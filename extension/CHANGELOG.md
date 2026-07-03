# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ⚠ BREAKING CHANGES
- **Synology Download Station Removed**: Synology is no longer a supported torrent client. `SynologyAdapter`, its error/schema classes, unit tests, and its `ClientFactory`/`CLIENT_LIST` registrations have been deleted; existing Synology server configurations will no longer resolve to an adapter and cannot be used. Support-matrix references removed from README.md and docs/BETA_TESTING.md.

### 🛡️ Error Handling (Phase 2 / OL-001)
- **AdapterError Hierarchy**: Introduced a shared `AdapterError` base with typed `<Client>AdapterError` subclasses for all nine adapters (Transmission, Aria2, Deluge, Flood, qBittorrent, ruTorrent, Synology, uTorrent, BiglyBT; Vuze inherits Transmission's coverage).
- **withAdapterRetry**: Added a canonical retry/backoff helper (`RetryConfig`, lifted from and re-exported by BiglyBTSchema) wired into each adapter's connection probe.
- **Truthful `testConnection`**: Changed the `testConnection` contract to return `AdapterConnectionResult` (`{ connected, error? }`) instead of a bare boolean, so connection failures surface real error detail instead of silently reporting false.
- Fixed a BiglyBT `classifyError` gap where a `PLUGIN_MISSING` condition wasn't classified correctly.
- Roughly ten commits implementing the above; full unit suite passed at the time (539 tests).

### 🔒 Security Hardening (2026-07-02 audit remediation)
- **Dependency Fixes**: Upgraded `wxt` (0.19.29 → 0.20.27) and `vitest` (4.0.15 → 4.1.9); pinned `esbuild`/`fx-runner`/`tmp`/`uuid` via npm overrides to close remaining transitive advisories. Migrated `wxt` 0.20 import paths (`wxt/sandbox` → `wxt/utils/define-background`, `wxt/storage` → `wxt/utils/storage`) and pinned `publicDir` in `wxt.config.ts`.
- **Sender Validation**: Added `isTrustedSender` checks (against `chrome.runtime.id`) to the background script's `onConnect`/`onMessage` listeners, rejecting untrusted senders before any privileged action (client creation, vault access, network requests) can run.
- **CSP Tightening**: Removed the unused `declarativeNetRequest` permission (dead since DNR removal) and dropped `data:`/`blob:` from the CSP `connect-src`.
- **CI Action Pinning**: Aligned `auto-localize.yml` to Node 22 (matching `ci.yml`/`.nvmrc`) and pinned `stefanzweifel/git-auto-commit-action` to a commit SHA instead of the mutable `v5` tag.
- **License Year Correction**: Corrected the LICENSE copyright year to match the repo's actual first commit.

### 🔧 Bug Fixes
- **LifecycleAdapter.parseDOM**: Replaced a stub that returned a non-structured-clone-safe raw `Document` with a serializable `ParsedDOMResult`/`ParsedDOMNode` tree, following the existing extract-to-serializable convention. Also fixed a defect where per-node text capture dropped nested inline markup (e.g. `<mark>`-wrapped highlighted terms), now using full descendant text.

### 💎 Core Architecture & Release Operations
- **Firefox Source Packaging**: Added a clean-tree AMO source archive generation step for compliant release packaging.
- **Build Maintenance**: Cleaned up source archive pathspecs to accommodate test directory removals.

### ✅ Testing & Reliability
- **Runtime Carry-Forward**: Restored non-VPN runtime features and their corresponding adapter tests.
- **Test Optimization**: Cleaned up the test surface by removing stale, duplicate Playwright E2E specs.
- **Validation Fixes**: Corrected RuTorrent property mappings to unblock the adapter unit tests.

### 📖 Documentation
- **Product Docs**: Updated and carried forward public product documentation to match the rebuilt branch.

## [0.2.0-beta.1] - 2026-01-11

### 💎 Core Refinement (Major)
- **Site Integration Separation**: Successfully completely decoupled all site-specific integrations (1337x, Nyaa, etc.) from the core extension. The project is now a pure, store-compliant torrent management tool.
- **Codebase Cleanup**: Removed 7+ integration modules, significantly reducing bundle size and complexity.
- **Architecture**: Relocated shared UI components (`Card`, `Button`) to the core shared library.

### ✅ Testing & Quality
- **Unit Tests**: Achieved **153 passing unit tests**. Verified stability of all 9 client adapters and vault security.
- **CI/CD**: Fixed critical CI pipeline issues by adding missing `test:e2e` script.
- **Linux Compatibility**: Verified build and test processes on Linux environments (Ubuntu 24.04).

### 📖 Documentation
- Added `docs/E2E_TROUBLESHOOTING.md` guide for diagnosing environment-specific testing issues.
- Updated Project Status Report to reflect the new "Core Only" state.

## [0.1.33] - 2025-12-19

### 🔧 Bug Fixes
- **TransmissionAdapter**: Fixed `removeTorrent` not passing torrent ID to API call (critical bug).
- **1337x Integration**: Re-enabled disabled check so users can toggle the integration off.
- **Types**: Fixed `NodeJS.Timeout` to browser-compatible `ReturnType<typeof setInterval>`.
- **Types**: Replaced `any` types with proper `NyaaOptions` and `ABBSettings` interfaces.
- **NyaaOptions**: Added missing `filterPanel`, `infiniteScroll`, `magnetLinks` properties.

### ✅ Testing
- Added 18 unit tests for `DelugeAdapter`
- Added 16 unit tests for `Aria2Adapter` (JSON-RPC multicall)
- Added 17 unit tests for `FloodAdapter` (JWT auth, tag management)
- Added 14 unit tests for `RuTorrentAdapter` (XML-RPC parsing)
- Added 17 unit tests for `UTorrentAdapter` (token auth, bitmask status)
- Test suite now at **106 tests** (up from 24, 4.4x increase)

## [0.1.32] - 2025-12-17

### 🔧 Maintenance
- Project maintenance and documentation updates.

## [0.1.28] - 2025-12-14

### 🚀 Data Management & Cleanup
- **Data Tools**: Implemented new Import/Export system. Separated "System Backup" (Global Settings) from "Server Migration" (Servers Only).
- **Security**: Added "Sanitized Export" option to strip passwords from system backups.
- **Cleanup**: Removed deprecated "Local Snapshots" feature.
- **Themes**: Removed Novelty, Brand, and Browser themes to streamline options. Retained "Main Line" and "Color Edition".

### 🐛 Fixed
- Resolved `exportSystemBackup` startup crash.

### ⚡ Changed
- Applied Dark Theme to Vault Setup & Guard screens.

## [0.1.27] - 2025-12-14

### 🚀 Final Polish
- **Connection**: Implemented Multi-Server DNR Support (Localhost + Remote IP can now coexist without rule conflicts).

### 🐛 Fixed
- **UI**: Fixed "Blurry Bar" artifact in Global Transfer card by removing broken shimmer effect.
- **Authentication**: Fixed `401 Unauthorized` issues when testing connections to non-active servers.
- **Logic**: Fixed "Add Paused" bug where global 'Pause by default' setting was ignored for drag-and-drop actions.
- **Stability**: Fixed `ReferenceError: poll is not defined` crash in background worker.

## [0.1.20] - 2025-12-09

### 🚀 Added
- **Project Prism**: Implemented the new "Prism" design system.
- **Components**: Added `CommandPalette` (Cmd+K) and `BentoGrid` layout.
- **Dashboard**: Refactored the main dashboard to use a modern bento-style layout.
- **Theming**: Introduced 'Linux', 'Glass', and 'Linear' themes with a dynamic theme engine.

## [0.1.15] - 2025-12-08

### 🚀 Added
- **UI Overhaul**: Complete redesign of the Options page to match the legacy "Torrent Control Reloaded" layout (Full-screen, compact sidebar).
- **Themes**: Added "Cyberpunk" theme with Neon Pink/Cyan styling.
- **Settings**: Added "Settings" gear to the sidebar for quick access.
- **Search**: Added theme-aware styling to the AudioBook Bay category search box.

### ⚡ Changed
- **Architecture**: Refactored Settings components to remove duplicates (`NotificationSettings`, `ContextMenuSettings` removed from `AppearanceSettings`).
- **Performance**: Optimized background script to silence "No configuration found" errors when no servers are configured.
- **UX**: Reordered Theme list to prioritize Browsers and Colors.

### 🐛 Fixed
- **Context Menu**: Fixed `previewServers is undefined` error in Context Menu settings.
- **Notifications**: Fixed missing props in Notification settings.

## [0.1.10] - 2025-12-06

### 🚀 Added
- **Site Integrations**: Support for active mirrors (`rargb.to`, etc.).
- **Shared Core Library**: Standardized component system for all site integrations to ensure stability and consistent UI.

### 🐛 Fixed
- **Firefox Build**: Resolved issue with missing content scripts in the final build artifact.
- **TorrentGalaxy**: Migrated to the new shared component system for better performance.

## [0.0.1] - 2024-11-20

### Added
- Initial WXT setup.
