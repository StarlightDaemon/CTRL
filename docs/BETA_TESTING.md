# CTRL — testing guide (pre-release)

This page is the public status of CTRL before its store release: what it
supports, what has been verified, how to install a release package, and how
to report problems. It replaces earlier beta notes that described features
no longer in the product.

## Status

- Version: `0.2.0-beta.1` (manifest `0.2.0.1`)
- Target: v1.0 on the Chrome Web Store and Firefox Add-ons; not yet submitted
- Clients offered: **Transmission**, **qBittorrent**, **aria2** — each verified end-to-end in Chrome 152 and Firefox 155 against a real server (see [release/v1/CLIENT_VERIFICATION.md](release/v1/CLIENT_VERIFICATION.md))
- Browsers: Chrome 120+ (desktop), Firefox 140+ (desktop)
- Language: English

Not in this release: Deluge, Flood, ruTorrent, µTorrent, BiglyBT and Vuze
(adapters exist but are unverified and hidden; an existing configuration
keeps working and is labelled experimental), page scanning for magnet links,
themes, download-completion notifications, translations.

## Install a release package

1. Download the package for your browser from [GitHub Releases](https://github.com/StarlightDaemon/CTRL/releases).
2. Chrome: unzip; `chrome://extensions` → Developer mode → *Load unpacked* → select the folder.
3. Firefox: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → select the `.zip`. Temporary add-ons disappear when Firefox restarts (this is a Firefox rule for unsigned add-ons; the store version will not have it).

## Set up

1. Open the toolbar popup or the options page and choose a **master
   password**. It encrypts your server logins on this device. It cannot be
   recovered; if you forget it, reset the vault from Settings → System (this
   deletes the saved servers).
2. Settings → Servers → **Add server**: name, client type, the full address
   of the client's web interface (for example `http://192.168.1.10:9091/`,
   `http://nas.local:8080/`, `https://home.example/qbt/`), username and
   password (aria2: put the RPC secret in the password field).
3. **Grant access** when asked — the browser needs your permission to let
   CTRL contact that address.
4. **Test connection**, then **Save**.

Client-side notes:

- qBittorrent: leave *CSRF protection* and *Host header validation* at their
  defaults; CTRL works with them on. Make sure the Web UI is enabled.
- Transmission: enable the RPC interface and authentication; CTRL uses the
  standard `…/transmission/rpc` path under the address you enter.
- aria2: start it with `--enable-rpc` and, if you use `--rpc-secret`, enter
  that token as the password.
- Plain `http://` to an address outside your local network is allowed but
  CTRL warns you that logins and commands can be read in transit.

## What to try

- Add a magnet link from the popup and from the right-click menu; with
  "Add torrents paused" on, check it arrives paused.
- Pause, resume and remove torrents from the options dashboard.
- Enter a wrong password: Test connection must fail and the dashboard must
  say *Authentication failed* rather than pretend to be connected.
- Stop the client: the dashboard must say *Connection lost*; start it again
  and CTRL must reconnect on its own.
- Lock CTRL, restart the browser: it must ask for the master password.
- Export the server list (safe export) and confirm the file contains no
  password; the full export says it contains secrets.

## Reporting a problem

Open a [GitHub issue](https://github.com/StarlightDaemon/CTRL/issues) with:

1. browser and version;
2. client and version, and how CTRL is pointed at it (address form, HTTP or HTTPS, reverse proxy or not);
3. what you did, what you expected, what happened (the status text CTRL showed);
4. anything from the client's log around that time.

Never paste passwords, tokens or a full export.

## Legal

CTRL is a remote control for BitTorrent clients. It does not provide, host,
index or distribute files. Users are responsible for the content they
transfer with their own clients.
