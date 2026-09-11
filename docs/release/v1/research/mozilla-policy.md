<!-- Verbatim research notes captured 2026-09-09 during the v1 release-completion pass. Evidence only: some recommendations below (activeTab/scripting, websiteContent, page scanning) predate the decision to remove page scanning; the accepted scope is docs/release/v1/V1_SCOPE.md. -->

# Mozilla / AMO requirements for CTRL v1 (Firefox MV3 listed submission)

All items verified against first-party Mozilla sources on **2026-09-09** unless marked UNVERIFIED. Quotes are verbatim (<=25 words). Sources abbreviated: EW = extensionworkshop.com, MDN = developer.mozilla.org, Blog = blog.mozilla.org/addons.

## 1. `browser_specific_settings.gecko.id`

| Aspect | Finding | Source |
|---|---|---|
| Mandatory for MV3 | Yes. "For Manifest V3 extensions you must add an ID to your extension's manifest.json file before it's submitted to AMO". addons-linter emits error `ADDON_ID_REQUIRED`. | https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/ ; https://mozilla.github.io/addons-linter/ |
| Format | Email-like `^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$` (e.g. `great_app@developers.company`; need not be a real mailbox) **or** GUID in braces `{8-4-4-4-12 hex}`. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings |
| Permanence | Fixed once first signed: "It's only at this point that the add-on is assigned a permanent ID, which is embedded in the signed packaged extension." Changing it later = a different add-on. | EW add-on-id page (above) |

## 2. `strict_min_version`

| Feature | Minimum Firefox | Source |
|---|---|---|
| MV3 generally available | 109 (dev preview from 101) | https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/ |
| `storage.session` | 115: "Support has been added for storage.session" (bug 1823713) | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/115 |
| `optional_host_permissions` | 128: "The optional_host_permissions manifest key has been added" (bug 1766026) | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/128 |
| `host_permissions` shown in install prompt | 127 (bug 1889402) | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/127 |
| Built-in data-consent UI (`data_collection_permissions`) | Desktop **140**, Android 142 (bug 1954524) | https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/140 ; https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ |
| Signature root-cert floor | "The minimum supported version capable of receiving updates is 115.0 (ESR) or, if ESR versions are not included, 128.0." | MDN browser_specific_settings |

Conclusion: the binding constraint is the consent UI. Mozilla's own option 1 for older versions is "Set strict_min_version to 140 (desktop)". Otherwise you must ship a custom consent flow for 128-139. Recommended for CTRL: `"strict_min_version": "140.0"`.

## 3. `data_collection_permissions`

