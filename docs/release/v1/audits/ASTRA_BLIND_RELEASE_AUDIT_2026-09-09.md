---
artifact: CTRL Astra Independent Blind Release Audit
audit_date: 2026-09-09
role: independent adversarial repository/release assessment
status: historical assessment evidence; findings require reconciliation against current repository state before implementation
source_agent: Astra
blindness_note: dedicated prior audits were quarantined, but repository operational state exposed some earlier conclusions before source reconstruction
---

# Decisions Supported by Evidence

**CTRL is not ready for either store. It needs targeted repairs, a smaller verified support surface, and a reproducible release process—not a rewrite.**

The strongest evidence supports these decisions:

- Fix server identity and stale-response handling before enabling public queue control.
- Replace the incorrect positional diff mechanism with reliable snapshots initially.
- Preserve AES-GCM encryption and the current session-only vault key design; repair vault consistency, corruption handling, and export sanitization.
- Treat every torrent client as **unverified end to end** until tested against a real server in both browsers.
- Reject the existing Firefox package as a release candidate: Mozilla’s validator reports a missing mandatory add-on ID.
- Replace contradictory privacy claims with an accurate account of communication with user-configured servers.
- Establish one authoritative source-to-package process before producing submission artifacts.

These are audit recommendations. No implementation authority was assumed.

# Decisions Requiring Operator Choice

The material decisions are:

1. **Client scope:** verify a small initial set, or delay release until all nine implementations pass.
2. **Transport policy:** support explicitly disclosed HTTP connections to user-controlled local/LAN clients, or require HTTPS except loopback.
3. **Page scanning:** retain and repair bulk magnet scanning, or remove it and its `scripting`/`activeTab` permissions from v1.
4. **Browser support:** establish a narrow tested desktop baseline, or fund older-browser compatibility and consent fallbacks.
5. **Release surface:** ship an English-first core product, or finish the broader settings, localization, and auxiliary features.
6. **Publisher identity:** choose the permanent Firefox add-on ID and complete the applicable publisher/trader declarations.

Detailed alternatives appear below. None prevents completing this audit.

# Critical Findings

| Rank | Finding | Evidence | Consequence |
|---|---|---|---|
| 1 | **AST-STATE-001:** stale server A results can replace B’s display; a command from that stale row routes to B | Controlled execution of the current background module | Wrong-server queue operations |
| 2 | **AST-STATE-002:** list diffs corrupt identity/order during replacement, removal, and reordering | Executed current diff generator and patch applicator | Incorrect or missing rows |
| 3 | **AST-SEC-001–003:** cross-window lock divergence, corrupt-vault false unlock, and incomplete safe-export sanitization | Chrome test and source execution | Misleading lock boundary, configuration loss, secret disclosure |
| 4 | **AST-NET-001–003:** XML serialization, cookie-session handling, and qBittorrent version assumptions are defective | Source execution, browser Fetch probes, official client source/API | Advertised clients cannot be accepted as working |
| 5 | **AST-FF-001 / AST-BUILD-001:** Firefox metadata and source/rebuild preparation are inadequate | Official validator and package inspection | Firefox submission/review blocked |

The wrong-server reproduction used synthetic clients and `deleteData: false`. **No real torrent was removed, and file deletion was not demonstrated.**

# Important Unknowns

- No real torrent-client environment was available or safely established. Login, add, pause, resume, remove, and reconnect remain unverified against actual servers.
- Firefox was not available for runtime testing.
- Chrome tests used the existing generated build; that build was not independently rebuilt from the audited working tree.
- The non-localhost, host-permission-granted behavior of qBittorrent’s CSRF checks remains unresolved.
- Mozilla’s treatment of unencrypted connections to user-controlled LAN servers needs explicit resolution for the chosen release scope.
- Store-account configuration, repository visibility, hosted policy availability, reviewer credentials, and completed listing assets were not established.
- Repeated clean builds and source-archive rebuilds were not performed because the normal process changes tracked files.

# Verification Performed

**Target**

| Item | Recorded state |
|---|---|
| Repository | CTRL |
| Root / working directory | `E:\Citadel\CTRL` |
| Application | `E:\Citadel\CTRL\extension` |
| Branch | `main` |
| HEAD | `f088c5f857d4f229534562f8c87c92bf4ba66df9` |
| Commit date | July 15, 2026, 11:53:02, UTC−06:00 |
| Commit subject | `chore: ignore AppleDouble and .DS_Store files` |
| Remote | `git@github.com:StarlightDaemon/CTRL.git` |
| Local upstream comparison | `origin/main`: 0 ahead, 0 behind; no fetch |
| Visibility | Unknown; authenticated GitHub inspection unavailable |
| Relevant tag | `pre-dependabot-delete-backup` |
| Stash | Existing generated-build-information stash; untouched |
| Worktrees | Main checkout only; no existing isolated checkout suitable for builds |
| Staged changes | None |

**Pre-existing work was present.** Modified paths included RAIDEN state, Serena configuration/memories, the package manifest/lockfile, background, context menus, and `KeyManager`. A Serena architecture memory was deleted; two Serena memories and `KeyManager.test.ts` were untracked. Final status matched the initial path/status inventory.

Repository instructions were inspected, including the RAIDEN navigation, state, open loops, and agent guide. The managed Writ boundary was respected.

**Blindness limitation:** the initial instruction-loading batch exposed operational state containing earlier review conclusions before source reconstruction. Consequently, this is **not a pristine blind pass**. Those conclusions were not used as proof. Dedicated previous reports were quarantined, and no comparison with another assessment was performed.

**QUARANTINED — NOT READ DURING BLIND PASS:**

- All six reports under `.audits/`, including the dated audit/exploration files.
- All files under `reports/`.
- `audit-reports/audit-2026-05-13.md`.
- `.raiden/state/LEGACY_REVIEW.md`.
- `extension/audit_extension.txt` and `extension/audit_extension_after_fix.txt`.
- Historical build logs, browser reports, and console exports.
- `docs/reference/`, withheld to avoid historical-review and store-research anchoring.

Packaged copies of historical reports were identified by filename without reading their contents.

**Diagnostics**

| Check | Result |
|---|---|
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit` — passed |
| ESLint | `node node_modules/eslint/bin/eslint.js src --ext .ts,.tsx` — 0 errors, 31 warnings |
| Unit tests | 16 files, **530 tests passed** |
| Diff probes | Reordering, replacement, and removal failures reproduced |
| Background probe | Delayed A result published after B; stale-row command routed to B |
| Viewport probes | New subscriber received no snapshot; outside-viewport total change emitted no update |
| Vault probe | Missing ciphertext with retained salt allowed incorrect-password “unlock” |
| Safe-export probe | Main passwords removed; `clientOptions.simpleApiKey` retained |
| Network probe | XML converted to a JSON string; caller AbortSignal replaced |
| Chrome | Installed Chrome **152.0.7977.83**, isolated temporary profiles |
| Chrome surfaces | Existing popup/options loaded; setup completed with synthetic credentials |
| Chrome lock test | Another open options window remained unlocked after session-key removal |
| Chrome Fetch | Wire inspection confirmed browser-controlled Origin, absent manual Cookie/Referer, preserved explicit Authorization, inaccessible `Set-Cookie` |
| Firefox runtime | Not performed: no available Firefox environment |
| Real-client tests | Not performed: no suitable verified client environment |
| Mozilla validator | `addons-linter@10.10.0`: **1 error, 5 warnings** |
| Dependency audit | Latest fresh result: **15 affected package nodes: 6 high, 8 moderate, 1 low**; all identified nodes marked development dependencies |
| Builds | Not run: canonical commands mutate tracked build metadata |
| Packages | Existing Firefox ZIP, automatic source ZIP, Chrome and Firefox unpacked outputs inspected |

The unit command used Vitest’s runner configuration loader with an in-memory `__dirname` binding to avoid its normal generated configuration cache:

```text
node --input-type=module -e 'globalThis.__dirname=process.cwd(); process.argv=[process.argv[0],"vitest","run","--no-cache","--configLoader","runner"]; await import("./node_modules/vitest/vitest.mjs");'
```

This was a diagnostic invocation of the existing suite, not a claim that an unmodified `npm test` invocation was run.

The validator was installed/executed through a temporary npm cache outside the repository. Temporary Chrome profiles and synthetic loopback diagnostics likewise stayed outside the repository.

**Policy-check date: September 9, 2026.** Official sources and their application are recorded below.

- Files changed in repository: **none**
- Commits created: **none**
- Pushes: **none**
- Merges: **none**
- Releases: **none**
- Deployments: **none**
- Store submissions: **none**

# Product and Architecture Reconstruction

CTRL is a browser-based remote controller for torrent clients. Its intended user already operates a torrent daemon or Web UI and wants to send links and manage its queue without repeatedly opening that client.

**Reviewer-safe purpose sentence:**

> CTRL sends torrent links to a torrent client chosen by the user and displays and controls that client’s download queue.

The manifest communicates this general purpose. The documentation weakens it by overstating client verification, language coverage, and privacy guarantees. The core functions form one coherent purpose; unrelated resource links and unfinished settings dilute it.

CTRL observes configured client responses and, upon an explicit context-menu action, magnet links in the current page. It stores encrypted server configuration, preferences, an in-memory-session encryption key, and a session cache of torrent metadata. It transmits authentication material, links, and commands to configured clients. The clients—not CTRL—download content, contact peers, and manage files.

```text
User
 ├─ Popup ─────────────── GET_TORRENTS polling / add messages ─────┐
 ├─ Options ── Zustand sparse torrent store ◄─ viewport messages ─┤
 │             │                          active-session port ────┤
 │             └─ settings hooks / vault hooks                    │
 └─ Context menu ── link/selection or explicit page scan ──────────┤
                                                                 ▼
                 Background: resolver → client factory → adapter
                    │              │                    │
                    │              │                    ├─ direct Fetch: qBittorrent
                    │              │                    └─ shared Fetch / JSON-RPC
                    │              │                              │
                    │              └─ encrypted server configs    ▼
                    │                                   User-configured client
                    ├─ 2-second active polling
                    ├─ 1-minute idle alarm
                    ├─ viewport/diff broadcasts
                    └─ session torrent cache

Browser storage.local: encrypted vault + salt + preferences
Browser storage.session: encryption key + torrent cache

