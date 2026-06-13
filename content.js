/*
 * Runs on every page (top frame only). If the current site is a configured
 * marketplace and the reminder is due, it renders a small, self-contained
 * modal — inside a Shadow DOM so the host page's CSS can't touch it — showing
 * the du'a for entering the marketplace.
 */

(async function () {
  if (window.top !== window) return; // top frame only, never inside iframes

  const settings = await loadSettings();
  if (!settings.enabled) return;

  const match = findMatchingSite(location.hostname, location.pathname, settings);
  if (!match) return;

  const domainKey = match.id || location.hostname;
  if (!(await shouldShow(domainKey, settings.frequency))) return;

  renderDuaModal(match.label);
})();

function loadSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get(getDefaultSettings(), (items) => resolve(items || getDefaultSettings()));
    } catch (e) {
      resolve(getDefaultSettings());
    }
  });
}

// Decides whether the reminder is due, and records that we've shown it.
function shouldShow(domainKey, frequency) {
  if (frequency === "always") return Promise.resolve(true);

  if (frequency === "daily") {
    const key = "mpdua_daily_" + domainKey;
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (res) => {
        const last = (res && res[key]) || 0;
        const now = Date.now();
        if (now - last < 24 * 60 * 60 * 1000) return resolve(false);
        chrome.storage.local.set({ [key]: now }, () => resolve(true));
      });
    });
  }

  // Default: once per browsing session (per tab, per domain) via sessionStorage.
  try {
    const key = "mpdua_session_" + domainKey;
    if (sessionStorage.getItem(key)) return Promise.resolve(false);
    sessionStorage.setItem(key, "1");
    return Promise.resolve(true);
  } catch (e) {
    return Promise.resolve(true);
  }
}

const DUA = {
  arabic:
    "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ حَيٌّ لَا يَمُوتُ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
  translit:
    "Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamd, yuḥyī wa yumīt, wa huwa ḥayyun lā yamūt, bi-yadihi-l-khayr, wa huwa ʿalā kulli shayʾin qadīr.",
  translation:
    "There is none worthy of worship but Allah alone, with no partner. His is the dominion and His is all praise. He gives life and causes death, and He is the Ever-Living who never dies. In His Hand is all good, and He has power over all things.",
  reward:
    "Whoever recites this upon entering a marketplace, Allah records for him a million good deeds, erases a million of his sins, and raises him a million ranks. — Reported by at-Tirmidhī"
};

function renderDuaModal(siteLabel) {
  if (document.getElementById("mpdua-host")) return;

  const hostEl = document.createElement("div");
  hostEl.id = "mpdua-host";
  // Keep the host element itself out of the page's flow / styling.
  hostEl.style.all = "initial";
  hostEl.style.position = "fixed";
  hostEl.style.zIndex = "2147483647";

  const root = hostEl.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; margin: 0; padding: 0; }

      .overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(12, 28, 22, 0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: fade 0.22s ease both;
      }
      @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }

      .card {
        position: relative;
        width: 100%;
        max-width: 460px;
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        background: #fbfaf5;
        border: 1px solid rgba(14, 124, 90, 0.16);
        border-radius: 22px;
        padding: 30px 28px 24px;
        text-align: center;
        box-shadow: 0 24px 60px rgba(8, 30, 22, 0.35);
        animation: rise 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      .close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 30px;
        height: 30px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: #8a988f;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .close:hover { background: rgba(0, 0, 0, 0.05); color: #4a564f; }

      .eyebrow {
        display: inline-block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #0e7c5a;
        font-weight: 600;
        margin-bottom: 6px;
      }
      .heading { font-size: 19px; font-weight: 650; color: #1c2e27; }
      .site { font-size: 13px; color: #768079; margin-top: 3px; }

      .rule {
        width: 46px;
        height: 3px;
        border-radius: 2px;
        background: #0e7c5a;
        opacity: 0.55;
        margin: 18px auto;
      }

      .arabic {
        direction: rtl;
        font-family: "Scheherazade New", "Traditional Arabic", "Geeza Pro", "Noto Naskh Arabic", serif;
        font-size: 27px;
        line-height: 2.05;
        color: #133f30;
        margin: 4px 4px 16px;
      }
      .translit {
        font-style: italic;
        font-size: 13.5px;
        line-height: 1.65;
        color: #6b7a72;
        margin-bottom: 14px;
      }
      .translation {
        font-size: 14.5px;
        line-height: 1.62;
        color: #34433c;
      }

      .reward {
        margin-top: 18px;
        padding: 12px 14px;
        background: rgba(14, 124, 90, 0.07);
        border: 1px solid rgba(14, 124, 90, 0.14);
        border-radius: 14px;
        font-size: 12px;
        line-height: 1.55;
        color: #4a5a52;
      }

      .btn {
        margin-top: 22px;
        width: 100%;
        border: none;
        border-radius: 14px;
        padding: 14px 18px;
        background: #0e7c5a;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, transform 0.08s;
      }
      .btn:hover { background: #0b6a4d; }
      .btn:active { transform: translateY(1px); }
    </style>

    <div class="overlay" part="overlay">
      <div class="card" role="dialog" aria-modal="true" aria-label="Du'a before entering the marketplace">
        <button class="close" aria-label="Close">&times;</button>
        <span class="eyebrow">Before you shop</span>
        <div class="heading">Du'a for entering the marketplace</div>
        <div class="site"></div>
        <div class="rule"></div>
        <p class="arabic"></p>
        <p class="translit"></p>
        <p class="translation"></p>
        <div class="reward"></div>
        <button class="btn">آمين — Continue</button>
      </div>
    </div>
  `;

  root.querySelector(".site").textContent = "You're entering " + siteLabel;
  root.querySelector(".arabic").textContent = DUA.arabic;
  root.querySelector(".translit").textContent = DUA.translit;
  root.querySelector(".translation").textContent = DUA.translation;
  root.querySelector(".reward").textContent = DUA.reward;

  function close() {
    hostEl.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  root.querySelector(".btn").addEventListener("click", close);
  root.querySelector(".close").addEventListener("click", close);
  root.querySelector(".overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) close();
  });
  document.addEventListener("keydown", onKey);

  (document.body || document.documentElement).appendChild(hostEl);
}
