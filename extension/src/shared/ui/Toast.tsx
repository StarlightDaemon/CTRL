import React, { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    const icons = {
        success: <CheckCircle className="w-5 h-5 text-support-success" aria-hidden="true" />,
        error: <XCircle className="w-5 h-5 text-support-error" aria-hidden="true" />,
        info: <Info className="w-5 h-5 text-support-info" aria-hidden="true" />,
    };

    const bgColors = {
        success: 'bg-layer-01 border-support-success',
        error: 'bg-layer-01 border-support-error',
        info: 'bg-layer-01 border-support-info',
    };

    return (
        <div
            role="alert"
            aria-live="assertive"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${bgColors[toast.type]} animate-slide-in`}
        >
            {icons[toast.type]}
            <span className="text-sm text-text-primary flex-1">{toast.message}</span>
            <button
                onClick={() => onDismiss(toast.id)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Dismiss notification"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container - Fixed bottom right */}
            <div
                className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
                aria-label="Notifications"
            >
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// Animation keyframes (add to CSS or tailwind config)
// @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
// .animate-slide-in { animation: slide-in 0.3s ease-out; }
