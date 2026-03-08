# Deluge JSON-RPC Research Prompt - ARCHITECT PASS

> **DIRECTIVE:** Focus strictly on the **Protocol Architecture, Authentication, and Stability**.
> - Detail the connection handshake, session handling, and error codes.
> - Identify specific version incompatibilities (1.x vs 2.x).
> - Document known bugs, quirks, and connection edge cases.

---

## Purpose

Export this prompt to another LLM for deep research on Deluge Web API **connection architecture and stability**.

---

## Context

You are researching the **Deluge Web API (JSON-RPC)** for integration into a browser extension called "CTRL" that manages BitTorrent clients.

**Current Implementation (455 Lines) Supports:**
- Multi-step handshake: `auth.login` → `web.connected` → `web.connect`
- JSON-RPC via `/json` endpoint
- Session cookie-based authentication
- Auto-reconnection on session expiry
- Plugin detection (`core.get_enabled_plugins`, `system.listMethods`)
- Plugin-based labeling (Label plugin required)

**Current Code Structure:**
```typescript
@injectable()
export class DelugeAdapter implements ITorrentClient {
    private requestId = 0;
    
    async login(): Promise<void> {
        // Step 1: Authenticate
        const authResult = await this.call<boolean>('auth.login', [this.config.password || '']);
        if (!authResult) throw new Error('Deluge auth failed');
        
        // Step 2: Check connection status
        const connected = await this.call<boolean>('web.connected');
        if (!connected) {
            // Step 3: Get hosts and connect
            const hosts = await this.call<[string, string, number, string][]>('web.get_hosts');
            if (hosts.length > 0) {
                await this.call('web.connect', [hosts[0][0]]);
            }
        }
    }
    
    async ensureAuth<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (e) {
            if (e instanceof Error && e.message.includes('not authenticated')) {
                await this.login();
                return await action();
            }
            throw e;
        }
    }
}
```

**Known Issues:**
- Session cookie expires without warning
- Multi-daemon switching complexity
- Plugin availability varies by installation

---

## Research Tasks (ARCHITECT FOCUS)

### 1. Authentication & Session Architecture
- How does Deluge WebUI session management work internally?
- Session cookie name and lifecycle (expiration timing)
- `auth.login` vs `auth.check_session` - when to use each
- What triggers session invalidation?
- Concurrent session behavior (multiple browser tabs)

### 2. Multi-Daemon Architecture
- `web.get_hosts` response format in detail
- Host tuple structure: `[id, hostname, port, status]`
- `web.connect` / `web.disconnect` mechanics
- What happens when connected daemon goes offline?
- How to detect daemon online/offline status?

### 3. Connection Handshake Details
- Complete handshake sequence diagram
- Required order of API calls (strict or flexible?)
- Error states at each step and recovery
- Partial connection state handling
- Timeout values for each step

### 4. HTTPS/TLS Configuration
- Default HTTPS setup in Deluge WebUI
- Self-signed certificate handling
- Browser extension constraints with CORS
- Reverse proxy compatibility (Nginx, Traefik)
- Mixed content blocking concerns

### 5. Error Handling & Edge Cases
- JSON-RPC error format (code, message structure)
- "Not authenticated" error variations
- Session timeout mid-operation behavior
- Daemon unreachable scenarios
- Corrupt configuration handling
- Rate limiting (if any)

### 6. Version Compatibility
- Deluge 1.3.x vs 2.x API differences
- Method availability by version
- Response format changes between versions
- How to detect Deluge version via API
- Graceful degradation strategies

---

## Expected Output Format

Please provide:
1. **Connection Handshake Sequence** - Complete step-by-step flow diagram
2. **Authentication State Machine** - Session states and transitions
3. **Error Code Reference** - JSON-RPC error mapping
4. **Multi-Daemon Workflow** - Host switching protocol
5. **Version Compatibility Matrix** - 1.x vs 2.x differences
6. **Security Recommendations** - Browser extension session handling

---

