/*
 * Runs on every page (top frame only). If the current site is a configured
 * marketplace and the reminder is due, it renders a small, self-contained
 * modal — inside a Shadow DOM so the host page's CSS can't touch it — showing
 * the du'a for entering the marketplace plus a prompt to ask Allah for good
 * in what you intend to buy.
 */

(async function () {
  if (window.top !== window) return; // top frame only, never inside iframes

  const settings = await loadSettings();
  if (!settings.enabled) return;

  const match = findMatchingSite(location.hostname, location.pathname, settings);
  if (!match) return;

  const domainKey = match.id || location.hostname;
  if (!(await shouldShow(domainKey, settings.frequency))) return;

  renderDuaModal(match.label, !!settings.darkMode);
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

// Du'a for entering the marketplace — Jāmiʿ at-Tirmidhī 3428.
const DUA_MARKET = {
  arabic:
    "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ حَيٌّ لَا يَمُوتُ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ",
  translit:
    "Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamd, yuḥyī wa yumīt, wa huwa ḥayyun lā yamūt, bi-yadihi-l-khayr, wa huwa ʿalā kulli shayʾin qadīr.",
  translation:
    "There is none worthy of worship but Allah alone, with no partner. His is the dominion and His is all praise. He gives life and causes death, and He is the Ever-Living who never dies. In His Hand is all good, and He has power over all things.",
  reward:
    "Whoever recites this upon entering a marketplace, Allah records for him a million good deeds, erases a million of his sins, and raises him a million ranks.",
  source: { label: "Jāmiʿ at-Tirmidhī 3428", url: "https://sunnah.com/tirmidhi:3428" }
};

// Du'a for what you acquire — Sunan Abī Dāwūd 2160 (graded ḥasan).
const DUA_SEEK = {
  prompt:
    "Now pause and ask Allah for what you truly need — and for goodness and barakah in whatever you buy, and refuge from its harm.",
  arabic:
    "اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهُ وَخَيْرَ مَا جَبَلْتَهُ عَلَيْهِ، وَأَعُوذُ بِكَ مِنْ شَرِّهِ وَشَرِّ مَا جَبَلْتَهُ عَلَيْهِ",
  translit:
    "Allāhumma innī asʾaluka khayrahu wa khayra mā jabaltahu ʿalayh, wa aʿūdhu bika min sharrihi wa sharri mā jabaltahu ʿalayh.",
  translation:
    "O Allah, I ask You for its good and the good with which You created it, and I seek refuge in You from its evil and the evil with which You created it.",
  note: "From the Prophet's ﷺ teaching on what to say when acquiring something. Adjust the pronoun to suit what you're buying.",
  source: { label: "Sunan Abī Dāwūd 2160", url: "https://sunnah.com/abudawud:2160" }
};

function renderDuaModal(siteLabel, dark) {
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
        --overlay-bg: rgba(12, 28, 22, 0.55);
        --card-bg: #fbfaf5;
        --card-border: rgba(14, 124, 90, 0.16);
        --ink: #1c2e27;
        --muted: #768079;
        --arabic: #133f30;
        --accent: #0e7c5a;
        --reward-bg: rgba(14, 124, 90, 0.07);
        --reward-border: rgba(14, 124, 90, 0.14);
        --btn-bg: #0e7c5a;
        --btn-bg-hover: #0b6a4d;
        --divider: rgba(14, 124, 90, 0.16);
        --link: #0b6a4d;

        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: var(--overlay-bg);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: fade 0.22s ease both;
      }
      .overlay.dark {
        --overlay-bg: rgba(4, 10, 8, 0.7);
        --card-bg: #15201c;
        --card-border: rgba(95, 194, 163, 0.22);
        --ink: #eaf3ef;
        --muted: #9fb0a8;
        --arabic: #b6e6d4;
        --accent: #5fc2a3;
        --reward-bg: rgba(95, 194, 163, 0.10);
        --reward-border: rgba(95, 194, 163, 0.22);
        --btn-bg: #1f9c76;
        --btn-bg-hover: #25b083;
        --divider: rgba(95, 194, 163, 0.20);
        --link: #7fd6ba;
      }
      @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes rise { from { opacity: 0; transform: translateY(14px) scale(0.985); } to { opacity: 1; transform: none; } }

      .card {
        position: relative;
        width: 100%;
        max-width: 470px;
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        background: var(--card-bg);
        border: 1px solid var(--card-border);
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
        color: var(--muted);
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .close:hover { background: rgba(127, 127, 127, 0.14); color: var(--ink); }

      .eyebrow {
        display: inline-block;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 600;
        margin-bottom: 6px;
      }
      .heading { font-size: 19px; font-weight: 650; color: var(--ink); }
      .site { font-size: 13px; color: var(--muted); margin-top: 3px; }
      .prompt { font-size: 13.5px; line-height: 1.6; color: var(--muted); margin-top: 4px; }

      .rule {
        width: 46px;
        height: 3px;
        border-radius: 2px;
        background: var(--accent);
        opacity: 0.55;
        margin: 18px auto;
      }

      .arabic {
        direction: rtl;
        font-family: "Scheherazade New", "Traditional Arabic", "Geeza Pro", "Noto Naskh Arabic", serif;
        font-size: 27px;
        line-height: 2.05;
        color: var(--arabic);
        margin: 4px 4px 16px;
      }
      .translit {
        font-style: italic;
        font-size: 13.5px;
        line-height: 1.65;
        color: var(--muted);
        margin-bottom: 14px;
      }
      .translation {
        font-size: 14.5px;
        line-height: 1.62;
        color: var(--ink);
      }

      .reward {
        margin-top: 18px;
        padding: 12px 14px;
        background: var(--reward-bg);
        border: 1px solid var(--reward-border);
        border-radius: 14px;
        font-size: 12px;
        line-height: 1.55;
        color: var(--ink);
      }
      .note {
        margin-top: 12px;
        font-size: 11.5px;
        line-height: 1.5;
        color: var(--muted);
      }

      .source {
        display: inline-block;
        margin-top: 10px;
        font-size: 12px;
        color: var(--link);
        text-decoration: none;
        border-bottom: 1px solid currentColor;
        padding-bottom: 1px;
      }
      .source:hover { opacity: 0.8; }

      .divider {
        height: 1px;
        background: var(--divider);
        margin: 24px 0 22px;
      }

      .btn {
        margin-top: 24px;
        width: 100%;
        border: none;
        border-radius: 14px;
        padding: 14px 18px;
        background: var(--btn-bg);
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, transform 0.08s;
      }
      .btn:hover { background: var(--btn-bg-hover); }
      .btn:active { transform: translateY(1px); }
    </style>

    <div class="overlay${dark ? " dark" : ""}" part="overlay">
      <div class="card" role="dialog" aria-modal="true" aria-label="Du'a before entering the marketplace">
        <button class="close" aria-label="Close">&times;</button>

        <span class="eyebrow">Before you shop</span>
        <div class="heading">Du'a for entering the marketplace</div>
        <div class="site"></div>
        <div class="rule"></div>
        <p class="arabic" id="m-arabic"></p>
        <p class="translit" id="m-translit"></p>
        <p class="translation" id="m-translation"></p>
        <div class="reward" id="m-reward"></div>
        <a class="source" id="m-source" target="_blank" rel="noopener noreferrer"></a>

        <div class="divider"></div>

        <span class="eyebrow">Then ask for what you seek</span>
        <p class="prompt" id="s-prompt"></p>
        <p class="arabic" id="s-arabic"></p>
        <p class="translit" id="s-translit"></p>
        <p class="translation" id="s-translation"></p>
        <p class="note" id="s-note"></p>
        <a class="source" id="s-source" target="_blank" rel="noopener noreferrer"></a>

        <button class="btn">آمين — Continue</button>
      </div>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);

  $(".site").textContent = "You're entering " + siteLabel;

  $("#m-arabic").textContent = DUA_MARKET.arabic;
  $("#m-translit").textContent = DUA_MARKET.translit;
  $("#m-translation").textContent = DUA_MARKET.translation;
  $("#m-reward").textContent = DUA_MARKET.reward;
  $("#m-source").textContent = DUA_MARKET.source.label + " ↗";
  $("#m-source").href = DUA_MARKET.source.url;

  $("#s-prompt").textContent = DUA_SEEK.prompt;
  $("#s-arabic").textContent = DUA_SEEK.arabic;
  $("#s-translit").textContent = DUA_SEEK.translit;
  $("#s-translation").textContent = DUA_SEEK.translation;
  $("#s-note").textContent = DUA_SEEK.note;
  $("#s-source").textContent = DUA_SEEK.source.label + " ↗";
  $("#s-source").href = DUA_SEEK.source.url;

  function close() {
    hostEl.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  $(".btn").addEventListener("click", close);
  $(".close").addEventListener("click", close);
  $(".overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) close();
  });
  document.addEventListener("keydown", onKey);

  (document.body || document.documentElement).appendChild(hostEl);
}
