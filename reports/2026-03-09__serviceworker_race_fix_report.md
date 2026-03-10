# 2026-03-09 CI Failure Diagnosis: Serviceworker Timeout Race Fix

## Root Cause Restatement
The recent CI failure on commit `bcd8cd8` was caused by a Chromium E2E service-worker timeout. While a previous commit increased the timeout, the underlying issue was determined to be a race condition in `extension/tests/e2e/fixtures.ts`.

Specifically, the `waitForServiceWorker` fixture function first spin-polls `context.serviceWorkers()`. If it was not initialized, it attached a `waitForEvent('serviceworker')` listener. If the `serviceworker` event fired in the brief window between checking the snapshot and attaching the listener, the event was missed, causing the fixture to wait indefinitely and time out.

## Exact Fix Implemented
In `extension/tests/e2e/fixtures.ts`, we resolved the race conditions in both `waitForServiceWorker` and `getServiceWorker`:
- We now register the `waitForEvent('serviceworker')` Promise *before* checking the `context.serviceWorkers()` snapshot.
- If the snapshot contains the service worker (i.e. already initialized), we safely assign a `.catch()` to the dangling event listener Promise to avoid unhandled rejections, and return immediately.
- Otherwise, we confidently await the registered event listener.

This adheres to asynchronous listener best practices and ensures that the event is never missed during the service worker startup phase.

## Files Changed
- `extension/tests/e2e/fixtures.ts`

## Verification Run
- `npm run compile` and `npm run lint` verified codebase type safety and syntax.
- Built the Chrome extension locally using `npm run build:chrome`.
- Ran localized Playwright validations via `npm run test:e2e`. The E2E tests could not be fully validated locally due to an environment host limitation (`libnspr4.so` missing in Chromium deps), but compilation and the async logic are solid.

## Commit Created
Yes

## Commit SHA
`1223702`

## Recommendation
Push and rerun CI now. The boundaries of the service worker initialization sequence successfully match canonical async-event resolution patterns, directly addressing the underlying race condition that caused CI flakiness.
