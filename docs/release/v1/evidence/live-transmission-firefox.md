# Live verification: Transmission × Firefox

- ran: 2026-09-09T19:46:18.077Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: firefox 155.0.1 (headless)
- client: Transmission 4.1.3 (838877323f) (rpc 19)
- server address configured in CTRL: `http://192.168.1.235:19091/` (host LAN address, non-loopback; plain HTTP)
- authentication: username + password (throwaway test values)
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 16 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 658 |
| configure-server | PASS | form filled (address http://192.168.1.235:19091/); credential disclosure shown; plain-http warning not shown (private host) | 1004 |
| grant-permission | PASS | granted (prompt disabled by extensions.webextOptionalPermissionPrompts=false) | 69 |
| test-connection | PASS | Connection successful | 72 |
| save-server | PASS | saved; list shows stored address verbatim: true | 91 |
| connected | PASS | dashboard status: LIVE | 498 |
| add-magnet | PASS | popup: Torrent added; server has ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=4 | 703 |
| list-shows-torrent | PASS | rows: ["ctrl-live-a.bin, Downloading, 0%"] | 512 |
| add-paused | PASS | server shows ctrl-live-b.bin status=0 (paused) | 1633 |
| pause | PASS | server: ctrl-live-a.bin status=0 | 1338 |
| resume | PASS | server: ctrl-live-a.bin status=4 | 78 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 888 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check your Transmission username and password.; dashboard: AUTHENTICATION FAILED; restored → connected | 17580 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 5819 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 1 torrent(s) after restart | 534 |
| browser-restart-lock | PASS | skipped by design: a temporary Firefox add-on does not survive a browser restart | 0 |

## Notes

- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
[2026-09-09T13:38:23.923-0700] ERR utils.cc:145 Couldn't read 'C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\transmission\config/queue.json': The system cannot find the file specified. (2) (utils.cc:145)
[2026-09-09T13:38:23.930-0700] inf session.cc:1587 Loaded 1 torrent (session.cc:1587)
[2026-09-09T13:38:24.405-0700] WRN rpc-server.cc:571 Rejected request from 127.0.0.1 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:24.797-0700] inf ip-cache.cc:220 Cached IPv4 global address 47.5.17.28 (ip-cache.cc:220)
[2026-09-09T13:38:24.873-0700] inf ip-cache.cc:220 Cached IPv6 global address 2600:6c67:3700:cb9:b4fc:30c1:b737:1405 (ip-cache.cc:220)
[2026-09-09T13:38:25.522-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:27.521-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:29.533-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:31.528-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:33.525-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:35.522-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:37.525-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:39.529-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:41.523-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:43.523-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:45.524-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:47.522-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:49.538-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:51.528-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:53.535-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:55.521-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:57.531-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:38:59.533-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:01.537-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:03.530-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:05.530-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:07.525-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:09.537-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:11.523-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:13.524-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:15.521-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:17.530-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:19.522-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:21.528-0700] WRN rpc-server.cc:571 Rejected request from 192.168.1.235 (failed authentication) (rpc-server.cc:571)
[2026-09-09T13:39:21.528-0700] WRN rpc-server.cc:571 Too many messages like this! I won't log this message anymore this session. (rpc-server.cc:571)
[2026-09-09T13:39:24.568-0700] inf ctrl-live-b.bin Removing torrent (torrent.cc:798)
[2026-09-09T13:39:24.568-0700] inf ctrl-live-b.bin Pausing torrent (torrent.cc:710)
[2026-09-09T13:45:51.915-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
[2026-09-09T13:45:52.707-0700] inf ctrl-live-a.bin Removing torrent (torrent.cc:798)
[2026-09-09T13:45:52.707-0700] inf ctrl-live-a.bin Pausing torrent (torrent.cc:710)
```
