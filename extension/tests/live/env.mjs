#!/usr/bin/env node
/**
 * Disposable torrent-client environment for CTRL live verification (Windows).
 *
 *   node tests/live/env.mjs fetch            download pinned upstream releases, verify sha256
 *   node tests/live/env.mjs extract          unpack them (no installer is ever run)
 *   node tests/live/env.mjs start <client>   start transmission | qbittorrent | aria2 | all
 *   node tests/live/env.mjs stop  <client>   stop one or all
 *   node tests/live/env.mjs status           which clients answer on their ports
 *   node tests/live/env.mjs info             JSON the harness consumes (ports, test credentials, paths)
 *   node tests/live/env.mjs clean            stop everything and delete the runtime state (keeps downloads/binaries)
 *   node tests/live/env.mjs purge            clean + delete downloads and binaries
 *
 * Everything lives under CTRL_LIVE_ROOT (default %LOCALAPPDATA%\Temp\ctrl-live):
 * nothing is installed, no service is registered, no system setting changes.
 * Credentials below are throwaway test values for these temporary processes;
 * they are not secrets. Each client listens on all interfaces on a non-default
 * port so the extension can be pointed at the host's LAN address (a
 * non-loopback origin, as V1_SCOPE.md §3 requires).
 *
 * Provenance: every asset is the upstream project's own GitHub release;
 * hashes were recorded on first download (2026-09-09) and are enforced.
 */
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ROOT = process.env.CTRL_LIVE_ROOT || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'Temp', 'ctrl-live');
const DOWNLOADS = path.join(ROOT, 'downloads');
const BIN = path.join(ROOT, 'bin');
const RUN = path.join(ROOT, 'run');

export const ASSETS = {
    transmission: {
        version: '4.1.3',
        file: 'transmission-4.1.3-x64.msi',
        url: 'https://github.com/transmission/transmission/releases/download/4.1.3/transmission-4.1.3-x64.msi',
        sha256: 'c8ea492d8f46fadac26e0c05b244cabba556201d5fe348dfcf1cf036621741f8',
        exe: path.join(BIN, 'transmission', 'PFiles', 'Transmission', 'transmission-daemon.exe'),
    },
    qbittorrent: {
        version: '5.2.3',
        file: 'qbittorrent_5.2.3_x64_setup.exe',
        url: 'https://github.com/qbittorrent/qBittorrent/releases/download/release-5.2.3/qbittorrent_5.2.3_x64_setup.exe',
        sha256: 'ff508e2f912d59c9eabaf03633ebacfd45c2049f38dcac027b8a7d7ad867ab2f',
        // Detached signature by sledgehammer999 (D8F3 DA77 AAC6 7410 5359 9C13 6E4A 2D02 5B7C C9A2); verified 2026-09-09.
        signature: 'https://github.com/qbittorrent/qBittorrent/releases/download/release-5.2.3/qbittorrent_5.2.3_x64_setup.exe.asc',
        exe: path.join(BIN, 'qbittorrent', 'qbittorrent.exe'),
    },
    aria2: {
        version: '1.37.0',
        file: 'aria2-1.37.0-win-64bit-build1.zip',
        url: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip',
        sha256: '67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288',
        exe: path.join(BIN, 'aria2', 'aria2-1.37.0-win-64bit-build1', 'aria2c.exe'),
    },
    /** Not a torrent client: Mozilla's WebDriver implementation, used by the Firefox harness. */
    geckodriver: {
        version: '0.37.1',
        file: 'geckodriver-v0.37.1-win64.zip',
        url: 'https://github.com/mozilla/geckodriver/releases/download/v0.37.1/geckodriver-v0.37.1-win64.zip',
        sha256: 'dfed9315abe8d2fbc1b6161a2ee8002452e79cf05ee92fdc653a4e26bc35edd8',
        exe: path.join(BIN, 'geckodriver', 'geckodriver.exe'),
    },
};

/** Throwaway values for the temporary processes. Not real credentials. */
export const TEST_CREDENTIALS = {
    username: 'ctrl',
    password: 'ctrl-test-password',
    aria2Secret: 'ctrl-test-token',
};

export const PORTS = {
    transmission: { rpc: 19091, peer: 16881 },
    qbittorrent: { web: 18080, peer: 16882 },
    aria2: { rpc: 16800, peer: 16883 },
};

const CLIENTS = ['transmission', 'qbittorrent', 'aria2'];

// ------------------------------------------------------------------ helpers

function sha256(file) {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function lanAddress() {
    for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
        for (const a of addrs ?? []) {
            if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) return { name, address: a.address };
        }
    }
    return { name: 'loopback', address: '127.0.0.1' };
}

function runDir(client) {
    return path.join(RUN, client);
}

function pidFile(client) {
    return path.join(runDir(client), 'pid');
}

