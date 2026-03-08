import React, { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { vpnService, VPNStatus } from '@/shared/lib/vpn/VPNService';

interface VPNIndicatorProps {
    /** Show detailed info on hover/click */
    showDetails?: boolean;
    /** Compact mode for toolbar */
    compact?: boolean;
    /** Auto-check interval in ms (0 = disabled) */
    autoCheckInterval?: number;
}

/**
 * VPN Status Indicator Component
 * 
 * Displays the current VPN protection status with:
 * - Green shield = Protected (VPN detected)
 * - Red shield = Exposed (no VPN + potential leak)
 * - Yellow shield = Unknown/checking
 */
export const VPNIndicator: React.FC<VPNIndicatorProps> = ({
    showDetails = true,
    compact = false,
    autoCheckInterval = 0, // Disabled by default for privacy alignment
}) => {
    const [status, setStatus] = useState<VPNStatus | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const checkVPN = useCallback(async () => {
        setIsChecking(true);
        try {
            const result = await vpnService.checkStatus();
            setStatus(result);
        } catch (error) {
            setStatus({
                isProtected: false,
                identity: null,
                leakCheck: null,
                lastChecked: Date.now(),
                error: 'Check failed'
            });
        } finally {
            setIsChecking(false);
        }
    }, []);

    // Initial check disabled for privacy compliance
    useEffect(() => {
        // Try cached only - never auto-trigger network request on mount
        const cached = vpnService.getCachedStatus();
        if (cached) {
            setStatus(cached);
        }
    }, [checkVPN]);

    // Auto-refresh (only if manually enabled)
    useEffect(() => {
        if (autoCheckInterval <= 0) return;

        const interval = setInterval(checkVPN, autoCheckInterval);
        return () => clearInterval(interval);
    }, [autoCheckInterval, checkVPN]);

    const getStatusIcon = () => {
        if (isChecking) {
            return <RefreshCw className="w-5 h-5 text-status-warning animate-spin" aria-hidden="true" />;
        }

        if (!status) {
            return <Shield className="w-5 h-5 text-text-disabled" aria-hidden="true" />;
        }

        if (status.error) {
            return <ShieldAlert className="w-5 h-5 text-status-warning" aria-hidden="true" />;
        }

        if (status.isProtected) {
            return <ShieldCheck className="w-5 h-5 text-status-success" aria-hidden="true" />;
        }

        return <ShieldAlert className="w-5 h-5 text-status-error" aria-hidden="true" />;
    };

    const getStatusText = () => {
        if (isChecking) return 'Checking...';
        if (!status) return 'Unknown';
        if (status.error) {
            if (status.error.includes('privacy')) return 'Disabled';
            return 'Check failed';
        }
        if (status.isProtected) return 'VPN Active';
        return 'Exposed';
    };

    const getStatusColor = () => {
        if (isChecking || !status) return 'text-status-warning';
        if (status.error) return 'text-status-warning';
        if (status.isProtected) return 'text-status-success';
        return 'text-status-error';
    };

    if (compact) {
        return (
            <button
                onClick={checkVPN}
                className="p-2 rounded-lg hover:bg-layer-selected-hover transition-colors"
                aria-label={`VPN Status: ${getStatusText()}`}
                title={getStatusText()}
            >
                {getStatusIcon()}
            </button>
        );
    }

    return (
        <div
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <button
                onClick={checkVPN}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                disabled={isChecking}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg
                    bg-layer-01 hover:bg-layer-selected-hover transition-colors
                    focus:outline focus:outline-2 focus:outline-[var(--cds-focus)] focus:outline-offset-2
                    border border-border-subtle
                    ${getStatusColor()}
                `}
                aria-label={`VPN Status: ${getStatusText()}. Click to refresh.`}
            >
                {getStatusIcon()}
                <span className="text-sm font-medium">{getStatusText()}</span>
            </button>

            {/* Tooltip with details */}
            {showDetails && showTooltip && status && !isChecking && (
                <div
                    className="absolute top-full left-0 mt-2 w-64 p-3 bg-layer-01 border border-border-subtle rounded-lg shadow-lg z-50"
                    role="tooltip"
                >
                    <div className="space-y-2 text-sm">
                        {/* IP Address */}
                        <div className="flex justify-between">
                            <span className="text-text-secondary">IP:</span>
                            <span className="font-mono">{status.identity?.ip || 'Unknown'}</span>
                        </div>

                        {/* Country */}
                        {status.identity?.country && (
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Location:</span>
                                <span>{status.identity.city ? `${status.identity.city}, ` : ''}{status.identity.country}</span>
                            </div>
                        )}

                        {/* Provider */}
                        {status.identity?.provider && (
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Provider:</span>
                                <span className="text-status-success">{status.identity.provider}</span>
                            </div>
                        )}

                        {/* Datacenter detection */}
                        {status.identity?.isDatacenter && (
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Type:</span>
                                <span className="text-status-success">Datacenter/VPN</span>
                            </div>
                        )}

                        {/* Leak status */}
                        {status.leakCheck && (
                            <div className="flex justify-between items-center">
                                <span className="text-text-secondary">WebRTC Leak:</span>
                                {status.leakCheck.hasLeak ? (
                                    <span className="flex items-center gap-1 text-status-error">
                                        <WifiOff className="w-3 h-3" /> Detected
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-status-success">
                                        <Wifi className="w-3 h-3" /> None
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Last checked */}
                        <div className="pt-2 border-t border-border-subtle text-xs text-text-secondary">
                            Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VPNIndicator;
