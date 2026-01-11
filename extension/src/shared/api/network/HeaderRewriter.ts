export interface ServerTarget {
    hostname: string;
}

export class HeaderRewriter {
    static async configure(servers: ServerTarget[]) {
        try {
            console.log(`[HeaderRewriter] Configuring rules for ${servers.length} servers`);

            // Clear old rules (Range 100-200 reserved for servers)
            // We can't easily "clear range", so we might need to track IDs.
            // But getting dynamic rules is cheap.
            const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
            const removeIds = oldRules.filter(r => r.id >= 100 && r.id < 200).map(r => r.id);

            // Create new rules
            const addRules = servers.map((server, index) => {
                const url = new URL(server.hostname);
                const origin = url.origin;

                return {
                    id: 100 + index,
                    priority: 1,
                    action: {
                        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                        requestHeaders: [
                            { header: 'Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin },
                            { header: 'Referer', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin + '/' }
                        ]
                    },
                    condition: {
                        urlFilter: origin + '/*', // Only match requests to this origin
                        resourceTypes: [
                            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                            chrome.declarativeNetRequest.ResourceType.OTHER
                        ]
                    }
                };
            });

            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: removeIds,
                addRules: addRules
            });
            console.log('[HeaderRewriter] Rules applied.');
        } catch (e) {
            console.error('[HeaderRewriter] Failed to apply rules:', e);
        }
    }

    static async configureTemporary(targetUrl: string) {
        try {
            const url = new URL(targetUrl);
            const origin = url.origin;

            console.log(`[HeaderRewriter] Configuring temporary rule for ${origin}`);

            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [999],
                addRules: [
                    {
                        id: 999, // Reserved for temporary test
                        priority: 2, // Higher priority than normal?
                        action: {
                            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                            requestHeaders: [
                                { header: 'Origin', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin },
                                { header: 'Referer', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: origin + '/' }
                            ]
                        },
                        condition: {
                            urlFilter: origin + '/*',
                            resourceTypes: [
                                chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
                                chrome.declarativeNetRequest.ResourceType.OTHER
                            ]
                        }
                    }
                ]
            });
        } catch (e) {
            console.error('[HeaderRewriter] Failed to apply temporary rule:', e);
        }
    }

    static async clear() {
        try {
            const rules = await chrome.declarativeNetRequest.getDynamicRules();
            const ids = rules.map(r => r.id);
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ids
            });
        } catch (e) { }
    }
}
