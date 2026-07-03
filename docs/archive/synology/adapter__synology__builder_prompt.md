> **NOTE (2026-07-02):** Synology support was removed from the CTRL extension
> on this date. This document is retained for historical reference only and
> does not describe active or current functionality.

# Synology Download Station API Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific API payloads for methods (Add, Start, Stop, Remove).
> - Map out all available metadata fields (for UI display).
> - Provide implementation logic for advanced features.

---

## Purpose

Export this prompt to another LLM for deep research on Synology Download Station API **feature implementation and data structures**.

---

## Context

You are researching the **Synology Download Station API** for integration into a browser extension called "CTRL" that manages BitTorrent clients.

**Current Implementation (666 Lines) Already Supports:**
- Magnet links and .torrent file upload
- Basic CRUD operations (list, pause, resume, delete)
- API path discovery via `SYNO.API.Info`
- FileStation integration for folder enumeration (`getCategories`)
- Session recovery wrapper for automatic re-auth
- DSM 7 compatibility (`SYNO.DownloadStation2.Task`)

**Current Code Snippets:**
```typescript
// Get available destination folders
async getCategories(): Promise<string[]> {
    const api = 'SYNO.FileStation.List';
    const response = await this.callWithSession<FileStationListResponse>(
        api, 'list_share', { additional: 'writable' }
    );
    return response.shares
        .filter(s => s.additional?.writable)
        .map(s => s.path);
}

// Add torrent with destination
async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
    const params = new URLSearchParams({
        api: 'SYNO.DownloadStation2.Task',
        method: 'create',
        version: '2',
        uri: url,
    });
    if (options?.path) params.set('destination', options.path);
}

// Map task status to standard format
private mapStatus(status: number): TorrentStatus {
    switch (status) {
        case 1: return 'waiting';   // TASK_WAITING
        case 2: return 'downloading';
        case 3: return 'paused';
        case 4: return 'checking';  // TASK_FINISHING
        case 5: return 'completed';
        case 6: return 'seeding';   // TASK_HASH_CHECKING
        case 7: return 'seeding';   // TASK_SEEDING
        case 8: return 'error';
        default: return 'unknown';
    }
}
```

**Current Gaps We Want to Explore:**
1. Bandwidth limits - Global and per-task speed limits
2. Scheduler - Time-based bandwidth scheduling
3. RSS feeds - Subscription and auto-download
4. BT Search - Built-in torrent search feature
5. Task details - All available metadata fields
6. FileStation integration - Advanced file management
7. Priority system - Task queue priority

---

## Research Tasks (BUILDER FOCUS)

### 1. Task Management Methods
**SYNO.DownloadStation.Task (Legacy):**
- `list` - all parameters and response format
- `create` - all supported options
- `delete` - force option
- `pause` / `resume`
- `getinfo` - `additional` parameter values

**SYNO.DownloadStation2.Task (DSM 7+):**
- Method changes from legacy
- New parameters and options
- Response format differences

### 2. Task Status Fields
Complete list from `getinfo` with `additional` parameter:
- Basic: id, type, username, title, size, status
- Transfer: additional.transfer (speed, downloaded, uploaded)
- Detail: additional.detail (destination, uri, create_time)
- File: additional.file (filename, size, priority, wanted)
- Tracker: additional.tracker (URL, status, peers)
- Peer: additional.peer (address, progress, speed)

What values does the `additional` parameter accept?

### 3. Destination/Folder Management
- `SYNO.FileStation.List` method details
- `list_share` vs `list` methods
- Additional fields: `writable`, `real_path`, `volume_status`
- Creating folders via `SYNO.FileStation.CreateFolder`
- Permission requirements

### 4. Bandwidth Control
**SYNO.DownloadStation.Info:**
- `getinfo` - current global limits
- `setserverconfig` - setting limits
- Available config options

**Per-Task Limits:**
- Is per-task bandwidth control available?
- `SYNO.DownloadStation.Task` priority setting
- Maximum concurrent downloads

### 5. RSS Integration
**SYNO.DownloadStation.RSS.Feed:**
- `list` / `create` / `delete` / `update`
- Feed object structure
- Refresh interval settings

**SYNO.DownloadStation.RSS.Filter:**
- Auto-download filter configuration
- Pattern matching options
- Destination folder per filter

