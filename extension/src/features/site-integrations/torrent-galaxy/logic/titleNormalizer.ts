import { extractMetadata } from '../../shared/logic/metadataParser';

export const normalizeTitles = () => {
    // Selectors based on TGx structure
    const titleElements = document.querySelectorAll('.tgxtablecell a[href^="/torrent/"] b');

    titleElements.forEach((el) => {
        if (el.getAttribute('data-ctrl-normalized')) return;
        el.setAttribute('data-ctrl-normalized', 'true');

        let text = el.textContent || '';
        const originalText = text;

        // Extract metadata before cleaning
        const meta = extractMetadata(text);

        // 1. Remove "TGx:" prefix
        text = text.replace(/^TGx:\s*/i, '');

        // 2. Replace periods with spaces
        text = text.replace(/\./g, ' ');

        // 3. Remove known metadata strings from the title to "clean" it
        // (Optional: can be aggressive or safe. Let's be safe and just fix spacing)
        text = text.replace(/\s{2,}/g, ' ').trim();

        el.textContent = text;

        // 4. Inject Badges
        const parent = el.parentElement;
        if (!parent) return;

        // Create a wrapper for badges if it doesn't exist
        let badgeContainer = parent.querySelector('.ctrl-badges');
        if (!badgeContainer) {
            badgeContainer = document.createElement('span');
            badgeContainer.className = 'ctrl-badges ml-2 inline-flex gap-1 align-middle';
            parent.appendChild(badgeContainer);
        }

        // Helper to create badge
        const createBadge = (text: string, colorClass: string) => {
            const span = document.createElement('span');
            span.className = `px-1.5 py-0.5 text-[0.65rem] font-bold rounded ${colorClass} uppercase tracking-wider`;
            span.textContent = text;
            return span;
        };

        if (meta.resolution) {
            const color = meta.resolution === '4K' ? 'bg-purple-900 text-purple-200' :
                meta.resolution === '1080p' ? 'bg-green-900 text-green-200' :
                    'bg-slate-700 text-slate-300';
            badgeContainer.appendChild(createBadge(meta.resolution, color));
        }

        if (meta.codec) {
            const color = meta.codec === 'x265' || meta.codec === 'AV1' ? 'bg-blue-900 text-blue-200' : 'bg-slate-700 text-slate-300';
            badgeContainer.appendChild(createBadge(meta.codec, color));
        }

        if (meta.audio) {
            badgeContainer.appendChild(createBadge(meta.audio, 'bg-amber-900 text-amber-200'));
        }
    });
};

