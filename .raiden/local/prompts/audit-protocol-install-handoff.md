You are the CTRL Instance agent, operating inside /mnt/e/CTRL (or wherever CTRL is checked out).

Read first:
- AGENTS.md
- .raiden/README.md
- .raiden/state/CURRENT_STATE.md
- .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md

Current objective:
Verify and commit the Edict v0.4.0 migration files that RAIDEN central wrote into this Instance. No new writes are needed — RAIDEN central completed all file operations; your task is verification and commit only.

Known constraints:
- Do not modify CURRENT_STATE.md, OPEN_LOOPS.md, DECISIONS.md, or WORK_LOG.md.
- Do not push without explicit operator confirmation.
- No Co-Authored-By or agent attribution lines in the commit message.
- Do not run raiden_updater.cli apply — use plan only.
- Do NOT include agent-ledger/ in this commit. LOOP-0015 is a separate task.

Already true:
- Phase 1 complete: v0.2.0 RAIDEN install committed at 73e73a8
  ("install: RAIDEN Instance v0.2.0") on main.
- RAIDEN central completed the v0.2.0 → v0.4.0 migration (2026-05-15).
- .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md — new file, v0.4.0 content.
  SHA-256: 1fa98a0ab068349d71556b142d433fe52462de0cca237d773e4e3dc2ad5bdbb0
- .raiden/instance/baseline.json — WORKSPACE_AUDIT_PROTOCOL.md entry added;
  installed_edict_version bumped 0.2.0 → 0.4.0.
- .raiden/instance/metadata.json — installed_edict_version bumped 0.2.0 → 0.4.0.
- .raiden/README.md — ## Workspace Audit section appended.
- .gitignore — audit-output exclusion block already present; no change.
- plan validator confirms: Block reason: Already up to date — no changes needed.

Still open:
1. Run `git status --porcelain` — confirm only the migration files appear. Stop if unexpected.
2. Run `grep installed_edict_version .raiden/instance/metadata.json` → expect "0.4.0"
3. Run from /mnt/e/Raiden/toolkit/updater/:
     python3 -m raiden_updater.cli plan \
       --instance /mnt/e/CTRL \
       --package /mnt/e/Raiden/toolkit/updater/fixtures/sample_package
   → expect: Block reason: Already up to date
4. Commit the following files:
     .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md
     .raiden/instance/baseline.json
     .raiden/instance/metadata.json
     .raiden/README.md
     .raiden/local/prompts/audit-protocol-install-handoff.md
   Suggested commit message:
     "install: RAIDEN Edict v0.2.0 → v0.4.0 (WORKSPACE_AUDIT_PROTOCOL install)"
5. Run `git status --porcelain` after commit — confirm clean.
6. If operator WIP (extension/ TypeScript files) was stashed in Phase 1, re-apply:
     git stash pop
   Then switch back to next/main-rebuild if needed and merge or cherry-pick RAIDEN commits.

Do not:
- Modify any managed file in .raiden/writ/
- Include agent-ledger/ in this commit (LOOP-0015 is separate)
- Run the workspace audit

Close out with:
- result: commit SHA
- evidence checked: git diff output, plan validator output, version grep
- remaining risks: LOOP-0015 (agent-ledger migration); operator WIP stash re-apply;
  branch merge decision for next/main-rebuild