function readPid(client) {
    try {
        const pid = Number(fs.readFileSync(pidFile(client), 'utf8').trim());
        return Number.isInteger(pid) && pid > 0 ? pid : null;
    } catch {
        return null;
    }
}

function isRunning(pid) {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function waitForHttp(url, { timeoutMs = 30_000, okStatuses } = {}) {
    const started = Date.now();
    let last = null;
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(2000) });
            last = res.status;
            if (!okStatuses || okStatuses.includes(res.status)) return res.status;
        } catch (e) {
            last = e.code ?? e.name;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`${url} did not answer as expected within ${timeoutMs} ms (last: ${last})`);
}

/** qBittorrent's WebUI password format: PBKDF2-HMAC-SHA512, 100k iterations, 16-byte salt, 64-byte key. */
export function qbittorrentPasswordHash(password) {
    const salt = randomBytes(16);
    const key = pbkdf2Sync(password, salt, 100_000, 64, 'sha512');
    return `@ByteArray(${salt.toString('base64')}:${key.toString('base64')})`;
}

// ----------------------------------------------------------------- commands

export async function fetchAssets() {
    fs.mkdirSync(DOWNLOADS, { recursive: true });
    for (const [client, asset] of Object.entries(ASSETS)) {
        const target = path.join(DOWNLOADS, asset.file);
        if (fs.existsSync(target) && sha256(target) === asset.sha256) {
            console.log(`${client}: ${asset.file} present, sha256 ok`);
            continue;
        }
        console.log(`${client}: downloading ${asset.url}`);
        const res = await fetch(asset.url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${asset.url}`);
        fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
        const actual = sha256(target);
        if (actual !== asset.sha256) {
            fs.rmSync(target);
            throw new Error(`${asset.file}: sha256 mismatch (expected ${asset.sha256}, got ${actual}); refusing to keep it`);
        }
        console.log(`${client}: sha256 ok`);
        if (asset.signature) {
            const sig = await fetch(asset.signature, { redirect: 'follow' });
            if (sig.ok) fs.writeFileSync(`${target}.asc`, Buffer.from(await sig.arrayBuffer()));
        }
    }
}

export function extractAssets() {
    if (process.platform !== 'win32') throw new Error('extract is implemented for Windows only (msiexec / 7-Zip / Expand-Archive)');
    fs.mkdirSync(BIN, { recursive: true });
    const sevenZip = ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe'].find((p) => fs.existsSync(p));

    // Transmission: administrative install = unpack the MSI's file table, no registration.
    if (!fs.existsSync(ASSETS.transmission.exe)) {
        const target = path.join(BIN, 'transmission');
        const r = spawnSync('msiexec.exe', ['/a', path.join(DOWNLOADS, ASSETS.transmission.file), '/qn', `TARGETDIR=${target}`, '/l*v', path.join(BIN, 'transmission-msi.log')], { stdio: 'inherit' });
        if (r.status !== 0) throw new Error(`msiexec /a failed with ${r.status} (see ${path.join(BIN, 'transmission-msi.log')})`);
    }
    // qBittorrent: the NSIS installer is an archive 7-Zip can unpack; the installer itself never runs.
    if (!fs.existsSync(ASSETS.qbittorrent.exe)) {
        if (!sevenZip) throw new Error('7-Zip is required to unpack the qBittorrent installer without running it (https://www.7-zip.org/)');
        const r = spawnSync(sevenZip, ['x', '-y', `-o${path.join(BIN, 'qbittorrent')}`, path.join(DOWNLOADS, ASSETS.qbittorrent.file)], { stdio: 'ignore' });
        if (r.status !== 0) throw new Error(`7z x failed with ${r.status}`);
    }
    // aria2 and geckodriver: plain zips.
    for (const [name, asset] of [['aria2', ASSETS.aria2], ['geckodriver', ASSETS.geckodriver]]) {
        if (fs.existsSync(asset.exe)) continue;
        const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${path.join(DOWNLOADS, asset.file)}' -DestinationPath '${path.join(BIN, name)}'`], { stdio: 'inherit' });
        if (r.status !== 0) throw new Error(`Expand-Archive (${name}) failed with ${r.status}`);
    }
    for (const [client, asset] of Object.entries(ASSETS)) {
        console.log(`${client}: ${fs.existsSync(asset.exe) ? 'ok' : 'MISSING'} ${asset.exe}`);
    }
}

function launch(client, exe, args, { cwd, env: extraEnv } = {}) {
    const dir = runDir(client);
    fs.mkdirSync(dir, { recursive: true });
    const out = fs.openSync(path.join(dir, 'stdout.log'), 'a');
    const err = fs.openSync(path.join(dir, 'stderr.log'), 'a');
    const child = spawn(exe, args, {
        cwd: cwd ?? dir,
        detached: true,
        stdio: ['ignore', out, err],
        windowsHide: true,
        env: { ...process.env, ...(extraEnv ?? {}) },
    });
    fs.writeFileSync(pidFile(client), String(child.pid));
    child.unref();
    return child.pid;
}

