# Main Rewrite Repo-Agent Handoff

**Date:** 2026-03-08
**Repository:** `/mnt/e/CTRL`
**Primary Goal:** Freeze the current remote `main`, preserve the current local dirty state, and prepare a validated replacement mainline for a controlled rewrite of `origin/main`.

## Model Recommendation

Use `Gemini 3.1 Pro` for the groundwork.

- Best fit: `Gemini 3.1 Pro`
- Backup choice: your strongest Claude coding/repo model
- Not recommended as the lead agent: Flash-class models

Reason:

- The repo has a large dirty working tree.
- The desired end state includes a remote history rewrite.
- The agent needs to distinguish between committed state, uncommitted state, remote archival refs, and safe rollback points.

## Known Repo Facts

- Local repo root: `/mnt/e/CTRL`
- Current local branch: `main`
- Local `HEAD`: `b7aef75bd925`
- Current `origin/main`: `d53596b23614`
- Local branch is ahead of `origin/main` by 1 commit.
- The meaningful divergence is mostly in the uncommitted worktree, not in committed history.
- Last checked working tree counts:
  - `89 modified`
  - `9 deleted`
  - `34 untracked`
- Additional worktree exists:
  - `/tmp/CTRL-audit-clean`
  - Detached at `b7aef75`
  - Minor dirtiness present

## Operational Intent

The old remote `main` is not relied on operationally and can be retired, but it must be preserved first.

The rewrite must follow this sequence:

1. Preserve the old remote state.
2. Preserve the current local dirty state in a recoverable branch.
3. Validate the replacement baseline.
4. Move local `main` to the validated replacement commit.
5. Rewrite `origin/main` using `--force-with-lease`.

## Required Safety Rules

- Do not discard or overwrite uncommitted work.
- Do not run `git reset --hard`, `git checkout --`, or similar destructive cleanup commands.
- Do not force-push anything until archival refs exist and the replacement branch has been snapshotted.
- Use `--force-with-lease`, never plain `--force`.
- If a command requires network or unsandboxed access, stop and request approval at that step.
- Treat the current dirty worktree as important source material, not noise.

## Deliverables Expected From The Repo Agent

The agent should produce all of the following:

1. An archive branch or tag pointing to current `origin/main`.
2. A new rewrite branch containing a full WIP snapshot of the current local worktree.
3. A short report listing:
   - created refs
   - resulting commit SHAs
   - whether the replacement branch builds/tests
   - whether local `main` is ready to replace `origin/main`
4. A final explicit stop point before any remote force-push, unless the user separately approves that action.

## Recommended Branch/Tag Names

- Archive branch: `archive/main-2026-03-08`
- Optional archive tag: `archive-main-2026-03-08`
- Rewrite branch: `rewrite/main-2026-03-08`

## Execution Plan For The Repo Agent

### Phase 1: Inspect And Confirm

- Verify current branch, SHAs, worktrees, and dirty status.
- Confirm no existing archive refs would collide with the proposed names.
- Confirm the extra worktree does not block branch creation or branch movement.

### Phase 2: Freeze Old Remote Main

- Create a local archive branch pointing to `origin/main`.
- Optionally create a matching archive tag.
- Prepare to push the archive branch/tag to remote later, but do not rewrite `main` yet.

### Phase 3: Snapshot Current Local State

- Create `rewrite/main-2026-03-08` from current local `HEAD`.
- Stage the current tracked and untracked changes carefully.
- Commit a WIP snapshot that preserves the exact local state.
- Do not try to clean or reorganize the changes in this phase.

### Phase 4: Validate Replacement Baseline

- Record the resulting snapshot commit SHA.
- Run the most relevant local verification available.
- If full test coverage is too expensive, run at least the build and the highest-signal checks available for this repo.
- Summarize failures without discarding the snapshot.

### Phase 5: Prepare Main For Rewrite

- If validation is acceptable, move local `main` to the validated rewrite commit.
- Confirm rollback paths:
  - archived remote commit preserved
  - rewrite snapshot preserved
  - previous local `main` still recoverable via reflog or explicit SHA

### Phase 6: Remote Rewrite Stop Point

