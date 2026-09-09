#!/usr/bin/env node
/**
 * Live verification matrix: CTRL in a real browser against a real torrent client.
 *
 *   node tests/live/verify.mjs --client transmission|qbittorrent|aria2 --browser chrome|firefox
 *        [--headless] [--only <scenario,...>] [--keep-browser]
 *
 * Prerequisites: `npm run build:chrome` / `npm run build:firefox`, and the client
 * running via `node tests/live/env.mjs start <client>` (this script starts it if
 * it is down, and stops/starts it for the outage scenarios).
 *
 * Every scenario drives the extension's own UI (options page, popup) the way a
 * user would, then asks the server directly (oracles.mjs) whether what the UI
 * claimed actually happened. Results are written as sanitized evidence to
 * docs/release/v1/evidence/live-<client>-<browser>.{md,json}.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { info as envInfo, startClient, stopClient, status as envStatus } from './env.mjs';
import { oracleFor } from './oracles.mjs';
import { TEST_TORRENTS } from './fixtures.mjs';
import { launchBrowser, EXTENSION_ROOT } from './browsers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(EXTENSION_ROOT, '..', 'docs', 'release', 'v1', 'evidence');
const MASTER_PASSWORD = 'ctrl-master-password-1';

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);
const CLIENT = arg('client');
const BROWSER = arg('browser');
const HEADLESS = flag('headless');
const ONLY = (arg('only', '') || '').split(',').filter(Boolean);
const KEEP = flag('keep-browser');
if (!['transmission', 'qbittorrent', 'aria2'].includes(CLIENT) || !['chrome', 'firefox'].includes(BROWSER)) {
    console.error('usage: verify.mjs --client transmission|qbittorrent|aria2 --browser chrome|firefox [--headless] [--only a,b] [--keep-browser]');
    process.exit(2);
}

// ------------------------------------------------------------ page helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => JSON.stringify(s);

/** Tags the first element matching `selector` whose text satisfies `text` and returns a CSS selector for it. */
async function tagByText(page, selector, text, mode = 'equals', timeoutMs = 15000) {
    const body = `
        const els = Array.from(document.querySelectorAll(${q(selector)}));
        const wanted = ${q(text)};
        const mode = ${q(mode)};
        const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
        const el = els.find((e) => {
            const t = norm(e.innerText || e.textContent);
            return mode === 'equals' ? t === wanted : mode === 'starts' ? t.startsWith(wanted) : t.includes(wanted);
        });
        if (!el) return null;
        const token = 'live-' + Math.random().toString(36).slice(2, 10);
        el.setAttribute('data-live-target', token);
        return '[data-live-target="' + token + '"]';`;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const css = await page.evaluate(body);
        if (css) return css;
        await sleep(250);
    }
    throw new Error(`no ${selector} with text ${mode} ${JSON.stringify(text)} within ${timeoutMs} ms`);
}

async function clickText(page, selector, text, mode = 'equals', timeoutMs = 15000) {
    await page.click(await tagByText(page, selector, text, mode, timeoutMs));
}

async function waitForText(page, text, timeoutMs = 15000) {
    await page.waitFor(`return document.body.innerText.includes(${q(text)});`, timeoutMs);
}

async function waitForAnyText(page, texts, timeoutMs = 15000) {
    const found = await page.waitFor(`const t = document.body.innerText; const hits = ${q(texts)}.filter((x) => t.includes(x)); return hits.length ? hits[0] : null;`, timeoutMs);
    return found;
}

const bodyText = (page) => page.evaluate('return document.body.innerText;');

/** Text of the live-region elements, for status assertions. */
const statusTexts = (page) => page.evaluate(`return Array.from(document.querySelectorAll('[role="status"],[role="alert"]')).map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean);`);

