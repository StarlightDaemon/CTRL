# ruTorrent / rTorrent XML-RPC Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific XML-RPC payloads for methods (Add, Start, Stop, Remove).
> - Map out all available metadata fields (for UI display).
> - Provide implementation logic for advanced features.

---

## Purpose

Export this prompt to another LLM for deep research on rTorrent XML-RPC API **feature implementation and data structures**.

---

## Context

You are researching the **rTorrent XML-RPC API** (accessed via ruTorrent) for integration into a browser extension called "CTRL" that manages BitTorrent clients. We already have a working `RuTorrentAdapter` implementation (313 lines, TypeScript) that supports:

- XML-RPC calls via `/RPC2` or `/rutorrent/plugins/httprpc/action.php`
- Basic Auth for HTTP authentication
- `d.multicall2` for listing torrents
- `load.raw_start` for adding torrents

**Current Gaps We Want to Explore:**
1. Labels/Categories - ruTorrent label plugin methods
2. Ratio groups - Managing seeding ratio rules
3. Scheduling - Download scheduling
4. RSS feeds - Autodl-irssi integration or ruTorrent RSS
5. Disk operations - Space checking, moving files
6. File priority - Per-file selection and priority

---

## Research Tasks (BUILDER FOCUS)

### 1. XML-RPC Method Reference
- Complete list of `d.*` (download) methods
- Complete list of `f.*` (file) methods
- Complete list of `t.*` (tracker) methods
- `system.*` and `throttle.*` namespaces

### 2. Multicall Optimization
- Efficient use of `d.multicall2` and `system.multicall`
- Required vs optional fields trade-offs
- Reducing round trips for common operations
- Batching multiple operations

### 3. ruTorrent Plugin System
- Label plugin: methods and data format
- Ratio groups plugin methods
- RSS downloader plugin
- Autodl-irssi integration
- diskspace plugin for storage monitoring

### 4. File & Tracker Operations
- `f.multicall` for file listing
- `f.priority.set` for file priority (0=skip, 1=normal, 2=high)
- `t.url` for tracker information
- `d.directory_base.set` for moving torrents

### 5. Bandwidth and Queue
- Throttle group management
- Per-torrent speed limits
- Queue position manipulation
- Ratio and seeding rules

### 6. Status Field Reference
- All download (`d.*`) status fields
- File (`f.*`) fields
- Tracker (`t.*`) fields
- Peer (`p.*`) fields

---

## Expected Output Format

Please provide:
1. **XML-RPC Method Reference Table** - Namespace.method, parameters, return type
2. **ruTorrent Plugin Endpoint Map** - Plugin name, HTTP path, capabilities
3. **Multicall Patterns** - Optimized batch requests
4. **Code Snippets** - Example XML-RPC calls
5. **File Operations** - Priority and selection methods
6. **Label Management** - Complete CRUD workflow

---

## Additional Resources (if accessible)
- rTorrent GitHub wiki (XML-RPC methods)
- ruTorrent GitHub (plugin documentation)
- pyrocore/rtorrent-ps documentation

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

