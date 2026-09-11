# Live verification: Aria2 / Motrix × Chrome

- ran: 2026-09-09T23:11:16.725Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: chrome Chrome/152.0.7977.83
- client: Aria2 / Motrix 1.37.0
- server address configured in CTRL: `http://192.168.1.235:16800/jsonrpc` (host LAN address, non-loopback; plain HTTP)
- authentication: RPC secret token (throwaway test values)
- server settings: aria2: --rpc-secret token
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 16 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 1041 |
| configure-server | PASS | form filled (address http://192.168.1.235:16800/jsonrpc); credential disclosure shown; plain-http warning not shown (private host) | 1576 |
| grant-permission | PASS | granted (invoked 'Allow' in window 'CTRL Settings - Google Chrome' (pid 15480)) | 1655 |
| test-connection | PASS | Connection successful | 274 |
| save-server | PASS | saved; list shows stored address verbatim: true | 265 |
| connected | PASS | dashboard status: LIVE | 502 |
| add-magnet | PASS | popup: Torrent added; server has [METADATA]ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=active | 1646 |
| list-shows-torrent | PASS | rows: ["[METADATA]ctrl-live-a.bin, Downloading, 0%"] | 527 |
| add-paused | PASS | server shows [METADATA]ctrl-live-b.bin status=paused (paused) | 2509 |
| pause | PASS | server: [METADATA]ctrl-live-a.bin status=paused | 1234 |
| resume | PASS | server: [METADATA]ctrl-live-a.bin status=active | 15 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 773 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check the Aria2 RPC secret token.; dashboard: AUTHENTICATION FAILED; restored → LIVE | 14519 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 24588 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 0 torrent(s) after restart | 537 |
| browser-restart-lock | PASS | locked after restart; unlocked → LIVE; host grant had to be repeated after the harness reloaded the unpacked extension (recovery flow via Servers → Grant access worked) | 5290 |

## Notes

- controller state after saving wrong credentials: +3ms connecting/- → +1266ms auth_failed/UNAUTHORIZED
- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
2026-09-09 17:11:10.123522 [INFO] [HttpServerResponseCommand.cc:60] CUID#13 - Persist connection.
2026-09-09 17:11:10.123522 [INFO] [HttpServer.cc:186] HTTP Server received request
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
2026-09-09 17:11:10.123522 [INFO] [rpc_helper.cc:103] Executing RPC method aria2.tellStopped
2026-09-09 17:11:10.123522 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#14 - HttpServer: all response transmitted.
2026-09-09 17:11:10.123522 [INFO] [HttpServerResponseCommand.cc:60] CUID#14 - Persist connection.
2026-09-09 17:11:10.206943 [INFO] [HttpServerCommand.cc:272] CUID#9 - Error occurred while reading HTTP request
Exception: [HttpServer.cc:180] errorCode=1 Got EOF from peer.
2026-09-09 17:11:10.206943 [INFO] [HttpServerCommand.cc:272] CUID#10 - Error occurred while reading HTTP request
Exception: [HttpServer.cc:180] errorCode=1 Got EOF from peer.
2026-09-09 17:11:14.125818 [INFO] [HttpServerCommand.cc:272] CUID#12 - Error occurred while reading HTTP request
Exception: [HttpServer.cc:180] errorCode=1 Got EOF from peer.
2026-09-09 17:11:14.125818 [INFO] [HttpServerCommand.cc:272] CUID#13 - Error occurred while reading HTTP request
Exception: [HttpServer.cc:180] errorCode=1 Got EOF from peer.
2026-09-09 17:11:14.125818 [INFO] [HttpServerCommand.cc:272] CUID#14 - Error occurred while reading HTTP request
Exception: [HttpServer.cc:180] errorCode=1 Got EOF from peer.
2026-09-09 17:11:14.971745 [INFO] [HttpListenCommand.cc:77] RPC: Accepted the connection from 192.168.1.235:55428.
2026-09-09 17:11:14.971745 [INFO] [HttpServer.cc:186] HTTP Server received request
POST /jsonrpc HTTP/1.1
Host: 192.168.1.235:16800
Connection: keep-alive
Content-Length: 865
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36
content-type: application/json
Accept: */*
Origin: chrome-extension://okipmajemgameabokhekjohnfccnbnca
Accept-Encoding: gzip, deflate
Accept-Language: en-US,en;q=0.9
2026-09-09 17:11:14.971745 [INFO] [rpc_helper.cc:103] Executing RPC method system.multicall
2026-09-09 17:11:14.971745 [INFO] [AbstractHttpServerResponseCommand.cc:117] CUID#15 - HttpServer: all response transmitted.
2026-09-09 17:11:14.971745 [INFO] [HttpServerResponseCommand.cc:60] CUID#15 - Persist connection.
```
