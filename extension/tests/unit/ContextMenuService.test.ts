import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContextMenuService } from '@/features/torrent-control/model/services/ContextMenuService';
import { storage } from 'wxt/storage';
import { VaultService } from '@/shared/api/security/VaultService';

// Mock dependencies
vi.mock('wxt/storage', () => ({
    storage: {
        getItem: vi.fn(),
        watch: vi.fn(),
    },
}));

vi.mock('@/shared/api/security/VaultService', () => ({
    VaultService: {
        isLocked: vi.fn(),
        getServers: vi.fn(),
    },
    SESSION_KEY_KEY: 'session',
    VAULT_DATA_KEY: 'vault',
    VAULT_SALT_KEY: 'salt',
}));

vi.mock('@/shared/api/server/ServerResolver', () => ({
    ServerResolver: {
        resolve: vi.fn(),
    },
    ResolutionState: {
        OK: 'OK',
        LOCKED: 'LOCKED',
        UNINITIALIZED: 'UNINITIALIZED',
        NO_SERVERS: 'NO_SERVERS',
        NO_ACTIVE_SERVER: 'NO_ACTIVE_SERVER',
        INVALID_CONFIG: 'INVALID_CONFIG'
    }
}));

import { ServerResolver, ResolutionState } from '@/shared/api/server/ServerResolver';

describe('ContextMenuService Gating', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        // Mock chrome.contextMenus.removeAll to return a resolved Promise
        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not create any items when mode is 0 (Hidden)', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 0 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [],
            activeServer: null
        });

        // doRebuild is called internally; call it directly for unit testing
        await (service as any).doRebuild('test');

        expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
        expect(chrome.contextMenus.create).not.toHaveBeenCalled();
    });

    it('should create basic items but not paused/labels when mode is 2 (Simple)', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: {
                contextMenu: 2,
                labels: ['label1']
            }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1', directories: ['/path1'] }],
            activeServer: { name: 'Server 1', directories: ['/path1'] } as any
        });

        await (service as any).doRebuild('test');

        // Should have basic add
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'add-torrent' }), expect.any(Function));
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'scan-page' }), expect.any(Function));

        // Should NOT have paused
        expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'add-torrent-paused' }), expect.any(Function));

        // Should NOT have labels or paths
        expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'label-selection' }), expect.any(Function));
        expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'path-selection' }), expect.any(Function));
    });

    it('should create everything when mode is 1 (Full)', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: {
                contextMenu: 1,
                labels: ['label1'],
                currentServer: 0
            }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1', directories: ['/path1'] }],
            activeServer: { name: 'Server 1', directories: ['/path1'] } as any
        });

        await (service as any).doRebuild('test');

        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'add-torrent' }), expect.any(Function));
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'add-torrent-paused' }), expect.any(Function));
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'label-selection' }), expect.any(Function));
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'path-selection' }), expect.any(Function));
    });

    it('should respect custom options when mode is 3 (Custom)', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: {
                contextMenu: 3,
                contextMenuCustomOptions: {
                    addToClient: false,
                    pauseResume: true
                }
            }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('test');

        // Add to client is disabled
        expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'add-torrent' }), expect.any(Function));

        // Pause/Resume is enabled
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'add-torrent-paused' }), expect.any(Function));
    });

    it('should show unlock item even if custom says no items, but NOT if mode is Hidden', async () => {
        // Case 1: Locked, Mode 3 (Custom), addToClient: false
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 3, contextMenuCustomOptions: { addToClient: false } }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.LOCKED,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('test');
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'unlock-vault' }), expect.any(Function));

        // Case 2: Locked, Mode 0 (Hidden)
        vi.clearAllMocks();
        vi.mocked(chrome.contextMenus.removeAll).mockImplementation(() => Promise.resolve());
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 0 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.LOCKED,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('test');
        expect(chrome.contextMenus.create).not.toHaveBeenCalled();
    });
});

