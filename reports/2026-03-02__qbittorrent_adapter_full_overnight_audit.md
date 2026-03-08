# qBittorrent Adapter — Full Overnight Audit

**Date:** 2026-03-02  
**Scope:** qBittorrent adapter subsystem only  
**Mode:** Read-only — no code, tests, configs, manifests, CSP, permissions, or architecture were modified  
**Baseline:** CTRL_BASELINE.md — **Unknown State** (file not found); CTRL_SYSTEM_STATE.md — **Unknown State** (file not found)

---

## 1) Evidence Alignment Table

Sources:
- **[DRR]** = `deep-research-report.md`
- **[ARCH]** = `docs/reference/adapter__qbittorrent__architect_prompt.md`
- **[BUILD]** = `docs/reference/adapter__qbittorrent__builder_prompt.md`
- **[IMPL]** = `extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts`
- **[SCHEMA]** = `extension/src/shared/api/clients/qbittorrent/QBittorrentSchema.ts`
- **[TEST]** = `extension/tests/unit/adapters/QBittorrentAdapter.test.ts`
- **[IFACE]** = `extension/src/entities/client/model/ITorrentClient.ts`

> All line references below were verified against the repo files at audit time. DRR claims are tagged **UNVERIFIED** (cannot browse web) but used to derive checklist items.

### Auth / Session / Cookie Handling

| # | Requirement (Source) | Status | Evidence (file:line) |
|---|---|---|---|
| A1 | Login uses `POST /api/v2/auth/login` with `application/x-www-form-urlencoded` (DRR L31, L42-43) | **Implemented** | [IMPL L76-84](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L76-L84): `URLSearchParams` is used as body → browser sends `x-www-form-urlencoded` by default |
| A2 | Login success = 200 + body `"Ok."` (DRR L48-49) | **Implemented** | [IMPL L87-107](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L87-L107): body checked for `"Fails."` and `IP_BANNED`; any non-matching 200 is treated as success |
| A3 | Login failure (legacy) = 200 + body `"Fails."` (DRR L52, L169) | **Implemented** | [IMPL L94-101](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L94-L101): checks `responseText.includes('Fails.')` → throws |
| A4 | Login failure (WebAPI ≥2.14.0) = HTTP 401 (DRR L53, L170, L228) | **Missing** | [IMPL L329-331](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L329-L331): `makeRequest` throws `HttpError` on any `!response.ok`, but the `login()` catch block at L110 only checks for `403`, not `401`. A 401 login failure falls through to the generic `throw error` at L119 without incrementing `loginAttempts` |
| A5 | IP banned = 403 + body contains `"Your IP address has been banned..."` (DRR L54, L171) | **Implemented** | [IMPL L91-93](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L91-L93): checked via `responseText.includes(…)` in 200-OK path; [IMPL L110-115](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L110-L115): checked in 403 catch path |
| A6 | Cookie name is NOT safe to hardcode as `SID` (DRR L59-61, L239, L304) | **Implemented (implicit)** | [IMPL L320-324](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L320-L324): uses `credentials: 'include'` → delegates cookie management to browser; never hardcodes `SID`. Correct approach. |
| A7 | Exponential backoff / circuit-breaker for login attempts (DRR L283; ARCH §2.4) | **Implemented** | [IMPL L41-42, L58-70](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L41-L70): `MAX_LOGIN_ATTEMPTS=3`, backoff computed from `LOGIN_BACKOFF_BASE_MS=2000` with `pow(2, MAX)` cooldown |
| A8 | Logout via `POST /api/v2/auth/logout` (DRR L32) | **Implemented** | [IMPL L123-129](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L123-L129) |
| A9 | `testConnection` should validate auth + connectivity (DRR L152-158) | **Partial** | [IMPL L218-230](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L218-L230): calls `login()` then `getAppVersion()` (uses `app/version`). DRR recommends `app/webapiVersion` as the better "ping" signal. Implementation uses `app/version` which is functionally equivalent but doesn't populate `apiVersion` cache. Catch-all swallows **all** errors → returns `false` with no error detail propagated to caller. |

