# qBittorrent API Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific JSON payloads for methods (Add, Start, Stop, Remove).
> - Map out all available metadata fields (for UI display).
> - Provide implementation logic for advanced features.

---

## Purpose

Export this prompt to another LLM for deep research on qBittorrent Web API **feature implementation and data structures**.

---

## Context

You are researching the **qBittorrent Web API** for integration into a browser extension called "CTRL" that manages BitTorrent clients. We already have a working `QBittorrentAdapter` implementation (177 lines, TypeScript) that supports:

- Cookie-based authentication via `/api/v2/auth/login`
- Categories and tags (full CRUD)
- Magnet links and .torrent file upload
- Pause/resume/delete operations
- Progress, speed, ETA, and save path display

**Current Gaps We Want to Explore:**
1. Sequential download mode - Setting first/last piece priority
2. Bandwidth limits - Per-torrent and global speed limits
3. RSS feeds - Built-in RSS downloader
4. Search plugins - qBittorrent's search plugin system
5. Tracker management - Adding/removing trackers
6. WebSocket support - Real-time updates instead of polling

---

## Research Tasks (BUILDER FOCUS)

### 1. Advanced Download Management
- Sequential download via API (`sequentialDownload` parameter)
- First/last piece priority per file
- WebSeed support - adding HTTP sources
- Super seeding mode activation

### 2. Bandwidth Control
- Global speed limits (`/api/v2/transfer/*`)
- Per-torrent speed limits
- Alternative speed limits (scheduled)
- Bandwidth scheduler settings

### 3. RSS Integration
- `/api/v2/rss/*` endpoints - full capability map
- Filter rules syntax and limitations
- Smart episode filter support
- Polling interval configuration

### 4. Search Plugin System
- List installed search plugins
- Trigger searches via API
- Install/uninstall plugins remotely
- Search result handling

### 5. Tracker Management
- Add/remove trackers from torrents
- Tracker status information
- Announce/scrape triggers
- Tracker URL editing

### 6. Real-Time Updates
- `/api/v2/sync/maindata` endpoint behavior
- `rid` parameter for efficient polling
- Delta updates vs full refreshes
- WebSocket/SSE availability

### 7. Torrent Status Fields
- Complete field reference for torrent info
- File list and progress fields
- Peer and tracker information
- Content layout options

---

## Expected Output Format

Please provide:
1. **API Method Reference Table** - Endpoint, method, parameters, response
2. **Torrent Field Map** - All fields with types
3. **Feature Feasibility Matrix** - Which gaps are possible
4. **Code Snippets** - Example API calls
5. **RSS Configuration** - Automation setup
6. **Sync/Polling Optimization** - Efficient update strategies

---

## Additional Resources (if accessible)
- qBittorrent GitHub wiki and API documentation
- Community reverse-engineering efforts
- qBittorrent release notes for API changes

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

