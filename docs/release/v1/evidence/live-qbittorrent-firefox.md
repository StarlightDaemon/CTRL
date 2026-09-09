# Live verification: qBittorrent × Firefox

- ran: 2026-09-09T19:51:24.254Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: firefox 155.0.1 (headless)
- client: qBittorrent v5.2.3 (web api 2.15.1)
- server address configured in CTRL: `http://192.168.1.235:18080/` (host LAN address, non-loopback; plain HTTP)
- authentication: username + password (throwaway test values)
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 12 passed, 3 failed, 1 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 601 |
| configure-server | PASS | form filled (address http://192.168.1.235:18080/); credential disclosure shown; plain-http warning not shown (private host) | 958 |
| grant-permission | PASS | granted (prompt disabled by extensions.webextOptionalPermissionPrompts=false) | 68 |
| test-connection | PASS | Connection successful | 78 |
| save-server | PASS | saved; list shows stored address verbatim: true | 69 |
| connected | PASS | dashboard status: LIVE | 495 |
| add-magnet | PASS | popup: Torrent added; server has ctrl-live-a.bin (638ceb8d793cd066ae854013514d1f32f95fb752) status=queuedDL | 711 |
| list-shows-torrent | PASS | rows: ["ctrl-live-a.bin, Queued, 0%"] | 500 |
| add-paused | FAIL | server never showed ctrl-live-b.bin paused within 20000 ms; last list: [{"hash":"638ceb8d793cd066ae854013514d1f32f95fb752","name":"ctrl-live-a.bin","status":"metaDL"},{"hash":"28f801e89e63463a469463ca0dbc8c36dc8cc0fc","name":"ctrl-live-b.bin","status":"metaDL"}] | 21140 |
| pause | PASS | server: ctrl-live-a.bin status=stoppedDL | 2132 |
| resume | PASS | server: ctrl-live-a.bin status=metaDL | 1370 |
| remove-keep-files | PASS | removed on server; other torrent untouched: true | 885 |
| bad-credentials | FAIL | no status matching /Authentication failed\|AUTHENTICATION FAILED\|Server unavailable\|SERVER UNAVAILABLE\|Connection lost\|CONNECTION LOST/ within 40000 ms; last: ["LIVE"] | 41451 |
| server-unavailable | PASS | dashboard: CONNECTION LOST | 5812 |
| reconnect-after-restart | FAIL | no status matching /^LIVE$\|^Connected/ within 60000 ms; last: ["AUTHENTICATION FAILED","Authentication failed qBittorrent has temporarily banned this IP after too many failed logins. Wait, or restart qBittorrent.","No queue to show The queue appears once CTRL is unlocked and connected to a server."] | 60733 |
| browser-restart-lock | SKIP | prerequisite failed: reconnect-after-restart | 0 |

## Notes

- on failure of add-paused, options page showed: Dashboard Servers Settings System About Settings Configure extension behavior, browser integration, and notifications. General Behavior Add torrents paused On Show advanced dialog when adding Off Extension Badge Choose what information to display on the extension icon. CTRL only polls your client in the background while the badge is enabled. Badge Information 3 Preview Context Menu Choose which right-click options CTRL adds to links. Menu Mode Full (add, add paused, labels, folders, per-server) Simple (add to the default server only) Hidden (no context menu) Server Visibility Servers switched on appear at the top level of the menu; the others are grouped under "Add to server...". Live qBittorrent Show Live qBittorrent at the top level Show Live qBittorrent at the top level Open Link in New Tab Save Link As... Add to CTRL Add to CTRL (paused) Inspect Preview Notifications Show a browser notification when a torrent is added from the context menu, or when adding fails. Enable notifications On
- on failure of bad-credentials, options page showed: Dashboard Servers Settings System About Torrents on Live qBittorrent LIVE ctrl-live-b.bin Downloading 0% 0 B Transfer DOWNLOAD 0 B/s UPLOAD 0 B/s Connection Connected Active: 1 · Total: 1 Last update: just now
- on failure of reconnect-after-restart, options page showed: Dashboard Servers Settings System About Torrents on Live qBittorrent AUTHENTICATION FAILED Authentication failed qBittorrent has temporarily banned this IP after too many failed logins. Wait, or restart qBittorrent. No queue to show The queue appears once CTRL is unlocked and connected to a server. Transfer DOWNLOAD — UPLOAD — Connection Authentication failed qBittorrent has temporarily banned this IP after too many failed logins. Wait, or restart qBittorrent. Active: — · Total: — Last update: 1 min ago

## Client log excerpt (sanitized, last lines)

```
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "127.0.0.1". Port: "TCP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "127.0.0.1". Port: "UDP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:db64:d263:3e64:3a5a". Port: "TCP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:db64:d263:3e64:3a5a". Port: "UDP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:b4fc:30c1:b737:1405". Port: "TCP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:b4fc:30c1:b737:1405". Port: "UDP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "fe80::73eb:88b3:9978:5432%10". Port: "TCP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "fe80::73eb:88b3:9978:5432%10". Port: "UDP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "::1". Port: "TCP/16882"
(I) 2026-09-09T13:50:23 - Successfully listening on IP. IP: "::1". Port: "UDP/16882"
(N) 2026-09-09T13:50:23 - Restored torrent. Torrent: "ctrl-live-b.bin"
(I) 2026-09-09T13:50:23 - IP geolocation database loaded. Type: DBIP-Country-Lite. Build time: Mon Aug 31 19:32:45 2026.
(N) 2026-09-09T13:50:23 - Using built-in WebUI.
(N) 2026-09-09T13:50:23 - WebUI translation for selected locale (en) has been successfully loaded.
(N) 2026-09-09T13:50:23 - WebUI: Now listening on IP: *, port: 18080
(W) 2026-09-09T13:50:23 - WebAPI login failure. Reason: invalid credentials, attempt count: 1, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:23 - WebAPI login failure. Reason: invalid credentials, attempt count: 2, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:23 - Failed to download the program update info. URL: "https://www.fosshub.com/feed/5b8793a7f9ee5a5c3e97a3b2.xml". Error: "The remote content was not found at the server (404)"
(W) 2026-09-09T13:50:25 - WebAPI login failure. Reason: invalid credentials, attempt count: 3, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:41 - WebAPI login failure. Reason: invalid credentials, attempt count: 4, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:43 - WebAPI login failure. Reason: invalid credentials, attempt count: 5, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:45 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:47 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:49 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:51 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:54 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:56 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:50:58 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:00 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:02 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:04 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:06 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:08 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:10 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:12 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:14 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:16 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:18 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:20 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
(W) 2026-09-09T13:51:22 - WebAPI login failure. Reason: IP has been banned, IP: ::ffff:192.168.1.235, username: ctrl
```
