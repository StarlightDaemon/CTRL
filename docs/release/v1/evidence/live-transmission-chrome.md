# Live verification: Transmission × Chrome

- ran: 2026-09-09T23:07:55.685Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: chrome Chrome/152.0.7977.83
- client: Transmission 4.1.3 (838877323f) (rpc 19)
- server address configured in CTRL: `http://192.168.1.235:19091/` (host LAN address, non-loopback; plain HTTP)
- authentication: username + password (throwaway test values)
- server settings: Transmission: RPC authentication required (Basic), host whitelist default
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 16 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 1050 |
| configure-server | PASS | form filled (address http://192.168.1.235:19091/); credential disclosure shown; plain-http warning not shown (private host) | 1599 |
| grant-permission | PASS | granted (invoked 'Allow' in window 'CTRL Settings - Google Chrome' (pid 14804)) | 1676 |
| test-connection | PASS | Connection successful | 265 |
| save-server | PASS | saved; list shows stored address verbatim: true | 265 |
| connected | PASS | dashboard status: LIVE | 498 |
| add-magnet | PASS | popup: Torrent added; server has ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=4 | 1636 |
| list-shows-torrent | PASS | rows: ["ctrl-live-a.bin, Downloading, 0%"] | 527 |
| add-paused | PASS | server shows ctrl-live-b.bin status=0 (paused) | 2500 |
| pause | PASS | server: ctrl-live-a.bin status=0 | 1252 |
| resume | PASS | server: ctrl-live-a.bin status=4 | 15 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 802 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check your Transmission username and password.; dashboard: AUTHENTICATION FAILED; restored → LIVE | 27821 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 3169 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 1 torrent(s) after restart | 530 |
| browser-restart-lock | PASS | locked after restart; unlocked → LIVE; host grant had to be repeated after the harness reloaded the unpacked extension (recovery flow via Servers → Grant access worked) | 5297 |

## Notes

- controller state after saving wrong credentials: +4ms auth_failed/AUTH_FAILED
- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
[2026-09-09T16:57:25.013-0700] inf daemon.cc:865 Loading settings from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\transmission\config' (daemon.cc:865)
[2026-09-09T16:57:25.017-0700] inf daemon.cc:908 Requiring authentication (daemon.cc:908)
[2026-09-09T16:57:25.019-0700] inf session.cc:1587 Loaded 1 torrent (session.cc:1587)
[2026-09-09T16:57:25.487-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T16:57:25.516-0700] inf ctrl-live-b.bin Removing torrent (torrent.cc:798)
[2026-09-09T16:57:25.516-0700] inf ctrl-live-b.bin Pausing torrent (torrent.cc:710)
[2026-09-09T16:57:26.036-0700] inf ip-cache.cc:220 Cached IPv6 global address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:220)
[2026-09-09T16:57:26.089-0700] inf ip-cache.cc:220 Cached IPv4 global address 47.5.17.28 (ip-cache.cc:220)
[2026-09-09T16:58:09.977-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T16:59:42.720-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:01:08.184-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:03:14.734-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:04.548-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:16.007-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:07:16.785-0700] inf ctrl-live-a.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:07:16.785-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:07:18.423-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:19.429-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:21.435-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:25.446-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:33.455-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:33.706-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:48.588-0700] inf ip-cache.cc:385 Cached IPv4 source address 192.168.1.235 (ip-cache.cc:385)
[2026-09-09T17:07:48.588-0700] inf ip-cache.cc:385 Cached IPv6 source address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:385)
[2026-09-09T17:07:48.588-0700] inf session.cc:424 Listening to incoming peer connections on 0.0.0.0:16881 (session.cc:424)
[2026-09-09T17:07:48.588-0700] inf session.cc:424 Listening to incoming peer connections on [2600:6c67:3700:cb9:b4fc:30c1:b737:1405]:16881 (session.cc:424)
[2026-09-09T17:07:48.588-0700] inf tr-udp.cc:207 Bound UDP IPv4 address 0.0.0.0:16881 (tr-udp.cc:207)
[2026-09-09T17:07:48.588-0700] inf tr-udp.cc:254 Bound UDP IPv6 address [2600:6c67:3700:cb9:b4fc:30c1:b737:1405]:16881 (tr-udp.cc:254)
[2026-09-09T17:07:48.588-0700] inf rpc-server.cc:878 Added '*.*.*.*' to host whitelist (rpc-server.cc:878)
[2026-09-09T17:07:48.588-0700] inf rpc-server.cc:1013 Serving RPC and Web requests on 0.0.0.0:19091/transmission/ (rpc-server.cc:1013)
[2026-09-09T17:07:48.589-0700] inf rpc-server.cc:825 Listening for RPC and Web requests on '0.0.0.0:19091' (rpc-server.cc:825)
[2026-09-09T17:07:48.589-0700] inf rpc-server.cc:1018 Whitelist enabled (rpc-server.cc:1018)
[2026-09-09T17:07:48.589-0700] inf rpc-server.cc:1023 Password required (rpc-server.cc:1023)
[2026-09-09T17:07:48.589-0700] inf rpc-server.cc:1038 Serving RPC and Web requests from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\bin\transmission\PFiles\Transmission/public_html' (rpc-server.cc:1038)
[2026-09-09T17:07:48.589-0700] inf daemon.cc:865 Loading settings from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\transmission\config' (daemon.cc:865)
[2026-09-09T17:07:48.592-0700] inf daemon.cc:908 Requiring authentication (daemon.cc:908)
[2026-09-09T17:07:48.595-0700] inf session.cc:1587 Loaded 1 torrent (session.cc:1587)
[2026-09-09T17:07:49.062-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:07:49.572-0700] inf ip-cache.cc:220 Cached IPv6 global address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:220)
[2026-09-09T17:07:49.578-0700] inf ip-cache.cc:220 Cached IPv4 global address 47.5.17.28 (ip-cache.cc:220)
```
