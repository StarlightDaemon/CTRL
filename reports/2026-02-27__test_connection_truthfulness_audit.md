# Test Connection Truthfulness Audit

**Date:** 2026-02-27  
**Scope:** "Test Connection" pipeline semantics and UI truthfulness  
**Baseline:** CTRL_BASELINE.md — **Unknown State** (not found). CTRL_SYSTEM_STATE.md — **Unknown State** (not found).

---

## 1  Evidence Alignment

### Log evidence

| Log file | Key lines | Observation |
|---|---|---|
| `console-export-2026-2-24_22-36-26.log` L22-24, L29-31, L100-102, L130-132 | `XHR POST http://localhost:9091/transmission/rpc [HTTP/1.1 409 Conflict 0ms]` | Every Transmission RPC call produces an initial 409 (CSRF handshake). The retry with the session header succeeds — but the 409 itself is visible in the console *before* the success log. |
| Same log L33, L104, L109, L114, L134 | `{"event":"TEST_CONNECTION_RESULT",…"resultShape":"true","errorMessage":null}` | Background reports `resultShape: "true"` for **every** test — including ones right after vault wipe (L125 `state=NO_SERVERS`). This means the client was constructed from `message.config` (transient form data), **not** from persisted state. |
| `console-export-2026-2-21_0-27-45.log` L33 | Same `resultShape: "true"` pattern | Corroborates the above across sessions. |

### Code-path map

```
UI click → ServerConfigPanel.testConnection (L157-171)
  ↓  chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', config: tempServer })
Background handleMessage (L275-417)
  ↓  getTargetClient() — sees message.config, creates client from transient config (L279-284)
  ↓  client.testConnection() — calls adapter (L389)
  ↓  return result (L400)
UI receives res:
  if (res === true)  → "Connection Successful!"   (L162)
  else               → "Authentication Failed"    (L164)
```

---

## 2  Findings

### F-1  ROOT CAUSE — UI error-response blindness

