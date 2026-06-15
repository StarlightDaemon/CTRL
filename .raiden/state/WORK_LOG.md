# Work Log

## 2026-06-14 — History rewrite, OL-002 close, upstream tracking repair

| 2026-06-13 | npm audit fix: vite 7.3.3→7.3.5, esbuild 0.27.2→0.27.7, shell-quote 1.8.3→1.8.4; 380 tests pass; 17 alerts remain in wxt transitive chain; committed 257e7e6 (rewritten to 39c869c post-history-rewrite) |
| 2026-06-14 | History rewrite via git filter-repo: .persistent-data/ scrubbed from all commits; all 4 remote branches force-pushed (main, next/main-rebuild, remove/vpn-tooling, archive/main-2026-03-08); Google API key revoked; secret scanning alert closed as Revoked; OL-002 closed; upstream tracking refs set |

## 2026-06-13 — Hook exec-bit fix, .gitignore e2e noise, Edict v0.6.1 state sync

| 2026-06-13 | Hook exec-bit fixed (chmod +x .git/hooks/commit-msg); .gitignore updated to exclude e2e artifacts (*.db, *.db-journal, *.pma, persistent-data/); CURRENT_STATE synced to Edict v0.6.1 |
| 2026-06-13 | .persistent-data/ untracked and ignored (git rm -r --cached + .gitignore fix); .raiden/ exec bits normalized (100755→100644 across all managed files) |

## 2026-05-15 — RAIDEN Instance install and agent-ledger migration

- RAIDEN Edict v0.2.0 install cherry-picked onto `next/main-rebuild` (originally landed on `main` 2026-05-15).
- RAIDEN Edict v0.4.0 migration cherry-picked onto `next/main-rebuild`; `WORKSPACE_AUDIT_PROTOCOL.md` installed in Writ.
- Agent-ledger migration complete: post-PR closeout note and VPN removal closeout mapped into `.raiden/state/`; artifact-policy file discarded; `agent-ledger/` removed.
- LEGACY_REVIEW.md closed.

## 2026-04-13 — VPN tooling removal (PR #2)

- Dormant VPN tooling removed: `VPNService.ts`, `VPNProviderRanges.ts`, `VPNIndicator.tsx`, and associated test deleted.
- PR #2 merged into `main`; all CI checks passed (lint, test, build, e2e).
- Two non-blocking gaps remain: stale reference docs (OL-002); isolated worktree npm repro gap (low priority, CI is authoritative).
- Exposed session token from PR #1 process: treated as revoked; was fine-grained repo-scoped temporary token, now expired.

## 2026-04-10 — Mainline rewrite (PR #1)

- `next/main-rebuild` branch merged into `main` as PR #1.
- Deterministic CI established (tracked lockfile, `npm ci`, caching).
- Chrome and Firefox build paths verified.
- Pre-rewrite history preserved under `archive/` branches.
