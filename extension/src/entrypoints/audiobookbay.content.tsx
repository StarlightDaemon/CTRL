import { defineContentScript } from 'wxt/sandbox';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { storage } from 'wxt/storage';
import { ABBSettings, DEFAULT_ABB_SETTINGS } from '../features/audiobook-bay/lib/types';
import { MagnetButton } from '../features/site-integrations/shared/components/MagnetButton';
import { PrismThemeProvider } from '@/app/providers/ThemeProvider';
import '@/app/styles/global.css';
// Import styles to ensure Tailwind classes are available
import './style.css';

export default defineContentScript({
    matches: [
        "*://audiobookbay.lu/*",
        "*://audiobookbay.nl/*",
        "*://audiobookbay.fi/*",
        "*://audiobookbay.li/*",
        "*://audiobookbay.is/*",
        "*://theaudiobookbay.me/*",
        "*://audiobookbayabb.com/*",
        "*://audiobookbay.se/*",
        "*://audiobookbay.biz/*",
        "*://audiobookbay.cc/*",
        "*://audiobookbay.la/*",
        "*://audiobookbay.unblockit.lat/*"
    ],
    // Inject CSS into the page head (WXT default for imported CSS in content scripts)
    cssInjectionMode: 'ui',
    runAt: 'document_end',
    main(ctx) {
        console.log('CTRL: Audiobook Bay Module Initialized');

        let currentSettings: ABBSettings = DEFAULT_ABB_SETTINGS;

        const init = async () => {
            const stored = await storage.getItem<ABBSettings>('local:abb_settings');
            if (stored) {
                currentSettings = { ...DEFAULT_ABB_SETTINGS, ...stored };
            }
            // Initial pass
            applyFilters();
            injectEnhancements();

            // Watch for changes
            storage.watch<ABBSettings>('local:abb_settings', (newValue) => {
                if (newValue) {
                    currentSettings = { ...DEFAULT_ABB_SETTINGS, ...newValue };
                    applyFilters();
                }
            });

            // Observer for dynamic content (though ABB is mostly static PHP, some elements might shift)
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length > 0) {
                        shouldUpdate = true;
                        break;
                    }
                }
                if (shouldUpdate) {
                    applyFilters();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };

        const applyFilters = () => {
            const postInfos = document.querySelectorAll('.postInfo');
            postInfos.forEach((info) => {
                const postContainer = info.parentElement;
                if (!postContainer) return;

                if (!currentSettings.enabled) {
                    (postContainer as HTMLElement).style.display = '';
                    return;
                }

                const text = info.textContent || '';
                const shouldHide = currentSettings.hiddenCategories.some(cat =>
                    text.toLowerCase().includes(cat.toLowerCase())
                );

                if (shouldHide) {
                    (postContainer as HTMLElement).style.display = 'none';
                    postContainer.classList.add('ctrl-hidden');
                } else {
                    if (postContainer.classList.contains('ctrl-hidden')) {
                        (postContainer as HTMLElement).style.display = '';
                        postContainer.classList.remove('ctrl-hidden');
                    }
                }
            });
        };

        const injectEnhancements = () => {
            if (!currentSettings.enabled) return;
            injectMagnetLink();
            injectGoodreadsLink();
        };

        const injectMagnetLink = () => {
            if (document.querySelector('#ctrl-magnet-container')) return;

            const rows = Array.from(document.querySelectorAll('tr'));
            const hashRow = rows.find(row => row.textContent?.includes('Info Hash:'));
            if (!hashRow) return;

            const hashCell = hashRow.querySelectorAll('td')[1];
            if (!hashCell) return;

            const infoHash = hashCell.textContent?.trim();
            if (!infoHash || !/^[a-f0-9]{40}$/i.test(infoHash)) return;

            // Find Trackers
            const trackerRow = rows.find(row => row.textContent?.includes('Tracker:'));
            let pageTrackers: string[] = [];
            if (trackerRow) {
                const trackerCell = trackerRow.querySelectorAll('td')[1];
                if (trackerCell) {
                    const text = trackerCell.textContent?.trim();
                    if (text && (text.startsWith('http') || text.startsWith('udp'))) {
                        pageTrackers.push(text);
                    }
                }
            }

            const titleEl = document.querySelector('.postTitle h1');
            const title = titleEl?.textContent?.trim() || 'Audiobook';

            const trackers = [...new Set([...(currentSettings.defaultTrackers || []), ...pageTrackers])];
            const trackerParams = trackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');
            const magnetLink = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${trackerParams ? '&' + trackerParams : ''}`;

            // Mount React Component
            const container = document.createElement('div');
            container.id = 'ctrl-magnet-container';
            container.style.display = 'inline-block';
            container.style.verticalAlign = 'middle';
            container.style.marginLeft = '10px';

            // Append to cell logic
            // The cell contains text node. We append container.
            hashCell.appendChild(container);

            // Create Shadow Root to isolate styles if needed, OR just mount if we inject CSS globally
            // Since we set cssInjectionMode: 'ui', WXT generates a CSS file for this entrypoint.
            // But we need to attach it.
            // Simplified: Use Shadow DOM to ensure styles work without polluting page
            const shadow = container.attachShadow({ mode: 'open' });

            // Add style sheet to shadow
            // NOTE: WXT's `ui` mode usually expects us to return the UI definition.
            // Here we are manually mounting.
            // We can manually inject the style string if we had it, or link it.
            // For now, let's try assuming allow-scripts injects styles to head (cssInjectionMode: undefined or 'manifest')
            // BUT, MagnetButton uses Tailwind. Page has no Tailwind.
            // So we MUST have Tailwind styles present.
            // Strategy: Create a UI with WXT's createShadowRootUi?
            // Existing `tgx.content.tsx` uses `ContentInjectionService` which does this.
            // I'll stick to a simpler approach: 
            // 1. Mount to shadow. 
            // 2. Fetch the extension's CSS (chrome.runtime.getURL) and link it.

            const styleLink = document.createElement('link');
            styleLink.rel = 'stylesheet';
            styleLink.href = chrome.runtime.getURL('assets/style.css'); // Verify path!
            shadow.appendChild(styleLink);

            const root = createRoot(shadow);
            root.render(
                <PrismThemeProvider mode="scoped">
                    <div className="flex items-center">
                        <span className="mr-2 text-xs font-bold text-gray-500">CTRL Generated:</span>
                        <MagnetButton magnet={magnetLink} />
                    </div>
                </PrismThemeProvider>
            );
        };

        const injectGoodreadsLink = () => {
            if (document.querySelector('#ctrl-goodreads-link')) return;

            const titleEl = document.querySelector('.postTitle h1');
            if (!titleEl || !titleEl.textContent) return;

            const title = titleEl.textContent.trim();
            // Clean title: Remove "Audiobook", author if possible, etc.
            // E.g. "The Great Gatsby - F. Scott Fitzgerald"
            // Simple approach: Send whole title
            const encodedTitle = encodeURIComponent(title);
            const url = `https://www.goodreads.com/search?q=${encodedTitle}`;

            const link = document.createElement('a');
            link.id = 'ctrl-goodreads-link';
            link.href = url;
            link.target = '_blank';
            link.className = 'ctrl-goodreads-btn'; // We can style this via global CSS or inline
            link.textContent = '📚 Goodreads';
            link.style.display = 'inline-block';
            link.style.marginTop = '5px';
            link.style.fontSize = '12px';
            link.style.color = '#875536'; // Goodreads brown
            link.style.textDecoration = 'none';
            link.style.border = '1px solid #875536';
            link.style.padding = '2px 8px';
            link.style.borderRadius = '10px';
            link.onmouseenter = () => { link.style.backgroundColor = '#875536'; link.style.color = 'white'; };
            link.onmouseleave = () => { link.style.backgroundColor = 'transparent'; link.style.color = '#875536'; };

            titleEl.parentElement?.appendChild(link);
        };

        init();
    },
});
