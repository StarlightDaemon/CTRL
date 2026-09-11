# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1 release program (2026-09-09)

This is the release-readiness pass that turns the beta into a store-ready
v1. The public surface was reduced to what is verified, and every remaining
claim was checked at runtime.

### Supported clients

- **Verified for v1** (full workflow against a real server, Chrome 152 and
  Firefox 155): Transmission 4.1.3, qBittorrent 5.2.3 (with its default CSRF
  protection on), aria2 1.37.0. Evidence: `docs/release/v1/evidence/`.
- Deluge, Flood, ruTorrent, µTorrent, BiglyBT and Vuze are no longer offered
  when adding a server; they are unverified. Existing configurations keep
  working and are labelled "experimental, not verified".

### Added

- Single-URL server form with real labels, keyboard operation, focus
  management, actionable validation; IPv6, ports and reverse-proxy sub-paths
  survive save → reload → edit → save.
- In-product credential disclosure at the point of entry and a warning for
  plain HTTP to non-private hosts.
- Truthful connection state everywhere (not configured, locked, damaged
  vault, no server, invalid configuration, access not granted / revoked,
  connecting, connected, connection lost, unavailable, authentication
  failed) with recovery actions (Grant access) in the popup and server list.
- Host-permission revocation is detected and reported as revoked.
- Vault reset with an explicit acknowledged confirmation (damaged-vault
  screen, "Forgot your master password?", Settings → System).
- `declarativeNetRequestWithHostAccess` permission: a session rule limited to
  each configured qBittorrent origin that sets `Origin`/`Referer` so
  qBittorrent's default cross-site protection accepts the extension (instead
  of asking users to disable it).
- Reproducible-build documentation (`BUILD.md`), `build-for-amo` script,
  reviewer source archive (`zip:source`), CI package gates (determinism,
  validator, contamination, version and permission consistency, checksums).
- Live verification harness (`tests/live/`): disposable upstream client
  binaries, real-browser drivers for Chrome and Firefox, client matrix and
  state/vault runners with server-checked evidence.

### Changed

- Manifest: `name` "CTRL - Torrent Control", English-only (`default_locale`
  `en`), Chrome minimum 120, Firefox minimum 140 with a permanent add-on id
  and `data_collection_permissions: authenticationInfo`; explicit CSP with
  `connect-src http: https:`; no remote fonts or resources in the package.
- Permissions reduced to `storage`, `contextMenus`, `notifications`, `alarms`,
  `declarativeNetRequestWithHostAccess` plus optional host access granted per
  server; `activeTab`, `scripting`, `ws:`/`wss:` host patterns removed.
- Vault stored as one authenticated envelope with a revision; the session key
  lives only in `storage.session` (a browser restart locks CTRL); incomplete
  or malformed vault data fails closed; the previous separate-key format is
  migrated on first unlock.
- Background rewritten around a single controller: generation-checked
  polling, id-keyed snapshots, per-server command routing, stable server
  identities, port-based live subscriptions, restart hydration.
- Firefox host grants use the port-less pattern (`http://host/*`) because
  Firefox match patterns have no port support; Chrome keeps `http://host:port/*`.
- qBittorrent 5.x: "add paused" sends `stopped`; a rejected login is not
  retried until the settings change (prevents the client's IP ban); Test
  connection ends an existing session first so it validates the entered
  credentials.
- aria2: JSON-RPC errors answered with HTTP 400 and per-call multicall faults
  are classified correctly ("Unauthorized" → authentication failed).
- Controller: settled outcomes stay visible during retries; automatic polling
  stops after an authentication failure until settings change or an explicit
  refresh.
- Safe export is allowlist-based and every export is marked `containsSecrets`.
- Settings toggles have stable ids and accessible names; native
  `alert`/`confirm` dialogs replaced by in-product dialogs and notifications.

### Removed

- Page scanning for magnet links, themes/appearance, layout and performance
  settings, notification level/style, debug overlay and debug tab, command
  palette, utilities page (external link sites, hash converter), self-test
  panel, WebSocket keepalive, the six partial translations and the
  auto-localize workflow, the "custom" context-menu mode.

### Security

- Vault session key removed from disk-backed storage on Firefox builds that
  mirrored it there; legacy copies are purged on every background start.
- Development dependency advisories reconciled; deterministic `npm ci`.

## [0.2.0-beta.1] — 2026-01

Beta release: nine adapters, multi-language UI, Chrome and Firefox builds.
Superseded by the v1 program above; the historical notes are kept in the
git history.
