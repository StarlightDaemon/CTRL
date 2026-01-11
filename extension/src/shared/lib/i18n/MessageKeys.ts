/**
 * Type-safe i18n message keys
 * Auto-generated from en/messages.json
 */

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
    | 'regexpMatchLabelsOption'
    | 'testUrlOption'
    | 'testAction'
    | 'testSuccessText'
    | 'testFailText'
    | 'addTorrentAction'
    | 'addTorrentPausedAction'
    | 'addTorrentLabelAction'
    | 'addTorrentPathAction'
    | 'addTorrentServerAction'
    | 'addRssFeedAction'
    | 'advancedModifier'
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
    | 'httpAuthOption'
    | 'serverDirectoriesOption'
    | 'torrentAddedNotification'
    | 'rssFeedAddedNotification'
    | 'loginError'
    | 'apiError'
    | 'rssFeedAddError'
    | 'torrentAddError'
    | 'torrentFetchError'
    | 'torrentParseError'
    | 'torrentLabelAddError'
    | 'sourceTabDestroyedError'
    | 'sequentialDownloadOption'
    | 'firstLastPiecePriorityOption'
    | 'skipHashCheckOption'
    | 'addTorrentTitle'
    | 'torrentUrl'
    | 'labelSelect'
    | 'downloadDirectorySelect'
    | 'defaultOption'
    | 'noneOption'
    | 'addAsPausedOption'
    | 'authTypeOption'
    | 'authTypeHttpAuthOption'
    | 'authTypeLoginFormOption'
    | 'contentLayoutOption'
    | 'contentLayoutOriginalOption'
    | 'contentLayoutSubfolderOption'
    | 'contentLayoutNoSubfolderOption'
    | 'serverDefaultDirectoryOption'
    | 'serverDefaultLabelOption'
    | 'sidebarServers'
    | 'sidebarGeneral';

/**
 * Type-safe wrapper for chrome.i18n.getMessage
 * Provides compile-time checking of message keys.
 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
    return chrome.i18n.getMessage(key, substitutions);
}
