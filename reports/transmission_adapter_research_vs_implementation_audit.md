# Transmission Adapter Research vs Implementation Audit

Date: 2026-02-18

## Baseline Documents
- `CTRL_BASELINE.md`: NOT PRESENT (Unknown State)
- `CTRL_SYSTEM_STATE.md`: NOT PRESENT (Unknown State)

## Scope (Transmission Only)
- Research: `docs/reference/adapter__transmission__architect_prompt.md`, `docs/reference/adapter__transmission__builder_prompt.md`
- Implementation: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`, `extension/src/shared/api/clients/transmission/TransmissionCapabilities.ts`, `extension/src/shared/api/clients/transmission/TransmissionErrors.ts`, `extension/src/shared/api/network/FetchHttpClient.ts`
- Tests: `extension/tests/unit/adapters/TransmissionAdapter.test.ts`

## Evidence Alignment (Key Research Claims)

| Research Expectation | Implementation Status | Evidence |
|---|---:|---|
| 409 handshake: extract `X-Transmission-Session-Id`, retry once, avoid infinite loops | ALIGNED | `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:238` |
| Preemptive Basic Auth header when user/pass configured | ALIGNED | `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:203` |
| Default endpoint path `/transmission/rpc` | ALIGNED (fixed path) | `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:60` |
| Duplicate adds: Transmission returns `torrent-duplicate` object; treat as duplicate signal | ALIGNED | Research: `docs/reference/adapter__transmission__builder_prompt.md:115` + Implementation: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:132` |
| Transmission 4 duplicates: `result === "duplicate torrent"` should not be treated as fatal at the generic RPC validation boundary | ALIGNED | Research: `docs/reference/adapter__transmission__architect_prompt.md:129` + Implementation: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:219` |
| Implement network timeouts to avoid hanging calls | PARTIAL (10s hard-coded) | Research: `docs/reference/adapter__transmission__architect_prompt.md:73` + Implementation: `extension/src/shared/api/network/FetchHttpClient.ts:26` |

## Findings (Classified)

- CONFIRMED BEHAVIOR: 409 session handshake is implemented with a single retry and explicit failure if header missing.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:238`

- CONFIRMED BEHAVIOR: Transmission 4 duplicate add responses are explicitly allowed through the `call()` result validator, then surfaced as `DuplicateTorrentError` by the `torrent-add` caller.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:219` and `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:132`

- ROOT CAUSE (contract mismatch risk): `ITorrentClient.testConnection()` is documented as returning `true/false`, but `TransmissionAdapter.testConnection()` can throw (it does not catch and return `false`).  
  Evidence: `extension/src/entities/client/model/ITorrentClient.ts:53` and `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:180` and `docs/API.md:168`

- ROOT CAUSE (potential functional bug): `setCategory/addTags/removeTags/getTorrentTags` accept a parameter named `hash` but pass `ids: [parseInt(hash)]`, which breaks if the caller actually supplies a hash string (and contradicts the research that `ids` may be hash strings).  
  Evidence: Research: `docs/reference/adapter__transmission__builder_prompt.md:115` + Implementation: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:351`

- SYMPTOM / UX GAP: 403 errors are collapsed into a generic authentication failure string, even though Transmission uses 403 for whitelist failures (and `WhitelistError` exists but is unused).  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:264` and `extension/src/shared/api/clients/transmission/TransmissionErrors.ts:28`

- DOCUMENTATION MISMATCH: Repo timeout policy is 10s in `FetchHttpClient`, while research references longer “typical client” timeouts (commonly ~30s).  
  Evidence: `extension/src/shared/api/network/FetchHttpClient.ts:26` and `docs/reference/adapter__transmission__architect_prompt.md:67`

- CONFIRMED BEHAVIOR: Tracker management branches by detected RPC capabilities (trackerList vs trackerAdd).  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:467`

- CONFIRMED BEHAVIOR: Labels exist as a modeled feature and are requested/mapped in torrent listings.  
  Evidence: Research: `docs/reference/adapter__transmission__builder_prompt.md:22` + Implementation: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:92`

- RISK (version gating not enforced): Implementation requests `labels` unconditionally and uses `torrent-set` with `labels` in tag/category methods without checking `capabilities.supportsLabels`. This can fail on RPC v15 (Transmission 2.x) despite capability detection existing.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:92` and `extension/src/shared/api/clients/transmission/TransmissionCapabilities.ts:27`

- CODE HYGIENE: `MAX_SESSION_RETRIES` constant is declared but unused; multiple error types are imported but never thrown.  
  Evidence: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:57` and `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:27`

## Regression Evidence (Tests)
- CONFIRMED BEHAVIOR: Unit test covers `arguments["torrent-duplicate"]` duplicate handling (Transmission 3-style).  
  Evidence: `extension/tests/unit/adapters/TransmissionAdapter.test.ts:221`
- GAP: No unit test asserts Transmission 4 `result === "duplicate torrent"` duplicate handling.  
  Evidence: `extension/tests/unit/adapters/TransmissionAdapter.test.ts:221`

## Single Highest-Leverage Next Action
- Add invariant enforcement: introduce a unit test that simulates `torrent-add` returning `result: "duplicate torrent"` and asserts the adapter rejects with `DuplicateTorrentError` (not `RpcError`).

## Execution Prompt (Implementation Agent)

Objective:
- Add a regression test ensuring Transmission 4 duplicate add responses (`result: "duplicate torrent"`) are surfaced as `DuplicateTorrentError` for `TransmissionAdapter.addTorrentUrl()` (and optionally `addTorrentFile()`).

Scope Boundary:
- Allowed edits: `extension/tests/unit/adapters/TransmissionAdapter.test.ts`
- Forbidden edits: no adapter code changes; no manifest/CSP/permissions changes; no refactors; no builds.

Requirements:
- Add a new test case that stubs fetch response for `torrent-add` with `status: 200`, `body.result: "duplicate torrent"`, and `arguments["torrent-duplicate"].name` populated.
- Assert the call rejects with `DuplicateTorrentError` and the error message includes the expected torrent name.
- Run the unit test command used by this repo (or, if not possible in your environment, state explicitly that tests were not executed).

Output:
- Produce a Markdown test/audit note including file+line evidence for the new test and the test run result.
