# CTRL v1 Scope Definition

Status: working definition for the v1 release program. Decisions recorded here
were taken during the 2026-09-09 release-completion pass after reconciling the
two independent audits under `audits/` against the live repository, and after
re-checking Chrome Web Store and Mozilla Add-ons requirements from first-party
sources on 2026-09-09 (research notes: `research/chrome-policy.md`,
`research/mozilla-policy.md`; a consolidated `STORE_POLICY_RECONCILIATION.md`
is still to be written).

The guiding question for every item was:

> What is the smallest technically and policy-defensible CTRL v1 that can
> actually be supported?

## 1. Product

**Name:** manifest `name` is `CTRL - Torrent Control` with `short_name` `CTRL`
(the public identity is "CTRL"; the manifest name never embeds a version).

**Single purpose:** CTRL sends magnet links and torrent URLs to a BitTorrent
client the user already runs, and shows and controls that client's queue from
the browser. It stores the client's address and login encrypted on the user's
device and transmits them only to that client.

## 2. Browser baseline

| Browser | Minimum | Tested on | Notes |
|---|---|---|---|
| Chrome (desktop) | `minimum_chrome_version` 120 | 152.0.7977.83 | MV3; `storage.session` (102+), alarms floor 30 s (120+), optional host permissions |
| Firefox (desktop) | `strict_min_version` 140.0 | 155.0.1 | MV3 event page; built-in data-consent UI (140+), `optional_host_permissions` (128+), `storage.session` (115+) |

Mobile browsers, Safari, and Chromium forks are not release targets. They may
work but are not tested or advertised.

## 3. Torrent-client support matrix

Classification rule: a client is **VERIFIED FOR V1** only after the full
operation set (endpoint, permission grant, login, list, add magnet, add paused,
pause, resume, remove without data deletion, bad credentials, unavailable
server, reconnect, browser restart) passes against a real server from both
Chrome and Firefox on a non-loopback address. Passing unit tests is not
evidence of support.

| Client | Adapter | v1 classification | Rationale |
|---|---|---|---|
| Transmission (daemon 4.x, RPC 17+) | `transmission` | **VERIFIED FOR V1** (2026-09-09, 4.1.3, Chrome + Firefox) → `CLIENT_VERIFICATION.md` | Header-based auth |
| qBittorrent (4.6+, 5.x; Web API 2.9+/2.11+) | `qbittorrent` | **VERIFIED FOR V1** (2026-09-09, 5.2.3 with default CSRF protection on, Chrome + Firefox) → `CLIENT_VERIFICATION.md` | Cookie session; CSRF satisfied by a per-origin `declarativeNetRequestWithHostAccess` header rule |
| aria2 (1.36+) | `aria2` | **VERIFIED FOR V1** (2026-09-09, 1.37.0, Chrome + Firefox) → `CLIENT_VERIFICATION.md` | JSON-RPC with token |
| Deluge Web UI | `deluge` | EXPERIMENTAL / HIDDEN | Cookie session repaired to browser model but no live environment; not advertised |
| Flood | `flood` | EXPERIMENTAL / HIDDEN | Bootstrap/cookie contract unverified |
| ruTorrent | `rutorrent` | EXPERIMENTAL / HIDDEN | XML body now sent verbatim; endpoint conventions unverified |
| µTorrent | `utorrent` | EXPERIMENTAL / HIDDEN | GUID/token flow moved to browser cookies; unverified |
| BiglyBT | `biglybt` | EXPERIMENTAL / HIDDEN | Transmission-like RPC plus Simple API; unverified; API key in query string |
| Vuze Web Remote | `vuze_remoteui` | EXPERIMENTAL / HIDDEN | Inherits Transmission adapter; no independent evidence |

"Hidden" means: not offered in the server type selector, not named in the
README support table, listing copy, or privacy policy. Existing configurations
of a hidden type keep working (the adapter code remains) and are labelled
"experimental, not verified" in the server list. The final VERIFIED / not
column is filled in by `CLIENT_VERIFICATION.md` (written 2026-09-09 after the
live-verification wave: all three candidates verified in both browsers; the
hiding of experimental clients in the UI was implemented in the
product-surface wave).

## 4. Feature classification

