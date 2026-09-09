import { HttpError } from './HttpError';
import { FetchHttpClient, RequestConfig, TransportProfile } from './FetchHttpClient';

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: unknown[];
    id: string | number;
    [key: string]: unknown;  // Index signature for Record<string, unknown> compatibility
}

export interface JsonRpcResponse<T> {
    jsonrpc: '2.0';
    result?: T;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
    id: string | number;
}

/**
 * Structured JSON-RPC error that carries the original `{ code, message }` fields
 * as own enumerable properties. This allows Aria2Adapter.wrapError() to detect
 * the structured-RPC branch (`'code' in error`) rather than falling through to
 * the plain-Error branch which would misclassify auth failures as NETWORK_ERROR.
 */
export class JsonRpcError extends Error {
    public readonly code: number;

    constructor(rpcCode: number, rpcMessage: string) {
        super(rpcMessage);
        this.name = 'JsonRpcError';
        this.code = rpcCode;
    }
}

function parseJsonRpcError(bodyText: string): { code: number; message: string } | null {
    if (!bodyText) return null;
    try {
        const parsed = JSON.parse(bodyText) as { error?: { code?: unknown; message?: unknown } };
        if (parsed && parsed.error && typeof parsed.error.code === 'number') {
            return { code: parsed.error.code, message: String(parsed.error.message ?? '') };
        }
    } catch {
        // not JSON
    }
    return null;
}

export interface JsonRpcCallOptions {
    /** Read-only methods may be retried safely; mutations are never retried. */
    idempotent?: boolean;
    signal?: AbortSignal;
    timeoutMs?: number;
}

export class JsonRpcClient {
    private httpClient: FetchHttpClient;
    private idCounter = 0;

    constructor(endpoint: string, private authHeader?: { key: string; value: string }, profile: TransportProfile = {}) {
        this.httpClient = new FetchHttpClient(endpoint, profile);
    }

    async call<T>(method: string, params: unknown[] = [], options: JsonRpcCallOptions = {}): Promise<T> {
        const id = this.generateId();
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id,
        };

        const config: RequestConfig = {
            idempotent: options.idempotent,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        };
        if (this.authHeader) {
            config.headers = { [this.authHeader.key]: this.authHeader.value };
        }

        // JSON-RPC is always a POST to the endpoint the client was created with.
        let response: JsonRpcResponse<T>;
        try {
            response = await this.httpClient.post<JsonRpcResponse<T>>('', request, config);
        } catch (error) {
            // Some servers answer a JSON-RPC error with a non-2xx status (aria2 sends
            // HTTP 400 with {"error":{"code":1,"message":"Unauthorized"}} for a wrong
            // secret, live-verified on 1.37.0). Surface the structured error rather
            // than a generic HTTP failure so callers classify it correctly.
            const structured = error instanceof HttpError ? parseJsonRpcError(error.bodyText) : null;
            if (structured) throw new JsonRpcError(structured.code, structured.message);
            throw error;
        }

        if (response.error) {
            // Throw a structured error so callers can inspect .code and .message
            // independently of the formatted message string.
            throw new JsonRpcError(response.error.code, response.error.message);
        }

        if (response.result === undefined) {
            // Some methods might return null/undefined on success, but usually result is present.
            return null as unknown as T;
        }

        return response.result;
    }

    private generateId(): string {
        return `tc-${Date.now()}-${this.idCounter++}`;
    }
}
