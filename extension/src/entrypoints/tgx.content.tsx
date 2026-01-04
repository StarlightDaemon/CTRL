import { defineContentScript } from 'wxt/sandbox';
import { ContentInjectionService } from '../features/site-integrations/core/ContentInjectionService';
import { QualityFilter } from '../features/site-integrations/torrent-galaxy/components/QualityFilter';
import { enhanceMagnetLinks } from '../features/site-integrations/torrent-galaxy/logic/magnetEnhancer';
import { normalizeTitles } from '../features/site-integrations/torrent-galaxy/logic/titleNormalizer';
import React from 'react';
import { AppOptions } from '@/shared/lib/types';

// Initialize the injection service
const injector = new ContentInjectionService('tgx-integration');

export default defineContentScript({
    matches: ['*://torrentgalaxy.to/*', '*://proxygalaxy.me/*'],
    cssInjectionMode: 'ui',

    async main(ctx) {
        console.log('[CTRL] TorrentGalaxy Adapter Loaded');

        // Fetch settings
        const storage = await chrome.storage.local.get('settings');
        const settings = storage.settings as AppOptions;

        // Check if integration is enabled
        const tgConfig = settings?.torrent_galaxy || {
            enabled: true,
            qualityFilter: true,
            magnetEnhancer: true,
            titleNormalizer: true
        };

        if (!tgConfig.enabled) {
            console.log('[CTRL] integration disabled for TGx');
            return;
        }

        // Locate target: The main container for torrents
        const targetSelector = 'div.container';

        // Load our styles
        const cssUrl = chrome.runtime.getURL('/style.css');
        const cssContent = await (await fetch(cssUrl)).text();

        // Mount the Quality Filter UI if enabled
        if (tgConfig.qualityFilter) {
            injector.mount(
                targetSelector,
                <QualityFilter />,
                cssContent
            );
        }

        // Feature Runners
        const runFeatures = () => {
            if (tgConfig.magnetEnhancer) enhanceMagnetLinks();
            if (tgConfig.titleNormalizer) normalizeTitles();
        };

        // Initial Run
        runFeatures();

        // Watch for infinite scroll / pagination changes
        const observer = new MutationObserver(() => {
            runFeatures();
        });

        const listContainer = document.querySelector('.tgxtable');
        if (listContainer) {
            observer.observe(listContainer, { childList: true, subtree: true });
        } else {
            // Fallback
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // Cleanup on invalidation
        ctx.onInvalidated(() => {
            injector.unmount();
            observer.disconnect();
        });
    },
});
