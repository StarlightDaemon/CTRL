# Privacy Policy

**Last Updated**: April 2026  
**Effective Date**: January 2026

---

## Introduction

CTRL (Torrent Control) is a browser extension that provides a unified interface for managing BitTorrent clients directly from your browser. This privacy policy explains how CTRL handles your data.

## Data Collection

**CTRL does not collect, store, or transmit any personal data to external servers.**

We believe in privacy by design. All data processing occurs locally on your device, and nothing is sent to us or any third-party services.

## What Data is Stored Locally

CTRL stores the following data **locally** on your device using your browser's built-in storage API (`chrome.storage.local` or `browser.storage.local`):

### 1. Torrent Client Credentials
- **What**: Server URLs, usernames, and passwords for your torrent clients
- **Purpose**: To connect to and manage your torrent clients (qBittorrent, Transmission, Deluge, etc.)
- **Security**: All credentials are encrypted using AES-GCM encryption before being stored locally
- **Location**: Browser's local storage on your device only
- **Transmission**: Credentials are never transmitted outside your device

### 2. User Preferences
- **What**: Your settings and preferences (theme, language, notification settings, etc.)
- **Purpose**: To provide a personalized experience
- **Location**: Browser's local storage on your device only

### 3. Extension State
- **What**: Active server selection, UI state, feature toggles
- **Purpose**: To maintain your workspace across browser sessions
- **Location**: Browser's local storage on your device only

## What Data is NOT Collected

CTRL explicitly does **NOT** collect, store, or transmit:

- ❌ Browsing history
- ❌ Personal information (name, email, address)
- ❌ Torrent content or metadata
- ❌ Magnet links or torrent hashes to external servers
- ❌ Usage analytics or telemetry
- ❌ Crash reports
- ❌ IP addresses
- ❌ Any data to advertising networks

## How CTRL Works

### User-Initiated Actions
CTRL operates only when you explicitly interact with it. It does not automatically modify web pages or background-monitor your browsing activity.

**How you interact with CTRL**:
1. **Context Menus**: You can right-click on a magnet link or a page to send torrents directly to your client.
2. **Scan Page**: You can manually trigger a "Scan Page for Magnets" action from the context menu. This generically scans the current page for magnet links (`magnet:?xt=...`) and adds them to your selected client.
3. **Manual Addition**: You can add torrents by pasting URLs or magnet links directly into the extension popup.

**What happens**:
1. When you initiate an action, CTRL processes the request **locally**.
2. If scanning a page, it identifies links matching the magnet protocol.
3. The link is sent directly to **your configured torrent client** (on your local network or remote server).

**What does NOT happen**:
- CTRL does not automatically inject UI components or buttons into websites.
- CTRL does not detect magnet links on page load; it only scans when you tell it to.
- CTRL does not track which torrents you view or download.
- CTRL does not send any data about your browsing to external servers.

### Protocol Handling
CTRL is **content-agnostic**. It processes magnet URI hashes (strings) without knowledge of what content they represent. The extension does not know if a magnet link points to a Linux ISO, open-source software, or any other type of file.

### Communication with Torrent Clients
When you initiate a download:
1. CTRL sends the magnet link to **your configured torrent client** using HTTP/HTTPS requests
2. Communication is **direct** between your browser and your client (localhost or your specified server)
3. No intermediary servers are involved
4. No data is sent to CTRL developers or third parties

## Third-Party Services

CTRL does **NOT** use any third-party services for:
- Analytics (e.g., Google Analytics)
- Crash reporting (e.g., Sentry)
- Advertising networks
- Cloud storage or sync

## Permissions Explained

CTRL requests the following browser permissions:

### `storage`
**Purpose**: To store your encrypted credentials and preferences locally on your device.  
**Data Access**: Only data created by CTRL (your settings and server configurations).

### `contextMenus`
**Purpose**: To add right-click menu options for sending magnet links to your torrent clients.  
**Data Access**: Only the text/URL you right-clicked on.

### `notifications`
**Purpose**: To notify you when downloads complete or errors occur.  
**Data Access**: None. Notifications are created locally.

### `activeTab`
**Purpose**: To generically scan the current page for magnet links when you manually select the "Scan Page" option from the context menu.  
**Data Access**: Only the ability to identify magnet link URLs (`href` attributes) on the page you are currently viewing and have interacted with.

### `optional_host_permissions`
**Purpose**: To allow communication with your self-hosted torrent client (e.g., qBittorrent, Transmission).  
**Data Access**: Permissions are only requested for the specific URL of your torrent client. No data from other websites is accessed using these permissions.

## Your Rights

Since CTRL does not collect any personal data, there is no data for you to request, correct, or delete from our servers (because we don't have servers).

However, you have full control over locally stored data:
- **View**: Inspect your browser's extension storage using developer tools
- **Delete**: Uninstall the extension to remove all local data
- **Export**: Use CTRL's built-in export feature to backup your settings
- **Modify**: Change settings at any time in the Options page

## Children's Privacy

CTRL does not knowingly collect any information from anyone, including children under the age of 13.

## Changes to This Privacy Policy

We may update this privacy policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of CTRL after changes constitutes acceptance of the updated policy.

## Open Source Transparency

CTRL is open-source software. You can inspect the source code to verify our privacy claims:

**GitHub Repository**: https://github.com/StarlightDaemon/CTRL

The code shows:
- No analytics libraries
- No network requests to external servers (except to your configured torrent clients)
- All storage operations use local browser APIs
- Encryption implementation for credential storage

## Legal Disclaimer

CTRL is a remote control utility for BitTorrent clients. The extension does not provide, host, index, or distribute any files, media, or content. Users are solely responsible for the content they choose to transfer using their local torrent clients.

BitTorrent is a legitimate protocol used for distributing open-source software, public domain content, and other legal files. CTRL developers do not endorse or encourage copyright infringement.

## Contact

If you have questions about this privacy policy or CTRL's data practices:

- **GitHub Discussions**: https://github.com/StarlightDaemon/CTRL/discussions
- **GitHub Issues**: https://github.com/StarlightDaemon/CTRL/issues

---

## Summary (TL;DR)

✅ **Zero data collection** - Nothing is sent to external servers  
✅ **Local encryption** - Credentials encrypted with AES-GCM  
✅ **No tracking** - No analytics, no telemetry  
✅ **Open source** - Code is publicly auditable  
✅ **Content agnostic** - Extension doesn't know what you download  
✅ **Direct communication** - Browser → Your Client (no middleman)  

**Your privacy is our priority.**

---

*This privacy policy is effective as of January 2026 and applies to CTRL version 0.2.0 and later.*
