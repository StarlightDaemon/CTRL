import React from 'react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';
import { RadioButton, RadioButtonGroup, Stack, Button } from '@carbon/react';

interface Props {
    settings: AppOptions;
    previewContextMenu: number;
    setPreviewContextMenu: (value: number) => void;
    previewCustomOptions: any;
    setPreviewCustomOptions: (options: any) => void;
    applyContextMenu: () => void;
    previewServers: ServerConfig[];
    setPreviewServers: (servers: ServerConfig[]) => void;
}

export const ContextMenuSettings: React.FC<Props> = ({
    settings,
    previewContextMenu,
    setPreviewContextMenu,
    previewCustomOptions,
    setPreviewCustomOptions,
    applyContextMenu,
    previewServers,
    setPreviewServers
}) => {
    // Debug IDs
    const applyBtnDebug = useDebugId('settings', 'context-menu', 'apply-button');

    // Custom Options
    const customAddToClientDebug = useDebugId('settings', 'context-menu', 'custom-add-client');
    const customPauseResumeDebug = useDebugId('settings', 'context-menu', 'custom-pause-resume');
    const customOpenWebUIDebug = useDebugId('settings', 'context-menu', 'custom-open-webui');

    const handleServerToggle = (index: number, checked: boolean) => {
        const newServers = [...previewServers];
        newServers[index] = { ...newServers[index], showInContextMenu: checked };
        setPreviewServers(newServers);
    };

    return (
        <SettingsCard
            title="Context Menu"
            description="Customize the right-click menu options."
            headerActions={
                (previewContextMenu !== settings.globals.contextMenu ||
                    JSON.stringify(previewCustomOptions) !== JSON.stringify(settings.globals.contextMenuCustomOptions) ||
                    JSON.stringify(previewServers) !== JSON.stringify(settings.servers)) && (
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
                        onChange={(val) => setPreviewContextMenu(val as number)}
                        orientation="vertical"
                    >
                        <RadioButton
                            value={1}
                            labelText="Default (Full Menu)"
                            id="mode-1"
                        />
                        <RadioButton
                            value={2}
                            labelText="Simple (Add Only)"
                            id="mode-2"
                        />
                        <RadioButton
                            value={3}
                            labelText="Custom"
                            id="mode-3"
                        />
                        <RadioButton
                            value={0}
                            labelText="Hidden"
                            id="mode-0"
                        />
                    </RadioButtonGroup>

                    {previewContextMenu === 3 && (
                        <div className="ml-8 mt-2 space-y-2 border-l-2 border-[var(--cds-border-subtle)] pl-3">
                            <SettingsToggle
                                checked={previewCustomOptions.addToClient}
                                onChange={() => setPreviewCustomOptions({ ...previewCustomOptions, addToClient: !previewCustomOptions.addToClient })}
                                label="Add to Client"
                                {...customAddToClientDebug}
                            />
                            <SettingsToggle
                                checked={previewCustomOptions.pauseResume}
                                onChange={() => setPreviewCustomOptions({ ...previewCustomOptions, pauseResume: !previewCustomOptions.pauseResume })}
                                label="Pause / Resume"
                                {...customPauseResumeDebug}
                            />
                            <SettingsToggle
                                checked={previewCustomOptions.openWebUI}
                                onChange={() => setPreviewCustomOptions({ ...previewCustomOptions, openWebUI: !previewCustomOptions.openWebUI })}
                                label="Open Web UI"
                                {...customOpenWebUIDebug}
                            />
                        </div>
                    )}

                    {/* Per-Server Context Menu Visibility */}
                    <div className="mt-4 pt-4 border-t border-[var(--cds-border-subtle)]">
                        <h4 className="text-sm font-medium text-[var(--cds-text-primary)] mb-2">Server Visibility</h4>
                        <p className="text-xs text-[var(--cds-text-secondary)] mb-3">Select which servers should appear at the top level of the context menu.</p>

                        <Stack gap={2}>
                            {previewServers.map((server, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded bg-[var(--cds-layer-01)]">
                                    <div className="text-sm font-medium text-[var(--cds-text-primary)]">{server.name}</div>
                                    <SettingsToggle
                                        checked={server.showInContextMenu ?? false}
                                        onChange={() => handleServerToggle(index, !(server.showInContextMenu ?? false))}
                                        data-debug-id={`settings:context-menu:server-${index}-visibility`}
                                        data-component="Toggle"
                                    />
                                </div>
                            ))}
                            {previewServers.length === 0 && (
                                <p className="text-xs text-[var(--cds-text-helper)] italic">No servers configured.</p>
                            )}
                        </Stack>
                    </div>
                </Stack>

                {/* Context Menu Mockup */}
                <div className="border border-[var(--cds-border-subtle)] rounded-lg bg-[var(--cds-layer-01)] p-4 relative h-48 flex items-center justify-center">
                    <div className="bg-layer-01 text-text-primary shadow-lg rounded border border-subtle w-48 text-sm py-1 absolute top-8 left-8 z-10">
                        <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default">Open Link in New Tab</div>
                        <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default">Save Link As...</div>
                        <div className="border-t border-subtle my-1"></div>
                        {previewContextMenu !== 0 && (
                            <>
                                {previewServers.filter(s => s.showInContextMenu).map((server, i) => (
                                    <div key={i} className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default flex items-center font-bold">
                                        <img src="/icon/default-16.png" className="w-4 h-4 mr-2" alt="" />
                                        Add to {server.name}
                                    </div>
                                ))}

                                {(previewContextMenu === 1 || previewContextMenu === 2 || (previewContextMenu === 3 && previewCustomOptions.addToClient)) && (
                                    <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default flex items-center font-bold">
                                        <img src="/icon/default-16.png" className="w-4 h-4 mr-2" alt="" />
                                        Add to Torrent Client
                                    </div>
                                )}

                                {previewServers.length > 1 && !previewServers.every(s => s.showInContextMenu) && (
                                    <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default flex justify-between items-center">
                                        <span>Add to Server...</span>
                                        <span className="text-xs">▶</span>
                                    </div>
                                )}

                                {(previewContextMenu === 1 || (previewContextMenu === 3 && previewCustomOptions.pauseResume)) && (
                                    <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default pl-10 text-xs text-text-helper italic">
                                        Pause / Resume
                                    </div>
                                )}
                                {(previewContextMenu === 1 || (previewContextMenu === 3 && previewCustomOptions.openWebUI)) && (
                                    <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default pl-10 text-xs text-text-helper italic">
                                        Open Web UI
                                    </div>
                                )}
                            </>
                        )}
                        <div className="px-4 py-1 hover:bg-interactive-hover hover:text-white cursor-default">Inspect</div>
                    </div>
                    <p className="text-xs text-[var(--cds-text-helper)] absolute bottom-4 w-full text-center">Right-click Mockup</p>
                </div>
            </div>
        </SettingsCard>
    );
};