## Additional Resources (if accessible)
- Deluge WebAPI documentation
- Deluge source code (deluge-web)
- Community implementations (Sonarr, Radarr, Jackett)
- Deluge RPC specification

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Comprehensive Technical Analysis of the Deluge JSON-RPC Interface for 'CTRL' Extension Architecture1. Architectural Overview and Protocol FundamentalsThe development of the 'CTRL' browser extension requires a rigorous understanding of the underlying communication architecture utilized by the Deluge BitTorrent client. Unlike monolithic torrent clients where the user interface and the protocol engine reside in the same process memory space, Deluge employs a split-core client-server model. This architecture fundamentally dictates the design of any external controller, such as a browser extension. The core application, known as the daemon (deluged), runs as a background process, handling the BitTorrent protocol, file system operations, and peer networking. The user interface—in this context, the deluge-web service—runs as a separate process, often on a different machine or port, communicating with the daemon via a proprietary RPC protocol (Rencode) while exposing a JSON-RPC API to external HTTP clients.1For the 'CTRL' extension, the deluge-web service acts as an API Gateway. The extension does not communicate with the deluged daemon directly; instead, it sends JSON-formatted commands over HTTP to the Web UI, which then translates these commands into internal RPC calls to the daemon. This introduces a "double-hop" latency and a complex state machine where the extension must maintain a valid HTTP session with the Web UI and verify that the Web UI maintains an active RPC connection with the daemon. Failure to distinguish between these two connection states is the primary cause of instability in third-party Deluge integrations.31.1 The JSON-RPC Implementation over Twisted WebThe Deluge Web UI is built upon the Twisted framework, an event-driven networking engine written in Python.5 This implementation detail is critical for the 'CTRL' extension developer because Twisted operates on a single-threaded reactor loop. While it handles Input/Output (I/O) asynchronously, CPU-bound tasks or blocking calls within the Web UI can stall the entire interface. The JSON-RPC API endpoint is typically exposed at /json relative to the web root.1The protocol adheres to the JSON-RPC 1.0 specification, although it exhibits some characteristics of 2.0 (such as the error object structure). A crucial distinction in Deluge’s implementation is the strict requirement for the id field in requests. While the JSON-RPC specification allows for "Notifications" (requests without an id that do not expect a response), the Deluge Web API requires an identifier to map asynchronous responses from the daemon back to the correct HTTP request context.31.2 Transport Layer SpecificationsThe communication between the 'CTRL' extension and the Deluge Web API occurs exclusively over HTTP/1.1 or HTTP/1.0.HTTP Method: The API strictly enforces the use of the POST method for all RPC calls. GET requests to the /json endpoint typically result in a 405 Method Not Allowed or a generic server error, as the request body parser expects a JSON payload.6Content-Type: The standard application/json header is expected. Some variations of the server may tolerate text/plain or missing headers, but for stability across versions (1.x and 2.x), strict adherence to application/json is recommended.6Compression: The Web UI supports gzip compression. Given that methods like web.get_torrents_status can return massive datasets (hundreds of kilobytes of JSON text for large libraries), the 'CTRL' extension must negotiate compression via the Accept-Encoding: gzip header to minimize latency and bandwidth consumption.61.3 Request and Response AnatomyA valid transaction consists of a request envelope and a response envelope. The symmetry of these envelopes allows the 'CTRL' extension to implement a predictable parsing logic.1.3.1 The Request EnvelopeThe extension must construct a JSON object with three mandatory keys:JSON{
  "method": "namespace.function_name",
  "params": [ "arg1", "arg2" ],
  "id": 12345
}
Method (method): A dot-notation string. Deluge namespaces (e.g., auth, web, core) are critical for routing.Parameters (params): This must always be an array (list), even for methods requiring a single argument. Passing a single value directly (e.g., "params": "password") will trigger a JSON-RPC Error: Invalid Params or a server-side TypeError.3Identifier (id): An integer or string. Using a monotonic counter or a UUID is best practice to track concurrent requests, especially given the asynchronous nature of the backend.1.3.2 The Response EnvelopeThe server replies with a uniform structure, regardless of success or failure:JSON{
  "result": <Any>,
  "error": <Object|null>,
  "id": 12345
}
Result (result): Contains the requested data on success. It is null if an error occurred.Error (error): This field is null on success. If an exception is raised, it contains an object describing the fault. The presence of a non-null error field is the primary trigger for the extension's exception handling logic.32. Authentication Architecture and Session ManagementSecurity in the Deluge Web API is managed through a session-based authentication system. This system is entirely distinct from the daemon's internal authentication. The 'CTRL' extension must successfully negotiate the Web UI's authentication layer before it can attempt to access any torrent data.2.1 The auth.login MechanismThe entry point for any session is the auth.login method. The Deluge Web UI utilizes a single password for access; there is no default username concept in the 1.x Web UI, although internal logic often references a default user (often 'admin' or purely purely session-based). In Deluge 2.x, multi-user support was introduced, but the default configuration often remains a single password for the localclient or admin user.9The Login Request:JSON{
  "method": "auth.login",
  "params": ["<password>"],
  "id": 1
}
The password parameter is transmitted in plain text within the JSON payload. This highlights the absolute necessity of securing the transport layer with TLS (HTTPS), as discussed in the Security Recommendations section. The default password for a fresh installation is "deluge".1The Login Response:Success: {"result": true, "error": null, "id": 1}. The server also sets the _session_id cookie in the HTTP response headers.Failure: {"result": false, "error": null, "id": 1} or an Error object if the request was malformed. Note that a wrong password typically returns false as the result rather than a JSON-RPC error code, requiring the extension to check the boolean value of result.32.2 The _session_id Cookie LifecycleUpon a successful auth.login call, the server generates a session identifier. The generation logic involves MD5 hashing the login name, a timestamp, and random bits.10 This ID is returned as an HTTP cookie:HTTPSet-Cookie: _session_id=<32-character-hex-string>; Expires=<Date>; Path=/json
Critical Implementation Detail for Extensions:Browser extensions typically share the "cookie jar" of the browser process for the domain they are accessing.Automatic Management: If the 'CTRL' extension uses standard fetch or XMLHttpRequest with credentials: 'include' (or appropriate manifest permissions), the browser will automatically attach the _session_id cookie to subsequent requests.Shared Session State: If the user has a tab open pointing to the Deluge Web UI, the extension and that tab share the same session. If the extension calls auth.delete_session (logout), the user's tab will be logged out. Conversely, if the user logs out in the tab, the extension's subsequent background requests will fail with Not Authenticated.132.3 Session Timeout ConfigurationThe duration of a valid session is governed by the session_timeout parameter in the web.conf file.Default Value: 3600 seconds (1 hour).5Mechanism: The server checks the last access time of the session on every request. If the idle time exceeds the timeout, the session is purged from the sessions dictionary in memory.User Workarounds: Because the 1-hour default is often considered too short for persistent monitors (like an extension), users frequently modify web.conf to set this value to 31536000 (1 year).16Extension Strategy: The 'CTRL' extension cannot rely on the user having increased this timeout. It must implement a robust re-authentication loop. When a request fails with an authentication error, the extension should attempt to re-login using the stored password and retry the original request once.Stability Warning: Setting the session timeout to excessively large values (e.g., 9999999999999) has been documented to cause OverflowError: date value out of range and JSON-RPC Error Code 3 in the backend Python code, crashing the auth check.18 The extension should not encourage users to set unsafe integer values.2.4 Multi-Tab and Concurrent Session HandlingIn the server.py and auth.py source code, sessions are stored in a dictionary keyed by the session ID. This implies that the server supports multiple concurrent sessions from different clients (e.g., a browser tab and a separate API client using a different cookie store). However, browser restrictions on unique cookies per domain usually force the extension to share the session with the browser tab.Conflict Resolution:To avoid "Session thrashing" (where the extension and a user tab fight for session validity), the 'CTRL' extension should perform a "Check before Login" operation:Call web.connected() or auth.check_session().If the result is true, reuse the existing session.Only call auth.login if the check returns false or an error.133. The Connection Handshake and State MachineA common misconception is that logging in (auth.login) grants access to torrents. It does not. The 'CTRL' extension must navigate a strict state machine to bridge the Web UI to the Daemon.3.1 The Two-Gate ArchitectureGate 1: The Web Session (HTTP Layer). Controlled by auth.login. Grants access to web.* methods.Gate 2: The Daemon Connection (RPC Layer). Controlled by web.connect. Grants access to core.* methods.Calls to core.get_torrents_status will fail with "Unknown Method" or "Not Connected" errors if Gate 1 is open but Gate 2 is closed.3.2 The Handshake SequenceThe following sequence is the definitive handshake protocol for a robust client. The extension must execute these steps in order upon initialization or connection loss.Step 1: Verify Web ConnectivityMethod: web.connected()Parameters: ``Response: true or false.1Logic: If true, the handshake is complete; the client can proceed to core operations. If false, proceed to Step 2.Step 2: Retrieve Available DaemonsMethod: web.get_hosts()Parameters: ``Response (Deluge 1.x): A list of tuples, e.g., [["<host_id>", "127.0.0.1", 58846, "Connected"]].20Response (Deluge 2.x): Similar structure, but serialized as lists due to Python 3 JSON behavior.Analysis: This method reveals all daemons configured in the hostlist.conf file. The extension must parse this list to find a target.Selection Logic: The extension should prioritize a host with status "Connected" or "Online". If multiple are online, it typically defaults to the first one or a user-configured choice.Step 3: Check Daemon Status (Optional but Recommended)Method: web.get_host_status(host_id)Parameters: ["<host_id>"]Response: ["<host_id>", "Online", "2.0.3"].21Logic: This confirms the daemon is reachable before attempting a connection. If the status is "Offline", web.connect will fail or hang.Step 4: Establish Daemon ConnectionMethod: web.connect(host_id)Parameters: ["<host_id>"]Response: A list of strings representing the methods exposed by the daemon (e.g., ["core.add_torrent_url", "core.get_config",...]).3Significance: Receiving this list is the confirmation that the Rencode bridge is active. The extension can now invoke core.* methods.3.3 The default_daemon ConfigurationThe web.conf file contains a default_daemon key. If populated with a Host ID, the Web UI attempts to auto-connect to this daemon on startup.12Risk: If the default_daemon is offline or the ID has changed (common if the hostlist.conf is regenerated), the auto-connect fails, and web.connected() remains false.Recommendation: The 'CTRL' extension must not rely on auto-connect logic. It must always actively verify the connection and perform web.connect if necessary.234. Multi-Daemon Workflow and Host ManagementDeluge is designed to manage multiple daemons (e.g., a local daemon and several remote seedboxes) from a single Web UI. The 'CTRL' extension must account for this one-to-many relationship.4.1 Host List Data StructuresThe data returned by web.get_hosts provides the necessary metadata for connection decisions.Deluge 1.3.x Structure:The response is a list of tuples.JSON["<32-char-sha1-hash>", "hostname", port, "status_string"]
The status string in 1.3.x typically reflects the internal connection state, e.g., "Connected", "Online", or "Offline".20Deluge 2.x Structure:The response remains a list of lists (JSON arrays).JSON["<32-char-sha1-hash>", "hostname", port, "status_string", "<optional-version-info>"]
Note that 2.x may append additional version information to the list or change the status string capitalization (e.g., "online" vs "Online"). The extension's parser should be case-insensitive regarding status strings.4.2 Handling "Offline" DaemonsIf a user selects a daemon that is "Offline", the Web UI cannot start it remotely unless it is a localhost daemon managed by the classic mode (which is deprecated in Web UI contexts).Workflow: If the target daemon is offline, the extension should display an error state to the user ("Daemon Unreachable") rather than endlessly retrying web.connect, which will likely time out or return a connection refused error.235. Error Handling References and Edge CasesThe robustness of the 'CTRL' extension depends entirely on how it handles the specific error codes returned by the JSON-RPC interface. Unlike REST APIs that rely on HTTP status codes (401, 403, 500), Deluge frequently returns HTTP 200 OK even when the JSON-RPC call fails. The error is encapsulated in the error field of the JSON body.5.1 JSON-RPC Error Code ReferenceThe following table synthesizes the error codes identified in the source code and documentation.7Error CodeError Message / ExceptionTrigger ConditionRecovery StrategynullNoneSuccessful execution.Process result object.1Not authenticatedThe _session_id cookie is missing, invalid, or expired.1. Drop current session.  2. Execute auth.login.  3. Retry request.2Unknown methodThe requested method does not exist. Common when calling core.* methods while disconnected from the daemon.1. Check web.connected().  2. If false, perform Handshake (Step 2-4).  3. If true, method is truly missing (version mismatch).3Internal errorUnhandled exception in Python code (e.g., date value out of range, OverflowError).Log error details. Do not retry immediately; this usually indicates a server-side config issue (e.g., bad timeout value).184RPC Request failedFailure in the Rencode bridge between Web UI and Daemon.1. Wait for backoff period.  2. Check web.get_host_status.  3. Reconnect if daemon restarted.5Auth level too lowNotAuthorizedError. The user's auth level (Read-Only) is insufficient for the action (e.g., removing torrents).Alert user to check auth file permissions. This is a permanent error for the session.-32600Invalid RequestMalformed JSON or missing id.Fix request payload syntax.-32601Method not foundStandard JSON-RPC equivalent of Code 2.Same as Code 2.-32700Parse errorInvalid JSON sent to server.Verify Content-Type and JSON syntax.5.2 The "NotAuthorizedError" (Code 5) NuanceDeluge 2.x enforces authentication levels rigorously.Level 1 (Read Only): Can call web.get_torrents_status but fail on core.add_torrent_magnet.Level 5 (Normal): Can add/remove torrents.Level 10 (Admin): Can change global preferences.If the extension receives Code 5, it means the session is valid, but the user account associated with the daemon connection lacks privileges. This cannot be fixed by re-logging in; the user must update their auth file configuration.95.3 Exception Handling in TwistedThe Twisted framework wraps exceptions in Failure objects. When these propagate to the JSON-RPC handler, they are serialized into the error object.Serialization Failures: In some versions of Deluge (particularly early 2.x builds), the Failure object itself was not JSON-serializable, leading to a "double fault" where the server would try to send an error, fail to serialize it, and hang or return a generic 500 error.28 The extension should implement a timeout on all requests to handle these silent server-side crashes.6. Version Compatibility: Deluge 1.3.x vs 2.xDeluge 2.0 represented a major rewrite, migrating from Python 2.7 to Python 3. This migration introduced subtle but breaking changes in the API that the 'CTRL' extension must handle to support the installed base.6.1 Data Type Changes (Python 2 vs 3)Tuples vs. Lists: Python 2.7 (Deluge 1.3) heavily utilized tuples for immutable data structures (e.g., host lists, file progress). Python 3's json module serializes tuples as lists.Impact: An extension checking if (Array.isArray(response)) works for both, but if the code relies on specific index positions that shifted or strictly validated types, it may break.Strings vs. Bytes: Python 3 distinguishes strictly between strings (Unicode) and bytes. Deluge 2.x had teething issues where binary data (like pieces of a torrent or certain info-hashes) might be returned as encoded strings or raise encoding errors. The extension should expect hex-encoded strings for binary data (like hashes) rather than raw bytes.296.2 Plugin IncompatibilityPlugins are a major source of API variance.Namespace Packaging: Plugins in 2.x use namespace packaging.Impact on 'CTRL': If the extension interacts with plugins (e.g., Label or AutoAdd), the method names might have changed or the plugins might simply fail to load in 2.x.Specific Error: Calls to plugin methods (e.g., label.get_labels) in 2.x when the plugin is broken or incompatible often return Code 2 (Unknown Method) or Code 3 (Internal Error) with a NoneType has no attribute 'call' message in the server logs.30 The extension should treat plugin-related errors as non-critical (soft fail) to avoid breaking core functionality.7. Security Recommendations and ConfigurationIntegrating a browser extension with a local server exposes several security vectors.7.1 HTTPS and Mixed ContentBrowsers block "Mixed Content" (loading HTTP resources from an HTTPS context). If the user browses a secure site, the 'CTRL' extension (if injected as a content script) may be blocked from querying http://localhost:8112.Recommendation: Force users to configure HTTPS in web.conf:JSON"https": true,
"pkey": "ssl/daemon.pkey",
"cert": "ssl/daemon.cert"
Self-Signed Certificates: Deluge generates self-signed certs by default. These cause ERR_CERT_AUTHORITY_INVALID.Workaround: The extension cannot silently bypass this in Manifest V3. The user must manually navigate to https://localhost:8112 in a tab and accept the security exception once for the browser to allow subsequent XHR requests from the extension.327.2 Cross-Origin Resource Sharing (CORS)This is the most significant hurdle. The standard json_api.py implementation in Deluge does not include Access-Control-Allow-Origin headers.33The Problem: Browser security prevents an extension from reading the response of an API call to a different origin (e.g., localhost) unless the server explicitly allows it.Manifest V3 Solution: The 'CTRL' extension must declare host permissions in manifest.json.JSON"host_permissions": [
  "http://localhost:8112/*",
  "https://localhost:8112/*"
]
This signals the browser to strip CORS restrictions for requests initiated by the extension background script.Reverse Proxy: For advanced users, running Deluge behind Nginx with add_header Access-Control-Allow-Origin *; is a robust solution.35Monkey Patching: Some users modify deluge/ui/web/json_api.py to inject headers. This is discouraged as it breaks on updates.337.3 Input Sanitization and XSSDeluge has a history of XSS vulnerabilities in the Web UI.36Risk: A malicious torrent could have a name containing <script>. If the 'CTRL' extension blindly renders this name in its popup HTML, the script executes with the extension's privileges.Defense: The extension must escape all data received from the API before inserting it into the DOM. Use textContent instead of innerHTML.8. Implementation Strategy and Best PracticesTo ensure stability, the 'CTRL' extension should adopt the following architectural patterns:8.1 The "Check-then-Act" PatternNever assume a state. Before performing a batch operation (e.g., pausing all torrents):Check web.connected().If disconnected, run the Handshake.Perform the operation.8.2 Batching and ConcurrencyThe Twisted reactor is single-threaded. Sending 100 simultaneous core.get_torrent_status requests (e.g., updating a list row by row) will degrade performance and potentially cause timeouts.13Best Practice: Use web.update_ui or core.get_torrents_status (plural) to fetch data in a single payload. These methods are optimized to return a dictionary of all torrents in one round trip.8.3 State Polling vs. EventsDeluge supports an event system, but it is complex to consume over stateless HTTP JSON-RPC.Recommendation: Implement a polling interval (e.g., 2-5 seconds) calling web.update_ui. This method is designed for differential updates, reducing bandwidth.8.4 The "Keep-Alive" HeartbeatTo prevent the session_timeout from expiring during active use:The polling loop acts as a keep-alive.If the extension goes idle (e.g., popup closed), the session will eventually time out. The next opening of the popup must anticipate a Code 1 error and handle the login prompt transparently if the credentials are stored.9. ConclusionThe Deluge Web API offers a powerful, albeit complex, interface for external control. Its split architecture, requiring distinct authentication for the Web UI and the Daemon, necessitates a sophisticated state machine in the 'CTRL' extension. By implementing the "Two-Gate" handshake, handling the nuanced error codes (particularly Code 1 vs Code 5), and adhering to strict version compatibility checks for 1.x and 2.x, the extension can provide a stable and responsive user experience. Furthermore, respecting the security constraints of CORS and HTTPS through Manifest V3 permissions is essential for modern browser compatibility.