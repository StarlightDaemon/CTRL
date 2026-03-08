# Test Connection UI Error Display Fix Report

## Overview
The "Test Connection" feature in the Server Configuration Panel was previously hard-coded to display "Authentication Failed" for any non-successful response from the background script. This report documents the fix to display the actual error message returned by the background (e.g., "Vault is locked", "Cannot reach server").

## Changes
### UI Update
**File:** `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`
**Lines:** 162-171

Replaced the hard-coded "Authentication Failed" message with logic that checks for a structured error response from the background.

**Before:**
```tsx
            if (res === true) {
                setTestStatus({ loading: false, success: true, message: 'Connection Successful!' });
            } else {
                setTestStatus({ loading: false, success: false, message: 'Authentication Failed' });
            }
```

**After:**
```tsx
            if (res === true) {
                setTestStatus({ loading: false, success: true, message: 'Connection Successful!' });
            } else if (res && typeof res === 'object' && typeof res.error === 'string' && res.error) {
                setTestStatus({ loading: false, success: false, message: res.error });
            } else if (res === false) {
                setTestStatus({ loading: false, success: false, message: 'Connection failed' });
            } else {
                setTestStatus({ loading: false, success: false, message: 'Connection Error' });
            }
```

## Rationale
The background script handles errors in a `catch` block (around `extension/src/entrypoints/background.ts:410-413`) and returns them as an object with an `error` property:

```typescript
410:             } catch (e: unknown) {
411:                 const errorMessage = e instanceof Error ? e.message : String(e);
412:                 console.error('Background Error:', e);
413:                 return { error: errorMessage };
414:             }
```

Previously, `ServerConfigPanel.tsx` (lines 162-166) ignored this structure and always displayed "Authentication Failed" if `res !== true`, leading to misleading user feedback when the actual issue might be a locked vault or a network timeout.

## Regression Check
**Command:** `cd extension && npm test`
**Results:** PASS

```
 Test Files  16 passed (16) 
      Tests  354 passed (354)
   Start at  02:45:29       
   Duration  79.12s
```

All 354 tests passed, confirming no regressions were introduced by this change.
