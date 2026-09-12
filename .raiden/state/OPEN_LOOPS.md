# Open Loops

## OL-001

- Title: Phase 2 — Error Handling
- Status: Closed (2026-06-18)
- Why it matters: adapter connections can fail silently or mislead the user; truthful connection reporting and graceful degradation are P1 for the stabilization phase.
- Success condition: all adapters implement graceful degradation and retry logic; connection state is reported accurately to the user.
- Decisions (2026-06-18):
  - Test coverage: full parity across all nine adapters. ruTorrent and Synology receive the same depth as all others — AdapterError subclass instantiation, withRetry behavior under failure conditions, testConnection return contract, and adapter-specific error scenarios.
  - Commit strategy: per-adapter granularity. One lead commit covering AdapterError base class and shared withRetry infrastructure. One commit per adapter each containing implementation and tests. Ten commits total.
  - Architecture: Option A — enhanced local component state, no persistent error indicator.
  - Implementation gate (cleared): LifecycleAdapter.ts and BiglyBTSchema.ts error helpers read and summarized before any implementation code was written.
- Closed by: Phase 2 error handling shipped across all nine adapters — AdapterError subclasses, withAdapterRetry wiring (confined to the testConnection probe), the AdapterConnectionResult testConnection contract, and the BiglyBT PLUGIN_MISSING classifyError fix — in ten commits 2246e00, 990cd30, 8fe1003, de8357c, 5119dd9, f79bf03, d16d869, abb713f, a514274, b94f809 (full suite: 539 passed / 0 failed; VuzeAdapter inherits TransmissionAdapter coverage by extension).

## OL-002

- Title: Stale VPN reference docs
- Status: Closed (2026-06-14)
- Severity: Low
- Why it matters: two docs still reference the deleted `VPNIndicator.tsx` — not a runtime issue but misleading to future readers.
- Files:
  - `docs/reference/carbon_ui_scope_manifest.md`
  - `docs/reference/tron_to_ctrl_carbon_runbook.md`
- Success condition: both files updated to remove the stale `VPNIndicator.tsx` references.
- Closed by: `VPNIndicator.tsx` removed from Zone B list in both files; commit a663320.

## OL-003

- Title: CTRL legacy agent-ledger migration
- Status: Closed (2026-05-15)
- Why it matters: pre-RAIDEN `agent-ledger/` held durable closeout notes that needed mapping into `.raiden/state/`.
- Closed by: agent-ledger contents mapped into `.raiden/state/` (DECISIONS.md, WORK_LOG.md); artifact-policy file discarded (RAIDEN structure makes it redundant); `agent-ledger/` directory removed; LEGACY_REVIEW.md closed.

## OL-004

- Title: Zero-touch localization pipeline — structural fix, AI translation deferred
- Status: Closed (2026-07-03)
- Why it matters: the pipeline's trigger path, `LOCALES_DIR`, and target-locale list were pointed at the wrong directory and an outdated/incorrect locale set, and the workflow carried an unneeded dependency-install step; the pipeline could not have run correctly as committed.
- Success condition: `extension/package.json`, `extension/scripts/translator/index.js`, and `.github/workflows/auto-localize.yml` all resolve to `extension/src/public/_locales`, target exactly `de, es, fi, fr, ru, zh_CN`, and the workflow runs with no install step and no external API dependency.
- Decisions (2026-07-03):
  - Real AI-backed translation was evaluated and deliberately deferred. OpenAI was rejected because it requires a separate billing relationship outside the current subscription; a direct Anthropic API integration has the identical problem.
  - Routing through Anthropic's own Claude Code GitHub Action using a subscription-tied OAuth token was identified as the one path that would stay inside the existing subscription, but its reliability for this specific unattended CI use case is unproven and was not pursued.
  - The pipeline currently writes a visible bracketed placeholder (`[locale] <English text>`) for any new untranslated key rather than a real translation, by design, until this is revisited.
