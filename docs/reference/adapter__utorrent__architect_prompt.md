# µTorrent (uTorrent) Web API Research Prompt - ARCHITECT PASS

> **DIRECTIVE:** Focus strictly on the **Protocol Architecture, Authentication, and Stability**.
> - Detail the connection handshake, session handling, and error codes.
> - Identify specific version incompatibilities (2.x vs 3.x).
> - Document known bugs, quirks, and connection edge cases.

---

## Purpose

Export this prompt to another LLM for deep research on µTorrent Web API **connection architecture and stability**.

---

## Context

You are researching the **µTorrent (uTorrent) Web API** for integration into a browser extension called "CTRL" that manages BitTorrent clients. We already have a working `UTorrentAdapter` implementation (185 lines, TypeScript) that supports:

- Token-based authentication via `/gui/token.html`
- Basic Auth header for credentials
- Query-string based API calls to `/gui/`

**Note:** This API is largely undocumented and reverse-engineered from the WebUI.

**Current Implementation:**
```typescript
// From UTorrentAdapter.ts - Token extraction
async login(): Promise<void> {
    const headers = this.getAuthHeaders();
    const response = await this.httpClient.get<string>('gui/token.html', { headers });

    const parser = new DOMParser();
    const doc = parser.parseFromString(response, 'text/html');
    const tokenDiv = doc.getElementById('token');
    if (tokenDiv && tokenDiv.textContent) {
        this.token = tokenDiv.textContent;
    } else {
        throw new Error('Failed to retrieve uTorrent token');
    }
}
```

---

## Research Tasks (ARCHITECT FOCUS)

### 1. Authentication Architecture
- Token extraction from `/gui/token.html`
- Token expiration behavior
- Basic Auth requirements (always required?)
- Token refresh strategies

### 2. Connection Protocol
- Query-string based API pattern
- HTTPS enforcement options
- IP-based access control
- CORS behavior

### 3. Session Management
- Token lifecycle and validity
- Concurrent session handling
- Session recovery after timeout
- Keep-alive patterns

### 4. Error Handling
- Error response format (HTTP codes vs JSON?)
- Token expiration detection
- Connection timeout behavior
- Invalid request handling

### 5. Version Compatibility
- µTorrent 2.x vs 3.x API differences
- BitTorrent client compatibility
- Deprecated endpoints
- Feature detection methods

### 6. Security Considerations
- Basic Auth over HTTP risks
- Token leakage in URLs (query strings)
- Recommended configurations for remote access
- Self-signed certificate handling

---

## Expected Output Format

Please provide:
1. **Authentication Flow Diagram** - Token extraction and usage
2. **Token Lifecycle** - Expiration and refresh patterns
3. **Error Response Format** - How errors are communicated
4. **Version Compatibility Matrix** - 2.x vs 3.x differences
5. **Security Recommendations** - Safe remote access configuration
6. **Known Quirks** - Undocumented behavior patterns

---

## Additional Resources (if accessible)
- µTorrent Web API forum posts
- BitTorrent Inc legacy documentation
- Reverse-engineering notes from community projects
- Sonarr/Radarr µTorrent implementation

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