rTorrent XML-RPC Architecture and ruTorrent Plugin Integration: A Technical Implementation Guide for the CTRL Browser Extension1. Architectural Overview and Protocol SpecificationsThe development of "CTRL," a browser-based management interface for BitTorrent clients, necessitates a rigorous understanding of the underlying communication protocols governing rTorrent and its popular frontend, ruTorrent. Unlike modern clients that often expose RESTful JSON APIs, rTorrent operates on a more primitive yet highly efficient XML-RPC implementation served over SCGI (Simple Common Gateway Interface). This section establishes the fundamental connectivity requirements, addressing the dichotomy between direct daemon communication and the utilization of ruTorrent’s PHP-based plugin bridge.1.1 The XML-RPC over SCGI InterfacerTorrent, written in C++, essentially functions as a headless daemon. Its primary control mechanism is an XML-RPC server that does not natively speak HTTP. Instead, it utilizes the SCGI protocol, a binary protocol designed to be simpler and faster than CGI.1 For a browser extension to communicate with rTorrent, an intermediary web server (typically Nginx, Apache, or Lighttpd) acts as a gateway, translating HTTP POST requests from the client into SCGI packets consumed by rTorrent.2The "CTRL" extension must construct standard XML-RPC payloads. These payloads are structurally verbose XML documents that encapsulate method calls and parameters. A critical distinction in the rTorrent API architecture is the concept of the "Target." In XML-RPC calls directed at specific downloads (d.*), files (f.*), or trackers (t.*), the first parameter—the Target—serves as the unique identifier.3Download Target: The Info Hash (SHA-1 checksum) of the torrent.File Target: A concatenation of the Info Hash, a colon, f, and the zero-based index of the file (e.g., HASH:f0).Tracker Target: A concatenation of the Info Hash, a colon, t, and the zero-based index of the tracker (e.g., HASH:t0).This architecture implies that the extension must maintain a localized state of the torrent list to correctly construct targets for subsequent operations. Without the Info Hash, specific operations on torrents are impossible via the direct API.31.2 The ruTorrent Plugin Bridge (httprpc)While the native rTorrent API handles core functionalities—adding torrents, stopping downloads, and retrieving file lists—it lacks the higher-level logic introduced by the ruTorrent web interface. Features such as "Labels," "Ratio Groups," and "RSS Feeds" are not native to the rTorrent C++ daemon but are implemented in the PHP layer of ruTorrent.2To bridge this gap, ruTorrent exposes a specialized endpoint: /plugins/httprpc/action.php. This endpoint acts as a high-level API gateway. It accepts simplified POST parameters (often standard form-data rather than XML) and internally orchestrates complex sequences of XML-RPC calls or modifies PHP-managed flat files (e.g., ratio.dat, feeds.dat).5For the "CTRL" extension to achieve feature parity with ruTorrent, it cannot rely solely on the raw /RPC2 endpoint. It must implement a hybrid adapter:Direct XML-RPC (/RPC2): Used for high-frequency polling of torrent status (d.multicall2), file lists, and basic transport control. This ensures minimal latency and overhead.Plugin Bridge (/plugins/httprpc/action.php): Used for metadata operations that exist only in the ruTorrent ecosystem, such as setting labels, adding RSS feeds, or managing ratio rules.71.3 Authentication and Session ManagementrTorrent itself does not handle authentication. Security is delegated to the web server (Nginx/Apache).9 The "CTRL" extension’s RuTorrentAdapter currently supports Basic Auth, which is the industry standard for seedbox deployments. However, the analysis indicates a prevalence of Digest Authentication in certain secure environments.10The HTTP POST requests sent by the extension must include the Authorization header. When interacting with the ruTorrent plugin system, maintaining a valid PHP session is often required, although the httprpc plugin is designed to be stateless for API interactions. It is crucial to handle 401 Unauthorized responses gracefully, prompting the user to re-authenticate, as the session between the browser and the web server is distinct from the persistent process of the rTorrent daemon.102. Download Management: The d.* NamespaceThe d.* namespace constitutes the core of the rTorrent API, providing methods to control and query individual torrents. The following reference table expands upon standard documentation by categorizing methods based on their utility for a UI-centric browser extension.2.1 Complete XML-RPC Method Reference (d.*)The following methods require the Info Hash as the first parameter (Target).Method NameReturn TypeDescription & Implementation LogicStatus & Stated.stateintReturns 1 for started/paused, 0 for stopped. Crucial for determining basic UI toggle states.3d.is_activeintReturns 1 if the torrent is actively downloading/seeding, 0 if paused. Combined with d.state, this allows accurate status display (e.g., if state=1 & active=0, status is "Paused").3d.is_openintReturns 1 if the torrent is loaded in memory. If 0, the torrent is closed (error state or stopped).3d.hashingintReturns 1 or 2 if the torrent is currently checking files. This overrides other status indicators in the UI.3d.completeintReturns 1 if the download is 100% complete, 0 otherwise.3d.messagestringReturns tracker error messages or status alerts. Display this in a tooltip or error column.3Metadatad.namestringThe display name of the torrent.3d.hashstringThe Info Hash. Useful verification when iterating via multicall.3d.size_bytesintTotal size of the torrent content in bytes.3d.bytes_doneintTotal bytes downloaded and verified. Use to calculate progress percentage (bytes_done / size_bytes).3d.left_bytesintBytes remaining. Alternative progress calculation method.3d.creation_dateintUnix timestamp of.torrent creation.3d.load_dateintUnix timestamp of when the torrent was added to rTorrent.3Transfer Datad.down.rateintCurrent download speed in bytes/second.3d.up.rateintCurrent upload speed in bytes/second.3d.down.totalintTotal bytes downloaded (session).d.up.totalintTotal bytes uploaded (session).d.ratiointDerived. Native d.ratio exists in some forks (rTorrent-PS), but standard rTorrent requires calculation: d.up.total / d.size_bytes.d.peers_connectedintTotal peers currently connected.d.peers_accountedintTotal peers currently transferring data.Configurationd.directorystringThe download directory path.d.directory_basestringThe base directory path. Essential for "Move" operations.3d.priorityintDownload priority: 0 (off), 1 (low), 2 (normal), 3 (high).3d.custom1stringLabel. Used by ruTorrent to store the label/category.3Actions (Void)d.startintResumes/Starts the torrent. Triggers hashing if needed.3d.stopintPauses/Stops the torrent.3d.closeintCloses the torrent (unloads from active memory).3d.eraseintRemoves the torrent from the client. Does not delete files by default.3d.check_hashintForces a re-check of the file data.32.2 Advanced State LogicImplementing a robust UI requires interpreting the combination of state flags. A single boolean is insufficient to describe a torrent's status. The following logic hierarchy is recommended for the "CTRL" extension:Checking: If d.hashing!= 0, Status = "Checking" (Progress = d.chunks_hashed / d.size_chunks).Error: If d.message is not empty (and indicates failure), Status = "Error".Paused: If d.is_active == 0 AND d.state == 1, Status = "Paused".Stopped: If d.state == 0, Status = "Stopped".Seeding: If d.complete == 1 AND d.state == 1, Status = "Seeding".Downloading: If d.complete == 0 AND d.state == 1, Status = "Downloading".This hierarchical evaluation ensures that transient states like "Hashing" take precedence over "Paused" or "Downloading," providing the user with accurate feedback.33. Multicall Optimization: Performance at ScaleEfficient use of d.multicall2 is the single most critical factor for the performance of the "CTRL" extension. Making individual HTTP requests for each torrent in a list of 1,000+ items will introduce massive latency and potentially crash the SCGI gateway.3.1 The d.multicall2 Patternd.multicall2 is a system method that iterates over a specific "view" of torrents, executes a list of commands for each, and returns a two-dimensional array of results.3.1.1 Payload StructureThe invocation requires:Target: Empty string "" (since the command applies to a view, not a specific torrent).View: typically "main" (all torrents), or "started", "stopped", "hashing".1Commands: A sequence of strings, each representing a d.* command appended with an equals sign = to indicate a value retrieval request.Optimized Batch Request Example:XML<methodCall>
  <methodName>d.multicall2</methodName>
  <params>
    <param><value><string></string></value></param> <param><value><string>main</string></value></param> <param><value><string>d.hash=</string></value></param>
    <param><value><string>d.name=</string></value></param>
    <param><value><string>d.size_bytes=</string></value></param>
    <param><value><string>d.bytes_done=</string></value></param>
    <param><value><string>d.down.rate=</string></value></param>
    <param><value><string>d.up.rate=</string></value></param>
    <param><value><string>d.complete=</string></value></param>
    <param><value><string>d.is_active=</string></value></param>
    <param><value><string>d.state=</string></value></param>
    <param><value><string>d.custom1=</string></value></param> <param><value><string>d.priority=</string></value></param>
  </params>
