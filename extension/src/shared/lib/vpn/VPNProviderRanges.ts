/**
 * Comprehensive VPN Provider CIDR Ranges
 * 
 * Source: Global VPN Infrastructure and CIDR Architecture Research Report (2025)
 * Based on: az0/vpn_ip repository, official provider documentation, ASN analysis
 * 
 * Last Updated: December 2025
 */

export interface VPNProviderRanges {
    provider: string;
    asn?: string;
    ranges: string[];
}

export const VPN_PROVIDER_RANGES: VPNProviderRanges[] = [
    {
        provider: 'Mullvad VPN',
        asn: 'AS216025',
        ranges: [
            '45.92.0.0/24',
            '45.85.106.0/24',
            '45.92.231.0/24',
            '45.132.193.0/24',
            '46.229.255.0/24',
            '92.60.40.0/24',
            '155.2.209.0/24',
            '155.2.219.0/24',
            '170.62.100.0/24',
            '185.184.220.0/24',
            '185.217.116.0/24',
            '185.248.85.0/24',
            '194.34.172.0/24',
            '194.36.25.0/24',
            '185.213.193.128/25',
            '142.147.89.192/26',
        ],
    },
    {
        provider: 'ProtonVPN',
        asn: 'AS209103',
        ranges: [
            '62.169.136.0/24',
            '62.169.137.0/24',
            '79.135.104.0/24',
            '185.159.157.0/24',
            '185.159.159.0/24',
            '194.126.177.0/24',
            '146.70.174.0/24',
            '84.252.114.1/32',
        ],
    },
    {
        provider: 'NordVPN',
        asn: 'AS141039', // PacketHub S.A.
        ranges: [
            '103.86.96.0/22',
            '116.204.192.0/22',
            '103.173.150.0/23',
            '158.220.76.0/23',
            '185.135.138.0/23',
            '185.221.134.0/23',
            '2.56.252.0/24',
            '2.58.36.0/24',
            '2.58.37.0/24',
            '2.58.38.0/24',
            '2.58.72.0/24',
            '2.58.73.0/24',
            '2.58.74.0/24',
            '2.59.157.0/24',
            '5.104.76.0/24',
            '5.104.78.0/24',
            '5.180.209.0/24',
            '5.182.16.0/24',
            '5.182.32.0/24',
            '5.183.32.0/24',
            '5.183.34.0/24',
            '5.183.35.0/24',
            '5.252.140.0/24',
            '5.252.141.0/24',
            '5.252.142.0/24',
            '5.252.143.0/24',
            '5.253.115.0/24',
            '5.253.232.0/24',
            '5.253.233.0/24',
            '5.253.234.0/24',
            '5.253.235.0/24',
            '45.81.7.0/24',
            '217.138.206.36/32',
        ],
    },
    {
        provider: 'ExpressVPN',
        ranges: [
            '185.198.191.192/27',
            '185.198.188.112/28',
            '194.127.173.144/28',
            '91.239.130.184/29',
            '92.119.19.80/29',
            '45.144.112.10/31',
            '91.246.58.132/31',
            '92.119.16.92/31',
            '45.86.208.98/32',
            '45.86.208.99/32',
            '45.86.208.100/32',
            '45.86.208.101/32',
            '80.91.222.34/32',
            '80.91.222.36/32',
            '80.91.222.40/32',
            '80.91.222.44/32',
            '80.91.222.54/32',
        ],
    },
    {
        provider: 'Windscribe',
        asn: 'AS397540',
        ranges: [
            '23.154.160.0/24',
            '149.57.28.0/24',
            '181.215.52.0/24',
            '209.127.204.0/24',
            '131.143.220.0/23',
            '167.88.50.0/26',
            '104.254.93.64/27',
            '204.187.100.192/27',
            '104.245.146.48/28',
            '149.56.178.48/28',
            '199.189.26.128/28',
            '104.254.92.8/29',
            '104.254.92.72/29',
            '104.254.92.96/29',
            '172.86.186.176/29',
            '184.75.212.88/29',
            '149.56.35.196/30',
            '217.138.206.211/32',
        ],
    },
    {
        provider: 'Private Internet Access (PIA)',
        ranges: [
            '154.6.93.0/24',
            '156.146.33.0/24',
            '156.146.34.0/24',
            '156.146.38.0/24',
            '156.146.51.0/24',
            '156.146.54.0/24',
            '185.107.56.0/24',
            '185.107.57.0/24',
            '185.107.58.0/24',
            '195.181.232.0/24',
            '95.181.232.29/32',
        ],
    },
    {
        provider: 'Surfshark',
        ranges: [
            '129.227.219.0/24',
            '2.59.202.0/24',
            '2.59.203.0/24',
            '5.182.103.0/24',
            '64.44.42.160/28',
            '107.174.20.128/28',
            '172.93.146.208/28',
            '185.225.28.64/28',
            '5.133.9.200/29',
            '37.28.156.240/29',
            '64.44.32.56/29',
            '96.9.246.32/29',
            '96.9.246.240/29',
            '172.93.146.112/29',
            '172.93.148.160/29',
            '172.93.148.184/29',
            '146.70.42.182/32',
        ],
    },
    {
        provider: 'CyberGhost',
        ranges: [
            '95.181.232.139/32',
            '2.58.36.0/24',
            '2.58.37.0/24',
            '2.58.38.0/24',
            '5.182.16.0/24',
            '5.182.32.0/24',
            '185.107.56.0/24',
            '185.107.57.0/24',
            '185.107.58.0/24',
        ],
    },
];

// Datacenter/Hosting ASNs (traffic from these is likely VPN/proxy)
export const DATACENTER_ASNS = new Set([
    'AS14061',   // DigitalOcean
    'AS16509',   // Amazon AWS
    'AS15169',   // Google Cloud
    'AS8075',    // Microsoft Azure
    'AS9009',    // M247 Ltd (common VPN host)
    'AS62041',   // Datacamp Limited
    'AS60068',   // CDN77/Datacamp
    'AS202425',  // IP Volume Inc (VPN host)
    'AS39351',   // 31173 Services AB (Mullvad partner)
    'AS141039',  // PacketHub S.A. (NordVPN)
    'AS207137',  // Tefincom (NordVPN)
    'AS216025',  // Mullvad VPN AB
    'AS209103',  // Proton AG
    'AS397540',  // Windscribe
    'AS46664',   // VolumeDrive (Windscribe partner)
]);

/**
 * Get total count of CIDR ranges
 */
export function getTotalRangeCount(): number {
    return VPN_PROVIDER_RANGES.reduce((acc, p) => acc + p.ranges.length, 0);
}

/**
 * Get flat list of all CIDR ranges
 */
export function getAllCIDRRanges(): string[] {
    return VPN_PROVIDER_RANGES.flatMap(p => p.ranges);
}

/**
 * Find provider by IP (requires CIDR check function)
 */
export function findProviderByIP(
    ip: string,
    isIPInCIDR: (ip: string, cidr: string) => boolean
): string | undefined {
    for (const provider of VPN_PROVIDER_RANGES) {
        for (const cidr of provider.ranges) {
            if (isIPInCIDR(ip, cidr)) {
                return provider.provider;
            }
        }
    }
    return undefined;
}

/**
 * Check if IP is in any known VPN range
 */
export function isKnownVPNRange(
    ip: string,
    isIPInCIDR: (ip: string, cidr: string) => boolean
): boolean {
    return findProviderByIP(ip, isIPInCIDR) !== undefined;
}
