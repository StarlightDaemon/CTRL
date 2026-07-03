# CTRL — Project Overview

CTRL is a TypeScript/React browser extension for managing remote torrent clients
from the browser toolbar. Package `ctrl-extension`, version `0.2.0-beta.1`. Built
with the **WXT** framework (`0.19.29`) targeting **Chrome and Firefox as Manifest V3**
extensions. UI is **React 18 + IBM Carbon Design System** (g100 dark theme).

**Purpose:** connect to a user's self-hosted torrent client (one of 10 supported)
and provide a unified popup + full options-page dashboard to list, add,
pause/resume, remove, categorize, and tag torrents — with encrypted credential
storage (the "vault").

## Source layout — Feature-Sliced Design (`extension/src/`)
- `app/` — React providers + global styles.
- `entities/` — core domain models: `client` (the `ITorrentClient` interface +
  `ClientFactory`), `server` (`ServerConfig` connection profile), `torrent`
  (`Torrent` model + `TorrentRow` UI). See `mem:architecture`.
- `entrypoints/` — WXT entrypoints: `background.ts` (MV3 service worker /
  coordination hub), `popup/` (toolbar popup), `options/` (full options page).
- `features/torrent-control/` — the main feature: hooks
  (`model/useSettings|useTorrentPoller|useVault`), services (`LifecycleAdapter`,
  `StateHydrator`, `ViewportManager`), and UI (Dashboard, dialogs, settings panels).
- `shared/` — cross-cutting layer. `shared/api/clients/` holds the **10
  torrent-client adapters** + shared error infra; `shared/lib/retry/` holds
  `withAdapterRetry`; plus `shared/api/{network,security,server,storage}` and UI
  primitives/utils. See `mem:adapters`.
- `stores/` — Zustand state (`useTorrentStore`). See `mem:architecture`.

**IMPORTANT:** the 9 adapters live under `shared/api/clients/`, NOT under
`features/torrent-control/`. `features/torrent-control/` is the feature layer
(hooks + services + UI) that consumes them.

Tests: `extension/tests/unit/` (Vitest, 539 passing) and `extension/tests/e2e/`
(Playwright). See `mem:conventions`.

## Governance & status
`.raiden/state/` holds a planning/governance layer (CURRENT_STATE, GOALS,
OPEN_LOOPS, DECISIONS). Project is in **Phase 2 "Technical Excellence"**,
Beta/stabilization, tracking toward a v1.0 Chrome Web Store + Firefox AMO release.
**OL-001** (adapter error handling) closed 2026-06-18; no open loops remain.
Note (verified 2026-07-01): the OL-001 commits (`2246e00`…`8d3d790`) ARE on
`origin/main`; an older RAIDEN note reading "not yet pushed" is stale.

Related: `mem:adapters`, `mem:architecture`, `mem:conventions`, `mem:tech_stack`,
`mem:suggested_commands`.
