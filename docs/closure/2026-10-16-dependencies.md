# CTRL dependency remediation

> **Final correction:** the five additional advisories recorded below have now
> been resolved. See the [final security closure report](2026-10-16-final-security.md).
> This document retains the earlier correction's evidence and audit snapshot.

The operator requested a one-time correction for the critical shell-quote and
medium brace-expansion findings from the [closure report](2026-10-15.md), followed
by verification and re-archiving. CTRL remains deprecated under D-007; D-008
records this limited correction.

## Patched dependencies

| Package | Previous | Patched | Advisory |
| --- | --- | --- | --- |
| shell-quote | 1.9.0 | 1.11.0 | [GHSA-pqg4-j6r4-53mv](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv), critical, GitHub alert 95 |
| brace-expansion, root instance | 1.1.18 | 1.1.21 | [GHSA-q2hr-2g5m-vwhr](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr), medium |
| brace-expansion, typescript-estree instance | 2.1.4 | 2.1.7 | Same advisory; GitHub alert 93 identified the 2.x instance |

The existing shell-quote override is retained because fx-runner requests an
older exact release. Both brace-expansion updates satisfy the existing minimatch
semver ranges. Only those three package entries and the shell-quote override
change; application source and dependency major versions are unchanged.

## Verification

Verification uses Node 24.18.0 and npm 11.16.0 on a clean worktree based on
`52741ed`, preserving the original checkout's existing changes.

- A clean `npm ci` succeeds, including WXT type generation.
- Installed and locked package versions agree at all three affected locations;
  `npm ls shell-quote brace-expansion --all` confirms the complete dependency tree.
- The shell-quote advisory input throws `TypeError` for all four line terminators
  (LF, CR, U+2028 and U+2029), without executing a shell. Normal quoting passes.
- Both brace-expansion installations process the advisory input with 128,000
  closing braces within a two-second subprocess limit. Normal expansion passes.
- TypeScript compilation passes. ESLint reports zero errors and 13 existing warnings.
- Chrome and Firefox packages build successfully, each with the expected 14 files
  and manifest version `0.2.0.1`. ZIP sizes are 326,574 and 326,651 bytes.
- All 28 files across the two browser packages are byte-identical to the existing
  pre-fix builds in the original checkout.
- All 717 unit and component tests pass across 32 files with two workers.
- Current npm audit output contains neither shell-quote nor brace-expansion, and
  reports zero critical vulnerabilities. Additional findings remain below.

The first sandboxed unit run could not load tests because of temporary-file
rename restrictions. A subsequent unrestricted run passed 716 tests and timed
out on one form test while browser builds were running. The final run with two
workers after the builds passes all 717 tests.

GitHub confirms alerts 95 and 93 as `fixed` at `2026-10-16T17:17:47Z` after
publication of commit `24fd2e2`. [CI run 38938578322](https://github.com/StarlightDaemon/CTRL/actions/runs/38938578322)
completed successfully on that commit: lint, test, package and e2e all passed.
The final evidence update changes documentation only; the tested dependency
files remain unchanged.

## Additional audit findings

The 2026-10-16 npm audit reports five distinct advisories beyond the two requested
findings. npm expands them into 14 affected-package entries: 12 high and two
moderate. Cascaded parent entries are not separate vulnerabilities. Each root
package version below is unchanged from the baseline. OL-018 records their
unresolved disposition.

| Root package | Installed | Severity | Available remediation |
| --- | --- | --- | --- |
| [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | 3.0.3 | High | No patched package release is listed. npm proposes a Tailwind major migration to remove the affected chain. |
| [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | 1.4.0 | High | No patched package release is listed. npm proposes a WXT major migration to remove the affected chain. |
| [postcss-selector-parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | 6.1.4 | Medium | Patched in 7.1.6; current parent constraints require 6.x, so a coordinated update or reviewed override is needed. |
| [sharp](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | 0.35.4 | High | Patch release 0.35.5 is available. |
| [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | 1.2.1 | High | Patch release 1.2.2 is available. |

`npm audit --omit=dev` still reports the source-map-js finding through the
production-declared styling dependency chain. The other four roots are marked
development dependencies. These classifications do not establish exploitability
in the packaged extension, and this correction does not claim a clean global
dependency audit.

## Publication and archive

The repository is temporarily unarchived only for publication and GitHub
verification, then returned to read-only archival with Actions disabled. Final
archive settings, Dependabot disposition and CI results are confirmed in the
operator closeout. The previously documented Chromium key history and OL-011
are unaffected by this dependency correction.

Detailed local evidence is retained under
`.audits/dependency-remediation-2026-10-16/` in the original checkout and is not
published. The original uncommitted RAIDEN and Serena work is not included in
the remediation commit.
