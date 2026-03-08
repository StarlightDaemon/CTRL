/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/**/*.{html,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Carbon Layer Tokens
                background: 'var(--cds-background)',
                'layer-01': 'var(--cds-layer-01)',
                'layer-02': 'var(--cds-layer-02)',
                'layer-03': 'var(--cds-layer-03)',
                'layer-selected': 'var(--cds-layer-selected)',
                'layer-selected-hover': 'var(--cds-layer-selected-hover)',

                // Carbon Text Tokens
                'text-primary': 'var(--cds-text-primary)',
                'text-secondary': 'var(--cds-text-secondary)',
                'text-helper': 'var(--cds-text-helper)',
                'text-placeholder': 'var(--cds-text-placeholder)',
                'text-on-color': 'var(--cds-text-on-color)',
                'text-disabled': 'var(--cds-text-disabled)',
                'text-error': 'var(--cds-text-error)',

                // Carbon Border Tokens
                'border-subtle': 'var(--cds-border-subtle)',
                'border-strong': 'var(--cds-border-strong)',
                'border-interactive': 'var(--cds-border-interactive)',

                // Carbon Interactive Tokens
                'interactive': 'var(--cds-interactive)',
                'interactive-hover': 'var(--cds-interactive-hover)',

                // Carbon Link Tokens
                'link-primary': 'var(--cds-link-primary)',
                'link-primary-hover': 'var(--cds-link-primary-hover)',

                // Semantic/Status Colors (Mapped to Carbon Support Tokens)
                'status-success': 'var(--cds-support-success)',
                'status-warning': 'var(--cds-support-warning)',
                'status-error': 'var(--cds-support-error)',
                'status-info': 'var(--cds-support-info)',
            },
            fontFamily: {
                sans: ['var(--cds-font-family-sans)'], // Fixed to use correct Carbon var
                mono: ['var(--cds-font-family-mono)'], // Carbon uses mono font var too usually, but we keep custom if needed. Let's assume defaults.
            },
            animation: {
                shimmer: 'shimmer 2s infinite linear',
            },
        },
    },
    plugins: [],
}
