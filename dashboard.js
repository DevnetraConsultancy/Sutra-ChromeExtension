(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const grid = $("#grid-container");
  const defaultCategories = ["Work", "Development", "Learning", "Design", "Tools", "Personal", "Finance", "Read later"];
  let categories = ["All bookmarks", ...defaultCategories];
  const categoryIcons = {
    "All bookmarks":"grid", "Work":"briefcase", "Development":"code", "Learning":"book",
    "Design":"palette", "Tools":"wrench", "Personal":"heart", "Finance":"chart", "Read later":"bookmark"
  };
  const iconPaths = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>',
    code:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14"/>',
    book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22zM4 5.5v14A2.5 2.5 0 0 1 6.5 17H20"/>',
    palette:'<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1"/><circle cx="13" cy="7" r="1"/><circle cx="17" cy="11" r="1"/><path d="M12 21c-1.5 0-2-1-1.5-2.2.5-1.1 0-2.3-1.5-2.3H7"/>',
    wrench:'<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    chart:'<path d="M3 3v18h18M7 14l4-4 3 3 6-7"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>'
  };
  let state = { bookmarks: [], backgroundImage: "", theme: "dark", customCategories: [], iconSize: 48, groupOrder: [], hiddenCategories: [], layoutLocked: false };
  let activeCategory = "All bookmarks";
  let toastTimer;
  let isInitialized = false;
  let storageSyncRunning = false;
  let storageSyncPending = false;
  let storageSyncTimer = null;
  let persistQueue = Promise.resolve();
  let pendingStorageWrites = 0;
  let generatedIdCounter = 0;

  const STORAGE_KEYS = ["bookmarks","shortcuts","backgroundImage","theme","customCategories","categoryNames","iconSize","groupOrder","hiddenCategories","layoutLocked"];
  const storageGet = (keys) => new Promise((resolve, reject) => chrome.storage.local.get(keys, result => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Chrome storage read failed."));
    else resolve(result || {});
  }));
  const storageSet = (obj) => new Promise((resolve, reject) => chrome.storage.local.set(obj, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Chrome storage write failed."));
    else resolve();
  }));
  const storageRemove = (keys) => new Promise((resolve, reject) => chrome.storage.local.remove(keys, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message || "Chrome storage remove failed."));
    else resolve();
  }));

  function escapeHtml(value="") {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function validUrl(raw) {
    try { const u = new URL(raw); return ["http:", "https:"].includes(u.protocol) ? u.href : null; }
    catch { return null; }
  }
  function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.bookmark}</svg>`; }
  function showToast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function persistedSnapshot() {
    return {
      bookmarks: state.bookmarks,
      backgroundImage: state.backgroundImage,
      theme: state.theme,
      customCategories: state.customCategories,
      categoryNames: defaultCategories,
      iconSize: state.iconSize,
      groupOrder: state.groupOrder,
      hiddenCategories: state.hiddenCategories,
      layoutLocked: state.layoutLocked
    };
  }
  function stateSignature() {
    try { return JSON.stringify(persistedSnapshot()); }
    catch { return String(Date.now()); }
  }
  function createId() {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      }
    } catch (err) { console.warn("Secure ID generation unavailable; using local fallback.", err); }
    generatedIdCounter += 1;
    return `sutra-${Date.now().toString(36)}-${generatedIdCounter.toString(36)}`;
  }
  async function persist() {
    // Snapshot immediately and serialise writes so rapid edits cannot finish out of order.
    let snapshot;
    try { snapshot = JSON.parse(JSON.stringify(persistedSnapshot())); }
    catch (err) {
      showToast("Could not prepare changes for saving.");
      console.error("Sutra snapshot failed:", err);
      return false;
    }
    pendingStorageWrites += 1;
    const write = persistQueue.catch(() => {}).then(() => storageSet(snapshot));
    persistQueue = write;
    try {
      await write;
      return true;
    } catch (err) {
      showToast("Could not save changes. Check Chrome storage space and try again.");
      console.error("Sutra storage write failed:", err);
      return false;
    } finally {
      pendingStorageWrites = Math.max(0, pendingStorageWrites - 1);
      if (!pendingStorageWrites && storageSyncPending && !hasOpenModal()) {
        storageSyncPending = false;
        scheduleStorageSync("writes-complete");
      }
    }
  }
  function getFavicon(url) {
    // Manifest V3 exposes saved site favicons through the extension's own
    // /_favicon/ endpoint. Direct chrome://favicon2 URLs are blocked in pages.
    const faviconUrl = new URL(chrome.runtime.getURL("/_favicon/"));
    faviconUrl.searchParams.set("pageUrl", url);
    faviconUrl.searchParams.set("size", "64");
    return faviconUrl.toString();
  }
  function refreshCategories() { categories = ["All bookmarks", ...defaultCategories, ...(state.customCategories || [])]; }
  function orderedGroupNames() {
    const available = categories.filter(c => c !== "All bookmarks");
    const ordered = [...new Set((state.groupOrder || []).filter(c => available.includes(c)))];
    available.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
    state.groupOrder = ordered;
    return ordered;
  }
  function reorderGroup(source, target) {
    if (!source || !target || source === target || state.layoutLocked) return;
    const order = orderedGroupNames().filter(name => name !== source);
    const targetIndex = order.indexOf(target);
    if (targetIndex < 0) order.push(source); else order.splice(targetIndex, 0, source);
    state.groupOrder = order;
    renderAll();
    void persist();
    showToast("Group moved");
  }
  function reorderBookmark(bookmarkId, targetId, position = "before") {
    if (state.layoutLocked || !bookmarkId || !targetId || bookmarkId === targetId) return;
    const sourceIndex = state.bookmarks.findIndex(b => b.id === bookmarkId);
    const target = state.bookmarks.find(b => b.id === targetId);
    if (sourceIndex < 0 || !target) return;

    const [dragged] = state.bookmarks.splice(sourceIndex, 1);
    const originalCategory = dragged.category;
    dragged.category = target.category;
    const targetIndex = state.bookmarks.findIndex(b => b.id === targetId);
    if (targetIndex < 0) {
      state.bookmarks.push(dragged);
    } else {
      const insertAt = targetIndex + (position === "after" ? 1 : 0);
      state.bookmarks.splice(insertAt, 0, dragged);
    }

    renderAll();
    void persist();
    showToast(originalCategory === dragged.category ? "Bookmark order updated" : `Moved to ${dragged.category}`);
  }

  async function moveBookmarkToGroup(bookmarkId, groupName) {
    if (state.layoutLocked) return;
    const sourceIndex = state.bookmarks.findIndex(b => b.id === bookmarkId);
    if (sourceIndex < 0 || !categories.includes(groupName) || groupName === "All bookmarks") return;
    const [item] = state.bookmarks.splice(sourceIndex, 1);
    item.category = groupName;

    // Menu moves and drops onto the empty group area append to the end of that group.
    const groupItems = state.bookmarks.filter(b => b.category === groupName);
    if (groupItems.length) {
      const lastGroupItem = groupItems[groupItems.length - 1];
      const lastIndex = state.bookmarks.findIndex(b => b.id === lastGroupItem.id);
      state.bookmarks.splice(lastIndex + 1, 0, item);
    } else {
      state.bookmarks.push(item);
    }

    renderAll();
    void persist();
    showToast(`Moved to ${groupName}`);
  }

  function dropPlacement(target, clientX, clientY) {
    const rect = target.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    // Use the closer axis: left/right to position within a row, up/down between rows.
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "before" : "after";
    return dy < 0 ? "before" : "after";
  }

  function clearDropMarkers(container) {
    container.querySelectorAll(".drop-before, .drop-after, .drag-over-bookmark").forEach(el => {
      el.classList.remove("drop-before", "drop-after", "drag-over-bookmark");
    });
    delete container.dataset.dropTargetId;
    delete container.dataset.dropPosition;
  }

  function nearestBookmarkDropTarget(container, clientX, clientY) {
    const candidates = [...container.querySelectorAll(".bookmark-tile[data-bookmark-id]")]
      .filter(tile => !tile.classList.contains("is-dragging-bookmark"));
    if (!candidates.length) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const tile of candidates) {
      const rect = tile.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      // Scale vertical distance so multi-row grids choose the closest visual slot.
      const distance = (dx * dx) + (dy * dy * 0.85);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = tile;
      }
    }
    return best;
  }
  function renderCategories() {
    const nav = $("#category-nav");
    nav.innerHTML = categories.map(cat => {
      const count = cat === "All bookmarks" ? state.bookmarks.length : state.bookmarks.filter(b => b.category === cat).length;
      return `<button class="category-chip ${activeCategory === cat ? "active" : ""}" data-category="${escapeHtml(cat)}"><span>${cat === "All bookmarks" ? "⌂" : ""}</span><span>${escapeHtml(cat)}</span><em>${count}</em></button>`;
    }).join("");
    nav.querySelectorAll("[data-category]").forEach(btn => btn.addEventListener("click", () => { activeCategory = btn.dataset.category; renderAll(); }));
  }
  function renderGrid() {
    const query = $("#search-input").value.trim().toLowerCase();
    const hiddenSet = new Set(state.hiddenCategories || []);
    if (activeCategory !== "All bookmarks" && hiddenSet.has(activeCategory)) activeCategory = "All bookmarks";
    let list = state.bookmarks.filter(b => !hiddenSet.has(b.category) && (activeCategory === "All bookmarks" || b.category === activeCategory) && [b.name,b.url,b.category,b.note].some(v => String(v || "").toLowerCase().includes(query)));
    const bookmarkCount = $("#bookmark-count");
    const visibleCount = $("#visible-count");
    if (bookmarkCount) bookmarkCount.textContent = state.bookmarks.length;
    if (visibleCount) visibleCount.textContent = list.length;
    // Never replace sectionTitle.innerHTML: it contains #visible-count, required
    // by future renders. Reconstruct a missing title text node rather than throwing.
    const sectionTitle = $("#section-title");
    if (sectionTitle) {
      let titleTextNode = Array.from(sectionTitle.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (!titleTextNode) {
        titleTextNode = document.createTextNode("");
        sectionTitle.insertBefore(titleTextNode, sectionTitle.firstChild);
      }
      titleTextNode.textContent = `${activeCategory} `;
    }
    const sectionKicker = $("#section-kicker");
    if (sectionKicker) sectionKicker.textContent = query ? "SEARCH RESULTS" : "YOUR LAUNCHPAD";
    grid.innerHTML = "";
    document.body.classList.toggle("layout-locked", !!state.layoutLocked);

    let groups;
    if (activeCategory === "All bookmarks") {
      const orderedNames = orderedGroupNames();
      groups = orderedNames.filter(name => !hiddenSet.has(name))
        .map(name => [name, list.filter(b => b.category === name)])
        // Show every non-hidden built-in and custom group on the default launchpad,
        // even when empty. Search mode stays compact and only shows groups with matches.
        .filter(([name, items]) => query ? items.length > 0 : true);
    } else {
      groups = [[activeCategory, list]];
    }

    for (const [groupName, items] of groups) {
      const section = document.createElement("section");
      section.className = `launch-collection${items.length === 0 ? " is-empty-group" : ""}`;
      section.dataset.groupName = groupName;

      if (activeCategory === "All bookmarks") {
        const heading = document.createElement("div");
        heading.className = "collection-heading";
        heading.innerHTML = `<h3>${escapeHtml(groupName)} <span>${items.length}</span></h3><button type="button" class="collection-manage" aria-label="Manage ${escapeHtml(groupName)}" title="Group options">•••</button><div class="collection-actions hidden"><button type="button" data-action="rename-group">Rename group</button><button type="button" data-action="delete-group" class="danger-action">Delete group</button></div>`;
        const groupMenu = heading.querySelector(".collection-manage");
        const groupActions = heading.querySelector(".collection-actions");
        groupMenu.addEventListener("click", e => {
          e.stopPropagation();
          document.querySelectorAll(".collection-actions, .tile-actions").forEach(menu => { if (menu !== groupActions) menu.classList.add("hidden"); });
          groupActions.classList.toggle("hidden");
        });
        heading.querySelector('[data-action="rename-group"]').addEventListener("click", () => {
          groupActions.classList.add("hidden");
          renameCategory(groupName);
        });
        heading.querySelector('[data-action="delete-group"]').addEventListener("click", () => {
          groupActions.classList.add("hidden");
          deleteCategory(groupName);
        });
        heading.draggable = !state.layoutLocked && !query;
        heading.title = state.layoutLocked ? "Layout is locked" : "Drag this group heading to move the entire group";
        heading.addEventListener("dragstart", e => {
          if (state.layoutLocked || e.target.closest("button, .collection-actions")) { e.preventDefault(); return; }
          e.dataTransfer.setData("application/x-sutra-group", groupName);
          e.dataTransfer.setData("text/plain", `group:${groupName}`);
          e.dataTransfer.effectAllowed = "move";
          section.classList.add("is-dragging-group");
        });
        heading.addEventListener("dragend", () => section.classList.remove("is-dragging-group", "drag-over"));
        section.appendChild(heading);
      }

      const tiles = document.createElement("div");
      tiles.className = "bookmark-grid";
      tiles.style.setProperty("--icon-size", `${state.iconSize || 48}px`);

      items.forEach(item => {
        const tile = document.createElement("article");
        tile.className = "bookmark-tile";
        tile.dataset.bookmarkId = item.id;
        tile.style.setProperty("--icon-size", `${state.iconSize || 48}px`);
        tile.draggable = !state.layoutLocked && !query;
        const initial = escapeHtml((item.name || "?").trim().slice(0,1).toUpperCase());
        const host = (()=>{try{return new URL(item.url).hostname.replace(/^www\./,"")}catch{return item.url}})();
        tile.innerHTML = `<a class="tile-open" draggable="false" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(item.name)}"><span class="tile-icon"><img src="${escapeHtml(getFavicon(item.url))}" alt="" loading="lazy"><span class="tile-initial">${initial}</span></span><span class="tile-name">${escapeHtml(item.name)}</span><span class="tile-domain">${escapeHtml(host)}</span></a><button class="tile-menu" type="button" aria-label="Actions for ${escapeHtml(item.name)}" title="Edit, move or delete">•••</button><div class="tile-actions hidden"><button data-action="edit">Edit bookmark</button><button data-action="move">Move to group</button><button data-action="delete" class="danger-action">Delete bookmark</button></div>`;
        const faviconImg = tile.querySelector(".tile-icon img");
        const fallback = tile.querySelector(".tile-initial");
        const onFaviconLoad = () => {
          if (faviconImg.naturalWidth > 0) fallback.hidden = true;
          else faviconImg.hidden = true;
        };
        const onFaviconError = () => { faviconImg.hidden = true; };
        if (faviconImg.complete) {
          onFaviconLoad();
        } else {
          faviconImg.addEventListener("load", onFaviconLoad);
          faviconImg.addEventListener("error", onFaviconError);
        }

        tile.addEventListener("dragstart", e => {
          if (state.layoutLocked || query) { e.preventDefault(); return; }
          e.stopPropagation();
          e.dataTransfer.setData("application/x-sutra-bookmark", item.id);
          e.dataTransfer.setData("text/plain", item.id);
          e.dataTransfer.effectAllowed = "move";
          tile.classList.add("is-dragging-bookmark");
        });
        tile.addEventListener("dragend", () => tile.classList.remove("is-dragging-bookmark", "drag-over-bookmark"));
        tile.addEventListener("dragover", e => {
          if (state.layoutLocked || query || !e.dataTransfer.types.includes("application/x-sutra-bookmark")) return;
          e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
          const placement = dropPlacement(tile, e.clientX, e.clientY);
          clearDropMarkers(tiles);
          tile.classList.add(placement === "before" ? "drop-before" : "drop-after");
        });
        tile.addEventListener("dragleave", e => {
          if (!tile.contains(e.relatedTarget)) tile.classList.remove("drag-over-bookmark", "drop-before", "drop-after");
        });
        tile.addEventListener("drop", e => {
          if (state.layoutLocked || query) return;
          const draggedId = e.dataTransfer.getData("application/x-sutra-bookmark");
          if (!draggedId) return;
          e.preventDefault(); e.stopPropagation();
          const placement = dropPlacement(tile, e.clientX, e.clientY);
          clearDropMarkers(tiles);
          reorderBookmark(draggedId, item.id, placement);
        });

        tile.addEventListener("contextmenu", e => {
          e.preventDefault();
          openBookmarkModal(item);
        });

        const tileActions = tile.querySelector(".tile-actions");
        tile.querySelector(".tile-menu").addEventListener("click", e => {
          e.stopPropagation();
          document.querySelectorAll(".tile-actions, .collection-actions").forEach(p => { if (p !== tileActions) p.classList.add("hidden"); });
          tileActions.classList.toggle("hidden");
        });
        tile.querySelector('[data-action="edit"]').addEventListener("click", () => {
          tileActions.classList.add("hidden");
          openBookmarkModal(item);
        });
        tile.querySelector('[data-action="move"]').addEventListener("click", async () => {
          tileActions.classList.add("hidden");
          refreshCategories();
          const choices = categories.filter(c => c !== "All bookmarks");
          const choice = prompt(`Move “${item.name}” to which group?\n\nAvailable groups:\n${choices.join(" · ")}`, item.category);
          if (!choice) return;
          const target = choices.find(c => c.trim().toLowerCase() === choice.trim().toLowerCase());
          if (target) await moveBookmarkToGroup(item.id, target);
          else showToast("Choose an existing group name");
        });
        tile.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          tileActions.classList.add("hidden");
          if (!confirm(`Delete “${item.name}”?`)) return;
          state.bookmarks = state.bookmarks.filter(b => b.id !== item.id);
          renderAll();
          void persist();
          showToast("Bookmark deleted");
        });
        tiles.appendChild(tile);
      });

      // Dropping between tiles is resolved to the nearest visual slot. Dropping
      // onto a tile is handled by that tile and places the item before/after it.
      tiles.addEventListener("dragover", e => {
        if (state.layoutLocked || query || !e.dataTransfer.types.includes("application/x-sutra-bookmark")) return;
        if (e.target.closest(".bookmark-tile")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const targetTile = nearestBookmarkDropTarget(tiles, e.clientX, e.clientY);
        clearDropMarkers(tiles);
        if (!targetTile) return;
        const placement = dropPlacement(targetTile, e.clientX, e.clientY);
        targetTile.classList.add(placement === "before" ? "drop-before" : "drop-after");
        tiles.dataset.dropTargetId = targetTile.dataset.bookmarkId;
        tiles.dataset.dropPosition = placement;
      });
      tiles.addEventListener("drop", e => {
        if (state.layoutLocked || query || !e.dataTransfer.types.includes("application/x-sutra-bookmark")) return;
        if (e.target.closest(".bookmark-tile")) return; // The tile handler owns this drop.
        const draggedId = e.dataTransfer.getData("application/x-sutra-bookmark");
        const targetId = tiles.dataset.dropTargetId;
        const placement = tiles.dataset.dropPosition || "after";
        if (!draggedId || !targetId) return;
        e.preventDefault();
        e.stopPropagation();
        clearDropMarkers(tiles);
        reorderBookmark(draggedId, targetId, placement);
      });
      tiles.addEventListener("dragleave", e => {
        if (!tiles.contains(e.relatedTarget)) clearDropMarkers(tiles);
      });

      // Every visible group gets its own compact grey add tile. Empty custom groups
      // therefore provide their first bookmark action without a global green button.
      if (!query && (activeCategory === "All bookmarks" || activeCategory === groupName)) {
        const addTile = document.createElement("button");
        addTile.type = "button";
        addTile.className = "add-bookmark-tile";
        addTile.title = `Add bookmark to ${groupName}`;
        addTile.setAttribute("aria-label", `Add bookmark to ${groupName}`);
        addTile.innerHTML = `<span class="tile-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></span><span class="tile-name">Add site</span>`;
        addTile.addEventListener("click", () => openBookmarkModal(null, groupName));
        tiles.appendChild(addTile);
      }
      section.appendChild(tiles);

      section.addEventListener("dragover", e => {
        if (state.layoutLocked || query) return;
        const hasBookmark = e.dataTransfer.types.includes("application/x-sutra-bookmark");
        const hasGroup = e.dataTransfer.types.includes("application/x-sutra-group");
        const hasExternalLink = e.dataTransfer.types.includes("text/uri-list") || e.dataTransfer.types.includes("text/plain");
        if (!hasBookmark && !hasGroup && !hasExternalLink) return;
        e.preventDefault(); e.dataTransfer.dropEffect = hasBookmark || hasGroup ? "move" : "copy"; section.classList.add("drag-over");
      });
      section.addEventListener("dragleave", e => { if (!section.contains(e.relatedTarget)) section.classList.remove("drag-over"); });
      section.addEventListener("drop", async e => {
        if (state.layoutLocked || query) return;
        const draggedGroup = e.dataTransfer.getData("application/x-sutra-group");
        const draggedBookmark = e.dataTransfer.getData("application/x-sutra-bookmark");
        e.preventDefault(); e.stopPropagation(); section.classList.remove("drag-over");
        if (draggedGroup) reorderGroup(draggedGroup, groupName);
        else if (draggedBookmark) await moveBookmarkToGroup(draggedBookmark, groupName);
        else {
          const droppedUrl = getDroppedUrl(e.dataTransfer);
          if (droppedUrl) createBookmarkFromDroppedUrl(droppedUrl, groupName);
          else showToast("Drop a website link into a group.");
        }
      });
      grid.appendChild(section);
    }

    const empty = $("#empty-state");
    const noSearchResults = !!query && list.length === 0;
    empty.classList.toggle("hidden", !noSearchResults);
    if (noSearchResults) {
      $("#empty-title").textContent = "No matching sites";
      $("#empty-copy").textContent = "Try another search.";
    }
    renderManageCategories();
  }
  function setCategoryHidden(name, hidden) {
    if (!categories.includes(name) || name === "All bookmarks") return;
    const hiddenSet = new Set(state.hiddenCategories || []);
    if (hidden) hiddenSet.add(name);
    else hiddenSet.delete(name);
    state.hiddenCategories = [...hiddenSet].filter(c => categories.includes(c));
    if (hidden && activeCategory === name) activeCategory = "All bookmarks";
    renderAll();
    renderManageCategories();
    void persist();
    showToast(hidden ? `Hidden ${name} from launchpad` : `Showing ${name} on launchpad`);
  }

  function renderManageCategories() {
    const box=$("#manage-categories"); if(!box)return;
    const hiddenSet = new Set(state.hiddenCategories || []);
    box.innerHTML=categories.filter(c=>c!=="All bookmarks").map(c=>`<div class="manage-category-row"><span class="manage-category-name">${escapeHtml(c)}</span><label class="hidden-group-toggle" title="Hide this group and its bookmarks from the main launchpad"><input type="checkbox" data-hidden-category="${escapeHtml(c)}" ${hiddenSet.has(c) ? "checked" : ""}><span>Hide</span></label><button type="button" data-rename="${escapeHtml(c)}">Rename</button><button type="button" data-delete="${escapeHtml(c)}">Delete</button></div>`).join("");
    box.querySelectorAll("[data-hidden-category]").forEach(input => input.addEventListener("change", () => setCategoryHidden(input.dataset.hiddenCategory, input.checked)));
    box.querySelectorAll("[data-rename]").forEach(b=>b.addEventListener("click",()=>renameCategory(b.dataset.rename)));
    box.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteCategory(b.dataset.delete)));
  }
  function renameCategory(name){const next=prompt("Rename group:",name);if(!next||!next.trim())return;const clean=next.trim().slice(0,40);if(clean.toLowerCase()!==name.toLowerCase()&&categories.some(c=>c.toLowerCase()===clean.toLowerCase())){showToast("Group already exists");return;}if(clean===name)return;const idx=defaultCategories.indexOf(name);if(idx>=0)defaultCategories[idx]=clean;else state.customCategories=state.customCategories.map(c=>c===name?clean:c);state.groupOrder=(state.groupOrder||[]).map(c=>c===name?clean:c);state.hiddenCategories=(state.hiddenCategories||[]).map(c=>c===name?clean:c);state.bookmarks.forEach(b=>{if(b.category===name)b.category=clean});if(activeCategory===name)activeCategory=clean;refreshCategories();orderedGroupNames();renderAll();void persist();showToast("Group renamed")}
  async function deleteCategory(name){
    if (!categories.includes(name) || name === "All bookmarks") return;
    const nonAllCategories = categories.filter(c => c !== "All bookmarks");
    if (nonAllCategories.length <= 1) {
      showToast("Cannot delete the only remaining group.");
      return;
    }
    const bookmarkCount = state.bookmarks.filter(bookmark => bookmark.category === name).length;
    const impact = bookmarkCount
      ? ` This will permanently remove ${bookmarkCount} bookmark(s) from Sutra.`
      : "";
    if (!confirm(`Delete group “${name}”?${impact} This does not delete the original bookmarks in Chrome.`)) return;

    // Delete means delete: never silently reassign a group's links to another group.
    state.bookmarks = state.bookmarks.filter(bookmark => bookmark.category !== name);
    const idx = defaultCategories.indexOf(name);
    if (idx >= 0) defaultCategories.splice(idx, 1);
    state.customCategories = (state.customCategories || []).filter(category => category !== name);
    state.groupOrder = (state.groupOrder || []).filter(category => category !== name);
    state.hiddenCategories = (state.hiddenCategories || []).filter(category => category !== name);
    if (activeCategory === name) activeCategory = "All bookmarks";

    refreshCategories();
    orderedGroupNames();
    renderAll();
    const saved = await persist();
    if (!saved) {
      showToast("Delete could not be saved. Reloading may restore the previous data; export a backup and retry.");
      return;
    }
    showToast(`Deleted group and ${bookmarkCount} bookmark(s) from Sutra`);
  }
  // Empty groups stay out of the launchpad until a drag is in progress. During a
  // drag they become compact drop targets; hovering one reveals its drop affordance.
  if (!window.__sutraEmptyGroupDragTracking) {
    window.__sutraEmptyGroupDragTracking = true;
    document.addEventListener("dragenter", event => {
      if (event.dataTransfer && event.dataTransfer.types && event.dataTransfer.types.length)
        document.body.classList.add("drag-in-progress");
    });
    document.addEventListener("dragover", event => {
      if (event.dataTransfer && event.dataTransfer.types && event.dataTransfer.types.length)
        document.body.classList.add("drag-in-progress");
    });
    document.addEventListener("drop", () => document.body.classList.remove("drag-in-progress"));
    document.addEventListener("dragend", () => document.body.classList.remove("drag-in-progress"));
    document.addEventListener("dragleave", event => {
      if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
        document.body.classList.remove("drag-in-progress");
      }
    });
    window.addEventListener("blur", () => document.body.classList.remove("drag-in-progress"));
  }

  let lastActiveElement = null;
  function renderAll() { refreshCategories(); orderedGroupNames(); renderCategories(); renderCategoryOptions(); renderGrid(); }
  function renderCategoryOptions() {
    $("#bookmark-category").innerHTML = categories.filter(c => c !== "All bookmarks").map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }
  function openModal(id) {
    lastActiveElement = document.activeElement;
    $("#" + id).classList.remove("hidden");
  }
  function closeModal(id) {
    $("#" + id).classList.add("hidden");
    if (lastActiveElement && typeof lastActiveElement.focus === "function") {
      try { lastActiveElement.focus(); } catch {}
    }
    if (typeof hasOpenModal === "function" && !hasOpenModal() && storageSyncPending) {
      scheduleStorageSync("modal-closed");
    }
  }
  function openBookmarkModal(item=null, category=null) {
    $("#bookmark-form").reset(); $("#form-error").textContent = "";
    $("#bookmark-name").dataset.userEdited = "";
    $("#edit-id").value = item?.id || "";
    $("#modal-title").textContent = item ? "Edit bookmark" : "Add a bookmark";
    $("#save-bookmark-btn").textContent = item ? "Save changes" : "Save bookmark";
    if (item) {
      $("#bookmark-name").value = item.name; $("#bookmark-url").value = item.url;
      $("#bookmark-category").value = item.category; $("#bookmark-note").value = item.note || "";
    } else if (category && categories.includes(category)) $("#bookmark-category").value = category;
    else if (activeCategory !== "All bookmarks") $("#bookmark-category").value = activeCategory;
    openModal("bookmark-modal"); setTimeout(() => $("#bookmark-name").focus(), 30);
  }
  // Derive a readable default bookmark name from the URL host.
  function defaultBookmarkName(rawUrl) {
    try {
      let raw = String(rawUrl || "").trim();
      if (raw && !/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = "https://" + raw;
      const u = new URL(raw);
      return u.hostname.replace(/^www\./i, "") || raw;
    } catch { return String(rawUrl || "").trim(); }
  }
  $("#bookmark-url").addEventListener("input", () => {
    const nameInput = $("#bookmark-name");
    const editId = $("#edit-id").value;
    if (!editId && (!nameInput.dataset.userEdited || !nameInput.value.trim())) {
      nameInput.value = defaultBookmarkName($("#bookmark-url").value);
    }
  });
  $("#bookmark-name").addEventListener("input", () => { $("#bookmark-name").dataset.userEdited = "true"; });
  function createBookmarkFromDroppedUrl(rawUrl, category) {
    let raw = String(rawUrl || "").trim();
    if (raw && !/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = "https://" + raw;
    const url = validUrl(raw);
    if (!url) return false;
    const existing = state.bookmarks.find(b => b.url === url);
    if (existing) {
      if (category && categories.includes(category) && category !== "All bookmarks") {
        void moveBookmarkToGroup(existing.id, category);
      } else {
        showToast("Bookmark already exists");
      }
      return true;
    }
    const name = defaultBookmarkName(url).slice(0, 80);
    const targetCategory = (category && categories.includes(category) && category !== "All bookmarks")
      ? category
      : (categories.find(c => c !== "All bookmarks") || "General");
    state.bookmarks.push({ id: createId(), name, url, category: targetCategory, note: "", createdAt: Date.now() });
    renderAll();
    void persist();
    showToast(`Added ${name}`);
    return true;
  }
  function getDroppedUrl(dataTransfer) {
    try {
      const uriList = (dataTransfer.getData("text/uri-list") || "")
        .split(/\r?\n/)
        .find(line => line && !line.startsWith("#"));
      if (uriList && validUrl(uriList.trim())) return validUrl(uriList.trim());

      const plain = (dataTransfer.getData("text/plain") || "").trim();
      if (validUrl(plain)) return validUrl(plain);
      const match = plain.match(/https?:\/\/[^\s<>"']+/i);
      if (match) {
        const cleaned = validUrl(match[0].replace(/[),.;]+$/, ""));
        if (cleaned) return cleaned;
      }
      if (plain && !/^[a-z][a-z\d+.-]*:/i.test(plain) && /^[\w-]+(\.[\w-]+)+/.test(plain)) {
        const normalized = validUrl("https://" + plain);
        if (normalized) return normalized;
      }

      const html = dataTransfer.getData("text/html") || "";
      if (html) {
        const hrefMatch = html.match(/href=["'](https?:\/\/[^"']+)["']/i);
        if (hrefMatch && validUrl(hrefMatch[1])) return validUrl(hrefMatch[1]);
      }
    } catch {}
    return null;
  }

  $("#bookmark-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#bookmark-name").value.trim();
    let rawUrl = $("#bookmark-url").value.trim();
    if (rawUrl && !/^[a-z][a-z\d+.-]*:/i.test(rawUrl)) rawUrl = "https://" + rawUrl;
    const url = validUrl(rawUrl);
    if (!name || !url) { $("#form-error").textContent = "Enter a name and a valid HTTP or HTTPS website URL."; return; }
    const id = $("#edit-id").value;
    const existing = state.bookmarks.find(b => b.id === id);
    const bookmark = { id: id || createId(), name, url, category: $("#bookmark-category").value, note: $("#bookmark-note").value.trim(), createdAt: existing?.createdAt || Date.now() };
    if (existing) {
      state.bookmarks = state.bookmarks.map(b => b.id === id ? bookmark : b);
    } else {
      state.bookmarks.push(bookmark);
    }
    renderAll();
    void persist();
    showToast(existing ? "Bookmark updated" : "Bookmark added");

    if (existing) {
      closeModal("bookmark-modal");
    } else {
      const savedCategory = bookmark.category;
      $("#bookmark-form").reset();
      $("#edit-id").value = "";
      $("#bookmark-name").dataset.userEdited = "";
      $("#modal-title").textContent = "Add a bookmark";
      $("#save-bookmark-btn").textContent = "Save bookmark";
      $("#bookmark-category").value = savedCategory;
      $("#form-error").textContent = "";
      setTimeout(() => $("#bookmark-url").focus(), 0);
    }
  });

  function chromeGetBookmarkTree() {
    return new Promise((resolve, reject) => {
      if (!chrome.bookmarks || typeof chrome.bookmarks.getTree !== "function") {
        reject(new Error("Chrome bookmark access is unavailable. Reload Sutra and check its bookmarks permission."));
        return;
      }
      chrome.bookmarks.getTree(tree => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message || "Could not read Chrome bookmarks."));
        else resolve(Array.isArray(tree) ? tree : []);
      });
    });
  }

  function chromeImportGroupName(folderPath, namesOwnedByImport) {
    const fullPath = folderPath.filter(Boolean).join(" / ") || "Bookmarks";
    // Keep group names short while preserving the tail of deeply nested folder paths.
    const tail = fullPath.length > 31 ? fullPath.slice(-31) : fullPath;
    const base = `Chrome · ${tail}`;
    let candidate = base.slice(0, 40);
    let suffix = 2;
    while (namesOwnedByImport.has(candidate) && namesOwnedByImport.get(candidate) !== fullPath) {
      const suffixText = ` ${suffix++}`;
      candidate = `${base.slice(0, 40 - suffixText.length)}${suffixText}`;
    }
    namesOwnedByImport.set(candidate, fullPath);
    return candidate;
  }

  async function importFromChrome() {
    const consent = confirm(
      "Import Chrome bookmarks into Sutra?\n\n" +
      "Sutra will read bookmark titles, URLs, and folder names to copy them into your launchpad. " +
      "Chrome's original bookmarks will not be changed, and Sutra will not upload them."
    );
    if (!consent) return;

    const button = $("#import-chrome-btn");
    if (button) { button.disabled = true; button.textContent = "Importing…"; }
    try {
      if (chrome.permissions && typeof chrome.permissions.contains === "function") {
        const hasPermission = await new Promise(resolve => {
          chrome.permissions.contains({ permissions: ["bookmarks"] }, resolve);
        });
        if (!hasPermission) {
          const granted = await new Promise(resolve => {
            chrome.permissions.request({ permissions: ["bookmarks"] }, resolve);
          });
          if (!granted) {
            showToast("Bookmarks permission was not granted.");
            return;
          }
        }
      }
      const tree = await chromeGetBookmarkTree();
      const rootNode = tree[0];
      const rootChildren = Array.isArray(rootNode?.children) ? rootNode.children : [];
      const collected = [];

      function walk(node, folderPath) {
        if (!node || typeof node !== "object") return;
        if (typeof node.url === "string") {
          const url = validUrl(node.url.trim());
          if (url) {
            collected.push({
              url,
              name: (typeof node.title === "string" && node.title.trim())
                ? node.title.trim().slice(0, 80) : defaultBookmarkName(url).slice(0, 80),
              folderPath: folderPath.length ? [...folderPath] : ["Bookmarks"]
            });
          }
          return;
        }
        const children = Array.isArray(node.children) ? node.children : [];
        const label = typeof node.title === "string" && node.title.trim()
          ? node.title.trim().slice(0, 60) : "Bookmarks";
        for (const child of children) {
          if (typeof child?.url === "string") {
            walk(child, folderPath.length ? folderPath : [label]);
          } else {
            walk(child, [...folderPath, (typeof child?.title === "string" && child.title.trim())
              ? child.title.trim().slice(0, 60) : "Bookmarks"]);
          }
        }
      }

      for (const child of rootChildren) {
        if (typeof child?.url === "string") walk(child, ["Bookmarks"]);
        else walk(child, [((typeof child?.title === "string" && child.title.trim()) ? child.title.trim() : "Bookmarks").slice(0, 60)]);
      }

      if (!collected.length) {
        showToast("No importable Chrome bookmarks were found.");
        return;
      }

      // Existing Sutra links win: importing the same URL again does not duplicate it
      // or unexpectedly move it out of its current group.
      const existingUrls = new Set(state.bookmarks.map(item => validUrl(item.url)).filter(Boolean));
      const namesOwnedByImport = new Map();
      const groupForPath = new Map();
      const pendingBookmarks = [];
      let duplicateCount = 0;

      for (const item of collected) {
        if (existingUrls.has(item.url)) {
          duplicateCount++;
          continue;
        }
        const pathKey = JSON.stringify(item.folderPath);
        let groupName = groupForPath.get(pathKey);
        if (!groupName) {
          groupName = chromeImportGroupName(item.folderPath, namesOwnedByImport);
          groupForPath.set(pathKey, groupName);
          if (!categories.includes(groupName) && !state.customCategories.includes(groupName)) {
            if ((state.customCategories || []).length < 100) {
              state.customCategories.push(groupName);
              refreshCategories();
            } else {
              groupName = categories.find(c => c !== "All bookmarks") || "General";
            }
          }
        }
        pendingBookmarks.push({
          id: createId(),
          name: item.name,
          url: item.url,
          category: groupName,
          note: "",
          createdAt: Date.now() + pendingBookmarks.length
        });
        existingUrls.add(item.url);
      }

      if (!pendingBookmarks.length) {
        showToast(`No new bookmarks to import · ${duplicateCount} duplicate(s) skipped`);
        return;
      }

      state.bookmarks.push(...pendingBookmarks);
      refreshCategories();
      orderedGroupNames();
      activeCategory = "All bookmarks";
      renderAll();
      const saved = await persist();
      showToast(
        saved
          ? `Imported ${pendingBookmarks.length} bookmark(s) · ${duplicateCount} duplicate(s) skipped`
          : `Imported ${pendingBookmarks.length}; saving failed. Export a backup and try again.`
      );
    } catch (err) {
      console.error("Sutra Chrome bookmark import failed:", err);
      showToast(err.message || "Could not import Chrome bookmarks.");
    } finally {
      if (button) { button.disabled = false; button.textContent = "Import from Chrome"; }
    }
  }

  async function exportBackup() {
    const backup = { app: "Sutra", schemaVersion: 1, exportedAt: new Date().toISOString(), bookmarks: state.bookmarks, preferences: { backgroundImage: state.backgroundImage, theme: state.theme, customCategories: state.customCategories, categoryNames: defaultCategories, iconSize: state.iconSize, groupOrder: state.groupOrder, hiddenCategories: state.hiddenCategories, layoutLocked: state.layoutLocked } };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sutra-bookmarks-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Sutra backup exported");
  }
  async function importBackup(file) {
    if (!file) return;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("This JSON file is unusually large.");
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : data && data.bookmarks;
      if (!Array.isArray(incoming)) throw new Error("This file does not contain a bookmarks array.");

      // JSON import is additive: preserve the current library and append any new groups.
      refreshCategories();
      const existingOrder = [...orderedGroupNames()];
      const currentGroups = [...defaultCategories, ...(state.customCategories || [])];
      const cleanGroupName = value => typeof value === "string" ? value.trim().slice(0, 40) : "";
      const findGroup = name => currentGroups.find(group => group.toLowerCase() === name.toLowerCase());
      const candidateNames = [];
      if (data && data.preferences && Array.isArray(data.preferences.groupOrder)) candidateNames.push(...data.preferences.groupOrder);
      if (data && data.preferences && Array.isArray(data.preferences.customCategories)) candidateNames.push(...data.preferences.customCategories);
      for (const item of incoming) {
        if (item && typeof item.category === "string") candidateNames.push(item.category);
      }

      const addedGroups = [];
      const addedGroupKeys = new Set();
      const groupNameMap = new Map();
      const availableNewGroupSlots = Math.max(0, 100 - (state.customCategories || []).length);
      for (const rawName of candidateNames) {
        const name = cleanGroupName(rawName);
        if (!name || name.toLowerCase() === "all bookmarks") continue;
        const key = name.toLowerCase();
        const existing = findGroup(name);
        if (existing) {
          groupNameMap.set(key, existing);
          continue;
        }
        if (addedGroupKeys.has(key)) continue;
        if (addedGroups.length >= availableNewGroupSlots) continue;
        addedGroupKeys.add(key);
        addedGroups.push(name);
        groupNameMap.set(key, name);
      }

      const existingUrls = new Set(state.bookmarks.map(item => validUrl(item.url)).filter(Boolean));
      const cleaned = [];
      let duplicateCount = 0;
      for (const item of incoming) {
        if (!item || typeof item.name !== "string" || typeof item.url !== "string") continue;
        let raw = item.url.trim();
        if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = "https://" + raw;
        const url = validUrl(raw);
        if (!url) continue;
        if (existingUrls.has(url)) {
          duplicateCount++;
          continue;
        }
        existingUrls.add(url);
        const rawCategory = cleanGroupName(item.category);
        const fallbackGroup = categories.find(c => c !== "All bookmarks") || defaultCategories[0] || "General";
        const category = rawCategory
          ? (groupNameMap.get(rawCategory.toLowerCase()) || findGroup(rawCategory) || fallbackGroup)
          : fallbackGroup;
        cleaned.push({
          id: createId(),
          name: item.name.trim().slice(0, 80) || defaultBookmarkName(url).slice(0, 80),
          url,
          category,
          note: typeof item.note === "string" ? item.note.slice(0, 120) : "",
          createdAt: Number(item.createdAt) || Date.now()
        });
      }

      if (!cleaned.length && !addedGroups.length) {
        if (incoming.length) throw new Error("No new bookmarks or groups were found. Check that the JSON contains valid bookmarks and group names.");
        throw new Error("No new bookmarks or groups were found in this file.");
      }
      const groupSummary = addedGroups.length ? ` and add ${addedGroups.length} new group(s)` : "";
      if (!confirm(`Import ${cleaned.length} new bookmark(s)${groupSummary}? Your current bookmarks and groups will be kept. Duplicate URLs are skipped.`)) return;

      state.customCategories = [...new Set([...(state.customCategories || []), ...addedGroups])].slice(0, 100);
      state.groupOrder = [...new Set([...existingOrder, ...addedGroups])];
      state.bookmarks.push(...cleaned);
      refreshCategories();
      orderedGroupNames();
      activeCategory = "All bookmarks";
      renderAll();
      closeModal("settings-modal");
      const saved = await persist();
      showToast(saved
        ? `Imported ${cleaned.length} bookmark(s) · added ${addedGroups.length} group(s) · skipped ${duplicateCount} duplicate(s)`
        : "Import applied, but saving failed. Export a backup and try again.");
    } catch (err) {
      showToast(err.message || "Could not import this file.");
    } finally {
      $("#import-file").value = "";
    }
  }
  async function processWallpaper(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Choose an image file."); return; }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = reject;
        reader.onload = () => {
          const img = new Image(); img.onload = () => {
            const max = 1920, scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas"); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/webp", .82));
          }; img.onerror = reject; img.src = reader.result;
        }; reader.readAsDataURL(file);
      });
      state.backgroundImage = dataUrl; applyPreferences(); void persist(); showToast("Wallpaper updated");
    } catch { showToast("Could not process that image. Try a smaller image."); }
    $("#bg-upload").value = "";
  }
  function applyPreferences() {
    let wallpaperValue = 'url("default-wallpaper.webp")';
    if (state.backgroundImage && typeof state.backgroundImage === "string") {
      const bg = state.backgroundImage.trim();
      if (/^data:image\/(?:png|jpeg|webp|jpg);base64,[A-Za-z0-9+/=]+$/.test(bg) || /^[a-zA-Z0-9_\-./]+\.(?:webp|png|jpg|jpeg)$/.test(bg)) {
        wallpaperValue = `url("${bg.replace(/["\\]/g, "")}")`;
      }
    }
    document.body.style.setProperty("--wallpaper", wallpaperValue);
    document.body.classList.toggle("light-theme", state.theme === "light");
    $("#theme-btn").setAttribute("aria-label", state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  function wireEvents() {
    const brandLink = $(".brand");
    if (brandLink) {
      brandLink.addEventListener("click", e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    $("#settings-btn").addEventListener("click", () => { renderManageCategories(); $("#icon-size").value=state.iconSize||48; $("#icon-size-label").textContent=`${state.iconSize||48} px`; $("#layout-lock-toggle").checked=!!state.layoutLocked; openModal("settings-modal"); });
    $("#add-category-btn").addEventListener("click", async()=>{const name=prompt("New group name:");if(!name||!name.trim())return;const clean=name.trim().slice(0,40);if(categories.some(c=>c.toLowerCase()===clean.toLowerCase())){showToast("Group already exists");return;}state.customCategories.push(clean);refreshCategories();state.groupOrder=orderedGroupNames();activeCategory="All bookmarks";renderAll();void persist();showToast("Group created")});
    $("#size-btn").addEventListener("click", () => {
      renderManageCategories();
      $("#icon-size").value = state.iconSize || 48;
      $("#icon-size-label").textContent = `${state.iconSize || 48} px`;
      $("#layout-lock-toggle").checked = !!state.layoutLocked;
      openModal("settings-modal");
      setTimeout(() => $("#icon-size").focus(), 50);
    });
    let iconSizeDebounce = null;
    $("#icon-size").addEventListener("input", e => {
      state.iconSize = Number(e.target.value);
      $("#icon-size-label").textContent = `${state.iconSize} px`;
      document.querySelectorAll(".bookmark-tile,.bookmark-grid,.add-bookmark-tile").forEach(t => t.style.setProperty("--icon-size", `${state.iconSize}px`));
      clearTimeout(iconSizeDebounce);
      iconSizeDebounce = setTimeout(() => { void persist(); }, 300);
    });
    $("#icon-size").addEventListener("change", () => {
      clearTimeout(iconSizeDebounce);
      void persist();
    });
    $("#layout-lock-toggle").addEventListener("change", e=>{state.layoutLocked=!!e.target.checked;renderAll();void persist();showToast(state.layoutLocked?"Drag & drop locked":"Drag & drop enabled")});
    $("#import-chrome-btn").addEventListener("click", importFromChrome);
    $("#settings-export-btn").addEventListener("click", exportBackup);
    $("#import-file").addEventListener("change", e => importBackup(e.target.files[0]));
    $("#bg-upload").addEventListener("change", e => processWallpaper(e.target.files[0]));
    $("#clear-bg-btn").addEventListener("click", () => { state.backgroundImage = ""; applyPreferences(); void persist(); showToast("Wallpaper removed"); });
    $("#theme-btn").addEventListener("click", () => { state.theme = state.theme === "dark" ? "light" : "dark"; applyPreferences(); void persist(); });
    $("#search-input").addEventListener("input", renderGrid);
    document.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", () => {
      closeModal(btn.dataset.close);
      if (!hasOpenModal() && storageSyncPending) scheduleStorageSync("modal-closed");
    }));
    document.querySelectorAll(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", e => {
      // Clicking outside the bookmark editor must not discard the user's work.
      // Other modals may still close from their backdrop.
      if (e.target === backdrop && backdrop.id !== "bookmark-modal") {
        closeModal(backdrop.id);
        if (!hasOpenModal() && storageSyncPending) scheduleStorageSync("backdrop-closed");
      }
    }));
    document.addEventListener("click", e => {
      if (!e.target.closest(".tile-menu, .tile-actions")) document.querySelectorAll(".tile-actions").forEach(p => p.classList.add("hidden"));
      if (!e.target.closest(".collection-manage, .collection-actions")) document.querySelectorAll(".collection-actions").forEach(p => p.classList.add("hidden"));
    });
    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#search-input").focus(); }
      if (e.key === "Tab") {
        const activeModal = document.querySelector(".modal-backdrop:not(.hidden)");
        if (activeModal) {
          const focusables = activeModal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
          if (focusables.length) {
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
      if (e.key === "Escape") {
        const openActions = document.querySelectorAll(".tile-actions:not(.hidden), .collection-actions:not(.hidden)");
        if (openActions.length) {
          openActions.forEach(p => p.classList.add("hidden"));
          return;
        }

        const searchInput = $("#search-input");
        if (!hasOpenModal() && document.activeElement === searchInput) {
          if (searchInput.value) {
            searchInput.value = "";
            renderGrid();
          } else {
            searchInput.blur();
          }
          return;
        }

        const bookmarkModal = $("#bookmark-modal");
        if (bookmarkModal && !bookmarkModal.classList.contains("hidden")) {
          const hasUnsaved = $("#bookmark-name").value.trim() || $("#bookmark-url").value.trim();
          if (!hasUnsaved || confirm("Discard unsaved bookmark changes?")) {
            closeModal("bookmark-modal");
          }
        }
        const settingsModal = $("#settings-modal");
        if (settingsModal && !settingsModal.classList.contains("hidden")) {
          closeModal("settings-modal");
        }
        if (storageSyncPending && !hasOpenModal()) scheduleStorageSync("escape-closed");
      }
    });
  }
  function hasOpenModal() {
    return !!document.querySelector(".modal-backdrop:not(.hidden)");
  }

  // Apply a single authoritative Chrome storage snapshot to the UI model.
  // Every page resume and cross-tab storage update uses the same normalisation path.
  function applyStoredData(data) {
    const before = stateSignature();
    const rawBookmarks = Array.isArray(data.bookmarks) ? data.bookmarks
      : Array.isArray(data.shortcuts) ? data.shortcuts : [];

    if (Array.isArray(data.categoryNames)) {
      defaultCategories.splice(0, defaultCategories.length,
        ...data.categoryNames.filter(c => typeof c === "string" && c.trim()).slice(0, 100));
    }

    state.customCategories = Array.isArray(data.customCategories)
      ? data.customCategories.filter(c => typeof c === "string" && c.trim() && !defaultCategories.includes(c)).slice(0, 100)
      : [];

    // Recover groups embedded in bookmark records when older or partial backups
    // did not contain a separate customCategories array.
    for (const item of rawBookmarks) {
      if (!item || typeof item !== "object") continue;
      const savedGroup = typeof item.category === "string" ? item.category.trim().slice(0, 40) : "";
      if (savedGroup && savedGroup !== "All bookmarks" &&
          !defaultCategories.includes(savedGroup) && !state.customCategories.includes(savedGroup)) {
        state.customCategories.push(savedGroup);
      }
    }
    state.customCategories = [...new Set(state.customCategories)].slice(0, 100);
    refreshCategories();
    if (categories.filter(c => c !== "All bookmarks").length === 0) {
      defaultCategories.push("General");
      refreshCategories();
    }

    state.backgroundImage = typeof data.backgroundImage === "string" ? data.backgroundImage : "";
    state.theme = data.theme === "light" ? "light" : "dark";
    state.iconSize = Number.isFinite(data.iconSize) ? Math.max(36, Math.min(88, data.iconSize)) : 48;
    state.groupOrder = Array.isArray(data.groupOrder)
      ? data.groupOrder.filter(c => typeof c === "string").slice(0, 200) : [];
    state.hiddenCategories = Array.isArray(data.hiddenCategories)
      ? [...new Set(data.hiddenCategories.filter(c => typeof c === "string" && c.trim()).map(c => c.trim()))].slice(0, 200) : [];
    state.layoutLocked = data.layoutLocked === true;

    state.bookmarks = rawBookmarks.map(item => {
      if (!item || typeof item !== "object") return null;
      let raw = String(item.url || "").trim();
      if (raw && !/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = "https://" + raw;
      const url = validUrl(raw);
      if (!url) return null;
      const name = typeof item.name === "string" && item.name.trim()
        ? item.name.trim().slice(0, 80) : defaultBookmarkName(url).slice(0, 80);
      const category = categories.includes(item.category) && item.category !== "All bookmarks"
        ? item.category
        : (categories.includes("Tools") ? "Tools" : (categories.find(c => c !== "All bookmarks") || "Uncategorised"));
      return {
        id: typeof item.id === "string" && item.id ? item.id : createId(),
        name, url, category,
        note: typeof item.note === "string" ? item.note.slice(0, 120) : "",
        createdAt: Number(item.createdAt) || Date.now()
      };
    }).filter(Boolean);

    refreshCategories();
    orderedGroupNames();
    if (activeCategory !== "All bookmarks" && !categories.includes(activeCategory)) activeCategory = "All bookmarks";

    const migrationNeeded = (state.bookmarks.length > 0 && !Array.isArray(data.bookmarks)) ||
      !Array.isArray(data.groupOrder) || typeof data.layoutLocked !== "boolean" ||
      !Array.isArray(data.categoryNames) || !Array.isArray(data.customCategories) || !Array.isArray(data.hiddenCategories);
    return { changed: before !== stateSignature(), migrationNeeded };
  }

  async function syncFromStorage(reason = "manual") {
    if (!isInitialized) { storageSyncPending = true; return; }
    if (storageSyncRunning) { storageSyncPending = true; return; }
    if (hasOpenModal()) { storageSyncPending = true; return; }

    storageSyncRunning = true;
    try {
      const data = await storageGet(STORAGE_KEYS);
      if (hasOpenModal() || pendingStorageWrites > 0) {
        storageSyncPending = true;
        return;
      }
      const result = applyStoredData(data);
      if (result.changed) {
        applyPreferences();
        renderAll();
      }
      if (result.migrationNeeded) await persist();
    } catch (err) {
      // Do not blank the working page when transient storage reads fail.
      console.error(`Sutra storage sync failed (${reason}):`, err);
    } finally {
      storageSyncRunning = false;
      if (storageSyncPending && !hasOpenModal() && pendingStorageWrites === 0) {
        storageSyncPending = false;
        scheduleStorageSync("queued");
      }
    }
  }

  function scheduleStorageSync(reason = "lifecycle") {
    if (!isInitialized) { storageSyncPending = true; return; }
    if (hasOpenModal()) { storageSyncPending = true; return; }
    clearTimeout(storageSyncTimer);
    storageSyncTimer = setTimeout(() => { void syncFromStorage(reason); }, 120);
  }

  function wireLifecycleSync() {
    // Chrome can restore suspended tabs from BFCache; pageshow/focus makes Sutra
    // reconcile state without requiring the user to press Ctrl+R.
    window.addEventListener("pageshow", () => scheduleStorageSync("pageshow"));
    window.addEventListener("focus", () => scheduleStorageSync("focus"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleStorageSync("visible");
    });

    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") return;
        if (!Object.keys(changes).some(key => STORAGE_KEYS.includes(key))) return;
        // Our own writes already match the in-memory model; syncFromStorage
        // signature comparison avoids needless full re-renders.
        scheduleStorageSync("storage-change");
      });
    }
  }

  async function init() {
    try {
      const data = await storageGet(STORAGE_KEYS);
      const result = applyStoredData(data);
      if (result.migrationNeeded) await persist();
    } catch (err) {
      console.error("Could not initialise Sutra storage:", err);
      storageSyncPending = true;
      showToast("Sutra could not read saved data. Retrying automatically.");
    }

    applyPreferences();
    wireEvents();
    renderAll();
    isInitialized = true;
    if (storageSyncPending) {
      storageSyncPending = false;
      scheduleStorageSync("startup-queued");
    }
  }
  // Register listeners synchronously so the first pageshow/focus is not missed
  // while the initial asynchronous Chrome storage read is still pending.
  wireLifecycleSync();
  init();
})();