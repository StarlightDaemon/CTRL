/**
 * VPN Detection and IP Monitoring Service
 * 
 * Provides multiple layers of VPN/proxy detection:
 * - Public IP retrieval via external APIs
 * - WebRTC leak detection
 * - CIDR range matching for known VPN providers
 * - ASN-based datacenter detection
 */

import {
    VPN_PROVIDER_RANGES,
    DATACENTER_ASNS,
    findProviderByIP,
    isKnownVPNRange,
} from './VPNProviderRanges';

export interface NetworkIdentity {
    ip: string;
    asn?: string;
    org?: string;
    country?: string;
    city?: string;
    isVpn?: boolean;
    isDatacenter?: boolean;
    provider?: string;
}

export interface LeakCheckResult {
    hasLeak: boolean;
    leakedIPs: string[];
    vpnIP: string | null;
}

export interface VPNStatus {
    isProtected: boolean;
    identity: NetworkIdentity | null;
    leakCheck: LeakCheckResult | null;
    lastChecked: number;
    error?: string;
}

/**
 * VPN Detection Service
 */
export class VPNService {
    private static readonly IP_APIS = [
        'https://api.ipify.org?format=json',
        'https://ipapi.co/json/',
        'https://ipinfo.io/json',
    ];

    private lastStatus: VPNStatus | null = null;

    /**
     * Perform a comprehensive VPN status check
     */
    async checkStatus(): Promise<VPNStatus> {
        const startTime = Date.now();

        try {
            // 1. Get public IP identity
            const identity = await this.getNetworkIdentity();
            if (!identity) {
                return {
                    isProtected: false,
                    identity: null,
                    leakCheck: null,
                    lastChecked: startTime,
                    error: 'Failed to retrieve network identity'
                };
            }

            // 2. Check for WebRTC leaks
            const leakCheck = await this.detectWebRTCLeaks(identity.ip);

            // 3. Determine VPN status
            const isProtected = this.analyzeProtectionStatus(identity, leakCheck);

            const status: VPNStatus = {
                isProtected,
                identity,
                leakCheck,
                lastChecked: startTime
            };

            this.lastStatus = status;
            return status;

        } catch (error) {
            return {
                isProtected: false,
                identity: null,
                leakCheck: null,
                lastChecked: startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get the current public IP and associated metadata
     */
    async getNetworkIdentity(): Promise<NetworkIdentity | null> {
        // Try multiple APIs with fallback
        for (const apiUrl of VPNService.IP_APIS) {
            try {
                const response = await fetch(apiUrl, {
                    signal: AbortSignal.timeout(5000)
                });

                if (!response.ok) continue;

                const data = await response.json();

                // Normalize response across different API formats
                const identity: NetworkIdentity = {
                    ip: data.ip || data.query,
                    asn: data.asn || data.org?.match(/AS\d+/)?.[0],
                    org: data.org || data.company?.name,
                    country: data.country || data.country_name,
                    city: data.city,
                };

                // Enrich with VPN detection
                identity.isDatacenter = this.isDatacenterASN(identity.asn);
                identity.isVpn = identity.isDatacenter || this.isKnownVPNIP(identity.ip);
                identity.provider = this.identifyVPNProvider(identity.ip);

                return identity;

            } catch (error) {
                console.warn(`[VPNService] API ${apiUrl} failed:`, error);
                continue;
            }
        }

        return null;
    }

    /**
     * Detect WebRTC IP leaks that bypass VPN tunnel
     */
    async detectWebRTCLeaks(expectedVpnIP: string): Promise<LeakCheckResult> {
        return new Promise((resolve) => {
            const discoveredIPs: string[] = [];

            // Check if RTCPeerConnection is available
            if (typeof RTCPeerConnection === 'undefined') {
                resolve({ hasLeak: false, leakedIPs: [], vpnIP: expectedVpnIP });
                return;
            }

            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });

                pc.createDataChannel('leak-detector');

                pc.onicecandidate = (event) => {
                    if (!event?.candidate) {
                        pc.close();

                        // Filter to unique public IPs (exclude private ranges)
                        const publicIPs = [...new Set(discoveredIPs)]
                            .filter(ip => !this.isPrivateIP(ip));

                        // A leak exists if we found IPs different from expected VPN
                        const leakedIPs = publicIPs.filter(ip => ip !== expectedVpnIP);

                        resolve({
                            hasLeak: leakedIPs.length > 0,
                            leakedIPs,
                            vpnIP: expectedVpnIP
                        });
                        return;
                    }

                    // Extract IP from candidate string
                    const match = event.candidate.candidate.match(
                        /([0-9]{1,3}(\.[0-9]{1,3}){3})/
                    );
                    if (match) {
                        discoveredIPs.push(match[1]);
                    }
                };

                pc.createOffer()
                    .then(offer => pc.setLocalDescription(offer))
                    .catch(() => {
                        pc.close();
                        resolve({ hasLeak: false, leakedIPs: [], vpnIP: expectedVpnIP });
                    });

                // Timeout after 3 seconds
                setTimeout(() => {
                    pc.close();
                    resolve({
                        hasLeak: discoveredIPs.length > 1,
                        leakedIPs: discoveredIPs.filter(ip => ip !== expectedVpnIP),
                        vpnIP: expectedVpnIP
                    });
                }, 3000);

            } catch (error) {
                resolve({ hasLeak: false, leakedIPs: [], vpnIP: expectedVpnIP });
            }
        });
    }