No persistent content scripts, external messaging API,
web-accessible resources, or developer telemetry service found.
```

WXT generates MV3 manifests. Chrome uses a service worker; Firefox receives background scripts. React renders popup/options; Zustand owns the options torrent display. Zod validates many adapter responses and imported configuration. `tsyringe` and `reflect-metadata` support decorators, though the factory explicitly constructs adapters.

## Repository inventory

Approximately **129 TypeScript/TSX source files, 19,117 lines**, with about **10,397 lines in client implementations**. There are 21 test/spec files in the inspected test tree.

| Area | Purpose / complexity | Runtime and test assessment |
|---|---|---|
| Entrypoints | Background orchestration and two UIs; high risk | Critical ownership and concurrency gaps; no adequate lifecycle integration coverage |
| Client adapters | Nine types, extensive optional APIs; high complexity | Strongest unit-test concentration; browser contracts insufficiently tested |
| Shared transport | Fetch, JSON-RPC, errors, retries; modest size, high impact | Cross-cutting encoding/authentication defects |
| Security | Key derivation, encrypted vault, session key | Good primitives; weak transaction and multi-context behavior |
| Torrent state | Poller, viewport manager, diff, hydrator, Zustand | Several interacting owners; deterministic failures reproduced |
| Settings/UI | Server setup, import/export, appearance, diagnostics | Duplicate vault/settings snapshots; unfinished controls |
| Styling/assets | Carbon, Tailwind, Plex, two icon systems | Generated font duplication dominates distribution |
| Tests/CI | Unit tests, Chromium E2E, build jobs | Useful foundation; missing release-critical contract tests |
| Release scripts | Metadata generation, builds, ZIPs, backups | Multiple competing package paths; tracked-file mutation |
| Repository process | RAIDEN, Serena, historical reports | Development context, not extension runtime; should stay out of release sources unless necessary |

Dead/legacy candidates include the no-op `HeaderRewriter`, unused keepalive/DOM parsing helpers, duplicate client interfaces, unconsumed settings, and numerous adapter capabilities without a UI consumer. These are scope/debt candidates, not a mandate for wholesale cleanup.

# User Journey Reconstruction

| Stage | Actual behavior | Release implication |
|---|---|---|
| 1. Install | MV3 manifests and optional endpoint access | Chrome package loads; Firefox metadata blocks signing |
| 2. First launch | Popup directs unconfigured users to setup; options presents vault setup | Coherent starting point |
| 3. Onboarding | Password setup precedes server configuration | After setup, empty queue incorrectly appears online |
| 4. Permissions | Server UI checks/requests endpoint-origin access | Denial/revocation recovery needs browser testing |
| 5. Credentials | Saved through encrypted vault | Existing open contexts can retain decrypted snapshots |
| 6. Server setup | Client selector, split address fields, test/save | IPv6/path handling and accessible labels deficient |
| 7. Add torrent | Popup message supports global paused default; advanced dialog supplies explicit values | Defaults differ across entrypoints |
| 8. Queue/status | Background viewport updates plus separate popup polling | Stale results, incorrect diffs, misleading connectivity |
| 9. Context menu | Add link/selection; explicit paused add; optional page scan | Scan immediately adds all found links; no preview/deduplication |
| 10. Settings | Many persisted preferences | Several affect previews or no runtime consumer |
| 11. Locked state | Session key removed; initiating UI locks | Other windows remain visually unlocked |
| 12. Revoked permission | No dedicated revocation-driven reset/recovery state established | Stale data and generic network errors possible |
| 13. Server unavailable | Adapter errors exist | Options connection banner remains “Online”; actions lack reliable feedback |
| 14. Extension restart | Session cache hydrates background | Cache lacks server/generation provenance |
| 15. Browser restart | Session key should disappear, requiring unlock | Actual full restart acceptance not performed |
| 16. Upgrade | Legacy key purge runs on background wake; plaintext migration path exists | Good mechanisms; interrupted/corrupt migration remains untested |
| 17. Backup/import/export | Validates imports before writes; exports JSON | Safe export leaks a supported API key; snapshots can diverge |
| 18. Uninstall | Browser-managed extension storage removal; remote torrents remain | No remote cleanup feature; exported files remain user-owned |

# Findings Ledger

“Blocks responsible quality bar” means this audit recommends withholding release. It does **not** mean a store has an automated rule detecting the defect.

## AST-STATE-001 — Commands and responses lack stable server identity

**Priority:** P0  
**Type:** Data integrity / command routing  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [background.ts](/E:/Citadel/CTRL/extension/src/entrypoints/background.ts:150), [TorrentRow.tsx](/E:/Citadel/CTRL/extension/src/entities/torrent/ui/TorrentRow.tsx:25), `ServerResolver`, `useTorrentStore`.

**Finding / importance / root cause:** Commands contain a torrent ID but no stable server identity. Background resolution uses the current server, while poll completion publishes results without checking the server generation. Configuration-array indexes are not durable identities.

**Proof:** Executing the current background module with controlled clients produced snapshots `B → A` after switching A to B. A subsequent stale-A-row removal message for ID `7` invoked B’s remove method with `deleteData:false`. Numeric IDs can identify different torrents on different Transmission servers.

**Falsification:** A production invariant binding displayed rows, commands, and responses to immutable server identities would disprove the routing defect. None was found; clearing `activeClient` did not prevent the reproduction.

**Treatment:** Minimum: stable server IDs, generation-tagged responses, stale-result rejection, display reset, and explicit command targets. Ambitious: a complete per-server operation/state manager. **Preferred:** the minimum coherent ownership change, with serialized polling.

**Files/subsystems:** Background, server configuration/resolver, message types, UI store, row actions, hydration.  
**Dependencies:** Agreed identity/migration contract.  
**Acceptance / verification:** Delayed A cannot update B; stale commands are rejected or explicitly target A; overlapping numeric IDs never cross-route. Test controlled delays and two real servers.  
**Scope:** L.  
**Deferral:** Wrong-server queue operations remain possible.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-STATE-002 — Positional diffs do not preserve torrent identity

**Priority:** P1  
**Type:** State correctness  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [TorrentDiffer.ts](/E:/Citadel/CTRL/extension/src/shared/lib/diff/TorrentDiffer.ts:33), `applyTorrentPatches`, `useTorrentStore`.

**Finding / root cause:** The generator matches by ID but writes modifications to the new positional index without moving the original item. Add/remove operations can overwrite and then delete the same slot.

**Proof:** `[A10,B20] → [B25,A10]` yielded `[A25,B20]`; `[A] → [B]` yielded an empty record; removing A from `[A,B]` left B at an index inconsistent with the new count.

**Why it matters:** Queue identity/order and visible status become unreliable. This alone does not prove file deletion.

**Falsification:** A sorting/identity invariant preventing all replacements, removals, and reorderings would be needed. Real queue operations invalidate that assumption.

**Treatment:** Minimum: full viewport snapshots on identity/order changes. Ambitious: ID-keyed entities plus ordered ID lists and versioned patches. **Preferred:** snapshots first; retain diffing only after measured need.

**Files:** Diff, viewport manager, store.  
**Dependencies:** AST-STATE-001’s identity contract.  
**Acceptance / verification:** Applying updates equals the complete expected list for reorder, insertion, deletion, replacement, and metadata changes.  
**Scope:** M.  
**Deferral:** Corrupt display survives passing unit tests.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-STATE-003 — Viewport synchronization has one global subscriber baseline

**Priority:** P1  
**Type:** Multi-context / lifecycle correctness  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [ViewportManager.ts](/E:/Citadel/CTRL/extension/src/features/torrent-control/services/ViewportManager.ts:14), [useTorrentPoller.ts](/E:/Citadel/CTRL/extension/src/features/torrent-control/model/useTorrentPoller.ts:48).

**Finding / root cause:** One viewport and previous slice serve all windows. Unchanged slices emit nothing, including when total count changes outside the slice. Disconnect handling logs without reconnecting.

**Proof:** A second same-range subscription emitted zero messages; increasing total count from one to two outside the viewport also emitted zero messages.

**Importance:** New windows can lack an initial snapshot; windows interfere with one another; restarted backgrounds can leave stale displays.

**Falsification:** A guaranteed independent initial snapshot/subscription baseline would invalidate the new-window concern. No such protocol was found.

**Treatment:** Minimum: explicit initial snapshot and resynchronization, total-count updates, reconnect handling. Ambitious: subscriber-specific ranges/revisions. **Preferred:** independently synchronized snapshots before optimized subscriptions.

**Files:** Viewport manager, poller, background ports, hydrator.  
**Dependencies:** STATE-001/002.  
**Acceptance / verification:** Two windows with different ranges remain correct through restart, reconnect, and offscreen list changes.  
**Scope:** M.  
**Deferral:** Intermittently empty/stale queues.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-SEC-001 — Vault state and decrypted snapshots diverge across contexts

**Priority:** P1  
**Type:** Local security / configuration integrity  
**Confidence:** CONFIRMED for lock divergence; HIGH-CONFIDENCE for stale-save consequences  
**Evidence class:** SOURCE TRACE, LIVE BROWSER TEST  
**Browsers:** Both by source; Chrome reproduced  
**Evidence:** [useVault.ts](/E:/Citadel/CTRL/extension/src/features/torrent-control/model/useVault.ts:40), [useSettings.ts](/E:/Citadel/CTRL/extension/src/features/torrent-control/model/useSettings.ts:125), [options App.tsx](/E:/Citadel/CTRL/extension/src/entrypoints/options/App.tsx:35).

**Finding / root cause:** Hooks keep separate decrypted snapshots without watching vault/session changes. Options overlays one snapshot onto another. Imports and concurrent edits can leave stale server arrays available for later writes.

**Proof:** Removing the session key in one Chrome options context left another displaying its unlocked dashboard. Source shows settings reload does not refresh the independent vault snapshot.

**Importance:** Locking does not consistently redact open UIs; stale configuration writes may overwrite newer changes. This is not evidence of remote password bypass.

**Falsification:** Cross-context invalidation and revision-checked writes would disprove it; current subscriptions do not provide them.

**Treatment:** Minimum: shared vault-state notifications, immediate redaction, revision-aware reload/save. Ambitious: all vault operations owned by background. **Preferred:** one authoritative vault interface with minimal UI-held secrets.

**Files:** Vault hooks, settings hooks, options composition, import/save paths.  
**Dependencies:** STATE-001 identity scheme.  
**Acceptance / verification:** Lock all windows; import/edit in one refreshes others; stale saves are rejected.  
**Scope:** L.  
**Deferral:** Misleading security boundary and lost edits.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-SEC-002 — Missing vault ciphertext is accepted as an empty valid vault

**Priority:** P1  
**Type:** Corruption handling / data integrity  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [VaultService.ts](/E:/Citadel/CTRL/extension/src/shared/api/security/VaultService.ts:54).

**Finding / root cause:** Initialization is inferred from salt alone. `getServers()` returns `[]` when ciphertext is absent; unlock treats that return as successful password verification. Salt and ciphertext are written separately.

**Proof:** Initialize with synthetic data, lock, remove ciphertext while retaining salt, then supply an incorrect password: unlock returns true and servers are empty.

**Importance:** Interrupted writes/corruption can masquerade as successful unlock and invite destructive replacement. Missing credentials were not decrypted.

**Falsification:** Requiring a valid authenticated envelope before accepting initialization/unlock would prevent the reproduced result.

**Treatment:** Minimum: fail closed on incomplete state and validate decrypted shape. Ambitious: versioned atomic vault envelope plus recovery copy. **Preferred:** versioned envelope, explicit corruption state, non-destructive recovery.

**Files:** VaultService, SecurityService integration, setup/unlock UI, migration/import.  
**Dependencies:** Defined migration/recovery behavior.  
**Acceptance / verification:** Missing/truncated/wrong-type data never unlocks; wrong passwords fail; recovery preserves original data.  
**Scope:** M.  
**Deferral:** Configuration loss and false unlock success.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-SEC-003 — “Safe” export retains supported authentication material

**Priority:** P1  
**Type:** Secret disclosure  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [useSettings.ts](/E:/Citadel/CTRL/extension/src/features/torrent-control/model/useSettings.ts:209), BiglyBT Simple API configuration.

**Finding / root cause:** Sanitization clears only the main password and HTTP-auth password while spreading all remaining fields.

**Proof:** Running the actual export function with synthetic BiglyBT configuration retained `clientOptions.simpleApiKey` in a file labeled safe. Passthrough fields and credential-bearing URLs are not comprehensively classified either.

**Importance:** A user sharing a supposedly safe configuration may disclose credentials.

**Falsification:** Removing the key before serialization or proving it is unsupported/non-secret would falsify the specific case; current adapter code consumes it as an API key.

**Treatment:** Minimum: allowlist non-secret exported fields and explicitly sanitize endpoint userinfo. Ambitious: typed per-client secret schemas and encrypted full backups. **Preferred:** allowlisted safe export now; clearly labeled sensitive full export.

**Files:** Export/import schema, client configuration types, data-management UI.  
**Dependencies:** Supported-client inventory.  
**Acceptance / verification:** Synthetic secrets in every supported location never appear in safe exports; intentional full exports are clearly disclosed.  
**Scope:** M.  
**Deferral:** Credential leakage through normal sharing.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-NET-001 — Shared POST serialization breaks XML-RPC

**Priority:** P1  
**Type:** Protocol correctness  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [FetchHttpClient.ts](/E:/Citadel/CTRL/extension/src/shared/api/network/FetchHttpClient.ts:149), RuTorrentAdapter XML calls.

**Finding / root cause:** Non-FormData/non-URLSearchParams bodies are JSON-stringified and labeled JSON, including XML strings.

**Proof:** An XML request supplied with `text/xml` became a quoted JSON string with `application/json`.

**Importance:** The rTorrent/ruTorrent XML path cannot produce its intended wire protocol.

**Falsification:** A separate raw-body transport used by these calls would disprove it; the calls use this POST path.

**Treatment:** Minimum: explicit raw-body and JSON APIs. Ambitious: a complete protocol-aware request abstraction. **Preferred:** a small typed transport contract retaining native BodyInit values and caller content types.

**Files:** FetchHttpClient, RuTorrentAdapter, transport tests.  
**Dependencies:** Decision whether ruTorrent remains in v1.  
**Acceptance / verification:** Exact XML bytes/content type reach a loopback server, then pass a real configured XML-RPC endpoint.  
**Scope:** M.  
**Deferral:** Broken advertised client.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-NET-002 — Cookie clients and Flood initialization lack a working session contract

**Priority:** P1  
**Type:** Authentication / protocol correctness  
**Confidence:** HIGH-CONFIDENCE; browser restrictions CONFIRMED  
**Evidence class:** SOURCE TRACE, LIVE BROWSER TEST, OFFICIAL API DOCUMENTATION  
**Browsers:** Both; Fetch behavior tested in Chrome  
**Evidence:** FetchHttpClient; DelugeAdapter; UTorrentAdapter; FloodAdapter.

**Finding / root cause:** Shared Fetch defaults to `credentials:'omit'`. Deluge relies on a session cookie. uTorrent attempts to read `Set-Cookie` and manually set `Cookie`. Flood’s cookie fallback shares the omission, and a fresh adapter does not log in before normal list operations.

**Proof:** Chrome hid `Set-Cookie` and omitted manually supplied Cookie. Deluge’s own implementation creates and checks `_session_id`. Flood retries authentication only after `sessionVerified` is already true; factory construction does not initialize it. [Deluge authentication source](https://raw.githubusercontent.com/deluge-torrent/deluge/develop/deluge/ui/web/auth.py).

**Falsification:** Browser-owned cookie sessions with appropriate credentials, or a verified token-only protocol and guaranteed login bootstrap, could overturn specific client failures.

**Treatment:** Minimum: per-client authentication policy and initial-login contract. Ambitious: isolated session manager. **Preferred:** browser-managed cookies where required; do not add `cookies` permission merely to emulate Node HTTP.

**Files:** Shared transport, these adapters, factory lifecycle.  
**Dependencies:** Client/version scope and browser tests.  
**Acceptance / verification:** Clean-profile login/list/reconnect works with default server security settings.  
**Scope:** L.  
**Deferral:** Authentication failures hidden by mocks.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-NET-003 — qBittorrent support is not version-aware

**Priority:** P1  
**Type:** Client compatibility  
**Confidence:** HIGH-CONFIDENCE; endpoint mismatch CONFIRMED  
**Evidence class:** SOURCE TRACE, OFFICIAL API DOCUMENTATION  
**Browsers:** Both  
**Evidence:** [QBittorrentAdapter.ts](/E:/Citadel/CTRL/extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts:209).

**Finding / root cause:** Pause/resume calls target older endpoint names. The state mapper recognizes `pausedDL/pausedUP`, not the newer stopped states. Retrieved API-version information does not select a compatible implementation.

**Proof:** qBittorrent 5.0 documents and implements `stop`/`start`; its controller declarations contain those actions rather than pause/resume. [Official API](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-%28qBittorrent-5.0%29), [5.0 controller](https://raw.githubusercontent.com/qbittorrent/qBittorrent/release-5.0.0/src/webui/api/torrentscontroller.h).

**Importance:** A successful login/list does not establish functioning queue control.

**Falsification:** A supported deployed version providing compatibility aliases could reduce impact for that version. It would not justify unspecified version support.

**Treatment:** Minimum: support explicit verified versions and map their endpoints/states. Ambitious: capability negotiation covering advanced APIs. **Preferred:** a small version adapter for advertised core operations.

**Files:** qBittorrent adapter/schema/tests and support documentation.  
**Dependencies:** Chosen supported versions.  
**Acceptance / verification:** Real supported versions pass pause/resume/state-display tests.  
**Scope:** M.  
**Deferral:** Broken core actions on advertised configurations.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-NET-004 — CSRF handling relies on headers Fetch does not permit callers to control

**Priority:** P2  
**Type:** Browser networking compatibility  
**Confidence:** CONFIRMED limitation; PLAUSIBLE — VERIFY client impact  
**Evidence class:** SOURCE TRACE, LIVE BROWSER TEST  
**Browsers:** Both potentially; Chrome tested  
**Evidence:** QBittorrentAdapter `makeRequest`; FetchHttpClient.

**Finding / root cause:** Code tries to set server-origin Origin/Referer as though Fetch were a general HTTP client.

**Proof:** The extension-origin loopback request carried the browser’s extension Origin, not the supplied server Origin; manual Referer/Cookie were absent. Explicit Authorization remained present.

**Importance:** qBittorrent/proxy CSRF configurations may reject requests despite unit-test success.

**Falsification:** A host-permission-granted, non-localhost live test with normal server CSRF settings could show the supported configuration needs no workaround. That test remains missing.

**Treatment:** Minimum: remove false assumptions and establish the actual supported browser/server contract. Ambitious: browser-specific header intervention only if necessary and permitted. **Preferred:** evidence first; avoid adding DNR/webRequest or weakening server security speculatively.

**Files:** Transport and qBittorrent adapter.  
**Dependencies:** Live server environment.  
**Acceptance / verification:** Authenticated core operations work with documented security settings in both browsers.  
**Scope:** S investigation; repair unknown.  
**Deferral:** Unbounded compatibility claims.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-NET-005 — Cancellation and response-body timeouts are incomplete

**Priority:** P2  
**Type:** Reliability / resource management  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** [FetchHttpClient.ts](/E:/Citadel/CTRL/extension/src/shared/api/network/FetchHttpClient.ts:43).

**Finding / root cause:** The transport overwrites the caller’s signal and clears its timeout before consuming the response body. Adapter timeout wrappers can reject without stopping underlying work.

**Proof:** An already-aborted caller signal became a fresh non-aborted request signal. Source places timeout clearing before `response.text()`.

**Importance:** Slow requests can outlive cancellation, overlap polling, and publish stale results.

**Falsification:** A caller-independent cancellation mechanism covering body consumption would invalidate this; none was found.

**Treatment:** Minimum: combine caller cancellation with transport timeout and keep it active through body processing. Ambitious: operation-level cancellation and retry budgets. **Preferred:** shared transport repair plus generation rejection.

**Files:** FetchHttpClient, adapter timeout wrappers, poll orchestration.  
**Dependencies:** STATE-001.  
**Acceptance / verification:** Pre-abort, mid-body stall, switch, and lock terminate or safely discard work; timers are cleaned up.  
**Scope:** M.  
**Deferral:** Resource waste and delayed failure.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-UX-001 — Connectivity and command outcomes are misleading

**Priority:** P1  
**Type:** Core UX correctness  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, LIVE BROWSER TEST  
**Browsers:** Both; Chrome reproduced  
**Evidence:** [TorrentDashboard.tsx](/E:/Citadel/CTRL/extension/src/features/torrent-control/ui/TorrentDashboard.tsx:92), VirtualizedTorrentList, TorrentRow.

**Finding / root cause:** “Connection: Online” and “LIVE” are unconditional. Zero rows means “server empty” regardless of configuration/connectivity. Optimistic pause/resume ignores command results.

**Proof:** Fresh setup with no configured server displayed online/empty-server messaging.

**Importance:** Users cannot distinguish success, stale data, lack of configuration, or failure.

**Falsification:** Binding those surfaces to verified connection/operation state would prevent the observed behavior.

**Treatment:** Minimum: explicit unconfigured/locked/loading/connected/stale/error states and command acknowledgement with rollback. Ambitious: centralized operation history. **Preferred:** truthful states and actionable errors only.

**Files:** Dashboard, list, row actions, store, background response contract.  
**Dependencies:** STATE-001–003.  
**Acceptance / verification:** No server or failed request never appears connected; failed actions remain visible and recoverable.  
**Scope:** M.  
**Deferral:** Users act on false status.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-UX-002 — Global add-paused behavior differs by entrypoint

**Priority:** P1  
**Type:** Behavioral consistency  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE  
**Browsers:** Both  
**Evidence:** [ContextMenuService.ts](/E:/Citadel/CTRL/extension/src/features/torrent-control/model/services/ContextMenuService.ts:360), background add handler, AddTorrentDialog.

**Finding / root cause:** Normal runtime add applies the global default. Context-menu adds call adapters directly without it. Page scanning does likewise. The advanced dialog resets paused to false and submits that explicit value.

**Importance:** “Always add paused” can unexpectedly start a transfer, with bandwidth and peer-contact consequences.

**Proof:** The menu supplies `{}` or no options; only its explicit Add Paused action passes true. The background default is bypassed.

**Falsification:** A common downstream policy applying the global preference would invalidate this. Adapters do not have that global context.

**Treatment:** Minimum: one add-command policy with explicit overrides. Ambitious: capability-aware add planning/preview. **Preferred:** centralize defaults; hide bulk scan until behavior is clear.

**Files:** Background command layer, context menu, add dialog.  
**Dependencies:** Client paused capability tests.  
**Acceptance / verification:** Every add entrypoint honors the same default and explicit override.  
**Scope:** M.  
**Deferral:** Unexpected transfer activity.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-UX-003 — Endpoint editing cannot reliably represent supported URL forms

**Priority:** P2  
**Type:** Configuration correctness  
**Confidence:** CONFIRMED parsing limitation; deployment impact HIGH-CONFIDENCE  
**Evidence class:** SOURCE TRACE  
**Browsers:** Both  
**Evidence:** [ServerConfigPanel.tsx](/E:/Citadel/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx:231), adapter URL constructors.

**Finding / root cause:** String splitting on `:` conflates host/port/path and breaks IPv6 representation. Adapter base-path behavior also differs: Transmission forces `/transmission/rpc`; uTorrent appends `gui/`; others use relative paths.

**Importance:** Valid reverse-proxy/subpath configurations can be silently altered or sent to the wrong path.

**Falsification:** Round-trip tests preserving those URL forms would disprove the editor concern; the displayed parsing cannot preserve IPv6 as written.

**Treatment:** Minimum: a complete endpoint URL field with `URL` validation and per-client guidance. Ambitious: endpoint discovery. **Preferred:** explicit endpoints, no discovery for v1.

**Files:** Server panel, permission helper, adapter constructors.  
**Dependencies:** Supported endpoint contract.  
**Acceptance / verification:** IPv4, DNS, IPv6, ports, HTTPS, and supported subpaths round-trip exactly.  
**Scope:** M.  
**Deferral:** Setup failures and support burden.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-UX-004 — Core server configuration lacks accessible control labeling

**Priority:** P2  
**Type:** Accessibility  
**Confidence:** HIGH-CONFIDENCE  
**Evidence class:** SOURCE TRACE  
**Browsers:** Both  
**Evidence:** [ServerConfigPanel.tsx](/E:/Citadel/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx:201), virtualized list semantics.

**Finding / root cause:** Several labels are adjacent text without `htmlFor`, wrapping, or equivalent accessible names. The virtual list mixes list semantics with row-count attributes and lacks clear item position/set size.

**Importance:** Server setup and queue navigation may be difficult with assistive technology.

**Proof:** Source association gaps are explicit. A full screen-reader audit was not performed.

**Falsification:** Browser accessibility-tree inspection showing correct names and navigation would narrow the finding.

**Treatment:** Minimum: associated labels, descriptive errors, correct list semantics, keyboard acceptance. Ambitious: comprehensive WCAG audit. **Preferred:** repair core workflows now, then audit the broader surface.

**Files:** Server panel, list, dialogs, settings toggles.  
**Dependencies:** Final v1 UI scope.  
**Acceptance / verification:** Keyboard-only setup/control and a screen-reader pass succeed; focus survives errors/dialog close.  
**Scope:** M.  
**Deferral:** Excludes some users from configuration.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR**.

## AST-SCOPE-001 — Visible and declared capabilities exceed implemented behavior

**Priority:** P2  
**Type:** Product scope / least privilege  
**Confidence:** CONFIRMED for identified consumers  
**Evidence class:** SOURCE TRACE, STATIC CONFIGURATION, DOCUMENTATION CLAIM  
**Browsers:** Both  
**Evidence:** Function/notification/layout settings, translation script, manifest.

**Finding / root cause:** Notification style/level previews, layout preferences, and other surfaces lack corresponding runtime behavior. Performance mode is explicitly locked. Localization mixes hardcoded English with partial dictionaries; the translation script creates prefixed English placeholders. WebSocket host permissions have no live WebSocket client consumer.

**Importance:** Unsupported controls and broad claims increase review/support burden.

**Falsification:** Actual runtime consumers and complete language walkthroughs would promote individual features; saving a preference alone is insufficient.

**Treatment:** Minimum: hide unimplemented controls, remove unused WebSocket declarations, narrow claims. Ambitious: finish the features. **Preferred:** scope reduction.

**Files:** Settings, navigation, locale workflow, manifest, documentation.  
**Dependencies:** Operator scope decision.  
**Acceptance / verification:** Every visible setting has observable behavior; every declared permission supports retained functionality.  
**Scope:** M.  
**Deferral:** Misleading product surface and avoidable permission scrutiny.  
**Release classification:** **CONDITIONAL BLOCKER IF FEATURE IS ADVERTISED**.

## AST-FF-001 — Firefox package lacks mandatory submission metadata

**Priority:** P0  
**Type:** Store submission  
**Confidence:** CONFIRMED  
**Evidence class:** STATIC CONFIGURATION, BUILD ARTIFACT, PACKAGE INSPECTION, OFFICIAL POLICY  
**Browsers:** Firefox  
**Evidence:** [wxt.config.ts](/E:/Citadel/CTRL/extension/wxt.config.ts:14), packaged manifest, `addons-linter@10.10.0`.

**Finding / root cause:** No Gecko add-on ID or data-collection declaration is generated.

**Proof:** Validator error `ADDON_ID_REQUIRED`; warning `MISSING_DATA_COLLECTION_PERMISSIONS`. The latter being a warning does not waive the new-submission requirement.

**Importance:** Current ZIP fails the signing/submission prerequisite. [Mozilla manifest documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

**Falsification:** Inspecting a different release artifact with correct metadata could supersede this finding; the inspected ZIP has none.

**Treatment:** Minimum: permanent operator-owned ID, accurate data declarations, and supported-version policy. Ambitious: older-browser consent fallback. **Preferred:** desktop baseline using built-in consent.

**Files:** WXT manifest generation, consent handling, reviewer notes.  
**Dependencies:** Publisher ID and data-flow decisions.  
**Acceptance / verification:** Official validator has no errors; install consent matches actual behavior; signed Firefox smoke succeeds.  
**Scope:** M.  
**Deferral:** Firefox submission remains blocked.  
**Release classification:** **BLOCKS FIREFOX**.

## AST-PRIV-001 — Privacy statements contradict necessary product data flows

**Priority:** P1  
**Type:** Privacy / disclosure accuracy  
**Confidence:** CONFIRMED  
**Evidence class:** SOURCE TRACE, DOCUMENTATION CLAIM, OFFICIAL POLICY  
**Browsers:** Both  
**Evidence:** [PRIVACY_POLICY.md](/E:/Citadel/CTRL/docs/PRIVACY_POLICY.md:14), `docs/privacy.html`, network and hydration code.

**Finding / root cause:** Claims that credentials never leave the device and links are not sent externally conflict with remote-client operation. Torrent metadata is session-cached. “Only operates when explicitly interacted with” overlooks autonomous configured-client polling.

**Importance:** Users and reviewers receive an inaccurate explanation even though no developer telemetry was found.

**Proof:** Adapters transmit credentials/links; background polls; StateHydrator stores torrent records. Later exceptions in the policy do not repair contradictory absolutes.

**Falsification:** Removing those data flows would alter the product substantially; otherwise the statements must change.

**Treatment:** Minimum: accurate policy, in-product explanation, permission justification, and store declarations. Ambitious: redesign transmission consent per feature. **Preferred:** truthful disclosure matching narrowed scope.

**Files:** Both policies, onboarding, manifest declarations, listing materials.  
**Dependencies:** Final scope and HTTP decision.  
**Acceptance / verification:** Every data-inventory row maps to consistent policy/UI/store statements.  
**Scope:** M.  
**Deferral:** Misleading disclosures and review risk.  
**Release classification:** **BLOCKS BOTH STORES** for the proposed submission materials; not an automated manifest error. [Chrome privacy policy](https://developer.chrome.com/docs/webstore/program-policies/privacy).

## AST-BUILD-001 — Competing source-package paths do not establish a reproducible release

**Priority:** P1  
**Type:** Release provenance / packaging  
**Confidence:** CONFIRMED defects; rebuild result UNKNOWN  
**Evidence class:** SOURCE TRACE, BUILD ARTIFACT, PACKAGE INSPECTION  
**Browsers:** Both artifacts; Firefox review especially affected  
**Evidence:** [generate-build-info.ts](/E:/Citadel/CTRL/extension/scripts/generate-build-info.ts:10), [zip-source.ts](/E:/Citadel/CTRL/extension/scripts/zip-source.ts:14), existing source ZIP.

**Finding / root cause:** Normal builds rewrite tracked timestamps. `wxt zip` bypasses that script. Automatic source ZIP includes backups/reports. The authored source script uses a Windows-sensitive root-string comparison, demands a clean tree, and archives HEAD rather than arbitrary build inputs.

**Proof:** Source ZIP contains 183 backup files, two audit files, a build log, and a browser-report HTML. The loaded build displays a March build stamp. Canonical build metadata uses current time and locale.

**Importance:** Reviewer reconstruction and release provenance are unreliable.

**Falsification:** A clean source ZIP and documented repeatable command producing matching files would supersede the current evidence.

**Treatment:** Minimum: one allowlisted source/package path, fixed build inputs, portable path handling, complete instructions. Ambitious: hermetic build tooling. **Preferred:** simple deterministic build from a frozen source revision.

**Files:** Build/ZIP scripts, WXT config, release CI/docs.  
**Dependencies:** Final source, versions, metadata.  
**Acceptance / verification:** Rebuild the source ZIP in a clean environment; compare file sets/content with the submission package.  
**Scope:** L.  
**Deferral:** Unreviewable or unverifiable release.  
**Release classification:** **BLOCKS FIREFOX** until reviewer rebuild evidence exists.

## AST-PERF-001 — Distribution contains substantial duplicated font payload

**Priority:** P2  
**Type:** Packaging / performance  
**Confidence:** CONFIRMED  
**Evidence class:** PACKAGE INSPECTION, BUILD ARTIFACT  
**Browsers:** Both  
**Evidence:** Chrome/Firefox unpacked assets and content hashes.

**Finding / root cause:** 1,058 fonts occupy 37,816,320 bytes. Only 530 unique font contents exist; **18,868,316 bytes are duplicate font data**.

**Importance:** Larger installs, updates, and review artifacts. Startup latency or memory regressions were not measured.

**Falsification:** Hash comparison already establishes duplication; a different build can remove it.

**Treatment:** Minimum: remove duplicate font-copy/import routes and retain required weights/scripts. Ambitious: replace styling systems. **Preferred:** asset deduplication; preserve framework/UI choices.

**Files:** Font/CSS imports, Carbon/Plex integration, build asset handling.  
**Dependencies:** Language scope.  
**Acceptance / verification:** No duplicate-content font emission; visual checks for required glyphs; package-size baseline recorded.  
**Scope:** M.  
**Deferral:** Wasteful distribution, not an identified store size violation.  
**Release classification:** **ACCEPTABLE POST-LAUNCH**, preferably addressed while packaging is repaired.

## AST-TEST-001 — Existing verification misses demonstrated severe failure classes

**Priority:** P2  
**Type:** Test / release assurance  
**Confidence:** CONFIRMED  
**Evidence class:** AUTOMATED TEST, SOURCE TRACE, RUNTIME REPRODUCTION  
**Browsers:** Both  
**Evidence:** 530 passing tests; tests, Playwright fixtures, CI workflow.

**Finding / root cause:** Adapter mocks bypass browser request semantics; lifecycle/state/vault integration is sparse. Chromium E2E includes paths that skip when vault state is absent. Firefox runtime and source-rebuild gates are absent.

**Importance:** Green CI currently coexists with the reproduced defects.

**Falsification:** Existing tests that fail on those exact sequences would narrow the gap; the executed suite passed.

**Treatment:** Minimum: targeted contracts for the demonstrated classes and both-browser smoke. Ambitious: broad integration farm. **Preferred:** a small failure-focused release suite.

**Files:** Unit/integration/browser tests, CI, package validation.  
**Dependencies:** Stable message/transport/vault contracts.  
**Acceptance / verification:** Tests fail against current defects and pass after repairs; required scenarios cannot silently skip.  
**Scope:** L, spread across repair waves.  
**Deferral:** Regressions recur undetected.  
**Release classification:** **BLOCKS RESPONSIBLE QUALITY BAR** for missing critical evidence.

## AST-DEP-001 — Dependency advisories require triage, not indiscriminate upgrades

**Priority:** P2  
**Type:** Supply-chain maintenance  
**Confidence:** CONFIRMED advisory result; runtime exploitability NOT ESTABLISHED  
**Evidence class:** STATIC CONFIGURATION, AUTOMATED TEST, REASONED INFERENCE  
**Browsers:** Build/review environment primarily  
**Evidence:** Fresh `npm audit`, lockfile classifications.

**Finding / root cause:** The latest response reports 15 affected package nodes, including development tooling and propagated dependencies. Earlier cached/offline results were not reliable.

**Importance:** Build tools process source, archives, and assets; development-only status does not make all advisories irrelevant.

**Falsification:** Reachability analysis and patched/withdrawn advisories can resolve individual entries.

**Treatment:** Minimum: advisory-by-advisory reachability and bounded fixes. Ambitious: broad upgrades. **Preferred:** patch compatible vulnerable tools and test overrides; do not apply `npm audit fix --force`.

**Files:** Package/lockfile, overrides, build workflow.  
**Dependencies:** Frozen supported toolchain.  
**Acceptance / verification:** Each retained advisory has a documented disposition; patches preserve builds/tests/reproducibility.  
**Scope:** M.  
**Deferral:** Toolchain exposure and unresolved review questions.  
**Release classification:** **ACCEPTABLE POST-LAUNCH only with explicit reachability disposition**; not evidence of a remotely exploitable shipped extension.

# Networking and Supported Clients

**No row below means “live verified working.”**

| Client | Auth / transport / body | Current confidence | Browser verification | Main risk | v1 recommendation |
|---|---|---|---|---|---|
| qBittorrent | HTTP form login, browser SID cookie, JSON responses, multipart add | Plausible after repairs | Generic Chrome Fetch only | Older actions/states; CSRF/proxy behavior; auxiliary shared-client calls | Candidate core client after version-specific tests |
| Transmission | HTTP JSON RPC, explicit Basic, 409 session-header negotiation | Strongest static candidate | Explicit Basic header survived generic probe | Fixed root RPC path; numeric IDs; timeout/state races | First client to verify |
| Deluge | HTTP JSON RPC; password login plus `_session_id` | Not supportable as currently evidenced | Cookie restrictions confirmed | Shared credentials omission | Hide until session repair/live tests |
| ruTorrent/rTorrent | HTTP XML-RPC, optional Basic | Broken serialization confirmed | Exact body probe | JSON-encoded XML; endpoint convention also needs verification | Hide until protocol repair |
| Flood | HTTP JSON, Bearer when returned or cookie session | Unverified; bootstrap defect traced | Generic browser semantics only | Fresh adapter not authenticated; cookie fallback | Experimental |
| Aria2 | HTTP JSON-RPC, `token:` in parameters | Plausible basic support | No real client | Endpoint input; bounded list windows; shared timeout | Optional candidate after core tests |
| BiglyBT | Transmission-like JSON RPC; Basic; optional Simple API key | Unverified | None against client | Multiple protocol modes, query key, endpoint/timeouts | Experimental |
| uTorrent | Basic + token HTML + GUID cookie; query actions | Browser session mechanism defective | Set-Cookie/Cookie restriction confirmed | Token/cookie handling; `/gui/` construction | Hide |
| Vuze Remote UI | Transmission-derived implementation | Unverified inheritance, not independent compatibility evidence | None | Plugin/version assumptions | Hide until plugin-specific tests |

Across clients:

- Relative URL resolution means trailing slashes and leading-path choices are observable protocol behavior.
- Redirects, HTTPS downgrade, cross-origin redirects, self-signed certificates, reverse proxies, and authentication stripping were not live tested.
- Shared timeout is generally 10 seconds; some adapters request different limits or add outer timeout wrappers. Those wrappers do not consistently cancel underlying work.
- Retries must distinguish safe reads, authentication negotiation, and mutation outcomes. A timeout after submission may mean “outcome unknown,” not “safe to add again.”
- File-add adapter methods exist, but the visible core workflow is principally URL/magnet-based; do not advertise complete file upload without UI/browser acceptance.
- No live WebSocket transport consumer was found.
- A successful “Test connection” must not be treated as proof that subsequent freshly created clients authenticate or that all queue operations work.

# Privacy, Security, and Permissions

## Data inventory

| Data | Source | Stored / location | Transmitted / destination | Purpose | User control |
|---|---|---|---|---|---|
| Client URL | Configuration/import | Encrypted vault, decrypted UI memory | Determines configured server destination | Connection | Edit/remove server |
| Username/password | Configuration/import | Encrypted vault; session-decrypted copies | Login/Basic auth to client | Authentication | Edit, lock, remove; full export |
| API keys | Client options/import | Encrypted vault; unsafe safe-export residue | Client RPC/query protocol | Authentication | Edit/remove; export needs repair |
| Master password | User entry | Not intentionally persisted | No transmission found | Derive encryption key | Unlock/reset |
| Derived key | WebCrypto | `storage.session` JWK | Extension storage boundary only | Decryption across contexts | Lock/browser-session end |
| Magnets/torrent URLs | Popup, selection, link, scan | Transient handling; client may retain | User-configured client | Add torrent | Explicit action; scan behavior needs clarification |
| Page links | Explicit main-document scan | Transient extracted list | Matching magnets sent to client | Bulk add | Context-menu invocation |
| Browsing history | Browser | No passive history collection found | None found | Not required | No history permission |
| Torrent names/status/paths | Client response | UI state and session torrent cache | Client requests/commands; no developer destination found | Queue display/control | Server selection; lock/cache behavior needs repair |
| Preferences | User settings | Local storage; backup JSON | No automatic developer transmission found | UI behavior | Settings/import/export |
| Diagnostics | Browser/runtime/errors | Console/local UI; manual exports where applicable | No automatic reporting endpoint found | Troubleshooting | Debug surfaces; redaction review needed |
| External resources | Utilities/About links | Packaged URLs | Browser navigation when clicked | Auxiliary resources/support | User click |
| Telemetry/crash reporting | — | No implementation found | No endpoint found | — | Preserve absence |

Security boundaries are reasonably narrow: no external-message listener, no persistent content script, no web-accessible-resource surface, and sender IDs are checked. Page-derived strings become client inputs rather than executable extension code.

AES-GCM with random IVs and PBKDF2-SHA-256 with 300,000 iterations is a sensible existing foundation. It does not protect unlocked UI memory, explicitly exported plaintext backups, or a compromised browser profile. The report’s vault findings concern lifecycle and integrity, not a demonstrated break of the cryptography.

Logging still deserves targeted redaction: invalid factory configuration can be logged as an object, and qBittorrent logging includes endpoint/username information. No automatic remote log delivery was found. Historical secret revocation and every Git reference were not independently verified.

## Permission matrix

Warning descriptions are functional summaries, not claims of exact localized browser prompt text.

| Permission/pattern | Required? | Actual feature/use | Narrower alternative | User warning / scrutiny |
|---|---|---|---|---|
| `storage` | Required | Preferences, vault, session cache | None for retained design | Storage handling must be disclosed |
| `contextMenus` | Required | Explicit link/selection/page actions | Remove feature | Generally low scrutiny when explained |
| `notifications` | Required | Add/error notifications | Optional permission or inline feedback | Notification capability |
| `activeTab` | Required | User-triggered page scan | Remove scan | Temporary active-page access |
| `scripting` | Required | Execute magnet-link scan | Remove scan | Explain exactly what page content is read |
| `alarms` | Required | Idle polling | Stop idle monitoring | Explain background operation |
| `http://*/*` | Optional host | Arbitrary user-configured HTTP clients | Request chosen origins only; already intended | Access to selected website/server |
| `https://*/*` | Optional host | Arbitrary HTTPS clients | Same | Defensible broad declaration, narrow runtime grants |
| `ws://*/*`, `wss://*/*` | Optional host | No live consumer found | Remove | Unjustified future capability |
| Required host permissions | None | — | Preserve | No blanket install-time all-host access found |
| Content-script matches | None | — | Preserve | No passive all-site injection |
| `cookies`, `tabs`, DNR, `webRequest` | Absent | Not granted | Preserve unless proven necessary | Do not add as speculative transport fixes |
| Web-accessible resources | Absent | — | Preserve | Smaller page boundary |

