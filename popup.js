/*
 * Settings UI. Reads from and writes to chrome.storage.sync. Built-in
 * marketplaces and the matching helpers come from defaults.js.
 */

let settings = getDefaultSettings();

const el = {
  body: document.getElementById("body"),
  enabled: document.getElementById("enabled"),
  frequency: document.getElementById("frequency"),
  darkMode: document.getElementById("dark-mode"),
  defaults: document.getElementById("defaults"),
  custom: document.getElementById("custom"),
  addForm: document.getElementById("add-form"),
  addInput: document.getElementById("add-input"),
  status: document.getElementById("status")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  // Populate the frequency dropdown from the shared options.
  for (const opt of FREQUENCY_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    el.frequency.appendChild(o);
  }

  chrome.storage.sync.get(getDefaultSettings(), (items) => {
    settings = Object.assign(getDefaultSettings(), items);
    render();
  });

  el.enabled.addEventListener("change", () => {
    settings.enabled = el.enabled.checked;
    save();
    el.body.classList.toggle("disabled", !settings.enabled);
  });

  el.frequency.addEventListener("change", () => {
    settings.frequency = el.frequency.value;
    save();
  });

  el.darkMode.addEventListener("change", () => {
    settings.darkMode = el.darkMode.checked;
    applyTheme();
    save();
  });

  el.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addCustom(el.addInput.value);
  });
}

function render() {
  el.enabled.checked = settings.enabled;
  el.frequency.value = settings.frequency;
  el.darkMode.checked = !!settings.darkMode;
  el.body.classList.toggle("disabled", !settings.enabled);
  applyTheme();
  renderDefaults();
  renderCustom();
}

function applyTheme() {
  document.body.classList.toggle("dark", !!settings.darkMode);
}

function renderDefaults() {
  el.defaults.innerHTML = "";
  const disabled = settings.disabledDefaults || [];
  const removed = settings.removedDefaults || [];

  for (const site of DEFAULT_MARKETPLACES) {
    if (removed.indexOf(site.id) !== -1) continue;

    const item = document.createElement("div");
    item.className = "item";

    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = disabled.indexOf(site.id) === -1;
    cb.addEventListener("change", () => toggleDefault(site.id, cb.checked));

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = site.label;

    label.appendChild(cb);
    label.appendChild(name);

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeDefault(site.id));

    item.appendChild(label);
    item.appendChild(remove);
    el.defaults.appendChild(item);
  }

  // Offer a way back — built-ins are part of the extension, not user data.
  if (removed.length > 0) {
    const row = document.createElement("div");
    row.className = "restore-row";

    const txt = document.createElement("span");
    txt.textContent =
      removed.length + (removed.length === 1 ? " marketplace removed" : " marketplaces removed");

    const btn = document.createElement("button");
    btn.className = "restore-btn";
    btn.textContent = "Restore all";
    btn.addEventListener("click", restoreDefaults);

    row.appendChild(txt);
    row.appendChild(btn);
    el.defaults.appendChild(row);
  }
}

function renderCustom() {
  el.custom.innerHTML = "";
  const sites = settings.customSites || [];

  if (sites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No custom sites yet.";
    el.custom.appendChild(empty);
    return;
  }

  for (const pattern of sites) {
    const item = document.createElement("div");
    item.className = "item";

    const name = document.createElement("span");
    name.className = "name";
    name.style.flex = "1";
    name.textContent = pattern;

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeCustom(pattern));

    item.appendChild(name);
    item.appendChild(remove);
    el.custom.appendChild(item);

    // Surface sites that don't yet have host permission on this device
    // (e.g. the list synced over but access was never granted here).
    const origin = customOriginPattern(pattern);
    if (origin) {
      chrome.permissions.contains({ origins: [origin] }, (has) => {
        if (has) return;
        item.classList.add("needs-perm");
        const enable = document.createElement("button");
        enable.className = "enable";
        enable.textContent = "Enable";
        enable.addEventListener("click", () => {
          chrome.permissions.request({ origins: [origin] }, (granted) => {
            if (!granted) return flash("Permission needed for " + pattern);
            registerCustom(pattern, () => {
              flash("Enabled " + pattern);
              renderCustom();
            });
          });
        });
        item.insertBefore(enable, remove);
      });
    }
  }
}

// Register a content script for a custom site (idempotent).
function registerCustom(pattern, done) {
  const origin = customOriginPattern(pattern);
  const id = customScriptId(pattern);
  if (!origin) return done && done();

  chrome.scripting.getRegisteredContentScripts({ ids: [id] }, (existing) => {
    if (existing && existing.length) return done && done();
    chrome.scripting.registerContentScripts(
      [{ id, matches: [origin], js: ["defaults.js", "content.js"], runAt: "document_idle" }],
      () => {
        void chrome.runtime.lastError; // ignore "already registered" races
        done && done();
      }
    );
  });
}

function toggleDefault(id, enabled) {
  const set = new Set(settings.disabledDefaults || []);
  if (enabled) set.delete(id);
  else set.add(id);
  settings.disabledDefaults = Array.from(set);
  save();
}

function removeDefault(id) {
  const set = new Set(settings.removedDefaults || []);
  set.add(id);
  settings.removedDefaults = Array.from(set);
  const site = DEFAULT_MARKETPLACES.find((s) => s.id === id);
  save("Removed " + (site ? site.label : id));
  renderDefaults();
}

function restoreDefaults() {
  settings.removedDefaults = [];
  save("Restored marketplaces");
  renderDefaults();
}

function addCustom(raw) {
  const pattern = normalizePattern(raw);
  if (!pattern || pattern.indexOf(".") === -1) {
    flash("Enter a full domain, e.g. shop.example.com");
    return;
  }
  const sites = settings.customSites || [];
  if (sites.indexOf(pattern) !== -1) {
    flash(pattern + " is already added");
    el.addInput.value = "";
    return;
  }

  // Ask for access to just this site, then register its content script.
  const origin = customOriginPattern(pattern);
  chrome.permissions.request({ origins: [origin] }, (granted) => {
    if (!granted) {
      flash("Permission needed to add " + pattern);
      return;
    }
    registerCustom(pattern, () => {
      settings.customSites = sites.concat(pattern);
      el.addInput.value = "";
      save("Added " + pattern);
      renderCustom();
    });
  });
}

function removeCustom(pattern) {
  const origin = customOriginPattern(pattern);
  const id = customScriptId(pattern);

  chrome.scripting.unregisterContentScripts({ ids: [id] }, () => {
    void chrome.runtime.lastError; // fine if it wasn't registered
    if (origin) chrome.permissions.remove({ origins: [origin] }, () => void chrome.runtime.lastError);
    settings.customSites = (settings.customSites || []).filter((p) => p !== pattern);
    save("Removed " + pattern);
    renderCustom();
  });
}

function save(message) {
  chrome.storage.sync.set(settings, () => flash(message || "Saved"));
}

let flashTimer = null;
function flash(message) {
  el.status.textContent = message;
  el.status.style.opacity = "1";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    el.status.style.opacity = "0";
  }, 1600);
}
