import { TransmissionCapabilities, TransmissionClientType, TransmissionSession } from './TransmissionTypes';

/**
 * Detects client type from version string
 */
export function detectClientType(version: string | undefined): TransmissionClientType {
    if (!version) return 'transmission';

    const versionLower = version.toLowerCase();

    // Vuze reports plugin version (e.g., "0.5.11") or contains "Vuze"
    if (versionLower.includes('vuze') || /^0\.\d+/.test(version)) {
        return 'vuze';
    }

    // BiglyBT typically identifies itself
    if (versionLower.includes('biglybt')) {
        return 'biglybt';
    }

    return 'transmission';
}

/**
 * Builds capability flags from session data
 */
export function buildCapabilities(session: TransmissionSession): TransmissionCapabilities {
    const rpcVersion = session['rpc-version'] || 14; // Default to v14 (safest baseline)
    const softwareVersion = session.version || 'unknown';
    const clientType = detectClientType(softwareVersion);

    return {
        rpcVersion,
        clientType,
        softwareVersion,

        // Feature flags based on RPC version
        supportsLabels: rpcVersion >= 16,
        supportsTrackerList: rpcVersion >= 17,
        usesSnakeCase: rpcVersion >= 17,
        supportsFreeSpace: rpcVersion >= 15 && clientType !== 'vuze', // Vuze may not support
        supportsQueueMoves: rpcVersion >= 14, // Available since v14

        // Client-specific quirks
        hasVuzePathBug: clientType === 'vuze',
    };
}

/**
 * Gets human-readable client description
 */
export function getClientDescription(capabilities: TransmissionCapabilities): string {
    const { clientType, softwareVersion, rpcVersion } = capabilities;

    switch (clientType) {
        case 'vuze':
            return `Vuze (${softwareVersion}) - RPC v${rpcVersion} emulation`;
        case 'biglybt':
            return `BiglyBT (${softwareVersion}) - RPC v${rpcVersion}`;
        case 'transmission':
        default:
            return `Transmission (${softwareVersion}) - RPC v${rpcVersion}`;
    }
}
