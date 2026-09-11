# Live verification: Transmission × Chrome

- ran: 2026-09-09T23:40:12.559Z
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
| vault-setup | PASS | master password created; options dashboard shown | 1057 |
| configure-server | PASS | form filled (address http://192.168.1.235:19091/); credential disclosure shown; plain-http warning not shown (private host) | 1591 |
| grant-permission | PASS | granted (invoked 'Allow' in window 'CTRL Settings - Google Chrome' (pid 8376)) | 1676 |
| test-connection | PASS | Connection successful | 288 |
| save-server | PASS | saved; list shows stored address verbatim: true | 284 |
| connected | PASS | dashboard status: LIVE | 510 |
| add-magnet | PASS | popup: Torrent added; server has ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=4 | 1646 |
| list-shows-torrent | PASS | rows: ["ctrl-live-a.bin, Downloading, 0%"] | 526 |
| add-paused | PASS | server shows ctrl-live-b.bin status=0 (paused) | 2505 |
| pause | PASS | server: ctrl-live-a.bin status=0 | 1258 |
| resume | PASS | server: ctrl-live-a.bin status=4 | 31 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 815 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check your Transmission username and password.; dashboard: AUTHENTICATION FAILED; restored → LIVE | 27930 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 3207 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 1 torrent(s) after restart | 2071 |
| browser-restart-lock | PASS | locked after restart; unlocked → LIVE; host grant had to be repeated after the harness reloaded the unpacked extension (recovery flow via Servers → Grant access worked) | 5364 |

## Notes

- controller state after saving wrong credentials: +4ms auth_failed/AUTH_FAILED
- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
[2026-09-09T17:35:46.058-0700] inf ctrl-live-c.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:35:46.058-0700] inf ctrl-live-c.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:38:26.665-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:38:40.730-0700] inf ctrl-live-a.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:38:40.730-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:38:40.732-0700] inf ctrl-live-b.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:38:40.732-0700] inf ctrl-live-b.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:38:40.732-0700] inf ctrl-live-c.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:38:40.732-0700] inf ctrl-live-c.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:38:55.903-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:04.387-0700] inf ctrl-live-a.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:39:04.387-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:39:19.629-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:31.160-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:39:31.938-0700] inf ctrl-live-a.bin Removing torrent (torrent.cc:798)
[2026-09-09T17:39:31.938-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T17:39:33.574-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:34.578-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:36.582-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:40.597-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:48.609-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:39:48.875-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:40:03.868-0700] inf ip-cache.cc:385 Cached IPv4 source address 192.168.1.235 (ip-cache.cc:385)
[2026-09-09T17:40:03.868-0700] inf ip-cache.cc:385 Cached IPv6 source address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:385)
[2026-09-09T17:40:03.868-0700] inf session.cc:424 Listening to incoming peer connections on 0.0.0.0:16881 (session.cc:424)
[2026-09-09T17:40:03.868-0700] inf session.cc:424 Listening to incoming peer connections on [2600:6c67:3700:cb9:b4fc:30c1:b737:1405]:16881 (session.cc:424)
[2026-09-09T17:40:03.868-0700] inf tr-udp.cc:207 Bound UDP IPv4 address 0.0.0.0:16881 (tr-udp.cc:207)
[2026-09-09T17:40:03.868-0700] inf tr-udp.cc:254 Bound UDP IPv6 address [2600:6c67:3700:cb9:b4fc:30c1:b737:1405]:16881 (tr-udp.cc:254)
[2026-09-09T17:40:03.868-0700] inf rpc-server.cc:878 Added '*.*.*.*' to host whitelist (rpc-server.cc:878)
[2026-09-09T17:40:03.868-0700] inf rpc-server.cc:1013 Serving RPC and Web requests on 0.0.0.0:19091/transmission/ (rpc-server.cc:1013)
[2026-09-09T17:40:03.869-0700] inf rpc-server.cc:825 Listening for RPC and Web requests on '0.0.0.0:19091' (rpc-server.cc:825)
[2026-09-09T17:40:03.869-0700] inf rpc-server.cc:1018 Whitelist enabled (rpc-server.cc:1018)
[2026-09-09T17:40:03.869-0700] inf rpc-server.cc:1023 Password required (rpc-server.cc:1023)
[2026-09-09T17:40:03.869-0700] inf rpc-server.cc:1038 Serving RPC and Web requests from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\bin\transmission\PFiles\Transmission/public_html' (rpc-server.cc:1038)
[2026-09-09T17:40:03.869-0700] inf daemon.cc:865 Loading settings from 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\transmission\config' (daemon.cc:865)
[2026-09-09T17:40:03.873-0700] inf daemon.cc:908 Requiring authentication (daemon.cc:908)
[2026-09-09T17:40:03.880-0700] inf session.cc:1587 Loaded 1 torrent (session.cc:1587)
[2026-09-09T17:40:04.342-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T17:40:04.871-0700] inf ip-cache.cc:220 Cached IPv4 global address 47.5.17.28 (ip-cache.cc:220)
[2026-09-09T17:40:04.884-0700] inf ip-cache.cc:220 Cached IPv6 global address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:220)
```
