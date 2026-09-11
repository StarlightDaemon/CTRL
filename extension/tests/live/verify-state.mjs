#!/usr/bin/env node
/**
 * Runtime validation of the state-integrity (Gate B) and vault/security
 * (Gate C) invariants, in a real browser, against two synthetic
 * Transmission-compatible servers whose responses and torrent lists the
 * harness controls (fake-transmission.mjs). No real torrent data is involved.
 *
 *   node tests/live/verify-state.mjs --browser chrome|firefox [--headless] [--only a,b]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { info as envInfo } from './env.mjs';
import { launchBrowser, EXTENSION_ROOT } from './browsers.mjs';
import { startFakeTransmission } from './fake-transmission.mjs';
import {
    sleep, q, tagByText, clickText, waitForText, waitForAnyText, bodyText, statusTexts, waitForStatus,
    openTab, rowLabels, waitForRows, rowActions, controllerState, createRunner,
} from './harness.mjs';

const EVIDENCE_DIR = path.resolve(EXTENSION_ROOT, '..', 'docs', 'release', 'v1', 'evidence');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const BROWSER = arg('browser');
const HEADLESS = argv.includes('--headless');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
if (!['chrome', 'firefox'].includes(BROWSER)) {
    console.error('usage: verify-state.mjs --browser chrome|firefox [--headless] [--only a,b]');
    process.exit(2);
}

const MASTER_PASSWORD = 'ctrl-master-password-1';
const LEGACY_PASSWORD = 'legacy-master-password-9';
const env = envInfo();
const LAN = env.lanAddress;
const t = (id, name, status = 4) => ({ id, name, status });

// Two servers with overlapping numeric ids (1 and 2 exist on both).
const PORT_A = Number(arg('port-a', 19191));
const PORT_B = Number(arg('port-b', 19192));
const A = await startFakeTransmission({ name: 'A', port: PORT_A, username: 'ctrl', password: 'password-for-a', torrents: [t(1, 'A-one'), t(2, 'A-two')] });
const B = await startFakeTransmission({ name: 'B', port: PORT_B, username: 'ctrl', password: 'password-for-b', torrents: [t(1, 'B-one'), t(2, 'B-two'), t(3, 'B-three')] });
const SERVERS = {
    A: { name: 'Server A', address: `http://${LAN}:${PORT_A}/`, fake: A },
    B: { name: 'Server B', address: `http://${LAN}:${PORT_B}/`, fake: B },
};

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `ctrl-state-${BROWSER}-`));
const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), `ctrl-state-dl-`));
const screenshotDir = path.join(EVIDENCE_DIR, 'screens');
fs.mkdirSync(screenshotDir, { recursive: true });

let browser = await launchBrowser(BROWSER, { headless: HEADLESS, profileDir, downloadDir, geckodriver: env.geckodriver });
console.log(`\n=== CTRL state/vault runtime validation: ${BROWSER} ${browser.version}${HEADLESS ? ' (headless)' : ''} ===`);
let win1 = await browser.openPage('options.html');
let win2 = null;
let popup = null;

const runner = createRunner({
    only: ONLY,
    onFailure: async (name) => {
        try {
            runner.note(`on failure of ${name}, window 1 showed: ${(await bodyText(win1)).replace(/\s+/g, ' ').slice(0, 800)}`);
            await win1.screenshot(path.join(screenshotDir, `state-${BROWSER}-fail-${name}.png`));
        } catch { /* window gone */ }
    },
});
const { scenario, note } = runner;
const editButton = (name) => `button[aria-label="Edit ${name}"]`;

async function configureServer(page, server) {
    await openTab(page, 'Servers');
    await clickText(page, 'button', 'Add server');
    await waitForText(page, 'Server name');
    await page.type('#server-name', server.name);
    await page.select('#server-client', 'transmission');
    await page.type('#server-address', server.address);
    await page.type('#server-username', 'ctrl');
    await page.type('#server-password', server.fake.password);
    // Grant unless the origin is already covered (Firefox grants per host, so B is covered by A).
    const already = await page.waitFor(`const t = document.body.innerText; return t.includes('CTRL may contact') ? 'granted' : t.includes('Grant access to') ? 'missing' : null;`, 15000);
    if (already === 'missing') {
        const grant = await tagByText(page, 'button', 'Grant access to', 'starts');
        const clickPromise = page.click(grant);
        await browser.acceptPermissionPrompt();
        await clickPromise;
        await waitForText(page, 'CTRL may contact', 20000);
    }
    await clickText(page, 'button', 'Test connection');
    const hit = await waitForAnyText(page, ['Connection successful', 'Connection failed'], 30000);
    if (hit !== 'Connection successful') throw new Error(`test connection for ${server.name}: ${(await statusTexts(page)).join(' | ')}`);
    await clickText(page, 'button', 'Save server');
    await waitForText(page, 'Server added', 20000);
}