[ServerConfigPanel.tsx L162-164](file:///mnt/e/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx#L162-L164):

```ts
if (res === true) {
    setTestStatus({ loading: false, success: true, message: 'Connection Successful!' });
} else {
    setTestStatus({ loading: false, success: false, message: 'Authentication Failed' });
}
```

When the background catches an error it returns `{ error: string }` ([background.ts L410-413](file:///mnt/e/CTRL/extension/src/entrypoints/background.ts#L410-L413)). This is **not** an exception, so the UI's `catch` block never fires. The `else` branch fires, but:
- The actual `res.error` string (e.g. "Vault is locked", "Cannot reach server") is **discarded**.
- The user always sees the **misleading** label `"Authentication Failed"` regardless of the real cause.

> **Impact:** Every non-success result (timeout, network unreachable, vault locked, wrong port) displays as "Authentication Failed".

### F-2  ROOT CAUSE — Transmission adapter cannot return `false`

[TransmissionAdapter.ts L180-184](file:///mnt/e/CTRL/extension/src/shared/api/clients/transmission/TransmissionAdapter.ts#L180-L184):

```ts
async testConnection(): Promise<boolean> {
    await this.call('session-get');
    return true;
}
```

The method either succeeds → `true`, or throws. It **never returns `false`**. The `ITorrentClient` contract ([ITorrentClient.ts L53-57](file:///mnt/e/CTRL/extension/src/entities/client/model/ITorrentClient.ts#L53-L57)) documents "Returns true if successful, **false otherwise**", making the implementation non-conforming.

The background's outer `catch` converts the thrown error to `{ error: string }`, which triggers F-1 above.

### F-3  CONFIRMED BEHAVIOR — QBittorrent adapter correctly returns `false`

[QBittorrentAdapter.ts L218-230](file:///mnt/e/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts#L218-L230):

```ts
async testConnection(): Promise<boolean> {
    try { … return true; }
    catch (error) { … return false; }
}
```

QBittorrent wraps in try/catch and returns `false` on failure. However, `false` is still not `=== true`, so the UI shows "Authentication Failed" instead of the real error — **same misleading label** (F-1).

### F-4  CONFIRMED BEHAVIOR — Test Connection always uses transient config

[background.ts L279-281](file:///mnt/e/CTRL/extension/src/entrypoints/background.ts#L279-L281):

```ts
if (message.config) {
    return { client: await factory.create(message.config) };
}
```

Because `ServerConfigPanel.testConnection` passes `config: tempServer`, the background always constructs a *new* client from the UI form, never from `ServerResolver`. This means Test Connection tests the **currently-edited** config, which is the correct behavior. The log `configSource: "message.config"` confirms this across all observed tests.

### F-5  SYMPTOM — misleading "adapterType" in instrumentation log

Log lines show `"adapterType":"rs"` instead of `"TransmissionAdapter"`. This is a minification artifact (`client.constructor.name` is minified in production builds). Not a functional bug, but it reduces diagnostic utility.

### F-6  FALSE POSITIVE — "Test Connection shows success when client is off"

The logs show successful connections (`resultShape: "true"`) when the Transmission daemon **is** reachable (localhost:9091 responding with 409 CSRF → retry → 200). There is no log evidence of a false positive where the daemon is off and the test still succeeds. The 409-then-success pattern is Transmission's **normal** CSRF handshake and is handled correctly by the adapter's retry logic ([TransmissionAdapter.ts L239-261](file:///mnt/e/CTRL/extension/src/shared/api/clients/transmission/TransmissionAdapter.ts#L239-L261)).

---

## 3  Summary Table

| ID | Classification | File | Lines |
|----|---------------|------|-------|
| F-1 | **ROOT CAUSE** | ServerConfigPanel.tsx | 162-164 |
| F-2 | **ROOT CAUSE** | TransmissionAdapter.ts | 180-184 |
| F-3 | CONFIRMED BEHAVIOR | QBittorrentAdapter.ts | 218-230 |
| F-4 | CONFIRMED BEHAVIOR | background.ts | 279-281 |
| F-5 | SYMPTOM | background.ts | 396 |
| F-6 | FALSE POSITIVE | — | — |

---

## 4  Selected Next Action

> **Fix root cause** — Make `ServerConfigPanel.testConnection` inspect `res.error` before falling through to the generic label.

This is the single highest-leverage fix because:
1. It surfaces the real error message to the user for **all** adapters and **all** failure modes.
2. It requires changing only 1 file, ~5 lines.
3. It makes F-2 (Transmission adapter throwing instead of returning `false`) irrelevant to user experience, since the UI will now extract and display `res.error` regardless.

---

## 5  Execution Prompt

PROMPT CONTRACT
- Model(s): Gemini 3 Flash (preferred); Gemini 3.1 Pro (low) fallback
- Reasoning level: Medium
- Chat context: continue current chat
- Conversation mode: fast

PROMPT:
```text
Update `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx` only.

In `testConnection()`, after receiving `res` from `chrome.runtime.sendMessage(...)`:
1) If `res === true`, keep the existing success status and message.
2) If `res` is an object with a truthy string field `error`, display that error string to the user.
3) If `res === false`, display `Connection failed`.
4) Otherwise, display `Connection Error`.

Remove the hard-coded `"Authentication Failed"` label so non-auth errors are not mislabeled.
Preserve the existing try/catch around `sendMessage` for runtime exceptions.

Run `cd extension && npm test`. Summarize pass/fail and any relevant failures (if any).

Write an editable Markdown report to `reports/2026-02-27__test_connection_ui_error_display_fix_report.md` containing:
- The exact file edited and the final line references of the change.
- A small diff snippet showing the change.
- A brief rationale referencing F-1 in `reports/2026-02-27__test_connection_truthfulness_audit.md`.
- A short summary of the `npm test` output.
```

EXECUTION STATUS REPORT
- Objective: Fix Test Connection UI to display real background error strings (F-1) instead of a generic, misleading label.
- Prompt issued: Update `ServerConfigPanel.tsx` `testConnection()` response-shape handling and messaging.
- Expected output: UI shows `res.error` when present; generic fallback messages otherwise; tests run and summarized.
- Completion criteria: Code change limited to the allowlisted file; `npm test` run; report written.
- Blocking inputs (if any): None.
- Next-step condition: If `npm test` fails, report the failures and stop for triage direction.
