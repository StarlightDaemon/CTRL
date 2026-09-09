# CTRL v1 Execution State

## Checkpoint

- timestamp: 2026-09-09 (Phase 8A product-surface reduction close-out)
- repository: `E:\Citadel\CTRL`
- branch: `main` (tracks `origin/main`; 10 local commits ahead, nothing pushed)
- ending HEAD: the commit that adds this checkpoint file, child of `9191c15` (see Local Commits)
- version: `0.2.0-beta.1` (unchanged; manifest `version` `0.2.0.1`; not eligible for 1.0.0 — gates not passed)
- working tree at checkpoint: only the pre-existing operator files under `.raiden/` and `.serena/` remain modified/untracked (11 modified or deleted, 2 untracked). No staged changes. Stash `stash@{0}` (obsolete buildInfo.ts stamp) untouched.

## Phase 8A — Product-Surface Reduction (this session) — COMPLETE, VERIFIED, COMMITTED

Starting HEAD `09e6677`. Reconciled `V1_SCOPE.md` against source before mutation; every deletion was preceded by a consumer search.

### Final public client candidate list

| Client | Selector | Status |
|---|---|---|
| Transmission | offered (default for new servers) | v1 candidate — **not live-verified** |
| qBittorrent | offered | v1 candidate — **not live-verified** |
| Aria2 / Motrix | offered | v1 candidate — **not live-verified** |
| BiglyBT, Deluge, Flood, ruTorrent, µTorrent, Vuze | hidden | experimental; adapter code retained |

Implementation: `ClientCapability.v1Status` (`'candidate' | 'experimental'`) in `shared/lib/types.ts`; `CLIENT_LIST` (all nine), `PUBLIC_CLIENT_LIST` (three), `DEFAULT_CLIENT_ID`, `getClientCapability()`, `isPublicClient()` in `shared/lib/constants.ts`. `ServerConfigPanel` renders `PUBLIC_CLIENT_LIST` in the type selector.

### Compatibility behaviour for existing hidden-client configurations

- They keep loading: `ClientFactory` still resolves all nine types (`clientCatalog.test.ts` instantiates every catalogued type, including Deluge).
- When editing such a server, its own type is appended to the selector as "<Client> (experimental, not verified)" so the form stays valid; it is not offered otherwise.
- The server list shows an "experimental, not verified" tag next to hidden-type servers.
- Nothing is silently destroyed; no migration rewrites a server's type.

### Settings / features removed

Persisted keys removed from `GlobalOptions` / `AppOptions`: `appearance.{theme,performance}`, `layout.sidebar`, `notificationLevel`, `notificationStyle`, `debugMode`, `matchRegExp`, `showDiagnostics`, `contextMenuCustomOptions`. Retained: `contextMenu` (0 hidden / 1 full / 2 simple), `addPaused`, `addAdvanced`, `enableNotifications`, `labels`, `currentServer`, `badgeInfo`, `servers`.

Compatibility: new `features/torrent-control/model/settingsSchema.ts` — `normalizeSettings()` (storage load: retained keys over defaults, obsolete keys dropped, malformed `globals` falls back to defaults, never throws), `normalizeContextMenuMode()` (legacy custom mode `3` → full `1`; numeric strings accepted; garbage → default), Zod `GlobalOptionsSchema` / `AppOptionsSchema` / `ServerConfigSchema` / `BackupSchema` (imports strip obsolete keys rather than rejecting the file), `mergeGlobals()`. `useSettings` uses these for load, settings-only export (`{ globals }`), and legacy/modern import. Safe-export allowlist (`exportSanitizer`) unchanged; `containsSecrets` now also stamped on system backups.

