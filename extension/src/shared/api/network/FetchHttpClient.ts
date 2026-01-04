import { HttpError } from './HttpError';
import { withRetry, RetryOptions } from '@/shared/lib/retry/withRetry';

export interface RequestConfig extends RequestInit {
    params?: Record<string, string>;
    /** Enable retry with exponential backoff for transient failures */
    retry?: boolean | RetryOptions;
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
            const response = await fetch(url.toString(), {
                credentials: 'include',
                ...fetchConfig,
            });

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