| Aspect | Finding | Source |
|---|---|---|
| Shape | `browser_specific_settings.gecko.data_collection_permissions: { "required": [...], "optional": [...] }`. `required` is mandatory; must be `["none"]` or one or more categories; `optional` is optional. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings |
| Taxonomy (exact keys) | `authenticationInfo`, `bookmarksInfo`, `browsingActivity`, `financialAndPaymentInfo`, `healthInfo`, `locationInfo`, `personalCommunications`, `personallyIdentifyingInfo`, `searchTerms`, `websiteActivity`, `websiteContent`, and `technicalAndInteraction` (**optional array only**). `none` only valid in `required`, and exclusive (linter error `NONE_DATA_COLLECTION_IS_EXCLUSIVE`). | same; https://mozilla.github.io/addons-linter/ |
| Category definitions (quoted) | authenticationInfo: "passwords, usernames, personal identification numbers (PINs), security questions, and registration information for extensions that offer account-based services". websiteContent: "anything visible on a website — such as text, images, videos, and links — and anything embedded". technicalAndInteraction: "Device and browser info, extension usage and settings data, crash and error reports". browsingActivity: "Information about the websites users visit, such as specific URLs, domains, or categories of pages users view". | https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/ |
| Mandatory since | New extensions: **3 Nov 2025**. "From November 3, 2025, all new extensions must adopt the Firefox built-in data collection consent system." Existing add-ons: "will have to at a later date"; blog said "In the first half of 2026, Mozilla will require all extensions"—no 2026 blog post confirming enforcement found (UNVERIFIED whether that date landed). Irrelevant for CTRL: it is a new listing. Missing key on a new submission blocks signing. | EW builtin-consent page; https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/ |
| Consent UI versions | Desktop 140+, Android 142+. | EW builtin-consent page |
| Older versions | Three options: (1) `strict_min_version` 140/142; (2) "Turn off the data collection for old Firefox versions"; (3) show a custom consent experience per best-practices page. Detect via `permissions.getAll()` — if `data_collection` key absent, fall back. | same |
| Does user-configured server count? | Policy text is about *transmission*: "we are only concerned with the transmission of data outside of an extension or browser". Best-practices page does not carve out user-chosen destinations and even states "Data sent to native applications using NativeMessaging must be declared". No exception for user-owned/LAN servers found. However, the Aug-2025 policy update adds: for single-use extensions whose feature obviously requires transmission, "data consent is implied and developers are not required to ask for explicit consent". | https://blog.mozilla.org/addons/2025/06/23/updated-add-on-policies-simplified-clarified/ ; https://extensionworkshop.com/documentation/develop/best-practices-for-collecting-user-data-consents/ |

## 4. Add-on Policies

| Rule | Quote / finding | Source |
|---|---|---|
| Consent for personal data | "Before an add-on may transmit personal information, it must clearly describe, and the user must affirmatively consent (i.e., explicitly opt-in)". Technical data: opt-out allowed during initial consent. | https://extensionworkshop.com/documentation/publish/add-on-policies/ |
| Encryption | "Add-ons must use encryption when transporting data remotely." **No LAN / localhost / user-owned-server exception appears** in the policy or the FAQ (FAQ checked, none). Plain-HTTP to a user's own qBittorrent is a policy gray area; mitigate by defaulting to HTTPS, warning on http://, and documenting in reviewer notes. | same; https://extensionworkshop.com/documentation/publish/add-on-policies-faq/ |
| Leaking local info | "Leaking local or user-specific information to websites or other applications is prohibited." | policies |
| No Surprises | "Users should be able to easily discern the functionality of your add-on based on the listing"; unexpected features must be opt-in ("non-default action"). | policies |
| Remote code | "Add-ons must be self-contained and not load remote code for execution." | policies |
| Third-party libs | "Only release versions of third-party libraries and/or frameworks may be included. Modifications... are not permitted". Dependencies must be vendored or fetched from official package managers at build time (Aug-2025 update). | policies; Blog 2025-06-23 |
| Minified vs obfuscated | "Minification of code with the intent to reduce file size is permitted"; "Add-ons are not allowed to contain obfuscated code". Source must be submitted for minified/bundled code. | policies |
| Effective date | Current policy text effective **4 Aug 2025**. | Blog 2025-06-23 |

## 5. Source code submission

| Aspect | Finding | Source |
|---|---|---|
| When required | Any minifier ("uglifyJS"), bundler ("browserify or webpack"), template engine, or "any other custom tool that... generates file(s)". WXT/Vite qualifies. | https://extensionworkshop.com/documentation/publish/source-code-submission/ |
| Must include | README with "operating system and environment requirements", tool "required version and installation instructions", "a list of all the commands to generate an identical copy of the extension", and "the lockfile for any package management tools, such as npm or yarn". Build tools must be open source and "cannot be web-based: all review builds are run locally." | same |
| Reviewer procedure | "the reviewer runs the instructions you provided and then uses a diff tool to compare the generated sources to those in the extension. There must be no differences." Effectively identical output required. | same |
| Automated rebuild (new, 2026) | "AMO now attempts to build your extensions from the submitted source code and compares the result to the package you uploaded." Add an npm script named **`build-for-amo`**. | https://blog.mozilla.org/addons/2026/07/23/firefox-153-webextensions-api-updates/ |
| Reviewer environment | "Ubuntu 24.04.4 LTS (Desktop edition)", "Node 24.14.0 and npm 11.9.0", 35 GB free disk. Notify reviewers of any deviation. | EW source-code-submission |

