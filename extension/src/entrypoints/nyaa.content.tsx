import { defineContentScript } from 'wxt/sandbox';
import { ContentInjectionService } from '../features/site-integrations/core/ContentInjectionService';
import { QualityFilter } from '../features/nyaa/components/QualityFilter';
import { enhanceMagnetLinks } from '../features/nyaa/logic/magnetEnhancer';
import { handleDarkMode } from '../features/nyaa/logic/darkMode';
import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

// Initialize the injection service
const injector = new ContentInjectionService('nyaa-integration');

export default defineContentScript({
    matches: ["*://nyaa.si/*", "*://sukebei.nyaa.si/*"],
    cssInjectionMode: 'ui',
    runAt: 'document_end',

    async main(ctx) {
        console.log('[CTRL] Nyaa Adapter Loaded');

        // Fetch settings
        const storage = await chrome.storage.local.get('settings');
        const settings = storage.settings as AppOptions;

        // Check if integration is enabled
        const config = settings?.nyaa ?? DEFAULT_OPTIONS.nyaa!;

        if (!config.enabled) {
            console.log('[CTRL] integration disabled for Nyaa');
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

        // 1. Core Logic (Dark Mode)
        if (config.autoDarkMode) handleDarkMode();

        // 2. Inject Filter Panel
        if (config.filterPanel !== false) {
            injector.mount(
                'div.container',
                <QualityFilter />,
                cssContent
            );
        }

        // 3. Enhance List Items
        const runEnhancements = () => {
            // In Nyaa list view
            enhanceMagnetLinks(config.highlightDeadTorrents);
        };

        runEnhancements();

        // Watch for changes
        const observer = new MutationObserver(() => {
            runEnhancements();
        });

        const listContainer = document.querySelector('table.torrent-list');
        if (listContainer) {
            observer.observe(listContainer, { childList: true, subtree: true });
        }

        // Cleanup on invalidation
        ctx.onInvalidated(() => {
            injector.unmount();
            observer.disconnect();
        });
    },
});

