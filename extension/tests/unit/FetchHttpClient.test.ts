import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    FetchHttpClient,
    TimeoutError,
    OutcomeUnknownError,
    AbortedError,
} from '@/shared/api/network/FetchHttpClient';
import { HttpError } from '@/shared/api/network/HttpError';

/**
 * Transport contract tests.
 *
 * `fetch` is replaced with a spy that records the exact RequestInit the
 * browser would receive. The assertions model what a browser actually does
 * (forbidden headers are dropped, credentials mode decides cookies) so an
 * adapter that relies on something the browser will not send fails here.
 */

type Recorded = { url: string; init: RequestInit };

function mockFetch(handler: (req: Recorded) => Response | Promise<Response>) {
    const calls: Recorded[] = [];
    const spy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const rec = { url: String(input), init: init ?? {} };
        calls.push(rec);
        return handler(rec);
    });
    vi.stubGlobal('fetch', spy);
    return { spy, calls };
}

const ok = (body = '', headers: Record<string, string> = {}) =>
    new Response(body, { status: 200, headers });

function headersOf(init: RequestInit): Headers {
    return new Headers(init.headers);
}

describe('FetchHttpClient — request bodies', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('sends a raw XML string untouched with the caller\'s content type', async () => {
        const { calls } = mockFetch(() => ok('<ok/>'));
        const client = new FetchHttpClient('http://box.example/RPC2');
        const xml = '<?xml version="1.0"?><methodCall><methodName>x</methodName></methodCall>';
        await client.post('', xml, { headers: { 'Content-Type': 'text/xml' } });
        expect(calls[0].init.body).toBe(xml);
        expect(headersOf(calls[0].init).get('content-type')).toBe('text/xml');
    });

    it('JSON encodes plain objects and sets application/json', async () => {
        const { calls } = mockFetch(() => ok('{}'));
        const client = new FetchHttpClient('http://box.example/');
        await client.post('rpc', { method: 'session-get', arguments: {} });
        expect(calls[0].init.body).toBe('{"method":"session-get","arguments":{}}');
        expect(headersOf(calls[0].init).get('content-type')).toBe('application/json');
    });

    it('passes FormData and URLSearchParams through without a content type override', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/api/v2/');
        const form = new FormData();
        form.append('urls', 'magnet:?x');
        await client.post('torrents/add', form);
        expect(calls[0].init.body).toBe(form);
        expect(headersOf(calls[0].init).has('content-type')).toBe(false);

        const params = new URLSearchParams({ username: 'u', password: 'p' });
        await client.post('auth/login', params);
        expect(calls[1].init.body).toBe(params);
        expect(headersOf(calls[1].init).has('content-type')).toBe(false);
    });

    it('sends binary bodies verbatim', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/');
        const bytes = new Uint8Array([1, 2, 3]);
        await client.post('upload', bytes, { headers: { 'Content-Type': 'application/octet-stream' } });
        expect(calls[0].init.body).toBe(bytes);
    });

    it('sends no body for null', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/');
        await client.post('logout', null);
        expect(calls[0].init.body).toBeUndefined();
    });

    it('appends query params and resolves relative endpoints against the base', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/base/');
        await client.get('items', { params: { a: '1', b: 'x y' } });
        expect(calls[0].url).toBe('http://box.example/base/items?a=1&b=x+y');
    });
});

describe('FetchHttpClient — headers and credentials', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('defaults to credentials: omit and never sets Origin, Referer or Cookie', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/');
        await client.get('x', { headers: { Origin: 'http://box.example', Referer: 'http://box.example/', Cookie: 'a=b', 'X-Custom': '1' } });
        expect(calls[0].init.credentials).toBe('omit');
        const h = headersOf(calls[0].init);
        expect(h.has('origin')).toBe(false);
        expect(h.has('referer')).toBe(false);
        expect(h.has('cookie')).toBe(false);
        expect(h.get('x-custom')).toBe('1');
    });

    it('uses credentials: include when the profile asks for browser-managed cookies', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/', { credentials: 'include' });
        await client.get('x');
        expect(calls[0].init.credentials).toBe('include');
    });

    it('preserves an explicit Authorization header', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/');
        await client.get('x', { headers: { Authorization: 'Basic dTpw' } });
        expect(headersOf(calls[0].init).get('authorization')).toBe('Basic dTpw');
    });

    it('applies profile default headers and lets per-call headers override them', async () => {
        const { calls } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/', { defaultHeaders: { 'X-A': '1', 'X-B': '1' } });
        await client.get('x', { headers: { 'X-B': '2' } });
        const h = headersOf(calls[0].init);
        expect(h.get('x-a')).toBe('1');
        expect(h.get('x-b')).toBe('2');
    });
});

