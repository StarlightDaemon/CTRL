/**
 * Checks if a hostname or IP is a Private Network Address (RFC1918).
 * Used for Chrome LNA (Local Network Access) compliance.
 */
export const isPrivateIP = (hostname: string): boolean => {
    // Remove protocol and port
    const host = hostname.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];

    // Check for localhost
    if (host === 'localhost') return true; // Localhost is exempt but considered local

    // Check for 127.0.0.1 (exempt)
    if (host === '127.0.0.1') return true;

    // IPv4 Checks
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
        // 10.0.0.0 - 10.255.255.255
        if (parts[0] === 10) return true;

        // 172.16.0.0 - 172.31.255.255
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

        // 192.168.0.0 - 192.168.255.255
        if (parts[0] === 192 && parts[1] === 168) return true;
    }

    return false;
};
