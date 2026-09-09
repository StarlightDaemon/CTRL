# CTRL v1 Execution State

## Checkpoint

- timestamp: 2026-09-09 (Phase B disposable runtime environment close-out)
- repository: `E:\Citadel\CTRL`
- branch: `main` (tracks `origin/main`; 14 local commits ahead after this checkpoint, nothing pushed)
- ending HEAD: the commit that adds this checkpoint file, child of the Phase B harness commit (see Local Commits)
- version: `0.2.0-beta.1` (unchanged; manifest `version` `0.2.0.1`; not eligible for 1.0.0 — gates not passed)
- working tree at checkpoint: only the pre-existing operator files under `.raiden/` and `.serena/` remain modified/untracked (11 modified or deleted, 2 untracked). No staged changes. Stash `stash@{0}` (obsolete buildInfo.ts stamp) untouched.
- toolchain used: Node v24.18.0, npm 11.16.0 (`.nvmrc` says 22; CI uses 22 — both work for this tree), addons-linter 10.11.0

## Phase B — Disposable Runtime Test Environment — COMPLETE, COMMITTED

Docker is unavailable on this host (no WSL either). The environment is built from the upstream projects' own release binaries, unpacked without running any installer, into `CTRL_LIVE_ROOT` (default `%LOCALAPPDATA%\Temp\ctrl-live`). Nothing is installed or registered; `env.mjs clean|purge` removes it. Full details: `extension/tests/live/README.md`.

| Component | Version | Provenance | Runtime |
|---|---|---|---|
| Transmission daemon | 4.1.3 (rpc 19) | `transmission-4.1.3-x64.msi`, sha256 `c8ea492d…41f8`, `msiexec /a` extract | `0.0.0.0:19091`, Basic auth, DHT/LPD/portmap off |
| qBittorrent | 5.2.3 (Web API 2.11) | `qbittorrent_5.2.3_x64_setup.exe`, sha256 `ff508e2f…ab2f`, **GPG signature verified** (sledgehammer999 `D8F3…C9A2`), 7-Zip extract | `*:18080`, PBKDF2 login, **CSRF / Host-header / clickjacking protection at defaults (on)** |
| aria2 | 1.37.0 | `aria2-1.37.0-win-64bit-build1.zip`, sha256 `67d01530…41f8` | `0.0.0.0:16800/jsonrpc`, `--rpc-secret` |
| geckodriver | 0.37.1 | `geckodriver-v0.37.1-win64.zip`, sha256 `dfed9315…edd8` | Firefox harness |
| Chrome | 152.0.7977.83 | installed release build | headed, throwaway profile |
| Firefox | 155.0.1 | installed release build | headless, throwaway profile |

Ports, throwaway credentials (`ctrl` / `ctrl-test-password`, aria2 token `ctrl-test-token` — not secrets), directories, start/stop/cleanup commands and logs are recorded in the README and pinned in `extension/tests/live/env.mjs`. The extension targets the host LAN address `192.168.1.235` (non-loopback origin). All three clients were started and probed through their own APIs (`oracles.mjs`: Transmission session-id negotiation + Basic auth; qBittorrent login → `204` + `QBT_SID_18080` cookie in 5.2; aria2 `getVersion`).

