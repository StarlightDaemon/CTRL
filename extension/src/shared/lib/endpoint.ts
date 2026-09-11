/**
 * Endpoint URL handling.
 *
 * Server addresses are stored as full absolute URLs. Users may enter a bare
 * host, a host:port, an IPv6 literal, or a URL with a reverse-proxy sub-path.
 * Everything is normalised through the platform `URL` parser rather than by
 * splitting on ":"; that is the only way IPv6 and paths survive intact.
 */

export type EndpointParseResult =
    | { ok: true; url: URL; normalized: string }
    | { ok: false; error: string };

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Parses user input into an absolute http(s) URL. A missing scheme defaults
 * to http://. Userinfo (user:pass@host) is rejected so credentials never live
 * in the address field. The normalised form always ends with a slash.
 */
export function parseEndpoint(input: string): EndpointParseResult {
    const trimmed = (input ?? '').trim();
    if (!trimmed) return { ok: false, error: 'Enter the server address.' };

    // Anything that already names a scheme is parsed as-is; a bare host gets http://.
    // `host:port` looks like a scheme ("host:") only when the scheme part has no
    // dots and is followed by digits, so it is treated as host:port instead.
    const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
    const looksLikeHostPort = !!schemeMatch && /^[a-z0-9.-]+:\d+(\/|$)/i.test(trimmed) && !trimmed.includes('://');
    const hasScheme = !!schemeMatch && !looksLikeHostPort;
    const withScheme = hasScheme ? trimmed : `http://${trimmed}`;

    if (hasScheme && !ALLOWED_PROTOCOLS.has(`${schemeMatch![1].toLowerCase()}:`)) {
        return { ok: false, error: 'Only http:// and https:// addresses are supported.' };
    }

    let url: URL;
    try {
        url = new URL(withScheme);
    } catch {
        return { ok: false, error: 'The server address is not a valid URL.' };
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
        return { ok: false, error: 'Only http:// and https:// addresses are supported.' };
    }
    if (url.username || url.password) {
        return { ok: false, error: 'Put the username and password in their own fields, not in the address.' };
    }
    if (!url.hostname) {
        return { ok: false, error: 'The server address needs a host name or IP address.' };
    }

    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;

    return { ok: true, url, normalized: url.toString() };
}

/** True for loopback, RFC1918 and link-local hosts. */
export function isPrivateHost(hostname: string): boolean {
    const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/**
 * Resolves the concrete RPC/API URL for a client type from the stored base
 * address. Conventions per client:
 *
 * - transmission / vuze / biglybt: `<base>transmission/rpc`, unless the user
 *   already pointed at a path ending in `/rpc`.
 * - aria2: `<base>jsonrpc`, unless the path already ends in `/jsonrpc`.
 * - qbittorrent: `<base>api/v2/`.
 * - everything else: the base as given.
 */
export function resolveClientEndpoint(type: string, base: string): string {
    const parsed = parseEndpoint(base);
    const root = parsed.ok ? parsed.url : new URL(base);
    const path = root.pathname;

    switch (type) {
        case 'transmission':
        case 'vuze_remoteui':
        case 'biglybt': {
            if (/\/rpc\/?$/.test(path)) return stripTrailingSlash(root.toString());
            return `${root.toString()}transmission/rpc`;
        }
        case 'aria2': {
            if (/\/jsonrpc\/?$/.test(path)) return stripTrailingSlash(root.toString());
            return `${root.toString()}jsonrpc`;
        }
        case 'qbittorrent':
            return `${root.toString()}api/v2/`;
        default:
            return root.toString();
    }
}

function stripTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
}