Optional broad host patterns are understandable for arbitrary user-owned servers. They are not equivalent to granting access to every host at installation. Unused optional patterns still need removal under least privilege.

# Browser and Store Requirements

## Cross-browser assessment

| Area | Chromium | Firefox | CTRL / evidence | Required action |
|---|---|---|---|---|
| Background | MV3 service worker | Background scripts/event-page model | WXT generates appropriate differences | Preserve; test independent restarts |
| Runtime namespace | `chrome` APIs | Compatibility namespace plus browser APIs | Mixed usage; basic Chrome surface works | Both-browser contracts, not namespace rewrite |
| Ports/lifecycle | Worker may stop; an idle open port is not a universal keepalive | Different background lifetime | Polling/ports/cache lack resync ownership | STATE-001–003 |
| Storage | Session memory supported | Session API version support matters | Current key avoids disk fallback | Set baseline; test browser restart |
| Alarms | Wake mechanism | Supported with lifecycle differences | One-minute idle polling | Verify recreate/wake/unlock |
| Host permissions | User-granted endpoint access | Version-dependent prompting/revocation behavior | Optional patterns present | Grant/deny/revoke tests |
| CSP | Local scripts only | Explicit policy affects insecure-request upgrading | No `unsafe-eval` allowance; explicit HTTP connectivity | Retain restrictive script policy |
| Fetch | Browser controls forbidden headers/cookies | Same fundamental Fetch constraints; extension exceptions differ | Generic Chrome proof only | Live client matrix |
| Packaging | Unpacked build available | ZIP fails ID validation | Genuine WXT targets | Complete release pipeline |
| Signing/declarations | Store dashboard requirements | Gecko ID/data declarations/reviewer source | Firefox incomplete | FF-001, BUILD-001 |

