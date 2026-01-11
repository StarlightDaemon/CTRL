import React from 'react';
import { useSettings } from '@/features/torrent-control/model/useSettings';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SidebarItem } from '@/shared/lib/types';
import { ArrowUp, ArrowDown, Eye, EyeOff, Layout } from 'lucide-react';

export const LayoutSettings = () => {
    const { settings, updateSettings } = useSettings();

    if (!settings?.layout?.sidebar) return null;

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newSidebar = [...settings.layout.sidebar];
        if (direction === 'up' && index > 0) {
            [newSidebar[index], newSidebar[index - 1]] = [newSidebar[index - 1], newSidebar[index]];
        } else if (direction === 'down' && index < newSidebar.length - 1) {
            [newSidebar[index], newSidebar[index + 1]] = [newSidebar[index + 1], newSidebar[index]];
        }

        // Update order property
        newSidebar.forEach((item, idx) => item.order = idx);

        updateSettings({ ...settings, layout: { ...settings.layout, sidebar: newSidebar } });
    };

    const toggleVisibility = (index: number) => {
        const newSidebar = [...settings.layout.sidebar];
        newSidebar[index].visible = !newSidebar[index].visible;
        updateSettings({ ...settings, layout: { ...settings.layout, sidebar: newSidebar } });
    };

    const getLabel = (id: string) => {
        switch (id) {
            case 'torrents': return 'Torrent Control';
            case 'audiobooks': return 'AudioBook Bay';
            case 'sites': return 'Site Integrations';
            case 'utilities': return 'Utilities';
            default: return id;
        }
    };

    return (
        <SettingsCard title="Sidebar Navigation" icon={<Layout size={20} className="text-accent" />}>
            <div className="space-y-2">
                <p className="text-sm text-text-secondary mb-4">
                    Customize your experience by toggling or reordering sidebar items.
                </p>
                {settings.layout.sidebar.map((item, index) => (
                    <div
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border border-border transition-colors ${item.visible ? 'bg-surface' : 'bg-background opacity-60'}`}
                    >
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => toggleVisibility(index)}
                                className={`p-1.5 rounded-md transition-colors ${item.visible ? 'text-accent hover:bg-accent/10' : 'text-text-secondary hover:bg-text-secondary/10'}`}
                                title={item.visible ? "Hide" : "Show"}
                                data-debug-id={`settings:layout:sidebar-item-${item.id}-visibility`}
                                data-component="Button"
                            >
                                {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                            <span className={`text-sm font-medium ${item.visible ? 'text-text-primary' : 'text-text-secondary'}`}>
                                {getLabel(item.id)}
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => moveItem(index, 'up')}
                                disabled={index === 0}
                                className="p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:hover:text-text-secondary"
                                data-debug-id={`settings:layout:sidebar-item-${item.id}-move-up`}
                                data-component="Button"
                            >
                                <ArrowUp size={16} />
                            </button>
                            <button
                                onClick={() => moveItem(index, 'down')}
                                disabled={index === settings.layout.sidebar.length - 1}
                                className="p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:hover:text-text-secondary"
                                data-debug-id={`settings:layout:sidebar-item-${item.id}-move-down`}
                                data-component="Button"
                            >
                                <ArrowDown size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </SettingsCard>
    );
};
