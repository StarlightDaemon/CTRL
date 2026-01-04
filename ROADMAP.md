# CTRL Roadmap

> **Strategic direction for the CTRL browser extension**

---

## Vision

Transform CTRL from a working port into a **Best-in-Class** torrent management solution with:
- 🚀 Performance for 10k+ torrents
- 🌍 Full internationalization
- 🔒 Enterprise-grade security

---

## Current Status: v0.1.x (Beta)

### ✅ Completed

| Feature | Status |
|---------|--------|
| WXT + React + TypeScript foundation | ✅ |
| Manifest V3 migration | ✅ |
| Feature-Sliced Design architecture | ✅ |
| 8 Torrent client adapters | ✅ |
| VaultService encrypted storage | ✅ |
| 7 Site integrations | ✅ |
| Context menu support | ✅ |
| Chrome + Firefox builds | ✅ |

---

## Short-Term Goals (v0.2.x)

### 🔴 P0 - Critical

| Goal | Description | Status |
|------|-------------|--------|
| **Test Coverage** | Unit tests for adapters, E2E for critical paths | ✅ Complete (106 tests) |
| **CI/CD Pipeline** | GitHub Actions: lint, test, build on PR | ✅ Complete |
| **Documentation** | Complete README, API docs, user guide | ✅ Complete |

### 🟡 P1 - Important

| Goal | Description | Status |
|------|-------------|--------|
| **Performance Tuning** | Profile and optimize 5k+ torrent handling | 📋 Planned |
| **Error Handling** | Graceful degradation, retry logic | 📋 Planned |
| **Accessibility** | WCAG 2.1 AA compliance | 📋 Planned |

---

## Medium-Term Goals (v0.3.x - v0.5.x)

### Performance Engine

- [ ] **Diffing Engine** - RFC 6902 JSON-Patch for incremental updates
- [ ] **Virtualized State** - Window-based fetching (visible rows only)
- [ ] **WebSocket Keepalive** - Chrome 116+ persistent connections

### Internationalization

- [ ] **5 Core Languages** - ES, FR, DE, RU, ZH
- [ ] **Build Pipeline** - Nested JSON → Chrome flat format
- [ ] **Type-safe i18n** - Generated TypeScript keys

---

## Long-Term Goals (v1.0+)

### 🔮 Future Features

| Feature | Priority | Notes |
|---------|----------|-------|
| VPN Integration Check | Medium | IP monitoring, WebRTC leak detection |
| Cloud Sync | Low | Encrypted settings sync |
| Torrent Detail View | Low | Files, Peers, Trackers tabs |
| RSS Auto-Downloader | Low | Regex filtering |
| Keyboard Shortcuts | Low | Power user hotkeys |

### 🛑 Explicitly Excluded

| Feature | Reason |
|---------|--------|
| Aggregated Search | Use Prowlarr/Jackett instead |
| Ad Blocking | Use uBlock Origin instead |
| Novelty Themes | Keep UI professional |
| Synology Download Station | API complexity, low usage |
| Mobile/Responsive UI | Desktop extension, not beneficial |

---

## Quality Gates for v1.0

| Metric | Target |
|--------|--------|
| Unit Test Coverage | > 70% |
| E2E Critical Path Coverage | 100% |
| Lighthouse Accessibility | > 90 |
| Bundle Size (popup) | < 500KB |
| Time to Interactive | < 1s |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

---

*Last Updated: December 2025*
