export interface ServerConfig {
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