- Closed by: `extract-i18n` --out-file corrected to `src/public/_locales/en/messages.json`; `LOCALES_DIR` corrected to `extension/src/public/_locales`; `TARGET_LOCALES` set to `['de', 'es', 'fi', 'fr', 'ru', 'zh_CN']`; zombie-key removal and new-key detection left intact; new-key branch restored to the original placeholder behavior (no OpenAI/Anthropic calls); workflow trigger path, dependency-install step removal, and direct-commit-via-`stefanzweifel/git-auto-commit-action` (pinned `b863ae1933cb653a53c021fe36dbb774e1fb9403`) all corrected to match.
- Correction (2026-07-26): the end-state recorded in the third 2026-07-03 decision above — "the pipeline currently writes a visible bracketed placeholder" — is no longer an accurate description of the repository. Per the 2026-07-26 audit (F5, F27):
  - Zero `[locale]` bracketed placeholders exist in any locale file. `grep -c '\[de\]'`, `'\[fr\]'`, and `'\[zh_CN\]'` against their respective `messages.json` files all return 0.
  - The six non-English locales instead carry real human-language translations, but at roughly 21% coverage: `en` has 152 message entries against `fi` 63, `ru` 61, and `de`/`es`/`fr`/`zh_CN` 32 each.
  - The visibility mechanism this loop closed on is therefore not in effect. A key present in English and absent from a target locale falls back silently to the English default via `browser.i18n.getMessage()` rather than rendering a `[locale] <English text>` marker, so missing coverage is invisible in the UI.
  - Provenance of the real translations is unexplained and unresolved. The in-repo pipeline writes only bracketed placeholders, and `gh run list --workflow=auto-localize.yml` returns empty — the workflow has never executed once — so the translations cannot have come from it. No governance record states where they did come from. This provenance question is not covered by the closure above and remains open.
  - The pipeline's live-risk aspect (armed in CI, never run, would inject 89–120 placeholders per locale on next trigger) is tracked separately as OL-015.
- Superseded (2026-09-10): `9191c15` removed `.github/workflows/auto-localize.yml`, `extension/scripts/translator/index.js`, the `extract-i18n` script and all six non-English locales as part of the English-only v1 scope (`docs/release/v1/V1_SCOPE.md`). The pipeline this loop describes no longer exists in the tree; the translation-provenance question above was never answered and no longer bears on the shipped tree. Status unchanged.

## OL-005

- Title: Babel 8 migration deferred during dependency-currency pass
- Status: Open
- Gate: upstream
- Why it matters: during the F4 dependency-currency pass, `@babel/plugin-proposal-decorators` was found six major-ish versions behind. Bumping it straight to `8.0.2` (the current latest) broke `npm install` — that release requires `@babel/core@^8.0.0` as a peer, which is a major migration of the whole Babel toolchain underneath tsyringe's legacy decorator configuration, not a routine bump.
- Held at: `7.29.7` — the newest release still within the `7.x` line (above the prior `7.28.0` pin, below the `8.0.2` major) — so the package stays current without forcing the toolchain migration.
- Success condition (future): migrate to Babel 8, including verifying whether legacy-mode decorators (as used by tsyringe) are still supported by the new decorators plugin under `@babel/core@8`, then bump `@babel/plugin-proposal-decorators` to the 8.x line as its own distinct change.
- Decisions (2026-07-04): treated as a distinct future decision, not part of this dependency-currency pass. No workaround (`--force`/`--legacy-peer-deps`) applied; the version was held back deliberately instead.
- Re-verified (2026-07-26): the 2026-07-26 audit re-derived this hold against installed and live upstream state and found it fully accurate — no correction needed. `extension/package.json` pins `@babel/plugin-proposal-decorators` at exactly `7.29.7`; installed `@babel/core` is `7.29.7`; `npm view @babel/plugin-proposal-decorators@8.0.2 peerDependencies` returns `{'@babel/core': '^8.0.0'}`. `wxt.config.ts` still applies the plugin in `{ legacy: true }` mode for tsyringe, so the open migration question above remains genuinely open. The declared blocker is real and unchanged.
- Update (2026-09-10): the premise above no longer holds at the v1 publication candidate. `d16b7df` removed `@babel/plugin-proposal-decorators`, `tsyringe` and `reflect-metadata` from `extension/package.json` and the legacy-decorators Babel block from `wxt.config.ts`; nothing in `extension/src` references `tsyringe`. The held package is no longer a dependency, so the success condition as written cannot be met literally. Status left Open pending an explicit decision to close it as superseded; no status transition is inferred here.

## OL-006

