
import { describe, it, expect } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

describe('Test Infrastructure', () => {
    it('should have chrome.storage mocked', async () => {
        expect(chrome.storage).toBeDefined();
        await chrome.storage.local.set({ test: 123 });
        const res = await chrome.storage.local.get('test');
        expect(res.test).toBe(123);
    });

    it('should support TextEncoder (Node Polyfill)', () => {
        expect(TextEncoder).toBeDefined();
        const encoder = new TextEncoder();
        const encoded = encoder.encode('hello');
        expect(encoded).toHaveLength(5);
    });
});