### CSRF / Origin / Referer

| # | Requirement (Source) | Status | Evidence (file:line) |
|---|---|---|---|
| C1 | Set `Origin` header to match target host (DRR L207, L243-244, L264) | **Implemented** | [IMPL L311-313](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L311-L313): `headers.set('Origin', origin)` and `headers.set('Referer', origin + '/')` |
| C2 | `credentials: 'include'` for cross-origin cookie attach (DRR L237, L263) | **Implemented** | [IMPL L323](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L323) |

### Status Codes and Error Semantics

| # | Requirement (Source) | Status | Evidence (file:line) |
|---|---|---|---|
| S1 | Handle 200 + `"Fails."` as auth failure (DRR L52, L169, L173, L205) | **Implemented** | [IMPL L94](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L94) |
| S2 | Handle HTTP 401 as auth failure for WebAPI ≥2.14.0 login (DRR L53, L170) | **Missing** | See A4 above. `login()` catch at L110 checks only `error.status === 403` |
| S3 | Handle HTTP 403 as either session expired or IP ban (DRR L54, L91, L194) | **Implemented** | [IMPL L110-118](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L110-L118) for login; [IMPL L367](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L367) for session expiry re-auth |
| S4 | Handle HTTP 409 (all adds fail, WebAPI ≥2.14.0) (DRR L103, L106, L180) | **Missing** | [IMPL L170-173](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L170-L173): `addTorrentUrl` delegates to `makeAuthenticatedRequest` which throws generic `HttpError` on 409 but no specific error class or message is produced |
| S5 | Handle HTTP 415 (invalid torrent file) (DRR L102, L114, L187) | **Missing** | Same as S4 — generic `HttpError` thrown, no semantic distinction |
| S6 | Handle HTTP 204 as success (no content) (DRR L206, L225, L271) | **Partial** | [IMPL L329-331](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L329-L331): `!response.ok` check will pass 204 (204 is "ok"), but [IMPL L333-334](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L333-L334): `response.text()` returns `""` → returns `{}` as T. This works but may violate caller expectations that expect `void`. |
| S7 | Handle HTTP 405 (wrong method, v4.4.4+) (DRR L23, L92, L287) | **Missing** | No specific handling. Generic `HttpError` thrown. |
| S8 | Session expiry re-auth on 401 or 403 (DRR L91, L194; ARCH §4.1) | **Implemented** | [IMPL L367](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L367): checks `error.status === 401 || error.status === 403` |

### Endpoint Naming / API Contract

| # | Requirement (Source) | Status | Evidence (file:line) |
|---|---|---|---|
| E1 | Pause = `torrents/stop` (qBittorrent v5.0+ naming) (DRR L119) | **DRIFT DETECTED** | [IMPL L195](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L195): uses `torrents/pause` (legacy v4 naming). DRR L119 documents qBittorrent v5.0 wiki names the endpoint `torrents/stop`. **Both names may work** per backward compatibility, but the adapter does not version-gate. |
| E2 | Resume = `torrents/start` (qBittorrent v5.0+ naming) (DRR L123) | **DRIFT DETECTED** | [IMPL L202](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L202): uses `torrents/resume` (legacy v4 naming). Same drift as E1. |
| E3 | Delete = `torrents/delete` with `deleteFiles` param (DRR L129-132) | **Implemented** | [IMPL L209-216](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L209-L216) |
| E4 | Add by URL = `POST torrents/add` with `multipart/form-data` (DRR L96-100) | **Implemented** | [IMPL L158-174](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L158-L174): uses `FormData` correctly |
| E5 | Add by file = field name `torrents` (DRR L112) | **Implemented** | [IMPL L178](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L178): `form.append('torrents', file)` |
| E6 | Version detection via `app/webapiVersion` (DRR L154, L218) | **Implemented** | [IMPL L139](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L139) |
| E7 | App version via `app/version` (DRR L161, L213) | **Implemented** | [IMPL L149](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L149) |
| E8 | Tags API (`torrents/tags`, `torrents/addTags`, `torrents/removeTags`) (DRR L143-148) | **Implemented** | [IMPL L250-267](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L250-L267) |
| E9 | Categories API (`torrents/categories`, `torrents/setCategory`) (DRR L139-140) | **Implemented** | [IMPL L238-248](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L238-L248) |

