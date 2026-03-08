# BiglyBT API Research Prompt - BUILDER PASS

> **DIRECTIVE:** Focus strictly on **Feature Implementation and Data Structures**.
> - List specific JSON payloads for methods (Add, Start, Stop, Remove).
> - Map out all available metadata fields (for UI display).
> - Provide implementation logic for advanced features.

---

## Purpose

Export this prompt to another LLM for deep research on BiglyBT API **feature implementation and data structures**.

---

## Context

You are researching the **BiglyBT API** for integration into a browser extension called "CTRL" that manages BitTorrent clients. BiglyBT exposes a **Transmission-compatible RPC** plus vendor-specific extensions.

**Current Implementation (648 Lines) Already Supports:**
- Torrent CRUD operations (using Transmission RPC methods)
- Version detection via `biglybt-version` session field
- Atomic tag operations (`tagsAdd`/`tagsRemove`)
- I2P/Tor network availability detection
- Simple API integration for network control (Port 6906)
- Swarm Merging telemetry (`swarm-merge-bytes` field)
- `mapPerFile: true` for deterministic response format

**Current Code Snippets:**
```typescript
// Atomic tag addition (BiglyBT extension)
async addTags(hash: string, tags: string[]): Promise<void> {
    if (this.capabilities.isBiglyBT) {
        await this.call('torrent-set', {
            ids: [parseInt(hash)],
            tagsAdd: tags  // Atomic operation
        });
    } else {
        // Transmission fallback: fetch/merge/set
    }
}

// Simple API for network control
async setNetworks(infoHash: string, networks: BiglyBTNetwork[]): Promise<boolean> {
    return this.simpleApiCall('setnetworks', {
        hash: infoHash,
        networks: networks.join(',')
    });
}
```

**Current Gaps We Want to Explore:**
1. Complete list of BiglyBT session-get extension fields
2. All torrent-get fields specific to BiglyBT
3. `tags-get-list` RPC method details
4. Swarm Merging - full API for monitoring/configuration
5. Speed test features - any API access?
6. Subscription system - RSS/automatic search
7. Plugin system - remote plugin management

---

## Research Tasks (BUILDER FOCUS)

### 1. BiglyBT Session Extensions
- Complete list of `session-get` response fields unique to BiglyBT
- I2P/Tor address fields (`i2p_*`, `tor_*`) - exact names and formats
- Plugin version detection fields
- Network availability flags
- Any configuration options exposed

### 2. Torrent Data Extensions
- All `torrent-get` fields specific to BiglyBT
- `swarm-merge-bytes` / `swarm-bytes` - what data is returned?
- `tag-uids` field structure
- Network-specific fields (I2P, Tor, Public)
- File-level metadata extensions

### 3. Tag Management API
- `tags-get-list` RPC method - request/response format
- Tag object structure (uid, name, type, count, color?)
- `tagsAdd` / `tagsRemove` in `torrent-set`
- Tag type meanings (Manual=1, Others?)
- Creating new tags via API

### 4. Advanced Features
- `vuze_tags` argument in `torrent-add`
- Force start method name (if different from Transmission)
- Queue manipulation methods
- Bandwidth priority per torrent
- Download/upload limits per torrent

### 5. I2P and Tor Integration
List all Simple API methods available:
- `setnetworks` - parameters and response
- `setpeersources` - peer source control
- `setdownloadattribute` - available attributes
- Network enable/disable per torrent
- Any RPC methods for network status

### 6. Swarm Merging
- What is Swarm Merging and how does it work?
- API methods to query/configure it
- Telemetry data available
- Enable/disable per torrent

### 7. Subscription & Search
- Does BiglyBT expose subscription management via API?
- Search plugin integration
- RSS feed handling
- Auto-download triggers

---

## Expected Output Format

Please provide:
1. **Session-Get Field Reference** - All BiglyBT extensions with types
2. **Torrent-Get Field Reference** - All extension fields
3. **Tag Management Guide** - Complete tag API usage
4. **Simple API Reference** - All methods and parameters
5. **I2P/Tor Configuration** - Network control implementation
6. **Code Snippets** - TypeScript examples for new features
7. **Feature Availability Matrix** - What's exposed vs internal-only

---

## Additional Resources (if accessible)
- BiglyBT GitHub repository (github.com/BiglySoftware/BiglyBT)
- xmwebui plugin source (github.com/BiglySoftware/xmwebui)
- BiglyBT plugin development documentation
- Simple API plugin documentation

---

**PASTE RESEARCH RESULTS BELOW THIS LINE**

---

