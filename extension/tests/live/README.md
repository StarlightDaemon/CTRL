# Live verification environment

Runtime verification of CTRL against real torrent clients in the real release
browsers. Everything here is disposable: no installer runs, no service is
registered, no browser profile of the operator is touched, and no real torrent
content is involved. Established 2026-09-09 on Windows 11 (the Docker route was
unavailable on the host).

## What runs

| Component | Version | Source (official upstream) | Verification |
|---|---|---|---|
| Transmission daemon | 4.1.3 | `transmission/transmission` GitHub release `transmission-4.1.3-x64.msi` | sha256 `c8ea492d8f46fadac26e0c05b244cabba556201d5fe348dfcf1cf036621741f8`; unpacked with `msiexec /a` (administrative extract, nothing installed) |
| qBittorrent | 5.2.3 (Web API 2.11.x) | `qbittorrent/qBittorrent` GitHub release `qbittorrent_5.2.3_x64_setup.exe` | sha256 `ff508e2f912d59c9eabaf03633ebacfd45c2049f38dcac027b8a7d7ad867ab2f`; detached signature `.asc` verified against sledgehammer999's key `D8F3 DA77 AAC6 7410 5359 9C13 6E4A 2D02 5B7C C9A2`; NSIS payload unpacked with 7-Zip (the installer never runs) |
| aria2 | 1.37.0 | `aria2/aria2` GitHub release `aria2-1.37.0-win-64bit-build1.zip` | sha256 `67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288` |
| geckodriver | 0.37.1 | `mozilla/geckodriver` GitHub release `geckodriver-v0.37.1-win64.zip` | sha256 `dfed9315abe8d2fbc1b6161a2ee8002452e79cf05ee92fdc653a4e26bc35edd8` |
| Google Chrome | 152.0.7977.83 | installed on the host (`C:\Program Files\Google\Chrome`) | release target |
| Firefox | 155.0.1 | installed on the host (`C:\Program Files\Mozilla Firefox`) | release target |

Hashes are pinned in `env.mjs`; a download that does not match is deleted.
Binaries are never committed.

## Layout on disk

`CTRL_LIVE_ROOT` (default `%LOCALAPPDATA%\Temp\ctrl-live`):

```
downloads/   pinned upstream archives (+ .asc)
bin/         unpacked binaries
run/<client>/  temporary config, download dir, logs, pid file  (deleted by `clean`)
```

## Clients: temporary configuration

| Client | Listens | Login | Notes |
|---|---|---|---|
| Transmission | `0.0.0.0:19091`, RPC at `/transmission/rpc` | Basic auth `ctrl` / `ctrl-test-password` | `--allowed *.*.*.*`, DHT/LPD/port-mapping off, peer port 16881, log `run/transmission/transmission.log` (info level) |
| qBittorrent | `*:18080`, Web API at `/api/v2/` | `ctrl` / `ctrl-test-password` (PBKDF2 written into `qBittorrent.ini`) | **default security kept**: CSRF protection, Host header validation, clickjacking protection, localhost auth all on; DHT/PeX/LSD off; peer port 16882; legal notice pre-accepted; log `run/qbittorrent/profile/qBittorrent/data/logs/qbittorrent.log` |
| aria2 | `0.0.0.0:16800`, JSON-RPC at `/jsonrpc` | `--rpc-secret ctrl-test-token` | DHT/LPD/PEX off, peer port 16883, log `run/aria2/aria2.log` |

The credentials above are throwaway values for these temporary processes and
are not secrets. The extension is pointed at the host's LAN address (printed
by `status`/`info`), which is a non-loopback origin as the v1 support rule
requires.

## Commands (run from `extension/`)

```bash
node tests/live/env.mjs fetch          # download + verify hashes (idempotent)
node tests/live/env.mjs extract        # unpack (Windows: msiexec /a, 7-Zip, Expand-Archive)
node tests/live/env.mjs start all      # or: start transmission | qbittorrent | aria2
node tests/live/env.mjs status
node tests/live/env.mjs info           # JSON consumed by the harness
node tests/live/env.mjs stop all
node tests/live/env.mjs clean          # stop + delete run/ (keeps downloads/bin)
node tests/live/env.mjs purge          # delete CTRL_LIVE_ROOT entirely
```

Requirements: Node 22+ (24 used), 7-Zip installed (only for unpacking the
qBittorrent installer), Windows for `extract`/`start`. The qBittorrent process
is the GUI build (no `-nox` build exists for Windows); it opens a window but
needs no interaction.

## Browser harness (`browsers.mjs`)

| Browser | Mechanism | Extension pages | Optional host permission |
|---|---|---|---|
| Chrome (stock) | `puppeteer-core` + CDP `Extensions.loadUnpacked` (`--enable-unsafe-extension-debugging`, pipe transport), throwaway `--user-data-dir` | `chrome-extension://<id>/…` navigable | The permission bubble is native UI. `win-invoke-button.ps1` clicks its **Allow** button through Windows UI Automation (scoped to the harness's own Chrome process tree). Requires a headed window. |
| Firefox (stock) | `selenium-webdriver` + geckodriver (`--allow-system-access`), temporary add-on install of the unpacked build | Not navigable from content in Firefox 155; the driver opens the tab from the privileged chrome context with the system principal, then drives it from content. UUID read from the profile's `prefs.js` | `extensions.webextOptionalPermissionPrompts=false` (Mozilla's own test pref) makes `permissions.request()` grant without a doorhanger. Headless works. |

Rejected paths and why: Playwright's bundled Chromium fails to start on this
host (side-by-side manifest error) and would not be the release target anyway;
branded Chrome ignores `--load-extension`; Firefox's WebDriver BiDi refuses
`moz-extension://` navigation; Chrome's `--apps-gallery-install-auto-confirm-for-tests`
switch does not auto-accept the permissions prompt in Chrome 152.

## Test data (`fixtures.mjs`)

Deterministic private torrents with no trackers describing content that exists
nowhere; a client that receives them cannot contact anyone. Info-hashes:

| Name | Size | Info-hash |
|---|---|---|
| `ctrl-live-a.bin` | 1 MiB | `638ceb8d793cd066ae854013514d1f32f95fb752` |
| `ctrl-live-b.bin` | 512 KiB | `28f801e89e63463a469463ca0dbc8c36dc8cc0fc` |
| `ctrl-live-c.bin` | 768 KiB | `b8ac43fd063912db63cdd1a075a235754b69503d` |

## Oracles (`oracles.mjs`)

Plain-Node clients for each server's own API. The harness never trusts the
extension's word for "added / paused / removed"; it asks the server.
