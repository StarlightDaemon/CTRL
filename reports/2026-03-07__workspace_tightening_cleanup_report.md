# Workspace Tightening Cleanup Report

## 1. Current Repository State Evidence

- **Branch**: `main`
- **HEAD SHA**: `b7aef75bd925a4cd49018fc4afad997b46fb7fc6`

### Commands Executed & Key Outputs
*Note: Full outputs for `status`, `diff`, and `ls-files` contained hundreds of lines and were captured to a temporary directory during execution.*

```bash
git branch --show-current
# Output: main

git rev-parse HEAD
# Output: b7aef75bd925a4cd49018fc4afad997b46fb7fc6

git status --porcelain=v1
# Output: Evaluated 88 modified, 9 deleted, and numerous untracked files

git diff --numstat | sort -nr | head -n 10
```

**Top 10 Largest Diffs (Lines Added/Removed):**
1. `1219 / 80` - `extension/tests/unit/adapters/TransmissionAdapter.test.ts`
2. `1000 / 7` - `extension/src/shared/api/clients/biglybt/BiglyBTAdapter.ts`
3. `880 / 43` - `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`
4. `597 / 43` - `extension/src/shared/api/clients/deluge/DelugeAdapter.ts`
5. `563 / 46` - `extension/src/shared/api/clients/aria2/Aria2Adapter.ts`
6. `528 / 54` - `extension/src/shared/api/clients/flood/FloodAdapter.ts`
7. `397 / 34` - `extension/tests/unit/adapters/Aria2Adapter.test.ts`
8. `350 / 127` - `extension/src/features/torrent-control/model/services/ContextMenuService.ts`
9. `349 / 42` - `extension/src/shared/api/clients/utorrent/UTorrentAdapter.ts`
10. `348 / 0` - `extension/src/public/_locales/en/messages.json`

## 2. Worktree Preparation

- **Worktree Path**: `/tmp/CTRL-audit-clean`
- **Verification**:
```bash
git worktree add /tmp/CTRL-audit-clean HEAD
cd /tmp/CTRL-audit-clean && git status --porcelain
```
*Result: Command produced empty output, confirming the clean state of the new worktree matching HEAD.*

## 3. Untracked Noise Reduction & Workspace State

Minimal ignores for explicitly generated output files were added to `.gitignore`. No source code or documentation paths were ignored.

| Metric | Before `.gitignore` Update | After `.gitignore` Update |
|---|---|---|
| Tracked Modified Files | 88 | 89 (+ `.gitignore`) |
| Deleted Tracked Files | 9 | 9 |
| Untracked Files | 110 | 107 |

**Exact File Paths Changed by Cleanup:**
- `.gitignore`
- `reports/2026-03-07__workspace_tightening_cleanup_report.md` (this report)

**Added to `.gitignore`:**
```text
# Generated UI exported data and build logs
ctrl-servers-full-*.json
extension/build_log.txt
```

## 4. WIP Isolation Recommendation

To continue active development securely without risking data loss, and to allow overnight audits to proceed smoothly against a stable baseline, we recommend the following isolation workflow:

1. **Continue WIP safely in the primary tree**: All your uncommitted changes remain exactly as they were in `/mnt/e/CTRL`. Continue doing your development in this primary workspace. The current branch remains `main` and no changes were reset. 
2. **Perform Audits on the Clean Worktree**: Point all incoming read-only or baseline audits directly to `/tmp/CTRL-audit-clean`. Because it was checked out as a separate git worktree connected to the same repository, it guarantees an exact representation of `HEAD` (`b7aef75`) with absolute 0 uncommitted modifications or untracked file clutter. This ensures the audits will run deterministically without touching your primary WIP directory.
3. **End of audit cycle**: Once the audits are fully finalized and closed, the temporary worktree can be cleanly disposed of without any impact using `git worktree remove /tmp/CTRL-audit-clean` from your primary workspace.
