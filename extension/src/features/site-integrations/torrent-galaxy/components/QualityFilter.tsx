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
        const saved = localStorage.getItem('ctrl-tgx-filter');
        if (saved) {
            try {
                setFilters(JSON.parse(saved));
            } catch (e) { console.error('Failed to load filters', e) }
        }
    }, []);

    // Save to localStorage & Apply Filters
    useEffect(() => {
        localStorage.setItem('ctrl-tgx-filter', JSON.stringify(filters));
        applyToDOM();
    }, [filters]);

    const applyToDOM = () => {
        const rows = document.querySelectorAll('.tgxtablerow');

        rows.forEach((row: any) => {
            const titleElement = row.querySelector('.tgxtablecell a[title], .tgxtablecell b');
            const title = titleElement ? titleElement.innerText : '';
            const seedersElement = row.querySelector('span[title^="Seeders/Leechers"] font b');
            const seeders = seedersElement ? parseInt(seedersElement.innerText, 10) : 0;

            const metadata = extractMetadata(title);
            let visible = true;

            // 1. Resolution Filter (if active, must match at least one)
            if (filters.resolution.length > 0) {
                if (!metadata.resolution || !filters.resolution.includes(metadata.resolution)) {
                    visible = false;
                }
            }

            // 2. Codec Filter (if active, must match at least one)
            if (filters.codec.length > 0 && visible) {
                if (!metadata.codec || !filters.codec.includes(metadata.codec)) {
                    visible = false;
                }
            }

            // 3. Dead Filter
            if (filters.hideDead && seeders === 0) {
                visible = false;
            }

            // Apply visibility
            row.style.display = visible ? '' : 'none';
        });
    };

    return (
        <FilterPanel
            filters={filters}
            onChange={setFilters}
            title="TGx Filter"
        />
    );
};

