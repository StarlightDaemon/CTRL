import type { ServerConfig } from '@/shared/lib/types';
import { DEFAULT_CLIENT_ID, getClientCapability } from '@/shared/lib/constants';
import { isPrivateHost, parseEndpoint } from '@/shared/lib/endpoint';
import { newServerId } from '@/entities/server/lib/serverIdentity';

/**
 * Form model for the server configuration workflow.
 *
 * The form holds the address as one complete URL string, exactly as the user
 * typed it (or exactly as it was stored). Nothing is split into host/port
 * fields, so IPv6 literals, non-default ports and reverse-proxy sub-paths
 * survive the edit cycle. On save the address goes through `parseEndpoint`
 * once, so what is stored is always an absolute http(s) URL ending in "/",
 * and a stored value re-parses to itself (save → reload → edit → save is a
 * fixed point).
 */
export interface ServerFormValues {
    name: string;
    clientId: string;
    address: string;
    username: string;
    password: string;
}

export type ServerFormField = keyof ServerFormValues;
export type ServerFormErrors = Partial<Record<ServerFormField, string>>;

export const MAX_SERVER_NAME_LENGTH = 64;

export function emptyServerForm(clientId: string = DEFAULT_CLIENT_ID): ServerFormValues {
    return { name: '', clientId, address: '', username: '', password: '' };
}

export function serverToForm(server: ServerConfig): ServerFormValues {
    return {
        name: server.name ?? '',
        clientId: server.type || server.application || DEFAULT_CLIENT_ID,
        address: server.hostname ?? '',
        username: server.username ?? '',
        password: server.password ?? '',
    };
}

/** Example address shown in the empty address field for a client type. */
export function addressPlaceholder(clientId: string): string {
    return getClientCapability(clientId)?.addressPlaceholder ?? 'http://127.0.0.1:8080/';
}

export interface AddressAnalysis {
    ok: boolean;
    /** Canonical form that will be stored, or null when invalid. */
    normalized: string | null;
    /** Origin used for the host-permission grant, or null when invalid. */
    origin: string | null;
    hostname: string | null;
    error: string | null;
    /** Plain http:// to a host outside loopback/LAN: traffic is observable and modifiable in transit. */
    plainHttpRemote: boolean;
}

export function analyzeAddress(address: string): AddressAnalysis {
    const parsed = parseEndpoint(address);
    if (!parsed.ok) {
        return { ok: false, normalized: null, origin: null, hostname: null, error: parsed.error, plainHttpRemote: false };
    }
    const isHttp = parsed.url.protocol === 'http:';
    return {
        ok: true,
        normalized: parsed.normalized,
        origin: parsed.url.origin,
        hostname: parsed.url.hostname,
        error: null,
        plainHttpRemote: isHttp && !isPrivateHost(parsed.url.hostname),
    };
}

export function validateServerForm(values: ServerFormValues): ServerFormErrors {
    const errors: ServerFormErrors = {};
    const name = values.name.trim();
    if (!name) {
        errors.name = 'Enter a name for this server.';
    } else if (name.length > MAX_SERVER_NAME_LENGTH) {
        errors.name = `Keep the name to ${MAX_SERVER_NAME_LENGTH} characters or fewer.`;
    }
    if (!getClientCapability(values.clientId)) {
        errors.clientId = 'Choose a BitTorrent client.';
    }
    const address = analyzeAddress(values.address);
    if (!address.ok) {
        errors.address = address.error ?? 'Enter the server address.';
    }
    return errors;
}

export function isServerFormValid(values: ServerFormValues): boolean {
    return Object.keys(validateServerForm(values)).length === 0;
}

/**
 * Builds the configuration to persist. Fields the form does not edit
 * (identity, directories, defaults, HTTP auth, context-menu visibility) are
 * carried over from the existing entry. Client-specific options are kept only
 * while the client type is unchanged.
 *
 * @throws Error with the first validation message when the values are invalid.
 */
export function formToServer(values: ServerFormValues, existing?: ServerConfig | null): ServerConfig {
    const errors = validateServerForm(values);
    const firstError = Object.values(errors)[0];
    if (firstError) throw new Error(firstError);

    const address = parseEndpoint(values.address);
    if (!address.ok) throw new Error(address.error);

    const sameClient = !!existing && existing.type === values.clientId;
    return {
        ...(existing ?? {}),
        id: existing?.id ?? newServerId(),
        name: values.name.trim(),
        application: values.clientId,
        type: values.clientId,
        hostname: address.normalized,
        username: values.username,
        password: values.password,
        directories: existing?.directories ?? [],
        clientOptions: sameClient ? (existing?.clientOptions ?? {}) : {},
    };
}
