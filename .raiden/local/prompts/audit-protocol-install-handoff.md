You are the CTRL Instance agent, operating inside /mnt/e/CTRL (or wherever CTRL is checked out).

Read first:
- AGENTS.md (on disk, currently untracked)
- .raiden/README.md
- .raiden/instance/metadata.json
- .gitignore

Current objective:
Complete the full Edict v0.4.0 migration for CTRL in three phases:
  Phase 1 — Clean the working tree (this agent's work)
  Phase 2 — RAIDEN central writes the migration files (operator triggers from /mnt/e/Raiden)
  Phase 3 — Verify and commit (this agent's work)

Known constraints:
- Do not modify any file under .raiden/writ/ — those are RAIDEN-managed.
- Do not run the workspace audit.
- Do not run raiden_updater.cli apply — use plan only for validation.
- No Co-Authored-By or agent attribution lines in any commit message.
- CTRL was on branch next/main-rebuild. The RAIDEN install commit must land on main.
  Confirm branch with operator before committing.
- Do not include agent-ledger/ in the RAIDEN commit. LOOP-0015 (agent-ledger migration)
  is separate and out of scope here.
- Do not include audit-reports/ in the RAIDEN commit — it is gitignored.

Already true (as of the 2026-05-13 halt):
- RAIDEN v0.2.0 install exists on disk (.raiden/, AGENTS.md) but was NEVER committed to git.
- .raiden/writ/ contains: OPERATING_RULES.md, OWNERSHIP_BOUNDARY.md, README.md (v0.2.0).
  No WORKSPACE_AUDIT_PROTOCOL.md yet — that is the v0.4.0 addition.
- Operator WIP tracked files (NOT RAIDEN files):
    M extension/src/shared/api/clients/aria2/Aria2Adapter.ts
    M extension/src/shared/api/clients/flood/FloodAdapter.ts
    M extension/src/shared/lib/buildInfo.ts
    M extension/src/shared/lib/vpn/VPNService.ts
    M extension/vitest.config.ts
    M extension/vitest.setup.ts
- Untracked non-RAIDEN items: .worktrees/, agent-ledger/, audit-reports/, reports/, extension audit files.
- installed_edict_version in .raiden/instance/metadata.json: 0.2.0

─── PHASE 1: CLEAN THE WORKING TREE ───────────────────────────────────────────

Step 1 — Handle operator WIP tracked files (the 6 extension/ and vitest files above):
  Option A (preferred if WIP is complete): commit them in a separate operator commit first.
    git add extension/src/shared/api/clients/aria2/Aria2Adapter.ts \
             extension/src/shared/api/clients/flood/FloodAdapter.ts \
             extension/src/shared/lib/buildInfo.ts \
             extension/src/shared/lib/vpn/VPNService.ts \
             extension/vitest.config.ts \
             extension/vitest.setup.ts
    git commit -m "<appropriate operator commit message for these changes>"
  Option B (if WIP is not ready): stash it.
    git stash push -m "wip: extension changes before RAIDEN install commit"
  Do NOT include WIP files in the RAIDEN install commit.

Step 2 — Confirm which branch the RAIDEN commit should land on.
  CTRL is on next/main-rebuild. The RAIDEN install commit must go on main.
  If on next/main-rebuild: git checkout main
  Confirm with operator before switching if there are any concerns about branch state.

Step 3 — Ensure .gitignore has the canonical audit-output exclusion block.
  Check for all three lines:
    # RAIDEN audit outputs — operational findings, not framework content
    audit-reports/
    .raiden/state/AUDIT_LOG.md
    .raiden/state/last-audit.md
  If any are absent, append the full block. If all present, no-op.

Step 4 — Commit the v0.2.0 RAIDEN install on main.
  Stage ONLY these files:
    AGENTS.md
    .raiden/  (entire directory)
    .gitignore  (only if modified in step 3)
  Do NOT stage: agent-ledger/, reports/, audit-reports/, .worktrees/, or any extension WIP.
  Suggested commit message:
    "install: RAIDEN Instance v0.2.0"

Step 5 — Verify clean tree.
  Run: git status --porcelain
  Expected: empty (or only stashed changes not shown).
  If non-empty: stop and surface to operator before proceeding to Phase 2.

─── PHASE 2: RAIDEN CENTRAL MIGRATION (operator triggers this) ─────────────────

After Phase 1 is complete and the tree is clean, signal to the operator:

  "CTRL working tree is clean on main. RAIDEN central can now run the v0.4.0 migration.
   From /mnt/e/Raiden, run the batch migration prompt targeting --instance /mnt/e/CTRL.
   The migration will write: .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md, update
   .raiden/instance/baseline.json and metadata.json, append ## Workspace Audit to
   .raiden/README.md, and write .raiden/local/prompts/audit-protocol-install-handoff.md."

Wait for the operator to confirm that RAIDEN central has completed the migration before
proceeding to Phase 3. The signal is: RAIDEN central reports the plan validator confirms
"Block reason: Already up to date."

─── PHASE 3: VERIFY AND COMMIT MIGRATION FILES ─────────────────────────────────

After RAIDEN central signals completion:

Step 6 — Run: git status --porcelain
  Confirm only the migration files appear as modified/untracked. No unexpected files.

Step 7 — Run: grep installed_edict_version .raiden/instance/metadata.json
  → expected: "0.4.0"

Step 8 — Run from /mnt/e/Raiden/toolkit/updater/:
    python3 -m raiden_updater.cli plan \
      --instance /mnt/e/CTRL \
      --package /mnt/e/Raiden/toolkit/updater/fixtures/sample_package
  → expected: Block reason: Already up to date — no changes needed
  If any other result: stop and surface to operator.

Step 9 — Commit migration files:
    .raiden/writ/WORKSPACE_AUDIT_PROTOCOL.md
    .raiden/instance/baseline.json
    .raiden/instance/metadata.json
    .raiden/README.md
    .raiden/local/prompts/audit-protocol-install-handoff.md
  Suggested commit message:
    "install: RAIDEN Edict v0.2.0 → v0.4.0 (WORKSPACE_AUDIT_PROTOCOL install)"

Step 10 — Run: git status --porcelain — confirm clean.

Step 11 — If you stashed operator WIP in Phase 1 (Option B), re-apply it now:
    git stash pop
  Then switch back to next/main-rebuild if needed:
    git checkout next/main-rebuild
    git merge main  (or cherry-pick the RAIDEN commits — operator decides)

─── ADDITIONAL NOTE: LOOP-0015 ──────────────────────────────────────────────────

CTRL has a legacy agent-ledger/ directory (LOOP-0015, open). That migration is a
separate task and out of scope here. Do not include agent-ledger/ in any commit from
this prompt.

Do not:
- Modify any managed file in .raiden/writ/
- Reopen settled naming or architecture
- Treat review artifacts as canon unless adopted
- Broaden the task beyond the three phases above
- Run the workspace audit

Close out with:
- result: Phase 1 commit SHA (v0.2.0 install), Phase 3 commit SHA (v0.4.0 migration)
- evidence checked: git log, plan validator output, version grep
- remaining risks: LOOP-0015 (agent-ledger); stash re-apply if WIP was stashed;
  branch merge decision (next/main-rebuild ← main RAIDEN commits)
