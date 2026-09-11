# Building CTRL from source

This document is the authoritative build description for reviewers (for
example the Mozilla Add-ons source-code review) and for anyone who wants to
reproduce the published package bit for bit. It describes exactly what was
used to produce the release artefacts; nothing else is required.

## Environment

| Requirement | Version used for the release build | Notes |
|---|---|---|
| Operating system | Windows 11 (build host); Ubuntu 24.04 LTS is equally supported | The build is pure Node/npm and has no native or platform-specific steps |
| Node.js | 24.x (24.18.0 on the build host; `.nvmrc` pins 24; continuous integration uses 24) | Node 24.14.0 as used by the Mozilla reviewer environment is fine |
| npm | 11.x (11.16.0 on the build host; 11.9.0 in the reviewer environment) | `npm ci` installs the exact dependency tree from `package-lock.json` |
| Network | needed only for `npm ci` (public npm registry) | the build itself makes no network requests |
| Disk | ~600 MB for `node_modules` | |

No global tools are needed: `wxt`, `vite`, `typescript` and everything else
come from the lockfile. No web-based or proprietary tooling is involved.

## Commands

All commands run inside the `extension/` directory of the source archive.

```bash
cd extension
npm ci                     # exact dependencies from package-lock.json (runs `wxt prepare` via postinstall)
npm run build-for-amo      # = wxt zip -b firefox --mv3  → builds/firefox-mv3/ and builds/ctrl-extension-<manifest version>-firefox.zip
```

Chrome package:

```bash
npm run zip:chrome         # = wxt zip -b chrome → builds/chrome-mv3/ and builds/ctrl-extension-<package version>-chrome.zip
```

Unpacked directories only (no zip): `npm run build:firefox` / `npm run build:chrome`.

## Expected output

- `builds/firefox-mv3/` — 14 files: `manifest.json`, `background.js`, `popup.html`, `options.html`, `chunks/*.js` (3), `assets/*.css` (1), `_locales/en/messages.json`, `icon/*.png` (5). Unpacked size about 1.59 MB.
- `builds/ctrl-extension-<manifest version>-firefox.zip` — about 327 KB.
- The manifest `version` is the package version with any pre-release tag folded into a fourth integer (`0.2.0-beta.1` → `0.2.0.1`); `1.0.0` stays `1.0.0`. See `toManifestVersion` in `wxt.config.ts`.

## Determinism

The build is deterministic: two consecutive builds of the same source tree
produce byte-identical files (verified on the build host for both targets,
`sha256sum` over every file). Chunk names contain content hashes; there are
no timestamps, random values or environment-dependent paths in the output.
Reviewers rebuilding from the source archive with the versions above obtain
the same files as the uploaded package. If your rebuild differs, check first
that `npm ci` (not `npm install`) was used and that the lockfile was not
modified.

## What the build does not contain

- No remote code and no remote resources: the stylesheet build strips the
  IBM Plex `@font-face` rules that the Carbon design system ships (see
  `postcss.config.js`), so the package makes no third-party requests; the
  UI uses the system font stack.
- Only the `en` locale is packaged.
- Third-party libraries are used unmodified from their npm release versions
  (React, Carbon, Zustand, Zod, txml, lucide-react, TanStack Virtual).

## Source archive

`npm run zip:source` (run from a clean git tree) produces
`builds/source/ctrl-extension-<version>-source.zip` from `git archive HEAD`
with exactly the files needed to build: this document, the `LICENSE`, the
extension sources, tests, configuration and lockfile — no build output,
no local artefacts, no audit or process material.

## Verification (optional)

```bash
npm run compile            # TypeScript
npm run lint               # ESLint
npm test                   # Vitest unit and component tests
npx addons-linter builds/firefox-mv3
```
