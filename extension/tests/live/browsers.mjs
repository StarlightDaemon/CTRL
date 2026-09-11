/**
 * Browser drivers for live verification.
 *
 * Both drivers load the *built* extension into a throwaway profile of the
 * real, installed browser (the release targets), open extension pages, and
 * expose one small page API so the scenario runner is browser-agnostic:
 *
 *   goto(url) · title() · text(selector) · exists(selector) · click(selector)
 *   type(selector, text) · evaluate(body, ...args) · waitFor(body, timeoutMs)
 *   screenshot(file) · close()
 *
 * `evaluate` / `waitFor` take a function *body* as a string (using `arguments`),
 * which both WebDriver and CDP can run.
 *
 * Chrome: stock Google Chrome (branded builds no longer honour --load-extension)
 *   via puppeteer-core + CDP `Extensions.loadUnpacked`
 *   (`--enable-unsafe-extension-debugging`, pipe transport). The optional host
 *   permission bubble is native UI, so `acceptPermissionPrompt()` clicks its
 *   "Allow" button through Windows UI Automation — the same click a person makes.
 *
 * Firefox: stock Firefox via selenium-webdriver + Mozilla's geckodriver
 *   (WebDriver classic). Extension pages cannot be navigated to directly from
 *   content; the driver opens them from the privileged chrome context
 *   (`--allow-system-access`). `extensions.webextOptionalPermissionPrompts=false`
 *   makes `permissions.request()` grant without a doorhanger, as Mozilla's own
 *   test suites do.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EXTENSION_ROOT = path.resolve(HERE, '..', '..');
export const GECKO_ID = '{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}';

export const BROWSER_BINARIES = {
    chrome: process.env.CTRL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    firefox: process.env.CTRL_FIREFOX || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
};

function fnFromBody(body) {
    // eslint-disable-next-line no-new-func
    return new Function(body);
}

// -------------------------------------------------------------------- Chrome

export async function launchChrome({ headless = false, buildDir = path.join(EXTENSION_ROOT, 'builds', 'chrome-mv3'), profileDir, downloadDir } = {}) {
    const puppeteer = (await import('puppeteer-core')).default;
    const profile = profileDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'ctrl-live-chrome-'));
    const browser = await puppeteer.launch({
        executablePath: BROWSER_BINARIES.chrome,
        headless,
        userDataDir: profile,
        pipe: true,
        enableExtensions: [buildDir],
        args: ['--no-first-run', '--no-default-browser-check', '--window-size=1200,900', '--disable-features=HighEfficiencyModeAvailable,MemorySaverModeAggressiveness'],
        protocolTimeout: 60000,
    });
    const worker = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 20000 });
    const extensionId = new URL(worker.url()).hostname;
    const version = await browser.version();
    const pid = browser.process()?.pid;
    if (downloadDir) {
        fs.mkdirSync(downloadDir, { recursive: true });
        const cdp = await browser.target().createCDPSession();
        await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
    }

    // A background tab is throttled (and can be discarded) by Chrome, which makes
    // CDP calls hang; every operation first brings its tab to the front.
    const front = async (page) => { try { await page.bringToFront(); } catch { /* closed */ } };
    const wrap = (page) => ({
        raw: page,
        goto: async (url) => { await front(page); await page.goto(url, { waitUntil: 'domcontentloaded' }); },
        title: async () => { await front(page); return page.title(); },
        text: async (selector) => { await front(page); return page.$eval(selector, (el) => el.innerText ?? el.textContent ?? ''); },
        exists: async (selector) => { await front(page); return (await page.$(selector)) !== null; },
        click: async (selector) => {
            await front(page);
            // Centre the element first: the options page has a sticky top bar that would otherwise catch clicks near the top edge.
            await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center', inline: 'center' })).catch(() => { });
            await page.click(selector);
        },
        type: async (selector, text) => {
            await front(page);
            await page.click(selector);
            // Select-all + Backspace clears password fields too (a triple-click does not select their contents).
            await page.keyboard.down('Control');
            await page.keyboard.press('a');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');
            if (text) await page.type(selector, text, { delay: 5 });
        },
        select: async (selector, value) => { await front(page); await page.select(selector, value); },
        evaluate: async (body, ...args) => { await front(page); return page.evaluate(fnFromBody(`return (function(){${body}}).apply(null, arguments);`), ...args); },
        waitFor: async (body, timeoutMs = 15000) => { await front(page); return (await page.waitForFunction(fnFromBody(body), { timeout: timeoutMs, polling: 250 })).jsonValue(); },
        screenshot: async (file) => { await front(page); await page.screenshot({ path: file, fullPage: true }); },
        upload: async (selector, filePath) => { await front(page); const input = await page.$(selector); await input.uploadFile(filePath); },
        reload: async () => { await front(page); await page.reload({ waitUntil: 'domcontentloaded' }); },
        close: () => page.close(),
    });

    return {
        name: 'chrome',
        version,
        extensionId,
        extensionUrl: (relative) => `chrome-extension://${extensionId}/${relative}`,
        profile,
        pid,
        openPage: async (relative) => {
            const page = await browser.newPage();
            await page.goto(`chrome-extension://${extensionId}/${relative}`, { waitUntil: 'domcontentloaded' });
            return wrap(page);
        },
        /** Click "Allow" in the native permission bubble (must be called right after the in-page click that opened it). */
        acceptPermissionPrompt: () => invokeNativeButton(pid, 'Allow', 15),
        supportsNativePrompt: !headless,
        /** Terminates the extension's service worker (as Chrome does when idle) and waits for it to come back. */
        restartBackground: async () => {
            const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 10000 });
            const cdp = await browser.target().createCDPSession();
            const targetId = (sw)._targetId ?? (await cdp.send('Target.getTargets')).targetInfos.find((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'))?.targetId;
            await cdp.send('Target.closeTarget', { targetId });
            const next = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://') && t !== sw, { timeout: 20000 });
            return next.url();
        },
        close: async () => {
            const proc = browser.process();
            await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 15000))]).catch(() => { });
            try { if (proc && proc.exitCode === null) proc.kill(); } catch { /* already gone */ }
            await new Promise((r) => setTimeout(r, 1000));
            if (!profileDir) fs.rmSync(profile, { recursive: true, force: true });
        },
    };
}

