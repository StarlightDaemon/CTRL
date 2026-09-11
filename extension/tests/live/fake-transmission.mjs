/**
 * Minimal Transmission-RPC-compatible server for state-integrity tests.
 *
 * It speaks enough of the protocol for the extension's Transmission adapter
 * (session-id negotiation via 409 + X-Transmission-Session-Id, Basic auth,
 * session-get, torrent-get/stop/start/start-now/remove/add) and gives the
 * harness what a real client cannot: a torrent list it can set at will
 * (including ids that collide with another server's), an artificial response
 * delay, and a log of every RPC call received. No BitTorrent traffic exists.
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';

function expand(t, index) {
    return {
        id: t.id,
        name: t.name,
        status: t.status ?? 4,
        totalSize: 1_048_576,
        percentDone: 0,
        rateDownload: 0,
        rateUpload: 0,
        eta: -1,
        downloadDir: '/tmp/ctrl-fake',
        addedDate: 1_700_000_000 + index,
        error: 0,
        errorString: '',
        hashString: (t.hash ?? `${'0'.repeat(38)}${String(t.id).padStart(2, '0')}`).slice(0, 40),
        queuePosition: index,
        labels: [],
    };
}

export async function startFakeTransmission({ name, port, host = '0.0.0.0', username = 'ctrl', password = 'ctrl-test-password', torrents = [] }) {
    let list = torrents.map((t) => ({ ...t }));
    let delayMs = 0;
    let sessionId = randomBytes(12).toString('hex');
    const calls = [];
    const expectedAuth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
            if (req.method !== 'POST' || !req.url.startsWith('/transmission/rpc')) {
                res.writeHead(404); res.end('not found'); return;
            }
            if (req.headers.authorization !== expectedAuth) {
                res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Transmission"' }); res.end('401: Unauthorized'); return;
            }
            if (req.headers['x-transmission-session-id'] !== sessionId) {
                res.writeHead(409, { 'X-Transmission-Session-Id': sessionId }); res.end('409: Conflict'); return;
            }
            let rpc;
            try { rpc = JSON.parse(body || '{}'); } catch { res.writeHead(400); res.end('bad json'); return; }
            const method = rpc.method;
            const args = rpc.arguments ?? {};
            calls.push({ method, arguments: args, at: Date.now() });
            if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));

            let result = { result: 'success', arguments: {} };
            switch (method) {
                case 'session-get':
                    result.arguments = { version: `4.1.3 (fake ${name})`, 'rpc-version': 17, 'rpc-version-minimum': 14, 'download-dir': '/tmp/ctrl-fake' };
                    break;
                case 'torrent-get': {
                    const ids = Array.isArray(args.ids) ? new Set(args.ids.map(Number)) : null;
                    result.arguments = { torrents: list.filter((t) => !ids || ids.has(t.id)).map(expand) };
                    break;
                }
                case 'torrent-stop':
                    for (const t of list) if ((args.ids ?? []).map(Number).includes(t.id)) t.status = 0;
                    break;
                case 'torrent-start':
                case 'torrent-start-now':
                    for (const t of list) if ((args.ids ?? []).map(Number).includes(t.id)) t.status = 4;
                    break;
                case 'torrent-remove': {
                    const ids = new Set((args.ids ?? []).map(Number));
                    list = list.filter((t) => !ids.has(t.id));
                    break;
                }
                case 'torrent-add': {
                    const id = Math.max(0, ...list.map((t) => t.id)) + 1;
                    const added = { id, name: args.filename ? `added-${id}` : `added-${id}`, status: args.paused ? 0 : 4 };
                    list.push(added);
                    result.arguments = { 'torrent-added': { id, name: added.name, hashString: expand(added, list.length).hashString } };
                    break;
                }
                default:
                    result = { result: `method '${method}' not supported by the fake`, arguments: {} };
            }
            const payload = JSON.stringify(result);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'X-Transmission-Session-Id': sessionId });
            res.end(payload);
        });
    });
    await new Promise((resolve, reject) => { server.on('error', reject); server.listen(port, host, resolve); });

    return {
        name,
        port,
        username,
        password,
        calls,
        setTorrents(next) { list = next.map((t) => ({ ...t })); },
        getTorrents() { return list.map((t) => ({ ...t })); },
        setDelay(ms) { delayMs = ms; },
        rotateSession() { sessionId = randomBytes(12).toString('hex'); },
        stop() { return new Promise((resolve) => server.close(() => resolve())); },
    };
}

// Standalone: node fake-transmission.mjs <port> [name]
if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    const port = Number(process.argv[2] || 19191);
    const fake = await startFakeTransmission({ name: process.argv[3] || 'fake', port, torrents: [{ id: 1, name: 'one' }, { id: 2, name: 'two' }] });
    console.log(`fake transmission "${fake.name}" listening on ${port} (user ${fake.username}); Ctrl+C to stop`);
}