describe('ContextMenuService Lifecycle', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('ensureMenus() should trigger doRebuild() and create expected items', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });

        service.ensureMenus();

        // Wait for async pipeline
        await vi.waitFor(() => {
            expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
        });

        expect(chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'add-torrent' }),
            expect.any(Function)
        );
    });

    it('concurrent doRebuild() calls should be serialized via isRebuilding flag', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });

        // Fire two concurrent calls
        (service as any).doRebuild('test1');
        (service as any).doRebuild('test2');

        await vi.waitFor(() => {
            expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
        });

        // The second call should have been queued, not dropped
        await vi.waitFor(() => {
            expect(vi.mocked(chrome.contextMenus.removeAll).mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('safeCreate() should log runtime.lastError when present', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        // Simulate runtime.lastError being set in the create callback
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            Object.defineProperty(chrome.runtime, 'lastError', {
                value: { message: 'Duplicate menu ID' },
                writable: true,
                configurable: true,
            });
            if (callback) callback();
            Object.defineProperty(chrome.runtime, 'lastError', {
                value: undefined,
                writable: true,
                configurable: true,
            });
            return 0;
        }) as any;

        (service as any).safeCreate({ id: 'test-item', title: 'Test', contexts: ['link'] });

        expect(warnSpy).toHaveBeenCalledWith(
            '[ContextMenu] create() error for',
            'test-item',
            ':',
            'Duplicate menu ID'
        );

        warnSpy.mockRestore();
    });
});

describe('ContextMenuService Coalescing', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;

        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should coalesce multiple rapid scheduleRebuild calls into one rebuild', async () => {
        // Fire 5 rapid non-immediate triggers
        (service as any).scheduleRebuild('options');
        (service as any).scheduleRebuild('vault_data');
        (service as any).scheduleRebuild('session_key');
        (service as any).scheduleRebuild('ff_fallback');
        (service as any).scheduleRebuild('vault_salt');

        // Advance past debounce window
        vi.advanceTimersByTime(250);

        await vi.waitFor(() => {
            expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
        });

        // Should only have rebuilt once despite 5 triggers
        expect(vi.mocked(chrome.contextMenus.removeAll).mock.calls.length).toBe(1);
    });

    it('immediate triggers should bypass debounce', async () => {
        // Schedule a debounced trigger
        (service as any).scheduleRebuild('options');

        // Then fire an immediate trigger (should cancel debounce and run now)
        (service as any).scheduleRebuild('ensureMenus', true);

        await vi.waitFor(() => {
            expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
        });

        // Only 1 rebuild (the immediate one; debounced one was cancelled)
        expect(vi.mocked(chrome.contextMenus.removeAll).mock.calls.length).toBe(1);
    });
});

describe('ContextMenuService NO_SERVERS Fallback', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create "Open CTRL" item when NO_SERVERS', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.NO_SERVERS,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('test');

        expect(chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'open-ctrl',
                title: 'Open CTRL to configure servers',
            }),
            expect.any(Function)
        );
    });

    it('should create "Open CTRL" item when INVALID_CONFIG', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.INVALID_CONFIG,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('test');

        expect(chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'open-ctrl',
                title: 'Open CTRL to configure servers',
            }),
            expect.any(Function)
        );
    });
});

describe('ContextMenuService Last-Known-Good', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;

        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should use cached OK result when NO_SERVERS within TTL window', async () => {
        // First rebuild: OK
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
        await (service as any).doRebuild('initial');

        vi.clearAllMocks();
        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });

        // Second rebuild: transient NO_SERVERS (within 3s)
        vi.advanceTimersByTime(1000); // 1s later
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.NO_SERVERS,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('transient');

        // Should use cached OK — creates add-torrent, NOT open-ctrl
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'add-torrent' }),
            expect.any(Function)
        );
        expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: 'open-ctrl' }),
            expect.any(Function)
        );
    });

    it('should NOT use cached OK result when NO_SERVERS after TTL expires', async () => {
        // First rebuild: OK
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
        await (service as any).doRebuild('initial');

        vi.clearAllMocks();
        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });

        // Second rebuild: NO_SERVERS after TTL (5s > 3s)
        vi.advanceTimersByTime(5000);
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.NO_SERVERS,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('real');

        // Should NOT use cache — shows open-ctrl
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'open-ctrl' }),
            expect.any(Function)
        );
    });

    it('should NOT use cached OK when vault is LOCKED (security override)', async () => {
        // First rebuild: OK
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
        await (service as any).doRebuild('initial');

        vi.clearAllMocks();
        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });

        // Second rebuild: LOCKED within TTL — must show unlock, not cached OK
        vi.advanceTimersByTime(1000);
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.LOCKED,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('locked');

        // Last-known-good only applies to NO_SERVERS, not LOCKED
        expect(chrome.contextMenus.create).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'unlock-vault' }),
            expect.any(Function)
        );
        expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: 'add-torrent' }),
            expect.any(Function)
        );
    });
});

