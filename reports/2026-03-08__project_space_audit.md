# Project Space Audit

**Date:** 2026-03-08
**Repo Root:** `/mnt/e/CTRL`
**Scope:** Full workspace audit of repository state, local drift, validation status, artifact footprint, and immediate cleanup/review priorities.

## Executive Summary

The repository baseline is stable.

- `main` and `origin/main` both resolve to `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- deterministic CI normalization is already in place
- TypeScript compile passes
- unit tests pass: `16` files, `357` tests
- lint does not fail, but emits `146` warnings

There are no immediate signs of repository breakage. The current problems are workspace hygiene and review debt rather than mainline instability.

## Canonical Baseline

Confirmed refs:

- `main`: `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- `origin/main`: `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- `archive/main-2026-03-08`: `d53596b23614f6db160ccb4b3080fe8802d546e0`
- `origin/archive/main-2026-03-08`: `d53596b23614f6db160ccb4b3080fe8802d546e0`
- `rewrite/main-2026-03-08`: `e90382b9ea2064fa4a13698985f9a77cee69cbfd`

Recent history:

1. `c6704f7` `ci: restore lockfile tracking and npm caching for deterministic builds`
2. `99b41b2` `ci: fix npm cache failure by removing lockfile dependency`
3. `ec510d2` `chore: refresh build metadata for rewrite baseline`
4. `e90382b` `WIP: Snapshot of dirty state for rewrite baseline`
5. `b7aef75` `chore: Phase 1 stabilization - ESLint cleanup and documentation`

Interpretation:

- the rewrite is no longer an in-flight branch migration problem
- the current active branch is the post-normalization `main`
- `rewrite/main-2026-03-08` remains reachable but should be treated as historical context, not an active target

## Working Tree Audit

Current git-visible drift:

- modified: `reports/2026-03-08__main_rewrite_repo_agent_handoff.md`
- untracked: `reports/2026-03-08__ci_lockfile_cache_fix_report.md`
- untracked: `reports/2026-03-08__current_state_repo_agent_handoff.md`
- untracked: `reports/2026-03-08__deterministic_ci_normalization_report.md`

Interpretation:

- working tree drift is limited to report artifacts
- there is no current git-visible code drift outside `reports/`
- the newly created `current_state` handoff should be treated as the better baseline document for future repo-agent work

## Worktree Audit

Observed worktrees:

- `/mnt/e/CTRL`
  - branch: `main`
  - HEAD: `c6704f7669e6978c8a37a769362f8e3f405de1b7`
- `/tmp/CTRL-audit-clean`
  - detached HEAD: `b7aef75bd925a4cd49018fc4afad997b46fb7fc6`

Interpretation:

- `/tmp/CTRL-audit-clean` is stale relative to current `main`
- the detached worktree commit is still reachable from `main`, so cleanup would be operationally low-risk if explicitly approved
- it should not be treated as an authoritative validation baseline

## Package Manager And CI Audit

Confirmed steady state:

- `extension/package-lock.json` is tracked
- root `.gitignore` ignores generic lockfiles but explicitly re-allows `extension/package-lock.json`
- `.github/workflows/ci.yml` uses `cache: 'npm'`
- `.github/workflows/ci.yml` uses `cache-dependency-path: extension/package-lock.json`
- `.github/workflows/ci.yml` installs with `npm ci`

Interpretation:

- current CI configuration matches the deterministic-lockfile baseline described in the newer handoff
- no package-manager drift was observed at the repository-control level

## Validation Results

Executed from `extension/`:

- `npm run compile`
  - result: pass
- `npm run test`
  - result: pass
  - summary: `16` test files, `357` tests passed
  - duration: `86.51s`
- `npm run lint`
  - result: pass with warnings
  - summary: `146` warnings, `0` errors

Important nuance:

- test output includes substantial expected stderr/stdout from mocked failure-path tests
- these logs are noisy but did not indicate failing assertions

## Lint Debt Review

Lint is not currently a blocking gate, but the warning volume is high enough to weaken signal quality.

Observed warning categories:

- unused imports and variables
- `any` usage
- `prefer-const`
- React hook dependency warnings

Files with especially visible warning concentration include:

- `extension/src/entrypoints/background.ts`
- `extension/src/entrypoints/options/Dashboard.tsx`
- `extension/src/shared/api/clients/deluge/DelugeAdapter.ts`
- `extension/src/shared/api/clients/synology/SynologyAdapter.ts`
- `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`

Interpretation:

- this is not a release blocker based on current config
- it is a real maintenance risk because new warnings can hide inside a large pre-existing warning pool

## Workspace Footprint Audit

Observed top-level sizes:

- `.github`: `4.0K`
- `backups`: `9.1M`
- `docs`: `24M`
- `extension`: `705M`
- `logs`: `32K`
- `reports`: `236K`

Observed extension-local artifact sizes:

- `extension/builds`: `82M`
- `extension/.wxt`: `40K`
- `extension/playwright-report`: `540K`
- `extension/test-results`: `0`
- `extension/backups`: `708K`

Inference:

- most of the remaining `extension` footprint is local dependency installation, primarily `node_modules`
- the large workspace size is therefore expected for an actively used local development environment, but still worth classifying clearly

## Ignore And Tracking Audit

Confirmed ignore behavior:

- `backups/` is ignored at repo root
- `extension/node_modules/` is ignored
- `extension/builds/` is ignored
- `extension/.wxt/` is ignored
- `extension/playwright-report/` is ignored
- `extension/test-results/` is ignored
- `logs/` is ignored
- `docs/reports/` is ignored
- `docs/archive/` is ignored

Observed tracking behavior:

- `reports/` is tracked and intentionally used for project artifacts
- the currently visible git drift is entirely inside tracked `reports/`

Interpretation:

- ignore coverage is broadly correct
- current cleanup pressure is mostly policy and organization, not missing ignore rules

## Residual Review Notes

- one active code TODO was found in `extension/src/features/torrent-control/services/LifecycleAdapter.ts`
- no broader TODO/FIXME explosion was observed in active source outside archival docs
- no evidence was found that repo-maintenance validation is currently running in the background

## Findings

### Finding 1: No blocking repository integrity issue was found

The code baseline, branch state, lockfile handling, compile result, and unit-test result all indicate that the repository is currently stable.

### Finding 2: Workspace cleanliness is report-drift bound, not code-drift bound

The current dirty state is confined to `reports/`. This is manageable, but it means future maintenance work should keep documentation/report commits separated from code/tooling commits.

### Finding 3: Lint warning volume is the most visible ongoing engineering-quality risk

There are `146` warnings and `0` errors. This does not break CI today, but it reduces confidence in future warning-based review.

### Finding 4: The detached worktree is stale and should be treated as cleanup inventory

`/tmp/CTRL-audit-clean` is not blocking work, but it is outdated relative to `main` and can easily mislead future agents if left undocumented.

### Finding 5: Local artifact volume is intentional but should be named explicitly in maintenance baselines

The workspace includes backups, build outputs, reports, local dependency installation, and test artifacts. Most of this is ignored correctly. The problem is not accidental tracking, but ambiguity about what should be retained.

## Recommended Next Actions

1. Normalize the `reports/` queue by deciding which 2026-03-08 reports should remain untracked working notes and which should become tracked historical artifacts.
2. Either remove `/tmp/CTRL-audit-clean` or document why it should remain.
3. Create a targeted lint-debt reduction pass, starting with high-churn files rather than attempting all `146` warnings at once.
4. Treat `reports/2026-03-08__current_state_repo_agent_handoff.md` as the canonical handoff for new repo-agent chats.
5. If an independent second opinion is desired, use another repo agent as a reviewer only after this audit is accepted as the baseline.

## Recommended Execution Mode

Best immediate path:

- continue in this chat for the first maintenance pass, because the repo state has already been verified directly here

Best follow-up path:

- use a second repo agent only for an independent review pass after baseline cleanup or after a specific maintenance slice is completed

This sequencing avoids wasting another agent on rediscovering already-confirmed baseline facts.
