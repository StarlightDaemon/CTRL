# Vuze Remote API Research Prompt - ARCHITECT PASS

> **DIRECTIVE:** Focus strictly on the **Protocol Architecture, Authentication, and Stability**.
> - Detail the connection handshake, session handling, and error codes.
> - Identify Vuze-specific quirks vs Transmission RPC.
> - Document known bugs and connection edge cases.

---

## Context

You are researching the **Vuze Remote WebUI API** for "CTRL" browser extension. Vuze uses **Transmission RPC compatibility** for its remote interface.

**Current Implementation:**
```typescript
export class VuzeAdapter extends TransmissionAdapter {
    constructor(config: ServerConfig) {
        super(config);
        // Vuze Remote WebUI is Transmission RPC compatible.
    }
}
```

---

## Research Tasks (ARCHITECT FOCUS)

### 1. Transmission RPC Compatibility
- Which RPC version does Vuze emulate?
- X-Transmission-Session-Id handling
- Known incompatibilities or quirks

### 2. Authentication & Setup
- Pairing code system (if applicable)
- Password authentication
- Default port and path configuration

### 3. Known Bugs and Quirks
- `downloadDir` path reporting bug (includes torrent name)
- Fields that return different data
- Methods that behave differently

### 4. Version Detection
- How to detect Vuze vs Transmission vs BiglyBT
- RPC version spoofing behavior
- Feature availability checks

### 5. Error Handling
- Vuze-specific error responses
- Connection flakiness reports

---

## Expected Output

