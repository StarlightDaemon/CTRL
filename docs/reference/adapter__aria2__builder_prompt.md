# Aria2 API Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific JSON payloads for methods (Add, Start, Stop, Remove).
> - Map out all available metadata fields (for UI display).
> - Provide implementation logic for advanced features.

---

## Purpose

Export this prompt to another LLM for deep research on Aria2 JSON-RPC API **feature implementation and data structures**.

---

## Context

You are researching the **Aria2 JSON-RPC API** for integration into a browser extension called "CTRL" that manages download clients. Aria2 is a lightweight multi-protocol download utility supporting HTTP, HTTPS, FTP, SFTP, BitTorrent, and Metalink.

**Current Implementation:**
```typescript
export class Aria2Adapter implements DownloadClientAdapter {
    // 168 lines TypeScript
    // JSON-RPC 2.0 over HTTP/WebSocket
    // Token-based auth via --rpc-secret
}
```

**Current Gaps We Want to Explore:**
1. Torrent metadata extraction - Getting filename from bittorrent info
2. WebSocket events - Real-time download notifications
3. Multi-server orchestration - Managing multiple aria2 instances
4. Bandwidth control - Global and per-download limits
5. File selection - BitTorrent file picker

---

## Research Tasks (BUILDER FOCUS)

### 1. Task Management Methods
- `aria2.addUri` - Complete parameter reference
- `aria2.addTorrent` - Base64 encoding requirements
- `aria2.remove` vs `aria2.forceRemove`
- `aria2.pause` / `aria2.unpause` state transitions

### 2. Status and Metadata
- `aria2.tellStatus` - All available fields
- `aria2.getFiles` - File list structure
- `aria2.getPeers` - Peer information format
- BitTorrent metadata extraction (`bittorrent.info.name`)

### 3. Global Operations
- `aria2.getGlobalStat` - Dashboard statistics
- `aria2.getGlobalOption` / `aria2.changeGlobalOption`
- `aria2.saveSession` - Persistence management

### 4. Bandwidth Control
- `max-overall-download-limit` / `max-overall-upload-limit`
- Per-download limits via `aria2.changeOption`
- `max-concurrent-downloads` queue management

### 5. BitTorrent File Selection
- `select-file` option syntax (1-based indexing)
- Dynamic file selection during download
- `bt-prioritize-piece` for streaming

### 6. HTTP/FTP Header Injection
- `header` option for cookies/referer
- Proxy configuration options
- Authentication for download URLs

### 7. Multicall Optimization
- `system.multicall` payload structure
- Batching strategies for dashboard updates
- Response parsing for bulk operations

---

## Expected Output Format

Please provide:
1. **Method Reference Table** - Method, parameters, response schema
2. **Status Field Map** - All `tellStatus` fields with types
3. **File Selection Examples** - Complete workflow
4. **Bandwidth Control Snippets** - TypeScript examples
5. **Multicall Patterns** - Optimized batch requests
6. **BitTorrent Metadata Extraction** - Magnet link name resolution

---

