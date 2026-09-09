import React from 'react';
import { AppOptions, ContextMenuMode, ServerConfig } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';
import { RadioButton, RadioButtonGroup, Stack, Button, Toggle } from '@carbon/react';

interface Props {
    settings: AppOptions;
    previewContextMenu: ContextMenuMode;
    setPreviewContextMenu: (value: ContextMenuMode) => void;
    applyContextMenu: () => void;
    previewServers: ServerConfig[];
    setPreviewServers: (servers: ServerConfig[]) => void;
}

export const ContextMenuSettings: React.FC<Props> = ({
    settings,
    previewContextMenu,
    setPreviewContextMenu,
    applyContextMenu,
    previewServers,
    setPreviewServers
}) => {
    // Debug IDs
    const applyBtnDebug = useDebugId('settings', 'context-menu', 'apply-button');

    const handleServerToggle = (index: number, checked: boolean) => {
        const newServers = [...previewServers];
        newServers[index] = { ...newServers[index], showInContextMenu: checked };
        setPreviewServers(newServers);
    };

    const isDirty =
        previewContextMenu !== settings.globals.contextMenu ||
        JSON.stringify(previewServers) !== JSON.stringify(settings.servers);

    return (
        <SettingsCard
            title="Context Menu"
            description="Choose which right-click options CTRL adds to links."
            headerActions={
                isDirty && (
                    <Button
                        onClick={applyContextMenu}
                        size="sm"
                        {...applyBtnDebug}
                    >
                        Apply
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Stack gap={6}>
                    <RadioButtonGroup
                        legendText="Menu Mode"
                        name="context-menu-mode"
                        valueSelected={previewContextMenu}
                        onChange={(val) => setPreviewContextMenu(Number(val) as ContextMenuMode)}
                        orientation="vertical"
                    >
                        <RadioButton
                            value={1}
                            labelText="Full (add, add paused, labels, folders, per-server)"
                            id="mode-1"
                        />
                        <RadioButton
                            value={2}
                            labelText="Simple (add to the default server only)"
                            id="mode-2"
                        />
                        <RadioButton
                            value={0}
                            labelText="Hidden (no context menu)"
                            id="mode-0"
                        />
                    </RadioButtonGroup>

                    {/* Per-Server Context Menu Visibility */}
                    <div className="mt-4 pt-4 border-t border-[var(--cds-border-subtle)]">
                        <h4 className="text-sm font-medium text-[var(--cds-text-primary)] mb-2">Server Visibility</h4>
                        <p className="text-xs text-[var(--cds-text-secondary)] mb-3">Servers switched on appear at the top level of the menu; the others are grouped under "Add to server...".</p>

                        <Stack gap={2}>
                            {previewServers.map((server, index) => (
                                <div key={server.id ?? index} className="flex items-center justify-between p-2 rounded bg-[var(--cds-layer-01)]">
                                    <div className="text-sm font-medium text-[var(--cds-text-primary)]">{server.name}</div>
                                    <Toggle
                                        id={`server-visibility-${server.id ?? index}`}
                                        labelText={`Show ${server.name} at the top level`}
                                        hideLabel
                                        labelA=""
                                        labelB=""
                                        size="sm"
                                        toggled={server.showInContextMenu ?? false}
                                        onToggle={() => handleServerToggle(index, !(server.showInContextMenu ?? false))}
                                        data-debug-id={`settings:context-menu:server-${index}-visibility`}
                                    />
                                </div>
                            ))}
                            {previewServers.length === 0 && (
                                <p className="text-xs text-[var(--cds-text-helper)] italic">No servers configured.</p>
                            )}
                        </Stack>
                    </div>
                </Stack>

                {/* Context Menu Preview — mirrors ContextMenuService.determineMenuItems */}
                <div className="border border-[var(--cds-border-subtle)] rounded-lg bg-[var(--cds-layer-01)] p-4 relative h-56 flex items-center justify-center">
                    <div className="bg-layer-01 text-text-primary shadow-lg rounded border border-subtle w-56 text-sm py-1 absolute top-8 left-8 z-10">
                        <div className="px-4 py-1 text-text-secondary cursor-default">Open Link in New Tab</div>
                        <div className="px-4 py-1 text-text-secondary cursor-default">Save Link As...</div>
                        <div className="border-t border-subtle my-1"></div>
                        {previewContextMenu !== 0 && (
                            <>
                                <div className="px-4 py-1 cursor-default flex items-center font-bold">
                                    <img src="/icon/default-16.png" className="w-4 h-4 mr-2" alt="" />
                                    Add to CTRL
                                </div>
                                {previewContextMenu === 1 && (
                                    <div className="px-4 py-1 cursor-default">Add to CTRL (paused)</div>
                                )}
                                {previewServers.length > 1 && previewServers.filter(s => s.showInContextMenu).map((server) => (
                                    <div key={server.id ?? server.name} className="px-4 py-1 cursor-default">
                                        Add to {server.name}
                                    </div>
                                ))}
                                {previewServers.length > 1 && !previewServers.every(s => s.showInContextMenu) && (
                                    <div className="px-4 py-1 cursor-default flex justify-between items-center">
                                        <span>Add to server...</span>
                                        <span className="text-xs">▶</span>
                                    </div>
                                )}
                                {previewContextMenu === 1 && (settings.globals.labels?.length ?? 0) > 0 && (
                                    <div className="px-4 py-1 cursor-default flex justify-between items-center">
                                        <span>Add with label...</span>
                                        <span className="text-xs">▶</span>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="px-4 py-1 text-text-secondary cursor-default">Inspect</div>
                    </div>
                    <p className="text-xs text-[var(--cds-text-helper)] absolute bottom-4 w-full text-center">Preview</p>
                </div>
            </div>
        </SettingsCard>
    );
};
