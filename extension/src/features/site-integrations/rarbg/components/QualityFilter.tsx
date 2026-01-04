import React, { useState, useEffect } from 'react';
import { extractMetadata } from '../../shared/logic/metadataParser';
import { FilterPanel, FilterState } from '../../shared/components/FilterPanel';

export const QualityFilter = () => {
    const [filters, setFilters] = useState<FilterState>({
        resolution: [],
        codec: [],
        hideDead: false
    });

    // Load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('ctrl-rarbg-filter');
        if (saved) {
            try {
                setFilters(JSON.parse(saved));
            } catch (e) { console.error('Failed to load filters', e) }
        }
    }, []);

    // Save to localStorage & Apply Filters
    useEffect(() => {
        localStorage.setItem('ctrl-rarbg-filter', JSON.stringify(filters));
        applyToDOM();
    }, [filters]);

    const applyToDOM = () => {
        // RARBG Structure: .lista2 are the rows
        const rows = document.querySelectorAll('.lista2');

        rows.forEach((row: any) => {
            // Title is usually in the second column's anchor
            const titleLink = row.querySelector('td:nth-child(2) a[href^="/torrent/"]');
            const title = titleLink ? titleLink.innerText : '';

            // Seeders are in usually 5th or 6th column, typically green color
            // But selectors vary. Let's look for known seeder attributes or color.
            // RARBG seeders often have color="green"
            const seedersElement = row.querySelector('font[color="green"]');
            const seeders = seedersElement ? parseInt(seedersElement.innerText, 10) : 0;

            const metadata = extractMetadata(title);
            let visible = true;

            // 1. Resolution
            if (filters.resolution.length > 0) {
                if (!metadata.resolution || !filters.resolution.includes(metadata.resolution)) {
                    visible = false;
                }
            }

            // 2. Codec
            if (filters.codec.length > 0 && visible) {
                if (!metadata.codec || !filters.codec.includes(metadata.codec)) {
                    visible = false;
                }
            }

            // 3. Dead
            if (filters.hideDead && seeders === 0) {
                visible = false;
            }

            row.style.display = visible ? '' : 'none';
        });
    };

    return (
        <FilterPanel
            filters={filters}
            onChange={setFilters}
            title="RARBG Filter"
        />
    );
};
