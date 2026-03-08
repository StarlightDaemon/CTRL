# P0 Audit: Chrome Context Menu Missing

**Status:** Implementation Complete (Build Verified)  
**Date:** 2026-02-08  
**Severity:** P0 (Release Blocking)

## Executive Summary
The context menu fails to appear on fresh installations of the extension. The root cause is a strict gating condition in `ContextMenuService.ts` that aborts menu creation if the `local:options` storage key is missing. On a fresh install, this key is `null` until the user manually saves settings.

A secondary issue exists where the "Unlock CTRL" menu item would appear for uninitialized vaults, which is confusing. The remediation plan addresses both by checking for defaults and distinguishing between "Locked" and "Uninitialized" states.

## Findings Table

| Location | Gate / Condition | Observed Effect | Proposed Fix |
| :--- | :--- | :--- | :--- |
| `ContextMenuService.ts:38` | `if (!settings) return;` | **BLOCKER:** Aborts initialization if settings haven't been saved yet (fresh install). | Fallback to `DEFAULT_OPTIONS` if storage is empty. |
| `ContextMenuService.ts:47` | `VaultService.isLocked()` | **CONFUSING:** identifying uninitialized vault as "locked". | Differentiate state; show "Setup CTRL" vs "Unlock CTRL". |
| `background.ts:108` | `initialize()` called on SW start | Correct. Runs on startup. | N/A |
| `ContextMenuService.ts:57` | `chrome.contextMenus.create` | Correct. Uses `chrome` API (MV3 compliant). | N/A |

## Findings Detail

### A) Menu Creation Logic
Context menus are created in `ContextMenuService.ts`. The service is initialized in `background.ts` on Service Worker startup. It correctly uses `chrome.contextMenus` API.

### B) Lifecycle
The logic runs on every Service Worker start (`background.ts` top-level execution calls `initialize`). This is correct for MV3.

### C) Gating Conditions
The primary failure is the check for user settings:
```typescript
const settings = await storage.getItem<AppSettings>('local:options');
if (!settings) return; // <--- FAILS HERE ON FRESH INSTALL
```
`wxt/storage` returns `null` for keys that have never been written.

### D) Context Registration
The extension registers for `['link', 'selection']` for the main "Add to Torrent Control" action. This is correct and ensures functionality across magnet links and standard .torrent links.

### E) Error Hygiene
The service is wrapped in try/catch blocks (lines 268-285) during execution, but the *initialization* phase (setupMenus) silently fails if `settings` is null.

## Remediation Plan (Trivial Fix)

We will apply the following "Minimal Safe Fix":
1.  **Import Defaults:** Import `DEFAULT_OPTIONS` in `ContextMenuService.ts`.
2.  **Apply Fallback:** Change the settings retrieval to use defaults if null.
3.  **Improve Setup UX:** Detect if the Vault is uninitialized vs. locked, and update the fallback menu item title accordingly ("Setup" vs "Unlock").

### Context Registration Matrix

| Menu Item | Gate | Contexts | Logic |
| :--- | :--- | :--- | :--- |
| **Add to Torrent Control** | Default (Mode 1) | `link`, `selection` | Visible if Vault unlocked (or uninitialized treated as locked/setup). |
| **Scan Page** | Default (Mode 1) | `page`, `frame` | Visible if Vault unlocked. |
| **Setup CTRL** | Vault Uninitialized | `link`, `selection`, `page` | **NEW:** Directs user to Options. |
| **Unlock CTRL** | Vault Locked | `link`, `selection`, `page` | Directs user to Options. |

## Verification Plan
1.  **Build:** `npm run build:chrome`
2.  **Install:** Load unpacked extension (clean profile/new install).
3.  **Verify:** Right-click context menu should show "Setup CTRL..." or "Add to Torrent Control" immediately.
4.  **Action:** Clicking "Setup" should open Options.
