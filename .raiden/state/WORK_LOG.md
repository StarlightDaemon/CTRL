# Work Log

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