## Additional Resources (if accessible)
- Aria2 RPC method reference
- Community TypeScript implementations
- AriaNg source code

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Technical Specification and Implementation Guide: Aria2 JSON-RPC Integration for Browser Extension Architecture1. Architectural Overview and Protocol FundamentalsThe integration of the Aria2 download utility into the "CTRL" browser extension requires a sophisticated understanding of the JSON-RPC 2.0 protocol as implemented by the Aria2 daemon. Aria2 operates as a headless backend, decoupling the user interface from the core download logic. This architecture allows for robust, multi-protocol file management (HTTP/FTP/SFTP/BitTorrent/Metalink) but necessitates a rigorous implementation of the communication layer to ensure state synchronization, command reliability, and performance efficiency.This report provides an exhaustive technical analysis of the Aria2 RPC interface, specifically tailored for a TypeScript-based browser extension environment. The analysis prioritizes implementation details, data structure mapping, and payload construction, drawing directly from the Aria2 documentation and community implementations to bridge gaps in the standard manual.11.1 Transport Mechanisms: HTTP vs. WebSocketThe "CTRL" extension must implement a dual-transport strategy to maximize performance and responsiveness. Aria2 exposes its JSON-RPC interface over both HTTP and WebSocket protocols, each serving distinct architectural roles within the extension.HTTP (POST) Transport: The HTTP transport is strictly transactional. It is the preferred mechanism for issuing command-and-control directives where a discrete confirmation of receipt is required. Operations such as adding a URI, removing a download, or changing global options are best handled via HTTP POST requests to the /jsonrpc endpoint. This ensures that the extension receives an immediate success or failure response (with error codes) that can be awaited and handled within a specific promise chain. The overhead of opening a new TCP connection for infrequent commands is negligible compared to the reliability of the request-response cycle.1WebSocket Transport: The WebSocket transport is critical for real-time state observation. In a browser extension, polling an HTTP endpoint for the status of active downloads introduces unnecessary network overhead and latency. By establishing a persistent WebSocket connection to ws://localhost:6800/jsonrpc (or the user-configured address), the "CTRL" client can subscribe to server-initiated notifications. This event-driven architecture allows the UI to update download progress, completion states, and error alerts instantly without user intervention or polling loops.11.2 Authentication and Security Token InjectionAria2 utilizes a token-based authentication model rather than standard HTTP Basic Auth or Bearer tokens. This mechanism, controlled by the --rpc-secret command-line option, requires the client to inject the secret directly into the method parameters.The architectural constraint here is that the token must always be the first parameter in the params array for any method call that requires authorization. The syntax is strictly token:<SECRET>. If the token is missing or incorrect, Aria2 returns a JSON-RPC error (typically code -32602 for invalid params or a 401 equivalent).Implementation Requirement: The Aria2Adapter class must automatically prepend this token to every outgoing request. This logic must be robust enough to handle methods that take no other parameters (where the token becomes the only parameter) and methods that accept variable arguments.1Critical Security Insight: The secret token validation mechanism in Aria2 is designed to mitigate brute-force attacks by introducing a time delay on failed authentication attempts. While beneficial for security, this underscores the importance of the client (the extension) managing the secret securely and ensuring it is not hardcoded but rather retrieved from a secure configuration store.51.3 JSON-RPC 2.0 Envelope StructureAll communications must adhere to the JSON-RPC 2.0 specification. Aria2 expects UTF-8 encoded payloads and does not support floating-point numbers in the request or response bodies. All numerical values representing file sizes, speeds, or limits are transmitted as strings and must be parsed by the TypeScript client.1Standard Request Object:JSON{
  "jsonrpc": "2.0",
  "id": "guid-12345",
  "method": "aria2.addUri",
  "params": [
    "token:user-rpc-secret",
    ["http://example.com/file.zip"],
    { "dir": "/downloads" }
  ]
}
2. Task Management Methods and PayloadsThe primary function of the "CTRL" extension is to orchestrate the lifecycle of download tasks. This section details the specific JSON payloads required for the four critical phases: Initiation (Add), Suspension (Pause), Resumption (Unpause), and Termination (Remove).2.1 Initiating Downloads: addUriThe aria2.addUri method is the workhorse for HTTP, FTP, SFTP, and Magnet link downloads. It accepts a list of URIs, which allows for multi-source downloading if the same file is hosted on multiple mirrors.Method Signature: aria2.addUri([secret], uris, [options], [position])uris: An array of strings. For HTTP/FTP, these are URLs. For BitTorrent Magnet links, this array contains the magnet URI string.options: A dictionary of key-value pairs overriding global settings for this specific download.position: An optional integer (0-based) allowing the client to insert the download at the front of the queue (0) or at a specific index. If omitted, it is appended to the end.1JSON Payload Implementation (HTTP/FTP/Magnet):JSON{
  "jsonrpc": "2.0",
  "id": "add-task-001",
  "method": "aria2.addUri",
  "params": [
    "token:$$secret$$",
    [
      "http://mirror1.example.com/iso/linux.iso",
      "ftp://mirror2.example.com/iso/linux.iso"
    ],
    {
      "dir": "/mnt/data/downloads",
      "max-connection-per-server": "16",
      "split": "16",
      "user-agent": "CTRL-Extension/1.0"
    }
  ]
}
Implementation Insight: When adding a Magnet URI, the uris array contains the magnet link as the sole element. Aria2 will initially create a "metadata download" task. Once the metadata is retrieved from the DHT or peers, this task will complete, and a new task (with a new GID) will seamlessly start for the actual content download. The extension must be prepared to track this GID transition, often by monitoring the followedBy field in the metadata task's status.12.2 Initiating BitTorrent Downloads: addTorrentWhen the user supplies a .torrent file (e.g., via drag-and-drop), the aria2.addTorrent method is used. This method requires the binary content of the torrent file to be Base64 encoded.Method Signature: aria2.addTorrent([secret], torrent, [uris], [options], [position])Critical Implementation Detail: There is a specific requirement in the parameter mapping where the uris argument (used for Web-Seeding) must be present, even if empty, if the developer wishes to pass an options object. Passing options as the third parameter often results in an error or the options being ignored. The robust signature is strictly [secret, torrent_base64,, options, position].9JSON Payload Implementation (Torrent File):JSON{
  "jsonrpc": "2.0",
  "id": "add-torrent-001",
  "method": "aria2.addTorrent",
  "params":, // Mandatory empty array for Web-Seeding URIs if not used
    {
      "dir": "/downloads/torrents",
      "seed-ratio": "1.5",
      "bt-save-metadata": "true"
    }
  ]
}
2.3 Lifecycle Management: Pause and UnpauseManaging the active state of a download involves transitions between active, waiting, and paused statuses.aria2.pause: Transitions a download from active or waiting to paused.Constraint: This method works on individual GIDs. To pause all, aria2.pauseAll is available but less granular.Behavior: If a download is in the process of hashing or negotiating metadata, the pause might not be instantaneous. The status returned immediately might still be active until the transition completes.aria2.unpause: Transitions a download from paused to waiting (and subsequently active if queue slots are available).JSON Payload Implementation (Pause):JSON{
  "jsonrpc": "2.0",
  "id": "pause-task-001",
  "method": "aria2.pause",
  "params":
}
.12.4 Lifecycle Management: Remove vs. ForceRemoveThe distinction between aria2.remove and aria2.forceRemove is vital for data integrity and network etiquette, particularly with BitTorrent.aria2.remove: This is the "graceful" shutdown.Behavior: If the task is a torrent, Aria2 attempts to contact the tracker to send a "stopped" event. This ensures the client is not flagged as a "leecher" that disappeared.State: Transitions the task to removed.Use Case: Standard user-initiated deletion.aria2.forceRemove: This is the "immediate" shutdown.Behavior: Drops connections immediately without contacting trackers.State: Transitions the task to removed.Use Case: Emergency stops, or when a graceful remove hangs due to network timeouts.JSON Payload Implementation (Force Remove):JSON{
  "jsonrpc": "2.0",
  "id": "force-remove-001",
  "method": "aria2.forceRemove",
  "params": [
    "token:$$secret$$",
    "2089b05ecca3d829"
  ]
}
.13. Status and Metadata Data StructuresAccurate rendering of the "CTRL" dashboard relies on interpreting the complex status objects returned by Aria2. The tellStatus method allows for granular retrieval of these fields. To optimize performance, the extension should explicitly request only the necessary keys using the keys parameter, rather than retrieving the full object every time.3.1 aria2.tellStatus Field MapThe following table maps the critical fields available in the tellStatus response. Note that all numerical values are returned as strings to maintain precision and compatibility.1Method Signature: aria2.tellStatus([secret], gid, [keys])Field KeyRaw TypeInterpreted TypeDescription & Implementation NotegidStringStringThe 16-character hex identifier. Key for all future operations.statusStringEnumactive, waiting, paused, error, complete, removed. Logic must handle error by checking errorCode.totalLengthStringNumber (Bytes)Total size. For Metalinks/Torrents, this is the sum of all file sizes.completedLengthStringNumber (Bytes)Bytes actively written to disk.uploadLengthStringNumber (Bytes)Bytes uploaded (BitTorrent only). Used to calc share ratio.bitfieldStringHex StringRepresents pieces downloaded. Vital for visualizing "chunk" progress bars.downloadSpeedStringNumber (B/s)Instantaneous speed. Smooth this on the UI side.uploadSpeedStringNumber (B/s)Instantaneous upload speed.infoHashStringStringSHA-1 hash of the Info dictionary. Essential for identifying torrents.numSeedersStringNumberNumber of connected seeders.seederStringBooleantrue if the client is currently seeding (download complete, uploading only).pieceLengthStringNumber (Bytes)Size of a single piece. Used with numPieces to map the bitfield.numPiecesStringNumberTotal count of pieces.connectionsStringNumberTotal peer/server connections.errorCodeStringString0 if no error. Non-zero values map to specific failures (e.g., file not found).errorMessageStringStringHuman-readable explanation of errorCode.dirStringStringThe generic save directory.filesArrayFileArray of file objects (Detailed in 3.2).bittorrentObjectBitTorrentDeep metadata struct (Detailed in 3.3).followedByStringString (GID)If this download generates another (e.g., Magnet -> Torrent), this points to the new GID.followingStringString (GID)Points to the GID that generated this download.belongsToStringString (GID)For multi-file torrents, this points to the master GID.JSON Payload Example (Optimized Status Query):JSON{
  "jsonrpc": "2.0",
  "id": "status-query-001",
  "method": "aria2.tellStatus",
  "params":
}
3.2 File List Structure (getFiles)The files key (also retrievable via aria2.getFiles) returns an array of file objects. This structure is critical for the "File Selection" feature.Data Structure Reference:TypeScriptinterface Aria2File {
  index: string;           // 1-based index (e.g., "1", "2"). CRITICAL for select-file.
  path: string;            // Absolute path on disk. Empty if not yet determined.
  length: string;          // Size of this specific file.
  completedLength: string; // Bytes of this file currently on disk.
  selected: string;        // "true" or "false". Indicates if the user chose to download this.
  uris: {                  // Array of source URIs for this specific file.
    uri: string;
    status: string;        // "used" or "waiting".
  };
}
.13.3 BitTorrent Metadata ExtractionExtracting the actual "Name" of a torrent is non-trivial because the file path might not match the torrent's internal name, especially with multi-file torrents or Magnet links. The bittorrent object within the tellStatus response holds this data.Extraction Logic:Check if status.bittorrent exists (it won't for HTTP downloads).Access status.bittorrent.info.name. This is the display name recommended by the.torrent metadata.Fallback: If bittorrent.info is missing (common with Magnet links pending metadata), use files.path or the GID as a placeholder until the onBtDownloadComplete event fires (signaling metadata acquisition).Data Structure Reference:TypeScriptinterface Aria2BitTorrent {
  announceList: string; // Tiered list of trackers
  comment?: string;         // Torrent comment
  creationDate?: string;    // UNIX timestamp
  mode: "single" | "multi";
  info?: {                  // Only present after metadata download
    name: string;           // The display name
  };
}
.13.4 Peer Information (getPeers)To display a "Peers" tab similar to desktop clients, aria2.getPeers provides real-time connectivity data.Method Signature: aria2.getPeers([secret], gid)Response Schema:TypeScriptinterface Peer {
  peerId: string;      // Percent-encoded Peer ID
  ip: string;          // IP Address
  port: string;        // Port number
  bitfield: string;    // Hex string of peer's available pieces
  amChoking: string;   // "true" if client is choking peer
  peerChoking: string; // "true" if peer is choking client
  seeder: string;      // "true" if peer is a seeder
  downloadSpeed: string;
  uploadSpeed: string;
}
.14. Advanced Features and Logic ImplementationThis section addresses the specific "Gap" requirements: File Selection, Bandwidth Control, Header Injection, and Multi-server orchestration.4.1 BitTorrent File SelectionAria2 supports selective downloading, but the implementation requires careful handling of indices.Logic Flow:Index Offset: Aria2 uses 1-based indexing for files. The first file is "1", not "0".Selection: Use the --select-file option via aria2.changeOption.Syntax: Indices are comma-separated (e.g., "1,4,5") or ranges (e.g., "1-5").Constraint: Changing select-file on an active download usually works, but bt-remove-unselected-file must be true if the user wants to reclaim disk space from deslected files immediately.JSON Payload (Select Files 1 and 3):JSON{
  "jsonrpc": "2.0",
  "id": "file-select-001",
  "method": "aria2.changeOption",
  "params": [
    "token:$$secret$$",
    "2089b05ecca3d829",
    { "select-file": "1,3" }
  ]
}
.14.2 Bandwidth Control: Global vs. Per-DownloadBandwidth throttling is managed via two distinct methods.Global Limits (changeGlobalOption):These affect the entire daemon. The user typically sets these in a settings panel.max-overall-download-limit: "0" (unlimited) or values like "2M", "500K".max-overall-upload-limit: Same format.max-concurrent-downloads: Defines how many items can be active simultaneously.Per-Download Limits (changeOption):These override global settings for a specific GID.max-download-limitmax-upload-limitTypeScript Implementation Snippet:TypeScript/**
 * Set a speed limit for a specific download.
 * @param gid The download ID
 * @param limit Speed string (e.g. "500K", "2M", "0")
 */
