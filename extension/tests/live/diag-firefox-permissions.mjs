// Diagnostic (Firefox): does a granted optional host permission exempt extension fetches from CORS?
// Compares a port-qualified origin pattern with a port-less one, from the extension page and via the background.
import { info as envInfo } from './env.mjs';
import { launchFirefox } from './browsers.mjs';

const env = envInfo();
const client = process.argv[2] || 'aria2';
const target = env[client];
const browser = await launchFirefox({ headless: true, geckodriver: env.geckodriver });
const page = await browser.openPage('options.html');
await page.waitFor(`return document.body.innerText.includes('Secure Your Data');`, 15000);

const url = client === 'aria2' ? target.baseUrl : new URL('transmission/rpc', target.baseUrl).toString();
const origin = new URL(target.baseUrl).origin;
const hostOnly = `${new URL(target.baseUrl).protocol}//${new URL(target.baseUrl).hostname}`;

async function grant(pattern) {
    await page.evaluate(`
        const b = document.createElement('button'); b.id = 'diag-grant'; b.textContent = 'grant'; b.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999;padding:8px';
        b.onclick = () => { browser.permissions.request({ origins: [arguments[0]] }).then((g) => { window.__granted = g; }, (e) => { window.__granted = 'error: ' + e; }); };
        document.body.prepend(b); window.__granted = undefined;`, pattern);
    await page.click('#diag-grant');
    const g = await page.waitFor(`return window.__granted === undefined ? null : window.__granted;`, 10000);
    await page.evaluate(`document.getElementById('diag-grant').remove();`);
    return g;
}

async function directFetch() {
    await page.evaluate(`
        const url = arguments[0]; const secret = arguments[1]; const client = arguments[2];
        window.__direct = undefined;
        const body = client === 'aria2'
            ? JSON.stringify({ jsonrpc: '2.0', id: 'x', method: 'aria2.getVersion', params: ['token:' + secret] })
            : JSON.stringify({ method: 'session-get' });
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
            .then(async (r) => { window.__direct = { status: r.status, body: (await r.text()).slice(0, 120) }; })
            .catch((e) => { window.__direct = { error: String(e) }; });`, url, target.secret || '', client);
    return page.waitFor(`return window.__direct === undefined ? null : window.__direct;`, 15000);
}

async function backgroundTest() {
    const config = client === 'aria2'
        ? { name: 'diag', application: 'aria2', type: 'aria2', hostname: target.baseUrl, username: '', password: target.secret, directories: [], clientOptions: {} }
        : { name: 'diag', application: client, type: client, hostname: target.baseUrl, username: target.username, password: target.password, directories: [], clientOptions: {} };
    await page.evaluate(`
        window.__test = undefined;
        browser.runtime.sendMessage({ type: 'TEST_CONNECTION', config: arguments[0] })
            .then((r) => { window.__test = r; }, (e) => { window.__test = { error: String(e) }; });`, config);
    return page.waitFor(`return window.__test === undefined ? null : window.__test;`, 30000);
}

const all = () => page.evaluate(`return browser.permissions.getAll().then((p) => JSON.stringify(p.origins));`);

console.log('firefox', browser.version, '| target', url);
console.log('--- with port-qualified pattern', origin + '/*');
console.log('grant:', await grant(origin + '/*'), '| getAll origins:', await all());
console.log('direct fetch:', JSON.stringify(await directFetch()));
console.log('background TEST_CONNECTION:', JSON.stringify(await backgroundTest()));

console.log('--- adding port-less pattern', hostOnly + '/*');
console.log('grant:', await grant(hostOnly + '/*'), '| getAll origins:', await all());
console.log('direct fetch:', JSON.stringify(await directFetch()));
console.log('background TEST_CONNECTION:', JSON.stringify(await backgroundTest()));
await browser.close();
