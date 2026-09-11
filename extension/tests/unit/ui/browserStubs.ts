import { vi } from 'vitest';

/**
 * `@webext-core/fake-browser` leaves `permissions.*` and `runtime.sendMessage`
 * unimplemented (they throw). UI tests install these controllable stubs on the
 * global `chrome` object per test.
 */
export interface PermissionStub {
    granted: Set<string>;
    contains: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    /** Fire the browser's onRemoved listeners as if the user revoked access. */
    emitRemoved: () => void;
    emitAdded: () => void;
}

export function stubPermissions(initiallyGranted: string[] = []): PermissionStub {
    const granted = new Set(initiallyGranted);
    const added = new Set<() => void>();
    const removed = new Set<() => void>();
    const contains = vi.fn(async ({ origins }: { origins: string[] }) => origins.every((o) => granted.has(o)));
    const request = vi.fn(async ({ origins }: { origins: string[] }) => {
        origins.forEach((o) => granted.add(o));
        added.forEach((cb) => cb());
        return true;
    });
    const permissions = {
        contains,
        request,
        onAdded: {
            addListener: (cb: () => void) => added.add(cb),
            removeListener: (cb: () => void) => added.delete(cb),
        },
        onRemoved: {
            addListener: (cb: () => void) => removed.add(cb),
            removeListener: (cb: () => void) => removed.delete(cb),
        },
    };
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.permissions = permissions;
    return {
        granted,
        contains,
        request,
        emitRemoved: () => removed.forEach((cb) => cb()),
        emitAdded: () => added.forEach((cb) => cb()),
    };
}

export function stubSendMessage(impl: (message: unknown) => Promise<unknown> | unknown) {
    const sendMessage = vi.fn(impl);
    const chrome = (globalThis as unknown as { chrome: { runtime: Record<string, unknown> } }).chrome;
    chrome.runtime.sendMessage = sendMessage as unknown as typeof chrome.runtime.sendMessage;
    return sendMessage;
}