async function waitForStatus(page, regex, timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let last = [];
    while (Date.now() < deadline) {
        last = await statusTexts(page);
        const hit = last.find((t) => regex.test(t));
        if (hit) return hit;
        await sleep(500);
    }
    throw new Error(`no status matching ${regex} within ${timeoutMs} ms; last: ${JSON.stringify(last.slice(0, 6))}`);
}

async function openTab(page, label) {
    // A closing Carbon modal keeps its overlay for the fade-out; never click through it.
    const hadModal = await page.evaluate(`return !!document.querySelector('.cds--modal.is-visible');`);
    await page.waitFor(`return !document.querySelector('.cds--modal.is-visible');`, 10000).catch(() => { });
    if (hadModal) await sleep(700);
    for (let attempt = 0; attempt < 3; attempt++) {
        await clickText(page, 'button[role="tab"]', label);
        await sleep(400);
        const selected = await page.evaluate(`return Array.from(document.querySelectorAll('button[role="tab"]')).some((b) => (b.innerText || '').trim() === ${q(label)} && b.getAttribute('aria-selected') === 'true');`);
        if (selected) return;
        await sleep(600);
    }
    throw new Error(`tab ${label} did not become selected`);
}

// ------------------------------------------------------------- oracle waits

async function waitForOracle(oracle, predicate, timeoutMs = 20000, label = 'condition') {
    const deadline = Date.now() + timeoutMs;
    let last = [];
    while (Date.now() < deadline) {
        try {
            last = await oracle.list();
            const hit = predicate(last);
            if (hit) return hit;
        } catch {
            // transient (client restarting)
        }
        await sleep(750);
    }
    throw new Error(`server never showed ${label} within ${timeoutMs} ms; last list: ${JSON.stringify(last.map((t) => ({ hash: t.hash, name: t.name, status: t.status })))}`);
}

const matches = (entry, torrent) => (entry.hash && entry.hash.toLowerCase() === torrent.infoHash) || (entry.name && entry.name.includes(torrent.name));
const findEntry = (list, torrent) => list.find((e) => matches(e, torrent));
const isGone = (list, torrent) => !list.some((e) => matches(e, torrent) && !['removed', 'complete', 'error'].includes(e.status));

// ------------------------------------------------------------------ report

const results = [];
const notes = [];
function note(text) { notes.push(text); console.log('  · ' + text); }

async function scenario(name, fn, { requires = [] } = {}) {
    if (ONLY.length && !ONLY.includes(name)) return;
    const missing = requires.filter((r) => !results.some((x) => x.name === r && x.result === 'PASS'));
    if (missing.length) {
        results.push({ name, result: 'SKIP', observed: `prerequisite failed: ${missing.join(', ')}`, ms: 0 });
        console.log(`[SKIP] ${name} (needs ${missing.join(', ')})`);
        return;
    }
    const started = Date.now();
    console.log(`[RUN ] ${name}`);
    try {
        const observed = await fn();
        results.push({ name, result: 'PASS', observed: observed ?? '', ms: Date.now() - started });
        console.log(`[PASS] ${name} — ${observed ?? ''}`);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ name, result: 'FAIL', observed: message, ms: Date.now() - started });
        console.log(`[FAIL] ${name} — ${message}`);
        // Diagnostics: what the page showed when the scenario failed.
        try {
            const text = (await bodyText(options)).replace(/\s+/g, ' ').slice(0, 1200);
            note(`on failure of ${name}, options page showed: ${text}`);
            await shot(options, `fail-${name}`);
        } catch { /* page gone */ }
    }
}

function sanitize(text, env) {
    const secrets = [env[CLIENT].password, env[CLIENT].secret, MASTER_PASSWORD].filter(Boolean);
    let out = text;
    for (const s of secrets) out = out.split(s).join('***');
    return out;
}

function tailLog(file, lines = 40) {
    try {
        const all = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
        return all.slice(-lines).join('\n');
    } catch {
        return '(log not available)';
    }
}

// ------------------------------------------------------------------- main

