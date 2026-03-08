# Deluge Adapter — Full Overnight Audit

**Date:** 2026-03-06  
**Scope:** Deluge adapter only — docs vs implementation  
**Baseline State:** Unknown State (`CTRL_BASELINE.md` / `CTRL_SYSTEM_STATE.md` not found)

---

## 1 — Evidence Alignment

| # | Requirement / Claim (from docs) | Status | Evidence (file : lines) |
|---|---|---|---|
| **A1** | **Two-Gate handshake**: `auth.login` → `web.connected` → `web.get_hosts` → `web.connect` | **Implemented** | `DelugeAdapter.ts:143-156` (`login`), `:114-136` (`ensureDaemonConnection`) |
| **A2** | **Session re-auth loop**: On error code 1, re-login and retry | **Implemented** | `DelugeAdapter.ts:167-205` (`ensureAuth`) – checks code 1, message patterns |
| **A3** | **Check-before-login pattern** (`auth.check_session` / `web.connected` before re-login) | **Implemented** | `DelugeAdapter.ts:102-108` (`checkSession`), `:184-189` (call checkSession inside ensureAuth) |
| **A4** | **Daemon disconnection recovery** (code 2 + `core.*` → reconnect daemon) | **Implemented** | `DelugeAdapter.ts:197-201` – detects `UNKNOWN_METHOD` on `core.*` calls |
| **A5** | **Error code constants** (1–5, -32600, -32601, -32700) | **Partial** | `DelugeAdapter.ts:12-18` — codes 1-5 defined; standard JSON-RPC codes (-32600, -32601, -32700) are **not** defined |
| **A6** | **Request timeout protection** (docs §5.3: "implement a timeout on all requests") | **Implemented** | `DelugeAdapter.ts:30,66-95` — 30 s AbortController timeout |
| **A7** | **Connection cache TTL** (avoid redundant `web.connected` calls) | **Implemented** | `DelugeAdapter.ts:32,115-118` — 5 s cache |
| **A8** | **Host status pre-check** (`web.get_host_status` before `web.connect`, docs §3.2 Step 3) | **Missing** | `ensureDaemonConnection` calls `web.get_hosts` then immediately `web.connect` without checking status |
| **A9** | **`auth.delete_session` logout** | **Implemented** | `DelugeAdapter.ts:158-160` |
| **A10** | **Version detection** (`daemon.info` → parse major) | **Implemented** | `DelugeAdapter.ts:490-510` (`getVersion`, `is2xOrHigher`) |
| **A11** | **Batch removal** (`core.remove_torrents` on 2.x, fallback on 1.x) | **Implemented** | `DelugeAdapter.ts:301-314` |
| **B1** | **`core.add_torrent_file`** with base64 + filename + options | **Implemented** | `DelugeAdapter.ts:267-281` |
| **B2** | **`core.add_torrent_url`** with options | **Implemented** | `DelugeAdapter.ts:254-265` — calls `core.add_torrent_url` (covers URLs); no separate `core.add_torrent_magnet` call |
| **B3** | **Pause / Resume** with batch `[id]` wrapper | **Implemented** | `DelugeAdapter.ts:283-289` |
| **B4** | **Force recheck** (`core.force_recheck`) | **Implemented** | `DelugeAdapter.ts:651-655` |
| **B5** | **Queue manipulation** (top / up / down / bottom) | **Implemented** | `DelugeAdapter.ts:660-683` |
| **B6** | **`core.set_torrent_options`** full options including `sequential_download`, `super_seeding`, etc. | **Implemented** | `DelugeAdapter.ts:452-456`, `DelugeSchema.ts:92-108` — all documented options present |
| **B7** | **File priority management** (0, 1, 5, 7 values; `file_priorities` key) | **Implemented** | `DelugeAdapter.ts:567-600`, `DelugeSchema.ts:117` |
| **B8** | **Peer & tracker introspection** | **Implemented** | `DelugeAdapter.ts:609-641`, `DelugeSchema.ts:134-155` |
| **B9** | **Tracker replace semantics** (set replaces full list) | **Implemented** | `DelugeAdapter.ts:635-641` with doc comment |
| **B10** | **Label plugin**: `get_labels`, `set_torrent`, `add`, `remove`, `get_options`, `set_options` | **Implemented** | `DelugeAdapter.ts:334-718` |
| **B11** | **Plugin detection** (`core.get_enabled_plugins`, `system.listMethods`, namespace check) | **Implemented** | `DelugeAdapter.ts:373-414` |
| **B12** | **AutoAdd / Scheduler / Execute plugins** (docs §6.2-6.4) | **Partial** | Factory methods exist (`DelugeAdapter.ts:744-763`) with lazy imports; actual plugin files not in audit scope |
| **B13** | **Event poller** (`web.register_event_listener` + `web.get_events`, docs §7) | **Partial** | Factory at `DelugeAdapter.ts:724-735`; implementation in external `DelugeEventPoller.ts` (not in scope) |
| **B14** | **Torrent status fields**: extended fields (time_added, active_time, seeding_time, total_done, etc.) | **Implemented** | `DelugeSchema.ts:20-49` — all documented fields present with proper optional markers |
| **B15** | **`addTorrentUrl` uses `core.add_torrent_url` not `core.add_torrent_magnet`** | **Partial** | `DelugeAdapter.ts:263` — always calls `core.add_torrent_url` even for magnet URIs. Docs specify `core.add_torrent_magnet` for magnets. Likely works because Deluge daemon accepts magnets via either method, but is **not** the documented best practice |
| **B16** | **Peer count version compatibility** (2.x `peer.num_peers_connected` vs 1.x `num_peers`) | **Missing** | Schema has only `num_peers` / `num_seeds` (both optional). No `peer.num_peers_connected` / `peer.num_seeds_connected` fields, no fallback helper |
| **B17** | **`web.update_ui`** used for primary torrent fetch (efficient single-payload) | **Implemented** | `DelugeAdapter.ts:216` |

