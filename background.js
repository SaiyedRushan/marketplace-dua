/*
 * Service worker. Built-in marketplaces run via static content_scripts in the
 * manifest. Custom sites are granted host access at runtime, and their content
 * scripts are registered dynamically. Dynamic registrations persist across
 * sessions, but this reconciles them on startup/install in case a registration
 * is missing (e.g. after an update) while the host permission is still granted.
 */

importScripts("defaults.js"); // provides customOriginPattern / customScriptId / normalizePattern

async function reconcileCustomSites() {
  const { customSites = [] } = await chrome.storage.sync.get({ customSites: [] });

  let existing = [];
  try {
    existing = await chrome.scripting.getRegisteredContentScripts();
  } catch (e) {
    /* nothing registered yet */
  }
  const have = new Set(existing.map((s) => s.id));

  for (const pattern of customSites) {
    const origin = customOriginPattern(pattern);
    if (!origin) continue;
    const id = customScriptId(pattern);
    if (have.has(id)) continue;

    let granted = false;
    try {
      granted = await chrome.permissions.contains({ origins: [origin] });
    } catch (e) {
      granted = false;
    }
    if (!granted) continue; // host permission revoked / not granted on this device

    try {
      await chrome.scripting.registerContentScripts([
        { id, matches: [origin], js: ["defaults.js", "content.js"], runAt: "document_idle" }
      ]);
    } catch (e) {
      /* a single bad pattern shouldn't break the rest */
    }
  }
}

// When the user grants a site's permission from the popup, finish the add here
// (the popup may have closed when the permission prompt opened), then make sure
// every granted custom site has a registered script.
chrome.permissions.onAdded.addListener(() => {
  finalizePendingCustom().then(() => reconcileCustomSites());
});

chrome.runtime.onInstalled.addListener(() => {
  finalizePendingCustom().then(() => reconcileCustomSites());
});
chrome.runtime.onStartup.addListener(() => {
  finalizePendingCustom().then(() => reconcileCustomSites());
});
