# Transmission RPC API Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation, Data Structures, and API Methods**.
> - Document all RPC methods, fields, and response structures.
> - Identify advanced features for implementation.
> - Provide code examples and implementation patterns.

---

## Purpose

Export this prompt to another LLM for deep research on Transmission RPC **feature implementation and capabilities**.

---

## Context

You are researching the **Transmission RPC API** for integration into a browser extension called "CTRL" that manages BitTorrent clients. We already have a working `TransmissionAdapter` implementation (215 lines, TypeScript) that supports:

- Basic Auth + `X-Transmission-Session-Id` header
- Torrent CRUD (add, list, pause, resume, delete)
- Labels (tags) via `labels` field (Transmission 3.0+)
- Progress, speed, ETA, and download directory

**Note:** This adapter is also the base class for BiglyBT and Vuze adapters (they use Transmission-compatible RPC).

**Current Gaps We Want to Explore:**
1. Bandwidth scheduling - Time-based speed limits
2. Blocklist support - IP blocklist for privacy
3. Free space checking - Pre-download disk validation
4. Queue management - Priority and position
5. Torrent verification - Force recheck
6. Tracker manipulation - Add/remove trackers
7. Session settings - All configurable options

---

## Research Tasks (BUILDER FOCUS)

### 1. Torrent Data Methods
- `torrent-get` - All available fields and their types
- `torrent-set` - All modifiable properties
- `torrent-add` - Options for adding torrents (paused, labels, priority)
- `torrent-remove` - Delete data flag behavior
- Field differences between v2.x, 3.x, and 4.x

### 2. Session Configuration
- `session-get` - All retrievable session properties
- `session-set` - All configurable settings
- Speed limit fields (`speed-limit-*`)
- Turtle mode / alt-speed configuration
- Download directory management

### 3. Bandwidth Scheduling
- `alt-speed-time-*` parameters for scheduling
- Day selection (alt-speed-time-day bitmask)
- Time window configuration
- Activating/deactivating scheduled limits

### 4. Queue Management
- `queue-move-top`, `queue-move-up`, `queue-move-down`, `queue-move-bottom`
- `bandwidthPriority` field values (-1, 0, 1)
- `queuePosition` manipulation
- Seeding queue vs download queue

### 5. File & Storage Operations
- `free-space` method for disk validation
- `torrent-set-location` for moving torrents
- `torrent-verify` for force recheck
- `torrent-reannounce` for tracker refresh
- File priority arrays (`files-wanted`, `files-unwanted`, `priority-high`, etc.)

### 6. Tracker Management
- `trackerAdd` and `trackerRemove` arguments
- `trackerReplace` for updating URLs
- Tracker stats fields in `torrent-get`

### 7. Advanced Features
- `seedRatioLimit` and `seedIdleLimit` per torrent
- Peer limit configuration
- Blocklist support (`blocklist-*` session fields)
- Port testing (`port-test` method)

---

## Expected Output Format

Please provide:
1. **RPC Method Reference Table** - Method name, arguments, response format
2. **Torrent Fields Catalog** - Complete list of `torrent-get` fields with types
3. **Session Settings Reference** - All `session-get`/`session-set` keys
4. **Feature Implementation Examples** - Code snippets for each capability
5. **Response Parsing Guide** - How to handle various response formats
6. **BiglyBT/Vuze Compatibility** - Known differences from standard Transmission

---