async function setTaskSpeedLimit(client: Aria2Client, gid: string, limit: string) {
  // Note: Setting limits might cause a momentary connection reset on the task
  const payload = {
    method: "aria2.changeOption",
    params: [
      `token:${client.secret}`,
      gid,
      { "max-download-limit": limit }
    ]
  };
  return client.post(payload);
}
.64.3 Streaming and Prioritization (bt-prioritize-piece)For the "CTRL" extension to support media streaming or sequential downloading, piece prioritization is required. Aria2 does not have a simple "sequential" boolean flag; instead, it uses bt-prioritize-piece.Logic: The client must calculate which "pieces" correspond to the file chunks the user wants (e.g., the beginning of a video file).Syntax: head, tail, or specific piece ranges index-index.Example: head=100M attempts to download the first 100MB of each selected file first.JSON Payload (Prioritize First 50MB):JSON{
  "jsonrpc": "2.0",
  "id": "prioritize-stream",
  "method": "aria2.changeOption",
  "params": [
    "token:$$secret$$",
    "2089b05ecca3d829",
    { "bt-prioritize-piece": "head=50M" }
  ]
}
.14.4 HTTP/FTP Header InjectionTo support downloads from sites requiring authentication (session cookies) or anti-hotlinking headers (Referer), the extension must inject headers.Option: headerFormat: An array of strings, where each string is a "Key: Value" pair.JSON Payload Example:JSON{
  "jsonrpc": "2.0",
  "method": "aria2.addUri",
  "params": [
    "token:$$secret$$",
    ["http://protected.example.com/video.mp4"],
    {
      "header":
    }
  ]
}
.54.5 Multi-Server OrchestrationThe prompt identifies a gap in "Multi-server orchestration". Since Aria2 is a daemon, "orchestration" is a client-side responsibility. The extension should implement a ServerManager class.Implementation Logic:Profile Storage: Store configurations (Host, Port, Secret, Name) for multiple Aria2 instances (e.g., "Localhost", "Seedbox VPS").Instance Switching: The UI should allow selecting an "Active" server context.Command Routing: The Aria2Adapter must accept a serverId or connectionProfile to route the JSON-RPC request to the correct endpoint (localhost:6800 vs 192.168.1.50:6800).Aggregation: The Dashboard "Global Stats" could optionally aggregate getGlobalStat sums from all connected servers to show a unified bandwidth total.5. Performance: Multicall OptimizationRendering a dashboard with 50+ active items using individual HTTP requests will saturate the browser's connection limit and cause UI lag. system.multicall is the required solution. It batches multiple RPC calls into a single HTTP/WebSocket frame.5.1 Multicall Payload StructureThe structure is highly specific and often implemented incorrectly. The params array of the system.multicall request contains one element: an array of method structs.Critical Note: The auth token must be inside each inner method call, not at the top level.Payload Example (Update Dashboard for 2 items):JSON{
  "jsonrpc": "2.0",
  "id": "batch-update-001",
  "method": "system.multicall",
  "params":]
      },
      {
        "methodName": "aria2.tellStatus",
        "params":]
      },
      {
        "methodName": "aria2.getGlobalStat",
        "params": ["token:$$secret$$"]
      }
    ]
}
.15.2 Parsing Multicall ResponsesThe response follows the order of the request array.JSON{
  "jsonrpc": "2.0",
  "id": "batch-update-001",
  "result":, // Result 1
   ,    // Result 2
    { "downloadSpeed": "1500", "numActive": "1" }                     // Result 3 (GlobalStat)
  ]
}
Parser Logic: Iterate through response.result. Note that some methods (like tellStatus) return their result wrapped in an array [...], while others might return a plain object. The parser must handle this inconsistency based on the method type.16. WebSocket Events and Real-Time NotificationsThe WebSocket connection handles the event loop. Upon connection to ws://host:port/jsonrpc, the server effectively treats the client as an event sink.6.1 Event Payload SchemaNotifications are standard JSON-RPC 2.0 requests from the server with no id.Payload Structure:JSON{
  "jsonrpc": "2.0",
  "method": "aria2.onDownloadStart",
  "params": [
    { "gid": "2089b05ecca3d829" }
  ]
}
6.2 Event Catalog and Handling LogicThe "CTRL" extension should listen for these specific events to trigger UI toasts or state refreshes:aria2.onDownloadStart: Task added or unpaused. Action: Add to "Active" list in UI.aria2.onDownloadPause: Task paused. Action: Move to "Waiting/Paused" list.aria2.onDownloadStop: Task removed by user. Action: Remove from UI.aria2.onDownloadComplete: HTTP/FTP download finished OR Torrent seeding finished. Action: Move to "History", send browser notification.aria2.onBtDownloadComplete: Crucial Event. Torrent payload download is finished, but seeding continues. Action: Notify user "Download Ready", but keep in "Active" list showing "Seeding" status.aria2.onDownloadError: Error occurred. Action: Show error icon, parse errorCode.WebSocket Implementation Pattern:TypeScriptconst ws = new WebSocket('ws://localhost:6800/jsonrpc');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.method) {
    // It's a notification
    switch (message.method) {
      case 'aria2.onBtDownloadComplete':
        handleTorrentFinish(message.params.gid);
        break;
      //... handle others
    }
  } else if (message.id) {
    // It's a response to a request we sent over WS
    resolvePendingRequest(message.id, message.result);
  }
};
.17. Global Operations7.1 Dashboard Statistics (getGlobalStat)This method provides the aggregate view of the system.Method: aria2.getGlobalStatReturn Fields: downloadSpeed, uploadSpeed, numActive, numWaiting, numStopped.Insight: numStopped refers to the number of stopped downloads kept in memory in the current session. It is capped by the --max-download-result option. This is not a historical count of all downloads ever performed.17.2 Session PersistenceAria2 keeps the download queue in memory. To ensure queue persistence across restarts (of the PC or the Aria2 daemon), the session must be saved.Method: aria2.saveSessionLogic: The extension should call this method periodically or on critical events (like adding a large batch of files) to force Aria2 to write the current control file (.aria2) to disk immediately.Payload: ["token:$$secret$$"]Response: "OK".18. Conclusion and Integration StrategyThe robust integration of Aria2 into the "CTRL" extension relies on a clean separation of concerns:State Management: Use aria2.tellStatus via system.multicall polling (e.g., 1000ms interval) to drive the main dashboard UI.Event Handling: Use WebSocket notifications (onDownloadComplete, onBtDownloadComplete) for instantaneous user alerts (Toasts) and to trigger dashboard refreshes.Data Integrity: Use aria2.getFiles and bittorrent.info parsing to resolve the discrepancy between "Display Names" and "File Paths".Performance: Strict adherence to system.multicall for all bulk operations is mandatory to prevent HTTP request saturation.By implementing the exact JSON schemas and logic flows detailed in this report, the "CTRL" extension will achieve feature parity with native desktop download managers while running efficiently within the browser environment.