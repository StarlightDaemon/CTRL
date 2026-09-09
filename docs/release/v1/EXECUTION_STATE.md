# CTRL v1 Execution State

## Checkpoint

- timestamp: 2026-09-09 (Phases F, G and H close-out — end of the unattended batch)
- repository: `E:\Citadel\CTRL`
- branch: `main` (tracks `origin/main`; 26 local commits ahead after this checkpoint, nothing pushed)
- ending HEAD: the commit that adds this checkpoint file, child of `0e6742b` (see Local Commits)
- version: `0.2.0-beta.1` (unchanged; manifest `version` `0.2.0.1`; not eligible for 1.0.0 — gates not all passed)
- working tree at checkpoint: only the pre-existing operator files under `.raiden/` and `.serena/` remain modified/untracked (11 modified or deleted, 2 untracked). No staged changes. Stash `stash@{0}` (obsolete buildInfo.ts stamp) untouched.
- toolchain: Node v24.18.0, npm 11.16.0 (`.nvmrc` 24; CI 24), addons-linter 10.11.0, Chrome 152.0.7977.83, Firefox 155.0.1
- disposable environment: the session scratchpad `live/` directory held Transmission 4.1.3, qBittorrent 5.2.3, aria2 1.37.0 and geckodriver 0.37.1; all client processes and harness browsers were **stopped at the end of the batch** (binaries and downloads remain only in the session scratchpad). Reproducible from scratch with `node tests/live/env.mjs fetch && extract && start all` (default root `%LOCALAPPDATA%\Temp\ctrl-live`).

## Phases F, G, H — CI/reviewer-build gates, documentation, store dossier — COMPLETE — COMMITTED

**F — CI and reviewer build** (`4998d1a`, `d4617d1`, `fa687e0`):
- `.github/workflows/ci.yml`: Node 24; `package` job builds both targets twice and requires byte-identical output, fails on tracked-source mutation, runs addons-linter (errors fail), checks `en`-only locale / no fonts / no remote font or CDN references / no removed-feature strings / exactly 14 files per package, verifies package↔manifest↔zip version consistency and the reviewed permission set, applies an internal 600 KB zip regression threshold, records `SHA256SUMS.txt`, uploads packages. Store submission is not automated. (CI itself has not run: nothing is pushed.)
- `extension/BUILD.md`: reviewer build instructions (Node 24 / npm 11, `npm ci`, `npm run build-for-amo`, expected 14 files / ~1.59 MB / ~327 KB zip, determinism, package contents). `zip:source` now includes `BUILD.md` and `LICENSE`; its workspace check was fixed for Windows paths; the archive is written with `core.autocrlf=false`, and `.gitattributes` pins packaged JSON to LF — the first reviewer-style rebuild differed in `messages.json` only because `git archive` on the Windows host had converted it to CRLF.
- **Reviewer-style rebuild verified**: the source archive (262 entries, ~520 KB; no audits, backups, reports, evidence, process state or build output) unpacked into a fresh directory, `npm ci` (831 packages) + `npm run build-for-amo` on Node 24.18 → `firefox-mv3` **byte-identical to the checked-in build (14/14 files)**. (Zip container bytes differ by entry timestamps; reviewers compare contents.)
- Chrome and Firefox builds deterministic across consecutive builds; `.nvmrc` → 24. The rebuild was repeated on the final tree (`0e6742b`, after the popup fix): **identical again (14/14)**. Pre-release artefact checksums are recorded in `STORE_DOSSIER.md` §9.

