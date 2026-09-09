import { defineConfig } from 'wxt';
import path from 'path';
import packageJson from './package.json';
import react from '@vitejs/plugin-react';

/**
 * Permanent Firefox add-on identity. AMO binds signing to this id from the
 * first submission onward; it must never change. GUID form is used so the id
 * does not assert ownership of a domain.
 */
export const GECKO_ADDON_ID = '{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}';

/** Browser floors. See docs/release/v1/V1_SCOPE.md §2. */
export const MINIMUM_CHROME_VERSION = '120';
export const MINIMUM_FIREFOX_VERSION = '140.0';

/**
 * Store manifests only accept dotted integers. `1.0.0` stays `1.0.0`;
 * a pre-release such as `1.0.0-rc.2` becomes `1.0.0.2` so it sorts before
 * the final `1.0.0` build in neither store (both compare `1.0.0.2 > 1.0.0`),
 * which is why pre-release tags are only used for internal builds.
 */
export function toManifestVersion(version: string): string {
  const [base, preRelease] = version.split('-');
  if (!preRelease) return base;
  const suffix = preRelease.split('.').pop() ?? '';
  return /^\d+$/.test(suffix) ? `${base}.${suffix}` : `${base}.0`;
}

export default defineConfig({
  srcDir: 'src',
  // WXT 0.20 changed the default publicDir from `<srcDir>/public` to
  // `<rootDir>/public`; pin the old location where _locales lives.
  publicDir: 'src/public',
  outDir: 'builds',
  zip: {
    // The reviewer source archive is produced by scripts/zip-source.ts from a
    // clean git tree. WXT's automatic "-sources.zip" would sweep in local
    // artefacts (backups, logs, reports), so it is disabled for every target.
    zipSources: false,
  },
  manifest: (env) => {
    const isFirefox = env.browser === 'firefox';
    const version = toManifestVersion(packageJson.version);

    return {
      name: 'CTRL - Torrent Control',
      short_name: 'CTRL',
      description: 'Send magnet links to your own BitTorrent client and control its queue from the browser.',
      version,
      ...(isFirefox ? {} : { version_name: packageJson.version, minimum_chrome_version: MINIMUM_CHROME_VERSION }),
      default_locale: 'en',
      permissions: ['storage', 'contextMenus', 'notifications', 'alarms'],
      optional_host_permissions: ['http://*/*', 'https://*/*'],
      action: {
        default_title: 'CTRL',
        default_popup: 'popup.html',
        default_icon: {
          '16': 'icon/default-16.png',
          '32': 'icon/default-32.png',
          '48': 'icon/default-48.png',
          '64': 'icon/default-64.png',
          '128': 'icon/default-128.png',
        },
      },
      icons: {
        '16': 'icon/default-16.png',
        '32': 'icon/default-32.png',
        '48': 'icon/default-48.png',
        '64': 'icon/default-64.png',
        '128': 'icon/default-128.png',
      },
      options_ui: {
        page: 'options.html',
        open_in_tab: true,
      },
      // No remote code, no remote resources. `connect-src http:` is required
      // because users run torrent clients over plain HTTP on their LAN.
      // Firefox's default MV3 policy adds upgrade-insecure-requests, which
      // would silently break those clients, so the policy is explicit here.
      content_security_policy: {
        extension_pages:
          "default-src 'self'; script-src 'self'; object-src 'none'; connect-src http: https:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; base-uri 'none'; form-action 'none';",
      },
      ...(isFirefox
        ? {
          browser_specific_settings: {
            gecko: {
              id: GECKO_ADDON_ID,
              strict_min_version: MINIMUM_FIREFOX_VERSION,
              // Credentials the user enters are transmitted to the user's own
              // torrent client. Mozilla's taxonomy classifies that as
              // authentication information leaving the extension.
              data_collection_permissions: {
                required: ['authenticationInfo'],
              },
            },
          },
        }
        : {}),
    };
  },
  vite: (env) => {
    const isDev = env.mode === 'development';

    return {
      plugins: [react()],
      build: {
        // Disable sourcemaps in production
        sourcemap: isDev,
        // Enable minification in production
        minify: !isDev,
      },
      define: {
        __UI_DEBUG_MODE__: JSON.stringify(isDev),
        __APP_VERSION__: JSON.stringify(packageJson.version),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    };
  },
});
