// Sutra Development Hot-Reload
// Automatically reloads the extension and active launchpad tab when you save any file.
// Automatically disables itself in production/packaged builds.

(() => {
  "use strict";

  const POLL_INTERVAL_MS = 1000;
  let isWatching = false;

  const readAllEntries = (dir) =>
    new Promise((resolve) => {
      const reader = dir.createReader();
      const allEntries = [];
      const readBatch = () => {
        reader.readEntries(
          (entries) => {
            if (!entries.length) {
              resolve(allEntries);
            } else {
              allEntries.push(...entries);
              readBatch();
            }
          },
          () => resolve(allEntries)
        );
      };
      readBatch();
    });

  const filesInDirectory = async (dir) => {
    const entries = await readAllEntries(dir);
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name.endsWith(".zip")) continue;
      if (entry.isDirectory) {
        const subFiles = await filesInDirectory(entry);
        files.push(...subFiles);
      } else {
        const file = await new Promise((res) => entry.file(res, () => res(null)));
        if (file) files.push(file);
      }
    }
    return files;
  };

  const getDirectoryFingerprint = async (dir) => {
    try {
      const files = await filesInDirectory(dir);
      return files
        .map((f) => `${f.name}:${f.lastModified}:${f.size}`)
        .sort()
        .join("|");
    } catch {
      return null;
    }
  };

  const triggerReload = () => {
    console.log("%c[Sutra Live-Reload]%c Changes detected! Reloading launchpad...", "color: #b9f27c; font-weight: bold;", "color: inherit;");
    try {
      if (chrome.runtime && typeof chrome.runtime.reload === "function") {
        chrome.runtime.reload();
      }
    } catch {}
    window.location.reload();
  };

  const startFileSystemWatcher = (dir) => {
    let lastFingerprint = null;
    const check = async () => {
      const current = await getDirectoryFingerprint(dir);
      if (current) {
        if (lastFingerprint && lastFingerprint !== current) {
          triggerReload();
          return;
        }
        lastFingerprint = current;
      }
      setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  };

  const startFetchFallbackWatcher = () => {
    const watchedFiles = ["dashboard.js", "style.css", "dashboard.html", "manifest.json"];
    let lastHashes = null;

    const check = async () => {
      try {
        const results = await Promise.all(
          watchedFiles.map(async (file) => {
            const res = await fetch(`${chrome.runtime.getURL(file)}?_t=${Date.now()}`, { cache: "no-store" });
            const text = await res.text();
            return `${file}:${text.length}:${text.slice(0, 80)}`;
          })
        );
        const current = results.join("|");
        if (lastHashes && lastHashes !== current) {
          triggerReload();
          return;
        }
        lastHashes = current;
      } catch {}
      setTimeout(check, POLL_INTERVAL_MS);
    };
    check();
  };

  const init = () => {
    if (isWatching) return;
    isWatching = true;

    const beginWatching = () => {
      console.log("%c[Sutra Live-Reload]%c Active in developer mode.", "color: #b9f27c; font-weight: bold;", "color: inherit;");
      if (chrome.runtime && typeof chrome.runtime.getPackageDirectoryEntry === "function") {
        try {
          chrome.runtime.getPackageDirectoryEntry((dir) => {
            if (dir) startFileSystemWatcher(dir);
            else startFetchFallbackWatcher();
          });
          return;
        } catch {}
      }
      startFetchFallbackWatcher();
    };

    if (chrome.management && typeof chrome.management.getSelf === "function") {
      chrome.management.getSelf((self) => {
        if (self.installType === "development") {
          beginWatching();
        }
      });
    } else {
      beginWatching();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