</methodCall>
3.1.2 Response Handling and Size LimitsThe response will be a list of lists. The order of elements in the inner lists corresponds exactly to the order of commands requested.Buffer Overflow Risk: For libraries with thousands of torrents, the XML response can exceed the default XML-RPC buffer size. The extension should issue a network.xmlrpc.size_limit.set command on startup, setting it to at least 4194304 (4MB) or higher (e.g., 16M) to prevent truncation or connection resets.3Delta Updates: To further optimize, "CTRL" should implement a delta update mechanism. It can maintain a local cache of torrent hashes. Periodic polling can be split:Fast Poll (2s): Call d.multicall2 on the active view (torrents currently uploading/downloading). Update only these rows.Slow Poll (10s): Call d.multicall2 on the main view to catch status changes (e.g., a torrent pausing or finishing).3.2 system.multicall: Batching Write OperationsWhile d.multicall2 is for reading, system.multicall is essential for writing. If a user selects 50 torrents and clicks "Start," sending 50 HTTP requests is inefficient. system.multicall packages these into a single request.Batch Start Example:XML<methodCall>
  <methodName>system.multicall</methodName>
  <params>
    <param>
      <value>
        <array>
          <data>
            <value>
              <struct>
                <member><name>methodName</name><value><string>d.start</string></value></member>
                <member><name>params</name><value><array><data><value><string>HASH_1</string></value></data></array></value></member>
              </struct>
            </value>
            <value>
              <struct>
                <member><name>methodName</name><value><string>d.start</string></value></member>
                <member><name>params</name><value><array><data><value><string>HASH_2</string></value></data></array></value></member>
              </struct>
            </value>
            </data>
        </array>
      </value>
    </param>
  </params>
