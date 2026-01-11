import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, Command, X } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CommandAction {
    id: string;
    label: string;
    icon?: React.ReactNode;
    shortcut?: string[]; // e.g. ['Ctrl', 'S']
    perform: () => void;
}

interface CommandPaletteProps {
    actions?: CommandAction[];
    isOpen?: boolean; // Controlled mode
    onClose?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    actions = [],
    isOpen: controlledIsOpen,
    onClose
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const isVisible = controlledIsOpen ?? isOpen;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                setQuery('');
                setSelectedIndex(0);
            }
            if (e.key === 'Escape' && isVisible) {
                setIsOpen(false);
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, onClose]);

    const filteredActions = actions.filter(action =>
        action.label.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (action: CommandAction) => {
        action.perform();
        setIsOpen(false);
        onClose?.();
    };

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={() => { setIsOpen(false); onClose?.(); }}
            />

            <div className="relative w-full max-w-lg bg-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center border-b border-white/10 px-3 py-3">
                    <Search className="w-5 h-5 text-text-muted mr-2" />
                    <input
                        className="flex-1 bg-transparent border-none outline-none text-text-primary placeholder:text-text-muted text-lg"
                        placeholder="Type a command..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="flex items-center space-x-1">
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-surface text-text-muted rounded border border-white/10">
                            ESC
                        </kbd>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto py-2">
                    {filteredActions.length === 0 ? (
                        <div className="px-4 py-8 text-center text-text-muted">
                            No results found.
                        </div>
                    ) : (
                        <div className="space-y-1 px-2">
                            {filteredActions.map((action, index) => (
                                <button
                                    key={action.id}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-text-primary hover:bg-hover hover:text-white",
                                        "focus:bg-hover focus:outline-none"
                                        // selectedIndex === index && "bg-hover"
                                    )}
                                    onClick={() => handleSelect(action)}
                                >
                                    <div className="flex items-center gap-3">
                                        {action.icon || <Command className="w-4 h-4 text-text-muted" />}
                                        <span>{action.label}</span>
                                    </div>
                                    {action.shortcut && (
                                        <div className="flex items-center gap-1">
                                            {action.shortcut.map(key => (
                                                <kbd key={key} className="px-1.5 py-0.5 text-xs font-medium bg-surface/50 text-text-muted rounded">
                                                    {key}
                                                </kbd>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-white/10 px-3 py-2 bg-surface/30 text-xs text-text-muted flex justify-between">
                    <span>Project Prism</span>
                    <span>v0.1.23</span>
                </div>
            </div>
        </div>,
        document.body
    );
};
