# Torrent Client Adapters

CTRL supports **9 torrent clients**. Each adapter lives under
`extension/src/shared/api/clients/<client>/` and is registered for tsyringe DI
with `@injectable()`.

## The 9 adapters (class — dir)
1. qBittorrent — `QBittorrentAdapter` (`qbittorrent/`)
2. Transmission — `TransmissionAdapter` (`transmission/`)
3. Deluge — `DelugeAdapter` (`deluge/`)
4. Flood — `FloodAdapter` (`flood/`)
5. ruTorrent — `RuTorrentAdapter` (`rutorrent/`)
6. uTorrent — `UTorrentAdapter` (`utorrent/`)
7. BiglyBT — `BiglyBTAdapter` (`biglybt/`)
8. Vuze — `VuzeAdapter` (`vuze/`)
9. Aria2 — `Aria2Adapter` (`aria2/`)

Synology support was removed from the extension on 2026-07-02 (product
decision — the operator does not intend to support that ecosystem going
forward). The historical research prompt is retained for reference at
`docs/reference/adapter__synology__architect_prompt.md`.

## Common interface — `ITorrentClient`
Canonical: `entities/client/model/ITorrentClient.ts`. (A re-export shim exists at
`features/torrent-control/model/types/ITorrentClient.ts` for FSD migration — not a
second source; all 8 direct adapters import from the `entities` path.) `ClientFactory`
(`entities/client/lib/ClientFactory.ts`) instantiates the right adapter from a
`ServerConfig` at runtime.

Methods: `login()`, `logout()`, `getTorrents(): Promise<Torrent[]>`,
`addTorrentUrl(url, options?)`, `addTorrentFile(file, options?)`,
`pauseTorrent(id)`, `resumeTorrent(id)`, `removeTorrent(id, deleteData?)`,
`testConnection(): Promise<AdapterConnectionResult>`, `ping(): Promise<number>`,
`getCategories()`, `setCategory(hash, category)`, `getTags()`, `addTags`, `removeTags`.

**Deviation — Vuze:** `VuzeAdapter extends TransmissionAdapter` (Vuze Remote WebUI
is Transmission-RPC compatible). Adds no methods, has no Vuze-specific error
subclass and no own unit-test file — inherits everything from Transmission and is
covered by Transmission's tests.

## Error-handling contract (OL-001, closed 2026-06-18) — stable
- **`AdapterError<TType extends string = string>`** (abstract, `extends Error`) at
  `shared/api/clients/shared/AdapterError.ts`. Fields: `readonly type: TType`
  (discriminant). `constructor(type, message)`. Abstract `toUserMessage(): string`.
  There is **no `retryable`/`isRetryable` field** — retry is attempt-count-driven.
- Each of the 8 non-Vuze adapters has a typed subclass
  `<Client>AdapterError extends AdapterError<<Client>ErrorType>` with a
  `toUserMessage()` and a static `from(unknown)` classifier mapping raw errors into
  the typed union.
- **`AdapterConnectionResult { connected: boolean; error?: AdapterError }`** at
  `shared/api/clients/shared/AdapterConnectionResult.ts` — the `testConnection()`
  return contract: `{ connected: true }` on success, `{ connected: false, error }`
  on failure. **`testConnection` never throws**; callers surface
  `error.toUserMessage()`.

## Retry infrastructure — `shared/lib/retry/withAdapterRetry.ts`
Canonical home (lifted out of `biglybt/BiglyBTSchema.ts`, which now re-exports it
for legacy callers — the retry file is authoritative).
- `RetryConfig { maxAttempts; initialDelayMs; maxDelayMs; backoffMultiplier }`.
- `DEFAULT_RETRY_CONFIG = { maxAttempts: 5, initialDelayMs: 1000, maxDelayMs: 16000,
  backoffMultiplier: 2 }` → delays 1s, 2s, 4s, 8s, 16s. `attempt` is 0-based:
  `calculateBackoffDelay(attempt, cfg) = min(initialDelayMs * backoffMultiplier^attempt,
  maxDelayMs)`, so attempt 4 = 16000 = the cap.
- `withAdapterRetry<T>(fn, config = DEFAULT_RETRY_CONFIG): Promise<T>` — retries up
  to `maxAttempts`, sleeps between; on exhaustion rethrows the last error if it is
  already an `AdapterError`, else wraps it in
  `RetryExhaustedError extends AdapterError<'RETRY_EXHAUSTED'>` (concrete, since
  `AdapterError` is abstract).
- **Scope:** wraps each adapter's `testConnection` connection/login probe **only** —
  NOT general per-request retry. A separate HTTP-status-focused `withRetry`
  (`shared/lib/retry/withRetry.ts`) is used by `FetchHttpClient`.

## Per-adapter notes
- **BiglyBT:** public `testConnection()` delegates to a private
  `testConnectionWithRetry(): Promise<boolean>` (calls `withAdapterRetry`); public
  method still returns `AdapterConnectionResult`.
- **Aria2:** two-layer errors — `Aria2Error` (low-level JSON-RPC, NOT an
  `AdapterError`) is wrapped by `Aria2AdapterError` at the boundary.
- **Flood:** internal domain errors (`FloodAuthError`, etc. — plain `Error`) wrapped
  by `FloodAdapterError` at the boundary.
- Most dirs also carry a `<Client>Schema.ts` (Zod) and per-client helpers/services
  (qBittorrent splits Sync/Transfer/Tracker/Rss/Search/File services; ruTorrent has
  `XmlRpcHelper`; Deluge has `DelugeEventPoller` + AutoAdd/Execute/Scheduler plugins;
  uTorrent has RSS/Settings services + `UTorrentParsingUtils`).

Related: `mem:core`, `mem:architecture`, `mem:conventions`.
