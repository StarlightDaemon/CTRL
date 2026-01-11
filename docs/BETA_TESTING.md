# 🧪 CTRL Beta Program

⚠️ **BETA SOFTWARE** - This is pre-release software for testing purposes.

**Version**: v0.2.0-beta.1  
**Release Date**: January 2026  
**Status**: Public Beta Testing

---

## What is CTRL?

CTRL (Torrent Control) is a browser extension that provides a **unified interface for managing BitTorrent clients** directly from your browser. Send magnet links to your torrent client with one click, monitor downloads, and manage your queue without leaving your browser.

---

## 🎯 What's Working in Beta

### ✅ Fully Functional Features

#### Torrent Client Support (9 Clients)
- ✅ **qBittorrent** - Full support with categories, tags, and sequential download
- ✅ **Transmission** - Session management and directory support
- ✅ **Deluge** - Multi-step authentication and label support
- ✅ **Flood** - JWT authentication and tag management
- ✅ **ruTorrent** - XML-RPC support with fast resume
- ✅ **µTorrent** - Token-based auth with bitmask status
- ✅ **BiglyBT** - Basic operations
- ✅ **Vuze** - Basic operations
- ✅ **Aria2** - JSON-RPC multicall support

#### Site Integrations
- ⛔ **Discontinued** - Use Context Menu (Right-Click) integration instead.


#### Core Features
- ✅ **Multi-Server Support** - Manage multiple clients, switch instantly
- ✅ **Secure Vault** - AES-GCM encrypted credential storage
- ✅ **Queue Management** - Pause, resume, remove torrents
- ✅ **Download Monitoring** - Real-time speed and progress
- ✅ **Context Menu Integration** - Right-click to add magnets
- ✅ **Notifications** - Completion alerts
- ✅ **Theming** - Dark Mode, Light Mode, Low Power, Cyberpunk, Linux, Glass, Linear
- ✅ **Internationalization** - 7 languages (en, de, es, fi, fr, ru, zh_CN)
- ✅ **Import/Export** - Backup and restore settings

---

## ⚠️ Known Limitations

### Technical Debt
- **YTS.mx**: Planned integration via API/Context Menu.


### Not Implemented Yet
- **E2E Testing**: Playwright test infrastructure designed but not yet implemented
- **Performance Optimization**: Diffing engine for large torrent lists (>5,000 torrents) not yet implemented
- **Advanced i18n**: Build-time transformation pipeline planned

### Browser Support
- ✅ **Chrome/Edge**: Manifest V3, fully tested
- ✅ **Firefox**: Manifest V3, fully tested
- ❌ **Safari**: Not supported (requires native app)
- ❌ **Mobile**: Desktop browsers only (mobile browsers have limited extension support)

---

## 📦 How to Install (Beta)

### Method 1: From GitHub Releases (Recommended)

