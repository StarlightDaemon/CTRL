# Tech Stack

Package `ctrl-extension` `0.2.0-beta.1` (`type: module`). Source under `extension/`.

## Framework / build
- **WXT** `0.19.29` — browser-extension framework (Vite under the hood), MV3,
  Chrome + Firefox.
- **Vite plugins:** `@vitejs/plugin-react` (Babel decorators), `vite-plugin-react-inspector` (dev).
- **TypeScript** `5.7.2` — strict; decorators on; ESNext / `moduleResolution: Bundler`;
  `@/*` alias. See `mem:conventions`.

## UI
- **React** / **React-DOM** `18.2.0`.
- **IBM Carbon:** `@carbon/react ^1.100.0`, `@carbon/styles ^1.99.0`,
  `@carbon/icons-react ^11.74.0`, `@ibm/plex ^6.4.1` (g100 dark theme).
- `@tanstack/react-virtual 3.13.12` (virtualized torrent list), `lucide-react 0.555.0`,
  `clsx 2.1.1`, `tailwind-merge 3.4.0`, `tailwindcss 3.4.3`.

## State / DI / validation
- **Zustand** `5.0.9` (no middleware).
- **tsyringe** `4.10.0` + **reflect-metadata** `0.2.2` (DI).
- **Zod** `3.23.8` (schema validation).
- `txml 5.2.1` (XML parsing for XML-RPC clients such as ruTorrent).

## Testing
- **Vitest** `4.0.15` (jsdom), `@webext-core/fake-browser`, `jsdom 27.3.0`.
- **Playwright** `@playwright/test 1.57.0` (Chromium).

See `mem:suggested_commands` for scripts, `mem:conventions` for config detail.