---

## 2 — Findings

| # | Finding | Classification |
|---|---|---|
| **F1** | **`web.get_host_status` pre-check is missing** — `ensureDaemonConnection` calls `web.connect` on the first host from `web.get_hosts` without verifying the host is "Online". If the only host is offline, `web.connect` will hang or fail silently (docs architect §3.2 Step 3). | **ROOT CAUSE** |
| **F2** | **Standard JSON-RPC error codes not defined** — codes -32600, -32601, -32700 from docs architect §5.1 are absent. The `call()` method would surface these as generic errors without structured handling. | **SYMPTOM** |
| **F3** | **`addTorrentUrl` does not distinguish magnet from URL** — always uses `core.add_torrent_url`. While this works in practice (daemon accepts magnets via both methods), it deviates from the documented API split (`core.add_torrent_magnet` for magnets). | **FALSE POSITIVE** |
| **F4** | **No Deluge 2.x peer count fields** — `peer.num_peers_connected` / `peer.num_seeds_connected` not in schema, no version-aware fallback helper. Builder docs §4.1 explicitly recommend this. | **SYMPTOM** |
| **F5** | **`testConnection` returns `boolean` only** — catches all errors and returns `false`. The caller receives no diagnostic information (e.g., "no daemons" vs "wrong password" vs network timeout). | **CONFIRMED BEHAVIOR** |
| **F6** | **No `addTorrentMagnet` method** — the `ITorrentClient` interface presumably only requires `addTorrentUrl`, so this is not a contract violation, but it means magnet-specific options cannot be targeted. | **FALSE POSITIVE** |
| **F7** | **Unit tests cover happy-path and basic error paths** — login handshake, re-auth loop, status mapping, label plugin fallback, and testConnection are all exercised. No tests for daemon disconnection recovery (code 2), host-status pre-check, or batch removal. | **REGRESSION** (gap in coverage) |

---

## 3 — Highest-Leverage Next Action

> **Add validation guard** — in `ensureDaemonConnection`, call `web.get_host_status(hostId)` before `web.connect(hostId)` and throw a descriptive error (`"Daemon Offline"`) if the host status is not `"Online"` or `"Connected"` (case-insensitive). This prevents silent hangs on offline daemons and directly addresses Finding F1.

---

## 4 — Execution Prompt (Completed)

**Status:** Completed on 2026-03-06. Evidence: `reports/2026-03-06__deluge_host_status_guard_fix_report.md`.

PROMPT CONTRACT
- Model(s): Gemini 3 Flash (preferred); Gemini 3.1 Pro (low) fallback
- Reasoning level: Medium
- Chat context: new chat
- Conversation mode: fast

PROMPT:
```text
Modify these files only:
- `extension/src/shared/api/clients/deluge/DelugeAdapter.ts`
- `extension/tests/unit/adapters/DelugeAdapter.test.ts`

In `DelugeAdapter.ensureDaemonConnection()`, before `web.connect(hostId)`, call `web.get_host_status(hostId)` and verify the returned status string is `"Online"` or `"Connected"` (case-insensitive). If it is not, throw:
`new Error(\`Deluge daemon is offline: ${hosts[0][1]}:${hosts[0][2]}\`)`.

Add/adjust unit tests to cover:
- The multi-step handshake path when not connected, including the new `web.get_host_status` call.
- An explicit offline-daemon case that asserts the descriptive error message.

Run `cd extension && npm test` and summarize pass/fail.

Write an editable Markdown report to `reports/2026-03-06__deluge_host_status_guard_fix_report.md` including:
- File paths and final line references for changes.
- A small diff/evidence snippet for the new guard and tests.
- A brief rationale citing Finding F1 in `reports/2026-03-06__deluge_adapter_full_overnight_audit.md`.
- A short `npm test` summary.
```

EXECUTION STATUS REPORT
- Objective: Prevent slow timeouts by failing fast when the Deluge daemon host is offline (Finding F1).
- Prompt issued: Add `web.get_host_status` pre-check in `ensureDaemonConnection` and add unit test coverage.
- Expected output: Offline daemon throws a descriptive error; handshake tests updated; test suite run; fix report written.
- Completion criteria: Changes limited to the two allowlisted files; tests pass; report created at the specified path.
- Blocking inputs (if any): None.
- Next-step condition: If tests fail, stop and request triage direction.

---

*Audit complete. Stopping.*
