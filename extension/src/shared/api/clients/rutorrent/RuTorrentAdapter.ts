import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { ServerConfig } from '@/shared/lib/types';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { RTorrentResponseSchema, RTorrentTuple } from './RTorrentSchema';
import { blobToBase64 } from '@/shared/lib/helpers';
// @ts-ignore
import { parse } from 'txml';

/** 
 * XML-RPC types - using `unknown` for inherently dynamic XML parsing.
 * Type safety is enforced at the Zod schema validation layer.
 */
type XmlRpcParam = string | number | boolean | XmlRpcParam[] | { type: string; value: string };
type XmlRpcResult = unknown;

@injectable()
export class RuTorrentAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private rpcEndpoint: string;

    constructor(private config: ServerConfig) {
        // rTorrent usually lives at /RPC2 or /rutorrent/plugins/httprpc/action.php
        // The user config 'hostname' might just be the base URL.
        // We need to allow the user's FULL URL if they provided it, or append default for rutorrent.
        // For now, assume config.hostname is the base, and we append /plugins/httprpc/action.php if it looks like rutorrent,
        // or /RPC2 if generic. 
        // Simplest: The user should provide the FULL path to the RPC endpoint in the config.
        // But mostly users provide http://seedbox.com/rutorrent.

        let url = config.hostname.replace(/\/$/, '');
        if (!url.endsWith('/RPC2') && !url.includes('action.php')) {
            // Default to ruTorrent plugin path as it's most common for web users
            url = `${url}/plugins/httprpc/action.php`;
        }

        this.client = new FetchHttpClient(url);
        this.rpcEndpoint = '';
    }

    /**
     * XML-RPC Call Helper
     */
    private async call(method: string, params: XmlRpcParam[] = []): Promise<XmlRpcResult> {
        const xmlPayload = this.buildXmlPayload(method, params);

        // Basic Auth
        const auth = btoa(`${this.config.username}:${this.config.password}`);

        const responseText = await this.client.post<string>('', xmlPayload, {
            headers: {
                'Content-Type': 'text/xml',
                'Authorization': `Basic ${auth}`
            }
        });

        // Parse XML
        const xmlObj = parse(responseText);
        const unwrapped = this.unwrapRpc(xmlObj);

        // Check for Fault
        if (unwrapped && typeof unwrapped === 'object' && 'faultCode' in unwrapped) {
            const fault = unwrapped as { faultCode: unknown; faultString: unknown };
            throw new Error(`rTorrent Fault: ${fault.faultString} (${fault.faultCode})`);
        }

        return unwrapped;
    }

    /**
     * "Lite" recursive unwrapper for tXml output
     */
    private unwrapRpc(node: unknown): XmlRpcResult {
        if (!node) return null;

        // If array of nodes, try to find the logic root or map
        if (Array.isArray(node)) {
            // Root of document usually has ?xml and methodResponse
            const response = node.find((n: unknown) => typeof n === 'object' && n !== null && 'tagName' in n && (n as { tagName: string }).tagName === 'methodResponse');
            if (response && typeof response === 'object' && 'children' in response) {
                return this.unwrapRpc((response as { children: unknown }).children);
            }

            // Just a list of children
            if (node.length === 1) return this.unwrapRpc(node[0]);
            return node.map((n: unknown) => this.unwrapRpc(n));
        }

        // Type guard for node object
        if (typeof node !== 'object' || node === null || !('tagName' in node)) {
            return typeof node === 'string' ? node : null;
        }

        const xmlNode = node as { tagName: string; children: unknown[] };

        if (xmlNode.tagName === 'params') {
            return this.unwrapRpc(xmlNode.children[0]);
        }

        if (xmlNode.tagName === 'param') {
            return this.unwrapRpc(xmlNode.children[0]);
        }

        if (xmlNode.tagName === 'value') {
            return this.unwrapRpc(xmlNode.children[0]);
        }

        // --- Types ---
        const firstChild = xmlNode.children[0];
        // XML-RPC strings: return '' for empty elements, not null
        if (xmlNode.tagName === 'string') return typeof firstChild === 'string' ? firstChild : '';
        if (xmlNode.tagName === 'i4' || xmlNode.tagName === 'int') return typeof firstChild === 'string' ? parseInt(firstChild, 10) : 0;
        // i8 (64-bit int) returned as string to preserve precision
        if (xmlNode.tagName === 'i8') return typeof firstChild === 'string' ? firstChild : '0';
        if (xmlNode.tagName === 'boolean') return firstChild === '1';

        if (xmlNode.tagName === 'array') {
            const dataNode = xmlNode.children.find((n: unknown) => typeof n === 'object' && n !== null && 'tagName' in n && (n as { tagName: string }).tagName === 'data');
            if (!dataNode || typeof dataNode !== 'object' || !('children' in dataNode)) return [];
            return ((dataNode as { children: unknown[] }).children).map((child: unknown) => this.unwrapRpc(child));
        }

        if (xmlNode.tagName === 'struct') {
            const result: Record<string, XmlRpcResult> = {};
            for (const member of xmlNode.children) {
                if (typeof member !== 'object' || member === null || !('children' in member)) continue;
                const memberNode = member as { children: unknown[] };
                const nameNode = memberNode.children.find((n: unknown) => typeof n === 'object' && n !== null && 'tagName' in n && (n as { tagName: string }).tagName === 'name');
                const valueNode = memberNode.children.find((n: unknown) => typeof n === 'object' && n !== null && 'tagName' in n && (n as { tagName: string }).tagName === 'value');
                if (nameNode && typeof nameNode === 'object' && 'children' in nameNode && valueNode) {
                    const name = (nameNode as { children: unknown[] }).children[0];
                    if (typeof name === 'string') {
                        result[name] = this.unwrapRpc(valueNode);
                    }
                }
            }
            return result;
        }

        if (xmlNode.tagName === 'fault') {
            return this.unwrapRpc(xmlNode.children[0]);
        }

        return null;
    }

    /**
     * XML Payload Builder (Template Literal)
     */
    private buildXmlPayload(method: string, params: XmlRpcParam[]): string {
        const paramStr = params.map(p => this.encodeParam(p)).join('');
        return `<?xml version="1.0" encoding="UTF-8"?><methodCall><methodName>${method}</methodName><params>${paramStr}</params></methodCall>`;
    }

    private encodeParam(p: XmlRpcParam): string {
        if (typeof p === 'number') return `<param><value><i4>${Math.floor(p)}</i4></value></param>`;
        if (typeof p === 'string') return `<param><value><string>${this.escapeXml(p)}</string></value></param>`;
        if (typeof p === 'boolean') return `<param><value><boolean>${p ? 1 : 0}</boolean></value></param>`;
        if (Array.isArray(p)) {
            // Encode as <array><data>...
            const data = p.map(item => {
                // unwrapped param tags for array items? No, array contains values.
                // We need to strip the outer <param> tag from the recursive call
                const encoded = this.encodeParam(item);
                return encoded.replace('<param>', '').replace('</param>', '');
            }).join('');
            return `<param><value><array><data>${data}</data></array></value></param>`;
        }
        if (p && p.type === 'base64') return `<param><value><base64>${p.value}</base64></value></param>`;
        return `<param><value><string>${p}</string></value></param>`;
    }

    private escapeXml(unsafe: string): string {
        return unsafe.replace(/[<>&'"]/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
            return c;
        });
    }

    // --- Interface Implementation ---

    async login(): Promise<void> {
        // Stateless, but verify basic access
        await this.call('system.client_version');
    }

    async logout(): Promise<void> {
        // No-op
    }

    async getTorrents(): Promise<Torrent[]> {
        // d.multicall2
        const params = [
            "", // Request for default
            "main", // View
            "d.hash=", "d.name=", "d.size_bytes=", "d.bytes_done=",
            "d.up.rate=", "d.down.rate=", "d.complete=", "d.state=",
            "d.is_active=", "d.custom1=", "d.ratio=", "d.hashing=",
            "d.base_path=", "d.up.total=", "d.message="
        ];

        const response = await this.call('d.multicall2', params);

        // Validation
        const safeData = RTorrentResponseSchema.parse(response);

        return safeData.map(t => this.mapTorrent(t));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        await this.call('load.start', ["", url]);

        if (options?.path) {
            // We can't easily chain set_directory on load.start without strict multicall
            // Best effort: load, then we might need to find it and move it? 
            // rTorrent load.start implies default dir. 
            // For advanced, we would need 'load.start_verbose' + command chaining.
            // Lite implementation: just load.
        }
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const base64 = await blobToBase64(file);
        // load.raw_start
        await this.call('load.raw_start', ["", { type: 'base64', value: base64 }]);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.call('d.stop', [id]);
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.call('d.start', [id]);
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        await this.call('d.erase', [id]);
        // deleteData logic requires XMLRPC 'd.delete_tied' or shell commands, 
        // which might be unsafe or disabled. Simple erase is standard.
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.login();
            return true;
        } catch {
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.call('system.client_version');
        return Date.now() - start;
    }

    async getCategories(): Promise<string[]> {
        // No distinct endpoint
        return [];
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.call('d.custom1.set', [hash, category]);
    }

    async getTags(): Promise<string[]> { return []; }
    async addTags(hash: string, tags: string[]): Promise<void> { }
    async removeTags(hash: string, tags: string[]): Promise<void> { }


    private mapTorrent(t: RTorrentTuple): Torrent {
        // [hash, name, size, bytes_done, up_rate, down_rate, complete, state, is_active, label, ratio, hashing, path, up_total, message]
        const [hash, name, size, done, up, down, complete, state, active, label, ratio, hashing, path, up_total, msg] = t;

        return {
            id: hash,
            name: name,
            status: this.mapStatus(state, active, complete, hashing),
            progress: this.calcProgress(done, size),
            size: Number(size),
            downloadSpeed: down,
            uploadSpeed: up,
            eta: down > 0 ? (Number(size) - Number(done)) / down : -1,
            savePath: path,
            addedDate: 0,
            category: label,
            tags: []
        };
    }

    private calcProgress(done: string | number, size: string | number): number {
        const d = Number(done);
        const s = Number(size);
        if (s === 0) return 0;
        return (d / s) * 100;
    }

    private mapStatus(state: number, active: number, complete: number, hashing: number): TorrentStatus {
        if (hashing === 1) return 'checking';
        if (state === 0) return 'paused'; // User stopped
        if (active === 0) return 'paused'; // Technically 'started' but not active? usually paused.
        if (complete === 1) return 'seeding';
        return 'downloading';
    }
}
