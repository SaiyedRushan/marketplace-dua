/*
 * Shared between the content script and the popup.
 * Defines the built-in marketplaces, default settings, and the site-matching
 * logic. Loaded as a plain script in both contexts (no modules), so it just
 * declares a few globals.
 */

const DEFAULT_MARKETPLACES = [
  { id: "amazon",     label: "Amazon",               test: (h)    => h.includes("amazon.") },
  { id: "ebay",       label: "eBay",                 test: (h)    => h.includes("ebay.") },
  { id: "fbmarket",   label: "Facebook Marketplace", test: (h, p) => (h.includes("facebook.") || h.includes("fb.com")) && p.includes("/marketplace") },
  { id: "etsy",       label: "Etsy",                 test: (h)    => h.includes("etsy.") },
  { id: "walmart",    label: "Walmart",              test: (h)    => h.includes("walmart.") },
  { id: "aliexpress", label: "AliExpress",           test: (h)    => h.includes("aliexpress.") },
  { id: "alibaba",    label: "Alibaba",              test: (h)    => h.includes("alibaba.") },
  { id: "temu",       label: "Temu",                 test: (h)    => h.includes("temu.") },
  { id: "shein",      label: "SHEIN",                test: (h)    => h.includes("shein.") },
  { id: "target",     label: "Target",               test: (h)    => h.includes("target.com") },
  { id: "bestbuy",    label: "Best Buy",             test: (h)    => h.includes("bestbuy.") },
  { id: "mercari",    label: "Mercari",              test: (h)    => h.includes("mercari.") },
  { id: "craigslist", label: "Craigslist",           test: (h)    => h.includes("craigslist.") },
  { id: "wayfair",    label: "Wayfair",              test: (h)    => h.includes("wayfair.") },
  { id: "wish",       label: "Wish",                 test: (h)    => h.includes("wish.com") },
  { id: "noon",       label: "Noon",                 test: (h)    => h.includes("noon.com") }
];

// Reminder frequency options shown in the popup.
const FREQUENCY_OPTIONS = [
  { value: "always",  label: "Every visit" },
  { value: "session", label: "Once per browsing session" },
  { value: "daily",   label: "Once per day" }
];

function getDefaultSettings() {
  return {
    enabled: true,
    frequency: "session", // "always" | "session" | "daily"
    darkMode: false,       // dark theme for the popup and the reminder modal
    disabledDefaults: [],  // ids of built-in marketplaces the user turned off
    removedDefaults: [],   // ids of built-in marketplaces the user removed from the list
    customSites: []        // user-added patterns, e.g. "shop.example.com"
  };
}

// Turn whatever the user typed into a bare host pattern.
function normalizePattern(input) {
  if (!input) return "";
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, ""); // strip scheme
  s = s.replace(/^www\./, "");        // strip leading www.
  s = s.split("/")[0].split("?")[0];  // drop path / query
  return s.trim();
}

// Match-pattern + dynamic-script id for a user-added custom site. Custom sites
// are granted host access at runtime (optional permissions), so the popup and
// the service worker both need to derive these consistently.
function customOriginPattern(input) {
  const d = normalizePattern(input);
  if (!d || d.indexOf(".") === -1) return null; // must be a real domain
  return "*://*." + d + "/*";
}

function customScriptId(input) {
  const d = normalizePattern(input);
  return "mpdua_" + d.replace(/[^a-z0-9]/g, "_");
}

function customMatches(host, pattern) {
  const p = normalizePattern(pattern);
  if (!p) return false;
  if (host === p) return true;
  if (host.endsWith("." + p)) return true;
  return host.includes(p); // forgiving: lets bare keywords like "shop" match too
}

// Returns { id, label } for the first matching site, or null.
function findMatchingSite(host, path, settings) {
  if (!settings || settings.enabled === false) return null;
  host = (host || "").toLowerCase();
  path = (path || "").toLowerCase();

  const disabled = settings.disabledDefaults || [];
  const removed = settings.removedDefaults || [];
  for (const site of DEFAULT_MARKETPLACES) {
    if (disabled.indexOf(site.id) !== -1) continue;
    if (removed.indexOf(site.id) !== -1) continue;
    try {
      if (site.test(host, path)) return { id: site.id, label: site.label };
    } catch (e) {
      /* a bad matcher should never break the page */
    }
  }

  for (const pattern of settings.customSites || []) {
    if (customMatches(host, pattern)) {
      const p = normalizePattern(pattern);
      return { id: "custom:" + p, label: p };
    }
  }

  return null;
}
