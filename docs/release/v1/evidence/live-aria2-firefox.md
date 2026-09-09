# Live verification: Aria2 / Motrix × Firefox

- ran: 2026-09-09T23:08:50.860Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: firefox 155.0.1 (headless)
- client: Aria2 / Motrix 1.37.0
- server address configured in CTRL: `http://192.168.1.235:16800/jsonrpc` (host LAN address, non-loopback; plain HTTP)
- authentication: RPC secret token (throwaway test values)
- server settings: aria2: --rpc-secret token
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 16 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 574 |
| configure-server | PASS | form filled (address http://192.168.1.235:16800/jsonrpc); credential disclosure shown; plain-http warning not shown (private host) | 914 |
| grant-permission | PASS | granted (prompt disabled by extensions.webextOptionalPermissionPrompts=false) | 68 |
| test-connection | PASS | Connection successful | 70 |
| save-server | PASS | saved; list shows stored address verbatim: true | 70 |
| connected | PASS | dashboard status: LIVE | 498 |
| add-magnet | PASS | popup: Torrent added; server has [METADATA]ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=active | 518 |
| list-shows-torrent | PASS | rows: ["[METADATA]ctrl-live-a.bin, Downloading, 0%"] | 509 |
| add-paused | PASS | server shows [METADATA]ctrl-live-b.bin status=paused (paused) | 1623 |
| pause | PASS | server: [METADATA]ctrl-live-a.bin status=paused | 555 |
| resume | PASS | server: [METADATA]ctrl-live-a.bin status=active | 78 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 879 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check the Aria2 RPC secret token.; dashboard: AUTHENTICATION FAILED; restored → LIVE | 14164 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 30054 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 0 torrent(s) after restart | 527 |
| browser-restart-lock | PASS | skipped by design: a temporary Firefox add-on does not survive a browser restart | 0 |

## Notes

- controller state after saving wrong credentials: +7ms connecting/- → +1376ms auth_failed/UNAUTHORIZED
- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
host: 192.168.1.235:16800
connection: keep-alive
Content-Type: application/json
accept: */*
accept-language: *
sec-fetch-mode: cors
user-agent: node
accept-encoding: gzip, deflate
content-length: 139
2026-09-09 17:08:50.188733 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellActive
2026-09-09 17:08:50.188733 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#12 - HttpServer: all response transmitted.
2026-09-09 17:08:50.188733 [INFO] [HttpServerResponseCommand.cc:60] CUID#12 - Persist connection.
2026-09-09 17:08:50.188733 [INFO] [HttpServer.cc:186] HTTP Server received request
POST /jsonrpc HTTP/1.1
host: 192.168.1.235:16800
connection: keep-alive
Content-Type: application/json
accept: */*
accept-language: *
sec-fetch-mode: cors
user-agent: node
accept-encoding: gzip, deflate
content-length: 147
2026-09-09 17:08:50.188733 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellWaiting
2026-09-09 17:08:50.188733 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#13 - HttpServer: all response transmitted.
2026-09-09 17:08:50.188733 [INFO] [HttpServerResponseCommand.cc:60] CUID#13 - Persist connection.
2026-09-09 17:08:50.188733 [INFO] [HttpServer.cc:186] HTTP Server received request
POST /jsonrpc HTTP/1.1
host: 192.168.1.235:16800
connection: keep-alive
Content-Type: application/json
accept: */*
accept-language: *
sec-fetch-mode: cors
user-agent: node
accept-encoding: gzip, deflate
content-length: 147
2026-09-09 17:08:50.188733 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellStopped
2026-09-09 17:08:50.188733 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#14 - HttpServer: all response transmitted.
2026-09-09 17:08:50.188733 [INFO] [HttpServerResponseCommand.cc:60] CUID#14 - Persist connection.
```