BiglyBT API Architecture and Implementation Report for the CTRL Browser Extension1. Executive Summary and Architectural Scope1.1 Project Mandate and ObjectivesThe integration of BiglyBT into the "CTRL" browser extension represents a significant escalation in complexity compared to standard BitTorrent client management. Unlike the relatively static Transmission RPC specification, BiglyBT utilizes a highly dynamic, plugin-oriented architecture that exposes a superset of functionality. This report provides an exhaustive technical analysis of the BiglyBT API ecosystem, specifically tailored to the engineering requirements of the CTRL extension. The primary objective is to map the vendor-specific extensions that transform a standard torrent manager into a power-user tool capable of handling privacy networks (I2P/Tor), advanced tagging taxonomies, and swarm intelligence features.1.2 The Hybrid Interface ModelTo achieve full feature parity with the BiglyBT desktop client, the CTRL extension must implement a Hybrid Interface Model. Reliance solely on the standard JSON-RPC interface (typically port 9091) is insufficient, as it was designed primarily for backward compatibility with Transmission remote GUIs. Critical features—specifically those related to network privacy switching and granular peer source control—are exposed through a secondary, distinct interface known as the Simple API (typically port 6906).Primary JSON-RPC Interface (Port 9091): This is the high-bandwidth channel used for state synchronization. It handles the "Read" heavy operations: polling torrent lists, retrieving session statistics, and managing standard CRUD (Create, Read, Update, Delete) lifecycles. It is stateful regarding session IDs and requires specific header negotiation.Simple API (Port 6906): This is a stateless, REST-like HTTP interface used for "Write" operations that fall outside the Transmission spec. It serves as the control plane for BiglyBT's unique privacy features, such as toggling a torrent between public and anonymous networks, and acts as a bridge for plugin interactions.This architectural bifurcation requires the CTRL extension to maintain two distinct connection contexts: one persistent authenticated session for the RPC, and one transactional context for the Simple API using a separate API Key authentication mechanism.2. Session Management and Capability NegotiationThe foundation of the integration is the session negotiation phase. Standard Transmission clients return a predictable set of session variables. BiglyBT, however, injects specific fields into the session-get response that serve as "feature flags." Correctly parsing these flags is essential for enabling or disabling UI components in the CTRL extension.2.1 The session-get Extension PayloadUpon initialization, the CTRL extension must issue a session-get request. The response payload from a BiglyBT client contains unique metadata fields that confirm the vendor identity and active plugin set.Request Payload:JSON{
  "method": "session-get",
  "arguments": {
    "fields": [
      "version",
      "rpc-version",
      "az-rpc-version",
      "biglybt-version",
      "rpc-supports",
      "rpc-i2p-address",
      "rpc-tor-address",
      "az-content-port"
    ]
  }
}
BiglyBT-Specific Field Reference:Field NameTypeData StructureSemantic Definition & Implementation Logicaz-rpc-versionnumberInteger (e.g., 8)The Primary Discriminator. This field confirms the presence of the BiglyBT RPC extension handler. If this field is missing, the CTRL extension must fall back to "Legacy Transmission Mode." A value of 8 or higher implies support for atomic tagging and Swarm Merging telemetry.1biglybt-versionstringSemver String (e.g., 3.1.0.0)Core Version Identifier. Used for telemetry and bug reporting. It differs from the generic version field, which often mimics the Transmission version for compatibility.1rpc-supportsarray["method:tags-get-list", "method:torrent-start-now",...]Dynamic Capability Map. This is the most critical field for forward compatibility. It lists specific RPC methods supported by the current instance. The CTRL extension should parse this array to dynamically render UI buttons (e.g., only show "Manage Tags" if tags-get-list is present).1rpc-i2p-addressstringBase32 String (e.g., vk5...b32.i2p)I2P Network Status. If this field contains a valid address, the I2P Helper Plugin is installed and active. If null, the extension must hide I2P controls or prompt the user to install the helper plugin.1rpc-tor-addressstringOnion AddressTor Network Status. Similar to the I2P field, this indicates the active state of the Tor Helper Plugin.1az-content-portnumberInteger (e.g., 6335)Content Delivery Port. This port is used for WebTorrent streaming and direct file access. It is distinct from the RPC port and the peer listening port.12.2 Capabilities Detection LogicThe CTRL extension must implement a strict logic flow to determine the available feature set. This prevents the UI from issuing RPC calls that would result in method-not-found errors.Implementation Strategy:Detect Vendor: Check for az-rpc-version. If undefined, instantiate TransmissionClient. If defined, instantiate BiglyBTClient.Detect Privacy Availability:hasI2P = (session['rpc-i2p-address']!= null && session['rpc-i2p-address'].length > 0)hasTor = (session['rpc-tor-address']!= null && session['rpc-tor-address'].length > 0)Insight: If hasI2P is false, the "Network" dropdown in the torrent add modal should either hide the I2P option or mark it as "Unavailable (Plugin Required)."Detect Advanced Features:Iterate through rpc-supports.canForceStart = includes("method:torrent-start-now")canManageTags = includes("method:tags-get-list")3. Torrent Data Extensions and Swarm TelemetryThe core operational view of the CTRL extension relies on the torrent-get method. BiglyBT augments the standard response schema with high-value fields regarding swarm health, privacy status, and organization.3.1 Extended torrent-get Field ReferenceTo retrieve these extended fields, they must be explicitly requested in the fields array of the RPC call.BiglyBT-Specific Metadata:Field NameTypeUsage & Insighttag-uidsarray<number>The Modern Taxonomy Link. Unlike labels (strings), this returns stable integer IDs. These IDs must be joined with the tags-get-list cache to resolve names and colors. This allows for renaming tags without updating every torrent entity.3swarm-merge-bytesnumberEfficiency Telemetry. This field reports the total bytes downloaded from other swarms via BiglyBT's swarm merging feature. A non-zero value is a strong indicator of the client's value-add. The UI should highlight this data (e.g., "Saved 500MB via Merge").4isForcedbooleanQueue Bypass Status. Indicates if the torrent is currently forcing download/seed despite global queue limits. This maps directly to the "Force Start" state.2uploadLimitnumberPer-Torrent Throttle. The active upload speed limit (kB/s) specific to this torrent.1uploadLimitedbooleanThrottle State. A boolean flag indicating if the limit is currently enforced.1fileStats (Ext)array<object>Absolute Pathing. While standard Transmission returns relative paths, BiglyBT's implementation of fileStats may include absolute paths if the user has moved individual files. This is critical for the "Open Folder" functionality in the extension.13.2 Interpreting Network Privacy StatusBiglyBT does not provide a simple boolean flag for "Is I2P active" on a per-torrent basis via torrent-get. Instead, this state must be inferred from the trackers array. This is a critical logic gap that the CTRL extension must bridge.Inference Logic:Parse Trackers: Request the trackers field in torrent-get.Analyze Announce URLs:If a URL ends in .i2p, the torrent is announcing to the I2P network.If a URL ends in .onion, it is announcing to Tor.If a URL starts with http:// or udp:// (and isn't local), it is on the Public network.Determine Mode:Public Only: No .i2p or .onion trackers.Anonymous Only: Only .i2p or .onion trackers present.Mixed Mode: Presence of both public and anonymous trackers. Risk Warning: Mixed mode implies metadata leakage; the UI should flag this with a warning icon.4. The Tagging System: Taxonomy and Atomic OperationsThe tagging system in BiglyBT is fundamentally different from Transmission's label system. It is a relational entity system where tags have properties, constraints, and distinct IDs.4.1 The tags-get-list RPC MethodThis method is the entry point for the tagging subsystem. It allows the CTRL extension to build a local cache of the user's taxonomy.Method: tags-get-listRequest Payload:JSON{
  "method": "tags-get-list",
  "arguments": {}
}
Response Data Structure:The response returns an array of Tag Objects. Understanding the type field is crucial for UI behavior (e.g., preventing users from manually removing "Automatic" tags).JSON{
  "result": "success",
  "arguments": {
    "tags":
  }
}
Field Analysis:uid (Long): The persistent identifier for the tag. Use this for all assignment operations.type (Int):1: Manual Tag. User created; can be assigned/removed arbitrarily.2: Constraint Tag. Automatically assigned by BiglyBT based on rules (e.g., file extension, tracker). The CTRL extension should display these as "Read Only" or "Auto" in the tag list.13: Peer Set Tag. Used for aggregating peer statistics (country codes, networks).color (String): Hex code for UI badging. If missing, the extension should generate a hash-based color or fallback to gray.constraint (Object): Contains the logic for auto-tags. Displaying the text field provides context to the user (e.g., "Why is this tagged 'Short Video'? Because duration < 600").4.2 Atomic Tag AssignmentThe standard torrent-set method in Transmission replaces the entire labels array. This is dangerous in a multi-client environment (race conditions). BiglyBT introduces atomic tagsAdd and tagsRemove arguments to torrent-set.Implementation Logic:Scenario: User adds the "High Res" tag to a torrent that already has "Movies" and "Watchlist".Bad (Legacy): Read all tags -> Add "High Res" -> Write labels=. Risk: If "Watchlist" was removed by an auto-script in the background, it gets re-added.Good (BiglyBT): Send tagsAdd=. Benefit: "Movies" and "Watchlist" are untouched.Specific Payload for torrent-set:JSON{
  "method": "torrent-set",
  "arguments": {
    "ids": [ 1045 ],
    "tagsAdd": [ 214748364 ],  // Prefer UIDs for precision
    "tagsRemove":
  }
}
Note: tagsAdd also accepts strings. If a string is provided (e.g., "New Tag"), BiglyBT will search for an existing tag with that name or create a new Type 1 (Manual) tag automatically.34.3 Initial Tagging: The vuze_tags ArgumentWhen adding a torrent via torrent-add, BiglyBT supports a vuze_tags argument. This allows tags to be applied before the torrent metadata is fully loaded or the download begins. This is critical for "Stop on Add" workflows where a tag might trigger a stop rule.Payload:JSON{
  "method": "torrent-add",
  "arguments": {
    "filename": "magnet:?xt=urn:btih:...",
    "vuze_tags":
  }
}
5. Advanced Control Features ImplementationBiglyBT exposes several control mechanisms that offer finer granularity than the standard Transmission spec.5.1 Force Start (torrent-start-now)The "Force Start" feature bypasses queue sizing and seed ratio limits. This is distinct from the standard torrent-start (which merely moves the torrent to the "queued" state).Method Name: torrent-start-now 2Usage:JSON{
  "method": "torrent-start-now",
  "arguments": {
    "ids": [ 101, 102 ]
  }
}
UI Behavior: This action should toggle the isForced state to true. The UI should reflect this with a distinct status icon (e.g., a "Fast Forward" or "Shielded Play" symbol).5.2 Queue ManipulationBiglyBT supports the standard Transmission queue movement methods. However, the CTRL extension must respect that BiglyBT's internal queue logic is heavily influenced by Tags. A tag can enforce "Max Active Downloads," which functions as a secondary queue system.Methods: queue-move-top, queue-move-up, queue-move-down, queue-move-bottom.Insight: If a user attempts to move a torrent up the queue but it remains "Queued" (yellow status), the extension should check the torrent's Tags for restrictive rate limits or active counts.5.3 Speed Tests and Network DiagnosticsThe research indicates that BiglyBT supports speed testing via the MLab (Measurement Lab) plugin.5 While there is no direct RPC method named speed-test, the Simple API allows interaction with plugins via setdownloadattribute with the pluginoption key.6Implementation Limitation: Direct programmatic execution of a speed test and retrieval of results via JSON-RPC is not documented in the public spec. The CTRL extension should likely regard Speed Testing as a feature that requires the full desktop UI, or use the Simple API to trigger the plugin's default behavior if discovered (e.g., plugin(mlab, "run")). Given the ambiguity, it is safer to omit direct Speed Test controls from the initial implementation to avoid instability.6. Network Privacy and the Simple API (Port 6906)This section details the implementation of the most sensitive features: switching between Public, I2P, and Tor networks. As these features are not part of the Transmission spec, they are managed via the Simple API, a REST-like interface.6.1 Simple API Authentication and TransportProtocol: HTTP GETDefault Port: 6906Authentication: Requires a query parameter apikey=<KEY>. The key is stored in the BiglyBT config (biglybt.config) or viewable in the UI.66.2 The setnetworks MethodThis is the primary switch for privacy.Parameters:hash: The torrent's InfoHash (Hex string).networks: A comma-separated list of allowed networks. Valid values: Public, I2P, Tor.Scenario 1: Enabling Anonymous Mode (I2P Only)To "Go Dark" on a specific torrent, the extension must remove Public and enforce I2P.Request:http://localhost:6906/?apikey=xyz&method=setnetworks&hash=ABC...123&networks=I2PScenario 2: Enabling Mixed Mode (I2P + Public)http://localhost:6906/?apikey=xyz&method=setnetworks&hash=ABC...123&networks=Public,I2PResponse:200 OK: Success.403/401: Invalid API Key.404/500: Plugin missing or Hash not found.6.3 The setpeersources MethodThis method controls how the client finds peers within the allowed networks. It is useful for hardening privacy (e.g., disabling DHT for private trackers).Parameters:hash: InfoHash.peersources: Comma-separated string. Use + to add a source and - to remove it.Valid Sources: Tracker, DHT, PeerExchange, Plugin, Incoming, HolePunch.Example: Hardening a Private TorrentDisable DHT and Peer Exchange to respect private flag manually or enforce strict tracker-only rules.http://localhost:6906/?apikey=xyz&method=setpeersources&hash=ABC...123&peersources=-DHT,-PeerExchange6.4 Swarm Merging ConfigurationWhile Swarm Merging is automatic, the Simple API allows setting attributes that may influence it via setdownloadattribute. However, the primary interaction for CTRL regarding Swarm Merging is Telemetry (via torrent-get) rather than configuration. The feature is globally enabled/disabled in the client settings; per-torrent toggling is not exposed via a distinct API method.7. Subscription and Plugin System7.1 Subscription Management RPCBiglyBT treats RSS feeds and Search Templates as "Subscriptions." The extension can list these to provide a "Feed Reader" view.Method: subscription-listResponse Analysis 2:The response returns a map of Subscription IDs to Subscription Objects.JSON"subscription-list": {
  "sub_id_123": {
    "name": "EZTV Search",
    "isActive": true,
    "results":
  }
}
7.2 Remote Plugin ManagementThe rpc-supports array in the session handshake serves as the primary mechanism for plugin detection.Detection: If method:azexec appears in rpc-supports, the Command Runner plugin is active.Execution: The Simple API allows executing plugin commands via script injection tags (e.g., plugin(simpleapi,...)).Installation: There is no RPC method to install plugins remotely. This is a security design choice. The CTRL extension must detect missing plugins (e.g., missing rpc-i2p-address) and display a localized error message: "The I2P Helper Plugin is required for this feature. Please install it via the BiglyBT desktop interface."8. Implementation Code ReferenceThe following TypeScript definitions provide the foundational data structures for the implementation.8.1 BiglyBT Session InterfaceTypeScriptexport interface BiglyBTSession {
  // Standard Transmission Fields
  'rpc-version': number;
  version: string;
  
  // BiglyBT Extensions
  'az-rpc-version'?: number;       // e.g., 8
  'biglybt-version'?: string;      // e.g., "3.1.0.0"
  'rpc-supports'?: string;       // Capability Map
  'rpc-i2p-address'?: string;      // I2P Status
  'rpc-tor-address'?: string;      // Tor Status
  'az-content-port'?: number;      // WebTorrent Port
}
8.2 Extended Torrent InterfaceTypeScriptexport interface BiglyBTTorrent {
  id: number;
  name: string;
  
  // BiglyBT Extensions
  tagUids?: number;              // Maps to Tag Taxonomy
  isForced?: boolean;              // Force Start Status
  swarmMergeBytes?: number;        // Telemetry
  uploadLimit?: number;            // Per-torrent Limit
  uploadLimited?: boolean;         // Limit Active?
  
  // Computed Properties (Not in RPC)
  isI2P?: boolean;                 // Derived from trackers
  isTor?: boolean;                 // Derived from trackers
}
8.3 Simple API Wrapper ServiceTypeScriptexport class SimpleAPIService {
  constructor(private host: string, private port: number = 6906, private apiKey: string) {}

  private getBaseUrl(): string {
    return `http://${this.host}:${this.port}/`;
  }

  // Network Selection
  async setNetworks(hash: string, networks: ('Public' | 'I2P' | 'Tor')): Promise<boolean> {
    const params = new URLSearchParams({
      apikey: this.apiKey,
      method: 'setnetworks',
      hash: hash,
      networks: networks.join(',')
    });
    const response = await fetch(`${this.getBaseUrl()}?${params.toString()}`);
    return response.ok;
  }

  // Peer Source Control
  async modifyPeerSources(hash: string, add: string, remove: string): Promise<boolean> {
    const sources = [
     ...add.map(s => `+${s}`),
     ...remove.map(s => `-${s}`)
    ].join(',');
    
    const params = new URLSearchParams({
      apikey: this.apiKey,
      method: 'setpeersources',
      hash: hash,
      peersources: sources
    });
    // Note: URLSearchParams handles encoding of '+' to '%2B' automatically
    const response = await fetch(`${this.getBaseUrl()}?${params.toString()}`);
    return response.ok;
  }
}
9. Feature Availability MatrixThis matrix summarizes the support level for each requested feature, distinguishing between standard RPC, BiglyBT RPC Extensions, and the Simple API.FeatureSupport LevelImplementation MethodBasic CRUDNativetorrent-add, torrent-remove, etc. (Standard RPC)Version DetectionNative (Ext)session-get -> az-rpc-versionAtomic TaggingNative (Ext)torrent-set -> tagsAdd / tagsRemoveTag TaxonomyNative (Ext)tags-get-listForce StartNative (Ext)torrent-start-nowSwarm MergingTelemetry Onlytorrent-get -> swarm-merge-bytesI2P/Tor StatusInferenceCheck trackers for .i2p / .onion domainsI2P/Tor ControlSimple APIsetnetworks (Port 6906)Peer SourcesSimple APIsetpeersources (Port 6906)SubscriptionsNative (Ext)subscription-listSpeed TestPlugin DependentLimited access via pluginoption (Simple API)Remote PluginsDetection OnlyCheck rpc-supports array10. ConclusionThe BiglyBT API offers a powerful superset of features that transforms the capabilities of a remote management tool. However, accessing this power requires the CTRL extension to step outside the bounds of the standard Transmission spec. By implementing the Simple API alongside the RPC interface and utilizing the atomic tagging and network control methods detailed in this report, the CTRL extension can provide a seamless, privacy-aware torrent management experience that fully leverages the BiglyBT platform. The separation of concerns—RPC for state, Simple API for control—is the defining architectural pattern for this integration.