µTorrent Web API Protocol Architecture: A Comprehensive Integration Analysis1. Executive SummaryThe integration of the µTorrent (uTorrent) Web API into the "CTRL" browser extension represents a significant architectural challenge, necessitating a departure from modern RESTful integration patterns. Unlike contemporary APIs that rely on standardized OAuth2 flows, semantic versioning, and self-describing JSON objects, the µTorrent WebUI (Web User Interface) exposes a legacy Remote Procedure Call (RPC) interface over HTTP. This interface is characterized by its reliance on positional data structures, a unique and often misunderstood token-cookie handshake, and a strict dependency on undocumented internal state identifiers.This report serves as the definitive architectural blueprint for the implementation of the UTorrentAdapter. It synthesizes data from community reverse-engineering efforts, legacy forum discussions, and empirical behavior analysis of uTorrent versions 2.x and 3.x. The central finding of this research is that the stability of the connection is not determined solely by the possession of a valid authentication token, but rather by the precise synchronization of a server-generated GUID session cookie with that token. Failure to maintain this binding—common in stateless HTTP client implementations—results in the prevalent "Invalid Request" feedback loop that plagues many third-party integrations.Furthermore, the data transport layer utilizes high-density JSON arrays where field meaning is determined solely by index position. This architecture requires the adapter to implement a rigid version detection strategy to handle the schema divergence between the lightweight uTorrent 2.x branch (favored by private tracker communities) and the feature-rich, albeit heavier, 3.x branch. The report details the bitwise logic required to decode torrent states, the differential update mechanism for bandwidth optimization, and the security implications of managing basic authentication credentials within a browser extension context.The analysis provided herein moves beyond simple functional documentation to offer a robust stability framework, ensuring the CTRL extension can manage connections with the resilience of a native client, handling edge cases such as token expiration, server restarts, and version mismatches with transparency to the end-user.2. The Protocol Ecosystem and Historical ContextTo architect a stable adapter, one must first understand the provenance of the µTorrent Web API. It was not designed as a public-facing API for third-party developers but rather as a backend for the proprietary WebUI frontend—a generic HTML/JavaScript application served directly by the uTorrent client.2.1 The "Internal API" ParadigmBecause the API was intended solely for the official WebUI, there is no official documentation, Swagger definition, or changelog. The "API" is effectively the set of HTTP endpoints that the official webui.zip JavaScript code calls to render the interface. This implies that the protocol is subject to silent changes, deprecated parameters, and quirky behaviors that exist solely to support the specific implementation details of the official frontend.For the "CTRL" extension, this means the UTorrentAdapter is essentially emulating a browser session. It must behave exactly as the official WebUI behaves, sending the same headers, respecting the same cookie mechanics, and reacting to the same error codes. Any deviation from this emulated behavior risks triggering the server's anti-CSRF protections or malformed request handlers.2.2 The Split: µTorrent 2.x vs. 3.xThe uTorrent ecosystem is deeply fractured. A significant portion of the advanced user base—the primary demographic for a tool like "CTRL"—remains on uTorrent version 2.2.1 (Build 25302) due to widely publicized concerns regarding the "bloat," advertising, and stability issues introduced in version 3.0.2This schism creates a requirement for dual compatibility.The 2.x Architecture: Characterized by stability, low resource usage, and a static API response format. It supports the core features but lacks newer metadata fields like "Date Added" or "Date Completed."The 3.x Architecture: Introduced a revamped backend, significantly altering the ?list=1 response array by appending new fields. It also introduced stricter header validation and native support for magnet link resolution via the add-url action.1The UTorrentAdapter cannot simply target the latest version. It must implement a feature-detection or version-detection logic during the handshake phase to determine which data schema to apply. Failing to do so will result in index-out-of-bounds errors or data misalignment (e.g., displaying a timestamp as a file size) for users on older clients.3. Authentication Architecture: The Token-Cookie BindingThe authentication mechanism is the single most critical component of the integration. Research indicates that the majority of connection stability issues stem from a misunderstanding of the "Three-Legged Handshake" required by the protocol. It is not enough to simply extract a token; the client must participate in a stateful session.3.1 The Three-Legged HandshakeModern APIs typically issue a bearer token that is sufficient on its own for authentication. µTorrent, conversely, uses a paired authentication model designed to prevent Cross-Site Request Forgery (CSRF). This model requires three distinct elements to be present in every request:HTTP Basic Authentication Header: Validates the user's credentials.The Anti-CSRF Token: Proves the request originated from a trusted context.The GUID Cookie: Links the request to the specific server session that generated the token.Phase 1: The Initial RequestThe session initiation begins with a GET request to the specific endpoint /gui/token.html.Request Headers: The adapter must send Authorization: Basic <base64(user:pass)>.Server Response:Status: 200 OK (assuming valid credentials).Headers: Crucially, the server sets a cookie: Set-Cookie: GUID=XVMGOIut0hCTJhy7f41W; path=/.5Body: An HTML fragment containing the token.Architectural Insight: Many HTTP clients (like the native fetch API or lightweight node clients) do not automatically persist cookies from a fetch response unless explicitly configured with a CookieJar. If the UTorrentAdapter ignores this Set-Cookie header, the authentication flow is already broken. The server generates an internal session mapped to this GUID. If subsequent requests arrive with the correct Token but missing the GUID, the server assumes the request is a forgery or a replay attack and rejects it with 400 Invalid Request.5Phase 2: Token ExtractionThe body of the token.html response is not JSON. It is a raw HTML div:HTML<html><div id='token' style='display:none;'>n0Y7ezLlIYA8R0K54rEmHaTOraBQVSPDjQaGlQxlGso4jdVN1kRxtcfskEs=</div></html>
The adapter must parse this string. While a full DOMParser is robust, it acts on the assumption of a valid DOM environment. In a background script context, a regular expression is often more performant and reliable given the static nature of this specific HTML response:TypeScriptconst tokenMatch = responseText.match(/<div id='token'[^>]*>(.*?)<\/div>/);
const token = tokenMatch? tokenMatch : null;
This token is a session-specific secret. It is valid only when accompanied by the GUID cookie delivered in the same response.7Phase 3: The Authenticated SessionFor every subsequent API call (e.g., ?list=1), the adapter must present all three credentials:Authorization Header: Basic... (Persists for the life of the connection).Cookie Header: GUID=XVMGOIut0hCTJhy7f41W (The value extracted from Phase 1).Query Parameter: ?token=n0Y7... (The value extracted from Phase 2).The snippets confirm that failing to send the GUID cookie is the primary cause of the "works in browser, fails in code" phenomenon.5 In a browser, the GUID is automatically handled by the document's cookie storage. In a programmatic adapter, it must be manually managed.3.2 Token Lifecycle and ExpirationThe token is not permanent. It has a specific lifecycle governed by the server's internal clock and the user's activity.Expiration Duration: Tokens typically expire after 30 minutes of inactivity.9 This is a server-side setting and cannot be extended by the client.Keep-Alive: Regular activity (e.g., polling the list every 5 seconds) resets the expiration timer. As long as the adapter is polling, the token remains valid.Invalidation: If the uTorrent client is restarted, all active tokens and GUID sessions are invalidated immediately. The adapter will receive 400 Invalid Request on the next poll.3.3 Refresh StrategiesThe API lacks a specific "refresh token" endpoint found in OAuth protocols. The refresh strategy is, effectively, "start over."The Reactive Refresh Pattern:The adapter detects an authentication failure (HTTP 400 or 401).It pauses the polling queue.It re-executes the Phase 1 handshake (calling /gui/token.html).It updates the internal state with the new Token and new GUID.It retries the failed request.This "Reactive" approach is superior to a "Proactive" approach (e.g., getting a new token every 29 minutes) because it automatically recovers from unexpected events like server restarts or network interruptions that might invalidate the session regardless of time.104. Connection Protocol and Transport MechanicsThe µTorrent Web API transport layer is a product of its time—efficient for low-bandwidth scenarios but unconventional by modern standards. It operates almost exclusively via HTTP GET requests, using the query string as the command bus.4.1 Query-String RPC PatternThe API endpoints are constructed by appending parameters to the base /gui/ URL. The action parameter acts as the remote procedure call method name.Base URL: http://<host>:<port>/gui/Method Dispatch: ?action=<method_name>Arguments: &hash=<hash>, &s=<setting>, &v=<value>Critical Implementation Detail: The token parameter should theoretically be position-agnostic, but legacy documentation and community wisdom strongly suggest placing it as the first parameter in the query string (/gui/?token=...&list=1). This avoids potential parsing bugs in older uTorrent versions or embedded web servers that might truncate long query strings before reaching the token.94.2 HTTP Verbs: The GET DominanceUnlike REST, where GET retrieves and POST creates, uTorrent uses GET for almost everything, including destructive actions:State Change: GET /gui/?action=stop&hash=... stops a torrent.Configuration: GET /gui/?action=setsetting&s=...&v=... changes server preferences.Retrieval: GET /gui/?list=1 fetches data.The Exception: POST for FilesThe only operation utilizing POST is adding a .torrent file (action=add-file). This endpoint expects a multipart/form-data payload.Field Name: The file data must be assigned to the field named torrent_file.11Boundary Handling: The Content-Type header must correctly specify the boundary. In the "CTRL" extension, using the native FormData API is recommended as it automatically sets the correct headers. Manually constructing the multipart body is error-prone and unnecessary in a JS environment.124.3 IP Access Control and HeadersuTorrent implements an internal IP filter via the webui.restrict setting.Behavior: If an IP is not whitelisted, the server may drop the connection or return an error indistinguishable from an auth failure.CORS (Cross-Origin Resource Sharing): The built-in web server does not send CORS headers (Access-Control-Allow-Origin). This is a major hurdle for a browser extension.Implication: The "CTRL" extension cannot make direct XHR requests to a remote uTorrent instance from a content script injected into a generic web page.Solution: The adapter must run within the extension's background script (service worker). Extension background pages are privileged contexts that can bypass CORS if the target permissions are declared in manifest.json (host_permissions: ["http://*/*", "https://*/*"] or specific user-configured hosts).4.4 HTTPS and Self-Signed CertificatesGiven that Basic Auth transmits credentials in Base64 (effectively cleartext), usage over HTTP is a critical security vulnerability.13 HTTPS is mandatory for any usage outside a strict localhost LAN.Self-Signed Certs: Most users will rely on self-signed certificates generated by uTorrent or third-party tools.Browser Behavior: Browsers (and by extension, the "CTRL" adapter) will block requests to IPs with untrusted certificates. The extension cannot programmatically "accept" a bad cert.User Flow: The adapter must detect connection failures potentially caused by cert errors and prompt the user to open the WebUI URL in a new tab to manually "Accept/Proceed" past the browser's security warning. Once the user accepts the cert in the browser, the extension's background script requests will succeed.145. Data Serialization: The Positional Array ArchitectureThe most complex aspect of the uTorrent API is its data serialization format. To conserve bandwidth, uTorrent returns data as dense JSON arrays (Arrays of Arrays) rather than Arrays of Objects. This "Positional Schema" means the data has no keys; its meaning is derived entirely from its index in the array.5.1 The list=1 Response SchemaA call to /gui/?list=1 returns the central data structure for the client.JSON{
  "build": 25302,
  "label": [... ],
  "torrents":,
   ,
  "torrentc": "92842359"
}
5.2 The Index Map (The "Rosetta Stone")The UTorrentAdapter must implement a strict mapping of indices to properties. The following table represents the synthesized schema from various reverse-engineering documents.15IndexPropertyTypeDescription0HASHStringThe 40-character SHA1 hash of the torrent info. Unique ID.1STATUSIntegerBitmask representing the internal state (See Section 6).2NAMEStringDisplay name of the torrent.3SIZEIntegerTotal size in bytes.4PROGRESSIntegerProgress in per-mils (0-1000). 1000 = 100%.5DOWNLOADEDIntegerTotal bytes downloaded (verified).6UPLOADEDIntegerTotal bytes uploaded.7RATIOIntegerRatio in per-mils. 1000 = 1.0 ratio.8UP_SPEEDIntegerCurrent upload speed (bytes/sec).9DOWN_SPEEDIntegerCurrent download speed (bytes/sec).10ETAIntegerEstimated Time of Arrival in seconds. -1 = unknown.11LABELStringThe label/category assigned to the torrent.12PEERS_CONIntegerNumber of peers currently connected.13PEERS_SWARMIntegerTotal peers in the swarm.14SEEDS_CONIntegerNumber of seeds currently connected.15SEEDS_SWARMIntegerTotal seeds in the swarm.16AVAILABILITYIntegerAvailability in 1/65535ths.17QUEUE_ORDERIntegerCurrent position in the download queue.18REMAININGIntegerBytes remaining to download.Version 3.x Extended Fields:Starting with version 3.0, additional fields were appended to this array.19: Download URL (Source URL).420: RSS Feed URL (if applicable).21: Status Message (String) - Sometimes present.22: Stream ID.23: Date Added (Unix Timestamp) - Critical for sorting.24: Date Completed (Unix Timestamp).26: Save Path (Directory).17Architectural Risk: Accessing index 23 (Date Added) on a uTorrent 2.2.1 client will result in undefined. The adapter must check array.length before accessing indices > 18. If the length is <= 19, the adapter operates in "Legacy Mode," limiting features (e.g., disabling "Sort by Date Added").5.3 Differential Updates (CacheID)Parsing the full list of 5,000 torrents every 2 seconds is computationally expensive and bandwidth-intensive. The API provides a Differential Update mechanism via the cid (Cache ID) parameter.Mechanism:Initial Fetch: Client requests ?list=1. Server returns torrents array and torrentc (Cache ID, e.g., "12345").Polling Fetch: Client requests ?list=1&cid=12345.Server Response:torrentp (Patch): An array of torrents that have changed (status, speed, etc.) since Cache ID 12345.torrentm (Minus): An array of hashes for torrents that have been removed since Cache ID 12345.torrentc: A new Cache ID (e.g., "67890").Note: If the Cache ID is invalid or too old, the server simply returns the full torrents list again.Implementation Logic:The adapter must maintain a local Map<Hash, Torrent> cache.On receiving torrents (Full List): Clear Map, populate with new data.On receiving torrentp (Patch): Iterate array, update existing Map entries matching the Hash (Index 0).On receiving torrentm (Removed): Iterate array, delete matching keys from the Map.This ensures the UI stays responsive even with large libraries.6. The Status Bitmask: Decoding Internal StateThe integer at Index 1 (STATUS) is not a linear enum; it is a bitwise flag summation. This explains why snippets reference codes like 136 or 201. These numbers are the sum of multiple active state flags. To accurately report status to the user (e.g., "Downloading", "Seeding", "Queued"), the adapter must perform bitwise decoding.6.1 Bit Flag DefinitionsBased on reverse-engineering analysis 18, the flags are defined as:ValueConstant NameMeaning1STARTEDThe torrent is active (not stopped).2CHECKINGThe torrent is checking files (hashing).4CHECK-STARTThe torrent will start after checking.8CHECKEDThe torrent has finished checking files.16ERRORThe torrent has encountered a runtime error.32PAUSEDThe torrent is paused.64QUEUEDThe torrent is in the queue (waiting for slot).128LOADEDThe torrent is loaded in memory (always set).6.2 Decoding Logic MatrixThe adapter must evaluate these flags in a specific order of precedence to determine the user-facing string.Error Check: If (Status & 16) is true, the state is Error, regardless of other flags.Paused Check: If (Status & 32) is true, the state is Paused.Checking Check: If (Status & 2) is true, the state is Checking.Queued Check: If (Status & 64) is true AND (Status & 1) is false (not started), the state is Queued.Nuance: A torrent can be "Queued" and "Started" simultaneously (e.g., Status 233 = 128+64+32+8+1). This usually implies a forced pause or a specific queue state. However, typically, if it's strictly queued, it's waiting.Seeding vs Downloading: If (Status & 1) is true (Started):If Progress == 1000 (100%), the state is Seeding.If Progress < 1000, the state is Downloading.Stopped: If none of the above (specifically if STARTED bit is 0), the state is Stopped (or "Finished" if Progress is 100%).Common Status Codes Explained:136 (128 + 8): Loaded + Checked. The torrent is Stopped (Finished).137 (128 + 8 + 1): Loaded + Checked + Started. Seeding (if 100%) or Downloading.200 (128 + 64 + 8): Loaded + Queued + Checked. Queued (Waiting).201 (128 + 64 + 8 + 1): Loaded + Queued + Checked + Started. This is a common "active" state often seen when the torrent is technically in the queue list but currently transferring. Treat as Downloading/Seeding.7. Version Compatibility: The 2.x vs 3.x SchismThe CTRL extension must support both major versions. The architectural differences extend beyond data fields into behavior and stability.7.1 Compatibility MatrixFeatureµTorrent 2.x (Legacy)µTorrent 3.x (Modern)Adapter StrategyList Response19 Fields (Indices 0-18)29+ Fields (Indices 0-28)Check array.length. If > 20, enable v3 features.Add by URLLimited to HTTP links.Supports Magnet URIs natively via add-url.For v2.x, magnets may need conversion to .torrent files or specific handling.File PriorityBasic (Skip, Low, Norm, High)."Fine Grained" (1-15) priorities added later.Use standard 0-3 mapping. Treat 1-15 as ranges if encountered.Header ValidationLenient.Strict. Requires User-Agent and correct Cookies.Ensure headers are fully compliant.StabilityHigh. "Invalid Request" loops rare.Moderate. "Invalid Request" loops frequent due to aggressive timeouts.Implement robust retry logic (See Sec 8).Date AddedNot Available.Available (Index 23).Return null or 0 for v2.x. UI must handle missing dates.7.2 Feature DetectionInstead of asking the user "Which version are you using?", the adapter should perform Feature Detection during the login() phase.Method: Inspect the build number in the ?list=1 response ({"build": 25302,...}).Threshold: Generally, builds > 26000 are v3.x.Implementation: Store isLegacy boolean in the session state. If isLegacy is true, suppress requests for "Date Added" columns and fallback to standard priority settings.8. Operational Stability and Error RecoveryThe defining characteristic of the uTorrent Web API is its fragility regarding session state. The "Invalid Request" error is not just a syntax error; it is a session state error.8.1 The "Invalid Request" Loop (HTTP 400)This error occurs when the token provided does not match the server's expectation for the provided GUID cookie.Cause: The server has rotated the token (time expiry), or the uTorrent application was restarted (clearing server memory), or the client sent the token without the cookie.Symptom: The client sends a valid-looking request but receives 400 Invalid Request text/html response.Recovery Algorithm: The "Retry-on-400" Pattern.The adapter wraps all API calls in a execute() method.execute() attempts the fetch.If response is 400 or 401:Check retryCount. If > 1, throw "Authentication Failed".If retryCount == 0, trigger this.login().login() acquires a fresh Token and GUID.execute() retries the original request with the new credentials.This is transparent to the user and heals the connection automatically after server restarts or timeouts.8.2 Connection Timeouts & GhostingTimeout: If the uTorrent client is under heavy load (hashing terabytes of data), the WebUI thread may hang. The adapter must set a reasonable client-side timeout (e.g., 10 seconds) to avoid blocking the extension UI.Ghosting: After sending ?action=remove, the torrent may still appear in the ?list=1 response for a few seconds until the server's internal loop processes the removal.Mitigation: The adapter should optimistically remove the torrent from its local cache immediately upon sending the remove command, rather than waiting for the next polling cycle to reflect the deletion.9. Security Posture and Vulnerability AnalysisIntegrating with a local application that exposes a web server creates a unique threat model.9.1 Basic Auth VulnerabilitiesThe API uses HTTP Basic Auth. The header Authorization: Basic <base64> is sent with every request.Risk: Anyone sniffing the network traffic (on public Wi-Fi) can decode the Base64 string and obtain the user's uTorrent admin password.Mitigation: The "CTRL" extension must strongly advise or enforce HTTPS for any remote connection. For localhost connections, this is less critical but still best practice.9.2 Token LeakageThe CSRF token is passed as a Query Parameter (?token=...), not a header.Risk: Query parameters are logged in proxy logs, browser history, and server access logs.Implication: If an attacker gains access to logs, they have a valid session token. However, without the corresponding GUID cookie (which is a Header), the token is useless. This highlights the architectural importance of the Token-Cookie binding as a defense-in-depth measure.9.3 DNS RebindingLegacy versions of uTorrent were vulnerable to DNS Rebinding attacks where a malicious website could access the localhost WebUI.19Mitigation: Modern browsers and newer uTorrent builds have mitigations (Host header validation). The "CTRL" extension, acting as a legitimate client, does not exacerbate this, but users should be warned to keep their uTorrent client updated to at least v2.2.1 (patched) or v3.x to avoid underlying protocol vulnerabilities.10. Implementation Blueprint for UTorrentAdapterBased on this architectural analysis, the UTorrentAdapter class must implement the following structural elements.10.1 Class Structure (Conceptual)TypeScriptclass UTorrentAdapter {
    private session: { token: string | null; guid: string | null; };
    private cacheID: string | null;
    private build: number;

    /**
     * The Login Phase
     * 1. Fetches token.html
     * 2. Extracts GUID from Set-Cookie header (CRITICAL)
     * 3. Extracts Token from HTML div
     */
    async login(): Promise<void> {
        //... Implementation of Three-Legged Handshake...
    }

    /**
     * The Request Wrapper
     * Implements the Retry-on-400 logic.
     */
    private async request(action: string, params: object, retry = true): Promise<any> {
        try {
            // Construct URL: /gui/?token=XYZ&action=ABC...
            // Set Headers: Authorization AND Cookie: GUID=...
            const response = await fetch(...);
            
            if (response.status === 400 |

| response.status === 401) {
                if (retry) {
                    await this.login();
                    return this.request(action, params, false); // One retry only
                }
                throw new Error("Session Expired");
            }
            return await response.json();
        } catch (e) {
            // Handle network errors
        }
    }

    /**
     * Polling Routine
     * Uses CacheID for differential updates
     */
    async refreshList(): Promise<Torrent> {
        const params = { list: 1 };
        if (this.cacheID) params['cid'] = this.cacheID;
        
        const data = await this.request('list', params);
        
        if (data.torrentc) this.cacheID = data.torrentc;
        
        // Handle full list vs differential patch (torrentp)
        // Decode bitwise status flags
        // Map positional indices to Torrent objects
        return this.processData(data);
    }
}
10.2 Final Recommendations for "CTRL" TeamPrioritize the Cookie: Ensure the HTTP client library used in the extension allows manual management of the Cookie header or automatically persists cookies from responses. This is the #1 point of failure.Version Agnosticism: Write the parser to be defensive. Check array bounds before accessing fields like "Date Added" to seamlessly support the vocal uTorrent 2.x community.User Feedback: When "Invalid Request" loops occur (even with retries), inform the user specifically: "Connection lost. uTorrent may have restarted or the session timed out. Re-authenticating..." rather than a generic "API Error."By strictly adhering to this architectural report, the "CTRL" extension will achieve a level of stability and compatibility that exceeds standard integrations, respecting the legacy nuances of the µTorrent Web API while leveraging its hidden optimization features.