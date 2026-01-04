/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./src/**/*.{html,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: 'hsl(var(--bg-background) / <alpha-value>)',
                panel: 'hsl(var(--bg-panel) / <alpha-value>)',
                surface: 'hsl(var(--bg-surface) / <alpha-value>)',
                hover: 'hsl(var(--bg-hover) / <alpha-value>)',
                border: 'hsl(var(--bg-border) / <alpha-value>)',

                primary: 'hsl(var(--bg-primary) / <alpha-value>)',
                secondary: 'hsl(var(--bg-primary) / 0.8)', // Fallback or derived? Let's use text vars for text colors

                'text-primary': 'hsl(var(--text-primary) / <alpha-value>)',
                'text-secondary': 'hsl(var(--text-secondary) / <alpha-value>)',
                'text-muted': 'hsl(var(--text-muted) / <alpha-value>)',

                // Retain existing functional colors if needed, or map them
                'accent-primary': 'hsl(var(--bg-primary) / <alpha-value>)',
                'status-success': '#22c55e', // Hardcoded for now or add to tokens
                'status-warning': '#eab308',
                'status-error': '#ef4444',
            },
            fontFamily: {
                sans: ['var(--font-sans)'],
                mono: ['var(--font-mono)'],
            },
            animation: {
                shimmer: 'shimmer 2s infinite linear',
            },
        },
    },
    plugins: [],
}
