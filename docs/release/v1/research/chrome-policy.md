<!-- Verbatim research notes captured 2026-09-09 during the v1 release-completion pass. Evidence only: some recommendations below (activeTab/scripting, websiteContent, page scanning) predate the decision to remove page scanning; the accepted scope is docs/release/v1/V1_SCOPE.md. -->

# Chrome Web Store / MV3 requirements — verification for CTRL v1

Access date for all items: **2026-09-09**. Sources are first-party (developer.chrome.com, chromeenterprise.google, chromium.org groups) unless noted. "Last updated" = the date stamp shown on the page. Items marked **UNVERIFIED** could not be confirmed from a fetched first-party page.

---

## 1. MV3 requirement / MV2 deprecation

| Field | Finding |
|---|---|
| Requirement | MV3 is mandatory. MV2 has been disabled in Chrome since Chrome 138 (July 2025); CWS stopped accepting new MV2 items in Jan 2022; all remaining MV2 items are removed from the store by **2026-08-31**; the enterprise `ExtensionManifestV2Availability` escape hatch was removed in Chrome 139. |
| Quote | "All remaining Manifest V2 extensions are removed from the Chrome Web Store." |
| URL | https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline (last updated 2026-07-08) |

## 2. Single purpose / minimum functionality / quality

| Field | Finding |
|---|---|
| Single purpose | One narrow, easy-to-understand purpose. A "narrow focus area or subject matter" may offer several related functions (FAQ). "An extension must have a single purpose that is narrow and easy to understand." |
| Minimum functionality | No launcher-only items; no broken features; must deliver real utility. "Extensions with broken functionality—such as dead sites or non-functioning features—are not allowed." |
| Quality / spam | Duplicate items, rating manipulation, notification abuse prohibited: "Extensions that abuse notifications by sending spam, ads, promotions, phishing attempts, or unwanted messages" are disallowed. Best practices: "If your extension is not particularly useful or unique, it doesn't belong on the Chrome Web Store." |
| URLs | https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines (2024-07-10); https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq (2024-07-10); https://developer.chrome.com/docs/webstore/program-policies/minimum-functionality (2022-11-01); https://developer.chrome.com/docs/webstore/program-policies/spam-and-abuse (2022-11-01); https://developer.chrome.com/docs/webstore/program-policies/best-practices (2024-07-10) |

## 3. User data policy, Limited Use, authentication info, privacy policy, prominent disclosure, 2026 update

| Field | Finding |
|---|---|
| Privacy policy required? | Yes whenever the item "handles" any user data — **including locally stored credentials**. FAQ Q14: "…only stores information locally (or only uses Chrome Storage Sync API). Do I still need to post a privacy policy? Yes." FAQ Q3: disclosure required "even when data is processed or stored locally on a user's device". Policy: "If your Product handles any user data, then you must post an accurate and up to date privacy policy." Link goes in the dashboard field. |
| Authentication information | Listed as user data: "Authentication information (such as logins, password, and authentication cookies)" (FAQ Q4). Policy: "Keep authentication information secure. Don't publicly disclose authentication information." |
| Limited Use | Collect/use/transmit only what the disclosed single purpose needs; no sale/transfer to ad platforms or data brokers; no creditworthiness use. "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose". |
| Prominent disclosure | In-product, before consent, not only in a privacy policy: "The prominent disclosure and consent must occur within the Product's user interface" (FAQ Q10). Policy: "Prominently disclose what user data will be collected and how it will be used. Obtain the user's affirmative and informed consent for such use." Post-install practice changes must also be prominently disclosed. |
| 2026 update | Blog 2026-07-01: disclosure now required for **all** data collection "regardless of whether the data is closely related to the extension's single purpose"; must "proactively disclose to users if their data handling practices change"; data must be "strictly necessary to the extension's disclosed single purpose"; new AI-guardrail-circumvention and prediction-market bans. **Enforcement began 2026-08-01** (already in force). |
| URLs | https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (page stamp 2016-04-23); https://developer.chrome.com/docs/webstore/program-policies/limited-use (2022-11-01); https://developer.chrome.com/docs/webstore/program-policies/privacy (2022-11-01); https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements (2022-11-01); https://developer.chrome.com/docs/webstore/program-policies/policies (2025-05-22); https://developer.chrome.com/blog/cws-policy-updates-2026 |

## 4. Dashboard privacy tab — data usage certification

| Field | Finding |
|---|---|
| Categories (verbatim) | Personally identifiable information; Health information; Financial and payment information; Authentication information; Personal communications; Location; Web history; User activity; Website content |
| Certifications | Three checkboxes: "Use the second group of checkboxes to certify that you comply with each of the disclosure statements." Exact checkbox text lives only in the dashboard UI — **UNVERIFIED verbatim** (substance matches Limited Use: no sale/transfer to third parties outside approved cases; no use unrelated to single purpose; no creditworthiness/lending use). |
| Privacy policy URL | Field exists; required when user data is handled. |
| URL | https://developer.chrome.com/docs/webstore/cws-dashboard-privacy (2020-06-12) |

