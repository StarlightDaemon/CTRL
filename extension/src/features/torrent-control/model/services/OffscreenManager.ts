
export const OffscreenManager = {
    async ensureCreated() {
        if (typeof chrome === 'undefined' || !chrome.offscreen) {
            return; // Not supported (e.g. Firefox)
        }

        try {
            const existingContexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT' as any], // Cast for WXT types compat if needed
            });

            if (existingContexts.length > 0) return;

            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['BLOBS' as any],
                justification: 'Keep Service Worker alive during active polling.',
            });
        } catch (e) {
            console.warn('OffscreenManager: Failed to create', e);
        }
    },

    async close() {
        if (typeof chrome === 'undefined' || !chrome.offscreen) {
            return;
        }

        try {
            await chrome.offscreen.closeDocument();
        } catch (e) {
            // Ignore if already closed or not found
        }
    }
};
