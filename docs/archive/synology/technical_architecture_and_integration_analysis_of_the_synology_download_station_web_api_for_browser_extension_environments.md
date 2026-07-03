> **NOTE (2026-07-02):** Synology support was removed from the CTRL extension
> on this date. This document is retained for historical reference only and
> does not describe active or current functionality.

Technical Architecture and Integration Analysis of the Synology Download Station Web API for Browser Extension EnvironmentsThe integration of Synology Download Station into a modern browser extension ecosystem, specifically under the constraints of Manifest V3, requires an exhaustive understanding of the DiskStation Manager (DSM) Web API framework. This framework is characterized by a modular, CGI-based architecture where the Synology NAS acts as a gateway for multiple service modules. The primary interface for download management, the SYNO.DownloadStation suite, facilitates a comprehensive range of actions from simple task monitoring to complex RSS-driven automation and binary file handling. This report provides a rigorous deep dive into the technical specifications, authentication lifecycles, and implementation challenges inherent in developing a high-performance download manager adapter for Synology hardware.API Fundamentals and Discovery InfrastructureThe Synology Web API is not a single, unified RESTful service but rather a collection of discrete modules that must be discovered and invoked through specific entry points. The architectural philosophy dictates a "Discovery First" approach, where the client application must first query the system to determine which modules are available and what their specific CGI paths and version constraints are.1The Role of SYNO.API.InfoThe SYNO.API.Info API serves as the service directory for the entire NAS. Before a browser extension can initiate a download task, it must determine the current path and supported versioning for the Download Station module. This is particularly critical because Synology frequently updates its packages, and the CGI path for SYNO.DownloadStation.Task might change from a legacy path to a consolidated entry.cgi path depending on the DSM version.1MethodPurposeKey ParametersqueryRetrieves the path and versioning info for specified APIsquery=all or query=SYNO.DownloadStation.Task,...The result of this query informs the client of the minVersion and maxVersion. For a robust extension, the implementation logic should always attempt to use the maxVersion supported by the hardware to ensure access to advanced features like subfolder creation and detailed peer telemetry.5Comprehensive SYNO.DownloadStation.Info MethodsThe informational module provides global context for the Download Station environment. It is essential for determining whether the service is active and what the current server-wide configurations are.1MethodDescriptionget_infoRetrieves basic information about the Download Station version and status.get_configReturns the global server settings, including maximum download/upload rates and default destination folders.set_server_configAllows for the modification of global limits and preferences.Beyond these, the SYNO.DownloadStation.Statistic API provides a telemetry hook for real-time monitoring. This method returns the aggregate download and upload speeds across all active tasks, which is typically used by browser extensions to update a badge on the extension icon or provide a high-level overview in a popup menu.1The SYNO.DownloadStation.Task API SuiteThe core of the integration lies within the SYNO.DownloadStation.Task module. This API handles the complete lifecycle of a download task, from creation to finalization. The methods exposed by this module allow for granular control over the download queue.1MethodOperational ContextKey ParameterslistRetrieves the task list with optional telemetryadditional, offset, limitcreateInitiates a new download via URI or fileuri, file, destinationdeleteRemoves tasks from the queueid, force_completepauseSuspends active network activityidresumeRe-queues or restarts a suspended taskideditModifies task-specific settingsid, destinationget_infoRetrieves deep details for specific tasksid, additionalThe additional parameter in the list and get_info methods is the most critical tool for a developer. By requesting detail, transfer, file, tracker, and peer, the extension can retrieve a rich data object that includes not only the progress but also the specific file structure within a torrent and the health of the trackers.8Authentication Deep Dive and Session SecurityAuthentication in the Synology ecosystem is a multi-stage process governed by SYNO.API.Auth. The shift from DSM 6.x to 7.x has introduced more rigorous security requirements, including enhanced CSRF protection and sophisticated multi-factor authentication (MFA) workflows.2Session Token (SID) LifecycleWhen a client logs in using the SYNO.API.Auth method with format=sid, the server does not set a traditional HTTP session cookie. Instead, it returns a unique session identifier called the sid in the JSON payload. This sid must then be appended to every subsequent API call as a _sid query parameter.2The lifecycle of the sid is determined by the "Logout Timer" configuration on the NAS. Typically, this is set to a default of 15 minutes of inactivity.13 However, "inactivity" is defined as the lack of API requests. For a browser extension that polls the task list every few seconds, the session can theoretically remain active indefinitely. If the NAS administrator has set a hard session limit, the extension will receive error code 106 (Session timeout) or 119 (Invalid session), requiring a transparent re-authentication flow to maintain a seamless user experience.2MFA, OTP, and Trusted Device WorkflowsSynology supports complex 2-factor authentication through its "Secure SignIn" mobile app. If 2FA is enabled for the account, a standard login request will fail with error code 403 (2-factor authentication code required).6 The client must then request a 6-digit TOTP (Time-based One-Time Password) from the user and resubmit the login request with the otp_code parameter.15To avoid requiring an OTP for every browser session, developers should utilize the "Device Token" system. By including enable_device_token=yes and a device_name in the initial login, the server returns a did (Device ID). This did can be stored in the extension's local storage and passed in future login attempts via the device_id parameter, effectively allowing the NAS to "remember" the extension as a trusted client and bypass subsequent OTP prompts.6The Absence of App-Specific PasswordsIt is important to note that Synology does not utilize a traditional "App-Specific Password" mechanism. Access is instead managed through specific user permissions. A dedicated "download-manager" user should be created on the NAS with access only to the Download Station package and specific shared folders. This minimizes security risks by ensuring that the extension cannot access sensitive system settings or File Station data.6Binary Data Transmission and Multipart File UploadsWhile adding magnets or URLs is a simple GET or POST request with the uri parameter, uploading a physical .torrent file is a significantly more complex operation. This process requires the construction of a multipart/form-data request that complies with strict boundary and formatting requirements.19Multipart/Form-Data AnalysisA successful file upload must be sent as a POST request to the CGI path (e.g., /webapi/DownloadStation/task.cgi or /webapi/entry.cgi). The body must contain the following fields 21:FieldValueapiSYNO.DownloadStation.Taskversion1 (or highest supported version)methodcreatefileThe binary data of the.torrent fileDevelopers must be cautious not to manually set the Content-Type header if using the FormData API in JavaScript. The browser will automatically generate a unique boundary string, which is essential for the server to correctly parse the separate parts of the request. Captured logs from tools like Tasker and Postman indicate that the Synology server expects the file field to have a filename and a Content-Type: application/x-bittorrent sub-header within the multipart segment.21Destination and Subfolder ParametersWhen creating a task, the destination parameter allows the client to specify which shared folder on the NAS should receive the downloaded files. In modern versions of the API, the create_list parameter is also required if the user wants to maintain the folder structure of a torrent.7A significant "gotcha" in the create method involves paths with spaces. Some versions of the API may return error code 403 (destination does not exist) if the path contains white space, even if the directory is valid. This often requires the extension to verify the path or ensure proper URL encoding of the destination string.7Task Status Mapping and State Machine LogicThe Synology Download Station API uses a numeric status system to report the progress of a download. Mapping these integers to a standardized set of torrent states is necessary for providing a consistent UI across different backends.9Status Code ReferenceSynology CodeAPI IdentifierCommon Torrent StateFunctional Meaning1downloadingDownloadingActively receiving data from peers.2waitingQueuedIn the queue; waiting for a download slot.3pausedPausedUser-suspended; no network activity.4finishedCompletedDownload complete; no longer seeding.5errorErrorTask failed due to network or disk issues.6seedingSeedingDownload complete; actively uploading data.7hash_checkingCheckingVerifying file integrity on disk.8waiting_on_extractProcessingQueued for automatic extraction.9extractingProcessingUnzipping files via the auto-unzip service.10finishingCompletedFinalizing file movements and closing handles.The "Waiting" state (Code 2) is a frequent source of user confusion. It typically indicates that the NAS has reached its maximum number of active downloads, a limit that defaults to 80 tasks but can be increased by modifying the settings.conf file on the NAS file system.26 A smart browser extension should detect a high number of Code 2 tasks and provide a contextual tip to the user about these limits.26Advanced Telemetry and Logic CalculationThe Download Station API provides raw data that must be processed by the extension to provide a user-friendly interface. Specifically, ETA and progress must be derived from the transfer and detail objects.9Performance MetricsThe transfer object provides size_downloaded and download_speed in bytes per second. To calculate the remaining time (ETA), the following formula is applied:$$ETA = \frac{TotalSize - SizeDownloaded}{DownloadSpeed}$$Progress is calculated as a simple percentage:$$Progress = \left( \frac{SizeDownloaded}{TotalSize} \right) \times 100$$Labeling and Categorization StrategyUnlike more advanced clients like Deluge or ruTorrent, Download Station lacks a native "Label" or "Category" metadata field for individual tasks. Organization is strictly folder-based.29 To implement a labels feature in a browser extension, developers must use a "Virtual Labeling" strategy. This involves mapping labels to specific destination subfolders. When a user chooses a "Movies" label, the extension should automatically set the destination parameter to SharedFolder/Movies. While Synology Drive has recently introduced labels, these are not currently exposed in the Download Station task creation API.30RSS and Automated FilteringThe SYNO.DownloadStation.RSS.Site and SYNO.DownloadStation.RSS.Feed APIs offer a robust way to automate downloads. A browser extension can allow users to add feed URLs and set filters using a specific wildcard syntax (e.g., *720p*) or regular expressions.32MethodDescriptionRSS.Site:listLists all subscribed feeds.RSS.Site:addSubscribes to a new XML/Atom feed.RSS.Feed:listDisplays individual items within a feed for manual selection.RSS.Feed:refreshForces an update of the feed data.Filters in Download Station are "forward-looking," meaning they only apply to new items added after the filter is created. This limitation requires extensions to be careful when reporting the "status" of a filter.33Browser Extension Implementation Challenges (Manifest V3)The transition to Manifest V3 has introduced significant hurdles for NAS-based integrations, particularly concerning the ephemeral nature of service workers and strict security policies.CORS and Network AccessChrome and Firefox extensions must declare host_permissions for the NAS address to bypass Cross-Origin Resource Sharing (CORS) restrictions. If the user is on a local network using IP addresses (e.g., 192.168.1.50), the manifest must explicitly allow these patterns. Furthermore, requests made from a background service worker do not share the same cookie state as a browser tab, which is why using the _sid query parameter is the only reliable way to maintain a session in a background-driven extension.2HTTPS and Self-Signed Certificate ValidationA major "Gotcha" involves self-signed certificates. Many users access their NAS over HTTPS using the default Synology certificate. Modern browsers will reject fetch requests from an extension background script if the certificate is not trusted.35 Because a background script cannot display the "Advanced > Proceed" security warning, the request will simply fail.The developer must implement a diagnostic check for this condition. The recommended fix is to guide the user to export the Synology Root CA from the NAS Control Panel and import it into the operating system's Trusted Root store.37 This satisfies the browser's security model and allows the extension's background script to communicate over HTTPS without intervention.Rate Limiting and Security PoliciesSynology's "Auto Block" and "Account Protection" features are designed to prevent brute-force attacks. If a browser extension has incorrect credentials or an expired sid and continues to poll the API, the user's IP address may be automatically blocked by the NAS firewall.17 Extensions must implement "Backoff Logic," where the polling frequency is reduced or suspended after a series of failed authentication attempts to protect the user's access to their own hardware.Error Handling and Response SchemasA resilient adapter must handle both generic WebAPI errors and module-specific failures. Synology uses a two-tier error system where the success boolean is the primary indicator of a valid request.2Common API Error CodesCodeMeaningContext100Unknown errorGeneric system failure.101Invalid parametersCheck method names and parameter types.102API does not existDiscovery phase failed or package stopped.103Method does not existVersion mismatch for the specific call.104Version not supportedRequested version is higher than maxVersion.105Permission deniedUser lacks privileges for the specific package.106Session timeoutsid has expired; re-login required.119Invalid sessionsid is malformed or already logged out.150IP mismatchSession was created on a different IP address.These codes must be caught by a global error-handling wrapper in the extension to prompt for re-authentication or report specific configuration issues to the user.2TypeScript Implementation for Manifest V3The following TypeScript definitions and implementation patterns provide a production-ready framework for building the Synology adapter. These interfaces cover the standard responses from the Task and Auth modules.6Core Interface DefinitionsTypeScriptexport interface SynologyResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    errors?: Array<{
      code: number;
      path: string;
    }>;
  };
}

