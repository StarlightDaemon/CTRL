# Remote vs. Local Repository Audit
**Timestamp:** 2026-03-08 00:15:00-07:00

## 1. Remote Alignment

### Remote URLs
- `origin`: https://github.com/StarlightDaemon/CTRL.git (fetch/push)

### SHA Comparison
- `main` (local): `b7aef75bd925a4cd49018fc4afad997b46fb7fc6`
- `origin/main` (remote): `d53596b23614f6db160ccb4b3080fe8802d546e0`

### Ahead/Behind Status
- **Ahead:** 1 commit
- **Behind:** 0 commits

---

## 2. Commit Drift

### Local-only Commits (Ahead)
- `b7aef75 (HEAD -> main) chore: Phase 1 stabilization - ESLint cleanup and documentation`

### Remote-only Commits (Behind)
- None

### Content Stat (origin/main..main)
```text
 CONTRIBUTING.md                                 |  61 +++-
 docs/adding-a-client.md                         | 342 +++++++++++++++++++
 extension/src/entrypoints/background.ts         |  16 +-
 .../services/LifecycleAdapter.ts                |  12 +-
 .../api/clients/rutorrent/RuTorrentAdapter.ts   |   2 +-
 .../clients/transmission/TransmissionAdapter.ts |  12 +-
 .../src/shared/api/network/HeaderRewriter.ts    |   4 +-
 extension/src/shared/ui/components/Card.tsx     |   3 +-
 8 files changed, 421 insertions(+), 31 deletions(-)
```

---

## 3. Uncommitted Working Tree Drift

### Overview
This section tracks local modifications that have not been committed. There is a significant amount of drift in the current workspace across many files.

### Summary Counts
- **Modified files:** 88
- **Deleted files:** 9
- **Untracked files:** 34

### Porcelain Output (Partial, first 60 lines)
```text
## main...origin/main [ahead 1]
 M .gitignore
 M README.md
 M docs/PRIVACY_POLICY.md
 D docs/decisions/001-use-fsd.md
 M extension/package.json
 M extension/playwright.config.ts
 D extension/src/app/providers/ThemeProvider.tsx
 D extension/src/app/providers/theme-tokens.ts
 M extension/src/app/styles/global.css
 M extension/src/entities/client/lib/ClientFactory.ts
 M extension/src/entities/torrent/model/Torrent.ts
 M extension/src/entities/torrent/ui/TorrentRow.tsx
 M extension/src/entrypoints/background.ts
 D extension/src/entrypoints/magnet-injection.ts
 D extension/src/entrypoints/offscreen.html
 M extension/src/entrypoints/options/App.tsx
 M extension/src/entrypoints/options/Dashboard.tsx
 M extension/src/entrypoints/options/OptionsLayout.tsx
 M extension/src/entrypoints/options/main.tsx
 M extension/src/entrypoints/popup/Popup.tsx
 M extension/src/entrypoints/popup/main.tsx
 M extension/src/entrypoints/style.css
 M extension/src/features/torrent-control/model/services/ContextMenuService.ts
 D extension/src/features/torrent-control/model/services/OffscreenManager.ts
 M extension/src/features/torrent-control/model/useSettings.ts
 M extension/src/features/torrent-control/model/useTorrentPoller.ts
 M extension/src/features/torrent-control/services/LifecycleAdapter.ts
 M extension/src/features/torrent-control/ui/AboutTab.tsx
 M extension/src/features/torrent-control/ui/AddTorrentDialog.tsx
 M extension/src/features/torrent-control/ui/Dashboard.tsx
 M extension/src/features/torrent-control/ui/DataManagement.tsx
 M extension/src/features/torrent-control/ui/DiagnosticsSettings.tsx
 M extension/src/features/torrent-control/ui/FunctionSettings.tsx
 M extension/src/features/torrent-control/ui/LayoutSettings.tsx
 D extension/src/features/torrent-control/ui/LegacySidebar.tsx
 M extension/src/features/torrent-control/ui/ServerConfigPanel.tsx
 M extension/src/features/torrent-control/ui/TorrentDashboard.tsx
 M extension/src/features/torrent-control/ui/Utilities.tsx
 M extension/src/features/torrent-control/ui/VirtualizedTorrentList.tsx
 M extension/src/features/torrent-control/ui/settings/ContextMenuSettings.tsx
 M extension/src/features/torrent-control/ui/settings/NotificationSettings.tsx
 M extension/src/features/torrent-control/ui/settings/PerformanceSettings.tsx
 M extension/src/features/torrent-control/ui/settings/ThemeSettings.tsx
 M extension/src/public/_locales/en/messages.json
 D extension/src/scripts/offscreen.ts
 M extension/src/shared/api/clients/aria2/Aria2Adapter.ts
 M extension/src/shared/api/clients/aria2/Aria2Schema.ts
 M extension/src/shared/api/clients/biglybt/BiglyBTAdapter.ts
 M extension/src/shared/api/clients/deluge/DelugeAdapter.ts
 M extension/src/shared/api/clients/deluge/DelugeSchema.ts
 M extension/src/shared/api/clients/flood/FloodAdapter.ts
 M extension/src/shared/api/clients/flood/FloodSchema.ts
 M extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts
 M extension/src/shared/api/clients/qbittorrent/QBittorrentSchema.ts
 M extension/src/shared/api/clients/synology/SynologyAdapter.ts
 M extension/src/shared/api/clients/transmission/TransmissionAdapter.ts
 M extension/src/shared/api/clients/transmission/TransmissionSchema.ts
 M extension/src/shared/api/clients/utorrent/UTorrentAdapter.ts
 M extension/src/shared/api/clients/utorrent/UTorrentSchema.ts
```

---

## 4. Worktree Context

### Active Worktrees
- `/mnt/e/CTRL`: [main] (Current workspace)
- `/tmp/CTRL-audit-clean`: (detached HEAD b7aef75)

### Status: `/tmp/CTRL-audit-clean`
- **HEAD:** `b7aef75bd925a4cd49018fc4afad997b46fb7fc6`
- **Dirty State:**
  - Modified: `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`
  - Untracked: `reports/`

---

## 5. Summary Note
The repository currently has **1 local commit** ahead of `origin/main`. However, the primary source of drift is the **uncommitted working tree**, which contains 88 modified files and 9 deletions. The `/tmp/CTRL-audit-clean` worktree is also slightly dirty but remains closely aligned with the local `main` commit.