// ------------------------------------------------------------- Gate B

await scenario('vault-setup', async () => {
    await waitForText(win1, 'Secure Your Data');
    await win1.type('#master-password', MASTER_PASSWORD);
    await win1.type('#confirm-password', MASTER_PASSWORD);
    await clickText(win1, 'button', 'Create Vault');
    await tagByText(win1, 'button[role="tab"]', 'Servers');
    return 'vault created';
});

await scenario('configure-two-servers', async () => {
    await configureServer(win1, SERVERS.A);
    await configureServer(win1, SERVERS.B);
    return `A (${SERVERS.A.address}) and B (${SERVERS.B.address}) saved; A is the default`;
}, { requires: ['vault-setup'] });

await scenario('list-shows-server-a', async () => {
    await openTab(win1, 'Dashboard');
    const rows = await waitForRows(win1, (l) => l.length === 2 && l.every((x) => x.startsWith('A-')), 20000);
    const st = await controllerState(win1);
    return `rows ${JSON.stringify(rows)}; controller server=${st.serverName} status=${st.status}`;
}, { requires: ['configure-two-servers'] });

await scenario('switch-to-b-while-a-is-slow', async () => {
    A.setDelay(6000); // the next poll to A will take 6 s
    await sleep(2500); // let a slow poll to A start
    await openTab(win1, 'Servers');
    await win1.click(`button[aria-label="Make ${SERVERS.B.name} the default server"]`);
    await waitForText(win1, 'Default server changed', 10000);
    await openTab(win1, 'Dashboard');
    const switchedAt = Date.now();
    const rows = await waitForRows(win1, (l) => l.length === 3 && l.every((x) => x.startsWith('B-')), 20000);
    const shownAfter = Date.now() - switchedAt;
    // Now let A's delayed answer arrive and make sure it is never displayed as B's queue.
    await sleep(7000);
    const later = await rowLabels(win1);
    const st = await controllerState(win1);
    A.setDelay(0);
    if (!later.every((x) => x.startsWith('B-')) || later.length !== 3) throw new Error(`after A's delayed response the list showed ${JSON.stringify(later)}`);
    if (st.serverName !== SERVERS.B.name || st.status !== 'connected') throw new Error(`controller reports ${st.serverName}/${st.status}`);
    return `B's queue shown ${shownAfter} ms after the switch: ${JSON.stringify(rows)}; still B after A's 6 s reply: ${JSON.stringify(later)}; A polls answered late: ${A.calls.filter((c) => c.method === 'torrent-get').length}`;
}, { requires: ['list-shows-server-a'] });

await scenario('command-targets-the-torrent-server-not-the-id', async () => {
    const before = { a: A.calls.length, b: B.calls.length };
    const row = await rowActions(win1, 'B-one');
    if (!row?.buttons.pause) throw new Error(`no pause control for B-one: ${JSON.stringify(row)}`);
    await win1.click(row.buttons.pause);
    await waitForRows(win1, (l) => l.some((x) => x.startsWith('B-one, Paused')), 15000);
    const aStops = A.calls.slice(before.a).filter((c) => c.method === 'torrent-stop');
    const bStops = B.calls.slice(before.b).filter((c) => c.method === 'torrent-stop');
    if (aStops.length !== 0) throw new Error(`server A received torrent-stop ${JSON.stringify(aStops)} although the row belongs to B`);
    if (bStops.length !== 1 || JSON.stringify(bStops[0].arguments.ids) !== '[1]') throw new Error(`server B received ${JSON.stringify(bStops)}`);
    const resume = await rowActions(win1, 'B-one');
    await win1.click(resume.buttons.resume);
    await waitForRows(win1, (l) => l.some((x) => x.startsWith('B-one, Downloading')), 15000);
    return `torrent-stop ids [1] reached B only (A got none, although A also has id 1); resume restored Downloading`;
}, { requires: ['switch-to-b-while-a-is-slow'] });