export interface Task {
  id: string;
  type: 'bt' | 'http' | 'ftp' | 'nzb' | 'emule';
  username: string;
  title: string;
  size: number;
  status: number; // Refer to Status Mapping Table
  additional?: {
    detail?: {
      destination: string;
      uri: string;
      create_time: number;
      priority: 'low' | 'normal' | 'high';
      total_peers: number;
      connected_peers: number;
    };
    transfer?: {
      download_speed: number;
      upload_speed: number;
      size_downloaded: number;
      size_uploaded: number;
    };
    file?: Array<{
      filename: string;
      size: number;
      size_downloaded: number;
      priority: number;
    }>;
  };
}

export interface TaskList {
  total: number;
  offset: number;
  tasks: Task;
}
Production Implementation LogicThe following class demonstrates how to manage sessions and file uploads within the constraints of a browser extension.TypeScriptclass SynologyClient {
  private sid: string | null = null;
  private baseUrl: string;

  constructor(host: string, port: string = '5001', useHttps: boolean = true) {
    this.baseUrl = `${useHttps? 'https' : 'http'}://${host}:${port}`;
  }

  /**
   * Performs discovery and login. Handles both standard and OTP auth.
   */
  async login(user: string, pass: string, otp?: string): Promise<void> {
    const params = new URLSearchParams({
      api: 'SYNO.API.Auth',
      version: '6',
      method: 'login',
      account: user,
      passwd: pass,
      session: 'DownloadStation',
      format: 'sid',
      enable_syno_token: 'yes'
    });

    if (otp) params.append('otp_code', otp);

    const response = await fetch(`${this.baseUrl}/webapi/entry.cgi?${params}`);
    const result: SynologyResponse<{ sid: string, synotoken: string }> = await response.json();

    if (result.success && result.data) {
      this.sid = result.data.sid;
      // Note: synotoken is often required for subsequent POST requests
    } else {
      throw new Error(`Auth Error: ${result.error?.code}`);
    }
  }

  /**
   * Retrieves the current download queue with full telemetry.
   */
  async listTasks(): Promise<Task> {
    const params = new URLSearchParams({
      api: 'SYNO.DownloadStation.Task',
      version: '1',
      method: 'list',
      additional: 'detail,transfer,file',
      _sid: this.sid!
    });

    const response = await fetch(`${this.baseUrl}/webapi/entry.cgi?${params}`);
    const result: SynologyResponse<TaskList> = await response.json();
    return result.data?.tasks ||;
  }

  /**
   * Adds a torrent via file upload. Critical for private trackers.
   */
  async uploadTorrent(blob: Blob, fileName: string, destination?: string): Promise<boolean> {
    const formData = new FormData();
    formData.append('api', 'SYNO.DownloadStation.Task');
    formData.append('version', '1');
    formData.append('method', 'create');
    formData.append('_sid', this.sid!);
    formData.append('file', blob, fileName);
    
    if (destination) {
      formData.append('destination', destination);
    }

    const response = await fetch(`${this.baseUrl}/webapi/entry.cgi`, {
      method: 'POST',
      body: formData
      // Content-Type is NOT set manually; let browser handle boundary
    });

    const result: SynologyResponse<void> = await response.json();
    return result.success;
  }
}
Strategic Synthesis and Architectural OutlookDeveloping for the Synology Download Station API is an exercise in managing legacy CGI behaviors within modern security paradigms. The architecture's greatest strength—its modularity—is also its greatest implementation challenge, as developers must maintain a discovery layer to ensure compatibility across a decade of hardware versions.1A second-order insight gained from analyzing task status transitions is the "Post-Processing Lag." Codes 8 and 9 (Extraction) reveal that the NAS often continues to consume significant CPU and I/O resources long after a download is marked as 100% complete.25 A high-quality extension must reflect this state to the user, preventing them from attempting to access files that are still being unzipped by the system.Furthermore, the "DID" (Device Token) mechanism represents a significant evolution in third-party app security. By moving away from persistent raw credentials and toward a hardware-linked token, Synology has provided a path for browser extensions to remain secure while offering a convenient user experience. Implementation of this token workflow is not merely optional but a requirement for modern DSM 7.2+ systems where 2FA enforcement is becoming the standard for admin-level users.6Ultimately, the success of a Synology adapter depends on its ability to handle "Silent Failures," particularly those related to HTTPS certificate validation and network isolation in Chromium-based browsers. By combining robust TypeScript structures with a deep understanding of the underlying CGI entry points, developers can build a management tool that offers the reliability and power expected by the Synology user community.
