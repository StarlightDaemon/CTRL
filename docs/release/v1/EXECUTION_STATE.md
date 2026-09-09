# CTRL v1 Execution State

## Checkpoint

- timestamp: 2026-09-09 (packaging wave close-out)
- repository: `E:\Citadel\CTRL`
- branch: `main` (tracks `origin/main`; 8 local commits ahead, nothing pushed)
- ending HEAD: the commit that adds this checkpoint file, child of `7377bc2` (see Local Commits)
- version: `0.2.0-beta.1` (unchanged; manifest `version` `0.2.0.1`; not eligible for 1.0.0 — gates not passed)
- working tree at checkpoint: only the pre-existing operator files under `.raiden/` and `.serena/` remain modified/untracked (11 modified or deleted, 2 untracked). No staged changes. Stash `stash@{0}` (buildInfo.ts stamp) untouched — it is now obsolete because `buildInfo.ts` no longer exists, but it was deliberately not dropped.

## Packaging Wave (this session) — COMPLETE, VERIFIED, COMMITTED

Starting HEAD `d13123f696fef9a01fc01235ae97ef3921eadd73`. The interrupted draft (`wxt.config.ts`, `style.css`, `global.css`) was verified first (`tsc` clean, 635 tests, Firefox build 2.61 MB) and then completed rather than discarded.

### Files materially changed

