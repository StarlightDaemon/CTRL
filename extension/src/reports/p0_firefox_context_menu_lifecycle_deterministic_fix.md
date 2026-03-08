# P0: Firefox Context Menu Lifecycle — Deterministic Fix

## Executive Summary

Firefox MV3 context menus disappeared after background service worker restarts because the extension lacked an `onStartup` menu rebuild path. This fix adds deterministic menu recreation on every cold start, converts the `removeAll()` call from a callback pattern to Promise-based to prevent silent drops, and adds `runtime.lastError` checking on every `create()` call.

## Root Cause Classification

| # | Cause | Severity |
|---|-------|----------|
| 1 | **No `onStartup` menu rebuild** — `runtime.onStartup` only cleared the Firefox session key; it never triggered `setupMenus()`. After a browser restart, Firefox had zero registered context menu items. | Critical |
| 2 | **Callback-style `removeAll()`** — Used `removeAll(callback)` instead of Promise-based `await removeAll()`. If the callback was dropped during SW suspension, no menus were created. | Medium |
| 3 | **No `runtime.lastError` check on `create()`** — Silent duplicate-ID or quota errors were invisible. | Low |

## Lifecycle Event Matrix

| Event | Chrome MV3 | Firefox MV3 | Before Fix | After Fix |
|-------|-----------|-------------|-----------|----------|
| `runtime.onInstalled` | Fires | Fires | ✅ Rebuilds | ✅ Rebuilds |
| `runtime.onStartup` | Fires | Fires | ❌ **No rebuild** | ✅ Rebuilds |
| Background script load | Menus persist | Menus lost | ✅ (via `initialize()`) | ✅ |
| Storage change | Watcher fires | Watcher fires | ✅ | ✅ |
| Extension reload | `onInstalled` | `onInstalled` | ✅ | ✅ |

## Files Changed

| File | Change |
|------|--------|
| [ContextMenuService.ts](file:///mnt/e/CTRL/extension/src/features/torrent-control/model/services/ContextMenuService.ts) | Promise-based `removeAll()`, `safeCreate()` helper, `ensureMenus()` public method |
| [background.ts](file:///mnt/e/CTRL/extension/src/entrypoints/background.ts) | `onStartup` listener now calls `contextMenuService.ensureMenus()` |
| [ContextMenuService.test.ts](file:///mnt/e/CTRL/extension/tests/unit/ContextMenuService.test.ts) | Updated mocks for Promise API; 3 new lifecycle tests |

## Before/After Behavior

| Scenario | Before | After |
|----------|--------|-------|
| Browser cold start (Firefox) | Menus missing until a storage event fires | Menus recreated immediately via `onStartup` |
| `removeAll()` during SW suspension | Callback silently dropped; no menus created | Promise-based; awaited before menu creation |
| Duplicate menu ID error | Invisible | Logged via `runtime.lastError` in `safeCreate()` |
| Browser cold start (Chrome) | Menus persisted (no change needed) | `ensureMenus()` fires but is harmless |

## Verification Results

| Check | Result |
|-------|--------|
| `npm run test` | ✅ 339/339 passed (16 files) |
| `npm run compile` | ✅ Zero type errors |
| `npm run build:firefox` | ✅ 40.69 MB, exit 0 |
| `npm run build:chrome` | ✅ 40.69 MB, exit 0 |

## Verification Checklist (Firefox Clean Profile + Reload Test)

- [ ] Load extension from `builds/firefox-mv3/` in `about:debugging`
- [ ] Set vault password → Add server → Right-click link → "Add to Torrent Control" appears
- [ ] Click "Reload" in `about:debugging` → Right-click link → Menu reappears
- [ ] Close Firefox entirely → Reopen → Unlock vault → Right-click link → Menu appears
- [ ] Chrome: Load from `builds/chrome-mv3/` → Context menus work and persist across reload

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| `ensureMenus()` double-fires with `initialize()` | None | `isUpdating` serialization guard prevents races |
| Chrome regression | None | `onStartup` + `ensureMenus()` is a no-op when menus are already registered |
| `safeCreate()` callback overhead | Negligible | Callback only logs on error; no functional change |
