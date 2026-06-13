# Marketplace Du'a

A small, minimalist Chrome extension that shows a gentle reminder to recite the
**du'a for entering the marketplace** whenever you land on a shopping site —
Amazon, eBay, Facebook Marketplace, and any sites you add yourself.

It shows two things, with links to verify each hadith on [sunnah.com](https://sunnah.com):

1. The **du'a for entering the marketplace** — [Jāmiʿ at-Tirmidhī 3428](https://sunnah.com/tirmidhi:3428):

   > لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، يُحْيِي وَيُمِيتُ، وَهُوَ حَيٌّ لَا يَمُوتُ، بِيَدِهِ الْخَيْرُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ
   >
   > *Lā ilāha illa-llāhu waḥdahu lā sharīka lah, lahu-l-mulku wa lahu-l-ḥamd, yuḥyī wa yumīt, wa huwa ḥayyun lā yamūt, bi-yadihi-l-khayr, wa huwa ʿalā kulli shayʾin qadīr.*

2. A **reminder to ask Allah for whatever you seek — however small**, with the
   Prophet's ﷺ teaching — [Jāmiʿ at-Tirmidhī 3604](https://sunnah.com/tirmidhi:3604j) (graded *ḥasan*):

   > لِيَسْأَلْ أَحَدُكُمْ رَبَّهُ حَاجَتَهُ حَتَّى يَسْأَلَهُ الْمِلْحَ، وَحَتَّى يَسْأَلَهُ شِسْعَ نَعْلِهِ إِذَا انْقَطَعَ
   >
   > *Li-yasʾal aḥadukum rabbahu ḥājatahu, ḥattā yasʾalahu-l-milḥa, wa ḥattā yasʾalahu shisʿa naʿlihi idhā-nqaṭaʿa.*
   >
   > "Let one of you ask his Lord for his every need, until he asks Him for salt, and asks Him for the strap of his sandal when it breaks."

## Features

- **Automatic reminder** — a clean modal appears the moment you open a shopping
  site, with both du'as in Arabic, transliteration, translation, and a clickable
  reference to the hadith on sunnah.com.
- **Built-in marketplaces** — Amazon, eBay, Facebook Marketplace, Etsy, Walmart,
  AliExpress, Alibaba, Temu, SHEIN, Target, Best Buy, Mercari, Craigslist,
  Wayfair, Wish, Noon. Turn any of them off from the popup.
- **Custom sites** — add any other shopping website (e.g. `shop.example.com`).
- **Frequency control** — show on every visit, once per browsing session
  (default), or once per day per site.
- **Dark mode** — a toggleable dark theme for both the popup and the reminder.
- **Private** — everything runs locally and is stored in your browser. No
  tracking, no network requests, no analytics.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome (or any Chromium browser — Edge, Brave…).
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this `marketplace-dua` folder.
4. Pin the extension and click its icon to manage settings.

## Usage

- Visit a shopping site → the du'a modal appears. Recite it, then click
  **آمين — Continue** (or press `Esc`) to dismiss.
- Click the toolbar icon to:
  - turn reminders on/off,
  - choose how often the reminder shows,
  - toggle dark mode,
  - enable/disable built-in marketplaces,
  - add or remove your own custom sites.

## Project layout

```
manifest.json          Manifest V3 config
defaults.js            Built-in marketplaces + matching/permission helpers (shared)
background.js          Re-registers custom-site scripts on startup/install
content.js             Detects marketplaces and renders the du'a modal
popup.html/.css/.js    Settings UI
icons/                 Generated PNG icons
scripts/generate_icons.py   Regenerates the icons (no dependencies)
```

## Permissions

The extension follows least privilege — it does **not** request broad access to
all sites:

- **Built-in marketplaces** are listed explicitly in the manifest's
  `content_scripts`, so they work automatically.
- **Custom sites** use *optional* host permissions: when you add a site in the
  popup, Chrome asks for access to just that domain, and its content script is
  registered dynamically (`scripting`). Removing the site unregisters it and
  revokes the permission.

The content script only checks the current hostname and does nothing on
non-marketplace pages.

## Notes

- To regenerate icons after tweaking colours/shape: `python3 scripts/generate_icons.py`.

May Allah make your transactions blessed.
