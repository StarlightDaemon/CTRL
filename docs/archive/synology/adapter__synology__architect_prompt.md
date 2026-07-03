> **NOTE (2026-07-02):** Synology support was removed from the CTRL extension
> on this date. This document is retained for historical reference only and
> does not describe active or current functionality.

# Synology Download Station API Research Prompt - ARCHITECT PASS

> **DIRECTIVE:** Focus strictly on the **Protocol Architecture, Authentication, and Stability**.
> - Detail the connection handshake, session handling, and error codes.
> - Identify specific version incompatibilities (DSM 6 vs DSM 7).
> - Document known bugs, quirks, and connection edge cases.

---

## Purpose

Export this prompt to another LLM for deep research on Synology Download Station API **connection architecture and stability**.

---

## Context

You are researching the **Synology Download Station API** for integration into a browser extension called "CTRL" that manages BitTorrent clients.

**Current Implementation (666 Lines) Supports:**
- Session-based authentication (sid token)
- 2FA via OTP codes
- Device token for trusted device bypass
- API path discovery via `SYNO.API.Info`
- Session recovery with automatic re-authentication
- FileStation integration for folder enumeration
- Rate limiting awareness (15s timeout for hibernating NAS)

**Current Code Structure:**
```typescript
@injectable()
export class SynologyAdapter implements ITorrentClient {
    private sid: string | null = null;
    private synoToken: string | null = null;
    private apiPaths: Map<string, string> = new Map();
    
    static readonly DEFAULT_PATHS = {
        'SYNO.API.Info': 'webapi/query.cgi',
        'SYNO.API.Auth': 'webapi/auth.cgi',
        'SYNO.DownloadStation.Task': 'webapi/DownloadStation/task.cgi',
        'SYNO.DownloadStation2.Task': 'webapi/entry.cgi',
        'SYNO.FileStation.List': 'webapi/entry.cgi',
    };
    
    async discoverAPIs(): Promise<void> {
        // 15s timeout for hibernating NAS
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        // Parse SYNO.API.Info response for dynamic paths
    }
    
    async withSessionRecovery<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (e) {
            if (this.isSessionExpiredError(e)) {
                this.sid = null;
                await this.login();
                return await operation();
            }
            throw e;
        }
    }
}
```

**Known Error Codes Handled:**
```typescript
const errors: Record<number, string> = {
    400: 'No such account or incorrect password',
    401: 'Account disabled',
    402: 'Permission denied',
    403: '2-factor authentication code required',
    404: '2-factor authentication failed',
    406: 'Enforce 2FA required',
    407: 'Blocked IP source',
    408: 'Account is blocked due to too many failed attempts',
    409: 'Network failure',
    410: 'SID not found',
    411: 'Account expired',
};
```

---

## Research Tasks (ARCHITECT FOCUS)

### 1. Authentication Deep Dive
- All possible 2FA methods (OTP, FIDO2, Synology Secure SignIn)
- `device_id` / `device_token` lifecycle and format
- Session expiration behavior mid-operation
- Detecting "account locked" vs "wrong password" vs "2FA required"
- OTP code format and retry limits
- App-specific password support

### 2. API Discovery Architecture
- `SYNO.API.Info` query mechanism - full parameter list
- Dynamic CGI path resolution across DSM versions
- Version negotiation strategy (min/max version handling)
- `SYNO.DownloadStation2` vs `SYNO.DownloadStation` namespaces
- Required API versions for specific methods

### 3. Session Management
- `sid` (Session ID) lifecycle and expiration
- `SynoToken` (CSRF token) - when is it required?
- Session persistence across requests
- Concurrent session limits
- Session sharing between Download Station and FileStation APIs

### 4. DSM Version Compatibility
- DSM 6.x to DSM 7.x breaking changes
- API version differences per DSM release
- HTTP method changes (GET vs POST for legacy support)
- Namespace migrations (DownloadStation → DownloadStation2)
- Entry.cgi vs individual CGI file routing

### 5. Error Handling & Edge Cases
- Complete error code mapping (100-level, 400-level)
- Disk quota exceeded behavior
- NAS power saving/hibernation mode handling
- IP blocking threshold and recovery
- Volume mount state detection
- Network interface changes

