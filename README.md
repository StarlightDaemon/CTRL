# CTRL

> **Control torrent clients from your browser**

A browser extension for managing BitTorrent clients. Built with WXT, React, and TypeScript.

[![Chrome](https://img.shields.io/badge/Chrome-Coming_Soon-lightgrey?logo=googlechrome)](https://github.com/StarlightDaemon/CTRL/releases)
[![Firefox](https://img.shields.io/badge/Firefox-Coming_Soon-lightgrey?logo=firefox)](https://github.com/StarlightDaemon/CTRL/releases)
[![CI](https://github.com/StarlightDaemon/CTRL/actions/workflows/ci.yml/badge.svg)](https://github.com/StarlightDaemon/CTRL/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/Tests-153%20passing-brightgreen)](extension/tests)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Features

- **Universal Client Support** - Unified interface for all major BitTorrent clients (see list below).
- **Secure Vault** - Industry-standard AES-GCM encryption for your credentials.
- **Privacy First** - Zero telemetry, zero analytics, strictly local data storage.
- **Modern UI** - Native dark mode, context menus, and responsive design.
- **Multilingual** - Translated into 7 languages.
- **Open Source** - MIT licensed and completely auditable code.

### 📦 Supported Clients

| Client | Status | Key Features |
|--------|--------|--------------|
| qBittorrent | ✅ Full | Categories, Tags, Sequential Download |
| Transmission | ✅ Full | Labels, Directories |
| Deluge | ✅ Full | Labels, Auth |
| Flood | ✅ Full | Tags, JWT |
| ruTorrent | ✅ Full | Labels, Fast Resume |
| uTorrent | ✅ Full | Token Auth |
| BiglyBT | ✅ Full | Basic Control |
| Vuze | ✅ Full | Basic Control |
| Aria2 | ✅ Basic | RPC Multicall |

---

## 🚧 Project Status

**Current Status**: Beta / Active Development  
**Target**: v1.0 Store Release (Coming 2026)

This project is currently in **Beta**. We recommend most users wait for the official release on the Chrome Web Store and Firefox Add-ons site.

---

## 📥 Installation

> **Beta Release Available**: Download from [GitHub Releases](https://github.com/StarlightDaemon/CTRL/releases) - See [Beta Guide](docs/BETA_TESTING.md) for instructions.

1. **Download**: Get the latest `.zip` release.
2. **Install**:
   - **Chrome**: Load unpacked in Developer Mode.
   - **Firefox**: Load as Temporary Add-on.

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Beta Guide](docs/BETA_TESTING.md) | **Start Here** - Installation & Testing |
| [E2E Troubleshooting](docs/E2E_TROUBLESHOOTING.md) | Diagnose Playwright/Environment issues |
| [ROADMAP.md](ROADMAP.md) | Future features & strategy |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup build environment |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |

---

## 🛠️ Development

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## 📄 License

MIT © CTRL Contributors

---

## 🙏 Acknowledgments

Inspired by [Torrent Control](https://github.com/AthanasiusBrainworx/torrent-control). CTRL is a complete rewrite built from the ground up with modern technologies.