await scenario('reorder-and-membership-changes', async () => {
    B.setTorrents([t(3, 'B-three'), t(4, 'B-four'), t(1, 'B-one')]);
    const rows = await waitForRows(win1, (l) => JSON.stringify(l.map((x) => x.split(',')[0])) === JSON.stringify(['B-three', 'B-four', 'B-one']), 15000);
    B.setTorrents([t(1, 'B-one'), t(2, 'B-two'), t(3, 'B-three')]);
    await waitForRows(win1, (l) => l.length === 3 && l[1].startsWith('B-two'), 15000);
    return `rows followed the server order and membership: ${JSON.stringify(rows)}; restored`;
}, { requires: ['switch-to-b-while-a-is-slow'] });

await scenario('second-options-window-mirrors-state', async () => {
    win2 = await browser.openPage('options.html');
    await tagByText(win2, 'button[role="tab"]', 'Dashboard');
    await openTab(win2, 'Dashboard');
    await waitForRows(win2, (l) => l.length === 3 && l.every((x) => x.startsWith('B-')), 20000);
    const row = await rowActions(win1, 'B-two');
    await win1.click(row.buttons.pause);
    await waitForRows(win2, (l) => l.some((x) => x.startsWith('B-two, Paused')), 15000);
    const resume = await rowActions(win1, 'B-two');
    await win1.click(resume.buttons.resume);
    await waitForRows(win2, (l) => l.some((x) => x.startsWith('B-two, Downloading')), 15000);
    return 'window 2 showed the same queue and reflected a pause/resume issued from window 1';
}, { requires: ['switch-to-b-while-a-is-slow'] });

await scenario('popup-consistent-with-options', async () => {
    popup = await browser.openPage('popup.html');
    await popup.waitFor(`return document.body.innerText.includes('B-one');`, 20000);
    const text = await bodyText(popup);
    const selected = await popup.evaluate(`const s = document.querySelector('#server-select'); return s ? (s.tagName === 'SELECT' ? s.options[s.selectedIndex].text : s.innerText) : null;`);
    if (selected !== SERVERS.B.name) throw new Error(`popup server selector shows ${selected}`);
    if (!/B-one[\s\S]*B-two[\s\S]*B-three/.test(text)) throw new Error('popup list does not show B-one..B-three');
    return `popup shows ${selected} with B-one, B-two, B-three`;
}, { requires: ['switch-to-b-while-a-is-slow'] });

await scenario('background-restart-resubscribe', async () => {
    if (BROWSER !== 'chrome') return 'skipped by design: WebDriver classic cannot terminate the Firefox event page';
    const url = await browser.restartBackground();
    B.setTorrents([t(1, 'B-one'), t(2, 'B-two'), t(3, 'B-three'), t(7, 'B-seven')]);
    await waitForRows(win1, (l) => l.some((x) => x.startsWith('B-seven')), 25000);
    await waitForRows(win2, (l) => l.some((x) => x.startsWith('B-seven')), 25000);
    B.setTorrents([t(1, 'B-one'), t(2, 'B-two'), t(3, 'B-three')]);
    await waitForRows(win1, (l) => l.length === 3, 15000);
    return `service worker terminated and restarted (${url.split('/').pop()}); both windows resubscribed and received the new queue`;
}, { requires: ['second-options-window-mirrors-state'] });

await scenario('permission-revoked-and-recovered', async () => {
    const pattern = BROWSER === 'firefox' ? `http://${LAN}/*` : `http://${LAN}:${PORT_B}/*`;
    await win1.evaluate(`return (globalThis.browser ?? chrome).permissions.remove({ origins: [arguments[0]] });`, pattern);
    const hit = await waitForStatus(win1, /Access revoked|ACCESS REVOKED/, 20000);
    await openTab(win1, 'Servers');
    await win1.waitFor(`return !!document.querySelector('button[aria-label="Grant access to ${SERVERS.B.name}"]');`, 15000);
    const clickPromise = win1.click(`button[aria-label="Grant access to ${SERVERS.B.name}"]`);
    await browser.acceptPermissionPrompt();
    await clickPromise;
    await openTab(win1, 'Dashboard');
    const back = await waitForStatus(win1, /^LIVE$|^Connected/, 30000);
    return `revoking ${pattern} → "${hit}"; Grant access in the server list → ${back}`;
}, { requires: ['switch-to-b-while-a-is-slow'] });

// ------------------------------------------------------------- Gate C

