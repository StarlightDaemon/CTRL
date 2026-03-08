# QBittorrent 401 Login Handling Fix Report

## Overview
Added HTTP 401 handling to the qBittorrent adapter's `login()` method. Now, invalid-credential responses with a 401 status correctly increment `loginAttempts` (enabling lockout/backoff protection) and produce a consistent "Authentication Failed" error, matching the existing 403 handling.

## Changes Made

### 1. `extension/src/shared/api/clients/qbittorrent/QBittorrentAdapter.ts`
**Lines 110-120:**
Updated the `catch` block in `login()` to handle `error.status === 401` alongside `403`. 
The code now properly detects IP bans for both statuses, increments `loginAttempts`, and throws an error that includes the status text (either "401 Unauthorized" or "403 Forbidden") and the number of remaining attempts before lockout protection is triggered.

### 2. `extension/tests/unit/adapters/QBittorrentAdapter.test.ts`
**Lines 101-121:**
Added unit coverage for the new 401 handling behavior in the `login` describe block:
- **Test 1:** `should throw error on 401 Unauthorized response`
  Stubs `auth/login` to return `ok: false, status: 401` and asserts that `adapter.login()` rejects with an "Authentication Failed (401 Unauthorized)" error.
- **Test 2:** `should track 401 failures and trigger lockout guard`
  Repeats 401 failures exactly enough times (4 times) to trigger the lockout guard (`Login attempts exhausted`), proving the attempts are accurately counted.

## Regression Check
Execution of `cd extension && npm test` passed successfully, with all unit tests passing.

**Result Summary:**
```text
 Test Files  16 passed (16)
      Tests  326 passed (326)
```
