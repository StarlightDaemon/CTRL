# CTRL Privacy Policy

**Last updated**: September 2026 (applies to CTRL 0.2.0-beta.1 and later)

CTRL is a browser extension that sends magnet links and torrent URLs to a
BitTorrent client you run yourself and shows and controls that client's
queue. This policy describes exactly what CTRL stores, what it transmits, to
whom, and what it never does. It is written to match the extension's
behaviour as verified in the release program; the source is public.

## The short version

- CTRL has **no servers of its own**, no analytics, no telemetry, no crash
  reporting and no advertising. The CTRL developer receives nothing from the
  extension.
- The only network destination is the **torrent client address you
  configured**. CTRL sends that client your login (to sign in) and the
  torrent links and commands you issue, and reads the queue back.
- Your server addresses, usernames and passwords are **encrypted on your
  device** with a master password before being stored, and are only ever
  sent to the client they belong to.

## What CTRL stores on your device

All storage uses the browser's extension storage; nothing leaves the device
by being stored.

| Data | Where | Encrypted | Lifetime |
|---|---|---|---|
| Server list: name, client type, address, username, password, per-server options | `storage.local`, key `vault` | Yes — AES-GCM with a key derived from your master password (PBKDF2-SHA256, 300,000 iterations, random salt). The master password itself is never stored. | Until you remove the server, reset the vault or uninstall |
| Preferences: context-menu mode, add-paused default, advanced-add dialog, notifications on/off, labels, default server, badge mode | `storage.local` | No (they contain no secrets) | Until changed or uninstall |
| Session key (the derived encryption key while the vault is unlocked) | `storage.session` (memory-backed, cleared when the browser closes) | Held by the browser in memory | Until you lock CTRL or the browser closes — after a browser restart CTRL is locked and asks for the master password |
| Queue snapshot: the last torrent list received from your client (names, sizes, progress, speeds, ids) | `storage.session` | No | Browser session; discarded when the active server changes |

Locking CTRL (toolbar or settings) discards the session key in every window
at once. A damaged vault is never "half-opened": CTRL refuses to unlock and
offers a reset that deletes the stored servers.

## What CTRL transmits, and to whom

CTRL makes network requests **only to the torrent client addresses you
configured**, and only after you granted the browser's host permission for
that address.

| What | When | To |
|---|---|---|
| Username and password (Transmission: HTTP Basic; qBittorrent: login form; aria2: RPC secret) | When signing in, testing a connection, or re-authenticating after a session expired | The configured client only |
| Magnet links / torrent URLs you add, with the options you chose (paused, label, folder) | When you add a torrent | The configured client only |
| Queue commands (pause, resume, remove) and queue polling requests | While a CTRL window is open (every few seconds) and, if the toolbar badge is enabled, about once a minute in the background | The configured client only |

Nothing is sent to the CTRL developer or to any third party. CTRL does not
read web pages, does not inject anything into websites, and does not react to
page loads; the right-click menu acts only on the link you right-clicked.

### Unencrypted connections

If you configure a client with `http://` rather than `https://`, the login
and the commands travel unencrypted. That is a normal choice on a private
network and CTRL allows it, but it warns you when the address is outside
loopback and private ranges, because anyone on the network path could read or
alter that traffic. Use `https://` wherever the client or a reverse proxy
offers it.

### qBittorrent and the `Origin` header

Browsers label every request an extension makes with the extension's own
origin, which qBittorrent's default cross-site protection rejects. To work
with qBittorrent without asking you to switch that protection off, CTRL
installs a browser rule (`declarativeNetRequestWithHostAccess`) that applies
**only to the qBittorrent server address you configured** and sets the
`Origin` and `Referer` headers of CTRL's own requests to that server's
address. The rule touches no other site and reads no traffic. It exists for
the current browser session and only for hosts you granted access to.

## Backups and exports

- **Safe export** (default) contains server names, types, addresses and
  options — never passwords — and is marked `containsSecrets: false`.
- **Full export** contains passwords in plain text so it can be imported
  elsewhere. It is marked `containsSecrets: true` and labelled as such in the
  interface. Keep such a file private.
- Exports are files saved by your browser; CTRL does not upload them.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | the encrypted vault, preferences, the session key and the queue snapshot |
| `contextMenus` | the right-click entries |
| `notifications` | optional local notifications when a torrent was added or adding failed (switchable in Settings) |
| `alarms` | the one-minute background badge refresh (only while the badge is enabled) |
| `declarativeNetRequestWithHostAccess` | the per-server header rule described above |
| Optional host access (`http://*/*`, `https://*/*`) | granted by you per server address when you add a server; used only to reach that client |

Firefox shows this in the add-on's data-collection consent as
*authentication information*: CTRL sends your client login to the client you
configured (Mozilla's taxonomy counts any transmission outside the extension,
even to your own server).

## What CTRL never does

- collect or transmit browsing history, page content, IP addresses or any
  personal information;
- send torrent links, hashes or queue contents anywhere other than your
  configured client;
- use analytics, telemetry, crash reporting or advertising;
- load remote code or remote resources (fonts are the system's; the package
  makes no third-party requests).

## Your control

- Change or remove servers at any time in Settings → Servers.
- Lock CTRL to discard the session key immediately.
- Reset the vault (Settings → System) to delete every stored server and the
  master password from the device.
- Uninstalling the extension removes all its stored data.

## Children

CTRL does not knowingly collect any information from anyone.

## Changes

Changes to this policy are published here with a new "last updated" date.

## Contact and source

- Source code: https://github.com/StarlightDaemon/CTRL
- Questions: https://github.com/StarlightDaemon/CTRL/discussions
- Issues: https://github.com/StarlightDaemon/CTRL/issues

## Legal note

CTRL is a remote control for BitTorrent clients. It does not provide, host,
index or distribute files. Users are responsible for the content they
transfer with their own clients.
