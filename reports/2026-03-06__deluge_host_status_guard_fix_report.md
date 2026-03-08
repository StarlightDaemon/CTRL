# Deluge Host Status Guard Fix Report

## Objective
Prevent slow timeouts when the Deluge daemon host is offline by checking `web.get_host_status` prior to `web.connect`.

## Changes Implemented

### 1. `extension/src/shared/api/clients/deluge/DelugeAdapter.ts`
Added the guard in `ensureDaemonConnection()` to throw an error if the host is offline before attempting to connect.
**Evidence (Lines 135-139):**
```typescript
        const hostStatus = await this.call<[string, string, string?]>('web.get_host_status', [hostId]);
        const status = hostStatus[1]?.toLowerCase();
        if (status !== 'online' && status !== 'connected') {
            throw new Error(`Deluge daemon is offline: ${hosts[0][1]}:${hosts[0][2]}`);
        }
```

### 2. `extension/tests/unit/adapters/DelugeAdapter.test.ts`
Updated the `login` test block to accommodate the new `web.get_host_status` call during handshake and added an explicit test for the daemon being offline.
**Evidence (Lines 58-122):**
```typescript
        it('should complete multi-step handshake when not connected', async () => {
            const fetchSpy = createMockFetch([
                // 1. auth.login - success
                { ok: true, status: 200, body: rpcResponse(true) },
                // 2. web.connected - not connected
                { ok: true, status: 200, body: rpcResponse(false) },
                // 3. web.get_hosts - return available host
                { ok: true, status: 200, body: rpcResponse([['host-id-123', '127.0.0.1', 58846, 'Online']]) },
                // 4. web.get_host_status - return Online
                { ok: true, status: 200, body: rpcResponse(['host-id-123', 'Online', '2.0.3']) },
                // 5. web.connect - success
                { ok: true, status: 200, body: rpcResponse(null) },
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledTimes(5);
        });

        // ...
        
        it('should throw if daemon is offline', async () => {
            createMockFetch([
                // 1. auth.login - success
                { ok: true, status: 200, body: rpcResponse(true) },
                // 2. web.connected - not connected
                { ok: true, status: 200, body: rpcResponse(false) },
                // 3. web.get_hosts - return available host
                { ok: true, status: 200, body: rpcResponse([['host-id-123', '127.0.0.1', 58846, 'Offline']]) },
                // 4. web.get_host_status - return Offline
                { ok: true, status: 200, body: rpcResponse(['host-id-123', 'Offline', '']) },
            ]);

            await expect(adapter.login()).rejects.toThrow('Deluge daemon is offline: 127.0.0.1:58846');
        });
```

## Regression Check
Run command: `cd extension && npm test`
Status: **Pass**
Failing test names: **None** (all tests passing)
