# Transmission RPC Investigation Export Pack (2026-02-20)

## 1. Provenance
- **Repository Head:** `b7aef75bd925a4cd49018fc4afad997b46fb7fc6`
- **Working Tree State:** 130 files modified/untracked (reflects active MV3 development and investigation artifacts).

## 2. Confirmed Behaviors
The following behaviors are confirmed by codebase inspection and runtime logs:

### A. Hardcoded Client Timeout
The `FetchHttpClient` enforces a default connection timeout that matches the observed failure window.
- **Evidence:** `extension/src/shared/api/network/FetchHttpClient.ts`
- **Reference:** Line 27 (`const timeoutMs = config.timeoutMs ?? 10000;`) and Line 28 (`const timeoutId = setTimeout(() => controller.abort(), timeoutMs);`).

### B. Enriched Timeout Diagnostics
The `TransmissionAdapter` is verified to catch these timeouts and append the target URL to the error message.
- **Evidence:** `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`
- **Reference:** Lines 283–293 (interception of `AbortError` to append `targetUrl`).

### C. Runtime Failure Evidence
Logs confirmed that requests to the Transmission RPC consistently abort at the 10-second mark.
- **Evidence:** `reports/console-export-2026-2-19_23-40-33.log`
- **Reference:** Line 49: `Check error: Error: Connection timed out after 10s (target: http://localhost:9091/transmission/rpc)`

## 3. Evidence Alignment Notes
- **[UNSUPPORTED] IPv6 Failure:** The analysis report (`reports/transmission_timeout_analysis.md`, line 26) claims `::1` failed immediately. However, neither `logs/console-export-2026-2-18_0-45-15.log` nor `reports/console-export-2026-2-19_23-40-33.log` contain attempts to `::1`; all log evidence points exclusively to `localhost` (resolving to IPv4) or `127.0.0.1`.
- **Latency Verification:** The `curl` benchmarks cited in `transmission_timeout_analysis.md` (lines 21–23) showing 9s–13s response times are external to the extension logs but align perfectly with the "Connection timed out after 10s" results seen in the browser.

## 4. Hypothesis & Recommendation
- **Hypothesis:** Transmission RPC latency (observed at 9–13s) exceeds the extension's hardcoded 10s timeout, causing requests to be aborted by the browser's `AbortController` before the server can respond.
- **Next Action:** Update `FetchHttpClient` to support an optional per-request timeout and set the `TransmissionAdapter` RPC calls to use a 14,000ms timeout.

## 5. Implementation Prompt
```markdown
Objective: Fix Transmission connectivity timeouts by allowing RPC requests to exceed 10s safely, without impacting other adapters.

Scope Boundary:
- extension/src/shared/api/network/FetchHttpClient.ts (Add optional timeoutMs to config)
- extension/src/shared/api/clients/transmission/TransmissionAdapter.ts (Set RPC timeout to 14000ms)
- extension/tests/unit/adapters/TransmissionAdapter.test.ts (Update expected timeout string in tests)

Constraints:
- Strictly NO changes to manifest.json, permissions, CSP, or other client adapters.
- Default timeout for all other requests MUST remain 10000ms.
- The new timeout (14000ms) MUST stay below the 15000ms UI-layer timeout.

Output Requirements:
- Provide a Markdown report citing modified file paths and line numbers.
- Perform a regression check by running Transmission adapter unit tests.
```
