# CTRL Architecture

## Overview

CTRL is a cross-browser extension (Chrome/Firefox MV3) for managing torrent clients from the browser.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Extension                       │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│   Popup     │   Options    │   Content    │   Background    │
│   (React)   │   (React)    │   Scripts    │   (Service      │
│             │              │   (7 sites)  │    Worker)      │
└──────┬──────┴──────┬───────┴──────┬───────┴────────┬────────┘
       │             │              │                │
       └─────────────┴──────────────┴────────────────┘
                            │
                    chrome.runtime.sendMessage
                            │
              ┌─────────────┴─────────────┐
              │     Background Service    │
              │     - Client Factory      │
              │     - Vault (Encryption)  │
              │     - Context Menus       │
              └─────────────┬─────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
    │qBittorrent│    │Transmission│    │  Deluge   │
    │  Adapter  │    │   Adapter  │    │  Adapter  │
    └───────────┘    └────────────┘    └───────────┘
```

## Key Patterns

### Feature-Sliced Design (FSD)

```
entrypoints/  →  features/  →  entities/  →  shared/
     ↓              ↓             ↓            ↓
  UI Entry      Business      Domain       Utilities
  Points        Features      Models       & APIs
```

### Client Adapter Pattern

All torrent clients implement `ITorrentClient` interface:
- `login()`, `logout()`
- `getTorrents()`, `addTorrentUrl()`, `removeTorrent()`
- `pauseTorrent()`, `resumeTorrent()`

### Vault Security

Credentials encrypted at rest using:
- PBKDF2 key derivation
- AES-GCM encryption
- Session-based key storage

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | WXT |
| UI | React 18, TypeScript |
| Styling | Tailwind CSS |
| State | Zustand, React Query |
| Validation | Zod |
| Testing | Vitest, Playwright |

## Directory Structure

See [PROJECT_SOP.md](../research/docs/PROJECT_SOP.md) for complete structure.