1. **Compatibility Report** - What works, what doesn't
2. **Known Quirks List** - Path bugs, field differences
3. **Version Detection** - Identifying Vuze reliably
4. **Error Handling** - Vuze-specific patterns

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Vuze and BiglyBT Remote API Protocol Architecture: A Comprehensive Research Report on Transmission RPC Emulation, Authentication Vectors, and System Stability1. Executive SummaryThe integration of legacy and forked BitTorrent clients into modern browser extension architectures presents a unique set of challenges, particularly when those clients operate via protocol emulation rather than native implementation. This research report provides an exhaustive architectural analysis of the Vuze Remote WebUI and its successor, the BiglyBT interface, specifically for the development of the "CTRL" browser extension. The directive for this research is to move beyond surface-level compatibility checks and dissect the underlying protocol architecture, authentication mechanisms, and stability patterns that define the interaction between a modern JavaScript client and the Java-based RPC emulator.Vuze (formerly Azureus) and BiglyBT utilize a plugin-based architecture to provide remote control capabilities. The core plugin, widely known as xmwebui (and historically azhtmlwebui), implements a server interface that mimics the Transmission RPC specification. However, this report establishes that the emulation is not merely a wrapper but a distinct architectural entity with its own state management logic, I/O handling characteristics, and protocol deviations.1 While the interface advertises itself as "Transmission-compatible," utilizing it as such without specific adaptation layers leads to critical failures in file path resolution, session management, and error recovery.Our analysis uncovers that the Vuze ecosystem does not strictly adhere to the semantic versioning or structural expectations of the Transmission daemon (typically a C-based application using libevent). Instead, it runs within a synchronous Jetty servlet container embedded in the Java Virtual Machine (JVM).2 This fundamental difference in execution environment dictates specific behaviors regarding HTTP header parsing, GZIP compression handling, and thread blocking during high-load operations. Furthermore, the "Pairing" mechanism used for remote access over Network Address Translation (NAT) introduces a complex overlay of proprietary headers (X-XMRPC-Tunnel-ID) and authentication tokens (ac codes), which are entirely foreign to the standard Transmission protocol.2The findings presented herein categorize the "VuzeAdapter" requirements into three critical pillars: Path Normalization (addressing the downloadDir concatenation anomaly), Session Resilience (handling the unique CSRF challenge-response loops and tunnel instabilities), and Version Polyfilling (managing the static spoofing of RPC versions). This document serves as the definitive reference for the "ARCHITECT PASS," enabling the construction of a robust, fault-tolerant integration strategy for the CTRL extension.2. Architectural Context and Protocol FundamentalsTo successfully engineer an adapter for Vuze, one must first deconstruct the architectural relationship between the Transmission RPC standard and the Vuze xmwebui implementation. The distinction is not merely syntactic but structural, rooted in the divergent design philosophies of a lightweight C daemon versus a feature-rich Java platform.2.1 The Transmission RPC BaselineThe standard Transmission RPC protocol is designed for efficiency and statelessness. It operates on a request-response model using JSON payloads transported via HTTP POST.Transport Protocol: HTTP/1.1 is the standard carrier.Endpoint Definition: The canonical endpoint is /transmission/rpc.Security Model: It employs a Cross-Site Request Forgery (CSRF) protection mechanism requiring the X-Transmission-Session-Id header, alongside optional Basic Authentication.Data Serialization: The payload strictly adheres to JSON-RPC 2.0 style objects, expecting UTF-8 encoding.This baseline assumes a non-blocking I/O model (typically handled by libcurl on the client and libevent on the server), allowing for rapid concurrency and minimal overhead.2.2 The Vuze xmwebui Emulation LayerIn contrast, Vuze and BiglyBT do not integrate remote control into their core kernel. Instead, this functionality is offloaded to the xmwebui plugin.1 This plugin instantiates a web server—identified in headers as Jetty or occasionally Azureus—within the host JVM. This architecture introduces significant implications for the remote API:2.2.1 The Jetty Container and Threading ModelUnlike the event-loop architecture of Transmission, the embedded Jetty server in Vuze operates on a thread-per-request or pooled thread model typical of Java servlet containers.Thread Blocking: Heavy operations, such as calculating the free-space for a drive or aggregating data for thousands of torrents, can block the worker thread. If the JVM is under memory pressure—a known issue where plugins can consume upwards of 150MB of heap space 4—garbage collection (GC) pauses may cause API requests to hang or time out.I/O Stream Handling: The source code analysis reveals that the plugin wraps the request input stream in LineNumberReader.2 This suggests that the server reads the JSON payload line-by-line rather than as a buffered block. While functional, this approach is less efficient for massive, minified JSON payloads and creates specific vulnerabilities to malformed line endings or encoding issues.2.2.2 Strictness vs. LazinessThe Java-based JSON parsers employed by Vuze are strictly compliant regarding character encoding (UTF-8 is mandatory) but the RPC logic itself exhibits what developers have termed "lazy programming".5State Caching: For methods like torrent-get with the recently-active ID, the plugin caches the previous response's field list. If a client alters the requested fields between calls, the differential logic may fail or return inconsistent data because the cache invalidation strategy is rudimentary compared to Transmission’s object-diffing engine.2.3 Protocol Versioning and Emulation StrategyA critical architectural decision in Vuze is the decoupling of the emulated RPC version from the actual capabilities of the client.Static Versioning: Vuze typically reports an rpc-version integer of 14 or 17 in the session-get response.6 This value is hardcoded to ensure compatibility with older Transmission GUI clients (like Transmission Remote GUI).Plugin Version Exposure: The version string field, which in Transmission would report the daemon version (e.g., 2.94), instead reports the xmwebui plugin version (e.g., 0.5.11) or the BiglyBT core version (e.g., B2.1.0.0).1Implication: This mismatch defeats standard feature-detection logic. A client checking rpc-version >= 15 to enable queue-position functionality might be misled, as the Vuze implementation of queue manipulation might be incomplete or behave differently despite the advertised version number.3. Connection Handshake and Session ManagementThe stability of the "CTRL" extension is predicated on its ability to establish and maintain a persistent session with the RPC endpoint. The Vuze implementation follows the high-level Transmission CSRF protection flow but introduces unique headers and behaviors, particularly when the connection is brokered through the remote pairing service.3.1 The CSRF Protection Loop (Session ID)Authentication and session anchoring rely on the X-Transmission-Session-Id header. The handshake mechanism is a "challenge-response" protocol that serves to prevent malicious scripts from executing RPC commands via cross-origin requests.3.1.1 The Challenge SequenceInitial Request: The client initiates a POST request (e.g., session-get) to /transmission/rpc. On the first connection, the X-Transmission-Session-Id header is either missing or stale.Server Challenge (409 Conflict): The Jetty server intercepts the request. The XMWebUIPlugin.java code explicitly checks for the header. If valid, it proceeds; if invalid, it triggers a 409 response.2Header Generation: The server generates a session ID (often a hash of the startup time and random entropy) and injects it into the response headers: X-Transmission-Session-Id: <new-id>.Unique Body Content: Unlike Transmission, which returns a generic HTML 409 page, Vuze writes a specific text payload: "You_didn_t_set_the_X-Transmission-Session-Id".2 This string is a reliable fingerprint for detecting the Vuze emulation layer during the handshake phase.Cookie Setting: The server also attempts to set a cookie: Set-Cookie: X-Transmission-Session-Id=<id>; path=/; HttpOnly.2 This indicates that browser-based clients might be able to rely on cookie persistence if the extension environment allows it, though header-based auth is preferred for RPC.3.1.2 Input Stream DrainingAn often-overlooked detail in the source code 2 is the error handling routine. When the session ID is invalid, the code enters a while loop to read lines from the input stream (lnr.readLine()) and log them before returning the 409 status.Architectural Insight: This "draining" of the request body is likely a defensive measure to ensure the underlying TCP connection remains consistent and isn't reset abruptly, which could cause "Connection Reset" errors in some clients. However, for a client sending a large payload (e.g., adding a.torrent file via base64), this means the server consumes the bandwidth before rejecting the request, introducing latency on the error path.3.2 The "Pairing" Handshake (Remote Access)For users accessing their client from outside their local network, Vuze and BiglyBT employ a proprietary pairing system that tunnels traffic through a relay server. This system overlays the standard RPC protocol with additional routing identifiers.3.2.1 The Tunnel Identifier (X-XMRPC-Tunnel-ID)When a request arrives via the pairing relay (e.g., pair.biglybt.com), it carries an X-XMRPC-Tunnel-ID header.2Composite Session ID: The server code logic appends this tunnel ID to the base session ID: session_id_plus += "/" + tid.2Implication for CTRL: While the client may treat the Session ID as an opaque string, internally it binds the session to the specific tunnel connection. If the tunnel reconnects or the relay node changes, the session ID might become invalid, triggering a fresh 409 challenge. The adapter must be aggressive in handling 409 retries when operating in "Remote Mode."3.2.2 Connection Recovery LogicThe pairing service is susceptible to timeouts and relay unavailability. Research snippets indicate that clients may receive specific error messages such as Tunnel unavailable for a further 16s due to failure.7Retry Strategy: This specific error message suggests a server-side "cool-down" period. A naive retry loop in the client would fail repeatedly. The architecture of the VuzeAdapter must detect this "Unavailable" state and implement an exponential backoff or a user-facing "Reconnecting..." status, rather than treating it as a permanent 404 or 500 error.3.3 Transport Encoding and CompressionBandwidth efficiency is critical for remote management extensions.GZIP Support: The snippet 2 confirms explicit support for GZIP. if ("gzip".equals(request.getHeaders().get("content-encoding")))... new GZIPInputStream(...).Chunked Encoding Vulnerability: The code contains a specific check: if available() == 0 and transfer-encoding is chunked, it returns 415 Unsupported Media Type.2Edge Case: Some HTTP libraries switch to chunked encoding for empty POST bodies or streams of unknown length. If the CTRL extension uses a streaming upload for a torrent file but pauses or sends an empty initial frame, Vuze will reject it with a 415 error, a code rarely seen in standard Transmission interactions.4. Authentication ArchitectureThe Vuze RPC interface supports multiple authentication vectors, ranging from standard HTTP Basic Auth to token-based pairing access.4.1 Standard Basic AuthenticationThis is the default mechanism for local network connections (e.g., LAN access).Configuration: Credentials are defined in the Vuze UI under Tools -> Options -> Plugins -> XMWebUI.Defaults: The snippet 8 suggests that while users can set custom credentials, default configurations or Docker-based setups often default to vuze / vuze or transmission / transmission.Mechanism: Standard Authorization: Basic <base64> header.Security Risk: By default, the plugin listens on HTTP (port 9091). Credentials are transmitted in cleartext unless the user explicitly configures the SSL connector, which requires complex keystore management in Java.94.2 The "Pairing" Access Code (ac) SystemThe pairing system bypasses port forwarding by using a specialized relay. It authenticates users via an Access Code rather than a traditional username/password pair.4.2.1 The ac ParameterThe Access Code is a short alphanumeric string (typically 8 characters) generated by the client.3Usage via Query Param: The code can be passed as a query parameter ?ac=<code > in the URL.Usage via Basic Auth: Crucially, research indicates that for local connections utilizing the pairing logic (or hybrid setups), the Access Code acts as the password while the username is fixed to vuze.3Scenario: A user might attempt to connect to their local Vuze instance using the "Remote" credentials found in the UI. The adapter must be intelligent enough to try the Access Code as a password if the standard password fails.4.2.2 Handshake Failure PatternsThe pairing handshake is sensitive to SSL/TLS configuration. Snippet 9 highlights issues with "Handshake failure SSL error" due to Java's keystore requirements or outdated TLS versions in older Vuze builds.Client Mitigation: The CTRL extension, running in a modern browser, enforces strict TLS. If the Vuze client is running on an older JVM (e.g., Java 7), the cipher suites might not match, leading to a connection drop before any HTTP response is received.4.3 Default Port and Path ConfigurationTo ensure seamless setup for the user, the adapter must prioritize the default listening ports and paths found in the wild.Default Port: 9091 (inherited from Transmission defaults).Alternative Port: 9595 is occasionally used in specific Docker containers or plugin presets.10Path Hierarchy:/transmission/rpc - The primary compatibility path./rpc - A shorthand path exposed by the xmwebui plugin.2/ (Root) - Some configurations mount the RPC handler at the root, though this is rare and usually conflicts with the web interface HTML.5. Transmission RPC Compatibility: The "Quirks"This section addresses the core "Architectural Focus" of the research: identifying the specific deviations that break standard Transmission clients. Vuze's emulation is functional but imperfect, characterized by specific data reporting bugs that require client-side polyfills.5.1 The downloadDir Path Reporting BugStatus: CRITICALThe most pervasive incompatibility identified in the research is the handling of the downloadDir field in the torrent-get response.Transmission Standard: In the official spec, downloadDir represents the parent directory where the torrent's data resides. The full path to a file is constructed as downloadDir + / + file path.Vuze Deviation: Vuze reports downloadDir as the path including the torrent's root directory name if the torrent is a multi-file structure (i.e., a directory).6Example: A torrent named "UbuntuISO" is saved to C:\Downloads.Transmission reports: downloadDir: C:\Downloads.Vuze reports: downloadDir: C:\Downloads\UbuntuISO.The "Double Directory" Consequence: If the CTRL extension uses standard Transmission logic to determine the file location, it will concatenate the path: C:\Downloads\UbuntuISO + UbuntuISO + file.iso, resulting in a non-existent path.Detection & Fix: The adapter must inspect the downloadDir. If the path ends with the name of the torrent, the adapter must strip the suffix to normalize the path to the Transmission standard.5.2 Field-Level Discrepancies and Missing DataThe xmwebui plugin does not map the internal Azureus/Vuze torrent object 1:1 to the Transmission schema.5.2.1 The version FieldTransmission: Returns the daemon version (e.g., 2.94, 3.00).Vuze: Returns the plugin version (e.g., 0.5.11) or the BiglyBT client version (e.g., B2.5.0.0).6Impact: Semantic version checks (SemVer) will fail. An adapter checking for version >= 3.0.0 to enable v3 RPC features will block Vuze users unnecessarily. The check must be relaxed or branched based on the detection of the "B" prefix or "0.5.x" pattern.5.2.2 The recently-active AnomalyTransmission uses an efficient change-tracking mechanism to return only the IDs of torrents that have changed since the last poll. Vuze implements this via "lazy programming".5Mechanism: The plugin caches the list of IDs sent in the previous response and the fields requested.Failure Mode: If the client changes the requested fields (e.g., switching from a "List View" requesting name, size to a "Detail View" requesting peers, trackers), the diff logic in Vuze may become confused or return a full list refresh, causing a UI glitch or performance spike.Recommendation: The adapter should avoid relying on recently-active for critical state updates on Vuze, preferring full polling or robust verification of the returned data.5.3 Method-Specific Quirks5.3.1 torrent-removeUsers have reported that the torrent-remove method returns a standard 200 OK "success" response, yet the torrent remains in the list or the data is not deleted.11Root Cause: This ghosting behavior often relates to "Imported" torrents or files where the JVM lacks operating system permissions to delete the artifacts. Unlike Transmission, which might return a permission error, the emulated layer absorbs the Java exception and reports success to maintain protocol compliance.Implication: The CTRL extension cannot assume deletion upon success. It must optimistically hide the torrent in the UI but be prepared for it to reappear in the next sync cycle.5.3.2 free-spaceThis method, used to determine available disk space, is notoriously unreliable in the Java emulation. It relies on java.io.File.getFreeSpace(), which can behave inconsistently across different OS mounts (especially network shares or Docker volumes). It often returns 0 or fails silently, whereas Transmission queries the filesystem directly via statvfs.6. Version Detection and IdentificationTo apply the necessary polyfills (like the path fix), the CTRL extension must reliably differentiate between a genuine Transmission daemon and a Vuze/BiglyBT emulator.6.1 Heuristic FingerprintingA standard session-get response provides multiple data points for fingerprinting.Detection VectorTransmission DaemonVuze / BiglyBT EmulatorHTTP Server HeaderServer: Transmission/2.94Server: Jetty(x.y.z) or Server: Azureusversion FieldSemantic Version (X.Y.Z)Plugin Version (0.5.11) or Fork Version (B2.x)rpc-versionDynamic, matches daemonStatic, usually 14 or 17Response 409 BodyHTML contentPlain text: "You_didn_t_set..."BiglyBT SpecificsN/AMay contain rpc-version-minimum field 16.2 The "BiglyBT" DivergenceBiglyBT, the active fork of Vuze, has begun to diverge further by adding fields to the RPC that are not in the Transmission spec.RPC Version Minimum: BiglyBT includes rpc-version-minimum in session-get.1 This field is useful for the adapter to determine the baseline feature set.Tagging Support: BiglyBT maps its advanced tagging system to the Transmission labels or categories fields, often providing richer data than the legacy Vuze plugin.7. Stability and Performance EngineeringThe Java-based nature of Vuze introduces stability constraints that differ from C-based clients.7.1 Memory Pressure and GC PausesThe xmwebui plugin runs within the main Vuze memory space.Risk: Snippets warn that plugins can consume significant memory.4 If the user has a large library (thousands of torrents), the serialization of the JSON response can trigger major Garbage Collection (GC) events.Symptom: The API request hangs for several seconds, potentially triggering a timeout in the browser extension.Mitigation: The adapter should configure a longer default timeout (e.g., 15,000ms) for Vuze connections compared to standard Transmission connections (typically 5,000ms).7.2 Thread ExhaustionThe Jetty server uses a thread pool. If the client issues multiple parallel requests (e.g., fetching details for 10 torrents simultaneously), it can exhaust the pool, causing subsequent requests to be queued or rejected with 500 Internal Server Error.Mitigation: The adapter should enforce a request queue, limiting concurrent requests to the Vuze endpoint (e.g., concurrency: 2).8. Error Handling and Edge CasesVuze's error responses are generally compliant with JSON-RPC, but the underlying Java stack introduces unique failure modes.8.1 HTTP Status CodesCodeMeaningVuze Specific ContextRecovery Action409ConflictCSRF Token missing. Standard operation.Update X-Transmission-Session-Id and retry immediately.415Unsupported MediaTransfer-Encoding: chunked with empty body.2Unique to Vuze. Ensure strictly defined Content-Length. Do not use chunked encoding for command-only POSTs.500Internal ErrorNullPointerException or IOException in Java plugin.Log error. Do not retry immediately (risk of retry storm). Backoff 5s.401UnauthorizedBasic Auth failure.Prompt user. Check if ac code should be tried as password.8.2 The "Tunnel Unavailable" StateWhen using the remote pairing service, the client may receive a 200 OK response from the HTTP layer (the relay), but the body might contain a proxied error message or a specific JSON payload indicating the tunnel is down.Error Signature: Text containing "Tunnel unavailable for a further Xs".7Handling: This is a soft failure. The adapter should switch the UI to a "Connecting..." state and poll the endpoint at the interval specified in the error message (e.g., 16 seconds), rather than failing the connection permanently.9. Implementation Recommendations: The VuzeAdapterBased on the exhaustive architectural analysis, the following implementation strategy is recommended for the VuzeAdapter class in the CTRL extension.9.1 Class Structure and PolyfillsTypeScript// Architectural Pseudocode for VuzeAdapter Implementation

