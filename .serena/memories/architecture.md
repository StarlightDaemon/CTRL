# Architecture — FSD layers, entrypoints, state flow

## FSD layers (`extension/src/`)
- `app/` — React providers + global styles.
- `entities/` — domain models (each with `model/`, plus `ui/`/`lib/` where relevant):
  - `client` — `ITorrentClient` interface (`model/`) + `ClientFactory` (`lib/`) +
    `AddTorrentOptions`.
  - `server` — `ServerConfig` (`model/types.ts`): name, application/type, hostname,
    credentials, directories, adapter-specific `clientOptions`, httpAuth,
    showInContextMenu.
  - `torrent` — `Torrent` model + `TorrentStatus` union
    (`downloading|seeding|paused|completed|error|checking|queued|stalled|unknown`)
    + `TorrentRow` (memoized virtualized-list row).
- `entrypoints/` — WXT entrypoints (below).
- `features/torrent-control/` — the feature: `model/` hooks, `services/`, `ui/`.
- `shared/` — cross-cutting: `api/clients/` (9 adapters, see `mem:adapters`),
  `api/{network,security,server,storage}`, `lib/retry/`, UI primitives, utils.
- `stores/` — Zustand `useTorrentStore`.

## WXT entrypoints
- **`background.ts`** — MV3 service worker + coordination hub. Bootstraps
  `ClientFactory`/`ServerResolver`, `ContextMenuService`, `ViewportManager`,
  `StateHydrator`, and `LifecycleAdapter.initKeepAlive`. **Dual-rate poll:** fast
  2000ms polling while a UI port is connected (`chrome.runtime.onConnect` name
  `ctrl-active-session`), ~1-min alarm heartbeat otherwise. Handles messages:
  `GET_TORRENTS`, `ADD_TORRENT_URL`, `PAUSE/RESUME/REMOVE_TORRENT`,
  `TEST_CONNECTION(_SERVER)`, `PING(_SERVER)`, `FORCE_REFRESH`, `UPDATE_VIEWPORT`,
  `SELF_TEST`. `performCheck()` resolves the active client, fetches torrents,
  updates ViewportManager + toolbar badge, broadcasts `STATS_UPDATE`.
  `ServerResolver` returns a `ResolutionState`
  (`OK|LOCKED|UNINITIALIZED|NO_ACTIVE_SERVER|INVALID_CONFIG`).
- **`popup/`** — compact 3-tab toolbar popup (Control / Settings / Debug) in Carbon
  g100. Control renders the torrent Dashboard, Settings opens the full options page,
  Debug toggles a dev overlay.
- **`options/`** — full options tab. `App.tsx` wraps the Dashboard in a `VaultGuard`
  (credentials must be unlocked first); `SecureContent` splits server saves (vault)
  from other settings (local storage). Tabs: TorrentDashboard, ServerConfigPanel,
  FunctionSettings, AppearanceSettings, Utilities, SystemSettings, AboutTab; hosts
  CommandPalette + `useTorrentPoller`; owns backup import/export.

`wxt.config.ts`: `srcDir=src`, `outDir=builds`; MV3 manifest, permissions
`[storage, contextMenus, notifications, activeTab, alarms, declarativeNetRequest,
scripting]` + optional host perms (http/https/ws/wss); `options_ui.open_in_tab=true`;
defines `__UI_DEBUG_MODE__`, `__BUILD_TIMESTAMP__`, `__APP_VERSION__`. Vite:
`@vitejs/plugin-react` (Babel decorators for tsyringe) + `vite-plugin-react-inspector`
(dev only).

## State & data flow
- **`stores/useTorrentStore.ts`** — plain Zustand store (no persist/devtools
  middleware); a pure UI sink with no network knowledge. State:
  `torrents: Record<number, Torrent>` (sparse, keyed by viewport index),
  `totalCount`, `globalStats`, `isLoading`, `error`.
- **`ViewportManager`** (background) holds the full in-memory `Torrent[]`, slices to
  the visible `[start, end)` range, diffs successive slices via `TorrentDiffer`, and
  broadcasts `VIEWPORT_UPDATE` (full) / `VIEWPORT_DIFF` (JSON patches) + `STATS_UPDATE`.
  Calls `StateHydrator` on every update.
- **`StateHydrator`** — write-through persistence to `browser.storage.session`
  (key `session:torrent_state`, ~1s debounce); state survives SW termination and is
  re-hydrated on wake.
- **`LifecycleAdapter`** — SW keep-alive selector: Alarms heartbeat (Firefox),
  WebSocket keep-alive (Chrome 116+).
- **`useTorrentPoller`** (UI) opens the `ctrl-active-session` port (keeps SW alive)
  and routes `VIEWPORT_UPDATE`/`VIEWPORT_DIFF`/`STATS_UPDATE` into the store.
- **Credentials never touch localStorage:** `useSettings` stores `AppOptions` in WXT
  local storage but routes servers exclusively through `VaultService` (encrypted);
  `useVault` exposes `VaultStatus` (`loading|uninitialized|locked|unlocked`).

Related: `mem:core`, `mem:adapters`, `mem:conventions`.
