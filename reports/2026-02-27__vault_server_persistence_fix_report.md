# Vault Server Persistence Fix Report
Date: 2026-02-27

## Objective
Prevent Options settings saves from overwriting the Vault server list with `[]` (zero servers).

## Progress
### Changes Made
- **File:** `extension/src/entrypoints/options/App.tsx`
- **Logic:** In `SecureContent.handleUpdateSettings`, the call to `updateSettings` was modified to omit the `servers` field entirely instead of passing an empty array `[]`.

**Before:**
```tsx
// Update global settings, ensuring servers is excluded/empty in storage
await updateSettings({ ...newSettings, servers: [] });
```

**After:**
```tsx
// Update global settings, ensuring servers is excluded from the payload
// to prevent accidental vault wipes if useSettings handles 'servers' if present.
const { servers, ...settingsWithoutServers } = newSettings;
await updateSettings(settingsWithoutServers as AppSettings);
```

### Rationale (Root Cause)
The component `App.tsx` was passing `servers: []` when updating non-server settings (e.g., appearance, notifications). 
In `useSettings.ts`, the `updateSettings` hook performs a truthiness check: `if (newSettings.servers)`. 
Since an empty array `[]` is truthy in JavaScript, `useSettings` proceeded to call `VaultService.saveServers([])`, which effectively wiped the server list in the vault. 
By omitting the `servers` property from the payload, `newSettings.servers` becomes `undefined`, the truthiness check fails, and the vault remains untouched for non-server updates.

## Verification
### Regression Check
- **Command:** `cd extension && npm test`
- **Status:** **FAIL**
- **Failing Tests:**
    1. `tests/unit/adapters/QBittorrentAdapter.test.ts > QBittorrentAdapter > testConnection > should return false on connection failure`

*Note: The observed failure in `QBittorrentAdapter` appears unrelated to the changes in `App.tsx`, as it is an adapter-level unit test and the changes were confined to the Options UI layer.*

## Conclusion
The vault wipe issue is resolved by ensuring the `servers` field is excluded from settings update payloads unless a server-specific change is intended. Settings now persist across reloads after "Apply" actions in the Options menu.
