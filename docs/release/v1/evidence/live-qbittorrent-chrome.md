# Live verification: qBittorrent × Chrome

- ran: 2026-09-09T19:46:25.346Z
- extension: CTRL 0.2.0-beta.1 (built from the working tree)
- browser: chrome Chrome/152.0.7977.83
- client: qBittorrent v5.2.3 (web api 2.15.1)
- server address configured in CTRL: `http://192.168.1.235:18080/` (host LAN address, non-loopback; plain HTTP)
- authentication: username + password (throwaway test values)
- harness: `extension/tests/live/verify.mjs`; every claim checked against the server through `oracles.mjs`

**Result: 3 passed, 1 failed, 12 skipped.**

| Scenario | Result | Observed | ms |
|---|---|---|---|
| vault-setup | PASS | master password created; options dashboard shown | 1069 |
| configure-server | PASS | form filled (address http://192.168.1.235:18080/); credential disclosure shown; plain-http warning not shown (private host) | 1580 |
| grant-permission | PASS | granted (invoked 'Allow' in window 'CTRL Settings - Google Chrome' (pid 15908)) | 1677 |
| test-connection | FAIL | test reported failure: Connection failed Authentication failed. Check your qBittorrent username and password. | 279 |
| save-server | SKIP | prerequisite failed: test-connection | 0 |
| connected | SKIP | prerequisite failed: save-server | 0 |
| add-magnet | SKIP | prerequisite failed: connected | 0 |
| list-shows-torrent | SKIP | prerequisite failed: add-magnet | 0 |
| add-paused | SKIP | prerequisite failed: add-magnet | 0 |
| pause | SKIP | prerequisite failed: list-shows-torrent | 0 |
| resume | SKIP | prerequisite failed: pause | 0 |
| remove-keep-files | SKIP | prerequisite failed: list-shows-torrent | 0 |
| bad-credentials | SKIP | prerequisite failed: connected | 0 |
| server-unavailable | SKIP | prerequisite failed: connected | 0 |
| reconnect-after-restart | SKIP | prerequisite failed: server-unavailable | 0 |
| browser-restart-lock | SKIP | prerequisite failed: reconnect-after-restart | 0 |

## Notes

- on failure of test-connection, options page showed: Dashboard Servers Settings System About Add server Tell CTRL where your BitTorrent client's web interface is and how to sign in. New server Server name How this server is listed in CTRL. BitTorrent client Transmission qBittorrent Aria2 / Motrix The program CTRL sends links to and reads the queue from. Server address The full address of the qBittorrent web interface, including https:// or http://, the port, and any path behind a reverse proxy. Example: http://127.0.0.1:8080/ CTRL may contact http://192.168.1.235:18080. Login Username Password CTRL encrypts this username and password before storing them in this browser. They are sent only to the server address above, to sign in to that torrent client. CTRL never sends them to the CTRL developer or to anyone else. Connection failed Authentication failed. Check your qBittorrent username and password. Save server Test connection Cancel

## Client log excerpt (sanitized, last lines)

```
(N) 2026-09-09T13:04:34 - qBittorrent v5.2.3 started. Process ID: 11368
(N) 2026-09-09T13:04:34 - Using config directory: C:\Users\construct\AppData\Local\Temp\claude\E--Citadel-CTRL\f43b56c4-28d6-4976-aa15-46a8fa8b0f6d\scratchpad\live\run\qbittorrent\profile\qBittorrent\config
(N) 2026-09-09T13:04:34 - Trying to listen on the following list of IP addresses: "0.0.0.0:16882,[::]:16882"
(I) 2026-09-09T13:04:34 - Peer ID: "-qB5230-"
(I) 2026-09-09T13:04:34 - HTTP User-Agent: "qBittorrent/5.2.3"
(I) 2026-09-09T13:04:34 - Distributed Hash Table (DHT) support: OFF
(I) 2026-09-09T13:04:34 - Local Peer Discovery support: OFF
(I) 2026-09-09T13:04:34 - Peer Exchange (PeX) support: OFF
(I) 2026-09-09T13:04:34 - Anonymous mode: OFF
(I) 2026-09-09T13:04:34 - Encryption support: ON
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "192.168.1.235". Port: "TCP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "192.168.1.235". Port: "UDP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "127.0.0.1". Port: "TCP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "127.0.0.1". Port: "UDP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:db64:d263:3e64:3a5a". Port: "TCP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:db64:d263:3e64:3a5a". Port: "UDP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:b4fc:30c1:b737:1405". Port: "TCP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "2600:6c67:3700:cb9:b4fc:30c1:b737:1405". Port: "UDP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "fe80::73eb:88b3:9978:5432%10". Port: "TCP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "fe80::73eb:88b3:9978:5432%10". Port: "UDP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "::1". Port: "TCP/16882"
(I) 2026-09-09T13:04:34 - Successfully listening on IP. IP: "::1". Port: "UDP/16882"
(W) 2026-09-09T13:04:34 - Couldn't load IP geolocation database. Reason: The system cannot find the path specified.
(N) 2026-09-09T13:04:34 - Using built-in WebUI.
(N) 2026-09-09T13:04:34 - WebUI translation for selected locale (en) has been successfully loaded.
(N) 2026-09-09T13:04:34 - WebUI: Now listening on IP: *, port: 18080
(W) 2026-09-09T13:04:34 - Failed to download the program update info. URL: "https://www.fosshub.com/feed/5b8793a7f9ee5a5c3e97a3b2.xml". Error: "The remote content was not found at the server (404)"
(I) 2026-09-09T13:04:34 - IP geolocation database loaded. Type: DBIP-Country-Lite. Build time: Mon Aug 31 19:32:45 2026.
(I) 2026-09-09T13:04:34 - Successfully updated IP geolocation database.
(N) 2026-09-09T13:05:22 - WebAPI login success. IP: ::ffff:192.168.1.235
(N) 2026-09-09T13:06:14 - WebAPI login success. IP: ::ffff:192.168.1.235
(W) 2026-09-09T13:06:15 - WebAPI login failure. Reason: invalid credentials, attempt count: 1, IP: ::ffff:192.168.1.235, username: ctrl
(N) 2026-09-09T13:43:37 - WebAPI login success. IP: ::ffff:192.168.1.235
(W) 2026-09-09T13:43:42 - WebUI: Origin header & Target origin mismatch! Source IP: '::ffff:192.168.1.235'. Origin header: 'moz-extension://7f6ead63-c84b-4778-954c-86dadcfde12f'. Target origin: '192.168.1.235:18080'
(N) 2026-09-09T13:46:18 - WebAPI login success. IP: ::ffff:192.168.1.235
(W) 2026-09-09T13:46:23 - WebUI: Origin header & Target origin mismatch! Source IP: '::ffff:192.168.1.235'. Origin header: 'chrome-extension://okipmajemgameabokhekjohnfccnbnca'. Target origin: '192.168.1.235:18080'
```
