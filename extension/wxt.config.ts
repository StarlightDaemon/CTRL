import { defineConfig } from 'wxt';
import path from 'path';
import packageJson from './package.json';
import react from '@vitejs/plugin-react';
import Inspector from 'vite-plugin-react-inspector';

export default defineConfig({
  srcDir: 'src',
  outDir: 'builds',
  manifest: (env) => {
    const permissions = ['storage', 'contextMenus', 'notifications', 'activeTab', 'downloads', 'alarms', 'cookies', 'declarativeNetRequest'];

    // Chrome requires 'offscreen' for Keep-Alive
    if (env.browser === 'chrome') {
      permissions.push('offscreen');
    }

    return {
      name: `CTRL v${packageJson.version}`,
      description: 'Manage your torrents from the browser',
      version: packageJson.version,
      default_locale: 'en',
      permissions: permissions,
      optional_host_permissions: ['<all_urls>'],
      protocol_handlers: [
        {
          protocol: 'magnet',
          name: 'Torrent Control',
          uriTemplate: 'options.html?magnet=%s'
        }
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
        extension_pages: "script-src 'self'; object-src 'self'; connect-src * data: blob: filesystem:;",
      },
      web_accessible_resources: [
        {
          resources: ['popup.html', 'options.html'],
          matches: ['<all_urls>'],
        },
        {
          resources: ['/style.css'], // Our compiled CSS for shadow DOM
          matches: ['*://torrentgalaxy.to/*', '*://proxygalaxy.me/*'], // Add proxies as needed
        }
      ],
    };
  },
  vite: () => ({
    plugins: [
      Inspector({
        toggleButtonVisibility: 'never', // We'll trigger it via our own overlay if needed, or just use the attributes
      }),
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
      sourcemap: true,
      minify: false,
    },
    define: {
      __UI_DEBUG_MODE__: JSON.stringify(true),
      __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }),
  hooks: {
    'build:manifestGenerated': (wxt, manifest) => {
      if (manifest.options_ui) {
        manifest.options_ui.open_in_tab = true;
      }
    },
  },
});
