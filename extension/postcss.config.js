import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/**
 * Drop every `@font-face` whose `src` points at a remote origin.
 *
 * `@carbon/styles/css/styles.css` declares IBM Plex via IBM's font CDN
 * (1.www.s81c.com). CTRL ships no remote resources and its CSP has
 * `font-src 'self'`, so those rules could only fail; removing them at build
 * time keeps the package free of third-party URLs. Carbon's type tokens are
 * remapped to system fonts in src/entrypoints/style.css.
 */
const stripRemoteFontFaces = () => ({
    postcssPlugin: 'ctrl-strip-remote-font-faces',
    AtRule: {
        'font-face': (rule) => {
            let remote = false;
            rule.walkDecls('src', (decl) => {
                if (/url\(\s*["']?(?:https?:)?\/\//i.test(decl.value)) remote = true;
            });
            if (remote) rule.remove();
        },
    },
});
stripRemoteFontFaces.postcss = true;

export default {
    plugins: [tailwindcss(), autoprefixer(), stripRemoteFontFaces()],
};
