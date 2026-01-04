import React from 'react';
import { createRoot } from 'react-dom/client';
import { MagnetButton } from '../../site-integrations/shared/components/MagnetButton';

export const enhanceMagnetLinks = (highlightDeadTorrents: boolean) => {
    const rows = document.querySelectorAll('table.torrent-list tbody tr');

    rows.forEach((row) => {
        // Highlighting Logic (Legacy but cleaned up)
        if (highlightDeadTorrents) {
            const seedersEl = row.querySelector('td:nth-child(6)');
            const seeders = seedersEl ? parseInt(seedersEl.textContent || '0', 10) : 0;
            if (seeders === 0) {
                row.classList.add('dead-torrent');
                (row as HTMLElement).style.opacity = '0.5';
                (row as HTMLElement).style.filter = 'grayscale(100%)';
            }
        }

        // Magnet Injection Logic
        // Nyaa usually has magnets in the 3rd column (Download links)
        const linksCell = row.querySelector('td:nth-child(3)');
        if (!linksCell) return;

        // Existing magnet link
        const magnetLink = linksCell.querySelector('a[href^="magnet:"]');
        if (!magnetLink) return;

        // Check if we already injected
        if (linksCell.querySelector('.ctrl-magnet-container')) return;

        // Create Container
        const container = document.createElement('span');
        container.className = 'ctrl-magnet-container';
        container.style.display = 'inline-block';
        container.style.marginLeft = '5px';
        container.style.verticalAlign = 'middle';

        // Append to cell
        linksCell.appendChild(container);

        // Render Button
        const root = createRoot(container);
        root.render(<MagnetButton magnet={(magnetLink as HTMLAnchorElement).href} />);
    });
};
