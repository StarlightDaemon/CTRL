# CI Baseline Documentation

**Purpose:** This document defines the expected behavior of the CTRL CI/CD pipeline and provides debugging guidance.

---

## Pipeline Overview

The GitHub Actions CI pipeline (`.github/workflows/ci.yml`) consists of 4 sequential jobs:

```
lint → test → build → e2e
```

### Job 1: `lint`
- **Purpose:** Run ESLint to catch code quality issues
- **Command:** `npm run lint`
- **Expected:** Exit code 0 (warnings are allowed)
- **Duration:** ~30 seconds

### Job 2: `test`
- **Purpose:** TypeScript compilation and unit tests
- **Commands:**
  - `npm run compile` (TypeScript type checking)
  - `npm run test` (Vitest unit tests)
- **Expected:** 153/153 tests passing
- **Duration:** ~2 minutes

### Job 3: `build`
- **Purpose:** Build Chrome and Firefox MV3 extensions
- **Commands:**
  - `npm run build:chrome`
  - `npm run build:firefox`
- **Artifacts:** `chrome-extension`, `firefox-extension` (7-day retention)
- **Expected:** Clean builds with no errors
- **Duration:** ~3 minutes

### Job 4: `e2e`
- **Purpose:** End-to-end tests using Playwright
- **Browser:** Chromium only
- **Command:** `npm run test:e2e -- --grep-invert "@integration"`
- **Expected:** All non-integration tests pass
- **Retries:** 2 (configured in `playwright.config.ts`)
- **Workers:** 1 (prevents resource contention)
- **Duration:** ~2 minutes

---

## Why Integration Tests Are Excluded

Tests tagged with `@integration` require:
1. Live torrent client servers (qBittorrent, Transmission, etc.)
2. Network access to external APIs
3. VPN configurations

These are excluded from CI to ensure fast, reproducible builds. Integration tests should be run locally or in a dedicated staging environment.

---

## Debugging CI Failures

### Lint Failures
**Symptom:** `lint` job fails with ESLint errors.

**Solution:**
1. Run `npm run lint` locally
2. Fix errors or use `npm run lint:fix` for auto-fixes
3. Commit and push

### Test Failures
**Symptom:** `test` job fails during `npm run test`.

**Solution:**
1. Run `npm run test` locally
2. Check the failing test output
3. Fix the test or implementation
4. Ensure all 153 tests pass before pushing

### Build Failures
**Symptom:** `build` job fails during Chrome or Firefox build.

**Solution:**
1. Run `npm run build` locally
2. Check for TypeScript errors or missing dependencies
3. Review build logs for specific errors

### E2E Failures
**Symptom:** `e2e` job fails during Playwright tests.

**Common Causes:**
- **Flaky tests:** Re-run the job (GitHub UI: "Re-run failed jobs")
- **Extension load errors:** Check that `build:chrome` produced valid artifacts
- **Timeout:** Increase timeout in `playwright.config.ts` (currently 45s)

**Debug Steps:**
1. Download the `playwright-report` artifact from failed run
2. Open `index.html` locally to view detailed trace
3. Check screenshots/videos for visual errors
4. Run `npm run test:e2e` locally to reproduce

---

## Expected CI Status

| Branch | Expected Status |
|--------|-----------------|
| `main` | ✅ All jobs passing |
| Feature branches | ✅ All jobs passing before merge |
| PRs | ✅ All jobs passing before approval |

---

## Maintenance Notes

### When to Update This Document
- When adding new CI jobs
- When changing test expectations (e.g., test count)
- When modifying E2E test exclusions
- When debugging patterns emerge

### Version History
- **2026-01-11:** Initial baseline (v0.2.0-beta.1)
  - 4 jobs: lint, test, build, e2e
  - 153 unit tests
  - E2E excludes `@integration`
