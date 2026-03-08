# qBittorrent Adapter — Research vs Implementation Audit

**Date:** 2026-03-02  
**Scope:** qBittorrent adapter only  
**Mode:** Read-only audit  
**Baseline State:** Unknown State (`CTRL_BASELINE.md` and `CTRL_SYSTEM_STATE.md` not found)

---

## 1. Evidence Alignment

### 1.1 Authentication & Session Management

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Cookie-based auth via `POST /api/v2/auth/login` with `x-www-form-urlencoded` | ✅ YES | [QBittorrentAdapter.ts L76–79](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L76-L79): `new URLSearchParams({ username, password })` |
| IP ban detection (parse "banned" text from 403 body) | ✅ YES | [QBittorrentAdapter.ts L91–93, L110–115](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L91-L115): checks `QB_ERROR_MESSAGES.IP_BANNED` |
| Exponential backoff for failed logins | ✅ YES | [QBittorrentAdapter.ts L58–70](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L58-L70): `LOGIN_BACKOFF_BASE_MS * 2^MAX_LOGIN_ATTEMPTS` |
| Hard stop after 3 attempts to prevent IP ban | ✅ YES | [QBittorrentAdapter.ts L41](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L41): `MAX_LOGIN_ATTEMPTS = 3` |
| Automatic re-auth on session expiry (401/403) | ✅ YES | [QBittorrentAdapter.ts L367](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L367): catches 401/403, re-logins, retries once |
| Explicit logout via `POST /auth/logout` | ✅ YES | [QBittorrentAdapter.ts L123–129](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L123-L129) |
| Research recommends "Circuit Breaker" pattern name | ⚠️ PARTIAL | Backoff exists, but no formal circuit-breaker class or state machine—logic is inline |

### 1.2 CSRF / Header Rewriting

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Inject `Origin` header matching target host | ✅ YES | [QBittorrentAdapter.ts L311–312](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L311-L312) |
| Inject `Referer` header matching target host | ✅ YES | [QBittorrentAdapter.ts L313](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L313) |
| `credentials: 'include'` for cookie attachment | ✅ YES | [QBittorrentAdapter.ts L323](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L323) |
| Research mentions `webRequest` API for header rewriting at network level | ❌ NOT FOUND | Adapter does manual injection in `makeRequest()` via `Headers.set()`, no `webRequest` interceptor layer detected in scope |

### 1.3 Version Detection

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Call `/api/v2/app/webapiVersion` for API version | ✅ YES | [QBittorrentAdapter.ts L139](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L139) |
| Call `/api/v2/app/version` for app version | ✅ YES | [QBittorrentAdapter.ts L149](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L149) |
| Cache API version after first call | ✅ YES | [QBittorrentAdapter.ts L136–138](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L136-L138) |
| Use version to toggle feature flags (e.g. `root_folder` vs `content_layout`) | ❌ MISSING | No version-gated feature flags found in adapter or services |

### 1.4 Status Mapping (`mapStatus`)

| Research State | Impl Mapping | Match? |
|---|---|---|
| `metaDL`, `allocating`, `downloading`, `forcedDL` → downloading | `'downloading'` | ✅ |
| `stalledDL` → downloading (research); stalled (impl) | `'stalled'` | ⚠️ DIVERGENCE |
| `uploading`, `forcedUP`, `stalledUP` → seeding | `'seeding'` | ✅ (research maps `stalledUP` to seeding; impl agrees) |
| `pausedDL`, `pausedUP` → paused | `'paused'` | ✅ |
| `queuedDL`, `queuedUP` → queued | `'queued'` | ✅ |
| `checkingDL`, `checkingUP` → checking | `'checking'` | ✅ |
| `error` → error | `'error'` | ✅ |
| `checkingResumeData` | `'checking'` | ✅ (impl adds this; not explicitly in research snippet but correct) |
| `missingFiles` | `'error'` | ✅ (impl adds this; reasonable) |

> Research architect prompt (L27–39) maps `stalledUP` to `seeding` and does not list `stalledDL` separately. Implementation ([QBittorrentAdapter.ts L412–413](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L412-L413)) returns `'stalled'` for `stalledDL`. The builder prompt (Section 4.2) explicitly lists `stalledDL` as a separate state. The implementation's choice is **more granular** than the architect research snippet and is consistent with the builder research.

### 1.5 Sync/maindata Protocol (rid-based delta updates)