Commit `2621e86` (extension):
- `wxt.config.ts` — fixed name/short_name/description; `version_name` + `minimum_chrome_version: 120` (Chrome only); permissions `storage, contextMenus, notifications, alarms`; `optional_host_permissions` `http://*/*`, `https://*/*` (`ws`/`wss` removed); hardened CSP (`default-src 'self'; script-src 'self'; object-src 'none'; connect-src http: https:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none'`); Firefox-only `browser_specific_settings.gecko` `{ id: "{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}", strict_min_version: "140.0", data_collection_permissions: { required: ["authenticationInfo"] } }`; `zip.zipSources: false`; `__BUILD_TIMESTAMP__` define, Inspector plugin and the `build:manifestGenerated` hook removed.
- `src/entrypoints/popup/index.html` (`<title>CTRL</title>`) and `options/index.html` (`<title>CTRL Settings</title>`, `<meta name="manifest.open_in_tab" content="true">`) — WXT derives `action.default_title` and `options_ui.open_in_tab` from these, which the draft had missed.
- `src/app/styles/index.css` (new; was `src/entrypoints/style.css`) — single stylesheet importing `@carbon/styles/css/styles.css` + `global.css`, Carbon type tokens mapped to system fonts; moved out of `entrypoints/` because WXT built it a second time as an unlisted CSS entry (this was the duplicate 800 KB CSS).
- `src/app/styles/global.css` — Inter/JetBrains `@font-face` and shimmer/slide animations removed; `prefers-reduced-motion` rule added.
- `postcss.config.js` — `ctrl-strip-remote-font-faces` plugin removes every `@font-face` whose `src` is remote (105 `s81c.com` rules from Carbon).
- `src/entrypoints/{popup,options}/main.tsx` — import `@/app/styles/index.css` once (duplicate `global.css` import removed).
- `package.json` / `package-lock.json` — `@ibm/plex`, `vite-plugin-react-inspector`, `fs-extra`, `@types/fs-extra` removed; scripts: `build:*` no longer run `generate-build-info`, `backup` removed, `build-for-amo` added (`npm run zip:firefox`, per Mozilla's automated source rebuild convention).
- Deleted: `scripts/generate-build-info.ts`, `scripts/backup.ts`, `src/shared/lib/buildInfo.ts`, `src/shared/ui/VersionOverlay.tsx` (+ its use in `options/App.tsx`), `src/public/fonts/*`, `src/features/torrent-control/services/LifecycleAdapter.ts`, `src/shared/lib/websocket/WebSocketKeepalive.ts`, `tests/unit/LifecycleAdapter.parseDOM.test.ts` (reference analysis: no production consumer after the background rewrite; `StateHydrator` is still used and was kept). `src/vite-env.d.ts` drops `__BUILD_TIMESTAMP__`. `tests/e2e/popup.spec.ts` no longer asserts the removed overlay.

Commit `7377bc2` (docs): `docs/release/v1/V1_SCOPE.md` (reconciled: manifest name, dangling references to not-yet-written `CLIENT_VERIFICATION.md` / `RELEASE_GATES.md` / `STORE_POLICY_RECONCILIATION.md` marked as pending, explicit statement that no client is live-verified and hidden clients are not yet hidden), `docs/release/v1/research/{chrome-policy,mozilla-policy}.md` (verbatim 2026-09-09 first-party research, header notes which recommendations are superseded).

### Verification results (final tree, before commit)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src --ext .ts,.tsx` | 0 errors, 24 warnings (pre-existing unused symbols / `any`) |
| `npx vitest run` | 21 files, 631 tests passed (4 parseDOM tests removed with the dead module) |
| `wxt build -b chrome` | success, 1.6 MB, 20 files |
| `wxt build -b firefox --mv3` | success, 1.6 MB, 20 files |
| Firefox manifest inspected | `name`, `short_name`, `version 0.2.0.1`, permissions as above, `action.default_title: CTRL`, `options_ui.open_in_tab: true`, CSP as above, gecko block present, `background.scripts` |
| Chrome manifest inspected | same plus `version_name`, `minimum_chrome_version: 120`, `background.service_worker`; no gecko block |
| Remote font scan | `s81c.com` occurrences in built CSS: 0; `@font-face` rules: 0; no `.woff` files in package |
| Other remote strings in bundles | only library doc strings (w3.org SVG namespace, reactjs.org, wxt.dev, carbondesignsystem.com), GitHub links from About, and the Utilities external links in `resources.ts` (scheduled for deletion in the next wave) |
| Package contents (`ctrl-extension-0.2.0.1-firefox.zip`, 338 KB, 20 files) | manifest, 2 html, background.js, 3 chunks, 1 css, 5 icons, 7 locales — no maps, tests, backups, logs, reports or env material |
| Determinism | two consecutive Firefox builds: identical sha256 for every file |
| Tracked source mutated by build | none (`git status` unchanged after `wxt build`/`wxt zip`) |
| Mozilla validator | `addons-linter` 10.11.0 via `npx --yes` (no global install): **0 errors, 3 warnings, 0 notices** |

Validator warning classification:
- `UNSAFE_VAR_ASSIGNMENT` ×2 (`chunks/index-*.js` line 5) — React DOM's SVG `innerHTML` path; third-party, unmodified release build; not actioned.
- `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` — `data_collection_permissions` needs Firefox for Android 142+; CTRL does not target Android (`V1_SCOPE.md` §2); informational. Optionally silence later with `browser_specific_settings.gecko_android.strict_min_version: "142.0"`.
- First-party findings: none.

Mozilla requirements reverified 2026-09-09 from MDN `browser_specific_settings` and Extension Workshop built-in data consent + source-code-submission pages: gecko id mandatory for MV3 signing; `data_collection_permissions` mandatory for new AMO submissions since 2025-11-03; `authenticationInfo` = "passwords, usernames, …"; consent UI desktop 140+; reviewer environment Ubuntu 24.04.4 / Node 24.14.0 / npm 11.9.0, rebuild must show no differences; `build-for-amo` script convention from the 2026-07-23 Add-ons blog.

## Release Gates

| Gate | Status | Note |
|---|---|---|
| A — Scope | DRAFTED | `V1_SCOPE.md` committed; client hiding and UI reduction not implemented |
| B — State integrity | NOT YET EVALUATED | unit-tested in `d16b7df`; no runtime/multi-window verification |
| C — Vault/security | NOT YET EVALUATED | unit-tested; migration from a real prior install untested |
| D — Supported clients | NOT YET EVALUATED | no client live-verified in either browser |
| E — Chrome | NOT YET EVALUATED | Chrome build valid; automation harness blocked (see Blockers) |
| F — Firefox | **PASS (static)** | manifest complete (gecko id, min version, data declaration), addons-linter 0 errors, reproducible build, `build-for-amo` present. Residual: runtime smoke in Firefox not run; gecko id awaits operator confirmation; reviewer `BUILD.md` not yet written |
| G — Build/package | **PASS (static)** | 1.6 MB, no remote resources, no source mutation, deterministic, no contamination, WXT source zip disabled, `zip:source` remains the authoritative source archive. Residual: Carbon stylesheet still imported whole (800 KB); `zip:source` not run (requires clean tree at a tag); CI does not yet run packaging gates |
| H — Automated verification | NOT YET EVALUATED | unit suite green; CI workflow not updated (no linter/size/diff gates, e2e still references old flows) |
| I — UX/accessibility | NOT YET EVALUATED | product-surface reduction not started |
| J — Documentation/store dossier | NOT YET EVALUATED | README/privacy/CHANGELOG untouched; `BUILD.md`, reviewer notes, `STORE_POLICY_RECONCILIATION.md` pending |
| K — Final manual acceptance | NOT YET EVALUATED | |

## Remaining Packaging / Release Blockers

1. Gecko add-on id `{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}` was generated by the previous run; it becomes permanent at first AMO signing — operator must confirm or replace it before the first submission.
2. `BUILD.md` for the AMO source archive (OS, Node 24.14 / npm 11.9, `npm ci`, `npm run build-for-amo`) not yet written; `zip:source` pathspecs still list the deleted `scripts/backup.ts` directory implicitly via `extension/scripts` (fine) but should be re-run from a clean tagged tree.
3. Carbon CSS is still the full prebuilt stylesheet (800 KB); acceptable for v1, revisit post-launch.
4. CI (`.github/workflows/ci.yml`) does not yet run addons-linter, size cap, build-twice diff, or package-contamination checks; `auto-localize.yml` still exists (scheduled for removal in the product-surface wave with the locale decision).
5. Firefox runtime smoke (`web-ext run`) and Chrome runtime verification have not been executed for this build.

## Other Open Items Carried Forward (unchanged from previous checkpoint)

- Chrome automation: `chrome-extension://` navigation blocked after `Extensions.loadUnpacked`; permission-prompt acceptance under automation unresolved.
- Firefox automation approach not established (candidates: `web-ext run`, geckodriver).
- qBittorrent CSRF: server rejects an extension `Origin` with protection on; supported path must be decided from a live browser test.
- Disposable client environment and research live only in session scratchpads; research is now preserved under `docs/release/v1/research/`, client scripts are not.
- `.raiden/state/` not updated by this session (operator-owned dirty files were left untouched by instruction).
- `DiagnosticsSettings` still sends message types the background no longer handles (dead until deleted in the next wave).

## Exact Next Execution Wave

**Product-surface / truthful UX reduction (Phase 8)** — determined by the remaining gates: A (hide experimental clients), I, and the parts of J that depend on final UI. Scope, in `extension/src`:
- trim `shared/lib/types.ts` / `constants.ts` (drop appearance, layout, notificationLevel, notificationStyle, debugMode, matchRegExp, showDiagnostics, contextMenuCustomOptions; public client list = transmission / qbittorrent / aria2, others hidden but loadable);
- rebuild `ServerConfigPanel.tsx` on Carbon inputs with a single URL field via `parseEndpoint`, labelled controls, in-product credential disclosure and plain-HTTP warning, no `alert`/`confirm`;
- remove context-menu "custom" mode; replace `SystemSettings` with backup + vault reset; delete `Utilities.tsx`, `resources.ts`, `DiagnosticsSettings.tsx`, appearance/theme/layout/performance settings, `CommandPalette`, `DebugOverlay`, `Toast`, `PlaceholderPage`, `PageHeader`, `Card`, `shared/lib/network.ts`, unused i18n helpers, duplicate `ITorrentClient` shim;
- remove `.github/workflows/auto-localize.yml`, `scripts/translator`, non-English `_locales` (English-only v1 per `V1_SCOPE.md`);
- update `useSettings` schemas/import; update unit and e2e tests accordingly.
Exit criteria: every persisted setting has a runtime consumer; no external links outside GitHub; tsc/lint/tests green; both builds succeed; addons-linter 0 errors.

Do not start in this wave: live client verification harness, CI gate work, README/privacy rewrite, store assets.

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
| (this file) | docs(release): checkpoint packaging wave |

Repository rule observed: the RAIDEN `commit-msg` hook forbids `Co-Authored-By` trailers; commits carry the operator identity only.

## Do Not Repeat

- Audit reconciliation, vault remediation review, dependency reconciliation, state-integrity and transport design: done (see commits).
- Chrome/Mozilla policy research: preserved in `docs/release/v1/research/`; do not redo.
- Packaging wave items above: done and verified; do not re-derive the manifest, CSS, or build-metadata design.
- Confirming that branded Chrome ignores `--load-extension`: confirmed.
