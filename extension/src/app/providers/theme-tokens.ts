export type ThemeName = 'linux' | 'glass' | 'linear';

export const baseTokens = {
    fonts: {
        sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    radii: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
    },
};

export const themeTokens = {
    linux: {
        colors: {
            background: '0 0% 12%', // #1e1e1e - Deep Gray
            panel: '0 0% 16%',      // #292929 - Lighter Gray
            surface: '0 0% 20%',    // #333333 - Surface
            border: '0 0% 30%',     // #4d4d4d - Distinct Border
            hover: '0 0% 25%',      // #404040 - Hover State
            primary: '210 100% 50%', // #007bff - Standard Blue
            text: {
                primary: '0 0% 90%',   // #e5e5e5
                secondary: '0 0% 70%', // #b3b3b3
                muted: '0 0% 50%',     // #808080
            }
        },
        effects: {
            blur: '0',
            glass: 'none',
            border: '1px solid var(--border)',
            shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
        }
    },
    glass: {
        colors: {
            background: '0 0% 0%',      // Black (for overlay)
            panel: '0 0% 100%',         // White (opacity controlled by alpha)
            surface: '0 0% 100%',
            hover: '0 0% 100%',         // White (opacity controlled by alpha)
            border: '0 0% 100%',
            primary: '210 100% 50%',
            text: {
                primary: '0 0% 100%',
                secondary: '0 0% 80%',
                muted: '0 0% 60%',
            }
        },
        effects: {
            blur: '12px',
            glass: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        }
    },
    linear: {
        colors: {
            background: '0 0% 8%',      // #141414 - Very Dark
            panel: '0 0% 12%',          // #1f1f1f
            surface: '0 0% 15%',        // #262626
            hover: '0 0% 20%',          // #333333
            border: '0 0% 20%',         // #333333 - Subtle
            primary: '270 100% 60%',    // #9f2b68 - Purple/Pink gradient capability
            text: {
                primary: '0 0% 95%',
                secondary: '0 0% 65%',
                muted: '0 0% 45%',
            }
        },
        effects: {
            blur: '0',
            glass: 'none',
            border: '1px solid var(--border)',
            shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        }
    }
};