await scenario('lock-redacts-every-window', async () => {
    if (!win2) win2 = await browser.openPage('options.html');
    await win1.click('button[aria-label="Lock Vault"]');
    await waitForText(win1, 'Unlock CTRL', 10000);
    await waitForText(win2, 'Unlock CTRL', 10000);
    if (popup) { await popup.reload(); await waitForText(popup, 'Unlock CTRL', 10000); }
    const leaked = (await bodyText(win2)).includes('B-one') || (await bodyText(win1)).includes('B-one');
    if (leaked) throw new Error('a window still showed queue data after the lock');
    return 'locking in window 1 redacted window 2 and the popup; no queue data remained visible';
}, { requires: ['configure-two-servers'] });

await scenario('wrong-master-password', async () => {
    await win1.type('#master-password-unlock', 'not-the-password');
    await clickText(win1, 'button', 'Unlock');
    await waitForText(win1, 'Incorrect password', 10000);
    const st = await controllerState(win1);
    if (st.status !== 'locked') throw new Error(`controller reports ${st.status} after a wrong password`);
    await win1.type('#master-password-unlock', MASTER_PASSWORD);
    await clickText(win1, 'button', 'Unlock');
    await tagByText(win1, 'button[role="tab"]', 'Dashboard');
    await waitForText(win2, 'Dashboard', 10000);
    return 'wrong password refused (controller stays locked); correct password unlocked both windows';
}, { requires: ['lock-redacts-every-window'] });

await scenario('import-failure-preserves-state', async () => {
    await openTab(win1, 'Servers');
    const bad = path.join(downloadDir, 'malformed.json');
    fs.writeFileSync(bad, '{"version":2,"type":"server_config","data":{"servers":[{"name":"x"}]}}');
    await win1.upload('input[type="file"]', bad);
    await waitForText(win1, 'Import failed', 15000);
    const text = await bodyText(win1);
    if (!text.includes(SERVERS.A.name) || !text.includes(SERVERS.B.name) || text.includes('"x"')) throw new Error('server list changed after a failed import');
    const st = await controllerState(win1);
    return `import rejected ("Import failed"); both servers still listed; controller still on ${st.serverName}`;
}, { requires: ['wrong-master-password'] });

async function waitForDownload(pattern, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const file = fs.readdirSync(downloadDir).find((f) => pattern.test(f) && !f.endsWith('.part') && !f.endsWith('.crdownload'));
        if (file) { await sleep(500); return path.join(downloadDir, file); }
        await sleep(400);
    }
    throw new Error(`no download matching ${pattern} within ${timeoutMs} ms (dir: ${fs.readdirSync(downloadDir).join(', ')})`);
}

await scenario('safe-export-has-no-secrets', async () => {
    await openTab(win1, 'Servers');
    await clickText(win1, 'button', 'Export servers (without passwords)');
    const file = await waitForDownload(/ctrl-servers-safe-.*\.json$/);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const raw = fs.readFileSync(file, 'utf8');
    if (json.containsSecrets !== false) throw new Error('safe export not marked containsSecrets=false');
    if (raw.includes('password-for-a') || raw.includes('password-for-b') || /"password"/.test(raw)) throw new Error('safe export contains a password');
    if (json.data.servers.length !== 2 || !raw.includes(SERVERS.A.address)) throw new Error('safe export lacks the server addresses');
    return `${path.basename(file)}: containsSecrets=false, 2 servers, addresses present, no password field or value`;
}, { requires: ['wrong-master-password'] });

await scenario('sensitive-export-is-labelled', async () => {
    await clickText(win1, 'button', 'Export servers (with passwords)');
    const file = await waitForDownload(/ctrl-servers-full-.*\.json$/);
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const raw = fs.readFileSync(file, 'utf8');
    if (json.containsSecrets !== true) throw new Error('full export not marked containsSecrets=true');
    if (!raw.includes('password-for-a') || !raw.includes('password-for-b')) throw new Error('full export lacks the stored passwords');
    return `${path.basename(file)}: containsSecrets=true and both passwords present (as the label says)`;
}, { requires: ['wrong-master-password'] });

// Legacy (pre-envelope) vault: separate salt + data keys, same KDF/cipher as SecurityService.
async function legacyVaultFixture(password, servers) {
    const enc = new TextEncoder();
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const base = await webcrypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 300000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(servers))));
    return { vaultSalt: Array.from(salt), vaultData: { iv: Array.from(iv), ciphertext: Array.from(ciphertext) } };
}

