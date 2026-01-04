import React from 'react';
import { ABBSettings } from '@/shared/lib/types';
import { Card } from './ui/Card';
import { Check, X } from 'lucide-react';

interface Props {
    settings: ABBSettings | null;
}

export const DiagnosticsTab: React.FC<Props> = ({ settings }) => {
    if (!settings) return null;

    const renderBoolean = (value: boolean) => (
        value ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />
    );

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-lg font-medium text-text-primary mb-4">Diagnostics State</h2>
                <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface text-text-secondary font-medium border-b border-border">
                            <tr>
                                <th className="px-4 py-3">Configuration Key</th>
                                <th className="px-4 py-3">Current Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-background">
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Feature Enabled</td>
                                <td className="px-4 py-3">{renderBoolean(settings.enabled)}</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Show Diagnostics</td>
                                <td className="px-4 py-3">{renderBoolean(settings.showDiagnostics)}</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Theme</td>
                                <td className="px-4 py-3 capitalize">{settings.theme}</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Highlight Color</td>
                                <td className="px-4 py-3 flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: settings.highlightColor }}></div>
                                    <span className="font-mono text-xs">{settings.highlightColor}</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Custom Mirrors Used</td>
                                <td className="px-4 py-3">{settings.customMirrors.length} defined</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Hidden Categories</td>
                                <td className="px-4 py-3">{settings.hiddenCategories.length > 0 ? settings.hiddenCategories.length : 'None'}</td>
                            </tr>
                            <tr>
                                <td className="px-4 py-3 font-medium text-text-primary">Default Trackers</td>
                                <td className="px-4 py-3">
                                    <details className="cursor-pointer group">
                                        <summary className="text-accent hover:underline text-xs flex items-center select-none">
                                            View {settings.defaultTrackers.length} Trackers
                                        </summary>
                                        <ul className="mt-2 text-xs font-mono text-text-secondary bg-surface p-2 rounded max-h-32 overflow-y-auto">
                                            {settings.defaultTrackers.map((t, i) => (
                                                <li key={i}>{t}</li>
                                            ))}
                                        </ul>
                                    </details>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
