import { describe, it, expect } from 'vitest';
import { LifecycleAdapter, ParsedDOMNode } from '@/features/torrent-control/services/LifecycleAdapter';

/**
 * parseDOM has zero real callers in this codebase (verified via grep across
 * src/ and tests/). These tests exist to validate whether its inferred
 * output shape would actually be usable, using the two closest real analogs
 * found in the codebase:
 *
 * 1. UTorrentParsingUtils.extractUTorrentToken — the only place this repo
 *    parses an HTML fragment from a torrent client today (deliberately
 *    regex-based, not DOMParser, "for Manifest V3 compatible way").
 * 2. ContextMenuService's "scan-page" context-menu action — the only place
 *    this repo scans a page's DOM for content (magnet links), via
 *    chrome.scripting.executeScript + document.querySelectorAll, returning
 *    a flat array of hrefs — not a generic parsed tree.
 */

function findAll(node: ParsedDOMNode | null, predicate: (n: ParsedDOMNode) => boolean): ParsedDOMNode[] {
    if (!node) return [];
    const results: ParsedDOMNode[] = [];
    if (predicate(node)) results.push(node);
    for (const child of node.children) {
        results.push(...findAll(child, predicate));
    }
    return results;
}

describe('LifecycleAdapter.parseDOM (DRAFT validation)', () => {
    it('parses a uTorrent-style token fragment (closest analog: extractUTorrentToken)', async () => {
        const html = "<html><head><title>uTorrent WebUI</title></head><body><div id='token' style='display:none;'>abc123token</div></body></html>";
        const result = await LifecycleAdapter.parseDOM(html);

        expect(result.title).toBe('uTorrent WebUI');

        const tokenNode = findAll(result.root, n => n.id === 'token')[0];
        expect(tokenNode).toBeDefined();
        expect(tokenNode.text).toBe('abc123token');
    });

    it('parses a torrent-listing page and exposes magnet links via attributes (closest analog: scan-page magnet finder)', async () => {
        const html = `
            <html>
            <head><title>Torrent Search Results</title></head>
            <body>
                <ul class="results">
                    <li class="row">
                        <a href="magnet:?xt=urn:btih:AAAA" class="magnet-link">Ubuntu <mark>22.04</mark> Desktop ISO</a>
                        <span class="seeds">1200</span>
                    </li>
                    <li class="row">
                        <a href="magnet:?xt=urn:btih:BBBB" class="magnet-link">Debian 12 <b>Netinst</b></a>
                        <span class="seeds">340</span>
                    </li>
                </ul>
            </body>
            </html>
        `;
        const result = await LifecycleAdapter.parseDOM(html);

        expect(result.title).toBe('Torrent Search Results');
        expect(result.root?.tag).toBe('body');

        const magnetLinks = findAll(result.root, n => n.tag === 'a' && n.attributes.href?.startsWith('magnet:'));
        expect(magnetLinks).toHaveLength(2);
        expect(magnetLinks[0].attributes.href).toBe('magnet:?xt=urn:btih:AAAA');
        expect(magnetLinks[1].attributes.href).toBe('magnet:?xt=urn:btih:BBBB');

        // A plausible caller (mirroring the real scan-page magnet finder) wants
        // the full visible label of each link, including inline formatting
        // such as search-result term highlighting (<mark>/<b>) — a very common
        // pattern on torrent index/search pages — not just the element's own
        // direct text nodes with descendant text silently dropped.
        expect(magnetLinks[0].text).toBe('Ubuntu 22.04 Desktop ISO');
        expect(magnetLinks[1].text).toBe('Debian 12 Netinst');
    });

    it('caps recursion at a bounded depth without throwing on deeply nested markup', async () => {
        const depth = 40;
        let html = '';
        for (let i = 0; i < depth; i++) html += `<div id="d${i}">`;
        html += 'leaf';
        for (let i = 0; i < depth; i++) html += '</div>';
        html = `<html><body>${html}</body></html>`;

        const result = await LifecycleAdapter.parseDOM(html);
        expect(result.root).not.toBeNull();

        let node = result.root!;
        let levels = 0;
        while (node.children.length > 0) {
            node = node.children[0];
            levels++;
        }
        expect(levels).toBeLessThanOrEqual(25);
    });

    it('returns a structured-clone-safe plain object, not a DOM node', async () => {
        const html = '<html><body><div id="x">hi</div></body></html>';
        const result = await LifecycleAdapter.parseDOM(html);
        // This is the exact defect the DRAFT rewrite was meant to fix: the
        // previous version returned the raw Document, which is not
        // structured-clone serializable and cannot cross the extension
        // message boundary.
        expect(() => structuredClone(result)).not.toThrow();
    });
});
