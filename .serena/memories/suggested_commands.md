# Suggested Commands

Run from **`extension/`** (npm scripts in `extension/package.json`). Repo root is
`/Users/dante/Citadel/CTRL`; governance in `.raiden/state/`.

## Dev / build
- `npm run dev` — Chrome dev build (WXT, hot reload).
- `npm run dev:firefox` — Firefox dev build.
- `npm run build` — clean + build Chrome + build Firefox + backup (full release build).
- `npm run build:chrome` / `npm run build:firefox` — single-target builds
  (generate build-info, then `wxt build`).
- `npm run zip:chrome` / `npm run zip:firefox` / `npm run zip:source` — package for
  store submission.

## Quality gates
- `npm run compile` — typecheck (`tsc --noEmit`). **No `typecheck` alias.**
- `npm run lint` — `eslint src --ext .ts,.tsx`; `npm run lint:fix` to autofix.
- `npm run test` — unit tests (`vitest run`, 539 tests).
- `npm run test:watch` — Vitest watch mode.
- `npm run test:coverage` — coverage.
- `npm run test:e2e` — Playwright e2e (`playwright test`).

## System (Darwin / macOS)
Standard BSD userland: `git`, `ls`, `find`, `grep` (ripgrep `rg` available). This is
a git repo on branch `main` (remote `origin` = `github.com:StarlightDaemon/CTRL`).

Related: `mem:core`, `mem:tech_stack`, `mem:conventions`.
