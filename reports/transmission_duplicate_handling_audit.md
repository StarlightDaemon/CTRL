# Transmission Duplicate Handling Audit

Date: 2026-02-18

## Baseline Documents
- `CTRL_BASELINE.md`: NOT PRESENT (Unknown State)
- `CTRL_SYSTEM_STATE.md`: NOT PRESENT (Unknown State)

## Scope
- Subsystem: Transmission adapter duplicate handling (`torrent-add`)
- Research source: `docs/reference/adapter__transmission__architect_prompt.md`
- Implementation source: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts`
- Test source: `extension/tests/unit/adapters/TransmissionAdapter.test.ts`

## Evidence (Repo State)
- `TransmissionAdapter.call()` explicitly treats `result === "duplicate torrent"` as non-fatal (prevents `RpcError` on Transmission 4 duplicate add responses): `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:219` through `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:226`.
- `addTorrentUrl()` detects duplicates via either `response.result === "duplicate torrent"` or `arguments["torrent-duplicate"]` and throws `DuplicateTorrentError`: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:127` through `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:143`.
- `addTorrentFile()` uses the same duplicate detection logic: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:145` through `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:163`.

## Evidence (Research Contract)
- Research asserts Transmission 4 can return `"duplicate torrent"` in the `result` field for duplicate adds and calls out the need to handle this condition explicitly: `docs/reference/adapter__transmission__architect_prompt.md:129`.

## Findings
- CONFIRMED BEHAVIOR: Repo implementation contains an explicit guard for Transmission 4 duplicate adds (`result === "duplicate torrent"`) at the RPC result validation boundary.
- CONFIRMED BEHAVIOR: Duplicate detection is implemented at the adapter public API boundary (`addTorrentUrl`, `addTorrentFile`) using both known duplicate signals.

## Test Coverage
- CONFIRMED BEHAVIOR: Unit test asserts duplicate detection for the `arguments["torrent-duplicate"]` path: `extension/tests/unit/adapters/TransmissionAdapter.test.ts:221`.
- GAP: No unit test asserts the Transmission 4 `result === "duplicate torrent"` path. This is the specific regression vector for reintroducing the prior failure mode (duplicate interpreted as `RpcError`).

## Classification
- Duplicate handling mismatch vs research: FALSE POSITIVE (implementation already aligned to research signal)
- Missing test for `result === "duplicate torrent"`: ROOT CAUSE (regression protection missing)

## Single Highest-Leverage Next Action
- Add invariant enforcement via a unit test covering `result === "duplicate torrent"` for `torrent-add`.

## Execution Prompt (Implementation Agent)
Objective:
- Add a regression test that proves Transmission 4 duplicate responses (`result === "duplicate torrent"`) are surfaced as `DuplicateTorrentError` (not `RpcError`) for `addTorrentUrl()` and/or `addTorrentFile()`.

Scope Boundary:
- Allowed files:
  - `extension/tests/unit/adapters/TransmissionAdapter.test.ts`
- Forbidden:
  - No adapter logic changes
  - No manifest/CSP/permissions changes
  - No refactors

Acceptance Criteria:
- New test simulates a `torrent-add` response with:
  - `result: "duplicate torrent"`
  - and (option A) `arguments["torrent-duplicate"]` populated, or (option B) missing (validate behavior is still deterministic)
- Test asserts:
  - rejection type is `DuplicateTorrentError`
  - error message includes the torrent name when present
- Run the single test file (or the unit test suite) and include output summary in a Markdown report section appended to this file (do not modify other reports).

Notes:
- No builds executed as part of this audit.
