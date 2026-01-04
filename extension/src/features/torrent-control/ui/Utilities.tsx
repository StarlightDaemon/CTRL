import React, { useState } from 'react';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { Wrench, Globe, Database, ArrowLeftRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { EXTERNAL_RESOURCES } from '@/shared/lib/resources';

export const Utilities = () => {
    const [magnetInput, setMagnetInput] = useState('');
    const [hashInput, setHashInput] = useState('');

    const convertMagnetToHash = () => {
        try {
            const match = magnetInput.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (match && match[1]) {
                setHashInput(match[1].toUpperCase());
            } else {
                setHashInput('Invalid Magnet Link');
            }
        } catch (e) {
            setHashInput('Error parsing link');
        }
    };

    const convertHashToMagnet = () => {
        if (!hashInput.match(/^[a-fA-F0-9]{40}$/)) {
            setMagnetInput('Invalid 40-char Hex Hash');
            return;
        }
        setMagnetInput(`magnet:?xt=urn:btih:${hashInput.toLowerCase()}`);
    };

    return (
        <SettingsPageLayout
            title="Utilities & Extras"
            description="Handy tools for torrent management and troubleshooting."
            icon={Wrench}
        >
            <SettingsCard title="Hash Converter">
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Convert between Magnet Links and Info Hashes.</p>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">Magnet Link</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={magnetInput}
                                onChange={(e) => setMagnetInput(e.target.value)}
                                placeholder="magnet:?xt=urn:btih:..."
                                className="flex-1 rounded-md border border-border bg-input text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                                data-component="Input"
                            />
                            <button
                                onClick={convertMagnetToHash}
                                className="px-4 py-2 bg-accent text-white rounded-md text-sm hover:bg-accent-hover transition-colors"
                                data-component="Button"
                            >
                                Extract Hash
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary">Info Hash</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={hashInput}
                                onChange={(e) => setHashInput(e.target.value)}
                                placeholder="e.g. 5B3260..."
                                className="flex-1 rounded-md border border-border bg-input text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                                data-component="Input"
                            />
                            <button
                                onClick={convertHashToMagnet}
                                className="px-4 py-2 bg-secondary text-text-primary border border-border rounded-md text-sm hover:bg-border transition-colors"
                                data-component="Button"
                            >
                                To Magnet
                            </button>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard title="Cache & Recovery">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {EXTERNAL_RESOURCES.cache.map((res) => (
                        <a
                            key={res.name}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border hover:border-accent group transition-colors"
                        >
                            <span className="font-medium text-text-primary">{res.name}</span>
                            <ExternalLink size={16} className="text-text-secondary group-hover:text-accent" />
                        </a>
                    ))}
                </div>
                <p className="mt-4 text-xs text-text-secondary">
                    These external services cache .torrent files. If a magnet link is stalled (0 metadata), you can search these caches using the info hash.
                </p>
            </SettingsCard>

            <SettingsCard title="Privacy & Diagnostics">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {EXTERNAL_RESOURCES.privacy.map((res) => (
                        <a
                            key={res.name}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border hover:border-accent group transition-colors"
                        >
                            <span className="font-medium text-text-primary">{res.name}</span>
                            <ExternalLink size={16} className="text-text-secondary group-hover:text-accent" />
                        </a>
                    ))}
                    {EXTERNAL_RESOURCES.diagnostics.map((res) => (
                        <a
                            key={res.name}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border hover:border-accent group transition-colors"
                        >
                            <span className="font-medium text-text-primary">{res.name}</span>
                            <ExternalLink size={16} className="text-text-secondary group-hover:text-accent" />
                        </a>
                    ))}
                </div>
                <p className="mt-4 text-xs text-text-secondary">
                    Tools to verify your connection security and IP exposure.
                </p>
            </SettingsCard>
        </SettingsPageLayout>
    );
};
