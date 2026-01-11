import 'reflect-metadata';
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

// 1. Polyfill Node.js Globals for JSDOM
// JSDOM usually handles this, verify if removal fixes instanceof issue
// import { TextEncoder, TextDecoder } from 'util';
// Object.assign(global, { TextEncoder, TextDecoder });

// 2. Inject the Extension API Simulation
vi.stubGlobal('chrome', fakeBrowser);
vi.stubGlobal('browser', fakeBrowser);

// 3. State Sanitization
beforeEach(() => {
    fakeBrowser.reset();
    vi.clearAllMocks();
});

// 4. Mock MatchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