/**
 * Starts a client. Existing runtime state (config, resume data) is kept so a
 * stop/start behaves like a real client restart; pass `fresh: true` (or run
 * `clean`) to start from an empty state.
 */
export async function startClient(client, { fresh = false } = {}) {
    const { address } = lanAddress();
    if (isRunning(readPid(client))) {
        console.log(`${client}: already running (pid ${readPid(client)})`);
        return;
    }
    const dir = runDir(client);
    if (fresh) fs.rmSync(dir, { recursive: true, force: true });
    const firstStart = !fs.existsSync(dir);
    fs.mkdirSync(dir, { recursive: true });
    const downloads = path.join(dir, 'downloads');
    fs.mkdirSync(downloads, { recursive: true });

    switch (client) {
        case 'transmission': {
            const config = path.join(dir, 'config');
            fs.mkdirSync(config, { recursive: true });
            const pid = launch(client, ASSETS.transmission.exe, [
                '--foreground',
                '--config-dir', config,
                '--port', String(PORTS.transmission.rpc),
                '--allowed', '*.*.*.*',
                '--auth', '--username', TEST_CREDENTIALS.username, '--password', TEST_CREDENTIALS.password,
                '--download-dir', downloads,
                '--no-incomplete-dir',
                '--peerport', String(PORTS.transmission.peer),
                '--no-dht', '--no-lpd', '--no-portmap',
                '--log-level', 'info',
                '--logfile', path.join(dir, 'transmission.log'),
            ]);
            await waitForHttp(`http://127.0.0.1:${PORTS.transmission.rpc}/transmission/rpc/`, { okStatuses: [401, 409] });
            console.log(`transmission ${ASSETS.transmission.version}: pid ${pid}, rpc http://${address}:${PORTS.transmission.rpc}/`);
            return;
        }
        case 'qbittorrent': {
            // --profile puts everything (config, data, cache) under this directory.
            const profile = path.join(dir, 'profile');
            const configDir = path.join(profile, 'qBittorrent', 'config');
            fs.mkdirSync(configDir, { recursive: true });
            if (firstStart || !fs.existsSync(path.join(configDir, 'qBittorrent.ini'))) fs.writeFileSync(path.join(configDir, 'qBittorrent.ini'), [
                '[LegalNotice]',
                'Accepted=true',
                '',
                '[Preferences]',
                'General\\Locale=en',
                'WebUI\\Enabled=true',
                'WebUI\\Address=*',
                `WebUI\\Port=${PORTS.qbittorrent.web}`,
                `WebUI\\Username=${TEST_CREDENTIALS.username}`,
                `WebUI\\Password_PBKDF2="${qbittorrentPasswordHash(TEST_CREDENTIALS.password)}"`,
                'WebUI\\LocalHostAuth=true',
                // Default is on. CTRL_QBT_CSRF=off reproduces the documented server-side setting
                // some users apply for browser extensions; the evidence must say which was used.
                `WebUI\\CSRFProtection=${process.env.CTRL_QBT_CSRF === 'off' ? 'false' : 'true'}`,
                'WebUI\\HostHeaderValidation=true',
                'WebUI\\ClickjackingProtection=true',
                'WebUI\\UseUPnP=false',
                'WebUI\\HTTPS\\Enabled=false',
                'Connection\\UPnP=false',
                '',
                '[BitTorrent]',
                `Session\\Port=${PORTS.qbittorrent.peer}`,
                'Session\\DHTEnabled=false',
                'Session\\PeXEnabled=false',
                'Session\\LSDEnabled=false',
                'Session\\UseRandomPort=false',
                `Session\\DefaultSavePath=${downloads.replace(/\\/g, '/')}`,
                'Session\\TempPathEnabled=false',
                '',
            ].join('\r\n'));
            const pid = launch(client, ASSETS.qbittorrent.exe, [
                `--profile=${profile}`,
                `--webui-port=${PORTS.qbittorrent.web}`,
                '--no-splash',
            ]);
            // Any answer from the WebUI port proves the process is up (403 = not logged in).
            await waitForHttp(`http://127.0.0.1:${PORTS.qbittorrent.web}/api/v2/app/version`, { timeoutMs: 60_000 });
            console.log(`qbittorrent ${ASSETS.qbittorrent.version}: pid ${pid}, web ui http://${address}:${PORTS.qbittorrent.web}/`);
            return;
        }
        case 'aria2': {
            const pid = launch(client, ASSETS.aria2.exe, [
                '--no-conf',
                '--enable-rpc',
                '--rpc-listen-all',
                `--rpc-listen-port=${PORTS.aria2.rpc}`,
                `--rpc-secret=${TEST_CREDENTIALS.aria2Secret}`,
                `--dir=${downloads}`,
                `--listen-port=${PORTS.aria2.peer}`,
                '--enable-dht=false', '--enable-dht6=false', '--bt-enable-lpd=false', '--enable-peer-exchange=false',
                '--seed-time=0',
                '--log-level=info', `--log=${path.join(dir, 'aria2.log')}`,
                '--console-log-level=warn',
            ]);
            await waitForHttp(`http://127.0.0.1:${PORTS.aria2.rpc}/jsonrpc`);
            console.log(`aria2 ${ASSETS.aria2.version}: pid ${pid}, rpc http://${address}:${PORTS.aria2.rpc}/jsonrpc`);
            return;
        }
        default:
            throw new Error(`unknown client ${client}`);
    }
}

