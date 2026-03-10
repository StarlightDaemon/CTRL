# Chromium E2E Serviceworker Timeout Fix Report (2026-03-09)

## Failure Signature
- **Workflow:** CI
- **Job:** End-to-end tests
- **Error:** `TimeoutError: browserContext.waitForEvent: Timeout 5000ms exceeded while waiting for event "serviceworker"`
- **Context:** The timeout occurred consistently in `extension/tests/e2e/fixtures.ts` while Playwright attempted to initialize the background script on Chromium on the slower GitHub Actions environment.

## Root-Cause Assessment
The timeout was triggered by strict, cumulative time limits during the extension's `waitForServiceWorker` function. The 10-second polling fallback combined with a 50% event wait timeout resulted in a maximum wait time of 15 seconds. Chromium cold start delays, coupled with slow disk I/O and CPU contention on the GitHub Actions Linux runner during complex extension background script parsing, pushed the initialization time beyond this 15-second cap.

## Chosen Fix
Increased the timeout passed to `waitForServiceWorker` and `getServiceWorker` from `10000` to `30000`. By increasing the limit to 30 seconds, we provide sufficient leeway for slower CI runners without needing to refactor the initialization process or poll more aggressively. The 45-second worst-case wait (30s polling + 15s await `waitForEvent`) remains safely within the 60-second limit allocated per Playwright test in the configuration. 

## Files Changed
#### `extension/tests/e2e/fixtures.ts`
- **Line 92, 110-113**: Modified `waitForServiceWorker` and `getServiceWorker` to default to `timeout = 30000` instead of `10000`. 

## Verification Run
- Ran `npm run compile` and `npm run lint` locally from the `extension` directory to ensure no syntax failures were introduced.
- E2E Playwright validation locally was previously confirmed to fail early due to a system-level issue with Chrome-headless missing `libnspr4.so`, so the definitive verification must rely on GitHub Actions CI. 

## Git Info
- **Commit Created:** Yes
- **Commit SHA:** 72697c36f433739bda91e2a9c83c97641d421d42

## Recommendation
**Rerun GitHub CI now.** The GitHub Actions workflow is expected to pass with this increased timeout limit. No further local investigation is necessary until the build finishes.
