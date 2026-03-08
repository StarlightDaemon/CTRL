# Current State Repo-Agent Handoff

**Date:** 2026-03-08
**Repo Root:** `/mnt/e/CTRL`
**Purpose:** Provide a clean starting brief for a new repo-focused agent chat based on the repo's current real state, not the earlier rewrite transition history.

## Executive Summary

The mainline rewrite and deterministic CI normalization are complete and already pushed.

- `main` and `origin/main` both point to `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- old pre-rewrite remote state is preserved at `origin/archive/main-2026-03-08`
- `extension/package-lock.json` is now tracked
- GitHub Actions workflow has been returned to lockfile-based deterministic npm behavior

The repository code state is stable. The remaining local drift is documentation/report-related plus one stale detached worktree.

## Canonical Refs

- `main`: `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- `origin/main`: `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- `archive/main-2026-03-08`: `d53596b23614f6db160ccb4b3080fe8802d546e0`
- `origin/archive/main-2026-03-08`: `d53596b23614f6db160ccb4b3080fe8802d546e0`
- `rewrite/main-2026-03-08`: `e90382b9ea2064fa4a13698985f9a77cee69cbfd`

## Recent Relevant History

1. `c6704f7` `ci: restore lockfile tracking and npm caching for deterministic builds`
2. `99b41b2` `ci: fix npm cache failure by removing lockfile dependency`
3. `ec510d2` `chore: refresh build metadata for rewrite baseline`
4. `e90382b` `WIP: Snapshot of dirty state for rewrite baseline`

Interpretation:

- `99b41b2` was the temporary CI workaround after the rewritten `main` landed.
- `c6704f7` is the durable follow-up that restored lockfile tracking, `npm ci`, and npm cache usage.

## Current Working Tree State

Current local status is not fully clean, but the remaining drift is limited to reports:

- modified: `reports/2026-03-08__main_rewrite_repo_agent_handoff.md`
- untracked: `reports/2026-03-08__ci_lockfile_cache_fix_report.md`
- untracked: `reports/2026-03-08__deterministic_ci_normalization_report.md`

Important:

- These report files were intentionally kept out of the tooling commits.
- They should not be mixed into repo-maintenance commits unless explicitly requested.

## Package Manager / CI State

This is the current intended steady state:

- `extension/package-lock.json` is tracked in git
- `.gitignore` allows `extension/package-lock.json` while still broadly ignoring root-level `package-lock.json`
- `.github/workflows/ci.yml` uses:
  - `cache: 'npm'`
  - `cache-dependency-path: extension/package-lock.json`
  - `npm ci`

Tracked lockfile confirmation:

- `extension/package-lock.json` is present in the index

## Worktrees

Active worktrees:

- `/mnt/e/CTRL`
  - branch: `main`
  - HEAD: `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- `/tmp/CTRL-audit-clean`
  - detached HEAD: `b7aef75bd925a4cd49018fc4afad997b46fb7fc6`

Interpretation:

- `/tmp/CTRL-audit-clean` is stale relative to current `main`
- it is not blocking the repo, but it is outdated and should be treated as cleanup material rather than an active baseline

## Active Tooling Context

At handoff creation time, no active npm/vitest build/test process related to repo maintenance was observed.

One IDE-related process was present:

- Playwright test server:
  - `extension/node_modules/@playwright/test/cli.js test-server -c extension/playwright.config.ts`

Interpretation:

- this appears to be IDE/editor support tooling rather than an active repo-maintenance task
- do not assume it means validation is currently running

## What Is Done

- mainline rewrite completed
- old remote main archived
- rewritten `main` pushed
- deterministic CI normalization completed
- lockfile tracked and pushed
- local and remote `main` aligned

## What Is Not Done

- report-file cleanup is not done
- stale detached worktree cleanup is not done
- no claim is made here about broader product quality beyond the repo/CI stabilization work

## Safe Next-Step Scope For A New Repo Agent

Good next tasks:

1. Review and normalize leftover report files in `reports/`
2. Decide whether the stale worktree at `/tmp/CTRL-audit-clean` should be removed or retained
3. Audit residual warnings or non-blocking tooling issues
4. Prepare a cleaner maintenance baseline now that `main` is stable

Bad next tasks unless explicitly requested:

- redoing the rewrite workflow
- changing remote branch history again
- broad dependency upgrades
- mixing report cleanup into CI/tooling commits

## Copy-Paste Prompt For A New Repo Agent

```text
You are a repo-focused maintenance agent operating in /mnt/e/CTRL.

Start from the current actual repo state, not from earlier rewrite-planning history.

Current confirmed repo state:
- main = origin/main = c6704f7669e6978c8a37a769362f8e3f405de1b7
- origin/archive/main-2026-03-08 = d53596b23614f6db160ccb4b3080fe8802d546e0
- rewrite/main-2026-03-08 = e90382b9ea2064fa4a13698985f9a77cee69cbfd
- extension/package-lock.json is tracked
- deterministic CI normalization has already been completed and pushed

Current expected local drift:
- modified: reports/2026-03-08__main_rewrite_repo_agent_handoff.md
- untracked: reports/2026-03-08__ci_lockfile_cache_fix_report.md
- untracked: reports/2026-03-08__deterministic_ci_normalization_report.md

Current worktrees:
- /mnt/e/CTRL on main at c6704f7669e6978c8a37a769362f8e3f405de1b7
- /tmp/CTRL-audit-clean detached at b7aef75bd925a4cd49018fc4afad997b46fb7fc6

Operating rules:
- Do not revisit or redo the mainline rewrite unless directly asked.
- Do not rewrite remote history unless directly asked.
- Treat the repo code and CI baseline as currently stable.
- Keep report/document drift separate from code/tooling changes.
- Verify all assumptions with direct git inspection before making changes.

Your first task is to inspect and restate the current state in concrete terms, then proceed only with the newly requested maintenance work.
```

## Human Notes

If starting a new chat, this file should be the primary handoff artifact instead of the older rewrite-planning reports. It reflects the current settled baseline more accurately.