export class VuzeAdapter extends TransmissionAdapter {
    
    constructor(config: ServerConfig) {
        super(config);
        // Vuze allows "lazy" active lists, but they are buggy.
        // Force full polling for stability.
        this.config.useRecentlyActive = false; 
        
        // Extend timeout for Java GC pauses
        this.config.requestTimeout = 15000;
    }

    /**
     * Detection Logic: Inspect headers and body from session-get
     */
    public static isVuze(headers: Headers, sessionData: any): boolean {
        const serverHeader = headers.get('Server') |

| '';
        const isJetty = serverHeader.includes('Jetty') |

| serverHeader.includes('Azureus');
        const isBigly = sessionData.version && sessionData.version.startsWith('B');
        const isPluginVersion = sessionData.version && sessionData.version.startsWith('0.5');
        
        return isJetty |

| isBigly |
| isPluginVersion;
    }

    /**
     * CRITICAL FIX: Normalize the downloadDir path.
     * Vuze appends the torrent name to the path for directories.
     */
    protected normalizeTorrentData(torrent: any): Torrent {
        // Call the base normalizer first
        const normalized = super.normalizeTorrentData(torrent);
        
        // Check for the "Double Directory" bug
        if (torrent.downloadDir && torrent.name) {
            // Logic: If downloadDir ends with the torrent Name, strip it.
            // Be careful of path separators (Windows \ vs Unix /)
            const dir = torrent.downloadDir;
            const name = torrent.name;
            
            // Heuristic check
            if (dir.endsWith(name) |

| dir.endsWith(name + '/') |
| dir.endsWith(name + '\\')) {
                 // Calculate the slice index
                 const newPath = dir.substring(0, dir.lastIndexOf(name));
                 // Clean up trailing slash
                 normalized.downloadDir = newPath.replace(/[/\\]$/, "");
            }
        }
        
        return normalized;
    }

