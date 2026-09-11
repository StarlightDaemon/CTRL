import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeaderRewriter, buildRule, needsHeaderRewrite, originOf } from '@/shared/api/network/HeaderRewriter';
import type { ServerConfig } from '@/shared/lib/types';

type Rule = chrome.declarativeNetRequest.Rule;

function stubDnr(initial: Rule[] = []) {
    let rules = [...initial];
    const dnr = {
        getSessionRules: vi.fn(async () => rules),
        updateSessionRules: vi.fn(async (opts: { addRules?: Rule[]; removeRuleIds?: number[] }) => {
            const remove = new Set(opts.removeRuleIds ?? []);
            rules = rules.filter((r) => !remove.has(r.id)).concat(opts.addRules ?? []);
        }),
    };
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.declarativeNetRequest = dnr;
    return { dnr, rules: () => rules };
}

const qbt = (hostname: string): ServerConfig => ({ id: 'q', name: 'q', application: 'qbittorrent', type: 'qbittorrent', hostname, directories: [], clientOptions: {} });
const transmission: ServerConfig = { id: 't', name: 't', application: 'transmission', type: 'transmission', hostname: 'http://192.168.1.10:9091/', directories: [], clientOptions: {} };

describe('HeaderRewriter', () => {
    beforeEach(() => {
        delete (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.declarativeNetRequest;
    });

    it('only qBittorrent needs the rewrite', () => {
        expect(needsHeaderRewrite(qbt('http://x/'))).toBe(true);
        expect(needsHeaderRewrite(transmission)).toBe(false);
        expect(needsHeaderRewrite({ type: 'aria2', application: 'aria2' })).toBe(false);
    });

    it('derives the origin only for http(s) addresses', () => {
        expect(originOf('http://192.168.1.235:18080/qbt/')).toBe('http://192.168.1.235:18080');
        expect(originOf('https://box.example/')).toBe('https://box.example');
        expect(originOf('ftp://x/')).toBeNull();
        expect(originOf('nope')).toBeNull();
    });

    it('builds a rule that only touches that origin and only sets Origin/Referer to itself', () => {
        const rule = buildRule('http://192.168.1.235:18080');
        expect(rule.condition.urlFilter).toBe('|http://192.168.1.235:18080/');
        expect(rule.condition.resourceTypes).toEqual(['xmlhttprequest']);
        expect(rule.action.type).toBe('modifyHeaders');
        expect(rule.action.requestHeaders).toEqual([
            { header: 'Origin', operation: 'set', value: 'http://192.168.1.235:18080' },
            { header: 'Referer', operation: 'set', value: 'http://192.168.1.235:18080/' },
        ]);
        expect(rule.action.responseHeaders).toBeUndefined();
        // Stable id per origin, distinct across origins.
        expect(buildRule('http://192.168.1.235:18080').id).toBe(rule.id);
        expect(buildRule('http://192.168.1.236:18080').id).not.toBe(rule.id);
    });

    it('installs a session rule once for a qBittorrent server and nothing for other clients', async () => {
        const { dnr, rules } = stubDnr();
        await HeaderRewriter.prepare(qbt('http://192.168.1.235:18080/'));
        await HeaderRewriter.prepare(qbt('http://192.168.1.235:18080/'));
        expect(dnr.updateSessionRules).toHaveBeenCalledTimes(1);
        expect(rules()).toHaveLength(1);
        expect(rules()[0].condition.urlFilter).toBe('|http://192.168.1.235:18080/');

        await HeaderRewriter.prepare(transmission);
        expect(rules()).toHaveLength(1);
    });

    it('prunes rules for origins no longer configured and leaves foreign rule ids alone', async () => {
        const foreign = { id: 7, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'x' } } as unknown as Rule;
        const { rules } = stubDnr([foreign]);
        await HeaderRewriter.ensure('http://a.example:8080');
        await HeaderRewriter.ensure('http://b.example:8080');
        expect(rules()).toHaveLength(3);
        await HeaderRewriter.prune(['http://b.example:8080']);
        expect(rules().map((r) => r.condition.urlFilter)).toEqual(['x', '|http://b.example:8080/']);
        await HeaderRewriter.clear();
        expect(rules().map((r) => r.id)).toEqual([7]);
    });

    it('is a no-op without the API and never throws', async () => {
        await expect(HeaderRewriter.prepare(qbt('http://192.168.1.235:18080/'))).resolves.toBeUndefined();
        expect(await HeaderRewriter.ensure('http://x.example')).toBe(false);
        const { dnr } = stubDnr();
        dnr.updateSessionRules.mockRejectedValueOnce(new Error('denied'));
        expect(await HeaderRewriter.ensure('http://x.example')).toBe(false);
    });
});
