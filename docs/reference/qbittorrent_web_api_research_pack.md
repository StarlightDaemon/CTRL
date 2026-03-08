# qBittorrent Web API Research Pack for CTRL Adapter

This report focuses strictly on the qBittorrent WebUI / Web API, with emphasis on real-world authentication/session behavior, version differences, error semantics, and browser-extension-relevant edge cases.

## A) Provenance

**Generated:** 2026-03-02 (America/Los_Angeles)

**Top sources (most authoritative and load-bearing):**

1. **qBittorrent Wiki — “WebUI API (qBittorrent 5.0)”** (official project wiki; defines the canonical `/api/v2/...` interface for qBittorrent v5.0+, including endpoints, parameters, and examples). citeturn10view0turn19view1turn43view0  
2. **Upstream source — `src/webui/webapplication.cpp`** (server-side implementation of session cookies, CSRF/Origin checks, host-header validation, and HTTP status mapping; crucial for browser-extension edge cases). citeturn40view4turn40view1turn46view0  
3. **Upstream source — `WebAPI_Changelog.md`** (project-maintained WebAPI change log; documents breaking/behavioral changes like 204 responses, 401 invalid-credential semantics, and evolving `/torrents/add` response formats). citeturn28view0  
4. **qBittorrent Wiki — “API Key Authentication (≥v5.2.0)”** (official documentation for API-key/Bearer auth mode and its limitations). citeturn35view2  
5. **Upstream PR — “WebAPI: Allow to specify session cookie name” (#18384)** (evidence that WebUI session cookie name is not safe to hardcode as `SID`; includes historical context and implementation diffs). citeturn15view0turn16view0  

## B) API Contract Summary

### Base URL patterns and required paths

qBittorrent’s Web API is organized as `/api/v2/<APIName>/<methodName>` where `<APIName>` is a functional subgroup such as `auth`, `app`, or `torrents`. citeturn19view1

Only `GET` and `POST` are used by the API, and starting with qBittorrent v4.4.4 the server returns **405 Method Not Allowed** if the wrong method is used. citeturn19view1

All API methods require authentication **except** `/api/v2/auth/login`. citeturn19view1turn46view0

### Authentication flow

#### Login endpoint(s)

- **Primary login endpoint:** `POST /api/v2/auth/login` citeturn19view1turn23view4  
- **Logout endpoint:** `POST /api/v2/auth/logout` citeturn19view1turn23view4

The wiki describes authentication as **cookie-based** and shows `/api/v2/auth/login` returning a Set-Cookie for the session identifier. citeturn19view1

Separately (version/capability dependent), qBittorrent also supports:
- **Basic auth supplied via the `Authorization` header** as a way of supplying WebAPI credentials (documented as a WebAPI change). citeturn28view0turn40view4  
- **API key auth (`Authorization: Bearer …`)** starting from qBittorrent v5.2.0 / WebAPI v2.14.1, intended to be stateless and not cookie-based. citeturn35view2turn40view1

#### Request content-type / body format

Login expects `username` and `password` parameters. citeturn19view1turn23view4  
The official example submits `username=...&password=...` as POST form data (typical `application/x-www-form-urlencoded`). citeturn19view1

#### Success / failure signals

**Success indicators**
- The wiki states that on successful login the response contains a cookie and subsequent authenticated calls must supply it. citeturn19view1turn40view4  
- If a session already exists, the server-side auth controller can treat `/auth/login` as successful without re-creating a session (implementation detail). citeturn23view4turn40view4

**Failure indicators (important version differences)**
- In qBittorrent 5.0.1 (as reported by an upstream issue), invalid credentials can produce **HTTP 200** with response text `"Fails."` (and banning produces **HTTP 403** with a message). citeturn45view0  
- The WebAPI changelog states that `auth/login` “responds to invalid credentials with a **401**” (in WebAPI v2.14.0). citeturn28view0turn46view0  
- The wiki states **403** when the user’s IP is banned due to too many failed login attempts. citeturn19view1

#### Cookie/session details

**Cookie name**
- The wiki examples show the cookie named `SID`. citeturn19view1turn18view0  
- However, upstream explicitly introduced the ability to avoid depending on the cookie being literally named `SID` (PR #18384), and its diff shows a historical hardcoded `SID` cookie name being a target of change. citeturn16view0turn15view0  
- In current upstream source, the session cookie name is built from a prefix `QBT_SID_` and includes the configured WebUI port (`QBT_SID_<port>`). citeturn8view0turn40view4turn46view0  

**Cookie attributes that commonly matter to browser-based clients**
- The server sets the cookie `HttpOnly`, with `path=/`. citeturn19view1turn40view4  
- The server can set `Secure` depending on configuration and whether the origin is considered trustworthy (`https` or reverse-proxy `X-Forwarded-Proto: https`). citeturn40view4  
- The server sets **SameSite=Strict** when CSRF protection is enabled; otherwise, if the cookie is Secure it sets SameSite=None. citeturn40view4turn40view1  

**Lifetime/refresh behavior**
- Cookie expiration: if WebUI session timeout is enabled (>0), the cookie expiration is set based on that timeout; for “permanent cookie” configuration (timeout ≤ 0), expiration is set far in the future (the implementation uses ~1 year). citeturn40view4turn40view1  
- qBittorrent refreshes cookies proactively (notably because “Safari browser does not persist cookies for more than 7 days”), refreshing cookies older than ~1 day (or timeout/2, whichever is smaller). citeturn20view4turn40view4  

### Core endpoints mapped to an ITorrentClient-style interface

The following mapping uses qBittorrent v5.0+ wiki naming and paths, with added notes where upstream code and changelog indicate versioned behavior.

#### List torrents

- **Method / Path:** `GET /api/v2/torrents/info` citeturn43view0turn19view1  
- **Key parameters (optional):**
  - `filter` (state filter; e.g. `downloading`, `seeding`, `stalled`, `errored`, etc.) citeturn43view0  
  - `category` (URL-encoded; empty string means “without category”) citeturn43view0  
  - `tag` (since WebAPI 2.8.3; URL-encoded; empty string means “without tag”) citeturn43view0  
  - `sort`, `reverse`, `limit`, `offset`, `hashes` citeturn43view0  
- **Response format:** JSON array of torrent objects. citeturn43view0turn43view1turn43view2turn43view3  
- **Important response fields for adapters (non-exhaustive):**
  - Identification: `hash`, `name`, `magnet_uri` citeturn43view1turn43view2  
  - Progress/state: `progress`, `state`, `eta` citeturn43view1turn43view2turn43view3  
  - Rates: `dlspeed`, `upspeed` citeturn43view1turn43view2turn43view3  
  - Categorization: `category`, `tags` citeturn43view1turn43view2  
- **Failure modes / status codes:**
  - If not authenticated, non-public endpoints are rejected with **403 Forbidden** (server checks for a valid session before routing most API calls). citeturn46view0turn40view4turn19view1  
  - Wrong method can result in **405** (from qBittorrent v4.4.4 onward). citeturn19view1  

#### Add torrent by URL (magnet / http(s) / bc://bt/)

- **Method / Path:** `POST /api/v2/torrents/add` citeturn18view0turn18view1  
- **Request encoding:** `multipart/form-data`. citeturn18view0turn18view1  
- **Required parameter:** `urls` (URLs separated by newlines). citeturn18view1turn18view0  
- **Supported URL schemes:** `http://`, `https://`, `magnet:`, `bc://bt/`. citeturn18view0  
- **Common optional parameters (adapter-relevant):** `savepath`, `category`, `tags`, `paused`, `skip_checking`, `root_folder`, `rename`, `upLimit`, `dlLimit`, `autoTMM`, `sequentialDownload`, `firstLastPiecePrio`. citeturn18view1turn18view0  
- **Response / status:**
  - The wiki states **415** if “torrent file is not valid” and **200** otherwise (note that this endpoint can accept both URLs and files). citeturn18view1  
  - The WebAPI changelog states that in WebAPI v2.14.0 the endpoint responds with JSON fields `success_count`, `pending_count`, `failure_count`, and `added_torrent_ids`; uses **202** when `pending_count` is non-zero; and uses **409** when all torrents fail to be added. citeturn28view0turn46view0  
- **Failure modes / status codes (cross-version):**
  - Earlier versions commonly returned **200** with body `"Fails."` for add failures (example report). citeturn24search1  
  - Versioned semantics in v2.14.0+ can include **409** when all adds fail (per changelog). citeturn28view0  

#### Add torrent by file

- **Method / Path:** `POST /api/v2/torrents/add` citeturn18view0turn18view1  
- **Request encoding:** `multipart/form-data`. citeturn18view1  
- **Required parameter for file adds:** `torrents` raw torrent bytes; the field can appear multiple times to add multiple files. citeturn18view1turn18view0  
- **Failure modes:**
  - The documented invalid torrent-file case returns **415**. citeturn18view1turn46view0  

#### Pause / Resume

- **Pause**
  - **Method / Path:** `GET /api/v2/torrents/stop` (mutating, but docs show query example; POST may also be used if implemented — see general “GET/POST only” and usage guidance). citeturn44view0turn19view1  
  - **Required parameter:** `hashes` (`|` separated, or `all`). citeturn44view0  
  - **Returns:** **200** all scenarios. citeturn44view0  
- **Resume**
  - **Method / Path:** `GET /api/v2/torrents/start` citeturn44view0turn19view1  
  - **Required parameter:** `hashes` (`|` separated, or `all`). citeturn44view0  
  - **Returns:** **200** all scenarios. citeturn44view0  

#### Remove torrents (with/without data)

- **Method / Path:** `GET /api/v2/torrents/delete` citeturn44view1turn19view1  
- **Required parameter:** `hashes` (`|` separated, or `all`). citeturn44view1  
- **Data deletion toggle:** `deleteFiles=true` deletes downloaded data; as described, this is the “remove with content” semantics. citeturn44view1  
- **Returns:** **200** all scenarios. citeturn44view1  

#### Categories and tags (labels)

qBittorrent supports **categories** and **tags** in the Web API (not “labels” as a first-class term in the official API docs). citeturn41view4turn41view5turn42view0

**Categories**
- **List categories:** `/api/v2/torrents/categories` (non-mutating; expected `GET` per the API’s general GET/POST guidance). citeturn41view4turn19view1  
- **Response:** JSON object keyed by category name; includes `name` and `savePath`. citeturn41view4  

**Tags**
- **List tags:** `/api/v2/torrents/tags` (expected `GET`). citeturn41view5turn19view1  
- **Response:** JSON array of strings. citeturn41view5  
- **Add tags to torrents:** `POST /api/v2/torrents/addTags` with `hashes` (`|` or `all`) and `tags` (comma-separated). citeturn42view0  
- **Remove tags from torrents:** `POST /api/v2/torrents/removeTags` with `hashes` and `tags`. citeturn42view0  
- **Create tags:** `POST /api/v2/torrents/createTags` with `tags` (comma-separated). citeturn42view0  
- **Delete tags:** `POST /api/v2/torrents/deleteTags` with `tags` (comma-separated). citeturn42view0  

### testConnection / ping equivalent

For an authenticated “ping” that validates both connectivity and session validity, the best high-signal, low-cost endpoint is:

- **`GET /api/v2/app/webapiVersion`** (returns the WebAPI version string such as `2.0` and is documented as always returning 200). citeturn19view1

Why this is a strong “testConnection” target:
- It is an **authenticated** endpoint (thus a successful response implies the session/cookie was accepted). citeturn19view1turn46view0  
- It returns a simple, deterministic value suitable for capability gating. citeturn19view1  

A complementary endpoint for product/version reporting is:
- **`GET /api/v2/app/version`** (returns qBittorrent version string like `v4.1.3`). citeturn19view1  

## C) Error Semantics and Edge Cases

### Wrong credentials

**Observed / documented behaviors differ by WebAPI version:**

- In qBittorrent 5.0.1, invalid credentials can return **HTTP 200** with body `"Fails."` (not banned). citeturn45view0  
- In WebAPI v2.14.0, invalid credentials are explicitly documented to return **HTTP 401**. citeturn28view0turn46view0  
- If the client/IP is banned due to too many failures, the wiki documents **HTTP 403**, and a user report shows the body text `"Your IP address has been banned after too many failed authentication attempts."` citeturn19view1turn45view0turn20view2  

**Edge case that breaks naïve clients:** treating any `200` as success is unsafe because (at least in some versions) incorrect credentials can still produce `200` with failure text. citeturn45view0  

### “Already exists / duplicate” on add

qBittorrent’s add semantics have evolved:

- Historically, add failures often produced **HTTP 200** with body `"Fails."` (example of `/torrents/add` returning `Fails.` with HTTP 200). citeturn24search1  
- In WebAPI v2.14.0, `/torrents/add` gains structured counts and can return **HTTP 409** when all torrents fail to be added. citeturn28view0turn46view0  

**What cannot be proven from primary docs alone:** whether “duplicate torrent” specifically maps to 409 vs 200/“Fails.” across all versions; the changelog only guarantees 409 for the “all torrents fail” condition, not the exact failure reasons. citeturn28view0  

### Invalid URL / malformed torrent file

- `/torrents/add` supports `http(s)`, `magnet:`, `bc://bt/`. citeturn18view0  
- A malformed torrent file yields **HTTP 415** (“Torrent file is not valid”). citeturn18view1turn46view0  

A frequently observed integration pitfall: using the wrong multipart field name for torrent files. The official API uses the `torrents` field (raw bytes), and an add attempt using a UI-oriented field name like `fileselect[]` is reported to yield `"Fails."`. citeturn18view1turn24search1  

### Reachable-but-error vs unreachable/timeout

**Reachable but rejected (HTTP-level):**
- If a request reaches qBittorrent but does not have a valid session cookie (and is not a public endpoint), the server rejects it with **403 Forbidden**. citeturn46view0turn40view4  
- If CSRF protection is enabled and the request is determined to be cross-site (Origin/Referer mismatch), the server can reject with **401 Unauthorized** before it even tries to authenticate or route the endpoint. citeturn40view4turn40view1  
- Host-header validation failures also produce a rejection (implementation throws Unauthorized). citeturn40view4turn40view1  

**Unreachable/timeout (network-level):**
- There is no qBittorrent-specific payload; the client experiences network errors (connection refused, DNS failure, timeouts). (This is not a qBittorrent API semantic; it is transport-level behavior.)

### Quirks affecting “truthy/falsey” connection tests

The following behaviors commonly break simplistic “status-code-only” or “body-text-only” tests:

- **`200` with an error body** (e.g., login returning `"Fails."` with HTTP 200). citeturn45view0  
- **`204 No Content` success responses**: WebAPI v2.11.8 introduced sending 204 when the response contains no data (with some endpoints kept at 200 for transition). The current server implementation sends 204 when an endpoint returns no data. citeturn28view0turn46view0  
- **CSRF Origin/Referer requirements**: the wiki warns clients to set `Referer` or `Origin` to match the request host/port exactly, and the server enforces same-origin checks when CSRF protection is enabled. citeturn19view1turn40view1turn40view4  

## D) Version and Capability Detection

### Detecting qBittorrent version

- **Endpoint:** `GET /api/v2/app/version`  
- **Returns:** string like `v4.1.3` (example given). citeturn19view1  

### Detecting WebAPI version

- **Endpoint:** `GET /api/v2/app/webapiVersion`  
- **Returns:** string like `2.0` (example given). citeturn19view1  

### Features that are version-gated (relevant to an adapter)

- `/torrents/info` supports `tag` filtering parameter **since WebAPI 2.8.3**. citeturn43view0  
- WebUI API “Changes” list notes that `/torrents/info` gained `reannounce` (documented under API v2.9.3 in the v5.0 wiki). citeturn17view3turn43view2  
- WebAPI introduced **204 No Content** behavior for null/empty responses in **2.11.8**, and the server implementation shows 204 being used when `result.data` is null. citeturn28view0turn46view0  
- WebUI API notes that cookie APIs were added and a `cookie` field was removed from `/torrents/add` request (API v2.11.3 in the v5.0 wiki). citeturn19view0turn17view3  
- WebAPI v2.14.0 changes:
  - `auth/login` invalid credentials -> **401** citeturn28view0turn46view0  
  - `/torrents/add` structured response fields and **202/409** semantics citeturn28view0turn46view0  
- API key auth is available **starting qBittorrent v5.2.0 / WebAPI v2.14.1**, and uses `Authorization: Bearer …` with a specific key format/prefix. citeturn35view2turn40view1  
- WebAPI credentials via **Basic auth** are documented as introduced in WebAPI v2.15.0. citeturn28view0turn40view4  

## E) Browser and Extension Constraints

### Cookies and credentialed requests

qBittorrent’s standard WebUI authentication is cookie-based, requiring clients to supply the session cookie on subsequent requests. citeturn19view1turn40view4

**Cookie name is not stable across versions/configurations:** the wiki examples show `SID`, but upstream changes and current implementation show that the cookie name may differ (e.g., port-suffixed `QBT_SID_<port>`). Browser-extension clients must not hardcode `SID`. citeturn19view1turn16view0turn8view0turn40view4

### CSRF protections and same-origin enforcement

The wiki explicitly warns: set `Referer` or `Origin` header to the exact same domain and port as the request’s `Host`. citeturn19view1

In implementation, when CSRF protection is enabled, qBittorrent treats an **Origin/Referer mismatch** as a cross-site request and rejects it (Unauthorized), logging messages about the mismatch. citeturn40view1turn40view4

As a related cookie constraint, when CSRF protection is enabled, qBittorrent sets the session cookie to **SameSite=Strict**, which reduces the chance that browsers attach cookies in cross-site contexts. citeturn40view4

### Host header validation and reverse proxy headers

qBittorrent can validate Host headers: it rejects requests when the Host port does not match the server port, and/or when the host does not match the configured domain list / local address (implementation logs and returns failure). citeturn40view1turn40view4

For reverse-proxy deployments, the server derives origin/host from `X-Forwarded-Host` (and trustworthy origin from `X-Forwarded-Proto`). This means that client behavior can differ depending on reverse-proxy configuration and forwarded headers. citeturn40view4

### CORS expectations (what qBittorrent typically does)

From the WebUI server implementation, there is explicit handling of “CORS requests” in the CSRF logic (Origin header is evaluated and must match target origin when CSRF is enabled). citeturn40view1

**Inference (not fully proven by a single definitive doc page):** the main WebUI server code does not appear to set `Access-Control-Allow-Origin` headers (no occurrences of “Access-Control” in the WebUI server source as fetched), so browser-based cross-origin XHR/fetch would not be expected to succeed via standard CORS unless the request is same-origin or the client context bypasses CORS enforcement. citeturn40view0turn40view4  

### Headers that matter most for non-browser clients and extensions

- `Cookie` (session cookie) is required for most endpoints. citeturn19view1turn40view4  
- `Origin` or `Referer` must align with `Host` when CSRF protection is enabled; mismatch leads to Unauthorized. citeturn19view1turn40view1turn40view4  
- `Authorization: Bearer <api_key>` (API key sessions; no cookie). citeturn35view2turn40view1  
- `Authorization: Basic <base64(user:pass)>` (documented as supported in newer WebAPI versions; implementation validates and can start a session). citeturn28view0turn40view4  
- `X-Forwarded-Host` / `X-Forwarded-Proto` (reverse-proxy deployments). citeturn40view4  

### Documented gotchas for non-browser clients

- Some endpoints can legitimately return **204 No Content** on success; clients should treat 204 as success where appropriate. citeturn28view0turn46view0  
- Cookie refresh behavior exists specifically due to Safari persistence limits; clients may see periodic Set-Cookie refreshes even without “re-login”. citeturn20view4turn40view4  

## F) Test Matrix

The table below lists stubbed-response cases to cover in adapter unit tests. The response/status behaviors are grounded in the official wiki, upstream changelog, and upstream server code.

| Endpoint group | Scenario | Stubbed response (status / headers / body) | Expected adapter outcome |
|---|---|---|---|
| Auth | Successful login (older-style) | `200`, `Set-Cookie: SID=...; path=/`, body `"Ok."` citeturn19view1turn24search1 | Store cookie; authenticated state = true |
| Auth | Invalid credentials (legacy behavior) | `200`, body `"Fails."` citeturn45view0 | Throw AuthError (bad credentials); authenticated state = false |
| Auth | Invalid credentials (WebAPI ≥2.14.0) | `401`, body optional citeturn28view0turn46view0 | Throw AuthError; authenticated state = false |
| Auth | IP banned due to failures | `403`, body `"Your IP address has been banned..."` citeturn19view1turn45view0 | Throw AuthBanned/RateLimited error (distinct from wrong password) |
| Ping / version | webapiVersion success | `200`, body `"2.x"` citeturn19view1 | testConnection = true; record webapiVersion |
| Ping / version | Not authenticated to webapiVersion | `403` citeturn46view0turn19view1 | testConnection = false (or “auth required”) |
| Torrents list | torrents/info success | `200`, JSON array with `hash`, `name`, `state`, `progress`, `category`, `tags` citeturn43view0turn43view1turn43view2turn43view3 | Parse list; map to CTRL torrent model |
| Torrents list | Method mismatch (v4.4.4+) | `405` citeturn19view1turn46view0 | Surface “API method mismatch” error; retry with correct method if applicable |
| Add torrent | Add by URL success | `200` (legacy) or `202/200` (newer), body may be empty/JSON depending version citeturn18view0turn28view0turn46view0 | Return add result; handle both plain success and structured counts |
| Add torrent | Invalid torrent file | `415` citeturn18view1turn46view0 | Throw InvalidTorrentFile error |
| Add torrent | All adds fail (WebAPI ≥2.14.0) | `409`, JSON includes `failure_count` etc citeturn28view0turn46view0 | Throw AddFailed error; preserve per-item details if available |
| Pause/Resume | Pause all | `200` citeturn44view0 | Mark torrents paused (or return success) |
| Pause/Resume | Resume specific hashes | `200` citeturn44view0 | Mark resumed (or return success) |
| Delete | Remove without data | `200` for `/torrents/delete?...&deleteFiles=false` citeturn44view1 | Delete from model only |
| Delete | Remove with data | `200` for `/torrents/delete?...&deleteFiles=true` citeturn44view1 | Delete from model and mark “content deleted” |
| Tags/Categories | List categories | `200`, JSON object with `{ "<name>": { name, savePath }}` citeturn41view4 | Parse categories map |
| Tags/Categories | Add tags to torrents | `200` citeturn42view0 | Update tags mapping; handle `hashes=all` and `tags=a,b` |

**Minimum negative coverage is satisfied** by explicit failing cases for Auth, Ping, Torrents/add, and method mismatch; the remaining groups also include failure implications via auth/CSRF handling (403/401). citeturn46view0turn40view4turn45view0turn28view0  

## G) Uncertainties and Missing Evidence

- **Exact `/torrents/add` response body format across all versions**: the v5.0 wiki describes status codes (415/200) but not the full legacy `"Ok."`/`"Fails."` body contract, while the WebAPI changelog documents a newer structured JSON response in v2.14.0+. A single unified canonical spec for both formats is not present in one document. citeturn18view1turn28view0turn24search1  
- **Duplicate-torrent semantics are not explicitly pinned** (e.g., whether duplicates produce 409 vs 200/“Fails.” in specific releases). The changelog only guarantees 409 when *all* adds fail, not the precise reason taxonomy. citeturn28view0  
- **Cookie name in published stable releases vs wiki examples**: wiki examples still use `SID`, while upstream code shows `QBT_SID_<port>` and there is upstream PR history about changing cookie name assumptions. The safest adapter stance is to treat the cookie name as variable and always parse Set-Cookie rather than hardcoding. citeturn19view1turn16view0turn8view0turn40view4  
- **CORS headers are not explicitly documented**: the server enforces same-origin checks under CSRF protection and does not appear to set `Access-Control-Allow-*` headers in the WebUI server source as fetched, but there is no single authoritative “CORS policy” doc page. citeturn40view0turn40view1turn40view4  

**Suggested filename:** `docs/reports/2026-03-02__qbittorrent_web_api_research_pack.md`