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

## 🚧 Project Status

**Current Status**: Beta / Active Development  
**Target**: v1.0 Store Release (Coming 2026)

This project is currently in **Beta**. We recommend most users wait for the official release on the Chrome Web Store and Firefox Add-ons site for the best experience (automatic updates, signing, etc.).

---

## 📥 Installation

### Option 1: Store Release (Recommended)

*Coming soon. Watch this repo for updates.*

- ⚪ **Chrome Web Store** - In Review
- ⚪ **Firefox Add-ons** - In Review

### Option 2: Beta Testing (Advanced)

If you want to test the latest features and help report bugs, you can install the unsigned beta.

> **⚠️ Note**: As these are unsigned beta builds, Chrome will require "Developer Mode" and Firefox will treat them as "Temporary Extensions" (removed on restart).

1. **Download**:> **Beta Release Available**: Download from [GitHub Releases](https://github.com/StarlightDaemon/CTRL/releases) - See [Beta Guide](docs/BETA_TESTING.md)
2. **Chrome/Edge**:
   - Go to `chrome://extensions` -> Toggle "Developer Mode"
   - Drag and drop the `ctrl-chrome-*.zip` file (or extract and "Load Unpacked")
3. **Firefox**:
   - Go to `about:debugging` -> "This Firefox"
   - Click "Load Temporary Add-on" -> Select the `manifest.json` inside the ZIP

---

## 🛠️ Development

Interested in contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for build instructions and architecture documentation.

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
| [Example Beta Guide](docs/BETA_TESTING.md) | Beta installation & testing |
## 🙏 Acknowledgments

Inspired by [Torrent Control](https://github.com/AthanasiusBrainworx/torrent-control). CTRL is a complete rewrite built from the ground up with modern technologies.
