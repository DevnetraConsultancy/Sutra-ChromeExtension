// Sutra Development Hot-Reload
// Automatically reloads the extension and active launchpad tab when you save any file.
// Automatically disables itself in production/packaged Web Store builds.

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 1000;
  let isWatching = false;
  let isReloading = false;

  // Fast 32-bit hash (djb2) to detect content changes across full files
  const hashString = (str) => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  };

  const triggerReload = () => {
    if (isReloading) return;
    isReloading = true;
    console.log("%c[Sutra Live-Reload]%c Changes detected! Reloading launchpad...", "color: #b9f27c; font-weight: bold;", "color: inherit;");
    try {
      if (chrome.runtime && typeof chrome.runtime.reload === "function") {
        chrome.runtime.reload();
        return;
      }
    } catch {}
    window.location.reload();
  };

  const startWatcher = () => {
    const watchedFiles = ["dashboard.js", "style.css", "dashboard.html", "manifest.json", "hot-reload.js"];
    let lastFingerprint = null;

    const check = async () => {
      try {
        const results = await Promise.all(
          watchedFiles.map(async (file) => {
            const res = await fetch(`${chrome.runtime.getURL(file)}?_t=${Date.now()}`, { cache: "no-store" });
            const text = await res.text();
            return `${file}:${text.length}:${hashString(text)}`;
          })
        );
        const currentFingerprint = results.join("|");
        if (lastFingerprint && lastFingerprint !== currentFingerprint) {
          triggerReload();
          return;
        }
        lastFingerprint = currentFingerprint;
      } catch {}
      setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  };

  const init = () => {
    if (isWatching) return;
    isWatching = true;

    // Unpacked extensions in Developer Mode do not have 'update_url' in their manifest.
    // Chrome Web Store installs always have 'update_url' injected by Chrome.
    const manifest = (chrome.runtime && typeof chrome.runtime.getManifest === "function")
      ? chrome.runtime.getManifest()
      : {};
    const isDevelopment = !("update_url" in manifest);

    if (isDevelopment) {
      console.log("%c[Sutra Live-Reload]%c Active in developer mode.", "color: #b9f27c; font-weight: bold;", "color: inherit;");
      startWatcher();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
