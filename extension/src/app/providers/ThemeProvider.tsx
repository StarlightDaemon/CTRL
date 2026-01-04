import React, { createContext, useContext, useEffect, useState } from 'react';
import { themeTokens, baseTokens, ThemeName } from './theme-tokens';

interface ThemeContextType {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: React.ReactNode;
    initialTheme?: ThemeName;
    mode?: 'global' | 'scoped';
}

export const PrismThemeProvider: React.FC<ThemeProviderProps> = ({
    children,
    initialTheme = 'linux',
    mode = 'global'
}) => {
    const [theme, setTheme] = useState<ThemeName>(initialTheme);

    // Load saved theme on mount
    useEffect(() => {
        chrome.storage.local.get(['appearance'], (result) => {
            if (result.appearance?.theme) {
                setTheme(result.appearance.theme as ThemeName);
            }
        });

        // Listen for changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.appearance?.newValue?.theme) {
                setTheme(changes.appearance.newValue.theme as ThemeName);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Generate CSS Variables Object
    const getCssVars = (themeName: ThemeName) => {
        const tokens = themeTokens[themeName];
        return {
            '--bg-background': tokens.colors.background,
            '--bg-panel': tokens.colors.panel,
            '--bg-surface': tokens.colors.surface,
            '--bg-border': tokens.colors.border,
            '--bg-hover': tokens.colors.hover,
            '--bg-primary': tokens.colors.primary,

            '--text-primary': tokens.colors.text.primary,
            '--text-secondary': tokens.colors.text.secondary,
            '--text-muted': tokens.colors.text.muted,

            '--effect-blur': tokens.effects.blur,
            '--effect-glass': tokens.effects.glass,
            '--effect-border': tokens.effects.border,
            '--effect-shadow': tokens.effects.shadow,

            '--font-sans': baseTokens.fonts.sans,
            '--font-mono': baseTokens.fonts.mono,

            '--radius-sm': baseTokens.radii.sm,
            '--radius-md': baseTokens.radii.md,
            '--radius-lg': baseTokens.radii.lg,
            '--radius-xl': baseTokens.radii.xl,
            '--radius-full': baseTokens.radii.full,
        } as React.CSSProperties;
    };

    // Inject CSS Variables for Global Mode
    useEffect(() => {
        if (mode === 'global') {
            const root = document.documentElement;
            const vars = getCssVars(theme);
            Object.entries(vars).forEach(([key, value]) => {
                if (value) root.style.setProperty(key, value as string);
            });
        }
    }, [theme, mode]);

    // Also sync current theme to storage when changed via context
    const handleSetTheme = (newTheme: ThemeName) => {
        setTheme(newTheme);
        chrome.storage.local.get(['appearance'], (result) => {
            const current = result.appearance || {};
            chrome.storage.local.set({
                appearance: { ...current, theme: newTheme }
            });
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme }}>
            {mode === 'scoped' ? (
                <div style={getCssVars(theme)} className="w-full h-full text-text-primary bg-transparent font-sans">
                    {children}
                </div>
            ) : (
                children
            )}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a PrismThemeProvider');
    }
    return context;
};
