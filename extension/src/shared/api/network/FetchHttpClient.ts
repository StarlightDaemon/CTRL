import { HttpError } from './HttpError';
import { withRetry, RetryOptions } from '@/shared/lib/retry/withRetry';

/**
 * Browser-correct HTTP transport shared by the torrent-client adapters.
 *
 * Design rules (see docs/release/v1/V1_SCOPE.md, Phase 3):
 *
 * - Bodies are sent as the caller intends. Native `BodyInit` values (string,
 *   Blob, ArrayBuffer, typed arrays, FormData, URLSearchParams) pass through
 *   untouched with the caller's Content-Type. Only plain objects are JSON
 *   encoded. XML is never quoted into a JSON string.
 * - Credentials mode is declared per client via `TransportProfile`, because
 *   cookie-session clients need the browser's cookie jar and header-auth
 *   clients must not leak cookies. The default is `omit`.
 * - Forbidden request headers (`Origin`, `Referer`, `Cookie`, `Host`, …) are
 *   browser-controlled. Fetch silently drops them, so this client refuses to
 *   pretend otherwise: they are stripped and adapters must not rely on them.
 * - A caller's AbortSignal is honoured and combined with the transport
 *   timeout. The timeout covers reading the response body, not only the
 *   headers.
 * - Retries are applied only to requests the caller marks idempotent. A
 *   timeout on a mutating request is surfaced as `OutcomeUnknownError`, not
 *   retried: the server may already have acted.
 */

export interface TransportProfile {
    /** Fetch credentials mode. `include` for cookie-session clients only. */
    credentials?: RequestCredentials;
    /** Time allowed for the connection and response headers. */
    timeoutMs?: number;
    /** Time allowed for reading the response body after headers arrived. */
    bodyTimeoutMs?: number;
    redirect?: RequestRedirect;
    /** Headers applied to every request unless overridden per call. */
    defaultHeaders?: Record<string, string>;
}

export interface RequestConfig extends Omit<RequestInit, 'body' | 'headers' | 'signal'> {
    headers?: HeadersInit;
    body?: BodyInit | null;
    signal?: AbortSignal | null;
    params?: Record<string, string>;
    /** Enable retry with exponential backoff for transient failures. Only honoured when the request is idempotent. */
    retry?: boolean | RetryOptions;
    /** Declares a non-GET request safe to repeat (e.g. a read-only RPC POST). */
    idempotent?: boolean;
    timeoutMs?: number;
    bodyTimeoutMs?: number;
}

export interface RawResponse<T> {
    status: number;
    headers: Headers;
    body: T;
    text: string;
}

/** Request headers the browser owns; setting them from JavaScript has no effect. */
export const FORBIDDEN_REQUEST_HEADERS = new Set([
    'accept-charset', 'accept-encoding', 'access-control-request-headers', 'access-control-request-method',
    'connection', 'content-length', 'cookie', 'cookie2', 'date', 'dnt', 'expect', 'host', 'keep-alive',
    'origin', 'referer', 'set-cookie', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via',
]);

export class TimeoutError extends Error {
    constructor(public readonly timeoutMs: number, phase: 'connection' | 'response body' = 'connection') {
        super(phase === 'connection' ? `Connection timed out after ${timeoutMs}ms` : `Response body timed out after ${timeoutMs}ms`);
        this.name = 'TimeoutError';
    }
}

/**
 * A mutating request timed out after it was sent. The server may or may not
 * have applied it; callers must not blindly retry.
 */
export class OutcomeUnknownError extends TimeoutError {
    constructor(timeoutMs: number, phase: 'connection' | 'response body' = 'connection') {
        super(timeoutMs, phase);
        this.name = 'OutcomeUnknownError';
        this.message = `${this.message}. The request may already have been applied by the server; check before retrying.`;
    }
}

export class AbortedError extends Error {
    constructor() {
        super('Request was cancelled');
        this.name = 'AbortedError';
    }
}

const DEFAULT_TIMEOUT_MS = 10000;

function isNativeBody(body: unknown): body is BodyInit {
    return (
        typeof body === 'string' ||
        body instanceof Blob ||
        body instanceof ArrayBuffer ||
        ArrayBuffer.isView(body) ||
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
    );
}

function isIdempotentMethod(method: string | undefined): boolean {
    const m = (method ?? 'GET').toUpperCase();
    return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
}

export class FetchHttpClient {
    private readonly profile: Required<Pick<TransportProfile, 'credentials' | 'timeoutMs' | 'bodyTimeoutMs' | 'redirect'>> & TransportProfile;

    constructor(private baseUrl: string, profile: TransportProfile = {}) {
        const timeoutMs = profile.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.profile = {
            ...profile,
            credentials: profile.credentials ?? 'omit',
            timeoutMs,
            bodyTimeoutMs: profile.bodyTimeoutMs ?? timeoutMs,
            redirect: profile.redirect ?? 'follow',
        };
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    /**
     * Sends a request and returns the parsed body (JSON when parseable, else
     * text, `{}` when empty). Throws HttpError for non-2xx responses.
     */
    async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        const raw = await this.requestRaw<T>(endpoint, config);
        return raw.body;
    }

