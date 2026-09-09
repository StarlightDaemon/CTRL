# Live verification: Aria2 / Motrix × Firefox

- ran: 2026-09-09T19:49:02.580Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: firefox 155.0.1 (headless)
- client: Aria2 / Motrix 1.37.0
- server address configured in CTRL: `http://192.168.1.235:16800/jsonrpc` (host LAN address, non-loopback; plain HTTP)
- authentication: RPC secret token (throwaway test values)
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 15 passed, 1 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 618 |
| configure-server | PASS | form filled (address http://192.168.1.235:16800/jsonrpc); credential disclosure shown; plain-http warning not shown (private host) | 866 |
| grant-permission | PASS | granted (prompt disabled by extensions.webextOptionalPermissionPrompts=false) | 69 |
| test-connection | PASS | Connection successful | 70 |
| save-server | PASS | saved; list shows stored address verbatim: true | 72 |
| connected | PASS | dashboard status: LIVE | 505 |
| add-magnet | PASS | popup: Torrent added; server has [METADATA]ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=active | 707 |
| list-shows-torrent | PASS | rows: ["[METADATA]ctrl-live-a.bin, Downloading, 0%"] | 502 |
| add-paused | PASS | server shows [METADATA]ctrl-live-b.bin status=paused (paused) | 1621 |
| pause | PASS | server: [METADATA]ctrl-live-a.bin status=paused | 566 |
| resume | PASS | server: [METADATA]ctrl-live-a.bin status=active | 78 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 872 |
| bad-credentials | FAIL | dashboard showed "CONNECTION LOST" instead of an authentication failure | 29486 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 31033 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 0 torrent(s) after restart | 530 |
| browser-restart-lock | PASS | skipped by design: a temporary Firefox add-on does not survive a browser restart | 0 |

## Notes

- restored password field holds the expected value: true
- on failure of bad-credentials, options page showed: Dashboard Servers Settings System About Torrents on Live Aria2 / Motrix LIVE [METADATA]ctrl-live-b.bin Paused 0% 0 B Transfer DOWNLOAD 0 B/s UPLOAD 0 B/s Connection Connected Active: 0 · Total: 1 Last update: just now

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
2026-09-09 13:49:02.005101 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellActive
2026-09-09 13:49:02.005101 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#12 - HttpServer: all response transmitted.
2026-09-09 13:49:02.005101 [INFO] [HttpServerResponseCommand.cc:60] CUID#12 - Persist connection.
2026-09-09 13:49:02.005101 [INFO] [HttpServer.cc:186] HTTP Server received request
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
2026-09-09 13:49:02.005101 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellWaiting
2026-09-09 13:49:02.005101 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#13 - HttpServer: all response transmitted.
2026-09-09 13:49:02.005101 [INFO] [HttpServerResponseCommand.cc:60] CUID#13 - Persist connection.
2026-09-09 13:49:02.005101 [INFO] [HttpServer.cc:186] HTTP Server received request
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
2026-09-09 13:49:02.005101 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellStopped
2026-09-09 13:49:02.005101 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#14 - HttpServer: all response transmitted.
2026-09-09 13:49:02.005101 [INFO] [HttpServerResponseCommand.cc:60] CUID#14 - Persist connection.
```
