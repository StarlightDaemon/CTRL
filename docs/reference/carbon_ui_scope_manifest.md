# Carbon UI Migration Scope Manifest

**AUTHORITATIVE DOCUMENT — DO NOT EDIT WITHOUT COMPLIANCE APPROVAL**

This manifest defines the STRICT BOUNDARY for the Carbon UI migration.
TRON agents must operate ONLY within Zone A (Read/Write) and Zone B (Presentation Tweak Only).
All other paths are FROZEN (Read Only) to prevent compliance regressions, permission drift, or functional breakage.

---

## A) Approved UI Paths (WRITE ALLOWED)

**ZONE A — UI-ONLY (Full Read/Write Access)**
*Refactoring, new components, and Carbon implementation allowed here.*

### Entrypoints
- `extension/src/entrypoints/popup/`
  - `Popup.tsx`
  - `index.html`
  - `main.tsx`
- `extension/src/entrypoints/options/`
  - `App.tsx`
  - `Dashboard.tsx`
  - `OptionsLayout.tsx`
  - `index.html`
  - `main.tsx`

### Shared UI Core
- `extension/src/shared/ui/layout/`
  - `BentoGrid.tsx`
  - `MainLayout.tsx`
  - `Sidebar.tsx`
- `extension/src/shared/ui/components/`
  - `Button.tsx`
  - `Card.tsx`

### Feature UI
- `extension/src/features/torrent-control/ui/`
  - `AboutTab.tsx`
  - `AddTorrentDialog.tsx`
  - `AppearanceSettings.tsx`
  - `Dashboard.tsx`
  - `DataManagement.tsx`
  - `DiagnosticsSettings.tsx`
  - `FunctionSettings.tsx`
  - `LayoutSettings.tsx`
  - `LegacySidebar.tsx`
  - `ServerConfigPanel.tsx`
  - `TorrentDashboard.tsx`
  - `Utilities.tsx`
  - `VirtualizedTorrentList.tsx`
  - `settings/ContextMenuSettings.tsx`
  - `settings/NotificationSettings.tsx`
  - `settings/PerformanceSettings.tsx`
  - `settings/ThemeSettings.tsx`

---

## B) UI-Adjacent Paths (PRESENTATION ONLY)

**ZONE B — UI-ADJACENT (Read / Presentation Write Only)**
*You may Edit styling or classNames ONLY. Do NOT change logic, imports, or functional behavior.*

- `extension/src/shared/ui/SystemSettings.tsx`
- `extension/src/shared/ui/VPNIndicator.tsx`
- `extension/src/shared/ui/VersionOverlay.tsx`
- `extension/src/entrypoints/style.css`

---

## C) Out of Scope UI-like Paths (DO NOT TOUCH)

**WARNING: These look like UI, but are NOT in Zone A/B.**
*Modifying these risks breaking frozen logic, security boundaries, or out-of-scope features.*

### Shared UI (Excluded)
- `extension/src/shared/ui/ErrorBoundary.tsx`
- `extension/src/shared/ui/Logo.tsx`
- `extension/src/shared/ui/PageHeader.tsx`
- `extension/src/shared/ui/PlaceholderPage.tsx`
- `extension/src/shared/ui/Toast.tsx`
- `extension/src/shared/ui/debug/DebugOverlay.tsx`
- `extension/src/shared/ui/security/` (SetupVault, UnlockVault, VaultGuard)
- `extension/src/shared/ui/settings/` (SettingsCard, SettingsPageLayout, SettingsToggle)
- `extension/src/shared/ui/ui/CommandPalette.tsx`

### Entities UI (Excluded)
- `extension/src/entities/torrent/ui/TorrentRow.tsx`

### App Providers/Styles (Excluded)
- `extension/src/app/providers/ThemeProvider.tsx`
- `extension/src/app/styles/global.css` (Only `style.css` in entrypoints is Zone B)

---

## D) Explicitly Excluded Paths (FROZEN / READ ONLY)

**ZONE C — FROZEN**
*Strictly forbidden. Any change here triggers immediate Rollback.*

- `extension/src/entrypoints/background.ts`
- `extension/src/shared/api/**`
- `extension/src/shared/lib/**`
- `extension/src/features/**/services/**`
- `extension/src/features/**/model/**`
- `extension/src/features/**/lib/**`
- `extension/wxt.config.ts`
- `extension/manifest.json`
- `package.json`

---

## Notes for TRON

1.  **Strict Boundary**: If a Carbon requirement implies changing a file in Section C or D, **STOP**. Do not implement. Flag for manual review.
2.  **No Scope Creep**: Do not "fix" the out-of-scope UI files to match Carbon. Leave them inconsistent if necessary. Safety > Consistency.
3.  **Presentation Only**: For Zone B, if the logic is tightly coupled to the UI (e.g. conditional rendering based on internal state), tread lightly. Prefer CSS-only changes or simple class swaps.
