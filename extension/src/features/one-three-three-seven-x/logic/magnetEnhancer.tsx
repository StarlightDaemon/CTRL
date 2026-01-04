import React from 'react';
import { createRoot } from 'react-dom/client';
import { MagnetButton } from '../../site-integrations/shared/components/MagnetButton';

export const enhanceMagnetLinks = () => {
    const rows = document.querySelectorAll('.table-list tbody tr');

    rows.forEach((row) => {
        // Prevent double injection
        if (row.querySelector('.ctrl-magnet-container')) return;

        const nameCell = row.querySelector('td.name');
        if (!nameCell) return;

        const titleLink = nameCell.querySelectorAll('a')[1] as HTMLAnchorElement; // 0 is icon, 1 is title usually
        if (!titleLink || !titleLink.href.includes('/torrent/')) return;

        // 1337x logic: We need to fetch the magnet link from the detail page because it's not in the list view DOM
        // OR we just provide a button that "Gets" it on click (optimistic / fetch on demand)
        // Previous vanilla logic did fetch on click.

        // Inject Container
        // We'll put it before the name or replacing the icon?
        // Let's put it as a new column or modify the icon column?
        // The old script inserted a cell. But standard table layout might break if we add cells but headers don't match.
        // Let's append to the seeds/leeches or just append to name cell?
        // Safest is to append to the name cell div or similar.

        // 1337x 'td.name' contains icons and links.

        const container = document.createElement('span');
        container.className = 'ctrl-magnet-container';
        container.style.display = 'inline-block';
        container.style.marginRight = '8px';
        container.style.verticalAlign = 'middle';

        // Insert at beginning of name cell
        nameCell.insertBefore(container, nameCell.firstChild);

        // Render Button
        // We pass a "fetcher" or just the URL? 
        // MagnetButton expects a 'magnet' string.
        // But we don't have it yet.
        // We need a wrapper that fetches it.
        // Wait, MagnetButton is simple. We need a "FetchAndAddButton"?
        // Or we can pre-fetch? No, too many requests.
        // Let's create a wrapper here.

        const root = createRoot(container);
        root.render(<AsyncMagnetButton detailUrl={titleLink.href} />);
    });
};

const AsyncMagnetButton = ({ detailUrl }: { detailUrl: string }) => {
    const [magnet, setMagnet] = React.useState<string | null>(null);
    const [status, setStatus] = React.useState<'idle' | 'fetching' | 'error'>('idle');

    // We can't use the shared MagnetButton 'onSuccess' perfectly because we need to get the magnet first.
    // So we wrap the shared button?
    // Or we modify MagnetButton to accept a promise?
    // Let's implement a specific wrapper.

    const handleFetch = async () => {
        if (magnet) return; // Already have it

        setStatus('fetching');
        try {
            const response = await fetch(detailUrl);
            const text = await response.text();
            const doc = new DOMParser().parseFromString(text, 'text/html');
            // 1337x magnet class often includes 'flaticon-magnet'
            // Usually simple anchor with magnet: protocol
            const magnetLink = doc.querySelector('a[href^="magnet:"]');

            if (magnetLink && magnetLink instanceof HTMLAnchorElement) {
                setMagnet(magnetLink.href);
                // Auto-click it? Or just let user click again?
                // Ideally we just trigger the "Add" right away.
                // But MagnetButton requires a string prop.
                setStatus('idle');
            } else {
                setStatus('error');
            }
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    // If we have magnet, show the shared button
    if (magnet) {
        // Auto-trigger add? 
        // We can render a MagnetButton that we click programmatically?
        // Better: Just use MagnetButton. it auto-adds on click? No it takes a magnet string and adds it on click.
        // If we want "One Click" experience: User clicks -> Fetch -> Add.
        // The current shared MagnetButton doesn't support async generator.

        return <MagnetButton magnet={magnet} />;
    }

    // Default "Fetch" button state
    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleFetch();
            }}
            className="ctrl-debrid-btn bg-orange-600 hover:bg-orange-700 text-white rounded p-1 transition-all flex items-center justify-center h-6 w-6 shadow-sm"
            title="Fetch Magnet"
        >
            {status === 'fetching' ? (
                <span className="animate-spin text-[10px]">↻</span>
            ) : status === 'error' ? (
                <span className="text-[10px]">✕</span>
            ) : (
                <span className="text-[10px]">⚡</span>
            )}
        </button>
    );
};
