# CTRL

> **Manage your torrents from the browser**

A modern, cross-browser extension for controlling torrent clients. Built with WXT, React, and TypeScript.

[![Chrome](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome)](https://chrome.google.com/webstore)
[![Firefox](https://img.shields.io/badge/Firefox-Add--on-orange?logo=firefox)](https://addons.mozilla.org/addon/torrent-control/)
[![Tests](https://img.shields.io/badge/Tests-106%20passing-brightgreen)](extension/tests)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Features

- **9 Torrent Clients** - qBittorrent, Transmission, Deluge, Flood, ruTorrent, uTorrent, BiglyBT, Vuze, Aria2
- **7 Site Integrations** - 1337x, Nyaa, TPB, FitGirl, RARBG, TorrentGalaxy, AudioBook Bay
- **Secure Vault** - Encrypted credential storage with AES-GCM
- **Context Menu** - Right-click to add torrents
- **Multi-Server** - Manage multiple torrent clients
- **Dark Mode** - Beautiful dark theme by default

---

## 🚀 Quick Start

### Install from Store

- [Chrome Web Store](https://chrome.google.com/webstore) *(coming soon)*
- [Firefox Add-ons](https://addons.mozilla.org/addon/torrent-control/)

### Build from Source

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/CTRL.git
cd CTRL/extension

# Install dependencies
npm install

# Development (Chrome)
npm run dev

# Build for production
npm run build
```

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

Originally forked from [Torrent Control](https://github.com/AthanasiusBrainworx/torrent-control).