UI/surfaces deleted: `Utilities.tsx`, `resources.ts` (torrent-cache / IP-tracking / tool links), `DiagnosticsSettings.tsx`, `AppearanceSettings.tsx`, `ThemeSettings.tsx`, `LayoutSettings.tsx`, `PerformanceSettings.tsx`, `NotificationSettings.tsx` (replaced by a single on/off toggle in `FunctionSettings`), System self-test card + diagnostics toggle + developer-tools card (`SystemSettings` is now the backup/restore page only), `CommandPalette`, `DebugOverlay` (+ lazy mounts in both `main.tsx`), `Toast.tsx`, `PlaceholderPage.tsx`, `PageHeader.tsx`, `components/Card.tsx`, `components/Button.tsx` (only consumer was ThemeSettings), `shared/lib/network.ts` (`endpoint.isPrivateHost` used instead), `shared/lib/i18n/{useI18n,MessageKeys}.ts`, `hooks/useExtensionTranslation.ts`, `model/types/ITorrentClient.ts` shim. Options navigation is now Dashboard / Servers / Settings + System / About.

Context menu: "custom" mode and its three toggles removed from UI and `ContextMenuService` (`determineMenuItems(resolution, mode, globals)`); full / simple / hidden retained; per-server visibility retained; the settings preview now mirrors the real item set.

English-only: `_locales/{de,es,fi,fr,ru,zh_CN}` deleted (they covered 32–63 of 152 keys), `.github/workflows/auto-localize.yml`, `scripts/translator/`, `scripts/chrome-formatter.js`, the `extract-i18n` script and `@formatjs/cli` removed. `default_locale` stays `en`.

### Verification results (final tree, before commit)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src --ext .ts,.tsx` | 0 errors, 15 warnings (pre-existing unused symbols / `any`) |
| `npx vitest run` | 24 files, 647 tests passed (+3 files / +16 tests: `settingsSchema`, `clientCatalog`, `localePackaging`; ContextMenuService tests updated) |
| `wxt build -b chrome` / `-b firefox --mv3` | success; 1.59 MB unpacked, 14 files |
| Zips | Chrome 323 KB, Firefox 323 KB (previous wave 338 KB) |
| Manifests | permissions `storage, contextMenus, notifications, alarms`; optional hosts `http://*/*`, `https://*/*`; `default_locale: en`; gecko block intact — **no permission changes** (each permission still has a retained consumer: vault/settings, context menu, add-result notifications toggle, badge alarm) |
| Package scan | `_locales/en` only; 0 font files; 0 `s81c.com`; no `iknowwhatyoudownload` / `btcache` / `torrage` / `itorrents` / `openwebtorrent` / removed-feature strings; remaining URLs are GitHub project links (About) and library doc strings (w3.org namespaces, reactjs.org, wxt.dev, carbondesignsystem.com) |
| Determinism | two consecutive Firefox builds byte-identical |
| Build side effects | none (`git status` unchanged by build/zip) |
| `addons-linter` 10.11.0 | **0 errors**, 3 warnings (2× React `innerHTML`, 1× Android min-version key) — unchanged |
| `git diff` scope | 45 files, +373 / −3,644 in `extension/` plus the deleted workflow; no `.raiden`/`.serena` files touched |

## Release Gates