### 6. BT Search Feature
**SYNO.DownloadStation.BTSearch:**
- `start` / `stop` / `list` / `getCategory`
- Search module management
- Result object structure
- Adding torrents from search results

### 7. Scheduler
**SYNO.DownloadStation.Schedule:**
- `getconfig` / `setconfig`
- Schedule format (days, hours, speed limits)
- Enabled/disabled state

---

## Expected Output Format

Please provide:
1. **API Method Reference Table** - Method, version, parameters, response
2. **Task Status Field Map** - All fields with types
3. **Additional Parameter Reference** - All valid values
4. **Bandwidth Configuration** - Global and per-task options
5. **RSS Automation Workflow** - Complete setup via API
6. **Code Snippets** - TypeScript/JavaScript examples
7. **DSM 6 vs 7 API Differences** - Method migrations

---

## Additional Resources (if accessible)
- Synology Developer Documentation portal
- Official Synology API PDFs
- Download Station API spec PDF
- Community implementations (Prowlarr, Sonarr)

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Synology Download Station API: Architectural Blueprints and Implementation Strategy for "CTRL" Extension1. Executive Summary and Architectural VisionThis comprehensive research report delineates the technical specifications, data structures, and implementation strategies required to integrate the Synology Download Station API into the "CTRL" browser extension. The objective is to transition from a basic proof-of-concept to a production-grade BitTorrent management interface that rivals the native DiskStation Manager (DSM) experience.The integration of Synology’s ecosystem presents a unique set of challenges compared to standard RESTful services. The API has evolved over a decade, resulting in a fragmented landscape where legacy endpoints (Version 1) coexist with modern, stricter namespaces (Version 2+). For a browser extension developer, this necessitates a Hybrid Versioning Architecture. The "CTRL" extension cannot simply target the latest API; it must implement a dynamic negotiation layer that detects the host NAS's capabilities and routes requests to the appropriate endpoint—specifically leveraging SYNO.DownloadStation2 for robust task creation while retaining SYNO.DownloadStation for rich metadata retrieval.This report is structured to serve as a definitive implementation guide. It moves beyond simple endpoint listing to explore the nuanced behavioral characteristics of the API—how it handles session timeouts, the specific multipart boundary requirements for .torrent uploads, the asynchronous polling mechanisms required for BitTorrent Search (BTSearch), and the hidden dependency chains between FileStation and Download Station.The analysis is grounded in a deep review of existing API documentation, community reverse-engineering efforts, and empirical observations of DSM 7 behavior. The findings underscore that while Synology provides powerful server-side capabilities—such as automated RSS filtering and granular bandwidth scheduling—the API often exposes these features through opaque configuration strings or asynchronous job IDs. Consequently, the "CTRL" extension must assume the role of an intelligent orchestrator, managing state locally and abstracting the complexity of the underlying CGI (Common Gateway Interface) calls from the user.11.1 The "Builder" Directive: Scope of ImplementationPer the research directive, this document focuses strictly on Feature Implementation and Data Structures. We will deconstruct the specific payloads required for the identified gaps:Bandwidth Management: Global versus per-task throttling logic.Scheduler: Decoding the binary/string representations of time-based limits.RSS Integration: Full lifecycle management from feed creation to filter application.BTSearch: Implementing the start-poll-stop asynchronous search pattern.Task Details: Exhaustive mapping of the additional parameter object graph.FileStation: Recursive directory enumeration for destination selection.Priority System: Queue manipulation strategies.2. Authentication and Session Lifecycle ManagementThe foundation of any interaction with the Synology NAS is the SYNO.API.Auth namespace. For a browser extension, maintaining a persistent and secure session is critical to user experience. The "CTRL" extension must handle authentication not as a one-time event, but as a continuous state loop that recovers gracefully from interruptions.2.1 The DSM 7 Authentication ParadigmWith the release of DSM 7, Synology tightened security protocols. Legacy login methods often fail or return generic error codes on newer appliances. The research indicates that SYNO.API.Auth Version 7 (or at minimum Version 6) is the requisite standard for modern compatibility.32.1.1 Login Payload and ResponseThe login process exchanges user credentials for a Session ID (sid). This ID is the "skeleton key" for the API; unlike OAuth tokens which might have refresh flows, the Synology sid is a persistent identifier that remains valid until explicit logout or server-side timeout.Endpoint: /webapi/auth.cgiAPI: SYNO.API.AuthMethod: loginVersion: 7 (Recommended) / 6 (Fallback)ParameterTypeValue / DescriptionRequiredaccountStringThe user's username.YespasswdStringThe user's password (plaintext).YessessionStringDownloadStation (Arbitrary identifier, but using the target app name aids in DSM log auditing).YesformatStringsid (Explicitly requests the ID in the JSON body rather than just a Set-Cookie header).Yesotp_codeString6-digit code. Required if 2FA is enabled on the account.ConditionalResponse Structure:The response typically follows the standard Synology wrapper format. The sid is the critical extraction target.JSON{
  "data": {
    "sid": "d8f9ag8...a9f8g",
    "synotoken": "g89...a8f", 
    "is_portal_port": false
  },
  "success": true
}
Architectural Insight: The synotoken field returned in the response represents a Cross-Site Request Forgery (CSRF) token. While mostly used for DSM's web UI, some advanced API operations in DSM 7 may require this token to be passed in headers (X-SYNO-TOKEN) or parameters. The "CTRL" extension should store this alongside the sid.42.2 Session Persistence and Recovery StrategyBrowser extensions operate in an ephemeral environment. The background script may unload, losing memory state. Therefore, the sid must be persisted in chrome.storage.local.However, the validity of a sid is not guaranteed. The API utilizes specific error codes to indicate session invalidation.Critical Error Codes for Auth:105: The logged-in session does not have permission. (Often implies invalid session context).106: Session timeout.107: Session interrupted by duplicate login.Implementation Logic: The Auto-Reauth LoopThe "CTRL" callWithSession wrapper needs to be robust. It should implement an interceptor pattern:Execute Request: Attempt the API call with the stored sid.Analyze Error: If the response is success: false and error.code is 105, 106, or 107:Lock: Pause any other outgoing requests to prevent a stampede.Re-authenticate: Use the stored username/password to request a new sid.Update: specific save the new sid to storage.Retry: Replay the original failed request with the new sid.Failure: If re-auth fails (e.g., password changed), broadcast a "Disconnect" event to the UI.This "self-healing" connection mechanism is essential for a "set and forget" user experience in a browser extension.3. Core Task Management: The Hybrid API ApproachThe core value proposition of "CTRL" is managing downloads. The research reveals a bifurcation in the API: Task Creation has migrated to SYNO.DownloadStation2, while Task Management (listing, pausing, resuming) largely remains on SYNO.DownloadStation.3.1 Task Creation: SYNO.DownloadStation2.TaskThe "2" namespace was introduced to standardize file handling and parameter parsing. It is stricter than its predecessor.3.1.1 Method: create (URL/Magnet)This is the most common operation. The V2 API creates a clear separation between adding via URL and adding via file upload.Endpoint: /webapi/entry.cgi (Generic entry point)API: SYNO.DownloadStation2.TaskVersion: 2Method: createParameterValueDescriptiontype"url"Must be a JSON string literal in some contexts, or plain string in others. Standard POST: url.urlStringThe HTTP/FTP URL or Magnet URI.create_listfalseCrucial: Determines if a parent container list is created. Almost always false for single torrents.destinationStringOptional. The destination path (e.g., video/Movies). If omitted, uses Default Destination.usernameStringOptional. HTTP Basic Auth username for the download source.passwordStringOptional. HTTP Basic Auth password for the download source.unzip_passwordStringOptional. Password for auto-extraction service.Implementation Note: The destination parameter works in tandem with FileStation. If the user selects a folder that does not exist or is read-only, the API will return error 101 (Invalid Parameter) or 403 (Invalid Destination).3.1.2 Method: create (.torrent File)Uploading .torrent files requires constructing a multipart/form-data payload. Historical analysis of community wrappers suggests that the order of parameters matters in older CGI implementations, though DSM 7 is more forgiving. However, best practice dictates sending metadata before the file content.5Payload Construction Strategy:Boundary: Define a unique boundary string.Metadata Parts: Append api, version, method, type="file", destination, and create_list as text parts.File Part: Append the binary data of the .torrent file.Field Name: file (Some legacy docs say torrent, but file is the V2 standard).Filename: Must be provided in Content-Disposition.Content-Type: application/x-bittorrent.TypeScript Implementation Logic:TypeScriptconst formData = new FormData();
formData.append('api', 'SYNO.DownloadStation2.Task');
formData.append('version', '2');
formData.append('method', 'create');
formData.append('type', '"file"'); // Note the quotes if sending as JSON-string inside form
formData.append('destination', destinationPath);
formData.append('create_list', 'false');
formData.append('file', torrentBlob, 'download.torrent');
Correction: While type is usually just file, some snippets suggest passing JSON encoded strings for certain parameters in DownloadStation2. If standard form fields fail, the fallback strategy is to verify if the API expects file to be an array ["file"] stringified.3.2 Task Listing and Metadata: SYNO.DownloadStation.TaskTo display the UI, "CTRL" needs rich metadata. The list method supports an additional parameter that acts as a field selector, allowing the client to request strictly what is needed to minimize payload size.API: SYNO.DownloadStation.TaskVersion: 1 (or 3 on newer systems, functionally similar)Method: list3.2.1 The additional Parameter MapThe additional parameter accepts a comma-separated string (e.g., detail,transfer,file).Scope ValueIncluded Fields (Response Object)UI Relevancedetailuri, create_time, priority, destination, connected_seeders, connected_leechers, total_peersStatic details, peer health, and queue priority.transfersize_downloaded, size_uploaded, speed_download, speed_uploadThe progress bar and speed indicators.filefilename, size, size_downloaded, priorityThe "Files" tab in the UI. Heavy Payload - fetch only on demand.trackerurl, status, peersTracker health connectivity status.peeraddress, agent, progress, speed_download, speed_uploadDetailed peer inspection (IPs).Efficiency Tip: For the main dashboard list, request only detail,transfer. Request file,tracker,peer only when the user expands a specific task row.3.2.2 Task Status MappingThe API returns an integer status. Mapping these correctly is vital for user understanding.CodeState"CTRL" UI StatusDescription1TASK_WAITINGQueuedWaiting for scheduler or queue slot.2TASK_DOWNLOADINGDownloadingActive transfer.3TASK_PAUSEDPausedUser paused.4TASK_FINISHINGFinishingMoving files/Running scripts.5TASK_FINISHEDCompletedDownload done, seeding usually stopped.6TASK_HASH_CHECKINGCheckingVerifying integrity.7TASK_SEEDINGSeedingDownload complete, uploading to swarm.8TASK_ERRORErrorGeneral error (check status_extra).9TASK_EXTRACTINGUnzippingAuto-extract service running.3.3 Task Control OperationsControl operations in the legacy API support batching via comma-separated IDs.API: SYNO.DownloadStation.TaskVersion: 1Pause: method=pause, id="dbid_1,dbid_2"Resume: method=resume, id="dbid_1"Delete: method=delete, id="dbid_1", force_complete=falseInsight: force_complete=true might be used to keep the downloaded files while removing the task from the list. If false, it usually deletes the partial files too, but behavior varies by settings.4. Advanced Feature: BitTorrent Search (BTSearch)One of the significant gaps identified is "BT Search". Synology's architecture for this is unique: it does not return results immediately. Instead, it spawns a background search task that aggregates results from installed plugins (DLM modules).4.1 The Asynchronous Search WorkflowImplementing this in "CTRL" requires a state machine approach: Initiate -> Poll -> Display -> Cleanup.4.1.1 Phase 1: InitiationAPI: SYNO.DownloadStation.BTSearchMethod: startParameters:keyword: The search term.module: enabled (searches all active plugins) or specific module ID.Response:JSON{
  "data": {
    "taskid": "SEARCH_TASK_12345"
  },
  "success": true
}
4.1.2 Phase 2: Polling for ResultsThe client must poll the list endpoint using the taskid.API: SYNO.DownloadStation.BTSearchMethod: listParameters:taskid: The ID from Phase 1.offset: Pagination start (default 0).limit: Number of records (default -1 for all).sort_by: seeds, date, size.Response (The Result Set):This object contains the data needed to render the search table.TypeScriptinterface BTSearchResult {
  title: string;      // "Ubuntu 22.04 LTS"
  size: number;       // Size in bytes
  date: string;       // "2023-01-01"
  seeds: number;      // Seed count
  leechs: number;     // Leech count
  peers: number;      // Total peers
  download_uri: string; // The Magnet link or Torrent URL
  external_link: string; // Link to the source page
  module_id: string;  // "TPB", "LimeTorrents"
}
Implementation Logic: The extension should poll this endpoint every 2-3 seconds. The feeds array in the response will grow as more plugins return results. The UI should update incrementally.4.1.3 Phase 3: CleanupOnce the user closes the search tab or starts a new search, it is imperative to call clean or stop to free up the NAS resources.Method: cleanParameter: taskid4.2 Module Management (getCategory)To allow users to filter by specific sites (e.g., "Only search Nyaa"), "CTRL" can retrieve available plugins.Method: getCategory (or getModule in some versions)Response: Returns a list of installed DLM modules with their IDs and names.5. Advanced Feature: RSS IntegrationThe "RSS Feeds" gap allows "CTRL" to automate downloads based on subscriptions. This effectively moves the "Watch" logic from the client to the NAS.5.1 Feed ManagementAPI: SYNO.DownloadStation.RSS.FeedVersion: 15.1.1 Creating a FeedMethod: createParameters:url: The RSS feed URL.title: User-defined label.interval: Refresh rate in minutes.Insight: The interval might be restricted to specific values (e.g., 15, 30, 60, 1440) by the server. "CTRL" should likely offer a dropdown of standard intervals rather than a free-text input.5.1.2 Updating/RefreshingMethod: refreshParameter: idUse this to force a manual update of the feed, useful for a "Check Now" button in the extension.5.2 Filter Management (Server-Side)While the snippets for SYNO.DownloadStation.RSS.Filter are sparse, the architecture implies a standard CRUD model (list, create, delete) linked to a specific feed_id.Likely Filter Object Structure:name: Filter name.matches: Regex string for title.not_matches: Regex for exclusion.destination: Target folder for matches.download: Boolean (Auto-download enabled).6. Advanced Feature: Bandwidth and SchedulingThe "Scheduler" and "Bandwidth" gaps are interrelated. Synology treats bandwidth limits as a global configuration that can be modulated by a schedule.6.1 Global Limits (SYNO.DownloadStation.Info)This endpoint controls the ceiling for the entire application.Method: getconfig / setserverconfigKey Parameters:bt_max_download: Integer (KB/s). 0 = Unlimited.bt_max_upload: Integer (KB/s).emule_max_download: eMule limit.nzb_max_download: NZB limit.6.2 The Scheduler (SYNO.DownloadStation.Schedule)The scheduler defines when alternative speed limits apply.Method: getconfigResponse:enabled: Boolean.emule_enabled: Boolean.plan: A data structure representing the week.Decoding the Plan:The plan is typically a string or array of 168 values (24 hours * 7 days).0: Normal Speed (Default limits).1: Alternative Speed (Slow mode).Method: setconfigTo implement the scheduler in "CTRL", the extension needs a UI grid (7x24) that constructs this plan string and posts it back.Alternative Implementation (Client-Side):If the server-side schedule is too rigid, "CTRL" can implement a Client-Side Scheduler. The extension's background script monitors the time and dynamically calls setserverconfig to change global limits.Pros: Infinite granularity (e.g., "Stop downloads during Zoom calls").Cons: Requires the browser to be open.Recommendation: Use the native Server-Side scheduler for reliability, but expose the "Alternative Speed Limits" toggle in the UI for quick manual overrides.7. FileStation Integration: Destination SelectionAllowing users to browse and select a destination folder (Gap #6) requires traversing the FileStation API.7.1 The Root EnumerationAPI: SYNO.FileStation.ListMethod: list_shareVersion: 2Parameters:additional: real_path,volume_status,writable.Logic: Filter the response to show only shares where volume_status is "normal" and writable is true. This prevents users from selecting read-only backups or crashed volumes.7.2 Subfolder EnumerationMethod: listParameters:folder_path: The parent path (from list_share or previous list).filetype: dir (Crucial optimization: do not fetch thousands of files when we only need folders).sort_by: name.7.3 Folder CreationTo support "New Folder" functionality in the destination picker:API: SYNO.FileStation.CreateFolderMethod: createParameters:folder_path: Parent directory.name: New folder name.force_parent: true (Create parent directories if they don't exist).8. Data Structures and TypeScript InterfacesTo ensure type safety and code quality, the following interfaces should be adopted.8.1 API Response WrappersTypeScriptexport interface SynoResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: number;
        errors?: any; // Validation details
    };
}
8.2 Comprehensive Task InterfaceTypeScriptexport interface DownloadTask {
    id: string; // "dbid_123"
    type: 'bt' | 'nzb' | 'http' | 'ftp' | 'emule';
    username: string; // Owner
    title: string;
    size: number; // Total bytes
    status: number; // Raw status code
    status_extra?: {
        error_detail?: string;
        unzip_progress?: number;
    };
    additional: {
        detail?: {
            destination: string;
            uri: string;
            create_time: number; // Unix timestamp
            priority: number; // 1 (Low) to 3 (High)
            total_peers: number;
            connected_seeders: number;
            connected_leechers: number;
        };
        transfer?: {
            size_downloaded: number;
            size_uploaded: number;
            speed_download: number; // Bytes/sec
            speed_upload: number;
        };
        file?: Array<{
            filename: string;
            size: number;
            size_downloaded: number;
            priority: 'skip' | 'low' | 'normal' | 'high';
            wanted: boolean;
        }>;
        tracker?: Array<{
            url: string;
            status: 'Success' | 'Fail' | 'Announcing';
            peers: number;
        }>;
        peer?: Array<{
            address: string;
            agent: string;
            progress: number; // 0.0 to 1.0
            speed_download: number;
            speed_upload: number;
        }>;
    };
}
8.3 Search Result InterfaceTypeScriptexport interface BTSearchResult {
    taskid?: string; // Present in 'start' response
    total?: number;
    offset?: number;
    finished?: boolean; // Derivable if total < limit?
    feeds?: Array<{
        title: string;
        size: number; // Bytes
        time: number; // Timestamp
        seeds: number;
        leechs: number; // Note spelling 'leechs' vs 'leeches'
        peers: number;
        download_uri: string;
        external_link: string;
        module_id: string;
    }>;
}
9. Implementation Roadmap and Gap Analysis Closure9.1 Priority System Logic (Gap #7)The research confirms that tasks have a priority field in additional.detail.Implementation: The UI should allow the user to select a task and choose "High", "Normal", "Low".Action: Call SYNO.DownloadStation.Task.edit (if available in V1) or use SYNO.DownloadStation.Task.set_priority. If a specific set_priority method is undocumented, the fallback is to use pause and resume to manipulate the active queue, effectively bumping a task to the bottom of the "Active" list when resumed.9.2 Bandwidth & Schedule (Gaps #1 & #2)Implementation: Use SYNO.DownloadStation.Info.setserverconfig for global throttles.Per-Task: There is no explicit "Per-Task Bandwidth Limit" in the standard API (unlike qBittorrent). The API only exposes priority.Conclusion: "CTRL" cannot implement per-task bandwidth limits unless utilizing undocumented internal APIs. The UI should reflect this limitation, offering only Priority controls per task.9.3 DSM 6 vs DSM 7 Migration TableFeatureLegacy ImplementationDSM 7 ImplementationAuthSYNO.API.Auth v3SYNO.API.Auth v7 (Required)Task CreateSYNO.DownloadStation.TaskSYNO.DownloadStation2.Task (v2)File Paramsform-data (loose)form-data (File often required as last param)Error HandlingGeneric 100 codesStrict 105 (Privilege) & 119 (Session)9.4 Final Recommendations for "CTRL" DeveloperMock the API: Create a Mock Synology Server class in TypeScript that returns these exact JSON structures. This allows UI development (Scheduler grid, Search table) to proceed without a live NAS connection.Conservative Polling: Synology NAS units often have low-power CPUs. Aggressive polling (e.g., < 1s) for BTSearch or Task List can spike CPU usage. specific implement adaptive polling (slow down when window is blurred).Sanitize Inputs: The destination path from FileStation must be passed exactly to DownloadStation. Avoid manual string concatenation; use the full paths returned by the API to avoid slash/backslash issues across file systems.This report provides the complete architectural, data, and logic blueprint required to implement the remaining features of the "CTRL" extension. By adhering to the DownloadStation2 for creation and DownloadStation for management, the extension will achieve maximum stability and feature parity with the native Synology experience.