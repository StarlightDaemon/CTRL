# Current State

**Active branch:** `main` (PR #4 merged `next/main-rebuild`; PR #5 merged `release/v1-publication-candidate` on 2026-09-11, merge commit `bdf2fb0`). The v1 release lineage (see `docs/release/v1/EXECUTION_STATE.md`) is **published as the default branch** — all 28 candidate commits are ancestors of `origin/main`. Publication here means git publication only: **no browser-store release, no GitHub release and no tag exist**, and the version remains `0.2.0-beta.1`. Sync status is deliberately not recorded here — verify it from live git evidence (`git fetch origin`, then `git rev-list --left-right --count origin/main...<branch>` and `git ls-remote origin`) before acting. This file is not authoritative for ahead/behind counts.
**CI:** last verified passing on `origin/main` at `bdf2fb0` — GitHub CI run `34553140709` (push), with `lint`, `test`, `package` and `e2e` all green; the PR run `34551989324` for `01f57ee` was green on the same four jobs. Release **Gate H is PASS** (its success condition was the first remote run of all four jobs completing green). Gate K (operator acceptance on a real install) is still not evaluated.

---

## Project

CTRL is a browser extension for managing BitTorrent clients. Built with WXT, React, and TypeScript. Supports 9 torrent clients (qBittorrent, Transmission, Deluge, Flood, ruTorrent, uTorrent, BiglyBT, Vuze, Aria2). MIT licensed.

**Status:** Beta / Active Stabilization — Phase 2 Technical Excellence in progress.
**Target:** v1.0 Chrome Web Store and Firefox Add-Ons release.

---

## Confirmed Current State

- Beta release shipped (January 2026); beta distribution and Privacy Policy remain in place.
- Mainline rewrite (`next/main-rebuild`, PR #1) merged into `main` (2026-04-10).
- Dormant VPN tooling removed (`remove/vpn-tooling`, PR #2) merged into `main` (2026-04-13).
- Deterministic CI in place: tracked `extension/package-lock.json`, `npm ci`, npm caching.
- Chrome and Firefox build paths both verified.
- VPN removal complete (2026-06-14): source files and tests removed in cherry-pick b09590a; orphaned docs removed in 9c721b9; `git ls-files | grep -i vpn` returns empty.
- FORK_REVIEW_PROTOCOL.md committed (3321d9c).
- Secret-scanning alert #1 (`google_api_key`) audit + remediation (2026-06-16). GitHub alert was already resolved-as-revoked (2026-06-14). Audit findings: the flagged value `AIzaSy…0KCYM` is the **public Chromium omnibox suggest key** (`client=chrome-omni&sugkey=`) captured in committed e2e browser cache under `extension/tests/e2e/.persistent-data/Default/Cache/Cache_Data/`, not a CTRL credential — it never appeared in any source or `.env` file. Full object-DB scan: exactly 16 cache blobs held the key, reachable **only** from the stale closed-PR-#3 Dependabot branch (`dependabot/npm_and_yarn/…b97e8eeb22`, tip 15ffee9); `main` and every live/backup/archive branch were already clean (the PR #1 rebuild had excised the committed profile). Remediation: deleted the stale remote Dependabot branch (2026-06-16); pruned local stale refs; retained local-only backup tag `pre-dependabot-delete-backup` → 15ffee9 for recovery (not pushed). A deletion-protection ruleset on that branch was auto-bypassed by the owner account's standing permissions (no protection was circumvented by the agent).

- OL-001 (see OPEN_LOOPS.md).

- OL-001 closeout recorded in RAIDEN state and pushed (2026-07-01, commit 8d3d790).
- Serena project config and memory layer added (2026-07-01, commit cef98db).
- External repository audit performed 2026-07-02 (report at `.audits/CTRL_AUDIT_2026-07-02.md`, untracked); remediation pass conducted: dependency vulnerability fixes (3196b3c), extension attack-surface hardening (0e90490), CI Node version alignment and third-party action pinning (4adf272), governance/license-year sync (e909644).
- LifecycleAdapter `parseDOM` serialization fixed and validated (2026-07-03, commit aaa99b3).
- Synology Download Station support removed — breaking change (2026-07-03, commit f2e4a62); research documents archived (247f7b0).
- As of 2026-07-03, `main` HEAD was `247f7b0` and in sync with `origin/main` (historical; for current sync status see the header). Full unit suite re-verified 2026-07-03: **512 passed / 0 failed** (15 test files).
- v1 release program (2026-09-09 → 2026-09-11): release lineage prepared locally, then published to git by merging PR #5 into `main` (merge commit `bdf2fb0`, 2026-09-11). Still **not released**: no store submission, no GitHub release, no tag; version remains `0.2.0-beta.1`. Program state, release gates and evidence: `docs/release/v1/EXECUTION_STATE.md`, `docs/release/v1/CLIENT_VERIFICATION.md`. Gate H (remote CI) is **PASS** on run `34553140709`; Gate K (operator acceptance) is not yet evaluated. OL-012, OL-013, OL-014 and OL-015 are closed against that lineage's evidence; OL-011 remains open (see OPEN_LOOPS.md).
- Development-dependency advisory sweep (2026-09-11): after the PR #5 merge Dependabot reanalysed the new default branch and reported 17 open alerts (7 high, 9 medium, 1 low) — all development/build scope, **0 runtime**. All 17 are remediated on the local branch `security/dev-tooling-2026-09` (not pushed): direct bumps of `vitest` 4.1.11 and `sharp` 0.35.4, the `adm-zip` override raised to 0.6.1, and lockfile-only refreshes of `brace-expansion`, `undici`, `js-yaml`, `postcss-selector-parser`, `@humanfs/node`, `browserslist`, `baseline-browser-mapping` and `nanoid`. `npm audit` goes 15 → 0; `npm audit --omit=dev` stays 0; no WXT major upgrade was needed. See OPEN_LOOPS.md OL-017.

## In Progress
- 2026-06-13 — hook exec-bit fixed, .gitignore e2e noise cleared.
- 2026-06-14 — VPN removal finalized, working tree clean.
- 2026-06-18 — OL-001 (see OPEN_LOOPS.md).

## Non-Blocking Open Items

- Secret scanning alert #1: RESOLVED (2026-06-16) — see Confirmed Current State. Flagged value was the public Chromium omnibox key in committed e2e cache, not a real credential; GitHub alert already resolved-as-revoked; stale Dependabot branch carrying the only reachable copy was deleted. Sole residual is GitHub's immutable `refs/pull/3/head` (PR #3), which cannot be removed client-side — acceptable: the key is public and the alert is already closed. No further action available or needed.
- Superseded in part (2026-07-26): the "acceptable … no further action" judgement above predates DECISIONS.md D-005, which records that `refs/pull/3/head` is publicly reachable because the repository is PUBLIC. Provider-side revocation remains unverified and is tracked as OPEN_LOOPS.md OL-011 (Open, external gate).

## Not Yet Done

- Performance Tuning (5k+ torrent profiling and optimization) — not started.
- Accessibility (WCAG 2.1 AA) — not started.
- v1.0 store submission — pending Phase 2 completion.

## Known Constraints

- RAIDEN install lives on `main` (the `next/main-rebuild` branch was merged via PR #4 and no longer exists locally or on origin).
- Other local branches (`archive/*`, `rewrite/main-2026-03-08`, `remove/vpn-tooling`) carry unpushed/divergent history; re-verify before acting on them.