- Title: `@vitejs/plugin-react` held back — bump requires an in-repo vite 7 → 8 migration
- Status: Open
- Gate: local
- Why it matters: during the F4 dependency-currency pass, `@vitejs/plugin-react` was found several major versions behind (current latest `6.0.4`). Bumping it breaks `npm install` — that release requires `vite@^8.0.0` as a peer, and it additionally introduces `@rolldown/plugin-babel` and `babel-plugin-react-compiler@^1.0.0` as new peers. The installed vite is `7.3.5`, so taking the bump means performing a vite 7 → 8 major migration in this repository and re-validating the WXT build against it — not a routine version bump.
- Held at: `5.2.0` — its peer range is `vite: ^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`, which the installed vite `7.3.5` satisfies, so the pin holds without forcing the vite 8 migration.
- Success condition (future): migrate this repository from vite 7 to vite 8 and confirm the WXT build plus the unit and e2e suites pass under it, then bump `@vitejs/plugin-react` to the 6.x line together with its new `@rolldown/plugin-babel` and `babel-plugin-react-compiler` peers as one coordinated change.
- Decisions (2026-07-04): treated as a blocked-upstream dependency, not a direct version constraint. The hold-back is deliberate pending WXT ecosystem updates, not a workaround.
- Correction (2026-07-26): the justification recorded on 2026-07-04 was factually inaccurate. The 2026-07-26 audit (F4) checked three of its premises against installed and live upstream state; all three failed:
  - "the currently installed vite (4.x)" — the installed vite is `7.3.5`, three majors off the recorded value.
  - "conflicts with `@wxt-dev/module-react@1.1.5`'s peer range (`^4.4.1 || ^5.0.0`)" — the installed `1.1.5` declares peers `{wxt: '>=0.19.16'}` and no vite peer at all. The named conflict did not exist.
  - "the WXT ecosystem has not yet moved to support vite 8" — `npm view @wxt-dev/module-react@1.2.2 peerDependencies` returns `{vite: '^5.4.19 || ^6.3.4 || ^7.0.0 || ^8.0.0-0', wxt: '>=0.19.16'}`, and the installed `wxt@0.20.27`'s own vite dependency range is already `^5.4.19 || ^6.3.4 || ^7.0.0 || ^8.0.0-0`. WXT supports vite 8.
  - Only the fourth premise held: `npm view @vitejs/plugin-react@6.0.4 peerDependencies` confirms `vite: ^8.0.0`.
  - Effect: the hold itself remains correct and stays Open, but for a different reason than recorded. The blocker is the in-repo vite 7 → 8 migration, not an upstream gap — the upstream gate this loop was waiting on has already been satisfied. Title, Why it matters, Held at, Success condition, and Gate (`upstream` → `local`) corrected accordingly; the original 2026-07-04 decision line is retained above as the historical record of what was decided at the time. See DECISIONS.md D-006.

## OL-007

- Title: AppleDouble ghost files break the local unit-test invocation
- Status: Closed (2026-07-26)
- Severity: High
- Why it matters: 3,153 `._*` AppleDouble sidecar files copied into the working tree were matched by Vitest's test glob, so ghost twins of 15 real test files were parsed as source and failed on binary AppleDouble header bytes. `npm run test` exited 1 even though all 512 real tests passed. Raised as F2 by the 2026-07-15 audit but never tracked as a loop.
- Success condition: `npm run test` exits 0 with no phantom test files.
- Closed by: confirmed resolved by the 2026-07-26 audit, by execution rather than inspection. `timeout 600 npm test` was run under that audit's sanctioned execution gate and returned **512 passed / 512, 15 test files, exit 0** in 9.96s. The root cause was independently confirmed gone: `find` for `._*` and for `.DS_Store` across the entire working tree both return 0 files (previously 3,153 and 4). Cross-ref: 2026-07-15 audit F2; 2026-07-26 audit §13.4. Root-cause fix tracked as OL-008.

## OL-008

- Title: Root `.gitignore` carried no `._*` pattern
- Status: Closed (2026-07-26)
- Severity: Medium
- Why it matters: the committed root `.gitignore` listed `.DS_Store` but no `._*` pattern anywhere. This was the root cause of OL-007 and of roughly 683 untracked-noise files surfacing in tracked source paths on every `git status` call.
- Files:
  - `.gitignore`
- Success condition: `._*` present in the committed root `.gitignore`, not merely as a pending working-tree edit.
- Closed by: confirmed resolved by the 2026-07-26 audit — `._*` is present at root `.gitignore` line 52 and landed in commit `f088c5f` (`chore: ignore AppleDouble and .DS_Store files`), i.e. it is committed state rather than an uncommitted edit. One residual noted but not blocking: `.DS_Store` is now listed twice (lines 34 and 53), a harmless redundancy that survived the fix (2026-07-26 audit F17). Cross-ref: 2026-07-15 audit F3.

## OL-009

- Title: `git fetch` failed with host key verification error
- Status: Closed (2026-07-26)
- Severity: Low
- Why it matters: `git fetch --all --prune` failed with `Host key verification failed` — an SSH host-key trust gap on the workstation rather than a repository defect. The consequence was that any ahead/behind reading against `origin` reflected the last successful fetch rather than a freshly confirmed one, so branch sync state could not be trusted.
- Success condition: `git fetch --all --prune` completes successfully and branch sync state can be confirmed against a fresh fetch.
- Closed by: confirmed resolved by the 2026-07-26 audit — `git fetch --all --prune` ran to exit 0, and `main` was then confirmed in sync with `origin/main` against that fresh fetch rather than a stale one. Environmental resolution, not a repository change. Cross-ref: 2026-07-15 audit F16.

## OL-010

