export interface ABBSettings {
    enabled: boolean;
    showDiagnostics: boolean; // Added
    hiddenCategories: string[];
    defaultTrackers: string[];
    highlightColor: string;
    theme: string;
    customMirrors: string[];
}

export const DEFAULT_ABB_SETTINGS: ABBSettings = {
    enabled: true,
    showDiagnostics: false,
    hiddenCategories: [],
    defaultTrackers: [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://open.stealth.si:80/announce',
        'udp://tracker.torrent.eu.org:451/announce'
    ],
    highlightColor: '#2ecc71',
    theme: 'light',
    customMirrors: []
};
