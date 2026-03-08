Unknown State

# Local Network Access (LNA) & Permissions Audit

## 1. Evidence Alignment

**How match patterns are computed:**
- `extension/src/shared/lib/permissions.ts:7-10`: The `toMatchPattern` function parses the URL and correctly strips the path, returning the origin wildcard format (e.g., `http://localhost:8080/*`).

**When permissions are checked vs requested:**
- **Checked:** `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx:60`. `checkHostPermission` is triggered on every update to `tempServer.hostname` via a React `useEffect`.
- **Requested:** `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx:65`. `requestHostPermission` is conditionally triggered by a user gesture when clicking the "Grant Permission" / "Grant Local Access" button inside `handleGrantPermission`.

**When LNA warning is shown & what hostnames count as "private":**
- **Warning Shown:** `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx:314-318`. Shown when the user lacks host permissions (`!hasPermission`) AND the hostname matches a private IP (`isPrivateIP(tempServer.hostname)`).
- **Private Hostnames:** `extension/src/shared/lib/network.ts:9-25`. Evaluates to true for `localhost`, `127.0.0.1`, `10.x.x.x`, `172.16.x.x`–`172.31.x.x`, and `192.168.x.x`.

## 2. Findings

- **CONFIRMED BEHAVIOR:** The extension correctly transforms arbitrary server URLs into origin-based match patterns to properly satisfy `chrome.permissions` requirements without path mismatches.
- **ROOT CAUSE:** The "Save Server" button (`ServerConfigPanel.tsx:353-356`) is explicitly disabled if the Vault is locked, but completely ignores whether the user has actually granted host permissions.
- **SYMPTOM:** Due to the missing validation on save, a user can enter a local IP, see the explicit LNA permission warning, ignore the "Grant Local Access" button entirely, and successfully save the server configuration. Background fetches will then silently fail or timeout at runtime due to native MV3 blocked network permissions.

## 3. Next Action
**Block server saves when host permissions are missing.**

## 4. Execution Prompt

**Agent:** Implementation Agent
**Target File:** `extension/src/features/torrent-control/ui/ServerConfigPanel.tsx`

**Objective:**
Prevent the user from saving a server configuration if they have not successfully granted host permissions for the target address. 

**Instructions:**
1. In `ServerConfigPanel.tsx`, update the "Save Server" button's `disabled` prop to block saving when the Vault is locked OR when `hasPermission` is false.
   *Example:* `disabled={vaultStatus === 'Vault: Locked' || !hasPermission}`
2. Update the button's styling payload so it correctly appears disabled (desaturated colors/muted hover FX) whenever `disabled` evaluates to true.
3. Validate that you are only modifying the `disabled` and `className` properties of the "Save Server" button. No other components or subsystems are to be modified.

**Regression Check:**
Manually review the component UI to verify that a user can no longer save a `192.168.x.x` server if the state of `hasPermission` evaluates to `false` without first explicitly granting Local Access permission.
