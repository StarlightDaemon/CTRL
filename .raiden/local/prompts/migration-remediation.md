# Migration Remediation Handoff — CTRL — Edict v0.4.0 Pre-Migration

## Prompt ID

`raiden.shared.handoff.v1`

## Purpose

CTRL's RAIDEN v0.2.0 install (2026-05-08) was never committed to git, and the working
tree has additional operator WIP. Before the RAIDEN central agent can run the Edict
v0.4.0 migration, CTRL's working tree must be clean. This handoff describes the
required pre-migration steps. (Target is v0.4.0 directly; v0.3.0 is skipped.)

## Template

```text
You are continuing a bounded work package inside the current repo.

Read first:
- AGENTS.md (on disk, untracked — check if present)
- .raiden/README.md
- .raiden/instance/metadata.json
- .gitignore

Current objective:
- Prepare CTRL's working tree so the RAIDEN central agent can perform the
  Edict v0.4.0 migration. This means: commit the existing v0.2.0 RAIDEN
  install, and ensure no other dirty-tree items remain. (v0.3.0 is skipped;
  the central agent will apply v0.4.0 directly after the tree is clean.)

Known constraints:
- Do NOT modify any file under .raiden/writ/ — these are RAIDEN-managed.
- Do NOT run the workspace audit.
- Do NOT run raiden_updater.cli apply.
- Commit attribution: no Co-Authored-By or agent attribution lines (CLAUDE.md §8 rule 11).
- CTRL is currently on branch `next/main-rebuild`. Confirm with the operator which
  branch the RAIDEN install commit should land on before committing.

Already true (as of step-2 halt, 2026-05-13):
- RAIDEN v0.2.0 install exists on disk (agent-written 2026-05-08) but was never
  committed. Untracked: .raiden/, AGENTS.md, agent-ledger/, audit-reports/, reports/.
- Working tree also has modified tracked files (operator WIP):
    M extension/src/shared/api/clients/aria2/Aria2Adapter.ts
    M extension/src/shared/api/clients/flood/FloodAdapter.ts
    M extension/src/shared/lib/buildInfo.ts
    M extension/src/shared/lib/vpn/VPNService.ts
    M extension/vitest.config.ts
    M extension/vitest.setup.ts
- .raiden/writ/ contains: OPERATING_RULES.md, OWNERSHIP_BOUNDARY.md, README.md
  (v0.2.0 managed content — NO WORKSPACE_AUDIT_PROTOCOL.md yet; that is the v0.3.0 add).
- No prior WORKSPACE_AUDIT_PROTOCOL.md exists in .raiden/writ/ — hypothesis refuted.
- audit-reports/ is untracked. It will be gitignored in the v0.3.0 migration
  (canonical audit-output exclusion). Do not commit it now.

Still open:
1. Handle the operator WIP tracked files (M extension/src/...):
   - Commit or stash the WIP before proceeding. These are NOT RAIDEN files;
     do not stage them in the RAIDEN commit.
   - Stash is the lower-risk option if the WIP is in-progress work:
       git stash push -m "wip: extension changes before RAIDEN install commit"
2. Switch to main:
       git checkout main
   The v0.2.0 RAIDEN install commit must land on main (operator decision 2026-05-13).
3. Add canonical audit-output exclusions to .gitignore if not already present:
     # RAIDEN audit outputs — operational findings, not framework content
     audit-reports/
     .raiden/state/AUDIT_LOG.md
     .raiden/state/last-audit.md
   (This is also done by the v0.3.0 migration, but adding it now prevents
   audit-reports/ from appearing as untracked after the RAIDEN commit.)
4. Commit the v0.2.0 RAIDEN install on main. Stage only RAIDEN files:
   - AGENTS.md
   - .raiden/ (entire directory)
   - .gitignore (if modified in step 3)
   Do NOT stage: agent-ledger/, reports/, or any operator WIP files.
   Suggested commit message:
   "chore: install RAIDEN Instance v0.2.0"
5. Verify clean tree on main: git status --porcelain should be empty
   (or show only stashed/committed operator WIP).
6. Signal to the operator: CTRL is ready for the RAIDEN central agent to run
   the v0.4.0 migration prompt from
   /mnt/e/Raiden/toolkit/prompts/audit-protocol-migration-v0.4.0-prompt.md
   targeting --instance /mnt/e/CTRL.
   (v0.3.0 is skipped; v0.4.0 is applied directly.)
   After the v0.4.0 migration and its commit, switch back to next/main-rebuild
   and re-apply any stash if needed.

Additional note — LOOP-0015:
CTRL has a legacy agent-ledger/ (LOOP-0015, open) that needs its own migration
pass. That is out of scope here. Do not include agent-ledger/ in the v0.2.0
RAIDEN commit or the v0.3.0 migration. It remains pending its own handoff.

Do not:
- reopen settled naming or architecture
- treat review artifacts as canon unless adopted
- broaden the task beyond cleaning the working tree for the v0.4.0 migration
- run the workspace audit

Close out with:
- result: working tree clean, v0.2.0 RAIDEN install committed, operator notified
  that RAIDEN central can proceed with v0.4.0 migration
- evidence checked: git status --porcelain empty, git log shows RAIDEN commit,
  .raiden/instance/metadata.json still shows installed_edict_version 0.2.0
- remaining risks: operator WIP disposition (commit or stash); branch choice
  for RAIDEN install commit
```
