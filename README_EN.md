<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./design/assets/brand/ldsp-mark-white.svg" />
    <img src="./design/assets/brand/ldsp-mark.svg" width="120" height="120" alt="LDSP Logo" />
  </picture>
  
  # 🚀 LDStatusPro

> **Linux.do & IDCFlare Community Enhancement Tool** - Trust Level Tracking · Reading Stats · Cloud Sync · Leaderboard · LD Store Shortcut

![Version](https://img.shields.io/badge/version-v3.9.0.12-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-✓-brightgreen)
![Multi-Site](https://img.shields.io/badge/Multi--Site-✓-brightgreen)
![Mobile](https://img.shields.io/badge/Mobile-✓-brightgreen)
![Code Size](https://img.shields.io/github/languages/code-size/caigg188/LDStatusPro)
![Stars](https://img.shields.io/github/stars/caigg188/LDStatusPro?style=flat)

🌐 **[Website](https://ldspro.qzz.io/)** | 🏪 **[LD Store](https://ldcstore.com/)** | 📖 **[Userscript Guide](./DOCS.md)**

The authoritative userscript version is the `@version` field in `LDStatusPro.user.js` (currently **3.9.0.12**). `update_log.md` stops at v3.5.4.10; see the recent entries below and git history for later changes.

[简体中文](./README.md) | **English** | [繁體中文](./README_TW.md)

This English README is synchronized with the [Simplified Chinese README](./README.md) through v3.9.0.12. The linked userscript guide and design documents are in Chinese.

</div>

---

## Brand & Design Standards

The current LDSP brand strategy, design language, logos, static assets, motion, real product previews, and desktop/tablet/mobile standards are maintained in [design/README.md](./design/README.md). Use these standards for future design and interface work. Original proposals in `design/archive/` are retained for historical reference only.

## 🌟 Core Features

### Interface language · v3.9.0.8

The userscript now offers an optional **English (US)** interface. Simplified Chinese remains the default.

To switch, open **⚙️ Settings → 🌐 界面语言 (Language) → English (US)**, then click **Reload page to apply**. The preference is saved locally for each site. Finish or stop active summaries, follow-up chats and exports, and save any pending plugin form edits before reloading. Forum posts, user content and AI output are not automatically translated.

Thanks to [@lulavc7221](https://github.com/lulavc7221) for contributing English support! See the [v3.9.0.8 release notes](https://github.com/caigg188/LDStatusPro/releases/tag/v3.9.0.8).

<table>
<tr>
<td width="50%">

### ☁️ Cloud Data Sync

- **Cross-browser Sync** - Chrome / Firefox / Edge / Safari
- **Cross-device Sync** - Desktop / Laptop / Tablet / Mobile
- **Smart Data Merge** - Auto keeps higher value per day
- **365-day History Recovery** - Auto restore on new devices
- **Upgrade History Sync** - Supported for all user levels

</td>
<td width="50%">

### 🏆 Reading Leaderboard

- **Three Rankings** - Daily / Weekly / Monthly
- **Top 50** - Shows top 50 by reading time
- **Privacy First** - Opt-in participation
- **Gold/Silver/Bronze** - Special display for top 3
- **Manual Refresh** - 5-min cooldown, independent per board

</td>
</tr>
<tr>
<td>

### ⏱️ Reading Time System

- **Up to 10 Reading Levels** - Progressive achievement system
- **Smart Activity Detection** - Auto pause after 60s idle
- **Dynamic Visual Feedback** - Color changes with intensity
- **Server Configurable** - Admin can adjust level thresholds
- **24-hour Local Cache** - Works offline too

</td>
<td>

### 📊 Trust Level Tracking

- **Real-time Progress** - Intuitive circular progress bar
- **Multi-dimensional Stats** - Topics viewed, posts read, likes received, replies, and topics created
- **Smart Change Markers** - Real-time highlight for changes
- **365-day Trend Analysis** - Heatmap/Line/Bar charts
- **Milestone Notifications** - Level 5 achievement alerts

</td>
</tr>
<tr>
<td>

### 🍉 Thread Summarizer

- **AI Thread Summary** - One-click summary, brief/detailed modes
- **Follow-up Chat** - Continue asking based on summary
- **Streaming Output** - Real-time AI response display
- **History Records** - Save summaries, view/copy/delete
- **Custom Prompts** - Personalize AI behavior

</td>
<td>

### 🍟 LDC Credits

- **Balance View** - Show credit.linux.do balance
- **Daily Estimate** - Estimate earnings based on L-site changes
- **7-day Stats** - Weekly income/expense trend chart
- **Transaction Records** - Filter by time/type
- **❤️ Donation Support** - 2/5/10/50 LDC tiers

</td>
</tr>
<tr>
<td>

### 📋 My Activity

- **Reading History** - Quick review of browsed topics
- **Bookmark Manager** - View all bookmarks at once
- **Reply Records** - View reply content and time
- **Interactions** - View Discourse Reactions records
- **Like History** - Review liked content
- **🔍 Search** - Title/tag search support

</td>
<td>

### 🏪 LD Store

- **Web App Shortcut** - Open the LD Store website directly from the panel
- **Opens in a New Tab** - Keep the current forum page unchanged
- **Separate from the Userscript** - Store features evolve in the standalone web app
- **Panel Entry Retained** - Continue using the panel's Store button
- **More Stable Access** - Avoid compatibility issues with an embedded store panel

</td>
</tr>
<tr>
<td>

### 🔑 CDK Panel

- **User Info** - Avatar, nickname, trust level, CDK score
- **Claim Records** - View claimed CDK projects
- **Project Details** - Name, description, remaining, requirements
- **One-click Copy** - Quick copy CDK content
- **Waterfall Loading** - Smooth data loading experience

</td>
<td>

### 🎫 Feedback Tickets

- **Quick Feedback** - One-click ticket submission
- **Multiple Types** - Feature Request / Bug Report
- **Two-way Communication** - User and admin replies
- **Unread Notifications** - Red dot for new replies

</td>
</tr>
</table>

---

## 🌐 Supported Sites

|     Site     | Trust Level | Reading Stats | Cloud Sync | Leaderboard |
| :----------: | :---------: | :-----------: | :--------: | :---------: |
| **Linux.do** |     ✅      |      ✅       |     ✅     |     ✅      |
| **IDCFlare** |     ✅      |      ✅       |     ✅     |     ✅      |

> Both sites have identical features, independent OAuth authentication, isolated data

---

## 📱 Cross-Platform Compatible

### Responsive Design

- **Large Screens** (≥1920px) - 340px panel width, larger fonts
- **Medium Screens** (≤768px) - Smart right-align, 280px width
- **Small Devices** (≤480px) - Compact layout, 260px width
- **Short Screens** (≤500px) - Auto hide non-essential elements

### Mobile Support

- ✅ Touch drag to move panel
- ✅ Draggable in collapsed state
- ✅ Adaptive fonts and spacing
- ✅ Optimized touch targets

---

## 🎨 UI/UX Design

### New Visual Experience

- 🎉 **100% Completion Celebration** - Confetti animation on progress complete
- ✨ **Level Badge Animation** - 360° flip on hover + gradient flow
- 🌈 **Level-specific Colors** - Lv1 Gray/Lv2 Blue/Lv3 Teal/Lv4 Gold-Orange-Red
- 🎨 **Glassmorphism Design** - Frosted glass effect + glowing borders
- 💫 **Micro-interactions** - Hover lift/elastic scale/enhanced shadows

### Theme System

- 🌙 **Dark Theme** - Deep background + glass cards
- ☀️ **Light Theme** - Transparent white + elegant shadows
- 🔄 **One-click Switch** - Auto remembers user preference

---

## 🔐 Security & Privacy

| Feature                         | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| ✅ **Local Storage**            | Data stored in browser, no forced uploads       |
| ✅ **OAuth Authentication**     | Secure login with official accounts             |
| ✅ **XSS Protection**           | Full input validation and escaping front & back |
| ✅ **SQL Injection Protection** | Parameterized queries throughout                |
| ✅ **User Choice**              | Cloud sync/leaderboard are opt-in               |
| ✅ **Easy Exit**                | Can leave leaderboard or logout anytime         |
| ✅ **Data Isolation**           | Multi-account/multi-site independent storage    |

---

## ⚡ Quick Start

### 1. Install Userscript Manager

| Browser        | Recommended  | Install Link                                                                                            |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Chrome/Edge    | Tampermonkey | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en) |
| Firefox        | Tampermonkey | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)                         |
| Safari (macOS) | Tampermonkey | [App Store](https://apps.apple.com/us/app/tampermonkey/id1482490089)                                    |
| Safari (iOS)   | Stay         | [App Store](https://apps.apple.com/app/stay-for-safari/id1591620171)                                    |

### 2. Install Script

| Method               | Description                     | Link                                                                                               |
| -------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| 🚀 **GitHub Direct** | Latest version, instant updates | [**Install Now**](https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js) |
| 📦 **GreasyFork**    | Alternative source, auto sync   | [GreasyFork Page](https://greasyfork.org/en/scripts/558575-ldstatus-pro)                           |

### 3. Start Using

- Visit [Linux.do](https://linux.do) or [IDCFlare](https://idcflare.com)
- The panel appears automatically on the page
- Login to enable cloud sync and leaderboard
- Use the panel's **Store** shortcut to open the LD Store web app in a new tab

---

## 📊 Reading Level System

|      Level      | Icon |    Range    | Color  |
| :-------------: | :--: | :---------: | :----: |
|  Just Started   |  🌱  |  0-30 min   |  Gray  |
|   Warming Up    |  📖  |  30-90 min  |  Blue  |
| Getting Into It |  📚  | 90-180 min  | Green  |
|    Immersed     |  🔥  | 180-300 min | Yellow |
|  Deep Learning  |  ⚡  | 300-450 min | Orange |
|    LD Expert    |  🏆  | 450-600 min | Purple |
|  Super Reader   |  👑  |  600+ min   |  Pink  |

> 💡 Admins can customize level thresholds and names in backend "System Settings"

---

## 🛠️ Repository Scope

This repository contains three frontend components only. The backend, admin panel, security services, and observability platform live in separate repositories.

```
LDStatusPro/
├── LDStatusPro.user.js    # Tampermonkey userscript (main API: api1)
├── ld-store/             # LD Store web app (Vue 3 + Vite 8) → https://ldcstore.com/
└── website/              # Product website (React 19 + Vite 7) → https://ldspro.qzz.io/
```

| Frontend | Service Usage |
|---|---|
| Userscript | `https://api1.ldspro.qzz.io` (OAuth / reading / leaderboards / tickets) |
| LD Store web app | Authentication → api1; business operations → api2; image hosting → api |
| Product website | Static homepage content; annual report uses `https://api.ldspro.qzz.io` |

### Tech Stack

- **Userscript**: Native JavaScript with markdown-it and DOMPurify embedded at build time; no runtime CDN dependencies. The script metadata determines the version.
- **LD Store web app**: Vue 3.5 + Vite 8 + Pinia + Vue Router 4 + Tailwind CSS 3.4
- **Product website**: React 19.2 + TypeScript + Vite 7.2 + Tailwind CSS 4 + Framer Motion; the homepage does not use a CMS API
- **Authentication**: api1 issues JWTs for user OAuth; the admin panel is not part of this repository

### Performance Optimizations

- LRU cache for historical data aggregation
- Batch write merging for storage operations
- API response cache + request deduplication + data buffering
- Async rendering to avoid UI blocking
- Exponential backoff retry mechanism
- Global request queue to prevent 429

---

## 📋 Changelog

### v3.9.0.12

- Resize the panel from all four edges and corners. On desktop, widen it up to the viewport margins; double-click any handle to restore the default size. Older size preferences retain content-adaptive height.
- Prevent duplicate panels from starting inside App Marketplace and other iframes while preserving the CDK iframe bridge.
- Fix indentation in the embedded build that damaged Markdown, code blocks, and AI prompts, and add a build-time guard against such corruption.
- Improve topic exports: quote attribution, task lists, table alignment, formulas, video links, image captions, superscripts, and subscripts. Preserve titles and user information literally in exported documents.
- Thanks to [@lulavc7221](https://github.com/lulavc7221) for contributing ([#105](https://github.com/caigg188/LDStatusPro/pull/105), [#106](https://github.com/caigg188/LDStatusPro/pull/106), [#107](https://github.com/caigg188/LDStatusPro/pull/107)).

### v3.9.0.11

- Prevent authentication errors from older login requests from clearing a newer session, including same-tab re-login and sessions shared across tabs.
- Keep LD Store signed in when image-host authentication fails. The store service validates image-host credentials, and services keep separate keys.

### v3.9.0.10

- Fix valid authorization codes being rejected because of device clock skew. Both the store and userscript rely on the server to determine code expiry.
- Improve upgrade guidance for older clients and recovery from authorization failures. Expired or already-used codes require starting login again.

### v3.9.0.9

- Replace JWTs in login callback URLs with browser-bound, single-use authorization codes and strictly validate callback origins.
- Support the backend's login-key isolation upgrade: update the userscript and sign in again. Account profiles, orders, and balances are retained.

### v3.9.0.8

- Add an optional English (US) userscript interface covering the panel, settings, reading statistics and trends, leaderboards, tickets, LDC/CDK, AI tools, and exports.
- Simplified Chinese remains the default. Open **⚙️ Settings → 🌐 界面语言 (Language) → English (US)**, then click **Reload page to apply**. The language preference is stored locally per site.
- Save the language preference before switching. Reloading checks for active summaries, follow-up chats, exports, and unsaved related forms. Forum posts, user content, and AI output are not automatically translated.
- Fix clipped settings-menu text in narrow panels and at larger font sizes, and add AI connection troubleshooting guidance.
- Thanks to [@lulavc7221](https://github.com/lulavc7221) for English support, menu fixes, and documentation ([#97](https://github.com/caigg188/LDStatusPro/pull/97), [#98](https://github.com/caigg188/LDStatusPro/pull/98), [#99](https://github.com/caigg188/LDStatusPro/pull/99)).

### v3.9.0.7

- Share a content cache, serialized request throttling, and cancellable backoff between topic exports and AI summaries, reading posts by their actual post numbers.
- Fix original-image selection, cross-origin image embedding, and completeness reports; improve rich-text layout in HTML, Markdown, and print-to-PDF exports.
- Send AI requests through the userscript manager's background transport, supporting local HTTP OpenAI-compatible services, optional API keys, and connection checks.
- Add segmented summaries for long topics, stopping, and reuse on retry after failure. Retain partial results and source post numbers, and upgrade safe Markdown rendering.
- Preserve existing settings and history. New history records include the site, range, model, and completion status. See the [export and AI summary guide (Chinese)](./DOCS.md#帖子导出与-ai-总结).

### v3.9.0.6

- Harden the CDK/LDC bridge: require HTTPS, an exact origin, and a path under `/api/`, with validation on both the parent and bridge pages.
- Escape summarizer Markdown before formatting and allow only HTTP(S) links to prevent XSS from model output.
- Route hot-path debug logs through `Logger` instead of printing OAuth and upgrade data to the console.
- Remove panel-wide selector transitions. Use a five-second LDC heartbeat and avoid 500ms polling when GM value listeners are available.
- Extract pure security helpers to `src/core/sanitize.mjs`, embed them in `SafeDom`, and cover them with `npm test` regressions.

### v3.9.0.3

- Userscript metadata version: `3.9.0.3`. Recent changes mainly affect `ld-store` (refunds, announcements, seller Telegram integration, checkout, and image-host authentication); see git history.

### v3.9.0.0

- Fix frozen LDC overview and transaction pages by restoring missing request, rendering, and close logic.
- Fix unresponsive refresh and close buttons in the LDC panel header.
- Prevent repeated automatic loading on the transaction page; load one page at a time when scrolling to the bottom.
- Correct transaction filters to use a `types` array and fix time-range request boundaries.
- Improve transaction types, income/expense direction, and status display, including online transfers, community transfers, and merchant distributions.

### v3.8.8.9

- Fix upgrade requirement targets occasionally appearing as `0` by strengthening parsing of the connect page.
- Add letter-avatar fallbacks for leaderboards and user avatars, with automatic backoff when remote avatars fail.
- Remove the embedded LD Store implementation from the userscript; keep the shortcut and open the web app in a new tab.
- Restore the minimized icon's original design and animation while improving rendering compatibility and stability.
- Update README installation links, version information, and LD Store usage instructions.

### v3.5.4.x 🏪 LD Store

**🏪 Virtual Item Exchange Hub**

- 💳 **LDC Credit Exchange** - Exchange virtual items and services with LDC credits
- 📦 **CDK Auto Delivery** - Auto receive CDK after exchange, one-click copy
- 👤 **Merchant Portal** - Bind LDC account to publish exchange listings
- 📋 **Order Tracking** - View exchange records and status
- 🔑 **CDK Management** - Merchants can bulk add, view, copy CDK

**🛡️ Security Hardening**

- 🔒 XSS Protection Enhanced - Fixed unescaped product names in dialogs
- 🔐 CDK Race Condition Fixed - Atomic UPDATE to prevent overselling
- 💉 SQL Injection Protection - Parameterized queries throughout

**🎨 UI/UX Improvements**

- 🖼️ Detail page optimization - 16:9 image ratio, larger description area
- 📜 List scroll memory - Restores scroll position when returning to list
- ⚠️ Rejection/delist reason display - Shows reasons in My Listings

---

### v3.5.2.x 🔑 CDK Panel & Request Optimization

**🔑 New CDK Panel**

- Integrated CDK panel on cdk.linux.do page
- View user info, claim records, project details

**⚡ Request Optimization**

- 🚦 Global request queue - 300ms minimum interval to prevent 429
- ⏱️ 429 rate limit cooldown - No new requests for 2 minutes
- 💬 Error message improvements - Smart error type detection, friendly tips

---

### v3.5.0.x 🎉 Core Features

**✨ Thread Summarizer**

- 🍉 AI Thread Summary / 📜 History Records / ✏️ Custom Prompts / 💬 Follow-up Chat

**📋 My Activity**

- 📖 Read / ⭐ Bookmarks / 💬 Replies / ❤️ Liked / 📝 My Topics / 🔍 Search

**🍟 LDC Credits**

- 💰 Balance / 📊 7-day Stats / 📈 Daily Estimate / ❤️ Donation Support

[Older Changelog (through v3.5.4.10, Chinese)](./update_log.md)

---

## ❓ FAQ

<details>
<summary><b>❗ Panel not showing?</b></summary>

If the panel doesn't appear after installation, try these steps:

1. **Enable Browser Developer Mode**

   - Chrome/Edge: Open `chrome://extensions/`, enable "Developer mode" at top right
   - Firefox: Open `about:debugging`, no extra settings needed

2. **Check Tampermonkey Settings**

   - Click Tampermonkey icon → Dashboard
   - Find LDStatus Pro script, ensure it's enabled (switch is ON)
   - Go to "Settings" → Ensure "Allowed permissions for user scripts" is correct

3. **Refresh the Page**
   - After completing above settings, refresh Linux.do or IDCFlare page
   - The panel should appear on the page

> 💡 If still not showing, try disabling other potentially conflicting extensions

</details>

<details>
<summary><b>🦊 Firefox login fails?</b></summary>

Some Firefox users may experience OAuth login failures due to privacy settings (authorization succeeds but panel doesn't update). Try these steps:

1. **Check Enhanced Tracking Protection**

   - Open `about:preferences#privacy`
   - If set to "Strict", try changing to "Standard"

2. **Check Container Tabs** (if using Multi-Account Containers extension)

   - Ensure auth popup and main page are in **the same container**
   - Or temporarily login in a regular tab without containers

3. **Check Third-party Cookie Settings**
   - Ensure third-party cookies aren't completely blocked
   - Check in `about:preferences#privacy` → "Cookies and Site Data"

> 💡 Chrome, Edge, and other browsers usually don't have this issue

</details>

<details>
<summary><b>📊 Why isn't reading time increasing?</b></summary>

- The script detects mouse movement, scrolling, clicks, and other activity
- **60 seconds of inactivity** will auto-pause the timer
- Timer resumes when activity is detected
</details>

<details>
<summary><b>☁️ Will cloud sync overwrite local data?</b></summary>

- Cloud sync uses a **keep higher value** merge strategy
- For the same day, keeps the higher value between local and cloud
- No recorded reading time will be lost
</details>

<details>
<summary><b>🏪 How do I open LD Store?</b></summary>

1. Open the **Store** shortcut in the userscript panel.
2. The script opens the LD Store web app in a new tab.
3. Your current Linux.do / IDCFlare page stays unchanged.
4. If your browser blocks the new tab, allow popups and try again.
</details>

---

## ⭐ Star History

<a href="https://star-history.dera.page/#caigg188/LDStatusPro&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=caigg188/LDStatusPro&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=caigg188/LDStatusPro&type=Date" />
   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=caigg188/LDStatusPro&type=Date" />
 </picture>
</a>

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

- 🐛 [Report Issues](https://github.com/caigg188/LDStatusPro/issues)
- 💡 [Feature Requests](https://github.com/caigg188/LDStatusPro/issues)
- 📖 [Documentation](./DOCS.md)
- 🔧 [CI / CD (Chinese)](./CI.md): pushes run checks; production Pages deployments are manual

---

## 📄 License

MIT License - Free to use, modify, and distribute

---

<div align="center">

**Made with ❤️ for Linux.do Community**

[GitHub](https://github.com/caigg188/LDStatusPro) · [Install Script](https://raw.githubusercontent.com/caigg188/LDStatusPro/main/LDStatusPro.user.js) · [Report Issues](https://github.com/caigg188/LDStatusPro/issues)

**⭐ If this helps, please give it a Star!**

</div>
