import React from 'react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    previewContextMenu: number;
    setPreviewContextMenu: (value: number) => void;
    previewCustomOptions: any;
    setPreviewCustomOptions: (options: any) => void;
    applyContextMenu: () => void;
    previewTheme: string;
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
    previewTheme,
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
        // ... implementation
    };

    return (
        <SettingsCard
            title="Context Menu"
            description="Customize the right-click menu options."
            headerActions={
                (previewContextMenu !== settings.globals.contextMenu ||
                    JSON.stringify(previewCustomOptions) !== JSON.stringify(settings.globals.contextMenuCustomOptions) ||
                    JSON.stringify(previewServers) !== JSON.stringify(settings.servers)) && (
                    <button
                        onClick={applyContextMenu}
                        className="bg-accent text-white px-3 py-1.5 rounded text-sm hover:bg-accent-hover transition-colors"
                        {...applyBtnDebug}
                    >
                        Apply
                    </button>
                )
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    {[
                        { value: 1, label: 'Default (Full Menu)', desc: 'Show all options (Add, Pause, etc.)' },
                        { value: 2, label: 'Simple (Add Only)', desc: 'Only show "Add to Torrent Client"' },
                        { value: 3, label: 'Custom', desc: 'Select individual options' },
                        { value: 0, label: 'Hidden', desc: 'Disable context menu integration' },
                    ].map((option) => (
                        <div key={option.value}>
                            <label className="flex items-start space-x-3 p-2 rounded hover:bg-hover cursor-pointer border border-transparent hover:border-border">
                                <input
                                    type="radio"
                                    name="contextMenu"
                                    checked={previewContextMenu === option.value}
                                    onChange={() => setPreviewContextMenu(option.value)}
                                    className="mt-1 text-accent focus:ring-accent"
                                    data-debug-id={`settings:context-menu:mode-${option.value}`}
                                    data-component="Radio"
                                />
                                <div>
                                    <div className="text-sm font-medium text-text-primary">{option.label}</div>
                                    <div className="text-xs text-text-secondary">{option.desc}</div>
                                </div>
                            </label>
                            {/* Custom Options */}
                            {option.value === 3 && previewContextMenu === 3 && (
                                <div className="ml-8 mt-2 space-y-2 border-l-2 border-border pl-3">
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
                        </div>
                    ))}

                    {/* Per-Server Context Menu Visibility */}
                    <div className="mt-4 pt-4 border-t border-border">
                        <h4 className="text-sm font-medium text-text-primary mb-2">Server Visibility</h4>
                        <p className="text-xs text-text-secondary mb-3">Select which servers should appear at the top level of the context menu.</p>

                        <div className="space-y-2">
                            {previewServers.map((server, index) => (
                                <div key={index} className="flex items-center justify-between p-2 rounded bg-background/50">
                                    <div className="text-sm font-medium text-text-primary">{server.name}</div>
                                    <SettingsToggle
                                        checked={server.showInContextMenu ?? false}
                                        onChange={() => handleServerToggle(index, !(server.showInContextMenu ?? false))}
                                        data-debug-id={`settings:context-menu:server-${index}-visibility`}
                                        data-component="Toggle"
                                    />
                                </div>
                            ))}
                            {previewServers.length === 0 && (
                                <p className="text-xs text-text-secondary italic">No servers configured.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Context Menu Mockup */}
                <div className="border border-border rounded-lg bg-white p-4 relative h-48 flex items-center justify-center bg-opacity-10" data-theme={previewTheme}>
                    <div className="bg-white text-black shadow-lg rounded border border-gray-200 w-48 text-sm py-1 absolute top-8 left-8">
                        <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default">Open Link in New Tab</div>
                        <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default">Save Link As...</div>
                        <div className="border-t border-gray-200 my-1"></div>
                        {previewContextMenu !== 0 && (
                            <>
                                {previewServers.filter(s => s.showInContextMenu).map((server, i) => (
                                    <div key={i} className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default flex items-center">
                                        <img src="/icon/default-16.png" className="w-4 h-4 mr-2" alt="" />
                                        Add to {server.name}
                                    </div>
                                ))}

                                {(previewContextMenu === 1 || previewContextMenu === 2 || (previewContextMenu === 3 && previewCustomOptions.addToClient)) && (
                                    <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default flex items-center">
                                        <img src="/icon/default-16.png" className="w-4 h-4 mr-2" alt="" />
                                        Add to Torrent Client
                                    </div>
                                )}

                                {previewServers.length > 1 && !previewServers.every(s => s.showInContextMenu) && (
                                    <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default flex justify-between items-center">
                                        <span>Add to Server...</span>
                                        <span className="text-xs">▶</span>
                                    </div>
                                )}

                                {(previewContextMenu === 1 || (previewContextMenu === 3 && previewCustomOptions.pauseResume)) && (
                                    <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default pl-10 text-xs text-gray-500">
                                        Pause / Resume
                                    </div>
                                )}
                                {(previewContextMenu === 1 || (previewContextMenu === 3 && previewCustomOptions.openWebUI)) && (
                                    <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default pl-10 text-xs text-gray-500">
                                        Open Web UI
                                    </div>
                                )}
                            </>
                        )}
                        <div className="px-4 py-1 hover:bg-blue-500 hover:text-white cursor-default">Inspect</div>
                    </div>
                    <p className="text-xs text-text-secondary mt-32">Right-click Mockup</p>
                </div>
            </div>
        </SettingsCard>
    );
};
