# Transmission 4 Duplicate Torrent Regression Test Report

Date: 2026-02-18

## Summary
Repo state includes a regression unit test that covers Transmission 4 duplicate add responses where `result === "duplicate torrent"`. The test asserts `TransmissionAdapter.addTorrentUrl()` rejects with `DuplicateTorrentError` and includes the torrent name in the error message.

## Implementation Details

### Evidence (Code)
- Duplicate result allowed through RPC validator (non-fatal): `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:219`.
- Duplicate surfaced as `DuplicateTorrentError` by caller: `extension/src/shared/api/clients/transmission/TransmissionAdapter.ts:127`.
- Regression test for Transmission 4 duplicate result: `extension/tests/unit/adapters/TransmissionAdapter.test.ts:245`.

### Regression Test Behavior
The test simulates an HTTP 200 `torrent-add` response containing:
- `result: "duplicate torrent"`
- `arguments["torrent-duplicate"].name: "Existing Torrent"`

```typescript
it('should detect Transmission 4 duplicate torrent (result: "duplicate torrent")', async () => {
    createMockFetch([{
        ok: true,
        status: 200,
        body: {
            result: 'duplicate torrent',
            arguments: {
                'torrent-duplicate': {
                    id: 10,
                    name: 'Existing Torrent'
                }
            }
        }
    }]);

    await expect(
        adapter.addTorrentUrl('magnet:?xt=urn:btih:def456')
    ).rejects.toThrow(DuplicateTorrentError);

    // Re-stub for the message assertion
    createMockFetch([{
        ok: true,
        status: 200,
        body: {
            result: 'duplicate torrent',
            arguments: {
                'torrent-duplicate': {
                    id: 10,
                    name: 'Existing Torrent'
                }
            }
        }
    }]);

    await expect(
        adapter.addTorrentUrl('magnet:?xt=urn:btih:def456')
    ).rejects.toThrow('Existing Torrent');
});
```

## Verification Results

### Unit Tests
Executed from `extension/`:

```bash
npm test -- tests/unit/adapters/TransmissionAdapter.test.ts
```

```
 ✓ tests/unit/adapters/TransmissionAdapter.test.ts (65 tests) 51ms

 Test Files  1 passed (1)
      Tests  65 passed (65)
   Start at  23:41:22
   Duration  36.03s (transform 550ms, setup 4.13s, import 1.43s, tests 51ms, environment 28.43s)
Exit code: 0
```

All 65 tests in `TransmissionAdapter.test.ts` passed successfully.