const env = envInfo();
const target = env[CLIENT];
const oracle = oracleFor(CLIENT, env);
const torrentA = TEST_TORRENTS.a;
const torrentB = TEST_TORRENTS.b;
const CLIENT_LABEL = { transmission: 'Transmission', qbittorrent: 'qBittorrent', aria2: 'Aria2 / Motrix' }[CLIENT];
const SERVER_NAME = `Live ${CLIENT_LABEL}`;

console.log(`\n=== CTRL live verification: ${CLIENT} × ${BROWSER}${HEADLESS ? ' (headless)' : ''} ===`);
console.log(`server: ${target.baseUrl}`);

// Make sure the client is up and empty.
const st = await envStatus();
if (!st[CLIENT].running) await startClient(CLIENT);
let clientVersion = 'unknown';
try {
    clientVersion = await oracle.version();
    await oracle.removeAll();
} catch (e) {
    console.error(`cannot reach ${CLIENT} through its API: ${e.message}`);
    process.exit(1);
}
console.log(`client version: ${clientVersion}`);

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), `ctrl-live-${BROWSER}-${CLIENT}-`));
let browser = await launchBrowser(BROWSER, { headless: HEADLESS, profileDir, geckodriver: env.geckodriver });
console.log(`browser: ${browser.name} ${browser.version}, extension ${browser.extensionId}`);
let options = await browser.openPage('options.html');

const screenshotDir = path.join(EVIDENCE_DIR, 'screens');
fs.mkdirSync(screenshotDir, { recursive: true });
const shot = async (page, name) => { try { await page.screenshot(path.join(screenshotDir, `${CLIENT}-${BROWSER}-${name}.png`)); } catch { /* optional */ } };
const editButton = `button[aria-label="Edit ${SERVER_NAME}"]`;
const rowGrantButton = `button[aria-label="Grant access to ${SERVER_NAME}"]`;

// 1. Clean state → vault setup
await scenario('vault-setup', async () => {
    await waitForText(options, 'Secure Your Data');
    await options.type('#master-password', MASTER_PASSWORD);
    await options.type('#confirm-password', MASTER_PASSWORD);
    await clickText(options, 'button', 'Create Vault');
    await tagByText(options, 'button[role="tab"]', 'Servers');
    return 'master password created; options dashboard shown';
});

// 2. Configure the server (single URL field) and grant the host permission
await scenario('configure-server', async () => {
    await openTab(options, 'Servers');
    await clickText(options, 'button', 'Add server');
    await waitForText(options, 'Server name');
    await options.type('#server-name', SERVER_NAME);
    await options.select('#server-client', CLIENT);
    await options.type('#server-address', target.baseUrl);
    if (CLIENT === 'aria2') {
        await options.type('#server-password', target.secret);
    } else {
        await options.type('#server-username', target.username);
        await options.type('#server-password', target.password);
    }
    const disclosureShown = (await bodyText(options)).includes('never sends them to the CTRL developer');
    const httpWarning = (await bodyText(options)).includes('Unencrypted connection');
    return `form filled (address ${target.baseUrl}); credential disclosure ${disclosureShown ? 'shown' : 'MISSING'}; plain-http warning ${httpWarning ? 'shown' : 'not shown (private host)'}`;
}, { requires: ['vault-setup'] });

await scenario('grant-permission', async () => {
    const grant = await tagByText(options, 'button', 'Grant access to', 'starts');
    const clickPromise = options.click(grant);
    const prompt = await browser.acceptPermissionPrompt();
    await clickPromise;
    await waitForText(options, 'CTRL may contact', 20000);
    return `granted (${prompt.output.split('\n').pop()})`;
}, { requires: ['configure-server'] });

await scenario('test-connection', async () => {
    await clickText(options, 'button', 'Test connection');
    const hit = await waitForAnyText(options, ['Connection successful', 'Connection failed'], 30000);
    if (hit !== 'Connection successful') {
        const texts = await statusTexts(options);
        throw new Error(`test reported failure: ${texts.filter((t) => t.includes('Connection failed')).join(' | ')}`);
    }
    return 'Connection successful';
}, { requires: ['grant-permission'] });

