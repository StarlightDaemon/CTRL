import React from 'react';
import { Cloud, Check, X } from 'lucide-react';

interface MagnetButtonProps {
    magnet: string;
    onSuccess?: () => void;
    onError?: (e: any) => void;
}

export const MagnetButton = ({ magnet, onSuccess, onError }: MagnetButtonProps) => {
    const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (status === 'loading') return;

        setStatus('loading');
        try {
            await chrome.runtime.sendMessage({
                type: 'ADD_TORRENT_URL',
                url: magnet
            });
            setStatus('success');
            setTimeout(() => setStatus('idle'), 2000);
            onSuccess?.();
        } catch (e) {
            console.error(e);
            setStatus('error');
            onError?.(e);
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const getIcon = () => {
        switch (status) {
            case 'success': return <Check size={14} />;
            case 'error': return <X size={14} />;
            case 'loading': return <Cloud size={14} className="animate-pulse" />;
            default: return <Cloud size={14} />;
        }
    };

    const getBgColor = () => {
        switch (status) {
            case 'success': return 'bg-green-600 hover:bg-green-700';
            case 'error': return 'bg-red-600 hover:bg-red-700';
            default: return 'bg-accent hover:bg-accent-hover';
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`ctrl-debrid-btn ${getBgColor()} text-white rounded p-1 ml-1 transition-all flex items-center justify-center h-6 w-6 shadow-sm`}
            title="Add to CTRL"
        >
            {getIcon()}
        </button>
    );
};