function invokeNativeButton(pid, name, timeoutSeconds) {
    return new Promise((resolve) => {
        const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(HERE, 'win-invoke-button.ps1'), '-ProcessId', String(pid), '-ButtonName', name, '-TimeoutSeconds', String(timeoutSeconds)], { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        ps.stdout.on('data', (d) => { out += d; });
        ps.stderr.on('data', (d) => { out += d; });
        ps.on('close', (code) => resolve({ ok: code === 0, output: out.trim() }));
    });
}

// ------------------------------------------------------------------- Firefox

export async function launchFirefox({ headless = true, buildDir = path.join(EXTENSION_ROOT, 'builds', 'firefox-mv3'), geckodriver, downloadDir } = {}) {
    const { Builder, Key } = await import('selenium-webdriver');
    const firefox = (await import('selenium-webdriver/firefox.js')).default;
    if (!geckodriver || !fs.existsSync(geckodriver)) throw new Error(`geckodriver not found at ${geckodriver} (run: node tests/live/env.mjs fetch && node tests/live/env.mjs extract)`);

    const options = new firefox.Options()
        .setBinary(BROWSER_BINARIES.firefox)
        .setPreference('extensions.webextOptionalPermissionPrompts', false);
    if (downloadDir) {
        fs.mkdirSync(downloadDir, { recursive: true });
        options.setPreference('browser.download.folderList', 2)
            .setPreference('browser.download.dir', downloadDir)
            .setPreference('browser.download.useDownloadDir', true)
            .setPreference('browser.download.manager.showWhenStarting', false)
            .setPreference('browser.helperApps.neverAsk.saveToDisk', 'application/json,application/octet-stream');
    }
    if (headless) options.addArguments('-headless');
    const service = new firefox.ServiceBuilder(geckodriver).addArguments('--allow-system-access');
    const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(service).build();
    const caps = await driver.getCapabilities();
    const version = caps.get('browserVersion');
    const profile = caps.get('moz:profile');
    await driver.installAddon(buildDir, true);

    let uuid = null;
    for (let i = 0; i < 60 && !uuid; i++) {
        const prefsFile = path.join(profile, 'prefs.js');
        if (fs.existsSync(prefsFile)) {
            const m = fs.readFileSync(prefsFile, 'utf8').match(/extensions\.webextensions\.uuids", "(.*?)"\);/);
            if (m) uuid = JSON.parse(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'))[GECKO_ID] ?? null;
        }
        if (!uuid) await new Promise((r) => setTimeout(r, 500));
    }
    if (!uuid) throw new Error('could not determine the extension UUID from prefs.js');

    const openTab = async (url) => {
        await driver.setContext('chrome');
        await driver.executeScript(`
            const url = arguments[0];
            const win = Services.wm.getMostRecentWindow('navigator:browser');
            const tab = win.gBrowser.addTab(url, { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
            win.gBrowser.selectedTab = tab;
        `, url);
        await driver.setContext('content');
        for (const h of await driver.getAllWindowHandles()) {
            await driver.switchTo().window(h);
            if ((await driver.getCurrentUrl()) === url) return h;
        }
        throw new Error(`tab for ${url} not found`);
    };

    const byCss = (selector) => driver.findElement({ css: selector });

    const wrap = (handle) => ({
        raw: driver,
        goto: async (url) => { await driver.switchTo().window(handle); await driver.get(url); },
        title: async () => { await driver.switchTo().window(handle); return driver.getTitle(); },
        text: async (selector) => { await driver.switchTo().window(handle); return byCss(selector).getText(); },
        exists: async (selector) => { await driver.switchTo().window(handle); return (await driver.findElements({ css: selector })).length > 0; },
        click: async (selector) => {
            await driver.switchTo().window(handle);
            const el = byCss(selector);
            await driver.executeScript('arguments[0].scrollIntoView({ block: "center", inline: "center" });', el).catch(() => { });
            await el.click();
        },
        type: async (selector, text) => {
            await driver.switchTo().window(handle);
            const el = byCss(selector);
            await el.click();
            await el.sendKeys(Key.chord(Key.CONTROL, 'a'), Key.BACK_SPACE); // clear through real key events so React sees the change
            if (text) await el.sendKeys(text);
        },
        select: async (selector, value) => {
            await driver.switchTo().window(handle);
            await driver.executeScript(`
                const el = document.querySelector(arguments[0]);
                el.value = arguments[1];
                el.dispatchEvent(new Event('change', { bubbles: true }));
            `, selector, value);
        },
        evaluate: async (body, ...args) => { await driver.switchTo().window(handle); return driver.executeScript(body, ...args); },
        waitFor: async (body, timeoutMs = 15000) => {
            await driver.switchTo().window(handle);
            return driver.wait(async () => driver.executeScript(body), timeoutMs, `waitFor timed out: ${body.slice(0, 80)}`);
        },
        screenshot: async (file) => { await driver.switchTo().window(handle); fs.writeFileSync(file, Buffer.from(await driver.takeScreenshot(), 'base64')); },
        upload: async (selector, filePath) => { await driver.switchTo().window(handle); await byCss(selector).sendKeys(filePath); },
        reload: async () => { await driver.switchTo().window(handle); await driver.navigate().refresh(); },
        close: async () => { await driver.switchTo().window(handle); await driver.close(); },
    });

    return {
        name: 'firefox',
        version,
        extensionId: GECKO_ID,
        extensionUrl: (relative) => `moz-extension://${uuid}/${relative}`,
        profile,
        openPage: async (relative) => wrap(await openTab(`moz-extension://${uuid}/${relative}`)),
        acceptPermissionPrompt: async () => ({ ok: true, output: 'prompt disabled by extensions.webextOptionalPermissionPrompts=false' }),
        supportsNativePrompt: true,
        restartBackground: async () => { throw new Error('not available for Firefox through WebDriver classic'); },
        close: async () => { await driver.quit().catch(() => { }); },
    };
}

export async function launchBrowser(name, opts) {
    if (name === 'chrome') return launchChrome(opts);
    if (name === 'firefox') return launchFirefox(opts);
    throw new Error(`unknown browser ${name}`);
}
