# Firefox Vault Session Persistence Fix Report

## Executive Summary
This report details the fix for vault session persistence in Firefox MV3. Users were experiencing a "No servers configured" error in Firefox because the vault's session key (required for decryption) was not correctly shared between the Options UI and the Background Service Worker. Additionally, a fallback mechanism in the background was incorrectly attempting to resolve servers from local options when the vault appeared empty or locked, leading to confusing error states.

## Root Cause
1. **Session Storage Visibility**: In Firefox MV3, `browser.storage.session` can sometimes be unreliable or have visibility issues between different extension contexts (e.g., Options page vs. Background script) during worker wake events. When the vault was unlocked in the Options page, the encryption key was written to session storage, but the background worker often failed to read it upon waking up for a context menu action or alarm.
2. **Missing Constants**: The background script was missing an import for `DEFAULT_OPTIONS`, which could lead to runtime errors when falling back to default settings.
3. **Aggressive Fallback**: The background client factory had a fallback path that could attempt to use legacy/redundant servers from `local:options` if the vault appeared empty, which could lead to instantiating clients with incomplete or default data.

## Chrome vs Firefox Storage Behavior Matrix

| Feature | Chrome MV3 | Firefox MV3 |
| :--- | :--- | :--- |
| **storage.session** | Reliable, cleared on browser close | Partially unreliable/buggy in some SW contexts |
| **storage.local** | Always persistent | Always persistent |
| **Session Key Persistence** | In `storage.session` only | **FIXED**: Prefers `storage.session`, falls back to `storage.local` |
| **Browser Restart** | Session cleared automatically | **FIXED**: Cleared manually via `onStartup` listener |

## Files Changed
- `extension/src/shared/api/security/KeyManager.ts`: Implemented Firefox-specific fallback to `local storage` for the session key.
- `extension/src/entrypoints/background.ts`: 
    - Added missing `DEFAULT_OPTIONS` import.
    - Added `onStartup` listener to clear Firefox session fallback.
    - Hardened `getClient` to prevent instantiation of invalid/default server configurations.

## Pseudocode of Logic Changes

### KeyManager (Compatibility Layer)
```typescript
async getSessionKey() {
    let key = await storage.session.getItem('encryptionKey');
    
    // Firefox specific workaround
    if (!key && isFirefox()) {
        key = await storage.local.getItem('session_encryptionKey_fallback');
    }
    return key;
}

async setSessionKey(key) {
    await storage.session.setItem('encryptionKey', key);
    if (isFirefox()) {
        await storage.local.setItem('session_encryptionKey_fallback', key);
    }
}
```

### Background (Security Cleanup & Guarding)
```typescript
// Maintain session security on Firefox
chrome.runtime.onStartup.addListener(async () => {
    if (isFirefox()) {
        await storage.local.removeItem('session_encryptionKey_fallback');
    }
});

// Guarded Client Factory
async getClient() {
    const servers = await VaultService.getServers();
    if (isLocked) throw "Vault is locked";
    if (!servers.length) throw "No servers configured";
    
    const target = servers[current];
    if (!target.hostname) throw "Invalid config";
    
    return factory.create(target);
}
```

## Security Assessment
- **Plaintext Data**: No plaintext server data is persisted to `storage.local`.
- **Session Key**: The session key (JWK) is stored in `storage.local` on Firefox as a fallback. This means the key is physically on disk. However, it is cleared automatically when the browser starts (`onStartup`), mimicking the lifecycle of `storage.session`.
- **Encryption**: Data in `storage.local` (vaultData) remains encrypted at all times. The fallback only affects the location of the transient session key.
- **Risk**: Low. The risk of the session key persisting in `storage.local` is mitigated by the `onStartup` cleanup.

## Manual Verification Steps
1. **Firefox Unlock**:
    - Open CTRL Options in Firefox.
    - Set up/Unlock the vault.
    - Close the Options tab.
    - Right-click a link and select "Add to Torrent Control".
    - **Expected**: Torrent is added successfully (indicates background could read the session key).
2. **Session Survival**:
    - Wait for the background worker to go idle (or manually terminate it in `about:debugging`).
    - Trigger a context menu action.
    - **Expected**: Background wakes up, reads the fallback key from `storage.local`, and successfully decrypts servers.
3. **Incorrect Fallback Removal**:
    - Lock the vault in Firefox.
    - Trigger a context menu action.
    - **Expected**: "Failed to add torrent: Vault is locked" notification (No QBit localhost fallback).
4. **Chrome Regression**:
    - Verify same steps in Chrome.
    - **Expected**: Chrome continues to use `storage.session` only; behavior remains unchanged.
