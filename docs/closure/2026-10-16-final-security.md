# CTRL final security closure report

All five remaining dependency advisories have been resolved. Full and
production-only npm audits report zero vulnerabilities. CTRL remains deprecated;
this is the operator-requested security correction before returning the
repository to read-only archival, not a resumption of product development.

## Advisory disposition

| Advisory | Previous dependency | Final disposition |
| --- | --- | --- |
| [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | braces 3.0.3, high | Removed entirely. Tailwind 4.3.3 and unimport 6.5.0 remove the affected globbing chains. |
| [node-forge signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | node-forge 1.4.0, high | Removed entirely. WXT 0.21.4 no longer uses web-ext-run, and its optional web-ext browser runner is omitted. |
| [PostCSS selector parsing](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | postcss-selector-parser 6.1.4, medium | Removed entirely with the Tailwind 4/PostCSS migration. No unsupported cross-major override is used. |
| [sharp librsvg vulnerability](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) | sharp 0.35.4, high | Upgraded to 0.35.5. Bundled librsvg 2.63.2 and SVG-to-PNG conversion verified. |
| [source-map-js section offset exhaustion](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | source-map-js 1.2.1, high | Upgraded to 1.2.2 throughout the lockfile. Invalid, oversized and cumulatively oversized section offsets are rejected. |

The first two packages have no patched upstream releases listed. Removing their
dependency chains resolves the findings without maintaining a local fork of
cryptographic or glob-parsing code. No advisory among these five remains unfixed.

The earlier shell-quote and brace-expansion corrections remain effective; their
vulnerable versions are not reintroduced. The previous
[remediation report](2026-10-16-dependencies.md) is retained as a historical snapshot.

## Compatibility changes

- WXT 0.21.4 uses an explicit Vite 7.3.5 peer. The existing configuration and
  browser floors remain in place. Archive names continue to use Chrome's
  version_name and Firefox's manifest version.
- Development commands build and watch but no longer open a browser
  automatically. Load the extension manually as described in the
  [development guide](../DEVELOPMENT.md). Production installation is unchanged.
- Tailwind 4.3.3 uses its dedicated PostCSS plugin. Carbon is placed in the
  component layer so layout utilities retain precedence. Existing theme tokens,
  spacing, typography, system fonts and relevant utility semantics are preserved.
  Remote font stripping remains enabled.
- Application version, browser permissions, client adapters and vault behavior
  are unchanged. Updated build metadata is recorded in the lockfile.

## Verification

The correction was prepared in a clean worktree from `22d851d`, using Node
24.18.0 and npm 11.16.0, without including the original checkout's local changes.

- Clean `npm ci`, including WXT preparation, passes.
- Full `npm audit` and `npm audit --omit=dev` both report zero vulnerabilities.
- `npm ls --all --json` reports no dependency problems. All resolved tarballs use
  the npm registry; the newly added packages match the upgraded build toolchains.
- TypeScript passes. ESLint reports zero errors and 13 existing warnings.
- All 717 unit and component tests pass across 32 files.
- Targeted source-map checks reject 12 invalid or oversized offset cases and
  preserve a valid mapping round trip. sharp converts an SVG to an 8-by-8 PNG
  with the expected red pixels, using librsvg 2.63.2.
- Chrome and Firefox production packages build successfully, each with 14 files
  and manifest version `0.2.0.1`.
- Headless Chrome 155 verifies the real vault setup flow and computed layout:
  32-pixel Carbon tile padding, 24-pixel title and system font stack. Setup and
  dashboard screenshots were visually reviewed. An additional browser test
  guards the Carbon/Tailwind cascade interaction in CI.
- GitHub CI includes an explicit dependency audit on Linux, alongside the existing
  lint, tests, deterministic package checks, Mozilla validation and browser smoke
  tests. Its final result is recorded in the operator closeout.

## Remaining limits and archive

No unresolved dependency finding from this five-advisory pass remains. The
historical Chromium key exposure and provider-side revocation question tracked
by OL-011 are unchanged; a clean dependency audit is not a new credential audit.

The repository is temporarily unarchived only to publish and verify this
correction. It is then re-archived with Actions disabled. Final GitHub alert
states, CI results and archive settings are verified in the operator closeout.

Local audit output, regression scripts, logs and screenshots are retained under
`.audits/remaining-advisories-2026-10-16/` and excluded from publication. Existing
local work is preserved. D-009 records the correction; OL-018 records the loop
disposition. No Writ or local overlay files were changed.
