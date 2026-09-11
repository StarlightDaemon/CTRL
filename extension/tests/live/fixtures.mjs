/**
 * Disposable test torrents for live verification.
 *
 * Every torrent is generated from a deterministic pseudo-random byte stream,
 * so the info-hash is stable across runs and machines. The torrents carry no
 * trackers, set the `private` flag (no DHT/PEX), and describe content that
 * exists nowhere, so a client that receives them cannot contact anyone and
 * never downloads anything. That is exactly what is needed to exercise
 * add / list / pause / resume / remove without touching real data.
 */
import { createHash } from 'node:crypto';

/** Deterministic byte stream (xorshift32 seeded by name). */
function pseudoRandomBytes(seed, length) {
    let x = 0;
    for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    if (x === 0) x = 0x9e3779b9;
    const out = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
        x ^= x << 13; x >>>= 0;
        x ^= x >>> 17;
        x ^= x << 5; x >>>= 0;
        out[i] = x & 0xff;
    }
    return out;
}

// Minimal bencode with sorted dictionary keys (required for a canonical info dict).
function bencode(value) {
    if (Buffer.isBuffer(value)) return Buffer.concat([Buffer.from(`${value.length}:`), value]);
    if (typeof value === 'string') return bencode(Buffer.from(value, 'utf8'));
    if (typeof value === 'number') return Buffer.from(`i${value}e`);
    if (Array.isArray(value)) return Buffer.concat([Buffer.from('l'), ...value.map(bencode), Buffer.from('e')]);
    const keys = Object.keys(value).sort();
    return Buffer.concat([Buffer.from('d'), ...keys.flatMap((k) => [bencode(k), bencode(value[k])]), Buffer.from('e')]);
}

export function makeTestTorrent(name, size, pieceLength = 256 * 1024) {
    const content = pseudoRandomBytes(name, size);
    const pieces = [];
    for (let offset = 0; offset < content.length; offset += pieceLength) {
        pieces.push(createHash('sha1').update(content.subarray(offset, offset + pieceLength)).digest());
    }
    const info = {
        length: size,
        name,
        'piece length': pieceLength,
        pieces: Buffer.concat(pieces),
        private: 1,
    };
    const infoBytes = bencode(info);
    const infoHash = createHash('sha1').update(infoBytes).digest('hex');
    const torrent = bencode({
        'created by': 'CTRL live verification',
        'creation date': 1_700_000_000,
        comment: 'Disposable test torrent: no trackers, private, content exists nowhere.',
        info,
    });
    return {
        name,
        size,
        infoHash,
        magnet: `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`,
        torrent,
    };
}

export const TEST_TORRENTS = {
    a: makeTestTorrent('ctrl-live-a.bin', 1024 * 1024),
    b: makeTestTorrent('ctrl-live-b.bin', 512 * 1024),
    c: makeTestTorrent('ctrl-live-c.bin', 768 * 1024),
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    for (const t of Object.values(TEST_TORRENTS)) {
        console.log(`${t.name}\t${t.size}\t${t.infoHash}\t${t.magnet}`);
    }
}
