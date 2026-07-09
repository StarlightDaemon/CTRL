# Work Log

## 2026-07-09 — Edict v2.0.0 + state normalization

- Edict v1.0.1 → v2.0.0 applied via `raiden_updater.cli` (plan → apply → re-plan "Already up to date"): `README.md`, `OPERATING_RULES.md`, `WORKSPACE_AUDIT_PROTOCOL.md`, `FORK_REVIEW_PROTOCOL.md`, `AGENTS.md` updated; `ROUTING_POLICY.md` added; `MODEL_TIERS.md` removed (expected `managed_file_removal` warn on the plan, package no longer ships it); `hooks/commit-msg` unchanged.
- `state_schema_version: 2` stamped into `.raiden/instance/metadata.json`.
- Routing overlay migrated: `.raiden/local/MODEL_MAP.md` removed (`git rm`); `.raiden/local/ROUTING.md` added in its place (ladder R1–R4 + offload pool + billing constraints, per the new local-overlay contract).
- State normalization pass against the new `OPERATING_RULES.md` Fact-Home Rule:
  - `CURRENT_STATE.md`: removed hand-written `Last updated:` and `RAIDEN Edict version:` header lines (installed Edict version is authoritative in `metadata.json`, never restated in state prose).
  - `CURRENT_STATE.md`: removed the "RAIDEN Instance installed at Edict v0.4.0 (2026-05-15...)" bullet — duplicate of the existing 2026-05-15 entry below, no unique content lost.
  - `CURRENT_STATE.md`: removed the "Edict v0.6.1 → v1.0.0 upgrade (2026-06-14, commit 671bee0)..." bullet; its unique detail (six writ files, `OWNERSHIP_BOUNDARY.md` retirement, `MODEL_TIERS.md` add, `AGENTS.md` WSL-path fix, baseline reconciliation, clean plan validator) relocated into the 2026-06-14 entry above.
  - `CURRENT_STATE.md`: stripped the redundant "state synced to Edict v0.6.1" / "Edict v1.0.0 installed" clauses from the `In Progress` log bullets (2026-06-13, 2026-06-14) — same facts already carried by the 2026-06-13 entry below and by the relocated 2026-06-14 detail above.
  - `CURRENT_STATE.md`: collapsed the full OL-001 technical restatement (adapter list, ten commit hashes, suite counts — duplicated from `OPEN_LOOPS.md` OL-001's `Closed by:` field) and the OL-001 decisions/closed-status restatement in `In Progress` down to bare `OL-001 (see OPEN_LOOPS.md)` citations, per the fact-home rule that loop status lives only in `OPEN_LOOPS.md`.
  - No Edict-version strings or Last Updated/Verified footers found in `OPEN_LOOPS.md`, `GOALS.md`, or `DECISIONS.md` requiring removal.
  - `.raiden/local/prompts/` left untouched (historical local handoff artifacts, out of scope).

## 2026-06-14 — History rewrite, OL-002 close, upstream tracking repair

| 2026-06-13 | npm audit fix: vite 7.3.3→7.3.5, esbuild 0.27.2→0.27.7, shell-quote 1.8.3→1.8.4; 380 tests pass; 17 alerts remain in wxt transitive chain; committed 257e7e6 (rewritten to 39c869c post-history-rewrite) |
| 2026-06-14 | History rewrite via git filter-repo: .persistent-data/ scrubbed from all commits; all 4 remote branches force-pushed (main, next/main-rebuild, remove/vpn-tooling, archive/main-2026-03-08); Google API key revoked; secret scanning alert closed as Revoked; OL-002 closed; upstream tracking refs set |
| 2026-06-14 | Edict v0.6.1 → v1.0.0 upgrade (commit 671bee0): all six writ files updated, OWNERSHIP_BOUNDARY.md retired, MODEL_TIERS.md added, root AGENTS.md refreshed (stale WSL path removed), baseline.json reconciled; plan validator: no anomalies |

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