| Gate | Status | Note |
|---|---|---|
| A — Scope | **PASS (implemented)** | Public surface matches `V1_SCOPE.md` §3–§5: three candidate clients offered, six hidden but loadable, dead settings/surfaces removed, English-only, permissions as targeted. Residual: `V1_SCOPE.md` §4 still lists "rebuild form on Carbon inputs" and "vault reset" under CORE/OPTIONAL — those belong to Phase 8B |
| B — State integrity | NOT YET EVALUATED | unit-tested in `d16b7df`; no runtime/multi-window verification |
| C — Vault/security | NOT YET EVALUATED | unit-tested; migration from a real prior install untested |
| D — Supported clients | NOT YET EVALUATED | no client live-verified in either browser; the three visible clients are candidates only |
| E — Chrome | NOT YET EVALUATED | automation harness blocked (see Blockers) |
| F — Firefox | PASS (static) | unchanged from packaging wave; validator 0 errors |
| G — Build/package | PASS (static) | 1.59 MB / 323 KB; deterministic; no contamination |
| H — Automated verification | NOT YET EVALUATED | unit suite green; CI has no linter/size/diff gates; e2e specs not re-run (Playwright Chromium not installed locally) |
| I — UX/accessibility | PARTIAL | Addressed by 8A: no Debug tab/overlay, no dead settings, no placeholder cards, no external utility links, per-server context-menu toggles now carry an accessible name, notification toggle simplified. **Not addressed:** `ServerConfigPanel` (raw inputs without label association, undefined Tailwind tokens, `alert`/`confirm`, host/port form that strips paths), in-product credential disclosure, plain-HTTP warning, `SettingsToggle` accessible name, status announcements, contrast — all Phase 8B |
| J — Documentation/store dossier | NOT YET EVALUATED | Implications from 8A: README/BETA/privacy must drop "7 languages", the nine-client "Full" matrix, completion notifications, themes; store copy must name only the three candidate clients (and only as supported after Gate D); privacy policy must reflect that Utilities links are gone and no page scanning exists. `en/messages.json` still contains unused `navAppearance`/`navUtilities`/`utilities*` keys (harmless) |
| K — Final manual acceptance | NOT YET EVALUATED | |

## Remaining Blockers / Open Items (carried forward)

1. Operator confirmation of the permanent gecko add-on id `{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}` before first AMO signing.
2. `BUILD.md` for the AMO source archive; `zip:source` run from a clean tagged tree.
3. CI packaging gates (addons-linter, size cap, build-twice diff, contamination check).
4. Firefox and Chrome runtime verification; Chrome automation (`chrome-extension://` navigation blocked after `Extensions.loadUnpacked`); Firefox harness not established.
5. qBittorrent CSRF supported-path decision from a live browser test.
6. Live client environment lives only in a prior session scratchpad (scripts not preserved in repo).
7. `.raiden/state/` still reflects the pre-run state (operator-owned dirty files left untouched by instruction).

## Exact Next Execution Wave

**Phase 8B — Server configuration, truthful connection UX, and core accessibility.** Determined by Gate I residuals and `V1_SCOPE.md` §4:
- rebuild `features/torrent-control/ui/ServerConfigPanel.tsx` on Carbon `TextInput`/`PasswordInput`/`Select`/`Button`/`InlineNotification` with real label association and visible focus; single URL field round-tripped through `shared/lib/endpoint.parseEndpoint` (paths, IPv6, sub-paths preserved); client-type change applies that client's placeholder;
- in-product credential disclosure at the point of entry ("stored encrypted in this browser; sent only to the server you enter") and a plain-HTTP warning for non-private hosts;
- replace `window.confirm`/`alert` with Carbon modal/notifications; `role="status"` on test-connection and save results; truthful connection state text from `ConnectionState`;
- give `SettingsToggle` a real accessible name (`labelText`/`aria-labelledby`, stable ids);
- `permissions.onRemoved` handling so a revoked host grant is explained rather than shown as a generic failure;
- optionally the "reset vault" action in `SystemSettings` using `VaultService.reset()` (already implemented in the service);
- tests: endpoint round-trip through the form model, disclosure presence, e2e options spec updates.
Exit criteria: keyboard-only server setup possible; every input has an accessible name; no `alert`/`confirm`; URL with sub-path survives save/edit; tsc/lint/tests green; both builds and validator unchanged.

Do not start in 8B: live client verification, CI gates, `BUILD.md`, README/privacy rewrite, store assets, version bump.

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
| (this file) | docs(release): checkpoint product-surface reduction |

Repository rule observed: the RAIDEN `commit-msg` hook forbids `Co-Authored-By` trailers; commits carry the operator identity only.

## Do Not Repeat

- Audit reconciliation, vault remediation, dependency reconciliation, state-integrity/transport design, packaging wave, product-surface reduction: done (see commits).
- Chrome/Mozilla policy research: preserved in `docs/release/v1/research/`.
- Consumer analysis for the deleted surfaces: done; do not re-audit unless a regression is suspected.
- Confirming that branded Chrome ignores `--load-extension`: confirmed.
