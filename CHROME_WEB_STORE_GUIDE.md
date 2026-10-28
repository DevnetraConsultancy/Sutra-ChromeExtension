# Sutra — Chrome Web Store Publication Guide & Audit Report

**Extension:** Sutra — Bookmark Launchpad  
**Version:** 2.11.0  
**Developer:** Devnetra Consultancy (`devnetraconsultancy@gmail.com`)  
**Package:** `sutra-extension-v2.11.0.zip` (Ready for upload)

---

## 1. Executive Summary & Audit Log

A comprehensive, top-tier software audit was conducted on Sutra prior to Chrome Web Store (CWS) submission. The codebase was evaluated against Manifest V3 specifications, Chrome Web Store Developer Program Policies, WCAG 2.1 Accessibility guidelines, and web application security standards.

### Critical Issues Detected & Remediated:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| **1** | **CRITICAL** | **Broken Privacy Policy Link:** `dashboard.html` linked to `privacy-policy.html`, but the file did not exist in the repository, resulting in `ERR_FILE_NOT_FOUND` during review. | Authored and bundled a comprehensive, legally compliant `privacy-policy.html` matching Sutra's dark/light aesthetic. |
| **2** | **HIGH** | **Chrome Web Store Least Privilege Violation:** `bookmarks` was declared as a mandatory install permission, triggering intrusive warnings ("Read and change all your bookmarks") and manual review friction. | Migrated `"bookmarks"` to `"optional_permissions"`. Sutra now requests runtime permission on-demand only when the user clicks "Import from Chrome". |
| **3** | **MEDIUM** | **Duplicated Privacy Section in UI:** `dashboard.html` contained two identical "Privacy" sections back-to-back in the Settings modal. | Removed the duplicated section, streamlining the modal layout. |
| **4** | **MEDIUM** | **Favicon Image Race Condition:** Favicon load/error events were bound without checking `img.complete`, causing cached favicons to intermittently fail to hide fallback initials. | Added synchronous `complete` inspection and event listener fallbacks. |
| **5** | **MEDIUM** | **CSS Injection Risk in Wallpaper:** `applyPreferences()` assigned raw base64/URL strings directly into CSS `url(...)` without character sanitation. | Implemented strict regex validation and quote/backslash stripping before setting CSS variables. |
| **6** | **MEDIUM** | **WCAG 2.1 Keyboard Trap & Dialog Accessibility:** The bookmark modal refused to close on `Escape` key press and allowed keyboard focus to escape into background elements. | Added standard WCAG focus-trapping inside open dialogs, focus restoration on close, and smart Escape-key dismissal. |
| **7** | **LOW** | **Dead Code & Case Sensitivity in Move Bookmark:** An unreferenced `manageOneCategory` function existed, and manual group moving was strictly case-sensitive. | Removed dead code and implemented case-insensitive, trimmed group matching with user-friendly error handling. |
| **8** | **LOW** | **Duplicate CSS Rules:** `style.css` contained duplicate rules for `.tile-open`, `.tile-name`, and `.tile-domain`. | Cleaned and deduplicated CSS definitions. |
| **9** | **PACKAGING** | **ZIP Archive Path Format:** Standard Windows zip archives use backslashes (`\`), which can cause CWS upload unpack failures. | Generated `sutra-extension-v2.11.0.zip` with normalized forward-slash (`/`) entry paths conforming to POSIX/CWS zip standards. |

---

## 2. Chrome Web Store Listing Copy

Copy and paste these exact values into the **Store Listing** tab of the Chrome Web Store Developer Dashboard:

### Product Details
* **Extension Name:** `Sutra`
* **Short Description (Max 132 chars):**  
  `A compact website launchpad with visible predefined groups, manually ordered bookmarks, and Chrome bookmark import.`
* **Category:** `Productivity` (Secondary: `Workflow & Planning`)
* **Language:** `English`

### Detailed Description (Formatted for Store Listing)
```markdown
Sutra is a lightweight, distraction-free new-tab website launchpad designed for speed, clarity, and focus.

Replace overwhelming bookmark bars with an organized, categorized visual grid of your most essential web destinations.

⚡ KEY FEATURES

• Clean Visual Launchpad: Open new tabs into a fast, beautifully structured grid of your favorite sites.
• Predefined & Custom Groups: Organize links into logical collections (Work, Development, Tools, Design, Personal, and custom categories).
• Precise Drag & Drop Ordering: Reorder bookmarks and entire groups seamlessly. Lock layout mode to prevent accidental moves.
• On-Demand Chrome Bookmark Import: Copy your existing Chrome bookmarks and folders directly into Sutra with one click without altering your original browser bookmarks.
• Fast Instant Search: Press Ctrl+K to instantly filter through all your saved links and notes.
• Privacy-First Architecture: Zero tracking, zero telemetry, zero advertisements, and zero remote server connections. 100% of your data remains strictly on your device.
• Custom Wallpapers & Themes: Switch between light and dark themes or set a custom background image with automatic optimization.
• Complete JSON Backup & Restore: Export your entire workspace configuration or import backups anytime.

🔒 PRIVACY & PERMISSIONS

Sutra requires only minimal permissions to function:
- Storage: Stores your bookmarks, groups, and settings locally on your machine.
- Favicon: Retrieves site icons directly from Chrome's internal cache.
- Bookmarks (Optional): Requested only if you choose to import your Chrome bookmarks into Sutra.

Developed by Devnetra Consultancy.
Support: devnetraconsultancy@gmail.com
```

---

## 3. Chrome Web Store "Privacy" Tab Declarations

Google reviewers inspect this section thoroughly. Use the following answers:

### 1. Single Purpose Description
> "Sutra is a lightweight new-tab launchpad that allows users to organize, visually manage, and search their bookmarks and web shortcuts in customizable groups on their local device."

### 2. Permission Justifications
When prompted in the Developer Dashboard for why each permission is required:

* **`storage` Justification:**
  > "Used exclusively to store user bookmarks, category groupings, icon size preferences, layout lock state, and local wallpaper selections via chrome.storage.local on the user's computer."

* **`favicon` Justification:**
  > "Used exclusively to display website favicons directly from Chrome's built-in local favicon cache (/_favicon/) inside the visual bookmark tiles."

* **`bookmarks` (Optional Permission) Justification:**
  > "Declared as an optional runtime permission requested only on-demand when the user explicitly clicks 'Import from Chrome' in Settings. It reads existing bookmark titles and folder structures to allow one-click migration into Sutra. It is never accessed unless explicitly initiated by the user, and never modifies Chrome bookmarks."

### 3. Data Usage & Host Permissions
* **Does your extension collect user data?** No.
* **Does your extension transmit user data to remote servers?** No.
* **Host Permissions:** None requested (`<all_urls>` is NOT requested).
* **Remote Code:** None. All scripts, fonts, and assets are 100% bundled locally within the extension.

### 4. Privacy Policy URL
Enter the public URL of `privacy-policy.html` (e.g. hosted on your website or GitHub Pages):
`https://devnetra.github.io/sutra/privacy-policy.html` (or your domain).  
*Note: A local copy is also packaged inside the extension at `privacy-policy.html`.*

---

## 4. Visual Assets & Submission Checklist

Before submitting, prepare the following graphic assets:

1. **Store Icon:**
   - Size: `128 x 128 px` PNG (Already created: [icons/icon128.png](file:///d:/All%20Software%20Projects/Not%20Done/Sutra-ChromeExtension/icons/icon128.png))
2. **Screenshots (At least 1 required, 5 recommended):**
   - Size: `1280 x 800 px` or `640 x 400 px` (PNG or JPEG)
   - Recommended captures:
     - Screenshot 1: Default launchpad with dark theme and organized groups.
     - Screenshot 2: Instant search filtering via `Ctrl+K`.
     - Screenshot 3: Settings modal showing group management and Chrome import.
     - Screenshot 4: Light theme layout.
3. **Small Promotional Tile (Optional but recommended):**
   - Size: `440 x 280 px` PNG.
4. **Marquee Promotional Tile (Optional):**
   - Size: `1400 x 560 px` PNG.

---

## 5. Submission Steps

1. Log into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **Add new item**.
3. Upload the bundled package: `sutra-extension-v2.11.0.zip`.
4. Fill in the **Store Listing** tab using Section 2 above and upload screenshots.
5. Complete the **Privacy** tab using the justification text in Section 3 above.
6. Under **Distribution**, select your target countries (All regions recommended) and set visibility to **Public**.
7. Click **Submit for Review**.
