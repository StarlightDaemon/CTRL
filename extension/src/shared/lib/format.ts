const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human-readable byte count, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${UNITS[i]}`;
}

/** Human-readable transfer rate, e.g. 2048 -> "2 KB/s". */
export function formatSpeed(bytesPerSecond: number): string {
    return `${formatBytes(bytesPerSecond)}/s`;
}
