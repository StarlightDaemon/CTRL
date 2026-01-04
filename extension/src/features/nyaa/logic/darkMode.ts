export const handleDarkMode = () => {
    // Basic dark mode toggle based on system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
        document.body.classList.add('dark');

        if (!document.getElementById('ctrl-dark-mode')) {
            const style = document.createElement('style');
            style.id = 'ctrl-dark-mode';
            style.textContent = `
                body { background-color: #121212 !important; color: #e0e0e0 !important; }
                .container { background-color: #1e1e1e !important; }
                table { background-color: #1e1e1e !important; color: #e0e0e0 !important; }
                table tr { background-color: #1e1e1e !important; }
                table tr:hover { background-color: #2a2a2a !important; }
                a { color: #64b5f6 !important; }
                a:visited { color: #ba68c8 !important; }
                .navbar { background-color: #212121 !important; border-bottom: 1px solid #333 !important; }
                .panel { background-color: #1e1e1e !important; border-color: #333 !important; }
                .panel-heading { background-color: #2a2a2a !important; border-color: #333 !important; color: #e0e0e0 !important; }
                .panel-body { background-color: #1e1e1e !important; }
                .footer { background-color: #212121 !important; color: #9e9e9e !important; }
                input, select, textarea { background-color: #333 !important; color: #fff !important; border: 1px solid #555 !important; }
            `;
            document.head.appendChild(style);
        }
    } else {
        const style = document.getElementById('ctrl-dark-mode');
        if (style) style.remove();
    }
};