## 6. addons-linter / web-ext lint

| Aspect | Finding | Source |
|---|---|---|
| Current versions | addons-linter **10.10.0** (engines node >=20; README says v22+); web-ext **10.6.0** bundles addons-linter 10.10.0. | https://registry.npmjs.org/addons-linter/latest ; https://registry.npmjs.org/web-ext/latest ; https://github.com/mozilla/addons-linter |
| Recommended invocation | `npm install -g addons-linter && addons-linter <dir-or-zip>` per README; `web-ext lint` "Reports errors in the extension manifest or other source code files" using addons-linter; `--warnings-as-errors`, `--self-hosted` available. `npx addons-linter` works but is not the documented form. | https://extensionworkshop.com/documentation/develop/web-ext-command-reference/ |
| `DANGEROUS_EVAL` | warning: "eval and the Function constructor are discouraged". Warnings do not block submission but are reviewed; prefer a build that avoids `new Function` in vendored libs. | https://mozilla.github.io/addons-linter/ |
| `UNSAFE_VAR_ASSIGNMENT` | warning: "Assignment using dynamic, unsanitized values" (innerHTML etc.). | same |
| `MISSING_DATA_COLLECTION_PERMISSIONS` | warning in linter, but AMO **rejects** new submissions without the key (see item 3). | same; Blog 2025-10-23 |
| Submission behaviour | "While warnings may proceed, addressing security and privacy flags is strongly recommended". | https://extensionworkshop.com/documentation/publish/submitting-an-add-on/ |

## 7. MV3 in Firefox

| Aspect | Finding | Source |
|---|---|---|
| Background | Firefox does not support `background.service_worker` (bug 1573659); uses `background.scripts` event page. Since Firefox 121 the event page starts even if `service_worker` is also present—specify both for cross-browser. `persistent: true` is an error in MV3. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background |
| Host permissions | Users "can grant or revoke any host permission on an ad-hoc basis". From 127, `host_permissions` are shown at install and granted; `optional_host_permissions` (128+) are runtime-only. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions ; MV3 migration guide |
| `permissions.request` | "The extension can only make the request inside the handler for a user action." Origins must be a subset of `optional_host_permissions`. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/permissions/request |
| Revocation UI | Extensions button panel and about:addons "Permissions" tab; users could manage optional permissions from the Add-ons Manager since Firefox 84. | https://blog.mozilla.org/addons/2022/11/17/unified-extensions-button-and-how-to-handle-permissions-in-manifest-v3/ ; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions |
| `permissions.onRemoved` | Available; Mozilla explicitly recommends listening to `onAdded`/`onRemoved` for host permissions. Exact first-supported version UNVERIFIED (compat table not fetched) but predates 84. | same |

## 8. CSP

| Aspect | Finding | Source |
|---|---|---|
| MV3 default | `"script-src 'self'; upgrade-insecure-requests;"` — **yes, includes `upgrade-insecure-requests`**, which would silently upgrade `http://` fetches to `https://` and break plain-HTTP LAN clients. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_Security_Policy |
| Custom CSP | Replaces the default entirely. `script-src`/`worker-src` may only contain `'self'`, `'none'`, `'wasm-unsafe-eval'`; no remote hosts, no hashes, no `'unsafe-eval'`; `object-src` optional since Firefox 106. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy |
| `connect-src http:` | Not restricted by the MV3 rules (only script/worker/object/default directives are constrained). Omitting `upgrade-insecure-requests` and setting `connect-src http: https:` is valid. UNVERIFIED that reviewers won't question it—explain in reviewer notes. | same |