CTRL is **a shared cross-browser implementation with a functioning Chrome surface and an unverified Firefox runtime**, not yet an evidenced dual-browser product.

Chrome’s service-worker documentation does not justify “the worker always dies after 30 seconds”: API activity and messaging affect lifetime. Conversely, opening a port alone does not guarantee persistence. [Chrome lifecycle documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Firefox’s explicit CSP can permit the intended HTTP connection behavior; automatic HTTPS upgrading must not be assumed from MV3 alone. Actual transport policy remains a separate question. [MDN extension CSP](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_Security_Policy).

## Chrome Web Store

**Automated validation blockers:** none established from a current CWS upload. The existing unpacked manifest loads in Chrome. This is not a completed store validation.

**Human review risks:** unsupported client claims, inaccurate status/privacy language, unused WebSocket permissions, unclear scan behavior, incomplete reviewer setup, and unfinished surfaces.

**Policy issue:** current privacy wording does not accurately describe the product. Chrome’s published privacy policy calls for an accurate explanation of handled data and recipients. [Chrome privacy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy).

**Important exception:** Chrome’s FAQ explicitly discusses protocol clients connecting to user-specified servers and exempts same-computer native communication from its encryption requirement. Therefore, I do **not** classify every HTTP/LAN configuration as a proven Chrome violation. Whether all retained CTRL flows fit the protocol-client exception should be documented rather than assumed. [Chrome user-data FAQ, questions 14–16](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

**Defensible scrutiny:** user-triggered page-link access and optional endpoint host access support the stated purpose. Remote RPC responses are data, not remote-hosted executable code. No first-party remote-code loader was found. [MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements).

The dashboard needs a purpose statement, permission justifications, accurate data practices, and applicable certifications. Authentication information and website content are relevant to the observed flows; “no developer backend” is insufficient reasoning for blanket “no data” answers. Exact dashboard selections must be reconciled with the chosen scope and current form definitions. [Privacy dashboard](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

Publisher account/verification status is unknown. Two-step verification and trader/non-trader declarations must be checked by the operator; this audit cannot choose their legal status. [Two-step verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification), [trader declarations](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq).

Torrent control is not itself evidence of prohibited content. Listings and auxiliary links should avoid promoting infringement; no categorical torrent-client prohibition was established. [CWS policies](https://developer.chrome.com/docs/webstore/program-policies/policies).

## Firefox / AMO

**Hard blocker:** the official validator rejects the missing MV3 add-on ID.

**Data declarations:** new submissions since November 3, 2025 must use Mozilla’s built-in declaration system. Its taxonomy includes usernames/passwords as `authenticationInfo` and page links as `websiteContent`. Transmission includes handling outside the add-on/local browser; no general exemption for user-configured self-hosted servers was found. Local encrypted storage alone should not be conflated with remote transmission. Desktop Firefox 140 provides the built-in consent baseline. [Mozilla data-consent requirements](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

**HTTP policy:** Mozilla requires secure remote data transmission. Whether a specific local/LAN deployment qualifies for an exception remains unresolved; do not silently assume Chrome’s exception transfers to AMO. [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/).

**Source review:** bundled/minified code requires matching source and build instructions. Reviewers rebuild and compare generated content; the documented requirement is matching output, not necessarily byte-identical ZIP metadata. The current source/build paths do not establish this. [Source submission](https://extensionworkshop.com/documentation/publish/source-code-submission/).

**Validator result**

| Code | Count | Interpretation |
|---|---:|---|
| `ADDON_ID_REQUIRED` | 1 error | Hard metadata defect |
| `MISSING_DATA_COLLECTION_PERMISSIONS` | 1 warning | Required for the intended new-submission path |
| `DANGEROUS_EVAL` | 2 warnings | `reflect-metadata` global-object fallbacks |
| `UNSAFE_VAR_ASSIGNMENT` | 2 warnings | React DOM implementation |

Modern browsers provide `globalThis`, bypassing the identified reflect fallback. React’s internal `innerHTML` code is not proof of an unsafe application data flow. Record provenance and reviewer explanations; do not loosen CSP or rewrite React merely to eliminate warning text.

# Build, Packages, Dependencies, and Performance

## Source-to-package chain

| Operation | Current command/behavior |
|---|---|
| Canonical build | `npm run build`: clean → Chrome → Firefox → source backup |
| Chrome | `npm run build:chrome`: generate tracked build metadata → WXT |
| Firefox | `npm run build:firefox`: same, Firefox MV3 |
| Browser ZIP | `npm run zip:chrome` / `zip:firefox`: WXT ZIP path |
| Authored source ZIP | `npm run zip:source`: clean-tree HEAD archive with explicit paths |
| Version source | Package version `0.2.0-beta.1`; manifest numeric `0.2.0.1` |
| Build metadata | Current time plus locale-formatted time in tracked source |
| Source maps | Production disabled |
| Backup | Timestamped source copy; not a complete reviewer source recipe |

The Unix-style `rm -rf` clean script also lacks an explicit portable Windows implementation. That is a development/release portability issue, not a reason to run it during this audit.

## Inspected artifacts

| Artifact | Size/content | Status |
|---|---|---|
| Chrome unpacked | 1,079 files; 40,670,016 bytes | Loads; no independent rebuild |
| Firefox unpacked | 1,079 files; 40,669,981 bytes | Inspected; runtime untested |
| Firefox ZIP | 38,371,285 bytes | Matches corresponding unpacked files; validator error |
| Automatic source ZIP | 922,683 bytes; 524 entries | Current source plus historical/process contamination |
| Chrome ZIP | Not present | Release artifact missing |

Firefox ZIP SHA-256:

```text
321e0e04d29ddb7cc29d533bffa1c405066c895893e757bbd4ea0fdd7e2e422e
```

Automatic source ZIP SHA-256:

```text
44e9999830adcf1d747d3096941125405dfd48afa1428fe3e8fb5cf7551f988b
```

The 161 compared source/config/script entries in the automatic source archive matched the current files. That does **not** prove the generated extension is a reproducible build of them.

No test/audit/source-map/environment filenames were found in the production ZIP scan. That is narrower than an exhaustive secret-free certification. The source ZIP, separately, contains historical backup and review material.

**Reproducibility status**

| Level | Result |
|---|---|
| Logical equivalence of repeated builds | Unknown |
| Same repeated-build file set | Unknown |
| Same repeated-build content | Unknown; timestamp generation creates a concrete obstacle |
| Byte-identical archives | Unknown; optional internal target unless specifically required |
| Existing Firefox ZIP vs unpacked content | Matched |
| Reviewer rebuild from submitted source ZIP | Not established |

## Dependencies

The lockfile contains 1,016 dependency entries besides the root, with registry URLs pointing to npm’s registry. Runtime dependencies include React, Carbon/Plex, Zustand, Zod, `txml`, virtual-list support, and decorator libraries. WXT, Vitest, Playwright, ESLint, Sharp, and build tooling are development dependencies.

The latest advisory result identified:

- High: `brace-expansion`, `browserslist`, `js-yaml`, `nanoid`, `sharp`, `undici`.
- Moderate: `@humanfs/node`, `@vitest/mocker`, `adm-zip`, `baseline-browser-mapping`, `firefox-profile`, `vitest`, `web-ext-run`, `wxt`.
- Low: `postcss-selector-parser`.

These are affected package nodes, including dependency propagation—not fifteen independent shipped vulnerabilities. All inspected affected entries were marked development dependencies. Representative reports concern archive extraction, untrusted parsing, development-server mocks, and image processing.

| Action class | Recommendation |
|---|---|
| RELEASE CRITICAL | Resolve any advisory proven reachable in shipped code or reviewer build with hostile inputs |
| SHOULD DO BEFORE RELEASE | Compatible targeted fixes; investigate overrides and archive/image tooling |
| POST-LAUNCH | Consolidate dependency duplication and unused development tools |
| DO NOT TOUCH FOR V1 | Framework/browser-abstraction major migrations solely for freshness |

Install scripts include WXT preparation and native/build-tool setup. A complete script sandbox and third-party license inventory remain unverified. No arbitrary Git dependency sources were found in the inspected lockfile.

## Performance

**Measured/package evidence:** roughly 93% fonts, 18.9 MB duplicate fonts, approximately 2 MB combined major CSS files, and substantial adapter code.

**Source-derived costs:** duplicate popup/background polling; two-second active polls can overlap slower requests; every full-list update schedules session persistence; hydration retains complete torrent metadata; sparse UI state can accumulate stale entries.

**Predicted, not measured:** large-list memory pressure, session quota failures, startup cost, and excessive network/serialization load. No latency percentile, CPU profile, memory benchmark, or battery regression is claimed.

No expensive page-wide observer was found. Scanning occurs only on explicit invocation.

# Documentation, Feature Scope, and Accessibility

## Documentation reconciliation

| Claim | Actual behavior | Consequence |
|---|---|---|
| All listed clients fully supported/tested | Mocks plus multiple protocol defects; no current live matrix | Narrow support claims |
| Seven-language support | Mixed translated keys, hardcoded English, placeholder translation generation | English-first or complete language acceptance |
| Credentials never leave device | Authentication sent to configured remote clients | Rewrite both privacy versions |
| No torrent metadata storage | Session cache stores torrent records | Describe cache and retention |
| Only runs on explicit interaction | Idle alarms poll configured clients | Explain background behavior |
| Completion notifications | No completion-monitoring implementation established | Remove claim |
| Architecture describes site scripts/React Query | Current entrypoints have no persistent site scripts; React Query absent | Update architecture |
| API `testConnection(): Promise<boolean>` | Current structured result contains connection/error data | Fix contributor guidance |
| Generic Node setup guidance | `.nvmrc`/CI use 22; audit environment used 24 | Pin reviewer environment |
| Security policy supports 0.1.x | Current package is 0.2.0 beta | Update support matrix/contact |
| Roadmap future functions | Many are explicitly aspirational | Do not classify every roadmap item as broken |
| Historical changelog features | Some no longer exist | Preserve history; distinguish current capabilities |

Accurate documentation includes the core client-controller purpose, encrypted credential storage in the current implementation, removal of automatic site integrations, and absence of developer telemetry.

## Feature scope

| Feature | Classification |
|---|---|
| Vault setup/unlock/lock | CORE FOR V1 |
| Verified client setup and permission grant | CORE FOR V1 |
| Add magnet, list, pause/resume, remove without data deletion | CORE FOR V1 |
| Clear errors and active-server identity | CORE FOR V1 |
| Safe configuration backup/import | CORE FOR V1 if advertised |
| Multiple servers | OPTIONAL FOR V1; identity correctness remains mandatory |
| Explicit Add Paused | CORE FOR V1 if offered |
| Bulk page scanning | OPTIONAL; preferably hide initially |
| Label/path advanced dialog | OPTIONAL; capability-test retained fields |
| Unverified client implementations | EXPERIMENTAL; hide from public supported selector |
| Notification styling/levels without consumers | REMOVE/HIDE BEFORE RELEASE |
| Sidebar customization without runtime effect | REMOVE/HIDE BEFORE RELEASE |
| Locked performance selector | REMOVE/HIDE BEFORE RELEASE |
| WebSocket capability | DEAD/UNIMPLEMENTED in live transport |
| Full multi-language expansion | POST-LAUNCH unless verified |
| Resource directory and unrelated utilities | OPTIONAL; reduce for a focused release |
| Advanced adapter APIs without UI | POST-LAUNCH; no need to delete sound internal code |

Accessibility is **likely acceptable in parts**, with named torrent-action buttons, focus-visible styling, text status labels, and Carbon form/dialog components. It is **likely deficient** in server-input association and virtual-list semantics.

Contrast, text scaling, reduced motion, modal focus traps, live-region timing, and screen-reader behavior require a dedicated audit. No WCAG compliance claim is warranted.

# What CTRL Already Gets Right

1. **WXT provides useful browser-specific manifest generation.** Keep it.
2. **The current session-only key design removes the disk-key fallback.** Preserve this pre-existing work.
3. **Authenticated encryption and password derivation are appropriate foundations.**
4. **Privileged runtime messages validate the sender’s extension identity.**
5. **No persistent all-site content scripts or external messaging surface were found.**
6. **Host access is optional and intended to be requested for configured endpoints.**
7. **Adapters isolate protocol-specific concerns and often validate responses with Zod.**
8. **Connection testing returns structured error information instead of only a boolean.**
9. **Imports validate before mutation and attempt rollback.** Repair consistency rather than discard this work.
10. **Context-menu rebuild logic accounts for startup and locked/unconfigured states.**
11. **No developer telemetry or remote executable-code service was found.**
12. **The existing 530-test foundation and Chrome/Firefox build jobs are useful.** Expand the missing boundaries rather than replace the suite.

# Things That Look Suspicious but Should NOT Be Treated as Release Problems

| Concern | Evidence / why acceptable | When it becomes a problem |
|---|---|---|
| Minified third-party code | Normal bundling; Mozilla allows minification with matching source | Missing provenance or nonreproducible source |
| Validator eval warnings | Identified reflect global-object fallbacks | Reachable dynamic evaluation of untrusted strings |
| React `innerHTML` warning | Library implementation, no first-party unsafe flow found | User/server strings reach unsafe HTML rendering |
| 38 MB Firefox ZIP | Large but below documented submission limits | Unsupported assets/licenses or unacceptable measured cost |
| Broad optional HTTP(S) patterns | Necessary declaration for arbitrary user-configured endpoints | Blanket grants or unrelated host access |
| Plain HTTP to same-machine client | Explicit Chrome policy exception | Remote credentials without supported policy/security basis |
| Development-only advisories | Not automatically shipped browser vulnerabilities | Reachable hostile-input toolchain attack |
| Firefox background scripts | Correct WXT accommodation of browser differences | Lifecycle assumptions remain untested |
| Explicit Authorization with credentials omitted | Browser probe preserved supplied Authorization | Assuming this also preserves cookies |
| Extractable session AES key | Enables session JWK storage across extension contexts | Disk persistence or exposure to untrusted contexts |
| RPC commands received from server | Data/protocol responses, not remote code | Interpreting responses as executable logic |
| No file-deletion confirmation | Current UI explicitly sends `deleteData:false` | Adding data deletion or leaving wrong-server routing unfixed |

# Negative-Evidence and Unknowns Ledgers

## Negative evidence

| Concern investigated | Evidence checked | Result | Confidence |
|---|---|---|---|
| Remote executable loading | Source, CSP, generated package | Not found | HIGH-CONFIDENCE |
| Developer telemetry | Network callsites/dependencies/resources | Not found | HIGH-CONFIDENCE |
| Unrestricted external messages | Manifest/listeners/sender checks | Not found | CONFIRMED within inspected surface |
| Passive all-site content scripts | Entrypoints/generated manifests | None | CONFIRMED |
| Arbitrary passive injection | Scan implementation | Explicit current-page action only | CONFIRMED |
| Current plaintext disk vault key | KeyManager and background purge | No active fallback; legacy purge exists | CONFIRMED source |
| Normal plaintext password persistence | Vault/save paths | Encrypted storage path; exports are separate | HIGH-CONFIDENCE |
| First-party unsafe eval | Source search; validator provenance | Not found | HIGH-CONFIDENCE |
| Production package includes audit files | ZIP filename inspection | Not found; source ZIP does include them | CONFIRMED |
| Production package entirely secret-free | Limited source/package checks | No secret identified; exhaustive certification not performed | UNKNOWN beyond checked scope |
| Automatic page-history collection | Manifest/source | Not found | HIGH-CONFIDENCE |
| Live data deletion during audit | Diagnostic traces | None | CONFIRMED |

## Unknowns

| Unknown | Why unresolved | Evidence needed | Blocks architecture? | Blocks release? |
|---|---|---|---|---|
| Exact supported client versions | No live matrix | Core-operation results per version | No | Yes |
| qBittorrent non-localhost CSRF | Generic probe lacked target deployment | Granted-host tests with default security | Possibly transport choice | Yes for qBittorrent |
| Firefox runtime | No installed environment | Signed/temporary install smoke and lifecycle tests | No | Yes |
| HTTP/LAN AMO interpretation | No clear applicable exception established | Official clarification or narrower transport scope | No | Yes if retained |
| Rebuild from source ZIP | Tracked mutation prevented safe run | Clean permitted environment and output comparison | No | Yes, Firefox |
| Private/incognito behavior | No runtime matrix | Permission/storage/scan isolation tests | No | Yes if supported |
| Large-list limits | No benchmark | 1k/10k synthetic list profiles and quota tests | Could affect optimization | Conditional |
| Historical secret remediation | Provider/remote evidence unavailable | Provider rotation records and authorized ref scan | No | If a live secret remains |
| Hosted privacy/support URLs | No verified publication | Public URL checks and operator control | No | Yes |
| Store account/trader status | Account unavailable | Dashboard/operator verification | No | Yes |
| Full accessibility | Static review only | Keyboard/screen-reader/zoom/contrast audit | No | Core workflows yes |
| Third-party notice completeness | No full license reconciliation | Dependency/assets notice inventory | No | Yes where obligations apply |

# Architecture Judgment and Scorecard

**Architecture verdict: MOSTLY sound; TARGETED REFACTORING required.**

The framework, adapter split, and privilege boundary are workable. The foundational defects are **state ownership, server identity, authentication contracts, and vault consistency**. They are concentrated enough for bounded repair.

| Structural class | Items |
|---|---|
| RELEASE BLOCKER | Wrong-server operations; Firefox metadata; unreproven release provenance |
| FOUNDATIONAL DEFECT | Multiple state owners; positional diffs; inconsistent transport/auth contracts |
| SIGNIFICANT MAINTENANCE ISSUE | Duplicate interfaces, broad adapter surface, stale docs, dependency overrides |
| NORMAL TECHNICAL DEBT | Mixed styling conventions, some `any`, inconsistent naming within implementation |
| NOT WORTH FIXING FOR V1 | Framework migration, full DI redesign, universal client capability system |

Architecture dimensions: conceptual clarity **3/5**, maintainability **3**, correctness **1**, testability **3**, state ownership **1**, error isolation **2**, portability **2**, security boundaries **3**, protocol abstraction **2**, configuration **2**, build simplicity **2**, releaseability **1**.

## Independent readiness scorecard

| Category | Score / 5 |
|---|---:|
| Product clarity | 3 |
| Architecture | 3 |
| Networking/protocol correctness | 1 |
| State/concurrency correctness | 1 |
| Security | 2 |
| Privacy | 1 |
| Permissions | 3 |
| Chrome runtime readiness | 2 |
| Firefox runtime readiness | 1 |
| Chrome policy readiness | 2 |
| Mozilla policy readiness | 1 |
| Build/packaging | 1 |
| Reproducibility | 1 |
| Testing | 2 |
| CI/release engineering | 2 |
| Performance | 2 |
| UX | 2 |
| Accessibility | 2 |
| Documentation | 1 |
| Store assets | 1 |
| Maintainability | 3 |

These are evidence/readiness scores, not a mechanical average.

**Confidence in the NOT READY verdict: HIGH.**  
**Confidence in successful operation across advertised deployments: LOW.**

Gating dimensions are state integrity, live protocol verification, Firefox runtime/submission, privacy accuracy, and release reproduction.

# Minimum Responsible v1 and Operator Decisions

A defensible initial release would have:

- **Browsers:** desktop Chrome 152+ as the conservative tested starting point, and Firefox 140+ only after minimum/current-version acceptance. Lower Chrome versions can be added with evidence; this is a support recommendation, not an API minimum claim.
- **Clients:** Transmission first, then qBittorrent after version/authentication repair. Neither is approved by this audit as already working. Aria2 may join after its smaller core matrix passes.
- **Core:** setup, permission grant/denial/revocation recovery, encrypted configuration, lock/unlock, truthful status, add magnet, add paused, list, pause/resume, remove without deleting data, reconnect, safe backup/import.
- **Languages:** English-first.
- **Scope removed/hidden:** unverified clients, nonfunctional settings, unverified file upload, automatic bulk scan, unused WebSocket permissions, broad “fully tested” claims.
- **Privacy:** no telemetry; direct client communication clearly disclosed; secrets excluded from safe exports; bounded and redacted session cache.
- **Evidence:** both-browser core scenarios, server-switch races, vault corruption/restart, transport contracts, source rebuild, official validator, listing assets and reviewer setup.

Excluded clients are promoted by repairing their identified protocol defects and passing the same browser/client operation matrix. Adapter existence or inherited implementation is not promotion evidence.

| Decision | Option A | Option B | Recommendation / evidence | What changes it |
|---|---|---|---|---|
| Client scope | Small verified set | All nine before release | A; current evidence is uneven and several paths are defective | Funded real-client matrix with passing results |
| HTTP | Explicit local/LAN support | HTTPS except loopback | Prefer B for remote use; resolve LAN policy before A | Official AMO clarification and deployment demand |
| Page scan | Hide initially | Retain repaired preview/bulk add | A reduces permissions and surprising transfers | Strong user need plus consent/default tests |
| Browser baseline | Narrow desktop baseline | Older versions/mobile | A reduces consent/lifecycle combinations | Verified demand and test capacity |
| Languages/settings | English core | Complete broad surface | A; visible claims exceed implementation | Finished translations and runtime consumers |
| Multi-server v1 | Retain after identity repair | Single configured server | Either is viable; retain only with STATE-001 acceptance | Product importance versus release schedule |
| Publisher identity | Existing verified identity | New permanent identity | Operator must choose, not infer | Actual account ownership |
| Quality bar | All mandatory gates | Ship with documented P2 debt | Permit bounded P2 debt, not unresolved wrong-target/security failures | New evidence that removes a gate |

# Remediation Program and Candidate Execution Waves

No work below is authorized for implementation by this audit request.

## Phases

| Phase | Objective / findings | Dependencies | Exit criterion |
|---|---|---|---|
| A — Decisions/evidence | Freeze clients, versions, transports, scan, languages; obtain client environments | Operator decisions | Written support matrix and reproducible test setup |
| B — Correctness | STATE-001–003, NET-005 | A identity contract | Stable command targets and restart-safe snapshots |
| C — Security/privacy | SEC-001–003, PRIV-001 | B ownership; A data scope | Corruption/lock/export tests and consistent disclosures |
| D — Browser/release | FF-001, BUILD-001 | A baseline; frozen source | Valid manifests and reviewer-rebuild proof |
| E — Scope reduction | SCOPE-001, unverified clients | A | Every visible control/permission justified |
| F — UX/accessibility | UX-001–004 | B/C/E | Core journey truthful and keyboard accessible |
| G — Tests/CI | TEST-001, client contracts, dependency dispositions | Repairs incrementally | Mandatory gates cannot silently skip |
| H — Submission preparation | Assets, notes, policy URLs, account prerequisites | All preceding release gates | Reviewable submission bundle |
| I — Post-launch | PERF-001 if deferred, optional APIs/localization/debt | Release acceptance | Measured improvements without scope creep |

## Bounded waves

**Safe to parallelize on this working tree: NO for every wave.** Separate worktrees could later isolate genuinely independent work, with explicit integration contracts.

| Wave | Objective / issues / files | Non-goals and mutation boundary | Starting evidence / dependencies | Acceptance / verification |
|---|---|---|---|---|
| 1 | Stable server identity, response generation, snapshots; background/resolver/store/messages | No adapter feature expansion; only state contract and associated tests | Current race/diff probes; agreed ID migration | All controlled race/reorder/reconnect cases pass |
| 2 | Vault authority, corruption envelope, safe export; security/hooks/import/export | No new account system or crypto replacement | Wave 1 contract; migration fixtures | Multi-window lock, stale-save rejection, corruption and secret matrix |
| 3 | Selected-client transport contracts; Fetch and chosen adapters | No all-client rewrite; no speculative permissions | Supported versions and live endpoints; wave 1 cancellation interface | Exact wire tests and real operation matrix |
| 4 | Honest core UI and scope removal; dashboard/server/settings/context menu | Do not implement dead features | Waves 1–3 and frozen visible surface | Truthful states, paused defaults, URL round-trip, keyboard acceptance |
| 5 | Deterministic builds, source archive, metadata, dependencies/assets; scripts/config/CI | No publishing; no unrelated major upgrades | Frozen source/toolchain and publisher ID | Validator, clean source rebuild, content comparison, package inventory |
| 6 | Privacy/listing/reviewer package; docs/assets/declarations | No submission or legal-status choice | Final data inventory and manual evidence | Consistent reviewed bundle ready for operator submission decision |

For every wave, **implemented, tested, committed, pushed, merged, released, and submitted remain separate statuses**. None of the latter actions is an automatic acceptance criterion.

# Release Gates

| Gate | Observable pass criteria |
|---|---|
| **1 — Product scope frozen** | Exact browser/client/version/transport/language/features matrix approved; unsupported surfaces hidden |
| **2 — Core correctness** | Wrong-server test impossible; stale responses rejected; reorders/replacements/removals correct; two-window/restart synchronization passes |
| **3 — Security/privacy** | Cross-window redaction; wrong-password/corrupt-state failure; safe-export secret matrix; accurate data declarations and policy |
| **4 — Chrome runtime** | Clean install and supported client matrix pass on declared Chrome baseline/current target; grant/deny/revoke tested |
| **5 — Firefox runtime** | Validator zero errors; warnings dispositioned; signed/installable package; core/lifecycle/consent matrix passes |
| **6 — Build/package reproduction** | Frozen source ZIP rebuilds matching output files/content in documented environment; forbidden files absent; checksums recorded |
| **7 — Automated verification** | Lint/typecheck/unit/contract/browser/package checks pass; required tests cannot skip; advisories dispositioned |
| **8 — Policy/listing readiness** | Accurate assets, descriptions, policy URL, permission/data forms, publisher prerequisites, reviewer notes/environment |
| **9 — Manual acceptance** | All required matrix rows pass with captured evidence and no unresolved critical defect |

## CI gate prioritization

**Required for first release:** lint, typecheck, targeted tests, both builds, Firefox validator, forbidden-file scan, source-archive rebuild, content comparison, dependency/secret disposition, Chrome E2E, Firefox smoke, artifact version/checksum consistency.

**Recommended soon after:** package-size regression budget, larger-list benchmarks, broader client-version coverage, longer lifecycle soak tests, stronger action pinning.

**Unnecessary for v1:** automatic store publication, an elaborate client farm for unadvertised clients, arbitrary coverage-percentage targets, custom telemetry infrastructure.

# Manual Acceptance Matrix

Use disposable profiles and dedicated client queues containing redistributable test content. “Both” means every declared desktop browser target.

| Environment | Steps | Expected result | Evidence |
|---|---|---|---|
| Clean Chrome / Firefox | Install exact candidate | Correct metadata, no startup errors | Package hash, browser version, console |
| Both | First launch; create vault | Clear setup → configure-server flow | Screenshots/video |
| Both | Wrong password; correct password | Failure then successful unlock | UI and storage observations |
| Both | Restart browser | Vault locked; no disk key fallback | Before/after storage keys |
| Each supported client | Configure endpoint; test connection | Accurate connection/auth result | Server version, sanitized network trace |
| Both | Grant endpoint permission | Only intended origin granted | Permission inventory |
| Both | Deny grant | Explain denial; no false success | UI/error |
| Both | Revoke existing grant | Connection invalidated; recovery offered | Permission/UI trace |
| Each client | Add magnet | Exactly one intended queue entry | Client queue + request trace |
| Each entrypoint/client | Enable default paused; add | Added paused consistently | Client state |
| Both/client | List and change status remotely | Correct refresh and ordering | Before/after snapshots |
| Each client | Pause/resume | Acknowledged actual state change | Client and UI evidence |
| Each client | Remove | Intended server/torrent only; data retained | Queue and filesystem check |
| Both/client | Bad credentials | Actionable auth error; no false online state | Sanitized logs |
| Both/client | Stop server / go offline | Stale/offline state; retry recovery | Timing and UI capture |
| Both | Configure A/B with overlapping IDs | Commands bind to selected server | Request destinations |
| Both | Delay A response; switch to B | A response rejected | Controlled trace |
| Both | Open two options windows | Independent ranges, common canonical configuration | Video/messages |
| Both | Lock in one window | All windows redact | Video/storage event trace |
| Both | Reload extension / stop background | Resubscription restores correct snapshot | Lifecycle trace |
| Both | Export safe/full; import | Safe excludes all secrets; full clearly sensitive; import consistent | Synthetic file inspection |
| Both | Empty/malformed/truncated backup or vault | Explicit error; original data preserved | Storage diff |
| Both | Update from prior supported version | Migration retains servers; legacy key removed | Version/storage evidence |
| Both | Keyboard-only core journey | Labels, focus, dialogs, errors usable | Recording/accessibility tree |
| Both | Screen reader and 200% zoom | Operable configuration and queue | Audit notes |
| Both | Observe network while idle/active | Only documented endpoints and polling | Sanitized network capture |
| Both, if supported | Private/incognito scan/configuration | No inappropriate persistence/cross-context leakage | Storage/network evidence |
| Both | Bulk scan, if retained | Correct frame/scope, preview, deduplication, defaults | Controlled page/client records |

# Release Artifact Checklist

| Artifact | Status |
|---|---|
| Chrome submission ZIP | **MISSING** in inspected build directory |
| Chrome unpacked build | **EXISTS**, provenance incomplete |
| Firefox ZIP | **EXISTS BUT WRONG**: metadata error |
| Firefox source archive | **EXISTS BUT WRONG**: contamination/rebuild process |
| Exact build instructions | **INCOMPLETE** |
| Checksums | **EXISTS** in this audit for inspected ZIPs; release manifest incomplete |
| Version consistency | **EXISTS**, numeric mapping coherent; release policy needed |
| Changelog | **EXISTS**, current capability reconciliation needed |
| Release notes | **INCOMPLETE** for a public candidate |
| Privacy policy files | **EXISTS BUT WRONG** |
| Hosted privacy URL | **UNKNOWN** |
| Permission justifications | **INCOMPLETE** |
| Chrome data disclosures | **UNKNOWN / INCOMPLETE** |
| Firefox data declarations | **MISSING** |
| Reviewer instructions | **INCOMPLETE** |
| Reviewer client environment | **MISSING** |
| Extension icons | **EXISTS** |
| Release screenshots | **MISSING** from inspected release materials |
| Small promotional tile | **MISSING** |
| Marquee promotional asset | **NOT REQUIRED** |
| Promotional video | **UNKNOWN requirement applicability**; official page wording warrants dashboard confirmation |
| Support URL/contact | **INCOMPLETE**; GitHub links exist, private security contact unclear |
| Third-party notices | **INCOMPLETE verification** |
| Manual acceptance evidence | **INCOMPLETE** |
| Store-account prerequisites | **UNKNOWN** |

For Chrome, prepare a 128×128 icon, at least one accurate 1280×800 screenshot, and a 440×280 small promotional tile. Confirm the actual dashboard’s video requirement rather than treating ambiguous documentation wording as a proven blocker. [Listing documentation](https://developer.chrome.com/docs/webstore/cws-dashboard-listing).

# Risk and Technical Debt Registers

## Risk register

| Risk | Probability | Impact | Evidence | Mitigation | Residual risk |
|---|---|---|---|---|---|
| Wrong-server command | Demonstrated sequence | High | STATE-001 | Stable IDs/generations | Client-side ID behavior |
| Incorrect queue state | Demonstrated | High | STATE-002/003 | Snapshots/resync | Large-list scaling |
| Authentication failure | High for identified paths | High | NET findings | Browser/live contracts | Server/proxy variants |
| Vault divergence/corruption | Demonstrated conditions | High | SEC findings | Canonical state/envelope | Local profile compromise |
| Safe-export disclosure | Demonstrated | High | SEC-003 | Allowlist sanitization | Sensitive full exports |
| Firefox incompatibility | Unknown runtime; known submission defect | High | Validator/no live test | Metadata + Firefox matrix | Browser updates |
| Privacy rejection | High with current wording | High | Contradictory policy | Accurate declarations | LAN interpretation |
| Chrome review friction | Medium | Medium/high | Claims/permissions/assets | Narrow scope and reviewer notes | Reviewer judgment |
| Source rebuild failure | High | High for AMO | BUILD-001 | One deterministic pipeline | Toolchain/platform differences |
| Dependency/toolchain exposure | Conditional | Medium/high | Fresh advisories | Reachability and patches | Future advisories |
| Package overhead | Confirmed | Medium | Font hashes | Deduplicate | Glyph coverage |
| Support burden | High if nine clients advertised | High | Uneven evidence | Verified support matrix | Third-party changes |
| Maintainability drift | Medium | Medium | Duplicate owners/interfaces/docs | Targeted ownership repair | Optional API surface |

## Debt register

| Timing | Work |
|---|---|
| **MUST FIX FOR V1** | Identity/races, diff/resync, vault/export integrity, retained-client protocols, truthful core UI, submission metadata/privacy/source reproduction |
| **FIRST POST-LAUNCH** | Additional verified client versions, larger-list profiling, deferred font cleanup, broader accessibility/localization |
| **LATER** | Optional advanced APIs, richer capabilities, notification polish, code organization consolidation |
| **MAY NEVER BE WORTH FIXING** | Reimplementing every dead setting, universal DI redesign, custom browser abstraction, automated publishing |

# What CTRL Should NOT Do Next

| Temptation | Why attractive | Why defer | Reconsider when |
|---|---|---|---|
| Framework migration | Appears to modernize everything | Does not fix identity/auth/vault contracts | Framework blocks a proven requirement |
| Replace WXT/browser abstraction | Firefox problems suggest portability failure | WXT already handles manifest differences | Reproduced framework defect cannot be isolated |
| Broad dependency majors | Quickly reduces advisory counts | Adds uncontrolled compatibility changes | Targeted patches unavailable and reachability warrants it |
| Finish all existing settings | UI already exists | Expands scope instead of removing misleading controls | Verified demand |
| Implement all nine clients at once | Matches current README | Multiplies live-test/support matrix | Dedicated environments and capacity exist |
| Add telemetry | Makes failures observable | Adds privacy and operational surface before core correctness | Explicit product need and consent design |
| Complete seven languages now | Existing dictionaries suggest near completion | Runtime UI remains mixed | English core is stable and translators/testers available |
| Automatic store publication | Convenient CI milestone | Removes a useful human review boundary | Mature release controls and explicit authorization |
| Broad refactoring | Cleans accumulated inconsistencies | Obscures bounded repairs | Specific maintenance evidence justifies it |
| Performance rewrite | Package is large | Asset duplication can be repaired directly | Measured runtime bottleneck remains |

# Final Independent Verdict

**What is CTRL today?**  
A substantial beta torrent-controller extension with useful adapter and security foundations, a working Chrome UI shell, and unresolved correctness, protocol, privacy, and release-engineering defects.

**Is the architecture fundamentally sound?**  
**MOSTLY.** Ownership boundaries need repair.

**Does it require a rewrite?**  
**TARGETED REFACTORING.**

**Chrome readiness?**  
**NOT READY.**

**Firefox readiness?**  
**NOT READY.**

**Top five release blockers, ranked**

1. Wrong-server routing and stale-response acceptance.
2. Incorrect queue diffs and synchronization.
3. Vault consistency, corruption handling, and safe-export secrets.
4. Unverified/broken advertised client protocols.
5. Firefox metadata plus privacy/source-rebuild readiness.

**Top five things not to change before v1**

1. WXT and the existing browser-target approach.
2. React and the basic UI framework.
3. AES-GCM/PBKDF2 primitives.
4. Current session-only vault key and legacy-key purge.
5. Adapter separation, response validation, and the existing useful tests.

**Remove or hide:** unverified clients, nonfunctional preferences, unverified upload/advanced claims, unused WebSocket declarations, and bulk scanning unless repaired and accepted.

**Can wait:** broad localization, advanced client APIs, cosmetic consolidation, framework upgrades, and measured noncritical optimization.

**Largest technical unknown:** real-browser authentication and core operations against the exact supported client/server/proxy versions.

**Largest policy unknown:** the defensible Mozilla treatment of unencrypted user-controlled LAN connections.

**Minimum path to Chrome:** repair shared correctness/security, verify a narrow client set in Chrome, reconcile disclosures, produce a clean package and complete manual/listing gates.

**Minimum path to Firefox:** the same shared repairs plus Gecko identity/data metadata, Firefox runtime acceptance, signed-package verification, and matching reviewer source rebuild.

**Recommended first execution wave:** stable server identity, generation rejection, explicit command targets, and reliable snapshots, with the reproduced races/diffs converted into regression tests.

# Comparison-Ready Summary Ledger

Abbreviations: ST = SOURCE TRACE; RR = RUNTIME REPRODUCTION; LB = LIVE BROWSER TEST; SC = STATIC CONFIGURATION; PI = PACKAGE INSPECTION; BA = BUILD ARTIFACT; AT = AUTOMATED TEST; OP = OFFICIAL POLICY; OA = OFFICIAL API DOCUMENTATION; DC = DOCUMENTATION CLAIM; RI = REASONED INFERENCE.

“Quality” denotes the audit’s responsible-release gate, not a store-specific rule.

| AST ID | Priority | Category | Short finding | Confidence | Evidence class | Chrome gate | Firefox gate | Needs runtime verification? | Needs policy verification? |
|---|---|---|---|---|---|---|---|---|---|
| STATE-001 | P0 | Integrity | Wrong-server/stale-response routing | CONFIRMED | ST, RR | Quality | Quality | Live acceptance | No |
| STATE-002 | P1 | State | Incorrect positional diffs | CONFIRMED | ST, RR | Quality | Quality | Repair acceptance | No |
| STATE-003 | P1 | Lifecycle | Shared viewport/no initial resync | CONFIRMED | ST, RR | Quality | Quality | Both-browser acceptance | No |
| SEC-001 | P1 | Security | Cross-context vault divergence | CONFIRMED / HIGH-CONFIDENCE | ST, LB | Quality | Quality | Firefox and stale-save | No |
| SEC-002 | P1 | Integrity | Missing ciphertext falsely unlocks | CONFIRMED | ST, RR | Quality | Quality | Recovery acceptance | No |
| SEC-003 | P1 | Secrets | Safe export retains API key | CONFIRMED | ST, RR | Quality | Quality | Full secret matrix | No |
| NET-001 | P1 | Protocol | XML JSON-stringified | CONFIRMED | ST, RR | Conditional client | Conditional client | Real XML endpoint | No |
| NET-002 | P1 | Auth | Cookie/bootstrap contract broken | HIGH-CONFIDENCE | ST, LB, OA | Conditional client | Conditional client | Yes | No |
| NET-003 | P1 | Compatibility | qBittorrent old actions/states | HIGH-CONFIDENCE | ST, OA | Conditional client | Conditional client | Exact versions | No |
| NET-004 | P2 | Browser network | Forbidden-header assumptions | CONFIRMED limitation; impact PLAUSIBLE | ST, LB | Conditional client | Conditional client | Yes | No |
| NET-005 | P2 | Reliability | Cancellation/body timeout gaps | CONFIRMED | ST, RR | Quality | Quality | Slow-body acceptance | No |
| UX-001 | P1 | UX | False online/ignored outcomes | CONFIRMED | ST, LB | Quality | Quality | Repair acceptance | No |
| UX-002 | P1 | Behavior | Paused defaults bypassed | CONFIRMED | ST | Conditional feature | Conditional feature | Each add path | No |
| UX-003 | P2 | Setup | Endpoint URL handling | CONFIRMED limitation | ST | Conditional topology | Conditional topology | Yes | No |
| UX-004 | P2 | Accessibility | Core labels/list semantics | HIGH-CONFIDENCE | ST | Quality | Quality | Assistive technology | No |
| SCOPE-001 | P2 | Product | Dead controls/overclaims/unused WS | CONFIRMED | ST, SC, DC | Scope/permissions | Scope/permissions | Retained features | Final permission mapping |
| FF-001 | P0 | Submission | Missing ID/data metadata | CONFIRMED | SC, BA, PI, OP | — | Hard blocker | Install/consent | Data selections |
| PRIV-001 | P1 | Privacy | Contradictory disclosures | CONFIRMED | ST, DC, OP | Policy materials | Policy materials | Network reconciliation | LAN exception |
| BUILD-001 | P1 | Release | Source/rebuild pipeline inadequate | CONFIRMED defects | ST, BA, PI | Provenance quality | Reviewer rebuild | Rebuild | No |
| PERF-001 | P2 | Packaging | Duplicate fonts | CONFIRMED | PI, BA | Deferrable | Deferrable | Performance impact | No |
| TEST-001 | P2 | Assurance | Severe failures escape suite | CONFIRMED | AT, ST, RR | Quality evidence | Quality evidence | Yes | No |
| DEP-001 | P2 | Supply chain | Dev-tool advisories unresolved | CONFIRMED reports | SC, AT, RI | Disposition | Disposition | Reachability-dependent | No |

All IDs in this table carry the `AST-` prefix; shortened cells avoid repetition.

## Strongest five findings

1. AST-FF-001: official validator rejects the actual Firefox ZIP.
2. AST-STATE-001: current background code reproduced stale publication and wrong-server routing with synthetic clients.
3. AST-STATE-002: current diff/application functions produce demonstrably wrong results.
4. AST-SEC-003: actual safe-export function retains the synthetic supported API key.
5. AST-NET-001: actual shared transport changes XML into JSON.

## Weakest five findings or impact estimates

1. AST-NET-004’s exact impact on privileged non-localhost qBittorrent deployments.
2. AST-SEC-001’s complete import/concurrent-save loss sequence beyond the confirmed lock divergence.
3. AST-UX-004’s severity across real assistive technologies.
4. AST-DEP-001’s exploitability under this project’s actual build inputs.
5. AST-PERF-001’s user-perceived startup/memory impact; duplication itself is certain.

## Five likely false-positive traps

1. Treating all validator warnings as submission errors.
2. Calling all development advisories shipped remote vulnerabilities.
3. Assuming optional HTTP(S) patterns mean blanket installed host access.
4. Declaring all localhost/LAN HTTP a Chrome policy violation.
5. Treating Firefox’s generated background scripts as a broken MV3 conversion.

## Five areas another independent reviewer should challenge

1. Reproduce the state-routing sequence in actual browser windows against disposable servers.
2. Test Fetch/cookie/CSRF behavior with granted host permissions in both browsers.
3. Rebuild the proposed source archive in Mozilla’s documented environment.
4. Challenge the exact data-category and LAN-policy interpretation with current official guidance.
5. Inspect concurrency/migration/export behavior using realistic multi-window workflows, while accounting for this audit’s disclosed blindness limitation.