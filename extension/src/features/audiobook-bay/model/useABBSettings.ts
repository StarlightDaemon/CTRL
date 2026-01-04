import { useState, useEffect } from 'react';
import { storage } from 'wxt/storage';
import { ABBSettings, DEFAULT_ABB_SETTINGS } from '@/features/audiobook-bay/lib/types';

export const abbSettingsStorage = storage.defineItem<ABBSettings>('local:abb_settings', {
    defaultValue: DEFAULT_ABB_SETTINGS,
});

export function useABBSettings() {
    const [settings, setSettings] = useState<ABBSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        abbSettingsStorage.getValue().then((val) => {
            setSettings({ ...DEFAULT_ABB_SETTINGS, ...val });
            setLoading(false);
        });

        const unwatch = abbSettingsStorage.watch((newVal) => {
            setSettings({ ...DEFAULT_ABB_SETTINGS, ...newVal });
        });

        return () => {
            unwatch();
        };
    }, []);

    const updateSettings = async (newSettings: ABBSettings) => {
        setSettings(newSettings);
        await abbSettingsStorage.setValue(newSettings);
    };

    return { settings, updateSettings, loading };
}
