import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VPNService } from '@/shared/lib/vpn/VPNService';

describe('VPNService', () => {
    let service: VPNService;

    beforeEach(() => {
        service = new VPNService();
        vi.clearAllMocks();
    });

    describe('isIPInCIDR', () => {
        it('should correctly match IP in /24 range', () => {
            expect(service.isIPInCIDR('192.168.1.100', '192.168.1.0/24')).toBe(true);
            expect(service.isIPInCIDR('192.168.1.1', '192.168.1.0/24')).toBe(true);
            expect(service.isIPInCIDR('192.168.1.255', '192.168.1.0/24')).toBe(true);
        });

        it('should correctly reject IP outside /24 range', () => {
            expect(service.isIPInCIDR('192.168.2.1', '192.168.1.0/24')).toBe(false);
            expect(service.isIPInCIDR('10.0.0.1', '192.168.1.0/24')).toBe(false);
        });

        it('should correctly match IP in /16 range', () => {
            expect(service.isIPInCIDR('10.100.50.25', '10.100.0.0/16')).toBe(true);
            expect(service.isIPInCIDR('10.100.255.255', '10.100.0.0/16')).toBe(true);
        });

        it('should correctly reject IP outside /16 range', () => {
            expect(service.isIPInCIDR('10.101.0.1', '10.100.0.0/16')).toBe(false);
        });

        it('should correctly match IP in /8 range', () => {
            expect(service.isIPInCIDR('10.255.255.255', '10.0.0.0/8')).toBe(true);
            expect(service.isIPInCIDR('10.0.0.1', '10.0.0.0/8')).toBe(true);
        });

        it('should handle invalid inputs gracefully', () => {
            expect(service.isIPInCIDR('invalid', '192.168.1.0/24')).toBe(false);
            expect(service.isIPInCIDR('192.168.1.1', 'invalid')).toBe(false);
        });
    });

    describe('isKnownVPNIP', () => {
        it('should identify known VPN IPs', () => {
            // Mullvad range: 45.92.0.0/24
            expect(service.isKnownVPNIP('45.92.0.50')).toBe(true);
            // ProtonVPN range: 185.159.157.0/24
            expect(service.isKnownVPNIP('185.159.157.100')).toBe(true);
        });

        it('should not flag random IPs as VPN', () => {
            expect(service.isKnownVPNIP('8.8.8.8')).toBe(false);
            expect(service.isKnownVPNIP('1.1.1.1')).toBe(false);
        });
    });

    describe('identifyVPNProvider', () => {
        it('should identify Mullvad VPN', () => {
            // 45.92.0.0/24 is Mullvad
            expect(service.identifyVPNProvider('45.92.0.50')).toBe('Mullvad VPN');
        });

        it('should identify ProtonVPN', () => {
            // 185.159.157.0/24 is ProtonVPN
            expect(service.identifyVPNProvider('185.159.157.100')).toBe('ProtonVPN');
        });

        it('should return undefined for unknown IPs', () => {
            expect(service.identifyVPNProvider('8.8.8.8')).toBeUndefined();
        });
    });

    describe('isDatacenterASN', () => {
        it('should identify datacenter ASNs', () => {
            expect(service.isDatacenterASN('AS14061')).toBe(true); // DigitalOcean
            expect(service.isDatacenterASN('AS16509')).toBe(true); // AWS
            expect(service.isDatacenterASN('AS15169')).toBe(true); // Google
        });

        it('should not flag residential ASNs', () => {
            expect(service.isDatacenterASN('AS7922')).toBe(false); // Comcast
            expect(service.isDatacenterASN('AS12345')).toBe(false); // Random
        });

        it('should handle undefined/null', () => {
            expect(service.isDatacenterASN(undefined)).toBe(false);
            expect(service.isDatacenterASN('')).toBe(false);
        });
    });

    describe('quickIPCheck', () => {
        it('should return IP on successful fetch', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ ip: '1.2.3.4' })
            });

            const ip = await service.quickIPCheck();
            expect(ip).toBe('1.2.3.4');
        });

        it('should return null on fetch failure', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const ip = await service.quickIPCheck();
            expect(ip).toBeNull();
        });
    });

    describe('getCachedStatus', () => {
        it('should return null when no cached status', () => {
            expect(service.getCachedStatus()).toBeNull();
        });
    });
});
