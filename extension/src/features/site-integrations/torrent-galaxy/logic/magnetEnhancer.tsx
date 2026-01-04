import { ContentInjectionService } from '../../core/ContentInjectionService';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MagnetButton } from '../../shared/components/MagnetButton';

// Healthy trackers list
const HEALTHY_TRACKERS = [
    'http://tracker.opentrackr.org:1337/announce',
    'udp://tracker.opentrackr.org:1337',
    'udp://open.demonii.com:1337',
    'udp://tracker.openbittorrent.com:80',
    'udp://tracker.coppersurfer.tk:6969',
    'udp://glotorrents.pw:6969/announce',
    'udp://tracker.torrent.eu.org:451/announce',
];

export const enhanceMagnetLinks = () => {
    const magnets = document.querySelectorAll('a[href^="magnet:"]:not([data-ctrl-enhanced])');

    magnets.forEach((link: Element) => {
        const anchor = link as HTMLAnchorElement;
        anchor.setAttribute('data-ctrl-enhanced', 'true');

        // 1. Append Trackers
        try {
            const url = new URL(anchor.href);
            const currentTrackers = url.searchParams.getAll('tr');

            HEALTHY_TRACKERS.forEach(t => {
                if (!currentTrackers.includes(t)) {
                    url.searchParams.append('tr', t);
                }
            });
            anchor.href = url.toString();
        } catch (e) {
            console.warn('[CTRL] Failed to parsing magnet link', e);
        }

        // 2. Inject "Add to Debrid" Button
        const buttonContainer = document.createElement('span');
        buttonContainer.style.marginLeft = '5px';
        buttonContainer.style.display = 'inline-block';
        buttonContainer.style.verticalAlign = 'middle';

        // Check if parent is suitable for insertion, otherwise append to it
        if (anchor.nextSibling) {
            anchor.parentNode?.insertBefore(buttonContainer, anchor.nextSibling);
        } else {
            anchor.parentNode?.appendChild(buttonContainer);
        }

        // Render the React Button
        const root = createRoot(buttonContainer);
        root.render(
            <MagnetButton magnet={anchor.href} />
        );
    });
};
