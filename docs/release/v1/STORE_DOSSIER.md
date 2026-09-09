# CTRL v1 store dossier (prepared, not submitted)

Status: prepared 2026-09-09 by the release program. Nothing here has been
submitted, published or declared. Items marked **OPERATOR DECISION REQUIRED**
need the operator's own action or authority.

## 1. Identity

| Item | Value | Status |
|---|---|---|
| Public name | CTRL | fixed |
| Manifest name / short name | `CTRL - Torrent Control` / `CTRL` | fixed |
| Version | `0.2.0-beta.1` → manifest `0.2.0.1` today; `1.0.0` only when every mandatory gate passes | not yet 1.0.0 |
| Firefox add-on id | `{2d629a61-d2b9-45d9-8f88-d58e8b43e9fb}` (GUID form; permanent once first signed) | **OPERATOR DECISION REQUIRED** — confirm before the first AMO upload; it cannot be changed afterwards |
| Developer / publisher account, trader status, contact e-mail, privacy-policy URL host | — | **OPERATOR DECISION REQUIRED** (legal and account matters; not decided by engineering) |
| Chrome Web Store item id | assigned at first upload | — |

## 2. Single purpose (both stores)

CTRL sends magnet links and torrent URLs to a BitTorrent client the user
already runs and shows and controls that client's queue from the browser.
It stores the client's address and login encrypted on the user's device and
transmits them only to that client. It does not read web pages, inject
anything into sites, or contact any other server.

## 3. Listing text (draft)

**Summary (≤ 132 chars, Chrome; ≤ 250, Firefox):**
Send magnet links to your own BitTorrent client and control its queue from the browser. Works with Transmission, qBittorrent and aria2.

**Description:**

CTRL is a remote control for a torrent client you already run — on your
computer, your NAS or a server you manage.

- Add magnet links and torrent URLs from the toolbar or the right-click menu, optionally paused, with a label and a download folder.
- See the client's queue with live speeds; pause, resume and remove torrents (downloaded files are kept).
- Configure several clients and switch between them; a toolbar badge shows the active count or download speed.
- Your server logins are encrypted on your device with a master password and sent only to the client they belong to. CTRL has no servers, no analytics and no telemetry.
- Back up your server list with or without passwords (clearly labelled) and import it elsewhere.

Verified with Transmission 4.1 (daemon RPC), qBittorrent 5.2 (Web UI, with
its default CSRF protection on) and aria2 1.37 (JSON-RPC), in Chrome 152
and Firefox 155.

CTRL does not provide, host, index or distribute any content. It talks only
to the client address you enter.

**Category:** Chrome: Productivity (or Tools). Firefox: Download Management.

**Languages:** English only.

## 4. Permissions and their justification (dashboard fields / reviewer notes)

| Permission | Justification text |
|---|---|
| `storage` | Stores the user's settings and the encrypted server vault locally, and the session key and last queue snapshot in session storage. |
| `contextMenus` | Adds "Add to CTRL" entries to the right-click menu for links. |
| `notifications` | Optional local notification when a torrent was added or adding failed; switchable in Settings. |
| `alarms` | Refreshes the toolbar badge once a minute while no CTRL window is open, only if the badge is enabled. |
| `declarativeNetRequestWithHostAccess` | Installs a session rule scoped to the user's configured qBittorrent server address that sets the `Origin`/`Referer` headers of CTRL's own requests to that address. qBittorrent's default CSRF protection rejects the extension origin browsers stamp on requests; the rule lets CTRL work without asking users to weaken their server. It applies only to hosts the user granted and to no other site. |
| Optional host permissions `http://*/*`, `https://*/*` | Requested per server address, at the moment the user adds that server, so CTRL can reach the torrent client's web interface. No other site is accessed. |

Remote code: none. Remote resources: none (system fonts; Carbon's remote
font rules are stripped at build time). Content scripts: none.

## 5. Data disclosures

### Chrome Web Store privacy tab

| Category | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | |
| Health, financial, location, web history, user activity, website content | No | |
| **Authentication information** | **Yes — stored locally, transmitted only to the user's own torrent client** | usernames/passwords (or RPC secret) the user enters for their client |
| Personal communications | No | |
| Certifications | Not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending | truthful per the privacy policy |

### Firefox `data_collection_permissions`

`required: ["authenticationInfo"]` (already in the manifest) — CTRL transmits
the user's client login outside the extension, to the user-configured
client. No optional categories; no `technicalAndInteraction` (no telemetry).

### Privacy policy

