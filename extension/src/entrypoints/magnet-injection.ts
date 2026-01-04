import { defineUnlistedScript } from 'wxt/sandbox';
import { storage } from 'wxt/storage';
import { AppSettings } from '@/shared/lib/types';

export default defineUnlistedScript({
    main() {
        // State to track if interception is enabled
        let enabled = false;

        // Initialize state
        storage.getItem<AppSettings>('local:options').then((settings) => {
            if (settings?.globals.catchTorrents) {
                enabled = true;
            }
        });

        // Watch for changes
        storage.watch<AppSettings>('local:options', (settings) => {
            enabled = settings?.globals.catchTorrents ?? false;
        });

        // Global click listener
        document.addEventListener('click', (e) => {
            if (!enabled) return;

            // Find the closest anchor tag
            const target = (e.target as HTMLElement).closest('a');
            if (!target) return;

            const href = target.getAttribute('href');
            if (!href) return;

            // Check for magnet link
            if (href.startsWith('magnet:')) {
                console.log('Torrent Control: Intercepted magnet link', href);

                // Prevent default navigation
                e.preventDefault();
                e.stopPropagation();

                // Send to background
                chrome.runtime.sendMessage({
                    type: 'ADD_TORRENT_URL',
                    url: href,
                    options: {}
                });
            }
        }, true); // Capture phase to ensure we get it first
    },
});
