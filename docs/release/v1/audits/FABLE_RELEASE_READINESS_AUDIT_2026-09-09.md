---
artifact: CTRL Fable Release Readiness Audit
audit_date: 2026-09-09
role: independent repository/release assessment
status: historical assessment evidence; findings require reconciliation against current repository state before implementation
source_agent: Fable
---

# CTRL — Full Repository, Architecture, Product, and Release Readiness Assessment

Assessment date: 2026-09-09 (evidence gathered 2026-09-08 to 2026-09-09)
Mode: REVIEW / ASSESSMENT / RECONCILIATION ONLY. No files, commits, pushes, releases, or submissions.

---

# Decisions Made

Recommendations the evidence supports without further operator input:

1. **Treat the shared HTTP transport as the first foundational fix.** One `FetchHttpClient` policy (`credentials: 'omit'`, manual `Origin`/`Referer`/`Cookie` headers that browsers silently drop, JSON coercion of every non-form body) breaks Deluge, Flood, uTorrent and ruTorrent outright and breaks qBittorrent against any non-localhost host with default CSRF protection. Per-adapter transport policy (credentials mode, raw-body passthrough, header strategy) must be introduced before any adapter-level symptom work.
2. **Ship v1 with a verified client subset.** Publicly advertise only adapters that pass a live browser test against a real client (today's candidates: qBittorrent, Transmission, BiglyBT, Aria2). Keep the other adapters in code but mark them "experimental" in the UI and listing, or hide them, until they pass.
3. **Add a Firefox-only manifest block** (`browser_specific_settings.gecko.id`, `strict_min_version` ≥ 128, `data_collection_permissions`) generated from `wxt.config.ts` by browser target. addons-linter currently reports one error (`ADDON_ID_REQUIRED`) and this is a hard AMO blocker.
4. **Fix packaging before any store work.** The production package is 40.67 MB with 1,058 font files, two ~1 MB CSS bundles containing the full Carbon stylesheet twice, 105 remote `s81c.com` font URLs in shipped CSS, non-deterministic font asset names between consecutive builds, and a build script that rewrites a tracked source file. Target: < 3 MB, byte-identical rebuilds, no remote URLs.
5. **Use `scripts/zip-source.ts` (git archive of a clean tree), never the WXT auto-generated `-sources.zip`, for AMO source upload.** The WXT sources zip sweeps in `backups/` (old torrent-site content scripts for 1337x, RARBG, TPB, Nyaa etc.), `build_log.txt`, `audit_extension*.txt`, and `playwright-report/`.
6. **Remove or hide every settings control that has no runtime consumer** (theme selector, layout/sidebar, notification level and style, "Open Web UI" context toggle, performance mode, enhanced diagnostics, command palette, "Storage Health" card, popup Debug tab) rather than implementing them for v1.
7. **Remove the Utilities external-link surface** (torrent cache sites, "IKnowWhatYouDownload", WebTorrent checker) from the shipped product. It is outside the single purpose and is the most likely reviewer trigger under both stores' copyright-facilitation language.
8. **Disarm `auto-localize.yml`** before any further push that touches the English locale, and downgrade the "7 languages" claim to "English, with partial translations" or ship English-only for v1.
9. **Commit the in-flight OL-012 vault-key remediation** (already in the working tree, tested by the new `KeyManager.test.ts`) as its own commit after review; it is a genuine security improvement and a prerequisite for the Firefox build to be credible.
10. **Reproducible-build gate for Firefox**: pin Node/npm versions in the source README, eliminate `generate-build-info.ts` timestamp rewriting, make font asset emission deterministic (or stop bundling Plex), and add a CI job that builds twice and diffs.
11. **Do not add `declarativeNetRequest` back** to solve qBittorrent CSRF unless a live test proves `credentials: 'include'` plus documented server-side settings cannot work. Prefer the least-permission path first.
12. **Keep WXT + single codebase + per-browser manifest generation.** No browser abstraction layer, no framework migration, no vite 8 / Babel 8 migration before v1.

# Decisions Deferred

Only matters that need more evidence or operator choice:

1. **Live runtime verification of the four broken adapters and the qBittorrent CSRF finding.** These are static/spec-derived conclusions (Confirmed by code trace, High confidence) but were not executed against real clients in this review; the project's own OL-013 records the same gap. A one-day live matrix (Chrome + Firefox × each client, non-localhost host) decides which adapters ship in v1.
2. **Firefox `data_collection_permissions` value** (`["none"]` with reviewer note vs `["authenticationInfo"]`). Policy text supports both; reviewer practice is unverified.
3. **Whether to keep plain-HTTP LAN support without an in-UI warning.** Both stores' "use encryption when transporting data" language is a gray area for user-owned LAN servers.
4. **Master-password vault as a mandatory first-run step.** It is the largest onboarding friction and the source of the "not configured" confusion, but changing it changes the security posture and privacy statements.
5. **Whether the public GitHub repository should keep `.raiden/`, `.serena/`, and `docs/reference/` tracked.** They are operator process artefacts (including a written map to a formerly exposed key) that will be read by store reviewers who follow the homepage link.
6. **Trader/non-trader (EU DSA) self-declaration** for the Chrome Web Store.

# Critical Issues

P0 (release stop) and the most consequential P1s:

| ID | Title | Gate |
|---|---|---|
| FND-01 / ADP-01..04 | Deluge, Flood, uTorrent, ruTorrent cannot authenticate or speak their protocol through the shared HTTP client | BLOCKS BOTH STORES (minimum functionality / false advertising) |
| FF-01 | No `browser_specific_settings.gecko` (id, min version, data-collection consent); addons-linter error | BLOCKS FIREFOX |
| PKG-01 / BUILD-01 | 40.7 MB package, remote font URLs, duplicated CSS, non-reproducible builds, tracked-file rewrite during build | BLOCKS FIREFOX (reproducibility), BLOCKS QUALITY BAR (Chrome) |
| REL-01 | WXT sources zip contains legacy torrent-site content scripts, build logs, audit notes | BLOCKS FIREFOX if that archive is uploaded |
| ADP-05 | qBittorrent default CSRF protection rejects extension `Origin`; works only on localhost | BLOCKS QUALITY BAR (flagship client) |
| PRIV-01 / PRIV-02 | Privacy policy and README claim no external requests, completion notifications, 7 languages, "fully tested" Firefox; implementation disagrees; no in-UI disclosure at credential entry | BLOCKS BOTH STORES (disclosure accuracy) |
| PROD-01 | Utilities links to torrent-cache and IP-tracking sites | BLOCKS QUALITY BAR / high policy risk |
| UX-01 | Popup shows "Extension not configured / Setup Now" when the vault is merely locked; no unlock path in popup | BLOCKS QUALITY BAR |
| ARCH-01 / ARCH-02 | Poll results and row commands not bound to a server; positional diff patches corrupt row identity on reorder (destructive actions can hit the wrong torrent) | BLOCKS QUALITY BAR |
| CI-01 | `auto-localize.yml` armed with `contents: write`, never run, would overwrite real translations with placeholders | BLOCKS QUALITY BAR |

# Changes and Verification

- Repository inspected: `E:\Citadel\CTRL` (git root), remote `origin = git@github.com:StarlightDaemon/CTRL.git`, public.
- Ref inspected: branch `main` at `f088c5f857d4f229534562f8c87c92bf4ba66df9` (2026-07-15), 0 ahead / 0 behind `origin/main`, 105 commits, single author. Working tree dirty: 19 entries (RAIDEN/Serena state, `extension/package.json` + lockfile bumps, uncommitted OL-012 vault-key remediation in `background.ts`, `ContextMenuService.ts`, `KeyManager.ts`, and a new untracked `tests/unit/KeyManager.test.ts`). One stash (`buildInfo.ts` regenerated stamp). One local tag `pre-dependabot-delete-backup`.
- Commands run (all read-only with respect to tracked state; outputs only under ignored `builds/`, `.wxt/`, `test-results/`, npx cache, and the session scratchpad):
  - `npm run compile` → pass (tsc, 0 errors)
  - `npm run lint` → 0 errors, 31 warnings
  - `npx vitest run` → 16 files, 530 tests passed (13.9 s)
  - `npx wxt build -b chrome` (×3) and `npx wxt build -b firefox --mv3` (×2) → success; 40.67 MB each; consecutive Chrome builds differ in `assets/style.css` (font asset numbering)
  - `npx wxt zip -b firefox --mv3` → `ctrl-extension-0.2.0.1-firefox.zip` 38.4 MB (1,091 files) + `-sources.zip` 923 KB (524 files incl. `backups/`)
  - `npx --yes addons-linter builds/firefox-mv3` → 1 error (`ADDON_ID_REQUIRED`), 5 warnings (`MISSING_DATA_COLLECTION_PERMISSIONS`, 2× `DANGEROUS_EVAL` in `background.js`, 2× `UNSAFE_VAR_ASSIGNMENT` innerHTML in React chunk)
  - `npm audit` → 0 vulnerabilities in production deps; 12 in dev deps (6 high: sharp < 0.35.4, undici 7.x, nanoid)
  - `CI=true npx playwright test --grep-invert @integration` → 6/6 failed: Chromium binary not installed locally. Not installed by me. E2E status relies on the CI record: `gh run list` shows the last 6 CI runs on `main` succeeded (latest 2026-07-16 for `f088c5f`).
  - `gh run list --workflow=auto-localize.yml` → no runs ever.
  - `git ls-files`, `git diff`, `git stash list`, `git show`, `gh repo view` (visibility PUBLIC).
- Policy sources checked (fetched 2026-09-08/09): developer.chrome.com program policies (quality guidelines, minimum functionality, privacy, user-data FAQ, limited use, disclosure requirements, 2026 policy update, data handling, dashboard privacy tab, MV3 requirements, permissions, deceptive installation, code readability, malicious/prohibited, IP, listing requirements, images, register/set-up-account, trader disclosure, review process, LNA blog), Chrome extension references (manifest version, minimum_chrome_version, CSP, alarms, storage, permissions list, activeTab, SW lifecycle, browser namespace), MDN (background, browser_specific_settings, host_permissions, optional_permissions, permissions.request, user actions, CSP, storage.session, alarms, menus, action, scripting, notifications, getBrowserInfo, Firefox 115/128 release notes, Chrome incompatibilities), extensionworkshop.com (add-on policies 2026-04-30, source code submission, third-party libraries, submitting an add-on, listing, MV3 migration guide, built-in data consent, signing overview, web-ext), blog.mozilla.org/addons (data-collection consent 2025-10-23; API changes 149–152), github.com/mozilla/addons-linter rules (secondary).
- Files changed: **none**. Commits created: **none**. Pushes: **none**. Releases / deployments / submissions: **none**.
- Not performed: browser runtime verification against live torrent clients; Playwright e2e locally; Firefox runtime CSP/upgrade-insecure-requests behaviour; Chrome ≥144 LNA behaviour.

---

# Full Detailed Report

## 2. Repository Verification

| Item | Value |
|---|---|
| Project | CTRL ("CTRL - Torrent Control"), `extension/package.json` name `ctrl-extension`, version `0.2.0-beta.1` |
| Working directory / root | `E:\Citadel\CTRL` (extension workspace at `E:\Citadel\CTRL\extension`) |
| Branch / HEAD | `main` @ `f088c5f` "chore: ignore AppleDouble and .DS_Store files" (2026-07-15) |
| Remote | `origin git@github.com:StarlightDaemon/CTRL.git`, PUBLIC, no releases, no open issues/PRs |
| Working tree | Dirty: 19 entries (see Changes and Verification). Pre-existing; preserved. |
| Instruction files | `AGENTS.md` (RAIDEN control plane; forbids `Co-Authored-By`, enforced by `.git/hooks/commit-msg`), `.raiden/` (21 tracked files: state, decisions, open loops), `.serena/` (8 tracked), no `CLAUDE.md` |
| State/decision docs | `.raiden/state/CURRENT_STATE.md`, `OPEN_LOOPS.md` (OL-001..OL-016), `DECISIONS.md` (D-001..D-006), `WORK_LOG.md` |
| Build config | `extension/wxt.config.ts` (WXT 0.20.27, Vite 7.3.5, React 18.2), `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `tailwind.config.js` |
| Prior audits (secondary evidence) | `.audits/CTRL_ADVERSARIAL_ENGINEERING_AUDIT_2026-09-08.md` and five earlier audits (untracked, ignored); ~200 historical reports under `reports/`, `docs/reports/` (ignored) |

No ambiguity about the target repository.

## 3. Evidence Standard Applied

Findings are tagged **CONFIRMED** (traced in current source or reproduced by command), **HIGH-CONFIDENCE** (traced, depends on documented browser behaviour not executed here), **PLAUSIBLE — VERIFY**, or **UNKNOWN**. The 2026-09-08 adversarial audit and RAIDEN open loops were used as leads only; every claim carried forward was re-traced in the current tree.

## 4. External Requirements Checked (2026-09-08/09)

Summarised here; per-item citations live with the findings.

Chrome: MV3 mandatory; single narrow purpose; minimum functionality; privacy policy mandatory when handling any user data including "authentication information… even when… stored locally"; in-UI prominent disclosure (a privacy-policy link alone is insufficient); 2026 policy update (enforced from 2026-08-01) requires data collection to be strictly necessary and prominently disclosed; no remotely hosted code; narrowest permissions; per-permission justification fields in the dashboard; `version` = 1–4 integers 0–65535; CSP `script-src`/`object-src`/`worker-src` limited to `'self' 'none' 'wasm-unsafe-eval'` (`connect-src` not restricted in text); alarms ≥ 0.5 min; SW idle 30 s, kept alive by API calls / ports (114+) / WebSocket traffic (116+); `storage.session` 102+, trusted contexts by default; icons 128 px; screenshots 1280×800 or 640×400 (1–5); small promo tile 440×280 required; manifest `description` ≤ 132 chars; broad `*://*/*` host patterns (even optional) trigger deeper review; developer registration fee + email verification + trader/non-trader declaration; policies prohibit facilitating unauthorized access to copyrighted content (no BitTorrent-specific text). Chrome LNA (142+) restricts web origins; extension exemption tied to granted host permission (secondary source only).

Firefox/AMO: `background.service_worker` unsupported — `background.scripts` event page required (both keys allowed for cross-browser); `browser_specific_settings.gecko.id` mandatory for MV3 signing; `strict_min_version` ≥ 115/128 for signature validity; `gecko.data_collection_permissions` mandatory for all new AMO submissions since 2025-11-03 (`required: ["none"]` or specific categories such as `authenticationInfo`); MV3 host permissions optional-by-default, `optional_host_permissions` from Firefox 128, `permissions.request` must be called synchronously inside a user-action handler; default MV3 CSP adds `upgrade-insecure-requests` (a custom `extension_pages` CSP replaces it); Add-on Policies (2026-04-30): no surprises, data transmission minimal with consent, must use encryption when transporting data remotely, no remote code, unmodified release third-party libraries, minified OK / obfuscated not, **source code submission required for bundled/minified code** with OS + tool versions + exact commands + lockfile, reviewer rebuilds and diffs — must be identical (default reviewer env Ubuntu 24.04.4, Node 24.14.0, npm 11.9.0); listing: summary ≤ 250 chars, icons 32/64 (+128), screenshots 1280×800, notes-to-reviewer with test credentials when login is needed; unsigned extensions cannot install in release Firefox; `web-ext lint`/addons-linter is the validator.

Cross-browser conflicts that a single manifest cannot paper over: background key shape; gecko block only for Firefox; CSP default differences; host-permission grant model; `chrome.*` promise support (Firefox yes; Chrome `browser.*` only 148+); data-consent surfaces (dashboard form vs manifest key); source-code submission (AMO only).

## 5. Reconstructed Product Model

### 5.1 Purpose

CTRL is a browser-action extension that lets a user who already runs a BitTorrent client with a web API (qBittorrent, Transmission, Deluge, Flood, ruTorrent, µTorrent, BiglyBT, Vuze, Aria2) add magnet links / torrent URLs to that client and see or control its queue from the browser toolbar and right-click menu. It stores the client's URL and credentials locally, encrypted under a user-chosen master password, and talks only to the user-configured server.

- Primary user: self-hoster / seedbox user with one or more torrent clients.
- Primary workflow: right-click a magnet link → "Add to Torrent Control" (or paste a link in the popup) → torrent appears in the client.
- Secondary workflows: pick active server; view active torrents / speeds (popup mini-list, options-page virtualized list with pause/resume/remove); badge with count or speed; "Scan Page for Magnets"; backup/import settings; open the client's Web UI.
- Entry points: toolbar popup (400×600), options page (full tab), context menu items on links/selection/page, browser notifications, action badge. No content scripts, no side panel, no commands/shortcuts, no override pages.
- What it observes/transmits: only on user action; sends magnet/URL plus credentials to the configured server; reads `a[href^="magnet:"]` from the current tab only via the "Scan Page" menu item (activeTab + scripting). Background polls the configured server (every 2 s while a UI port is open; every 60 s via alarm otherwise) to refresh badge/state.
- What makes it useful: one-click hand-off of links to a self-hosted client without opening its Web UI; multi-server switching.

**One-sentence reviewer description (draft):** "CTRL lets you send magnet links to, and monitor, the BitTorrent client you already run (qBittorrent, Transmission, and others) directly from your browser; your client address and login are stored encrypted on your device and nothing is sent anywhere else."

Multiple purposes? The core is single-purpose. Two surfaces stray: the Utilities page's links to third-party torrent-cache / privacy-check websites (`src/shared/lib/resources.ts`, `Utilities.tsx`), and the popup "Debug" tab. Both should be removed (PROD-01, UX-02).

### 5.2 User journey (as implemented)

1. **Install** — no `onInstalled` onboarding; only context-menu rebuild (`ContextMenuService.ts:66-69`). Chrome shows "Display notifications" as the only install warning; no host access granted.
2. **First popup** — `features/torrent-control/ui/Dashboard.tsx:124,199-224` shows "Extension not configured." + **Setup Now** because `useSettings` only loads servers when the vault is initialised and unlocked. Popup tabs: Control / Settings (placeholder that opens options) / Debug (no-op in production, `Popup.tsx:81-103`, `wxt.config.ts:91`).
3. **Setup Now → options** — `VaultGuard` → `SetupVault` (master password ≥ 8 chars, warns it cannot be recovered). No explanation of *why* a master password is needed before the first server. After creation, landing view is the torrent Dashboard with placeholder stat cards ("Storage Health: Unknown", "Connection: Online" hard-coded) rather than the Servers tab.
4. **Add server** (`ServerConfigPanel.tsx`) — name, client type, protocol/host/port (path is stripped on edit; breaks Aria2 `/jsonrpc` and reverse-proxy sub-paths), username, password. Test Connection and Save are disabled until the per-origin host permission is granted through the "Grant Local Access / Grant Permission" button (`permissions.ts:36-40`, called synchronously in the click handler — correct for both browsers). Vault must be unlocked to save. Remove uses `window.confirm`.
5. **Normal use** — popup shows server tile, status line, quick-add, first 3 torrents (count badge shows all), Web UI / Test / Open Settings. Context menu: Add, Add Paused, Scan Page, per-server / per-label / per-path submenus (English only). Options Dashboard: virtualized list with hover actions, global speeds.
6. **Error states** — popup Test collapses every failure to "Failed"; options Test shows the adapter's user message. Adapter failures surface as text; no retry guidance.
7. **Settings** — many controls persist values nothing reads (theme, layout, notification level/style, Open Web UI toggle, performance, enhanced diagnostics).
8. **Locked vault / missing permission** — after any browser restart the session key is gone, so the popup reverts to "Extension not configured" with no unlock control (UX-01). If host permission is later revoked, background fetches fail with a generic error; there is no `permissions.onRemoved` handling.
9. **Update** — `purgeLegacyFallbackKey` runs on every SW wake (dirty tree); no other migration. Settings deep-merge with defaults on load (`useSettings.ts:82-90`).
10. **Uninstall** — storage removed by the browser; no cleanup needed. Export/backup exists but "safe" export leaks `clientOptions.simpleApiKey` (SEC-03).

Unclear/surprising points: master password before any value; "not configured" when locked; Storage Health placeholder; Debug tab; settings that do nothing; English-only context menus and most UI on non-English locales; count badge vs 3-row list; `alert()`/`confirm()` dialogs; page reload after import.

### 5.3 Architecture

```
 Toolbar popup (React, popup.html)          Options page (React, options.html, opened in tab)
   Dashboard.tsx  ──GET_TORRENTS/ADD/TEST──┐    App.tsx > VaultGuard > Dashboard.tsx
   polls every 2 s via runtime.sendMessage │      useTorrentPoller: runtime.connect('ctrl-active-session')
                                           │      + UPDATE_VIEWPORT / VIEWPORT_UPDATE / VIEWPORT_DIFF / STATS_UPDATE
                                           ▼                       │
              ┌───────────────── background.ts (Chrome SW / Firefox event page) ─────────────────┐
              │ isTrustedSender(sender.id === runtime.id)                                          │
              │ ServerResolver.resolve() → VaultService (AES-GCM, PBKDF2-300k, key in storage.session)
              │ ClientFactory.create(config) → dynamic import of 1 of 9 adapters (ITorrentClient)   │
              │ performCheck(): setInterval 2 s while ports open; alarm 'packet_beat' every 1 min   │
              │ ViewportManager → TorrentDiffer (RFC6902 patches) → StateHydrator (storage.session) │
              │ ContextMenuService (@singleton): rebuild on storage watches; onClicked → addTorrentUrl
              │   'scan-page' → scripting.executeScript (activeTab) → a[href^=magnet:]              │
              │ Badge (count/speed), notifications                                                  │
              └──────────────────────────────┬────────────────────────────────────────────────────┘
                                             ▼
                        FetchHttpClient (credentials:'omit', 10 s abort, JSON coercion)
                        JsonRpcClient (aria2) │ adapter-private fetch (qBittorrent, BiglyBT simple API)
                                             ▼
                        User's torrent client Web API (http/https, LAN or remote)
Storage: local:options (settings), local:vaultSalt, local:vaultData (ciphertext), session:encryptionKey, session:torrent_state
```

Components: manifest generated by `wxt.config.ts` (single config; WXT emits `service_worker` for Chrome, `scripts` for Firefox); no content scripts; no side panel; no commands; DI via `tsyringe` decorators but no container (`@injectable`/`@singleton` are decorative); state: React hooks + one Zustand store (`useTorrentStore`) for the virtualized list; i18n via `browser.i18n.getMessage` in 7 of 41 UI files; tests: Vitest (jsdom + `@webext-core/fake-browser`) 16 files / 530 tests, Playwright 6 CI tests + 3 `@integration`; CI: lint → typecheck+unit → build both → Chrome e2e; no release automation; docs: README, ROADMAP, docs/* (several stale); no telemetry, no error reporting, no analytics (confirmed by grep and bundle scan: only `s81c.com` font URLs, `wxt.dev` doc strings, and the Utilities links).

## 6. Repository Inventory (high-signal)

| Area | Role | Notes |
|---|---|---|
| `extension/src/entrypoints/` | `background.ts` (451 lines), `popup/`, `options/`, `style.css` | Only three entrypoints; `style.css` imports full Carbon + Plex CSS |
| `extension/src/shared/api/clients/` | 9 adapters (~7.2k lines) + `shared/` AdapterError | Largest area; Transmission 1,068 lines, BiglyBT 1,032 |
| `extension/src/shared/api/network/` | `FetchHttpClient`, `JsonRpcClient`, `HttpError`, `HeaderRewriter` (dead no-op) | Single transport policy — foundational defect |
| `extension/src/shared/api/security/` | `SecurityService`, `VaultService`, `KeyManager` | OL-012 remediation uncommitted |
| `extension/src/shared/api/server/ServerResolver.ts` | Vault → active server resolution | Used by background + context menu |
| `extension/src/features/torrent-control/` | `model/` hooks (`useSettings` 419 lines, `useVault`, `useTorrentPoller`), `model/services/ContextMenuService.ts` (484), `services/` (Lifecycle, Hydrator, Viewport), `ui/` (13 components + settings/) | Feature-sliced naming but `services/` vs `model/services/` split is arbitrary |
| `extension/src/entities/` | `Torrent`, `ServerConfig`, `ITorrentClient`, `ClientFactory`, `TorrentRow` | Second `ITorrentClient.ts` copy in `features/.../model/types/` — duplicate |
| `extension/src/shared/lib/` | constants (CLIENT_LIST, DEFAULT_OPTIONS), diff, retry (two retry helpers), websocket (unused), i18n (three unused helper modules), permissions, network (`isPrivateIP`), `buildInfo.ts` (generated, tracked) | |
| `extension/src/shared/ui/` | Carbon-based layouts, vault screens, `CommandPalette` (empty), `DebugOverlay`, `Toast` (unused), `PlaceholderPage`/`PageHeader`/`Card` (unused) | |
| `extension/src/public/` | `_locales/{de,en,es,fi,fr,ru,zh_CN}`, icons 16–128, fonts Inter/JetBrains (unused) | |
| `extension/scripts/` | `generate-build-info.ts` (rewrites tracked file), `zip-source.ts` (git-archive source package, requires clean tree), `backup.ts` (copies src to `../backups/`), icon generators, `translator/index.js` (placeholder injector), `launch-setup.mjs` | |
| `extension/tests/unit/` | 10 adapter suites, ContextMenuService (24 it), KeyManager (new), TorrentDiffer, withRetry, LifecycleAdapter.parseDOM, sanity | No VaultService/SecurityService/background/useSettings tests |
| `extension/tests/e2e/` | fixtures + 5 specs (6 CI tests, 3 integration) | Chrome only |
| `.github/workflows/` | `ci.yml`, `auto-localize.yml` | No release, no lint of build, no Firefox e2e |
| `docs/` | 11 top-level docs + 31 `reference/` prompt/architecture files + 4 archived Synology docs tracked; `docs/reports/`, `docs/archive/` ignored | Heavy process artefacts in public repo |
| `.raiden/`, `.serena/` | Agent control-plane state (tracked, public) | Contains operational history incl. exposed-key map (D-005) |
| `extension/backups/`, `build_log.txt`, `audit_extension*.txt`, `playwright-report/`, `test-results/` | Local artefacts (ignored) | Swept into WXT sources zip |
| `.audits/`, `reports/`, `logs/`, `audit-reports/` | Ignored local audit outputs | |

Flags: duplicated `ITorrentClient` interface; two retry helpers with different semantics; three i18n helper modules unused; `HeaderRewriter` dead; `WebSocketKeepalive`/`ServiceWorkerKeepalive`/`parseDOM`/`XmlRpcHelper` no callers; qBittorrent File/Tracker/Transfer/Sync/RSS/Search services exported but unused (~1k lines + tests); `tsyringe`+`reflect-metadata`+legacy decorators+`emitDecoratorMetadata` for zero DI benefit (and the source of `DANGEROUS_EVAL` in `background.js`); `babel-plugin-react-component-data-attribute` applied in production builds; hidden coupling: background, context menu, popup and options each re-resolve the vault independently; implicit global state: `activeClient`, `activePorts`, `pollingInterval` module variables in the SW.

## 7. Code and Correctness Audit

Static baseline: `tsc --noEmit` clean; ESLint 0 errors / 31 warnings (unused symbols, `any`); 530 unit tests green. The green suite does not exercise browser transport semantics, cross-context lifecycle, or background concurrency, which is where the material defects sit.

### Confirmed defects

| ID | Location | Defect |
|---|---|---|
| ADP-01 | `clients/deluge/DelugeAdapter.ts:45-105,159-221`; `network/FetchHttpClient.ts:39-44` | `auth.login` succeeds but the `_session_id` cookie is never stored (`credentials:'omit'`) nor forwarded; every later RPC returns "Not authenticated"; `ensureAuth` re-logs-in and fails again. |
| ADP-02 | `clients/rutorrent/RuTorrentAdapter.ts:53-64`; `FetchHttpClient.ts:154-169` | XML-RPC string body is `JSON.stringify`'d and `Content-Type` overwritten to `application/json`. Reproduced by the 2026-09-08 audit harness; re-traced here. |
| ADP-03 | `clients/flood/FloodAdapter.ts:133-151,565-571` | Flood authenticates via httpOnly `jwt` cookie only; the `token`/Bearer branch never executes; cookie discarded → 401 on `api/auth/verify`. HIGH-CONFIDENCE. |
| ADP-04 | `clients/utorrent/UTorrentAdapter.ts:48-58,389-394`, `UTorrentRssService.ts:66-71`, `UTorrentSettingsService.ts:75-80` | Reads `Set-Cookie` (forbidden response header, always null) and sets `Cookie` (forbidden request header, dropped); GUID never established → HTTP 400 loop → misreported as AUTH_FAILED. HIGH-CONFIDENCE. |
| ADP-05 | `FetchHttpClient.ts:31-33,105-107`; `QBittorrentAdapter.ts:326-330`; `HeaderRewriter.ts` (no-op) | `Origin`/`Referer` are forbidden request headers; the browser sends `Origin: chrome-extension://<id>`; qBittorrent's default CSRF check rejects it → 401 → adapter enters 16 s cooldown / `IP_BANNED`. Localhost is exempt by qBittorrent default, which is why prior testing passed. HIGH-CONFIDENCE (OL-013 records the same gap). |
| ADP-06 | `TransmissionAdapter.ts:66-67,223` | Absolute `/transmission/rpc` discards a reverse-proxy sub-path; BiglyBT uses the relative form correctly. |
| ADP-07 | `Aria2Adapter.ts:32-33`, `ServerConfigPanel.tsx:230-275`, `constants.ts:97-101` | `/jsonrpc` is not appended by the adapter and is stripped by the host/port form; saved endpoint points at `/`. |
| ADP-08 | `QBittorrentAdapter.ts:445-458,209-221` | qBittorrent 5.x `stoppedDL/stoppedUP` unmapped → `unknown`; `torrents/pause|resume` vs 5.x `stop|start` unverified. |
| ADP-09 | `DelugeAdapter.ts:792`, `UTorrentAdapter.ts:457-474` | `addedDate` in seconds; entity and other adapters use ms. |
| ADP-10 | `FetchHttpClient.ts:39-44` vs `DelugeAdapter.ts:76-100`, `BiglyBTAdapter.ts:774-786`; `Aria2Adapter.ts:478-550`; `withAdapterRetry.ts` | Caller `AbortSignal` overwritten by the 10 s client signal (dead timeouts); aria2 timeout classified retryable → `addUri` may execute 2–5 times; `withAdapterRetry` retries auth/validation failures. |
| ADP-11 | ruTorrent / aria2 / Deluge / uTorrent | Unsupported operations (`removeTorrent(id,true)`, `paused`, `path`, tags) silently succeed. |
| ADP-12 | `RuTorrentAdapter.ts:53-77,197-200` | `testConnection` reports true for any HTTP 200 (login page, proxy HTML). |
| ARCH-01 | `background.ts:46,152-178,282-286,306-396`; `TorrentRow.tsx:20-33` | One mutable `activeClient`; poll results and `PAUSE/RESUME/REMOVE` messages carry no server id or generation; a slow poll from server A lands in server B's UI; a remove can hit the wrong server. |
| ARCH-02 | `TorrentDiffer.ts:40-87,98-132` | Patches keyed by ID at compute time but applied by array index; reorder yields cross-torrent value assignment (reproduced by the 2026-09-08 audit). |
| ARCH-03 | `useVault.ts:11-67`, `VaultGuard.tsx` | Lock is component-local; a second options window keeps decrypted servers and can export them. |
| ARCH-04 | `background.ts:197-205,224-236`; popup `Dashboard.tsx:69-92` | `performCheck` has no in-flight guard; popup polls `GET_TORRENTS` every 2 s independently of the port/viewport pipeline; alarm polls every minute even when badge = none. |
| ARCH-05 | `ViewportManager.ts:35-81`, `VirtualizedTorrentList.tsx:32-40` | No initial snapshot for a second subscriber with the same range; total only delivered with viewport messages; inclusive virtualizer end vs exclusive `slice`. |
| ARCH-06 | `useSettings.ts:15-28,167-206,315-384`; `App.tsx:32-63` | Full backup uses a stale closure; empty-server import "succeeds" without writing; import accepts any `type` / `application` / URL scheme. |
| SEC-01 | `VaultService.ts:15-17,54-88` | Salt present + ciphertext absent → `unlock()` succeeds with any password (fail-open on corrupted or partial state). |
| BUG-01 | popup `Dashboard.tsx:332` | ProgressBar checks `'Downloading'`; statuses are lowercase → always "finished". |
| BUG-02 | `background.ts:238`, `useTorrentPoller.ts` | `if (activePorts > 0)` at init is always false; after SW restart with the options page open, polling never resumes and the poller does not reconnect. |
| BUG-03 | `background.ts:311-317` | "Vault Locked" notification ignores `enableNotifications`. |

### Lifecycle observations (Chrome SW / Firefox event page)

- Fast polling uses `setInterval` inside the SW; it survives only because each tick calls extension APIs (badge, `sendMessage`) that reset the 30 s idle timer. A fetch that hangs longer than 30 s without API activity can let the SW die mid-poll; state is rehydrated from `storage.session` on wake, but `activeClient` session objects (Transmission session id, qBittorrent SID) are rebuilt from scratch, re-logging-in every wake.
- Alarm `packet_beat` (1 min) is recreated on every SW start (fine, above the 0.5 min floor).
- Context menus: rebuilt on install / startup / every storage watch event with `removeAll()` then `create()`; debounce coalesces; acceptable.
- Session key in `storage.session` (default trusted-contexts) is the correct MV3 pattern for both browsers once the dirty-tree change lands.
- `chrome.*` promise style is used throughout; works in Firefox; WXT `browser` alias used for storage/session. No SW-only globals in shared code (grep: none).
- Incognito: not declared (Chrome default "spanning"). AMO's "data from private browsing must not be stored" is satisfied because no page data is stored.

### Probable defects / risks

- `toMatchPattern` uses `origin + '/*'`; for `ws://` hosts the pattern would be `ws://host/*`, which is not a valid Chrome match-pattern scheme; `optional_host_permissions` lists `ws://*/*` which Chrome ignores with a warning. PLAUSIBLE — VERIFY, moot once `ws`/`wss` are removed.
- `info.selectionText` is passed verbatim to `addTorrentUrl` (`ContextMenuService.ts:353`), so arbitrary selected text reaches the client API (low risk; the client rejects it).
- `btoa()` throws on non-Latin-1 passwords for all Basic-auth adapters.

## 8. Browser Extension Architecture Audit

- **MV3 suitability:** appropriate. No persistent-background assumptions beyond the polling interval noted above; hydration from `storage.session` is the right pattern.
- **Portable core:** yes. One codebase; WXT generates `service_worker` for Chrome and `scripts` for Firefox. Browser branching is by `navigator.userAgent.includes('Firefox')` (`ContextMenuService.ts:10`) and `getBrowserInfo` feature detection (`LifecycleAdapter.ts`); acceptable.
- **Missing per-browser manifest keys:** `browser_specific_settings.gecko.{id,strict_min_version,data_collection_permissions}` (Firefox) and `minimum_chrome_version` (Chrome). WXT supports `manifest: (env) => ...` branching on `env.browser`; this is the cleanest fix. No adapter layer needed.
- **CSP:** `script-src 'self'; object-src 'self'; connect-src http: https: ws: wss:` is within both browsers' constrained-directive rules. Because a custom `extension_pages` CSP replaces Firefox's default (which includes `upgrade-insecure-requests`), plain-HTTP LAN targets should work in Firefox. PLAUSIBLE — VERIFY at runtime. Consider adding `default-src 'self'` once remote font URLs are removed so the "no external requests" claim is enforced by policy.
- **Host permissions:** none required at install; `optional_host_permissions` `http://*/*`, `https://*/*` (+ `ws`/`wss`, unused); granted per-origin from a click handler (synchronous, which satisfies Firefox's user-action rule). Chrome's review process flags broad optional patterns; justification text needed.
- **Declarative vs imperative:** DNR removed (good); `scripting.executeScript` under `activeTab` for the one-shot scan is the documented pattern.
- **Namespace:** `chrome.*` everywhere, `browser` from WXT for storage. Fine for Chrome ≥ 102 and Firefox ≥ 115/128.
- **Firefox-specific behaviour:** `getBrowserInfo` detection, longer menu debounce, `background.scripts`. `storage.session` requires Firefox ≥ 115 → `strict_min_version` should be `128.0` (optional_host_permissions) or `140.0` (built-in consent UI).
- **Dual-store safety:** unsafe today only because of the missing gecko block, reproducibility, and the transport defects; the architecture itself does not need restructuring.

**Recommended strategy:** keep the unified codebase and unified `wxt.config.ts`; add `env.browser` branches for the gecko block and `minimum_chrome_version`; keep the two build targets. No adapters, no polyfill library, no separate manifests.

## 9. Permissions Audit

| Permission | Browser | Req/Opt | Feature | Evidence | Necessary? | Narrower alternative | Store risk |
|---|---|---|---|---|---|---|---|
| `storage` | both | required | settings, vault, session key, hydration | `useSettings.ts`, `VaultService.ts`, `KeyManager.ts`, `StateHydrator.ts` | Yes | none | none (no warning) |
| `contextMenus` | both | required | Add / Scan / Server / Label / Path menu items | `ContextMenuService.ts` | Yes (core workflow) | none | none |
| `notifications` | both | required | result/error/vault-locked toasts | `ContextMenuService.ts:471-483`, `background.ts:311` | Marginal — two call sites; completion alerts claimed in docs are not implemented | make optional and request when the user enables notifications | Chrome shows "Display notifications" warning at install; the only install-time warning today |
| `activeTab` | both | required | one-shot magnet scan on the current tab | `ContextMenuService.ts:373-401` | Yes for Scan Page | drop the feature → drop both `activeTab` and `scripting` | low; must be justified together with `scripting` |
| `scripting` | both | required | `executeScript` for Scan Page | same | Yes if Scan Page ships | see above | medium — reviewers ask why an extension with no content scripts needs `scripting`; justification must name the single function |
| `alarms` | both | required | 1-minute background poll for badge | `background.ts:224-236` | Yes if badge/background polling ships | gate the alarm on `badgeInfo !== 'none'`, or drop background polling | none |
| `optional_host_permissions` `http://*/*`, `https://*/*` | both | optional, per-origin at runtime | fetch to the user's client | `permissions.ts`, `ServerConfigPanel.tsx:58-67` | Yes — user-defined origins | nothing narrower is possible; keep runtime per-origin grants | Chrome: broad pattern → deeper review even though optional; Firefox 128+: fine |
| `optional_host_permissions` `ws://*/*`, `wss://*/*` | both | optional | nothing (WebSocket keepalive has no callers) | grep: no `new WebSocket` outside the unused module | **No** | remove | unnecessary permission = release defect (PERM-01, P1) |
| `externally_connectable` | — | absent | — | — | correct | — | — |
| `web_accessible_resources` | — | absent | — | — | correct | — | — |
| `declarativeNetRequest` | — | removed 2026-07-02 | — | `HeaderRewriter.ts` no-op | correctly absent | — | do not re-add without live evidence |

Permission-related defects: PERM-01 unused `ws`/`wss` optional hosts (P1, CONFIRMED); PERM-02 `notifications` should be optional or its use expanded to match documentation (P2); PERM-03 no per-permission justification text exists anywhere in the repo for the Chrome dashboard or AMO notes (P1, documentation).

## 10. Security Audit

- **Message passing:** `onMessage` / `onConnect` reject senders whose `id !== runtime.id` (`background.ts:206-215,290-296`); no `externally_connectable`; no content scripts → web pages cannot reach the background. CONFIRMED sound. Message payloads (`message.config`, `message.url`, `serverIndex`) are trusted from own UI; `serverIndex` is bounds-checked.
- **Injected script:** `scan-page` injects a fixed function reading `href` attributes only; results are strings passed to `addTorrentUrl`. No page-controlled code execution. A page can plant fake magnet links, which the user explicitly asked to scan; acceptable, but the loop adds *all* found magnets with no confirmation and no cap (SEC-06, P2: a hostile page can enqueue hundreds of torrents in one click).
- **DOM / HTML / eval:** no `innerHTML`, `dangerouslySetInnerHTML`, `eval`, or `new Function` in `src` (grep). addons-linter warnings come from React DOM (`innerHTML` in the SVG namespace path) and `reflect-metadata`'s `Function("return this")` in `background.js` (DEP-01). Both are third-party and unmodified, therefore acceptable, but removing `tsyringe` / `reflect-metadata` removes the `DANGEROUS_EVAL` warnings entirely.
- **Remote code / config:** none. Remote *resources*: 105 `https://1.www.s81c.com/...` font URLs in shipped CSS (PRIV-01).
- **URL handling:** `openWebUI` prepends `http://` and calls `tabs.create` with the stored hostname (own config) — fine. `ClientFactory.validate` accepts any parseable scheme; a `javascript:` hostname from an imported backup could reach `tabs.create` (SEC-08, P3: restrict schemes to http/https at validation and import).
- **Secrets at rest:** credentials AES-GCM-256 under PBKDF2-SHA256 300k with 16-byte salt and a fresh 12-byte IV per write; session key in `storage.session` only (after the dirty-tree change). Prior builds mirrored the key to `storage.local` on Firefox (OL-012); the uncommitted remediation purges it on every wake. No secrets in source. The public Chromium omnibox key in a PR ref (OL-011) is not a CTRL credential.
- **Secrets in transit / logs:** BiglyBT Simple API key in the query string (`BiglyBTSchema.ts:370-419`) → server logs; "safe" export leaks `clientOptions.simpleApiKey` (SEC-03, P1); `QBittorrentAdapter.ts:97` logs the login response body; no password logging found.
- **Vault integrity:** SEC-01 fail-open on salt-only state (P2); no versioning of the vault record; no lockout on wrong master password (PBKDF2 cost is the only brake — acceptable).
- **Cross-window lock:** ARCH-03.
- **Dependency supply chain:** see §12; lockfile tracked; overrides pin transitive advisories; `postinstall: wxt prepare` is the only install script of note.
- **Build process:** `generate-build-info.ts` writes into `src/` during build; `backup.ts` copies `src` outside the repo. Neither is malicious; both surprise reviewers.

Abuse scenarios: (1) a page with 500 hidden magnet links + one "Scan Page" click → 500 torrents added, no confirmation (SEC-06). (2) A profile-directory reader on an old Firefox build recovers the vault key from `storage.local` (mitigated by the pending purge). (3) A shared "safe" export reveals a BiglyBT API key (SEC-03).

## 11. Privacy and Data-Flow Audit

| Data | Source | Purpose | Stored? | Location | Transmitted? | Destination | Retention | User control | Disclosure required |
|---|---|---|---|---|---|---|---|---|---|
| Client URL, username, password, HTTP-auth creds, `clientOptions` (may hold BiglyBT API key) | user input / import | connect to client | Yes, AES-GCM | `local:vaultData` | Yes, to the configured client only | user's server | until removed / uninstall | edit, delete, export | Chrome: authentication information (privacy policy + dashboard form + in-UI disclosure); AMO: `data_collection_permissions` value + policy |
| Master password | user input | derive key | No (derived key as exportable JWK in `storage.session`) | memory / session | No | — | browser session | — | describe in policy |
| Settings | user | preferences | Yes | `local:options` | No | — | until uninstall | yes | minimal |
| Torrent list snapshots (names, sizes, paths, speeds) | client API | UI, badge | Yes (session) | `session:torrent_state` | No | — | browser session | none | mention (torrent names are user content) |
| Magnet links / URLs | click, selection text, page scan | add to client | No | — | Yes | user's server | — | user-initiated | yes; page-content read via `activeTab` must be disclosed (Chrome "website content" category likely) |
| Current tab page | Scan Page only | find magnets | No | — | No (only hrefs extracted) | — | — | user-initiated | yes |
| Fonts | IBM CDN (`s81c.com`) if any `@font-face` resolves remotely | rendering | browser cache | — | request reveals IP/UA to IBM | third party | — | none | contradicts "no external servers" (PRIV-01, PLAUSIBLE — VERIFY) |
| User agent, platform, language | `navigator` | Self Test display | No | — | No | — | — | — | none |
| Backup files | export | user backup | user's disk | — | — | — | — | — | "safe" export must actually be safe (SEC-03) |
| Analytics / crash / telemetry | — | — | none | — | none | — | — | — | truthful today |

Disclosure gaps (PRIV-02, P1): `docs/PRIVACY_POLICY.md` says "notify you when downloads complete" (not implemented), lists `storage / contextMenus / notifications / activeTab / optional_host_permissions` but not `scripting` or `alarms`, says "No network requests to external servers" (see fonts), and there is no in-UI disclosure when credentials are entered (Chrome requires in-UI disclosure, not policy-only). README claims "Translated into 7 languages"; BETA_TESTING claims "Firefox: fully tested", "Completion alerts", and a theme list — none supported by the code. `docs/privacy.html` exists but no hosted URL is referenced anywhere.

Proportionality: collection is minimal and appropriate. Background polling every minute contacts the user's server continuously while the vault is unlocked, even with the badge disabled; disclose or gate it.

## 12. Dependency and Supply-Chain Audit

Runtime deps (15): React 18.2, `@carbon/react` 1.100, `@carbon/styles`, `@carbon/icons-react`, `@ibm/plex` 6.4 (entire family → 1,058 font files), `lucide-react` (second icon set), `@tanstack/react-virtual`, `zustand`, `zod` 3.23, `tsyringe` + `reflect-metadata` (decorators only, no container → unnecessary; brings `Function()` into `background.js`), `txml` (XML for ruTorrent; no XXE surface), `clsx`, `tailwind-merge`.

Dev deps: WXT 0.20.27, Vite 7.3.5 (transitive), Vitest 4.1.9, Playwright 1.57, TypeScript 5.7, ESLint 9, Babel legacy-decorators plugin, `babel-plugin-react-component-data-attribute` (applied in production builds — adds `data-component` attributes and bundle weight), `vite-plugin-react-inspector` (dev-only, correctly gated), `sharp` (icon generation).

- `npm audit --omit=dev`: 0 vulnerabilities (the production package is clean).
- `npm audit` (all): 12 (6 high) — `sharp < 0.35.4` (dirty tree bumps to 0.35.3, still vulnerable), `undici 7.x`, `nanoid`, `postcss-selector-parser`, `js-yaml`. All dev-only; none enters the store package.
- Lockfile: tracked, `npm ci` in CI, `npm ls` consistent with the installed tree. The working tree's `package.json` / lockfile edits (sharp, postcss, three new overrides) are uncommitted.
- Pinning: exact pins except `@carbon/*`, `@ibm/plex`, `postcss` (caret). Node: `.nvmrc` 22, CI 22, docs say 20+, local 24.18 (works). No `engines` field.
- Held migrations (OL-005 Babel 8, OL-006 Vite 8): correct to hold.

Classification: release-critical — none in production. Advisable before release — remove `tsyringe` / `reflect-metadata` / legacy decorators (DEP-01, also clears the linter warnings); stop bundling all of `@ibm/plex` and the full `@carbon/styles` CSS (PKG-01); gate `babel-plugin-react-component-data-attribute` to dev (DEP-03). Safe to postpone — `sharp` 0.35.4, `undici` / `nanoid` transitive fixes. Unnecessary — Vite 8, Babel 8, React 19, Carbon majors.

## 13. Build and Reproducibility Audit

- Build: `npm run build:chrome` = `tsx scripts/generate-build-info.ts && wxt build -b chrome`; `build:firefox` the same with `-b firefox --mv3`. `npm run build` also runs `clean` (`rm -rf`) and `backup` (copies `src` to `../backups/`).
- Package: `wxt zip -b chrome` / `wxt zip -b firefox --mv3` → `builds/*.zip` (+ WXT auto `-sources.zip` for Firefox). AMO source: `scripts/zip-source.ts` (git archive of HEAD; refuses a dirty tree, so it cannot run today).
- Determinism: JS chunks identical across three builds; `assets/style.css` differs between consecutive builds because Vite's font asset numbering (`style.woff` vs `style2.woff`) is not stable → the Firefox reviewer diff would fail (BUILD-01, CONFIRMED). `generate-build-info.ts` rewrites tracked `src/shared/lib/buildInfo.ts` with a wall-clock timestamp (shown in `VersionOverlay`) → every build dirties the tree and differs (a stash of exactly this exists).
- Included: manifest, 4 JS, 2 CSS (~1 MB each), 7 locales, 5 icons, 2 local fonts, 1,058 Plex woff/woff2 → 40.67 MB. No source maps (`sourcemap: isDev`), no tests, no `.env`, no dev files.
- Per-browser difference: only the `background` key and `version_name`. No `browser_specific_settings`.
- Versioning: manual in `package.json`; manifest `version` normalised `0.2.0-beta.1 → 0.2.0.1`; manifest `name` embeds the version ("CTRL v0.2.0-beta.1"), so the store listing name would change per release (STORE-01).
- Environment documentation: `docs/DEVELOPMENT.md` (Node 20+, commands) — no exact versions, no AMO build instructions, no OS statement.
- Reproduction on another machine: partially — lockfile + `npm ci` + WXT works (CI proves it), but output is not byte-identical (fonts, buildInfo).

Missing for Firefox: deterministic asset naming or removal of bundled Plex; removal of timestamp generation from the build; a `BUILD.md` in the source archive with OS / Node / npm versions and exact commands; a CI "build twice and diff" gate; documented checksums linking source archive to uploaded XPI.

## 14. Package Inspection (performed)

Chrome build (`builds/chrome-mv3`, 1,079 files, 41 MB) and Firefox build (`builds/firefox-mv3`, same content, `background.scripts`):

| Check | Result |
|---|---|
| Manifest | MV3, valid; `name` includes version; `description` generic ("Manage your torrents from the browser"); no `minimum_chrome_version`; no gecko block; `version_name` dropped for Firefox (correct) |
| Assets | icons 16/32/48/64/128 present; `_locales` 7; Plex fonts 1,058 files ≈ 38 MB; unused Inter/JetBrains fonts 80 KB |
| Unwanted files | none of test/dev/env type; but the font payload is unwanted |
| Source maps | none |
| Secrets | none |
| Debug code | 77 `console.log/debug/info` call sites in `src` remain in the production bundle; `VersionOverlay` build stamp visible; `SELF_TEST` exposes UA/platform in the UI |
| Remote references | 105 `s81c.com` font URLs (CSS), a `carbondesignsystem.com` docs string, a `wxt.dev` string, 6 Utilities links |
| Duplicate bundles | Carbon stylesheet emitted twice (`style.css` 984 KB and `global-*.css` 1,000 KB) because `style.css` imports `global.css` and each entry imports both |
| Licenses | no third-party notices in package or repo (Carbon Apache-2.0, IBM Plex OFL-1.1, React MIT, lucide ISC); OFL redistribution requires the licence text (DOC-02) |
| Reviewer readability | JS minified (allowed); AMO warnings from React / reflect-metadata; the 40 MB font payload dominates any reviewer's download and diff |

WXT `-sources.zip` (Firefox): 524 files including `backups/site-integrations-v0.2.0-2026-01-11/entrypoints/{1337x,rarbg,tpb,nyaa,fitgirl,audiobookbay,tgx}.content.tsx`, `backups/src-v0.1.28-*`, `build_log.txt`, `audit_extension*.txt`, `playwright-report/`. It excludes `node_modules` and `.persistent-data`. **It must not be uploaded** (REL-01).

## 15. Performance and Resource Audit

No content scripts run on web pages, so page-load and page-interaction impact is nil (CONFIRMED by manifest). Remaining risks are code-level predictions; nothing was measured:

- **Popup open cost:** the popup loads ~2 MB of CSS (Carbon twice) plus a 352 KB shared React/Carbon chunk and 48 KB popup chunk; Plex fonts load on demand. Expect a visible flash and hundreds of ms parse time on modest hardware. PERF-01, P2.
- **Polling volume:** while the options page is open, the background polls every 2 s; while the popup is open, the popup separately requests the full torrent list every 2 s and checks vault status every 2 s; with both open the server sees two full-list requests every 2 s (ARCH-04). Alarm poll every 60 s forever while unlocked, even with the badge off. For a 5k-torrent client, each poll transfers the full list and re-serialises it into `storage.session` (1 s debounce).
- **Message traffic:** viewport diffs are computed; the Zustand store is sparse-indexed. Fine at 50-row viewports.
- **Memory:** `ViewportManager.fullTorrents` + `previousSlice` + `storage.session` copy; acceptable. No MutationObservers, no listeners on pages.
- **Startup:** SW runs `purgeLegacyFallbackKey`, hydration, `ServerResolver.resolve()` (PBKDF2 is not re-run; only AES decrypt), context-menu rebuild. Acceptable.
- **Battery:** the 60 s alarm wakes the SW and performs a network request continuously; on laptops this is the only persistent cost. Gate it on badge setting (PERF-02, P2).

## 16. UX and Product Quality Audit

Could a new user obtain value without developer knowledge? Partially. A user who already knows their client's URL and credentials can succeed in about five screens, but several points create abandonment or bad reviews:

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| UX-01 | P1 | Popup shows "Extension not configured / Setup Now" whenever the vault is locked (every browser restart), with no unlock control in the popup; the vault badge that would explain is only rendered in the configured branch | `features/torrent-control/ui/Dashboard.tsx:124,199-239`, `useSettings.ts:96-98` |
| UX-02 | P1 | Popup "Debug" tab ships in production; its only control dispatches an event nothing listens to | `Popup.tsx:81-103`, `wxt.config.ts:91` |
| UX-03 | P1 | Settings that persist but do nothing: theme (8 options; both roots hard-code Carbon `g100`), layout sidebar, notification level and style, "Open Web UI" context toggle, performance mode ("locked for testing" banner), enhanced diagnostics, `CommandPalette` (Ctrl+K opens an empty palette with "Project Prism v0.1.23" footer), "Storage Health" card permanently "Unknown", "Connection: Online" hard-coded | `ThemeSettings.tsx`, `popup/main.tsx:16`, `options/main.tsx:15`, `LayoutSettings.tsx`, `NotificationSettings.tsx:73-85`, `ContextMenuSettings.tsx:106-111`, `PerformanceSettings.tsx:19-32`, `SystemSettings.tsx:37-42`, `CommandPalette.tsx`, `TorrentDashboard.tsx:62-93` |
| UX-04 | P2 | Master password is demanded before any value is shown; no explanation of why; "cannot be recovered" warning without an escape hatch (no "reset vault" path except System settings) | `SetupVault.tsx` |
| UX-05 | P2 | Landing view after setup is the empty Dashboard; nothing routes the user to "Servers" | `options/Dashboard.tsx:39` |
| UX-06 | P2 | Popup mini-list caps at 3 rows while the count badge shows all; no link to full list; popup Test collapses every failure to "Failed" | `Dashboard.tsx:314-318,359-371` |
| UX-07 | P2 | `window.confirm` / `alert` for destructive and error flows; import triggers a full page reload | `ServerConfigPanel.tsx:128,141,153,469-476`, `DataManagement.tsx:17-37` |
| UX-08 | P2 | Server form strips URL paths (breaks Aria2 and reverse-proxy sub-paths); changing client type does not apply the client's default port/path | `ServerConfigPanel.tsx:230-275` |
| UX-09 | P2 | Context-menu preview in settings does not match the real menu (labels, missing "Scan Page", "Pause/Resume" vs "Add Paused") | `ContextMenuSettings.tsx` vs `ContextMenuService.ts:179-283` |
| UX-10 | P2 | Naming inconsistency: "CTRL", "Torrent Control", "CTRL - Torrent Control", "Project Prism" across manifest, popup title, HTML titles, palette | manifest, `index.html` titles, `CommandPalette.tsx:127` |
| UX-11 | P3 | Build stamp overlay visible on both pages, overlapping toast position; empty 56 px popup header | `VersionOverlay.tsx`, `MainLayout.tsx:11-13` |
| UX-12 | P2 | No `permissions.onRemoved` handling; revoked host access appears as generic connection failure | grep: none |

Store-review UX risks: Debug tab and "locked for testing" copy read as unfinished software; Utilities links read as piracy-adjacent (PROD-01).

## 17. Accessibility Audit

No WCAG conformance is claimed. Status by surface (inspected, not tested with AT):

| Surface | Status | Notes |
|---|---|---|
| Carbon components (Tabs, Modal, PasswordInput, Select, Toggle with labels) | likely compliant | Carbon provides names, focus, keyboard |
| `ServerConfigPanel` form | likely non-compliant (A11Y-01, P1) | `<label>` without `htmlFor`, inputs without `id`/`aria-label`; focus classes reference undefined Tailwind tokens so no visible focus; status text not announced |
| `SettingsToggle` and per-server toggles | likely non-compliant (A11Y-02, P1) | `hideLabel` with empty labels and random `id`; no accessible name |
| Popup status line, options test result | likely non-compliant (P2) | no `aria-live` / `role="status"` |
| `VersionOverlay` clickable div | likely non-compliant (P2) | not focusable, no role |
| `Utilities` tiles with `role="button"` | likely non-compliant (P2) | Space not handled; nested interactive controls |
| `CommandPalette` | likely non-compliant (P2) | no dialog role, no focus trap, arrow keys unwired |
| `TorrentRow` actions | needs dedicated audit | reachable via `focus-within`; `aria-rowcount` on `role="list"` is invalid; virtualised rows leave the DOM |
| Colour / contrast | needs dedicated audit | light-mode Tailwind colours (`bg-orange-100`, `text-green-500`) on the dark g100 theme; status by colour only in stat cards |
| Reduced motion | likely non-compliant (P2) | no `prefers-reduced-motion`; infinite shimmer on downloading rows |
| Target size | needs dedicated audit | 28–32 px controls, 10 px labels in popup |
| Language | likely non-compliant (P3) | `html lang="en"` fixed |

## 18. Testing Strategy Audit

Inventory: unit (Vitest, jsdom, fake-browser) 16 files / 530 tests — 10 adapter suites (mocked `fetch`), `ContextMenuService` (24), `KeyManager` (new, untracked), `TorrentDiffer`, `withRetry`, `LifecycleAdapter.parseDOM`, sanity. E2E (Playwright, Chromium only): 6 CI tests (options load, version visible, tab navigation — skips when locked, unconfigured state, theme controls — skips when locked, popup first-run) + 3 `@integration` (mocked Deluge add flow, real qBittorrent, manual session). No integration, compatibility, security, packaging, or Firefox tests.

Coverage vs release-critical behaviour:

| Behaviour | Covered? |
|---|---|
| Adapter parsing / error taxonomy | Yes (well) |
| Adapter transport as the browser sends it (credentials, forbidden headers, body encoding, base path) | **No** — the four P0 adapters pass CI |
| Vault init / unlock / lock / corrupt state | KeyManager only; no VaultService/SecurityService tests (SEC-01 untested) |
| Background message handling, server switching, concurrency | No |
| Context menu build/click | Partially (unit) |
| Viewport diff identity, reorder | No (ARCH-02 untested) |
| Settings migration / import / export round-trip | No |
| Permission denied / revoked | No |
| SW restart / browser restart | No |
| Firefox anything | No |
| Package contents / size / linter | No |
| Clean install / update path | Popup first-run only |

**Minimum viable release test suite:**
1. Transport contract tests: a `FetchHttpClient` test harness that models forbidden headers and `credentials` (fail if `Cookie`/`Origin` are relied upon), plus per-adapter assertions on final `RequestInit` (body bytes, content type, URL incl. sub-path, credentials mode).
2. Vault tests: init, unlock, wrong password, salt-only / ciphertext-only / malformed records fail closed, lock clears session key.
3. `TorrentDiffer` property test: permutations + membership changes converge with identity preserved.
4. Background tests with fake-browser: server switch during pending poll discards stale result; command routed by server id; alarm gated on badge.
5. Import/export round-trip: full/settings/server, empty servers, sanitized export contains no credential field including `clientOptions`.
6. Live client matrix (manual or Docker in a nightly job): Chrome + Firefox × {qBittorrent (CSRF on, non-localhost), Transmission, Deluge, Flood, aria2, BiglyBT} → add, list, pause, resume, remove.
7. Packaging tests in CI: addons-linter with `--warnings-as-errors` allowlist, package size cap, forbidden-file list, build-twice-and-diff.
8. E2E: Chrome + Firefox (web-ext) first run, vault setup, add server against a mocked HTTP server, popup add via mocked server, permission grant/revoke.

## 19. CI and Release Engineering Audit

Existing: `ci.yml` lint → typecheck + unit → build Chrome + Firefox (artifacts 7 days) → Chrome e2e (non-integration). Actions pinned by tag (`@v4`); one third-party action SHA-pinned. `auto-localize.yml` (never run) has `contents: write` and auto-commits to `main` (CI-01, P1). No release workflow, no zip, no linter, no size check, no checksum, no changelog automation, no dependency/secret scanning, no Firefox e2e. tsconfig/lint exclude `scripts/` and `tests/` (OL-016).

**Required before first public release:** disarm `auto-localize.yml`; add `package` job (`wxt zip` both browsers, `zip:source`, addons-linter, size cap ≤ 5 MB, forbidden-file check, sha256 manifest, build-twice diff); run lint/typecheck over `scripts/` and `tests/`; version/tag consistency check (`package.json` = tag); upload zips + source + checksums as release artifacts on tag.
**Useful later:** Firefox e2e via `web-ext run`; nightly live-client matrix; dependabot; CodeQL; automated store upload.

## 20. Documentation Audit

| Document | Status |
|---|---|
| `README.md` | Overstates: "7 languages", all 9 clients "Full"; badges "Coming Soon"; fine as overview |
| `docs/BETA_TESTING.md` | Stale/misleading: "Firefox fully tested", "Completion alerts", "Theming: Dark, Light, Low Power, Cyberpunk, Linux, Glass, Linear", release ZIP names that do not exist (no GitHub releases) |
| `docs/PRIVACY_POLICY.md` / `privacy.html` | Necessary for store; needs corrections (PRIV-02); no hosted URL |
| `docs/ARCHITECTURE.md` | Wrong: content scripts on 7 sites, React Query |
| `docs/API.md` | Stale `testConnection(): Promise<boolean>` |
| `docs/DEVELOPMENT.md`, `CONTRIBUTING.md` | Adequate; Node version inconsistent with `.nvmrc` |
| `docs/CI_BASELINE.md` | Test counts stale (357 vs 530) |
| `SECURITY.md` | Supported version 0.1.x (stale); "email the maintainers" with no address |
| `ROADMAP.md` | Strategic; claims "Diffing Engine ✅" that is defective |
| `extension/CHANGELOG.md` | `[Unreleased]` well maintained |
| Firefox reviewer/build instructions | **Absent** |
| Permission justifications | **Absent** |
| Third-party licences | **Absent** (DOC-02) |
| Troubleshooting | Beta guide only |
| Versioning policy | `docs/archive/versioning_standards.md` (ignored dir) |

## 21. Store Listing Readiness

| Item | Chrome | Firefox |
|---|---|---|
| Name | "CTRL v0.2.0-beta.1" in manifest — must become "CTRL — Torrent Control" (no version) | same |
| Concise purpose / summary (≤132 / ≤250 chars) | draft exists in §5.1; manifest description too generic | same |
| Full description | not written | not written |
| Category | Productivity / Developer tools — undecided | Download Management / Other — undecided |
| Icons | 128 px present (16/32/48/64 too) | 32/64 present; SVG source absent |
| Screenshots (1280×800) | **missing** | **missing** |
| Small promo tile 440×280 (required) | **missing** | n/a |
| Support / homepage | GitHub only; Discussions URL unverified | same |
| Privacy-policy URL | markdown + html in repo; **no hosted URL** | same; "has privacy policy" flag |
| Data-usage answers | not drafted; must include authentication information | `data_collection_permissions` absent |
| Permission justifications | **missing** | **missing** |
| Reviewer notes / test instance | **missing**; reviewers cannot test without a torrent client | **missing**; needs test credentials or Docker recipe |
| Release notes | CHANGELOG usable | same |
| Trader declaration | undecided | n/a |

Contradictions to resolve before writing copy: language support, notifications, themes, Firefox test status, "no external requests", client support matrix vs ADP-01..05.

## 22. Chrome Web Store Readiness

**Manifest:** MV3 valid; `background.service_worker` correct; permissions six + optional hosts; no content scripts; CSP compliant with the constrained directives; no WAR; no commands; `action` with popup and icons; `optional_permissions` none; no `minimum_chrome_version` (should be ≥ "102", ideally "120"); `name` embeds version; `description` generic; unused `ws`/`wss` optional hosts.

**Policy:** single purpose — yes if Utilities links and Debug tab are removed; minimum functionality — fails for four advertised clients and for qBittorrent on non-localhost hosts (a reviewer testing against a Docker qBittorrent from another host would see "Unauthorized"); permission minimisation — `ws`/`wss` unnecessary, `notifications` marginal; transparent behaviour — settings that do nothing and a Debug tab undermine it; user data — authentication information handled locally → privacy policy URL, dashboard data-usage certification, and in-UI disclosure required (2026 policy update enforced since 2026-08-01); browsing activity — none, but `activeTab` page read must be described; remote code — none; remote resources — font CDN URLs contradict the policy text; listing metadata — screenshots/tile absent.

**Submission blockers (automated):** none expected from the manifest itself (a 40 MB zip uploads but is unusual). **Human/policy rejection risks:** broken advertised functionality; privacy-policy inconsistencies; Utilities links; unjustified `scripting`/broad optional hosts without justification text. **High-scrutiny but passable with justification:** `scripting` + `activeTab`, `http://*/*` optional hosts, torrent subject matter. **Manual fields:** single-purpose description, six permission justifications + host justification, data-usage checkboxes, privacy URL, trader status, screenshots, promo tile, category, support email.

**Chrome release verdict: NOT READY.** The manifest and security posture are close, but advertised functionality is broken for a large share of users, disclosures are inaccurate, listing assets do not exist, and the package is 40 MB of fonts.

## 23. Mozilla Add-ons / Firefox Readiness

**Manifest/API:** `background.scripts` event page — correct; `browser_specific_settings.gecko.id` **absent → addons-linter error `ADDON_ID_REQUIRED`** (hard submission failure); `strict_min_version` absent (needs ≥ 128.0 for `optional_host_permissions`, 140.0 for built-in consent UI); `data_collection_permissions` **absent** (mandatory for new submissions since 2025-11-03; linter warning today, submission rejection in practice); `storage.session` needs 115+; `chrome.*` promises fine; `optional_host_permissions` fine on 128+; `permissions.request` is called synchronously in a click handler — correct; custom CSP replaces default `upgrade-insecure-requests` — PLAUSIBLE — VERIFY that plain-HTTP LAN targets work; `contextMenus` alias fine; `notifications` fine (Firefox may drop rapid successive notifications — Scan Page fires two in a row).

**Reviewer concerns:** data transmission to the user's server — choose the `data_collection_permissions` value and state it in reviewer notes; privacy policy required; remote code none; minified bundle → **source code submission mandatory**, with reproducible build instructions; today the build is not byte-reproducible (fonts, buildInfo) and the auto-generated sources zip contains torrent-site content scripts and logs; third-party libraries unmodified (Carbon/React from npm — fine, reviewers verify by checksum, so `package-lock.json` must be included); "no surprises" — Utilities links and dead settings; encryption in transit — plain HTTP to LAN clients is the norm for this product class; document it and warn in UI; reviewer must be able to test → test instance or Docker recipe.

**Submission risks:** automated — `ADDON_ID_REQUIRED` (fail), `MISSING_DATA_COLLECTION_PERMISSIONS`, `DANGEROUS_EVAL` (reflect-metadata), `UNSAFE_VAR_ASSIGNMENT` (React) — the last two are warnings from unmodified libraries; source review — reproducibility diff fails; policy — same as Chrome plus consent framework; signing — listed AMO submission; packaging — 38 MB XPI.

**Firefox release verdict: NOT READY** (bordering FUNDAMENTAL REWORK for the release pipeline, not for the code): the manifest cannot be submitted, the source package pipeline is not reproducible, and the functional/disclosure defects from the Chrome verdict apply equally. Firefox runtime behaviour has never been verified by automation.

## 24. Cross-Browser Delta

| Area | Chrome | Firefox | Current CTRL | Required action |
|---|---|---|---|---|
| Background | `service_worker` | `scripts` event page | WXT emits both correctly | none |
| Add-on identity | n/a | `gecko.id` mandatory (MV3) | absent | add via `env.browser === 'firefox'` branch |
| Min version | `minimum_chrome_version` optional | `strict_min_version` recommended ≥ 128 | both absent | add "102"/"120" and "128.0"/"140.0" |
| Data consent | dashboard form + in-UI disclosure | manifest `data_collection_permissions` (140+) + custom consent on 128–139 if not `none` | absent | decide value; add key; add in-UI disclosure for both |
| CSP default | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` | adds `upgrade-insecure-requests` | custom policy in both | verify Firefox plain-HTTP; optionally add `default-src 'self'` |
| Host permission grant | optional, per-origin via user gesture | 128+: same; user can revoke from toolbar panel; request must be synchronous in handler | compliant | add `permissions.onRemoved` handling |
| `chrome.*` promises | yes | yes | used | none (Chrome <148 lacks `browser.*` — WXT alias handles) |
| `storage.session` | 102+ | 115+ | used | min versions |
| Alarms floor | 0.5 min (120+) | undocumented | 1 min | none |
| Notifications | `iconUrl` required | may drop rapid successive | two calls in a row on Scan Page | debounce |
| `getBrowserInfo` | absent | present | feature-detected | none |
| WebSocket in background | 116+ keeps SW alive | n/a | unused | remove `ws`/`wss` permissions |
| Source submission | not required | required, reproducible | not reproducible | BUILD-01, REL-01 |
| LNA | 142+ web origins; extensions with granted host permission exempt (secondary source) | none | per-origin grant enforced before fetch | verify on Chrome ≥ 144 |
| Runtime testing | Playwright e2e (6 tests) | none | — | add `web-ext` smoke |

**Verdict:** CTRL is a Chromium extension with a Firefox build target that compiles, plus an uncommitted Firefox-motivated security fix. It has never been verified by automation in Firefox, cannot be submitted to AMO in its current manifest form, and its Firefox-specific runtime claims ("fully tested") are unsupported. It is portable by construction, so making it a genuine dual-browser product is a bounded task (manifest block, reproducibility, one runtime verification pass), not a port.

## 25. Architecture Quality Assessment

| Dimension | Assessment | Class |
|---|---|---|
| Conceptual clarity | Clear layering (entrypoints → features → entities → shared) but with duplicates (`ITorrentClient` ×2, retry helpers ×2, i18n helpers ×3) and a `services/` vs `model/services/` split without rule | C |
| Separation of concerns | Background mixes resolution, polling, badge, message routing, notification in one 450-line closure | B |
| Maintainability | Adapters are large but isolated; dead surfaces (~2k lines) mislead | B |
| Testability | Adapters testable; background/vault/UI lifecycle untestable as written (module-level state, direct `chrome.*` calls) | B |
| Browser portability | Good | — |
| Security boundaries | Good (sender check, no content scripts, vault) | — |
| State ownership | Unclear: settings in `local:options`, servers in vault, torrents in SW memory + `storage.session` + popup local state + Zustand; four independent vault-state pollers | B |
| Dependency direction | Mostly inward; `features/model/services/ContextMenuService` imports `ServerResolver` from `shared/api` — fine | — |
| Data-flow clarity | Two parallel torrent pipelines (popup direct calls vs port/viewport) | B |
| Error isolation | Adapter errors typed; background collapses to `{error: string}`; UI shows strings | C |
| Configuration management | Single `wxt.config.ts`; missing browser branches | A (small) |
| Extensibility | Adding an adapter is documented; adding transport variants is not possible without touching the shared client | B |
| Operational simplicity | Build side effects (buildInfo, backup) and 40 MB output | A |

## 26. Foundational Assessment

### FND-01 — Single-policy HTTP transport for nine protocols
- Root cause: `FetchHttpClient` hard-codes `credentials: 'omit'` (introduced 2026-02-07 to fix a Firefox/Transmission CORS case), forbidden-header injection, JSON coercion, and a fixed abort signal; adapters were written against Node-like `Headers` semantics and tested with mocks that do not enforce browser rules.
- Symptoms: ADP-01..05, ADP-10, OL-013; qBittorrent-only `credentials:'include'` workaround inside one adapter.
- Future symptoms: every new adapter repeats the problem; any DNR reintroduction expands permissions.
- Fix: make transport policy an adapter-declared `TransportProfile` (`credentials`, `rawBody`, `contentType`, `timeoutMs`, `signal` passthrough, header strategy); implement cookie-based adapters with `credentials: 'include'` (per-origin host permission already grants cookie access for that origin) and verify CORS/`SameSite` behaviour live in both browsers; encode raw string bodies untouched; document the qBittorrent CSRF position (server setting) or prove `include` fixes it.
- Migration: touch `FetchHttpClient`, `JsonRpcClient`, 6 adapters; add transport contract tests. No storage migration.
- Do not patch individually before this: per-adapter cookie hacks, DNR re-add, retry tweaks.

### FND-02 — Firefox manifest identity and consent absent
- Root cause: one manifest object for both targets; gecko block never added.
- Symptoms: FF-01; Firefox build cannot be signed/submitted.
- Fix: `env.browser` branch in `wxt.config.ts` adding `browser_specific_settings.gecko` (id, `strict_min_version`, `data_collection_permissions`) and `minimum_chrome_version` for Chrome; add addons-linter to CI.
- Do not patch before: hand-editing built manifests.

### FND-03 — Packaging pipeline is oversized, non-deterministic, and has side effects
- Root cause: `style.css` imports the entire Carbon stylesheet and the entire IBM Plex CSS; both entries import both CSS files; Vite emits every Plex face; font asset numbering is unstable; `generate-build-info.ts` rewrites tracked source; `backup.ts` copies source outside the repo; WXT sources zip is unconstrained.
- Symptoms: PKG-01, BUILD-01, REL-01, PRIV-01, PERF-01.
- Fix: import only needed Carbon SCSS/CSS (or keep `styles.css` but exclude `@ibm/plex` and self-host only the 2–4 Plex faces actually used, or use system fonts), single CSS entry, delete `generate-build-info.ts` in favour of `__APP_VERSION__` define, remove `backup` from `build`, configure `zip.excludeSources` or standardise on `zip:source`, add build-twice diff gate.
- Do not patch before: CSS tweaks, font swaps in components, store asset creation (screenshots would show a UI that changes).

### FND-04 — No identity or generation protocol between background and UI
- Root cause: singleton `activeClient`; positional viewport patches; commands without server id; independent vault-state pollers; two polling paths.
- Symptoms: ARCH-01..05, BUG-02, UX-01 (partly), ARCH-03.
- Fix: introduce `{serverId, generation}` on every poll result, viewport message and command; make viewport updates keyed by torrent id with an ordered id list (drop RFC 6902 positional patches or validate id at apply time); single background-owned polling with single-flight; UI subscribes via port and receives an initial snapshot on connect; vault state broadcast via `storage.session` watch so all contexts lock together.
- Migration: background, ViewportManager, TorrentDiffer, useTorrentPoller, useTorrentStore, TorrentRow, popup Dashboard (switch to port subscription). Tests: background concurrency, differ properties.
- Do not patch before: popup polling tweaks, optimistic-update fixes, per-row bug fixes.

### FND-05 — Product surface promises behaviour the runtime does not have
- Root cause: UI built ahead of features (themes, layout, notification levels, palette, storage health, Debug tab, utilities), docs written from plans.
- Symptoms: UX-02, UX-03, PRIV-02, DOC drift, "7 languages".
- Fix: remove/hide every control without a consumer; rewrite README, BETA guide, privacy policy from the code; establish a "settings-consumption matrix" test.
- Do not patch before: implementing themes or notification levels for v1.

### FND-06 — i18n pipeline and claims
- Root cause: legacy locale files from the original Torrent Control port (32 keys) vs 152 current keys; hardcoded English in 34 of 41 UI files and all context-menu/notification strings; placeholder-injecting workflow armed in CI.
- Symptoms: I18N-01, CI-01.
- Fix for v1: disarm workflow; either ship English only (remove non-English locale dirs and the claim) or externalise the current UI strings and translate properly later.

## 27–28. Issue Register and Required Finding Format

Legend: Priority P0–P4; Type; Confidence (Confirmed / High / Medium / Low); Evidence class (SI = static inspection, RV = runtime verification, AT = automated test, BP = build/package evidence, OP = official policy, INF = inference requiring verification).

### [FND-01] Shared HTTP transport breaks cookie-based and raw-body adapters (covers ADP-01, ADP-02, ADP-03, ADP-04)

**Priority:** P0  **Type:** BUG, ARCHITECTURE, CROSS_BROWSER  **Confidence:** Confirmed (ADP-01, ADP-02 by code trace and harness), High (ADP-03, ADP-04 depend on documented Fetch forbidden-header behaviour)  **Affected browsers:** both
**Evidence:** `extension/src/shared/api/network/FetchHttpClient.ts:27-62,154-169`; `clients/deluge/DelugeAdapter.ts:45-105,183-221`; `clients/rutorrent/RuTorrentAdapter.ts:53-64`; `clients/flood/FloodAdapter.ts:133-151,565-571`; `clients/utorrent/UTorrentAdapter.ts:48-58,389-394`; `docs/reports/2026-02-07__p0_firefox_transmission_cors_credentials_fix__report.md` (origin of `omit`); RAIDEN OL-013. SI + prior harness.

**Problem:** One transport policy is applied to nine protocols. `credentials:'omit'` discards every `Set-Cookie`; `Cookie`, `Origin`, `Referer` are forbidden request headers and are silently dropped; every non-`FormData`/`URLSearchParams` body is `JSON.stringify`'d with `Content-Type: application/json`; the caller's `AbortSignal` is overwritten.
**Why it matters:** Deluge, Flood, µTorrent and ruTorrent cannot complete a session; the README, beta guide and store copy would advertise nine "Full" clients.
**Root cause:** the shared client was changed to `omit` to fix a Firefox/Transmission CORS case without a per-adapter policy; tests use Node `Headers`/mocked `fetch` that do not model browser rules.
**Current consequence:** four adapters fail on every real server; ruTorrent fails on request parse.
**Release consequence:** Chrome "minimum functionality"/misleading listing rejection or a wave of 1-star reviews; AMO "no surprises" and reviewer test failure.
**Recommended solution:** adapter-declared transport profile; `credentials:'include'` for Deluge/Flood/µTorrent (host permission already covers the origin); raw-body passthrough with caller `Content-Type`; signal passthrough; contract tests that emulate browser header guards.
**Implementation outline:** (1) add `TransportProfile { credentials: RequestCredentials; rawBody?: boolean; timeoutMs?: number }` to `FetchHttpClient` constructor; (2) `post()` sends `string`/`Blob`/`ArrayBuffer` bodies untouched and only JSON-encodes plain objects; (3) merge caller `signal` with the timeout via `AbortSignal.any` or manual linking; (4) Deluge/Flood/µTorrent construct their client with `include`; µTorrent stops parsing `Set-Cookie` and relies on the cookie jar; (5) delete `HeaderRewriter.ts` and the `Origin`/`Referer` injection; (6) tests: `FetchHttpClient.contract.test.ts` with a `Headers` shim that throws on forbidden names and asserts `credentials` per adapter; ruTorrent body/content-type assertion; (7) docs: update `docs/adding-a-client.md` with the profile requirement.
**Alternatives considered:** reinstate DNR `modifyHeaders` for cookies/origin (adds `declarativeNetRequest` permission and does not fix cookie storage); use `cookies` API (extra permission, more disclosure). **Recommended:** `credentials:'include'` per adapter; verify the 2026-02-07 Firefox CORS issue does not recur for Transmission (it keeps `omit` because it uses Basic auth + custom header).
**Dependencies:** none. **Acceptance criteria:** each of the four adapters completes login → list → add → pause → remove against a real server from Chrome and Firefox; ruTorrent request body is the exact XML with `text/xml`; contract tests fail if a forbidden header is relied on. **Verification:** live matrix + unit contract tests. **Estimated scope:** M. **Consequence of deferral:** ship with four broken clients or drop them from the listing. **Release gate:** BLOCKS BOTH STORES (unless the four adapters are withdrawn from v1).

### [ADP-05] qBittorrent CSRF protection rejects extension requests off localhost

**Priority:** P1  **Type:** BUG, CROSS_BROWSER  **Confidence:** High  **Affected browsers:** both
**Evidence:** `FetchHttpClient.ts:31-33`, `QBittorrentAdapter.ts:326-342`, `HeaderRewriter.ts` no-op, unit test `QBittorrentAdapter.test.ts:126-143` asserts a header the browser never sends; OL-013. SI + INF (needs live confirmation).
**Problem:** the browser sends `Origin: chrome-extension://…` / `moz-extension://…`; qBittorrent's default "CSRF protection" compares Origin to Host and returns 401. **Why it matters:** qBittorrent is the flagship client; LAN/seedbox users hit it immediately. **Root cause:** DNR header rewrite removed 2026-07-02 without replacement. **Current consequence:** login fails, adapter escalates to `IP_BANNED` after 3 attempts. **Release consequence:** reviewer running qBittorrent in Docker from a different host sees failure. **Recommended solution:** live-test first; then either document "disable CSRF protection or add the extension origin to Host header validation" with an in-app hint on 401, or (if unavoidable) reintroduce a per-origin DNR `modifyHeaders` rule for `Origin` scoped to the granted host with a clear permission justification. **Implementation outline:** live test on Chrome + Firefox against qBittorrent ≥ 4.6 and 5.x on a non-localhost host; map 401 with body `Fails.`/`Unauthorized` to a `CSRF_REJECTED` error with actionable message; remove the false unit test; update docs. **Alternatives:** none better. **Dependencies:** FND-01 (transport profile). **Acceptance:** documented path works on both browsers; error message names the server setting. **Verification:** live test. **Scope:** S–M. **Deferral:** most users fail on first connect. **Gate:** BLOCKS QUALITY BAR.

### [FF-01] Firefox manifest lacks add-on id, minimum version, and data-collection consent

**Priority:** P0  **Type:** POLICY, CROSS_BROWSER, RELEASE  **Confidence:** Confirmed  **Affected browsers:** Firefox
**Evidence:** `extension/wxt.config.ts:14-70` (no `browser_specific_settings`); `builds/firefox-mv3/manifest.json`; `addons-linter` → `ADDON_ID_REQUIRED` (error), `MISSING_DATA_COLLECTION_PERMISSIONS` (warning); MDN `browser_specific_settings` (fetched 2026-09-08), Mozilla blog 2025-10-23. BP + OP.
**Problem/why:** AMO cannot sign an MV3 add-on without `gecko.id`; new submissions since 2025-11-03 must declare `data_collection_permissions`. **Root cause:** single manifest object without browser branch. **Consequence:** submission fails at upload. **Solution:** branch in `manifest: (env)` on `env.browser === 'firefox'` adding `browser_specific_settings: { gecko: { id: 'ctrl@<domain-or-guid>', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] /* or ['authenticationInfo'] */ } } }`; add `minimum_chrome_version: '120'` for Chrome. **Implementation:** `wxt.config.ts`; CI step `npx addons-linter builds/firefox-mv3 --warnings-as-errors` with an allowlist for library warnings; document the id choice (it is permanent). **Alternatives:** none. **Dependencies:** operator decision on consent value (Deferred #2). **Acceptance:** linter 0 errors; manifest contains the block only in the Firefox build. **Verification:** linter in CI; `web-ext run` smoke. **Scope:** XS. **Deferral:** Firefox release impossible. **Gate:** BLOCKS FIREFOX.

### [PKG-01] Production package is 40.7 MB, mostly bundled IBM Plex fonts, with Carbon CSS twice and remote font URLs

**Priority:** P1 (P0 for Firefox in combination with BUILD-01)  **Type:** BUILD, RELEASE, PERFORMANCE, PRIVACY  **Confidence:** Confirmed  **Affected browsers:** both
**Evidence:** `extension/src/entrypoints/style.css:1-3` (`@import '@carbon/styles/css/styles.css'; @import '@ibm/plex/css/ibm-plex.css'; @import '../app/styles/global.css'`), both `main.tsx` files import `style.css` and `global.css`; build output 1,058 woff/woff2, `assets/style.css` 984 KB + `assets/global-*.css` 1,000 KB; 105 `s81c.com` URLs in built CSS. BP.
**Problem/why:** install size, popup load time, reviewer friction, and an external font CDN reference that contradicts the privacy statement. **Root cause:** whole-library CSS imports. **Solution:** import Carbon component styles selectively (Carbon supports SCSS partials) or keep `styles.css` but drop `@ibm/plex` entirely and self-host only the Plex Sans/Mono weights used (or use system fonts via `--cds-font-family-sans`), single CSS entry, and verify no `s81c.com` remains. **Implementation:** `style.css`/`global.css` restructure; `wxt.config.ts` Vite `build.assetsInlineLimit`/`rollupOptions` if needed; remove unused Inter/JetBrains fonts; CI size cap (e.g. ≤ 5 MB) and `grep -c s81c.com` = 0 check. **Alternatives:** keep full Plex but set `font-src 'self'` (still 40 MB). **Dependencies:** none. **Acceptance:** package ≤ 5 MB; one CSS bundle per entry; zero remote URLs. **Verification:** `unzip -l` + CI check. **Scope:** S–M. **Deferral:** 40 MB downloads, slow popup, policy contradiction. **Gate:** BLOCKS QUALITY BAR (Chrome), BLOCKS FIREFOX with BUILD-01.

### [BUILD-01] Builds are not reproducible and mutate a tracked file

**Priority:** P1  **Type:** BUILD, RELEASE  **Confidence:** Confirmed  **Affected browsers:** Firefox (policy), both (hygiene)
**Evidence:** two consecutive `wxt build -b chrome` runs differ in `assets/style.css` (font asset numbering); `scripts/generate-build-info.ts` writes `src/shared/lib/buildInfo.ts` with `new Date()`; stash `WIP on main: buildInfo.ts regenerated build stamp`; AMO source-code submission policy (fetched 2026-09-08) requires an identical rebuild. BP + OP.
**Solution:** delete `generate-build-info.ts` and derive version from `__APP_VERSION__`/`runtime.getManifest()`; drop the display timestamp; make font emission deterministic (removing Plex bundling resolves it) or pin Vite asset naming; add `BUILD.md` (OS, Node 24.x, npm 11.x, `npm ci`, `npm run build:firefox`, `npm run zip:firefox`) inside the source archive; CI job builds twice and diffs. **Dependencies:** PKG-01. **Acceptance:** two builds on two machines produce identical zips (sha256). **Scope:** S. **Gate:** BLOCKS FIREFOX.

### [REL-01] Firefox source archive path is ambiguous and the WXT default leaks legacy site-integration code

**Priority:** P1  **Type:** RELEASE, POLICY  **Confidence:** Confirmed  **Affected browsers:** Firefox
**Evidence:** `builds/ctrl-extension-0.2.0.1-sources.zip` contains `backups/site-integrations-v0.2.0-2026-01-11/entrypoints/{1337x,rarbg,tpb,nyaa,tgx,fitgirl,audiobookbay}.content.tsx`, `build_log.txt`, `audit_extension*.txt`, `playwright-report/`; `scripts/zip-source.ts` is correct but refuses dirty trees and is not wired into CI. BP.
**Solution:** set `zip.excludeSources` in `wxt.config.ts` (or disable WXT source zip) and make `zip:source` the only documented path, run from a clean tag in CI, include `BUILD.md`, `package-lock.json`, `.nvmrc`. **Acceptance:** source archive contains only tracked files under `extension/` + build instructions; reviewer rebuild diff is empty. **Scope:** XS. **Gate:** BLOCKS FIREFOX (if the wrong archive is uploaded, reviewers see piracy-site content scripts that the product no longer contains).

### [PRIV-01] Shipped CSS references IBM's font CDN

**Priority:** P1  **Type:** PRIVACY, POLICY  **Confidence:** Confirmed (URLs present), Medium (whether fetched at runtime)  **Affected browsers:** both
**Evidence:** 105 `https://1.www.s81c.com/common/carbon/plex/...` `src:url()` entries in `builds/chrome-mv3/assets/style.css`; `docs/PRIVACY_POLICY.md` "No network requests to external servers". BP + SI.
**Solution:** part of PKG-01; then add `default-src 'self'` (plus the required `connect-src`) to CSP so any regression is blocked, and verify with the network panel that no third-party request occurs on popup/options open. **Scope:** XS after PKG-01. **Gate:** BLOCKS BOTH STORES (disclosure accuracy).

### [PRIV-02] Privacy policy, README and beta guide do not match the implementation; no in-UI disclosure

**Priority:** P1  **Type:** PRIVACY, POLICY, DOCUMENTATION  **Confidence:** Confirmed  **Affected browsers:** both
**Evidence:** `docs/PRIVACY_POLICY.md` (completion notifications, permission list omits `scripting`/`alarms`, "no external requests"); `README.md` ("7 languages", nine "Full" clients); `docs/BETA_TESTING.md` ("Firefox fully tested", themes, completion alerts); no disclosure text in `SetupVault.tsx` / `ServerConfigPanel.tsx`; Chrome User Data FAQ + Disclosure Requirements (fetched 2026-09-08/09); AMO policies 2026-04-30. SI + OP.
**Solution:** rewrite the three documents from the code after FND-05; add a one-paragraph disclosure on the server form ("Your client address and login are encrypted and stored only in this browser; they are sent only to the server you enter") and a first-run screen; publish the policy at a stable URL (GitHub Pages from `docs/privacy.html` is sufficient); draft the Chrome data-usage answers (authentication information; website content for Scan Page) and the AMO consent value. **Dependencies:** FND-05, FND-01 (support matrix). **Acceptance:** every claim in policy/README is traceable to code; disclosure visible before credentials are entered. **Scope:** S. **Gate:** BLOCKS BOTH STORES.

### [PROD-01] Utilities page links to torrent-cache and IP-tracking websites

**Priority:** P1  **Type:** POLICY, PRODUCT  **Confidence:** Medium (reviewer outcome), Confirmed (presence)  **Affected browsers:** both
**Evidence:** `src/shared/lib/resources.ts` (btcache.me, itorrents.net, torrage.info, iknowwhatyoudownload.com, checker.openwebtorrent.com), `Utilities.tsx:176-208`; Chrome "Malicious and Prohibited" policy language on facilitating unauthorized access to copyrighted content; AMO "no surprises". SI + OP.
**Solution:** remove the external-link groups from v1 (keep Diagnostics under Settings). **Scope:** XS. **Gate:** BLOCKS QUALITY BAR / high rejection risk.

### [UX-01] Locked vault presented as "not configured"; no unlock in the popup

**Priority:** P1  **Type:** UX, PRODUCT  **Confidence:** Confirmed  **Affected browsers:** both
**Evidence:** `features/torrent-control/ui/Dashboard.tsx:124,199-239`; `useSettings.ts:82-123`; `useVault.ts`. SI.
**Solution:** derive popup state from `VaultService` (`uninitialized` → Setup; `locked` → inline `UnlockVault`; `unlocked && no servers` → Add server; otherwise dashboard); reuse `VaultGuard`. **Implementation:** mount `VaultGuard` in `Popup.tsx`; shrink `UnlockVault` styling for 400 px; remove the 2 s vault poll. **Dependencies:** FND-04 (vault state broadcast) helps but is not required. **Acceptance:** after browser restart the popup shows an unlock form and returns to the dashboard on success. **Scope:** S. **Gate:** BLOCKS QUALITY BAR.

### [UX-02] Production popup contains a non-functional Debug tab

**Priority:** P1  **Type:** UX, PRODUCT  **Confidence:** Confirmed  **Affected browsers:** both  **Evidence:** `Popup.tsx:81-103`, `wxt.config.ts:91`. **Solution:** gate the tab on `__UI_DEBUG_MODE__` or delete it; replace the "Settings" placeholder tab with a direct options link. **Scope:** XS. **Gate:** BLOCKS QUALITY BAR.

### [UX-03] Settings without runtime consumers

**Priority:** P1  **Type:** UX, PRODUCT  **Confidence:** Confirmed  **Affected browsers:** both  **Evidence:** §16 UX-03 table. **Solution:** delete Appearance (theme/performance), Layout, notification level/style, "Open Web UI" toggle, Enhanced Diagnostics, CommandPalette, Storage Health and System Status cards; keep context-menu mode, add-paused, notifications on/off, badge, labels (add a labels editor or remove label menus). **Tests:** a settings-consumption matrix test that fails if a persisted key has no reader. **Scope:** S. **Gate:** BLOCKS QUALITY BAR.

### [ARCH-01] Poll results and commands are not bound to a server

**Priority:** P1  **Type:** BUG, ARCHITECTURE  **Confidence:** Confirmed (static concurrency trace)  **Affected browsers:** both  **Evidence:** `background.ts:46,152-178,282-286,306-396`; `TorrentRow.tsx:20-33`. **Solution:** see FND-04; add `serverId` (stable UUID stored in `ServerConfig`, migrated on load) and `generation` to poll results/messages; background rejects stale results and commands whose `serverId` ≠ active; destructive commands fail closed. **Tests:** fake-browser background test with a deferred adapter promise across a server switch. **Dependencies:** none. **Scope:** M. **Gate:** BLOCKS QUALITY BAR (wrong-server removal is data loss).

### [ARCH-02] Positional viewport patches corrupt row identity

**Priority:** P1  **Type:** BUG, ARCHITECTURE  **Confidence:** Confirmed (reproduced 2026-09-08; re-traced)  **Affected browsers:** both  **Evidence:** `TorrentDiffer.ts:40-132`; `useTorrentStore.ts`. **Solution:** replace with keyed updates `{ids: string[], changed: Record<id, Partial<Torrent>>, removed: id[]}` and store by id + ordered id list; or validate id at apply and fall back to snapshot. **Tests:** permutation property test. **Dependencies:** none (coordinate with ARCH-01 in one wave). **Scope:** S–M. **Gate:** BLOCKS QUALITY BAR.

### [SEC-02] OL-012 vault-key remediation is uncommitted

**Priority:** P1  **Type:** SECURITY, RELEASE  **Confidence:** Confirmed  **Affected browsers:** Firefox (defect), both (purge)  **Evidence:** `git diff` on `KeyManager.ts`, `background.ts`, `ContextMenuService.ts`; untracked `tests/unit/KeyManager.test.ts` (530 tests pass with it). **Solution:** review and commit as its own change with the test; add VaultService/SecurityService tests in the same wave (SEC-01). **Scope:** XS. **Gate:** BLOCKS BOTH STORES (shipping the pre-change Firefox build would persist the key in plaintext).

### [SEC-03] "Safe" export leaks `clientOptions.simpleApiKey`

**Priority:** P1  **Type:** SECURITY, PRIVACY  **Confidence:** Confirmed  **Affected browsers:** both  **Evidence:** `useSettings.ts:192-196,222-228`; `BiglyBTSchema.ts:350-364`; OL-014. **Solution:** allow-list exported fields per `ServerConfig` and per client's declared secret keys; add a test that populates every credential field and asserts absence. **Scope:** XS. **Gate:** BLOCKS QUALITY BAR.

### [PERM-01] Unused `ws://*/*` and `wss://*/*` optional host permissions

**Priority:** P1  **Type:** POLICY  **Confidence:** Confirmed  **Affected browsers:** both  **Evidence:** `wxt.config.ts:30-35`; no WebSocket callers. **Solution:** remove; delete `WebSocketKeepalive.ts` and `ServiceWorkerKeepalive` or move to a branch. **Scope:** XS. **Gate:** BLOCKS BOTH STORES (unnecessary permission is a policy defect).

### [CI-01] `auto-localize.yml` can overwrite real translations with placeholders

**Priority:** P1  **Type:** RELEASE, MAINTAINABILITY  **Confidence:** Confirmed  **Affected browsers:** both  **Evidence:** `.github/workflows/auto-localize.yml`; `scripts/translator/index.js:51-58`; `gh run list` empty; OL-015. **Solution:** delete or disable the workflow (`on: workflow_dispatch` only) until a reviewed translation process exists. **Scope:** XS. **Gate:** BLOCKS QUALITY BAR.

### [I18N-01] Locale coverage ~21 %; most UI hardcoded English

**Priority:** P1 (if languages are advertised) / P3 (if English-only v1)  **Type:** PRODUCT, UX  **Confidence:** Confirmed  **Evidence:** key counts en 152 / de es fr zh_CN 32 / fi 63 / ru 61; 7 of 41 UI files use `getMessage`; context menu and notifications English. **Solution (v1):** remove non-English locale directories or keep them but advertise English only; remove three unused i18n helper modules; fix `extract-i18n` (would clobber `en/messages.json`). **Scope:** XS (reduction) / L (full i18n). **Gate:** BLOCKS QUALITY BAR only if multi-language is claimed.

### [A11Y-01] Server configuration form has no accessible names or visible focus

**Priority:** P1  **Type:** ACCESSIBILITY, UX  **Confidence:** Confirmed  **Evidence:** `ServerConfigPanel.tsx:186-368` (labels without `htmlFor`, undefined Tailwind tokens `border-border`, `focus:ring-accent`, `bg-accent`). **Solution:** rebuild the form with Carbon `TextInput`/`Select`/`PasswordInput`/`Button` and `InlineNotification` with `role="status"`; replace `confirm`/`alert` with Carbon `Modal`/notifications. **Scope:** S. **Gate:** BLOCKS QUALITY BAR.

### [A11Y-02] Toggles without accessible names

**Priority:** P1  **Type:** ACCESSIBILITY  **Confidence:** Confirmed  **Evidence:** `SettingsToggle.tsx:26-34`, `ContextMenuSettings.tsx:124-129`. **Solution:** pass `labelText`/`aria-labelledby` and stable ids. **Scope:** XS. **Gate:** BLOCKS QUALITY BAR.

### [STORE-01] Listing metadata and assets absent; manifest name embeds version

**Priority:** P1  **Type:** RELEASE, DOCUMENTATION  **Confidence:** Confirmed  **Evidence:** §21. **Solution:** fixed `name`, 132-char description, screenshots ×3–5 at 1280×800, 440×280 tile, hosted privacy URL, permission justifications, reviewer notes with Docker recipe (`qbittorrent-nox` + `transmission` compose file) or hosted test instance, support email, category, EU trader declaration. **Dependencies:** UX waves (screenshots must show final UI). **Scope:** S. **Gate:** BLOCKS BOTH STORES.

### [TEST-01] No transport, vault, or lifecycle contract tests

**Priority:** P1  **Type:** TESTING  **Confidence:** Confirmed  **Evidence:** §18. **Solution:** the minimum viable suite in §18 items 1–5 and 7. **Dependencies:** FND-01, FND-04 designs. **Scope:** M. **Gate:** BLOCKS QUALITY BAR.

### P2 findings (compact)

| ID | Title | Type | Conf. | Evidence | Solution | Scope | Gate |
|---|---|---|---|---|---|---|---|
| ADP-06 | Transmission absolute `/transmission/rpc` drops sub-path | BUG | Confirmed | `TransmissionAdapter.ts:66-67` | relative `transmission/rpc` like BiglyBT; test with base path | XS | ACCEPTABLE POST-LAUNCH (document workaround) |
| ADP-07 | Aria2 `/jsonrpc` lost in form and not appended | BUG, UX | Confirmed | `Aria2Adapter.ts:32`, `ServerConfigPanel.tsx:230-275` | full-URL field or path field; adapter default path | S | BLOCKS QUALITY BAR if Aria2 ships |
| ADP-08 | qBittorrent 5.x states/endpoints | BUG | Confirmed/Medium | `QBittorrentAdapter.ts:445-458` | map `stopped*`; verify `stop/start` | XS | BLOCKS QUALITY BAR (flagship) |
| ADP-09 | Deluge/uTorrent `addedDate` seconds | BUG | Confirmed | see §7 | ×1000 | XS | POST-LAUNCH |
| ADP-10 | Dead per-call timeouts; aria2 duplicate add on retry; retry of auth failures | BUG | Confirmed | `FetchHttpClient.ts:39-44`, `Aria2Adapter.ts:478-550`, `withAdapterRetry.ts` | signal merge (FND-01); retry predicate; no retry on non-idempotent ops | S | BLOCKS QUALITY BAR (duplicate adds) |
| ADP-11 | Silent no-op unsupported operations | BUG, UX | Confirmed | ruTorrent/aria2/Deluge/uTorrent | capability map; throw `NOT_SUPPORTED`; hide controls | S | POST-LAUNCH |
| ADP-12 | ruTorrent `testConnection` true on any 200 | BUG | High | `RuTorrentAdapter.ts:197-200` | require valid `client_version` | XS | POST-LAUNCH |
| ARCH-03 | Vault lock window-local | SECURITY | Confirmed | `useVault.ts` | `storage.session` watch → clear state in all contexts | S | BLOCKS QUALITY BAR |
| ARCH-04 | Overlapping/duplicate polling; alarm regardless of badge | PERFORMANCE | Confirmed | `background.ts`, popup `Dashboard.tsx` | single-flight; popup subscribes via port; gate alarm | S | BLOCKS QUALITY BAR (part of FND-04) |
| ARCH-05 | Viewport protocol gaps | BUG | Confirmed | `ViewportManager.ts` | snapshot on subscribe; total independent; end+1 | S | part of FND-04 |
| ARCH-06 | Import/export fidelity and validation | BUG, SECURITY | Confirmed | `useSettings.ts` | single snapshot; explicit empty semantics; enum `type`; http(s) only | S | BLOCKS QUALITY BAR |
| SEC-01 | Salt-only vault accepts any password | SECURITY | Confirmed | `VaultService.ts:15-88` | versioned record; fail closed; tests | XS | BLOCKS QUALITY BAR |
| SEC-06 | Scan Page adds unlimited magnets without confirmation | SECURITY, UX | Confirmed | `ContextMenuService.ts:373-401` | cap + confirmation notification/dialog | XS | POST-LAUNCH (document) |
| PERM-02 | `notifications` required but barely used | POLICY | Confirmed | manifest | optional permission requested on enable | XS | POST-LAUNCH |
| DEP-01 | `tsyringe`/`reflect-metadata` unused DI; source of `DANGEROUS_EVAL` | DEPENDENCY, POLICY | Confirmed | `background.js` linter; `@injectable` without container | remove decorators + Babel plugin + `emitDecoratorMetadata` | S | BLOCKS QUALITY BAR (linter noise for AMO) |
| DEP-03 | Prod build includes `react-component-data-attribute`; unused fonts | DEPENDENCY, BUILD | Confirmed | `wxt.config.ts:80-84`, `public/fonts` | gate to dev; delete fonts | XS | POST-LAUNCH |
| DOC-01 | Architecture/API/Beta/Security docs stale | DOCUMENTATION | Confirmed | §20 | rewrite from code | S | BLOCKS QUALITY BAR (reviewers read them) |
| DOC-02 | No third-party licence notices (OFL fonts) | DOCUMENTATION, POLICY | Confirmed | none in repo/package | `THIRD_PARTY_NOTICES.md` bundled | XS | BLOCKS QUALITY BAR |
| CI-02 | No packaging/linter/size/diff gates; scripts and tests unlinted | RELEASE | Confirmed | `ci.yml`, `tsconfig.json` | §19 | S | BLOCKS QUALITY BAR |
| UX-04..UX-12 | see §16 | UX | Confirmed | §16 | §16 | S total | mixed |
| PERF-01/02 | popup CSS weight; alarm polling | PERFORMANCE | Confirmed/INF | §15 | PKG-01; gate alarm | — | with PKG-01 |
| CROSS-01 | Firefox custom CSP vs `upgrade-insecure-requests`; plain-HTTP LAN | CROSS_BROWSER | INF | MDN CSP page | runtime verify in Firefox 128/140+ | XS | BLOCKS FIREFOX until verified |
| SEC-05 | Public map to a formerly exposed (public Chromium) key in tracked `.raiden/state` | SECURITY (hygiene) | Confirmed | `CURRENT_STATE.md:26`, OL-011 | operator decision on tracking `.raiden/` publicly | XS | OPTIONAL |

### P3 / P4

BUG-01 (popup progress status), BUG-02 (post-restart polling), BUG-03 (locked notification ignores setting), SEC-08 (scheme validation), UX-11, A11Y P3 items, dead modules (`Toast`, `PlaceholderPage`, `PageHeader`, `Card`, i18n helpers, qBittorrent unused services, `XmlRpcHelper`, `parseDOM`, `WebSocketKeepalive`), ESLint warnings, duplicate `ITorrentClient`, `SECURITY.md` contact, `.nvmrc`/docs Node mismatch, dev-dep audit items, `console.log` volume. P4: Vite 8 / Babel 8 migrations, React 19, Carbon major bumps, full i18n, themes, WebSocket push, RSS, file-based add (`addTorrentFile` exists in adapters but is unreachable from UI).

# What CTRL Should NOT Do Next

| Tempting work | Why someone proposes it | Why it is lower value or harmful now | Reconsider when |
|---|---|---|---|
| Vite 8 / Babel 8 / React 19 / Carbon major upgrades (OL-005, OL-006) | "dependency currency" | No production vulnerability; large regression surface; delays release | after v1.0 ships and CI has packaging gates |
| Reintroduce `declarativeNetRequest` for CSRF headers | it worked before | adds a permission and a reviewer question; may be unnecessary once cookie-based `include` and server-side settings are verified | only if the live test proves no alternative for qBittorrent |
| Build a browser-abstraction / adapter layer | "dual-store safety" | code is already portable; the only gaps are manifest keys and verification | never, absent a third target |
| Implement themes, layout editor, notification levels, command palette, storage-health metrics | UI already exists for them | these are FND-05 symptoms; implementing them adds surface before the core works | post-launch, feature by feature, with consumers first |
| Full 7-language i18n with an AI pipeline | README promise | the armed workflow is the risk; translation without a stable string set churns twice | after the UI string set freezes (post UX waves) |
| WebSocket keepalive / push updates | Chrome 116 feature | no client protocol defined; permission bloat | when a client with a WS API is supported |
| Performance tuning for 10k torrents (ROADMAP) | roadmap goal | no measurement; the current identity bug (ARCH-02) makes optimisation moot | after FND-04 and a measured baseline |
| Automated store publishing in CI | "release engineering" | packaging is not stable or reproducible; manual first submissions are safer | after two manual releases with green gates |
| Adding telemetry/crash reporting to "understand users" | support burden | breaks the strongest listing claim (zero data); adds consent obligations | avoid |
| Broad test rewrites / coverage targets (>70 %) | ROADMAP quality gate | coverage is not the gap; missing contract tests are | keep to the minimum viable suite |
| Expanding permissions (`cookies`, `tabs`, `<all_urls>`) to "simplify" auth | easier cookie handling | policy risk; per-origin optional grants already suffice | never for v1 |
| Rewriting adapters onto a new shared "protocol engine" | elegance | adapters mostly work once transport policy is fixed; rewrite risks regressions in the two best-tested adapters | never as a release task |
| Removing the master-password vault | onboarding friction | it is the basis of the privacy/security story; changing it re-opens disclosures | product decision post-launch with data |

# 30. Scope Reduction Opportunities

| Reduction | Risk/complexity removed |
|---|---|
| Ship v1 with a verified client subset (qBittorrent, Transmission, BiglyBT, Aria2 after ADP-07); mark Deluge/Flood/µTorrent/ruTorrent "experimental — not yet verified" or hide | removes four P0s from the v1 critical path; keeps the code |
| Remove Utilities external links | removes the main policy tripwire |
| Remove Debug tab, popup Settings placeholder, CommandPalette, Storage Health/System Status cards, Appearance/Layout/Performance settings, notification level/style, Enhanced Diagnostics | removes FND-05 entirely; fewer strings, fewer screenshots to redo |
| Ship English-only; delete or deprioritise other locales; delete three unused i18n modules; disarm workflow | removes I18N-01, CI-01 |
| Drop `ws`/`wss` permissions and WebSocket modules | PERM-01 |
| Drop bundled Plex; use system font stack via Carbon token override | most of PKG-01 |
| Remove `tsyringe`/`reflect-metadata`/decorators | DEP-01, linter noise, smaller background bundle |
| Make background polling opt-in to the badge setting (no alarm when badge = none) | PERF-02, battery, simpler disclosure |
| Remove Scan Page (and with it `activeTab` + `scripting`) if the team prefers the smallest permission set | two permissions and one page-content disclosure; costs a useful feature — recommend keeping with a cap |
| Delete unused qBittorrent services, `XmlRpcHelper`, `parseDOM`, `HeaderRewriter`, `Toast`, `PlaceholderPage`, `PageHeader`, `Card`, `backup.ts` | ~2k lines of misleading surface |

# 31. Scope Expansion Opportunities (necessary)

- Transport profile + contract tests (FND-01).
- Firefox manifest block + addons-linter in CI (FF-01).
- Reproducible build + `BUILD.md` + source archive gate (BUILD-01, REL-01).
- In-UI privacy disclosure and hosted policy URL (PRIV-02).
- Popup unlock state (UX-01) and `permissions.onRemoved` handling (UX-12).
- Server/generation identity protocol and keyed viewport updates (FND-04).
- Vault fail-closed + tests (SEC-01, SEC-02).
- Accessible server form (A11Y-01/02).
- Store assets, reviewer notes, Docker test recipe (STORE-01).
- Third-party notices (DOC-02).
- Live client verification matrix (manual for v1).

# 32. Remediation Strategy

## Phase 0 — Release-definition decisions
Objective: fix scope. Decide: v1 client subset; `data_collection_permissions` value; plain-HTTP warning policy; English-only v1; keep or drop Scan Page; public tracking of `.raiden/`/`.serena/`. Exit: decisions recorded in `.raiden/state/DECISIONS.md`.

## Phase 1 — Foundational corrections
Includes: SEC-02 (commit), FND-01 (transport profile) + ADP-05 live test, FND-03 (PKG-01, BUILD-01, REL-01, PRIV-01, DEP-01, DEP-03, PERM-01), FF-01, CI-01. Dependencies: Phase 0. Exit: four adapters authenticate live or are withdrawn; package ≤ 5 MB, deterministic, linter 0 errors; workflow disarmed; contract tests in CI.

## Phase 2 — Release blockers
Includes: FND-04 (ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, BUG-02), SEC-01, SEC-03, ARCH-06, ADP-07, ADP-08, ADP-10, UX-01, UX-02, UX-03, PROD-01. Exit: background concurrency and differ tests green; no dead settings; popup unlock works.

## Phase 3 — Cross-browser stabilisation
Includes: CROSS-01 verification, `permissions.onRemoved`, notification debounce, Firefox `web-ext` smoke in CI, Chrome ≥ 144 LNA check, live matrix on both browsers. Exit: manual matrix (§36) passes on both.

## Phase 4 — Testing and release infrastructure
Includes: TEST-01 remaining items, CI-02 (package job, size cap, forbidden files, checksums, build-twice diff, lint scripts/tests), tagged release artifacts. Exit: a tag produces Chrome zip, Firefox zip, source zip, checksums with all gates green.

## Phase 5 — UX / accessibility / product polish
Includes: A11Y-01, A11Y-02, UX-04..UX-12, DOC-01, I18N-01 reduction, naming consistency. Exit: no `alert/confirm`; form accessible; strings consistent.

## Phase 6 — Store submission preparation
Includes: PRIV-02 rewrite, STORE-01 assets and copy, permission justifications, reviewer notes + Docker recipe, DOC-02 notices, hosted privacy URL, EU trader declaration. Exit: Gate H checklist complete; dry-run upload to both dashboards without submitting.

## Phase 7 — Post-launch backlog
ADP-06, ADP-09, ADP-11, ADP-12, SEC-06, PERM-02, remaining P3/P4, i18n expansion, themes, file-based add, WebSocket push, performance work, dependency majors.

# 33. Dependency Graph

```text
Phase 0 decisions
├── SEC-02 (commit vault fix) ── SEC-01 (fail-closed + tests)
├── FND-01 transport profile
│   ├── ADP-01..04 fixes ── live matrix (Phase 3)
│   ├── ADP-05 qBittorrent CSRF decision
│   ├── ADP-10 signal/retry
│   └── TEST-01 transport contract tests
├── FND-03 packaging
│   ├── PKG-01 fonts/CSS ── PRIV-01 ── CSP default-src
│   ├── BUILD-01 determinism ── REL-01 source archive ── Firefox source upload
│   ├── DEP-01 remove DI ── addons-linter clean
│   └── PERM-01 ws/wss removal
├── FF-01 gecko block ── addons-linter in CI ── Firefox smoke (Phase 3)
├── CI-01 disarm workflow ── I18N-01 decision
├── FND-04 identity protocol
│   ├── ARCH-01 server id ── ARCH-06 import validation (server id migration)
│   ├── ARCH-02 keyed viewport ── ARCH-05
│   ├── ARCH-03 global lock ── UX-01 popup unlock
│   └── ARCH-04 single-flight polling ── PERF-02 alarm gating
├── FND-05 remove dead settings ── UX-02, UX-03 ── PRIV-02 docs rewrite ── STORE-01 copy/screenshots
├── A11Y-01 form rebuild ── ADP-07 URL/path field ── UX-08
└── CI-02 packaging gates ── Gate F ── Gate I manual matrix
```

# 34. Recommended Execution Waves

Each wave = one bounded task for a coding agent. Sequential unless marked parallel-safe.

**Wave 1 — Land the vault fix and fail-closed vault** (SEC-02, SEC-01). Files: `KeyManager.ts`, `VaultService.ts`, `SecurityService.ts`, `tests/unit/KeyManager.test.ts`, new `VaultService.test.ts`. Non-goals: UI. Acceptance: committed; salt-only/ciphertext-only/malformed records reject; 530+ tests green. Verification: unit tests. Parallel-safe with Wave 2.

**Wave 2 — Disarm risky automation and trim permissions** (CI-01, PERM-01, DEP-03 gating, delete WebSocket modules). Files: `.github/workflows/auto-localize.yml`, `wxt.config.ts`, `shared/lib/websocket/*`, `LifecycleAdapter.ts`. Acceptance: workflow cannot fire on push; manifest has no `ws`/`wss`; build passes. Parallel-safe.

**Wave 3 — Transport profile** (FND-01, ADP-10, TEST-01 part 1). Files: `FetchHttpClient.ts`, `JsonRpcClient.ts`, Deluge/Flood/µTorrent/ruTorrent/aria2/BiglyBT adapters, `HeaderRewriter.ts` (delete), tests. Non-goals: qBittorrent CSRF policy change; UI. Acceptance: contract tests assert credentials/body/content-type/signal per adapter; ruTorrent XML verbatim. Verification: unit contract tests + live smoke against Docker Deluge/Flood/ruTorrent.

**Wave 4 — qBittorrent CSRF live test and decision** (ADP-05, ADP-08). Files: `QBittorrentAdapter.ts`, tests, docs. Acceptance: documented working path on both browsers against non-localhost qBittorrent 4.6 and 5.x; 5.x states mapped. Depends on Wave 3.

**Wave 5 — Packaging and reproducibility** (PKG-01, BUILD-01, REL-01, PRIV-01, DEP-01, FF-01). Files: `style.css`, `global.css`, `main.tsx` ×2, `wxt.config.ts`, `package.json` scripts, delete `generate-build-info.ts`/`buildInfo.ts`/`backup.ts`, `VersionOverlay.tsx`, remove `tsyringe`/`reflect-metadata`/decorator plugin, new `BUILD.md`. Non-goals: visual redesign. Acceptance: package ≤ 5 MB; two builds identical; addons-linter 0 errors; zero `s81c.com`; gecko block present in Firefox manifest only. Verification: CI packaging job (added in Wave 9 but run locally here). Depends on Wave 2.

**Wave 6 — Identity protocol and polling** (FND-04: ARCH-01..05, BUG-02, PERF-02). Files: `background.ts`, `ViewportManager.ts`, `TorrentDiffer.ts`, `useTorrentStore.ts`, `useTorrentPoller.ts`, `TorrentRow.tsx`, popup `Dashboard.tsx`, `ServerConfig` (add `id`), `useSettings.ts` migration. Non-goals: adapter changes. Acceptance: server switch during pending poll discards stale data; reorder property test passes; single poller; popup uses port; alarm gated on badge. Verification: new background tests + differ property tests + manual two-server check. Depends on Wave 1.

**Wave 7 — Product surface reduction and popup states** (FND-05, UX-01, UX-02, UX-03, PROD-01, ARCH-03, SEC-03, ARCH-06). Files: `Popup.tsx`, popup `Dashboard.tsx`, `options/Dashboard.tsx`, settings components (delete), `Utilities.tsx`, `resources.ts`, `useVault.ts`, `useSettings.ts`. Acceptance: popup shows unlock when locked; no control without a consumer; safe export contains no credential; lock propagates across windows. Depends on Wave 6.

**Wave 8 — Accessible server form and URL handling** (A11Y-01, A11Y-02, ADP-07, UX-07, UX-08). Files: `ServerConfigPanel.tsx` (rebuild on Carbon), `SettingsToggle.tsx`, `ContextMenuSettings.tsx`, `constants.ts`. Acceptance: full-URL round trip incl. paths; every input labelled; no `alert/confirm`; keyboard-only completion. Depends on Wave 7.

**Wave 9 — CI packaging gates and Firefox smoke** (CI-02, TEST-01 rest, CROSS-01). Files: `.github/workflows/ci.yml`, new `release.yml` (tag → artifacts), `tsconfig.json`, `package.json`. Acceptance: gates from §35 automated; `web-ext run` smoke passes; plain-HTTP fetch verified on Firefox. Depends on Wave 5.

**Wave 10 — Documentation and disclosures** (PRIV-02, DOC-01, DOC-02, STORE-01 text). Files: `README.md`, `docs/*`, `docs/privacy.html` hosting, new `THIRD_PARTY_NOTICES.md`, `docs/STORE_LISTING.md` (copy, justifications, reviewer notes, Docker compose for reviewers). Depends on Waves 7–8 (final behaviour).

**Wave 11 — Assets and manual acceptance** (STORE-01 assets, §36 matrix). Screenshots, promo tile, acceptance record. Depends on Wave 10.

# 35. Release Gates

**Gate A — Architecture stable:** transport profile merged with contract tests; server-id/generation protocol merged; keyed viewport; single poller; vault lock global; no module exports without callers in `shared/api/network`, `shared/lib/websocket`.
**Gate B — Security/privacy acceptable:** OL-012 committed; vault fail-closed tests; sanitized export test; zero third-party URLs in built assets (`grep` = 0); CSP includes `default-src 'self'`; privacy policy matches code (checklist signed).
**Gate C — Chrome functional compatibility:** manual matrix (§36) rows 1,3–20 pass on current Chrome stable and Chrome ≥ 144 with a `192.168.x.x` target; `minimum_chrome_version` set.
**Gate D — Firefox functional compatibility:** addons-linter 0 errors; matrix rows 2–20 pass on Firefox release ≥ `strict_min_version`; plain-HTTP target works; `web-ext run` smoke in CI green.
**Gate E — Test baseline passing:** lint 0 errors over `src/`, `scripts/`, `tests/`; typecheck incl. scripts/tests; unit ≥ current 530 + new contract/vault/background/differ suites; Chrome e2e green.
**Gate F — Production packages validated:** Chrome zip and Firefox zip ≤ 5 MB; build-twice sha256 identical; forbidden-file list empty (no `backups/`, logs, reports, maps, tests); source zip from `zip:source` on the release tag with `BUILD.md`; checksums file produced.
**Gate G — Store-policy readiness:** permission set = `storage, contextMenus, notifications, activeTab, scripting, alarms` (or smaller) + `http(s)://*/*` optional; written justification for each; `data_collection_permissions` present; disclosure visible in UI; no external links to torrent-cache/tracking sites; Debug tab gone.
**Gate H — Store assets/documentation complete:** §37 checklist every row "exists".
**Gate I — Final manual acceptance:** §36 executed on both browsers by someone other than the implementer; record stored in `.raiden/state/` or `docs/releases/`.

# 36. Manual Acceptance Matrix

| # | Scenario | Setup | Action | Expected | Browser | Evidence |
|---|---|---|---|---|---|---|
| 1 | Fresh Chrome install | new profile, load zip | open popup | vault setup prompt (not "not configured" wording); only "Display notifications" warning at install | Chrome | screenshot |
| 2 | Fresh Firefox install | new profile, install signed XPI or `web-ext run` | open popup | same; no host permission requested | Firefox | screenshot |
| 3 | First run / onboarding | after 1/2 | create master password | lands on Servers with disclosure text visible | both | screenshot |
| 4 | Add server + grant permission | qBittorrent on `192.168.x.x` (CSRF on) | fill form, Grant, Test, Save | per-origin prompt; Test = success with named client version | both | screenshot + network log |
| 4b | Each v1 client | Transmission, BiglyBT, Aria2 (+ Deluge/Flood/ruTorrent/µTorrent if shipped) | Test, add magnet, pause, resume, remove | all succeed; list reflects state within 2 s | both | log per client |
| 5 | Permission denied | dismiss prompt | Test/Save | disabled with explanation; no request sent | both | screenshot |
| 6 | Permission later granted | from 5 | Grant | Test enabled and succeeds | both | screenshot |
| 7 | Permission revoked | revoke in extension settings (Firefox panel / Chrome site access) | open popup | clear "access to host revoked — grant again" state, not generic failure | both | screenshot |
| 8 | Browser restart | configured | restart, open popup | unlock form in popup; unlock restores dashboard; context menu shows "Unlock CTRL" item before, full menu after | both | screenshots |
| 9 | Extension reload / SW restart | options open, Chrome `chrome://serviceworker-internals` stop | wait 5 s | list keeps updating (poller reconnects) | Chrome | screen recording |
| 10 | Multiple tabs/windows | two options windows | lock in one | other shows lock screen immediately | both | screenshot |
| 11 | Navigation / context menu | any page with magnet link | right-click → Add; → Add Paused; → Add to <server>; Scan Page | torrent added with correct options; notification (if enabled); scan caps/confirms | both | client UI screenshot |
| 12 | SPA navigation | n/a (no content scripts) | — | — | — | — |
| 13 | Offline | disable network | popup | status shows connection failed with retry guidance; no hang > timeout | both | screenshot |
| 14 | API failure | stop client | poll | error state; badge "!"; recovers when client returns | both | screenshot |
| 15 | Corrupted / legacy stored state | delete `vaultData` leaving `vaultSalt`; also legacy `local:options.servers` | unlock / open options | fail-closed recovery message; legacy migration prompt | both | screenshot |
| 16 | Extension update | install v0.2.0.1 then new build over it | open | settings and vault intact; legacy local key purged; menus rebuilt | both | storage inspection |
| 17 | Settings persistence | change context mode, badge, add-paused | restart | persisted and effective (menu changes, badge changes) | both | screenshots |
| 18 | Keyboard operation | no mouse | complete 3, 4, 11 via keyboard | all reachable; visible focus | both | recording |
| 19 | Privacy behaviour | network panel on popup/options open | — | zero third-party requests; only configured host | both | HAR |
| 20 | Uninstall / reinstall | uninstall | reinstall | fresh state; no leftovers | both | storage inspection |

# 37. Release Artifact Checklist

| Artifact | Status |
|---|---|
| Chrome ZIP | incomplete (buildable, 38 MB, wrong name) |
| Firefox ZIP/XPI | incomplete (no gecko block) |
| Firefox source package | incomplete (`zip:source` exists; tree dirty; WXT default leaks) |
| Reproducible build instructions (`BUILD.md`) | missing |
| Manifest verification (name/version/min versions/permissions) | incomplete |
| Version verification (package = tag = manifest) | missing (no tags/releases) |
| Changelog / release notes | exists (`extension/CHANGELOG.md` Unreleased) |
| Privacy policy (hosted URL) | incomplete (files exist, not hosted, inaccurate) |
| Permission explanations | missing |
| Reviewer notes / test credentials or Docker recipe | missing |
| Support contact | incomplete (GitHub only; SECURITY.md has no address) |
| Listing copy (name, summary, description, category) | missing |
| Icons | exists (16–128 PNG); SVG source unknown |
| Screenshots / promo tile | missing |
| Licenses / attributions | missing |
| Manual acceptance record | missing |
| Package checksums | missing |
| EU trader declaration | unknown |

# 38. Risk Register

| Risk | Probability | Impact | Release relevance | Mitigation | Residual |
|---|---|---|---|---|---|
| Live test shows cookie-based adapters still fail after `credentials:'include'` (SameSite/CORS in Firefox) | Medium | High | v1 client subset | test early (Wave 3); fall back to withdrawing those adapters | Low if subset strategy adopted |
| qBittorrent CSRF cannot be satisfied without DNR | Medium | High | flagship client | live test; documented server setting + actionable error; DNR as last resort with justification | Medium |
| Chrome reviewer classifies BitTorrent remote control as facilitating infringement | Low–Medium | High | listing | neutral copy, no site references, no Utilities links, privacy-first framing | Low–Medium |
| AMO reviewer rejects `required: ["none"]` given credential transmission to user server | Medium | Medium | Firefox listing | ask in reviewer notes; be ready to switch to `authenticationInfo` (new install prompt line) | Low |
| Reproducibility diff fails on reviewer machine (Node/npm minor differences, native `sharp`) | Medium | High | Firefox | pin Node 24.14 / npm 11.9 in `BUILD.md`; remove `sharp` from install path (`optionalDependencies` or separate script); test on Ubuntu 24.04 | Low |
| Firefox default CSP or LAN plain-HTTP behaves unexpectedly | Low–Medium | High | Firefox | CROSS-01 verification in Wave 9 | Low |
| Chrome LNA (≥ 142/144) blocks fetch to private IPs despite optional host grant | Low | High | Chrome | verify on current stable; document enterprise policy fallback | Low |
| Master-password UX causes abandonment / bad reviews | Medium | Medium | reviews | popup unlock; clearer copy; consider "remember until browser closes" is already the model | Medium |
| Identity bugs surface as wrong-torrent deletion in reviews | Medium (today) | High | reputation | FND-04 before launch | Low after Wave 6 |
| Single maintainer; RAIDEN/agent process artefacts in public repo confuse reviewers/contributors | Certain | Low–Medium | perception | move process dirs out of the public tree or document them | Low |
| Auto-localize workflow fires and corrupts locales | Medium (any en change) | Medium | quality | Wave 2 | None |
| Dev-dependency CVEs escalate | Low | Low | none (not shipped) | routine bumps | Low |
| Large old torrent-site code in git history / PR refs discovered by reviewers | Low | Medium | perception | it is history; keep the current product clean; do not ship `backups/` | Low |

# 39. Technical Debt Register

| Item | Classification | Why |
|---|---|---|
| Shared transport policy (FND-01) | must fix now | blocks functionality |
| Identity/generation protocol (FND-04) | must fix now | data-loss class bug |
| Packaging/fonts/reproducibility (FND-03) | must fix now | Firefox blocker, size |
| Dead settings/surfaces (FND-05) | must fix now (by deletion) | disclosure accuracy |
| `tsyringe`/`reflect-metadata`/legacy decorators | must fix now | linter noise, unused; small |
| Duplicate `ITorrentClient`, two retry helpers, three i18n helpers | first post-launch cycle | confusion, not behaviour |
| Unused qBittorrent services, `XmlRpcHelper`, `parseDOM`, `Toast`, `PlaceholderPage`, `PageHeader`, `Card`, `backup.ts` | first post-launch cycle (or delete now in Wave 7 if touching those areas) | maintenance |
| Background as one closure with module state | first post-launch cycle | testability; partially addressed by FND-04 |
| Two polling pipelines (popup vs port) | must fix now (Wave 6) | duplicate load |
| `console.log` volume in production | first post-launch cycle | noise; wrap in `__UI_DEBUG_MODE__` |
| Tailwind + Carbon + custom CSS + two icon libraries | later | works; consolidation is polish |
| Adapter size (Transmission/BiglyBT > 1k lines) | later | isolated, tested |
| `docs/reference` prompt archives, RAIDEN/Serena dirs in public repo | operator decision | perception only |
| Vite 8 / Babel 8 migrations | later | no value for release |
| Full i18n | later | needs stable strings |
| `SECURITY.md` supported versions/contact | must fix now (XS) | store support info |
| ESLint warnings (31) | first post-launch cycle | cosmetic |
| Public Chromium key in PR ref (OL-011) | likely never worth "fixing" beyond recording | value is public by design; ref is immutable |

# 40. Questions Requiring Operator Decision

### Decision 1 — v1 client support matrix
Option A: ship all nine after FND-01 and a full live matrix. Option B: ship the verified subset (qBittorrent, Transmission, BiglyBT, Aria2) and label the rest experimental/hidden. **Recommendation:** B, then promote adapters as each passes live tests. Changes if: a live matrix environment for all clients exists within the release window.

### Decision 2 — Firefox `data_collection_permissions`
Option A: `required: ["none"]` + reviewer note. Option B: `required: ["authenticationInfo"]`. **Recommendation:** A, with the note; switch to B on reviewer pushback. Changes if: Mozilla publishes guidance treating user-server transmission as collection.

### Decision 3 — Plain-HTTP servers
Option A: allow silently (status quo). Option B: allow with a one-time in-form warning and policy sentence. **Recommendation:** B. Changes if: reviewers demand HTTPS-only (unlikely for LAN tools).

### Decision 4 — Scan Page feature
Option A: keep (with `activeTab` + `scripting`, cap and confirmation). Option B: drop for v1 (fewer permissions, simpler disclosure). **Recommendation:** A. Changes if: Chrome review pushes back on `scripting`.

### Decision 5 — Language claim for v1
Option A: English-only listing, locale dirs removed. Option B: keep partial locales, list "English (partial translations)". **Recommendation:** A. Changes if: a translator commits to covering the ~150 keys before release.

### Decision 6 — Public repository hygiene
Option A: keep `.raiden/`, `.serena/`, `docs/reference/` tracked. Option B: move to a private process repo or untrack. **Recommendation:** B before submission (reviewers follow the homepage link). Changes if: the operator values public process transparency over reviewer clarity.

### Decision 7 — qBittorrent CSRF strategy (after live test)
Option A: documented server-side setting + actionable error. Option B: per-origin DNR `modifyHeaders`. **Recommendation:** A unless the live test shows an unacceptable share of setups need B.

# 41. Final Release Readiness Scorecard

| Category | Score | Rationale |
|---|---:|---|
| Product clarity | 3 | Single purpose is clear; Utilities links, Debug tab and dead settings blur it |
| Architecture | 3 | Portable, MV3-appropriate, but transport policy and identity protocol are foundational defects |
| Code correctness | 2 | Four adapters non-functional; flagship client fails off-localhost; identity bugs |
| Security | 3 | Sound boundaries and crypto; fail-open vault edge; uncommitted key fix; export leak |
| Privacy | 3 | Genuinely no telemetry; remote font URLs and inaccurate disclosures |
| Permissions | 3 | Minimal set; unused `ws/wss`; no justifications written |
| Chrome compatibility | 3 | Builds and runs; CI e2e green; LNA/CSRF unverified off-localhost |
| Firefox compatibility | 1 | Cannot be submitted; never automated; runtime unverified |
| Build reproducibility | 1 | Non-deterministic; tracked-file rewrite; 40 MB |
| Testing | 2 | 530 green unit tests that cannot catch the P0s; 6 e2e; no Firefox |
| Performance | 3 | No page impact; heavy popup CSS; duplicate polling |
| UX | 2 | Locked-vault confusion; dead controls; alert/confirm; unfinished copy |
| Accessibility | 2 | Carbon parts fine; primary form and toggles unlabeled; no reduced motion |
| Documentation | 2 | Plenty of documents, several materially wrong; no reviewer/build docs |
| Release engineering | 1 | No release workflow, packaging gates, checksums, or source pipeline in CI |
| Chrome policy readiness | 2 | Missing disclosure UI, justifications, assets; risky links |
| Mozilla policy readiness | 1 | Manifest, consent key, reproducible source all missing |
| Store asset readiness | 0 | No screenshots, tile, copy, hosted policy |
| Maintainability | 3 | Clear layout, good adapter tests; ~2k lines of dead surface |

**Overall release confidence: LOW.** Gating factors: FND-01 (functionality), FND-03 + FF-01 (Firefox submission impossible), disclosure accuracy, and absent store assets. None requires a rewrite; all are bounded.

# 42. Final Verdict

**1. What is CTRL today?** A well-structured MV3 WXT/React extension that remote-controls self-hosted torrent clients, with strong local-credential encryption and no telemetry, whose shared HTTP layer breaks four of nine advertised clients, whose background/UI protocol can mis-attribute data and commands, whose Firefox build cannot be submitted, and whose 40 MB package and documentation do not reflect the product.

**2. Is the existing foundation sound?** **PARTIALLY.** Layering, security boundaries, vault design, adapter isolation and the MV3 lifecycle model are sound. The transport policy, identity protocol, and packaging pipeline are foundational defects; none needs a rewrite.

**3. Chrome Web Store submission ready?** **NO.**

**4. Mozilla Add-ons submission ready?** **NO** (release pipeline close to FUNDAMENTAL WORK REQUIRED; code is not).

**5. Five most important things to fix (ranked):**
1. Transport profile per adapter and live verification of the client matrix (FND-01, ADP-05) — or withdraw unverified adapters.
2. Packaging: fonts/CSS/size, determinism, source archive, Firefox manifest block, linter (FND-03, FF-01).
3. Server identity and keyed viewport protocol (FND-04).
4. Truthful product surface and disclosures: remove dead settings, Debug tab, Utilities links; in-UI disclosure; rewrite privacy/README (FND-05, PRIV-02, PROD-01).
5. Popup unlock state and accessible server form (UX-01, A11Y-01).

**6. What should happen first?** Wave 1 + Wave 2 (commit the vault fix with fail-closed tests; disarm auto-localize; drop `ws/wss`), immediately followed by Wave 3 (transport profile) because every other functional decision depends on its live result.

**7. What should explicitly NOT happen yet?** Dependency major migrations (Vite 8 / Babel 8), implementing themes/layout/notification levels, DNR reintroduction before the live test, automated store publishing, i18n expansion, performance work.

**8. Safely deferrable until after launch (ranked):** Transmission sub-path (ADP-06), silent no-op capability map (ADP-11), Deluge/µTorrent dates (ADP-09), notification permission optionality (PERM-02), scan cap UX (SEC-06, document meanwhile), console-log cleanup, duplicate-module consolidation, full i18n, themes, file-based add, WebSocket push, dependency majors.

**9. Largest unknown?** Whether cookie-based adapters and qBittorrent (CSRF on, non-localhost) work in real Chrome and Firefox once transport is fixed. Resolved by a one-day live matrix with Docker qBittorrent/Deluge/Flood/ruTorrent/Transmission on a LAN host, exercised from both browsers, capturing HAR files.

**10. Minimum responsible path to public release:**
Phase 0 decisions (subset, consent value, English-only) → Waves 1–2 → Wave 3 + live matrix → Wave 5 (packaging + Firefox manifest + linter) → Wave 6 (identity protocol) → Wave 7 (surface reduction, popup unlock, export fix) → Wave 8 (accessible form) → Wave 9 (CI gates, Firefox smoke) → Wave 10 (docs/disclosures) → Wave 11 (assets, manual matrix) → manual Chrome submission and AMO submission with source archive, both from the same tag.