`docs/PRIVACY_POLICY.md` / `docs/privacy.html` (hosted URL: **OPERATOR
DECISION REQUIRED** — GitHub Pages or repository raw file).

## 6. Reviewer notes (Firefox "Notes for Reviewers"; Chrome "notes")

- Purpose and behaviour: see §2. The extension only ever contacts the address the user enters.
- **Test setup**: any Transmission 4.x daemon with RPC authentication, qBittorrent 5.x with the Web UI enabled (defaults, CSRF protection on), or aria2 with `--enable-rpc --rpc-secret <token>`. A fully scripted disposable environment with upstream binaries is in `extension/tests/live/README.md` (`node tests/live/env.mjs fetch && extract && start all`). Test credentials are whatever the reviewer's server uses; CTRL has no accounts of its own.
- **Plain HTTP**: allowed because most torrent clients on a LAN have no TLS; the server form warns when `http://` targets a non-private host. The CSP therefore sets `connect-src http: https:` and omits `upgrade-insecure-requests` (which would silently break LAN clients).
- **`declarativeNetRequestWithHostAccess`**: see §4; the rule code is `src/shared/api/network/HeaderRewriter.ts` (≈120 lines).
- **Host permissions**: optional; in Firefox the grant is `http://host/*` (Firefox match patterns carry no port), in Chrome `http://host:port/*`.
- **Reproducible build**: `extension/BUILD.md`; `npm ci && npm run build-for-amo` on Node 24 / npm 11 reproduces the uploaded Firefox package byte for byte (verified by a rebuild from the submitted source archive; see §9).
- Validator: addons-linter 0 errors; the 2 `UNSAFE_VAR_ASSIGNMENT` warnings come from React's production bundle (`innerHTML` in the DOM renderer), unmodified upstream release.

## 7. Supported environment

| | Minimum | Verified |
|---|---|---|
| Chrome (desktop) | 120 | 152.0.7977.83 |
| Firefox (desktop) | 140.0 | 155.0.1 |
| Transmission | 4.x (RPC 17+) | 4.1.3 |
| qBittorrent | 4.6+ / 5.x (Web API 2.9+/2.11+) | 5.2.3 |
| aria2 | 1.36+ | 1.37.0 |

Not supported: mobile browsers, Safari, other clients (adapters hidden).

## 8. Known limitations (to state in the listing or FAQ)

- English only.
- No page scanning: links are added one at a time from the menu or the popup.
- Firefox: an unsigned/temporary install is removed on restart (store version is signed).
- A qBittorrent session that already exists stays valid until it expires or the client restarts, even if the stored password was changed in CTRL (the server decides when a session ends).
- Plain HTTP is the user's choice; CTRL warns but does not block it.

## 9. Artefacts and checksums (current pre-release build, commit `d4617d1` tree)

| Artefact | Size | SHA-256 |
|---|---|---|
| `ctrl-extension-0.2.0.1-firefox.zip` | 326,684 B | _fill from `sha256sum` at release time; CI records `SHA256SUMS.txt`_ |
| `ctrl-extension-0.2.0-beta.1-chrome.zip` | 326,607 B | _idem_ |
| `ctrl-extension-0.2.0-beta.1-source.zip` (AMO source) | 519,946 B (261 entries) | _idem_ |

The reviewer-style rebuild of `firefox-mv3` from the source archive was
compared against the checked-in build (see `EXECUTION_STATE.md`, Phase F).

## 10. Store asset inventory

| Asset | Requirement | Status |
|---|---|---|
| Icon 128 px (Chrome), 32/64/128 px (Firefox) | PNG | present in `src/public/icon/` (16/32/48/64/128) |
| Screenshots | Chrome 1280×800 or 640×400 (1–5); Firefox 1280×800 recommended | to capture from the actual UI (`docs/release/v1/assets/`) — see §11 |
| Small promo tile (Chrome) | 440×280 | **to produce** (design asset, not generated by engineering) |
| Marquee (Chrome, optional) | 1400×560 | optional |
| Privacy policy URL | hosted | **OPERATOR DECISION REQUIRED** |
| Support URL / e-mail | | **OPERATOR DECISION REQUIRED** |

## 11. Release notes (draft for 1.0.0)

First store release. Send magnet links to Transmission, qBittorrent or aria2
and control the queue from the browser; encrypted local vault for your
logins; no telemetry. See the changelog for the full list of changes since
the beta.

## 12. What must not happen without the operator

Submitting or publishing to either store, tagging an official release,
pushing branches, changing the version to 1.0.0 before all gates pass,
making trader/legal declarations, choosing the signing account or hosting
the privacy policy.
