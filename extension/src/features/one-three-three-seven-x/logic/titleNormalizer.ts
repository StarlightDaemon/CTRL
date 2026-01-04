export const normalizeTitles = () => {
    const rows = document.querySelectorAll('.table-list tbody tr');

    rows.forEach((row) => {
        const titleLink = row.querySelector('td.name a:nth-child(2)'); // 2nd anchor is usually the title
        if (titleLink) {
            let text = titleLink.textContent || '';
            // 1337x specific garbage removal
            text = text.replace(/torrent/gi, '')
                .replace(/download/gi, '')
                .replace(/1337x/gi, '')
                .trim();

            // Remove trailing punctuation
            text = text.replace(/[|\-]+\s*$/, '').trim();

            titleLink.textContent = text;
        }
    });
};
