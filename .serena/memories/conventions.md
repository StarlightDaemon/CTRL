# Conventions

## TypeScript
- `strict: true` with all sub-flags explicit (noImplicitAny, strictNullChecks,
  strictFunctionTypes, strictBindCallApply, strictPropertyInitialization,
  noImplicitThis, alwaysStrict). `target`/`module` = ESNext,
  `moduleResolution: Bundler`, `jsx: react-jsx`, `noEmit: true`.
- Path alias: `@/*` → `./src/*` (baseUrl `.`). Import via `@/...`
  (e.g. `@/entities/client/model/ITorrentClient`).
- Typecheck with **`npm run compile`** (`tsc --noEmit`) — there is no `typecheck`
  script. See `mem:suggested_commands`.

## Dependency injection (tsyringe)
- `experimentalDecorators: true` + `emitDecoratorMetadata: true`; `reflect-metadata`
  is imported at entry. Adapters and services are `@injectable()` (all 10 adapters
  carry it). Vite uses Babel decorator support so decorators work through the
  WXT/Vite build.

## Validation
- **Zod** used pervasively for API response validation — each adapter dir has a
  `<Client>Schema.ts`; `useSettings` validates backup/restore payloads with Zod +
  atomic rollback.

## Adapter error handling
See `mem:adapters` for the full contract. Convention: never throw from
`testConnection` (return `AdapterConnectionResult`); classify raw errors into a
typed `<Client>AdapterError` via a static `from()`; wrap the connection probe in
`withAdapterRetry` (probe-only, not general request retry).

## Testing
- **Unit:** Vitest (`4.0.15`), jsdom, `globals: true`. Config
  `extension/vitest.config.ts`; setup `extension/vitest.setup.ts` stubs
  `chrome`/`browser` via `@webext-core/fake-browser`, resets `fakeBrowser` +
  `vi.clearAllMocks()` in `beforeEach`, mocks `matchMedia`. WXT `#imports` virtual is
  aliased to a test mock. Tests in `extension/tests/unit/` — **539 `it()` cases**
  across 15 files (no co-located `src` tests today, though the glob allows them).
- **Adapter test convention:** `new AdapterClass(mockConfig)` in `beforeEach`;
  `vi.spyOn(global, 'fetch')` returning a queue of stubbed `Response`s; assert return
  shapes on success, `rejects.toThrow(<Client>AdapterError)` on failure paths, and
  inspect the outgoing RPC body via `JSON.parse(fetchSpy.mock.calls[N][1].body)`.
  `vi.restoreAllMocks()` in `afterEach`. Adapter test files: Aria2, BiglyBT, Deluge,
  Flood, QBittorrent (+ services), RuTorrent, Synology, Transmission, UTorrent
  (9 clients — Vuze covered by Transmission's tests).
- **E2E:** Playwright (`@playwright/test 1.57.0`), `extension/playwright.config.ts`,
  `testDir: tests/e2e`, Chromium only, 60s timeout, retries in CI; loads the built
  extension.
- **Lint:** `eslint src --ext .ts,.tsx` (`npm run lint`).

## WXT specifics
- Entrypoints use WXT conventions (`defineBackground`, etc.). Storage via WXT
  `storage` (`local:` for options, `session:` for hydration). Firefox build uses
  `--mv3`; `background.ts` includes Firefox-specific `onStartup` workarounds.

Related: `mem:core`, `mem:architecture`, `mem:adapters`, `mem:tech_stack`.
