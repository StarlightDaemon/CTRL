/**
 * Type-safe i18n hook for Chrome Extensions
 * 
 * Uses chrome.i18n.getMessage under the hood but provides
 * TypeScript type checking for message keys.
 */

// Message keys from _locales/en/messages.json
// This could be auto-generated from the JSON file
export type MessageKey =
    | 'addonConfigurationTitle'
    | 'contextMenuOption'
    | 'contextMenuDefaultOption'
    | 'contextMenuSimpleOption'
    | 'contextMenuHiddenOption'
    | 'catchUrlsOption'
    | 'addAdvancedOption'
    | 'enableNotificationsOption'
    | 'addPausedOption'
    | 'torrentLabelsOption'
    | 'addTorrentAction'
    | 'addTorrentPausedAction'
    | 'addTorrentLabelAction'
    | 'addTorrentPathAction'
    | 'addTorrentServerAction'
    | 'saveAction'
    | 'removeAction'
    | 'addServerAction'
    | 'serverConfigurationTitle'
    | 'bittorrentClientOption'
    | 'serverSelect'
    | 'serverNameOption'
    | 'serverAddressOption'
    | 'usernameOption'
    | 'passwordOption'
    | 'torrentAddedNotification'
    | 'loginError'
    | 'apiError'
    | 'torrentAddError'
    | 'torrentFetchError'
    | 'addTorrentTitle'
    | 'labelSelect'
    | 'downloadDirectorySelect'
    | 'defaultOption'
    | 'noneOption'
    | 'sidebarServers'
    | 'sidebarGeneral';

/**
 * Get localized message by key
 * Falls back to key name if message not found
 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
    try {
        const message = chrome.i18n.getMessage(key, substitutions);
        return message || key;
    } catch {
        // Fallback for testing or unsupported environments
        return key;
    }
}

/**
 * Get the current UI locale
 */
export function getLocale(): string {
    try {
        return chrome.i18n.getUILanguage();
    } catch {
        return 'en';
    }
}

/**
 * React hook for accessing i18n in components
 */
export function useI18n() {
    return {
        t,
        locale: getLocale(),
    };
}