## 5. Permission justification fields

| Field | Finding |
|---|---|
| Requirement | Yes — the tab lists every permission from the manifest (API permissions **and** host permissions) and each needs a justification, plus a single-purpose description and a remote-code declaration. "Fill out these fields to tell the reviewers why your extension needs to use each permission." Remote code: "tell reviewers whether your extension executes remote code and, if so, why this is necessary." Remove unneeded permissions before upload. |
| URL | https://developer.chrome.com/docs/webstore/cws-dashboard-privacy (2020-06-12) |

## 6. Optional host permissions / broad patterns

| Field | Finding |
|---|---|
| Policy | "Request access to the narrowest permissions necessary to implement your Product's features or services." No future-proofing. |
| Review impact | Broad patterns (`*://*/*`, `https://*/*`, `<all_urls>`) "give extensions extensive access to the user's web activity" and get extended scrutiny; "dangerous permission requests", "new developers", "new extensions" are listed review signals. Nothing states `optional_host_permissions` are exempt. `optional_host_permissions` are "Granted by the user at runtime, instead of at install time." `activeTab` "does not display a permission warning." |
| URLs | https://developer.chrome.com/docs/webstore/program-policies/permissions (2022-11-01); https://developer.chrome.com/docs/webstore/review-process (2021-12-10); https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions; https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings |

## 7. User-data FAQ: protocol-client exception, encryption in transit

| Field | Finding |
|---|---|
| Encryption requirement | Q9: "Extensions must transmit user data over a secure connection (e.g. HTTPS, WSS) and stored at rest using a strong encryption method such as RSA or AES." Q8: the policy "establishes a minimum requirement of encrypting transmissions of all user data". Policy text: "transmitting it via modern cryptography." |
| Protocol client exception (Q15) | "When the Product is a client for an internet protocol with user-specified servers, like an FTP or IRC client, the Limited Use section does not apply to the Product's collection of data for, or transmission of data with, the user-specified server". The answer continues that for that traffic the policy "would not require the developer to post a privacy policy or transmit the data securely", while the policy still applies to data handled for other purposes (e.g. registration). |
| Same-computer exception (Q16) | "The requirement to handle the user data securely … does not apply to transmissions between a Chrome extension or app and a native program on the same computer." No FAQ question mentions LAN/intranet/self-hosted servers — a LAN qBittorrent box on plain HTTP is covered by Q15, not Q16. |
| URL | https://developer.chrome.com/docs/webstore/program-policies/user-data-faq |

## 8. Remotely hosted code (MV3)

| Field | Finding |
|---|---|
| Requirement | All executable code (JS, Wasm) must ship in the package; fetching data/JSON/CSS is fine: extensions must "bundle _all_ code they are using inside the extension itself." Exceptions only: userScripts API, chrome.debugger, sandboxed iframes. Undeclared remote code is rejected in review. |
| URL | https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code (2023-12-13) |

## 9. CSP for extension_pages

| Field | Finding |
|---|---|
| Rules | Default `script-src 'self'; object-src 'self';`. Minimum `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` — "cannot be relaxed beyond this minimum value". `script-src`, `object-src`, `worker-src` "may only have the following values: `self`, `none`, `wasm-unsafe-eval`", plus localhost sources for unpacked extensions only. `'unsafe-eval'` or remote origins cause an install error. |
| connect-src / http: | Docs put no restriction on non-script directives; nothing prohibits `connect-src http:`. **UNVERIFIED as an explicit statement** — inferred from silence. Service-worker fetches are governed by host permissions, not page CSP. |
| URLs | https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy (2024-02-13); https://developer.chrome.com/docs/extensions/develop/migrate/improve-security (2023-03-08) |

## 10. Manifest field formats

| Field | Finding |
|---|---|
| `version` | "One to four dot-separated integers"; each "between 0 and 65535, inclusive"; "Non-zero integers can't start with 0"; not all zero. Suffixes like `1.0.0-beta` are invalid. |
| `version_name` | Optional display string; `version` still drives updates. |
| `minimum_chrome_version` | Optional; older Chrome shows "Not compatible"; existing users below it stop receiving updates. |
| `name` | "maximum of 75 characters"; `short_name` "maximum of 12 characters recommended". |
| `description` | "no more than 132 characters", plain text. |
| URLs | https://developer.chrome.com/docs/extensions/reference/manifest/version; https://developer.chrome.com/docs/extensions/reference/manifest/name; https://developer.chrome.com/docs/extensions/reference/manifest/short-name; https://developer.chrome.com/docs/extensions/reference/manifest/description; https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version |