</methodCall>
This method returns an array of results, allowing the UI to confirm the success of each individual operation within the batch.14. ruTorrent Plugin System: Bridging the Capability GapThe core research gap identified is the implementation of features that reside outside the rTorrent daemon. ruTorrent plugins typically store their configuration in PHP arrays or flat files within the rutorrent/share/ or rutorrent/plugins/<name>/ directories. Since "CTRL" cannot directly read the server's filesystem, it must interact with the plugin endpoints (action.php) or replicate the logic client-side.4.1 Label Management (Categories)Mechanism: ruTorrent uses the custom field d.custom1 to store labels. There is no separate database of categories; a category "exists" simply if at least one torrent possesses that label string.CRUD Workflow for CTRL:Read Labels: When parsing d.multicall2 results, extract d.custom1. Aggregate unique values to build the "Categories" sidebar list dynamically.Create/Update Label: To set a label, perform a direct XML-RPC call or use the plugin bridge. The direct XML-RPC call d.custom1.set is preferred for speed and robustness.Method: d.custom1.setParams: ``Note: ruTorrent URL-encodes labels in some versions. "CTRL" should ensure labels are properly encoded/decoded to maintain compatibility with the ruTorrent web UI.3Delete Label: Set d.custom1 to an empty string "".Batch Labeling: Use system.multicall to apply d.custom1.set to multiple torrents simultaneously.Legacy Compatibility: The httprpc plugin exposes a mode=setlabel parameter. However, source code analysis reveals that this PHP function simply wraps d.set_custom1. Therefore, direct XML-RPC is strictly superior as it removes the PHP overhead.64.2 Ratio GroupsMechanism: This is a purely synthetic feature implemented in PHP. The ratio plugin allows users to define rules (e.g., "Ratio > 2.0", "Time > 48h") which are saved in ratio.dat. A PHP backend process periodically checks torrents against these rules and issues stop/erase commands.Gap Analysis: rTorrent has no concept of "Ratio Groups." It only has d.up.total and d.size_bytes.Implementation Strategy:Option A (Client-Side Logic - Recommended): "CTRL" should implement its own ratio enforcement engine.Polling: In the background polling loop, calculate the ratio (d.up.total / d.size_bytes) for every active torrent.Rule Matching: Check against user-defined rules stored in the extension's local storage.Action: If a threshold is crossed, issue d.stop or d.erase via XML-RPC.Benefit: This makes "CTRL" independent of the server-side plugin configuration, which is inaccessible via standard API calls.Option B (Server-Side Integration): If strict sync with ruTorrent settings is required, "CTRL" must utilize the ratio plugin's action.php. However, this endpoint is primarily for setting the group of a torrent, not for retrieving the rule definitions. The definitions are static server-side files.Verdict: Option A provides a better user experience for a standalone extension, as reading remote PHP serialized objects (ratio.dat) via HTTP is brittle and insecure.114.3 RSS FeedsMechanism: ruTorrent's RSS plugin fetches feeds, parses them server-side, and uses regex filters to auto-load torrents.Gap Analysis: rTorrent has no native RSS capability.Implementation Strategy:Adding Feeds: To add a feed that ruTorrent tracks, "CTRL" must POST to /plugins/rss/action.php.Payload: mode=add&url={FEED_URL}&alias={NAME}.Response: Success/Failure status.Reading Feeds: There is no standard XML-RPC method to list RSS feeds. "CTRL" would likely need to parse the HTML output of the ruTorrent RSS tab or maintain its own separate RSS engine client-side.Recommendation: "CTRL" should implement a client-side RSS fetcher. It can fetch the RSS feed directly from the browser (bypassing the server), parse it, and allow the user to manually or automatically add torrents using the load.start XML-RPC command. This leverages the browser's connectivity and avoids dependency on the server's PHP configuration (e.g., curl restrictions).134.4 Autodl-irssi IntegrationMechanism: autodl-irssi is a Perl script that runs in the background, connects to IRC, and calls rTorrent XML-RPC to load torrents. The ruTorrent plugin is merely a configuration editor for the ~/.autodl/autodl.cfg file.Gap Analysis: There is no API to control autodl-irssi dynamically. Changes require editing a text file and reloading the Perl process.Implementation Strategy:Monitoring: "CTRL" can monitor the results of autodl-irssi by watching for torrents with specific labels (if autodl is configured to apply labels).Configuration: Direct configuration of filters via "CTRL" is effectively impossible without SSH access or a custom server-side API extension, as the standard autodl-irssi plugin does not expose a JSON API for modifying the config file—it serves a generated UI.14 "CTRL" should treat autodl-irssi as a "black box" source of torrents.4.5 Diskspace MonitoringMechanism: The diskspace plugin executes shell commands (df -h) via PHP to report free space.Implementation Strategy:Native: rTorrent has a command d.free_diskspace 3, but it requires a Target (info hash) and returns the space on the volume where that specific torrent resides.Plugin: To get a general system status, query /plugins/diskspace/action.php.Method: HTTP GET/POST.Response: Typically a JSON object containing total and free space bytes.Code Snippet:TypeScript// TypeScript for RuTorrentAdapter
async getDiskSpace(): Promise<{free: number, total: number}> {
    const response = await this.httpPost('/plugins/diskspace/action.php', { mode: 'get' });
    return response.json();
}
This provides the "storage bar" functionality common in UIs.165. File and Tracker Operations5.1 File Priority (f.*)Granular file prioritization is a high-value feature. It allows users to skip specific files in a multi-file torrent.Method Reference:f.multicall: Used to list files.f.priority.set: Used to change priority.Implementation Workflow:Fetch File List:XML<methodCall>
  <methodName>f.multicall</methodName>
  <params>
    <param><value><string>HASH</string></value></param> <param><value><string></string></value></param> <param><value><string>f.path=</string></value></param>
    <param><value><string>f.size_bytes=</string></value></param>
    <param><value><string>f.priority=</string></value></param>
    <param><value><string>f.completed_chunks=</string></value></param>
  </params>
