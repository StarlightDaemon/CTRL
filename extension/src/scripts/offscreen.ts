
// Simple Keep-Alive Interval
// Sends a message to the Service Worker every 20 seconds
setInterval(() => {
    chrome.runtime.sendMessage({ type: 'KEEP_ALIVE_PING' }).catch(() => {
        // Ignore errors (SW might be busy or restarting)
    });

    // Also log to console to verify it's running
    console.debug('Offscreen Keep-Alive Ping sent');
}, 20000);