## 11. Listing assets and categories

| Field | Finding |
|---|---|
| Icon | 128x128 PNG, 96x96 artwork + 16 px transparent padding; "should work well on both light and dark backgrounds." |
| Screenshots | "At least one 1280x800 px screenshot, up to 5 total." Images page: 1280x800 preferred or 640x400; "Square corners, no padding (full bleed)". |
| Small promo tile | **Required**: "You must provide one small, 440x280-pixel promotional image." |
| Marquee | 1400x560, "optional". |
| Video | Listing page lists "A link to a YouTube video" among assets and marks only the marquee as optional; the images page never mentions video. Dashboard treats it as optional in practice — **UNVERIFIED** from docs; plan for none. |
| Categories (extensions) | Accessibility; Art & Design; Communication; Developer Tools; Education; Entertainment; Functionality & UI; Games; Household; Just for Fun; News & Weather; Privacy & Security; Shopping; Social Media & Networking; Tools; Travel; Well-being; Workflow & Planning. Also required: detailed description, primary category, language. |
| URLs | https://developer.chrome.com/docs/webstore/images (2018-06-11); https://developer.chrome.com/docs/webstore/cws-dashboard-listing (2020-12-07); https://developer.chrome.com/docs/webstore/best_practices |

## 12. Developer account

| Field | Finding |
|---|---|
| Fee | "pay a one-time registration fee" — amount not stated on any fetched first-party docs page; US$5 appears only in support-forum thread titles. **Amount UNVERIFIED first-party** (commonly $5). |
| Email | Contact email must be added and verified ("Click the Verify email link…"); the account email cannot be changed later. |
| 2SV | "2-Step Verification is required for all developer accounts prior to publishing an extension or updating an existing extension." |
| Trader / DSA | All developers must self-declare Trader or Non-Trader; traders are verified (legal name, contact details, possibly ID documents) since 2024-02-17 and their details are shown publicly; non-traders get a consumer-rights notice on the listing. |
| URLs | https://developer.chrome.com/docs/webstore/register (2024-02-13); https://developer.chrome.com/docs/webstore/set-up-account (2023-10-16); https://developer.chrome.com/docs/webstore/program-policies/two-step-verification (2022-11-01); https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure (2024-02-09); https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq |

## 13. Copyright / unauthorized-content policy

| Field | Finding |
|---|---|
| Statements | Malicious and Prohibited Products: "Do not encourage, facilitate, or enable the unauthorized access, download, or streaming of copyrighted content or media." and "Do not facilitate unauthorized access to content on websites, such as circumventing paywalls or login restrictions." IP section: "Don't infringe on the intellectual property rights of others…" No policy text names BitTorrent, torrents or magnet links. |
| URL | https://developer.chrome.com/docs/webstore/program-policies/policies (2025-05-22) |

## 14. Local Network Access (LNA) and extensions

| Field | Finding |
|---|---|
| Web behaviour | LNA prompt shipped in Chrome 142 (2025-09-29); opt-in testing from 138. Covers RFC1918, link-local, ULA, loopback; `.local` and private-IP literals are recognised before DNS. "Local network requests from Service Workers and Shared Workers require that the worker's origin has previously been granted the Local Network Access permission." Enterprise policies `LocalNetworkAccessAllowedForUrls` / `LocalNetworkAccessRestrictionsTemporaryOptOut` exist. |
| Extensions | No developer.chrome.com doc, blog, or release note (Chrome 138–153) addresses extensions. The only first-party statement is on the chromium-extensions list, Patrick Kettner (Google), 2025-11-06: "As long as an extension has the correct host permissions, then they will not be impacted by this." Two related bugs (crbug 435246545, 456078996) were fixed Nov 2025. **Formal documented exemption UNVERIFIED**; treat granted (optional) host permissions as the mechanism that avoids LNA blocking. |
| URLs | https://developer.chrome.com/blog/local-network-access (2025-06-09; update note 2025-09-29); https://developer.chrome.com/release-notes/142; https://groups.google.com/a/chromium.org/g/chromium-extensions/c/pUDh8RiTjJk; https://chromeenterprise.google/policies/local-network-access-allowed-for-urls/ |

## 15. Service worker lifecycle

