# ruTorrent / rTorrent XML-RPC Research Prompt - ARCHITECT PASS

> **DIRECTIVE:** Focus strictly on the **Protocol Architecture, Authentication, and Stability**.
> - Detail the connection handshake, session handling, and error codes.
> - Identify specific version incompatibilities (0.9.x vs 0.10.x).
> - Document known bugs, quirks, and connection edge cases.

---

## Purpose

Export this prompt to another LLM for deep research on rTorrent XML-RPC API **connection architecture and stability**.

---

## Context

You are researching the **rTorrent XML-RPC API** (accessed via ruTorrent) for integration into a browser extension called "CTRL" that manages BitTorrent clients. We already have a working `RuTorrentAdapter` implementation (313 lines, TypeScript) that supports:

- XML-RPC calls via `/RPC2` or `/rutorrent/plugins/httprpc/action.php`
- Basic Auth for HTTP authentication
- `d.multicall2` for listing torrents
- Manual XML parsing via txml library

**Current Implementation:**
```typescript
// From RuTorrentAdapter.ts - XML-RPC call structure
private async call(method: string, params: XmlRpcParam[] = []): Promise<XmlRpcResult> {
    const payload = this.buildXmlPayload(method, params);
    
    const response = await this.client.post<string>(this.rpcEndpoint, payload, {
        headers: this.headers,
        responseType: 'text'
    });
    
    const parsed = parse(response);
    return this.unwrapRpc(parsed);
}
```

---

## Research Tasks (ARCHITECT FOCUS)

### 1. Authentication & Endpoints
- Supported authentication methods (Basic, form, none)
- `/RPC2` vs `/rutorrent/plugins/httprpc/action.php` differences
- SCGI vs HTTP-RPC configuration detection
- Authentication challenge flow

### 2. Connection Architecture
- HTTPS and self-signed certificate handling
- CORS behavior of ruTorrent
- Reverse proxy configurations
- Socket path vs TCP connections

### 3. XML-RPC Protocol Details
- Request/response format
- Fault code handling
- Character encoding considerations
- Large payload handling

### 4. Error Handling & Edge Cases
- XML-RPC fault codes and messages
- Connection refused vs auth failure detection
- Malformed response handling
- Timeout and retry strategies

### 5. Version Compatibility
- rTorrent 0.9.x vs 0.10.x differences
- Method availability detection
- ruTorrent version detection
- Graceful degradation patterns

### 6. Security Considerations
- HTTP Basic Auth in browser extensions
- Credential storage best practices
- Recommended authentication configurations
- IP-based access control

---

## Expected Output Format

Please provide:
1. **Connection Flow Diagram** - Endpoint detection and auth
2. **XML-RPC Protocol Details** - Request/response format
3. **Error Code Reference** - Fault codes and meanings
4. **Endpoint Compatibility Matrix** - RPC2 vs httprpc
5. **Version Detection Strategy** - Identifying rTorrent version
6. **Security Recommendations** - Browser extension best practices

---

