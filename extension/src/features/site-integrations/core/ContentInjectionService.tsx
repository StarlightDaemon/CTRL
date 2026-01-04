import { createRoot } from 'react-dom/client';
import React from 'react';
import { PrismThemeProvider } from '@/app/providers/ThemeProvider';
import '@/app/styles/global.css';

/**
 * Service to handle safe injection of React components into hostile DOMs using Shadow DOM.
 */
export class ContentInjectionService {
    private shadowHost: HTMLElement | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private reactRoot: any = null; // ReactDOM Root

    constructor(private injectionId: string) { }

    /**
     * Mounts a React component into a Shadow DOM rooted at the specified target.
     * @param targetSelector Selector for the container to append the shadow host to.
     * @param Component The React component to mount.
     * @param cssContent Optional CSS string to inject into the shadow root.
     */
    public mount(
        targetSelector: string,
        Component: React.ReactNode,
        cssContent: string = ''
    ) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.warn(`[CTRL] Injection target not found: ${targetSelector}`);
            return;
        }

        // 1. Create Host
        if (!this.shadowHost) {
            this.shadowHost = document.createElement('div');
            this.shadowHost.id = `ctrl-host-${this.injectionId}`;
            this.shadowHost.style.position = 'fixed';
            this.shadowHost.style.zIndex = '999999'; // High z-index to sit on top
            this.shadowHost.style.top = '0';
            this.shadowHost.style.left = '0';
            this.shadowHost.style.width = '0'; // Minimal impact until content renders
            this.shadowHost.style.height = '0';
            target.appendChild(this.shadowHost);

            // 2. Attach Shadow
            this.shadowRoot = this.shadowHost.attachShadow({ mode: 'open' });
        }

        // 3. Inject Styles
        if (this.shadowRoot && !this.shadowRoot.querySelector('style#ctrl-styles')) {
            // Inject Tailwind/Global styles
            const tailwindLink = document.createElement('link');
            tailwindLink.rel = 'stylesheet';
            tailwindLink.href = chrome.runtime.getURL('assets/style.css');
            this.shadowRoot.appendChild(tailwindLink);

            const style = document.createElement('style');
            style.id = 'ctrl-styles';
            // Add a basic reset and the passed CSS
            style.textContent = `
                :host { all: initial; font-family: sans-serif; } 
                ${cssContent}
            `;
            this.shadowRoot.appendChild(style);
        }

        // 4. Mount React
        if (this.shadowRoot) {
            const mountPoint = document.createElement('div');
            mountPoint.id = 'ctrl-mount';
            // Ensure full pointer events for the UI
            mountPoint.style.pointerEvents = 'auto';
            this.shadowRoot.appendChild(mountPoint);

            this.reactRoot = createRoot(mountPoint);
            this.reactRoot.render(
                <PrismThemeProvider mode="scoped" >
                { Component }
            </PrismThemeProvider>
            );
        }
    }

    /**
     * Unmounts the component and removes the shadow host.
     */
    public unmount() {
        if (this.reactRoot) {
            this.reactRoot.unmount();
        }
        if (this.shadowHost) {
            this.shadowHost.remove();
        }
        this.shadowHost = null;
        this.shadowRoot = null;
        this.reactRoot = null;
    }
}