## Additional Resources (if accessible)
- Transmission RPC spec (transmission-rpc-spec.txt)
- BiglyBT xmwebui plugin documentation
- Vuze Remote WebUI documentation
- Community implementations (Sonarr, Radarr, Flood)

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Comprehensive Architectural Analysis and Implementation Guide for the Transmission RPC Protocol: Version 4.0 Compliance, Legacy Support, and Cross-Client Integration1. Introduction to the Transmission RPC EcosystemThe Transmission Remote Procedure Call (RPC) interface serves as the foundational communication layer for the Transmission BitTorrent client, enabling external applications to monitor state, manipulate configuration, and control torrent lifecycles programmatically. For developers architecting the "CTRL" browser extension, understanding the RPC protocol is not merely a matter of mapping endpoints; it requires a deep appreciation of the protocol's evolution, particularly the seismic shift introduced in Transmission 4.0, and the subtle dialectal variations present in compatible clients like BiglyBT and Vuze.This report provides an exhaustive technical analysis of the Transmission RPC specification. It is designed to serve as the definitive implementation reference for the construction of a robust, type-safe TransmissionAdapter in TypeScript. The analysis synthesizes data from official specifications, developer community discussions, and source code observations to illuminate the intricacies of feature implementation, ranging from basic CRUD operations to advanced bandwidth scheduling and storage management.The architecture of the Transmission RPC is built upon HTTP/HTTPS transport, utilizing JSON payloads for both request and response bodies. Unlike RESTful interfaces which rely on HTTP verbs to define operations, Transmission strictly adheres to RPC conventions where the method is defined within the JSON payload itself. This design choice facilitates complex operations, such as batch updates and atomic transactions, within a single HTTP round-trip. However, it also imposes specific requirements on the client implementation regarding session authentication, version negotiation, and error handling—complexities that have only increased with the recent adoption of the JSON-RPC 2.0 standard in Transmission 4.0.1Furthermore, the ecosystem extends beyond the reference Transmission daemon. Clients such as BiglyBT and Vuze (Azureus) implement emulation layers—most notably the xmwebui plugin—that expose a Transmission-compatible RPC interface. These implementations, while largely compliant, introduce unique behaviors, proprietary fields, and subtle deviations in method signatures that a unified adapter must elegantly abstract. This report will systematically dissect these variances to ensure the "CTRL" extension functions seamlessly across the entire spectrum of supported backends.2. Transport Architecture and Security MechanismsThe reliability of the TransmissionAdapter hinges on a correct implementation of the transport layer. The RPC interface does not maintain a persistent socket connection; rather, it operates via stateless HTTP POST requests to the /transmission/rpc endpoint. However, the stateless nature of HTTP is augmented by a rigorous session security model that prevents Cross-Site Request Forgery (CSRF).2.1 The Session ID Handshake ProtocolA critical security feature of the Transmission RPC is the requirement for a valid X-Transmission-Session-Id header in every request. The server does not issue this ID upon a specific "login" method; instead, it utilizes a challenge-response mechanism. When a client initiates a request without this header, or with an expired ID, the server rejects the request with an HTTP 409 Conflict status code. Crucially, the response headers of this 409 rejection contain the new, valid Session ID.1For the "CTRL" extension, the networking layer must implement an automatic interception and retry logic. The flow is as follows:The adapter constructs the JSON payload for the intended operation (e.g., torrent-get).The request is transmitted to the RPC endpoint.The server validates the X-Transmission-Session-Id.If valid, the operation proceeds.If invalid or missing, the server returns HTTP 409 and provides the correct ID in the response header.The adapter must catch this 409 error, extract the header value, update its internal state configuration, and immediately re-transmit the original payload with the new header.This mechanism ensures that only clients capable of reading headers (same-origin or CORS-permitted) can interact with the daemon, effectively mitigating CSRF attacks where a malicious site might attempt to blind-POST data to the local daemon.32.2 Protocol Versioning and JSON-RPC 2.0 TransitionThe release of Transmission 4.0 marked a significant maturation of the protocol, formally adopting the JSON-RPC 2.0 specification. While previous versions used a bespoke JSON format that loosely resembled JSON-RPC, version 4.0 enforces strict compliance. This shift has profound implications for response parsing and error handling.2Legacy versions (pre-4.0) utilized a flat response structure where success or failure was indicated by a simple result string. In contrast, the v4.0+ JSON-RPC 2.0 implementation introduces a structured error object containing numeric codes and data payloads, alongside the result object.To manage this transition without breaking backward compatibility, Transmission 4.0 and later include an X-Transmission-Rpc-Version header in the HTTP 409 response.2 This allows the "CTRL" adapter to determine the daemon's capabilities during the initial Session ID handshake.Version EraHeader IndicatorKey CharacteristicsLegacy (v1.x - v3.x)X-Transmission-Session-Id onlyBespoke JSON. Hyphenated keys (e.g., download-dir). Loose typing on some fields.Modern (v4.0+)X-Transmission-Rpc-Version presentStrict JSON-RPC 2.0. Support for snake_case keys (e.g., download_dir). Structured error objects.The adapter should prioritize using hyphenated keys (e.g., download-dir) in requests, as modern versions of Transmission maintain backward compatibility for these keys, whereas legacy versions will fail if snake_case is used. This strategy ensures a single codebase can support the widest range of daemon versions.22.3 Response Envelope StructureUnderstanding the response envelope is prerequisite to parsing data. A standard successful response follows a consistent schema across versions, though v4.0 adds strictness.Response Schema:result (string): "success" indicates a successful operation. Any other string indicates failure in legacy mode.arguments (object): Contains the requested data (e.g., torrents array, session object).tag (number): An integer identifier matching the tag passed in the request. This is essential for correlating asynchronous responses in a high-concurrency browser extension environment.In v4.0+, an error response follows the JSON-RPC 2.0 standard:error (object): Present only on failure.code (number): Numeric error identifier.message (string): Human-readable description.data (object): Additional context, often containing a specific errorString.23. Torrent Data Methods and Data StructuresThe manipulation of torrent data constitutes the core functionality of the "CTRL" extension. The RPC API provides a comprehensive suite of methods for creating, retrieving, updating, and deleting torrents. The data structures returned by these methods are rich and typed, requiring precise interface definitions in TypeScript.3.1 Accessor Logic: torrent-getThe torrent-get method is the primary mechanism for state synchronization. To optimize performance—crucial for a browser extension operating over potentially slow network links—the client must explicitly specify the fields array in the request arguments. Requesting all fields is inefficient and discouraged.3.1.1 The Fields CatalogThe following table details the essential fields that the TransmissionAdapter must support to enable the features outlined in the prompt (progress, speed, ETA, status, verification, etc.).Field NameTypeDescription and Implementation SemanticsidIntegerThe unique identifier for the torrent within the current session. Note that IDs are not guaranteed to persist across daemon restarts in all versions, though they are generally stable.hashStringStringThe SHA-1 hash of the torrent (40 hex characters). This is the immutable identifier and should be used by "CTRL" for local storage references.nameStringThe display name of the torrent.statusIntegerA numeric code representing the current state. The adapter must map these to enums: 0=Stopped, 1=Check Wait, 2=Check, 3=Download Wait, 4=Download, 5=Seed Wait, 6=Seed.2errorIntegerError state: 0=OK, 1=Tracker Warning, 2=Tracker Error, 3=Local Error.errorStringStringDescriptive error message. Should be exposed in the UI via tooltips.percentDoneDoubleDownload progress (0.0 to 1.0). In v4.0, this is distinct from verification progress.recheckProgressDoubleProgress of data verification (0.0 to 1.0). Essential for displaying "Checking..." bars correctly.rateDownloadIntegerInstantaneous download speed in bytes per second.rateUploadIntegerInstantaneous upload speed in bytes per second.etaIntegerEstimated seconds until completion. Returns -1 for "not available" and -2 for "unknown". The UI must handle these sentinels gracefully.downloadDirStringThe absolute path on the server where the data is stored.filesArrayDetailed file list. Each object contains name (string), length (int), and bytesCompleted (int).fileStatsArrayParallel array to files. Contains wanted (boolean), priority (int), and bytesCompleted (int). Indices correspond strictly to the files array.peersConnectedIntegerTotal count of connected peers.peersGettingFromUsIntegerCount of peers currently downloading from the client (upload slots).peersSendingToUsIntegerCount of peers currently uploading to the client.queuePositionIntegerThe torrent's order in the execution queue. Lower numbers execute first.trackersArrayList of trackers. Structure includes id, announce, tier.trackerStatsArrayRuntime statistics for trackers: announceState, lastAnnounceResult, seederCount, leecherCount, downloadCount.labelsArray(v3.0+) Array of strings used for tagging/categorization.wantedArray(v4.0+) Array of booleans indicating file download selection. Note: v3.x used 0/1 integers; v4.0.2 reverted to 0/1 for compatibility.2 Adapter must handle truthy/falsy values.bandwidthPriorityIntegerPriority level: -1 (Low), 0 (Normal), 1 (High).seedRatioLimitDoubleThe ratio at which seeding should stop for this torrent.seedIdleLimitIntegerThe minutes of inactivity before seeding stops.3.1.2 Response Format OptimizationTransmission supports a format argument in torrent-get. The default is objects, which returns an array of JSON objects. However, specifying format: "table" returns an array of arrays, where the first row contains the keys and subsequent rows contain the values.Table Format Example:JSON{
  "torrents":,
   ,
    [2, "Arch Linux", 1.0]
}
This format significantly reduces JSON payload size for large lists. The TransmissionAdapter should implement logic to normalize this response into objects for consumption by the UI layer, effectively abstracting the transport optimization.33.2 Mutator Logic: torrent-setThe torrent-set method modifies the properties of existing torrents. It requires an ids argument, which can be an array of IDs, an array of hash strings, or the special string "recently-active" (though usage of the latter in set operations is rare).Key Modifiable Properties:Queue & Priority: queuePosition (int), bandwidthPriority (int).Limits: downloadLimit (int), uploadLimit (int), downloadLimited (bool), uploadLimited (bool), peer-limit (int).Seeding: seedRatioLimit (double), seedRatioMode (0=Global, 1=Single, 2=Unlimited), seedIdleLimit (int), seedIdleMode (0=Global, 1=Single, 2=Unlimited).Files: files-wanted (array of file indices), files-unwanted (array of file indices), priority-high, priority-normal, priority-low (arrays of file indices).Labels: labels (array of strings). Note that this replaces the current list; adding a label requires get -> append -> set.3.3 Lifecycle Operations: Add and Remove3.3.1 torrent-addAdding torrents requires careful handling of source data.filename: Can be a Magnet URI or a URL to a.torrent file.metainfo: Base64-encoded content of a.torrent file. This is the preferred method for browser extensions where the user selects a local file.download-dir: (Optional) Overrides the session default.paused: (Boolean) If true, the torrent is added in a "Stopped" state.labels: (Array) Initial labels to apply.Response: Returns an object containing the id, name, and hashString of the added torrent. If the torrent already exists, the response key changes to torrent-duplicate, providing the details of the existing entry.23.3.2 torrent-removeRemoves torrents from the session.ids: Array of identifiers.delete-local-data: (Boolean) CRITICAL: If set to true, the daemon permanently deletes the downloaded files from the disk. The "CTRL" UI must gate this functionality behind a robust confirmation dialog to prevent data loss.24. Session Configuration: Global ControlThe session-get and session-set methods control the daemon's global behavior. Unlike per-torrent settings, these affect the entire application state.4.1 Global Settings ReferenceThe session object is extensive. The following table categorizes the key settings relevant to the "CTRL" extension's gaps.CategoryKeyTypeDescriptionSpeedspeed-limit-downIntGlobal download limit (KB/s).speed-limit-down-enabledBoolToggle for global download limit.speed-limit-upIntGlobal upload limit (KB/s).speed-limit-up-enabledBoolToggle for global upload limit.Turtle Modealt-speed-enabledBoolMaster toggle for Alternative Speed Limits.alt-speed-downIntAlternate download limit (KB/s).alt-speed-upIntAlternate upload limit (KB/s).Schedulingalt-speed-time-enabledBoolToggle for time-based scheduling.alt-speed-time-beginIntStart time (minutes from midnight).alt-speed-time-endIntEnd time (minutes from midnight).alt-speed-time-dayIntBitmask for active days.Storagedownload-dirStringDefault download path.incomplete-dirStringPath for active downloads.incomplete-dir-enabledBoolToggle usage of incomplete directory.start-added-torrentsBoolAuto-start newly added torrents.Networkpeer-portIntListening port for incoming connections.port-forwarding-enabledBoolUPnP/NAT-PMP toggle.peer-limit-globalIntMax global peers.Blocklistblocklist-enabledBoolMaster toggle for blocklist.blocklist-urlStringURL to the P2P plaintext or DAT blocklist.blocklist-sizeIntRead-only count of blocked IPs.4.2 Bandwidth Scheduling ImplementationTransmission employs a specific bitmask strategy for scheduling "Turtle Mode." The alt-speed-time-day parameter is a sum of values representing individual days.Bitmask Values:Sunday: 1 (0000001)Monday: 2 (0000010)Tuesday: 4 (0000100)Wednesday: 8 (0001000)Thursday: 16 (0010000)Friday: 32 (0100000)Saturday: 64 (1000000)Common Combinations:Weekdays: Mon+Tue+Wed+Thu+Fri = $2+4+8+16+32 = 62$ (0111110).Weekends: Sat+Sun = $64+1 = 65$ (1000001).All Days: $127$ (1111111).To implement this in "CTRL," the UI should present checkboxes for each day. The TransmissionAdapter must sum the selected values to construct the alt-speed-time-day integer for the session-set call.6 The alt-speed-time-begin and alt-speed-time-end fields represent minutes from midnight (e.g., 14:30 = $14 \times 60 + 30 = 870$).5. Tracker Management: The Version 4.0 Paradigm ShiftOne of the most significant complexities in the Transmission RPC involves tracker management. The transition to RPC version 17 (Transmission 4.0) deprecated the granular list manipulation methods in favor of a declarative approach.5.1 Legacy Management (RPC < 17)In versions prior to 4.0 (RPC version 16 and below), managing trackers involved specific mutation commands passed to torrent-set:trackerAdd: An array of strings (URLs) to append to the tracker list.trackerRemove: An array of tracker IDs to delete.trackerReplace: An array of tuples [id, url] to update existing trackers.This method was granular but relied on unstable tracker IDs, leading to race conditions where IDs might shift if the list was modified concurrently.95.2 Modern Management (RPC >= 17)Transmission 4.0 introduced trackerList. This field replaces the entire set of trackers for a torrent with a new list provided as a single string.Key: trackerList (string).Format: URLs are separated by a newline character (\n). A new tier (group of trackers) is indicated by a double newline (\n\n).Example: "http://trackerA.com\nhttp://trackerB.com\n\nhttp://trackerC.com" creates two tiers: Tier 1 contains A and B; Tier 2 contains C.5.3 Implementation Strategy for "CTRL"The TransmissionAdapter must implement a polymorphic method for adding trackers that checks the session's RPC version.Check Version: On connection, store the rpc-version from session-get.Branch Logic:If v4.0+: Fetch the current trackerList via torrent-get. Append the new URL string (preceded by \n\n for a new tier or \n for the same tier). Send the updated full string back via torrent-set.If Legacy: Simply send trackerAdd: [url] via torrent-set.This distinction is non-negotiable; using trackerAdd on v4.0 will result in warnings or failures, and trackerList is unrecognized on older daemons.26. Queue Management and PriorityTransmission separates the concept of execution order (Queue) from bandwidth allocation (Priority).6.1 Queue ManipulationThe RPC API provides four explicit methods for reordering the queue. These methods accept an ids array, allowing batch reordering.queue-move-top: Promotes torrents to the very top (index 0).queue-move-up: Decrements queue position by 1.queue-move-down: Increments queue position by 1.queue-move-bottom: Demotes torrents to the bottom.Additionally, specific positions can be set using torrent-set with the queuePosition argument (integer).6.2 Bandwidth PriorityThis is controlled via the bandwidthPriority field in torrent-set.Values: -1 (Low), 0 (Normal), 1 (High).Impact: Higher priority torrents receive a larger share of available bandwidth but do not necessarily start sooner if the queue is full.6.3 Queue ConfigurationGlobal queue behavior is managed via session-set:download-queue-enabled / download-queue-size: Controls parallel downloads.seed-queue-enabled / seed-queue-size: Controls parallel uploads.queue-stalled-enabled: Allows the queue to skip torrents that are "stalled" (connected to peers but not transferring data), maximizing throughput.7. Storage Operations and File ManagementHandling files and storage locations requires precise API calls to ensure data integrity.7.1 Free Space ValidationTo prevent "Disk Full" errors, the client should validate space before adding a torrent.Method: free-space.Argument: path (string).Response: Object containing path and size-bytes (number).Usage: The adapter should call this using the path from session-get (download-dir) or the user's custom path before invoking torrent-add.17.2 Moving DataMethod: torrent-set-location.Arguments:ids: Array of torrent IDs.location: The new absolute path.move: Boolean. If true, the daemon moves the physical files. If false, it only updates the internal path reference (useful if the user moved files manually via CLI).7.3 File VerificationMethod: torrent-verify.Description: Forces a hash check of the local data. This is critical when importing existing data or recovering from a crash. The torrent status will change to 2 (Check) and recheckProgress will update until completion.7.4 ReannounceMethod: torrent-reannounce.Description: Forces the daemon to contact the tracker immediately, bypassing the announce interval. Useful for jump-starting a stalled torrent.8. Advanced Security and Network Features8.1 Blocklist ManagementTransmission supports IP blocklists to filter malicious peers.Update Method: blocklist-update (no arguments).Response: Returns blocklist-size (integer), indicating the number of rules loaded.Configuration: The URL is set via blocklist-url in session-set. The update is asynchronous; the RPC returns immediately with the result of the fetch/parse operation.118.2 Port TestingTo ensure connectivity (incoming TCP/UDP), the client can trigger a port check.Method: port-test.Response: port-is-open (boolean).UX Consideration: This check relies on an external Transmission server and may take several seconds. The adapter should handle this asynchronously, and the UI should display a loading state.9. Compatibility: BiglyBT and VuzeBiglyBT and Vuze (via the xmwebui plugin) emulate the Transmission API to support remote control tools. While impressive, the emulation is not perfect.9.1 BiglyBT SpecificsNamespace Pollution: BiglyBT injects proprietary fields into the session-get response, often prefixed with az- (e.g., az-rpc-version, az-version). The "CTRL" adapter can use the presence of these fields to detect the backend type.Strict Parameter Validation: BiglyBT's parser is sometimes stricter than Transmission's. For example, empty POST requests might be rejected differently.recently-active Implementation: BiglyBT calculates "recently active" diffs based on the assumption that the requested field list remains constant between calls. If "CTRL" changes the fields array dynamically, BiglyBT's diffing logic may return inconsistent results. The adapter should lock the field list for polling loops.139.2 Vuze SpecificsDownload Directory Paths: Vuze often reports the downloadDir as the full path including the torrent name, whereas Transmission reports the parent directory. This can cause file browsing logic in the "CTRL" extension to miscalculate paths.Version Masquerading: Vuze may report a Transmission version (e.g., 2.92) to satisfy client checks, but the actual capabilities might differ. It is safer to rely on feature detection (probing for specific fields) than version strings.1410. Feature Implementation Reference (Code Patterns)The following TypeScript implementation patterns demonstrate how to synthesize the research findings into the TransmissionAdapter.10.1 Polymorphic Tracker AdditionTypeScriptinterface RpcResponse {
    result: string;
    arguments: any;
    tag?: number;
}

