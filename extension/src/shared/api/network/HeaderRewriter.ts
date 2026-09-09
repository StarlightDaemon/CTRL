import type { ServerConfig } from '@/entities/server/model/types';

/**
 * Origin / Referer rewriting for clients that enforce same-origin checks.
 *
 * Why this exists (live-verified 2026-09-09, qBittorrent 5.2.3, Chrome 152 and
 * Firefox 155): browsers stamp every request an extension makes with
 * `Origin: chrome-extension://…` / `moz-extension://…`. qBittorrent's default
 * CSRF protection compares that header with its own host and rejects the
 * request ("Origin header & Target origin mismatch"). `Origin` and `Referer`
 * are forbidden request headers, so `fetch()` cannot set them; the only
 * mechanism a Manifest V3 extension has is a declarativeNetRequest
 * `modifyHeaders` rule.
 *
 * Scope and least privilege:
 * - Rules are session rules (gone when the browser closes) and exist only for
 *   the origins of servers the user configured as qBittorrent.
 * - `declarativeNetRequestWithHostAccess` (not `declarativeNetRequest`) is
 *   used: the browser applies these rules only to hosts the user has granted
 *   host permission for, and no additional install-time warning is shown.
 * - A rule only touches requests to that one origin, and only sets the two
 *   headers to that origin's own value — the same values a browser tab on the
 *   client's web UI would send. Nothing is added to, removed from, or observed
 *   on any other request.
 *
 * The alternative — asking users to switch off qBittorrent's CSRF protection —
 * would weaken the user's server for every website, so it is not the default
 * path.
 */

const RULE_ID_FLOOR = 100_000;
const RULE_ID_SPAN = 1_000_000;

/** Clients whose same-origin check needs the rewrite. */
const CLIENTS_NEEDING_REWRITE = new Set(['qbittorrent']);

/** FNV-1a 32-bit hash: stable rule id per origin (session rules need integer ids). */
function ruleIdFor(origin: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < origin.length; i++) {
        hash ^= origin.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return RULE_ID_FLOOR + (hash % RULE_ID_SPAN);
}

export function originOf(hostname: string): string | null {
    try {
        const url = new URL(hostname);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.origin;
    } catch {
        return null;
    }
}

export function needsHeaderRewrite(server: Pick<ServerConfig, 'type' | 'application'>): boolean {
    return CLIENTS_NEEDING_REWRITE.has(server.type || server.application);
}

export function buildRule(origin: string): chrome.declarativeNetRequest.Rule {
    return {
        id: ruleIdFor(origin),
        priority: 1,
        action: {
            type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
            requestHeaders: [
                { header: 'Origin', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: origin },
                { header: 'Referer', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: `${origin}/` },
            ],
        },
        condition: {
            // Left-anchored: only URLs under this exact origin.
            urlFilter: `|${origin}/`,
            resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType],
        },
    };
}

function api(): typeof chrome.declarativeNetRequest | null {
    const dnr = (globalThis as { chrome?: { declarativeNetRequest?: typeof chrome.declarativeNetRequest } }).chrome?.declarativeNetRequest;
    return dnr && typeof dnr.updateSessionRules === 'function' && typeof dnr.getSessionRules === 'function' ? dnr : null;
}

export class HeaderRewriter {
    /**
     * Makes sure the rewrite rule for this server's origin exists, when the
     * client needs one. Safe to call often: it is a no-op when the rule is
     * present, when the client does not need it, or when the API is missing.
     * Never throws — transport preparation must not break polling.
     */
    static async prepare(server: ServerConfig): Promise<void> {
        if (!needsHeaderRewrite(server)) return;
        const origin = originOf(server.hostname);
        if (!origin) return;
        await HeaderRewriter.ensure(origin);
    }

    static async ensure(origin: string): Promise<boolean> {
        const dnr = api();
        if (!dnr) return false;
        try {
            const rule = buildRule(origin);
            const existing = await dnr.getSessionRules();
            if (existing.some((r) => r.id === rule.id)) return true;
            await dnr.updateSessionRules({ addRules: [rule], removeRuleIds: [rule.id] });
            return true;
        } catch (error) {
            console.warn('[HeaderRewriter] could not install header rule for', origin, error);
            return false;
        }
    }

    /** Removes rules for origins that are no longer configured. */
    static async prune(keepOrigins: string[]): Promise<void> {
        const dnr = api();
        if (!dnr) return;
        try {
            const keep = new Set(keepOrigins.map(ruleIdFor));
            const existing = await dnr.getSessionRules();
            const stale = existing
                .map((r) => r.id)
                .filter((id) => id >= RULE_ID_FLOOR && id < RULE_ID_FLOOR + RULE_ID_SPAN && !keep.has(id));
            if (stale.length) await dnr.updateSessionRules({ removeRuleIds: stale });
        } catch (error) {
            console.warn('[HeaderRewriter] could not prune header rules', error);
        }
    }

    static async clear(): Promise<void> {
        await HeaderRewriter.prune([]);
    }
}