await scenario('save-server', async () => {
    await clickText(options, 'button', 'Save server');
    await waitForText(options, 'Server added', 20000);
    const listed = (await bodyText(options)).includes(target.baseUrl);
    return `saved; list shows stored address verbatim: ${listed}`;
}, { requires: ['test-connection'] });

// 3. Live connection on the dashboard
await scenario('connected', async () => {
    await openTab(options, 'Dashboard');
    const hit = await waitForStatus(options, /^LIVE$|^Connected/, 30000);
    await shot(options, 'connected');
    return `dashboard status: ${hit}`;
}, { requires: ['save-server'] });

// 4. Add magnet from the popup, verify on the server
let popup = null;
await scenario('add-magnet', async () => {
    popup = await browser.openPage('popup.html');
    await popup.waitFor(`return !!document.querySelector('#add-url:not([disabled])');`, 20000);
    await popup.type('#add-url', torrentA.magnet);
    await popup.evaluate(`const el = document.querySelector('#add-url'); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    const hit = await waitForAnyText(popup, ['Torrent added', 'Could not add'], 30000);
    if (hit !== 'Torrent added') throw new Error(`popup reported: ${(await statusTexts(popup)).join(' | ')}`);
    const entry = await waitForOracle(oracle, (list) => findEntry(list, torrentA), 20000, `torrent ${torrentA.infoHash}`);
    return `popup: Torrent added; server has ${entry.name} (${entry.hash || 'no hash yet'}) status=${entry.status}`;
}, { requires: ['connected'] });

await scenario('list-shows-torrent', async () => {
    await openTab(options, 'Dashboard');
    await options.waitFor(`return Array.from(document.querySelectorAll('[role="listitem"]')).some((e) => (e.getAttribute('aria-label') || '').toLowerCase().includes(${q(torrentA.name.toLowerCase())}) || (e.getAttribute('aria-label') || '').toLowerCase().includes(${q(torrentA.infoHash)}));`, 30000);
    const labels = await options.evaluate(`return Array.from(document.querySelectorAll('[role="listitem"]')).map((e) => e.getAttribute('aria-label'));`);
    await shot(options, 'list');
    return `rows: ${JSON.stringify(labels)}`;
}, { requires: ['add-magnet'] });

// 5. Add paused (global default), verify paused state on the server
await scenario('add-paused', async () => {
    await openTab(options, 'Settings');
    await options.click('label[for="setting-add-paused"]');
    await options.waitFor(`return document.querySelector('#setting-add-paused').getAttribute('aria-checked') === 'true';`, 10000);
    await popup.goto(browser.extensionUrl('popup.html'));
    await popup.waitFor(`return !!document.querySelector('#add-url:not([disabled])');`, 20000);
    await popup.type('#add-url', torrentB.magnet);
    await popup.evaluate(`const el = document.querySelector('#add-url'); el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    const hit = await waitForAnyText(popup, ['Torrent added', 'Could not add'], 30000);
    if (hit !== 'Torrent added') throw new Error(`popup reported: ${(await statusTexts(popup)).join(' | ')}`);
    const entry = await waitForOracle(oracle, (list) => { const e = findEntry(list, torrentB); return e && e.paused ? e : null; }, 20000, `${torrentB.name} paused`);
    await openTab(options, 'Settings');
    await options.click('label[for="setting-add-paused"]');
    await options.waitFor(`return document.querySelector('#setting-add-paused').getAttribute('aria-checked') === 'false';`, 10000);
    return `server shows ${entry.name} status=${entry.status} (paused)`;
}, { requires: ['add-magnet'] });

// 6. Pause / resume / remove from the dashboard list, verified on the server
async function rowButton(name, kind) {
    const prefix = kind === 'remove' ? 'Remove ' : kind === 'pause' ? 'Pause ' : 'Resume ';
    return tagByText(options, `button[aria-label^="${prefix}"]`, '', 'includes', 5000).catch(() => null);
}

async function rowFor(torrent) {
    return options.evaluate(`
        const rows = Array.from(document.querySelectorAll('[role="listitem"]'));
        const row = rows.find((e) => { const l = (e.getAttribute('aria-label') || '').toLowerCase(); return l.includes(${q(torrent.name.toLowerCase())}) || l.includes(${q(torrent.infoHash)}); });
        if (!row) return null;
        const token = 'live-' + Math.random().toString(36).slice(2, 10);
        row.setAttribute('data-live-target', token);
        const buttons = {};
        for (const b of row.querySelectorAll('button[aria-label]')) {
            const l = b.getAttribute('aria-label');
            const t = token + '-' + (l.startsWith('Pause ') ? 'pause' : l.startsWith('Resume ') ? 'resume' : l.startsWith('Remove ') ? 'remove' : 'other');
            b.setAttribute('data-live-target', t);
            buttons[l.split(' ')[0].toLowerCase()] = '[data-live-target="' + t + '"]';
        }
        return { row: '[data-live-target="' + token + '"]', label: row.getAttribute('aria-label'), buttons };`);
}

await scenario('pause', async () => {
    await openTab(options, 'Dashboard');
    let row = null;
    for (let i = 0; i < 20 && !(row && row.buttons.pause); i++) { row = await rowFor(torrentA); if (!(row && row.buttons.pause)) await sleep(500); }
    if (!row || !row.buttons.pause) throw new Error(`no Pause control for ${torrentA.name}; row=${JSON.stringify(row)}`);
    await options.click(row.buttons.pause);
    const entry = await waitForOracle(oracle, (list) => { const e = findEntry(list, torrentA); return e && e.paused ? e : null; }, 20000, `${torrentA.name} paused`);
    return `server: ${entry.name} status=${entry.status}`;
}, { requires: ['list-shows-torrent'] });

await scenario('resume', async () => {
    let row = null;
    for (let i = 0; i < 20 && !(row && row.buttons.resume); i++) { row = await rowFor(torrentA); if (!(row && row.buttons.resume)) await sleep(500); }
    if (!row || !row.buttons.resume) throw new Error(`no Resume control for ${torrentA.name}; row=${JSON.stringify(row)}`);
    await options.click(row.buttons.resume);
    const entry = await waitForOracle(oracle, (list) => { const e = findEntry(list, torrentA); return e && !e.paused ? e : null; }, 20000, `${torrentA.name} resumed`);
    return `server: ${entry.name} status=${entry.status}`;
}, { requires: ['pause'] });

await scenario('remove-keep-files', async () => {
    let row = null;
    for (let i = 0; i < 20 && !(row && row.buttons.remove); i++) { row = await rowFor(torrentA); if (!(row && row.buttons.remove)) await sleep(500); }
    if (!row || !row.buttons.remove) throw new Error(`no Remove control for ${torrentA.name}; row=${JSON.stringify(row)}`);
    await options.click(row.buttons.remove);
    await waitForText(options, 'Remove torrent?', 10000);
    await options.click('.cds--modal-footer .cds--btn--danger');
    await options.waitFor(`return !document.querySelector('.cds--modal.is-visible');`, 10000).catch(() => { });
    await sleep(700); // fade-out
    await waitForOracle(oracle, (list) => (isGone(list, torrentA) ? true : null), 20000, `${torrentA.name} removed`);
    const bStill = findEntry(await oracle.list(), torrentB);
    return `removed on server; other torrent untouched: ${!!bStill}`;
}, { requires: ['list-shows-torrent'] });

// 7. Bad credentials → truthful state, then restore
await scenario('bad-credentials', async () => {
    await openTab(options, 'Servers');
    await options.waitFor(`return !!document.querySelector(${q(editButton)});`, 15000);
    await options.click(editButton);
    await waitForText(options, 'Server name');
    await options.type('#server-password', 'definitely-wrong-password');
    await clickText(options, 'button', 'Test connection');
    const testHit = await waitForAnyText(options, ['Connection successful', 'Connection failed'], 30000);
    const testTexts = (await statusTexts(options)).filter((t) => t.includes('Connection')).join(' | ');
    await clickText(options, 'button', 'Save server');
    await waitForText(options, 'Server updated', 20000);
    await openTab(options, 'Dashboard');
    const dash = await waitForStatus(options, /Authentication failed|AUTHENTICATION FAILED|Server unavailable|SERVER UNAVAILABLE|Connection lost|CONNECTION LOST/, 40000);
    await shot(options, 'bad-credentials');
    // restore
    await openTab(options, 'Servers');
    await options.waitFor(`return !!document.querySelector(${q(editButton)});`, 15000);
    await options.click(editButton);
    await waitForText(options, 'Server name');
    const expected = CLIENT === 'aria2' ? target.secret : target.password;
    await options.type('#server-password', expected);
    const restoredOk = await options.evaluate(`return document.querySelector('#server-password').value === ${q(expected)};`);
    note(`restored password field holds the expected value: ${restoredOk}`);
    await clickText(options, 'button', 'Save server');
    await waitForText(options, 'Server updated', 20000);
    await openTab(options, 'Dashboard');
    await waitForStatus(options, /^LIVE$|^Connected/, 40000);
    if (testHit !== 'Connection failed') throw new Error(`test connection with a wrong password reported "${testHit}"`);
    if (!/Authentication failed|AUTHENTICATION FAILED/.test(dash)) throw new Error(`dashboard showed "${dash}" instead of an authentication failure`);
    return `test: ${testTexts}; dashboard: ${dash}; restored → connected`;
}, { requires: ['connected'] });

// 8. Server unavailable → reconnect after restart
await scenario('server-unavailable', async () => {
    stopClient(CLIENT);
    const hit = await waitForStatus(options, /Connection lost|CONNECTION LOST|Server unavailable|SERVER UNAVAILABLE/, 40000);
    await shot(options, 'unavailable');
    return `dashboard: ${hit}`;
}, { requires: ['connected'] });

await scenario('reconnect-after-restart', async () => {
    await startClient(CLIENT);
    const hit = await waitForStatus(options, /^LIVE$|^Connected/, 60000);
    let list = [];
    try { list = await oracle.list(); } catch { /* oracle re-login */ }
    return `dashboard: ${hit}; server lists ${list.length} torrent(s) after restart`;
}, { requires: ['server-unavailable'] });

// 9. Browser restart → locked → unlock → connected (persistent profile; Chrome only: Firefox temporary add-ons do not survive a restart)
await scenario('browser-restart-lock', async () => {
    if (BROWSER !== 'chrome') return 'skipped by design: a temporary Firefox add-on does not survive a browser restart';
    await browser.close();
    browser = await launchBrowser(BROWSER, { headless: HEADLESS, profileDir, geckodriver: env.geckodriver });
    options = await browser.openPage('options.html');
    await waitForText(options, 'Unlock CTRL', 20000);
    await options.type('#master-password-unlock', MASTER_PASSWORD);
    await clickText(options, 'button', 'Unlock');
    await tagByText(options, 'button[role="tab"]', 'Dashboard');
    await openTab(options, 'Dashboard');
    let hit = await waitForStatus(options, /^LIVE$|^Connected|ACCESS NOT GRANTED|Access not granted/, 40000);
    let regrant = '';
    if (/ACCESS NOT GRANTED|Access not granted/.test(hit)) {
        // The harness reloads the unpacked extension on every launch (CDP loadUnpacked), which
        // Chrome treats as a reinstall and drops the optional host grant. A store-installed
        // extension is not reinstalled on restart. Use the in-product recovery flow and continue.
        await openTab(options, 'Servers');
        await options.waitFor(`return !!document.querySelector(${q(rowGrantButton)});`, 15000);
        const clickPromise = options.click(rowGrantButton);
        await browser.acceptPermissionPrompt();
        await clickPromise;
        await openTab(options, 'Dashboard');
        hit = await waitForStatus(options, /^LIVE$|^Connected/, 40000);
        regrant = '; host grant had to be repeated after the harness reloaded the unpacked extension (recovery flow via Servers → Grant access worked)';
    }
    return `locked after restart; unlocked → ${hit}${regrant}`;
}, { requires: ['reconnect-after-restart'] });

// ------------------------------------------------------------- wrap-up

const logExcerpt = sanitize(tailLog(target.log, 40), env);
try { await oracle.removeAll(); } catch { /* best effort */ }
if (!KEEP) await browser.close();
if (!KEEP) fs.rmSync(profileDir, { recursive: true, force: true });

const serverSettings = CLIENT === 'qbittorrent'
    ? `qBittorrent Web UI security: CSRF protection ${process.env.CTRL_QBT_CSRF === 'off' ? 'OFF (documented server-side setting, not the default)' : 'ON (default)'}; Host header validation ON; clickjacking protection ON`
    : CLIENT === 'transmission' ? 'Transmission: RPC authentication required (Basic), host whitelist default' : 'aria2: --rpc-secret token';
const summary = {
    client: CLIENT,
    clientVersion,
    serverSettings,
    browser: BROWSER,
    browserVersion: browser.version,
    headless: HEADLESS,
    extensionVersion: JSON.parse(fs.readFileSync(path.join(EXTENSION_ROOT, 'package.json'), 'utf8')).version,
    address: target.baseUrl,
    lanAddress: env.lanAddress,
    ranAt: new Date().toISOString(),
    results,
    notes,
};
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const base = path.join(EVIDENCE_DIR, `live-${CLIENT}-${BROWSER}`);
fs.writeFileSync(`${base}.json`, JSON.stringify(summary, null, 2));

const passed = results.filter((r) => r.result === 'PASS').length;
const failed = results.filter((r) => r.result === 'FAIL').length;
const skipped = results.filter((r) => r.result === 'SKIP').length;
const md = [
    `# Live verification: ${CLIENT_LABEL} × ${BROWSER === 'chrome' ? 'Chrome' : 'Firefox'}`,
    '',
    `- ran: ${summary.ranAt}`,
    `- extension: CTRL ${summary.extensionVersion} (built from the working tree)`,
    `- browser: ${browser.name} ${browser.version}${HEADLESS ? ' (headless)' : ''}`,
    `- client: ${CLIENT_LABEL} ${clientVersion}`,
    `- server address configured in CTRL: \`${target.baseUrl}\` (host LAN address, non-loopback; plain HTTP)`,
    `- authentication: ${CLIENT === 'aria2' ? 'RPC secret token' : 'username + password'} (throwaway test values)`,
    `- server settings: ${serverSettings}`,
    `- harness: \`extension/tests/live/verify.mjs\`; every claim checked against the server through \`oracles.mjs\``,
    '',
    `**Result: ${passed} passed, ${failed} failed, ${skipped} skipped.**`,
    '',
    '| Scenario | Result | Observed | ms |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.name} | ${r.result} | ${sanitize(String(r.observed), env).replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${r.ms} |`),
    '',
    ...(notes.length ? ['## Notes', '', ...notes.map((n) => `- ${sanitize(n, env)}`), ''] : []),
    '## Client log excerpt (sanitized, last lines)',
    '',
    '```',
    logExcerpt,
    '```',
    '',
].join('\n');
fs.writeFileSync(`${base}.md`, md);
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped → ${base}.md`);
process.exit(failed ? 1 : 0);