    /**
     * Check if IP is in a known VPN provider's CIDR range
     */
    isKnownVPNIP(ip: string): boolean {
        for (const provider of VPN_PROVIDER_RANGES) {
            for (const cidr of provider.ranges) {
                if (this.isIPInCIDR(ip, cidr)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Identify the VPN provider by IP
     */
    identifyVPNProvider(ip: string): string | undefined {
        for (const provider of VPN_PROVIDER_RANGES) {
            for (const cidr of provider.ranges) {
                if (this.isIPInCIDR(ip, cidr)) {
                    return provider.provider;
                }
            }
        }
        return undefined;
    }

    /**
     * Check if ASN belongs to a known datacenter
     */
    isDatacenterASN(asn?: string): boolean {
        if (!asn) return false;
        return DATACENTER_ASNS.has(asn);
    }

    /**
     * Check if IP is in a CIDR range
     */
    isIPInCIDR(ip: string, cidr: string): boolean {
        try {
            const [rangeAddress, prefixStr] = cidr.split('/');
            const prefix = parseInt(prefixStr, 10);
            const mask = ~(Math.pow(2, 32 - prefix) - 1) >>> 0;

            const ipInt = this.ipToInt(ip);
            const rangeInt = this.ipToInt(rangeAddress);

            return (ipInt & mask) === (rangeInt & mask);
        } catch {
            return false;
        }
    }

    /**
     * Convert IP string to 32-bit integer
     */
    private ipToInt(ip: string): number {
        return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
    }

    /**
     * Check if IP is in private range (RFC 1918)
     */
    private isPrivateIP(ip: string): boolean {
        const privateRanges = [
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
            '127.0.0.0/8',
        ];
        return privateRanges.some(cidr => this.isIPInCIDR(ip, cidr));
    }

    /**
     * Analyze all data to determine protection status
     */
    private analyzeProtectionStatus(
        identity: NetworkIdentity,
        leakCheck: LeakCheckResult
    ): boolean {
        // If WebRTC leaks detected, not fully protected
        if (leakCheck.hasLeak) {
            return false;
        }

        // If on datacenter/hosting IP, likely protected
        if (identity.isDatacenter || identity.isVpn) {
            return true;
        }

        // Otherwise, assume exposed (residential IP)
        return false;
    }

    /**
     * Get cached status if available and recent (< 60s)
     */
    getCachedStatus(): VPNStatus | null {
        if (!this.lastStatus) return null;

        const age = Date.now() - this.lastStatus.lastChecked;
        if (age > 60000) return null; // Expired

        return this.lastStatus;
    }

    /**
     * Quick check - just get IP without full analysis
     */
    async quickIPCheck(): Promise<string | null> {
        try {
            const response = await fetch('https://api.ipify.org?format=json', {
                signal: AbortSignal.timeout(3000)
            });
            const data = await response.json();
            return data.ip;
        } catch {
            return null;
        }
    }
}

// Singleton instance
export const vpnService = new VPNService();
