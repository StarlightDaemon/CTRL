# Deluge JSON-RPC Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific JSON payloads for methods (Add, Start, Stop, Remove).
> - Map out all available metadata fields (for UI display).
> - Provide implementation logic for advanced features.

---

## Purpose

Export this prompt to another LLM for deep research on Deluge Web API **feature implementation and data structures**.

---

## Context

You are researching the **Deluge Web API (JSON-RPC)** for integration into a browser extension called "CTRL" that manages BitTorrent clients.

**Current Implementation (455 Lines) Already Supports:**
- Multi-step handshake and session management
- Core torrent operations via `web.update_ui` and `core.*` methods
- Label plugin integration for categories
- Plugin detection via `core.get_enabled_plugins` and `system.listMethods`
- Advanced torrent options (`setTorrentOptions`)
- File operations (`moveStorage`, `renameFiles`, `renameFolder`)

**Current Code Snippets:**
```typescript
// Plugin detection
async discoverMethods(): Promise<string[]> {
    const response = await this.call<{ result: string[] }>('system.listMethods', []);
    return DelugeMethodsSchema.parse(response).result;
}

async isPluginEnabled(pluginName: string): Promise<boolean> {
    const plugins = await this.getEnabledPlugins();
    return plugins.includes(pluginName);
}

// Advanced torrent management
async moveStorage(torrentIds: string[], destPath: string): Promise<void> {
    await this.call('core.move_storage', [torrentIds, destPath]);
}

async setTorrentOptions(torrentIds: string[], options: DelugeTorrentOptions): Promise<void> {
    await this.call('core.set_torrent_options', [torrentIds, options]);
}
```

**Current Gaps We Want to Explore:**
1. AutoAdd plugin - Watch folder configuration via API
2. Scheduler plugin - Time-based bandwidth scheduling
3. Execute plugin - Script execution on torrent events
4. Event polling - Real-time updates (WebSocket?)
5. Complete torrent field list - All available metadata
6. Peer and tracker information - Detailed inspection
7. File priority - Per-file download priorities

---

## Research Tasks (BUILDER FOCUS)

### 1. Core Torrent Methods
- `core.add_torrent_file` - all parameters and options
- `core.add_torrent_url` / `core.add_torrent_magnet`
- `core.get_torrents_status` - filter syntax and all fields
- `core.pause_torrent` / `core.resume_torrent`
- `core.remove_torrent` - delete data option
- `core.force_recheck` method availability

### 2. Torrent Status Fields
Complete list of all fields available in `core.get_torrents_status`:
- Basic: name, hash, state, progress, size
- Speed: download_payload_rate, upload_payload_rate
- Connections: num_peers, num_seeds, total_peers, total_seeds
- Time: eta, time_added, active_time, seeding_time
- Files: files, file_priorities, file_progress
- Tracker: trackers, tracker_status
- Any Deluge 2.x specific fields

### 3. Plugin System
**Label Plugin:**
- `label.get_labels` - response format
- `label.add` / `label.remove`
- `label.set_torrent` - assigning labels
- `label.get_options` / `label.set_options`

**AutoAdd Plugin:**
- How to configure watch folders via API?
- `autoadd.get_config` / `autoadd.set_config` (if available)

**Scheduler Plugin:**
- `scheduler.get_config` / `scheduler.set_config`
- Schedule format and options

**Execute Plugin:**
- `execute.get_commands` / `execute.save_command`
- Event types and script configuration

### 4. Advanced Torrent Management
- `core.set_torrent_options` - all available options:
  * `max_download_speed`, `max_upload_speed`
  * `max_connections`, `max_upload_slots`
  * `prioritize_first_last_pieces`
  * `sequential_download`
  * `move_completed`, `move_completed_path`
  * `auto_managed`, `stop_at_ratio`, `stop_ratio`
- File priority setting (0=skip, 1=normal, 5=high, 7=highest?)
- Queue position manipulation

### 5. Event System
- Does Deluge WebUI support event streaming?
- `web.register_event_listener` - how does it work?
- Polling optimization strategies
- Event types available

### 6. Peer and Tracker Details
- `core.get_torrent_status` with peers field
- Peer object structure
- Tracker object structure
- Adding/removing trackers

---

## Expected Output Format

