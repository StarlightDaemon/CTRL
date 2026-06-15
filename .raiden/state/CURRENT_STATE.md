# Current State

**Last updated:** 2026-06-14
**RAIDEN Edict version:** v1.0.0
**Active branch:** `next/main-rebuild` (ahead of origin by several commits + RAIDEN install)
**CI:** passing on `main` (GitHub CI: lint, test, build, e2e)

---

## Project

CTRL is a browser extension for managing BitTorrent clients. Built with WXT, React, and TypeScript. Supports 10 torrent clients (qBittorrent, Transmission, Deluge, Flood, ruTorrent, uTorrent, BiglyBT, Vuze, Aria2, Synology). MIT licensed.

**Status:** Beta / Active Stabilization — Phase 2 Technical Excellence in progress.
**Target:** v1.0 Chrome Web Store and Firefox Add-Ons release.

---

## Confirmed Current State

- Beta release shipped (January 2026); beta distribution and Privacy Policy remain in place.
- Mainline rewrite (`next/main-rebuild`, PR #1) merged into `main` (2026-04-10).
- Dormant VPN tooling removed (`remove/vpn-tooling`, PR #2) merged into `main` (2026-04-13).
- Deterministic CI in place: tracked `extension/package-lock.json`, `npm ci`, npm caching.
- Chrome and Firefox build paths both verified.
- RAIDEN Instance installed at Edict v0.4.0 (2026-05-15, cherry-picked onto `next/main-rebuild`).
- VPN removal complete (2026-06-14): source files and tests removed in cherry-pick b09590a; orphaned docs removed in 9c721b9; `git ls-files | grep -i vpn` returns empty.
- FORK_REVIEW_PROTOCOL.md committed (3321d9c).
- Edict v0.6.1 → v1.0.0 upgrade (2026-06-14, commit 671bee0): all six writ files updated, OWNERSHIP_BOUNDARY.md retired, MODEL_TIERS.md added, root AGENTS.md refreshed (stale WSL path removed), baseline.json reconciled. Plan validator: no anomalies.

## In Progress

- Phase 2 — Error Handling: graceful degradation, retry logic, truthful connection reporting (priority: P1).
- 2026-06-13 — hook exec-bit fixed, .gitignore e2e noise cleared, state synced to Edict v0.6.1.
- 2026-06-14 — VPN removal finalized, Edict v1.0.0 installed, working tree clean.

## Non-Blocking Open Items

- Secret scanning alert: Google API key revoked and path gitignored (2026-06-14). Blobs remain in packed history; no urgency.

## Not Yet Done

- Performance Tuning (5k+ torrent profiling and optimization) — not started.
- Accessibility (WCAG 2.1 AA) — not started.
- v1.0 store submission — pending Phase 2 completion.

## Known Constraints

- RAIDEN install lives on `next/main-rebuild` only (cherry-picked); `main` also has the install from the original migration pass.
- `next/main-rebuild` is ahead of origin by several commits; not yet pushed.
