import { HttpError } from './HttpError';
import { withRetry, RetryOptions } from '@/shared/lib/retry/withRetry';

export interface RequestConfig extends RequestInit {
    params?: Record<string, string>;
    /** Enable retry with exponential backoff for transient failures */
    retry?: boolean | RetryOptions;
    timeoutMs?: number;
}

export class FetchHttpClient {
    constructor(private baseUrl: string) { }

    async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        const { retry, ...fetchConfig } = config;
        const url = new URL(endpoint, this.baseUrl);

        if (fetchConfig.params) {
            Object.entries(fetchConfig.params).forEach(([key, value]) => {
                url.searchParams.append(key, value);
            });
        }

        const doFetch = async (): Promise<T> => {
            const headers = new Headers(fetchConfig.headers);
            const controller = new AbortController();
            const timeoutMs = config.timeoutMs ?? 10000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs); // default 10s timeout

            try {
                const origin = new URL(this.baseUrl).origin;
                if (!headers.has('Origin')) headers.set('Origin', origin);
                if (!headers.has('Referer')) headers.set('Referer', origin + '/');
            } catch (e) {
                console.warn('[FetchHttpClient] Failed to derive Origin/Referer from baseUrl:', this.baseUrl);
            }

            try {
                const response = await fetch(url.toString(), {
                    credentials: 'omit',
                    ...fetchConfig,
                    headers,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new HttpError(response.status, response.statusText, response);
                }

                // Handle empty responses (e.g. "Ok.")
                const text = await response.text();
                if (!text) return {} as T;

                try {
                    return JSON.parse(text);
                } catch {
                    return text as unknown as T;
                }
            } catch (error) {
                clearTimeout(timeoutId);
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new Error(`Connection timed out after ${timeoutMs}ms`);
                }
                throw error;
            }
        };

        // Apply retry logic if enabled
        if (retry) {
            const retryOptions = typeof retry === 'boolean' ? {} : retry;
            return withRetry(doFetch, retryOptions);
        }

        return doFetch();
    }

    async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'GET' });
    }

    async post<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | null, config: RequestConfig = {}): Promise<T> {
        const isFormData = body instanceof FormData;
        const isSearchParams = body instanceof URLSearchParams;
        const headers = new Headers(config.headers);

        if (!isFormData && !isSearchParams && body) {
            headers.set('Content-Type', 'application/json');
        }

        return this.request<T>(endpoint, {
            ...config,
            method: 'POST',
            headers,
            body: (isFormData || isSearchParams) ? body : JSON.stringify(body),
        });
    }

    async put<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | null, config: RequestConfig = {}): Promise<T> {
        const isFormData = body instanceof FormData;
        const headers = new Headers(config.headers);

        if (!isFormData && body) {
            headers.set('Content-Type', 'application/json');
        }

        return this.request<T>(endpoint, {
            ...config,
            method: 'PUT',
            headers,
            body: isFormData ? body : JSON.stringify(body),
        });
    }

    async patch<T>(endpoint: string, body?: BodyInit | Record<string, unknown> | null, config: RequestConfig = {}): Promise<T> {
        const isFormData = body instanceof FormData;
        const headers = new Headers(config.headers);

        if (!isFormData && body) {
            headers.set('Content-Type', 'application/json');
        }

        return this.request<T>(endpoint, {
            ...config,
            method: 'PATCH',
            headers,
            body: isFormData ? body : JSON.stringify(body),
        });
    }

    async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        return this.request<T>(endpoint, { ...config, method: 'DELETE' });
    }
}