describe('ContextMenuService Notifications', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        service = new ContextMenuService();
        vi.clearAllMocks();
        chrome.notifications.create = vi.fn() as any;
    });

    it('should NOT dispatch notification if enableNotifications is false', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { enableNotifications: false }
        });

        await (service as any).notify(true, 'Test message');

        expect(chrome.notifications.create).not.toHaveBeenCalled();
    });

    it('should dispatch notification if enableNotifications is true', async () => {
        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { enableNotifications: true }
        });

        await (service as any).notify(true, 'Test message');

        expect(chrome.notifications.create).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Test message'
        }));
    });


    it('should dispatch notification if settings are missing (default behavior)', async () => {
        vi.mocked(storage.getItem).mockResolvedValue(null);

        await (service as any).notify(true, 'Test message');

        expect(chrome.notifications.create).toHaveBeenCalled();
    });
});

describe('ContextMenuService Atomic Rebuild', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should never call removeAll without immediately creating items (non-Hidden)', async () => {
        const removeAllSpy = vi.mocked(chrome.contextMenus.removeAll);
        const createSpy = vi.mocked(chrome.contextMenus.create);

        // Test all non-Hidden, non-OK states
        const states = [
            ResolutionState.LOCKED,
            ResolutionState.UNINITIALIZED,
            ResolutionState.NO_SERVERS,
            ResolutionState.INVALID_CONFIG
        ];

        for (const state of states) {
            vi.clearAllMocks();
            vi.mocked(storage.getItem).mockResolvedValue({ globals: { contextMenu: 2 } });
            vi.mocked(ServerResolver.resolve).mockResolvedValue({
                state,
                servers: [],
                activeServer: null
            });

            await (service as any).doRebuild('test');

            if (removeAllSpy.mock.calls.length > 0) {
                // If removeAll was called, create MUST have been called at least once
                expect(createSpy.mock.calls.length).toBeGreaterThan(0);
            }
        }
    });

    it('should create exactly one fallback item for each non-OK state', async () => {
        const createSpy = vi.mocked(chrome.contextMenus.create);

        const testCases = [
            { state: ResolutionState.LOCKED, expectedId: 'unlock-vault' },
            { state: ResolutionState.UNINITIALIZED, expectedId: 'unlock-vault' },
            { state: ResolutionState.NO_SERVERS, expectedId: 'open-ctrl' },
            { state: ResolutionState.INVALID_CONFIG, expectedId: 'open-ctrl' },
        ];

        for (const { state, expectedId } of testCases) {
            vi.clearAllMocks();
            vi.mocked(storage.getItem).mockResolvedValue({ globals: { contextMenu: 2 } });
            vi.mocked(chrome.contextMenus.removeAll).mockImplementation(() => Promise.resolve());
            vi.mocked(chrome.contextMenus.create).mockImplementation((_props: any, callback?: () => void) => {
                if (callback) callback();
                return 0;
            });
            vi.mocked(ServerResolver.resolve).mockResolvedValue({
                state,
                servers: [],
                activeServer: null
            });

            await (service as any).doRebuild('test');

            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id: expectedId }),
                expect.any(Function)
            );
            // Should create exactly 1 item for non-OK states
            expect(createSpy).toHaveBeenCalledTimes(1);
        }
    });
});