- Stop and present the exact push commands needed:
  - push archive refs
  - push replacement `main` with `--force-with-lease`
- Do not execute those remote-changing commands without explicit user approval.

## Copy-Paste Prompt For The Repo Agent

This version is tuned for `Gemini 3.1 Pro` as the primary repo agent.

```text
You are Gemini 3.1 Pro operating as a careful repository migration agent inside the repository at /mnt/e/CTRL.

Goal:
Prepare a safe rewrite of origin/main by preserving the old remote main, preserving the current dirty local state in a real branch/commit, validating the replacement baseline, and stopping before any remote force-push unless separately approved.

Current known facts:
- local branch: main
- local HEAD: b7aef75bd925
- origin/main: d53596b23614
- local main is ahead of origin/main by 1 commit
- the important divergence is mostly uncommitted worktree drift
- latest observed worktree counts: 89 modified, 9 deleted, 34 untracked
- extra worktree exists at /tmp/CTRL-audit-clean on detached HEAD b7aef75 with minor dirtiness

Required outcomes:
1. Preserve current origin/main under an archive ref such as archive/main-2026-03-08.
2. Create a rewrite branch such as rewrite/main-2026-03-08.
3. Snapshot the entire current local worktree into a WIP commit on that rewrite branch.
4. Run the highest-signal safe validation available.
5. If the snapshot is a viable replacement baseline, move local main to that validated commit.
6. Stop before any remote force-push and report the exact commands needed for the final remote rewrite.

Safety constraints:
- Never discard local changes.
- Never use git reset --hard or checkout-based reversion.
- Never use plain --force; use --force-with-lease only.
- If network or unsandboxed execution is needed, stop and request approval at that exact step.
- Keep the archived remote state recoverable.
- Do not make assumptions about cleanliness; verify branch, worktree, and worktree-list state directly before changing refs.
- Prefer reversible steps and explicit recovery points over clever shortcuts.

Preferred ref names:
- archive/main-2026-03-08
- archive-main-2026-03-08
- rewrite/main-2026-03-08

Working style:
- First inspect branch/worktree state and confirm assumptions.
- Then create archival refs.
- Then create the rewrite branch and commit the dirty state as a WIP snapshot.
- Then validate.
- Then prepare local main.
- Then stop and report.
- Be explicit about what is observed versus inferred.
- If a command fails, explain why and choose the safest next step.
- Do not compress multiple risky git actions into one command sequence.

Deliver a concise report with:
- refs created
- commit SHAs
- validation results
- whether local main is ready to replace origin/main
- exact next commands for the remote rewrite

Execution details:
1. Inspect:
   - Run branch/ref/status/worktree inspection commands.
   - Confirm whether any archive refs already exist.
   - Confirm whether /tmp/CTRL-audit-clean creates any branch movement constraints.
2. Freeze old remote main:
   - Create a local archive branch at origin/main.
   - Optionally create a tag at the same commit if safe and non-colliding.
3. Preserve current dirty local state:
   - Create rewrite/main-2026-03-08 from current local HEAD.
   - Stage tracked and untracked files needed to preserve the exact current state.
   - Commit a WIP snapshot with a message clearly identifying it as the rewrite baseline snapshot.
4. Validate:
   - Run the highest-signal available verification that is safe in this environment.
   - If there are failures, preserve the snapshot and report them without discarding work.
5. Prepare local main:
   - If validation is acceptable, move local main to the validated rewrite commit using a safe, non-destructive ref update strategy.
   - Confirm the final local main commit SHA.
6. Stop point:
   - Do not push yet unless separately approved.
   - Provide the exact archive-push commands and the exact force-with-lease command that would replace origin/main.

Success criteria:
- The old remote main is preserved under an archive ref.
- The dirty local state exists as a real commit on a rewrite branch.
- Local main points to the validated replacement commit or the agent clearly explains why it does not.
- The final report leaves the operator one approval away from the remote rewrite.
```

## Recommended Human Decision

Use `Gemini 3.1 Pro` for this handoff. Use Claude only if the runtime you are using has materially better local repo tooling. Flash is not the right lead model for this operation.
