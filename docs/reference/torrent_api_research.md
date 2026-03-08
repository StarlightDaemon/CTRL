# Torrent Client API Implementation Research
## Comprehensive API Specifications for Browser Extension Integration

**Purpose**: Document complete API specifications for 7 major torrent clients to enable integration into TypeScript/React-based browser extension (Manifest V3) with standardized `ITorrentClient` adapter pattern.

**Environment**: Chrome Extension (MV3), Background Service Worker, TypeScript, Fetch API (no axios), React

---

## Table of Contents
1. [Deluge (WebUI)](#deluge-webui)
2. [Flood (Node.js)](#flood-nodejs)
3. [ruTorrent (WebUI)](#rutorrent-webui)
4. [uTorrent (WebUI)](#utorrent-webui)
5. [qBittorrent (WebUI)](#qbittorrent-webui)
6. [BiglyBT (WebUI)](#biglybt-webui)
7. [Vuze (Remote WebUI)](#vuze-remote-webui)
8. [Transmission (RPC)](#transmission-rpc)
9. [Synology DSM (Native)](#synology-dsm-native)
10. [Browser Extension Integration Guide](#browser-extension-integration-guide)

---

## DELUGE (WEBUI)

### 1. Authentication

**Method**: Cookie-based session with `X-Deluge-Cookie` header

**Login Endpoint**: `POST /json`

**Payload Structure**:
```json
{
  "method": "auth.login",
  "params": [
    "username",
    "password"
  ],
  "id": 1
}
```

**Headers Required**:
```
Content-Type: application/json
```

**Response**:
```json
{
  "id": 1,
  "result": true,
  "error": null
}
```

**Session Management**:
- Session cookie automatically set in response headers
- Cookie name: `_deluge_session` (set to `Set-Cookie` header)
- Include cookie in all subsequent requests
- Sessions expire after inactivity (typically 1 hour)
- No refresh mechanism needed; re-authenticate if expired

**CSRF Considerations**:
- No explicit CSRF token required for MV3 extension (fetch from background script handles CORS)
- Cookie-based auth is inherently vulnerable to CSRF in web context, but safe in extension context due to sandboxing

### 2. API Endpoints

#### Get Torrents List
```
POST /json
Content-Type: application/json

{
  "method": "core.get_torrents_status",
  "params": [""],
  "id": 2
}
```

**Response Fields Include**:
- `name`: Torrent name (string)
- `hash`: Torrent hash (string, unique identifier)
- `state`: Status string (e.g., "Downloading", "Seeding", "Paused", "Error")
- `progress`: Progress 0-100 (float)
- `download_payload_rate`: Download speed in bytes/sec (int)
- `upload_payload_rate`: Upload speed in bytes/sec (int)
- `total_size`: Total size in bytes (int)
- `total_done`: Downloaded size in bytes (int)
- `eta`: ETA in seconds (int, -1 if infinite)
- `num_seeds`: Connected seeders (int)
- `num_peers`: Connected peers (int)

#### Add Torrent (Magnet Link)
```
POST /json
Content-Type: application/json

{
  "method": "core.add_torrent_magnet",
  "params": [
    "magnet:?xt=urn:btih:HASH&dn=NAME&tr=TRACKER",
    {}
  ],
  "id": 3
}
```

#### Add Torrent (File Upload)
```
POST /json
Content-Type: multipart/form-data

Boundary: ----WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="torrent.torrent"
Content-Type: application/octet-stream
[binary file content]

{
  "method": "core.add_torrent_file",
  "params": [
    "filename.torrent",
    "base64-encoded-file-content",
    {}
  ],
  "id": 4
}
```

#### Add Torrent (URL)
```
POST /json
Content-Type: application/json

{
  "method": "core.add_torrent_url",
  "params": [
    "https://example.com/torrent.torrent",
    {}
  ],
  "id": 5
}
```

#### Pause Torrent
```
POST /json
Content-Type: application/json

{
  "method": "core.pause_torrent",
  "params": [
    ["hash1", "hash2"]
  ],
  "id": 6
}
```

#### Resume Torrent
```
POST /json
Content-Type: application/json

{
  "method": "core.resume_torrent",
  "params": [
    ["hash1", "hash2"]
  ],
  "id": 7
}
```

#### Remove Torrent
```
POST /json
Content-Type: application/json

{
  "method": "core.remove_torrent",
  "params": [
    ["hash"],
    true  // remove_data: true to delete files
  ],
  "id": 8
}
```

#### Get Categories/Labels
```
POST /json
Content-Type: application/json

{
  "method": "label.get_labels",
  "params": [],
  "id": 9
}
```

#### Set Category/Label
```
POST /json
Content-Type: application/json

{
  "method": "label.set_torrent_label",
  "params": [
    "hash",
    "label_name"
  ],
  "id": 10
}
```

### 3. Data Structures

**Full Sample Response - core.get_torrents_status**:
```json
{
  "id": 2,
  "result": {
    "hash1": {
      "name": "Ubuntu 24.04 LTS",
      "hash": "hash1",
      "state": "Downloading",
      "progress": 45.5,
      "download_payload_rate": 1048576,
      "upload_payload_rate": 524288,
      "total_size": 4294967296,
      "total_done": 1952210731,
      "eta": 3600,
      "num_seeds": 12,
      "num_peers": 45,
      "label": "linux-distros",
      "is_seed": false,
      "is_finished": false,
      "active_time": 1800,
      "seeding_time": 0,
      "completed_time": 0,
      "ratio": 0.15,
      "time_added": 1701432000,
      "last_seen_complete": 0
    },
    "hash2": {
      "name": "Debian 12",
      "hash": "hash2",
      "state": "Seeding",
      "progress": 100.0,
      "download_payload_rate": 0,
      "upload_payload_rate": 2097152,
      "total_size": 3145728000,
      "total_done": 3145728000,
      "eta": 0,
      "num_seeds": 15,
      "num_peers": 8,
      "label": "linux-distros",
      "is_seed": true,
      "is_finished": true,
      "active_time": 86400,
      "seeding_time": 86400,
      "completed_time": 1701518400,
      "ratio": 3.45,
      "time_added": 1700828400,
      "last_seen_complete": 1701604800
    }
  },
  "error": null
}
```

### 4. Quirks & Gotchas

**CORS Issues**:
- Deluge WebUI typically runs on localhost or requires CORS header configuration
- In MV3 extension context, use `fetch` with explicit credentials: `credentials: 'include'`
- Server-side CORS headers needed: `Access-Control-Allow-Credentials: true`

**Version Differences**:
- **Deluge 1.x**: Older API uses different method names (e.g., `get_torrents_status` called differently)
- **Deluge 2.x+**: Modern JSON-RPC 2.0 API, stable endpoint `/json`
- **Breaking Changes**: Method signatures changed between versions; test compatibility

**Performance Notes**:
- `core.get_torrents_status` with empty filter returns ALL torrents
- Large torrent libraries (1000+) may cause slow responses
- No built-in delta/update mechanism; full resync required per request
- Consider pagination or filtering by label for performance

**Session Timeout**:
- Default session timeout: 1 hour of inactivity
- No refresh token; must re-authenticate after expiration
- Check response for 403 status or `error.code` to detect expired sessions

### 5. TypeScript Interfaces

```typescript
// Deluge Torrent Status Response
interface DelugeTorrentStatus {
  name: string;
  hash: string;
  state: 'Downloading' | 'Seeding' | 'Paused' | 'Error' | 'Checking' | 'Allocating' | 'Connecting' | 'Moving' | 'Queue' | 'Unknown';
  progress: number; // 0-100
  download_payload_rate: number; // bytes/sec
  upload_payload_rate: number; // bytes/sec
  total_size: number; // bytes
  total_done: number; // bytes
  eta: number; // seconds, -1 if infinite
  num_seeds: number;
  num_peers: number;
  label?: string;
  is_seed: boolean;
  is_finished: boolean;
  active_time: number; // seconds
  seeding_time: number; // seconds
  completed_time: number; // unix timestamp
  ratio: number;
  time_added: number; // unix timestamp
  last_seen_complete: number; // unix timestamp
}

interface DelugeRPCRequest {
  method: string;
  params: unknown[];
  id: number;
}

interface DelugeRPCResponse<T> {
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  } | null;
}

interface DelugeLoginResponse {
  id: number;
  result: boolean;
  error: null | {
    code: number;
    message: string;
  };
}
```

---

## FLOOD (NODE.JS)

### 1. Authentication

**Method**: Username/password login with JSON Web Token (JWT) Bearer token

**Login Endpoint**: `POST /api/auth/authenticate`

**Payload Structure**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Headers Required**:
```
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Session Management**:
- Token is JWT-based; store in memory (not localStorage due to MV3 limitations)
- Include token in `Authorization: Bearer <token>` header for all requests
- Tokens don't expire automatically unless configured server-side
- No refresh mechanism; re-authenticate if server rejects token

**CORS Considerations**:
- Flood typically runs on port 3000
- Must configure CORS headers server-side if running on different origin
- MV3 extension can bypass CORS restrictions in background context

### 2. API Endpoints

#### Get Torrents List
```
GET /api/torrents
Authorization: Bearer <token>
```

**Response**:
```json
{
  "torrents": [
    {
      "hash": "abcd1234",
      "name": "Ubuntu 24.04 LTS",
      "state": ["downloading"],
      "progress": 0.45,
      "upRate": 1048576,
      "dnRate": 2097152,
      "sizeBytes": 4294967296,
      "bytesDone": 1932735283,
      "eta": 3600,
      "peers": 45,
      "seeds": 12,
      "ratio": 0.15,
      "label": "linux",
      "isPrivate": false,
      "isInitialSeeding": false,
      "bytesMissing": 2362232013,
      "downloadTotal": 4294967296,
      "uploadTotal": 645922816,
      "connectedPeers": 45,
      "connectedSeeds": 12
    }
  ]
}
```

#### Add Torrent (Magnet Link)
```
POST /api/torrents/add
Authorization: Bearer <token>
Content-Type: application/json

{
  "urls": [
    "magnet:?xt=urn:btih:HASH&dn=NAME&tr=TRACKER"
  ]
}
```

#### Add Torrent (File Upload)
```
POST /api/torrents/add
Authorization: Bearer <token>
Content-Type: multipart/form-data

[Binary multipart with file]
```

#### Pause Torrents
```
PATCH /api/torrents/stop
Authorization: Bearer <token>
Content-Type: application/json

{
  "hashes": ["hash1", "hash2"]
}
```

#### Resume Torrents
```
PATCH /api/torrents/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "hashes": ["hash1", "hash2"]
}
```

#### Remove Torrents
```
DELETE /api/torrents
Authorization: Bearer <token>
Content-Type: application/json

{
  "hashes": ["hash1"],
  "deleteFiles": true
}
```

#### Get Labels/Tags
```
GET /api/torrent-tags
Authorization: Bearer <token>
```

#### Set Label/Tag
```
PATCH /api/torrents
Authorization: Bearer <token>
Content-Type: application/json

{
  "hashes": ["hash"],
  "tags": ["label1", "label2"]
}
```

### 3. Data Structures

**Flood Torrent Object**:
```typescript
interface FloodTorrent {
  hash: string;
  name: string;
  state: string[]; // ["downloading"], ["seeding"], ["paused"], etc.
  progress: number; // 0-1
  upRate: number; // bytes/sec
  dnRate: number; // bytes/sec
  sizeBytes: number;
  bytesDone: number;
  eta: number; // seconds
  peers: number;
  seeds: number;
  ratio: number;
  label?: string;
  isPrivate: boolean;
  isInitialSeeding: boolean;
  bytesMissing: number;
  downloadTotal: number;
  uploadTotal: number;
  connectedPeers: number;
  connectedSeeds: number;
}

interface FloodResponseTorrents {
  torrents: FloodTorrent[];
  transferSummary: {
    upRate: number;
    dnRate: number;
    ratioAverage: number;
  };
}
```

### 4. Quirks & Gotchas

**Performance**:
- Flood is an excellent aggregator; no delta updates available
- Full torrent list resync required per request
- Consider polling interval of 5-10 seconds for UI updates

**Version Compatibility**:
- Flood 4.x+ is current stable version
- Earlier versions may have different API structure
- Check `/api/client/version` endpoint for version info

**Connected Clients**:
- Flood supports multiple upstream torrent clients (rTorrent, qBittorrent, Transmission, Deluge)
- Must configure which client to connect to at Flood startup
- API abstracts underlying client differences

**CORS & Cross-Origin**:
- Flood requires explicit configuration for cross-origin requests
- Can be secured with reverse proxy (nginx/Apache)

### 5. TypeScript Interfaces

```typescript
interface FloodAuthRequest {
  username: string;
  password: string;
}

interface FloodAuthResponse {
  success: boolean;
  token: string;
}

interface FloodTorrent {
  hash: string;
  name: string;
  state: string[];
  progress: number; // 0-1
  upRate: number;
  dnRate: number;
  sizeBytes: number;
  bytesDone: number;
  eta: number;
  peers: number;
  seeds: number;
  ratio: number;
  label?: string;
  isPrivate: boolean;
  isInitialSeeding: boolean;
  bytesMissing: number;
  downloadTotal: number;
  uploadTotal: number;
  connectedPeers: number;
  connectedSeeds: number;
}

interface FloodTorrentsResponse {
  torrents: FloodTorrent[];
  transferSummary: {
    upRate: number;
    dnRate: number;
    ratioAverage: number;
  };
}
```

---

## RUTORRENT (WEBUI)

### 1. Authentication

**Method**: HTTP Basic Authentication (mod_auth_basic)

**Authentication**:
- Server-side Apache module `mod_auth_basic` handles authentication
- Credentials passed via `Authorization: Basic base64(username:password)` header
- No login endpoint; auth header sent with every request

**Headers Required**:
```
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

**Multi-User Support**:
- Each user has separate download directory
- User identified via HTTP Basic credentials
- Username extracted from `$_SERVER['REMOTE_USER']` in PHP backend

### 2. API Endpoints

#### Get Torrents List
```
GET /php/getdir.php?dir=...
Authorization: Basic <credentials>

Response: XML (not JSON!)
```

**ruTorrent uses XML-RPC protocol via rTorrent**, not a traditional REST API. Direct HTTP API calls are limited.

#### Alternative: Use XML-RPC Protocol
```
POST /RPC2
Authorization: Basic <credentials>
Content-Type: text/xml

<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>d.multicall2</methodName>
  <params>
    <param><value>default</value></param>
    <param><value>d.hash=</value></param>
    <param><value>d.name=</value></param>
    <param><value>d.state=</value></param>
    <param><value>d.down.rate=</value></param>
    <param><value>d.up.rate=</value></param>
    <param><value>d.size_bytes=</value></param>
    <param><value>d.bytes_done=</value></param>
    <param><value>d.eta=</value></param>
  </params>
</methodCall>
```

#### Add Torrent (URL/Magnet)
```
GET /plugins/action/add?url=<magnet-or-url>
Authorization: Basic <credentials>

Returns: XML response with status
```

#### Pause Torrent
```
GET /plugins/action/start?hash=<hash>&action=pause
Authorization: Basic <credentials>
```

#### Resume Torrent
```
GET /plugins/action/start?hash=<hash>&action=start
Authorization: Basic <credentials>
```

#### Remove Torrent
```
GET /plugins/action/remove?hash=<hash>&action=remove-with-files
Authorization: Basic <credentials>
```

### 3. Data Structures

**XML-RPC Response Format**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<methodResponse>
  <params>
    <param><value>
      <array>
        <data>
          <value>
            <array>
              <data>
                <value>hash1value</value>
                <value>Torrent Name</value>
                <value>0</value> <!-- state -->
                <value>1048576</value> <!-- down rate -->
                <value>524288</value> <!-- up rate -->
                <value>4294967296</value> <!-- size -->
                <value>1932735283</value> <!-- bytes done -->
                <value>3600</value> <!-- eta -->
              </data>
            </array>
          </value>
        </data>
      </array>
    </value></param>
  </params>
</methodResponse>
```

### 4. Quirks & Gotchas

**XML-RPC Protocol**:
- ruTorrent is a PHP frontend to **rTorrent** (not native REST API)
- Communication with rTorrent is via XML-RPC over SCGI socket
- Direct HTTP API is limited; most operations via action plugins

**Authentication**:
- HTTP Basic Auth credentials sent on every request (no session tokens)
- Credentials must be URL-encoded or Base64-encoded in header
- No CSRF protection; relies on HTTP Basic Auth security

**Performance**:
- XML-RPC calls can be slow with many torrents
- Consider batching operations where possible
- No delta/incremental updates

**Browser Extension Compatibility**:
- Basic Auth works in MV3 but requires explicit header handling
- Some installations may use digest authentication; requires more complex handling

### 5. TypeScript Interfaces

```typescript
interface RuTorrentTorrent {
  hash: string;
  name: string;
  state: 0 | 1; // 0 = stopped, 1 = running
  downRate: number; // bytes/sec
  upRate: number; // bytes/sec
  sizeBytes: number;
  bytesDone: number;
  eta: number; // seconds
  ratio: number;
  seeders: number;
  leechers: number;
}

interface RuTorrentXMLRPCRequest {
  methodName: string;
  params: unknown[];
}

interface RuTorrentXMLRPCResponse {
  methodResponse: {
    params: {
      param: {
        value: unknown;
      };
    };
  };
}
```

---

## UTORRENT (WEBUI)

### 1. Authentication

**Method**: Token-based CSRF protection with Basic Authentication

**Token Endpoint**: `GET /gui/token.html`

**Initial Request**:
```
GET /gui/token.html
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

**Response** (HTML page with embedded token):
```html
<html><body><div id='token' style='display:none;'>YOUR_TOKEN_HERE</div></body></html>
```

**Token Usage**:
- Extract token from response HTML
- Append to all API URLs as query parameter: `?token=<token>`
- Include `Authorization: Basic` header on every request
- Token is long-lived; refresh only if API returns error

**Headers Required**:
```
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
Cookie: [optional session cookie]
```

### 2. API Endpoints

#### Get Torrents List
```
GET /gui/?list=1&token=<token>
Authorization: Basic <credentials>
```

**Response Format** (JSON):
```json
{
  "build": 45201,
  "rss": [1, 0, 0],
  "label": ["All", "Downloading", "Completed"],
  "torrent": [
    ["hash", "name", "size", "progress", "downloaded", "uploaded", 
     "ratio", "upspeed", "downspeed", "eta", "label", "peers", "seeds",
     "status", "remaining"]
  ],
  "cid": "12345"
}
```

#### Add Torrent (Magnet)
```
POST /gui/?action=add-url&s=<magnet-url>&token=<token>
Authorization: Basic <credentials>
```

#### Add Torrent (File)
```
POST /gui/?action=add-file&token=<token>
Authorization: Basic <credentials>
Content-Type: multipart/form-data

[Binary multipart file upload]
```

#### Start/Stop Torrents
```
GET /gui/?action=start&hash=<hash1>,<hash2>&token=<token>
GET /gui/?action=stop&hash=<hash1>,<hash2>&token=<token>
Authorization: Basic <credentials>
```

#### Remove Torrent
```
GET /gui/?action=remove&hash=<hash>&token=<token>
Authorization: Basic <credentials>
```

### 3. Data Structures

**uTorrent Torrent Array Format**:
```typescript
// Array indices correspond to fields in response:
// [0] hash
// [1] name
// [2] size (bytes)
// [3] progress (0-1000, divide by 10 for percentage)
// [4] downloaded (bytes)
// [5] uploaded (bytes)
// [6] ratio (0-1000, divide by 10)
// [7] upspeed (bytes/sec)
// [8] downspeed (bytes/sec)
// [9] eta (seconds)
// [10] label
// [11] peers (connected)
// [12] seeds (connected)
// [13] status (bitmask)
// [14] remaining (bytes)

type UTorrentTorrentArray = [
  string,    // 0: hash
  string,    // 1: name
  number,    // 2: size
  number,    // 3: progress
  number,    // 4: downloaded
  number,    // 5: uploaded
  number,    // 6: ratio
  number,    // 7: upspeed
  number,    // 8: downspeed
  number,    // 9: eta
  string,    // 10: label
  number,    // 11: peers
  number,    // 12: seeds
  number,    // 13: status
  number     // 14: remaining
];

interface UTorrentListResponse {
  build: number;
  rss: number[];
  label: string[];
  torrent: (string | UTorrentTorrentArray)[][];
  cid: string;
}
```

### 4. Quirks & Gotchas

**Token System**:
- Token is **REQUIRED** for all API calls; enables CSRF protection
- Token obtained via `/gui/token.html` endpoint
- Token is long-lived (session-based)
- Token must be extracted from HTML, not JSON (legacy design)

**Legacy Protocol**:
- uTorrent WebUI API is aging; based on early 2010s standards
- Response format is unconventional (hybrid JSON/array structure)
- Field indices in torrent arrays must match exact order

**Status Bitmask**:
- Status field is a bitmask:
  - Bit 0: Started
  - Bit 1: Checking
  - Bit 2: Start after check
  - Bit 3: Checked
  - Bit 4: Error
  - Bit 5: Paused
  - Bit 6: Queued
  - Bit 7: Allocating

**Browser Extension Considerations**:
- Basic Auth works in MV3 but requires explicit handling
- Token extraction from HTML fragile; regex parsing required
- Consider retry logic if token parsing fails

### 5. TypeScript Interfaces

```typescript
type UTorrentTorrentArray = [
  string, string, number, number, number, number, 
  number, number, number, number, string, number, 
  number, number, number
];

interface UTorrentListResponse {
  build: number;
  rss: number[];
  label: string[];
  torrent: (string | UTorrentTorrentArray)[][];
  cid: string;
}

interface UTorrentTokenResponse {
  token: string; // Extracted from HTML <div id='token'>
}

interface UTorrentTorrentParsed {
  hash: string;
  name: string;
  size: number;
  progress: number; // 0-100
  downloaded: number;
  uploaded: number;
  ratio: number;
  upspeed: number;
  downspeed: number;
  eta: number;
  label: string;
  peers: number;
  seeds: number;
  status: number; // Bitmask
  remaining: number;
}
```

---

## QBITTORRENT (WEBUI)

### 1. Authentication

**Method**: Cookie-based session with optional token authentication

**Login Endpoint**: `POST /api/v2/auth/login`

**Payload Structure**:
```json
{
  "username": "admin",
  "password": "adminpassword"
}
```

**Headers Required**:
```
Content-Type: application/x-www-form-urlencoded
```

**Alternative Form Data**:
```
username=admin&password=adminpassword
```

**Response**:
```
HTTP 200 OK
Set-Cookie: SID=<session_id>; Path=/; HttpOnly
```

**Session Management**:
- Session ID automatically set in cookie
- Include cookie in all subsequent requests
- Sessions expire after inactivity (default 3600 seconds)
- No explicit logout necessary; session expires automatically
- Can enable token auth in settings for API-only access

**CSRF Considerations**:
- qBittorrent uses SameSite cookies for CSRF protection
- No explicit CSRF token needed in modern versions
- Safe in MV3 extension context due to fetch credential handling

### 2. API Endpoints

#### Get Torrents List
```
GET /api/v2/torrents/info
Authorization: Bearer <token> (if token auth enabled)

Query Parameters:
- filter: string (all, downloading, completed, paused, active, seeding, stalled, etc.)
- sort: string (name, size, progress, state, etc.)
- reverse: boolean
- limit: number
- offset: number
```

**Response** (JSON array):
```json
[
  {
    "hash": "abc123def456",
    "name": "Ubuntu 24.04 LTS",
    "size": 4294967296,
    "progress": 0.45,
    "dl_speed": 2097152,
    "up_speed": 1048576,
    "priority": 1,
    "num_complete": 150,
    "num_incomplete": 45,
    "num_leechs": 30,
    "num_seeds": 120,
    "num_total": 150,
    "ratio": 0.15,
    "state": "downloading",
    "eta": 3600,
    "seq_dl": false,
    "f_l_piece_prio": false,
    "category": "linux",
    "tags": ["ubuntu", "distro"],
    "super_seeding": false,
    "force_start": false,
    "save_path": "/home/user/Downloads",
    "added_on": 1701432000,
    "completion_on": 0,
    "last_seen": 1701518400,
    "downloading_time": 1800,
    "seeding_time": 0,
    "seen_complete": false,
    "total_wasted": 0,
    "max_ratio": -1,
    "max_seeding_time": -1,
    "last_upload": 1701518400,
    "last_download": 1701432000,
    "amount_left": 2362232013,
    "completed": 1932735283,
    "trackers_count": 3,
    "peers": 45,
    "seeds": 12,
    "availability": 1.0
  }
]
```

#### Add Torrent (Magnet/URL)
```
POST /api/v2/torrents/add
Content-Type: multipart/form-data

Form Fields:
- urls: string (newline-separated URLs/magnets)
- savepath: string (optional)
- category: string (optional)
- paused: boolean (optional)
- skip_checking: boolean (optional)
```

#### Add Torrent (File)
```
POST /api/v2/torrents/add
Content-Type: multipart/form-data

Form Fields:
- torrents: file (binary .torrent file)
- savepath: string (optional)
- category: string (optional)
- paused: boolean (optional)
- skip_checking: boolean (optional)
```

#### Pause Torrents
```
GET /api/v2/torrents/pause?hashes=hash1|hash2
or
POST /api/v2/torrents/pause
Content-Type: application/x-www-form-urlencoded

hashes=hash1|hash2
```

#### Resume Torrents
```
GET /api/v2/torrents/resume?hashes=hash1|hash2
```

#### Remove Torrent
```
GET /api/v2/torrents/delete?hashes=hash1&deleteFiles=true
```

#### Get Categories
```
GET /api/v2/torrents/categories
```

**Response**:
```json
{
  "category_name": {
    "name": "category_name",
    "savePath": "/path/to/save"
  }
}
```

#### Set Category
```
GET /api/v2/torrents/setCategory?hashes=hash1&category=category_name
```

#### Get Tags
```
GET /api/v2/torrents/tags
```

**Response**:
```json
["tag1", "tag2", "tag3"]
```

#### Add/Remove Tags
```
GET /api/v2/torrents/addTags?hashes=hash1&tags=tag1,tag2
GET /api/v2/torrents/removeTags?hashes=hash1&tags=tag1
```

### 3. Data Structures

**qBittorrent Torrent Info Object**:
```typescript
interface QBittorrentTorrent {
  hash: string;
  name: string;
  size: number; // bytes
  progress: number; // 0-1
  dl_speed: number; // bytes/sec
  up_speed: number; // bytes/sec
  priority: number;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  num_total: number;
  ratio: number;
  state: 'error' | 'missingFiles' | 'uploading' | 'paused' | 'queuedForChecking' | 
         'checkingResumeData' | 'forcedUL' | 'allocating' | 'metadataDL' | 'forcedDL' | 
         'downloading' | 'queuedForDownload' | 'stalledUL' | 'stalledDL' | 'checkingUL' | 'unknown';
  eta: number; // seconds
  seq_dl: boolean;
  f_l_piece_prio: boolean;
  category: string;
  tags: string[];
  super_seeding: boolean;
  force_start: boolean;
  save_path: string;
  added_on: number; // unix timestamp
  completion_on: number; // unix timestamp, 0 if not completed
  last_seen: number; // unix timestamp
  downloading_time: number; // seconds
  seeding_time: number; // seconds
  seen_complete: boolean;
  total_wasted: number; // bytes
  max_ratio: number; // -1 if unlimited
  max_seeding_time: number; // -1 if unlimited, seconds
  last_upload: number; // unix timestamp
  last_download: number; // unix timestamp
  amount_left: number; // bytes
  completed: number; // bytes
  trackers_count: number;
  peers: number;
  seeds: number;
  availability: number; // 0-1
}

interface QBittorrentLoginRequest {
  username: string;
  password: string;
}

interface QBittorrentAddTorrentRequest {
  urls?: string; // newline-separated
  torrents?: Blob; // binary file
  savepath?: string;
  category?: string;
  paused?: boolean;
  skip_checking?: boolean;
  root_folder?: boolean;
}
```

### 4. Quirks & Gotchas

**API Versions**:
- **v2.0+** (qBittorrent 4.1+): Current stable API
- **v2.8.3** (qBittorrent 4.4+): Latest stable API version
- Consistent endpoint patterns since v2.0

**Performance Optimization**:
- Use `filter` parameter to reduce data transfer
- Supports `limit` and `offset` for pagination
- Consider polling interval of 5-10 seconds for UI updates
- API is efficient with large torrent counts (tested with 1000+)

**Hash Format**:
- Hashes are base32-encoded SHA-1
- Multiple hashes separated by `|` pipe character in query params
- All operations support batch hashing

**Error Handling**:
- HTTP 200 with empty response means operation succeeded
- HTTP 400 indicates invalid parameters
- HTTP 403 indicates not authenticated
- HTTP 409 means conflict (e.g., duplicate torrent)

**Browser Extension Compatibility**:
- Excellent MV3 support via fetch API
- Session cookie automatically managed by browser
- No special CORS handling needed if running locally

### 5. TypeScript Interfaces

```typescript
interface QBittorrentTorrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  dl_speed: number;
  up_speed: number;
  priority: number;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  num_total: number;
  ratio: number;
  state: string;
  eta: number;
  seq_dl: boolean;
  f_l_piece_prio: boolean;
  category: string;
  tags: string[];
  super_seeding: boolean;
  force_start: boolean;
  save_path: string;
  added_on: number;
  completion_on: number;
  last_seen: number;
  downloading_time: number;
  seeding_time: number;
  seen_complete: boolean;
  total_wasted: number;
  max_ratio: number;
  max_seeding_time: number;
  last_upload: number;
  last_download: number;
  amount_left: number;
  completed: number;
  trackers_count: number;
  peers: number;
  seeds: number;
  availability: number;
}

interface QBittorrentLoginRequest {
  username: string;
  password: string;
}

interface QBittorrentAddTorrentResponse {
  status: 'success' | 'error';
  message?: string;
}
```

---

## BIGLYBT (WEBUI)

### 1. Authentication

**Method**: JSON-RPC 2.0 with Session Token

**Login Endpoint**: `POST /api/xmwebui/session.json`

**Payload Structure**:
```json
{
  "jsonrpc": "2.0",
  "method": "Session.login",
  "params": ["username", "password"],
  "id": 1
}
```

**Headers Required**:
```
Content-Type: application/json
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "sessionId": "12345abcde",
    "username": "admin"
  },
  "id": 1
}
```

**Session Management**:
- Session ID valid for duration of connection
- Include session ID in all subsequent requests as query param
- No explicit logout; session expires when client disconnects
- Session timeout configurable on server

### 2. API Endpoints

#### Get Torrents List
```
POST /api/xmwebui/torrents.json?sessionId=<sessionId>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "Torrent.list",
  "params": [],
  "id": 2
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "torrents": [
      {
        "id": "hash1",
        "name": "Ubuntu 24.04 LTS",
        "size": 4294967296,
        "seeders": 120,
        "leechers": 45,
        "seeds": 12,
        "peers": 45,
        "bytesReceived": 1932735283,
        "bytesSent": 289910784,
        "state": "downloading",
        "percentDone": 45,
        "eta": 3600,
        "uploadSpeed": 1048576,
        "downloadSpeed": 2097152,
        "ratio": 0.15,
        "category": "linux",
        "tags": ["ubuntu", "distro"],
        "added": 1701432000,
        "completed": 0
      }
    ]
  },
  "id": 2
}
```

#### Add Torrent
```
POST /api/xmwebui/torrents.json?sessionId=<sessionId>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "Torrent.add",
  "params": [
    "magnet:?xt=urn:btih:HASH&dn=NAME&tr=TRACKER"
  ],
  "id": 3
}
```

#### Pause/Resume Torrents
```
POST /api/xmwebui/torrents.json?sessionId=<sessionId>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "Torrent.pause",
  "params": [["hash1", "hash2"]],
  "id": 4
}

{
  "jsonrpc": "2.0",
  "method": "Torrent.resume",
  "params": [["hash1", "hash2"]],
  "id": 5
}
```

#### Remove Torrent
```
POST /api/xmwebui/torrents.json?sessionId=<sessionId>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "Torrent.remove",
  "params": [
    ["hash"],
    true  // removeData
  ],
  "id": 6
}
```

### 3. Data Structures

**BiglyBT Torrent Object**:
```typescript
interface BiglyBTTorrent {
  id: string; // hash
  name: string;
  size: number; // bytes
  seeders: number;
  leechers: number;
  seeds: number;
  peers: number;
  bytesReceived: number;
  bytesSent: number;
  state: 'downloading' | 'seeding' | 'paused' | 'stopped' | 'error';
  percentDone: number; // 0-100
  eta: number; // seconds
  uploadSpeed: number; // bytes/sec
  downloadSpeed: number; // bytes/sec
  ratio: number;
  category?: string;
  tags?: string[];
  added: number; // unix timestamp
  completed: number; // unix timestamp
}

interface BiglyBTRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown[];
  id: number;
}

interface BiglyBTRPCResponse<T> {
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}
```

### 4. Quirks & Gotchas

**JSON-RPC 2.0 Protocol**:
- Uses standard JSON-RPC 2.0 structure
- All requests must include `jsonrpc: "2.0"` field
- Session ID passed as query parameter, not in headers
- Method names follow CamelCase convention

**Performance**:
- API efficient with moderately sized collections
- No delta/incremental updates; full sync required
- Consider filtering by category or tags for large libraries

**Version Compatibility**:
- BiglyBT project is less actively updated than other clients
- API stability generally good; limited breaking changes

**Browser Extension Compatibility**:
- Fetch-friendly API with JSON-RPC 2.0 standard
- Session ID as query param simple to handle
- No special CORS configuration typically needed

### 5. TypeScript Interfaces

```typescript
interface BiglyBTTorrent {
  id: string;
  name: string;
  size: number;
  seeders: number;
  leechers: number;
  seeds: number;
  peers: number;
  bytesReceived: number;
  bytesSent: number;
  state: 'downloading' | 'seeding' | 'paused' | 'stopped' | 'error';
  percentDone: number;
  eta: number;
  uploadSpeed: number;
  downloadSpeed: number;
  ratio: number;
  category?: string;
  tags?: string[];
  added: number;
  completed: number;
}

interface BiglyBTRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: unknown[];
  id: number;
}

interface BiglyBTRPCResponse<T> {
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

interface BiglyBTLoginRequest {
  jsonrpc: "2.0";
  method: "Session.login";
  params: [string, string]; // [username, password]
  id: number;
}

interface BiglyBTSessionResponse {
  sessionId: string;
  username: string;
}
```

---

## VUZE (REMOTE WEBUI)

### 1. Authentication

**Method**: HTTP Basic Authentication with optional token

**WebUI Port**: Typically 6880 (configurable)

**Headers Required**:
```
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

**Authentication**:
- Credentials sent on every request via Basic Auth header
- No login endpoint; auth stateless
- Optional remote token can be configured for additional security
- Token (if enabled) passed as query parameter: `?token=<token>`

### 2. API Endpoints

#### Get Torrents List
```
GET /api/torrents
Authorization: Basic <credentials>
```

**Response** (JSON):
```json
{
  "torrents": [
    {
      "hash": "abc123",
      "name": "Ubuntu 24.04 LTS",
      "size": 4294967296,
      "progress": 45,
      "status": "downloading",
      "seeds": 120,
      "peers": 45,
      "upRate": 1048576,
      "dnRate": 2097152,
      "eta": 3600,
      "ratio": 0.15,
      "category": "linux",
      "addedTime": 1701432000,
      "completedTime": 0
    }
  ]
}
```

#### Add Torrent
```
POST /api/torrents/add
Authorization: Basic <credentials>
Content-Type: application/x-www-form-urlencoded

url=magnet:?xt=urn:btih:HASH or
file=[binary multipart]
```

#### Pause/Resume
```
GET /api/torrents/action?action=pause&hash=hash1
GET /api/torrents/action?action=resume&hash=hash1
Authorization: Basic <credentials>
```

#### Remove Torrent
```
GET /api/torrents/action?action=remove&hash=hash&deleteFiles=true
Authorization: Basic <credentials>
```

### 3. Data Structures

**Vuze Torrent Object**:
```typescript
interface VuezeTorrent {
  hash: string;
  name: string;
  size: number; // bytes
  progress: number; // 0-100
  status: 'downloading' | 'seeding' | 'paused' | 'error' | 'checking';
  seeds: number;
  peers: number;
  upRate: number; // bytes/sec
  dnRate: number; // bytes/sec
  eta: number; // seconds
  ratio: number;
  category?: string;
  addedTime: number; // unix timestamp
  completedTime: number; // unix timestamp
}
```

### 4. Quirks & Gotchas

**Limited Documentation**:
- Vuze WebUI API has sparse official documentation
- Implementation details gleaned from community sources
- May vary between Vuze versions

**Legacy Status**:
- Vuze actively maintained but declining user base
- API stable but not as feature-rich as alternatives
- Consider qBittorrent or Transmission as modern alternatives

**Performance**:
- API response times generally acceptable
- No specific optimization endpoints
- Full refresh on each poll

### 5. TypeScript Interfaces

```typescript
interface VuezeTorrent {
  hash: string;
  name: string;
  size: number;
  progress: number;
  status: 'downloading' | 'seeding' | 'paused' | 'error' | 'checking';
  seeds: number;
  peers: number;
  upRate: number;
  dnRate: number;
  eta: number;
  ratio: number;
  category?: string;
  addedTime: number;
  completedTime: number;
}

interface VuezeAddTorrentRequest {
  url?: string; // magnet or HTTP URL
  file?: Blob; // binary torrent file
}
```

---

## TRANSMISSION (RPC)

### 1. Authentication

**Method**: HTTP Basic Authentication with CSRF token protection

**RPC Endpoint**: `POST /transmission/rpc`

**Initial Request** (to get CSRF token):
```
POST /transmission/rpc
Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
Content-Type: application/json

{}
```

**Response** (contains CSRF token):
```
HTTP 409 Conflict
X-Transmission-Session-Id: <session-id>

{
  "result": "INVALID SESSION-ID"
}
```

**Subsequent Requests**:
```
POST /transmission/rpc
Authorization: Basic <credentials>
X-Transmission-Session-Id: <session-id>
Content-Type: application/json

{
  "method": "torrent-get",
  "arguments": {...}
}
```

**Session Management**:
- Session ID obtained from `X-Transmission-Session-Id` header in 409 response
- Session ID required for all subsequent RPC calls
- Session expires after inactivity (default 30 minutes)
- No explicit logout needed

### 2. API Endpoints

#### Get Torrents List
```
POST /transmission/rpc
Authorization: Basic <credentials>
X-Transmission-Session-Id: <session-id>
Content-Type: application/json

{
  "method": "torrent-get",
  "arguments": {
    "fields": [
      "id", "hashString", "name", "status", "percentDone",
      "rateDownload", "rateUpload", "totalSize", "downloadedEver",
      "uploadedEver", "eta", "peersConnected", "seeders", "leechers",
      "comment", "downloadDir", "labels", "isFinished", "isPrivate",
      "magnetLink", "activityDate", "addedDate", "doneDate"
    ]
  }
}
```

**Response**:
```json
{
  "method": "torrent-get",
  "result": {
    "torrents": [
      {
        "id": 1,
        "hashString": "abc123def456",
        "name": "Ubuntu 24.04 LTS",
        "status": 6,
        "percentDone": 0.45,
        "rateDownload": 2097152,
        "rateUpload": 1048576,
        "totalSize": 4294967296,
        "downloadedEver": 1932735283,
        "uploadedEver": 289910784,
        "eta": 3600,
        "peersConnected": 45,
        "seeders": 120,
        "leechers": 30,
        "comment": "",
        "downloadDir": "/home/user/Downloads",
        "labels": ["linux", "distro"],
        "isFinished": false,
        "isPrivate": false,
        "magnetLink": "magnet:?xt=urn:btih:...",
        "activityDate": 1701518400,
        "addedDate": 1701432000,
        "doneDate": 0
      }
    ]
  }
}
```

#### Add Torrent
```
POST /transmission/rpc
Authorization: Basic <credentials>
X-Transmission-Session-Id: <session-id>
Content-Type: application/json

{
  "method": "torrent-add",
  "arguments": {
    "filename": "magnet:?xt=urn:btih:HASH&dn=NAME&tr=TRACKER",
    "paused": false,
    "download-dir": "/path/to/download"
  }
}

or for file upload:

{
  "method": "torrent-add",
  "arguments": {
    "metainfo": "base64-encoded-.torrent-file-content",
    "paused": false
  }
}
```

#### Start/Stop Torrents
```
POST /transmission/rpc
Authorization: Basic <credentials>
X-Transmission-Session-Id: <session-id>
Content-Type: application/json

{
  "method": "torrent-start",
  "arguments": {
    "ids": [1, 2, 3]
  }
}

{
  "method": "torrent-stop",
  "arguments": {
    "ids": [1, 2, 3]
  }
}
```

#### Remove Torrent
```
POST /transmission/rpc
Authorization: Basic <credentials>
X-Transmission-Session-Id: <session-id>
Content-Type: application/json

{
  "method": "torrent-remove",
  "arguments": {
    "ids": [1],
    "delete-local-data": true
  }
}
```

### 3. Data Structures

**Status Codes**:
```
0 = stopped
1 = checking to be downloaded
2 = checking to be seeded
3 = downloading
4 = seeding
5 = stopped (seeds only)
6 = queued to check
7 = checking seeds
```

**Transmission Torrent Object**:
```typescript
interface TransmissionTorrent {
  id: number;
  hashString: string;
  name: string;
  status: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  percentDone: number; // 0-1
  rateDownload: number; // bytes/sec
  rateUpload: number; // bytes/sec
  totalSize: number; // bytes
  downloadedEver: number; // bytes
  uploadedEver: number; // bytes
  eta: number; // seconds
  peersConnected: number;
  seeders: number;
  leechers: number;
  comment: string;
  downloadDir: string;
  labels: string[];
  isFinished: boolean;
  isPrivate: boolean;
  magnetLink: string;
  activityDate: number; // unix timestamp
  addedDate: number; // unix timestamp
  doneDate: number; // unix timestamp
}

interface TransmissionRPCRequest {
  method: string;
  arguments: Record<string, unknown>;
}

interface TransmissionRPCResponse<T> {
  method: string;
  result: string; // "success" or error message
  arguments?: T;
}
```

### 4. Quirks & Gotchas

**Session ID Requirement**:
- First request returns 409 Conflict with session ID in header
- All subsequent requests must include `X-Transmission-Session-Id` header
- Failure to include session ID on non-initial requests results in 409 Conflict
- This prevents CSRF attacks

**JSON-RPC 1.0 Protocol**:
- Transmission uses custom JSON-RPC variant (not 2.0)
- Method and arguments in separate fields
- No `id` field in requests
- Results wrapped in `arguments` field

**Performance**:
- Efficient with moderate torrent counts
- Supports filtering via `ids` parameter
- RPC calls lightweight and fast

**URL Encoding**:
- Filenames must be URL-encoded
- Base64 encoding required for .torrent file content

**Browser Extension Compatibility**:
- Excellent MV3 support via fetch API
- Session ID persistence requires careful state management
- Basic Auth and custom headers work well in background context

### 5. TypeScript Interfaces

```typescript
interface TransmissionTorrent {
  id: number;
  hashString: string;
  name: string;
  status: number;
  percentDone: number;
  rateDownload: number;
  rateUpload: number;
  totalSize: number;
  downloadedEver: number;
  uploadedEver: number;
  eta: number;
  peersConnected: number;
  seeders: number;
  leechers: number;
  comment: string;
  downloadDir: string;
  labels: string[];
  isFinished: boolean;
  isPrivate: boolean;
  magnetLink: string;
  activityDate: number;
  addedDate: number;
  doneDate: number;
}

interface TransmissionRPCRequest {
  method: string;
  arguments: Record<string, unknown>;
}

interface TransmissionRPCResponse<T> {
  method: string;
  result: string;
  arguments?: T;
}

interface TransmissionGetTorrentsResponse {
  torrents: TransmissionTorrent[];
}
```

---

## SYNOLOGY DSM (NATIVE)

### 1. Authentication

**Method**: Session-based authentication via Synology API

**Auth Endpoint**: `GET /webapi/auth.cgi?api=SYNO.API.Auth&version=7&method=login&account=<user>&passwd=<pass>&session=SynologyDSM&format=json`

**Response**:
```json
{
  "data": {
    "sid": "session_id_string",
    "did": "device_id"
  },
  "success": true
}
```

**Session Management**:
- Session ID (SID) valid for duration
- Include SID in all subsequent requests: `?_sid=<sid>`
- No explicit logout in torrent API (though `auth.cgi?method=logout` available)
- Session times out after inactivity

### 2. API Endpoints

#### Get Torrents List
```
GET /webapi/DownloadStation/task.cgi?api=SYNO.DownloadStation.Task
&version=3&method=list&_sid=<session_id>

or POST with optional parameters:
- additional: ["detail", "transfer", "file"]
- offset: number
- limit: number
- sort_by: "name" | "size" | "create_time"
```

**Response**:
```json
{
  "data": {
    "tasks": [
      {
        "id": "dbid_1",
        "type": "bt",
        "username": "admin",
        "title": "Ubuntu 24.04 LTS",
        "uri": "magnet:?xt=urn:btih:...",
        "create_time": 1701432000,
        "priority": 2,
        "size": 4294967296,
        "status": "downloading",
        "additional": {
          "transfer": {
            "size_downloaded": 1932735283,
            "size_uploaded": 289910784,
            "speed_download": 2097152,
            "speed_upload": 1048576
          },
          "detail": {
            "completed_time": 0,
            "total_peers": 150,
            "connected_leechers": 45,
            "connected_seeders": 120,
            "upload_ratio": 0.15
          }
        }
      }
    ]
  },
  "success": true
}
```

#### Add Torrent (URL/Magnet)
```
POST /webapi/DownloadStation/task.cgi
?api=SYNO.DownloadStation.Task&version=3&method=create&_sid=<session_id>

Form Data:
- uri: "magnet:?xt=..." or "https://..."
- destination: "/download/path"
- priority: 0-3
```

#### Pause Torrent
```
POST /webapi/DownloadStation/task.cgi
?api=SYNO.DownloadStation.Task&version=3&method=pause&_sid=<session_id>

Form Data:
- id: "dbid_1"
```

#### Resume Torrent
```
POST /webapi/DownloadStation/task.cgi
?api=SYNO.DownloadStation.Task&version=3&method=resume&_sid=<session_id>

Form Data:
- id: "dbid_1"
```

#### Remove Torrent
```
POST /webapi/DownloadStation/task.cgi
?api=SYNO.DownloadStation.Task&version=3&method=delete&_sid=<session_id>

Form Data:
- id: "dbid_1"
- force_complete: true/false
```

### 3. Data Structures

**Synology Task Status**:
```typescript
interface SynologyTask {
  id: string;
  type: 'bt' | 'http' | 'ftp' | 'nzb';
  username: string;
  title: string;
  uri: string;
  create_time: number;
  priority: 0 | 1 | 2 | 3; // 0 = low, 3 = high
  size: number;
  status: 'downloading' | 'seeding' | 'paused' | 'error' | 'finishing';
  additional?: {
    transfer?: {
      size_downloaded: number;
      size_uploaded: number;
      speed_download: number;
      speed_upload: number;
    };
    detail?: {
      completed_time: number;
      total_peers: number;
      connected_leechers: number;
      connected_seeders: number;
      upload_ratio: number;
    };
  };
}

interface SynologyTasksResponse {
  data: {
    tasks: SynologyTask[];
    total: number;
    offset: number;
  };
  success: boolean;
}
```

### 4. Quirks & Gotchas

**Proprietary Synology API**:
- Uses Synology WebAPI standard format
- Endpoint-specific API names and versions
- Different from standard torrent clients

**DSM Versions**:
- **DSM 6.x**: DownloadStation WebUI API v2-3
- **DSM 7.x**: DownloadStation WebUI API v3 (improved)
- API relatively stable across versions

**Performance**:
- NAS-based; response times may be slower than desktop clients
- Efficient with typical residential use cases
- Consider polling interval of 10-15 seconds

**Session Management**:
- Session ID passed via query parameter
- Credentials transmitted on login endpoint; use HTTPS in production
- No built-in CSRF token; relies on same-origin policy

**Browser Extension Compatibility**:
- Synology API requires query parameters for session ID
- CORS may block direct API access from web; extension context has privileges
- Consider cross-origin fetch or local proxy for web access

### 5. TypeScript Interfaces

```typescript
interface SynologyAuthResponse {
  data: {
    sid: string;
    did: string;
  };
  success: boolean;
}

interface SynologyTask {
  id: string;
  type: 'bt' | 'http' | 'ftp' | 'nzb';
  username: string;
  title: string;
  uri: string;
  create_time: number;
  priority: 0 | 1 | 2 | 3;
  size: number;
  status: 'downloading' | 'seeding' | 'paused' | 'error' | 'finishing';
  additional?: {
    transfer?: {
      size_downloaded: number;
      size_uploaded: number;
      speed_download: number;
      speed_upload: number;
    };
    detail?: {
      completed_time: number;
      total_peers: number;
      connected_leechers: number;
      connected_seeders: number;
      upload_ratio: number;
    };
  };
}

interface SynologyTasksResponse {
  data: {
    tasks: SynologyTask[];
    total: number;
    offset: number;
  };
  success: boolean;
}
```

---

## BROWSER EXTENSION INTEGRATION GUIDE

### Standardized ITorrentClient Interface

```typescript
// Base interface all adapters must implement
interface ITorrentClient {
  // Connection & Auth
  connect(config: TorrentClientConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Torrent Operations
  getTorrents(filters?: TorrentFilters): Promise<StandardTorrent[]>;
  addTorrent(source: TorrentSource): Promise<AddTorrentResult>;
  pauseTorrents(hashes: string[]): Promise<void>;
  resumeTorrents(hashes: string[]): Promise<void>;
  removeTorrents(hashes: string[], deleteData?: boolean): Promise<void>;

  // Categories/Labels
  getCategories(): Promise<string[]>;
  setCategory(hash: string, category: string): Promise<void>;

  // Metadata
  getName(): string;
  getVersion(): string;
  getCapabilities(): ClientCapabilities;
}

interface TorrentClientConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  sessionId?: string; // For session-based clients
  token?: string; // For token-based clients
  ssl?: boolean;
  basePath?: string; // For proxied clients
}

interface StandardTorrent {
  hash: string;
  name: string;
  state: TorrentState;
  progress: number; // 0-100
  totalSize: number; // bytes
  downloaded: number; // bytes
  uploaded: number; // bytes
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number; // bytes/sec
  eta: number; // seconds
  ratio: number;
  seeders: number;
  leechers: number;
  category?: string;
  tags?: string[];
  addedDate: number; // unix timestamp
  completedDate?: number; // unix timestamp
}

type TorrentState = 'downloading' | 'seeding' | 'paused' | 'error' | 'checking' | 'allocating';

interface TorrentFilters {
  category?: string;
  tags?: string[];
  state?: TorrentState;
  limit?: number;
  offset?: number;
}

interface TorrentSource {
  type: 'magnet' | 'url' | 'file' | 'metainfo';
  value: string | Blob; // magnet URI, URL, file blob, or base64 metainfo
  category?: string;
  paused?: boolean;
}

interface AddTorrentResult {
  hash?: string;
  success: boolean;
  message?: string;
}

interface ClientCapabilities {
  supportsTags: boolean;
  supportsCategories: boolean;
  supportsLabels: boolean;
  supportsPriority: boolean;
  supportsSequentialDownload: boolean;
}

// Adapter Implementation Pattern
class DelugeAdapter implements ITorrentClient {
  private config: TorrentClientConfig;
  private connected: boolean = false;
  private requestId: number = 0;

  async connect(config: TorrentClientConfig): Promise<void> {
    this.config = config;
    try {
      const response = await this.rpcCall('auth.login', [
        config.username || 'admin',
        config.password || ''
      ]);
      if (response.result === true) {
        this.connected = true;
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  async getTorrents(filters?: TorrentFilters): Promise<StandardTorrent[]> {
    const response = await this.rpcCall('core.get_torrents_status', ['']);
    // Map Deluge format to StandardTorrent format
    return Object.values(response.result).map(t => this.mapTorrent(t));
  }

  private async rpcCall(method: string, params: unknown[]): Promise<any> {
    const request = {
      method,
      params,
      id: ++this.requestId
    };

    const response = await fetch(
      `${this.config.ssl ? 'https' : 'http'}://${this.config.host}:${this.config.port}/json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  private mapTorrent(delugeT: DelugeTorrentStatus): StandardTorrent {
    return {
      hash: delugeT.hash,
      name: delugeT.name,
      state: this.mapState(delugeT.state),
      progress: delugeT.progress,
      totalSize: delugeT.total_size,
      downloaded: delugeT.total_done,
      uploaded: delugeT.uploadedEver || 0,
      downloadSpeed: delugeT.download_payload_rate,
      uploadSpeed: delugeT.upload_payload_rate,
      eta: delugeT.eta,
      ratio: delugeT.ratio,
      seeders: delugeT.num_seeds,
      leechers: delugeT.num_peers,
      category: delugeT.label
    };
  }

  private mapState(state: string): TorrentState {
    const stateMap: Record<string, TorrentState> = {
      'Downloading': 'downloading',
      'Seeding': 'seeding',
      'Paused': 'paused',
      'Error': 'error',
      'Checking': 'checking'
    };
    return stateMap[state] || 'downloading';
  }

  // ... implement remaining interface methods
}
```

### MV3 Extension Context Considerations

```typescript
// Background Service Worker (MV3 Context)
// - Can make cross-origin fetch requests via extension privileges
// - No localStorage; use chrome.storage instead
// - Promise-based async/await fully supported
// - No DOM access

// Storage pattern for browser extension
class ExtensionStorage {
  static async saveConfig(clientName: string, config: TorrentClientConfig): Promise<void> {
    await chrome.storage.local.set({
      [`torrent_client_${clientName}`]: config
    });
  }

  static async getConfig(clientName: string): Promise<TorrentClientConfig | null> {
    const result = await chrome.storage.local.get(`torrent_client_${clientName}`);
    return result[`torrent_client_${clientName}`] || null;
  }

  static async saveToken(clientName: string, token: string): Promise<void> {
    await chrome.storage.local.set({
      [`torrent_token_${clientName}`]: {
        token,
        timestamp: Date.now()
      }
    });
  }
}

// Polling pattern for background service worker
class TorrentPollingService {
  private clients: Map<string, ITorrentClient> = new Map();
  private pollingInterval: number = 10000; // 10 seconds
  private activePolls: Map<string, NodeJS.Timer> = new Map();

  startPolling(clientName: string, client: ITorrentClient): void {
    if (this.activePolls.has(clientName)) {
      return; // Already polling
    }

    const pollId = setInterval(async () => {
      try {
        const torrents = await client.getTorrents();
        // Send to content scripts/popups via message API
        chrome.runtime.sendMessage({
          type: 'torrent-list-update',
          client: clientName,
          torrents
        }).catch(() => {
          // Listeners may not be ready; silently fail
        });
      } catch (error) {
        console.error(`Polling error for ${clientName}:`, error);
      }
    }, this.pollingInterval);

    this.activePolls.set(clientName, pollId);
  }

  stopPolling(clientName: string): void {
    const pollId = this.activePolls.get(clientName);
    if (pollId) {
      clearInterval(pollId);
      this.activePolls.delete(clientName);
    }
  }
}

// Content script message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'add-torrent') {
    const client = clients.get(message.clientName);
    client?.addTorrent({
      type: message.sourceType,
      value: message.value,
      category: message.category
    }).then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, message: error.message }));
    return true; // Async response
  }
});
```

### Error Handling & Retry Pattern

```typescript
class ResilientTorrentClient implements ITorrentClient {
  private maxRetries: number = 3;
  private retryDelayMs: number = 1000;

  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(
          `${context} failed (attempt ${attempt}/${this.maxRetries}). Retrying in ${delay}ms`,
          error
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async getTorrents(filters?: TorrentFilters): Promise<StandardTorrent[]> {
    return this.executeWithRetry(
      () => this.fetchTorrents(filters),
      'getTorrents'
    );
  }

  async addTorrent(source: TorrentSource): Promise<AddTorrentResult> {
    return this.executeWithRetry(
      () => this.uploadTorrent(source),
      `addTorrent (${source.type})`
    );
  }
}
```

### CORS & Cross-Origin Fetch in MV3

```typescript
// manifest.json permissions needed for extension to access torrent client APIs:
{
  "permissions": ["storage", "webRequest"],
  "host_permissions": [
    "http://localhost:*/*",
    "http://127.0.0.1:*/*",
    "http://<user-configured-hosts>/*"
  ]
}

// Fetch with proper credential handling for authentication
async function authenticatedFetch(
  url: string,
  options: RequestInit & { auth?: { username: string; password: string } }
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (options.auth) {
    const encoded = btoa(`${options.auth.username}:${options.auth.password}`);
    headers.set('Authorization', `Basic ${encoded}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include cookies for session-based auth
  });
}
```

---

## SUMMARY & COMPARISON MATRIX

| Feature | Deluge | Flood | ruTorrent | uTorrent | qBittorrent | BiglyBT | Vuze | Transmission | Synology |
|---------|--------|-------|----------|----------|-------------|---------|------|--------------|----------|
| **Auth Method** | Cookie | JWT | Basic | Token | Cookie | JSON-RPC | Basic | Basic+CSRF | Session |
| **API Protocol** | JSON-RPC | REST | XML-RPC | Legacy JSON | REST | JSON-RPC | REST | JSON-RPC | Synology |
| **Batch Operations** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Categories/Labels** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Add by Magnet** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Add by File** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Add by URL** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Get Speed Stats** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **ETA Calculation** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Delta Updates** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Session Timeout** | 1h | N/A | N/A | Session | 1h | Session | Session | 30min | Session |
| **MV3 Compatible** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Documentation Quality** | Good | Fair | Fair | Poor | Excellent | Fair | Poor | Good | Good |
| **Active Maintenance** | ✓ | ✓ | ✓ | ✗ | ✓ | Limited | Limited | ✓ | ✓ |

---

## RECOMMENDATIONS

### For Browser Extension Integration

1. **Start with qBittorrent**: Most straightforward REST API, excellent documentation, active project
2. **Then add Transmission**: Widely deployed, stable RPC API, good error handling
3. **Add Flood**: Excellent aggregator if user runs multiple upstream clients
4. **ruTorrent/Deluge**: Legacy but stable; add if targeting existing installations

### API Selection Strategy

- **Prioritize JSON-RPC 2.0** clients (Deluge, BiglyBT, Transmission) for modern standardization
- **Prefer REST clients** (qBittorrent, Flood) for simplicity in browser context
- **Avoid XML-RPC** (ruTorrent) unless essential for user base

### Performance Optimization

- Implement **polling interval of 5-10 seconds** for UI responsiveness
- Use **category/label filtering** to reduce data transfer for large libraries (1000+ torrents)
- **Batch operations** where possible (pause multiple torrents in single call)
- **Cache torrent data** in extension storage to reduce API load

### Security Considerations

1. **Never store passwords in extension storage**; use chrome.storage.session for temp auth tokens only
2. **HTTPS only** for remote connections; disable cert verification warnings via proper CA setup
3. **Session IDs** should be treated as secrets; store in secure storage
4. **Basic Auth**: Use only over HTTPS; base64 encoding provides no security

---

## REFERENCES & FURTHER READING

- **Deluge**: https://deluge.readthedocs.io/en/latest/reference/webapi.html
- **Flood**: https://github.com/jesec/flood (official repo with API docs)
- **qBittorrent**: https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)
- **Transmission**: https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
- **BiglyBT**: https://github.com/BiglySoftware/BiglyBT-plugin-xmwebui/blob/master/rpc-spec.txt

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Target**: Torrent Control Browser Extension (Manifest V3)