export function stopClient(client) {
    const pid = readPid(client);
    if (!pid) return;
    if (isRunning(pid)) {
        if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        else process.kill(pid, 'SIGTERM');
        console.log(`${client}: stopped pid ${pid}`);
    }
    fs.rmSync(pidFile(client), { force: true });
}

export async function status() {
    const { address } = lanAddress();
    const probes = {
        transmission: `http://127.0.0.1:${PORTS.transmission.rpc}/transmission/rpc/`,
        qbittorrent: `http://127.0.0.1:${PORTS.qbittorrent.web}/api/v2/app/version`,
        aria2: `http://127.0.0.1:${PORTS.aria2.rpc}/jsonrpc`,
    };
    const result = {};
    for (const client of CLIENTS) {
        let http = 'down';
        try {
            const res = await fetch(probes[client], { signal: AbortSignal.timeout(2000) });
            http = `HTTP ${res.status}`;
        } catch (e) {
            http = `down (${e.code ?? e.name})`;
        }
        result[client] = { pid: readPid(client), running: isRunning(readPid(client)), http };
        console.log(`${client}: ${http}${result[client].pid ? ` (pid ${result[client].pid})` : ''}`);
    }
    console.log(`LAN address for the extension: ${address}`);
    return result;
}

export function info() {
    const { address } = lanAddress();
    return {
        root: ROOT,
        lanAddress: address,
        geckodriver: ASSETS.geckodriver.exe,
        transmission: {
            version: ASSETS.transmission.version,
            baseUrl: `http://${address}:${PORTS.transmission.rpc}/`,
            username: TEST_CREDENTIALS.username,
            password: TEST_CREDENTIALS.password,
            log: path.join(runDir('transmission'), 'transmission.log'),
        },
        qbittorrent: {
            version: ASSETS.qbittorrent.version,
            baseUrl: `http://${address}:${PORTS.qbittorrent.web}/`,
            username: TEST_CREDENTIALS.username,
            password: TEST_CREDENTIALS.password,
            log: path.join(runDir('qbittorrent'), 'profile', 'qBittorrent', 'data', 'logs', 'qbittorrent.log'),
        },
        aria2: {
            version: ASSETS.aria2.version,
            baseUrl: `http://${address}:${PORTS.aria2.rpc}/jsonrpc`,
            secret: TEST_CREDENTIALS.aria2Secret,
            log: path.join(runDir('aria2'), 'aria2.log'),
        },
    };
}

export function clean({ purge = false } = {}) {
    for (const client of CLIENTS) stopClient(client);
    fs.rmSync(RUN, { recursive: true, force: true });
    console.log(`removed ${RUN}`);
    if (purge) {
        fs.rmSync(ROOT, { recursive: true, force: true });
        console.log(`removed ${ROOT}`);
    }
}

// ---------------------------------------------------------------------- CLI

const isMain = process.argv[1] && import.meta.url === `file:///${path.resolve(process.argv[1]).replace(/\\/g, '/')}`;
if (isMain) {
    const [, , command, target = 'all'] = process.argv;
    const clients = target === 'all' ? CLIENTS : [target];
    try {
        switch (command) {
            case 'fetch': await fetchAssets(); break;
            case 'extract': extractAssets(); break;
            case 'start': for (const c of clients) await startClient(c, { fresh: process.argv.includes('--fresh') }); break;
            case 'stop': for (const c of clients) stopClient(c); break;
            case 'restart': for (const c of clients) { stopClient(c); await startClient(c); } break;
            case 'status': await status(); break;
            case 'info': console.log(JSON.stringify(info(), null, 2)); break;
            case 'clean': clean(); break;
            case 'purge': clean({ purge: true }); break;
            default:
                console.error('usage: env.mjs fetch|extract|start [--fresh]|stop|restart|status|info|clean|purge [client|all]');
                process.exit(2);
        }
    } catch (e) {
        console.error(String(e?.stack ?? e));
        process.exit(1);
    }
}
