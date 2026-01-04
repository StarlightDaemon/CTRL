import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    // @ts-ignore
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        alias: {
            '@': resolve(__dirname, './src'),
            '~': resolve(__dirname, './src'),
            // Mock WXT virtual imports
            '#imports': resolve(__dirname, './src/test/mocks/wxt-imports.ts'),
        },
        include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
    },
});
