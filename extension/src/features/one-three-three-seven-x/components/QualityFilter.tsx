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
        const rows = document.querySelectorAll('.table-list tbody tr');

        rows.forEach((row) => {
            const rowEl = row as HTMLElement;

            // Title is usually in the second column's anchor (first anchor with /torrent/)
            const titleLink = row.querySelector('td.name a:nth-child(2)');
            const title = titleLink ? titleLink.textContent || '' : '';

            // Seeders are in usually 2nd to last column with class 'seeds'
            const seedersElement = row.querySelector('.seeds');
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

    // Parse filters from existing URLs or rows? No, just react state.

    return (
        <FilterPanel
            filters={filters}
            onChange={setFilters}
            title="1337x Filter"
        />
    );
};
