import { useState } from 'react';
// import browser from 'webextension-polyfill'; // Use wxt/browser or global chrome
import { ABBSettings } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Trash2, Plus, Globe } from 'lucide-react';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: ABBSettings;
    updateSettings: (settings: ABBSettings) => void;
}

export function MirrorManager({ settings, updateSettings }: Props) {
    const [newMirror, setNewMirror] = useState('');

    // Debug IDs
    const urlInputDebug = useDebugId('abb', 'mirrors', 'url-input');
    const addBtnDebug = useDebugId('abb', 'mirrors', 'add-button');

    const handleAdd = async () => {
        if (!newMirror) return;

        // Basic validation
        let url = newMirror;
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        try {
            // Request permissions first
            const origin = new URL(url).origin + '/*';
            const granted = await chrome.permissions.request({
                origins: [origin]
            });

            if (granted) {
                const newMirrors = [...(settings.customMirrors || []), url];
                updateSettings({ ...settings, customMirrors: newMirrors });
                setNewMirror('');
            } else {
                alert('Permission denied. Cannot add mirror.');
            }
        } catch (e) {
            alert('Invalid URL');
        }
    };

    const handleRemove = async (url: string) => {
        if (confirm('Are you sure you want to remove this mirror?')) {
            const newMirrors = settings.customMirrors.filter(m => m !== url);
            updateSettings({ ...settings, customMirrors: newMirrors });
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <SettingsCard title="Custom Mirrors" description="Add alternate URLs if the main site is blocked.">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <Input
                            label="Mirror URL"
                            placeholder="e.g., audiobookbay.is"
                            value={newMirror}
                            onChange={(e) => setNewMirror(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            {...urlInputDebug}
                        />
                    </div>
                    <Button onClick={handleAdd} className="flex items-center gap-2" {...addBtnDebug}>
                        <Plus className="w-4 h-4" /> Add Mirror
                    </Button>
                </div>
            </SettingsCard>

            <div className="space-y-4">
                {(!settings.customMirrors || settings.customMirrors.length === 0) ? (
                    <div className="text-center py-12 bg-surface rounded-lg border border-border border-dashed text-text-secondary">
                        <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No custom mirrors added.</p>
                        <p className="text-xs mt-1">Add a mirror URL above if the main site is blocked.</p>
                    </div>
                ) : (
                    settings.customMirrors.map((mirror) => (
                        <div key={mirror} className="p-4 flex justify-between items-center bg-surface rounded-lg border border-border hover:border-accent transition-colors shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-accent/10 text-accent">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <span className="font-medium text-text-primary">{mirror}</span>
                            </div>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleRemove(mirror)}
                                className="flex items-center gap-2"
                                data-debug-id={`abb:mirrors:remove-btn-${mirror}`}
                                data-component="Button"
                            >
                                <Trash2 className="w-4 h-4" /> Remove
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
