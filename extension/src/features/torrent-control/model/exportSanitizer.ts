import type { ServerConfig } from '@/shared/lib/types';
import { CLIENT_LIST } from '@/shared/lib/constants';

/**
 * Safe-export sanitisation.
 *
 * A "safe" export must never contain a credential. Instead of listing the
 * fields to strip (a denylist cannot be correct over an open
 * `clientOptions` record), this builds the export from an explicit allowlist:
 * only the named non-secret fields are copied, `httpAuth` keeps its username
 * only, userinfo is removed from the address, and `clientOptions` keeps only
 * the option keys that the client definition in `CLIENT_LIST` declares as
 * user-visible settings. Anything else is dropped.
 */

/** Non-secret top-level fields that survive a safe export. */
export const SAFE_SERVER_FIELDS = [
    'id',
    'name',
    'application',
    'type',
    'hostname',
    'username',
    'directories',
    'defaultDirectory',
    'defaultLabel',
    'showInContextMenu',
] as const;

export type SafeServerConfig = Pick<ServerConfig, (typeof SAFE_SERVER_FIELDS)[number]> & {
    httpAuth?: { username: string };
    clientOptions: Record<string, unknown>;
};

function stripUserinfo(hostname: string): string {
    try {
        const url = new URL(hostname);
        url.username = '';
        url.password = '';
        return url.toString();
    } catch {
        // Not a parseable URL: keep the literal but remove anything before an '@'.
        return hostname.replace(/^([a-z]+:\/\/)?[^/@]*@/i, '$1');
    }
}

function allowedClientOptionKeys(type: string): Set<string> {
    const definition = CLIENT_LIST.find((c) => c.id === type);
    return new Set((definition?.clientOptions ?? []).map((o) => o.name));
}

export function sanitizeServerForExport(server: ServerConfig): SafeServerConfig {
    const safe: Partial<SafeServerConfig> = {};
    for (const field of SAFE_SERVER_FIELDS) {
        const value = server[field];
        if (value !== undefined) {
            (safe as Record<string, unknown>)[field] = Array.isArray(value) ? [...value] : value;
        }
    }
    if (typeof server.hostname === 'string') {
        safe.hostname = stripUserinfo(server.hostname);
    }
    if (server.httpAuth?.username) {
        safe.httpAuth = { username: server.httpAuth.username };
    }
    const allowed = allowedClientOptionKeys(server.type);
    const clientOptions: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(server.clientOptions ?? {})) {
        if (allowed.has(key) && (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number')) {
            clientOptions[key] = value;
        }
    }
    safe.clientOptions = clientOptions;
    return safe as SafeServerConfig;
}

export function sanitizeServersForExport(servers: ServerConfig[]): SafeServerConfig[] {
    return servers.map(sanitizeServerForExport);
}