- Title: Live CI run status could not be verified
- Status: Closed (2026-07-26)
- Severity: Low
- Why it matters: the `gh` CLI was not installed on the workstation, so CI pipeline *definitions* could be reviewed but live Actions run status could not be queried at all. A green local tree masking a failing remote pipeline would have gone unnoticed.
- Success condition: live run status for `main` can be queried and confirmed against the declared "CI: passing" state.
- Closed by: confirmed resolved by the 2026-07-26 audit — `gh` is installed and authenticated. `gh run list --limit 10` returned 10 of 10 runs completed successfully, and the most recent CI run on `main` (`29472393892`, for commit `f088c5f`) succeeded in 4m09s. The "CI: passing on `main`" line in CURRENT_STATE.md is now independently verified rather than asserted. Cross-ref: 2026-07-15 audit F13.

## OL-011

- Title: Verify provider-side revocation of the exposed Google/Chromium API key
- Status: Open
- Gate: external
- Severity: Critical
- Why it matters: 2026-07-26 audit F1. The committed key remains reachable in current git state, and the blast radius previously on record was wrong. It is not confined to this machine:
  - `git ls-remote origin` resolves `refs/pull/3/head` to `15ffee9534d732e44727ad370458217340798122` — the identical commit object as the local `pre-dependabot-delete-backup` tag — and `gh repo view` reports the repository visibility is PUBLIC. Any unauthenticated party can fetch that ref and recover the value.
  - `git ls-remote --tags origin` returns no tags, so the prior record that the tag was never pushed is literally true but does not mean the secret is absent from the remote.
  - GitHub retains `refs/pull/<n>/head` permanently and immutably. Deleting the local tag remediates nothing, and no client-side git operation can remove the remote copy.
  - `git grep -l 'AIzaSy' pre-dependabot-delete-backup` returns 16 blobs under `extension/tests/e2e/.persistent-data/Default/Cache/Cache_Data/`; `main` and every branch remain clean.
  - The tracked and publicly readable `.raiden/state/CURRENT_STATE.md` itself records the key fragment, its exact in-tree path, the commit, and the residual PR ref — a complete public map to the artifact.