    /**
     * Handle the unique 409 response body and headers.
     */
    protected async handleCsrfChallenge(response: Response): Promise<string | null> {
        // Vuze 409s have the ID in the header, same as Transmission.
        // However, we can log the specific Vuze body text for debugging.
        if (response.status === 409) {
            const body = await response.text();
            if (body.includes("You_didn_t_set")) {
                console.debug("Vuze CSRF Challenge detected");
            }
            return response.headers.get('X-Transmission-Session-Id');
        }
        return null;
    }
}
9.2 Configuration & Setup ChecklistPort 9091: Ensure this is the default scan port.Auth Mode: Support both "User/Pass" and "Access Code" (mapped to Password).Concurrency: Limit to 2 parallel requests to prevent Jetty thread exhaustion.Encoding: Force Identity or Gzip encoding. explicitly disable Chunked transfer for empty bodies to avoid 415 errors.10. Future Outlook and RecommendationsThe ecosystem is shifting towards BiglyBT, which is actively maintained. Vuze (legacy) is effectively static. The xmwebui plugin sees occasional updates but the core architecture remains tied to the legacy Azureus code base.Strategic Recommendation:The CTRL extension should officially brand this support as "Vuze / BiglyBT" support. The architecture is similar enough to share a single adapter, but the isBigly detection flag should be used to enable future features (like Tags) that will never arrive on the legacy Vuze client. The adapter must remain defensive, assuming that the remote endpoint is fragile, memory-constrained, and strictly validated regarding HTTP protocol semantics.By implementing the path normalization fix and the robust session recovery logic described in this report, the CTRL extension can transform a flaky, "beta-level" connection into a stable, production-grade integration.11. Appendix: Detailed Known Quirks ListComponentQuirk DescriptionImpact on CTRLPathingdownloadDir includes torrent name.Broken "Open Folder" links; Incorrect path display.Session409 Body is plain text.None functionality-wise, but useful for fingerprinting.Encoding415 Error on Chunked Transfer.Upload failures for torrent files if not length-prefixed.Removaltorrent-remove ghosts data.Deleted torrents may reappear; need UI handling.Versionversion string is non-standard.Feature detection logic based on version numbers fails.Fieldsrecently-active is unreliable.UI desync if relying on diffs; use full polling.PairingTunnel timeouts require backoff.Connection loops if not handled with "Cool-down" logic.PerformanceHigh Memory/GC pauses.Request timeouts if set too low (under 10s).End of Report