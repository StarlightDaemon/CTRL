import React from 'react';
import { Filter, X, ShieldCheck, Video, Cpu, Trash2, Settings2 } from 'lucide-react';

export interface FilterState {
    resolution: string[];
    codec: string[];
    hideDead: boolean;
}

interface FilterPanelProps {
    filters: FilterState;
    onChange: (filters: FilterState) => void;
    title?: string;
}

export const FilterPanel = ({ filters, onChange, title = 'Quality Filters' }: FilterPanelProps) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const toggleFilter = (type: 'resolution' | 'codec', value: string) => {
        const list = filters[type];
        const newList = list.includes(value)
            ? list.filter(i => i !== value)
            : [...list, value];
        onChange({ ...filters, [type]: newList });
    };

    const toggleDead = () => {
        onChange({ ...filters, hideDead: !filters.hideDead });
    };

    const clearAll = () => {
        onChange({ resolution: [], codec: [], hideDead: false });
    };

    const activeCount = filters.resolution.length + filters.codec.length + (filters.hideDead ? 1 : 0);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 text-blue-400 p-3 rounded-full shadow-lg z-[9999] hover:bg-slate-800 hover:text-blue-300 transition-all group flex items-center gap-2"
                title="Open Filters"
            >
                <Filter size={20} />
                {activeCount > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {activeCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[9999] font-sans text-slate-200">
            {/* Header */}
            <div className="bg-slate-950 px-4 py-3 flex justify-between items-center border-b border-slate-800">
                <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
                    <ShieldCheck size={16} />
                    <span>{title}</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="p-4 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">

                {/* Resolution Group */}
                <div>
                    <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 gap-1">
                        <Video size={12} /> Resolution
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {['4K', '1080p', '720p', 'SD'].map(res => (
                            <button
                                key={res}
                                onClick={() => toggleFilter('resolution', res)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${filters.resolution.includes(res)
                                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                {res}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Codec Group */}
                <div>
                    <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 gap-1">
                        <Cpu size={12} /> Codec
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {['x265', 'x264', 'AV1', 'XviD'].map(codec => (
                            <button
                                key={codec}
                                onClick={() => toggleFilter('codec', codec)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${filters.codec.includes(codec)
                                        ? 'bg-purple-600/20 border-purple-500/50 text-purple-200'
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                            >
                                {codec}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Other Filters */}
                <div>
                    <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 gap-1">
                        <Settings2 size={12} /> Advanced
                    </div>
                    <button
                        onClick={toggleDead}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md border transition-all ${filters.hideDead
                                ? 'bg-red-900/20 border-red-500/50 text-red-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                            }`}
                    >
                        <span>Hide Dead Torrents (0 seeders)</span>
                        {filters.hideDead && <Trash2 size={12} />}
                    </button>
                </div>

                {/* Footer Actions */}
                {activeCount > 0 && (
                    <div className="pt-2 border-t border-slate-800">
                        <button
                            onClick={clearAll}
                            className="w-full text-xs text-slate-500 hover:text-white py-1 transition-colors"
                        >
                            Reset filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
