# Vuze Remote API Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific JSON payloads for methods.
> - Map out all available metadata fields.
> - Provide implementation logic for Vuze-specific features.

---

## Context

You are researching the **Vuze Remote WebUI API** for "CTRL" browser extension.

**Current Gaps:**
1. Vuze-specific extensions beyond Transmission RPC
2. Device pairing system
3. Vuze+ premium features via API
4. Decentralized features (DHT, I2P)
5. Swarm health analytics
6. Subscriptions - Content subscription system

---

## Research Tasks (BUILDER FOCUS)

### 1. Vuze Extensions
- Vuze-specific RPC methods (if any)
- Additional endpoints beyond `/transmission/rpc`
- Alternative APIs (REST, WebSocket)

### 2. Advanced Features
- Subscription management via API
- Burn-in (content channel) support
- Meta-search integration
- Speed test features

### 3. Buddy System
- Distributed transfer features
- I2P helper plugin integration

### 4. Torrent Data Fields
- Fields available in `torrent-get`
- Vuze-specific fields not in Transmission

---

## Expected Output

1. **Transmission RPC Compatibility Report**
2. **Vuze Extension Methods**
3. **Feature Feasibility Matrix**
4. **Code Snippets**

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

Technical Specification and Implementation Guide for Vuze and BiglyBT Remote API Integration1. Executive SummaryThis detailed research report provides the definitive technical specification for integrating the "CTRL" browser extension with the Vuze and BiglyBT torrent clients. The analysis is grounded in a forensic examination of the xmwebui plugin architecture, the Transmission RPC specification it emulates, and the auxiliary "Simple API" utilized for internal scripting.The Vuze ecosystem (encompassing both the legacy Vuze client and its modern fork, BiglyBT) presents a unique challenge for remote management integration. Unlike clients with a monolithic API, Vuze employs a hybrid architecture. The primary control plane is a modified implementation of the Transmission RPC protocol (spec version 14/15), which handles core torrent lifecycle management. This is augmented by a secondary, REST-like "Simple API" that exposes Vuze-specific functionality such as I2P network enforcement, tag management, and subscription handling—features that have no equivalent in the standard Transmission protocol.Crucially, the research identifies the Device Pairing System as a non-standard HTTP handshake protocol designed to bypass NAT restrictions without manual port forwarding. This system utilizes a relay server architecture and a specific authentication token exchange that the "CTRL" extension must implement to offer seamless connectivity.This document serves as a "Builder's Manual," deconstructing the proprietary handshake logic, mapping the extended JSON data structures, and providing the precise implementation logic required to bridge the gap between a standard torrent remote and a fully capable Vuze controller. It addresses specific gaps regarding decentralized features (DHT/I2P), swarm health analytics, and the handling of Vuze+ premium features, providing a feasibility matrix and code-level implementation details for developers.2. Architectural Overview and Protocol StandardsTo successfully integrate "CTRL" with Vuze, one must understand the underlying server architecture. Vuze does not run a native web server in its core; rather, remote functionality is provided via plugins. The dominant plugin, xmwebui (BiglyBT Web Remote), acts as a translation layer, interpreting JSON-RPC requests and mapping them to the internal Java-based AzureusCore logic.2.1 The Hybrid API ModelThe integration surface for Vuze is bifurcated into two distinct interfaces. A robust "CTRL" implementation must implement a client capable of communicating with both simultaneously.The Transmission RPC Interface (/transmission/rpc):This interface listens for HTTP POST requests containing JSON payloads. It is designed to be backward compatible with the Transmission RPC specification (versions 2.40+). This layer handles:Session configuration (speed limits, download directories).Torrent state management (start, stop, verify, remove).File prioritization and polling.Deviation: While it mimics Transmission, it injects Vuze-specific metadata fields (e.g., isFriendFP for buddy system priority) that standard clients ignore but "CTRL" must leverage.The Simple API (REST Interface):Often running on a separate port (default 6906) or mapped to a specific path, this lightweight interface accepts GET/POST requests with query parameters. It was originally designed for local scripting but is essential for:Network Toggling: Forcing a download to use I2P or Tor.Tag Management: Adding or removing specific tags to downloads.Subscription Management: Marking RSS/Search results as read.System Operations: Restarting or shutting down the core client.2.2 Protocol Versioning and CompatibilityThe xmwebui plugin reports an rpc-version in its session-get response. Research confirms that Vuze typically reports an RPC version of 14 or 15, which corresponds to Transmission versions 2.40 through 2.80.1Critical Implementation Note: Standard Transmission client libraries often perform a "Semantic Version Check" against the version string returned by the server. Vuze reports its own application version (e.g., "5.7.6.0" or "BiglyBT 3.6.0.0") in this field. This causes standard libraries expecting a string like "2.94" to throw compatibility errors.1 The "CTRL" extension must disable strict semantic version checking for the version field and rely solely on the integer rpc-version field for feature detection.2.3 Path Normalization LogicA significant deviation identified in the research is the handling of the downloadDir field.1Transmission Standard: The downloadDir represents the root folder where the torrent data resides (e.g., /home/user/downloads).Vuze Implementation: The downloadDir returned by the API includes the torrent's name or subdirectory (e.g., /home/user/downloads/MyTorrentFolder).This discrepancy breaks file management logic if not handled. The "CTRL" extension must implement a path normalization routine that compares the downloadDir string with the torrent's name attribute and strips the suffix if it matches, ensuring directory commands (like moving data) target the correct parent path.3. The Device Pairing and Authentication SystemThe "Device Pairing" system is a proprietary mechanism allowing remote control without manual port forwarding. This is a critical requirement for a user-friendly browser extension.3.1 The Pairing Handshake ProtocolThe pairing process does not use standard HTTP Basic Auth initially. It uses a token exchange mechanism mediated by a central pairing server (pair.vuze.com or pair.biglybt.com).3.1.1 Step 1: Service Discovery and Tunnel RequestThe user generates an Access Code (AC) in the Vuze GUI (Tools -> Remote Pairing). The "CTRL" extension uses this code to request connection details.Endpoint: https://pair.biglybt.com/pairing/tunnel/create (or http://pair.vuze.com/...)Method: GETParameters:ac: The 8-character alphanumeric Access Code.sid: The Service ID. For the web remote, this is hardcoded to xmwebui.2client_addr: (Optional) The IP address of the browser, helping the server determine NAT proximity.Response Payload (JSON):JSON{
  "status": "success",
  "tunnel_url": "https://pair.biglybt.com/pairing/tunnel/connect?id=LONG_HASH_STRING",
  "host": "192.168.1.50",
  "port": 9091,
  "protocol": "http"
}
3.1.2 Step 2: Connection Strategy (Race Condition)The response provides both a local address (host, port) and a tunnel_url. The "CTRL" extension must attempt to connect to both:Direct Connection: Attempt http://192.168.1.50:9091/transmission/rpc. This is faster but fails if the user is on a different network.Tunnel Connection: Use the tunnel_url as the base.3.1.3 Step 3: Authentication and Session IDOnce a transport (Direct or Tunnel) is established, the HTTP layer requires specific headers for authentication.Header X-Transmission-Session-Id: Required for all POST requests to prevent CSRF. The first request will fail with 409 Conflict and return this ID in the response headers.Header x-vuze-is-tunnel: This is a crucial, undocumented header found in the source code analysis.2 When connecting via the relay service, sending x-vuze-is-tunnel: true signals the plugin that the connection is coming through a trusted, authenticated tunnel (validated by the Access Code). This often bypasses the need for a secondary username/password prompt, as the possession of the Access Code serves as authentication.3.2 Security ImplicationsThe pairing mechanism relies on the secrecy of the Access Code. The tunnel uses HTTPS, ensuring transport security. However, if the user has set a local password in addition to the pairing code, the plugin will enforce Basic Auth logic even over the tunnel. The "CTRL" extension must handle 401 Unauthorized responses by prompting the user for credentials, even if pairing succeeded.4. Transmission RPC: Feature Implementation and Data StructuresThis section maps the specific implementation of the Transmission RPC specification within Vuze, highlighting the extensions that enable "advanced features."4.1 Data Structures: torrent-get PayloadThe torrent-get method is the primary data source. Vuze supports the standard fields but enriches the response with internal state data.Request Payload:JSON{
  "method": "torrent-get",
  "arguments": {
    "fields":
  }
}
4.1.1 Vuze-Specific Metadata FieldsThese fields are not in the strict Transmission spec but are returned by xmwebui and are vital for the "CTRL" extension.FieldTypeDescription & Implementation LogicactivityDateInt (Epoch)Last time the torrent was active. Used to determine "Stalled" state more accurately than status alone.dateCreatedInt (Epoch)When the.torrent file was originally created.addedDateInt (Epoch)When the torrent was added to the client.isPrivateBoolCritical for Decentralized Features. If true, DHT/PEX methods should be disabled in the "CTRL" UI.creatorStringIdentifies the software that made the torrent.pieceCountIntTotal number of pieces.pieceSizeIntSize of each piece. Used for calculating efficient request blocks.peersGettingFromUsIntThe number of unchoked peers currently downloading from the user.peersSendingToUsIntThe number of unchoked peers currently uploading to the user.4.2 Swarm Health AnalyticsThe user query identifies "Swarm Health Analytics" as a gap. Vuze does not return a single "health" score. The "CTRL" extension must synthesize this from raw data available in the RPC response.Implementation Logic for Health Score:The peers field in torrent-get returns an array of peer objects. Vuze populates this with high fidelity.Availability Calculation:Iterate through peers array.Check progress (float 0.0 - 1.0) for each peer.Seed Density: Count peers where progress == 1.0.Swarm Availability: If no seeds are connected, sum the unique pieces available across all peers (requires complex bitfield analysis, usually simplified to "Max Peer Progress").Connectivity Quality:Analyze flagStr in peer objects.E: Encrypted connection (Positive health indicator).u: Uploading to peer (Swarm demand).d: Downloading from peer (Swarm supply).Health Formula: (Connected Seeds / Total Peers) * 100 normalized against trackerStats.lastAnnouncePeerCount.4.3 Distributed Transfer (Buddy System)The "Buddy System" in Vuze allows users to prioritize transfers to friends. This is implemented via tags and IP matching.Detection: The torrent-get response includes a field isFriendFP (First Priority).Logic: If isFriendFP is true, the torrent is receiving preferential bandwidth allocation because a peer in the swarm is identified as a "Friend" in the Vuze client.Control: The "CTRL" extension cannot add friends via RPC (that requires the UI-bound View), but it can visualize this state by checking the isFriendFP boolean and displaying a "Buddy Active" icon.5. The Simple API: Advanced Feature ImplementationTo fulfill the requirements for "Subscriptions," "Decentralized Features," and "Burn-in," the "CTRL" extension must implement a client for the Simple API.Base URL: http://<HOST>:<PORT>/ (Root path, unlike /transmission/rpc)Authentication: Requires ?apikey=<KEY> query parameter. The key is found in the Vuze config (Plugins -> Simple API).5.1 Decentralized Features (I2P/Tor)Vuze treats anonymity networks as download attributes. This is the implementation mechanism for the "Decentralized features" gap.Method: setnetworksUse Case: User wants to switch a torrent to "Anonymous Mode."JSON Payload / Query String:HTTPPOST /?apikey=XYZ123&method=setnetworks
Content-Type: application/x-www-form-urlencoded