**Browser harness (`extension/tests/live/browsers.mjs`)** — both real release browsers load the built extension and open its pages; the optional host permission is granted end-to-end:
- Chrome: `puppeteer-core` 25.10.0 + CDP `Extensions.loadUnpacked`; the native permission bubble is accepted by `win-invoke-button.ps1` (Windows UI Automation, scoped to the harness's own Chrome process). Verified: `permissions.request` → granted, `contains` → true.
- Firefox: `selenium-webdriver` 4.49.0 + geckodriver `--allow-system-access`; temporary add-on install; extension tab opened from chrome context; `extensions.webextOptionalPermissionPrompts=false`. Verified headless: granted.
- Rejected: Playwright's bundled Chromium (side-by-side manifest failure on this host; not the release target), branded Chrome `--load-extension` (ignored), Firefox BiDi (`moz-extension://` navigation refused), Chrome auto-confirm test switch (no effect on the permissions prompt).
- Deterministic fixture torrents (`fixtures.mjs`): private, trackerless, content that exists nowhere; info-hashes recorded in the README.

Nothing beyond scripts/docs/dev-dependencies is committed (no binaries; `builds/`, profiles and `CTRL_LIVE_ROOT` stay outside git).

## Phase 8B — Server Configuration, Truthful UX, Core Accessibility — COMPLETE, VERIFIED, COMMITTED

Starting HEAD `7c2f019`. Startup reconciliation confirmed the previous checkpoint against git and test evidence before mutation (HEAD/branch/stash/dirty files as recorded; tsc clean; ESLint 0 errors / 15 warnings; Vitest 24 files / 647 tests).

### Server configuration workflow (`features/torrent-control/ui/ServerForm.tsx`, `ServerConfigPanel.tsx`)

- Rebuilt on Carbon `TextInput` / `PasswordInput` / `Select` / `Button` / `InlineNotification` / `Modal`. Every control has a real label and a stable id (`server-name`, `server-client`, `server-address`, `server-username`, `server-password`); focus is visible (Carbon focus ring); keyboard-only setup is possible (Tab order name → client → address → …, Enter submits). Validation errors are field-level (`invalid`/`invalidText`), actionable, and the first invalid field receives focus on submit.
- Address is **one complete URL** field backed by `shared/lib/endpoint.parseEndpoint` through the new pure form model `features/torrent-control/model/serverForm.ts`. Stored form is always an absolute http(s) URL ending in `/`; the form shows the stored string verbatim; save → reload → edit → save is a fixed point. Round-trip covered for HTTP, HTTPS, DNS, IPv4, IPv6 (`[::1]`, `[fd00::5]`), non-default ports, reverse-proxy sub-paths, aria2 `/jsonrpc`, query/fragment stripping (`tests/unit/serverForm.test.ts`).
- Client selector offers `PUBLIC_CLIENT_LIST` (Transmission, qBittorrent, Aria2 / Motrix). An existing configuration of a hidden client keeps its type ("<Client> (experimental, not verified)" option) and is loadable/editable without migration; client-specific options are carried over only while the type is unchanged; identity, directories, defaults, `httpAuth`, `showInContextMenu` are always carried over.
- Credential disclosure at the point of entry (`CREDENTIAL_DISCLOSURE`, referenced by `aria-describedby` from both login fields): encrypted before storage in this browser; sent only to the configured server address to sign in; never sent to the CTRL developer or anyone else.
- Plain-HTTP warning (`HTTP_WARNING_TITLE`/`HTTP_WARNING_TEXT`, live region) for `http://` to a non-private host: credentials and commands can be read or altered in transit. HTTP is not prohibited (no policy decision requires it; `V1_SCOPE.md` §6).
- Host permission: `features/torrent-control/model/useHostPermission.ts` checks the origin, re-checks on `permissions.onAdded/onRemoved`, and requests synchronously from the click handler (Firefox user-gesture rule). Save no longer depends on the grant (the truthful connection state reports `permission_missing`); Test connection requires it and says so.
- Test connection sends `TEST_CONNECTION` with the normalised configuration; success/failure are `role="status"` / `role="alert"` notifications carrying the adapter's user message.
- Native dialogs: `window.alert` / `window.confirm` are gone from the retained server workflow (grep of `src/` is empty). Remove uses a Carbon danger `Modal` that states what is deleted and that the client is untouched; import results are in-product notifications; the page no longer reloads after import.
- Server list: `<ul aria-label="Configured servers">`, per-row buttons named with the server (`Edit X`, `Remove X`, `Make X the default server`), Default / experimental tags. The active server row shows the **background controller's canonical `ConnectionState`** via `describeConnection` (no second connection architecture) and a `Grant access` button when the state is `permission_missing`.
- Migration card: Carbon buttons; the file input is triggered from a real button (keyboard-operable).

### Truthful state and permission revocation

- `TorrentController.notePermissionRemoved()` + background `permissions.onRemoved` listener: the next poll that lacks permission reports `lastErrorType: 'PERMISSION_REVOKED'` with "Access to this server address was removed in the browser. Grant it again to reconnect." (`PERMISSION_MISSING` otherwise; the flag clears once access is confirmed). Queue is cleared, subscribers get a cleared STATUS.
- `describeConnection` now distinguishes "Access revoked" from "Access not granted" and has a distinct title for all eleven canonical statuses (`tests/unit/connectionPresentation.test.ts`). Copy pointing at the removed "Settings → System" reset path now says "Open CTRL settings to reset it."
- Popup: `Grant access` button appears under the status when the active server is `permission_missing` (calls `permissions.request` in the click handler; background `onAdded` → invalidate → reconnect).
- No new permissions; manifests unchanged (verified below).

### SettingsToggle

`id` is required; the visible text is a `<label htmlFor={id} id={id}-label>` and the Carbon `Toggle` switch uses `aria-labelledby` (accessible name = setting name, not "On/Off"), `aria-describedby` for the description. Ids: `setting-add-paused`, `setting-add-advanced`, `setting-enable-notifications`. Context-menu per-server toggles already had names (8A).

### Vault reset (implemented — `VaultService.reset()` already existed)

- `useVault().reset()`; `shared/ui/security/ResetVaultDialog.tsx`: Carbon danger modal, primary action disabled until the "I understand that every saved server and login will be deleted" checkbox is ticked; states precisely what is deleted (every server's address/username/password; the master password — key discarded, no recovery) and what is kept (preferences; nothing on the torrent clients).
- Exposed from: `VaultCorrupted` screen (new; `VaultGuard` previously fell through to the unlocked content for a corrupted vault — fixed, children are never rendered), "Forgot your master password?" on the options unlock screen (not in the popup), and a "Reset vault" card under Settings → System.
- Tests: dialog gating and failure handling; VaultGuard corrupted → reset → setup (`tests/unit/ui/ResetVaultDialog.test.tsx`).

### Test infrastructure

`@testing-library/react@16.3.3` and `@testing-library/user-event@14.6.7` added as exact dev dependencies (lockfile updated); `vitest.setup.ts` gains a no-op `ResizeObserver` (Carbon Modal). `tests/unit/ui/browserStubs.ts` stubs `chrome.permissions` and `runtime.sendMessage`, which the fake browser leaves unimplemented. Component tests assert accessible names/roles, keyboard operation, live regions, absence of native dialogs (spied), and the exact messages sent to the background. Note for future tests: every Carbon `TextInput` renders an empty `role="alert"` announcer span and Carbon danger buttons carry a visually hidden "danger" name prefix.

### Verification results (final tree, before commit)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src --ext .ts,.tsx` | 0 errors, 15 warnings (unchanged, pre-existing) |
| `npx vitest run` | **30 files, 696 tests passed** (+6 files / +49 tests) |
| `wxt build -b chrome` / `-b firefox --mv3` | success; 1.59 MB unpacked, 14 files each |
| Zips | Chrome 325,748 B, Firefox 325,823 B (previous wave 323 KB; +~2.5 KB from the form/dialogs) |
| Manifests | permissions `storage, contextMenus, notifications, alarms`; optional hosts `http://*/*`, `https://*/*`; `default_locale: en`; Chrome `minimum_chrome_version 120`; gecko id/`strict_min_version 140.0`/`data_collection_permissions authenticationInfo` intact — **no permission changes** |
| Package scan | `_locales/en` only; 0 font files; 0 `s81c.com`/Google Fonts/`@font-face` refs; no removed-feature strings |
| Native dialogs | `grep` for `window.alert`/`window.confirm`/`alert(`/`confirm(` in `src/`: none |
| Determinism | two consecutive Firefox builds byte-identical (14 files, sha256) |
| Build side effects | none (`git status` unchanged by build/zip) |
| `addons-linter` 10.11.0 | **0 errors**, 3 warnings (2× React `innerHTML`, 1× Android min-version key) — unchanged |
| Keyboard/accessibility inspection | jsdom-level: label association, Tab order, Enter submit, focus-to-first-invalid, switch names, modal buttons, live regions all asserted by tests. **Not yet inspected in a real browser** (needs Phase B harness) |
| `git diff` scope | 17 modified + 8 new files under `extension/`; no `.raiden`/`.serena` files touched; CRLF preserved on the four files the index stores as CRLF |

## Release Gates

| Gate | Status | Note |
|---|---|---|
| A — Scope | **PASS (implemented)** | `V1_SCOPE.md` §4 residuals ("rebuild form on Carbon inputs", "vault reset") now done |
| B — State integrity | NOT YET EVALUATED | unit-tested in `d16b7df` (+ revocation path in `8959576`); no runtime/multi-window verification |
| C — Vault/security | NOT YET EVALUATED | unit-tested incl. corrupted → reset; migration from a real prior install untested |
| D — Supported clients | NOT YET EVALUATED | no client live-verified in either browser; the three visible clients are candidates only |
| E — Chrome | NOT YET EVALUATED | harness established (Phase B): stock Chrome 152 loads the build, extension pages drivable, host permission grant automated; runtime scenarios pending (Phase C) |
| F — Firefox | PASS (static) | validator 0 errors; harness established (Phase B): stock Firefox 155 installs the build temporarily, pages drivable headless, permission grant automated; runtime scenarios pending (Phase C) |
| G — Build/package | PASS (static) | 1.59 MB / 326 KB; deterministic; no contamination; no permission change |
| H — Automated verification | NOT YET EVALUATED | unit suite green (696); CI has no linter/size/diff gates; e2e specs not re-run |
| I — UX/accessibility | **PASS (STATIC)** | All 8B exit criteria met at jsdom level: keyboard-only server setup, every input named, no `alert`/`confirm`, sub-path survives save/edit, credential disclosure, HTTP warning, truthful state incl. revocation, SettingsToggle names, vault reset with explicit confirmation. Residual for a browser pass (Phase B/E): contrast of the Tailwind-token status text, screen-reader announcement order, Firefox permission-prompt behaviour from the popup (the doorhanger may close the popup; options page path exists) |
| J — Documentation/store dossier | NOT YET EVALUATED | unchanged from 8A; additionally the privacy text must now match the in-product disclosure wording |
| K — Final manual acceptance | NOT YET EVALUATED | |

## Remaining Blockers / Open Items (carried forward)

1. Operator confirmation of the permanent gecko add-on id `{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}` before first AMO signing — **OPERATOR DECISION REQUIRED**.
2. `BUILD.md` for the AMO source archive; `zip:source` run from a clean tagged tree.
3. CI packaging gates (addons-linter, size regression, build-twice diff, contamination check).
4. Firefox and Chrome runtime verification (harnesses now exist; the scenario matrix is Phase C). Note: in Chrome 152 `chrome-extension://` pages are navigable after CDP `Extensions.loadUnpacked` — the earlier note was wrong for this path.
5. qBittorrent CSRF supported-path decision from a live browser test (environment now runs 5.2.3 with default protections on).
6. ~~Live client environment lives only in a prior session scratchpad~~ — now repository-native under `extension/tests/live/` (Docker still unavailable; native upstream binaries used instead).
7. `.raiden/state/` still reflects the pre-run state (operator-owned dirty files left untouched by instruction).

## Exact Next Execution Wave

**Phase C — live browser + torrent-client verification.** Write `extension/tests/live/verify.mjs`: for each client × browser run the common matrix (clean state → vault setup → server configuration → permission grant → test connection → save → connected → add magnet → add paused → pause → resume → remove keeping files → bad credentials → server unavailable → reconnect/client restart), checking every claim against the server through `oracles.mjs`, and write sanitized evidence to `docs/release/v1/evidence/`. Transmission first (Basic auth, session-id negotiation, sub-path, numeric ids, reconnect), then qBittorrent (5.2.3, cookie session, CSRF with defaults on, non-localhost, modern stop/start states), then aria2 (`/jsonrpc`, token, endpoint round-trip). Classify each client VERIFIED FOR V1 / FAILED — REPAIRABLE / BLOCKED BY ENVIRONMENT / EXPERIMENTAL-HIDE.

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
| (harness) | test(live): disposable torrent-client environment and real-browser harness |
| (this file) | docs(release): checkpoint disposable runtime environment |

Repository rule observed: the RAIDEN `commit-msg` hook forbids `Co-Authored-By` trailers; commits carry the operator identity only.

## Do Not Repeat

- Audit reconciliation, vault remediation, dependency reconciliation, state-integrity/transport design, packaging wave, product-surface reduction, server-configuration/accessibility rebuild: done (see commits).
- Chrome/Mozilla policy research: preserved in `docs/release/v1/research/`.
- Consumer analysis for the deleted surfaces: done; do not re-audit unless a regression is suspected.
- Confirming that branded Chrome ignores `--load-extension`: confirmed.
- Carbon-in-jsdom quirks (empty `role="alert"` announcers in TextInput; "danger" prefix in danger button names; `ResizeObserver` needed for Modal): known, handled in `vitest.setup.ts` and the UI tests.
- Browser-harness research (Playwright Chromium, BiDi, auto-confirm switch): done; see `extension/tests/live/README.md` "Rejected paths". Do not re-try them.