| Feature | Class | Decision |
|---|---|---|
| Master-password vault (setup, unlock, lock, browser-restart lock) | CORE V1 | Keep; fail closed on corruption; lock propagates across windows |
| Server configuration (one or many), per-origin permission grant, test connection | CORE V1 | Keep; rebuild form on Carbon inputs with real labels and a single URL field |
| Add magnet/URL from popup and context menu | CORE V1 | Keep; one add-paused policy (global default, explicit override) |
| Queue list, pause, resume, remove (keeps files) | CORE V1 | Keep; id-keyed snapshots; remove requires confirmation |
| Toolbar badge (count / speed / off) | OPTIONAL V1 | Keep; background polling only when badge is on |
| Backup: safe export, sensitive export, import | OPTIONAL V1 | Keep; safe export allowlisted; sensitive export clearly labelled |
| Advanced add dialog (folder, label, paused) | OPTIONAL V1 | Keep |
| Notifications on/off | OPTIONAL V1 | Keep the on/off switch only |
| Context menu mode (full / simple / hidden) | OPTIONAL V1 | Keep; drop the "custom" preview that did not match the real menu |
| "Scan page for magnet links" | DELETE (v1) | Removed with its `activeTab` + `scripting` permissions; unbounded adds without preview and an extra page-content disclosure were not worth the v1 cost. Post-launch candidate with cap + preview |
| Popup Debug tab / UI debug overlay in production | DELETE | Removed |
| Theme, layout/sidebar, performance mode, notification level & style, enhanced diagnostics, command palette | DELETE | No runtime consumer; removed from UI and settings schema (existing stored values are ignored) |
| "Storage Health" / hard-coded "Connection: Online" cards | DELETE | Replaced by truthful connection state |
| Utilities page external links (torrent caches, IP-check sites) and hash converter | DELETE | Outside the single purpose; review risk |
| Self-test panel exposing user agent / platform | DELETE | Replaced by version + build info on About |
| WebSocket keepalive module and `ws://`/`wss://` optional host permissions | DELETE | No consumer |
| Multi-language claim (7 languages at ~21 % coverage) | DELETE (v1) | English-only listing; partial locale directories removed; `auto-localize` workflow removed. Post-launch: proper localisation once strings are stable |
| Torrent file upload (`addTorrentFile`) | POST-LAUNCH | Adapter methods exist but no UI; not advertised |
| RSS, search, file management, trackers, bandwidth scheduling adapter APIs | POST-LAUNCH | Code retained where harmless; not advertised, no UI |

## 5. Permissions (target manifest)

| Permission | Kept | Why |
|---|---|---|
| `storage` | yes | settings, encrypted vault, session key, session snapshot |
| `contextMenus` | yes | right-click add |
| `notifications` | yes | add/error result notifications (user-switchable) |
| `alarms` | yes | 1-minute badge refresh when no UI is open |
| `declarativeNetRequestWithHostAccess` | yes (added 2026-09-09) | session rule per configured qBittorrent origin that sets `Origin`/`Referer` to that origin, so qBittorrent's default CSRF check accepts the extension without the user weakening their server; applies only to hosts the user granted; no extra install-time warning |
| `optional_host_permissions: http://*/*, https://*/*` | yes | user-configured client origins, granted per origin at runtime (Chrome: `http://host:port/*`; Firefox: `http://host/*` — its patterns have no port support) |
| `activeTab`, `scripting` | removed | page scanning removed |
| `ws://*/*`, `wss://*/*` | removed | no consumer |

## 6. Privacy / data declarations

- Credentials are encrypted at rest (AES-GCM, PBKDF2) and transmitted only to
  the user-configured client. They are never sent to the CTRL developer.
- Magnet links / torrent URLs the user acts on are sent to that client.
- Torrent metadata received from the client is cached in `storage.session`
  for the browser session only.
- No telemetry, analytics, crash reporting, or remote code. No third-party
  network requests (fonts are bundled or system).
- Firefox `data_collection_permissions`: `required: ["authenticationInfo"]`
  (credentials are transmitted outside the extension to the user's server;
  Mozilla's definition draws no exception for user-configured destinations).
- Chrome dashboard data categories: "Authentication information".
- Plain HTTP is allowed for user-configured addresses (Chrome user-data FAQ
  protocol-client exception). The server form warns when a non-private host
  uses `http://`.

## 7. Release gates

Gates A–K as defined in the program brief. Gate status and evidence are
tracked in `EXECUTION_STATE.md` until a dedicated `RELEASE_GATES.md` exists;
the version becomes 1.0.0 only when every gate passes.