</methodCall>
Returns: An array of arrays. The index of the array corresponds to the File Index.Set Priority:To set the 3rd file (Index 2) to "Do Not Download":XML<methodCall>
  <methodName>f.priority.set</methodName>
  <params>
    <param><value><string>HASH:f2</string></value></param> <param><value><int>0</int></value></param> </params>
</methodCall>
Update Torrent: Crucially, after changing priorities, d.update_priorities must be called on the torrent hash to inform the swarm of the new interest set. Failure to do this may result in the client continuing to request "skipped" pieces.15.2 Tracker OperationsMethod Reference:t.multicall: List trackers.d.tracker_announce: Force announce.Tracker List Payload:XML<methodCall>
  <methodName>t.multicall</methodName>
  <params>
    <param><value><string>HASH</string></value></param>
    <param><value><string></string></value></param>
    <param><value><string>t.url=</string></value></param>
    <param><value><string>t.type=</string></value></param>
    <param><value><string>t.is_open=</string></value></param>
    <param><value><string>t.activity_time_next=</string></value></param>
  </params>
</methodCall>
Force Announce: Call d.tracker_announce with the torrent hash.5.3 Disk Operations: Moving TorrentsMoving a download involves changing its base directory and physically moving the data.The Danger Zone:rTorrent's d.directory.set changes the internal path variable but does not move files. If called on an active torrent without moving files, the torrent will error out ("File not found").Safe Implementation Logic:Stop: Call d.stop (or d.close).Move & Set: The recommended approach is to use the datadir plugin if available, as it handles the atomic move.Endpoint: /plugins/datadir/action.phpPayload: hash=HASH&datadir=/new/path&move_datafiles=1Native Fallback: If the plugin is absent, "CTRL" cannot safely move files because it lacks shell access to execute mv. It can only change the download location for future files using d.directory.set.17 It is strongly recommended to disable "Move Data" functionality in "CTRL" if the datadir plugin is undetected, to prevent data loss.6. Bandwidth and Queue Management6.1 Throttle GroupsrTorrent manages bandwidth via "Throttle" channels. There is no simple "per-torrent limit" variable.Global Limits:throttle.global_down.max_rate.set_kb (Argument: integer in KB/s)throttle.global_up.max_rate.set_kb (Argument: integer in KB/s).19Per-Torrent Throttling:To limit a specific torrent, it must be assigned to a throttle group. ruTorrent simulates per-torrent limits by dynamically creating throttle groups (e.g., thr_HASH) on the fly.CTRL Implementation:Create a throttle group: throttle.up name "slow_upload", limit "100k".Assign torrent: d.throttle_name.set Target=HASH, Value="slow_upload".9This is complex to manage statefully. A simpler MVP approach is to support assigning torrents to NULL (unlimited) or predefined groups if they exist.6.2 Queue PositionrTorrent does not have a linear "Queue" [1, 2, 3...] that can be reordered by swapping indices. Queueing is managed by the scheduler based on active slots.Prioritization Logic:To "Move to Top," "CTRL" should manipulate the Priority:Method: d.priority.setValues: 0 (Off), 1 (Low), 2 (Normal), 3 (High).Logic: Setting a torrent to 3 tells the internal scheduler to allocate bandwidth/slots to it preferentially. There is no "Move Up One Slot" command; priority is the only lever available.37. Status Field Mapping for UITo assist in UI development, the following table maps standard BitTorrent UI columns to their specific rTorrent XML-RPC requirements.UI ColumnXML-RPC Method (d.*)Transformation LogicStatus Icond.state, d.is_active, d.hashing, d.completeHashing: If hashing!= 0.  Seeding: If complete==1 AND state==1.  Downloading: If complete==0 AND state==1.  Paused: If state==1 AND is_active==0.  Stopped: If state==0.Progress Bard.bytes_done, d.size_bytes(bytes_done / size_bytes) * 100. Handle size_bytes=0 div-by-zero edge case.ETAd.left_bytes, d.down.rateleft_bytes / down.rate. If down.rate < 1024, display "∞".Ratiod.up.total, d.size_bytesup.total / size_bytes.Peersd.peers_connected, d.peers_accountedDisplay accounted (active) / connected (total).Seedsd.peers_complete, d.peers_connectedNote: peers_complete is the count of seeds connected.Labeld.custom1Decode URI component if necessary.Added Ond.load_dateConvert Unix timestamp to Locale String.8. Conclusion and Strategic RecommendationsThe integration of rTorrent into the "CTRL" browser extension requires a sophisticated hybrid approach. The analysis confirms that a purely XML-RPC approach is insufficient for a modern user experience due to the heavy reliance of the rTorrent ecosystem on ruTorrent plugins for metadata management.Key Recommendations for the Builder:Prioritize d.multicall2: This is the non-negotiable standard for fetching list data. Ensure the size_limit is increased on session start to prevent data truncation.Hybrid Label Management: Read labels via XML-RPC (d.custom1) for speed, but be prepared to handle encoding quirks. Writing labels via XML-RPC is safe and compatible with ruTorrent.Client-Side Logic: Do not rely on server-side plugins for Ratio Groups or generic RSS parsing. Implementing these client-side in the extension's background scripts yields a more robust, portable application that works even on minimal rTorrent installations (e.g., standard Docker containers) that may lack specific plugins.Security Awareness: The extension must handle both Basic and Digest authentication. When interfacing with httprpc, ensure the HTTP client (fetch/axios) correctly maintains session cookies if the web server configuration requires it.Safe Failures: When implementing Disk Operations, aggressive checks for the datadir plugin are necessary. If the plugin is missing, disable the "Move" feature to prevent users from corrupting their download state.This architectural roadmap provides the necessary primitives and logic flows to build a high-performance, feature-rich rTorrent client that respects the idiosyncrasies of the underlying C++ daemon while delivering the usability of a modern web application.
Force Announce: Call d.tracker_announce with the torrent hash.5.3 Disk Operations: Moving TorrentsMoving a download involves changing its base directory and physically moving the data.The Danger Zone:rTorrent's d.directory.set changes the internal path variable but does not move files. If called on an active torrent without moving files, the torrent will error out ("File not found").Safe Implementation Logic:Stop: Call d.stop (or d.close).Move & Set: The recommended approach is to use the datadir plugin if available, as it handles the atomic move.Endpoint: /plugins/datadir/action.phpPayload: hash=HASH&datadir=/new/path&move_datafiles=1Native Fallback: If the plugin is absent, "CTRL" cannot safely move files because it lacks shell access to execute mv. It can only change the download location for future files using d.directory.set.17 It is strongly recommended to disable "Move Data" functionality in "CTRL" if the datadir plugin is undetected, to prevent data loss.6. Bandwidth and Queue Management6.1 Throttle GroupsrTorrent manages bandwidth via "Throttle" channels. There is no simple "per-torrent limit" variable.Global Limits:throttle.global_down.max_rate.set_kb (Argument: integer in KB/s)throttle.global_up.max_rate.set_kb (Argument: integer in KB/s).19Per-Torrent Throttling:To limit a specific torrent, it must be assigned to a throttle group. ruTorrent simulates per-torrent limits by dynamically creating throttle groups (e.g., thr_HASH) on the fly.CTRL Implementation:Create a throttle group: throttle.up name "slow_upload", limit "100k".Assign torrent: d.throttle_name.set Target=HASH, Value="slow_upload".9This is complex to manage statefully. A simpler MVP approach is to support assigning torrents to NULL (unlimited) or predefined groups if they exist.6.2 Queue PositionrTorrent does not have a linear "Queue" [1, 2, 3...] that can be reordered by swapping indices. Queueing is managed by the scheduler based on active slots.Prioritization Logic:To "Move to Top," "CTRL" should manipulate the Priority:Method: d.priority.setValues: 0 (Off), 1 (Low), 2 (Normal), 3 (High).Logic: Setting a torrent to 3 tells the internal scheduler to allocate bandwidth/slots to it preferentially. There is no "Move Up One Slot" command; priority is the only lever available.37. Status Field Mapping for UITo assist in UI development, the following table maps standard BitTorrent UI columns to their specific rTorrent XML-RPC requirements.UI ColumnXML-RPC Method (d.*)Transformation LogicStatus Icond.state, d.is_active, d.hashing, d.completeHashing: If hashing!= 0.  Seeding: If complete==1 AND state==1.  Downloading: If complete==0 AND state==1.  Paused: If state==1 AND is_active==0.  Stopped: If state==0.Progress Bard.bytes_done, d.size_bytes(bytes_done / size_bytes) * 100. Handle size_bytes=0 div-by-zero edge case.ETAd.left_bytes, d.down.rateleft_bytes / down.rate. If down.rate < 1024, display "∞".Ratiod.up.total, d.size_bytesup.total / size_bytes.Peersd.peers_connected, d.peers_accountedDisplay accounted (active) / connected (total).Seedsd.peers_complete, d.peers_connectedNote: peers_complete is the count of seeds connected.Labeld.custom1Decode URI component if necessary.Added Ond.load_dateConvert Unix timestamp to Locale String.8. Conclusion and Strategic RecommendationsThe integration of rTorrent into the "CTRL" browser extension requires a sophisticated hybrid approach. The analysis confirms that a purely XML-RPC approach is insufficient for a modern user experience due to the heavy reliance of the rTorrent ecosystem on ruTorrent plugins for metadata management.Key Recommendations for the Builder:Prioritize d.multicall2: This is the non-negotiable standard for fetching list data. Ensure the size_limit is increased on session start to prevent data truncation.Hybrid Label Management: Read labels via XML-RPC (d.custom1) for speed, but be prepared to handle encoding quirks. Writing labels via XML-RPC is safe and compatible with ruTorrent.Client-Side Logic: Do not rely on server-side plugins for Ratio Groups or generic RSS parsing. Implementing these client-side in the extension's background scripts yields a more robust, portable application that works even on minimal rTorrent installations (e.g., standard Docker containers) that may lack specific plugins.Security Awareness: The extension must handle both Basic and Digest authentication. When interfacing with httprpc, ensure the HTTP client (fetch/axios) correctly maintains session cookies if the web server configuration requires it.Safe Failures: When implementing Disk Operations, aggressive checks for the datadir plugin are necessary. If the plugin is missing, disable the "Move" feature to prevent users from corrupting their download state.This architectural roadmap provides the necessary primitives and logic flows to build a high-performance, feature-rich rTorrent client that respects the idiosyncrasies of the underlying C++ daemon while delivering the usability of a modern web application.