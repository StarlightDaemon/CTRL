import React, { useState, useEffect } from 'react';
import { FilterPanel } from '../../site-integrations/shared/components/FilterPanel';
import { extractMetadata } from '../../site-integrations/shared/logic/metadataParser';

export const QualityFilter = () => {
    const [filters, setFilters] = useState<{
        resolution: string[];
        codec: string[];
        hideDead: boolean;
    }>({
        resolution: [],
        codec: [],
        hideDead: false
    });

    useEffect(() => {
        applyFilters();
    }, [filters]);

    const applyFilters = () => {
        const rows = document.querySelectorAll('table.torrent-list tbody tr');

        rows.forEach((row) => {
            const rowEl = row as HTMLElement;

            // Title is usually in the second column's anchor (first anchor is sometimes category)
            // Nyaa: td:nth-child(2) contains category logic + title link.
            const links = row.querySelectorAll('td:nth-child(2) a');
            // The title is the link that doesn't have class 'comments' and isn't the category link (which has query params starting with /?c=)
            // Simplest: The link that has href starting with /view/
            const titleLink = Array.from(links).find(a => (a as HTMLAnchorElement).getAttribute('href')?.startsWith('/view/'));

            const title = titleLink ? titleLink.textContent || '' : '';

            // Seeders: 6th column
            const seedersElement = row.querySelector('td:nth-child(6)');
            const seeders = seedersElement ? parseInt(seedersElement.textContent || '0', 10) : 0;

            const metadata = extractMetadata(title);

            let visible = true;

            // Resolution Filter
            if (filters.resolution.length > 0) {
                if (!metadata.resolution || !filters.resolution.includes(metadata.resolution)) {
                    visible = false;
                }
            }

            // Codec Filter
            if (filters.codec.length > 0) {
                if (!metadata.codec || !filters.codec.includes(metadata.codec)) {
                    visible = false;
                }
            }

            // Hide Dead
            if (filters.hideDead && seeders === 0) {
                visible = false;
            }

            rowEl.style.display = visible ? '' : 'none';
        });
    };

    return (
        <FilterPanel
            filters={filters}
            onChange={setFilters}
            title="Nyaa Filter"
        />
    );
};
