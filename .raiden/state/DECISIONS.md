# Decisions

## D-001

- Date: 2026-04-10
- Status: Active
- Decision: the mainline rewrite (`next/main-rebuild`) is the canonical codebase going forward; pre-rewrite history is archived under `archive/` branches.
- Rationale: the original codebase required a full structural rebuild; the rewrite normalizes the extension architecture, CI, and test baseline. Archived branches preserve pre-rewrite history for provenance.

## D-002

- Date: 2026-04-13
- Status: Active
- Decision: dormant VPN tooling (`VPNService.ts`, `VPNProviderRanges.ts`, `VPNIndicator.tsx`, associated tests) is removed from the extension source.
- Rationale: the VPN detection feature was not shipped and had no active consumers. Removing it reduces the attack surface and eliminates dead code from the published extension.
- Note: two stale reference doc paths still mention `VPNIndicator.tsx` (low severity; see OPEN_LOOPS.md OL-002).