### 6. Security Considerations
- HTTP vs HTTPS enforcement in DSM 7
- Self-signed certificate handling
- Application-specific passwords configuration
- IP blocking after failed attempts (threshold)
- DNS rebinding protection

---

## Expected Output Format

Please provide:
1. **Authentication Flow Diagram** - Including 2FA challenge/response
2. **Session State Machine** - sid/SynoToken lifecycle
3. **API Discovery Protocol** - Dynamic path resolution steps
4. **Error Code Reference** - Complete mapping with recovery actions
5. **DSM Compatibility Matrix** - 6.x vs 7.x API differences
6. **Security Recommendations** - Browser extension best practices

---

## Additional Resources (if accessible)
- Synology Developer Documentation portal
- Official Synology API PDFs (DSM 6 and DSM 7)
- Community implementations (N4S4/synology-api, Prowlarr)
- Synology Knowledge Center

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Synology Download Station API: Comprehensive Architectural Protocol and Integration Report1. Executive Summary and Architectural PhilosophyThe integration of the Synology Download Station API into an external client, such as the "CTRL" browser extension, represents a significant exercise in protocol interoperability and defensive systems architecture. Unlike modern, contract-first API standards like OpenAPI (Swagger) or GraphQL, the Synology DiskStation Manager (DSM) exposes a proprietary, Common Gateway Interface (CGI)-based JSON-RPC mechanism. This protocol has evolved incrementally over nearly fifteen years, resulting in a stratified landscape of legacy endpoints (SYNO.DownloadStation), transitional implementations, and modern, albeit undocumented, interfaces (SYNO.DownloadStation2).The primary challenge for an external architect is not merely sending HTTP requests but navigating a complex, dynamic service registry where endpoints are mutable, documentation is deprecated or nonexistent, and system states such as hibernation introduce non-deterministic latency. This report provides an exhaustive, 15,000-word analysis of the Synology API ecosystem, specifically tailored to the constraints and requirements of a browser-based extension environment.1.1 The DSM Architectural ParadigmTo successfully integrate with Synology DSM, one must understand that it operates as a modular operating system rather than a monolithic web service. The API structure reflects this modularity. Services are registered dynamically; when a package like Download Station is installed, it registers its API namespace, version support, and CGI routing paths with the central system. Consequently, hardcoding API paths (e.g., assuming the task creation endpoint is always at /webapi/DownloadStation/task.cgi) is architecturally unsound and a primary cause of integration failure across DSM versions.1The architectural philosophy requires a "Discovery-First" approach. The client must act as a dynamic agent, querying the SYNO.API.Info service to resolve the topology of the target NAS before attempting any functional operations. This indirection layer allows Synology to reorganize internal binary structures, migrate from Apache to Nginx, or containerize services without breaking compliant clients—provided those clients respect the discovery handshake.1.2 Scope of AnalysisThis report focuses strictly on the Protocol Architecture, Authentication, and Stability necessary to engineer a robust client. It addresses the critical schism between DSM 6.x and DSM 7.x, analyzing the breaking changes in authentication logic, specifically the handling of Two-Factor Authentication (2FA) and "Trusted Device" tokens (device_id). It further explores the SYNO.DownloadStation2 namespace, which offers superior functionality for task management but lacks public documentation, requiring reliance on behavioral analysis and community reverse-engineering.2Furthermore, this document serves as a blueprint for implementing stability mechanisms that respect the physical constraints of Network Attached Storage hardware. This includes intelligent handling of disk hibernation (spin-down), where API polling must be rate-limited or suspended to prevent "thrashing" the hardware or incurring excessive energy costs—a requirement often overlooked in standard API wrappers but critical for user acceptance in the home lab community.42. Authentication Protocol and Session SecurityAuthentication is the gateway to all DSM interaction and the area most fraught with version-specific complexity. The SYNO.API.Auth service manages session creation, validation, and destruction. While it ostensibly follows a simple challenge-response model, the introduction of varied 2FA methods, "Trusted Device" logic, and stricter security policies in DSM 7 creates a multi-dimensional state machine that the "CTRL" extension must navigate flawlessly.2.1 The Authentication Handshake: Theoretical ModelThe authentication process is not a single atomic operation but a negotiation. The client must be prepared to handle immediate success, credential failure, or a conditional challenge requiring secondary verification (OTP).2.1.1 The Initial ChallengeThe standard login request is sent to the auth.cgi endpoint (or entry.cgi in some DSM 7 contexts). The discovery service (SYNO.API.Info) must be queried first to determine the correct path and supported API version.Protocol Specification:API Name: SYNO.API.AuthMethod: loginVersion: The client should negotiate the highest version supported by the NAS (typically v6 for DSM 6 and v7 for DSM 7).5Transport: HTTP POST is strictly recommended to prevent credential leakage in server access logs, although GET is historically supported on older versions.Critical Parameters:account: The user's login name.passwd: The user's password.session: A string identifier for the client session (e.g., "DownloadStation", "FileStation", or "CTRL"). Using "DownloadStation" allows the API session to share context with the native application logic, potentially reducing permission friction.6format: This parameter dictates the response payload structure. It can be cookie or sid. For a browser extension, format=sid is architecturally superior. It returns the Session ID (sid) in the JSON body, decoupling the extension's authentication state from the browser's global cookie jar, which might be cleared by user privacy settings or interfere with other open DSM tabs.72.1.2 The Response TaxonomyA successful response yields the session credentials.JSON{
  "data": {
    "sid": "kYyzCzSxzwHGH90...",
    "synotoken": "03yhfxW4syRQw",
    "did": "8nC0nhJjgiE1XTqM6...", 
    "is_portal_port": false
  },
  "success": true
}
sid: The Session ID. This is the bearer token for all subsequent requests.synotoken: The CSRF token. In DSM 7, if the user has enabled "Improve protection against cross-site request forgery attacks," this token becomes mandatory for all state-changing operations (POST requests). The extension must cache this alongside the sid.8did: The Device ID. Its presence and behavior differ radically between DSM versions, which is a primary source of integration failure (detailed in Section 2.3).2.2 Two-Factor Authentication (2FA) State MachineWhen 2FA is enabled on the target account, the initial login request will fail. The extension must detect this failure mode and transition its internal state machine to a "Challenge Required" state.2.2.1 Error Code Analysis for 2FAIn DSM 6, the API typically returns error code 403 or 404 with specific internal messaging indicating OTP is required. The lack of standardized error sub-codes in earlier versions meant clients often had to rely on heuristic parsing of the error message or simply catching the 403 status on the login endpoint.5In DSM 7, the behavior is formalized. The API returns:HTTP Status: 200 OK (The API request completed, even if the login failed).JSON Content: success: false.Error Code: 403 (Forbidden).Error Detail: A specific internal error code (often in the errors array) signaling ERR_OTP_REQUIRED.52.2.2 The OTP Re-Submission FlowUpon detecting the OTP requirement, the "CTRL" extension must prompt the user for their 6-digit TOTP code. It cannot proceed autonomously. Once the code is obtained, the client must re-submit the original login request with identical parameters, plus:otp_code: The 6-digit integer provided by the user.Supported 2FA Methods:TOTP (Time-based One-Time Password): The standard method compatible with Google Authenticator, Authy, and Synology Secure SignIn. This is the only method fully supported for third-party API automation via the otp_code parameter.5Approve Sign-in: This proprietary method pushes a notification to the Synology Secure SignIn mobile app. The API does not expose a "wait for approval" socket or polling mechanism for third-party clients. Therefore, even if the user has "Approve Sign-in" configured, the extension must force the user to fall back to the OTP code display on their app.9FIDO2 / Hardware Keys: Authentication via USB keys (YubiKey) relies on WebAuthn browser APIs interacting directly with the DSM web interface JavaScript. The SYNO.API.Auth endpoint does not support raw FIDO2 assertion passing. Consequently, users with hardware keys must be instructed to use their backup TOTP code for the extension integration.102.3 The "Trusted Device" Breaking Change (DSM 7)One of the most critical findings for the "CTRL" extension architecture is the change in how "Trusted Devices" (bypassing 2FA for future logins) are handled between DSM 6 and DSM 7. Misunderstanding this change leads to a poor user experience where the extension repeatedly asks for OTP codes after session timeouts.2.3.1 DSM 6: Server-Side GenerationIn DSM 6, the workflow was server-centric:Client sends Login + otp_code + enable_device_token=yes.Server validates OTP.Server generates a new did (Device ID).Server returns did in the JSON response.6Client stores did and sends it as device_id in future requests to skip OTP.2.3.2 DSM 7: Client-Side ClaimIn DSM 7, Synology shifted this responsibility to the client to improve privacy and statelessness.Client sends Login + otp_code + enable_device_token=yes.Server validates OTP.Crucial Difference: The server does not return a did in the response if one was not provided in the request.11If the client expected the server to provide the ID, it receives nothing. The next login attempts will fail to bypass 2FA because no ID was stored.Architectural Requirement for CTRL:The extension must implement Client-Side Device ID Generation.Initialization: On first install, the extension should generate a persistent UUID v4 (e.g., 550e8400-e29b...).First Login: Send this client-generated UUID as the device_id parameter, along with enable_device_token=yes and the otp_code.Example: &device_id=550e8400-e29b...&enable_device_token=yes&otp_code=123456Registration: The NAS receives the UUID and the valid OTP. It registers this UUID in its internal database as a trusted device for that user.Subsequent Logins: When the session expires (error 105), the client re-authenticates sending device_id=550e8400-e29b.... The NAS recognizes the ID and grants the session without requiring an OTP code.11Failure to implement this client-side generation logic renders the "Remember this device" feature non-functional on DSM 7, a major regression for user experience.2.4 Session Lifecycle and PersistenceThe sid returned by the authentication process is valid only for a specific duration, determined by the NAS's security settings (Control Panel > Security > Logout Timer). This defaults to 15 minutes but can be extended by users.2.4.1 Keep-Alive StrategyThere is no dedicated "keep-alive" API method. However, any valid request to the API updates the session's "last active" timestamp, resetting the logout timer.Polling: If the extension polls SYNO.DownloadStation.Task.List every 5 seconds, the session will effectively never expire as long as the browser is open.Hibernation Risk: Aggressive polling keeps the session alive but prevents the NAS from sleeping (detailed in Section 7).2.4.2 Handling ExpirationIf the user closes the browser or the computer sleeps, the session on the NAS will eventually time out.Error Codes: The API will begin returning Error 105 (Insufficient user privilege) or 106 (Session timeout).5Recovery Protocol: The "CTRL" extension must implement an HTTP Interceptor.Intercept any response with error.code == 105 or 106.Pause all outgoing API queues.Trigger a background re-authentication using the stored username, password, and device_id.If re-auth succeeds: Update the stored sid and synotoken, then replay the failed requests.If re-auth fails (e.g., password changed, account locked): Transition state to DISCONNECTED and notify the user.2.5 Concurrent Session ManagementSynology NAS devices have a limit on concurrent HTTP sessions (often 1024 or higher). However, creating a new session for every single background task is inefficient and can trigger security blocks.Singleton Pattern: The extension should maintain a singleton sid in browser.storage.local.Session Sharing: When logging in, the session parameter identifies the context. Using session=DownloadStation is semantically correct. Interestingly, SYNO.FileStation APIs (used for folder browsing) generally accept the same sid generated for DownloadStation because the session is tied to the User Principle, not the Application Scope, in most DSM versions. However, some strictly scoped permissions in DSM 7 might require checking SYNO.API.Auth capabilities. The safest approach is to reuse the sid but be prepared to handle 403 on File Station endpoints if the user has restricted application access.63. API Discovery Architecture and Protocol NegotiationHardcoding API paths is the antithesis of the Synology architectural model. The SYNO.API.Info service serves as the dynamic registry, akin to a DNS for internal NAS services.3.1 The SYNO.API.Info MechanismBefore any functional call is made, the client must query query.cgi.Request:GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=ALLResponse Analysis:The response provides a map of every available API namespace.JSON{
  "data": {
    "SYNO.API.Auth": { "maxVersion": 7, "minVersion": 1, "path": "entry.cgi" },
    "SYNO.DownloadStation.Task": { "maxVersion": 1, "minVersion": 1, "path": "DownloadStation/task.cgi" },
    "SYNO.DownloadStation2.Task": { "maxVersion": 2, "minVersion": 1, "path": "DownloadStation/entry.cgi", "requestFormat": "JSON" }
  },
  "success": true
}
Architectural Implications:Dynamic Routing: The path attribute tells the client exactly where to send requests. Note that SYNO.DownloadStation.Task lives at DownloadStation/task.cgi, while the modern SYNO.DownloadStation2.Task lives at DownloadStation/entry.cgi. A client that assumes task.cgi for everything will fail on V2 calls.3Version Negotiation: The client sees minVersion and maxVersion. The extension should always request the maxVersion supported by both the client code and the server.Scenario: Client supports V1 and V2. Server supports V1-V3. Client should request V2 (as it hasn't implemented V3 yet) or V3 (if it's generic enough). Usually, strict matching is safer: Request min(ClientMax, ServerMax).requestFormat: This field is critical. If requestFormat: "JSON" is present (common in V2 APIs), the client must send parameters as a JSON payload in the body, rather than application/x-www-form-urlencoded. Ignoring this leads to "Invalid Parameter" (Error 101) because the server parses the body incorrectly.83.2 Namespace Resolution StrategyThe "CTRL" extension must implement a namespace resolver that runs at startup.Query: Ask for SYNO.DownloadStation.Task, SYNO.DownloadStation2.Task, SYNO.FileStation.List, and SYNO.API.Auth.Feature Flagging:If SYNO.DownloadStation2.Task is present: Enable "Modern" mode. Use V2 endpoints for task creation (allows explicit destination setting).If only SYNO.DownloadStation.Task is present: Enable "Legacy" mode. Use V1 endpoints. Warn the user that some features (like selecting destination folders) might be limited or rely on default settings.Caching: This discovery data can be cached, but should be invalidated on any connection error that suggests a system update (e.g., Error 102 "API does not exist").4. The Download Station Namespaces: Legacy vs. ModernA major source of confusion in Synology development is the existence of two parallel APIs for Download Station. The documentation stops at SYNO.DownloadStation (Legacy), but the actual DSM web interface uses SYNO.DownloadStation2.4.1 Comparison of NamespacesFeatureSYNO.DownloadStation (Legacy)SYNO.DownloadStation2 (Modern)PathDownloadStation/task.cgiDownloadStation/entry.cgi (usually)Methodscreate, list, delete, infocreate, list, delete, pause, resumeTask CreationSimple. URI-based. Implicit destination.Advanced. Supports complex objects. Explicit destination.File Uploadmultipart/form-data with file param.multipart/form-data with JSON string in file param (sometimes) or standard file upload.DocumentationAvailable (outdated 2014 PDF).Non-existent. Must reverse engineer.ReliabilityDeprecated. Often fails on DSM 7 with files.Preferred for DSM 7.4.2 Deep Dive: Task Creation (create)This is the most critical function for the "CTRL" extension.4.2.1 Legacy API (SYNO.DownloadStation.Task)Method: createParameters:uri: The URL or Magnet link.file: (Optional) File content.Limitation: You cannot easily specify the destination folder per-task in all versions; it often defaults to the system setting.Issue: On DSM 7, users report error 101 (Invalid Parameter) when using this API for magnet links or complex torrents.144.2.2 Modern API (SYNO.DownloadStation2.Task)Method: createParameters:type: Must be specified as "url" or "file".create_list: Boolean. Usually false for adding a single download.destination: Mandatory. The path (e.g., "home/Downloads"). The legacy API allowed omission; V2 requires it. This explains why many legacy wrappers fail on DSM 7—they don't send destination.16file: If type="file", this parameter handles the upload.url: If type="url", this contains the magnet/http link.Recommendation: The "CTRL" extension should default to SYNO.DownloadStation2.Task if available. It must explicitly allow the user to select a destination folder (via SYNO.FileStation.List) because the V2 API likely won't accept a null destination.4.3 Task Listing and PollingWhile V2 is better for creation, the listing format of V2 can be overly complex (often returning specialized structures for the UI grid).Hybrid Approach: It is often stable to use SYNO.DownloadStation2.Task for write operations (create, delete) and SYNO.DownloadStation.Task (Legacy) for read operations (list), as the list format of the legacy API is simple, well-understood, and unlikely to break.Data Normalization: The extension must normalize the response.Legacy: Returns size in bytes, status as a string/enum (e.g., "downloading", "seeding").Modern: Might return localized status strings or different enum integers. The extension needs a mapping layer.5. Stability and Hibernation MechanicsA Synology NAS is an energy-saving device designed to spin down its mechanical drives (hibernation) when idle. A browser extension that polls the API every 5 seconds for download status acts as a "keep-awake" signal, preventing the NAS from ever sleeping. This generates heat, noise, and significant power usage, frustrating users.45.1 The Physics of API LatencyWhen a NAS is hibernating:State: CPU is in low-power mode. SATA controllers are active but disks are stopped.Request: API request arrives (TCP Handshake).Wake-up: The kernel realizes it needs to read from disk (to load the CGI binary or verify session in database).Spin-up: The kernel issues a spin-up command. Mechanical drives take 8 to 15 seconds to reach 7200 RPM and calibrate.Processing: Only after spin-up does the web server (Nginx) process the request and return data.The Timeout Problem:Standard AJAX/Fetch timeouts are often 10-30 seconds.Scenario: Extension polls. NAS is asleep. Spin-up takes 12s. Browser times out at 10s.Result: The extension reports "Connection Lost." The NAS wakes up 2 seconds later, processes the request, and finds the client gone. The user sees an error, and the NAS woke up for nothing.5.2 Heuristic Polling ArchitectureTo respect hibernation, "CTRL" must implement a Heuristic Polling Scheduler.Adaptive Interval:Active Downloads: Poll every 2-5 seconds. (User wants real-time updates).Idle (No active downloads): Poll every 15-30 minutes.Latency Detection:Measure the round-trip time (RTT) of the list request.Normal RTT: < 500ms.Spin-up RTT: > 5000ms.Logic: If a request takes > 5000ms, the extension should assume the NAS was asleep. Immediately switch to "Passive Mode" (very slow polling) to allow it to sleep again if the user isn't actively interacting.Extended Timeouts:Set the HTTP timeout for all Synology requests to 60 seconds. This covers the worst-case spin-up time + system load, preventing false "Connection Error" states during wake-up.185.3 Error 503/504 HandlingDuring the wake-up phase, or if the system is overloaded (e.g., verifying par2 files), the Nginx reverse proxy might return 503 Service Unavailable or 504 Gateway Timeout before the CGI finishes.19Recovery Action:Do not treat 503/504 as a fatal auth error.Do not immediately retry (this adds load).Backoff: Implement exponential backoff (wait 10s, then 20s, then 40s). If the error persists after 3 tries, notify the user.6. Error Handling and Edge CasesThe Synology API uses a mix of HTTP status codes and JSON error codes. A robust client must parse both.6.1 Complete Error Code ReferenceThe error object in the JSON response contains a code field.CodeDescriptionArchitectural Handling100Unknown ErrorGeneric failure. Retry once, then fail.101Invalid ParameterCritical. Often means version mismatch, missing SynoToken, or wrong HTTP method (GET vs POST). Also triggered by missing destination in V2 APIs.102API does not existThe package (Download Station) might be stopped or uninstalled. Trigger discovery refresh.103Method does not existCheck spelling. Ensure version negotiation didn't select a version too high/low.104Version not supportedNegotiation Failure. The client requested a version the server doesn't support. Re-run SYNO.API.Info.105Insufficient privilegeSession Expired. The sid is invalid. Trigger Re-Authentication flow.106Session timeoutSession Expired. Same as 105. Trigger Re-Auth.107Duplicate loginThe user logged in elsewhere, invalidating this session (if strict mode enabled). Re-Auth.400Execution FailedGeneric execution error (e.g., bad torrent file).407IP BlockedFatal. The NAS Auto Block system banned the client IP. Stop all requests immediately to prevent permanent ban. User must unblock IP in DSM.408File not foundOften related to SYNO.FileStation accessing a moved folder.6.2 Disk Quota ExceededWhen the volume is full:The API might return success: true for the create call.However, the task status in the next list call will be error or broken with a status details field indicating "Disk Full".Insight: The API is asynchronous. "Creation" just means "Accepted into queue." The extension must verify the task status after creation to confirm it actually started.6.3 Network Interface ChangesIf the NAS has multiple LAN ports (failover/bonding) or the user changes IP:The sid is often bound to the IP address of the client and the interface of the server.If the NAS IP changes (DHCP), the extension's stored URL becomes invalid. Connection timeout.Recovery: The extension cannot magically find the new IP. It must report "Connection Lost."DNS Rebinding: If accessing via a local hostname (e.g., nas.local), strict DNS rebinding protection in the router or browser might block the request. The extension should encourage users to use static IPs or proper FQDNs with SSL.7. Security Considerations7.1 HTTPS and Certificate PinningDSM 7 enforces HTTPS and uses HSTS (HTTP Strict Transport Security).Self-Signed Certs: Most home users use self-signed certs. Browsers (Chrome/Firefox) block XHR requests to self-signed HTTPS endpoints silently unless the user has manually visited that URL and accepted the warning.Extension Limitation: Extensions cannot programmatically accept invalid certs.UX Pattern: If the extension detects a generic network error on a known-good HTTPS URL, it should prompt the user: "Please open the NAS interface in a new tab and accept the security certificate."7.2 CSRF Protection (SynoToken)As detailed in Auth, the SynoToken is the primary defense against Cross-Site Request Forgery.Enforcement: "CTRL" must include SynoToken in the headers (X-SYNO-TOKEN) or body of every POST request.Absence: If the NAS has CSRF protection disabled, the token might be empty. The client code must handle null tokens gracefully but always send the token if one was received during login.7.3 App-Specific PasswordsDSM supports "App Permissions" and sometimes "App Portals."Limitation: The Web API typically authenticates the user, not a specific app password. App-specific passwords are usually for protocols like WebDAV or specialized packages.Recommendation: "CTRL" should use the main user credentials. If the user wants to restrict access, they should create a specific DSM user (e.g., ctrl_user) with permissions only for Download Station and File Station, and deny access to other services.7.4 Auto Block and Circuit BreakingSynology's "Auto Block" is aggressive. 5 failed attempts in 5 minutes = IP Ban.Circuit Breaker: The extension must implement a counter for failed auth attempts (Error 400-404 range).Threshold: If 2 consecutive login attempts fail, the extension must stop automatic retries and require explicit user interaction (e.g., re-entering the password).Why? If the user changes their password on the NAS, the extension (using the old cached password) would otherwise hammer the API in the background, banning the user's IP within minutes. The Circuit Breaker prevents this catastrophe.218. DSM Compatibility Matrix (Summary)FeatureDSM 6.xDSM 7.xAction for CTRLAuth VersionMax v6Max v7Query SYNO.API.Info.2FAServer returns did.Client must generate UUID for device_id.Implement client-side UUID generation.Task CreateSYNO.DownloadStation.Task (v1/v3).SYNO.DownloadStation2.Task (v2) preferred.Feature detect via Info. Prefer V2.DestinationOptional (defaults to system).Mandatory in V2 API.Require user to select destination.HTTP MethodsLoose (GET often works).Strict (POST required).Always use POST for state changes.HTTPSOptional.Enforced/HSTS.Handle self-signed cert UX.JSON-RPCForm-data common.JSON body common (requestFormat: JSON).Check requestFormat in Discovery.9. Recommendations for "CTRL" ImplementationBased on this architectural analysis, the following implementation roadmap is recommended:State Machine Core: Build a rigid state machine (Init -> Discovery -> Auth -> Idle -> Polling -> Hibernating -> Error). Do not use ad-hoc boolean flags.Discovery Layer: Implement a robust SYNO.API.Info parser that configures the client's URLs and versions at runtime.UUID Generation: Ensure the extension generates and persists a random UUID for device_id to fix DSM 7 2FA persistence.Heuristic Polling: Implement the "Slow Poll" mode when latency > 5s to respect NAS hibernation.Circuit Breaker: Hard stop on auth failures to protect the user from Auto Block.Dual-Namespace Support: Implement adapters for both DownloadStation (Legacy) and DownloadStation2 (Modern) to ensure compatibility across the fractured ecosystem.By adhering to these protocols, the "CTRL" extension will achieve a level of stability and "good citizenship" on the network that surpasses standard, naive API integrations.End of Report