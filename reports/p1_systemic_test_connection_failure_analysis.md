# P1: Systemic Test Connection Failure Analysis

> **Generated**: 2026-02-15  
> **Scope**: End-to-end "Test Connection" flow — UI → Background → Adapter → Network → Return  
> **Methodology**: Static analysis against repository source; no speculation

---

## Executive Summary

Five systemic root causes produce the recurring failure patterns in the Test Connection flow. They span four classification categories: **ADAPTER BUG** (highest probability), **ASYNC LIFECYCLE BUG**, **STATE BUG**, and **ROUTING BUG** (lowest).

The most impactful is a silent-failure design in `QBittorrentAdapter.testConnection()` that returns `false` instead of propagating error details, combined with a dual-timeout mismatch between the UI (5 s) and the network layer (10 s) that causes the UI to display "Connection timed out" *before* the real error ever arrives.

---

## Verified Data Flow Trace

### Stage 1 — UI Trigger

**File**: [`ServerConfigPanel.tsx`](file:///mnt/e/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx) — Lines 146–187

```
testConnection() @ L146
  → guards: permissionStatus !== 'granted' → early return (L147-154)
  → setTestStatus({ loading: true }) (L156)
  → chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', config: tempServer }) (L163-166)
  → Promise.race([ responsePromise, timeoutPromise(5000ms) ]) (L173)
  → response handling: true / { success: true } / { error } / catch (L175-186)
```

**Payload emitted**:
```json
{
  "type": "TEST_CONNECTION",
  "config": { "name", "application", "type", "hostname", "username", "password", ... }
}
```

**Key invariant**: `tempServer` carries both `application` (display) and `type` (routing). Both are set from the same UI selector at [`L237-240`](file:///mnt/e/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx#L237-L240).

---

### Stage 2 — Messaging Layer

**Mechanism**: `chrome.runtime.sendMessage` (one-shot, expects single `sendResponse` call).

**Payload structure**: The message includes `config` (the raw `ServerConfig`). No `serverIndex` is sent.

**Propagation**: The entire `tempServer` object is serialized. The `config.type` field is the sole routing discriminant for `ClientFactory.create()`.

---

### Stage 3 — Background Entry

**File**: [`background.ts`](file:///mnt/e/CTRL/extension/src/entrypoints/background.ts) — Lines 274–409

```
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage().then(sendResponse);
  return true;  // async response
});
```

**Dispatch**: `handleMessage()` at L275 calls `getTargetClient()` (L278–318), then dispatches on `message.type`:

```
case 'TEST_CONNECTION':
case 'TEST_CONNECTION_SERVER':
  return await client.testConnection();  // L389
```

**Client resolution** (`getTargetClient`, L278–318):

```
1. IF message.config exists → factory.create(message.config)  ← DIRECT PATH (L279-285)
2. ELSE → ServerResolver.resolve() → vault lookup
   a. IF message.serverIndex → factory.create(servers[index])
   b. ELSE → getClientResult() → may return cached activeClient
```

For `TEST_CONNECTION`, path 1 is taken because the UI always sends `config`.

---

### Stage 4 — Server Resolution (Bypass Path)

**File**: [`ServerResolver.ts`](file:///mnt/e/CTRL/extension/src/shared/api/server/ServerResolver.ts) — Lines 27–91

For `TEST_CONNECTION`, `ServerResolver.resolve()` is **not called** when `message.config` is present (Stage 3, path 1). Resolution is bypassed entirely.

However, if `message.config` were ever `undefined` (due to serialization failure or future code change), the flow falls through to `getClientResult()` (L313), which:

```
getClientResult() @ background.ts L53-89:
  → ServerResolver.resolve()
  → IF activeClient exists → returns cached client (L77-78) ← STALE RISK
  → ELSE → factory.create(activeServer)
```

**Invariant**: `activeClient` is a module-level singleton that may point to a different adapter type than the user's current config.

---

### Stage 5 — Client Instantiation

**File**: [`ClientFactory.ts`](file:///mnt/e/CTRL/extension/src/entities/client/lib/ClientFactory.ts) — Lines 34–86

```
factory.create(config) @ L34:
  → ClientFactory.validate(config)  // hostname + type presence check (L36)
  → switch (config.type) {          // ROUTING DISCRIMINANT (L41)
      case 'qbittorrent': → new QBittorrentAdapter(config)   (L42-45)
      case 'transmission': → new TransmissionAdapter(config) (L51-54)
      ...
      default: throw Error('Unsupported client type')        (L83-84)
    }
```

**Routing key**: `config.type` (a free-form `string` field).

**Invariant**: `config.type` must exactly match a switch case. No normalization, no case-folding, no alias resolution.

---

### Stage 6 — Adapter Execution

#### TransmissionAdapter.testConnection()

**File**: [`TransmissionAdapter.ts`](file:///mnt/e/CTRL/extension/src/shared/api/clients/transmission/TransmissionAdapter.ts#L171-L175)

```typescript
async testConnection(): Promise<boolean> {
    await this.call('session-get');  // Lets exceptions bubble up
    return true;
}
```

- **Error propagation**: Exceptions from `call()` bubble up to `background.ts` L389, caught at L398, returned as `{ error: errorMessage }`.
- **409 handshake**: Handled correctly within `call()` (L227-249) with retry.

#### QBittorrentAdapter.testConnection()

**File**: [`QBittorrentAdapter.ts`](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L218-L230)

```typescript
async testConnection(): Promise<boolean> {
    try {
        await this.login();
        const v = await this.getAppVersion();
        return true;
    } catch (e) {
        console.error('[QBit] Connection Test Failed:', e);
        return false;  // ← SWALLOWS ERROR DETAILS
    }
}
```

- **Error propagation**: ALL errors are caught and **silently converted to `false`**. The background returns `false` to the UI.
- **UI impact**: At L175-180 in `ServerConfigPanel.tsx`:
  ```typescript
  if (res === true || ...) { /* success */ }
  else if (res && res.error) { /* shows error message */ }
  else { /* generic: "Connection test failed. Verify host, port, and credentials." */ }
  ```
  `false` matches the final `else`, producing a generic message with zero diagnostic value.

---

### Stage 7 — Network Layer

#### FetchHttpClient (used by TransmissionAdapter)

**File**: [`FetchHttpClient.ts`](file:///mnt/e/CTRL/extension/src/shared/api/network/FetchHttpClient.ts) — Lines 23–66

| Property | Value |
|---|---|
| Timeout | **10 seconds** (L26) |
| Credentials | `'omit'` (L38) |
| Origin/Referer | Auto-injected from `baseUrl` (L29-31) |
| AbortError message | `'Connection timed out after 10s'` (L62) |

**CORS behavior**: `credentials: 'omit'` avoids the CORS preflight complication where `Access-Control-Allow-Origin: *` is incompatible with credentialed requests.

#### QBittorrentAdapter.makeRequest() (bypasses FetchHttpClient)

**File**: [`QBittorrentAdapter.ts`](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts) — Lines 303–349

| Property | Value |
|---|---|
| Timeout | **30 seconds** (L43, L317) |
| Credentials | `'include'` (L323) |
| Origin/Referer | Manually injected from `baseUrl` (L311-313) |
| AbortError message | `'Request timeout after 30000ms'` (L345) |

**CORS behavior**: `credentials: 'include'` requires the server to return `Access-Control-Allow-Origin: <specific-origin>` (not `*`), AND `Access-Control-Allow-Credentials: true`. If the server returns `Access-Control-Allow-Origin: *`, the browser **silently blocks** the response.

---

### Stage 8 — Return Path

```
background.ts L389:  return await client.testConnection()
  → L407: handleMessage().then(sendResponse)   // Resolves with true, false, or { error }
  → chrome.runtime → ServerConfigPanel.tsx L173

UI timeout race @ L169-173:
  → Promise.race([responsePromise, setTimeout(5000ms)])
  → IF network takes >5s: catch fires with "Connection timed out. Check if the server is offline."
  → IF responsePromise resolves first: normal handling
```

**Timeout mismatch chain**:

| Layer | Timeout |
|---|---|
| UI (`ServerConfigPanel.tsx`) | **5 seconds** |
| `FetchHttpClient` (Transmission) | **10 seconds** |
| `QBittorrentAdapter.makeRequest()` | **30 seconds** |

---

## Invariant Violations (with Evidence)

### V1 — QBittorrentAdapter Error Swallowing

| Field | Value |
|---|---|
| **Classification** | ADAPTER BUG |
| **File** | [`QBittorrentAdapter.ts:218-230`](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L218-L230) |
| **Invariant** | `testConnection()` must propagate error details to caller |
| **Violation** | `catch (e) { return false; }` — error message is logged to console but never returned |
| **Impact** | UI always shows generic "Connection test failed" message; auth errors, IP bans, network failures all produce identical user-facing output |

**Evidence**: `testConnection()` at L218–230 catches ALL exceptions and returns `false`. The background handler at `background.ts:389` receives `false`, which the UI handler at `ServerConfigPanel.tsx:179-180` maps to the generic catch-all message.

**Contrast**: `TransmissionAdapter.testConnection()` at L171–175 lets exceptions bubble up, producing specific error messages like "Authentication failed" or "Cannot reach server".

---

### V2 — Dual-Timeout Mismatch (UI vs Network)

| Field | Value |
|---|---|
| **Classification** | ASYNC LIFECYCLE BUG |
| **File** | [`ServerConfigPanel.tsx:169-170`](file:///mnt/e/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx#L169-L170) vs [`FetchHttpClient.ts:26`](file:///mnt/e/CTRL/extension/src/shared/api/network/FetchHttpClient.ts#L26) |
| **Invariant** | UI timeout ≥ network layer timeout, so specific error reaches UI before generic timeout fires |
| **Violation** | UI timeout (5s) < FetchHttpClient timeout (10s) < QBit timeout (30s) |
| **Impact** | User sees "Connection timed out" while background is still waiting for a server response. The real error (auth failure, wrong port, DNS failure) never reaches the UI. |

**Evidence**: `ServerConfigPanel.tsx:170` — `setTimeout(() => reject(new Error('Connection timed out...')), 5000)`. `FetchHttpClient.ts:26` — `setTimeout(() => controller.abort(), 10000)`. `QBittorrentAdapter.ts:317` — `setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS)` where `REQUEST_TIMEOUT_MS = 30000` (L43).

---

### V3 — Credential Mode Inconsistency (CORS)

| Field | Value |
|---|---|
| **Classification** | ADAPTER BUG |
| **File** | [`FetchHttpClient.ts:38`](file:///mnt/e/CTRL/extension/src/shared/api/network/FetchHttpClient.ts#L38) vs [`QBittorrentAdapter.ts:323`](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L323) |
| **Invariant** | All adapters use consistent credential modes to ensure predictable CORS behavior |
| **Violation** | `FetchHttpClient` uses `credentials: 'omit'`; `QBittorrentAdapter` uses `credentials: 'include'` |
| **Impact** | qBittorrent requests are subject to stricter CORS requirements. If the server returns `Access-Control-Allow-Origin: *` (common for local network setups), Firefox blocks the response silently. TransmissionAdapter (via FetchHttpClient) is unaffected. |

**Evidence**: `FetchHttpClient.ts:38` — `credentials: 'omit'`. `QBittorrentAdapter.ts:323` — `credentials: 'include'`. The `QBittorrentAdapter` bypasses `FetchHttpClient` entirely, using raw `fetch()` at L320 in its own `makeRequest()`.

**Note**: qBittorrent relies on cookie-based session auth, which requires `credentials: 'include'`. This is an architectural constraint, not easily changed. However, MV3 extensions run in an isolated origin and may need to handle this differently.

---

### V4 — Stale `activeClient` Cache Risk

| Field | Value |
|---|---|
| **Classification** | STATE BUG |
| **File** | [`background.ts:77-78`](file:///mnt/e/CTRL/extension/src/entrypoints/background.ts#L77-L78) |
| **Invariant** | `activeClient` type matches current `activeServer.type` |
| **Violation** | `getClientResult()` returns cached `activeClient` without verifying it matches the resolved `activeServer` |
| **Impact** | If storage watchers (L246-263) fail to fire (race condition, worker restart), a qBittorrent client could answer requests intended for Transmission |

**Evidence**: `background.ts:77-78`:
```typescript
if (activeClient) {
    return { client: activeClient, state: ResolutionState.OK };
}
```
No check against `activeServer.type` or `activeServer.hostname`. The comment at L74-76 acknowledges the risk: *"we MUST NOT blindly return it if the activeServer has changed. For simplicity and correctness, we rely on the storage watchers below to clear activeClient."*

**Mitigation in place**: Storage watchers at L246-263 set `activeClient = null` on vault/key changes. Settings watcher at L268-271 also clears. However, watchers are asynchronous and non-transactional — a `getClientResult()` call during a watcher lag will return the stale client.

**For TEST_CONNECTION specifically**: This path is NOT normally hit because `message.config` is present, so `getTargetClient()` takes path 1 (direct factory creation at L279-284). This bug affects polling and other message types more than Test Connection.

---

### V5 — `config.type` / `config.application` Dual-Field Coupling

| Field | Value |
|---|---|
| **Classification** | ROUTING BUG |
| **File** | [`ServerConfigPanel.tsx:237-240`](file:///mnt/e/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx#L237-L240) |
| **Invariant** | `config.type` always equals `config.application` |
| **Violation** | Two separate `handleTempChange` calls in the same event handler — if `application` succeeds but `type` fails (React state batching edge case), they desync |
| **Impact** | `ClientFactory.create()` routes on `config.type`, which could differ from the visually selected application |

**Evidence**: `ServerConfigPanel.tsx:237-240`:
```typescript
onChange={(e) => {
    handleTempChange('application', e.target.value);
    handleTempChange('type', e.target.value);
}}
```

Both calls are in the same synchronous handler and React batches them, so desync is extremely unlikely but not impossible if `handleTempChange` has side effects. The `ServerConfig` type at `entities/server/model/types.ts:3-4` defines both `application: string` and `type: string` as independent fields.

**Practical likelihood**: Very low. React 18 batches state updates in the same event handler. However, the architectural debt of having two fields that must stay in sync is a latent risk.

---

## Rejected Hypotheses

### H1: "ServerResolver returns wrong server"

**Rejected**: For `TEST_CONNECTION`, `ServerResolver.resolve()` is never called. The UI sends `message.config` directly, and `getTargetClient()` takes path 1 at `background.ts:279-284`, creating a fresh adapter from the provided config. Server resolution is entirely bypassed.

### H2: "Vault encryption causes data corruption leading to wrong type"

**Rejected**: Vault data is only read by `ServerResolver.resolve()`, which is bypassed for `TEST_CONNECTION`. The `tempServer` config is transmitted in cleartext via `chrome.runtime.sendMessage`.

### H3: "ClientFactory has a default/fallback that instantiates qBittorrent"

**Rejected**: `ClientFactory.create()` at L83-84 throws `Error('Unsupported client type')` for unrecognized types. There is no fallback to any specific adapter. The `default` case in `ServerConfigPanel.tsx:startAdd()` (L65-74) initializes `application` and `type` to `'qbittorrent'`, but this only affects the initial form state for *new* servers.

---

## Root Cause Ranking

| Rank | Root Cause | Classification | Probability | Impact | Evidence Strength |
|---|---|---|---|---|---|
| **1** | V1: QBit error swallowing | ADAPTER BUG | **High** | **High** — users get zero diagnostic info for qBit failures | Definitive (code path is unambiguous) |
| **2** | V2: Dual timeout mismatch | ASYNC LIFECYCLE BUG | **High** | **High** — "timed out" message masks real errors | Definitive (5s < 10s < 30s) |
| **3** | V3: CORS credential inconsistency | ADAPTER BUG | **Medium** | **Medium** — Firefox-specific, affects qBit only | Strong (credentials mode differs) |
| **4** | V4: Stale `activeClient` cache | STATE BUG | **Low** for Test Connection; **Medium** for polling | **High** if triggered — wrong adapter type | Conditional (watchers usually fire in time) |
| **5** | V5: Dual-field coupling | ROUTING BUG | **Very Low** | **High** if triggered — wrong adapter type | Theoretical (React batching prevents in practice) |

---

## Minimal Stabilization Plan

### Target: V1 + V2 (highest probability, highest impact)

#### Fix 1: QBittorrentAdapter.testConnection() — Stop swallowing errors

**File**: `extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts`  
**Lines**: 218–230  
**Change**: ~4 lines modified

```diff
 async testConnection(): Promise<boolean> {
-    try {
-        console.log('[QBit] Testing Connection...');
-        await this.login();
-        console.log('[QBit] Login passed, checking version...');
-        const v = await this.getAppVersion();
-        console.log(`[QBit] Version response: ${v}`);
-        return true;
-    } catch (e) {
-        console.error('[QBit] Connection Test Failed:', e);
-        return false;
-    }
+    // Let exceptions bubble up so background.ts can return structured errors to UI
+    console.log('[QBit] Testing Connection...');
+    await this.login();
+    console.log('[QBit] Login passed, checking version...');
+    const v = await this.getAppVersion();
+    console.log(`[QBit] Version response: ${v}`);
+    return true;
 }
```

**Rationale**: Matches `TransmissionAdapter.testConnection()` behavior. The `background.ts` handler at L398-401 already catches exceptions and returns `{ error: errorMessage }` to the UI, which then displays the specific message at L178.

**Lines changed**: Net −5 (removal of try/catch block).

#### Fix 2: Align UI timeout above network timeout

**File**: `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`  
**Line**: 170  
**Change**: 1 line modified

```diff
-    setTimeout(() => reject(new Error('Connection timed out. Check if the server is offline.')), 5000)
+    setTimeout(() => reject(new Error('Connection timed out. Check if the server is offline.')), 15000)
```

**Rationale**: Set UI timeout (15 s) above `FetchHttpClient` timeout (10 s) so network-layer errors reach the UI before the generic timeout fires. The qBittorrent adapter has its own 30 s timeout but Fix 1 ensures errors propagate before that.

**Lines changed**: 1.

---

### Total Change: 2 files, ~6 lines net

- No architectural changes
- No manifest changes
- No permission changes
- No telemetry additions
- MV3 compliant
- No unrelated flow modifications

---

## Risk Assessment

| Fix | Risk Level | Regression Surface |
|---|---|---|
| Fix 1 (QBit error propagation) | **Low** | `testConnection()` only. All other qBit methods already throw. Background handler already has catch block. |
| Fix 2 (UI timeout increase) | **Very Low** | Only affects Test Connection button loading state duration. User sees "Testing..." for up to 15 s instead of 5 s, but real errors arrive in <10 s. |

| Residual Risk | Mitigation |
|---|---|
| V3 (CORS/qBit) still exists | Requires architectural decision on qBit cookies vs. `credentials: 'omit'` — out of scope for minimal fix |
| V4 (stale cache) exists for polling | Existing watchers provide sufficient mitigation; full fix requires invalidation-by-type comparison |
| V5 (dual field) exists | React batching prevents practical occurrence; fixing requires `ServerConfig` schema change |

---

## Validation Checklist

After applying the minimal stabilization:

- [ ] **qBittorrent auth failure**: Test with wrong password → UI must show "Authentication Failed" (not generic)
- [ ] **qBittorrent IP ban**: Trigger ban condition → UI must show ban message
- [ ] **qBittorrent unreachable**: Wrong port → UI must show "Connection timed out after 10s" (from FetchHttpClient, if qBit starts using it) or "Request timeout after 30000ms" (from qBit's own timeout)
- [ ] **Transmission 409 handshake**: Test normal connection → must succeed with session ID exchange
- [ ] **Transmission auth failure**: Wrong password → UI must show "Authentication failed"
- [ ] **UI timeout**: Server with artificial 12 s delay → UI shows network-layer error, NOT "Connection timed out"
- [ ] **CORS (Firefox, qBit)**: Test with local qBit → verify no silent CORS block (monitor console)
- [ ] **Adapter routing**: Add Transmission server, test → background log shows `[TransmissionAdapter]` not `[QBit]`
- [ ] **No regression**: Existing torrent list, pause/resume, add URL all function normally
- [ ] **Build clean**: `npm run build` succeeds for Chrome MV3 and Firefox MV3

---

*End of report.*
