export interface ServerConfig {
    /**
     * Stable identity of this server entry. Never changes once assigned.
     * Entries saved by older versions may lack it until the next save; use
     * `ensureServerIds()` from `entities/server/lib/serverIdentity` to
     * normalise a list before relying on it.
     */
    id?: string;
    name: string;
    application: string;
    type: string;
    hostname: string;
    username?: string;
    password?: string;
    directories: string[];
    defaultDirectory?: string;
    defaultLabel?: string;
    clientOptions: Record<string, unknown>;
    httpAuth?: {
        username: string;
        password?: string;
    };
    showInContextMenu?: boolean;
}