| Research Claim | Implemented? | Evidence |
|---|---|---|
| `rid=0` for full update | ✅ YES | [QBittorrentSyncService.ts L27](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSyncService.ts#L27): `rid: 0` |
| `full_update` flag → discard local state | ✅ YES | [QBittorrentSyncService.ts L63–68](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSyncService.ts#L63-L68) |
| Delta merge via spread operator | ✅ YES | [QBittorrentSyncService.ts L75–77](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSyncService.ts#L75-L77): `{ ...existing, ...delta }` |
| `torrents_removed` → delete from store | ✅ YES | [QBittorrentSyncService.ts L84–87](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSyncService.ts#L84-L87) |
| `categories`, `categories_removed` handling | ✅ YES | [QBittorrentSyncService.ts L90–96](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSyncService.ts#L90-L96) |
| `tags`, `tags_removed` handling | ✅ YES | [QBittorrentSyncService.ts L99–105](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSyncService.ts#L99-L105) |
| `server_state` in sync schema | ✅ YES | [QBittorrentSchema.ts L124](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSchema.ts#L124) (schema only; not merged by SyncService) |
| Adaptive polling interval | ❌ MISSING | No adaptive polling logic in SyncService or adapter |
| Heartbeat / keep-alive pattern | ❌ MISSING | No background heartbeat mechanism |

### 1.6 Bandwidth / Transfer Control

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Global download/upload limit get/set | ✅ YES | [QBittorrentTransferService.ts L60–93](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTransferService.ts#L60-L93) |
| Per-torrent download/upload limits (pipe-separated hashes) | ✅ YES | [QBittorrentTransferService.ts L138–164](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTransferService.ts#L138-L164) |
| Alternative speed limits toggle | ✅ YES | [QBittorrentTransferService.ts L107–132](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTransferService.ts#L107-L132) |
| `limit` param in bytes/sec, 0 = unlimited | ✅ YES | URLSearchParams encoding throughout |

### 1.7 Tracker Management

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Add trackers (newline-separated) | ✅ YES | [QBittorrentTrackerService.ts L62](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTrackerService.ts#L62): `urls.join('\n')` |
| Remove trackers (pipe-separated) | ✅ YES | [QBittorrentTrackerService.ts L76](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTrackerService.ts#L76): `urls.join('|')` |
| Edit tracker (`origUrl`, `newUrl`) | ✅ YES | [QBittorrentTrackerService.ts L90–97](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTrackerService.ts#L90-L97) |
| Force reannounce | ✅ YES | [QBittorrentTrackerService.ts L108](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTrackerService.ts#L108) |
| Tracker status enum (0–4) | ✅ YES | [QBittorrentTrackerService.ts L21–32](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentTrackerService.ts#L21-L32) |

### 1.8 Search Plugin System

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Start search → returns job ID | ✅ YES | [QBittorrentSearchService.ts L37–41](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSearchService.ts#L37-L41) |
| Poll status, get results with pagination | ✅ YES | [QBittorrentSearchService.ts L51–77](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSearchService.ts#L51-L77) |
| Install/uninstall/enable plugins | ✅ YES | [QBittorrentSearchService.ts L87–113](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSearchService.ts#L87-L113) |

### 1.9 RSS Integration

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Add/remove/move feeds | ✅ YES | [QBittorrentRssService.ts L26–51](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentRssService.ts#L26-L51) |
| Set rule with JSON payload | ✅ YES | [QBittorrentRssService.ts L68–72](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentRssService.ts#L68-L72): `JSON.stringify(ruleDef)` |
| Rule fields: `mustContain`, `useRegex`, `episodeFilter`, `smartFilter`, `affectedFeeds`, `savePath`, `assignedCategory`, `addPaused` | ✅ YES | [QBittorrentSchema.ts L139–151](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSchema.ts#L139-L151) |

### 1.10 File Management

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Get files for torrent | ✅ YES | [QBittorrentFileService.ts L42–47](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentFileService.ts#L42-L47) |
| File priority: 0=skip, 1=normal, 6=high, 7=max | ✅ YES | [QBittorrentFileService.ts L20–28](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentFileService.ts#L20-L28) |
| Rename file (`oldPath`, `newPath`) | ✅ YES | [QBittorrentFileService.ts L95–103](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentFileService.ts#L95-L103) |

### 1.11 Sequential Download & First/Last Piece

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Toggle sequential download (toggle, not set) | ✅ YES | [QBittorrentAdapter.ts L277–282](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L277-L282) |
| Toggle first/last piece priority (toggle, not set) | ✅ YES | [QBittorrentAdapter.ts L288–293](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L288-L293) |
| Pipe-separated hashes | ✅ YES | Both use `hashes.join('|')` |
| `seq_dl` and `f_l_piece_prio` in torrent schema | ✅ YES | [QBittorrentSchema.ts L51–52](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSchema.ts#L51-L52) |

### 1.12 JSON Parsing Robustness

| Research Claim | Implemented? | Evidence |
|---|---|---|
| Wrap JSON parsing in try/catch, fall back to raw string | ✅ YES | [QBittorrentAdapter.ts L336–340](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L336-L340) |
| Request timeout handling | ✅ YES | [QBittorrentAdapter.ts L316–317, L344–346](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L316-L346): 30s AbortController |

### 1.13 POST Enforcement (REST Strictness)

All state-mutating operations use `method: 'POST'`:
- `pauseTorrent` → [L195](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L195)
- `resumeTorrent` → [L202](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L202)
- `removeTorrent` → [L209](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L209)
- `addTorrentUrl/File` → [L170, L188](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L170)
- All service mutations → POST throughout

✅ **Compliant with v4.4+ strict enforcement.**

---

## 2. Classified Findings

### Finding 1 — `testConnection` swallows error details
**Classification: CONFIRMED BEHAVIOR**

`testConnection()` ([QBittorrentAdapter.ts L218–230](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L218-L230)) catches all errors and returns `false`. The actual error message (e.g., IP ban vs. wrong password vs. network timeout) is logged to console but not propagated to callers.

This was previously identified and partially addressed at the UI layer (conversation `34668031`). Test coverage confirms this behavior: [QBittorrentAdapter.test.ts L365–371](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L365-L371).

### Finding 2 — `stalledDL` maps to `'stalled'`, diverging from architect research snippet
**Classification: FALSE POSITIVE**

The architect research snippet (L27–39) groups `stalledDL` under `'downloading'`. However, the builder research (Section 4.2) explicitly lists it as a separate state. The implementation's choice of `'stalled'` is **intentionally more granular** and well-tested: [QBittorrentAdapter.test.ts L397–402](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L397-L402).

### Finding 3 — No version-gated feature flags
**Classification: SYMPTOM**

Research recommends using `webapiVersion` to toggle features (e.g., `root_folder` vs `content_layout` for v4.1 vs v4.4+). The version is fetched and cached ([QBittorrentAdapter.ts L135–142](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L135-L142)) but never consumed for feature gating. Currently, the adapter always uses `content_layout`-era semantics. Impact: potential 400 errors on very old qBittorrent v4.1–4.3 instances.

### Finding 4 — No adaptive polling or heartbeat in SyncService
**Classification: SYMPTOM**

Research strongly recommends adaptive polling (increase interval with response time) and background heartbeat requests. `QBittorrentSyncService` provides the sync protocol correctly but has no polling loop, no backoff, and no heartbeat. This puts the responsibility on the caller, which is architecturally valid but undocumented.

### Finding 5 — `server_state` captured in schema but not merged by SyncService
**Classification: SYMPTOM**

`QBittorrentSyncDataSchema` includes `server_state` ([QBittorrentSchema.ts L124](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentSchema.ts#L124)), but `QBittorrentSyncService.sync()` does not merge it into `SyncState`. Global transfer info from sync delta updates is silently dropped.

### Finding 6 — No `webRequest` API interceptor for CSRF bypass
**Classification: CONFIRMED BEHAVIOR**

Research recommends a `webRequest`-level header rewrite. Implementation uses manual `Headers.set()` in `makeRequest()` instead. This is functionally equivalent for the adapter's own requests but does not cover requests made by other layers (e.g., if services ever use raw `fetch`). All current services use `FetchHttpClient`, not raw `fetch`, so this is low risk within scope.

### Finding 7 — RSS `getRules()` does not validate against schema
**Classification: SYMPTOM**

`getRules()` ([QBittorrentRssService.ts L97–99](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentRssService.ts#L97-L99)) returns `data as Record<string, QBittorrentRssRule>` with a comment noting "verify schema on integration." No Zod validation is applied, unlike other service methods. This is a schema validation gap.

---

## 3. Highest-Leverage Next Action

**Add validation guard** — Propagate structured error info from `testConnection()` instead of swallowing to boolean.

This was previously identified as a truthfulness issue (see prior audits). Currently, the adapter correctly detects IP bans, bad credentials, and timeouts in `login()`, but `testConnection()` collapses all failures to `false`. A structured error return (e.g., `{ success: false, error: string }`) would propagate the real failure cause to the UI layer without breaking the `ITorrentClient` contract.

---

## 4. Execution Prompt for Implementation Agent

```
OBJECTIVE:
Modify QBittorrentAdapter.testConnection() to return a structured result
({ success: boolean; error?: string }) instead of a plain boolean, so that
the UI can display the actual failure reason (IP ban, bad credentials,
timeout, network error).

SCOPE BOUNDARY:
- MODIFY ONLY: extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts
  (testConnection method, lines 218–230)
- MODIFY ONLY: extension/src/shared/api/clients/qbittorrent/index.ts (if export
  changes needed)
- UPDATE: extension/tests/unit/adapters/QBittorrentAdapter.test.ts (testConnection
  tests, lines 353–372)
- UPDATE: ITorrentClient interface if testConnection return type changes

EXPLICITLY FORBIDDEN:
- Do NOT modify any other adapter (Transmission, Deluge, rTorrent, etc.)
- Do NOT modify manifest, CSP, permissions, or build config
- Do NOT refactor service files (Sync, Transfer, Tracker, Search, RSS, File)
- Do NOT change authentication logic or session management
- Do NOT add new dependencies

REQUIRED OUTPUT:
- Markdown audit report at reports/YYYY-MM-DD__qbittorrent_testconnection_structured_error.md
- Report MUST include: file paths + line references for every change
- Report MUST include: evidence citations (before/after code)
- Report MUST include: regression check — run `cd extension && npm test` and
  record pass/fail with summary

REGRESSION CHECK:
- All existing QBittorrentAdapter tests must continue to pass
- testConnection tests must verify: success case returns { success: true },
  network error returns { success: false, error: "..." },
  IP ban returns { success: false, error: "IP has been banned..." }
```
