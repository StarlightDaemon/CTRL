# LNA Save Guard Fix Report

- **Date:** 2026-02-27
- **Target File:** `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`

## Changes Summary

Updated the "Save Server" button to be disabled if host permissions for the target origin have not been granted. This ensures that users cannot save a server configuration that will inevitably fail due to lack of network permissions (particularly relevant for Local Network Access / private IPs).

### File Evidence

- **File Path:** `/mnt/e/CTRL/extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`
- **Lines:** 354-356
- **Changes:**
  - `disabled` prop updated: `disabled={vaultStatus === 'Vault: Locked' || !hasPermission}`
  - `className` updated to apply disabled styling when `!hasPermission` evaluates to `true`.

## Rationale
The fix addresses a root cause identified in `reports/2026-02-25__lna_permissions_audit.md`. Previously, the "Save Server" button ONLY checked for vault lock status. This allowed users to save a server for a local endpoint (e.g., `192.168.x.x`) even if they had not yet granted Local Network Access permissions via the browser's permission UI. By blocking the save action until permissions are granted, we prevent a silent failure state at runtime where background scripts would be unable to connect to the saved server.

## Regression Check
- **Command:** `cd extension && npm test`
- **Results:** PASS
  - 16 Test Files passed
  - 354 Tests passed
  - Duration: ~77s
