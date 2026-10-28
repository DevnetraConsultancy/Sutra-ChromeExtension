# Sutra — Bookmark Launchpad

> A compact, privacy-first website launchpad with predefined groups, drag-and-drop bookmark ordering, and Chrome bookmark import.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success)](manifest.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero-brightgreen)](privacy-policy.html)

---

## ⚡ Features

- **Organized Visual Launchpad:** Replaces the standard new-tab page with a clean, high-density grid of your bookmarks.
- **Predefined & Custom Groups:** Sort shortcuts into categorized collections (Work, Development, Tools, Design, Personal, etc.).
- **Drag & Drop Layout:** Seamlessly rearrange bookmarks within and across groups, or reorder entire collections.
- **Layout Lock:** Lock the grid to prevent accidental drags or drops.
- **On-Demand Chrome Bookmark Import:** Import your existing Chrome bookmarks and folder structure with a single click.
- **Instant Search:** Press <kbd>Ctrl</kbd> + <kbd>K</kbd> to quickly search and filter through all your saved bookmarks.
- **100% Client-Side Privacy:** Zero tracking, zero telemetry, no ads. All data is kept strictly on your local machine using Chrome's local storage.
- **Theme & Wallpaper Customization:** Dark and light modes, adjustable icon sizing, and custom wallpaper support with automatic compression.
- **JSON Backup & Restore:** Complete export and import capabilities for data portability.

---

## 🚀 Manual Installation (Developer Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/DevnetraConsultancy/Sutra-ChromeExtension.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the repository folder.
5. Open a new tab to see **Sutra** in action!

---

## 🛠️ Automated CI/CD (GitHub → Chrome Web Store)

This repository includes a GitHub Actions workflow in [`.github/workflows/deploy-cws.yml`](.github/workflows/deploy-cws.yml) for automated Chrome Web Store deployments.

For step-by-step instructions on setting up automated releases, see [`CI_CD_SETUP_GUIDE.md`](CI_CD_SETUP_GUIDE.md).

---

## 📋 Documentation & Guides

- [Chrome Web Store Publication Guide](CHROME_WEB_STORE_GUIDE.md) — Descriptions, permission justifications, and store listing assets.
- [CI/CD Setup Guide](CI_CD_SETUP_GUIDE.md) — Automate deployment via GitHub Actions.
- [Privacy Policy](privacy-policy.html) — Official zero-telemetry privacy policy.

---

## 🔒 Permissions & Security

Sutra adheres to the Principle of Least Privilege:
- `storage`: Saves bookmarks, layout preferences, and wallpapers locally via `chrome.storage.local`.
- `favicon`: Loads site icons directly from Chrome's internal cache (`/_favicon/`).
- `bookmarks` *(Optional)*: Requested only at runtime if you choose to import your existing Chrome bookmarks.

---

## 👤 Author & Support

Developed by **Devnetra Consultancy**  
Email: [devnetraconsultancy@gmail.com](mailto:devnetraconsultancy@gmail.com)
