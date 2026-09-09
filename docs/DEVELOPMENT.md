# CTRL Development Guide

## Prerequisites

- Node.js 24 (see `.nvmrc`; 22 also works) and npm 11
- Chrome and/or Firefox for manual testing
- For the live verification harness (optional): Windows, 7-Zip, and the
  installed release browsers — see `extension/tests/live/README.md`

## Quick start

```bash
cd extension
npm ci                 # exact dependencies from package-lock.json
npm run dev            # WXT dev build for Chrome with reload
npm run dev:firefox    # same for Firefox
```

## Commands

| Command | Description |
|---|---|
| `npm run compile` | TypeScript type check |
| `npm run lint` | ESLint over `src` |
| `npm test` | Vitest unit and component tests (jsdom, React Testing Library) |
| `npm run build:chrome` / `build:firefox` | Production builds into `builds/chrome-mv3` and `builds/firefox-mv3` |
| `npm run zip:chrome` / `zip:firefox` | Build and zip a package |
| `npm run build-for-amo` | The Firefox package exactly as submitted (used by Mozilla's rebuild) |
| `npm run zip:source` | Reviewer source archive from a clean git tree (`builds/source/`) |
| `npm run test:e2e` | Playwright smoke tests (Chromium) |
| `npm run live:env …` | Disposable torrent-client environment (see below) |
| `npm run live:verify …` | Live client × browser verification matrix |

Reproducible-build details for reviewers: [`extension/BUILD.md`](../extension/BUILD.md).

## Project structure

```
extension/src/
├── app/styles      # single stylesheet (Carbon + Tailwind tokens; remote fonts stripped at build time)
├── entrypoints/    # background (controller, badge, context menus), options, popup
├── features/       # torrent-control: UI (server form, dashboard, settings), model (settings, vault, forms), services (TorrentController)
├── entities/       # domain models: client factory, server identity, torrent
└── shared/         # adapters (api/clients), transport (api/network), vault (api/security), messaging protocol, lib
```

Key modules:

- `features/torrent-control/services/TorrentController.ts` — the single owner of background state: polling with generation checks, id-keyed snapshots, per-server command routing, connection state.
- `shared/api/messaging/protocol.ts` — the port and message protocol between background and UI.
- `shared/api/security/VaultService.ts` — encrypted server vault (PBKDF2 + AES-GCM envelope), legacy migration, fail-closed handling.
- `shared/lib/endpoint.ts` and `features/torrent-control/model/serverForm.ts` — address parsing and the server form model.
- `shared/lib/permissions.ts` — optional host permission patterns (Chrome keeps the port, Firefox cannot).
- `shared/api/network/HeaderRewriter.ts` — the per-server `Origin`/`Referer` rule qBittorrent needs.
- `shared/lib/constants.ts` — `CLIENT_LIST` with the v1 status of each adapter (`candidate` = offered, `experimental` = hidden but loadable).

## Loading a build manually

- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → `extension/builds/chrome-mv3`.
- **Firefox**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `extension/builds/firefox-mv3/manifest.json`.

Debugging: background service worker from `chrome://extensions` (Chrome) or `about:debugging` (Firefox); popup via right-click → Inspect.

## Tests

### Unit and component tests

```bash
cd extension
npm test
```

Vitest with jsdom and `@webext-core/fake-browser`. Component tests use React
Testing Library. Notes: Carbon `TextInput` renders an empty `role="alert"`
announcer (query notifications by text), Carbon danger buttons carry a
hidden "danger" prefix in their accessible name, and `chrome.permissions` /
`runtime.sendMessage` are stubbed per test (`tests/unit/ui/browserStubs.ts`).

### Live verification (real browsers, real clients)

`extension/tests/live/` contains a disposable environment (upstream
Transmission, qBittorrent and aria2 binaries, pinned by hash, run with
temporary configuration) and two runners that drive the built extension in
stock Chrome and Firefox:

```bash
cd extension
npm run build:chrome && npm run build:firefox
node tests/live/env.mjs fetch && node tests/live/env.mjs extract && node tests/live/env.mjs start all
node tests/live/verify.mjs --client transmission --browser chrome         # client matrix (16 scenarios)
node tests/live/verify-state.mjs --browser firefox --headless             # state/vault invariants (17 scenarios)
node tests/live/env.mjs clean
```

Evidence lands in `docs/release/v1/evidence/`. See `extension/tests/live/README.md`
for provenance, ports, credentials, the browser harness design and its limits.

## Workflow

1. Branch from `main`.
2. Keep changes narrow; add or update tests with the change.
3. `npm run compile && npm run lint && npm test`, then build both targets.
4. If adapter, transport or controller code changed, re-run the affected live
   matrix cells and refresh the evidence.
5. Conventional commit messages; no `Co-Authored-By` trailers (enforced by the
   repository's commit hook).
