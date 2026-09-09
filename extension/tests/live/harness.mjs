/**
 * Shared page helpers and the scenario/evidence runner used by the live
 * verification scripts. Page objects come from browsers.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const q = (s) => JSON.stringify(s);

/** Tags the first element matching `selector` whose text satisfies `text` and returns a CSS selector for it. */
export async function tagByText(page, selector, text, mode = 'equals', timeoutMs = 15000) {
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

export async function clickText(page, selector, text, mode = 'equals', timeoutMs = 15000) {
    await page.click(await tagByText(page, selector, text, mode, timeoutMs));
}

export async function waitForText(page, text, timeoutMs = 15000) {
    await page.waitFor(`return document.body.innerText.includes(${q(text)});`, timeoutMs);
}

export async function waitForAnyText(page, texts, timeoutMs = 15000) {
    return page.waitFor(`const t = document.body.innerText; const hits = ${q(texts)}.filter((x) => t.includes(x)); return hits.length ? hits[0] : null;`, timeoutMs);
}

export const bodyText = (page) => page.evaluate('return document.body.innerText;');

export const statusTexts = (page) => page.evaluate(`return Array.from(document.querySelectorAll('[role="status"],[role="alert"]')).map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean);`);

export async function waitForStatus(page, regex, timeoutMs = 20000) {
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

export async function openTab(page, label) {
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

/** Row labels of the dashboard torrent list, in render order. */
export const rowLabels = (page) => page.evaluate(`return Array.from(document.querySelectorAll('[role="listitem"][aria-label]')).map((e) => e.getAttribute('aria-label'));`);

/** Waits until the dashboard rows satisfy `predicate(labels)`; returns the labels. */
export async function waitForRows(page, predicate, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    let labels = [];
    while (Date.now() < deadline) {
        labels = await rowLabels(page);
        if (predicate(labels)) return labels;
        await sleep(400);
    }
    throw new Error(`rows never satisfied the condition within ${timeoutMs} ms; last: ${JSON.stringify(labels)}`);
}

/** Tags the action buttons of the row for `name` (pause/resume/remove selectors). */
export async function rowActions(page, name) {
    return page.evaluate(`
        const rows = Array.from(document.querySelectorAll('[role="listitem"]'));
        const row = rows.find((e) => (e.getAttribute('aria-label') || '').startsWith(${q(name)} + ','));
        if (!row) return null;
        const token = 'live-' + Math.random().toString(36).slice(2, 10);
        const buttons = {};
        for (const b of row.querySelectorAll('button[aria-label]')) {
            const l = b.getAttribute('aria-label');
            const kind = l.startsWith('Pause ') ? 'pause' : l.startsWith('Resume ') ? 'resume' : l.startsWith('Remove ') ? 'remove' : 'other';
            b.setAttribute('data-live-target', token + '-' + kind);
            buttons[kind] = '[data-live-target="' + token + '-' + kind + '"]';
        }
        return { label: row.getAttribute('aria-label'), buttons };`);
}

/** The background controller's own connection state, through the extension's GET_STATE message. */
export const controllerState = (page) => page.evaluate(`return (globalThis.browser ?? chrome).runtime.sendMessage({ type: 'GET_STATE' }).then((r) => ({ status: r.connection.status, serverName: r.connection.serverName, serverId: r.connection.serverId, lastErrorType: r.connection.lastErrorType, activeServerId: r.activeServerId, servers: r.servers, total: r.stats.total }));`);

// ------------------------------------------------------------------ runner

export function createRunner({ only = [], onFailure } = {}) {
    const results = [];
    const notes = [];
    const note = (text) => { notes.push(text); console.log('  · ' + text); };

    async function scenario(name, fn, { requires = [] } = {}) {
        if (only.length && !only.includes(name)) return;
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
            if (onFailure) { try { await onFailure(name); } catch { /* best effort */ } }
        }
    }

    function write({ file, title, header, secrets = [] }) {
        const sanitize = (text) => secrets.filter(Boolean).reduce((acc, s) => acc.split(s).join('***'), String(text));
        const passed = results.filter((r) => r.result === 'PASS').length;
        const failed = results.filter((r) => r.result === 'FAIL').length;
        const skipped = results.filter((r) => r.result === 'SKIP').length;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.json`, JSON.stringify({ title, header, results, notes, ranAt: new Date().toISOString() }, null, 2));
        const md = [
            `# ${title}`,
            '',
            ...header.map((h) => `- ${sanitize(h)}`),
            '',
            `**Result: ${passed} passed, ${failed} failed, ${skipped} skipped.**`,
            '',
            '| Scenario | Result | Observed | ms |',
            '|---|---|---|---|',
            ...results.map((r) => `| ${r.name} | ${r.result} | ${sanitize(r.observed).replace(/\|/g, '\\|').replace(/\n/g, ' ')} | ${r.ms} |`),
            '',
            ...(notes.length ? ['## Notes', '', ...notes.map((n) => `- ${sanitize(n)}`), ''] : []),
        ].join('\n');
        fs.writeFileSync(`${file}.md`, md);
        console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped → ${file}.md`);
        return { passed, failed, skipped };
    }

    return { scenario, results, notes, note, write };
}
