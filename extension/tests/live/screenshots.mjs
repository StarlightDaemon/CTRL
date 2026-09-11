#!/usr/bin/env node
/**
 * Captures store screenshots from the actual UI (Chrome, 1280x800) against
 * the live Transmission instance: options dashboard with a queue, the
 * servers page, the server form, settings, and the popup composed onto a
 * 1280x800 canvas. Output: docs/release/v1/assets/*.png
 *
 *   node tests/live/screenshots.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { info as envInfo, startClient, status as envStatus } from './env.mjs';
import { oracleFor } from './oracles.mjs';
import { TEST_TORRENTS } from './fixtures.mjs';
import { launchChrome, EXTENSION_ROOT } from './browsers.mjs';
import { clickText, tagByText, waitForText, waitForAnyText, openTab, waitForRows, sleep } from './harness.mjs';

const OUT = path.resolve(EXTENSION_ROOT, '..', 'docs', 'release', 'v1', 'assets');
fs.mkdirSync(OUT, { recursive: true });
const env = envInfo();
const target = env.transmission;
const MASTER_PASSWORD = 'ctrl-master-password-1';

const st = await envStatus();
if (!st.transmission.running) await startClient('transmission');
const oracle = oracleFor('transmission', env);
await oracle.removeAll();

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-shots-'));
const browser = await launchChrome({ headless: false, profileDir });
const page = await browser.openPage('options.html');
await page.raw.setViewport({ width: 1280, height: 800 });

// Vault + server
await waitForText(page, 'Secure Your Data');
await page.type('#master-password', MASTER_PASSWORD);
await page.type('#confirm-password', MASTER_PASSWORD);
await clickText(page, 'button', 'Create Vault');
await tagByText(page, 'button[role="tab"]', 'Servers');
await openTab(page, 'Servers');
await clickText(page, 'button', 'Add server');
await waitForText(page, 'Server name');
await page.type('#server-name', 'Home Transmission');
await page.select('#server-client', 'transmission');
await page.type('#server-address', target.baseUrl);
await page.type('#server-username', target.username);
await page.type('#server-password', target.password);
const grant = await tagByText(page, 'button', 'Grant access to', 'starts');
const clicking = page.click(grant);
await browser.acceptPermissionPrompt();
await clicking;
await waitForText(page, 'CTRL may contact', 20000);
await clickText(page, 'button', 'Test connection');
await waitForAnyText(page, ['Connection successful', 'Connection failed'], 30000);
await page.raw.screenshot({ path: path.join(OUT, '03-server-form.png') });
await clickText(page, 'button', 'Save server');
await waitForText(page, 'Server added', 20000);

// Queue content: add two fixture magnets through the server API so the dashboard has rows.
for (const t of [TEST_TORRENTS.a, TEST_TORRENTS.b, TEST_TORRENTS.c]) {
    await oracle.call('torrent-add', { filename: t.magnet, paused: t === TEST_TORRENTS.b });
}
await openTab(page, 'Dashboard');
await waitForRows(page, (l) => l.length === 3, 30000);
await sleep(1500);
await page.raw.screenshot({ path: path.join(OUT, '01-dashboard.png') });

await openTab(page, 'Servers');
await sleep(800);
await page.raw.screenshot({ path: path.join(OUT, '02-servers.png') });

await openTab(page, 'Settings');
await sleep(800);
await page.raw.screenshot({ path: path.join(OUT, '04-settings.png') });

// Popup at its natural size, composed onto a 1280x800 canvas (Chrome Web Store size).
const popup = await browser.openPage('popup.html');
await popup.raw.setViewport({ width: 420, height: 640 });
await popup.waitFor(`return document.body.innerText.includes('ctrl-live-a');`, 30000);
await sleep(1000);
const popupPng = await popup.raw.screenshot({ type: 'png' });
const sharp = (await import('sharp')).default;
await sharp({ create: { width: 1280, height: 800, channels: 4, background: { r: 22, g: 22, b: 22, alpha: 1 } } })
    .composite([{ input: popupPng, left: Math.round((1280 - 420) / 2), top: Math.round((800 - 640) / 2) }])
    .png()
    .toFile(path.join(OUT, '05-popup.png'));

await oracle.removeAll();
await browser.close();
fs.rmSync(profileDir, { recursive: true, force: true });
console.log('screenshots written to', OUT, fs.readdirSync(OUT).join(', '));