async function addTrackerToTorrent(
    adapter: TransmissionAdapter,
    torrentId: number,
    trackerUrl: string
): Promise<RpcResponse> {
    const session = await adapter.getSession();
    // RPC Version 17 corresponds to Transmission 4.0
    const rpcVersion = session.arguments['rpc-version'] |

| 0;

    if (rpcVersion >= 17) {
        // v4.0+ Strategy: Append to trackerList string
        const getRes = await adapter.rpcCall({
            method: 'torrent-get',
            arguments: { ids: [torrentId], fields: ['trackerList'] }
        });

        let currentList = getRes.arguments.torrents.trackerList |

| "";
        // Append new tracker. If list not empty, add double newline for new tier
        // or single newline for same tier. Here we create a new tier.
        if (currentList.length > 0) {
            currentList += "\n\n";
        }
        currentList += trackerUrl;

        return await adapter.rpcCall({
            method: 'torrent-set',
            arguments: { ids: [torrentId], trackerList: currentList }
        });
    } else {
        // Legacy Strategy: Use trackerAdd array
        return await adapter.rpcCall({
            method: 'torrent-set',
            arguments: {
                ids: [torrentId],
                trackerAdd: [trackerUrl]
            }
        });
    }
}
10.2 Bandwidth Scheduler LogicTypeScriptfunction setTurtleSchedule(
    adapter: TransmissionAdapter,
    enabled: boolean,
    beginHour: number, 
    beginMin: number,
    endHour: number,
    endMin: number,
    activeDays: boolean //
): Promise<RpcResponse> {
    
    // Calculate minutes from midnight
    const beginMinutes = (beginHour * 60) + beginMin;
    const endMinutes = (endHour * 60) + endMin;

    // Calculate Bitmask
    // Sunday is bit 0 (value 1), Monday bit 1 (value 2), etc.
    let dayMask = 0;
    const bitValues = ; // Sun -> Sat

    activeDays.forEach((isActive, index) => {
        if (isActive) {
            dayMask += bitValues[index];
        }
    });

    return adapter.rpcCall({
        method: 'session-set',
        arguments: {
            'alt-speed-time-enabled': enabled,
            'alt-speed-time-begin': beginMinutes,
            'alt-speed-time-end': endMinutes,
            'alt-speed-time-day': dayMask
        }
    });
}
10.3 Robust 409 Conflict HandlingTypeScriptasync function fetchWithSession(url: string, payload: any, sessionId: string | null): Promise<any> {
    let currentId = sessionId;
    
    const performRequest = async (id: string | null) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (id) headers = id;

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        return response;
    };

    let response = await performRequest(currentId);

    if (response.status === 409) {
        // Extract new ID from header
        currentId = response.headers.get('X-Transmission-Session-Id');
        if (!currentId) throw new Error("409 received but no session ID header found");
        
        // Update global storage with new ID
        saveSessionId(currentId);
        
        // Retry immediately
        response = await performRequest(currentId);
    }

    return response.json();
}
11. ConclusionThe Transmission RPC API is a mature, powerful interface that has recently undergone significant modernization with version 4.0. For the "CTRL" extension, the primary challenges lie not in the basic data retrieval, but in the nuanced handling of version-specific features (specifically tracker management and JSON-RPC compliance) and the abstraction of backend idiosyncrasies (BiglyBT/Vuze).By implementing the X-Transmission-Session-Id retry loop at the transport level, adopting a version-aware strategy for trackerList vs trackerAdd, and utilizing the efficient table response format for data retrieval, the builder team can ensure a responsive, stable, and feature-rich user experience. The data structures and logic flows detailed in this report provide the necessary blueprint to bridge the gap between a standard web extension and the complex, stateful nature of the BitTorrent protocol.