## Additional Resources (if accessible)
- rTorrent GitHub wiki (XML-RPC methods)
- ruTorrent GitHub (plugin documentation)
- pyrocore/rtorrent-ps documentation

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Architectural Specification: rTorrent XML-RPC Protocol Integration1. Architectural Overview and Ecosystem AnalysisThe integration of the rTorrent BitTorrent client into a modern browser-based extension environment, specifically under the constraints of the "CTRL" project, necessitates a rigorous examination of legacy protocol architectures, non-standardized API endpoints, and the security boundaries enforced by contemporary web browsers. rTorrent, distinguished by its high performance and low resource footprint, operates on a C++ codebase that exposes its control interface via the XML-RPC protocol transported over SCGI (Simple Common Gateway Interface).1 This architectural decision, while efficient for local inter-process communication, presents a significant impedance mismatch when interfacing with remote web clients. The primary challenge lies not merely in sending commands, but in navigating the fragmented ecosystem of gateway configurations—ranging from raw SCGI mounts to PHP-based wrappers like ruTorrent's httprpc plugin—and adapting to the breaking API changes introduced between the 0.9.x and 0.10.x release branches.3The prevailing architecture for remote rTorrent management involves a three-tier stack: the rTorrent daemon (the SCGI server), a web server (Nginx, Apache, or Lighttpd) acting as a reverse proxy or SCGI gateway, and a client interface (typically ruTorrent).5 For a browser extension to successfully interoperate with this stack, it must function as a polymorphic adapter, capable of detecting the server topology, negotiating authentication protocols (Basic, Digest, or Cookie-based), and dynamically adjusting its XML-RPC method signatures to match the underlying daemon version. This report provides a comprehensive technical analysis of these integration points, establishing a definitive reference for the protocol architecture, connection stability mechanisms, and security best practices required for a robust implementation.1.1 The SCGI to HTTP Bridge ProblemAt the core of the connectivity challenge is rTorrent’s reliance on SCGI. Unlike HTTP, SCGI is a binary protocol designed to be a simplified, faster alternative to CGI. It utilizes "netstrings" to encode headers and does not support standard HTTP semantics like CORS (Cross-Origin Resource Sharing) or Keep-Alive natively.2 Web browsers, and by extension the "CTRL" tool, speak HTTP/1.1 or HTTP/2. Consequently, a direct connection from a browser extension to the rTorrent daemon is technically impossible without an intermediary web server to translate HTTP requests into SCGI packets.This necessity for a translation layer introduces a "Gateway" architectural pattern. The web server (e.g., Nginx) accepts an XML-formatted HTTP POST request from the extension, parses the headers, opens a socket connection (Unix domain socket or TCP) to the rTorrent daemon, constructs an SCGI payload, and forwards the data. The daemon processes the XML-RPC command, returns an XML response via SCGI, which the web server then wraps in an HTTP 200 OK response to the client.6 This multi-stage pipeline creates distinct points of failure: the HTTP connection to the web server may succeed (200 OK), but the SCGI connection to the daemon may fail (502 Bad Gateway), or the XML-RPC execution may fail internally (Fault -504).7 Distinguishing between these failure modes is critical for providing accurate user feedback and implementing effective retry logic.1.2 The Role of ruTorrent and the httprpc PluginWhile advanced users may configure direct SCGI mounts (typically at endpoints like /RPC2), the ruTorrent web frontend introduces an alternative access paradigm via its httprpc plugin. This plugin was developed to circumvent the complexities of configuring SCGI support on shared hosting environments (seedboxes) where users might not have root access to modify web server configurations.1The httprpc plugin functions as an application-layer gateway. Instead of the web server performing the protocol translation, a PHP script (action.php) receives the HTTP request, utilizes a PHP XML-RPC client library to communicate with the local rTorrent socket, and relays the response.10 This adds a fourth tier to the stack: the PHP interpreter. This architectural nuance has profound implications for stability. PHP scripts are subject to execution time limits (max_execution_time) and memory limits (memory_limit). Large XML-RPC responses—such as a d.multicall request for a library of 5,000 torrents—may cause the action.php script to crash or time out, resulting in a truncated response or an HTTP 500 error, even if rTorrent itself is healthy.8 Thus, while the httprpc endpoint is more universally available, it is architecturally less stable for high-throughput data retrieval than a direct SCGI mount.2. Connection Architecture and TopologiesA robust RuTorrentAdapter must support multiple connection topologies. The diversity in server configurations, particularly between self-hosted home servers and commercial seedboxes, dictates that the extension cannot rely on a single hardcoded endpoint structure.2.1 Endpoint Topology MatrixThe following matrix synthesizes the common endpoint configurations identified in the research, categorized by their underlying mechanism and expected stability.Topology TypeStandard Endpoint PathMechanismAuth AuthorityStability RatingNotesDirect SCGI Mount/RPC2Web Server Module (mod_scgi, scgi_pass)Web Server (Basic/Digest)HighThe "Gold Standard." Direct pipe to daemon. Fastest parsing. Requires scgi_mount config. 8Alternative SCGI/RPC200, /xmlrpcWeb Server ModuleWeb ServerHighCommon on older setups or specific seedbox templates (e.g., QuickBox). 6ruTorrent Plugin/plugins/httprpc/action.phpPHP Script (action.php)Web Server / PHP SessionMediumSubject to PHP timeouts. path may vary based on rutorrent install root. 9ruTorrent Plugin (Nested)/rutorrent/plugins/httprpc/action.phpPHP ScriptWeb ServerMediumMost common path on commercial seedboxes. 11Root Mount/Web Server ModuleWeb ServerLowRare. Some dedicated servers map the root directly to RPC, but this conflicts with web UIs.Insight: The prevalence of the /rutorrent/plugins/httprpc/action.php endpoint is a direct result of shared hosting restrictions.11 Seedbox providers often host hundreds of users on a single Nginx instance. Configuring unique SCGI mount points (e.g., /user1/RPC2, /user2/RPC2) is complex to automate securely. However, because ruTorrent is almost always installed, the httprpc plugin provides a zero-configuration "side channel" for API access. The RuTorrentAdapter must prioritize the detection of this endpoint if the standard /RPC2 probe fails.2.2 Reverse Proxy Configurations and QuirksThe behavior of the API is heavily influenced by the web server acting as the reverse proxy. The "CTRL" extension must anticipate specific quirks introduced by Nginx and Apache.Nginx and scgi_pass:Nginx is the dominant server for rTorrent. A typical configuration involves defining a location block that passes traffic to a Unix socket.6Nginxlocation /RPC2 {
    include scgi_params;
    scgi_pass unix:/home/user/.rtorrent.sock;
    auth_basic "Restricted";
    auth_basic_user_file.htpasswd;
}
Stability Implication: If the user restarts rTorrent, the Unix socket file might be recreated with different permissions or ownership, preventing Nginx from writing to it. This results in a 502 Bad Gateway (HTTP) or a generic XML-RPC Fault -504 (Connection failed).15 The extension must interpret a -504 not as "Authentication Failed" but as "Daemon Unreachable," triggering a specific "Server Error" state rather than prompting for a password re-entry.Apache and mod_scgi:Older installations use Apache. A critical quirk of Apache configurations is the handling of the Authorization header. By default, some Apache configurations strip the Authorization header before passing the request to CGI/SCGI scripts for security reasons.1 If the extension uses the httprpc plugin (which is a PHP script), and Apache strips the header, authentication will fail even if the credentials are correct.Workaround: The user may need to add SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1 to their .htaccess. While the extension cannot fix this server-side, identifying this specific failure mode (valid credentials rejected repeatedly on action.php) allows for intelligent troubleshooting advice.2.3 HTTPS and Self-Signed Certificate HandlingSecurity best practices mandate the use of HTTPS, especially for seedboxes. However, a significant portion of the user base utilizes self-signed certificates or certificates issued by private CAs, particularly on internal networks or budget hosting.13The Browser Security Model: Modern browsers (Chrome, Firefox, Edge) impose strict validation on HTTPS connections initiated by extensions via the fetch API. If the certificate is invalid (e.g., self-signed), the request will fail instantly with a generic "Network Error" (often mapped to TypeError: Failed to fetch). The extension is architecturally prohibited from programmatically bypassing this check or inspecting the certificate details.The "Accept Risk" Workflow: The only viable architectural solution is to detect this specific network failure pattern (HTTPS scheme + immediate failure + unreachable endpoint) and prompt the user to manually intervene. The user must open the rTorrent web UI in a standard browser tab. Upon navigating to the URL, the browser will present the "Your connection is not private" warning. Once the user clicks "Advanced -> Proceed to [IP] (unsafe)," the browser caches this exception. Subsequent background requests from the extension to that origin will then succeed.6Recommendation: The extension should implement a "Connection Diagnostic" routine. If a connection fails, it should attempt to fetch the URL. If the error indicates a certificate issue (which may be inferred from the timing or generic network error on a reachable host), the UI must guide the user to perform the "manual acceptance" handshake.2.4 CORS (Cross-Origin Resource Sharing) ArchitectureCORS is arguably the most significant barrier to browser-based API integration. rTorrent, being a command-line daemon, has no concept of HTTP headers or CORS.16 The web server is responsible for injecting Access-Control-Allow-Origin.The Problem: Default rTorrent/ruTorrent installations do not send CORS headers.18 A standard web page script (Content Script) attempting to fetch('https://seedbox/RPC2') will be blocked by the browser because the seedbox domain does not allow the extension's origin.Manifest V3 Solution: Extensions utilizing Manifest V3 have a distinct advantage. Requests initiated from the Service Worker (Background Script) are not subject to CORS restrictions if the target domain is declared in the host_permissions section of manifest.json.19JSON"host_permissions": [
  "*://*/*" 
]
Or, more restrictively, requesting permissions for the specific user-configured URL at runtime.Architectural Mandate: All XML-RPC communication must originate from the extension's background context. The UI (popup or options page) must send messages to the background worker, which performs the fetch and returns the serialized data. This bypasses the need for the server to support CORS headers (Access-Control-Allow-Origin: *), rendering extensions like "Allow CORS" 21 unnecessary for the extension's internal function.3. Authentication and Session HandlingThe security architecture of rTorrent is decentralized; the daemon trusts any command arriving over the SCGI socket. Access control is entirely the responsibility of the gateway. The "CTRL" extension must negotiate three distinct authentication patterns.3.1 HTTP Basic AuthenticationThis is the industry standard for protecting RPC endpoints.1Protocol: The client sends the header Authorization: Basic <base64(user:pass)>.Flow: The server validates the header against a .htpasswd file.Browser Integration: The fetch API handles this cleanly. However, simply adding the username/password to the URL (https://user:pass@host.com) is deprecated and often blocked due to phishing risks. The adapter must explicitly construct the Authorization header.Security Insight: Basic Auth over HTTP is insecure (plaintext). Over HTTPS, it is secure. The risk lies in storage (see Section 6).3.2 HTTP Digest AuthenticationDigest authentication is a challenge-response protocol designed to prevent replay attacks and avoid sending passwords in plaintext.23Handshake Protocol:Client: Sends Request (no auth).Server: Responds 401 Unauthorized with header WWW-Authenticate: Digest realm="rTorrent", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="...", qop="auth".Client: Generates a cnonce (client nonce) and computes an MD5 hash of the data (HA1 = MD5(username:realm:password), HA2 = MD5(method:uri), Response = MD5(HA1:nonce:nc:cnonce:qop:HA2)).Client: Resends Request with header Authorization: Digest username="...", realm="...", nonce="...", uri="...", response="...".Server: Validates hash and responds 200 OK.Implementation Requirement: The RuTorrentAdapter must implement a Digest Auth logic manually or use a library that supports it, as the native fetch API does not automatically handle the 401 challenge negotiation for opaque origins in the same way a browser navigation does. Explicit handling of the 401 status code and parsing of the WWW-Authenticate header is required.253.3 Form-Based and Cookie AuthenticationWhen connecting via the httprpc plugin on a system like ruTorrent, the authentication might be governed by a PHP session.26Mechanism: The user logs in via a web form. The server sets a PHPSESSID cookie.The "Double Auth" Conflict: Often, the web server (Nginx) enforces Basic Auth on top of the PHP application's internal auth. Alternatively, the action.php script might check for a valid session and reject requests without it.Stability Strategy: The most robust method for an API client is to rely on Basic/Digest Auth headers. Most ruTorrent configurations are set to accept Basic Auth credentials passed to the web server as sufficient. Attempting to scrape login forms or reuse browser cookies is brittle (due to SameSite policies and cookie partitioning) and should be avoided. The adapter should strictly use Header-based authentication.4. XML-RPC Protocol DetailsThe structure of the data exchange is governed by the XML-RPC specification, but rTorrent's implementation via xmlrpc-c introduces specific data typing and encoding behaviors that must be handled precisely.4.1 Request Payload ArchitectureA valid request to the /RPC2 endpoint must follow this XML structure:XML<?xml version="1.0" encoding="utf-8"?>
<methodCall>
  <methodName>d.multicall2</methodName>
  <params>
    <param><value><string></string></value></param> <param><value><string>main</string></value></param> <param><value><string>d.name=</string></value></param> <param><value><string>d.size_bytes=</string></value></param> </params>
</methodCall>
Critical Variation for httprpc:When targeting action.php, sending raw XML in the body often fails. The PHP script expects the XML payload to be wrapped in a form parameter or passed via specific query arguments.28Payload: mode=xmlrpc&cmd=<URL_ENCODED_XML_PAYLOAD> or simply raw XML depending on the plugin version.Recommendation: To minimize complexity, the adapter should treat action.php as a standard XML-RPC endpoint first (sending Content-Type: text/xml). If the server responds with a parsing error or 200 OK but invalid body, the adapter should attempt the "form-wrapped" payload format utilized by web interfaces.4.2 Data Types and the 64-bit Integer ProblemrTorrent relies heavily on 64-bit integers (<i8>) to report file sizes and transfer totals (bytes uploaded/downloaded).30The XML-RPC Spec Divergence: The standard XML-RPC spec defines <int> or <i4> (32-bit signed). It does not officially standardize <i8>. However, xmlrpc-c (used by rTorrent) extensions allow <i8>.JavaScript Compatibility: JavaScript's Number type is a 64-bit float, which can only safely represent integers up to $2^{53} - 1$ (approx 9 Petabytes). While sufficient for most file sizes, precision loss can occur with cumulative stats.Architectural Requirement: The XML parser used by the extension must explicitly handle the <i8> tag. It should parse these values into JavaScript BigInt or Strings to prevent overflow or precision loss. Failing to handle <i8> will result in empty values or parser errors when querying d.size_bytes on large torrents.4.3 Character Encoding and UTF-8rTorrent is strictly UTF-8 compliant, but the transport layer can introduce corruption.The Issue: Torrent names containing non-ASCII characters (e.g., Emoji, Cyrillic, Kanji) can break the XML parser if the Content-Type header does not explicitly specify charset=utf-8.31Snippet Evidence: Issues with "Unrecognized UTF-8 initial byte" 31 suggest that if the adapter sends ISO-8859-1 or if the server response isn't handled as a UTF-8 stream, the XML parsing will crash.Resolution: The adapter must enforce Content-Type: text/xml; charset=utf-8 on all outgoing requests and force the response decoder to treat the stream as UTF-8.5. Version Compatibility and Stability StrategiesThe ecosystem is fractured between legacy rTorrent 0.9.x installs (common on "set and forget" home servers) and 0.9.7+ installs (standard on modern repositories). The RuTorrentAdapter must implement a dynamic compatibility layer.5.1 The d.multicall vs. d.multicall2 TransitionThis is the single largest source of instability for API clients.4rTorrent < 0.9.0: Used d.multicall.Signature: d.multicall <view> <cmd> <cmd>...rTorrent 0.9.x (Early): Introduced d.multicall2 but kept d.multicall with deprecation warnings.rTorrent 0.9.7+: Deprecated d.multicall. It may still exist but behaves inconsistently or is removed in forks. d.multicall2 is the standard.Signature: d.multicall2 <target> <view> <cmd> <cmd>...The Breaking Change: The insertion of the <target> parameter (usually an empty string '') in d.multicall2 shifts all subsequent arguments by one. Calling d.multicall2 with the d.multicall signature results in Fault -501: Unsupported target type found because the server interprets the view name ("main") as the target info-hash, which fails validation.45.2 The "Target" Parameter AnomalyIn modern rTorrent (0.9.7+), every command invocation via XML-RPC is strictly typed.Legacy: d.get_name could be called; the context was inferred or ignored.Modern: d.get_name MUST be called with a target info-hash: d.get_name("HASH..."). If the command is generic, it still often requires an empty string argument to satisfy the parser's expectation of a target slot.32Impact: The adapter cannot simply send system.method calls blindly. It must construct payloads that explicitly include the target hash for item-specific commands and '' (empty string) for generic commands where multicall requires it.5.3 Version Detection Strategy (The "Handshake")To solve the compatibility matrix, the adapter must perform a "Handshake" upon initial connection.Probe Version: Call system.client_version.Response: "0.9.6" -> Enable Legacy Mode (use d.multicall).Response: "0.9.8" -> Enable Modern Mode (use d.multicall2 + Empty Target).Probe Capabilities: Call system.listMethods.This returns an array of all supported commands.7Check: Does the array contain d.multicall.filtered?Logic: If yes, use it. This method (introduced in 0.9.8) is significantly more efficient for large libraries as it filters torrents server-side, reducing bandwidth.35 If no, fallback to client-side filtering.5.4 Compatibility MatrixrTorrent VersionRecommended List CommandTarget Param Required?Filtered APIStability Note0.8.xd.multicallNo (Implicit)NoLegacy. Low stability expected.0.9.0 - 0.9.6d.multicallMixedNoTransition period. d.multicall2 exists but may be buggy.0.9.7 - 0.9.8d.multicall2Yes (Strict)NoFault -501 common if target omitted.0.9.8+ / PSd.multicall.filteredYes (Strict)YesOptimal performance. 356. Error Handling and Edge CasesThe RuTorrentAdapter must translate raw protocol faults into actionable user feedback.6.1 XML-RPC Fault Codes ReferencerTorrent returns structured "Faults" when a call fails. These are distinct from HTTP errors.Fault CodeMessage SnippetRoot CauseAdapter Resolution-501Unsupported target type foundAPI Signature Mismatch. Sending a command without the required target hash or empty string filler.34Auto-Correct: Retry the request with the alternative signature (insert '' as first param). Downgrade version capability flag.-503Command not foundThe specific method (e.g., d.tracker_announce) does not exist in this version.4Feature Check: Check system.listMethods. Disable the UI feature relying on this command.-504Connection failed / Empty replyCritical Stability Indicator. The web server cannot connect to the SCGI socket. Daemon is down, crashed, or locked.7Backoff: Do NOT retry immediately. Display "Daemon Unreachable". Polling should slow down to avoid log spam.-506Method... not definedSimilar to -503 but specific to the XML-RPC method registry lookup failure.15Fallback: Switch to a legacy command equivalent if available.6.2 HTTP Status Codes401/403: Auth failure. Trigger re-login prompt.404: Endpoint detection failure. The user provided the wrong URL base, or the httprpc plugin is missing.405: Method Not Allowed. The adapter attempted a GET request; XML-RPC requires POST.6500/502: Web server misconfiguration. Often correlated with XML-RPC Fault -504 (SCGI socket unreachable).6.3 The Connection Refused Edge CaseA specific edge case exists where the web server is running, but rTorrent is frozen. In this state, action.php might execute but hang until the PHP execution time limit is reached, returning a 504 Gateway Timeout or 500 Internal Server Error after 30-60 seconds.8Stability Logic: The adapter must implement a timeout on its fetch requests (e.g., 10 seconds). If the request times out, it should be treated as a daemon failure, not a network failure. This prevents the browser extension from hanging indefinitely while waiting for a frozen PHP script.7. Connection Flow DiagramThe following logical flow outlines the robust connection procedure for the RuTorrentAdapter.Code snippetgraph TD
    A --> B{Credentials Provided?}
    B -- No --> C
    B -- Yes --> D
    
    D --> E{Probe /RPC2 Endpoint}
    E -- 200 OK --> F[Parse system.client_version]
    E -- 401 Unauthorized --> G{Check Auth Type}
    E -- 404 Not Found --> H{Probe /plugins/httprpc/action.php}
    
    G -- Basic --> I
    G -- Digest --> J
    
    I --> E
    J --> E
    
    H -- 200 OK --> K
    H -- 404/Error --> L[Fail: Endpoint Unreachable]
    
    K --> F
    
    F --> M{Version >= 0.9.7?}
    M -- Yes --> N
    M -- No --> O
    
    N --> P[Call system.listMethods]
    O --> P
    
    P --> Q{d.multicall.filtered exists?}
    Q -- Yes --> R
    Q -- No --> S
    
    R --> T[Connection Established]
    S --> T
8. Security Recommendations8.1 HTTP Basic Auth in Browser Extensions (Manifest V3)Storing credentials securely is paramount.Risk: Storing username:password in chrome.storage.local writes plaintext to the user's disk.Mitigation:Session Storage: Utilize chrome.storage.session for active credentials. This area is memory-only and cleared when the browser acts.Encryption: If persistence is required, encrypt the credentials using a key derived from a user-supplied PIN or utilize the OS-level credential manager if exposed via native messaging (complex). At minimum, obfuscate locally stored data.Header Hygiene: Ensure the Authorization header is only sent to the specific origin of the rTorrent server. The adapter must check response.url after fetch to ensure no redirect has moved the request to an untrusted domain before re-sending credentials.8.2 Self-Signed CertificatesExtensions cannot override certificate errors programmatically.Recommendation: When a network error occurs on an HTTPS endpoint, perform a "dry" fetch. If it fails rapidly, infer a certificate error and display a UI notification: "Browser blocked connection. Please open the rTorrent web UI in a new tab to accept the certificate." This relies on the browser's shared certificate store.8.3 CSRF ProtectionStandard XML-RPC has no CSRF protection. However, the httprpc plugin, running as a PHP script, might implement checks on the Referer or Origin header to prevent cross-site attacks.27Best Practice: The adapter should strip the Origin header if possible or set it to null. If the server rejects the request (403 Forbidden), the adapter may need to spoof the Referer header to match the ruTorrent URL (e.g., https://seedbox.io/rutorrent/), though modern browser security headers (Forbidden Headers) make this difficult. In such cases, the user must be advised to whitelist the extension ID in their web server config.9. ConclusionThe integration of rTorrent into the "CTRL" extension requires a sophisticated, defensive architectural approach. The RuTorrentAdapter cannot treat the API as a static standard. It must actively probe the environment, identifying the specific combination of Gateway (SCGI vs HTTPRPC), Authentication (Basic vs Digest), and Protocol Version (Legacy vs Modern) in use.By implementing the Endpoint Compatibility Matrix and the Fault Tolerance logic detailed above—specifically regarding the handling of <i8> integers, the -501 Target Fault, and the strict UTF-8 enforcement—the extension can achieve a high degree of stability. The recommended architecture prioritizes the /RPC2 endpoint for performance but retains full fallback capability for the httprpc plugin, ensuring broad compatibility across the diverse landscape of self-hosted and commercial BitTorrent infrastructure.