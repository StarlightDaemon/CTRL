# CTRL

> **Send magnet links to your own BitTorrent client and control its queue from the browser.**

CTRL is a browser extension for Chrome and Firefox. It talks directly to a
torrent client you already run — on your machine, your NAS or a server you
control — and shows and controls that client's queue from the toolbar.

[![CI](https://github.com/StarlightDaemon/CTRL/actions/workflows/ci.yml/badge.svg)](https://github.com/StarlightDaemon/CTRL/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What it does

- **Add** magnet links and torrent URLs from the toolbar popup or the right-click menu, optionally paused, with a label and a download folder.
- **See and control** the client's queue: pause, resume, remove (files are kept), live transfer speeds, a toolbar badge with the active count or download speed.
- **Several servers**: configure more than one client and switch between them.
- **Encrypted vault**: server addresses and logins are encrypted on your device with a master password (PBKDF2 + AES-GCM) and sent only to the client you configured. Nothing is sent to the CTRL developer; there is no telemetry.
- **Backup**: export your server list with or without passwords (clearly labelled) and import it elsewhere.

## Supported clients

Support means the whole workflow — configure, grant access, sign in, list, add, add paused, pause, resume, remove, wrong credentials, server outage and restart — has been verified against a real server from both Chrome and Firefox. Details and evidence: [docs/release/v1/CLIENT_VERIFICATION.md](docs/release/v1/CLIENT_VERIFICATION.md).

| Client | Verified versions | Notes |
|---|---|---|
| **Transmission** (daemon / RPC) | 4.1.3 | Basic authentication |
| **qBittorrent** (Web UI) | 5.2.3 (Web API 2.11) | Works with qBittorrent's default CSRF protection left on |
| **aria2** (JSON-RPC) | 1.37.0 | RPC secret token; also used by Motrix |

Adapters for Deluge, Flood, ruTorrent, µTorrent, BiglyBT and Vuze exist in the code but are **not offered** in this release: they are not verified. An existing configuration of one of them keeps working and is marked "experimental" in the server list.

## Browsers

| Browser | Minimum | Verified on |
|---|---|---|
| Chrome (desktop) | 120 | 152 |
| Firefox (desktop) | 140 | 155 |

The extension is English-only in this release.

## Installation

Store listings are being prepared. Until then, install a release package from [GitHub Releases](https://github.com/StarlightDaemon/CTRL/releases):

- **Chrome**: unzip, open `chrome://extensions`, enable *Developer mode*, *Load unpacked*, select the unzipped folder.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, *Load Temporary Add-on*, select the `.zip`. Temporary add-ons are removed when Firefox restarts.

## First use

1. Choose a master password. It encrypts your server logins on this device and cannot be recovered; forgetting it means resetting the vault (Settings → System).
2. Add your client: name, client type, the full address of its web interface (for example `http://192.168.1.10:9091/` or `https://nas.example/qbt/`), username and password. CTRL asks the browser for permission to contact that address.
3. *Test connection*, then *Save*. The toolbar popup now shows the queue; right-click a magnet link to add it.

Plain `http://` to a server outside your local network is allowed but CTRL warns you: anyone on the path can read or alter the login and the commands. Prefer `https://` where the client or a reverse proxy offers it.

## Permissions

| Permission | Why |
|---|---|
| `storage` | your settings and the encrypted vault (local); the session key and queue snapshot (session storage) |
| `contextMenus` | the right-click "Add to CTRL" entries |
| `notifications` | optional "torrent added / failed" notifications (can be switched off) |
| `alarms` | a one-minute badge refresh while no CTRL window is open (only when the badge is enabled) |
| `declarativeNetRequestWithHostAccess` | a rule, limited to the qBittorrent server you configured, that sets the `Origin`/`Referer` headers of CTRL's own requests to that server so qBittorrent's default cross-site protection accepts them — without asking you to weaken your server. It affects no other site |
| host access (`http://*/*`, `https://*/*`, **optional**) | requested per server address, only when you add a server |

The full data-handling description is in the [privacy policy](docs/PRIVACY_POLICY.md).

## Documentation

| Document | Description |
|---|---|
| [docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) | What is stored, what is transmitted, and to whom |
| [docs/release/v1/CLIENT_VERIFICATION.md](docs/release/v1/CLIENT_VERIFICATION.md) | Verified clients, evidence, known limits |
| [extension/BUILD.md](extension/BUILD.md) | Reproducible build instructions (also used for store source review) |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Developer setup, tests, live verification harness |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together |
| [extension/CHANGELOG.md](extension/CHANGELOG.md) | Changes per release |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

## Development

```bash
cd extension
npm ci
npm run dev            # Chrome dev build with reload
npm run dev:firefox
npm test               # unit and component tests
npm run build:chrome && npm run build:firefox
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), including how to run the live verification against real clients.

## License

MIT © CTRL Contributors

## Acknowledgments

Inspired by [Torrent Control](https://github.com/AthanasiusBrainworx/torrent-control). CTRL is a complete rewrite.
