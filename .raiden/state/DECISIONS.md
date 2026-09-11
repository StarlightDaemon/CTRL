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

## D-005

- Date: 2026-07-26
- Status: Active
- Decision: record as established fact that the exposed Google/Chromium API key is reachable from the **public** repository, not only from the local clone. The 2026-07-26 audit's first pass characterized the exposure as local-only, resting on the claim that the `pre-dependabot-delete-backup` tag was never pushed to `origin`. That claim is technically true — `git ls-remote --tags origin` returns no tags — but materially incomplete: `git ls-remote origin` resolves `refs/pull/3/head` to `15ffee9534d732e44727ad370458217340798122`, the identical commit object as the local tag, and `gh repo view` reports the repository visibility is PUBLIC. The audit's adversarial second pass established this and corrected the finding in place.
- Rationale: GitHub retains `refs/pull/<n>/head` permanently and immutably, independent of whether the source branch was deleted. Because the remote ref names the same commit object as the local tag, it carries the same tree and the same 16 cache blobs under `extension/tests/e2e/.persistent-data/Default/Cache/Cache_Data/`. Two consequences follow and are the reason this is recorded rather than left in the audit report alone: deleting the local tag remediates nothing, and no client-side git operation can remove the remote copy. The blast radius on record is therefore internet-exposed, not single-machine.
- Note: this entry records a fact established by audit, not a remediation decision. No decision has been taken on verifying provider-side rotation or on pursuing a GitHub Support purge of the PR-3 ref; both are tracked as open items in OPEN_LOOPS.md OL-011. Mitigating context recorded but not adjudicated: the flagged value is documented as the public Chromium omnibox suggest key, and D-003 declares it revoked on 2026-06-14 — a declared date, which no repository-bound audit can verify. Related: the tracked and publicly readable `.raiden/state/CURRENT_STATE.md` records the key fragment, its exact in-tree path, the commit, and the residual ref.

## D-006

- Date: 2026-07-26
- Status: Active
- Decision: record as a correction to the record that the technical justification documented for the `@vitejs/plugin-react` hold (OPEN_LOOPS.md OL-006, written 2026-07-04) was factually inaccurate as of this date. The 2026-07-26 audit checked its premises against installed and live upstream state; three failed. It recorded the installed vite as "4.x" when the installed version is `7.3.5`. It named a conflicting `@wxt-dev/module-react@1.1.5` peer range of `^4.4.1 || ^5.0.0` when that package declares `{wxt: '>=0.19.16'}` and no vite peer at all, so the named conflict did not exist. And it stated the WXT ecosystem had not moved to support vite 8 when `@wxt-dev/module-react@1.2.2` declares `vite: ^5.4.19 || ^6.3.4 || ^7.0.0 || ^8.0.0-0` and the installed `wxt@0.20.27`'s own vite dependency range already includes `^8.0.0-0`.
- Rationale: the hold's conclusion remains correct — `@vitejs/plugin-react@6.0.4` requires `vite@^8.0.0` plus new `@rolldown/plugin-babel` and `babel-plugin-react-compiler` peers, while the project runs vite `7.3.5` — but the recorded reason pointed at an upstream gap that has since been satisfied. A planner reading OL-006 as originally written would wait for something that has already happened, and would be working from a vite version three majors out of date. The corrected justification, and the gate change from `upstream` to `local`, are recorded in OL-006 itself.
- Note: this entry records a correction to the record, not a decision to act. OL-006 remains Open and no decision has been taken on performing the vite 7 → 8 migration. By contrast the Babel 8 hold (OL-005) was re-verified in the same pass as fully accurate and required no correction.
