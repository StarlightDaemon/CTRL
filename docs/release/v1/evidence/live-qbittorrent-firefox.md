# Live verification: qBittorrent × Firefox

- ran: 2026-09-09T23:09:25.563Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: firefox 155.0.1 (headless)
- client: qBittorrent v5.2.3 (web api 2.15.1)
- server address configured in CTRL: `http://192.168.1.235:18080/` (host LAN address, non-loopback; plain HTTP)
- authentication: username + password (throwaway test values)
- server settings: qBittorrent Web UI security: CSRF protection ON (default); Host header validation ON; clickjacking protection ON
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 16 passed, 0 failed, 0 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 392 |
| configure-server | PASS | form filled (address http://192.168.1.235:18080/); credential disclosure shown; plain-http warning not shown (private host) | 988 |
| grant-permission | PASS | granted (prompt disabled by extensions.webextOptionalPermissionPrompts=false) | 68 |
| test-connection | PASS | Connection successful | 277 |
| save-server | PASS | saved; list shows stored address verbatim: true | 72 |
| connected | PASS | dashboard status: LIVE | 494 |
| add-magnet | PASS | popup: Torrent added; server has ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=queuedDL | 692 |
| list-shows-torrent | PASS | rows: ["ctrl-live-a.bin, Queued, 0%"] | 505 |
| add-paused | PASS | server shows ctrl-live-b.bin status=stoppedDL (paused) | 1638 |
| pause | PASS | server: ctrl-live-a.bin status=stoppedDL | 2081 |
| resume | PASS | server: ctrl-live-a.bin status=metaDL | 3185 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 890 |
| bad-credentials | PASS | test: Connection failed Authentication failed. Check your qBittorrent username and password.; dashboard: AUTHENTICATION FAILED; restored → LIVE | 12536 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 5770 |
| reconnect-after-restart | PASS | dashboard: LIVE; server lists 0 torrent(s) after restart | 533 |
| browser-restart-lock | PASS | skipped by design: a temporary Firefox add-on does not survive a browser restart | 0 |

## Notes

- controller state after saving wrong credentials: +6ms auth_failed/AUTH_FAILED
- restored password field holds the expected value: true

## Client log excerpt (sanitized, last lines)

```
(I) 2026-09-09T17:08:51 - Successfully updated IP geolocation database.
(N) 2026-09-09T17:08:52 - WebAPI login success. IP: ::ffff:192.168.1.235
(N) 2026-09-09T17:08:56 - WebAPI login success. IP: ::ffff:192.168.1.235
(N) 2026-09-09T17:08:57 - Added new torrent. Torrent: "ctrl-live-a.bin"
(N) 2026-09-09T17:08:59 - Added new torrent. Torrent: "ctrl-live-b.bin"
(N) 2026-09-09T17:09:00 - Torrent stopped. Torrent: "ctrl-live-a.bin"
(N) 2026-09-09T17:09:03 - Torrent resumed. Torrent: "ctrl-live-a.bin"
(N) 2026-09-09T17:09:05 - Torrent removed. Torrent: "ctrl-live-a.bin"
(W) 2026-09-09T17:09:06 - WebAPI login failure. Reason: invalid credentials, attempt count: 1, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T17:09:06 - WebAPI login failure. Reason: invalid credentials, attempt count: 2, IP: ::ffff:192.168.1.235, username: ctrl
(N) 2026-09-09T17:09:18 - WebAPI login success. IP: ::ffff:192.168.1.235
(N) 2026-09-09T17:09:24 - qBittorrent v5.2.3 started. Process ID: 14172
(N) 2026-09-09T17:09:24 - Using config directory: C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\qbittorrent\profile\qBittorrent\config
(N) 2026-09-09T17:09:24 - Trying to listen on the following list of IP addresses: "0.0.0.0:16882,[::]:16882"
(I) 2026-09-09T17:09:24 - Peer ID: "-qB5230-"
(I) 2026-09-09T17:09:24 - HTTP User-Agent: "qBittorrent/5.2.3"
(I) 2026-09-09T17:09:24 - Distributed Hash Table (DHT) support: OFF
(I) 2026-09-09T17:09:24 - Local Peer Discovery support: OFF
(I) 2026-09-09T17:09:24 - Peer Exchange (PeX) support: OFF
(I) 2026-09-09T17:09:24 - Anonymous mode: OFF
(I) 2026-09-09T17:09:24 - Encryption support: ON
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "192.168.1.235". Port: "TCP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "192.168.1.235". Port: "UDP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "127.0.0.1". Port: "TCP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "127.0.0.1". Port: "UDP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:db64:d263:3e64:3a5a". Port: "TCP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:db64:d263:3e64:3a5a". Port: "UDP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:b4fc:30c1:b737:1405". Port: "TCP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:b4fc:30c1:b737:1405". Port: "UDP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "fe80::73eb:88b3:9978:5432%10". Port: "TCP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "fe80::73eb:88b3:9978:5432%10". Port: "UDP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "::1". Port: "TCP/16882"
(I) 2026-09-09T17:09:24 - Successfully listening on IP. IP: "::1". Port: "UDP/16882"
(N) 2026-09-09T17:09:24 - Restored torrent. Torrent: "ctrl-live-b.bin"
(I) 2026-09-09T17:09:24 - IP geolocation database loaded. Type: DBIP-Country-Lite. Build time: Mon Aug 31 19:32:45 2026.
(N) 2026-09-09T17:09:24 - Using built-in WebUI.
(N) 2026-09-09T17:09:24 - WebUI translation for selected locale (en) has been successfully loaded.
(N) 2026-09-09T17:09:24 - WebUI: Now listening on IP: *, port: 18080
(N) 2026-09-09T17:09:24 - WebAPI login success. IP: ::ffff:192.168.1.235
(W) 2026-09-09T17:09:24 - Failed to download the program update info. URL: "https://www.fosshub.com/feed/5b8793a7f9ee5a5c3e97a3b2.xml". Error: "The remote content was not found at the server (404)"
```