**G — Documentation / privacy** (`a534ec6`):
- `README.md`: purpose, verified clients table (Transmission 4.1.3, qBittorrent 5.2.3, aria2 1.37.0), hidden adapters named as not offered, browsers (Chrome 120+/152, Firefox 140+/155), English only, installation, first use, permission table incl. `declarativeNetRequestWithHostAccess`, plain-HTTP warning.
- `docs/PRIVACY_POLICY.md` + `docs/privacy.html`: storage table (encrypted vault, preferences, session key, session snapshot), transmission table (login, links/commands, polling — only to the configured client), HTTP implications, the qBittorrent `Origin` rule, backups/exports with `containsSecrets`, permissions, Firefox `authenticationInfo` consent, what CTRL never does, user control.
- `docs/DEVELOPMENT.md`, `docs/ARCHITECTURE.md` rewritten to the current controller/transport/vault/harness/packaging; `docs/BETA_TESTING.md` → pre-release testing guide; `docs/API.md` annotated; `extension/CHANGELOG.md` records the whole v1 program. Removed claims: nine clients, seven languages, themes, completion notifications, page scanning, "fully tested" Firefox.

**H — Store dossier** (`fa687e0`, `efef03d`): `docs/release/v1/STORE_DOSSIER.md` — identity (gecko id **OPERATOR DECISION REQUIRED**; publisher/trader/contact/privacy-URL **OPERATOR DECISION REQUIRED**), single purpose, listing text draft, permission justifications, Chrome privacy-tab and Firefox data-collection mapping, reviewer notes (test setup, HTTP/CSP rationale, DNR rule, reproducible build), supported environment, known limitations, artefact inventory, asset inventory, release-notes draft, and the list of actions reserved for the operator. Screenshots captured from the actual UI at 1280×800 (`docs/release/v1/assets/01–05`, script `tests/live/screenshots.mjs`); they exposed and led to two popup fixes (empty header band; paused torrents shown as finished) — `Transmission × Chrome` re-run 16/16 on the final tree.

## Phase E — Runtime Validation of State and Vault Gates — COMPLETE — COMMITTED (`8d51232`)

Runner: `extension/tests/live/verify-state.mjs` against two synthetic Transmission-compatible servers (`fake-transmission.mjs`: session-id negotiation, Basic auth, harness-controlled torrent lists with colliding ids 1 and 2, artificial delays, request logs). 17 scenarios; every claim checked against the servers' request logs and the controller's `GET_STATE`. Evidence: `docs/release/v1/evidence/state-vault-{chrome,firefox}.{md,json}`.

| Area | Scenario | Chrome 152 | Firefox 155 |
|---|---|---|---|
| B | two servers configured, A default, list shows A | PASS | PASS |
| B | switch to B while A answers 6 s late: B's queue shown in ~3 s; A's late reply never displayed; controller reports B/connected | PASS | PASS |
| B | pause row "B-one" (id 1): `torrent-stop [1]` reached B only, A (which also has id 1) received nothing | PASS | PASS |
| B | reorder + membership change on the server → rows follow order and membership | PASS | PASS |
| B | second options window mirrors queue and a pause/resume issued in window 1 | PASS | PASS |
| B | popup shows the same server and rows | PASS | PASS |
| B | service worker terminated and restarted → both windows resubscribe and receive new rows | PASS | skipped by design (WebDriver classic cannot terminate the event page) |
| B | host permission revoked via `permissions.remove` → "Access revoked"; Grant access in the server list → LIVE | PASS | PASS |
| C | lock in window 1 → window 2 and popup show Unlock; no queue text remains | PASS | PASS |
| C | wrong master password refused; controller stays `locked`; correct password unlocks both windows | PASS | PASS |
| C | malformed import → "Import failed"; server list and active server unchanged | PASS | PASS |
| C | safe export: `containsSecrets:false`, no `password` key or value, addresses present | PASS | PASS |
| C | sensitive export: `containsSecrets:true`, passwords present | PASS | PASS |
| C | legacy `vaultSalt`+`vaultData` fixture (PBKDF2-SHA256 300k / AES-GCM, generated by the harness) unlocks with its password, rewritten as v2 envelope, legacy keys removed, server usable | PASS | PASS |
| C | corrupt envelope → "Vault damaged" in options and popup, no data shown; explicit acknowledged reset → setup screen, no vault keys left | PASS | PASS |