describe('ContextMenuService Enhanced Stabilization', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;

        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should maintain menu across OK → NO_SERVERS → OK flicker within TTL', async () => {
        const createSpy = vi.mocked(chrome.contextMenus.create);

        // Cycle 1: OK
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
        await (service as any).doRebuild('cycle1');

        const okCalls = createSpy.mock.calls.length;
        expect(okCalls).toBeGreaterThan(0);

        // Cycle 2: Transient NO_SERVERS (within TTL, < 300ms)
        vi.clearAllMocks();
        vi.mocked(chrome.contextMenus.removeAll).mockImplementation(() => Promise.resolve());
        vi.mocked(chrome.contextMenus.create).mockImplementation((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        });
        vi.advanceTimersByTime(100); // < 3000ms TTL

        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.NO_SERVERS,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('cycle2');

        // Should use cached OK result, NOT create open-ctrl fallback
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'add-torrent' }),
            expect.any(Function)
        );
        expect(createSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: 'open-ctrl' }),
            expect.any(Function)
        );
    });

    it('should apply last-known-good to INVALID_CONFIG within TTL', async () => {
        const createSpy = vi.mocked(chrome.contextMenus.create);

        // First: OK
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
        await (service as any).doRebuild('initial');

        vi.clearAllMocks();
        vi.mocked(chrome.contextMenus.removeAll).mockImplementation(() => Promise.resolve());
        vi.mocked(chrome.contextMenus.create).mockImplementation((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        });
        vi.advanceTimersByTime(500); // Within TTL

        // Second: INVALID_CONFIG (should use cached OK)
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.INVALID_CONFIG,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('transient_invalid');

        // Should use cached OK — creates add-torrent
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'add-torrent' }),
            expect.any(Function)
        );
    });

    it('should reset cache when vault locks (security override)', async () => {
        const createSpy = vi.mocked(chrome.contextMenus.create);

        // First: OK (unlocked)
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
        await (service as any).doRebuild('initial');

        vi.clearAllMocks();
        vi.mocked(chrome.contextMenus.removeAll).mockImplementation(() => Promise.resolve());
        vi.mocked(chrome.contextMenus.create).mockImplementation((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        });
        vi.advanceTimersByTime(500); // Within TTL

        // Second: LOCKED (should NOT use cache, must show unlock)
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.LOCKED,
            servers: [],
            activeServer: null
        });

        await (service as any).doRebuild('locked');

        // Must show unlock-vault, NOT cached OK menus
        expect(createSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'unlock-vault' }),
            expect.any(Function)
        );
        expect(createSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ id: 'add-torrent' }),
            expect.any(Function)
        );
    });
});

describe('ContextMenuService Rapid Trigger Coalescing', () => {
    let service: ContextMenuService;

    beforeEach(() => {
        vi.useFakeTimers();
        service = new ContextMenuService();
        vi.clearAllMocks();

        chrome.contextMenus.removeAll = vi.fn(() => Promise.resolve()) as any;
        chrome.contextMenus.create = vi.fn((_props: any, callback?: () => void) => {
            if (callback) callback();
            return 0;
        }) as any;

        vi.mocked(storage.getItem).mockResolvedValue({
            globals: { contextMenu: 2 }
        });
        vi.mocked(ServerResolver.resolve).mockResolvedValue({
            state: ResolutionState.OK,
            servers: [{ name: 'Server 1' }],
            activeServer: { name: 'Server 1' } as any
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should coalesce 7 rapid storage triggers into max 2 rebuilds', async () => {
        const removeAllSpy = vi.mocked(chrome.contextMenus.removeAll);

        // Simulate burst from vault unlock + server save (all non-immediate)
        (service as any).scheduleRebuild('options');
        (service as any).scheduleRebuild('vault_data');
        (service as any).scheduleRebuild('session_key');
        (service as any).scheduleRebuild('ff_fallback_key');
        (service as any).scheduleRebuild('vault_salt');
        (service as any).scheduleRebuild('options'); // duplicate
        (service as any).scheduleRebuild('vault_data'); // duplicate

        // Advance past Firefox debounce (300ms)
        vi.advanceTimersByTime(400);

        await vi.waitFor(() => {
            expect(removeAllSpy.mock.calls.length).toBeGreaterThan(0);
        });

        // Should be 1 rebuild (all coalesced) or 2 (if one was mid-flight when burst started)
        expect(removeAllSpy.mock.calls.length).toBeLessThanOrEqual(2);
    });
});

