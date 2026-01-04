import { defineContentScript } from 'wxt/sandbox';
import { ContentInjectionService } from '../features/site-integrations/core/ContentInjectionService';
import { QualityFilter } from '../features/one-three-three-seven-x/components/QualityFilter';
import { enhanceMagnetLinks } from '../features/one-three-three-seven-x/logic/magnetEnhancer';
import { normalizeTitles } from '../features/one-three-three-seven-x/logic/titleNormalizer';
import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

// Initialize the injection service for 1337x
const injector = new ContentInjectionService('1337x-integration');

// List of 1337x domains and mirrors
const MATCHES = [
    "*://1337x.to/*",
    "*://www.1337x.to/*",
    "*://1337x.st/*",
    "*://www.1337x.st/*",
    "*://1337x.ws/*",
    "*://www.1337x.ws/*",
    "*://1337x.eu/*",
    "*://www.1337x.eu/*",
    "*://1337x.se/*",
    "*://www.1337x.se/*",
    "*://1337x.is/*",
    "*://www.1337x.is/*",
    "*://1337x.gd/*",
    "*://www.1337x.gd/*",
    "*://unblocked.dk/*"
];

export default defineContentScript({
    matches: MATCHES,
    cssInjectionMode: 'ui',
    runAt: 'document_end',

    async main(ctx) {
        console.log('[CTRL] 1337x Adapter Loaded');

        // Fetch settings
        const storage = await chrome.storage.local.get('settings');
        const settings = storage.settings as AppOptions;

        // Check if integration is enabled
        const config = settings?.['1337x'] || DEFAULT_OPTIONS['1337x']!;

        // Check if integration is disabled
        if (!config.enabled) {
            console.log('[CTRL] 1337x integration disabled by user settings');
            return;
        }

        // Load global styles
        const cssUrl = chrome.runtime.getURL('/style.css');
        let cssContent = '';
        try {
            cssContent = await (await fetch(cssUrl)).text();
        } catch (e) {
            console.error('[CTRL] Failed to load CSS', e);
        }

        // Route: Detail Page vs List View
        if (window.location.href.includes('/torrent/')) {
            // Detail View Logic could go here (e.g. IMDb badge)
            // Keeping it simple for now, focusing on Filter and List enhancements
        } else {
            // List View Logic

            // 1. Inject Filter Panel
            // Target: The main sidebar or a new container. 1337x sidebars are sometimes messy.
            // Let's try to find a consistent place. The search results usually have a sidebar container.
            // Or we can just inject into fixed position like TGx.
            // TGx injector mounts to a specific selector.
            // 1337x structure: `main.container` usually wraps everything.

            if (config.listView.filterPanel !== false) { // Default to true if undefined
                // Mount the Quality Filter UI
                // We use a broader selector for 1337x as it varies
                injector.mount(
                    'main.container',
                    <QualityFilter />,
                    cssContent
                );
            }

            // 2. Enhance List Items
            const runListEnhancements = () => {
                if (config.listView.addMagnetLinks) enhanceMagnetLinks();
                if (config.listView.cleanTitles) normalizeTitles();
            };

            runListEnhancements();

            // Watch for changes (pagination/sorting often reloads page, but just in case of dynamic stuff)
            const observer = new MutationObserver(() => {
                runListEnhancements();
            });

            const table = document.querySelector('.table-list');
            if (table) {
                observer.observe(table, { childList: true, subtree: true });
            }

            // Cleanup on invalidation
            ctx.onInvalidated(() => {
                injector.unmount();
                observer.disconnect();
            });
        }
    },
});