Not covered at runtime (documented limits): browser restart in Firefox (temporary add-on), lock-on-browser-restart is covered by the Phase C Chrome cell; migration from a real installed prior release (only a fixture with the prior on-disk format).

## Phase C — Live Browser + Torrent-Client Verification — COMPLETE (with Phase D repairs) — COMMITTED

Runner: `extension/tests/live/verify.mjs` (16 scenarios per cell; every claim checked against the server's own API through `oracles.mjs`; evidence written to `docs/release/v1/evidence/live-<client>-<browser>.{md,json}`; screenshots under `evidence/screens/` are git-ignored). Classification document: `docs/release/v1/CLIENT_VERIFICATION.md`.

**Final matrix on the tree of `a8f489a` (all cells re-run after the last code change):**

| Client | Chrome 152 | Firefox 155 | Classification |
|---|---|---|---|
| Transmission 4.1.3 | 16/16 | 16/16 | **VERIFIED FOR V1** |
| qBittorrent 5.2.3 (CSRF protection **on**, Host-header validation on) | 16/16 | 16/16 | **VERIFIED FOR V1** |
| aria2 1.37.0 (`--rpc-secret`) | 16/16 | 16/16 | **VERIFIED FOR V1** |
| Deluge, Flood, ruTorrent, µTorrent, BiglyBT, Vuze | — | — | EXPERIMENTAL / HIDDEN |

Scenarios: vault setup → server form (single URL, disclosure, HTTP-warning logic) → permission grant → test connection → save → live dashboard → add magnet (server-verified) → list → add paused (server-verified paused state) → pause → resume → remove keeping files (other torrent untouched) → wrong credentials (test fails, dashboard shows Authentication failed, restore reconnects) → server stopped (Connection lost) → server restarted (reconnects; Transmission/qBittorrent keep torrents) → browser restart (Chrome: locked → unlock → connected; Firefox: skipped by design, see caveats).

Caveats recorded in `CLIENT_VERIFICATION.md`: Chrome restart re-grants the host permission because the harness reloads the unpacked build (store installs are not reinstalled); Firefox restart not exercised (temporary add-on); prompts automated; live servers were IPv4+port over plain HTTP (HTTPS/sub-path/DNS unit-tested only); single Windows host.

## Phase D — Targeted Repair Loop — COMPLETE — COMMITTED (`18b3069`, `a8f489a`)

| # | Live finding | Repair (smallest necessary) | Tests |
|---|---|---|---|
| 1 | Firefox: all clients "cannot be reached"; preflights sent, replies blocked | `toMatchPattern()`: Firefox gets `http://host/*` (its patterns have no port support; port-qualified patterns are accepted but do not exempt fetches from CORS); Chrome keeps `http://host:port/*` | `permissions.test.ts` |
| 2 | qBittorrent rejects extension `Origin` under default CSRF check (both browsers) | `declarativeNetRequestWithHostAccess` session rule per configured qBittorrent origin setting `Origin`/`Referer` (`HeaderRewriter.ts`); controller `prepareTransport` hook before client creation / test; verified with CSRF **on** in both browsers | `HeaderRewriter.test.ts`, controller test |
| 3 | qBittorrent 5.x ignores `paused` on add | send `stopped` too | adapter test |
| 4 | Wrong qBittorrent password → IP ban within seconds | adapter latches a rejected login until settings change; controller stops automatic polling after `auth_failed` (explicit refresh / settings change retries) | adapter + controller tests |
| 5 | qBittorrent test-connection passed with a wrong password (existing session cookie) | test-connection ends the session first (`auth/logout`) | adapter test |
| 6 | aria2 wrong token shown as network failure | `JsonRpcClient` parses JSON-RPC errors from non-2xx bodies (aria2 sends HTTP 400); multicall bare faults mapped; "Unauthorized" → `UNAUTHORIZED` in any context | adapter tests |
| 7 | Auth failure invisible in Chrome ("Connecting…" during each 2 s retry; aria2 rejects slowly) | settled outcomes stay on screen during retries; `auth_failed` sticky until `invalidate`/force | controller tests |

Decision recorded: qBittorrent support relies on the DNR header rule rather than asking users to disable CSRF protection (which would weaken their server for every website). This adds one manifest permission (`declarativeNetRequestWithHostAccess`; no extra install-time warning in either browser; addons-linter unchanged at 0 errors). Privacy/store documents must describe it (Phase G/H).

### Verification (tree of `a8f489a`)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src --ext .ts,.tsx` | 0 errors, 13 warnings (was 15; two unused symbols removed) |
| `npx vitest run` | **32 files, 716 tests passed** |
| Builds | Chrome + Firefox success, 1.59 MB / 14 files each |
| Determinism | Chrome and Firefox builds byte-identical across two consecutive builds |
| Zips | Chrome 326,607 B; Firefox 326,684 B (+~0.9 KB for HeaderRewriter/controller changes) |
| Manifests | permissions `storage, contextMenus, notifications, alarms, declarativeNetRequestWithHostAccess`; optional hosts unchanged; gecko block unchanged |
| addons-linter 10.11.0 | 0 errors, 3 warnings (unchanged set) |
| Package scans | `_locales/en` only; 0 fonts; 0 remote font refs; 0 native dialogs in `src/` |
| Build side effects | none |

## Phase B — Disposable Runtime Test Environment — COMPLETE — COMMITTED (`ad73f7d`)

Docker unavailable (no WSL). Upstream release binaries pinned by sha256 (qBittorrent installer signature verified against sledgehammer999's key), unpacked without running installers into `CTRL_LIVE_ROOT`; temporary configs, non-default ports (19091/18080/16800), throwaway credentials (`ctrl`/`ctrl-test-password`, token `ctrl-test-token`), DHT/PEX/LPD off, qBittorrent default security on; deterministic private trackerless fixture torrents. Browser harness: stock Chrome via puppeteer-core/CDP `loadUnpacked` with the native permission bubble accepted by Windows UI Automation (`win-invoke-button.ps1`); stock Firefox via selenium-webdriver/geckodriver (`--allow-system-access`, chrome-context tab, `extensions.webextOptionalPermissionPrompts=false`). Details and rejected paths: `extension/tests/live/README.md`.

## Phase 8B — Server Configuration, Truthful UX, Core Accessibility — COMPLETE — COMMITTED (`8959576`)

Carbon-based `ServerForm`/`ServerConfigPanel` (labels, stable ids, keyboard, focus-to-first-invalid, single URL field round-tripped through `parseEndpoint`, hidden clients editable), credential disclosure, plain-HTTP warning, no native dialogs, canonical connection state in the server list, permission revocation reported as revoked with Grant-access recovery (list + popup), `SettingsToggle` accessible names, vault reset (corrupted screen, forgot-password, Settings → System) with explicit acknowledged confirmation. Component tests via React Testing Library. See commit message for the full list.

## Release Gates

| Gate | Status | Evidence |
|---|---|---|
| A — Scope | **PASS** | `V1_SCOPE.md` §3–§5 match the tree; support matrix now filled by `CLIENT_VERIFICATION.md` |
| B — State integrity | **PASS (runtime, single host)** | Phase E: delayed-response discard, id-keyed command routing across servers with colliding ids, reorder/membership, multi-window + popup consistency, service-worker restart resubscribe (Chrome), revocation recovery — both browsers |
| C — Vault/security | **PASS (runtime, single host)** | Phase C: lock on browser restart + unlock (Chrome); Phase E: cross-window lock redaction, wrong master password, corrupt envelope fails closed + reset, import failure preservation, safe/sensitive export content, legacy-format migration fixture — both browsers. Limit: no migration from a real installed prior release |
| D — Supported clients | **PASS** | 6/6 cells 16/16 on `a8f489a`; Transmission, qBittorrent, aria2 VERIFIED FOR V1; others hidden |
| E — Chrome | **PASS (runtime, single host)** | all three clients, all scenarios, real Chrome 152 with the real permission prompt; caveat A (harness reinstall on restart) |
| F — Firefox | **PASS (runtime, single host)** | all three clients, real Firefox 155 headless; validator 0 errors; caveat B (restart not exercised) |
| G — Build/package | **PASS** | deterministic (both targets, consecutive builds); reviewer-style rebuild from the source archive byte-identical (14/14); archive contamination-free; ~327 KB zips; one justified permission addition |
| H — Automated verification | **PASS (STATIC — CI workflow not yet executed)** | unit + component suite 716 green; CI now gates lint, typecheck, tests, both builds, build-twice diff, source mutation, addons-linter, content scans, version/permission consistency, size threshold, checksums; runs only after a push (operator) |
| I — UX/accessibility | PASS (STATIC) | 8B; live runs exercised the keyboard-driven form in both browsers (typed, tabbed, submitted) |
| J — Documentation/store dossier | **PASS (prepared; operator items open)** | README, privacy (md+html), guides, changelog reconciled to the verified v1; dossier drafted with listing text, justifications, disclosures, reviewer notes, screenshots; open: gecko id confirmation, publisher/trader/contact/privacy URL, promo tile |
| K — Final manual acceptance | NOT YET EVALUATED | operator's own pass on a real install (store-signed or unpacked) — not something the batch can do |

## Remaining Blockers / Open Items

1. **OPERATOR DECISION REQUIRED:** confirm the permanent gecko add-on id `{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}` before the first AMO upload (it cannot change afterwards).
2. **OPERATOR DECISION REQUIRED:** publisher account, trader/non-trader declaration, support contact, hosted privacy-policy URL, Chrome promo tile (design asset).
3. Push to `origin` so the new CI package gates actually run (Gate H is static until then); then Gate K (operator's manual acceptance on a real install).
4. Version stays `0.2.0-beta.1`; bump to `1.0.0` only after Gates H (CI green) and K.
5. `.raiden/state/` still reflects the pre-run state (operator-owned dirty files left untouched by instruction); `.raiden/state/OPEN_LOOPS.md` OL-013 (CSRF headers) can be closed with reference to `CLIENT_VERIFICATION.md` §Defects #2.
6. Residual evidence limits: single Windows host; Firefox browser-restart not exercised (temporary add-on); Chrome restart needed a re-grant only because the harness reloads the unpacked build; HTTPS/sub-path/DNS addresses unit-tested only.

## Exact Next Execution Wave

**Operator wave:** (1) confirm the gecko id and the account/legal items above; (2) `git push origin main` and watch the CI `package` job (expected green; it reproduces the local gates); (3) manual acceptance (Gate K) on a real install in both browsers; (4) then bump to `1.0.0` (`package.json` → manifests via `toManifestVersion`), tag, and submit using `STORE_DOSSIER.md`. No engineering wave is pending.

(Superseded plans kept for the record) **Phase F — CI and reviewer-build gates:** CI jobs for addons-linter, package contamination/remote-resource scans, build-twice diff, version consistency, checksums, internal size threshold; `extension/BUILD.md` with the verified environment (Node 24 / npm 11, exact commands, expected output); include `BUILD.md` and `LICENSE` in `zip:source`; run `zip:source` from the clean tree and perform a reviewer-style rebuild from the archive, comparing the generated `firefox-mv3` contents byte-for-byte. Then G (docs/privacy), H (dossier).

(Superseded plan kept for the record) **Phase E — runtime validation of Gates B and C.** Add a small synthetic Transmission-compatible server (`extension/tests/live/fake-transmission.mjs`: session-id negotiation, Basic auth, configurable torrent list with overlapping numeric ids, configurable response delay) and a second runner (`verify-state.mjs`) covering: two configured servers with overlapping ids, delayed response from A while switching to B (stale result and stale command rejection), popup + two options windows, background restart/resubscribe, list reorder/membership changes; vault: lock in one window redacts the other, browser restart, wrong master password, corrupt envelope fixture → reset, import failure preserves state, safe vs sensitive export content, legacy `vaultSalt`/`vaultData` migration fixture. Update Gates B and C only from that evidence. Then Phase F (CI, BUILD.md, source archive), G (docs), H (dossier).

## Local Commits (all on `main`, none pushed)

| Commit | Subject |
|---|---|
| `853666a` | docs(release): preserve v1 release-readiness audit evidence |
| `50e54c4` | fix(security): keep the vault session key out of disk-backed storage (OL-012) |
| `ea87b39` | chore(deps): reconcile pending dev-dependency advisory bumps |
| `d16b7df` | feat(core): stable server identity, generation-checked polling, fail-closed vault |
| `d13123f` | feat(transport): browser-correct HTTP transport, endpoint handling, allowlisted safe export |
| `2621e86` | build(packaging): store-ready manifests, local-only styling, deterministic builds |
| `7377bc2` | docs(release): v1 scope definition and store-policy research notes |
| `09e6677` | docs(release): checkpoint packaging wave |
| `9191c15` | refactor(product): reduce CTRL to the v1 public surface |
| `7c2f019` | docs(release): checkpoint product-surface reduction |
| `8959576` | feat(ui): accessible server configuration, truthful connection recovery, vault reset |
| `0542209` | docs(release): checkpoint server configuration and accessibility wave |
| `ad73f7d` | test(live): disposable torrent-client environment and real-browser harness |
| `b945317` | docs(release): checkpoint disposable runtime environment |
| `18b3069` | fix(firefox): grant port-less host patterns so fetches are CORS-exempt; live scenario runner and first evidence |
| `a8f489a` | fix(clients): live-verified repairs for qBittorrent, aria2 and truthful failure state; all three v1 clients verified |
| `b2c54a8` | docs(release): checkpoint live verification and repair loop |
| `8d51232` | test(live): runtime validation of state-integrity and vault invariants in both browsers |
| `a3e4148` | docs(release): checkpoint state and vault runtime validation |
| `4998d1a` | build(release): CI package gates, reviewer BUILD.md, source archive contents |
| `d4617d1` | build(release): make zip:source workspace check path-separator independent |
| `a534ec6` | docs: reconcile README, privacy policy, guides and changelog with the verified v1 |
| `fa687e0` | build(release): reproducible source archive bytes; store dossier draft |
| `efef03d` | docs(release): store screenshots captured from the actual UI, with the capture script |
| `0e6742b` | fix(popup): remove the empty header band and stop marking paused torrents as finished |
| (this file) | docs(release): checkpoint CI, documentation and store-dossier waves |

Repository rule observed: the RAIDEN `commit-msg` hook forbids `Co-Authored-By` trailers; commits carry the operator identity only.

## Do Not Repeat

- Phases 8A/8B, B, C, D, E, F, G, H: done (see commits and evidence). Do not re-run the client or state matrices unless client-facing or controller code changes; do not redo the reviewer rebuild unless `extension/` sources change.
- The `messages.json` CRLF finding: fixed at the archive (`core.autocrlf=false`) and pinned by `.gitattributes`; the Windows host is otherwise not the release-build host — CI (Linux) produces the artefacts.
- Browser-harness research (Playwright Chromium, BiDi, auto-confirm switch): rejected paths documented in `extension/tests/live/README.md`.
- qBittorrent CSRF decision: taken (DNR header rule, CSRF on). Do not reopen unless a store review objects.
- Carbon-in-jsdom quirks and the Firefox typing/port-pattern findings: recorded in tests and comments.
