import { FetchHttpClient, RequestConfig } from './FetchHttpClient';

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

export class JsonRpcClient {
    private httpClient: FetchHttpClient;
    private idCounter = 0;

    constructor(endpoint: string, private authHeader?: { key: string; value: string }) {
        this.httpClient = new FetchHttpClient(endpoint);
    }

    async call<T>(method: string, params: unknown[] = []): Promise<T> {
        const id = this.generateId();
        const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method,
            params,
            id,
        };

        const config: RequestConfig = {};
        if (this.authHeader) {
            config.headers = { [this.authHeader.key]: this.authHeader.value };
        }

        // JSON-RPC is always a POST to the root (or specific endpoint handled by httpClient base URL)
        const response = await this.httpClient.post<JsonRpcResponse<T>>('', request, config);

        if (response.error) {
            throw new Error(`JSON-RPC Error ${response.error.code}: ${response.error.message}`);
        }

        if (response.result === undefined) {
            // Some methods might return null/undefined on success, but usually result is present.
            // If strict, we might check for 'result' key presence.
            return null as unknown as T;
        }

        return response.result;
    }

    private generateId(): string {
        return `tc-${Date.now()}-${this.idCounter++}`;
    }
}