### Status Mapping

| # | Requirement (Source) | Status | Evidence (file:line) |
|---|---|---|---|
| M1 | `metaDL` → downloading (DRR via BUILD §4.2) | **Implemented** | [IMPL L407](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L407) |
| M2 | `stalledDL` → stalled (distinct from downloading) (BUILD §4.2) | **Implemented** | [IMPL L412-413](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L412-L413) |
| M3 | `checkingResumeData` → checking (BUILD §4.2) | **Implemented** | [IMPL L426](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L426) |
| M4 | `missingFiles` → error (BUILD §4.2) | **Implemented** | [IMPL L429](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L429) |
| M5 | `movingStorage` state (undocumented in DRR) | **Missing** | No case for `movingStorage` in `mapStatus`. Falls to default → `unknown`. |

### Test Coverage

| # | Requirement (Source) | Status | Evidence (file:line) |
|---|---|---|---|
| T1 | Auth success (200 + `"Ok."`) | **Covered** | [TEST L61-71](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L61-L71) |
| T2 | Auth failure (200 + `"Fails."`) | **Covered** | [TEST L73-77](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L73-L77) |
| T3 | IP ban detection | **Covered** | [TEST L79-83](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L79-L83) |
| T4 | Login attempt tracking / lockout | **Covered** | [TEST L85-99](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L85-L99) |
| T5 | CSRF header injection | **Covered** | [TEST L101-118](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L101-L118) |
| T6 | Session re-auth on 403 | **Covered** | [TEST L122-135](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L122-L135) |
| T7 | Session re-auth on **401** | **Missing** | No test stubs a 401 for session expiry |
| T8 | Auth failure via HTTP **401** (WebAPI ≥2.14.0) | **Missing** | No test for 401 login response |
| T9 | `addTorrent` with 200 + `"Fails."` body (legacy add failure) | **Missing** | No test for add endpoint returning error body |
| T10 | `addTorrent` with HTTP 409 (all adds fail) | **Missing** | No test stubs a 409 response |
| T11 | `addTorrent` with HTTP 415 (invalid file) | **Missing** | No test stubs a 415 response |
| T12 | `testConnection` success | **Covered** | [TEST L354-363](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L354-L363) |
| T13 | `testConnection` network failure | **Covered** | [TEST L365-371](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts#L365-L371) |
| T14 | `testConnection` auth failure (wrong creds) | **Missing** | No test for `testConnection` when login actually throws auth error (returns `false` but no assertion that error message is surfaced) |
| T15 | HTTP 204 (no-content success) | **Missing** | No test verifies adapter behavior on 204 |
| T16 | Request timeout handling | **Missing** | No test for `AbortError` / timeout path |

---

## 2) Findings

### F1 — Missing 401 handling in `login()` catch block
- **Classification:** ROOT CAUSE
- **Evidence:** [IMPL L110](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L110) checks `error.status === 403` only. WebAPI ≥2.14.0 returns 401 for invalid credentials (DRR L53, L170, L228). A 401 on login bypasses both `loginAttempts` tracking and IP-ban body inspection → the circuit breaker is ineffective against v5.0+ servers.
- **Impact:** On qBittorrent v5.0+ with WebAPI ≥2.14.0, the adapter will throw generic `HttpError` on bad credentials, will not count the attempt toward the lockout limit, and will not warn the user about remaining attempts.

### F2 — Endpoint naming drift: `pause`/`resume` vs `stop`/`start`
- **Classification:** CONFIRMED BEHAVIOR (with drift risk)
- **Evidence:** [IMPL L195](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L195) uses `torrents/pause`; [IMPL L202](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L202) uses `torrents/resume`. DRR L119, L123 documents the v5.0 wiki naming as `torrents/stop` and `torrents/start`.
- **Impact:** qBittorrent v5.0 currently supports both legacy and new names (confirmed by existing tests passing). However, future versions may deprecate the old names. No version-gating logic exists.

### F3 — `testConnection()` swallows all errors, returns no detail
- **Classification:** SYMPTOM
- **Evidence:** [IMPL L218-230](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L218-L230): catch-all returns `false` regardless of error type (network, auth, IP ban, timeout). The `ITorrentClient` contract at [IFACE L57](file:///mnt/e/CTRL/extension/src/entities/client/model/ITorrentClient.ts#L57) defines `testConnection(): Promise<boolean>` — no room for error detail.
- **Impact:** UI displays a generic failure, cannot distinguish "wrong password" from "IP banned" from "unreachable". This was previously identified in conversation `c8899fa6` and addressed in `34668031` at the UI layer, but root-cause error propagation from the adapter is still missing.

### F4 — No semantic handling of HTTP 409, 415, or 405
- **Classification:** REGRESSION (potential)
- **Evidence:** No specific code paths for these status codes. They all fall through to generic `HttpError`. DRR documents:
  - 409 = all adds fail (DRR L103, L106)
  - 415 = invalid torrent file (DRR L102, L114)
  - 405 = wrong HTTP method (DRR L23, L92)
- **Impact:** Users receive opaque HTTP error messages instead of actionable feedback ("All torrents failed to add", "Invalid torrent file", "Method not allowed — update adapter").

### F5 — `login()` HttpError catch reads response body via `error.response.text()` after it was already consumed
- **Classification:** ROOT CAUSE
- **Evidence:** [IMPL L329-340](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L329-L340): `makeRequest` calls `response.text()` (consuming the `ReadableStream`), then if `!response.ok`, throws `HttpError(response.status, statusText, response)` at L330-331 **before** reaching L333. But note: L329 checks `!response.ok` *first*, so the body is **not** consumed before the throw. However, the `HttpError` stores the original `response` object. At [IMPL L112](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L112), `error.response?.text?.()` attempts to re-read the body. Since `makeRequest` threw *before* calling `response.text()`, this second read **should** succeed. ✓
- **Re-classification:** FALSE POSITIVE — On closer reading, `makeRequest` throws `HttpError` at L330 before consuming the body at L333. The body is available for the catch block. ✓

### F6 — `makeRequest` returns `{} as T` for empty response bodies
- **Classification:** CONFIRMED BEHAVIOR
- **Evidence:** [IMPL L334](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L334): `if (!text) return {} as T`. For endpoints that return 200 with empty body (e.g., `torrents/pause`), the adapter returns an empty object cast to the generic type. Callers like `pauseTorrent` ignore the return value (`Promise<void>`), so this is benign.
- **Impact:** Low. Works correctly for current usage. Could surprise callers expecting `string` or `undefined`.

### F7 — `testConnection` uses `app/version` instead of `app/webapiVersion`
- **Classification:** CONFIRMED BEHAVIOR
- **Evidence:** [IMPL L223](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L223) calls `getAppVersion()` → `app/version`. DRR L152-158 recommends `app/webapiVersion` as the optimal authenticated ping (deterministic, low-cost, and provides capability info).
- **Impact:** Low — both are authenticated endpoints. But `testConnection` misses the opportunity to populate `this.apiVersion` for subsequent feature gating.

### F8 — No test coverage for HTTP 401 login (WebAPI ≥2.14.0) or session re-auth on 401
- **Classification:** REGRESSION (test gap)
- **Evidence:** [TEST](file:///mnt/e/CTRL/extension/tests/unit/adapters/QBittorrentAdapter.test.ts): no test stubs a 401 response for login or for authenticated-request re-auth. The `makeAuthenticatedRequest` code at [IMPL L367](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L367) does handle 401 for re-auth, but this is untested.
- **Impact:** Silent regression risk — if the 401 re-auth path breaks, no test catches it.

---

## 3) Highest-Leverage Next Action

**Fix root cause: Add 401 handling to `login()` catch block** (Finding F1)

This is the single highest-leverage fix because:
1. It closes the most dangerous contract gap — qBittorrent v5.0+ returns 401 for bad credentials, and the current adapter fails to count that attempt toward the lockout limit
2. Without this fix, the exponential backoff circuit breaker (which exists and is otherwise well-implemented) is completely bypassed on modern qBittorrent servers
3. The fix is surgical (≤5 lines changed in one function) with no architectural implications
4. It unblocks a matching test to be added (T8), increasing regression coverage

---

## 4) Execution Prompt

> **For: Implementation Agent**

### Objective

Add HTTP 401 handling to the `login()` method's catch block in `QBittorrentAdapter.ts` so that on qBittorrent servers running WebAPI ≥2.14.0, invalid credentials (which return 401 instead of 200+"Fails.") correctly increment `loginAttempts`, check the response body for IP ban text, and throw a user-friendly error. Add a corresponding unit test.

### Scope Boundary

**Files allowed to edit:**
- `extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts`
- `extension/tests/unit/adapters/QBittorrentAdapter.test.ts`

### Explicitly Forbidden

- Do NOT modify `manifest.json`, any CSP rules, permissions, architecture files, or any files outside the two listed above
- Do NOT refactor `makeRequest` or `makeAuthenticatedRequest`
- Do NOT change the `ITorrentClient` interface
- Do NOT modify `QBittorrentSchema.ts` or any service files
- Do NOT add new dependencies

### Implementation Steps

1. In `QBittorrentAdapter.ts`, in the `login()` method's catch block (around line 110), extend the `HttpError` status check from `error.status === 403` to `error.status === 403 || error.status === 401`:

   ```typescript
   if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
       const body = await error.response?.text?.() || '';
       if (body.includes(QB_ERROR_MESSAGES.IP_BANNED)) {
           throw new Error('IP has been banned by qBittorrent.');
       }
       this.loginAttempts++;
       const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - this.loginAttempts;
       throw new Error(
           `Authentication Failed (${error.status}). ` +
           `${remainingAttempts} attempts remaining before lockout protection.`
       );
   }
   ```

2. In `QBittorrentAdapter.test.ts`, add a test case in the `login` describe block:

   ```typescript
   it('should handle 401 response for invalid credentials (WebAPI ≥2.14.0)', async () => {
       mockFetch('', false, 401);
       await expect(adapter.login()).rejects.toThrow('Authentication Failed');
   });
   ```

3. Add a second test to verify lockout tracking works with 401:

   ```typescript
   it('should track login attempts on 401 failures', async () => {
       mockFetch('', false, 401);
       await expect(adapter.login()).rejects.toThrow('2 attempts remaining');
       await expect(adapter.login()).rejects.toThrow('1 attempts remaining');
       await expect(adapter.login()).rejects.toThrow('0 attempts remaining');
       await expect(adapter.login()).rejects.toThrow('Login attempts exhausted');
   });
   ```

### Required Output

- **Markdown report** at `reports/YYYY-MM-DD__qbittorrent_401_login_handling_fix.md` containing:
  - File + line references for every change
  - Evidence that `loginAttempts` is now incremented for both 401 and 403
  - Regression check results

### Regression Check

Run: `cd /mnt/e/CTRL/extension && npm test`

Report pass/fail count and any failing test names. If tests cannot be run, state why explicitly.

---

*Audit complete. Stop.*
