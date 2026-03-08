# Connectivity Pipeline Audit Report

### 1) Evidence alignment

**UI:** 
- "Save Server" is disabled if `permissionStatus !== 'granted'` (`extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`, line 389).
- Conditions causing UI state to update without vault persistence: The `saveServer` function calls `updateSettings` which updates React State immediately via `setSettings(newSettings)` (`extension/src/features/torrent-control/model/useSettings.ts`, line 140). The routine checks `(!await VaultService.isLocked())` before calling `saveServers(newSettings.servers)`. If the vault is locked or if `saveServers` throws an error, the `try-catch` explicitly swallows the error (line 148-152), leaving the UI correctly updated in memory but unmodified in the WXT persistent vault. Because `setSettings` executes successfully and no errors are raised to the user, the edits appear saved until a hard reload. 

**Vault:** 
- `VaultService.getServers()` throws `Error('Vault is locked')` if it cannot resolve a session key (`extension/src/shared/api/security/VaultService.ts`, line 85), or standard decoding errors if WXT ciphertext decryption fails.
- `VaultService.saveServers()` similarly throws `Error('Vault is locked')` if the session key is absent (`VaultService.ts`, line 108).
- These errors are completely swallowed by `updateSettings()` in `useSettings.ts` lines 145-152, logging only to console if `__UI_DEBUG_MODE__` is active.

**Resolver/background:** 
- For polling, the active server is sourced from the persistent vault: `ServersResolver.resolve()` pulls servers strictly from `VaultService.getServers()`, taking the active one via index (`extension/src/shared/api/server/ServerResolver.ts`, lines 44, 75).
- For `TEST_CONNECTION`, the target client is instantiated temporarily using only the unpersisted UI representation `message.config`: `await factory.create(message.config)` (`extension/src/entrypoints/background.ts`, lines 279-281).
- `activeClient` is cleared when global options change or when the Vault Data explicitly changes, governed by WXT watchers: `storage.watch(VAULT_DATA_KEY)` and `storage.watch<AppSettings>('local:options')` (`background.ts`, lines 259, 269).

**Test Connection:** 
- The UI strictly treats a top-level boolean `true` or an object with `success: true` as a successful response (`ServerConfigPanel.tsx`, line 175).
- A non-JSON response from a successful 200 HTTP request (e.g. hitting a Python web server or standard HTML page instead of Transmission Daemon) is returned by `FetchHttpClient` as a raw string. `TransmissionAdapter` subsequently asserts this string as an object lacking a `.result` parameter: `const rpcResponse = response as { result?: string }` (`TransmissionAdapter.ts`, line 224). The guard `if (rpcResponse.result && rpcResponse.result !== 'success'...)` therefore passes vacuously on the string, throwing no errors. The string propagates back out to `TransmissionAdapter.testConnection()`, which simply resolves `true` (`TransmissionAdapter.ts`, line 183), giving the UI an illegitimate connection success confirmation.

**Messaging:**
- The LNA (Local Network Access) warning specifies "Chrome may still block local IPs" but renders unconditionally across all browsers when `permissionStatus === 'granted' && isPrivateIP(tempServer.hostname)` evaluates to true (`ServerConfigPanel.tsx`, lines 365-373). It explicitly lacks browser exclusion checks (e.g. `navigator.userAgent`), unlike the strict `Access Denied` phrasing block above it.

### 2) Findings classification
- **UI state updates without vault persistence**: ROOT CAUSE (State update precedes persistence and silently ignores errors).
- **False positive Test Connection on non-JSON response**: ROOT CAUSE.
- **Chrome LNA warning missing browser guard**: ROOT CAUSE.
- **Background polling utilizes persisted config while Test Connection uses UI state**: CONFIRMED BEHAVIOR. 

### 3) Highest-leverage next action
Fix root cause

### 4) Execution Prompt

**Objective:**
Fix the swallowed persistence errors in `useSettings.ts` by ensuring UI state is only updated after a successful Vault write, and fix the false positive Test Connection success in `TransmissionAdapter.ts` by strictly validating that the RPC response is a valid JSON object.

**Scope boundary (explicit file list):**
- `extension/src/features/torrent-control/model/useSettings.ts`
- `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`

**Constraints:**
- Do NOT make unrelated changes to the manifest, CSP, permissions, architecture, telemetry, or other subsystems.
- Keep fixes to existing functions (enforce JSON shape, await persistence before UI state update).

**Requirements:**
- Produce a Markdown report detailing the root causes targeted and the structural logic of the implemented fixes.
- Include explicit file paths and line number references as evidence citations for the exact changes made within the report.
- Include a regression check confirmation using existing unit tests, explicitly stating `npm run test` or "not executed" if no tests exist.