## 9. Listing requirements

| Field | Finding | Source |
|---|---|---|
| Summary | max **250 characters** | https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/ |
| Description | no hard limit; HTML/bullets allowed, lead with benefits | same |
| Icon | "32x32 and 64x64" PNG/JPEG (AMO submission UI also accepts 128; SVG source recommended). 128 not stated on this page — UNVERIFIED. | same |
| Screenshots | "1280x800px (the maximum image display size)", 1.6:1 ratio | same |
| Categories | up to two; Firefox list: Alerts & Updates, Appearance, Bookmarks, **Download Management**, Feeds News & Blogging, Games & Entertainment, Language Support, Other, Photos Music & Videos, Privacy & Security, Search Tools, Shopping, Social & Communication, Tabs, Web Development | https://addons.mozilla.org/en-US/firefox/extensions/ |
| Privacy policy | Checkbox "This add-on has a privacy policy"; required if any user data is transmitted; may be self-hosted link since Aug 2025. | https://extensionworkshop.com/documentation/publish/submitting-an-add-on/ ; Blog 2025-06-23 |
| Notes to reviewer | "Notes for Reviewers" field: test credentials, build instructions, context. | EW submitting-an-add-on |
| Package size | max 200 MB | same |

## 10. Signing

| Aspect | Finding | Source |
|---|---|---|
| Requirement | "Extensions and themes need to be signed by Mozilla before they can be installed in release and beta versions of Firefox." Applies to listed and unlisted (self-distributed). | https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/ |
| Disabling | `xpinstall.signatures.required=false` in about:config works only in Developer Edition, Nightly, and ESR; needs an add-on ID. | same |
| Testing unsigned | about:debugging > This Firefox > "Load Temporary Add-on" (until restart, no signing needed); `web-ext run` (`--firefox deved|nightly|beta`, `--pref`). | https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/ ; EW web-ext reference |

## 11. Version string

| Rule | Finding | Source |
|---|---|---|
| Format | 1–4 dot-separated integers, each 0–9 digits, no leading zeros: `^(0|[1-9][0-9]{0,8})([.](0|[1-9][0-9]{0,8})){0,3}$`. Firefox 108+ warns on non-conforming strings. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/version |
| Suffixes | `1.0.0rc1` / `1.0.0-beta` do **not** match; use numeric (e.g. `1.0.0.1`) plus `version_name: "1.0.0 rc1"` for display. Chrome additionally caps parts at 65535 and rejects all-zero. | same |

## 12. Torrent / copyright policy statements

| Finding | Source |
|---|---|
| No policy text mentions torrents, BitTorrent, piracy, or copyright facilitation. Reviewers "do not handle reports of copyright or trademark infringements"; only "advertisements for illegal products or services" are rejected under the AUP. Comparable client-remote extensions (e.g. "Torrent Control") are listed on AMO. Do not use "Mozilla"/"Firefox" in the name. | https://extensionworkshop.com/documentation/publish/add-on-policies/ ; https://wiki.mozilla.org/Add-ons/Reviewers/Content_Review_Guidelines ; https://addons.mozilla.org/en-US/firefox/addon/torrent-control/ |

## 13. storage.session / alarms / notifications

| API | Finding | Source |
|---|---|---|
| `storage.session` | Firefox 115+; 10 MB quota; not exposed to content scripts by default. `storage.onChanged` and `storage.session.onChanged` fire for `session`. Firefox quirk (bug 1833153): listener "receives all the keys from a storage area where storageArea.set executes" and "may also be invoked when there is no change". | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session ; https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/onChanged |
| `alarms` | Alarms don't persist across sessions. MDN documents only Chrome's 30 s clamp for packed extensions; **no Firefox minimum documented** (UNVERIFIED whether Firefox clamps). Use >=1 min to be safe in both. | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms/create |
| `notifications` | Firefox "only supports the type, title, message, and iconUrl properties; and the only supported value for type is 'basic'"; `buttons`, `isClickable`, `appIconMaskUrl` unsupported. "If you call notifications.create() more than once in rapid succession, Firefox may end up not displaying any notification". | https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications/NotificationOptions ; .../notifications/create |

