import { useState, useMemo } from 'react';
import { CATEGORIES } from '../lib/categories';
import { ABBSettings } from '@/shared/lib/types';
import { Search, Eye, EyeOff, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';
// import { Input } from './ui/Input';
// import { Button } from './ui/Button';
// Using standard HTML elements for now to avoid dependency hell or import from TC components

interface Props {
    settings: ABBSettings;
    updateSettings: (settings: ABBSettings) => void;
}

export function CategoryList({ settings, updateSettings }: Props) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'hidden' | 'visible'>('all');

    // Debug IDs
    const searchInputDebug = useDebugId('abb', 'categories', 'search-input');
    const filterAllDebug = useDebugId('abb', 'categories', 'filter-all');
    const filterVisibleDebug = useDebugId('abb', 'categories', 'filter-visible');
    const filterHiddenDebug = useDebugId('abb', 'categories', 'filter-hidden');
    const showAllActionDebug = useDebugId('abb', 'categories', 'action-show-all');
    const hideAllActionDebug = useDebugId('abb', 'categories', 'action-hide-all');

    const filteredCategories = useMemo(() => {
        return CATEGORIES.filter(cat => {
            const matchesSearch = cat.toLowerCase().includes(search.toLowerCase());
            const isHidden = settings.hiddenCategories.includes(cat);

            if (!matchesSearch) return false;
            if (filter === 'hidden') return isHidden;
            if (filter === 'visible') return !isHidden;
            return true;
        });
    }, [search, filter, settings.hiddenCategories]);

    const handleHideAll = async () => {
        if (confirm('Are you sure you want to hide ALL categories?')) {
            updateSettings({ ...settings, hiddenCategories: [...CATEGORIES] });
        }
    };

    const handleShowAll = async () => {
        if (confirm('Are you sure you want to show ALL categories?')) {
            updateSettings({ ...settings, hiddenCategories: [] });
        }
    };

    const onToggle = (category: string) => {
        const newHidden = settings.hiddenCategories.includes(category)
            ? settings.hiddenCategories.filter(c => c !== category)
            : [...settings.hiddenCategories, category];
        updateSettings({ ...settings, hiddenCategories: newHidden });
    };

    function cn(...inputs: (string | undefined | null | false)[]) {
        return twMerge(clsx(inputs));
    }

    return (
        <div className="flex flex-col h-full bg-panel max-w-4xl mx-auto rounded-xl border border-border shadow-sm">
            <div className="p-4 border-b border-border space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                    <input
                        placeholder="Search categories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-full rounded-lg border border-input bg-input text-text-primary px-3 py-2 text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-all"
                        {...searchInputDebug}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filter === 'all' ? 'bg-accent text-white shadow-sm' : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-hover'}`}
                            onClick={() => setFilter('all')}
                            {...filterAllDebug}
                        >
                            All
                        </button>
                        <button
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filter === 'visible' ? 'bg-accent text-white shadow-sm' : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-hover'}`}
                            onClick={() => setFilter('visible')}
                            {...filterVisibleDebug}
                        >
                            Visible
                        </button>
                        <button
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${filter === 'hidden' ? 'bg-accent text-white shadow-sm' : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-hover'}`}
                            onClick={() => setFilter('hidden')}
                            {...filterHiddenDebug}
                        >
                            Hidden
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button className="p-1.5 hover:bg-hover rounded-md transition-colors text-text-secondary hover:text-text-primary" onClick={handleShowAll} title="Show All" {...showAllActionDebug}>
                            <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-hover rounded-md transition-colors text-text-secondary hover:text-text-primary" onClick={handleHideAll} title="Hide All" {...hideAllActionDebug}>
                            <EyeOff className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCategories.map(category => {
                        const isHidden = settings.hiddenCategories.includes(category);
                        return (
                            <div
                                key={category}
                                onClick={() => onToggle(category)}
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border",
                                    isHidden
                                        ? "bg-surface/50 border-border opacity-60 hover:opacity-100"
                                        : "bg-surface border-border hover:border-accent hover:shadow-sm"
                                )}
                                data-debug-id={`abb:categories:toggle-${category}`}
                                data-component="CategoryToggle"
                            >
                                <span className={cn("text-sm font-medium pr-2 transition-colors", isHidden ? "text-text-secondary" : "text-text-primary")}>{category}</span>
                                {isHidden ? (
                                    <EyeOff className="w-4 h-4 text-text-secondary flex-shrink-0" />
                                ) : (
                                    <Eye className="w-4 h-4 text-accent flex-shrink-0" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {filteredCategories.length === 0 && (
                    <div className="text-center py-12 text-text-secondary">
                        <Filter className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p>No categories found</p>
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-border bg-surface/30 text-xs text-text-secondary text-center rounded-b-xl">
                Showing {filteredCategories.length} of {CATEGORIES.length} categories
            </div>
        </div >
    );
}
