import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = join(__dirname, '..', '..', 'src', 'public', '_locales');

describe('v1 locale packaging (English only)', () => {
    it('ships exactly the English locale', () => {
        const dirs = readdirSync(LOCALES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
        expect(dirs).toEqual(['en']);
        expect(existsSync(join(LOCALES_DIR, 'en', 'messages.json'))).toBe(true);
    });

    it('has a valid English message catalogue with the keys the UI uses', () => {
        const messages = JSON.parse(readFileSync(join(LOCALES_DIR, 'en', 'messages.json'), 'utf8'));
        for (const key of ['navDashboard', 'navServers', 'navSettings', 'navSystem', 'navAbout', 'lockVault', 'systemTitle']) {
            expect(messages[key]?.message, key).toBeTruthy();
        }
        // Placeholder strings from the removed auto-translation pipeline must never ship.
        for (const [key, entry] of Object.entries<{ message: string }>(messages)) {
            expect(entry.message, key).not.toMatch(/^\[[a-z_]+\]\s/i);
        }
    });

    it('the automatic translation workflow and tooling are gone', () => {
        expect(existsSync(join(__dirname, '..', '..', '..', '.github', 'workflows', 'auto-localize.yml'))).toBe(false);
        expect(existsSync(join(__dirname, '..', '..', 'scripts', 'translator'))).toBe(false);
    });
});