## Implications for CTRL v1

**Manifest**
1. Set a permanent `browser_specific_settings.gecko.id` (e.g. `ctrl@<your-domain>` or a braced GUID) now; never change it after first signing.
2. Set `strict_min_version: "140.0"` — required for the built-in consent UI, and it covers storage.session (115), optional_host_permissions (128), and the signature root-cert floor (128). Do not claim support below 140 unless you also implement a custom consent screen.
3. **Recommended `data_collection_permissions`:** `{"required": ["authenticationInfo", "websiteContent"], "optional": ["technicalAndInteraction"]}` — drop `technicalAndInteraction` if you ship no telemetry/error reporting. Justification: the policy scopes consent to *transmission outside the extension*; CTRL transmits the user's torrent-client username/password (matches the `authenticationInfo` definition verbatim) and page-scraped magnet links (`websiteContent`: "links... and anything embedded") to a network endpoint. There is no documented carve-out for user-configured or LAN destinations, and NativeMessaging is explicitly in scope, so `["none"]` would be a misdeclaration a reviewer can reject. Because the feature is self-evident (Aug-2025 "implied consent" clause) the built-in install prompt is sufficient consent; no extra opt-in dialog needed on 140+.
4. Keep the custom CSP `script-src 'self'; object-src 'self'; connect-src http: https:` — it is valid and, crucially, omits `upgrade-insecure-requests` (the Firefox MV3 default) which would break plain-HTTP LAN clients. Document this choice in reviewer notes.
5. Keep `background.scripts` (add `service_worker` alongside only if you ship a shared manifest for Chromium); ensure `persistent` is absent/false.
6. Version must be purely numeric (`1.0.0`); use `version_name` for "rc" labels.
7. Alarms >= 1 minute; notifications use only `type:'basic'`, `title`, `message`, `iconUrl`; throttle bursts.

**Code / policy**
8. "Must use encryption when transporting data remotely": default new connections to `https://`, show a persistent warning when the user configures `http://`, and state in the listing + reviewer notes that plain HTTP is a user-chosen LAN option. Consider blocking http to non-private IP ranges.
9. Ensure `permissions.request` stays inside the click/context-menu handler; listen to `permissions.onRemoved` to clear cached server state.
10. Audit vendored libs for `new Function`/`eval` (DANGEROUS_EVAL) and innerHTML (UNSAFE_VAR_ASSIGNMENT); include unmodified release builds only.

**Source submission**
11. Add `"build-for-amo"` npm script producing the exact Firefox zip; ship source with `package-lock.json`, README stating Ubuntu 24.04 / Node 24.14 / npm 11.9 expectations, exact commands, and `wxt`/`vite` versions; verify locally that a rebuild diffs clean against the uploaded zip (minified output must be deterministic — pin versions, avoid timestamps/hashes in filenames).

**Listing**
12. Summary <= 250 chars; category "Download Management" (+ optionally "Other"); icons 32/64 (+128); screenshots 1280x800; privacy policy link (self-hosted OK) describing credential storage (AES-GCM/PBKDF2, local only) and transmission only to the user-configured client; "Notes for Reviewers" with a test qBittorrent/Transmission setup (or docker command), the HTTP/LAN rationale, CSP rationale, and the "Scan page for magnet links" behaviour (reads only `a[href^="magnet:"]` on activeTab).

**Testing**
13. Use `web-ext lint --warnings-as-errors` (addons-linter 10.10.0) in CI; test unsigned builds via `web-ext run --firefox deved` or about:debugging on Firefox 155.
