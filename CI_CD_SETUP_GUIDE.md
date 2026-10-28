# GitHub to Chrome Web Store (CI/CD Pipeline)

Just like **GitHub → Vercel** automatically deploys your web apps when you push code, you can set up **GitHub → Chrome Web Store** to automatically package and publish your extension updates.

We have created the GitHub Actions workflow at [`.github/workflows/deploy-cws.yml`](file:///d:/All%20Software%20Projects/Not%20Done/Sutra-ChromeExtension/.github/workflows/deploy-cws.yml).

---

## How It Works

```
[ Local Dev ] 
      │  (git push tag v2.11.1 / Run Workflow)
      ▼
[ GitHub Repository ]
      │
      ▼
[ GitHub Actions Runner ]
      │  • Check out repository
      │  • Package clean production zip (sutra.zip)
      │  • Connect to Google Chrome Web Store API (OAuth2)
      ▼
[ Chrome Web Store ]
      • Uploads updated zip
      • Automatically submits update for review
```

---

## One-Time Setup (Takes ~10 minutes)

To allow GitHub Actions to securely speak to the Chrome Web Store on your behalf, you need 5 credentials stored as GitHub Secrets.

### 1. Initial Manual Upload (Prerequisite)
Google requires the extension to exist in the store console once before it can accept automated API updates:
1. Log in to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Click **Add new item** and upload `sutra-extension-v2.11.0.zip`.
3. Note your **Extension ID** from the URL (e.g., `chrome.google.com/webstore/devconsole/<EXTENSION_ID>`).
4. Note your **Publisher ID** under **Publisher > Settings** (or the left sidebar).

---

### 2. Enable Chrome Web Store API in Google Cloud
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g. `Sutra Extension`).
3. In the search bar at the top, search for **Chrome Web Store API** and click **Enable**.

---

### 3. Create OAuth Credentials
1. In the Google Cloud Console left menu, go to **APIs & Services > OAuth consent screen**.
2. Select **External** and click **Create**.
3. Fill in the App name (`Sutra Deployer`), user support email, and developer email. Click **Save and Continue**.
4. Skip the "Scopes" step and "Test users" step (add your developer Google email under Test users if requested), then click **Back to Dashboard**.
5. Go to **APIs & Services > Credentials** > Click **+ CREATE CREDENTIALS** > Select **OAuth client ID**.
6. Set Application type to **Desktop app** (or **Web application**).
7. Name it `GitHub Actions CWS Deployer` and click **Create**.
8. Copy your **Client ID** and **Client Secret**.

---

### 4. Get the Refresh Token
To let GitHub generate access tokens without manual login:
1. Open the [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. In the top-right corner, click the **Gear icon (⚙️)**:
   - Check **"Use your own OAuth credentials"**.
   - Paste your **Client ID** and **Client Secret**.
3. In the left panel under "Step 1 Select & authorize APIs":
   - In the input box at the bottom ("Input your own scopes"), paste:
     `https://www.googleapis.com/auth/chromewebstore`
   - Click **Authorize APIs**.
4. Log into the Google account associated with your Chrome Web Store developer account and click **Allow**.
5. You will be redirected back to Step 2. Click **Exchange authorization code for tokens**.
6. Copy the **Refresh token** value.

---

### 5. Add Secrets to Your GitHub Repository
1. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret** for each of the following:

| Secret Name | Value |
| :--- | :--- |
| `CHROME_EXTENSION_ID` | Your 32-character Extension ID from the Developer Dashboard |
| `CHROME_PUBLISHER_ID` | Your Publisher ID from Developer Dashboard Settings |
| `CHROME_CLIENT_ID` | Google Cloud OAuth Client ID |
| `CHROME_CLIENT_SECRET` | Google Cloud OAuth Client Secret |
| `CHROME_REFRESH_TOKEN` | Refresh token generated in OAuth Playground |

---

## Daily Developer Workflow

Once setup is complete, you never need to manually zip and upload files again!

### Method 1: Tag-Driven Automated Release (Recommended)
Whenever you want to release an update:
1. Bump the `"version"` in [`manifest.json`](file:///d:/All%20Software%20Projects/Not%20Done/Sutra-ChromeExtension/manifest.json) (e.g. from `2.11.0` to `2.11.1`).
2. Commit and push:
   ```bash
   git add .
   git commit -m "Release v2.11.1"
   git tag v2.11.1
   git push origin main --tags
   ```
3. GitHub Actions triggers automatically, packages `sutra.zip`, and submits the new version to Google for review!

---

### Method 2: 1-Click Manual Trigger (via GitHub UI)
You can also trigger a deployment on demand:
1. In your GitHub repo, go to the **Actions** tab.
2. Select **Deploy to Chrome Web Store** from the workflow list.
3. Click **Run workflow**:
   - Choose whether to **Publish immediately** (submit for review) or **Upload as draft** (upload without submitting yet).
   - Click the green **Run workflow** button.