await scenario('legacy-vault-migration', async () => {
    const fixture = await legacyVaultFixture(LEGACY_PASSWORD, [{
        name: 'Legacy box', application: 'transmission', type: 'transmission', hostname: SERVERS.A.address,
        username: 'ctrl', password: 'password-for-a', directories: [], clientOptions: {},
    }]);
    await win1.evaluate(`
        const api = globalThis.browser ?? chrome;
        return api.storage.local.remove(['vault']).then(() => api.storage.session.remove(['encryptionKey'])).then(() => api.storage.local.set(arguments[0]));`, fixture);
    await win1.reload();
    await waitForText(win1, 'Unlock CTRL', 15000);
    await win1.type('#master-password-unlock', LEGACY_PASSWORD);
    await clickText(win1, 'button', 'Unlock');
    await tagByText(win1, 'button[role="tab"]', 'Servers');
    await openTab(win1, 'Servers');
    await waitForText(win1, 'Legacy box', 15000);
    const keys = await win1.evaluate(`const api = globalThis.browser ?? chrome; return api.storage.local.get(['vault', 'vaultSalt', 'vaultData']).then((v) => ({ envelope: !!(v.vault && v.vault.version === 2), legacyLeft: !!(v.vaultSalt || v.vaultData) }));`);
    if (!keys.envelope || keys.legacyLeft) throw new Error(`after unlock: ${JSON.stringify(keys)}`);
    await openTab(win1, 'Dashboard');
    const st = await waitForStatus(win1, /^LIVE$|^Connected/, 30000);
    return `legacy salt+data unlocked with the old password, rewritten as a v2 envelope, legacy keys removed, server usable (${st})`;
}, { requires: ['wrong-master-password'] });

await scenario('corrupt-vault-fails-closed-and-resets', async () => {
    await win1.evaluate(`const api = globalThis.browser ?? chrome; return api.storage.local.set({ vault: { version: 2, salt: [1, 2, 3], iv: [], ciphertext: [], revision: 1 } });`);
    await win1.reload();
    await waitForText(win1, 'Vault damaged', 15000);
    if ((await bodyText(win1)).includes('Legacy box')) throw new Error('server data visible on a corrupted vault');
    if (popup) { await popup.reload(); await waitForText(popup, 'Vault damaged', 15000); }
    await clickText(win1, 'button', 'Reset vault', 'includes'); // Carbon prefixes danger buttons with a hidden "danger" label
    await win1.waitFor(`return !!document.querySelector('.cds--modal.is-visible');`, 10000);
    await win1.click('label[for="reset-vault-acknowledge"]');
    await clickText(win1, '.cds--modal.is-visible button', 'Delete servers and reset', 'includes');
    await waitForText(win1, 'Secure Your Data', 15000);
    const left = await win1.evaluate(`const api = globalThis.browser ?? chrome; return api.storage.local.get(['vault', 'vaultSalt', 'vaultData']).then((v) => Object.keys(v));`);
    if (left.length) throw new Error(`vault material left after reset: ${left.join(', ')}`);
    return 'corrupt envelope → "Vault damaged" in options and popup, no data shown; explicit reset → setup screen, vault keys removed';
}, { requires: ['legacy-vault-migration'] });

// ------------------------------------------------------------- report

await browser.close();
fs.rmSync(profileDir, { recursive: true, force: true });
fs.rmSync(downloadDir, { recursive: true, force: true });
await A.stop();
await B.stop();

const { failed } = runner.write({
    file: path.join(EVIDENCE_DIR, `state-vault-${BROWSER}`),
    title: `State-integrity and vault runtime validation: ${BROWSER === 'chrome' ? 'Chrome' : 'Firefox'}`,
    header: [
        `browser: ${browser.name} ${browser.version}${HEADLESS ? ' (headless)' : ''}`,
        `extension: CTRL ${JSON.parse(fs.readFileSync(path.join(EXTENSION_ROOT, 'package.json'), 'utf8')).version} (working tree)`,
        `servers: two synthetic Transmission-compatible servers (tests/live/fake-transmission.mjs) at ${SERVERS.A.address} and ${SERVERS.B.address}, overlapping torrent ids 1 and 2, harness-controlled delays and lists`,
        'harness: tests/live/verify-state.mjs; every claim checked against the servers\' request logs and the controller\'s GET_STATE',
    ],
    secrets: [MASTER_PASSWORD, LEGACY_PASSWORD],
});
process.exit(failed ? 1 : 0);
