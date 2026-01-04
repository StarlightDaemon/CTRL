import React from 'react';
import { Card } from '../ui/Card';
import { ABBSettings } from '@/shared/lib/types';

interface Props {
    settings: ABBSettings;
    previewTheme: string;
    setPreviewTheme: (theme: string) => void;
    applyTheme: () => void;
}

export const ThemeSettings: React.FC<Props> = ({ previewTheme, setPreviewTheme }) => {
    const themes = ['light', 'dark', 'midnight', 'oled', 'forest', 'ocean', 'sky_blue', 'cyberpunk'];

    return (
        <Card>
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-medium text-text-primary">Color Theme</h3>
                    <p className="text-sm text-text-secondary">Choose a color scheme for the extension.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {themes.map((themeName) => (
                    <button
                        key={themeName}
                        onClick={() => {
                            setPreviewTheme(themeName);
                            // Apply immediately for preview effect, but save happens later
                            document.documentElement.setAttribute('data-theme', themeName);
                        }}
                        className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${previewTheme === themeName
                            ? 'border-accent bg-accent/10 text-accent ring-2 ring-accent/20'
                            : 'border-border hover:border-accent/50 hover:bg-secondary'
                            }`}
                    >
                        {themeName.replace('_', ' ')}
                    </button>
                ))}
            </div>

            <div className="mt-4 p-3 bg-secondary/50 rounded-md border border-border text-xs text-text-secondary">
                <p><strong>Note:</strong> Changes are previewed instantly but must be saved to persist.</p>
            </div>
        </Card>
    );
};