1. **Download the Extension**
   - Visit [Releases](https://github.com/YOUR_USERNAME/CTRL/releases)
   - Download `ctrl-chrome-v0.2.0-beta.1.zip` (for Chrome/Edge)
   - OR download `ctrl-firefox-v0.2.0-beta.1.zip` (for Firefox)
   - Extract the ZIP file

2. **Install in Chrome/Edge**
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the extracted folder
   - ✅ Extension will appear in your toolbar

3. **Install in Firefox**
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Navigate to extracted folder
   - Select `manifest.json`
   - ✅ Extension will appear in your toolbar
   - **Note**: Temporary add-ons in Firefox are removed when browser restarts

### Method 2: Build from Source

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/CTRL.git
cd CTRL/extension

# Install dependencies
npm install

# Build for Chrome
npm run build:chrome

# OR build for Firefox
npm run build:firefox

# Load from builds/chrome-mv3/ or builds/firefox-mv3/
```

---

## 🚀 Quick Start Guide

### Step 1: Configure Your First Client

1. Click the CTRL icon in your toolbar
2. Click **"Add Server"** or go to Options
3. Enter your torrent client details:
   - **Name**: "Home qBittorrent" (or whatever you prefer)
   - **Type**: Select your client (qBittorrent, Transmission, etc.)
   - **URL**: Your client's WebUI URL (e.g., `http://localhost:8080`)
   - **Username**: Your WebUI username
   - **Password**: Your WebUI password
4. Click **"Test Connection"**
5. If successful, click **"Save"**

### Step 2: Add a Torrent (Example with Ubuntu ISO)

**Option A: From a Torrent Site**
1. Visit any torrent site
2. Find a magnet link
3. Right-click the link -> "Add to [Client]"
4. ✅ Torrent starts downloading!


**Option B: Right-Click Context Menu**
1. Right-click any magnet link on any webpage
2. Select **"Add to qBittorrent"** (or your configured client)
3. ✅ Torrent starts downloading!

### Step 3: Monitor Downloads

1. Click the CTRL icon
2. See your active torrents, speeds, and progress
3. Use controls to pause, resume, or remove torrents

---

## 🐛 Known Issues & Workarounds

### Issue: "Connection Failed" Error
**Cause**: Client WebUI not accessible or wrong URL  
**Fix**:
1. Verify your client's WebUI is running
2. Check URL format: `http://192.168.1.100:8080` (include `http://`)
3. Try accessing the WebUI URL directly in your browser
4. Check firewall/network settings

### Issue: "Authentication Failed" Error
**Cause**: Wrong username/password  
**Fix**:
1. Verify credentials by logging into WebUI manually
2. Re-enter credentials in CTRL settings
3. For qBittorrent: Ensure "Bypass authentication for localhost" is OFF

### Issue: Extension Icon Greyed Out
**Cause**: No active server configured  
**Fix**: Add and test a server in Options


---

## 🧪 What We Need from Beta Testers

### Critical Testing Areas

1. **Multi-Client Compatibility**
   - Test with your specific torrent client version
   - Report any authentication issues
   - Verify torrent operations work (add, pause, resume, remove)

2. **Site Integration Stability**
   - Test on different torrent sites
   - Report if buttons don't appear
   - Check for layout conflicts or broken pages

3. **Cross-Browser Testing**
   - Test on Chrome, Edge, and Firefox
   - Report browser-specific bugs

4. **Edge Cases**
   - Large torrent lists (>100 torrents)
   - Slow/unreliable network connections
   - Multiple servers switching rapidly

### How to Report Bugs

**GitHub Issues**: https://github.com/YOUR_USERNAME/CTRL/issues

**Please include**:
1. **Browser**: Chrome/Edge/Firefox + version
2. **Extension Version**: v0.2.0-beta.1
3. **Torrent Client**: Type + version (e.g., "qBittorrent 4.6.2")
4. **Steps to Reproduce**: Detailed steps to trigger the bug
5. **Expected Behavior**: What should happen
6. **Actual Behavior**: What actually happens
7. **Screenshots**: If applicable
8. **Console Errors**: Open DevTools, check for red errors

---

## 📊 Beta Testing Goals

### Success Criteria for v1.0 Release

- [ ] **10+ active beta testers** providing feedback
- [ ] **<5 critical bugs** discovered
- [ ] **All 9 clients** verified working
- [ ] **Positive user feedback** on core functionality
- [ ] **No data loss** or credential security issues

### Roadmap to v1.0

**Next Release: v0.3.0** (Estimated: Week 4-7)
- ✅ Migrate 1337x to Shadow DOM
- ✅ Integrate YTS.mx (#1 movie site)
- ✅ Implement E2E testing with Playwright
- ✅ Performance benchmarking

**Production Release: v1.0** (Estimated: Week 13-16)
- ✅ Chrome Web Store submission
- ✅ Firefox AMO submission
- ✅ Code signing for installers
- ✅ Full E2E test coverage
- ✅ Accessibility score >90

---

## 🔒 Privacy & Security

**CTRL does NOT collect any data.**

- ✅ No analytics or tracking
- ✅ No telemetry
- ✅ No external servers (except your torrent clients)
- ✅ Credentials encrypted with AES-GCM locally
- ✅ Open source - code is auditable

**Privacy Policy**: [View Full Policy](https://YOUR_USERNAME.github.io/CTRL/privacy)

---

## 📝 Changelog (v0.2.0-beta.1)

### New Features
- 🎉 First public beta release
- ✅ Multi-server management
- ✅ 9 torrent client adapters
- ✅ Encrypted credential vault
- ✅ 7 language translations
- ⛔ **Site Integrations**: Removed for stability and store compliance.

### Testing
- ✅ 153 unit tests passing
- ✅ All adapter tests passing
- ⚠️ E2E tests pending


---

## 💬 Community & Support

**Questions?** Open a [Discussion](https://github.com/YOUR_USERNAME/CTRL/discussions)  
**Bugs?** Create an [Issue](https://github.com/YOUR_USERNAME/CTRL/issues)  
**Email**: [your-email@domain.com]

---

## 📚 Additional Resources

- [Main README](../README.md) - Project overview
- [ROADMAP](../ROADMAP.md) - Strategic direction
- [CONTRIBUTING](../CONTRIBUTING.md) - How to contribute
- [Privacy Policy](https://YOUR_USERNAME.github.io/CTRL/privacy) - Full privacy details

---

## ⚖️ Legal Disclaimer

CTRL is a **remote control utility** for BitTorrent clients. It does not provide, host, index, or distribute any files, media, or content. Users are solely responsible for the content they choose to transfer using their local torrent clients.

BitTorrent is a legitimate protocol used for distributing open-source software, public domain content, and other legal files. CTRL developers do not endorse or encourage copyright infringement.

---

## ❤️ Thank You, Beta Testers!

Your feedback is invaluable in making CTRL a production-ready extension. Thank you for being part of the beta program!

**Happy Testing! 🚀**

---

*CTRL v0.2.0-beta.1*  
*Released: January 2026*  
*Next Release: v0.3.0 (Week 4-7)*
