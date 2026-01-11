import { useMemo } from 'react';

/**
 * Custom hook to safely access chrome.i18n messages.
 * Provides a fallback for non-extension environments (dev/test).
 */
export const useExtensionTranslation = (key: string, substitutions?: string | string[]) => {
    const message = useMemo(() => {
        // Fallback for non-extension environments
        if (typeof chrome === 'undefined' || !chrome.i18n) {
            return `[${key}]`;
        }
        return chrome.i18n.getMessage(key, substitutions);
    }, [key, substitutions]);

    return message;
};
