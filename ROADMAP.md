# CTRL Roadmap

> **Strategic direction for the CTRL browser extension**

---

## Vision

Transform CTRL from a working port into a **Best-in-Class** torrent management solution with:
- 🚀 Performance for 10k+ torrents
- 🌍 Full internationalization
- 🔒 Enterprise-grade security

---

## Current Status: v0.2.0-beta.1 (Jan 2026)

### ✅ Completed
- **Phase 1: Beta Release** (Jan 2026)
  - Public GitHub Release
  - 153 Unit Tests passing
  - CI/CD Pipeline active
  - Privacy Policy published

### 🚀 Upcoming: Phase 2 (Technical Excellence)
- **Focus**: Stability, Performance Tuning, E2E testing

### 🟡 P1 - Important

| Goal | Description | Status |
|------|-------------|--------|
| **Performance Tuning** | Profile and optimize 5k+ torrent handling | 📋 Planned |
| **Error Handling** | Graceful degradation, retry logic | 📋 Planned |
| **Accessibility** | WCAG 2.1 AA compliance | 📋 Planned |

---

## Medium-Term Goals (v0.3.x - v0.5.x)

### Performance Engine

- [x] **Diffing Engine** - RFC 6902 JSON-Patch for incremental updates ✅
- [ ] **Virtualized State** - Window-based fetching (visible rows only)
- [ ] **WebSocket Keepalive** - Chrome 116+ persistent connections

### Internationalization

- [x] **7 Core Languages** - de, en, es, fi, fr, ru, zh_CN ✅
- [ ] **Build Pipeline** - Nested JSON → Chrome flat format
- [x] **Type-safe i18n** - Generated TypeScript keys (`MessageKeys.ts`) ✅

---

## Long-Term Goals (v1.0+)

### 🔮 Future Features

| Feature | Priority | Notes |
|---------|----------|-------|
| VPN Integration Check | Medium | ⏳ Deferred to v0.4.x+ |
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

*Last Updated: January 2026*

