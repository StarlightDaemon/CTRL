# Report: Firefox Context Menu Not Appearing After Server Save

## Root Cause
The context menu registration logic in `ContextMenuService` was missing key storage triggers for Firefox-specific recovery. 
1. **Missing Watchers**: The service was watching `local:options`, `local:vaultData`, and `session:encryptionKey`, but it was NOT watching:
   - `local:vaultSalt`: Essential for detecting the transition from "Uninitialized" to "Locked" during fresh installs.
   - `local:session_encryptionKey`: The Firefox fallback for persistent session encryption keys.
2. **Race Conditions**: Rapid storage events (e.g., initialization followed by server save) triggered concurrent `removeAll()` and `create()` cycles. In MV3, these async operations can race, leading to duplicated or missing IDs in the browser's context menu registry.

## Files Changed
- [ContextMenuService.ts](file:///mnt/e/CTRL/extension/src/features/torrent-control/model/services/ContextMenuService.ts)

## Before/After Behavior
- **Before**: In Firefox, after initializing the vault and adding a first server, the context menu would often remain stuck on "Setup CTRL..." or show nothing until a manual background worker restart or the next Chrome/Firefox restart.
- **After**: The menu now detects `vaultSalt` and `fallback_sessionKey` changes immediately. Concurrency protection ensures that only one update cycle runs at a time, preventing registration collisions.

## Technical Details
- Added `VAULT_SALT_KEY` watcher to `initialize()`.
- Added `FALLBACK_SESSION_KEY` (`local:session_encryptionKey`) watcher for Firefox.
- Implemented `isUpdating`/`pendingUpdate` concurrency flag in `setupMenus()` to serialize menu rebuilds.
- Added `chrome.runtime.onInstalled` listener to ensure a clean menu state on installation or extension updates.

## Manual Verification Steps (Firefox)
1. **Fresh Install**: Right-click a link -> Menu shows "Setup CTRL to add torrents".
2. **Initialize Vault**: Options page -> "Set Password".
3. **Add Server**: Add a server configuration.
4. **Verify Update**: Right-click a link immediately -> Menu should show "Add to Torrent Control" (or "Unlock..." if lock was triggered).
5. **Multiple Servers**: Add a second server -> Verify the menu expands with server selection items.

## Chrome Smoke Check
- Verified successful context menu appearance and functionality in Chrome. No regressions in menu registration triggers.
