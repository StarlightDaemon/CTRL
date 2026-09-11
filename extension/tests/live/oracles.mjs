/**
 * Independent "truth" clients for the live-verification environment.
 *
 * The browser harness drives CTRL; these oracles talk to the torrent client
 * directly (plain Node fetch, no extension code) so every claim the
 * extension makes ("added", "paused", "removed") is checked against the
 * server's own state. They also reset the client between scenarios.
 */

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ---------------------------------------------------------------- Transmission

export class TransmissionOracle {
    constructor({ baseUrl, username, password }) {
        this.rpcUrl = new URL('transmission/rpc', baseUrl).toString();
        this.auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
        this.sessionId = null;
    }

    async call(method, args = {}) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const headers = { 'Content-Type': 'application/json', Authorization: this.auth };
            if (this.sessionId) headers['X-Transmission-Session-Id'] = this.sessionId;
            const res = await fetchWithTimeout(this.rpcUrl, { method: 'POST', headers, body: JSON.stringify({ method, arguments: args }) });
            if (res.status === 409) {
                this.sessionId = res.headers.get('x-transmission-session-id');
                continue;
            }
            if (!res.ok) throw new Error(`transmission ${method}: HTTP ${res.status}`);
            const body = await res.json();
            if (body.result !== 'success') throw new Error(`transmission ${method}: ${body.result}`);
            return body.arguments;
        }
        throw new Error('transmission: could not negotiate session id');
    }

    async version() {
        const s = await this.call('session-get', { fields: ['version', 'rpc-version'] });
        return `${s.version} (rpc ${s['rpc-version']})`;
    }

    /** @returns {Array<{id:string, hash:string, name:string, status:string, paused:boolean}>} */
    async list() {
        const r = await this.call('torrent-get', { fields: ['id', 'hashString', 'name', 'status'] });
        return r.torrents.map((t) => ({ id: String(t.id), hash: t.hashString, name: t.name, status: String(t.status), paused: t.status === 0 }));
    }

    async removeAll() {
        const ids = (await this.list()).map((t) => Number(t.id));
        if (ids.length) await this.call('torrent-remove', { ids, 'delete-local-data': false });
    }
}

// ----------------------------------------------------------------- qBittorrent

export class QBittorrentOracle {
    constructor({ baseUrl, username, password }) {
        this.base = new URL(baseUrl);
        this.api = new URL('api/v2/', this.base).toString();
        this.username = username;
        this.password = password;
        this.cookie = null;
    }

    headers(extra = {}) {
        // qBittorrent validates Referer/Origin against its own host (CSRF); a
        // same-origin Referer is what a browser on its web UI would send.
        const h = { Referer: this.base.origin + '/', Origin: this.base.origin, ...extra };
        if (this.cookie) h.Cookie = this.cookie;
        return h;
    }

    async login() {
        const res = await fetchWithTimeout(this.api + 'auth/login', {
            method: 'POST',
            headers: this.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
            body: new URLSearchParams({ username: this.username, password: this.password }),
        });
        const text = await res.text();
        // 4.x answers `200 Ok.`; 5.2 answers `204` with an empty body. Both set the session cookie
        // (`SID` in 4.x, `QBT_SID_<port>` in 5.2). A wrong password is a 401.
        if (res.status !== 200 && res.status !== 204) throw new Error(`qbittorrent login: HTTP ${res.status} ${text.trim()}`);
        const setCookie = res.headers.get('set-cookie') ?? '';
        const m = setCookie.match(/((?:QBT_)?SID[^=;]*)=([^;]+)/);
        if (!m) throw new Error(`qbittorrent login: no session cookie (HTTP ${res.status} ${text.trim()})`);
        this.cookie = `${m[1]}=${m[2]}`;
    }

    async get(pathname, params) {
        if (!this.cookie) await this.login();
        const url = this.api + pathname + (params ? '?' + new URLSearchParams(params) : '');
        const res = await fetchWithTimeout(url, { headers: this.headers() });
        if (!res.ok) throw new Error(`qbittorrent GET ${pathname}: HTTP ${res.status}`);
        return res.text();
    }

    async post(pathname, form) {
        if (!this.cookie) await this.login();
        const res = await fetchWithTimeout(this.api + pathname, {
            method: 'POST',
            headers: this.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
            body: new URLSearchParams(form),
        });
        if (!res.ok) throw new Error(`qbittorrent POST ${pathname}: HTTP ${res.status}`);
        return res.text();
    }

    async version() {
        return `${await this.get('app/version')} (web api ${await this.get('app/webapiVersion')})`;
    }

    async list() {
        const items = JSON.parse(await this.get('torrents/info'));
        return items.map((t) => ({
            id: t.hash,
            hash: t.hash,
            name: t.name,
            status: t.state,
            paused: /^(paused|stopped)/.test(t.state),
        }));
    }

    async removeAll() {
        await this.post('torrents/delete', { hashes: 'all', deleteFiles: 'false' });
    }
}

// ----------------------------------------------------------------------- aria2

export class Aria2Oracle {
    constructor({ baseUrl, secret }) {
        this.rpcUrl = /\/jsonrpc\/?$/.test(new URL(baseUrl).pathname) ? baseUrl.replace(/\/$/, '') : new URL('jsonrpc', baseUrl).toString();
        this.secret = secret;
        this.seq = 0;
    }

    async call(method, params = []) {
        const body = { jsonrpc: '2.0', id: String(++this.seq), method, params: this.secret ? [`token:${this.secret}`, ...params] : params };
        const res = await fetchWithTimeout(this.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.error) throw new Error(`aria2 ${method}: ${json.error.code} ${json.error.message}`);
        return json.result;
    }

    async version() {
        return (await this.call('aria2.getVersion')).version;
    }

    async list() {
        const keys = ['gid', 'status', 'bittorrent', 'infoHash', 'files'];
        const [active, waiting, stopped] = await Promise.all([
            this.call('aria2.tellActive', [keys]),
            this.call('aria2.tellWaiting', [0, 1000, keys]),
            this.call('aria2.tellStopped', [0, 1000, keys]),
        ]);
        return [...active, ...waiting, ...stopped].map((d) => ({
            id: d.gid,
            hash: d.infoHash ?? '',
            name: d.bittorrent?.info?.name ?? d.files?.[0]?.path ?? d.gid,
            status: d.status,
            paused: d.status === 'paused',
        }));
    }

    async removeAll() {
        const all = await this.list();
        for (const d of all) {
            if (d.status === 'active' || d.status === 'waiting' || d.status === 'paused') {
                await this.call('aria2.forceRemove', [d.id]).catch(() => { });
            }
        }
        await this.call('aria2.purgeDownloadResult');
    }
}

export function oracleFor(client, env) {
    switch (client) {
        case 'transmission':
            return new TransmissionOracle({ baseUrl: env.transmission.baseUrl, username: env.transmission.username, password: env.transmission.password });
        case 'qbittorrent':
            return new QBittorrentOracle({ baseUrl: env.qbittorrent.baseUrl, username: env.qbittorrent.username, password: env.qbittorrent.password });
        case 'aria2':
            return new Aria2Oracle({ baseUrl: env.aria2.baseUrl, secret: env.aria2.secret });
        default:
            throw new Error(`no oracle for ${client}`);
    }
}
