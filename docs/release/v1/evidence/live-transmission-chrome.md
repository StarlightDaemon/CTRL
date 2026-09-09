# Live verification: Transmission × Chrome

- ran: 2026-09-09T19:47:51.246Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: chrome Chrome/152.0.7977.83
- client: Transmission 4.1.3 (838877323f) (rpc 19)
- server address configured in CTRL: `http://192.168.1.235:19091/` (host LAN address, non-loopback; plain HTTP)
- authentication: username + password (throwaway test values)
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 16 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 1042 |
| configure-server | PASS | form filled (address http://192.168.1.235:19091/); credential disclosure shown; plain-http warning not shown (private host) | 1588 |
| grant-permission | PASS | granted (invoked 'Allow' in window 'CTRL Settings - Google Chrome' (pid 11604)) | 1684 |
| test-connection | PASS | Connection successful | 280 |
| save-server | PASS | saved; list shows stored address verbatim: true | 268 |
| connected | PASS | dashboard status: LIVE | 498 |
| add-magnet | PASS | popup: Torrent added; server has ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=4 | 1635 |
| list-shows-torrent | PASS | rows: ["ctrl-live-a.bin, Downloading, 0%"] | 518 |
| add-paused | PASS | server shows ctrl-live-b.bin status=0 (paused) | 2470 |
| pause | PASS | server: ctrl-live-a.bin status=0 | 1239 |
| resume | PASS | server: ctrl-live-a.bin status=4 | 30 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 776 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check your Transmission username and password.; dashboard: AUTHENTICATION FAILED; restored → connected | 18380 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 2690 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 1 torrent(s) after restart | 525 |
| browser-restart-lock | PASS | locked after restart; unlocked → LIVE; host grant had to be repeated after the harness reloaded the unpacked extension (recovery flow via Servers → Grant access worked) | 5352 |

## Notes

- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
[2026-09-09T13:46:16.945-0700] inf rpc-server.cc:1023 Password required (rpc-server.cc:1023)
[2026-09-09T13:46:16.945-0700] inf rpc-server.cc:1038 Serving RPC and Web requests from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\bin\transmission\PFiles\Transmission/public_html' (rpc-server.cc:1038)
[2026-09-09T13:46:16.945-0700] inf daemon.cc:865 Loading settings from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\transmission\config' (daemon.cc:865)
[2026-09-09T13:46:16.948-0700] inf daemon.cc:908 Requiring authentication (daemon.cc:908)
[2026-09-09T13:46:16.951-0700] inf session.cc:1587 Loaded 1 torrent (session.cc:1587)
[2026-09-09T13:46:17.418-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:46:17.448-0700] inf ctrl-live-b.bin Removing torrent (torrent.cc:798)
[2026-09-09T13:46:17.448-0700] inf ctrl-live-b.bin Pausing torrent (torrent.cc:710)
[2026-09-09T13:46:17.992-0700] inf ip-cache.cc:220 Cached IPv4 global address 47.5.17.28 (ip-cache.cc:220)
[2026-09-09T13:46:18.050-0700] inf ip-cache.cc:220 Cached IPv6 global address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:220)
[2026-09-09T13:46:18.373-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:09.955-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:21.444-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T13:47:22.216-0700] inf ctrl-live-a.bin Removing torrent (torrent.cc:798)
[2026-09-09T13:47:22.216-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T13:47:23.835-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:24.846-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:26.855-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:30.873-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:38.877-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:39.112-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:39.803-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:44.067-0700] inf ip-cache.cc:385 Cached IPv4 source address 192.168.1.235 (ip-cache.cc:385)
[2026-09-09T13:47:44.068-0700] inf ip-cache.cc:385 Cached IPv6 source address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:385)
[2026-09-09T13:47:44.068-0700] inf session.cc:424 Listening to incoming peer connections on 0.0.0.0:16881 (session.cc:424)
[2026-09-09T13:47:44.068-0700] inf session.cc:424 Listening to incoming peer connections on [2600:6c67:3700:cb9:b4fc:30c1:b737:1405]:16881 (session.cc:424)
[2026-09-09T13:47:44.068-0700] inf tr-udp.cc:207 Bound UDP IPv4 address 0.0.0.0:16881 (tr-udp.cc:207)
[2026-09-09T13:47:44.068-0700] inf tr-udp.cc:254 Bound UDP IPv6 address [2600:6c67:3700:cb9:b4fc:30c1:b737:1405]:16881 (tr-udp.cc:254)
[2026-09-09T13:47:44.068-0700] inf rpc-server.cc:878 Added '*.*.*.*' to host whitelist (rpc-server.cc:878)
[2026-09-09T13:47:44.068-0700] inf rpc-server.cc:1013 Serving RPC and Web requests on 0.0.0.0:19091/transmission/ (rpc-server.cc:1013)
[2026-09-09T13:47:44.068-0700] inf rpc-server.cc:825 Listening for RPC and Web requests on '0.0.0.0:19091' (rpc-server.cc:825)
[2026-09-09T13:47:44.068-0700] inf rpc-server.cc:1018 Whitelist enabled (rpc-server.cc:1018)
[2026-09-09T13:47:44.068-0700] inf rpc-server.cc:1023 Password required (rpc-server.cc:1023)
[2026-09-09T13:47:44.068-0700] inf rpc-server.cc:1038 Serving RPC and Web requests from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\bin\transmission\PFiles\Transmission/public_html' (rpc-server.cc:1038)
[2026-09-09T13:47:44.068-0700] inf daemon.cc:865 Loading settings from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\transmission\config' (daemon.cc:865)
[2026-09-09T13:47:44.072-0700] inf daemon.cc:908 Requiring authentication (daemon.cc:908)
[2026-09-09T13:47:44.074-0700] inf session.cc:1587 Loaded 1 torrent (session.cc:1587)
[2026-09-09T13:47:44.545-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:47:44.994-0700] inf ip-cache.cc:220 Cached IPv6 global address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:220)
[2026-09-09T13:47:45.088-0700] inf ip-cache.cc:220 Cached IPv4 global address 47.5.17.28 (ip-cache.cc:220)
```