| Field | Finding |
|---|---|
| Timeouts | Terminated "After 30 seconds of inactivity"; a single event/API call over 5 minutes; a fetch() response taking over 30 s. |
| Keep-alive | "Receiving an event or calling an extension API resets this timer." Chrome 110: API calls reset timers. Chrome 114: "Sending a message with long-lived messaging keeps the service worker alive. Opening a port no longer resets the timers." Chrome 116: active WebSockets extend lifetime. Chrome 118: debugger sessions. Chrome 105: native messaging. Chrome 120: "Alarms can now be set to a minimum period of 30s". |
| storage.session | "Chrome 102+ MV3+"; quota 10 MB (was 1 MB through Chrome 111). storage.local 10 MB (was 5 MB through 113); `unlimitedStorage` lifts it. |
| alarms | "Chrome limits alarms to at most once every 30 seconds"; values under 0.5 min are not honoured (packed); no floor unpacked; "an alarm will not wake up a device." Chrome 150: alarm names limited to 1024 bytes (TypeError). Max alarm count not stated — **UNVERIFIED**. |
| URLs | https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle (2023-05-02); https://developer.chrome.com/docs/extensions/reference/api/storage; https://developer.chrome.com/docs/extensions/reference/api/alarms; https://developer.chrome.com/docs/extensions/whats-new (2026-08-25, covers through Chrome 153) |

## 16. notifications.create

| Field | Finding |
|---|---|
| Requirement | `iconUrl`, `title`, `message`, `type` are all required for `create()`: "Note: This value is required for the notifications.create() method." Install warning: "Display notifications." |
| URL | https://developer.chrome.com/docs/extensions/reference/api/notifications |

---

## Implications for CTRL v1

**Manifest**
1. `manifest_version: 3`; `version` must be 1–4 numeric segments with no `-beta`/leading zeros — put pre-release labels in `version_name` only.
2. `name` at most 75 chars, `description` at most 132 chars plain text; consider a `short_name` of 12 chars or fewer.
3. Set `minimum_chrome_version` to at least "120" (alarms 30 s floor, storage.session, port keep-alive semantics); "142" if you want LNA-era behaviour guaranteed. Users below it stop receiving updates.
4. Keep `optional_host_permissions: ["http://*/*","https://*/*"]` but expect extended review; justify in the dashboard that origins are granted per user-configured server at runtime via `permissions.request`. Keep `activeTab` + `scripting` (no install warning) for page scan; do not add `tabs` or `<all_urls>` to `host_permissions`.
5. CSP: leave `extension_pages` at `script-src 'self'; object-src 'self'` (add `'wasm-unsafe-eval'` only if needed). Never allow-list remote script origins. If you set `connect-src`, `http:`/`https:` wildcards are not documented as prohibited, but keep it minimal or omit.
6. Alarm periods must be at least 0.5 min; alarm names under 1024 bytes; every `notifications.create` call must pass `type`, `iconUrl`, `title`, `message`.
7. No remote code: WXT bundle only; no `eval`, no CDN scripts. Declare "does not execute remote code" in the privacy tab.
8. LNA: private-IP/`.local` fetches from the service worker rely on the granted host permission (Google engineer statement, not formal docs). Add an in-app troubleshooting note telling users to grant the origin and, on managed devices, pointing admins to `LocalNetworkAccessAllowedForUrls`. Re-test on current stable (~Chrome 152) before submission.

**Listing / dashboard**
9. Single purpose statement: "Send magnet links to, and monitor, the user's own self-hosted BitTorrent client." Frame every feature (context menu, page scan, status polling, notifications) as serving that one purpose.
10. Privacy tab: tick **Authentication information** (stored credentials) and **Website content** (page scan reads magnet links from the active tab); nothing else. Complete all three Limited Use certifications. Write per-permission justifications for storage, contextMenus, notifications, activeTab, scripting, alarms and each optional host pattern.
11. Publish a privacy policy URL — required even though credentials never leave the device except to the user's own server (FAQ Q14/Q3). Cite the Q15 protocol-client exception to explain that traffic to the user-configured server (possibly plain HTTP on a LAN) is outside the Limited Use / secure-transmission scope, while still documenting AES-GCM/PBKDF2 at-rest encryption and the absence of telemetry.
12. In-product prominent disclosure (2026 policy, enforced since 2026-08-01): on first run / server setup show a consent screen stating what is stored (server URL, credentials, encrypted locally), where it is sent (only the configured server), and that nothing else is collected; re-show it if practices change in a later version.
13. Assets: 128x128 PNG icon (96 px art + 16 px padding, legible on dark and light), 5 screenshots at 1280x800, one 440x280 small promo tile (required), optional 1400x560 marquee; no video needed. Category: **Tools** (alternatives: Workflow & Planning, Functionality & UI).
14. Wording: avoid any listing/README language about obtaining copyrighted media; describe CTRL as a remote-control client for the user's own torrent client, analogous to FTP/IRC clients. Do not ship tracker/indexer integrations.
15. Account: pay the one-time fee (commonly $5), verify the contact email, enable 2-Step Verification on the Google account, complete the Trader/Non-Trader declaration (Non-Trader for a hobby project; Trader triggers identity verification and public disclosure).
16. Expect "new developer + new extension + broad optional host permissions" to trigger a longer manual review (days to weeks); keep the bundle unobfuscated (minified is fine) and small.
