# CTRL Architecture

## Overview

CTRL is a Manifest V3 extension for Chrome and Firefox. One codebase (WXT +
React + TypeScript) produces both packages; the manifest differs only in
what each browser requires (Chrome: `minimum_chrome_version`; Firefox: the
`gecko` block with the permanent add-on id, `strict_min_version` and
`data_collection_permissions`).

```
┌──────────────────────────── extension ────────────────────────────┐
│  popup.html           options.html            background          │
│  (React, Carbon)      (React, Carbon)         (service worker /   │
│      │                     │                   event page)        │
│      └──── runtime port ───┴──── messages ──────► TorrentController│
│                                                    │  ├ ClientFactory ─► adapter (Transmission | qBittorrent | aria2 | hidden ones)
│                                                    │  ├ ServerResolver ─► VaultService (encrypted servers) + settings
│                                                    │  ├ HeaderRewriter ─► declarativeNetRequest session rule (qBittorrent only)
│                                                    │  └ StateHydrator ─► storage.session snapshot
│                                                    └ badge, context menus, alarms
└────────────────────────────────────────────────────────────────────┘
                              │ fetch (only to the configured client address, after the host grant)
                              ▼
                     the user's torrent client
```

There are no content scripts, no web-accessible resources, no remote code
and no third-party network requests.

## Background: `TorrentController`

The controller is the single owner of queue state. Invariants (all
runtime-verified in `docs/release/v1/evidence/state-vault-*.md`):

- **One poll in flight**; additional refresh requests coalesce.
- **Generation checks**: every poll captures the generation it started in.
  A server switch, vault lock or settings change bumps it, and a result from
  an older generation is discarded — a slow reply from server A is never
  shown as server B's queue.
- **Id-keyed snapshots**: the UI addresses rows by torrent id, never by
  position, so reordering, insertion and removal on the server cannot make a
  row show another torrent's data.
- **Commands carry the server id** of the row they came from and are routed
  to that server's client, whatever the active server is; a command for a
  server that no longer exists fails closed.
- **Truthful connection state** (`ConnectionState`): `uninitialized`,
  `locked`, `vault_corrupted`, `no_servers`, `invalid_config`,
  `permission_missing` (with a `PERMISSION_REVOKED` discriminant when the
  browser removed the grant), `connecting`, `connected`, `stale`,
  `unavailable`, `auth_failed`. Settled outcomes stay on screen while a
  retry runs; after `auth_failed` automatic polling stops until the settings
  change or the user asks, so a wrong password fails once instead of
  hammering (and getting banned by) the server.
- Each subscriber (popup, every options window) opens a port, declares the
  viewport it renders and receives id-keyed snapshots; holding a port
  switches the background to fast polling; with no UI open a one-minute
  alarm refreshes the badge only if the badge is enabled.

## Adapters and transport

Every client implements `ITorrentClient` (`login`, `getTorrents`,
`addTorrentUrl`, `pauseTorrent`, `resumeTorrent`, `removeTorrent`,
`testConnection`, `classifyError`, …). Adapters map their protocol's errors
to typed `AdapterError`s so the controller can tell an authentication
failure from an outage.

- `FetchHttpClient` is the browser-correct transport: forbidden headers
  (`Origin`, `Referer`, `Cookie`) are never set, cookie sessions use
  `credentials: 'include'` (qBittorrent) and everything else `omit`.
- `HeaderRewriter` installs a `declarativeNetRequestWithHostAccess` session
  rule for each configured qBittorrent origin that sets `Origin`/`Referer`
  to that origin, because qBittorrent's default cross-site check rejects the
  extension origin the browser stamps on requests. The rule is scoped to
  that one origin and to hosts the user granted.
- Host permissions are optional and granted per server address. Chrome gets
  `http://host:port/*`; Firefox `http://host/*` (its match patterns have no
  port support and a port-qualified grant does not exempt fetches from CORS).

The v1 adapters offered in the UI are Transmission, qBittorrent and aria2
(`CLIENT_LIST` in `shared/lib/constants.ts`, `v1Status: 'candidate'`); the
other adapters remain loadable for existing configurations but are hidden.

## Vault

Servers (address, username, password, options) live in one authenticated
envelope in `storage.local` (`vault`: version, PBKDF2 parameters, salt, IV,
ciphertext, revision). The key is derived from the master password
(PBKDF2-SHA256, 300,000 iterations) and kept only in `storage.session`
while unlocked, so a browser restart locks the vault. Writes carry a revision
so a stale window cannot silently overwrite a newer one. Incomplete or
malformed material is reported as corrupted and never unlocks; the only way
forward is an explicit, acknowledged reset. The pre-envelope format
(`vaultSalt` + `vaultData`) is migrated on the first successful unlock.

## UI

Popup and options pages are React with IBM Carbon components (Tailwind only
for layout tokens). The server form is a single complete-URL field backed by
`parseEndpoint` (IPv6, ports and reverse-proxy sub-paths round-trip), with
labels, stable ids, live-region results, the credential disclosure and the
plain-HTTP warning. No native `alert`/`confirm` dialogs are used.

## Packaging

`wxt.config.ts` generates both manifests; PostCSS strips remote `@font-face`
rules so the package makes no third-party requests; builds are deterministic
(verified by CI building twice). `scripts/zip-source.ts` produces the
reviewer source archive from a clean git tree. See `extension/BUILD.md`.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | WXT 0.20 |
| UI | React 18, TypeScript, IBM Carbon, Tailwind (layout) |
| State | Zustand (UI mirror of the background snapshot) |
| Validation | Zod |
| Tests | Vitest + React Testing Library; Playwright smoke; live harness (puppeteer-core for Chrome, selenium-webdriver for Firefox) |
