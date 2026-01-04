# CTRL

> **Control torrent clients from your browser**

A browser extension for managing BitTorrent clients. Built with WXT, React, and TypeScript.

[![Chrome](https://img.shields.io/badge/Chrome-Coming_Soon-lightgrey?logo=googlechrome)](https://github.com/StarlightDaemon/CTRL/releases)
[![Firefox](https://img.shields.io/badge/Firefox-Coming_Soon-lightgrey?logo=firefox)](https://github.com/StarlightDaemon/CTRL/releases)
[![Tests](https://img.shields.io/badge/Tests-153%20passing-brightgreen)](extension/tests)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Features

- **9 Torrent Clients** - qBittorrent, Transmission, Deluge, Flood, ruTorrent, uTorrent, BiglyBT, Vuze, Aria2
- **7 Site Integrations** - 1337x, Nyaa, TPB, FitGirl, RARBG, TorrentGalaxy, AudioBook Bay
- **Secure Vault** - Encrypted credential storage with AES-GCM
- **Context Menu** - Right-click to add torrents
- **Multi-Server** - Manage multiple torrent clients
- **Theming** - Dark mode and multiple theme options

---

## 🚀 Quick Start

### Download Beta Release

**Recommended**: Download pre-built packages from [GitHub Releases](https://github.com/StarlightDaemon/CTRL/releases)

**Chrome/Edge**:
1. Download `ctrl-chrome-v0.2.0-beta.1.zip`
2. Extract the ZIP file
3. Go to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

**Firefox**:
1. Download `ctrl-firefox-v0.2.0-beta.1.zip`
2. Extract the ZIP file
3. Go to `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Select `manifest.json` from the extracted folder

### Install from Store *(Coming Soon)*

- [Chrome Web Store](https://chrome.google.com/webstore) - In review
- [Firefox Add-ons](https://addons.mozilla.org/firefox) - In review

<details>
<summary><b>Advanced: Build from Source</b></summary>

For developers who want to build the extension themselves:

```bash
# Clone the repository
git clone https://github.com/StarlightDaemon/CTRL.git
cd CTRL/extension

# Install dependencies
npm install

# Build for Chrome
npm run build:chrome

# Build for Firefox
npm run build:firefox

# Run tests
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup.

</details>

---

## 📦 Supported Clients

| Client | Status | Features |
|--------|--------|----------|
| qBittorrent | ✅ Full | Categories, Tags, Sequential |
| Transmission | ✅ Full | Labels, Directories |
| Deluge | ✅ Full | Labels |
| Flood | ✅ Full | Tags |
| ruTorrent | ✅ Full | Labels, Fast Resume |
| uTorrent | ✅ Full | - |
| BiglyBT | ✅ Full | - |
| Vuze | ✅ Full | - |
| Aria2 | ✅ Basic | - |

---

## 🔧 Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup instructions.

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run compile      # Type check
npm run test         # Unit tests
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [ROADMAP.md](ROADMAP.md) | Feature roadmap |
| [docs/API.md](docs/API.md) | Client adapter API |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev setup |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

---

## 📄 License

MIT © CTRL Contributors

---

## 🙏 Acknowledgments

Inspired by [Torrent Control](https://github.com/AthanasiusBrainworx/torrent-control). CTRL is a complete rewrite built from the ground up with modern technologies.
