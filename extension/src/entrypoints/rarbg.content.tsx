import { defineContentScript } from 'wxt/sandbox';
import { ContentInjectionService } from '../features/site-integrations/core/ContentInjectionService';
import { QualityFilter } from '../features/site-integrations/rarbg/components/QualityFilter';
import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { extractMetadata } from '../features/site-integrations/shared/logic/metadataParser';

// Initialize the injection service for RARBG
const injector = new ContentInjectionService('rarbg-integration');

export default defineContentScript({
    matches: [
        '*://rargb.to/*',
        '*://rarbggo.org/*',
        '*://rarbgproxy.org/*',
        '*://rarbgget.org/*',
        '*://torrentsbay.org/*'
    ],
    cssInjectionMode: 'ui',

    async main(ctx) {
        console.log('[CTRL] RARBG Adapter Loaded');

        const storage = await chrome.storage.local.get('settings');
        const settings = storage.settings as AppOptions;

        const rarbgConfig = settings?.rarbg || {
            enabled: true,
            qualityFilter: true
        };

        if (!rarbgConfig.enabled) return;

        // Load styles
        const cssUrl = chrome.runtime.getURL('/style.css');
        const cssContent = await (await fetch(cssUrl)).text();

        // 1. Quality Filter Injection
        if (rarbgConfig.qualityFilter) {
            injector.mount(
                'body', // We mount to body and use fixed positioning in the component
                <QualityFilter />,
                cssContent
            );
        }

        // 2. Metadata Badges (Optional / Future)
        // verifyListRows();
    }
});