describe('FetchHttpClient — responses', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('parses JSON, falls back to text, and returns {} for empty bodies', async () => {
        let n = 0;
        mockFetch(() => ok(['{"a":1}', 'Ok.', ''][n++]));
        const client = new FetchHttpClient('http://box.example/');
        expect(await client.get('a')).toEqual({ a: 1 });
        expect(await client.get('b')).toBe('Ok.');
        expect(await client.get('c')).toEqual({});
    });

    it('throws HttpError with the body text for non-2xx responses', async () => {
        mockFetch(() => new Response('Fails.', { status: 403, statusText: 'Forbidden' }));
        const client = new FetchHttpClient('http://box.example/');
        const error = await client.get('x').catch((e) => e);
        expect(error).toBeInstanceOf(HttpError);
        expect(error.status).toBe(403);
        expect(error.bodyText).toBe('Fails.');
    });

    it('exposes response headers through requestRaw', async () => {
        mockFetch(() => ok('', { 'X-Transmission-Session-Id': 'abc' }));
        const client = new FetchHttpClient('http://box.example/');
        const raw = await client.requestRaw('x');
        expect(raw.headers.get('X-Transmission-Session-Id')).toBe('abc');
        expect(raw.status).toBe(200);
    });
});

describe('FetchHttpClient — cancellation and timeouts', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    const neverResolving = (signal?: AbortSignal | null) =>
        new Promise<Response>((_, reject) => {
            signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        });

    it('rejects immediately with AbortedError when the caller signal is already aborted', async () => {
        const { spy } = mockFetch(() => ok(''));
        const client = new FetchHttpClient('http://box.example/');
        const controller = new AbortController();
        controller.abort();
        await expect(client.get('x', { signal: controller.signal })).rejects.toBeInstanceOf(AbortedError);
        expect(spy).not.toHaveBeenCalled();
    });

    it('propagates a caller abort as AbortedError, not as a timeout', async () => {
        mockFetch((req) => neverResolving(req.init.signal));
        const client = new FetchHttpClient('http://box.example/');
        const controller = new AbortController();
        const pending = client.get('x', { signal: controller.signal });
        const assertion = expect(pending).rejects.toBeInstanceOf(AbortedError);
        controller.abort();
        await assertion;
    });

    it('turns a connection timeout on a GET into TimeoutError', async () => {
        mockFetch((req) => neverResolving(req.init.signal));
        const client = new FetchHttpClient('http://box.example/', { timeoutMs: 500 });
        const pending = client.get('x');
        const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);
        await vi.advanceTimersByTimeAsync(600);
        await assertion;
    });

    it('turns a timeout on a mutating POST into OutcomeUnknownError', async () => {
        mockFetch((req) => neverResolving(req.init.signal));
        const client = new FetchHttpClient('http://box.example/', { timeoutMs: 500 });
        const pending = client.post('torrents/add', { a: 1 });
        const assertion = expect(pending).rejects.toBeInstanceOf(OutcomeUnknownError);
        await vi.advanceTimersByTimeAsync(600);
        await assertion;
    });

    it('times out a response body that stalls after the headers arrived', async () => {
        mockFetch((req) => {
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('{"partial":'));
                    req.init.signal?.addEventListener('abort', () => controller.error(Object.assign(new Error('aborted'), { name: 'AbortError' })));
                },
            });
            return new Response(stream, { status: 200 });
        });
        const client = new FetchHttpClient('http://box.example/', { timeoutMs: 10000, bodyTimeoutMs: 300 });
        const pending = client.get('x');
        const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError', message: expect.stringContaining('body') });
        await vi.advanceTimersByTimeAsync(400);
        await assertion;
    });
});

describe('FetchHttpClient — retry classification', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('retries idempotent GETs on transient status codes', async () => {
        let n = 0;
        const { spy } = mockFetch(() => (n++ === 0 ? new Response('', { status: 503 }) : ok('{"ok":true}')));
        const client = new FetchHttpClient('http://box.example/');
        const result = await client.get('x', { retry: { baseDelay: 1, maxDelay: 2 } });
        expect(result).toEqual({ ok: true });
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('never retries a mutating POST, even when retry is requested', async () => {
        const { spy } = mockFetch(() => new Response('', { status: 503 }));
        const client = new FetchHttpClient('http://box.example/');
        await expect(client.post('torrents/add', { a: 1 }, { retry: true })).rejects.toBeInstanceOf(HttpError);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('retries a POST the caller marked idempotent (read-only RPC)', async () => {
        let n = 0;
        const { spy } = mockFetch(() => (n++ === 0 ? new Response('', { status: 503 }) : ok('{"result":"success"}')));
        const client = new FetchHttpClient('http://box.example/');
        await client.post('rpc', { method: 'session-get' }, { retry: { baseDelay: 1, maxDelay: 2 }, idempotent: true });
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