qBittorrent Web API v2: Comprehensive Integration Architecture & Data Structure Reference1. Executive SummaryThis comprehensive research report outlines the architectural specifications, data structures, and implementation logic required to integrate the qBittorrent Web API (v2.x) into an external browser extension environment, specifically the "CTRL" project. The analysis is derived from an exhaustive review of technical documentation, community reverse-engineering efforts, and source code behaviors of the underlying libtorrent library utilized by qBittorrent.The primary objective of this document is to bridge the gap between basic API utilization—such as adding torrents and pausing downloads—and the implementation of "power user" features. These features include sequential downloading for streaming, granular file prioritization, complex RSS automation with Regular Expression (Regex) filtering, and real-time state synchronization without the benefit of native WebSocket support.The findings indicate that while qBittorrent operates on a REST-like architecture, it deviates significantly in its state management strategy. It employs a robust HTTP polling mechanism anchored by a "Response ID" (rid) system to deliver delta updates. This report details the algorithmic approach required to consume these deltas effectively in a client-side application, ensuring high performance even when managing large torrent lists. Furthermore, the report provides the precise JSON payloads for undocumented or partially documented endpoints, such as those governing the search plugin system and the experimental web seed functionality.The architectural recommendations contained herein are designed to facilitate the creation of a "Builder" class application—one that not only monitors status but fully manipulates the client's configuration and behavioral logic.2. Authentication & Session Security ArchitectureThe foundation of any remote interface is secure, persistent authentication. Unlike modern API standards that often utilize stateless Bearer tokens or JWTs (JSON Web Tokens), qBittorrent relies on a traditional cookie-based session management system. This choice reflects its origins as a direct WebUI for the desktop application rather than an API-first platform. For a browser extension, this necessitates distinct handling of cross-origin requests and cookie lifecycles.2.1. Session Lifecycle ManagementThe entry point for all API interactions is the authentication endpoint. It is crucial to note that the API expects the payload to be formatted as application/x-www-form-urlencoded rather than application/json.1 This is a common stumbling block for modern TypeScript implementations that default to JSON serialization.Endpoint Specification:Method: POSTURL: /api/v2/auth/loginHeaders:Content-Type: application/x-www-form-urlencodedReferer: <HOST_URL> (Required for CSRF checks)Payload: username=<USER>&password=<PASS>Upon a successful login, the server responds with a 200 OK status and a body containing the string Ok..2 Critically, it sets a Set-Cookie header containing the SID (Session ID). For a browser extension, the browser's underlying network stack typically handles the storage of this cookie automatically, provided the extension has the appropriate host permissions in its manifest. However, the extension must explicitly handle the Referer header. qBittorrent’s security settings often reject requests that do not originate from the same host to prevent Cross-Site Request Forgery (CSRF) attacks.3The session duration is configurable on the server side (defaulting to 3600 seconds). The client implementation must be resilient to session expiry. When an API call returns a 403 Forbidden (often used for IP bans) or 401 Unauthorized (used for invalid sessions), the adapter must intercept this failure, attempt a silent re-authentication using stored credentials, and retry the original request.4 This "optimistic" request flow reduces the latency overhead of checking session validity before every action.2.2. Security Context and CSRF ProtectionThe research highlights strict enforcement of header validation in recent API versions (v2.x). If the Referer or Origin headers do not match the expected domain and port of the qBittorrent instance, the server will reject mutations (POST requests) even with a valid SID cookie.For the "CTRL" extension, this implies that fetch requests must manually override these headers if the browser security context allows, or the extension must operate in a context (like a background script) where these restrictions are relaxed compared to a standard web page.Logout and Session Termination:Explicitly terminating sessions is good practice to prevent session leaking, especially on shared machines.Endpoint: /api/v2/auth/logoutMethod: POSTPayload: NoneResponse: 200 OK3. Core Synchronization Protocol & State ManagementThe most complex requirement for the "CTRL" extension is "Real-Time Updates." In the absence of WebSockets 5, qBittorrent implements a highly efficient polling protocol designed to minimize bandwidth usage while keeping the UI in sync. This is achieved through the /api/v2/sync/maindata endpoint and the rid (Response ID) parameter.3.1. The Response ID (rid) ArchitectureThe rid system transforms a standard HTTP polling mechanism into a pseudo-push system. The server maintains an internal counter of state changes.Initial Synchronization (rid=0):When the dashboard first loads, the client sends a GET request to /api/v2/sync/maindata?rid=0. The server identifies 0 as a request for the full state. It responds with a complete snapshot of all categories, tags, server state, and active torrents. Crucially, the response includes a new rid (e.g., 1548).Delta Synchronization:For subsequent updates, the client sends the last received rid (e.g., 1548). The server holds the request (simulating long-polling behavior) or processes it immediately depending on configuration.If no changes have occurred since rid 1548, the server returns the same rid and an empty payload (or waits until a timeout).If the state has changed (e.g., download progress increased, a peer connected), the server calculates the difference (delta) between the state at 1548 and the current state. It returns only the changed fields and a new rid (e.g., 1549).This architecture 6 significantly reduces data transfer. A client monitoring 1,000 torrents might only receive a few kilobytes of JSON data per second representing speed updates, rather than megabytes of redundant metadata.3.2. Sync Data Payload StructureThe JSON returned by sync/maindata is hierarchical and must be parsed carefully to update the local state store correctly.Top-Level Object Map:rid (Integer): The new response ID to be used for the next request.full_update (Boolean): A critical flag. If true, the client must discard its entire local cache and replace it with the data in this response. This typically happens if the rid provided was too old or invalid.torrents (Object): A dictionary map where keys are Torrent Hashes.In a full_update, this contains all torrents.In a delta update, this contains only torrents that have changed.torrents_removed (Array of Strings): A list of Torrent Hashes that have been removed from the transfer list. The client must delete these keys from its local store.7categories (Object): Map of category names to properties (save path).categories_removed (Array): List of category names to delete.tags (Array): List of all tags.tags_removed (Array): List of tags to delete.server_state (Object): Global application state (connection status, global speed limits, free disk space).3.3. Implementation Logic: Delta MergingThe "CTRL" extension must implement a robust merge function. A simple object overwrite will not work for delta updates because the delta only contains partial data.Algorithm:Check full_update: If true, localStore = response.torrents.Process Removals: Iterate through response.torrents_removed and delete localStore[hash].Process Updates: Iterate through keys in response.torrents.If localStore[hash] exists: localStore[hash] = {...localStore[hash],...response.torrents[hash] }. This spreads the new properties over the old ones, preserving fields that didn't change (like name or size) while updating dynamic fields (like dlspeed or eta).If localStore[hash] does not exist: This is a new torrent added since the last sync. localStore[hash] = response.torrents[hash].3.4. Polling Optimization StrategiesTo maintain browser performance, the extension should utilize an adaptive polling interval.Foreground Mode: When the popup is open, poll every 1000ms - 2000ms.Background Mode: Poll every 10s - 30s or suspend polling entirely until the user engages.Error Backoff: If the API returns 500 or times out, increase the polling interval exponentially (2s -> 4s -> 8s) to prevent hammering a struggling server.4. Torrent Metadata & File Structure AnalysisThe torrents dictionary returned by sync/maindata (and torrents/info) is the primary data source for the UI. Mapping these fields correctly is essential for a professional user experience.4.1. Comprehensive Torrent Field MapThe following table maps the raw JSON fields to their data types and UI utility. This aggregation combines standard documentation with observations from community reverse-engineering.7Field KeyData TypeUI LabelDescription & ContextnameStringNameThe display name of the torrent.hashStringHashThe SHA-1 identifier. Used as the primary key.magnet_uriStringMagnet LinkThe full magnet URI.sizeIntegerTotal SizeTotal size of selected files in bytes.progressFloatProgressDownload progress (0.0 to 1.0). Multiply by 100 for percentage.dlspeedIntegerDL SpeedCurrent download speed in bytes/second.upspeedIntegerUL SpeedCurrent upload speed in bytes/second.priorityIntegerQueue PosQueue position. 1 is highest. -1 indicates not queued.num_seedsIntegerSeeds (Conn)Number of seeds currently connected.num_leechsIntegerPeers (Conn)Number of leechers (peers) currently connected.total_seedsIntegerSeeds (Total)Total known seeds in the swarm (from tracker/DHT).total_leechsIntegerPeers (Total)Total known peers in the swarm.ratioFloatRatioShare ratio. Calculated as uploaded / downloaded.etaIntegerETAEstimated seconds remaining. 8640000 = Infinity/Unknown.stateStringStatusCritical status enum (see section 4.2).seq_dlBooleanSequentialtrue if sequential download is enabled.10f_l_piece_prioBooleanHead/Tailtrue if First/Last piece priority is enabled.10super_seedingBooleanSuper Seedtrue if Super Seeding mode is active.3force_startBooleanForce Starttrue if the torrent ignores queue limits.save_pathStringSave PathAbsolute path on the server filesystem.added_onIntegerAdded DateUnix timestamp of addition.completion_onIntegerDone DateUnix timestamp of completion. -1 if incomplete.categoryStringCategoryAssigned category name. Empty string if none.tagsStringTagsComma-separated list of tags (e.g., "linux,iso").content_pathStringContent PathAbsolute path to the content (file or root folder).4.2. Status State MachineThe state field is not a simple "Downloading" string. It reflects the internal libtorrent state machine. The extension must map these raw values to user-friendly UI badges.metaDL: Downloading metadata (.torrent file).allocating: Allocating disk space.downloading: Active downloading.stalledDL: Downloading enabled, but no peers connected (or transfer is 0).pausedDL: Paused by user (incomplete).checkingDL / checkingUP: Hash checking.queuedDL / queuedUP: Waiting in queue.uploading: Seeding.stalledUP: Seeding enabled, but no peers connected.pausedUP: Paused by user (complete).error: IO error or other issue (check error field for message).4.3. File Management (torrents/files)While sync/maindata provides the overview, the "CTRL" extension allows users to browse files inside a torrent. This requires a separate endpoint: GET /api/v2/torrents/files?hash=<HASH>.Response JSON Structure:The response is an array of file objects.JSON[
  {
    "index": 0,
    "name": "Ubuntu_22.04.iso",
    "size": 36548945,
    "progress": 0.55,
    "priority": 1,
    "is_seed": false,
    "piece_range": ,
    "availability": 0.99
  }
]
Priority Levels:The priority field controls whether a file is downloaded.0: Do not download.1: Normal priority.6: High priority.7: Maximal priority.To rename a file, the endpoint POST /api/v2/torrents/renameFile is used with hash, oldPath, and newPath parameters.115. Advanced Download & Queue ManagementA key requirement for the "CTRL" extension is enabling "Advanced Download Management," specifically sequential downloading and piece prioritization. These features are vital for users who wish to stream video content while it downloads.5.1. Sequential Download & First/Last Piece PrioritySequential downloading forces the client to request pieces in order (0, 1, 2...) rather than the rarest-first strategy usually employed by BitTorrent. First/Last piece priority ensures the file header and footer are present, which is often required by media players to index the file duration and codecs.Endpoints:POST /api/v2/torrents/toggleSequentialDownloadPOST /api/v2/torrents/toggleFirstLastPiecePrioPayload Implementation:These endpoints operate as toggles. They do not accept a "true/false" value to set a specific state; they simply invert the current state. Therefore, the implementation logic in the extension must check the current state (via the seq_dl and f_l_piece_prio fields in the torrent info) before sending the request to ensure the desired outcome is achieved.Request Payload:These endpoints utilize application/x-www-form-urlencoded.HTTPhashes=8c212779b4abde7c6bc608063a0d008b7e40ce32|54eddd830a5b58480a6143d616a97e3a6c23c439
hashes: A string containing one or more torrent hashes separated by the pipe character |.all: Alternatively, the keyword all can be passed to toggle the setting for every torrent in the session.35.2. Web Seeds (HTTP Sources)Web seeds (HTTP Seeding/BEP 19) allow a torrent client to download pieces from a standard HTTP web server, acting as a reliable seed when P2P swarms are slow. While often configured at the.torrent file level, qBittorrent allows adding them dynamically.Endpoint: POST /api/v2/torrents/addWebSeeds 2Payload:HTTPhash=<TORRENT_HASH>&url=<HTTP_URL>
hash: The hash of the target torrent.url: The full HTTP/HTTPS URL to the file.Feasibility Note: This feature is supported in the API but is often considered "experimental" in terms of UI exposure. The extension can leverage this to allow users to "boost" downloads by manually providing direct download links (e.g., from a file locker or mirror) that match the torrent's file structure.5.3. Super SeedingSuper Seeding is a mode designed for initial uploaders. It hides the fact that the client has 100% of the data and pretends to have only specific pieces, incentivizing peers to share with each other rather than leeching solely from the seed.Endpoint: POST /api/v2/torrents/setSuperSeeding 3Payload: hashes=<HASHES>&value=truevalue: Boolean (true/false) to enable or disable the mode. Unlike the sequential toggle, this endpoint allows explicit state setting.6. Bandwidth Control & Transfer EngineeringEffective bandwidth management is a core utility for any torrent controller. qBittorrent exposes a layered system of limits: Global, Alternative (Scheduled), and Per-Torrent.6.1. Global Transfer LimitsGlobal limits apply to the aggregate traffic of the client.Endpoints:GET /api/v2/transfer/info: Returns current global transfer data (dl_info_speed, dl_rate_limit, etc.).7POST /api/v2/transfer/setDownloadLimit: Sets global download cap.POST /api/v2/transfer/setUploadLimit: Sets global upload cap.POST /api/v2/transfer/toggleSpeedLimitsMode: Toggles "Alternative" rate limits.Payload Structure:HTTPlimit=1024000
limit: The speed limit in bytes per second. A value of 0 indicates no limit.12Logic for "Bandwidth Scheduler":While qBittorrent has an internal scheduler, the API exposes toggleSpeedLimitsMode (taking 0 or 1 or toggling if empty) which allows the "CTRL" extension to implement its own sophisticated scheduler. The extension can monitor the user's browser activity or system time and engage "Alternative Mode" (usually stricter limits) when the user is active, and disengage it when idle.6.2. Per-Torrent Bandwidth LimitsFor granular control, limits can be applied to individual torrents.Endpoints:POST /api/v2/torrents/setDownloadLimitPOST /api/v2/torrents/setUploadLimitPayload Structure:HTTPhashes=8c212779b4abde7c6bc608063a0d008b7e40ce32|...&limit=512000
hashes: Pipe-separated hashes.limit: Bytes per second.Implementation Insight:The extension should display the current limit status in the UI. This data is available in the torrents/info or sync/maindata response under the keys dl_limit and up_limit. If these keys are 0 or missing, it implies the global limit (or no limit) applies.7. Tracker Management & ConnectivityManaging trackers is essential for reviving dead torrents or optimizing speeds on private trackers. The API supports full CRUD (Create, Read, Update, Delete) operations on the tracker list of any torrent.7.1. Adding and Removing TrackersEndpoints:POST /api/v2/torrents/addTrackersPOST /api/v2/torrents/removeTrackersAdd Trackers Payload:HTTPhash=<TORRENT_HASH>&urls=http://tracker1.com/announce%0Ahttp://tracker2.com/announce
urls: A string containing one or more tracker URLs. Critically, multiple URLs must be separated by the newline character (\n or URL-encoded %0A).11Remove Trackers Payload:HTTPhash=<TORRENT_HASH>&urls=http://tracker1.com/announce|http://tracker2.com/announce
urls: For removal, the API documentation and community wrappers suggest using pipe | separation or repeating the urls parameter, though newline is the standard delimiter for the "add" endpoint. Testing confirms that providing the exact URL string as it appears in the tracker list is required for matching.117.2. Editing and Tier ManagementTrackers are organized into tiers. qBittorrent attempts to announce to all trackers in Tier 0, then Tier 1, etc.Endpoint: POST /api/v2/torrents/editTrackerPayload:HTTPhash=<TORRENT_HASH>&origUrl=<OLD_URL>&newUrl=<NEW_URL>
origUrl: The current URL of the tracker to be changed.newUrl: The new URL.Endpoint: POST /api/v2/torrents/reannounce 7Triggers a manual announce to all trackers for the specified torrents (hashes parameter). Useful if a tracker was temporarily down.7.3. Tracker Status CodesWhen retrieving tracker info via GET /api/v2/torrents/trackers?hash=<HASH>, the response includes a status integer field. The extension should map these to UI states 7:0: Disabled (Tracker is disabled)1: Not Contacted (Waiting to announce)2: Working (Announce successful, peers received)3: Updating (Announce in progress)4: Not Working (Error occurred, check msg field)8. Search Subsystem & Plugin OrchestrationqBittorrent's search engine is a powerful feature that runs on Python plugins. The "CTRL" extension can interface with this system to allow users to search for content directly from the browser popup, aggregating results from multiple torrent sites.8.1. Search LifecycleSearching is an asynchronous process involving three distinct steps: Initiation, Polling, and Retrieval.Step 1: Initiate SearchEndpoint: POST /api/v2/search/startPayload:HTTPpattern=Ubuntu 22.04&plugins=all&category=all
pattern: The search query string.plugins: all, enabled, or a pipe-separated list of specific plugin names (e.g., legittorrents|linux tracker).category: Category filter (usually all).Response: {"id": 12345} (The Job ID).3Step 2: Monitor StatusEndpoint: POST /api/v2/search/statusPayload: id=12345 (The Job ID received in Step 1).Response:JSON
The extension should poll this endpoint every 1-2 seconds. Status can be Running or Stopped.Step 3: Retrieve ResultsEndpoint: POST /api/v2/search/resultsPayload: id=12345&limit=50&offset=0limit: Max results to return.offset: Pagination offset.Response:JSON{
  "results":,
  "status": "Running",
  "total": 15
}
8.2. Plugin ManagementThe extension can also manage the installed search plugins.List Plugins: GET /api/v2/search/plugins. Returns a list of installed plugins, their version, and whether they are enabled.Install Plugin: POST /api/v2/search/installPlugin.Payload: sources=<URL>. Accepts a URL to a .py search plugin file.Uninstall Plugin: POST /api/v2/search/uninstallPlugin.Payload: names=<PLUGIN_NAME>.Implementation Warning: The search functionality relies on the host machine having Python installed. If Python is missing, the API calls may fail with specific error codes or generic 500 errors. The extension should handle these cases by prompting the user to check their Python installation.159. RSS Automation & Rule DefinitionqBittorrent features a sophisticated RSS Downloader that supports automated content retrieval based on complex rules. This is a high-value feature for "CTRL," allowing users to configure "set and forget" download rules.9.1. Feed ManagementEndpoints:POST /api/v2/rss/addFeedPOST /api/v2/rss/removeItemPOST /api/v2/rss/moveItemPayload for Adding a Feed:JSON{
  "url": "http://rss.legittorrents.info/rss.php",
  "path": "Linux Distros\\Ubuntu"
}
url: The URL of the RSS feed.path: A hierarchical path string. qBittorrent allows organizing feeds into folders. The path Linux Distros\Ubuntu creates a folder "Linux Distros" containing the feed "Ubuntu".9.2. Automated Rule DefinitionThe setRule endpoint defines the logic for auto-downloading. This is where the power lies. The payload is a JSON object that maps directly to the UI fields in the "RSS Downloader" dialog.Endpoint: POST /api/v2/rss/setRuleDetailed JSON Payload:JSON{
  "ruleName": "Daily Linux ISOs",
  "ruleDef": {
    "enabled": true,
    "mustContain": "daily-build",
    "mustNotContain": "broken|unstable",
    "useRegex": true,
    "episodeFilter": "",
    "smartFilter": false,
    "previouslyMatchedEpisodes":,
    "affectedFeeds": [
      "http://rss.legittorrents.info/rss.php"
    ],
    "ignoreDays": 0,
    "lastMatch": "",
    "addPaused": true,
    "assignedCategory": "ISOs",
    "savePath": "/downloads/isos/daily"
  }
}
Field Analysis for UI Construction:mustContain: The primary filter. If useRegex is true, this string is interpreted as a Python-compatible Regular Expression (e.g., Ubuntu.*22\.04). If false, it acts as a simple wildcard string.episodeFilter: Used for TV shows. It accepts specific syntax like 1x01-1x12; 2x01-. The extension should ideally provide a helper UI to generate these strings rather than asking the user to type them raw.3smartFilter: A boolean flag. When enabled, qBittorrent attempts to prevent downloading duplicates of the same episode (e.g., downloading a 1080p version if a 720p version was already fetched, depending on priority).affectedFeeds: An array of feed URLs to which this rule applies. If empty or missing, the rule might apply to all feeds, but explicit assignment is recommended.savePath: Overrides the default save path for matches, allowing for automated sorting of content into subfolders.10. Implementation Recommendations & Best PracticesTo successfully build the "CTRL" extension with this API research, the following implementation roadmap is recommended:State Architecture: Adopt a centralized store (e.g., Redux or React Context) that is capable of delta merging. The store should mirror the structure of sync/maindata.Network Layer: Create an abstraction layer for the API that handles:Cookie persistence and CSRF header injection.Automatic retry on 401/403 errors (re-login flow).Adaptive polling for the sync/maindata loop.Data Type Safety: Use the Field Maps provided in Sections 4 and 9 to create strict TypeScript interfaces. This prevents runtime errors when accessing fields like dlspeed that might be missing in partial updates.User Feedback: Since operations like "Search" and "RSS Refresh" are asynchronous, implement UI indicators (spinners, toasts) that listen for the completion status via polling, rather than assuming immediate success.Security: Ensure the extension's manifest.json requests host permissions for the user's qBittorrent IP to allow the browser to attach the SID cookie automatically.By adhering to these specifications, the "CTRL" extension can deliver a robust, desktop-class management experience within the browser.