Please provide:
1. **Method Reference Table** - `namespace.method`, parameters, response
2. **Torrent Status Field Map** - All fields with types
3. **Plugin Capability Matrix** - Plugin → methods available
4. **DelugeTorrentOptions Reference** - All settable options
5. **Code Snippets** - Example JSON-RPC calls
6. **Event System Details** - Real-time update options
7. **File Priority Guide** - Priority values and behavior

---

## Additional Resources (if accessible)
- Deluge WebAPI documentation
- Deluge plugin development docs
- Community implementations (Sonarr, Radarr)
- Deluge source code (GitHub)

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Deluge Web API Architecture and Implementation Guide for External Client Integration1. Executive SummaryThis technical research report presents an exhaustive architectural analysis of the Deluge Web API (JSON-RPC), specifically designed to guide the development of "CTRL," a browser extension-based BitTorrent management tool. The objective is to bridge the gap between the raw RPC documentation and the practical requirements of a production-grade external client. This analysis focuses strictly on feature implementation, data structure mapping, and the intricate logic required to manage the Deluge daemon via its web interface.Deluge operates on a client-server model where the Web interface (deluge-web) functions as a proxy client to the core daemon (deluged). For an external application like CTRL, all interactions occur via the Web API, which encapsulates the core RPC calls within a specific JSON-RPC v1.0 envelope. This report details the necessary JSON payloads, state management logic, and legacy handling required to implement core functionality, advanced torrent management, and complex plugin integrations including Label, AutoAdd, Scheduler, and Execute.The research highlights a critical architectural reality: while the core API provides robust control over the Libtorrent backend, the plugin system operates on disparate configuration schemas that require precise manipulation of nested dictionaries. Furthermore, the transition from Deluge 1.x to 2.x has introduced deprecated keys and subtle behavioral changes in metadata retrieval that the CTRL extension must handle to ensure broad compatibility.2. API Architecture and Session State Management2.1 The JSON-RPC Protocol LayerDeluge employs a JSON-RPC v1.0 compliant interface served over HTTP/HTTPS. Unlike RESTful APIs which utilize resource-based endpoints (e.g., GET /torrents/1), Deluge utilizes a single endpoint—typically /json—for all operations.1 This architectural choice necessitates that the client, in this case, the CTRL extension, maintains internal state regarding the validity of the session and the connection status to the daemon.The request structure adheres to a strict envelope format. Every request sent by the extension must follow this schema:JSON{
  "id": <integer_request_id>,
  "method": "<namespace>.<method_name>",
  "params": [<arg1>, <arg2>,...]
}
The response provided by the Web API mirrors this structure, wrapping the return value or error object:JSON{
  "id": <integer_request_id>,
  "result": <return_value_or_null>,
  "error": <error_object_or_null>
}
Crucially, the error field in the response serves as the primary mechanism for exception handling. The CTRL extension must parse this field for specific error codes, particularly those indicating session timeouts or daemon disconnections.22.2 Authentication and Daemon Handshake SequenceA prevalent implementation error in external Deluge clients is the conflation of web authentication with daemon connection. The architectural separation between the WebUI (the interface) and the Core (the daemon) dictates a multi-step handshake process. Authentication with the WebUI does not automatically establish a link to the torrent management core.The analysis identifies the following mandatory handshake sequence for the CTRL extension 3:Authentication (auth.login): The client POSTs the password to the WebUI. Successful execution sets a session cookie. This authorizes the client to talk to the WebUI, but not yet to the torrent core.Payload: {"method": "auth.login", "params": ["<password>"], "id": 1}Connection Verification (web.connected): The client must query whether the WebUI currently has an active bridge to a deluged daemon.Payload: {"method": "web.connected", "params":, "id": 2}Logic: If result is true, the client may proceed to core operations. If false, the client must initiate the connection sequence.Host Retrieval (web.get_hosts): If unconnected, the client requests the list of configured daemons.Payload: {"method": "web.get_hosts", "params":, "id": 3}Response Structure: A list of tuples/lists containing [host_id, hostname, port, status].Daemon Connection (web.connect): The client selects a host_id (typically the first online host or a user-selected preference) and instructs the WebUI to bridge the connection.Payload: {"method": "web.connect", "params": ["<host_id>"], "id": 4}Implementation Requirement: The CTRL extension must cache the host_id. API calls to core.* methods will fail with "Unknown Method" or similar RPC errors if the WebUI is not connected to a daemon, even if the user is authenticated.22.3 Namespace SegmentationThe API is segmented into namespaces that reflect the internal component architecture of Deluge. Understanding this segmentation is vital for correct method discovery and error handling:web.*: These methods execute within the WebUI process. They manage the host list, session cookies, extension settings, and the event proxy system. They do not interact directly with libtorrent.3core.*: These are proxy methods. The WebUI receives these requests, deserializes the parameters, and forwards them to the deluged process via the Twisted asynchronous framework. The response is then relayed back to the HTTP client.6daemon.*: These methods control the daemon process lifecycle, allowing for administrative actions such as retrieving the method list (daemon.get_method_list) or shutting down the service (daemon.shutdown).53. Core Torrent Operations: Implementation DetailsThe core lifecycle of a torrent—addition, state modification, and removal—relies on specific core.* methods. This section details the precise payloads required by the CTRL extension.3.1 Adding TorrentsDeluge provides distinct methods for adding torrents via binary files versus Magnet URIs/URLs. The handling of options at the time of addition is critical for enabling features like "Add Paused" or "Download to specific folder."3.1.1 File-Based Addition (core.add_torrent_file)To add a .torrent file, the client must first read the file as a binary stream and encode it using Base64. This string is passed as the filedump argument.Method: core.add_torrent_fileParameters: [filename, filedump, options]JSON Payload:JSON{
  "method": "core.add_torrent_file",
  "params":,
  "id": 101
}
Implementation Note: The options dictionary is optional but highly recommended. It allows the client to override global defaults (such as download location or ratio limits) at the moment of instantiation. If omitted, the daemon's configured defaults are applied.73.1.2 Magnet and URL Addition (core.add_torrent_magnet)Magnet links operate differently as they require a metadata resolution phase. The payload for magnets is lighter, transmitting only the URI.Method: core.add_torrent_magnetParameters: [uri, options]JSON Payload:JSON{
  "method": "core.add_torrent_magnet",
  "params": [
    "magnet:?xt=urn:btih:5b326031e6d0218c1442721...", 
    {
        "download_location": "/mnt/storage/movies",
        "prioritize_first_last_pieces": true
    }
  ],
  "id": 102
}
There is also core.add_torrent_url, which instructs the daemon to download the .torrent file from a remote HTTP server before adding it. This follows the same [url, options] signature.23.2 State Control (Pause, Resume, Recheck)Deluge supports batch operations, which are essential for performance when managing large lists of torrents.3.2.1 Batch Pause and ResumeThe methods core.pause_torrent and core.resume_torrent are polymorphic; they can accept a single Torrent ID (string) or a list of Torrent IDs. For the CTRL extension, utilizing the list format is best practice to reduce HTTP overhead.JSON Payload (Resume Multiple):JSON{
  "method": "core.resume_torrent",
  "params": ["<hash_1>", "<hash_2>", "<hash_3>"],
  "id": 103
}
Convenience methods core.pause_all_torrents and core.resume_all_torrents exist and take no parameters.63.2.2 Force RecheckRechecking a torrent is an asynchronous operation. Calling core.force_recheck initiates the hash verification process but returns immediately. To reflect the "Checking" state in the UI, the client must rely on subsequent polling of the state field (which will report "Checking") or listen for the TorrentStateChangedEvent.Method: core.force_recheckParameters: [torrent_ids] (List of strings).93.3 Removal OperationsThe removal API has evolved. While core.remove_torrent (singular) exists, Deluge 2.x emphasizes core.remove_torrents (plural) for batch efficiency. This method ensures that the session state file is written only once after all specified torrents are removed, rather than rewriting it for every individual removal.Method: core.remove_torrentsParameters: [torrent_ids, remove_data]torrent_ids: List of strings (hashes).remove_data: Boolean. true deletes downloaded data/files; false removes only the .torrent from the session.JSON Payload:JSON{
  "method": "core.remove_torrents",
  "params": ["<hash_1>", "<hash_2>"],
    true
  ],
  "id": 104
}
.94. Torrent Status and Metadata MappingThe retrieval of torrent data is the most bandwidth-intensive operation for any external client. Deluge provides core.get_torrents_status, a highly flexible method that allows the client to filter which torrents are retrieved and exactly which metadata fields are included in the response.4.1 Field Map and Data TypesThe following table provides a comprehensive mapping of the available metadata fields, their data types, and their semantic meaning within the Deluge ecosystem. This map is essential for constructing the UI models in the CTRL extension.CategoryKeyData TypeDescriptionIdentitynamestringThe display name of the torrent.hashstringThe SHA-1 info hash (unique identifier).commentstringComment embedded in the torrent metadata.StatestatestringCurrent state: "Downloading", "Seeding", "Paused", "Checking", "Queued", "Error".is_finishedboolTrue if the download phase is complete (includes Seeding state).pausedboolTrue if the torrent is paused (manually or auto-managed).progressfloatCompletion percentage (0.0 to 100.0).Size & Datatotal_sizeintTotal size of the payload in bytes.total_doneintTotal bytes downloaded and verified.total_uploadedintTotal bytes uploaded during this session.num_filesintThe number of files contained in the torrent.all_time_downloadintTotal bytes downloaded (lifetime).Bandwidthdownload_payload_rateintCurrent download speed (bytes/second).upload_payload_rateintCurrent upload speed (bytes/second).etaintEstimated time to completion in seconds.ratiofloatShare ratio (Uploaded / Downloaded).Connectivitynum_peersintDeprecated in 2.x. Use peer.num_peers_connected.num_seedsintDeprecated in 2.x. Use peer.num_seeds_connected.total_peersintTotal peers discovered in the swarm.total_seedsintTotal seeds discovered in the swarm.peer.num_peers_connectedintActive peer connections (Deluge 2.x).peer.num_seeds_connectedintActive seed connections (Deluge 2.x).Timetime_addedfloatUnix timestamp of when the torrent was added.active_timeintTotal seconds the torrent has been active.seeding_timeintTotal seconds spent in the seeding state.Pathingsave_pathstringThe current directory where data is saved.download_locationstringThe configured download target directory.QueuequeueintThe torrent's numerical position in the queue.PluginlabelstringThe label assigned (requires Label plugin).Implementation Insight: In Deluge 2.x, utilizing num_peers or num_seeds triggers deprecation warnings in the daemon logs. The CTRL extension should implement logic to check for the presence of peer.num_peers_connected in the response; if missing (indicating a Deluge 1.x daemon), it should fallback to num_peers.114.2 File Structure and PrioritiesTo display and manage the files within a torrent, the client must request the files key via get_torrent_status. The response is a list of dictionaries, where the index in the list corresponds to the file index used for priority operations.Structure of files Object:JSON
.12File Priority Guide:Deluge maps file priorities to specific integer values derived from libtorrent. To change priorities, the client uses core.set_torrent_options with the file_priorities key. The value must be a list of integers matching the length of the files list.Priority ValueBehavior0Skip/Do Not Download. The file is ignored.1Normal Priority. Standard scheduling.5High Priority. Prefers pieces for this file.7Highest Priority. Aggressively requests pieces for this file.Example Logic: If a torrent has 3 files and the user wants to skip the second file, the payload options would include "file_priorities": .4.3 Peer and Tracker IntrospectionDetailed inspection of peers and trackers involves requesting specific keys that return lists of complex objects.Peer Object Structure:Requested via the peers key.JSON
.13Tracker Object Structure:Requested via the trackers key.JSON[
  {
    "url": "http://tracker.example.com/announce",
    "tier": 0,
    "send_stats": true,
    "fails": 0,
    "source": 1,
    "verified": true,
    "updating": false,
    "last_error": {"code": 0, "message": ""}
  }
]
Adding/Removing Trackers:Unlike other properties, trackers are not managed via granular add/remove methods. Instead, the core.set_torrent_trackers(torrent_id, trackers) method is used. This method replaces the existing tracker list with the new one provided. To add a tracker, the CTRL extension must first fetch the current list, append the new tracker dictionary, and then send the updated list back to the core.95. Advanced Torrent ManagementThe CTRL extension aims to provide granular control over torrent behavior. This is achieved primarily through the core.set_torrent_options method, which accepts a dictionary of configuration keys.5.1 DelugeTorrentOptions ReferenceThe following table details the settable options available for set_torrent_options. These keys map directly to the TorrentOptions class in the core.Option KeyTypeDescriptionmax_download_speedfloatBandwidth limit in KiB/s (-1.0 for unlimited).max_upload_speedfloatBandwidth limit in KiB/s (-1.0 for unlimited).max_connectionsintMaximum global connections allowed for this torrent.max_upload_slotsintMaximum upload slots (peers served simultaneously).stop_at_ratioboolEnable/Disable stopping upon reaching a ratio.stop_ratiofloatThe target ratio value (e.g., 2.0).remove_at_ratioboolIf true, remove torrent when stop_ratio is met.move_completedboolEnable/Disable moving files upon completion.move_completed_pathstringAbsolute path for moving completed files.prioritize_first_last_piecesboolRequest header/footer pieces first (for previewing).sequential_downloadboolDownload pieces in order (for streaming).auto_managedboolAllow Deluge to manage the queue state.super_seedingboolEnable super seeding (Initial Seeding) mode.download_locationstringThe directory path for data storage.Code Snippet (Setting Options):JSON{
  "method": "core.set_torrent_options",
  "params": ["<torrent_id>"],
    {
      "max_upload_speed": 50.0,
      "stop_at_ratio": true,
      "stop_ratio": 2.0,
      "auto_managed": false
    }
  ],
  "id": 200
}
.75.2 Queue ManipulationTo modify the queue position, specific core methods are used rather than setting a property.core.queue_top(torrent_ids): Move to position 1.core.queue_up(torrent_ids): Move up one slot.core.queue_down(torrent_ids): Move down one slot.core.queue_bottom(torrent_ids): Move to the end of the queue.These methods accept a list of Torrent IDs, allowing for batch reordering.176. Plugin System ImplementationOne of the most complex aspects of the Deluge API is the plugin system. Plugins do not always follow the standard core.* conventions and often utilize their own namespaces or configuration dictionaries. This section provides the specific implementation logic for the four requested plugins.6.1 Label PluginThe Label plugin adds a categorization layer on top of the standard torrent list.Namespace: labelRetrieving Labels: label.get_labels() returns a list of strings (e.g., ``).Assigning Labels: label.set_torrent(torrent_id, label_id) assigns a specific label to a torrent.Metadata Integration: When the Label plugin is enabled, core.get_torrents_status will accept "label" as a key in its requested fields list. The response will contain the label field for each torrent. This is the most efficient way to fetch label associations for the UI.186.2 AutoAdd Plugin (Watch Folders)The AutoAdd plugin is sophisticated, managing a dictionary of "Watch Directories," where each entry contains a full set of torrent application options.Namespace: autoaddConfiguration Retrieval: There is no simple "get_watch_folders" method exposed in all versions. The configuration is stored in the plugin's config file. Access is typically managed via autoadd.get_config() (if exported) or by manipulating the configuration via core config methods if the plugin exposes them. However, standard implementation usually involves autoadd.set_config.Data Structure: The configuration uses a dictionary named watchdirs, keyed by a unique string ID (usually an incrementing integer).Watch Directory Entry Schema:JSON"watchdirs": {
  "1": {
    "path": "/home/user/watch/movies",
    "abspath": "/home/user/watch/movies",
    "enabled": true,
    "label": "Movies",
    "download_location": "/home/user/downloads/movies",
    "max_download_speed": -1.0,
    "move_completed": true,
    "move_completed_path": "/home/user/media/movies",
    "append_extension": ".added"
  }
}
Toggle Keys Logic: The AutoAdd plugin uses a "toggle" system for optional overrides. For many settings (like max_download_speed), the plugin looks for a corresponding _toggle key (e.g., max_download_speed_toggle). If the toggle is true, the value is applied. If false or missing, the global default is used. The CTRL extension must check for these toggles when rendering the configuration UI.166.3 Scheduler PluginThe Scheduler plugin controls bandwidth throttling based on a weekly timetable.Namespace: schedulerConfiguration Method: scheduler.set_config(config_dict)Key Configuration Fields:low_down: Download limit (KiB/s) during "Yellow" (Throttled) periods.low_up: Upload limit (KiB/s) during "Yellow" (Throttled) periods.button_state: A matrix representing the schedule.The button_state Matrix:This structure defines the schedule for the entire week. It is a list of 7 lists (representing Monday through Sunday). Each inner list contains 24 integers (representing hours 00:00 to 23:00).State Values:0: Green (Normal/Unlimited).1: Yellow (Throttled/Low Bandwidth).2: Red (Paused/Stopped).Example Matrix Row (Monday):[0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0,...]Interpretation: Unlimited from midnight to 7am; Throttled from 7am to 12pm; Unlimited thereafter. To modify the schedule, the CTRL extension must construct this 7x24 matrix and pass it within the set_config payload.216.4 Execute PluginThe Execute plugin allows the daemon to run shell scripts based on torrent events.Namespace: executeMethod: execute.add_command(event, command) is the primary RPC method for adding a new script.Supported Events: "added", "complete".Payload:JSON{
  "method": "execute.add_command",
  "params": ["complete", "/home/scripts/notify.sh"],
  "id": 300
}
Execution Argument Logic:When the event fires, Deluge executes the script and passes three arguments in a specific order:torrent_id (The Info Hash)torrent_name (The Display Name)save_path (The location of the data)The CTRL extension can allow users to input the script path, but it cannot change the arguments passed to that script; the script itself must be written to handle these three positional arguments.247. Event System and Polling StrategiesUnlike modern web applications that utilize WebSockets for bidirectional communication, the Deluge WebUI relies on a polling mechanism against an internal event queue. The API does not support event streaming over a persistent socket.7.1 Registering Event ListenersTo minimize bandwidth usage, the client should not poll get_torrents_status indefinitely. Instead, it should register for relevant events and update its local state only when changes occur.Method: web.register_event_listenerParameter: event_name (string)Critical Events for CTRL:TorrentStateChangedEvent: Fired when a torrent moves from "Downloading" to "Seeding", etc.TorrentAddedEvent: Fired when a new torrent is successfully added.TorrentRemovedEvent: Fired when a torrent is deleted.TorrentFinishedEvent: Fired when download completes.ConfigValueChangedEvent: Fired when core settings change..277.2 The Polling LoopOnce listeners are registered, the client must implement a polling loop using web.get_events.Initial Call: web.register_event_listener("TorrentStateChangedEvent") (and others).Loop:Call web.get_events().Response: A list of event objects fired since the last call.Action: If the list is empty, wait (e.g., 2 seconds) and poll again. If the list contains events, parse them.Update: If a TorrentStateChangedEvent is received for a specific ID, the client can then issue a specific core.get_torrent_status for only that ID, rather than refreshing the entire list.This "long-polling" style simulation is the standard architectural pattern for Deluge web clients.288. Implementation Recommendations for "CTRL" ExtensionBased on the research, the following implementation logic is recommended for the CTRL extension:Connection Resilience: Implement a rigid state machine for the handshake. Do not assume auth.login success implies a core connection. Always check web.connected and auto-connect to the first available host if necessary.Version Compatibility Layer: Abstract the retrieval of peer and seed counts. Create a helper function that checks for peer.num_peers_connected (v2.x). If null/undefined, fallback to num_peers (v1.x). This ensures the extension works across different user environments without crashing.Batch Optimization: When the user performs actions on multiple torrents (e.g., selecting 10 items to pause), aggregate these into a single core.pause_torrent call with a list of IDs. This significantly reduces HTTP round-trips and server load compared to iterating 10 separate requests.Plugin Defense: When configuring plugins like AutoAdd, always fetch the current config first (get_config), modify the specific dictionary entry, and then send the full config back (set_config). Deluge's config replacement logic can be destructive if partial configs are sent.Event-Driven UI: Use the initial get_torrents_status to populate the table. Then, switch to web.get_events polling. Only refresh the full table if TorrentAddedEvent or TorrentRemovedEvent occurs. For TorrentStateChangedEvent, update the specific row locally.9. ConclusionThe Deluge Web API offers a comprehensive, albeit complex, interface for remote management. It eschews modern REST/WebSocket conventions in favor of a strictly typed JSON-RPC envelope and a polling-based event queue. Success in developing the "CTRL" extension hinges on rigorous session management, precise data structure manipulation (particularly for the nested configurations of the Scheduler and AutoAdd plugins), and an intelligent polling strategy that leverages the event system to minimize overhead. By implementing the batch operations and metadata mappings detailed in this report, the extension can achieve a high level of performance and feature parity with the native Deluge client.