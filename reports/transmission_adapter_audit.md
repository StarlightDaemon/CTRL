# Transmission Adapter Audit

Date: 2026-02-18

## Baseline Documents
- `CTRL_BASELINE.md`: NOT PRESENT (Unknown State)
- `CTRL_SYSTEM_STATE.md`: NOT PRESENT (Unknown State)

## Scope (Transmission Only)
- Research: `docs/reference/adapter__transmission__architect_prompt.md`, `docs/reference/adapter__transmission__builder_prompt.md`
- Implementation: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`, `extension/src/shared/api/network/FetchHttpClient.ts`
- Contract docs: `docs/API.md`, `extension/src/entities/client/model/ITorrentClient.ts`
- Tests: `extension/tests/unit/adapters/TransmissionAdapter.test.ts`

## Evidence Alignment (What Matches Research)
- 409 handshake retry is implemented with `X-Transmission-Session-Id` extraction and a single retry.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:238`
- Basic Auth header is set when username/password exist.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:203`
- Default RPC path is `/transmission/rpc`.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:62` and research reference: `docs/reference/adapter__transmission__architect_prompt.md:61`
- Transmission 4 duplicate add responses (`result === "duplicate torrent"`) are not treated as fatal at the generic RPC validation boundary and are handled by `torrent-add` callers.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:219` and `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:127` and research reference: `docs/reference/adapter__transmission__architect_prompt.md:129`
- Network timeout exists at the HTTP client layer (10s abort).  
  Evidence: `extension/src/shared/api/network/FetchHttpClient.ts:26` and research expectation: `docs/reference/adapter__transmission__architect_prompt.md:73`

## Findings (Classified)
- CONFIRMED BEHAVIOR (closed): unit test now covers Transmission 4 duplicate adds where `result === "duplicate torrent"`.  
  Evidence: `extension/tests/unit/adapters/TransmissionAdapter.test.ts:245` and `reports/transmission_4_duplicate_regression_report.md`
- ROOT CAUSE (contract mismatch): interface/docs describe `testConnection()` as returning `true/false`, but Transmission’s implementation can throw (it does not catch and return `false`).  
  Evidence: `extension/src/entities/client/model/ITorrentClient.ts:53`, `docs/API.md:168`, `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:180`
- ROOT CAUSE (ID/hash ambiguity risk): tag/category methods accept a parameter named `hash` but use `parseInt(hash)` as the RPC torrent id. Research indicates `ids` can be hash strings in some contexts.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:351` and research statement: `docs/reference/adapter__transmission__builder_prompt.md:115`
- SYMPTOM: 403 (whitelist / host protections) is surfaced as a generic auth failure string.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:264`

## Single Highest-Leverage Next Action
- Fix root cause: resolve the `testConnection()` contract mismatch (docs/interface promise boolean return, adapter may throw).  
  Evidence: `docs/API.md:168`, `extension/src/entities/client/model/ITorrentClient.ts:53`, `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:180`

## Closed Loop (Regression)
- Implemented and verified: Transmission 4 duplicate add regression coverage.  
  Evidence: `extension/tests/unit/adapters/TransmissionAdapter.test.ts:245` and `reports/transmission_4_duplicate_regression_report.md`

## Where/How to Run the Next Audit Prompt
- Use a NEW chat to avoid context bleed (Transmission-only).
- Model: `Claude Opus 4.5 (thinking)`.

## Execution Prompt (Completed)
Status: Executed. Evidence: `reports/transmission_4_duplicate_regression_report.md`.

```text
Objective:
Add a regression unit test to ensure Transmission 4 duplicate add responses are handled correctly.

Scope (do not expand):
- Only edit: extension/tests/unit/adapters/TransmissionAdapter.test.ts
- Do NOT edit adapters, manifest, CSP, permissions, architecture, or configs.
- Do NOT run builds.

Required test:
- Add a test that stubs fetch to return a successful HTTP 200 response for torrent-add with:
  - result: "duplicate torrent"
  - arguments: { "torrent-duplicate": { name: "Existing Torrent" } }
- Assert adapter.addTorrentUrl(...) rejects with DuplicateTorrentError and the error message includes "Existing Torrent".

Regression check:
- Run the repo’s unit test command (or, if you cannot run it, state explicitly that tests were not executed).

Output:
- Provide a short Markdown report with file path + line evidence and test run results.
```