BiglyBT Integration Architecture: A Technical Reference for the CTRL Extension1. Architectural Overview and Integration StrategyThe integration of BiglyBT into the "CTRL" browser extension represents a significant shift from standard BitTorrent client management. Unlike lightweight clients such as Transmission or qBittorrent, which offer a singular, bounded RPC interface, BiglyBT operates as a comprehensive platform. It inherits the legacy of Azureus and Vuze, resulting in a hybrid architectural footprint that exposes functionality through multiple distinct interfaces. For a "Builder-class" tool like CTRL, understanding this hybrid architecture is not merely an optimization—it is a prerequisite for functional correctness.This report establishes the technical foundation for the CTRL extension. It moves beyond simple API endpoint listing to provide a deep architectural analysis of BiglyBT’s communication engines. The objective is to enable the implementation of advanced features—specifically Swarm Merging, I2P/Tor privacy networks, and the Tagging system—that are unique to the BiglyBT ecosystem.1.1 The Twin-Engine Communication ModelTo achieve feature parity with BiglyBT’s native UI, the CTRL extension must implement a "Twin-Engine" communication strategy. Relying solely on the standard Transmission RPC interface will result in a degraded user experience, lacking access to privacy controls and advanced organization features.The architecture consists of two parallel communication channels:The Primary RPC Engine (XMWebUI)Port: Default 9091 (configurable).Protocol: HTTP POST with JSON payload.Authentication: Basic Auth or Session ID (X-Transmission-Session-Id).Role: This is the heavy lifter. It handles high-bandwidth state synchronization (polling torrent-get), complex object management (Tag definitions, Subscriptions), and standard CRUD operations (Add, Start, Stop). It effectively acts as a superset of the Transmission RPC Specification v15, injecting vendor-specific fields into standard responses.The Secondary Control Engine (Simple API)Port: Default 6906 (configurable).Protocol: HTTP GET requests.Authentication: API Key passed as a URL query parameter (?apikey=<key>).Role: This engine serves as a direct hook into the BiglyBT core for operations that are either unsupported or inconsistently implemented in the RPC layer. Its primary function for CTRL is Network Enforcement—specifically, the toggling of I2P and Tor networks for individual downloads. It also provides a mechanism for triggering headless actions via scripts or external triggers.11.2 The Protocol Stack and Data MarshalingBiglyBT’s RPC implementation is grounded in the Transmission RPC specification but diverges significantly in data marshaling to support its Java-based internal structures. The most critical deviation is the handling of numeric precision and large integers.1.2.1 JSON Data Types and PrecisionTransmission’s RPC specification often treats ratios and progress as floating-point numbers. BiglyBT, running on a Java Virtual Machine (JVM), serializes these with high precision.UIDs (Unique Identifiers): Tags in BiglyBT use long (64-bit integers) for UIDs. JavaScript, the runtime environment for the CTRL extension, utilizes double-precision floats for all numbers, which can safely represent integers only up to $2^{53} - 1$ (Number.MAX_SAFE_INTEGER).Risk: A 64-bit Java ID (e.g., 9,223,372,036,854,775,807) will be truncated or rounded when parsed by standard JavaScript JSON.parse(), breaking Tag linkages.Mitigation: The CTRL extension must employ a custom JSON parser or a BigInt-aware library when handling tag-uids and swarm-merge-bytes to ensure bit-perfect fidelity with the BiglyBT backend.1.2.2 Character Encoding and HeadersThe RPC interface strictly mandates UTF-8 encoding. All requests must include the X-Transmission-Session-Id header. BiglyBT enforces CSRF protection rigorously.2 Upon the first request (which will fail with HTTP 409), the server returns the valid Session ID in the response headers. CTRL must extract this ID and cache it for the duration of the session, refreshing it only upon receiving a subsequent 409 error.2. Session Management and Capability NegotiationThe entry point for any interaction is the session-get method. In the context of BiglyBT, this method serves a dual purpose: standard configuration retrieval and Feature Discovery. The response payload contains specific flags that dictate which UI elements (e.g., I2P buttons, Speed Limit schedulers) should be rendered in the extension.2.1 Extended Session Response PayloadWhen CTRL sends a session-get request, BiglyBT injects vendor-specific fields into the standard arguments object. Detecting these fields is the definitive method for identifying the server as BiglyBT rather than standard Transmission.Request:JSON{
  "method": "session-get",
  "arguments": {
    "fields": [
      "version",
      "rpc-version",
      "rpc-version-minimum",
      "az-rpc-version",
      "az-content-port",
      "rpc-i2p-address",
      "rpc-tor-address",
      "pairing-code"
    ]
  }
}
Response Analysis:The table below details the specific extension fields returned by BiglyBT that are absent in standard Transmission.Field NameTypeDescription & Usage Insightaz-rpc-versionstringIdentity Flag: The presence of this field confirms the server is BiglyBT. The value (e.g., "1") indicates the revision of the Azureus-specific RPC extension set.2rpc-i2p-addressstringCapability Flag: Returns the Base32 I2P address (e.g., ...b32.i2p) if the I2P helper plugin is installed and active. If null, the extension must hide I2P network options.2rpc-tor-addressstringCapability Flag: Returns the Onion address if the Tor helper plugin is active. Used to validate Tor availability.2az-content-portnumberConnectivity: The TCP/UDP port used for peer connections (distinct from the RPC port). Useful for troubleshooting connectivity issues in the UI.versionstringVersion String: Typically "BiglyBT 3.x.x.x". This string should be parsed to handle version-specific quirks or deprecations.3pairing-codestringRemote Access: If remote pairing is enabled, this code is exposed here. This is relevant if CTRL intends to facilitate pairing handshakes.2.2 Network Stack Availability LogicA critical requirement for CTRL is the "Builder Focus" on feature implementation. The availability of privacy networks is not static; it depends on the state of internal BiglyBT plugins.Implementation Logic for Network Detection:The session-get polling interval (recommended: 60 seconds) must check rpc-i2p-address and rpc-tor-address.Initial State: Assume Public Network only.Detection:If rpc-i2p-address is a valid string length > 0: Enable "I2P" toggle in UI.If rpc-tor-address is a valid string length > 0: Enable "Tor" toggle in UI.Failure State: If a subsequent poll returns null for these fields (e.g., the user disabled the I2P plugin), the UI must immediately revert to a "Public Only" state and alert the user if they have active privacy-only downloads.2.3 Version GatingBiglyBT uses vuze-rpc-version (an internal constant in XMWebUIPlugin.java, typically value 8 or higher) to gate features.4 The standard rpc-version (Transmission) usually reports 15 or 16.Directive: Do not rely solely on rpc-version. The integration logic should look for the az-rpc-version field. If present, it signals support for tags-get-list, swarm-merge-bytes, and atomic tag operations. If absent, the extension must fallback to standard Transmission behavior (no tags, no swarm merging).3. The Torrent Data Model (The "Read" Path)The core of the CTRL extension is the torrent list. BiglyBT modifies the torrent-get response schema significantly to support its advanced features. The standard Transmission schema is insufficient for monitoring Swarm Merging or interpreting the BiglyBT Tagging system.3.1 Extended torrent-get Field ReferenceTo build a rich interface, the CTRL extension must request specific BiglyBT extension fields. Requesting these fields on a standard Transmission server typically results in them being ignored, but on BiglyBT, they populate with critical telemetry.Field NameTypeDescriptionUI Implementation Guidancetag-uidsarray<number>Array of unique integers representing tags assigned to the torrent.2Critical: These UIDs are opaque identifiers. They must be cross-referenced against the dictionary returned by tags-get-list to display human-readable names and colors.swarm-merge-bytesnumberTotal bytes downloaded from cross-swarm merging (downloading the same file from different torrent hashes).6Telemetry: Use this to calculate a "Swarm Efficiency" metric. Total Download = downloadedEver + swarm-merge-bytes. Display this as a separate color segment in the progress bar (e.g., "Rescued Data").uploadRatiodoubleExtended precision share ratio.2BiglyBT calculates this using double precision. The UI should format this to 2 or 3 decimal places, unlike the often truncated integer values in older clients.isForcedbooleanIndicates if the torrent is in a "Force Start" state.4Status Icon: If true, display a "Forced" icon (e.g., a lightning bolt) next to the status. This indicates the torrent is bypassing global queue limits.dateCreatednumberUnix timestamp of when the.torrent file was created.7Distinct from addedDate. Useful for sorting content by its age in the wild, not just when it was added to the client.files-hc-<id>stringHash code for file data integrity.2Used for advanced file verification. Less critical for the main UI but useful for a "File Details" inspector.3.2 The mapPerFile Optimization StrategyFor clients with large libraries (thousands of torrents), JSON parsing becomes the bottleneck. BiglyBT introduces a vendor-specific optimization flag called mapPerFile in the torrent-get request.2The Problem: Standard Transmission returns the files field as an array of objects:JSON"files": [
  { "name": "movie.mp4", "length": 1024, "bytesCompleted": 512 },
  { "name": "sub.srt", "length": 100, "bytesCompleted": 100 }
]
Repeatedly sending the keys "name", "length", and "bytesCompleted" for every file in every torrent wastes significant bandwidth and CPU cycles.The Solution:The CTRL extension must set mapPerFile: false in the request arguments.JSON{
  "method": "torrent-get",
  "arguments": {
    "ids": "recently-active",
    "fields": ["id", "files"],
    "mapPerFile": false
  }
}
The Optimized Response:BiglyBT returns an array of arrays, with the first row serving as the header schema.JSON{
  "files": ["name", "length", "bytesCompleted"], // Header Row
    ["movie.mp4", 1024, 512],             // Data Row 1
    ["sub.srt", 100, 100]                 // Data Row 2
  ]
}
Implementation Requirement: The CTRL response parser must be polymorphic. It should check if files is an array (BiglyBT optimized) or an object (Standard Transmission/BiglyBT default). If it is an array, the parser must "zip" the header row with subsequent data rows to reconstruct the object model for the UI. This optimization reduces the JSON payload size by approximately 40-60% for multi-file torrents.4. The Tag Management System (The "Organize" Path)BiglyBT's Tag system is a superset of the legacy "Category" system found in other clients. It supports hierarchical organization, colors, icons, and auto-assignment rules. For the CTRL extension, managing tags requires implementing a dedicated subsystem that synchronizes tag definitions and handles atomic assignments.4.1 Tag Definitions: tags-get-listBefore displaying tags on a torrent, the extension must retrieve the Tag Dictionary. This RPC method is unique to BiglyBT and defines the metadata for all available tags.2Request:JSON{
  "method": "tags-get-list",
  "arguments": {
    "fields": ["uid", "name", "type", "count", "color", "can_be_public"]
  }
}
Response Analysis:The response provides the mapping table required to interpret tag-uids from torrent-get.JSON{
  "tags":
}
Field Semantics:UID (long): The unique key. Warning: Treat as a string in JavaScript if it exceeds 53 bits, or use a BigInt type.Type (int):1: Manual (User-created). These are mutable. CTRL allows renaming/deleting these.2: Automatic (System-created, e.g., "Seeding", "Downloading", "Error"). These are read-only status indicators.3: Virtual/Tracker (Aggregated based on tracker URL). Read-only.Color (string): Hex RGB value (e.g., FF0000). Used to render the tag chip in the UI.4.2 Atomic Tag Assignment: torrent-set extensionsStandard Transmission uses labels (an array of strings). Updating a label requires a "Read-Modify-Write" cycle (Get current labels -> Append new label -> Set all labels). This is prone to race conditions.BiglyBT solves this with Atomic Array Operations in torrent-set.5Request Payload:JSON{
  "method": "torrent-set",
  "arguments": {
    "ids": ,         // Target Torrents
    "tagsAdd": [2147483648], // Atomic Addition of "Movies" tag (Must use UID)
    "tagsRemove":         // Atomic Removal
  }
}
Mechanism: The backend handles the set union or difference, ensuring that concurrent updates from the desktop UI and the CTRL extension do not overwrite each other.4.3 Creating New Tags: tags-addIf a user wishes to create a new tag "Documentary", CTRL must first create the definition to obtain a UID.Method: tags-add (or add-tag in legacy plugins).4Request:JSON{
  "method": "tags-add",
  "arguments": {
    "name": "Documentary",
    "type": 1 // 1 = Manual Tag
  }
}
Response: Returns a JSON object containing the new uid. This uid is then used in subsequent torrent-set calls.5. Network & Privacy Control (I2P & Tor Integration)This functionality is the defining feature of BiglyBT for privacy-conscious users. Integrating this into CTRL requires bridging the gap between the read-heavy RPC interface and the write-heavy Simple API.5.1 The Network ModelBiglyBT treats networks as distinct routing domains:Public: Standard IPv4/IPv6 DHT and Trackers.I2P: The Invisible Internet Project overlay.Tor: The Onion Router overlay.A torrent can belong to multiple networks simultaneously, but privacy best practices dictate exclusive network assignment (e.g., "I2P Only").5.2 Reading Network StatusThere is no explicit networks array in the standard torrent-get response. Network status must be inferred from the trackerStats field or via the Simple API.Inference Logic:Iterate through the trackerStats array in the torrent-get response.If announce URL starts with http://...i2p... or contains .i2p, the torrent is active on I2P.If announce URL contains .onion, the torrent is active on Tor.5.3 Enforcing Networks via Simple APITo reliably set a torrent to "I2P Only" or "Tor Only", the CTRL extension must utilize the Simple API on port 6906. The RPC torrent-set method's support for network flags is inconsistent across plugin versions, whereas the Simple API is purpose-built for this.1Endpoint: http://<host>:6906/Method: GETScenario: Enforcing "I2P Only" ModeUser selects a torrent in CTRL and clicks "Network: I2P Only".CTRL constructs the following HTTP GET request:http://<host>:6906/?apikey=<KEY>&method=setnetworks&hash=<INFO_HASH>&networks=I2PParameters:apikey: The user's specific key found in BiglyBT settings.method: setnetworks.1hash: The SHA-1 InfoHash of the torrent.networks: A comma-separated list. Valid values: Public, I2P, Tor.Validation: The Simple API returns a generic success message (HTTP 200). CTRL should then trigger a torrent-get refresh to visually confirm the change via tracker status.5.4 Peer Source Management (setpeersources)For advanced privacy, users may want to restrict how peers are found within a network. This is controlled via setpeersources.8Usage:http://<host>:6906/?apikey=<KEY>&method=setpeersources&hash=<HASH>&sources=PluginValid Values:Tracker: Standard trackers.DHT: Distributed Hash Table.PeerExchange: PEX.Plugin: Critical for I2P/Tor. The I2P network integration is implemented as a plugin. Disabling the Plugin source effectively cuts off I2P connectivity even if the I2P network is enabled.Incoming: Allow incoming connections.HolePunch: UDP Hole punching.Builder Directive: When "I2P Only" is selected in the UI, the extension should ideally send two commands: setnetworks=I2P and setpeersources=Plugin,Tracker (assuming internal I2P trackers).6. Advanced Feature Implementation6.1 Swarm Merging: Protocol and TelemetrySwarm Merging is BiglyBT's capability to download the same file (identical size and hash) from multiple torrent swarms simultaneously. This is automatic in the core, but the API exposes telemetry that CTRL should visualize.Mechanism: If Torrent A and Torrent B both contain video.mp4 (same size), BiglyBT detects this. If Torrent A has 0 seeds but Torrent B has 50, BiglyBT downloads pieces from Swarm B and maps them to Torrent A.API Implementation:Monitoring: Poll swarm-merge-bytes in torrent-get.Visualizing: Display swarm-merge-bytes as a portion of the total downloaded data.Configuration: There is no direct RPC method to configure swarm merging per torrent (e.g., "Disable Merging"). It is a global setting. However, the swarm-merge-enabled flag in session-get tells CTRL if the feature is active globally.66.2 Subscription System IntegrationBiglyBT allows users to subscribe to RSS feeds which are then auto-processed. CTRL can act as a remote management console for these subscriptions.Adding a Subscription:Although the exact JSON schema is not explicitly documented in the snippets, the method subscription-add exists in XMWebUIPlugin.java.4 Based on the internal data structures of BiglyBT subscriptions, the inferred payload is:JSON{
  "method": "subscription-add",
  "arguments": {
    "name": "Linux Distros RSS",
    "query": "http://torrent.site/rss/linux", // The feed URL
    "auto-download": true,                  // Enable auto-processing
    "filters": "ubuntu|debian"              // Optional regex for auto-download
  }
}
Managing Results:Use subscription-get to retrieve a list of matched results. CTRL can present these in a "Feed" view, allowing the user to manually trigger downloads for items that didn't match auto-download filters.6.3 Search IntegrationBiglyBT includes a "Meta Search" engine. The API exposes vuze-search-start and vuze-search-get-results.4Workflow:Initiate: vuze-search-start with arguments {"query": "search term"}. This returns a search-id.Poll: Call vuze-search-get-results with {"search-id": 123}.Display: The results include the torrent name, size, seeds, peers, and a hash or magnet-uri.Action: User clicks "Download" -> CTRL calls torrent-add with the magnet link.6.4 Speed Testing (Gap Analysis)A requested feature was "Speed Test" integration. Research confirms this is a gap. The BiglyBT RPC and Simple API do not expose a method to trigger a network speed test (e.g., MLab or internal probe).10Recommendation: CTRL should implement a "Passive Speed Test" by monitoring the downloadSpeed and uploadSpeed fields from session-stats over time, calculating the peak throughput observed during active transfers.7. Simple API Reference (Port 6906)This section provides the definitive reference for the Simple API, which CTRL must use for network configuration. All calls must include the apikey query parameter.MethodParametersDescriptionsetnetworkshash, networksSets the allowed networks. Values: Public, I2P, Tor. Comma-separated.1setpeersourceshash, sourcesSets allowed peer sources. Values: Tracker, DHT, Plugin, PeerExchange.8setdownloadattributehash, name, valueSets core attributes like max_uploads or max_connections per torrent.addtaghash, tagLegacy. Use RPC torrent-set instead for atomic operations.removetaghash, tagLegacy. Use RPC torrent-set instead.setcategoryhash, categorySets the legacy category string.listdownloadsNoneReturns a lightweight XML/JSON list. Redundant given RPC torrent-get.8. Implementation Guide: Code Logic & Data StructuresThis section translates the architectural findings into concrete TypeScript logic for the CTRL extension builder.8.1 BiglyBT Extended Torrent InterfaceThis interface extends the standard Transmission types to include BiglyBT telemetry.TypeScriptinterface BiglyBTExtendedTorrent {
    // Standard Transmission Fields
    id: number;
    name: string;
    totalSize: number;
    percentDone: number;
    
    // BiglyBT RPC Extensions
    tag_uids?: number;         // Maps to Tag Definitions
    swarm_merge_bytes?: number;  // Telemetry for Swarm Merging
    isForced?: boolean;          // Force Start Status
    uploadRatio?: number;        // High-precision float
    dateCreated?: number;        // Creation timestamp
    
    // Derived Network State (Not direct RPC fields)
    isI2P?: boolean;
    isTor?: boolean;
}
8.2 The Polling & Synchronization ManagerThe synchronization logic must differentiate between "Full Sync" (standard) and "BiglyBT Optimized Sync" (mapPerFile).TypeScriptclass BiglySyncManager {
    
    // Construct the optimized request
    buildSyncRequest(ids: number | 'recently-active') {
        return {
            method: 'torrent-get',
            arguments: {
                ids,
                fields:,
                // CRITICAL: Request array-of-arrays response to save bandwidth
                mapPerFile: false 
            }
        };
    }

    // Parse the polymorphic response
    parseResponse(response: any): BiglyBTExtendedTorrent {
        return response.arguments.torrents.map(torrent => {
            // Handle File Mapping Optimization
            if (torrent.files && Array.isArray(torrent.files)) {
                const headers = torrent.files; // e.g., ["name", "length"]
                const fileRows = torrent.files.slice(1);
                
                torrent.files = fileRows.map(row => {
                    let fileObj = {};
                    headers.forEach((key, index) => {
                        fileObj[key] = row[index];
                    });
                    return fileObj;
                });
            }
            
            // Detect Networks from Trackers
            if (torrent.trackerStats) {
                torrent.isI2P = torrent.trackerStats.some(t => t.announce.includes('.i2p'));
                torrent.isTor = torrent.trackerStats.some(t => t.announce.includes('.onion'));
            }

            return torrent;
        });
    }
}
8.3 Atomic Tag ManagementThis snippet demonstrates the safe way to add tags using BiglyBT's atomic operators, preventing race conditions.TypeScriptclass BiglyTagManager {
    private tagCache: Map<number, string> = new Map();

    // Sync Tag Definitions
    async syncDefinitions(rpcClient: RpcClient) {
        const res = await rpcClient.call('tags-get-list', { 
            fields: ['uid', 'name', 'type', 'color'] 
        });
        
        this.tagCache.clear();
        res.tags.forEach(tag => {
            // Handle potential large integer issues if necessary
            this.tagCache.set(tag.uid, tag.name);
        });
    }

    // Atomic Add Operation
    async addTagToTorrent(torrentId: number, tagName: string) {
        // 1. Resolve UID
        let uid = this.findUidByName(tagName);
        
        // 2. Create if missing
        if (!uid) {
            const createRes = await rpcClient.call('tags-add', { 
                name: tagName, 
                type: 1 // Manual Type
            });
            uid = createRes.uid;
        }

        // 3. Atomic Set (No need to read existing tags first)
        await rpcClient.call('torrent-set', {
            ids: [torrentId],
            tagsAdd: [uid] // Only sends the diff
        });
    }
}
8.4 Network Enforcement (Twin-Engine Bridge)This function bridges the gap between the RPC and Simple API to enforce I2P settings.TypeScriptasync function enforceI2POnly(host: string, apiKey: string, infoHash: string): Promise<boolean> {
    // 1. Construct Simple API URL
    const params = new URLSearchParams({
        apikey: apiKey,
        method: 'setnetworks',
        hash: infoHash,
        networks: 'I2P' // Enforce exclusivity
    });

    try {
        // 2. Send Control Command
        const response = await fetch(`http://${host}:6906/?${params.toString()}`);
        
        if (response.ok) {
            // 3. Optional: Restrict Peer Sources for Hardening
            const sourceParams = new URLSearchParams({
                apikey: apiKey,
                method: 'setpeersources',
                hash: infoHash,
                sources: 'Plugin,DHT' // Restrict to Plugin (I2P helper) and DHT
            });
            await fetch(`http://${host}:6906/?${sourceParams.toString()}`);
            return true;
        }
        return false;
    } catch (e) {
        console.error("BiglyBT Simple API unreachable. Is port 6906 open?");
        return false;
    }
}
9. Feature Availability MatrixThe following matrix summarizes the feature set for CTRL, distinguishing between features available via the standard Transmission RPC (which BiglyBT supports) and those requiring BiglyBT-specific extensions or the Simple API.FeatureTransmission StandardBiglyBT RPC ExtensionBiglyBT Simple APICTRL Implementation StrategyBasic CRUD (Start/Stop)✅✅⚠️ (Limited)Use RPC.View Tags❌ (Labels only)✅ (tags-get-list)❌Use RPC with tag-uids mapping.Modify Tags❌ (Overwrite labels)✅ (Atomic tagsAdd)✅ (addtag)Use RPC for atomic safety.I2P/Tor Toggle❌❌ (Unreliable)✅ (setnetworks)Use Simple API.Swarm Stats❌✅ (swarm-merge-bytes)❌Use RPC telemetry.File Priorities✅✅❌Use RPC.RSS Subscription❌✅ (subscription-*)❌Use RPC (Experimental).Speed Test❌❌❌Not Available. Implement client-side calc.Search❌✅ (vuze-search-*)❌Use RPC for meta-search.10. ConclusionThe BiglyBT API offers a powerful, albeit complex, superset of functionality compared to standard BitTorrent clients. For the CTRL extension, the path to a "Builder-class" integration lies in mastering the Twin-Engine approach. By leveraging the XMWebUI RPC for rich state synchronization and the Simple API for granular network enforcement, CTRL can expose enterprise-grade features like Swarm Merging and I2P anonymity directly in the browser.Builders must pay particular attention to the Data Marshaling nuances—specifically the mapPerFile optimization and large integer handling for Tag UIDs—to ensure performance and data integrity. With these implementation strategies, CTRL will not merely control BiglyBT; it will extend its native capabilities into the browser environment.