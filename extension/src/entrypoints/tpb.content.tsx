import { defineContentScript } from 'wxt/sandbox';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ContentInjectionService } from '../features/site-integrations/core/ContentInjectionService';
import { MagnetButton } from '../features/site-integrations/shared/components/MagnetButton';
import { PrismThemeProvider } from '@/app/providers/ThemeProvider';
import '@/app/styles/global.css';
// Import tailwind styles to ensure they are available
import './style.css';
import { AppOptions } from '@/shared/lib/types';

const injector = new ContentInjectionService('tpb-integration');

export default defineContentScript({
    // Standard TPB and known proxies
    matches: [
        '*://thepiratebay.org/*',
        '*://thepiratebay.se/*',
        '*://pirateproxy.live/*',
        '*://thehiddenbay.com/*',
        '*://tpb.party/*',
        '*://piratebay.live/*',
        '*://piratebay.party/*'
    ],
    cssInjectionMode: 'ui',

    async main(ctx) {
        console.log('[CTRL] TPB Adapter Loaded');

        const storage = await chrome.storage.local.get('settings');
        const settings = storage.settings as AppOptions;

        // Default config
        const tpbConfig = settings?.the_pirate_bay || {
            enabled: true,

            magnetEnhancer: true
        };

        if (!tpbConfig.enabled) return;



        // 2. Magnet Enhancer
        if (tpbConfig.magnetEnhancer) {
            enhanceMagnets();
            // Watch for changes (pagination/infinite scroll is rare on TPB but good practice)
            const observer = new MutationObserver(() => enhanceMagnets());
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }
});



function enhanceMagnets() {
    // TPB magnet links usually have an icon
    // Selector: a[href^="magnet:"]
    const magnets = document.querySelectorAll('a[href^="magnet:"]:not([data-ctrl-enhanced])');

    magnets.forEach((link) => {
        const anchor = link as HTMLAnchorElement;
        anchor.setAttribute('data-ctrl-enhanced', 'true');

        // Insert button AFTER the magnet link (or its icon)
        const buttonContainer = document.createElement('span');
        buttonContainer.className = 'ctrl-magnet-container';
        buttonContainer.style.display = 'inline-block';
        buttonContainer.style.verticalAlign = 'middle';
        buttonContainer.style.marginLeft = '4px';

        if (anchor.nextSibling) {
            anchor.parentNode?.insertBefore(buttonContainer, anchor.nextSibling);
        } else {
            anchor.parentNode?.appendChild(buttonContainer);
        }

        const shadow = buttonContainer.attachShadow({ mode: 'open' });

        // Inject styles
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('assets/style.css');
        shadow.appendChild(styleLink);

        const root = createRoot(shadow);
        root.render(
            <PrismThemeProvider mode="scoped">
                <MagnetButton magnet={anchor.href} />
            </PrismThemeProvider>
        );
    });
}