- Why this loop is scoped to verification: no repository-bound audit can confirm provider-side revocation; that is outside the repository boundary by definition. DECISIONS.md D-003 declares the key revoked in the Google Cloud Console on 2026-06-14. That is a declared date, not a verified one, and this loop exists to confirm it against the provider.
- Files:
  - `refs/pull/3/head` (remote, public, immutable — not removable client-side)
  - `refs/tags/pre-dependabot-delete-backup` → `15ffee9` (local)
  - `extension/tests/e2e/.persistent-data/Default/Cache/Cache_Data/` (16 blobs within that commit's tree)
- Success condition: revocation confirmed directly against the Google Cloud Console — or the key's absence from the project's credential list recorded — with the confirmation date and method written back into this entry. Separately, a decision recorded on whether to pursue a GitHub Support purge of the PR-3 ref.
- Mitigating context (recorded by the audit, not adjudicated by it): the flagged value is documented as the public Chromium omnibox suggest key (`client=chrome-omni&sugkey=`), a value embedded in every Chromium build and public by design, so realistic harm may be nil. The audit reports presence and reachability only and takes no position on provider-side status. See DECISIONS.md D-005.

## OL-012

- Title: Firefox vault-key fallback writes the AES key to `chrome.storage.local` in plaintext
- Status: Closed (2026-09-10)
- Severity: High
- Why it matters: 2026-07-26 audit F2. `KeyManager.setSessionKey()` exports the derived AES-GCM vault key to JWK and, on Firefox only, additionally writes it to `local:session_encryptionKey` in `chrome.storage.local` — which is plaintext on disk and unencrypted at rest on every platform. Anyone with read access to the extension's profile directory can recover the key and decrypt every stored torrent-client credential without knowing the master password, bypassing the PBKDF2-300k work factor entirely. `SecurityService.deriveKey` is called with `extractable = true` specifically to enable this export. The fallback is a deliberate workaround for Firefox MV3 session storage not surviving background-script restarts, and `background.ts:25-33` clears the key on `chrome.runtime.onStartup`, which bounds exposure to between browser sessions but not during them — and not against offline disk access if a crash prevented the clear.
- Files:
  - `extension/src/shared/api/security/KeyManager.ts` (write path lines 33-36, read path lines 50-53)
  - `extension/src/shared/api/security/SecurityService.ts` (`extractable = true`)
  - `extension/src/entrypoints/background.ts` (startup clear, lines 25-33)
- Success condition: the vault key is no longer persisted in plaintext at rest on any target, or the residual risk is explicitly accepted and recorded here with its rationale and the compensating controls relied upon.
- Note on coverage: the same audit found this path has no direct test coverage at all (F12) — no test file imports `KeyManager`, `VaultService`, or `SecurityService` as a subject, so a regression here would not fail CI.
- Closed by: `50e54c4` (`fix(security): keep the vault session key out of disk-backed storage (OL-012)`), verified against the first branch of the success condition — the key is no longer persisted at rest on any target:
  - `KeyManager` reads and writes the session key through `storage.session` (in-memory, browser-session scoped) only, on every browser; the Firefox `storage.local` fallback write and read paths are gone. A search of `extension/src` for `session_encryptionKey` / `local:session` finds only the legacy-key constant retained for scrubbing.
  - `KeyManager.purgeLegacyFallbackKey()` runs on every background wake — not only `onStartup`, which does not fire on extension update — so a key left on disk by an older build is removed.
  - `extension/tests/unit/KeyManager.test.ts` (real WebCrypto, `@webext-core/fake-browser` storage areas) asserts on Chrome-like and Firefox-like user agents that the raw key material never reaches `local`, `sync` or `managed` storage, including across repeated unlocks, and that a legacy plaintext key is ignored and purged. It gives `KeyManager` the direct coverage F12 found missing, and passed in the 2026-09-10 publication-candidate validation.
  - Residual context, not a reopening: `SecurityService.deriveKey` still derives with `extractable = true`, now used only to export the key into in-memory `storage.session`; Firefox lock-on-browser-restart was not exercised live (`docs/release/v1/CLIENT_VERIFICATION.md` caveat B).

## OL-013

- Title: CSRF-bypass headers (Origin, Referer, Cookie) are silently dropped by the Fetch API
- Status: Closed (2026-09-10)
- Severity: High
- Why it matters: 2026-07-26 audit F25. `Origin`, `Referer`, and `Cookie` are forbidden header names under the Fetch Standard — when a `Headers` object is used to construct a `Request`, the request guard filters them out silently, with no exception and no warning. The extension sets all three and relies on them reaching the torrent client:
  - `extension/src/shared/api/network/FetchHttpClient.ts:32-33` and `:106-107` set `Origin` and `Referer` for every adapter that routes through the shared client.
  - `extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts:327-330` sets them again directly, under the comment "Inject CSRF bypass headers - critical for browser extensions".
  - `extension/src/shared/api/clients/utorrent/UTorrentAdapter.ts:394` and the uTorrent RSS/Settings services set `Cookie` for the GUID session; `FetchHttpClient` also passes `credentials: 'omit'`, so the browser will not supply that cookie either.
  - The mechanism that handled this correctly — Declarative Net Request dynamic rules — was removed during the 2026-07-02 hardening pass along with the `declarativeNetRequest` permission. `shared/api/network/HeaderRewriter.ts` survives as a set of logging no-ops whose own comments state that DNR was "the standard, safe way to handle this in MV3". There is currently no working mechanism for these headers.
  - Expected impact if confirmed: qBittorrent enforces Origin/Referer CSRF validation by default and the browser supplies `Origin: chrome-extension://<id>` on these cross-origin requests, which is precisely the mismatch the code was written to prevent. Transmission is unaffected because `X-Transmission-Session-Id` is not a forbidden header name.
- Verification status — NOT CONFIRMED IN EITHER DIRECTION: this finding is spec-derived and corroborated from four independent places (the source, the removed DNR mechanism, the unit test, and the localhost-only testing history), but it was **not runtime-verified**. Observing the actual wire requires launching a browser against a live torrent client, which the audit's sanctioned execution gate did not permit. It must not be treated as a confirmed defect, nor dismissed, until a live-browser test is run. Two facts bear on why it could have gone unnoticed for this long:
  - `extension/tests/unit/adapters/QBittorrentAdapter.test.ts:126-142` ("should inject CSRF headers (Origin and Referer)") asserts on the standalone `Headers` object, whose guard is `"none"` and where `set()` genuinely succeeds. The filtering happens later, at `Request` construction inside `fetch()`, which the test never reaches — so the test passes regardless of what is actually transmitted.
  - qBittorrent relaxes CSRF and host-header checks for localhost by default, and prior connection testing was performed against `localhost:8080` / `localhost:9091`. The failure would not appear in the environment the project tested in, while affecting LAN and remote hosts.
- Files:
  - `extension/src/shared/api/network/FetchHttpClient.ts`
  - `extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts`
  - `extension/src/shared/api/clients/utorrent/UTorrentAdapter.ts`, `UTorrentRssService.ts`, `UTorrentSettingsService.ts`
  - `extension/src/shared/api/network/HeaderRewriter.ts` (dead, no-op)
- Success condition: a live-browser test against a non-localhost qBittorrent instance establishes whether these headers reach the server. Treat the finding as confirmed or refuted only on that result, and decide remediation from there.
- Closed by: the live-browser test this loop required was run in the v1 release program, and it **confirmed** the finding. `docs/release/v1/CLIENT_VERIFICATION.md` §Defects #2: against qBittorrent 5.2.3 at the non-loopback LAN address `192.168.1.235`, with default CSRF protection on, every request from both Chrome 152 and Firefox 155 was rejected ("Origin header & Target origin mismatch") because the browser stamps the extension origin and `Origin`/`Referer` are forbidden request headers. Remediation was decided and implemented in `a8f489a`: a `declarativeNetRequestWithHostAccess` session rule per configured qBittorrent origin sets `Origin`/`Referer` to that origin (`HeaderRewriter.ts`, no longer a no-op), installed by the controller before a client is created or tested; asking users to disable CSRF protection was rejected. After the fix qBittorrent passed 16/16 live scenarios in both browsers with CSRF protection on (`docs/release/v1/evidence/live-qbittorrent-{chrome,firefox}.md`). Not covered by this closure: the µTorrent `Cookie` path, which was not live-tested; µTorrent is hidden/experimental in v1.

## OL-014

- Title: Export sanitizer denylist misses `clientOptions.simpleApiKey`, leaking the BiglyBT API key
- Status: Closed (2026-09-10)
- Severity: High
- Why it matters: 2026-07-26 audit F26. Both sanitizing export paths in `useSettings.ts` clear exactly two fields — `password` and `httpAuth.password` — while spreading the rest of the `ServerConfig` through verbatim. `ServerConfig.clientOptions` is typed `Record<string, unknown>` and demonstrably holds a real credential: `BiglyBTSchema.ts` `parseSimpleApiConfig()` reads `clientOptions.simpleApiKey`, documented in-source as the API key the user copies from BiglyBT's own Simple API plugin settings. The `...s` spread copies it into the export untouched. A user who has configured BiglyBT's Simple API and then exports a "safe" server config — for backup, for sharing, or to attach to a bug report — ships a live credential in cleartext inside a file named `ctrl-servers-safe-<timestamp>.json`, whose name asserts the opposite. The structural problem outlasts this one key: a denylist applied over an open `Record<string, unknown>` cannot be correct, so any future secret placed in `clientOptions` leaks identically.
- Files:
  - `extension/src/features/torrent-control/model/useSettings.ts` (lines 192-196 for `exportSystemBackup`, lines 222-228 for `exportServerConfig`)
  - `extension/src/shared/api/clients/biglybt/BiglyBTSchema.ts` (lines 350-364, `parseSimpleApiConfig`)
  - `extension/src/entities/server/model/types.ts` (`ServerConfig.clientOptions`)
- Success condition: an export marked sanitized provably contains no credential from any field of `ServerConfig`, including `clientOptions`, verified against a config that has every credential-bearing field populated.
- Related: the same key is also placed in the query string of every Simple API request (`?apikey=…`), so it reaches the BiglyBT server's access logs — 2026-07-26 audit F33.
- Closed by: `d13123f` replaced the denylist with an allowlist (`extension/src/features/torrent-control/model/exportSanitizer.ts`), which also removes the structural problem above. A safe export copies only named non-secret `ServerConfig` fields, strips userinfo from `hostname`, keeps `httpAuth.username` only, and keeps only primitive `clientOptions` values whose keys the client's `CLIENT_LIST` definition declares as user-visible settings (none of the declared keys is a credential). Everything else is dropped, including `clientOptions.simpleApiKey` and any future unknown key. Both sanitizing paths in `useSettings.ts` (`exportSystemBackup` and `exportServerConfig` with `sanitize`) route through it. `extension/tests/unit/exportSanitizer.test.ts` populates every credential-bearing field (`password`, `httpAuth.password`, URL userinfo in `hostname`, and in `clientOptions` the BiglyBT `simpleApiKey`, a token, a nested secret and an unknown future key) and asserts that none appears in the serialized export; it passed in the 2026-09-10 publication-candidate validation. Runtime corroboration: `safe-export-has-no-secrets` passed in both browsers (`docs/release/v1/evidence/state-vault-{chrome,firefox}.md`; password fields only). Not covered by this closure: F33 (the Simple API key in the request query string reaches BiglyBT access logs) is unaddressed; BiglyBT is hidden/experimental in v1.

## OL-015

- Title: Locale-injection script is armed in CI with `contents: write` and has never executed
- Status: Closed (2026-09-10)
- Severity: Medium
- Why it matters: 2026-07-26 audit F27. `.github/workflows/auto-localize.yml` runs `node extension/scripts/translator/index.js` with `permissions: contents: write` and auto-commits the result directly to `main` via `stefanzweifel/git-auto-commit-action` (SHA-pinned `b863ae1933cb653a53c021fe36dbb774e1fb9403`). Three facts combine into a live risk:
  - `gh run list --workflow=auto-localize.yml` returns empty — the workflow has never executed once, so its real behaviour has never been observed.
  - It fires on any push to `main` that touches `extension/src/public/_locales/en/messages.json`, and the script writes `[locale] <English text>` for every key present in English and missing from a target locale (`scripts/translator/index.js:53-57`).
  - Current key counts are `en` 152 against `fi` 63, `ru` 61, and `de`/`es`/`fr`/`zh_CN` 32 each. The next trigger would inject roughly 89 to 120 bracketed placeholder strings per locale across all six files and push them to `main` unattended and unreviewed — over the real translations currently in the tree (see OL-004).
  - Compounding: this script is covered by neither the typecheck nor the lint gate (OL-016), so it is the one piece of repository code that runs in CI with write access and is checked by nothing.
- Files:
  - `.github/workflows/auto-localize.yml`
  - `extension/scripts/translator/index.js`
  - `extension/src/public/_locales/*/messages.json`
- Success condition: a decision recorded on whether this pipeline should be able to fire at all in its current form, and either the workflow disarmed or gated, or its placeholder behaviour reconciled with the real translations now present in the tree.
- Closed by: `9191c15` (`refactor(product): reduce CTRL to the v1 public surface`) removed `.github/workflows/auto-localize.yml`, `extension/scripts/translator/index.js`, the `extract-i18n` script and all six non-English locales. The decision is recorded in `docs/release/v1/V1_SCOPE.md`: the multi-language claim is DELETE (v1), with an English-only listing, the partial locales removed, the `auto-localize` workflow removed, and proper localisation deferred to after launch. The pipeline is disarmed by removal. At the v1 publication candidate `.github/workflows/` contains only `ci.yml`, which declares no `permissions:` block and has no commit or push step, and the CI `package` job asserts that each package ships the `en` locale only. Any future localisation pipeline is a new decision, not a reopening of this one.

## OL-016

- Title: Typecheck and lint are scoped to `src/` only — `scripts/` and `tests/` are covered by neither gate
- Status: Open
- Severity: Medium
- Why it matters: 2026-07-26 audit F28. `extension/tsconfig.json` sets `"include": ["src/**/*", ".wxt/types/**/*"]`, so `npm run compile` (`tsc --noEmit`, the CI test job's typecheck step) never typechecks `tests/`, `scripts/`, `wxt.config.ts`, `vitest.config.ts`, or `playwright.config.ts`. `extension/package.json` sets `"lint": "eslint src --ext .ts,.tsx"`, so the CI lint job never lints `tests/` or `scripts/` either. The sharp edge is that `extension/scripts/translator/index.js` runs in CI with `contents: write` and pushes commits to `main` (OL-015), and it is the one piece of repository code subject to neither gate. `tsconfig.json` additionally excludes a `"legacy"` directory that does not exist in the tree. Strictness for the code that *is* covered is not in question — all seven `strict*` flags are enabled and only `react/react-in-jsx-scope` is disabled repo-wide, which is correct for the modern JSX transform.
- Files:
  - `extension/tsconfig.json`
  - `extension/package.json`
- Success condition: CI-executed code and test code are covered by typecheck, by lint, or by an explicit recorded decision that they are intentionally excluded and why.
- Update (2026-09-10): `9191c15` removed `extension/scripts/translator/index.js` and the `auto-localize` workflow, so the sharp edge above (an unchecked script running in CI with write access) no longer exists (OL-015 closed). The scope gap itself is unchanged at the v1 publication candidate: `extension/tsconfig.json` `include` is still `src/**/*` and `.wxt/types/**/*`, `lint` is still `eslint src --ext .ts,.tsx`, and CI still executes `tests/` through `npm test`. Status remains Open.

## OL-017

- Title: Development/build dependency advisory backlog after the v1 publication merge
- Status: Open
- Gate: local (awaiting PR CI and Dependabot reanalysis)
- Severity: Medium
- Why it matters: merging PR #5 made the v1 lineage the default branch, and Dependabot reanalysed it (alerts #55, #72 and #81 flipped to `fixed` at the merge moment, 2026-09-11T02:03:46-47Z). The reanalysis left **17 open alerts - 7 high, 9 medium, 1 low**. Every one is development/build scope and **0 are runtime**: `npm audit --omit=dev` reported zero before the work and reports zero after it, so no shipped code was ever exposed. The backlog still matters because the build and test toolchain runs on developer machines and in CI with repository write access, and because `npm audit` reported 15 vulnerabilities (6 high, 8 moderate, 1 low) on the merged tree.
- Remediated on: local branch `security/dev-tooling-2026-09`, based on `bdf2fb0`, **not pushed**. Two commits: `chore(deps): remediate dev-tooling security advisories` (`extension/package.json`, `extension/package-lock.json`) and `chore(raiden): reconcile post-merge v1 state` (state/docs only).
- Changes:
  - Direct, in `extension/package.json`: `vitest` 4.1.9 -> 4.1.11 (closes #88 and #85, GHSA-82fw-gwwq-j7x9; vitest pins `@vitest/mocker` exactly, so the parent bump is the only route); `sharp` 0.35.3 -> 0.35.4 (closes #90, GHSA-rgj7-g3m4-5g8c; the libheif fix is in the `@img/sharp-libvips-*` 1.3.2 -> 1.3.3 binaries); `overrides.adm-zip` 0.6.0 -> 0.6.1 (closes #84, see below).
  - Lockfile-only, no declared range changed because every parent range already admitted the fixed version: `brace-expansion` 1.1.14 -> 1.1.18 and 2.1.0 -> 2.1.4 under `@typescript-eslint/typescript-estree` (#61, #76); `undici` 7.28.0 -> 7.29.1 (#65, #66, #67, #68, #69 in one move); `js-yaml` 4.3.0 -> 4.3.2 (#73, #91); `postcss-selector-parser` 6.1.2 -> 6.1.4 (#79); `@humanfs/node` 0.16.7 -> 0.16.8 (#80); `browserslist` 4.28.1 -> 4.28.9 and `baseline-browser-mapping` 2.9.14 -> 2.11.22 (#83, #86); `nanoid` 3.3.16 -> 3.3.19.
  - Two traps worth recording. First, the advisories' nominal first-patched versions for `brace-expansion` (1.1.16 / 2.1.2) are **insufficient**: GHSA-mh99-v99m-4gvg and GHSA-rgw5-rvv9-x895 raise the real floor to 1.1.18 / 2.1.4, and aiming at the nominal values would have left four further advisories live for no saving. Second, `nanoid` GHSA-2v37-7h3g-55p8 is **not** an open alert - Dependabot auto-dismissed it as #75 - yet `npm audit` still reports it high; it was fixed because the same refresh covered it. The same applies to the auto-dismissed #64, #70, #77, #78 and #82.
- `adm-zip` (#84, GHSA-vwc7-r8mq-g2x9 / CVE-2026-76845, extraction follows destination symlinks) is **resolved, not waived**. The prior disposition - unpatchable residual, dev/build-only, absent from both shipped packages - was correct when written: there was no fixed release. adm-zip 0.6.1 was published 2026-09-11T10:24:22Z, three days after GitHub (updated 2026-09-08T21:20:42Z) and OSV (modified 2026-09-08T21:40:56Z) last touched the advisory, which is exactly why both still report no patched version. The fix was confirmed from the published tarball rather than inferred from the advisory's upper bound - OSV encodes `last_affected: 0.6.0`, not `fixed`, which asserts nothing about 0.6.1 - by diffing 0.6.0 against 0.6.1: 0.6.1 adds `Utils.assertPathSafe`, an lstat-based per-component symlink check, and calls it at five extraction sites, matching the advisory's described root cause. `types.d.ts` is byte-identical and the public method set is unchanged, and OSV reports zero advisories against 0.6.1. **No WXT major upgrade was required or taken**; `wxt` stays 0.20.27, even though `npm audit` proposed `wxt@0.21.4` (flagged `isSemVerMajor`) as its fix for this chain.
- Validation on the committed branch state (Node 24.18.0 / npm 11.16.0, Windows host): clean `npm ci`; `tsc --noEmit` clean; `eslint` 0 errors / 13 warnings (unchanged); **32 test files, 717 tests passed** under vitest 4.1.11 (unchanged count); both packages build, 14 files each, 326,574 and 326,651 bytes; byte-identical across consecutive builds; no tracked source mutated by the build; addons-linter 0 errors / 0 notices / 3 warnings (unchanged); locale, font, remote-font/CDN, removed-feature-string, file-count, version, permission and size gates all pass; `npm audit` 0; `npm audit --omit=dev` 0. The built `chrome-mv3` and `firefox-mv3` trees are **byte-identical to the artefacts CI produced for `bdf2fb0`**, which establishes that none of these dependency changes reached the shipped output.
- Playwright could not run locally (`browserType.launchPersistentContext: spawn UNKNOWN`, bundled `chromium-1200`) - the limitation already recorded in `extension/tests/live/README.md`. All five failures are that launch error with no assertion failure, so the `e2e` evidence stays with Linux CI.
- Success condition: the branch is pushed, one PR is opened against current `main`, the full Gate H job set (`lint`, `test`, `package`, `e2e`) re-runs green on it, and Dependabot's reanalysis of the merged result confirms the alert count at 0 open (or the exact residual set is re-dispositioned here). Until then this loop stays Open: the remediation is local and unpushed, and alert closure is a provider-side observation that cannot be asserted from the working tree.
- Not addressed here, deliberately: OL-005 (Babel 8) and OL-006 (`@vitejs/plugin-react` / vite 7 -> 8) are dependency holds requiring their own migrations and were left untouched - no advisory in this backlog implicated either, and `vite` stays 7.3.5 with `@vitejs/plugin-react` at 5.2.0. `vitest` 5.0.0 was likewise not taken; 4.1.11 closes the advisory inside the 4.x line, and 5.0.0 is a major with real test-suite migration work (mocks cleared by default, unawaited async assertions failing, reporter output relocated, `-t` separator changed).
