# Vault Status Indicator & Save Guard Verification Report

## 1. What Changed
- **`extension/src/features/torrent-control/ui/Dashboard.tsx`**: Added a Vault status indicator pill utilizing `useState` and `setInterval` to the main header block (rendered alongside `dashboardTitle`).
- **`extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`**: Added identical Vault status polling, and injected an inline save guard near the action buttons.
- **Note**: `extension/src/shared/ui/PageHeader.tsx` was not modified since the placement fit directly inside the Dashboard and Server configuration panels.

## 2. Why It Was Changed
Without an explicit UI guard before saving, the user interaction pattern allows a "Save" action when the Vault is locked. As observed in `extension/src/features/torrent-control/model/useSettings.ts` (specifically inside the `updateSettings` function), if `VaultService.isLocked()` returns true, Vault persistence correctly throws an error. If not explicitly guarded in the UI layer prior to interaction, the user might perceive successful transient inputs that eventually clash with backend reality ("appears saved but not persisted" or sudden error popups). By proactively disabling the "Save Server" action and actively rendering Vault status, the UI prevents the user from assuming their edits can be persisted while the Vault is locked.

## 3. Verification Checklist
- **Where the status renders**: 
  - **Dashboard**: Rendered as a pill next to the `dashboardTitle` text in the header.
- **Exact states displayed**: 
  - `Vault: Uninitialized` (Warning styling: `bg-[var(--cds-support-warning)] text-black`)
  - `Vault: Locked` (Error styling: `bg-[var(--cds-support-error)] text-white`)
  - `Vault: Unlocked` (Success styling: `bg-[var(--cds-support-success)] text-white`)
- **Save button disabled condition**: In `ServerConfigPanel.tsx`, the `Save Server` button has the attribute `disabled={vaultStatus === 'Vault: Locked'}` and applies a grayed-out `cursor-not-allowed` background class when locked.
- **User-facing message text when locked**: A red inline `<span>` element explicitly displays `Unlock vault to save` alongside the Save button.

## 4. Risks / Gaps
- **Polling Delay**: Because the Vault status relies on a 2-second interval (`setInterval`), a user who quickly locks the vault via another mechanism might have a ~2-second window where the Save button is still active. This would eventually result in an caught exception upon save attempt fallback in `updateSettings`.
- **No In-place Unlock Action**: The guard informs the user to unlock the vault, but does not offer an inline password prompt to perform the unlock natively inside the `ServerConfigPanel` or Dashboard.

## 5. Next Step Recommendation
Implement an event-driven global Vault state listener or Context Provider to replace the independent 2-second interval polling, ensuring instantaneous UI reactivity across all settings pages without redundant data fetching.
