# TRON to CTRL: Carbon UI Migration Runbook

**STATUS:** AUTHORITATIVE
**TARGET AGENT:** CTRL Compliance / Execution Agent
**OBJECTIVE:** Safe migration of `ctrl-extension` UI to IBM Carbon Design System.

---

## 1. Scope Confirmation (Strict Boundaries)

The **Carbon UI Migration** is strictly limited to **Zone A (Read/Write)** and **Zone B (Presentation Only)**.
All other zones are **FROZEN**.

### ✅ Zone A: Approved Write Access (UI Implementation)
- `extension/src/entrypoints/popup/` (Popup.tsx, etc.)
- `extension/src/entrypoints/options/` (Dashboard.tsx, etc.)
- `extension/src/shared/ui/layout/` (BentoGrid.tsx, Sidebar.tsx)
- `extension/src/shared/ui/components/` (Button.tsx, Card.tsx)
- `extension/src/features/torrent-control/ui/` (All Feature UI components)

### ⚠️ Zone B: Presentation Only (Class/Style Edits Only)
- `extension/src/shared/ui/SystemSettings.tsx`
- `extension/src/shared/ui/VPNIndicator.tsx`
- `extension/src/shared/ui/VersionOverlay.tsx`
- `extension/src/entrypoints/style.css`

### 🚫 Zone C: FROZEN (DO NOT TOUCH)
- **CRITICAL:** `extension/manifest.json` (FROZEN)
- **CRITICAL:** `extension/package.json` (FROZEN - *Requires Manual Exception*)
- `extension/wxt.config.ts`
- `extension/src/entrypoints/background.ts`
- `extension/src/shared/lib/**`
- `extension/src/shared/api/**`

---

## 2. Dependency Plan (Manual Intervention Required)

**NOTE:** The Automated Agent cannot modify `package.json`. A Human Operator must perform this step.

### Required Packages
Install the following dependencies to verify Carbon integration:
- **`@carbon/react`** (Use `^1.70.0` or latest v11 stable)
- **`@carbon/styles`** (Use `^1.70.0` or latest v11 stable)
- **`@carbon/icons-react`** (Use `^11.50.0` or latest stable)
- **`@ibm/plex`** (Use `^6.4.0` for local font hosting)

### Installation Command
```bash
cd extension
npm install @carbon/react @carbon/styles @carbon/icons-react @ibm/plex --save
```

---

## 3. Styling & Token Strategy

### Theme Integration
- **Global Imports:** Add Carbon styles to `extension/src/entrypoints/style.css`.
  ```css
  /* Zone B Edit Allowable */
  @import '@carbon/styles/css/styles.css';
  @import '@ibm/plex/css/ibm-plex-sans.css';
  ```
- **Context:** Wrap entrypoints (`Popup.tsx`, `Options/App.tsx`) with `<Theme theme="g100">` (Dark) or `"white"` (Light).

### Compliance Rules
1.  **NO Remote Fonts:** Use `@ibm/plex`. Do NOT import from Google Fonts.
2.  **NO Inline Styles:** Use Carbon classes (`cds--btn`) or Tailwind utilities.
3.  **NO CSS-in-JS injection:** Avoid libs that break CSP.

---

## 4. Component Mapping Table

| UI Element | Existing Code Path (Zone A) | Carbon Replacement | Adapter Strategy |
| :--- | :--- | :--- | :--- |
| **Button** | `shared/ui/components/Button.tsx` | `Button` | Wrapper needed to map `variant` prop to Carbon `kind`. |
| **Card** | `shared/ui/components/Card.tsx` | `Tile` / `ClickableTile` | Direct replacement. Use `Layer` for nesting. |
| **Grid** | `layout/BentoGrid.tsx` | `Grid` + `Column` | Enforce 16-col grid. Map existing `span` logic to `lg={8}` etc. |
| **Sidebar** | `layout/Sidebar.tsx` | `UIShell` / `SideNav` | Complex. May need custom styling to match Carbon Shell if full shell is too heavy. |
| **Input** | `features/**/Settings.tsx` | `TextInput` | Direct swap. |
| **Switch** | `features/**/Settings.tsx` | `Toggle` | Direct swap. Ensure `onToggle` matches signature. |
| **Tabs** | `features/**/Dashboard.tsx` | `Tabs` | Direct swap. |
| **Table** | `VirtualizedTorrentList.tsx` | `DataTable` | **Risk:** High virtual row count. Custom wrapper recommended. |

---

## 5. Execution Batching Plan

**Strategy:** Fail Fast. Build after every batch.

### Batch 1: Infrastructure
- **Files:** `style.css` (Zone B), `Button.tsx` (Zone A)
- **Goal:** Carbon styles load, IBM Plex renders, Button looks correct.
- **Rollback:** If font fails to load or styles break layout completely.

### Batch 2: Simple Inputs (Zone A)
- **Files:** `AppearanceSettings.tsx`, `ThemeSettings.tsx`
- **Goal:** Replace native inputs/selects with Carbon `TextInput`, `Select`, `Toggle`.
- **Rollback:** If settings fail to persist or UI becomes unusable.

### Batch 3: Dashboard Layout (Zone A)
- **Files:** `BentoGrid.tsx`, `MainLayout.tsx`
- **Goal:** Apply Carbon Grid system.
- **Rollback:** If strict 16-col grid breaks existing component sizing logic.

---

## 6. Verification Plan (Operator Steps)

### Build Verification
Run these commands after EACH batch:
```bash
npm run build:chrome
npm run build:firefox
```
*Expected Result:** `BUILD SUCCESS`.

### Compliance Inspection
1.  **CSP Check:**
    - Open Extension -> Inspect -> Console.
    - **PASS:** No red "Refused to execute..." messages.
2.  **Network Silence:**
    - Open Extension -> Inspect -> Network Tab.
    - **PASS:** No requests to `fonts.googleapis.com`, `unpkg.com`, or other CDNs.
3.  **Bundle Size:**
    - Check `extension/.wxt/chrome-mv3/content.js` (and chunks).
    - **PASS:** Total size increase < 2MB.

### Minimal Manual QA
1.  **Popup:** Open. Check Font (Must be IBM Plex). Click "Global Settings".
2.  **Options:** open. Toggle a setting. Ensure it saves.

---

## 7. Stop Conditions (Immediate Halt)

1.  **Zone C Violation:** If a requirement demands editing `manifest.json` or `background.ts` -> **STOP**.
2.  **CSP Errors:** If Carbon components inject dynamic styles that trigger CSP blocks -> **STOP**.
3.  **Remote Assets:** If a component tries to load an external icon/font -> **STOP**.
4.  **Logic Breakage:** If converting a component breaks the `onSave` or data flow -> **STOP** & Revert.

---
**Runbook Generated by:** TRON (Planning Agent)
**Date:** 2026-02-01
