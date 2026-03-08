import React from 'react';
import { useSettings } from '@/features/torrent-control/model/useSettings';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SidebarItem } from '@/shared/lib/types';
import { ArrowUp, ArrowDown, Eye, EyeOff, Layout } from 'lucide-react';
import { Stack, IconButton } from '@carbon/react';

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
        <SettingsCard title="Sidebar Navigation" icon={<Layout size={20} className="text-[var(--cds-link-primary)]" />}>
            <Stack gap={4}>
                <p className="text-sm text-[var(--cds-text-secondary)]">
                    Customize your experience by toggling or reordering sidebar items.
                </p>
                <Stack gap={2}>
                    {settings.layout.sidebar.map((item, index) => (
                        <div
                            key={item.id}
                            className={`flex items-center justify-between p-3 rounded border border-[var(--cds-border-subtle)] transition-colors ${item.visible ? 'bg-[var(--cds-layer-01)]' : 'bg-[var(--cds-background)] opacity-60'}`}
                        >
                            <div className="flex items-center gap-3">
                                <IconButton
                                    label={item.visible ? "Hide" : "Show"}
                                    kind="ghost"
                                    size="sm"
                                    onClick={() => toggleVisibility(index)}
                                    className={item.visible ? 'text-[var(--cds-link-primary)]' : 'text-[var(--cds-text-secondary)]'}
                                    data-debug-id={`settings:layout:sidebar-item-${item.id}-visibility`}
                                >
                                    {item.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                </IconButton>
                                <span className={`text-sm font-medium ${item.visible ? 'text-[var(--cds-text-primary)]' : 'text-[var(--cds-text-secondary)]'}`}>
                                    {getLabel(item.id)}
                                </span>
                            </div>

                            <div className="flex items-center gap-1">
                                <IconButton
                                    label="Move up"
                                    kind="ghost"
                                    size="sm"
                                    onClick={() => moveItem(index, 'up')}
                                    disabled={index === 0}
                                    data-debug-id={`settings:layout:sidebar-item-${item.id}-move-up`}
                                >
                                    <ArrowUp size={16} />
                                </IconButton>
                                <IconButton
                                    label="Move down"
                                    kind="ghost"
                                    size="sm"
                                    onClick={() => moveItem(index, 'down')}
                                    disabled={index === settings.layout.sidebar.length - 1}
                                    data-debug-id={`settings:layout:sidebar-item-${item.id}-move-down`}
                                >
                                    <ArrowDown size={16} />
                                </IconButton>
                            </div>
                        </div>
                    ))}
                </Stack>
            </Stack>
        </SettingsCard>
    );
};