    /**
     * Sends a request and returns status, headers and body. Response headers
     * are readable only as the browser exposes them: `Set-Cookie` is never
     * visible to JavaScript.
     */
    async requestRaw<T>(endpoint: string, config: RequestConfig = {}): Promise<RawResponse<T>> {
        const { retry, idempotent, params, timeoutMs, bodyTimeoutMs, signal: callerSignal, headers: headerInit, body, ...init } = config;
        const url = new URL(endpoint, this.baseUrl);
        if (params) {
            for (const [key, value] of Object.entries(params)) url.searchParams.append(key, value);
        }

        const method = (init.method ?? 'GET').toUpperCase();
        const mutating = !isIdempotentMethod(method) && !idempotent;
        const connectTimeout = timeoutMs ?? this.profile.timeoutMs;
        const bodyTimeout = bodyTimeoutMs ?? this.profile.bodyTimeoutMs;

        const headers = this.buildHeaders(headerInit);

        const doFetch = async (): Promise<RawResponse<T>> => {
            if (callerSignal?.aborted) throw new AbortedError();

            const controller = new AbortController();
            let timedOut: 'connection' | 'response body' | null = null;
            const onCallerAbort = () => controller.abort();
            callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

            let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
                timedOut = 'connection';
                controller.abort();
            }, connectTimeout);

            try {
                const response = await fetch(url.toString(), {
                    ...init,
                    method,
                    credentials: this.profile.credentials,
                    redirect: this.profile.redirect,
                    headers,
                    body: body ?? undefined,
                    signal: controller.signal,
                });

                // Headers arrived: switch to the body timer.
                clearTimeout(timer);
                timer = setTimeout(() => {
                    timedOut = 'response body';
                    controller.abort();
                }, bodyTimeout);

                const text = await response.text();
                clearTimeout(timer);
                timer = null;

                if (!response.ok) {
                    throw new HttpError(response.status, response.statusText, response, text);
                }

                return { status: response.status, headers: response.headers, body: parseBody<T>(text), text };
            } catch (error) {
                if (timer) clearTimeout(timer);
                if (error instanceof Error && error.name === 'AbortError') {
                    if (callerSignal?.aborted && !timedOut) throw new AbortedError();
                    const phase = timedOut ?? 'connection';
                    const ms = phase === 'connection' ? connectTimeout : bodyTimeout;
                    throw mutating ? new OutcomeUnknownError(ms, phase) : new TimeoutError(ms, phase);
                }
                throw error;
            } finally {
                callerSignal?.removeEventListener('abort', onCallerAbort);
            }
        };

        if (retry && !mutating) {
            const retryOptions = typeof retry === 'boolean' ? {} : retry;
            return withRetry(doFetch, retryOptions);
        }
        return doFetch();
    }

    async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'GET' });
    }

    /**
     * Like get(), but also returns the response headers alongside the parsed body.
     */
    async getRaw<T>(endpoint: string, config: RequestConfig = {}): Promise<{ body: T; headers: Headers; status: number }> {
        const raw = await this.requestRaw<T>(endpoint, { ...config, method: 'GET' });
        return { body: raw.body, headers: raw.headers, status: raw.status };
    }

    /**
     * POST. Native BodyInit values are sent verbatim; plain objects are JSON
     * encoded with `Content-Type: application/json` unless the caller set one.
     */
    async post<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | unknown[] | null, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, this.withBody(body, { ...config, method: 'POST' }));
    }

    async postRaw<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | unknown[] | null, config: RequestConfig = {}): Promise<RawResponse<T>> {
        return this.requestRaw<T>(endpoint, this.withBody(body, { ...config, method: 'POST' }));
    }

    async put<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | unknown[] | null, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, this.withBody(body, { ...config, method: 'PUT' }));
    }

    async patch<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | unknown[] | null, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, this.withBody(body, { ...config, method: 'PATCH' }));
    }

    async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'DELETE' });
    }

    private withBody(body: BodyInit | Record<string, unknown> | unknown[] | null | undefined, config: RequestConfig): RequestConfig {
        if (body === undefined || body === null) {
            return { ...config, body: null };
        }
        const headers = new Headers(config.headers);
        if (isNativeBody(body)) {
            return { ...config, headers, body };
        }
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        return { ...config, headers, body: JSON.stringify(body) };
    }

    private buildHeaders(init?: HeadersInit): Headers {
        const headers = new Headers(this.profile.defaultHeaders ?? {});
        if (init) {
            new Headers(init).forEach((value, key) => headers.set(key, value));
        }
        for (const name of Array.from(headers.keys())) {
            if (FORBIDDEN_REQUEST_HEADERS.has(name.toLowerCase())) {
                headers.delete(name);
            }
        }
        return headers;
    }
}

function parseBody<T>(text: string): T {
    if (!text) return {} as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return text as unknown as T;
    }
}
