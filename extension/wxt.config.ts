import { defineConfig } from 'wxt';
import path from 'path';
import packageJson from './package.json';
import react from '@vitejs/plugin-react';
import Inspector from 'vite-plugin-react-inspector';

export default defineConfig({
  srcDir: 'src',
  // WXT 0.20 changed the default publicDir from `<srcDir>/public` to
  // `<rootDir>/public`; pin the old location where _locales lives.
  publicDir: 'src/public',
  outDir: 'builds',
  manifest: (env) => {
    const permissions = ['storage', 'contextMenus', 'notifications', 'activeTab', 'alarms', 'scripting'];

    // Normalize version for Chrome compatibility (e.g., "0.2.0-beta.1" -> "0.2.0.1")
    const [baseVersion, preRelease] = packageJson.version.split('-');
    let numericVersion = baseVersion;
    if (preRelease) {
      const parts = preRelease.split('.');
      const suffix = parts[parts.length - 1];
      numericVersion = /^\d+$/.test(suffix) ? `${baseVersion}.${suffix}` : `${baseVersion}.0`;
    }

    return {
      name: `CTRL v${packageJson.version}`,
      description: 'Manage your torrents from the browser',
      version: numericVersion,
      version_name: packageJson.version,
      default_locale: 'en',
      permissions: permissions,
      optional_host_permissions: [
        'http://*/*',
        'https://*/*',
        'ws://*/*',
        'wss://*/*',
      ],

      action: {
        default_title: 'Torrent Control',
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
      content_security_policy: {
        extension_pages: "script-src 'self'; object-src 'self'; connect-src http: https: ws: wss:;",
      },

    };
  },
  vite: (env) => {
    const isDev = env.mode === 'development';

    return {
      plugins: [
        // Only include Inspector in development
        ...(isDev ? [Inspector({
          toggleButtonVisibility: 'never',
        })] : []),
        react({
          babel: {
            plugins: [
              ['@babel/plugin-proposal-decorators', { legacy: true }],
              ['react-component-data-attribute', { onlyRootComponents: false }]
            ]
          }
        })
      ],
      build: {
        // Disable sourcemaps in production
        sourcemap: isDev,
        // Enable minification in production
        minify: !isDev,
      },
      define: {
        __UI_DEBUG_MODE__: JSON.stringify(isDev),
        __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
        __APP_VERSION__: JSON.stringify(packageJson.version),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    };
  },
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      if (manifest.options_ui) {
        manifest.options_ui.open_in_tab = true;
      }
    },
  },
});
