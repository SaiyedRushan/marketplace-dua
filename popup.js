/*
 * Settings UI. Reads from and writes to chrome.storage.sync. Built-in
 * marketplaces and the matching helpers come from defaults.js.
 */

let settings = getDefaultSettings();

const el = {
  body: document.getElementById("body"),
  enabled: document.getElementById("enabled"),
  frequency: document.getElementById("frequency"),
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

  el.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addCustom(el.addInput.value);
  });
}

function render() {
  el.enabled.checked = settings.enabled;
  el.frequency.value = settings.frequency;
  el.body.classList.toggle("disabled", !settings.enabled);
  renderDefaults();
  renderCustom();
}

function renderDefaults() {
  el.defaults.innerHTML = "";
  const disabled = settings.disabledDefaults || [];

  for (const site of DEFAULT_MARKETPLACES) {
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
    item.appendChild(label);
    el.defaults.appendChild(item);
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
  }
}

function toggleDefault(id, enabled) {
  const set = new Set(settings.disabledDefaults || []);
  if (enabled) set.delete(id);
  else set.add(id);
  settings.disabledDefaults = Array.from(set);
  save();
}

function addCustom(raw) {
  const pattern = normalizePattern(raw);
  if (!pattern) {
    flash("Enter a valid website");
    return;
  }
  const sites = settings.customSites || [];
  if (sites.indexOf(pattern) !== -1) {
    flash(pattern + " is already added");
    el.addInput.value = "";
    return;
  }
  settings.customSites = sites.concat(pattern);
  el.addInput.value = "";
  save("Added " + pattern);
  renderCustom();
}

function removeCustom(pattern) {
  settings.customSites = (settings.customSites || []).filter((p) => p !== pattern);
  save("Removed " + pattern);
  renderCustom();
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
