# CTRL Roadmap

> **Strategic direction for the CTRL browser extension**

Status note: This roadmap is strategic direction, not the public live-status page. Use [docs/BETA_TESTING.md](docs/BETA_TESTING.md) for the current beta-status and tester-facing state.

---

## Vision

Transform CTRL from a working port into a **Best-in-Class** torrent management solution with:
- 🚀 Performance for 10k+ torrents
- 🌍 Full internationalization
- 🔒 Enterprise-grade security

---

## Current Status: Post-Beta Stabilization (March 2026)

### ✅ Current Baseline
- **Phase 1: Beta Release** shipped in January 2026
- **Maintained validation baseline** is documented in `docs/CI_BASELINE.md`
- **Deterministic CI** is restored with tracked lockfile, `npm ci`, and npm caching
- **Mainline rewrite and normalization** are complete
- **Privacy Policy** and beta distribution remain in place

### 🚀 Phase 2: Technical Excellence (In Progress)
- **Focus**: Stability, Error Handling, Performance Tuning, Accessibility, and stronger validation after beta

### 🟡 P1 - Important

| Goal | Description | Status |
|------|-------------|--------|
| **Stability** | Keep `main`, CI, and release builds operational after beta | ✅ Active |
| **Error Handling** | Graceful degradation, retry logic, truthful connection reporting | 🟡 In Progress |
| **Performance Tuning** | Profile and optimize 5k+ torrent handling | 📋 Not Started |
| **Accessibility** | WCAG 2.1 AA compliance | 📋 Not Started |

### Recently Completed Post-Beta Infrastructure

- Deterministic CI normalization with tracked `extension/package-lock.json`
- Mainline rewrite completed with archived pre-rewrite history
- Ongoing Chrome and Firefox build verification during stabilization

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
| VPN Integration Check | Medium | ⏳ Deferred to v0.4.x+; prototype archived |
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

*Last Updated: April 2026*