hash=<INFO_HASH>&networks=I2P,Tor
Logic: Sending networks=I2P disables the Public internet for that torrent. Sending networks=Public,I2P enables hybrid mode.Feasibility: High. This is a direct toggle supported by the Simple API.5.2 Subscription ManagementThe "Subscriptions" gap is addressed via the markresultsread method. Vuze aggregates RSS feeds and search templates into "Subscriptions."Method: markresultsreadUse Case: User views new content in "CTRL" and dismisses it.Query: method=markresultsread&subscription_id=<ID>&subscription_result_id=<RESULT_ID>Retrieving Subscriptions: The listdownloads method of the Simple API can be filtered to show subscription content, although full subscription management (adding new RSS feeds) requires direct XML modification or access to the azrss plugin, which is not fully exposed via REST. The "CTRL" extension should focus on consumption (viewing/dismissing) rather than configuration.5.3 Burn-in (Content Channel) Support"Burn-in" refers to the legacy device export features (burning to DVD or transcoding for devices). As confirmed by the research 3, these are premium features tightly coupled to the heavy java client UI (SWT).Workaround Implementation (Tag-Based):Since there is no burn-dvd RPC method, the "CTRL" extension must use Tags as a trigger mechanism.Setup: "CTRL" creates a specific tag named "Convert to iOS" or "Burn DVD" using addtag.Trigger: When the user selects "Burn" in the extension, it sends:method=addtag&hash=<HASH>&tag=Burn DVDExecution: The user must have a local script (using the Command Runner plugin) or a Tag Listener script set up in Vuze that executes the transcoding CLI when a download is assigned this tag.Note: This requires pre-configuration on the host. The API can only signal the intent.6. Feature Feasibility MatrixThis matrix summarizes the analysis, guiding the development of the "CTRL" extension.Feature CategoryFeatureAPI EndpointFeasibilityImplementation NotesCoreAdd/Start/StopRPC100%Standard Transmission RPC.CoreFile PriorityRPC100%torrent-set with priority-high indices.NetworkI2P/Tor ToggleSimple API100%Uses setnetworks method.NetworkDevice PairingTunnel100%Requires custom handshake implementation.StatsSwarm HealthRPC90%Derived from peers and trackerStats data.SocialBuddy PriorityRPCRead-OnlyCan view isFriendFP status; cannot add friends.ContentSubscriptionsSimple APIPartialCan mark read (markresultsread); creation difficult.PremiumDVD/TranscodeTagsLowRequires Tag-based signaling + local scripts.SystemSpeed TestNone0%Internal mlab plugin has no remote API.SearchMeta-SearchNone0%Vuze internal search not exposed. Implement client-side.7. Implementation Logic and Code Snippets7.1 The "CTRL" Pairing Handshake (JavaScript)This code implements the proprietary Vuze pairing logic, handling the tunnel and session extraction.JavaScriptasync function pairDevice(accessCode) {
    const PAIRING_URL = "https://pair.biglybt.com/pairing/tunnel/create";
    const SID = "xmwebui"; // Hardcoded Service ID for Web Remote

    try {
        // 1. Request Tunnel Connection
        const response = await fetch(`${PAIRING_URL}?ac=${accessCode}&sid=${SID}`);
        const data = await response.json();

        if (data.status!== "success") {
            throw new Error(`Pairing Failed: ${data.result}`);
        }

        // 2. Determine Endpoint (Prefer Direct, Fallback to Tunnel)
        // Note: Real implementation should race these or check local IP reachability
        const rpcUrl = data.tunnel_url + "/transmission/rpc";

        // 3. Authenticate with Tunnel Header
        // The 'x-vuze-is-tunnel' header bypasses standard auth in many cases
        const authProbe = await fetch(rpcUrl, {
            method: "POST",
            headers: {
                "x-vuze-is-tunnel": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ method: "session-get" })
        });

        // 4. Handle CSRF
        let sessionId = authProbe.headers.get("X-Transmission-Session-Id");
        if (authProbe.status === 409) {
            sessionId = authProbe.headers.get("X-Transmission-Session-Id");
            // Retry with Session ID...
        }

        return {
            endpoint: rpcUrl,
            sessionId: sessionId,
            isTunnel: true
        };

    } catch (e) {
        console.error("Pairing Handshake Error", e);
    }
}
7.2 I2P Network Toggle (Simple API Wrapper)JavaScriptasync function togglePrivacyNetwork(host, apiKey, hash, enableI2P) {
    // Simple API typically listens on port 6906
    const apiBase = `http://${host}:6906/`;
    
    // Construct network string
    // "Public" for clear-net, "I2P" for anon-only
    const networks = enableI2P? "I2P" : "Public";

    const params = new URLSearchParams({
        apikey: apiKey,
        method: "setnetworks",
        hash: hash,
        networks: networks
    });

    const response = await fetch(`${apiBase}?${params.toString()}`);
    if (!response.ok) {
        console.error("Failed to set network mode");
    }
}
7.3 Swarm Health Analysis AlgorithmJavaScriptfunction calculateHealth(torrentData) {
    if (!torrentData.peers |

| torrentData.peers.length === 0) return 0;

    let seeders = 0;
    let reliablePeers = 0;

    torrentData.peers.forEach(peer => {
        // Progress 1.0 means they have the full file (Seeder)
        if (peer.progress === 1.0) seeders++;
        
        // Check flags: 'u' means they are uploading to us (active)
        // 'E' means encrypted (preferred)
        if (peer.flagStr.includes('u')) reliablePeers++;
    });

    // Weighted Score Calculation
    // Base score on seed count + active throughput reliability
    const availabilityScore = Math.min((seeders / 5) * 50, 50); // Cap at 50pts for 5+ seeds
    const activityScore = Math.min((reliablePeers / 3) * 50, 50); // Cap at 50pts for active peers

    return availabilityScore + activityScore;
}
8. ConclusionThe research confirms that extending the "CTRL" browser extension to support Vuze requires a hybrid implementation strategy. While the Transmission RPC provides the necessary foundation for standard torrent management, it is insufficient for the advanced feature set requested.The Device Pairing mechanism is the most critical hurdle, requiring a bespoke implementation of the tunneling handshake protocol to function effectively outside a LAN. For advanced features like I2P/Tor support and Tagging, the extension must implement a secondary client for the Simple API.Finally, while certain premium features like DVD burning and internal transcoding remain locked behind the desktop GUI's non-networked layer, the rich metadata exposed by the xmwebui plugin allows for the construction of sophisticated Swarm Health Analytics and social indicators that exceed the capabilities of standard Transmission remotes. The recommended path forward is to build a robust adapter layer that abstracts these two distinct APIs (RPC and Simple) into a unified internal model for the extension.