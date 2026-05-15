# Current State

**Last updated:** 2026-05-15
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

## In Progress

- Phase 2 — Error Handling: graceful degradation, retry logic, truthful connection reporting (priority: P1).
- Operator WIP on `next/main-rebuild`: uncommitted changes to extension adapter and config files.

## Non-Blocking Open Items

- Two stale reference doc paths still mention the deleted `VPNIndicator.tsx`:
  - `docs/reference/carbon_ui_scope_manifest.md`
  - `docs/reference/tron_to_ctrl_carbon_runbook.md`
- Local reproducibility gap in the archived `remove-vpn` worktree (npm lint failed; CI passed; low priority).

## Not Yet Done

- Performance Tuning (5k+ torrent profiling and optimization) — not started.
- Accessibility (WCAG 2.1 AA) — not started.
- v1.0 store submission — pending Phase 2 completion.

## Known Constraints

- `next/main-rebuild` has uncommitted working-tree changes to several extension files; these are operator WIP and must not be discarded.
- RAIDEN install lives on `next/main-rebuild` only (cherry-picked); `main` also has the install from the original migration pass.
