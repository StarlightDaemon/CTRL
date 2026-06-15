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

## D-003

| D-003 | 2026-06-14 | History rewrite: `extension/tests/e2e/.persistent-data/` removed from all commits via `git filter-repo`. Google API key (`AIzaSy...KCYM`) revoked in Google Cloud Console and secret scanning alert closed as Revoked. All four remote branches force-pushed. |

## D-004

| D-004 | 2026-06-14 | Maintenance pass: hook exec-bit fixed, .persistent-data/ untracked and ignored, .raiden/ exec-bit drift normalized, npm audit fix applied (vite 7.3.3→7.3.5, esbuild 0.27.2→0.27.7, shell-quote 1.8.3→1.8.4), stale VPN doc references removed. |
