// ==UserScript==
// @name         Kick Third-Party Emotes
// @namespace    https://kick.com
// @version      2.11.1
// @description  Adds BetterTTV, 7TV & FrankerFaceZ emotes to Kick.com chat — animated & zero-width emotes, usage-ranked autocomplete, favourites, hover previews, right-click emote menu, native picker tab with recents & per-provider toggles
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         https://raw.githubusercontent.com/jakubn11/kick-third-party-emotes/main/icon.svg
// @match        https://kick.com/*
// @updateURL    https://raw.githubusercontent.com/jakubn11/kick-third-party-emotes/main/kick-third-party-emotes.user.js
// @downloadURL  https://raw.githubusercontent.com/jakubn11/kick-third-party-emotes/main/kick-third-party-emotes.user.js
// @grant        GM_xmlhttpRequest
// @connect      api.betterttv.net
// @connect      cdn.betterttv.net
// @connect      7tv.io
// @connect      cdn.7tv.app
// @connect      api.frankerfacez.com
// @connect      cdn.frankerfacez.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const log = (...a) => console.log('[KickEmotes]', ...a);

  const NON_CHANNEL_SLUGS = new Set([
    '', 'home', 'browse', 'following', 'categories', 'search',
    'login', 'register', 'dashboard', 'settings', 'clips', 'videos',
    'subscriptions', 'notifications', 'messages', 'wallet',
  ]);

  const BTTV_CDN = 'https://cdn.betterttv.net/emote';
  const BTTV_API = 'https://api.betterttv.net/3';
  const SEVENTV_API = 'https://7tv.io/v3';
  const FFZ_API = 'https://api.frankerfacez.com/v1';
  // Same-origin, so it goes through the page's fetch — no GM request, no @connect.
  const KICK_CHANNEL_API = '/api/v2/channels';

  // BTTV's API exposes no overlay flag, so its own clients carry this fixed
  // list of zero-width emotes. Without it `cvMask`/`cvHazmat` — both in BTTV
  // global today — render side by side instead of stacking on the base emote.
  const BTTV_ZERO_WIDTH = new Set([
    'SoSnowy', 'IceCold', 'SantaHat', 'TopHat', 'ReinDeer', 'CandyCane',
    'cvMask', 'cvHazmat',
  ]);

  const ALLOWED_CDN_HOSTS = new Set([
    'cdn.betterttv.net',
    'cdn.7tv.app',
    'cdn.frankerfacez.com',
  ]);

  // Kick may change class names; list fallbacks in priority order.
  const MSG_SELECTORS = [
    'div[style*="--chatroom-font-size"]',   // current Kick DOM (2025+)
    'span.leading-\\[1\\.55\\].font-normal', // text span fallback
    '.chat-entry-content',
    '.chat-message-content',
    '.message-content',
    '[data-chat-entry] .message',
    '.chat-entry .message',
  ];
  const MSG_SELECTOR = MSG_SELECTORS.join(', ');

  // Text inside these is chrome, not message content. Kick renders the chatter's
  // name as a plain <button> inside the message row, so without the button rule
  // a chatter called e.g. `Sadge` has their name replaced by an emote image and
  // loses Kick's click-to-mention control. Both button selectors are deliberately
  // narrow: the reply-preview button ("Replying to X: …") carries neither, so
  // emotes still render inside reply quotes.
  const SKIP_TEXT_SELECTORS = [
    'a',
    'button[data-prevent-expand]',           // current Kick DOM (2025+)
    'button.font-bold',                      // class fallback for the same button
  ];
  const SKIP_TEXT_SELECTOR = SKIP_TEXT_SELECTORS.join(', ');

  const INPUT_SELECTORS = [
    '[data-testid="chat-input"]',            // current Kick DOM (2025+)
    '.editor-input[contenteditable]',        // Lexical editor class fallback
    '[data-chat-input]',
    '.chat-input-wrapper [contenteditable]',
    '.chat-input [contenteditable]',
    '[contenteditable][placeholder]',
    'div[contenteditable="true"]',
  ];

  // ─── Cache ────────────────────────────────────────────────────────────────

  const GLOBAL_CACHE_TTL = 12 * 60 * 60 * 1000;
  const CHANNEL_CACHE_TTL = 3 * 60 * 60 * 1000;
  const EMPTY_CACHE_TTL = 15 * 60 * 1000;

  function isSafeTextToken(value, maxLength) {
    return typeof value === 'string'
      && value.length > 0
      && value.length <= maxLength
      && !/[\s\u0000-\u001f\u007f]/.test(value);
  }

  function isSafeTextLabel(value, maxLength) {
    return typeof value === 'string'
      && value.length > 0
      && value.length <= maxLength
      && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function isValidCacheEntry(e) {
    if (!Array.isArray(e)
      || !isSafeTextToken(e[0], 100)
      || typeof e[1]?.url !== 'string'
      || e[1].url.length > 2048
      || !safeUrl(e[1].url)
      || !isSafeTextLabel(e[1]?.source, 64)) return false;
    if (e[1].staticUrl !== undefined) {
      if (typeof e[1].staticUrl !== 'string'
        || e[1].staticUrl.length > 2048
        || !safeUrl(e[1].staticUrl)) return false;
    }
    return true;
  }

  // Prefix bumped from `kte_` to `kte_v2_` when adding `staticUrl` to the emote
  // schema, to `kte_v3_` when BTTV emotes gained real zeroWidth flags — cached
  // v2 entries all claim `zeroWidth: false` — and to `kte_v4_` when 7TV's
  // zeroWidth started reading the right flag bit and failed channel lookups
  // stopped being cached as empty sets. Orphaned keys from older prefixes are
  // removed by sweepCache below.
  const CACHE_PREFIX = 'kte_v4_';

  // User state, not cached provider data: it has no schema tied to the emote
  // shape, so it deliberately keeps its own stable prefix and survives every
  // cache-prefix bump. sweepCache skips these keys.
  const USAGE_KEY = 'kte_v2_usage';
  const FAVS_KEY = 'kte_v2_favs';
  const SETTINGS_KEY = 'kte_v2_settings';
  const PRESERVED_KEYS = new Set([USAGE_KEY, FAVS_KEY, SETTINGS_KEY]);

  // Every visited channel leaves kte_v4_*_c_<slug> keys behind and localStorage
  // never evicts them, so a long tail of channels would eventually hit quota
  // and silently disable caching. Drop old-prefix keys and anything long expired.
  const CACHE_SWEEP_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  function sweepCache() {
    const doomed = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('kte_')) continue;
        if (PRESERVED_KEYS.has(key)) continue; // usage + favourites persist indefinitely
        if (!key.startsWith(CACHE_PREFIX)) { doomed.push(key); continue; }
        try {
          const { ts } = JSON.parse(localStorage.getItem(key));
          if (typeof ts !== 'number' || Date.now() - ts > CACHE_SWEEP_MAX_AGE) doomed.push(key);
        } catch { doomed.push(key); }
      }
      doomed.forEach(key => localStorage.removeItem(key));
    } catch { /* storage access denied – skip */ }
  }

  const Cache = {
    read(key) {
      try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (typeof ts !== 'number' || !Array.isArray(data) || !data.every(isValidCacheEntry)) {
          localStorage.removeItem(`${CACHE_PREFIX}${key}`);
          return null;
        }
        return { ts, data };
      } catch {
        try { localStorage.removeItem(`${CACHE_PREFIX}${key}`); }
        catch { /* ignore */ }
        return null;
      }
    },
    set(key, data) {
      try { localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ ts: Date.now(), data })); }
      catch { /* quota exceeded – skip silently */ }
    },
  };

  // ─── Emote usage tracker ──────────────────────────────────────────────────
  // Local-only counter of inserted emotes (autocomplete + picker). Powers
  // usage-first autocomplete ranking and the picker's "Recently used" section.

  const USAGE_MAX_ENTRIES = 200;

  let usageMap = null; // code → { n: insert count, t: last-used timestamp }
  let usageSaveQueued = false;

  function usageLoad() {
    if (usageMap) return usageMap;
    usageMap = new Map();
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      if (raw) {
        const { counts } = JSON.parse(raw);
        for (const [code, v] of Object.entries(counts ?? {})) {
          if (!isSafeTextToken(code, 100)) continue;
          if (typeof v?.[0] !== 'number' || typeof v?.[1] !== 'number') continue;
          usageMap.set(code, { n: v[0], t: v[1] });
        }
      }
    } catch { /* corrupted record – start fresh */ }
    return usageMap;
  }

  function usageCount(code) {
    return usageLoad().get(code)?.n ?? 0;
  }

  function usageBump(code) {
    const map = usageLoad();
    const cur = map.get(code) ?? { n: 0, t: 0 };
    cur.n++;
    cur.t = Date.now();
    map.set(code, cur);
    if (map.size > USAGE_MAX_ENTRIES) {
      // Evict the least-recently-used code (bumps add at most one entry)
      let worst = null;
      for (const [c, v] of map) {
        if (!worst || v.t < worst[1].t) worst = [c, v];
      }
      if (worst) map.delete(worst[0]);
    }
    usageSave();
  }

  function usageSave() {
    if (usageSaveQueued) return;
    usageSaveQueued = true;
    RIC(() => {
      usageSaveQueued = false;
      try {
        const counts = {};
        for (const [code, v] of usageLoad()) counts[code] = [v.n, v.t];
        localStorage.setItem(USAGE_KEY, JSON.stringify({ ts: Date.now(), counts }));
      } catch { /* quota exceeded – skip silently */ }
    });
  }

  // ─── Favourites ───────────────────────────────────────────────────────────
  // Local-only starred emote codes. Favourites outrank usage in autocomplete
  // and get their own picker section above "Recently used".

  const FAVS_MAX_ENTRIES = 100;

  let favSet = null; // insertion-ordered Set of codes, oldest first
  let favSaveQueued = false;

  function favLoad() {
    if (favSet) return favSet;
    favSet = new Set();
    try {
      const raw = localStorage.getItem(FAVS_KEY);
      if (raw) {
        const { codes } = JSON.parse(raw);
        for (const code of Array.isArray(codes) ? codes : []) {
          if (isSafeTextToken(code, 100)) favSet.add(code);
        }
      }
    } catch { /* corrupted record – start fresh */ }
    return favSet;
  }

  function favHas(code) {
    return favLoad().has(code);
  }

  // Newest first — the picker section reads most-recently-starred at the top.
  function favCodes() {
    return [...favLoad()].reverse();
  }

  function favToggle(code) {
    const set = favLoad();
    const added = !set.delete(code);
    if (added) {
      set.add(code);
      // Drop the oldest star once full (adds grow the set by at most one).
      if (set.size > FAVS_MAX_ENTRIES) set.delete(set.values().next().value);
    }
    favSave();
    return added;
  }

  function favSave() {
    if (favSaveQueued) return;
    favSaveQueued = true;
    RIC(() => {
      favSaveQueued = false;
      try {
        localStorage.setItem(FAVS_KEY, JSON.stringify({ ts: Date.now(), codes: [...favLoad()] }));
      } catch { /* quota exceeded – skip silently */ }
    });
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  // Local-only preferences, surfaced as chips at the top of the picker's 7TV+
  // tab. User state like usage and favourites, so it keeps its own stable key
  // and is exempt from the cache sweep.

  const PROVIDERS = ['7TV', 'BTTV', 'FFZ'];

  let settings = null;
  let settingsSaveQueued = false;

  function settingsLoad() {
    if (settings) return settings;
    settings = { providers: {} };
    for (const provider of PROVIDERS) settings.providers[provider] = true;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        for (const provider of PROVIDERS) {
          if (typeof saved?.providers?.[provider] === 'boolean') {
            settings.providers[provider] = saved.providers[provider];
          }
        }
      }
    } catch { /* corrupted record – fall back to defaults */ }
    return settings;
  }

  // Anything outside the known set — a future provider, or the 'Other' bucket
  // sourceName falls back to — stays visible rather than silently disappearing.
  function providerEnabled(provider) {
    return settingsLoad().providers[provider] ?? true;
  }

  function settingsSave() {
    if (settingsSaveQueued) return;
    settingsSaveQueued = true;
    RIC(() => {
      settingsSaveQueued = false;
      try {
        const { providers } = settingsLoad();
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ts: Date.now(), providers }));
      } catch { /* quota exceeded – skip silently */ }
    });
  }

  // ─── State ────────────────────────────────────────────────────────────────

  const emoteMap = new Map(); // code → { url, source, animated, zeroWidth }
  const memoryCache = new Map(); // provider key → { ts, data }, avoids sync localStorage parse on SPA nav
  const pendingLoads = new Map(); // provider key → Promise<entries>, deduplicates in-flight API fetches

  // Each channel visit leaves three channel keys in memoryCache, each holding
  // its provider's full entry array. Nothing ever dropped them, so a long
  // channel-surfing session kept every set it had ever seen in memory. Cap it
  // LRU-style with room for the three globals plus a handful of channels.
  const MEMORY_CACHE_MAX = 24;

  function memoryCacheTouch(key, record) {
    memoryCache.delete(key);
    memoryCache.set(key, record);
    if (memoryCache.size > MEMORY_CACHE_MAX) {
      memoryCache.delete(memoryCache.keys().next().value); // oldest use first
    }
  }

  let channelSlug = null;
  let chatObserver = null;
  let inputObserver = null;
  let initSeq = 0;
  let emoteVersion = 0;
  let visibleRefreshTimer = null;
  let pickerInjectTimer = null;
  let pickerDeferredRefreshTimer = null;
  let messageProcessQueue = [];
  let messageProcessQueued = false;
  let lastNavigationAt = 0;
  let lastPath = location.pathname;

  let acDropdown = null;
  let acFocusIdx = -1;
  let acMatches = [];
  let acInput = null;
  let tipEl = null;
  let tipAnchor = null; // element the open tooltip is positioned against

  // Tracks the picker content currently holding viewport scroll + window resize
  // listeners. Lets handleNavigation force-detach even if Kick already removed
  // the picker panel from the DOM.
  let activePickerImageLoader = null;

  // Currently-attached autocomplete input. Lets the input observer skip work
  // while the input is still connected, and re-attach when Kick swaps it out.
  let attachedAcInput = null;

  // ─── Styles ───────────────────────────────────────────────────────────────

  const _style = document.createElement('style');
  _style.textContent = `
    /* Emote base wrapper */
    .kte-wrap {
      display: inline-block;
      position: relative;
      vertical-align: middle;
    }
    .kte-img {
      height: 28px;
      width: auto;
      max-width: 112px;
      vertical-align: middle;
      display: block;
      cursor: default;
    }

    /* Zero-width overlay: sits centred on top of the base emote */
    .kte-zw {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      height: 28px;
      width: auto;
      pointer-events: none;
    }

    #kte-tip {
      display: none;
      position: fixed;
      transform: translateX(-50%);
      background: #101013;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1;
      padding: 7px 11px 7px 13px;
      border-radius: 8px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 9999;
      border: 1px solid rgba(255,255,255,.1);
      border-left: 3px solid #22c55e;
      box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      backdrop-filter: blur(8px);
      flex-direction: column;
      align-items: center;
      gap: 7px;
    }
    .kte-tip-preview {
      height: 64px;
      min-width: 64px;
      max-width: 168px;
      width: auto;
      object-fit: contain;
      display: block;
    }
    .kte-tip-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Autocomplete popup */
    #kte-ac {
      position: fixed;
      background: #101013;
      border: 1px solid rgba(255,255,255,.1);
      border-top: 2px solid #22c55e;
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.06);
      backdrop-filter: blur(12px);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      z-index: 99999;
      min-width: min(230px, calc(100vw - 16px));
      max-width: min(320px, calc(100vw - 16px));
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    #kte-ac-header {
      font-size: 10px;
      font-weight: 700;
      color: #22c55e;
      padding: 8px 12px 4px;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .kte-ac-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      transition: background .08s;
    }
    .kte-ac-row:hover,
    .kte-ac-row.kte-focused { background: rgba(34,197,94,.1); }
    .kte-ac-row img {
      height: 26px;
      width: 40px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .kte-ac-code {
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kte-ac-src {
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
      opacity: .85;
    }
    .kte-ac-fav {
      font-size: 10px;
      line-height: 1;
      flex-shrink: 0;
    }
    .kte-src-7tv  { color: #4da6ff; }
    .kte-src-bttv { color: #ff6b6b; }
    .kte-src-ffz  { color: #c084fc; }
    .kte-src-other { color: #22c55e; }

    .kte-tip-star,
    .kte-picker-btn[data-kte-fav="1"]::after,
    .kte-ac-fav {
      color: #facc15;
    }
    .kte-tip-code {
      color: #fff;
    }
    .kte-tip-sep {
      color: rgba(255,255,255,.25);
      font-weight: 600;
    }
    .kte-tip-source {
      font-size: 10px;
      font-weight: 700;
      opacity: .85;
    }
    #kte-ac-footer {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,.25);
      padding: 4px 12px 7px;
      border-top: 1px solid rgba(255,255,255,.08);
    }

    /* Emote context menu */
    #kte-menu {
      position: fixed;
      z-index: 99999;
      min-width: 160px;
      background: #101013;
      border: 1px solid rgba(255,255,255,.1);
      border-left: 3px solid #22c55e;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      backdrop-filter: blur(8px);
      overflow: hidden;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      padding: 4px 0;
    }
    .kte-menu-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px 5px;
      margin-bottom: 3px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    }
    .kte-menu-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      color: #fff;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 7px 12px;
      cursor: pointer;
      transition: background .08s;
    }
    .kte-menu-item:hover,
    .kte-menu-item:focus-visible {
      background: rgba(34,197,94,.1);
      outline: none;
    }

    /* Native emote picker tab content */
    #kte-picker-content {
      height: 15rem;
      padding: 8px 10px 8px 20px;
      margin-right: 10px;
      color: #efeff1;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      box-sizing: border-box;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    #kte-picker-content[hidden] { display: none !important; }
    .kte-picker-provider {
      display: block;
      /* Kick's text-xs leaves no room above the caps, so the row's bottom edge
         crops the header when it sits right under it. */
      line-height: 1.5;
      padding-top: 2px;
    }
    .kte-picker-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .kte-picker-btn {
      position: relative;
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      border: 0;
      border-radius: 4px;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: transparent;
      contain: layout style paint;
      content-visibility: auto;
      contain-intrinsic-size: 38px 38px;
    }
    .kte-picker-btn:hover,
    .kte-picker-btn:focus-visible {
      background: rgba(255,255,255,.1);
      outline: none;
    }
    .kte-picker-btn img {
      max-width: 32px;
      max-height: 32px;
      width: auto;
      height: auto;
      object-fit: contain;
      pointer-events: none;
    }
    .kte-picker-btn img[data-kte-src] {
      width: 32px;
      height: 32px;
      object-fit: contain;
      visibility: hidden;
    }
    .kte-picker-btn img[data-kte-loaded="1"] {
      visibility: visible;
    }
    .kte-picker-btn[data-kte-fav="1"]::after {
      content: '★';
      position: absolute;
      top: 1px;
      right: 2px;
      font-size: 9px;
      line-height: 1;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,.9);
    }
    /* Kick sizes the tab strip to fit exactly the tabs it ships with, so our
       extra one tips its scroller (overflow-x: auto) into scrolling and it
       paints a horizontal scrollbar directly under the icons — which reads as
       a line under the native tabs that stops short of ours. Tighten the row
       instead of overflowing it: a slightly smaller gap, and tabs allowed to
       give up a few pixels down to a floor that still holds their 28px icon.
       With enough native tabs it will scroll anyway, exactly as Kick's own
       does — this only buys back the width our one tab costs. */
    div:has(> #kte-picker-tab) {
      gap: 6px;
    }
    div:has(> #kte-picker-tab) > button {
      flex-shrink: 1;
      min-width: 32px;
    }
    /* Zero-height marker at the very top of the tab. While it is in view the
       tab is scrolled to the top; once it scrolls out, the settings row hides. */
    .kte-settings-sentinel {
      height: 1px;
      margin-bottom: -1px;
    }
    /* Settings row at the top of the picker tab */
    .kte-picker-settings {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      /* A rounded card rather than a full-bleed bar. It auto-hides once the grid
         scrolls, so it no longer needs the negative margin that made it cover
         #kte-picker-content's top padding. The bottom margin keeps the first
         section header clear of it. */
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px;
      background: rgba(16,16,19,.92);
      backdrop-filter: blur(8px);
      transition: opacity .12s ease, transform .12s ease;
    }
    /* Out of the way while the grid is scrolled, so it never sits on emotes. */
    .kte-picker-settings[data-kte-hidden="1"] {
      opacity: 0;
      transform: translateY(-100%);
      pointer-events: none;
    }
    .kte-chip {
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 999px;
      background: transparent;
      color: rgba(255,255,255,.25);
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      padding: 5px 9px;
      cursor: pointer;
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .kte-chip:hover,
    .kte-chip:focus-visible {
      background: rgba(255,255,255,.06);
      outline: none;
    }
    .kte-chip[data-on="1"] {
      background: rgba(34,197,94,.14);
      border-color: rgba(34,197,94,.5);
      color: #4ade80;
    }
    .kte-chip[data-on="1"]:hover,
    .kte-chip[data-on="1"]:focus-visible {
      background: rgba(34,197,94,.18);
      border-color: rgba(34,197,94,.6);
    }
    /* An enabled provider chip wears its own brand colour, for the same reason
       the source badges do — telling providers apart at a glance is the point. */
    .kte-chip[data-on="1"][data-provider="7TV"] {
      background: rgba(77,166,255,.14); border-color: rgba(77,166,255,.5); color: #4da6ff;
    }
    .kte-chip[data-on="1"][data-provider="7TV"]:hover {
      background: rgba(77,166,255,.2); border-color: rgba(77,166,255,.6);
    }
    .kte-chip[data-on="1"][data-provider="BTTV"] {
      background: rgba(255,107,107,.14); border-color: rgba(255,107,107,.5); color: #ff6b6b;
    }
    .kte-chip[data-on="1"][data-provider="BTTV"]:hover {
      background: rgba(255,107,107,.2); border-color: rgba(255,107,107,.6);
    }
    .kte-chip[data-on="1"][data-provider="FFZ"] {
      background: rgba(192,132,252,.14); border-color: rgba(192,132,252,.5); color: #c084fc;
    }
    .kte-chip[data-on="1"][data-provider="FFZ"]:hover {
      background: rgba(192,132,252,.2); border-color: rgba(192,132,252,.6);
    }
    .kte-picker-empty {
      color: #71717a;
      font-size: 12px;
      text-align: center;
      padding: 18px 8px;
      margin: 0;
    }
    .kte-picker-limit {
      color: #71717a;
      font-size: 11px;
      margin: 0;
    }
    .kte-picker-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin: 4px 0 2px;
    }
    .kte-picker-more {
      width: fit-content;
      border: 1px solid rgba(34,197,94,.5);
      border-radius: 6px;
      background: rgba(34,197,94,.14);
      color: #4ade80;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 7px 12px;
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .kte-picker-more::before {
      content: '';
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background:
        linear-gradient(#101013, #101013) center / 9px 2px no-repeat,
        linear-gradient(#101013, #101013) center / 2px 9px no-repeat,
        #22c55e;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .kte-picker-more:hover,
    .kte-picker-more:focus-visible {
      background: rgba(34,197,94,.18);
      border-color: rgba(34,197,94,.6);
      color: #4ade80;
      outline: none;
    }
    .kte-picker-more:disabled {
      cursor: progress;
      opacity: .68;
    }
  `;
  (document.head ?? document.documentElement).appendChild(_style);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // Reject URLs that aren't https: or don't come from a known emote CDN.
  // Prevents a compromised provider API from loading arbitrary tracking pixels.
  function safeUrl(url) {
    try {
      const { protocol, hostname } = new URL(url);
      return protocol === 'https:' && ALLOWED_CDN_HOSTS.has(hostname) ? url : '';
    } catch { return ''; }
  }

  function RIC(cb) {
    return typeof requestIdleCallback === 'function'
      ? requestIdleCallback(cb, { timeout: 300 })
      : setTimeout(cb, 16);
  }

  function sourceName(source) {
    return (source ?? '').split(' ')[0] || 'Other';
  }

  function sourceClass(source) {
    const name = sourceName(source);
    return { '7TV': 'kte-src-7tv', BTTV: 'kte-src-bttv', FFZ: 'kte-src-ffz' }[name] ?? 'kte-src-other';
  }

  function setEmoteTooltip(el, code, source, url) {
    el.dataset.kteTip = `${code}  ·  ${source}`;
    el.dataset.kteTipCode = code;
    el.dataset.kteTipSource = source;
    // kteTipCode picks up " + <code>" suffixes as zero-width emotes stack on
    // this wrap; kteTipBase stays the single code the star state belongs to.
    el.dataset.kteTipBase = code;
    if (url) el.dataset.kteTipUrl = url;
  }

  function preconnectEmoteHosts() {
    const origins = [
      BTTV_API,
      BTTV_CDN,
      SEVENTV_API,
      'https://cdn.7tv.app',
      FFZ_API,
      'https://cdn.frankerfacez.com',
    ].map(url => new URL(url).origin);

    const existing = new Set(
      [...document.querySelectorAll('link[rel="preconnect"]')].map(link => link.href.replace(/\/$/, '')),
    );

    for (const origin of origins) {
      if (existing.has(origin)) continue;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      (document.head ?? document.documentElement).appendChild(link);
      existing.add(origin);
    }
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  const FETCH_TIMEOUT = 15000;

  // Errors carry the HTTP status so a 404 can be told apart from a failure.
  function httpError(status) {
    const err = new Error(`HTTP ${status}`);
    err.status = status;
    return err;
  }

  function fetchJSON(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'application/json' },
        // Without this a hung provider request never settles, which blocks the
        // failed-provider retry pass in init() forever.
        timeout: FETCH_TIMEOUT,
        ontimeout: () => reject(new Error('timeout')),
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            try { resolve(JSON.parse(res.responseText)); }
            catch (e) { reject(e); }
          } else {
            reject(httpError(res.status));
          }
        },
        onerror: reject,
      });
    });
  }

  // A 404 is the provider answering "no such user/room": the channel really has
  // no emotes there, and an empty set is safe to cache. Anything else — timeout,
  // 5xx, rate limit — still throws. Swallowing those used to cache an outage as
  // an empty set for 15 minutes, and a failed background refresh would replace
  // a good cached set with nothing mid-session.
  async function fetchJSONOrNull(url) {
    try { return await fetchJSON(url); }
    catch (e) {
      if (e?.status === 404) return null;
      throw e;
    }
  }

  // Kick's own API, fetched same-origin the way Kick's frontend does. Same 404
  // contract as fetchJSONOrNull.
  async function fetchKickJSONOrNull(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(`${location.origin}${path}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw httpError(res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Cache-aware load helper ──────────────────────────────────────────────

  function cacheTtlFor(key, data) {
    if (!data.length) return EMPTY_CACHE_TTL;
    return key.endsWith('_g') ? GLOBAL_CACHE_TTL : CHANNEL_CACHE_TTL;
  }

  function cachedRecord(key) {
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key);
      memoryCacheTouch(key, cached); // re-mark as most recently used
      return cached;
    }

    const record = Cache.read(key);
    if (record) memoryCacheTouch(key, record);
    return record;
  }

  function isFreshCacheRecord(key, record) {
    return Date.now() - record.ts <= cacheTtlFor(key, record.data);
  }

  function sameEmoteEntry(a, b) {
    return a?.[0] === b?.[0]
      && a?.[1]?.url === b?.[1]?.url
      && a?.[1]?.staticUrl === b?.[1]?.staticUrl
      && a?.[1]?.source === b?.[1]?.source
      && Boolean(a?.[1]?.animated) === Boolean(b?.[1]?.animated)
      && Boolean(a?.[1]?.zeroWidth) === Boolean(b?.[1]?.zeroWidth);
  }

  function sameEmoteEntries(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!sameEmoteEntry(a[i], b[i])) return false;
    }
    return true;
  }

  function fetchAndCache(key, fetcher) {
    if (pendingLoads.has(key)) return pendingLoads.get(key);

    const pending = Promise.resolve()
      .then(fetcher)
      .then(entries => {
        const safeEntries = Array.isArray(entries) ? entries.filter(isValidCacheEntry) : [];
        const record = { ts: Date.now(), data: safeEntries };
        memoryCacheTouch(key, record);
        RIC(() => Cache.set(key, safeEntries));
        return safeEntries;
      })
      .finally(() => {
        pendingLoads.delete(key);
      });

    pendingLoads.set(key, pending);
    return pending;
  }

  // `fetcher` must return an array of [code, emoteObj] pairs.
  async function cachedLoad(key, fetcher, options = {}) {
    const record = cachedRecord(key);

    if (record) {
      if (!isFreshCacheRecord(key, record) && options.revalidate !== false) {
        const cachedData = record.data;
        fetchAndCache(key, fetcher).then(entries => {
          if (typeof options.onRefresh === 'function' && !sameEmoteEntries(cachedData, entries)) {
            options.onRefresh(entries, cachedData, key);
          }
        }).catch(() => {
          // Keep serving stale cache when a background refresh fails.
        });
      }
      return record.data;
    }

    return fetchAndCache(key, fetcher);
  }

  // Provider layers for the current channel, kept at module scope so a settings
  // change can rebuild emoteMap without re-running init() — which would tear the
  // picker down under the user while they click a chip inside it.
  let loadedProviders = new Map(); // loader key → validated entries
  let activeLoaders = [];          // loader descriptors for the current channel

  // Channel emotes override globals; globals never overwrite an existing entry.
  // Resolution order is non-deterministic, so rebuild from the known layers
  // whenever a provider updates or is toggled in settings.
  function rebuildEmoteMap() {
    emoteMap.clear();
    for (const loader of activeLoaders) {
      if (!providerEnabled(loader.provider)) continue;
      const entries = loadedProviders.get(loader.key);
      if (entries) mergeEmoteEntries(entries, loader.isChannel);
    }
  }

  function mergeEmoteEntries(entries, isChannel) {
    if (!Array.isArray(entries) || !entries.length) return 0;
    let added = 0;
    for (const [code, e] of entries) {
      if (isChannel || !emoteMap.has(code)) {
        emoteMap.set(code, e);
        added++;
      }
    }
    return added;
  }

  // ─── Channel lookup ───────────────────────────────────────────────────────
  // The URL slug is not a usable identity on its own. BTTV's user endpoint takes
  // a numeric platform ID, never a name, so a slug always 404s there. And a Kick
  // slug isn't always the username: newer accounts with an underscore get a
  // dash in the URL (`xqc_lobotomy` lives at /xqc-lobotomy), which no provider
  // knows them by. So the channel is resolved once through Kick's API and every
  // channel loader keys off that:
  //
  //   Kick user ID ───► 7TV user (via its Kick connection) ───► linked Twitch ID
  //   Kick username ──► FFZ room (as a Twitch login) ─────────► Twitch ID fallback
  //
  // The Twitch ID is what BTTV needs, and 7TV's fallback when Kick isn't linked.

  // Shares lookups between the three channel loaders, which all start at once.
  // Short-lived so a background revalidation hours later fetches afresh, and a
  // rejected lookup is dropped immediately so the retry pass refetches it.
  const CHANNEL_LOOKUP_TTL = 60 * 1000;
  const channelLookups = new Map(); // `${kind}:${slug}` → { ts, promise }

  function channelLookup(kind, slug, fn) {
    const now = Date.now();
    for (const [key, hit] of channelLookups) {
      if (now - hit.ts > CHANNEL_LOOKUP_TTL) channelLookups.delete(key);
    }
    const key = `${kind}:${slug}`;
    let hit = channelLookups.get(key);
    if (!hit) {
      hit = { ts: now, promise: fn() };
      channelLookups.set(key, hit);
      hit.promise.catch(() => {
        if (channelLookups.get(key) === hit) channelLookups.delete(key);
      });
    }
    return hit.promise;
  }

  function isNumericId(value) {
    return typeof value === 'string' && /^\d{1,20}$/.test(value);
  }

  // → { userId, username }, or null when Kick has no such channel. The one hard
  // dependency of every channel loader: without it there is nothing to look up.
  function kickChannel(slug) {
    return channelLookup('kick', slug, async () => {
      const data = await fetchKickJSONOrNull(`${KICK_CHANNEL_API}/${encodeURIComponent(slug)}`);
      if (!data) return null;
      const userId = String(data.user_id ?? '');
      const username = data.user?.username;
      if (!isNumericId(userId) || !isSafeTextToken(username, 64)) {
        throw new Error('unexpected Kick channel response');
      }
      return { userId, username };
    });
  }

  // The streamer's 7TV account, found through its Kick connection →
  // { emotes, twitchId }, or null when they haven't linked Kick on 7TV.
  function sevenTvKickUser(slug) {
    return channelLookup('7tv', slug, async () => {
      const kick = await kickChannel(slug);
      if (!kick) return null;
      const data = await fetchJSONOrNull(`${SEVENTV_API}/users/kick/${kick.userId}`);
      if (!data) return null;
      const twitch = Array.isArray(data.user?.connections)
        ? data.user.connections.find(c => c?.platform === 'TWITCH')
        : null;
      return {
        emotes: parse7TVEmotes(data.emote_set?.emotes),
        twitchId: isNumericId(twitch?.id) ? twitch.id : null,
      };
    });
  }

  // The Twitch account linked on 7TV, or null. A 7TV outage also reads as null
  // here, so it degrades BTTV and FFZ to the by-name lookup instead of failing
  // them too — one provider being down must not take the others with it.
  async function linkedTwitchId(slug) {
    try { return (await sevenTvKickUser(slug))?.twitchId ?? null; }
    catch { return null; }
  }

  // The channel's FFZ room. FFZ has no Kick support, so this is a Twitch room:
  // the one the streamer linked on 7TV when there is one, otherwise the Kick
  // username taken as a Twitch login.
  function ffzRoom(slug) {
    return channelLookup('ffz', slug, async () => {
      const kick = await kickChannel(slug);
      if (!kick) return null;
      const linked = await linkedTwitchId(slug);
      return fetchJSONOrNull(linked
        ? `${FFZ_API}/room/id/${linked}`
        : `${FFZ_API}/room/${encodeURIComponent(kick.username.toLowerCase())}`);
    });
  }

  // → the Twitch account's numeric ID as a string, or null.
  async function channelTwitchId(slug) {
    const linked = await linkedTwitchId(slug);
    if (linked) return linked;
    const id = String((await ffzRoom(slug))?.room?.twitch_id ?? '');
    return isNumericId(id) ? id : null;
  }

  // ─── Emote Loaders ────────────────────────────────────────────────────────

  function bttvEntries(emotes, source) {
    return (Array.isArray(emotes) ? emotes : []).map(e => [e?.code, {
      url: `${BTTV_CDN}/${e?.id}/2x${e?.animated ? '.gif' : ''}`,
      source,
      animated: Boolean(e?.animated),
      zeroWidth: BTTV_ZERO_WIDTH.has(e?.code),
    }]);
  }

  async function loadBTTVGlobal(options) {
    return cachedLoad('bttv_g', async () => {
      return bttvEntries(await fetchJSON(`${BTTV_API}/cached/emotes/global`), 'BTTV');
    }, options);
  }

  // Twitch only: BTTV has no Kick provider. `/cached/users/kick/<id>` answers
  // exactly like a made-up provider name does — 404 for every ID — so asking it
  // first would just add a request that always fails.
  async function loadBTTVChannel(slug, options) {
    return cachedLoad(`bttv_c_${slug}`, async () => {
      const twitchId = await channelTwitchId(slug);
      if (!twitchId) return [];
      const data = await fetchJSONOrNull(`${BTTV_API}/cached/users/twitch/${twitchId}`);
      const all = [...(data?.channelEmotes ?? []), ...(data?.sharedEmotes ?? [])];
      return bttvEntries(all, 'BTTV (twitch)');
    }, options);
  }

  // 7TV's v3 emote list, the same shape for the global set and a user's set:
  // each entry is an active emote whose `name` is the set's alias, wrapping the
  // emote itself in `data`.
  //
  // Zero-width is the active emote's flag, ActiveEmoteFlag.ZeroWidth = 1 << 0.
  // `data.flags & 256` is EmoteFlags.ZeroWidth — the emote's own default, which
  // a set can override — and is never set on the active emote, so testing
  // `flags & 256` there (as this used to) flagged nothing at all.
  function parse7TVEmotes(emotes) {
    const entries = [];
    for (const e of Array.isArray(emotes) ? emotes : []) {
      const host = e?.data?.host;
      const files = Array.isArray(host?.files) ? host.files : [];
      if (typeof host?.url !== 'string' || !files.length) continue;
      const animated = Boolean(e.data.animated);
      const named = name => files.find(f => f?.name === name);
      // Animated: prefer GIF (universally supported) over animated WebP.
      const file = animated
        ? (named('2x.gif') ?? files.find(f => f?.format === 'GIF') ?? named('2x.webp') ?? files[0])
        : (named('2x.webp') ?? named('2x.avif') ?? files[0]);
      if (typeof file?.name !== 'string') continue;
      const entry = {
        url: `https:${host.url}/${file.name}`,
        source: '7TV',
        animated,
        zeroWidth: ((e.flags ?? 0) & 1) !== 0,
      };
      // The frozen first frame isn't a file of its own in the list: each file
      // names its variant in `static_name`. The picker shows it until hover.
      const staticName = animated ? named('2x.webp')?.static_name : null;
      if (typeof staticName === 'string' && staticName !== file.name) {
        entry.staticUrl = `https:${host.url}/${staticName}`;
      }
      entries.push([e.name, entry]);
    }
    return entries;
  }

  async function load7TVGlobal(options) {
    return cachedLoad('7tv_g', async () => {
      const data = await fetchJSON(`${SEVENTV_API}/emote-sets/global`);
      return parse7TVEmotes(data?.emotes);
    }, options);
  }

  async function load7TVChannel(slug, options) {
    return cachedLoad(`7tv_c_${slug}`, async () => {
      const user = await sevenTvKickUser(slug);
      if (user) return user.emotes;
      // Kick isn't linked on 7TV — fall back to the channel's Twitch account.
      const twitchId = await channelTwitchId(slug);
      if (!twitchId) return [];
      const data = await fetchJSONOrNull(`${SEVENTV_API}/users/twitch/${twitchId}`);
      return parse7TVEmotes(data?.emote_set?.emotes);
    }, options);
  }

  // FFZ "modifier" entries (ffzSpin, ffzRainbow, ffzX, …) are effects applied
  // to the preceding emote, not emotes. They're over half of the global set
  // and render as meaningless 32px icons on their own.
  function ffzEntries(sets, source) {
    const entries = [];
    for (const set of Object.values(sets ?? {})) {
      for (const e of (set?.emoticons ?? [])) {
        if (e?.modifier) continue;
        const raw = e?.urls?.['2'] ?? e?.urls?.['1'];
        if (typeof raw !== 'string') continue;
        entries.push([e.name, {
          url: raw.startsWith('//') ? `https:${raw}` : raw,
          source,
          animated: false,
          zeroWidth: false,
        }]);
      }
    }
    return entries;
  }

  async function loadFFZGlobal(options) {
    return cachedLoad('ffz_g', async () => {
      const data = await fetchJSON(`${FFZ_API}/set/global`);
      return ffzEntries(data?.sets, 'FFZ');
    }, options);
  }

  async function loadFFZChannel(slug, options) {
    return cachedLoad(`ffz_c_${slug}`, async () => {
      const room = await ffzRoom(slug);
      return ffzEntries(room?.sets, 'FFZ (channel)');
    }, options);
  }

  // ─── DOM Processing ───────────────────────────────────────────────────────

  // Fullscreen API hides everything outside the fullscreen element's subtree,
  // so floating overlays must live inside it while it's active.
  function overlayParent() {
    return document.fullscreenElement ?? document.body;
  }

  function reparentOverlay(el) {
    if (!el) return;
    const parent = overlayParent();
    if (el.parentNode !== parent) parent.appendChild(el);
  }

  function hideTooltip() {
    if (tipEl) tipEl.style.display = 'none';
    tipAnchor = null;
  }

  function positionTooltip(wrap) {
    if (!tipEl || tipEl.style.display === 'none') return;
    // The anchor can vanish under a stationary cursor — chat's virtual list
    // recycles rows out from under it, and removing an element fires no
    // mouseleave — which would strand the tooltip until the next hover.
    if (!wrap.isConnected) { hideTooltip(); return; }
    const rect = wrap.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) { hideTooltip(); return; }
    const tipRect = tipEl.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + rect.width / 2, tipRect.width / 2 + 4), window.innerWidth - tipRect.width / 2 - 4);
    const top = Math.max(4, rect.top - tipRect.height - 5);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }

  function showTooltip(wrap) {
    const text = wrap.dataset.kteTip;
    if (!text) return;

    if (!tipEl) {
      tipEl = document.createElement('span');
      tipEl.id = 'kte-tip';
    }
    reparentOverlay(tipEl);

    tipEl.textContent = '';

    // Large preview above the label — the emote is already decoded from chat or
    // the picker, so this costs nothing beyond layout.
    const previewUrl = safeUrl(wrap.dataset.kteTipUrl ?? '');
    if (previewUrl) {
      const preview = document.createElement('img');
      preview.className = 'kte-tip-preview';
      preview.src = previewUrl;
      preview.alt = '';
      // CSS reserves the box, but the intrinsic width only lands on load —
      // re-anchor once it does so a cold image doesn't leave the tip off-centre.
      // isConnected gates the stale case: hovering another emote rebuilds the
      // tip's children, and this image's late load must not drag the tip back
      // to the emote it belonged to.
      preview.addEventListener('load', () => {
        if (preview.isConnected) positionTooltip(wrap);
      });
      // Drop the reserved box rather than show an empty frame on a dead URL.
      preview.addEventListener('error', () => {
        if (!preview.isConnected) return;
        preview.remove();
        positionTooltip(wrap);
      });
      tipEl.appendChild(preview);
    }

    const label = document.createElement('span');
    label.className = 'kte-tip-label';

    const code = wrap.dataset.kteTipCode;
    const source = wrap.dataset.kteTipSource;
    if (code && source) {
      if (favHas(wrap.dataset.kteTipBase ?? code)) {
        const starEl = document.createElement('span');
        starEl.className = 'kte-tip-star';
        starEl.textContent = '★';
        label.appendChild(starEl);
      }

      const codeEl = document.createElement('span');
      codeEl.className = 'kte-tip-code';
      codeEl.textContent = code;

      const sepEl = document.createElement('span');
      sepEl.className = 'kte-tip-sep';
      sepEl.textContent = '·';

      const sourceEl = document.createElement('span');
      sourceEl.className = `kte-tip-source ${sourceClass(source)}`;
      sourceEl.textContent = source;

      label.append(codeEl, sepEl, sourceEl);
    } else {
      label.textContent = text;
    }
    tipEl.appendChild(label);

    tipEl.style.display = 'inline-flex';
    tipAnchor = wrap;
    positionTooltip(wrap);
  }

  // #kte-tip is position:fixed, so chat scrolling past a hovered emote (or the
  // picker grid scrolling under the cursor) leaves the tooltip behind where the
  // emote used to be. Re-anchor on any scroll while one is open.
  function repositionTooltip() {
    if (tipAnchor) positionTooltip(tipAnchor);
  }
  document.addEventListener('scroll', repositionTooltip, { capture: true, passive: true });
  window.addEventListener('resize', repositionTooltip, { passive: true });

  // ─── Emote context menu ───────────────────────────────────────────────────

  let menuEl = null;

  function hideEmoteMenu() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    document.removeEventListener('mousedown', emoteMenuDismiss, true);
    document.removeEventListener('keydown', emoteMenuKeydown, true);
  }

  function emoteMenuDismiss(e) {
    if (!menuEl?.contains(e.target)) hideEmoteMenu();
  }

  function emoteMenuKeydown(e) {
    if (e.key === 'Escape') hideEmoteMenu();
  }

  // Derive the emote's public page from its (already allowlisted) CDN URL.
  function emotePageUrl(emote) {
    const url = safeUrl(emote.url);
    if (!url) return null;
    const { hostname, pathname } = new URL(url);
    let m;
    if (hostname === 'cdn.betterttv.net' && (m = pathname.match(/^\/emote\/([a-f0-9]+)\//i))) {
      return `https://betterttv.com/emotes/${m[1]}`;
    }
    if (hostname === 'cdn.7tv.app' && (m = pathname.match(/^\/emote\/([A-Za-z0-9]+)\//))) {
      return `https://7tv.app/emotes/${m[1]}`;
    }
    if (hostname === 'cdn.frankerfacez.com' && (m = pathname.match(/^\/emote\/(\d+)\//))) {
      return `https://www.frankerfacez.com/emoticon/${m[1]}`;
    }
    return null;
  }

  function copyText(text) {
    try { navigator.clipboard?.writeText(text)?.catch?.(() => {}); }
    catch { /* clipboard unavailable */ }
  }

  // A star changes three things at once: the picker's badge and Favourites
  // section, the autocomplete ranking, and the tooltip. Rebuild the picker even
  // when its tab is hidden — pickerRefreshContent preserves the hidden state,
  // and nothing else would rebuild it before the user switches back.
  function favToggleAndRefresh(code) {
    const added = favToggle(code);
    const panel = document.getElementById('chat-emotes-picker-panel');
    if (panel?.querySelector('#kte-picker-content')) {
      pickerRefreshContent(panel);
      pickerApplyActiveState(panel);
    }
    acRefreshOpen();
    return added;
  }

  function showEmoteMenu(x, y, code, emote) {
    hideEmoteMenu();

    const menu = document.createElement('div');
    menu.id = 'kte-menu';

    const header = document.createElement('div');
    header.className = 'kte-menu-header';
    const nameEl = document.createElement('span');
    nameEl.textContent = code;
    const srcEl = document.createElement('span');
    srcEl.className = `kte-ac-src ${sourceClass(emote.source)}`;
    srcEl.textContent = sourceName(emote.source);
    header.append(nameEl, srcEl);
    menu.appendChild(header);

    const addItem = (label, action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kte-menu-item';
      btn.textContent = label;
      btn.addEventListener('click', () => { action(); hideEmoteMenu(); });
      menu.appendChild(btn);
    };

    addItem(favHas(code) ? 'Remove from favourites' : 'Add to favourites', () => favToggleAndRefresh(code));
    addItem('Copy name', () => copyText(code));
    const imgUrl = safeUrl(emote.url);
    if (imgUrl) addItem('Copy image URL', () => copyText(imgUrl));
    const pageUrl = emotePageUrl(emote);
    if (pageUrl) addItem(`Open on ${sourceName(emote.source)}`, () => window.open(pageUrl, '_blank', 'noopener'));

    overlayParent().appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    menuEl = menu;

    document.addEventListener('mousedown', emoteMenuDismiss, true);
    document.addEventListener('keydown', emoteMenuKeydown, true);
  }

  function makeEmoteWrap(code, emote) {
    const wrap = document.createElement('span');
    wrap.className = 'kte-wrap';
    setEmoteTooltip(wrap, code, emote.source, emote.url);
    wrap.addEventListener('mouseenter', () => showTooltip(wrap));
    wrap.addEventListener('mouseleave', hideTooltip);
    wrap.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      showEmoteMenu(e.clientX, e.clientY, code, emote);
    });

    const url = safeUrl(emote.url);
    if (!url) return document.createTextNode(code);

    const img = document.createElement('img');
    img.src = url;
    img.alt = code;
    img.className = 'kte-img';
    img.addEventListener('error', () => {
      if (img._kteRetry) return;
      img._kteRetry = true;
      setTimeout(() => { img.src = url; }, 2000);
    });

    wrap.appendChild(img);
    return wrap;
  }

  function processTextNode(node) {
    const text = node.textContent;
    if (!text.trim()) return;

    const tokens = text.split(/(\s+)/);
    if (!tokens.some(t => emoteMap.has(t))) return;

    const frag = document.createDocumentFragment();
    let lastWrap = null; // anchor for zero-width overlays

    for (const token of tokens) {
      const emote = emoteMap.get(token);

      if (emote) {
        if (emote.zeroWidth && lastWrap) {
          // Overlay this image centred on the previous emote wrap.
          // The whitespace token that preceded the overlay is dropped: the
          // overlay is absolutely positioned, so that space renders as a stray
          // gap after the emote, and un-rendering the message (provider toggled
          // off) would leave it orphaned and grow the run by one space on every
          // render/un-render cycle.
          const prev = frag.lastChild;
          if (prev?.nodeType === Node.TEXT_NODE && !prev.textContent.trim()) frag.removeChild(prev);
          const zwUrl = safeUrl(emote.url);
          if (!zwUrl) {
            // Same fallback makeEmoteWrap uses for a rejected URL: show the code
            // as text rather than dropping the token out of the message.
            frag.appendChild(document.createTextNode(token));
            lastWrap = null;
            continue;
          }
          const zw = document.createElement('img');
          zw.src = zwUrl;
          zw.alt = token;
          zw.className = 'kte-zw';
          zw.addEventListener('error', () => {
            if (zw._kteRetry) return;
            zw._kteRetry = true;
            setTimeout(() => { zw.src = zwUrl; }, 2000);
          });
          lastWrap.appendChild(zw);
          lastWrap.dataset.kteTip += ` + ${token}`;
          lastWrap.dataset.kteTipCode += ` + ${token}`;
          // Keep lastWrap — multiple ZW emotes can stack on the same base
        } else {
          const wrap = makeEmoteWrap(token, emote);
          frag.appendChild(wrap);
          // makeEmoteWrap falls back to a bare text node when safeUrl rejects the
          // emote's URL. Only an element can anchor a zero-width overlay.
          lastWrap = wrap.nodeType === Node.ELEMENT_NODE ? wrap : null;
        }
      } else {
        frag.appendChild(document.createTextNode(token));
        // Whitespace between emotes keeps the ZW chain alive ("POGGERS cvHazmat")
        if (token.trim()) lastWrap = null;
      }
    }

    node.parentNode.replaceChild(frag, node);
  }

  function processMessageEl(el) {
    const version = String(emoteVersion);
    if (el.dataset.kteVersion === version) return;
    el.dataset.kteVersion = version;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        // closest, not tagName — Kick nests both link and username text in spans.
        if (p.classList.contains('kte-wrap') || p.closest(SKIP_TEXT_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
  }

  function processAllVisible() {
    const seq = initSeq;
    const nodes = [...document.querySelectorAll(MSG_SELECTOR)];
    let i = 0;

    function step() {
      if (seq !== initSeq) return;
      const end = Math.min(i + 25, nodes.length);
      for (; i < end; i++) {
        if (nodes[i].isConnected) processMessageEl(nodes[i]);
      }
      if (i < nodes.length) RIC(step);
    }

    RIC(step);
  }

  // Turning a provider off has to put its already-rendered emotes back to text:
  // processing only ever goes text → image, so nothing else would undo them. Each
  // img's alt is its emote code — including every zero-width overlay stacked on
  // the wrap — so the original tokens reconstruct exactly. Clearing the version
  // mark and normalizing makes the element eligible for a clean reprocess.
  function unrenderEmoteWraps() {
    for (const el of document.querySelectorAll(MSG_SELECTOR)) {
      const wraps = el.querySelectorAll('.kte-wrap');
      if (!wraps.length) continue;
      for (const wrap of wraps) {
        const codes = [...wrap.querySelectorAll('img')].map(img => img.alt).filter(Boolean);
        wrap.replaceWith(document.createTextNode(codes.join(' ')));
      }
      el.normalize();
      delete el.dataset.kteVersion;
    }
  }

  function applyProviderSettings() {
    rebuildEmoteMap();
    emoteVersion++;
    hideTooltip();
    unrenderEmoteWraps();
    queueVisibleEmoteRefresh(0);
    acRefreshOpen();
  }

  function queueVisibleEmoteRefresh(delay = 0) {
    if (visibleRefreshTimer) clearTimeout(visibleRefreshTimer);

    const seq = initSeq;
    visibleRefreshTimer = setTimeout(() => {
      visibleRefreshTimer = null;
      RIC(() => {
        if (seq !== initSeq) return;
        processAllVisible();
      });
    }, delay);
  }

  function processMessageTree(root) {
    if (root.matches?.(MSG_SELECTOR)) processMessageEl(root);
    root.querySelectorAll?.(MSG_SELECTOR).forEach(processMessageEl);
  }

  function queueProcessMessageTree(root) {
    if (!root?.isConnected) return;
    messageProcessQueue.push(root);
    if (messageProcessQueued) return;
    messageProcessQueued = true;

    const seq = initSeq;
    function drain() {
      if (seq !== initSeq) {
        messageProcessQueue = [];
        messageProcessQueued = false;
        return;
      }

      for (let i = 0; i < 20 && messageProcessQueue.length; i++) {
        const next = messageProcessQueue.shift();
        if (next?.isConnected) processMessageTree(next);
      }

      if (messageProcessQueue.length) RIC(drain);
      else messageProcessQueued = false;
    }

    RIC(drain);
  }

  function isOwnUINode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.id === 'kte-picker-content'
      || node.id === 'kte-ac'
      || node.id === 'kte-menu'
      || node.classList.contains('kte-wrap')
      || Boolean(node.closest?.('#kte-picker-content, #kte-ac, #kte-menu, .kte-wrap'));
  }

  // ─── Autocomplete ─────────────────────────────────────────────────────────

  function acFindInput() {
    for (const sel of INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function acWordBeforeCursor(inputEl) {
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      const before = inputEl.value.slice(0, inputEl.selectionStart ?? inputEl.value.length);
      return (before.match(/(\S+)$/) ?? [])[1] ?? '';
    }
    // contenteditable
    const sel = window.getSelection();
    if (!sel?.rangeCount) return '';
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';
    const before = node.textContent.slice(0, range.startOffset);
    return (before.match(/(\S+)$/) ?? [])[1] ?? '';
  }

  let acIndex = null;
  let acIndexVersion = -1;

  function acGetIndex() {
    if (acIndexVersion === emoteVersion && acIndex) return acIndex;
    acIndex = [];
    for (const [code, emote] of emoteMap) {
      acIndex.push({ code, lower: code.toLowerCase(), emote });
    }
    acIndex.sort((a, b) => a.code.length - b.code.length || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    acIndexVersion = emoteVersion;
    return acIndex;
  }

  const AC_RESULTS = 8;
  // Collect more candidates than displayed so usage ranking can promote a
  // frequently-used emote that index order (shortest name first) would drop.
  const AC_SCAN_CAP = 48;

  function acSearch(query) {
    if (query.length < 2) return [];
    const lower = query.toLowerCase();
    const index = acGetIndex();
    const prefix = [];
    const substr = [];
    for (const entry of index) {
      if (entry.lower.startsWith(lower)) {
        if (prefix.length < AC_SCAN_CAP) prefix.push(entry);
      } else if (substr.length < AC_SCAN_CAP && entry.lower.includes(lower)) {
        substr.push(entry);
      }
      if (prefix.length >= AC_SCAN_CAP && substr.length >= AC_SCAN_CAP) break;
    }
    // Favourites first, then most-used, within each group (stable sort keeps
    // the index order — shortest, then alphabetical — as tiebreak); prefix
    // matches always outrank substring matches.
    const byRank = (a, b) =>
      (Number(favHas(b.code)) - Number(favHas(a.code)))
      || (usageCount(b.code) - usageCount(a.code));
    prefix.sort(byRank);
    substr.sort(byRank);
    return prefix.concat(substr)
      .slice(0, AC_RESULTS)
      .map(entry => ({ code: entry.code, emote: entry.emote }));
  }

  function acHide() {
    acResizeObserver?.disconnect();
    window.removeEventListener('resize', acPosition);
    acDropdown?.remove();
    acDropdown = null;
    acFocusIdx = -1;
    acMatches = [];
    acInput = null;
  }

  let acResizeObserver = null;

  // (Re)position the open popup from the input's current rect: anchor to the
  // input's left edge, open upward, cap height to the space above the input,
  // and shift left if it would overflow the right viewport edge.
  function acPosition() {
    if (!acDropdown || !acInput?.isConnected) return;
    const rect = acInput.getBoundingClientRect();
    acDropdown.style.left = `${rect.left}px`;
    acDropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    acDropdown.style.maxHeight = `${Math.max(120, rect.top - 14)}px`;
    const overflow = acDropdown.getBoundingClientRect().right - (window.innerWidth - 8);
    if (overflow > 0) acDropdown.style.left = `${Math.max(8, rect.left - overflow)}px`;
  }

  // The chat pane can be resized without a window resize (dragging Kick's
  // divider), which moves the input under the fixed-position popup — track the
  // input's size too, not just the window.
  function acWatchReposition() {
    if (!acResizeObserver) acResizeObserver = new ResizeObserver(() => acPosition());
    acResizeObserver.observe(acInput);
    window.addEventListener('resize', acPosition, { passive: true });
  }

  function acRefreshOpen() {
    if (!acInput?.isConnected) return;
    const word = acWordBeforeCursor(acInput);
    const matches = acSearch(word);
    matches.length ? acRender(matches, acInput) : acHide();
  }

  function acSetFocus(idx) {
    acFocusIdx = idx;
    acDropdown?.querySelectorAll('.kte-ac-row').forEach((r, i) => {
      r.classList.toggle('kte-focused', i === acFocusIdx);
      if (i === acFocusIdx) r.scrollIntoView({ block: 'nearest' });
    });
  }

  function acCommit(code) {
    if (!acInput) return;
    acInput.focus();

    if (acInput.tagName === 'TEXTAREA' || acInput.tagName === 'INPUT') {
      const pos = acInput.selectionStart ?? acInput.value.length;
      const head = acInput.value.slice(0, pos).replace(/\S+$/, '');
      const tail = acInput.value.slice(pos);
      acInput.value = head + code + ' ' + tail;
      const newPos = head.length + code.length + 1;
      acInput.setSelectionRange(newPos, newPos);
      acInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable — execCommand keeps Vue/React reactivity intact
      const sel = window.getSelection();
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const offset = range.startOffset;
          const wordStart = node.textContent.slice(0, offset).search(/\S+$/);
          if (wordStart >= 0) {
            const wr = document.createRange();
            wr.setStart(node, wordStart);
            wr.setEnd(node, offset);
            sel.removeAllRanges();
            sel.addRange(wr);
          }
        }
      }
      document.execCommand('insertText', false, code + ' ');
    }

    usageBump(code);
    acHide();
  }

  function acRender(matches, inputEl) {
    acHide();
    // Filter before storing: acMatches indexes into the rendered rows, so a row
    // skipped further down would make arrow-key focus commit the wrong emote.
    matches = matches.filter(m => safeUrl(m.emote.url));
    if (!matches.length) return;
    acMatches = matches;
    acInput = inputEl;

    const popup = document.createElement('div');
    popup.id = 'kte-ac';
    // Keep the chat input focused when interacting with the popup — a scrollbar
    // drag would otherwise blur the input and close the popup mid-scroll.
    popup.addEventListener('mousedown', e => e.preventDefault());

    const header = document.createElement('div');
    header.id = 'kte-ac-header';
    header.textContent = 'Emotes';
    popup.appendChild(header);

    for (let i = 0; i < matches.length; i++) {
      const { code, emote } = matches[i];
      const row = document.createElement('div');
      row.className = 'kte-ac-row';

      const acUrl = safeUrl(emote.url);
      const img = document.createElement('img');
      img.src = acUrl;
      img.alt = code;
      img.addEventListener('error', () => {
        if (img._kteRetry) return;
        img._kteRetry = true;
        setTimeout(() => { img.src = acUrl; }, 2000);
      });

      const nameEl = document.createElement('span');
      nameEl.className = 'kte-ac-code';
      nameEl.textContent = code;

      const srcEl = document.createElement('span');
      const srcName = sourceName(emote.source);
      srcEl.className = `kte-ac-src ${sourceClass(emote.source)}`;
      srcEl.textContent = srcName;

      row.append(img, nameEl);
      if (favHas(code)) {
        const favEl = document.createElement('span');
        favEl.className = 'kte-ac-fav';
        favEl.textContent = '★';
        row.appendChild(favEl);
      }
      row.appendChild(srcEl);
      row.addEventListener('mousedown', e => { e.preventDefault(); acCommit(code); });
      popup.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.id = 'kte-ac-footer';
    footer.textContent = '↑↓ navigate  ·  Tab/Enter select  ·  Esc close';
    popup.appendChild(footer);

    overlayParent().appendChild(popup);
    acDropdown = popup;
    acPosition();
    acWatchReposition();
  }

  function acOnInput(e) {
    const word = acWordBeforeCursor(e.currentTarget);
    const matches = acSearch(word);
    matches.length ? acRender(matches, e.currentTarget) : acHide();
  }

  function acOnKeydown(e) {
    if (!acDropdown) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); acSetFocus(Math.min(acFocusIdx + 1, acMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); acSetFocus(Math.max(acFocusIdx - 1, 0)); }
    else if (e.key === 'Tab') {
      // No explicit focus → complete the top match (matches Twitch/7TV behaviour)
      const pick = acMatches[acFocusIdx >= 0 ? acFocusIdx : 0];
      if (pick) { e.preventDefault(); acCommit(pick.code); }
    }
    else if (e.key === 'Enter') {
      // An explicitly focused row means the user navigated to it — insert it
      // instead of sending. With no focus, let the message send, but close the
      // popup: Kick clears the Lexical editor programmatically, which fires no
      // input event, so the suggestions would hang around over an empty input.
      const pick = acFocusIdx >= 0 ? acMatches[acFocusIdx] : null;
      if (pick) { e.preventDefault(); acCommit(pick.code); }
      else acHide();
    }
    else if (e.key === 'Escape') { e.preventDefault(); acHide(); }
  }

  function attachAutocomplete(el) {
    if (el._kteAC) return;
    el._kteAC = true;
    el.addEventListener('input', acOnInput);
    el.addEventListener('keydown', acOnKeydown);
    // Lexical intercepts beforeinput for deletions so input doesn't always fire;
    // keyup is a reliable fallback for backspace/delete.
    el.addEventListener('keyup', e => {
      if (e.key === 'Backspace' || e.key === 'Delete') acOnInput(e);
    });
    el.addEventListener('blur', () => setTimeout(acHide, 150));
    log('Autocomplete attached');
  }

  function attemptAcAttach() {
    if (attachedAcInput?.isConnected) return;
    const found = acFindInput();
    if (!found) return;
    attachAutocomplete(found);
    attachedAcInput = found;
  }

  function waitForInput() {
    inputObserver?.disconnect();
    inputObserver = null;
    attachedAcInput = null;

    const el = acFindInput();
    if (el) {
      attachAutocomplete(el);
      attachedAcInput = el;
      return;
    }

    inputObserver = new MutationObserver(() => {
      const found = acFindInput();
      if (found) {
        inputObserver?.disconnect();
        inputObserver = null;
        attachAutocomplete(found);
        attachedAcInput = found;
      }
    });
    inputObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Emote Picker ─────────────────────────────────────────────────────────

  const PICKER_PROVIDER_LIMIT = 40;
  const PICKER_RECENT_LIMIT = 16;
  const PICKER_INJECT_DELAY = 120;
  const PICKER_ROUTE_INJECT_DELAY = 700;
  const PICKER_APPEND_REFRESH_DELAY = 260;
  const PICKER_ACTIVE_PROVIDER_DEFER_WINDOW = 15000;
  const PICKER_DEFERRED_RETRY_DELAY = 2000;
  const ROUTE_CHAT_REFRESH_DELAY = 500;
  const PICKER_APPEND_CHUNK = 10;
  const PICKER_APPEND_DELAY = 24;
  const PICKER_IMAGE_LOAD_CHUNK = 4;
  const PICKER_IMAGE_LOAD_DELAY = 60;
  const PICKER_IMAGE_UNLOAD_DELAY = 250;
  const PICKER_IMAGE_VIEWPORT_BUFFER = 180;
  const PICKER_IMAGE_UNLOAD_BUFFER = 200;
  // Hard cap on simultaneously loaded picker images. Even within the unload
  // zone, anything past this count gets evicted (furthest from viewport first).
  // Has to be tight because in fullscreen the video player is already holding
  // a large GPU texture, so we share what's left with very little headroom.
  const PICKER_MAX_LOADED = 40;

  function pickerBuildButton(code, emote) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kte-picker-btn';
    btn.setAttribute('aria-label', `Insert ${code}`);
    btn.dataset.code = code;
    setEmoteTooltip(btn, code, emote.source, emote.url);
    if (favHas(code)) btn.dataset.kteFav = '1';

    const animUrl = safeUrl(emote.url);
    const staticUrl = emote.staticUrl ? safeUrl(emote.staticUrl) : null;
    const defaultUrl = staticUrl ?? animUrl;
    if (!defaultUrl) return null;
    const img = document.createElement('img');
    img.alt = code;
    img.draggable = false;
    img.decoding = 'async';
    img.setAttribute('fetchpriority', 'low');
    img.dataset.kteSrc = defaultUrl;
    // Static-by-default + animate-on-hover: only set kteAnimSrc when the static
    // and animated URLs actually differ (i.e. the provider serves a separate
    // frozen frame). Without that, the emote either is naturally static or has
    // no static variant available, so we just show whatever the default is.
    if (staticUrl && animUrl && staticUrl !== animUrl) {
      img.dataset.kteAnimSrc = animUrl;
    }
    img.addEventListener('error', () => {
      if (img._kteRetry) return;
      img._kteRetry = true;
      setTimeout(() => {
        const retryUrl = safeUrl(img.dataset.kteSrc ?? '');
        if (retryUrl && img.dataset.kteLoaded === '1') img.src = retryUrl;
      }, 2000);
    });
    btn.appendChild(img);

    return btn;
  }

  function pickerHoverAnimate(btn, hover) {
    const img = btn.querySelector('img');
    if (!img?.dataset.kteAnimSrc || img.dataset.kteLoaded !== '1') return;
    if (hover) {
      const animUrl = safeUrl(img.dataset.kteAnimSrc);
      if (animUrl) img.src = animUrl;
    } else {
      const baseUrl = safeUrl(img.dataset.kteSrc ?? '');
      if (baseUrl) img.src = baseUrl;
    }
  }

  function pickerLoadImage(img) {
    if (img.dataset.kteLoaded === '1') return;
    const url = safeUrl(img.dataset.kteSrc ?? '');
    if (!url) return;
    img.dataset.kteLoaded = '1';
    img.src = url;
  }

  function pickerPumpImageQueue(content) {
    if (!content || content._kteImageLoading || !content._kteImageQueue?.length) return;
    content._kteImageLoading = true;

    function step() {
      content._kteImagePumpTimer = null;
      if (!content.isConnected || content.dataset.kteStale === '1') {
        content._kteImageQueue = [];
        content._kteImageLoading = false;
        return;
      }
      if (content.hidden) {
        content._kteImageLoading = false;
        return;
      }

      const batch = content._kteImageQueue.splice(0, PICKER_IMAGE_LOAD_CHUNK);
      batch.forEach(pickerLoadImage);

      if (content._kteImageQueue.length) {
        content._kteImagePumpTimer = setTimeout(step, PICKER_IMAGE_LOAD_DELAY);
      } else {
        content._kteImageLoading = false;
        // Initial IO callback can queue more than the hard cap. The scroll-based
        // unload pass only fires on scroll, so run cap enforcement once after
        // the pump drains to bound memory even when the user never scrolls.
        if (content._kteImageScrollTarget) {
          pickerEvictFarOrCapped(content, content._kteImageScrollTarget);
        }
      }
    }

    requestAnimationFrame(step);
  }

  function pickerFindImageViewport(content) {
    const panel = content?.closest?.('#chat-emotes-picker-panel');
    let el = content?.parentElement;
    while (el && el !== panel) {
      const className = typeof el.className === 'string' ? el.className : '';
      const overflowY = getComputedStyle(el).overflowY;
      if (className.includes('overflow-y-auto') || className.includes('overflow-y-scroll') || /auto|scroll/.test(overflowY)) {
        return el;
      }
      el = el.parentElement;
    }
    return panel ?? content;
  }

  function pickerActiveImageViewport(content, fallback) {
    if (!content) return fallback;
    return content.scrollHeight > content.clientHeight + 1
      ? content
      : (fallback ?? pickerFindImageViewport(content));
  }

  function pickerUnloadImg(img) {
    img.removeAttribute('src');
    delete img.dataset.kteLoaded;
    delete img.dataset.kteQueued;
    delete img._kteRetry;
  }

  function pickerEvictFarOrCapped(content, viewport) {
    if (!content || content.hidden) return;
    const viewportRect = viewport?.getBoundingClientRect?.() ?? { top: 0, bottom: window.innerHeight };
    const unloadTop = viewportRect.top - PICKER_IMAGE_UNLOAD_BUFFER;
    const unloadBottom = viewportRect.bottom + PICKER_IMAGE_UNLOAD_BUFFER;
    const center = (viewportRect.top + viewportRect.bottom) / 2;
    const survivors = [];
    content.querySelectorAll('img[data-kte-loaded="1"]').forEach(img => {
      const rect = (img.parentElement ?? img).getBoundingClientRect();
      if (rect.bottom < unloadTop || rect.top > unloadBottom) {
        pickerUnloadImg(img);
        return;
      }
      survivors.push({ img, dist: Math.abs((rect.top + rect.bottom) / 2 - center) });
    });
    if (survivors.length > PICKER_MAX_LOADED) {
      survivors.sort((a, b) => b.dist - a.dist);
      for (let i = 0; i < survivors.length - PICKER_MAX_LOADED; i++) {
        pickerUnloadImg(survivors[i].img);
      }
    }
  }

  function pickerObserveButton(content, btn) {
    if (!content?._kteLoadObserver) return;
    const img = btn.querySelector('img');
    if (!img || img._kteObserved) return;
    img._kteObserved = true;
    content._kteLoadObserver.observe(img);
  }

  function pickerDetachImageLoader(content) {
    if (!content) return;
    if (content._kteImageScrollTarget && content._kteImageScrollHandler) {
      content._kteImageScrollTarget.removeEventListener('scroll', content._kteImageScrollHandler);
      window.removeEventListener('resize', content._kteImageScrollHandler);
    }
    content._kteLoadObserver?.disconnect();
    content._kteLoadObserver = null;
    if (content._kteImageUnloadTimer) clearTimeout(content._kteImageUnloadTimer);
    if (content._kteImagePumpTimer) clearTimeout(content._kteImagePumpTimer);
    if (content._kteImageScrollTarget && content._kteScrollContainValue !== undefined) {
      content._kteImageScrollTarget.style.overscrollBehavior = content._kteScrollContainValue;
    }
    content._kteImageScrollTarget = null;
    content._kteImageScrollHandler = null;
    content._kteImageUnloadTimer = null;
    content._kteImagePumpTimer = null;
    content._kteImageViewportFallback = null;
    content._kteScrollContainValue = undefined;
    content._kteImageLoading = false;
    if (activePickerImageLoader === content) activePickerImageLoader = null;
  }

  function pickerAttachImageLoader(content, viewport = pickerFindImageViewport(content)) {
    if (!content) return;
    content._kteImageViewportFallback = viewport;
    viewport = pickerActiveImageViewport(content, viewport);
    if (!viewport) return;

    if (content._kteImageScrollTarget === viewport && content._kteImageScrollHandler) {
      // Same viewport — IntersectionObserver is already wired up. Just observe
      // any imgs added since attach (e.g. Load more chunks).
      if (content._kteLoadObserver) {
        content.querySelectorAll('.kte-picker-btn img[data-kte-src]').forEach(img => {
          if (img._kteObserved) return;
          img._kteObserved = true;
          content._kteLoadObserver.observe(img);
        });
      }
      return;
    }

    pickerDetachImageLoader(content);
    content._kteImageViewportFallback = viewport === content ? pickerFindImageViewport(content) : viewport;
    content._kteScrollContainValue = viewport.style.overscrollBehavior;
    viewport.style.overscrollBehavior = 'contain';

    // IntersectionObserver tracks visible buttons natively — no per-scroll DOM
    // walk. The browser only fires our callback for buttons whose visibility
    // actually changed, so scrolling a fully-expanded "Load all" grid stays
    // O(1) in our code regardless of total button count.
    if (!content._kteImageQueue) content._kteImageQueue = [];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const img = entry.target;
        if (!img.dataset.kteSrc) continue;
        if (entry.isIntersecting) {
          if (img.dataset.kteLoaded === '1' || img.dataset.kteQueued === '1') continue;
          img.dataset.kteQueued = '1';
          content._kteImageQueue.push(img);
        } else if (img.dataset.kteQueued === '1') {
          delete img.dataset.kteQueued;
          const idx = content._kteImageQueue.indexOf(img);
          if (idx >= 0) content._kteImageQueue.splice(idx, 1);
        }
      }
      pickerPumpImageQueue(content);
    }, { root: viewport, rootMargin: `${PICKER_IMAGE_VIEWPORT_BUFFER}px` });
    content._kteLoadObserver = observer;
    content.querySelectorAll('.kte-picker-btn img[data-kte-src]').forEach(img => {
      img._kteObserved = true;
      observer.observe(img);
    });

    // Unload throttle: periodically evict far-from-viewport images and enforce
    // the hard cap. Runs at most once per PICKER_IMAGE_UNLOAD_DELAY during
    // scroll. The actual visibility-tracking is the IO above; this just bounds
    // memory.
    const schedule = () => {
      if (content._kteImageUnloadTimer) return;
      content._kteImageUnloadTimer = setTimeout(() => {
        content._kteImageUnloadTimer = null;
        pickerEvictFarOrCapped(content, viewport);
      }, PICKER_IMAGE_UNLOAD_DELAY);
    };

    content._kteImageScrollTarget = viewport;
    content._kteImageScrollHandler = schedule;
    viewport.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    if (activePickerImageLoader && activePickerImageLoader !== content) {
      pickerDetachImageLoader(activePickerImageLoader);
    }
    activePickerImageLoader = content;
  }

  function pickerAppendButtons(grid, emotes, start, end) {
    const frag = document.createDocumentFragment();
    const newButtons = [];
    for (let i = start; i < end; i++) {
      const { code, emote } = emotes[i];
      const btn = pickerBuildButton(code, emote);
      if (btn) {
        frag.appendChild(btn);
        newButtons.push(btn);
      }
    }
    grid.appendChild(frag);
    const content = grid.closest('#kte-picker-content');
    if (content?._kteLoadObserver) {
      for (const btn of newButtons) pickerObserveButton(content, btn);
    }
  }

  function pickerAppendButtonsChunked(grid, emotes, start, end, onChunk, onDone) {
    let index = start;

    function step() {
      if (!grid.isConnected) {
        onDone?.();
        return;
      }
      const next = Math.min(index + PICKER_APPEND_CHUNK, end);
      pickerAppendButtons(grid, emotes, index, next);
      index = next;
      onChunk?.(index);

      if (index < end) {
        setTimeout(() => RIC(step), PICKER_APPEND_DELAY);
      } else {
        onDone?.();
      }
    }

    RIC(step);
  }

  function pickerMarkContentStale(content) {
    if (content) {
      pickerDetachImageLoader(content);
      pickerDetachSettingsAutoHide(content);
      content.querySelectorAll('img[data-kte-loaded="1"]').forEach(img => {
        img.removeAttribute('src');
        delete img.dataset.kteLoaded;
        delete img.dataset.kteQueued;
        delete img._kteRetry;
      });
      content.dataset.kteStale = '1';
      content._kteImageQueue = [];
      content._kteImageLoading = false;
      content._kteAppendingMore = false;
      content._kteRefreshAfterAppend = false;
      content._kteDeferredProviderRefresh = false;
    }
  }

  function pickerBuildLoadMore(grid, emotes, shown, limitEl) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'kte-picker-more';
    more.textContent = 'Load more';
    more.setAttribute('aria-label', 'Load more emotes');

    more.addEventListener('mousedown', e => e.preventDefault());
    more.addEventListener('click', () => {
      const next = Math.min(shown + PICKER_PROVIDER_LIMIT, emotes.length);
      more.disabled = true;
      more.textContent = 'Loading...';
      const content = grid.closest('#kte-picker-content');
      if (content) content._kteAppendingMore = true;

      pickerAppendButtonsChunked(grid, emotes, shown, next, current => {
        shown = current;
        limitEl.textContent = `Showing ${shown} of ${emotes.length}`;
        pickerAttachImageLoader(content, content?._kteImageViewportFallback ?? content?._kteImageScrollTarget);
      }, () => {
        if (content) {
          content._kteAppendingMore = false;
          if (content._kteRefreshAfterAppend) {
            content._kteRefreshAfterAppend = false;
            const panel = content.closest('#chat-emotes-picker-panel');
            if (panel) queuePickerInject(panel, PICKER_APPEND_REFRESH_DELAY);
          }
        }
        if (!more.isConnected) return;
        if (shown >= emotes.length) {
          more.remove();
        } else {
          more.disabled = false;
          more.textContent = 'Load more';
        }
      });
    });

    return more;
  }

  function pickerInsert(code) {
    const el = acFindInput();
    if (!el) return;
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const pos = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, pos);
      const after = el.value.slice(pos);
      const gap = before && !before.endsWith(' ') ? ' ' : '';
      const insert = gap + code + ' ';
      el.value = before + insert + after;
      const newPos = before.length + insert.length;
      el.setSelectionRange(newPos, newPos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const sel = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      const before = range?.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.textContent.slice(0, range.startOffset)
        : '';
      const gap = before && !/\s$/.test(before) ? ' ' : '';
      document.execCommand('insertText', false, gap + code + ' ');
    }
    usageBump(code);
  }

  function pickerBuildGrid() {
    const grid = document.createElement('div');
    grid.className = 'kte-picker-grid';
    grid.addEventListener('mousedown', e => { if (e.target.closest('.kte-picker-btn')) e.preventDefault(); });
    grid.addEventListener('mouseover', e => {
      const b = e.target.closest('.kte-picker-btn');
      if (b && grid.contains(b)) {
        showTooltip(b);
        pickerHoverAnimate(b, true);
      }
    });
    grid.addEventListener('mouseout', e => {
      const b = e.target.closest('.kte-picker-btn');
      if (b && !b.contains(e.relatedTarget)) {
        hideTooltip();
        pickerHoverAnimate(b, false);
      }
    });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.kte-picker-btn');
      if (b?.dataset.code) pickerInsert(b.dataset.code);
    });
    // Same menu as chat emotes — starring is the point, but copy/open work too.
    grid.addEventListener('contextmenu', e => {
      const b = e.target.closest('.kte-picker-btn');
      const emote = b?.dataset.code ? emoteMap.get(b.dataset.code) : null;
      if (!emote) return;
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      showEmoteMenu(e.clientX, e.clientY, b.dataset.code, emote);
    });
    return grid;
  }

  function pickerBuildSection(label, emotes) {
    const section = document.createElement('div');
    section.className = 'kte-picker-section grid gap-2';

    const hdr = document.createElement('span');
    hdr.className = 'kte-picker-provider text-xs font-medium text-neutral-400';
    hdr.textContent = `${label} (${emotes.length})`;
    section.appendChild(hdr);

    const grid = pickerBuildGrid();
    const shown = Math.min(PICKER_PROVIDER_LIMIT, emotes.length);
    pickerAppendButtons(grid, emotes, 0, shown);
    section.appendChild(grid);

    if (shown < emotes.length) {
      const footer = document.createElement('div');
      footer.className = 'kte-picker-footer';
      const limit = document.createElement('p');
      limit.className = 'kte-picker-limit';
      limit.textContent = `Showing ${shown} of ${emotes.length}`;
      footer.appendChild(limit);
      footer.appendChild(pickerBuildLoadMore(grid, emotes, shown, limit));
      section.appendChild(footer);
    }
    return section;
  }

  // Starred emotes still present in the current emote set, newest star first,
  // filtered by the active picker search.
  function pickerFavouriteEmotes(lowerQuery) {
    const favourites = [];
    for (const code of favCodes()) {
      if (lowerQuery && !code.toLowerCase().includes(lowerQuery)) continue;
      const emote = emoteMap.get(code);
      if (emote) favourites.push({ code, emote });
    }
    return favourites;
  }

  // Most recently inserted emotes still present in the current emote set,
  // filtered by the active picker search.
  function pickerRecentEmotes(lowerQuery) {
    const byRecency = [...usageLoad().entries()].sort((a, b) => b[1].t - a[1].t);
    const recent = [];
    for (const [code] of byRecency) {
      if (recent.length === PICKER_RECENT_LIMIT) break;
      if (lowerQuery && !code.toLowerCase().includes(lowerQuery)) continue;
      const emote = emoteMap.get(code);
      if (emote) recent.push({ code, emote });
    }
    return recent;
  }

  function pickerChipState(chip, on) {
    chip.dataset.on = on ? '1' : '0';
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function pickerBuildChip(label, tip) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'kte-chip';
    chip.textContent = label;
    chip.dataset.kteTip = tip;
    chip.addEventListener('mouseenter', () => showTooltip(chip));
    chip.addEventListener('mouseleave', hideTooltip);
    // Keep the chat input focused, same as the grid buttons and Load more.
    chip.addEventListener('mousedown', e => e.preventDefault());
    return chip;
  }

  // Settings row pinned to the top of the tab: which providers render. Toggles
  // apply immediately — no reload, no channel change.
  function pickerBuildSettings() {
    const row = document.createElement('div');
    row.className = 'kte-picker-settings';

    for (const provider of PROVIDERS) {
      const chip = pickerBuildChip(provider, `Show or hide ${provider} emotes`);
      chip.dataset.provider = provider;
      pickerChipState(chip, providerEnabled(provider));
      chip.addEventListener('click', () => {
        const store = settingsLoad();
        store.providers[provider] = !providerEnabled(provider);
        settingsSave();
        applyProviderSettings(); // hides the tooltip and re-renders chat
        // The section list changes, so the tab content has to be rebuilt.
        const panel = document.getElementById('chat-emotes-picker-panel');
        if (panel) {
          pickerRefreshContent(panel);
          pickerApplyActiveState(panel);
        }
      });
      row.appendChild(chip);
    }

    return row;
  }

  // The settings row is sticky, so once the grid scrolls it would cover the top
  // row of emotes. Hide it while the tab is scrolled away from the top and bring
  // it back on return. Observing a sentinel instead of listening for scroll keeps
  // this working for either scroller — the tab's own overflow, and Kick's panel
  // scroller when the tab itself isn't the one scrolling.
  function pickerAttachSettingsAutoHide(content) {
    if (!content || content._kteSettingsObserver) return;
    const sentinel = content.querySelector('.kte-settings-sentinel');
    const row = content.querySelector('.kte-picker-settings');
    if (!sentinel || !row) return;
    const observer = new IntersectionObserver(entries => {
      const atTop = entries[entries.length - 1].isIntersecting;
      row.dataset.kteHidden = atTop ? '0' : '1';
      if (!atTop) hideTooltip(); // a chip tooltip would outlive the row otherwise
    });
    observer.observe(sentinel);
    content._kteSettingsObserver = observer;
  }

  function pickerDetachSettingsAutoHide(content) {
    content?._kteSettingsObserver?.disconnect();
    if (content) content._kteSettingsObserver = null;
  }

  function pickerBuildContent(query) {
    const wrap = document.createElement('div');
    wrap.id = 'kte-picker-content';
    const sentinel = document.createElement('div');
    sentinel.className = 'kte-settings-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    wrap.appendChild(sentinel);
    wrap.appendChild(pickerBuildSettings());
    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'grid gap-2';

    const lower = (query ?? '').trim().toLowerCase();
    const groups = new Map();
    for (const [code, emote] of emoteMap) {
      if (lower && !code.toLowerCase().includes(lower)) continue;
      const source = sourceName(emote.source);
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push({ code, emote });
    }

    const providerOrder = ['7TV', 'BTTV', 'FFZ'];
    const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
      const ai = providerOrder.includes(a) ? providerOrder.indexOf(a) : providerOrder.length;
      const bi = providerOrder.includes(b) ? providerOrder.indexOf(b) : providerOrder.length;
      return ai - bi || (a < b ? -1 : a > b ? 1 : 0);
    });

    let any = false;

    const favourites = pickerFavouriteEmotes(lower);
    if (favourites.length) {
      any = true;
      sectionsContainer.appendChild(pickerBuildSection('Favourites', favourites));
    }

    const recent = pickerRecentEmotes(lower);
    if (recent.length) {
      any = true;
      sectionsContainer.appendChild(pickerBuildSection('Recently used', recent));
    }

    for (const [source, emotes] of orderedGroups) {
      if (!emotes.length) continue;
      any = true;
      emotes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
      sectionsContainer.appendChild(pickerBuildSection(source, emotes));
    }

    if (!any) {
      const msg = document.createElement('p');
      msg.className = 'kte-picker-empty';
      msg.textContent = query
        ? 'No matching emotes'
        : (PROVIDERS.every(provider => !providerEnabled(provider))
          ? 'Every provider is hidden — turn one back on above'
          : 'Emotes loading…');
      wrap.appendChild(msg);
    } else {
      wrap.appendChild(sectionsContainer);
    }
    return wrap;
  }

  function pickerCommonAncestor(a, b, limit) {
    let el = a;
    while (el && el !== limit) {
      if (el.contains(b)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function pickerFindScrollViewport(mainGrid, panel) {
    let el = mainGrid;
    while (el && el !== panel) {
      const className = typeof el.className === 'string' ? el.className : '';
      const overflowY = getComputedStyle(el).overflowY;
      if (className.includes('overflow-y-auto') || className.includes('overflow-y-scroll') || /auto|scroll/.test(overflowY)) {
        return el;
      }
      el = el.parentElement;
    }
    return panel;
  }

  function pickerFindParts(panel) {
    const tabButtons = [...panel.querySelectorAll('button[data-active]')];
    const tabsRow = tabButtons
      .map(button => button.parentElement)
      .find(row => row && row.querySelectorAll(':scope > button[data-active]').length >= 2)
      ?? tabButtons[0]?.parentElement;
    if (!tabsRow) return null;

    const searchInput = panel.querySelector('#search-emotes-input');
    let header = searchInput ? pickerCommonAncestor(searchInput, tabsRow, panel) : null;
    let mainGrid = header?.parentElement ?? null;

    if (!header || !mainGrid || header === panel) {
      const scrollable = panel.querySelector('[class*="overflow-y-auto"]');
      mainGrid = scrollable?.firstElementChild ?? null;
      header = mainGrid ? [...mainGrid.children].find(child => child.contains(tabsRow)) : null;
    }

    if (!header || !mainGrid || header === panel || !mainGrid.contains(header)) return null;
    return {
      tabsRow,
      header,
      mainGrid,
      searchInput,
      scrollViewport: pickerFindScrollViewport(mainGrid, panel),
    };
  }

  function pickerNativeViews(parts, pickerContent) {
    return [...parts.mainGrid.children].filter(child => (
      child !== parts.header && child !== pickerContent
    ));
  }

  function pickerRefreshContent(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return null;

    const oldContent = panel.querySelector('#kte-picker-content');
    const keepScroll = oldContent?.dataset.kteChannel === (channelSlug ?? '');
    const scrollTop = keepScroll ? oldContent.scrollTop : 0;

    const tab = panel.querySelector('#kte-picker-tab');
    const active = tab?.getAttribute('data-active') === 'true';

    const content = pickerBuildContent(parts.searchInput?.value ?? '');
    content.dataset.kteChannel = channelSlug ?? '';
    content.dataset.kteEmoteVersion = String(emoteVersion);
    content.hidden = !active;

    if (oldContent) {
      pickerMarkContentStale(oldContent);
      oldContent.replaceWith(content);
    }
    else parts.mainGrid.appendChild(content);
    pickerAttachSettingsAutoHide(content);

    if (!content.hidden) {
      content.scrollTop = scrollTop;
      pickerAttachImageLoader(content, parts.scrollViewport);
    }
    return content;
  }

  function pickerIsActive(panel) {
    return panel.querySelector('#kte-picker-tab')?.getAttribute('data-active') === 'true';
  }

  function pickerApplyActiveState(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return;

    const tab = panel.querySelector('#kte-picker-tab');
    const content = panel.querySelector('#kte-picker-content');
    const active = tab?.getAttribute('data-active') === 'true';

    if (content) {
      content.hidden = !active;
      if (!active) {
        content.style.height = '';
        if (content._kteDeferredProviderRefresh) {
          pickerMarkContentStale(content);
          content.remove();
        } else {
          pickerDetachImageLoader(content);
        }
      } else {
        pickerAttachImageLoader(content, parts.scrollViewport);
      }
    }
    for (const child of pickerNativeViews(parts, content)) {
      if (active) {
        child.dataset.kteNativeHidden = '1';
        child.hidden = true;
      } else if (child.dataset.kteNativeHidden === '1') {
        child.hidden = false;
        delete child.dataset.kteNativeHidden;
      }
    }
  }

  function queueProviderPickerRefresh() {
    const panel = document.getElementById('chat-emotes-picker-panel');
    const content = panel?.querySelector('#kte-picker-content');
    const active = panel ? pickerIsActive(panel) : false;
    const deferActiveRefresh = active && content
      && (Date.now() - lastNavigationAt < PICKER_ACTIVE_PROVIDER_DEFER_WINDOW
        || content._kteAppendingMore
        || content._kteImageLoading
        || Boolean(content._kteImageQueue?.length));

    if (deferActiveRefresh) {
      content._kteDeferredProviderRefresh = true;
      // Only another provider resolving would call this again. If this was the
      // last one and the user stays on the tab, the picker would keep showing
      // the pre-refresh set — re-check once the defer reason has had time to
      // clear (the navigation window expires; appends and image loads finish).
      if (!pickerDeferredRefreshTimer) {
        const seq = initSeq;
        pickerDeferredRefreshTimer = setTimeout(() => {
          pickerDeferredRefreshTimer = null;
          if (seq === initSeq) queueProviderPickerRefresh();
        }, PICKER_DEFERRED_RETRY_DELAY);
      }
      return;
    }

    queuePickerInject(panel, pickerProviderInjectDelay());
  }

  function pickerSetActive(panel, active, refresh = false) {
    const tab = panel.querySelector('#kte-picker-tab');
    if (!tab) return;

    if (active) {
      panel.querySelectorAll('button[data-active="true"]').forEach(button => {
        if (button !== tab) button.setAttribute('data-active', 'false');
      });
    }

    tab.setAttribute('data-active', active ? 'true' : 'false');
    if (refresh) pickerRefreshContent(panel);
    pickerApplyActiveState(panel);
  }

  // The project icon (`icon.svg`) — the same winking face, minus its dark rounded
  // plate, since the tab icons sit on the panel background and the buttons round
  // them anyway (`[&_svg]:rounded-full`, which would shave a plate's corners off).
  // The path data below is icon.svg's, unchanged; keep the two in step. Only the
  // viewBox differs: it crops to just outside the face (which spans 10-54) so the
  // circle fills ~83% of the icon box. Kick's own emote icons are images with
  // their own transparent margin, so a face drawn edge to edge reads too large.
  // Widen the crop to shrink the face, tighten it to grow it.
  function pickerBuildTabIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '5.5 5.5 53 53');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const add = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      svg.appendChild(node);
    };

    add('circle', { cx: '32', cy: '32', r: '22', fill: '#22c55e' });
    add('circle', { cx: '24.5', cy: '27.5', r: '3.5', fill: '#101013' });
    add('path', {
      d: 'M36 27.5 Q39.5 24 43 27.5',
      fill: 'none', stroke: '#101013', 'stroke-width': '3.5', 'stroke-linecap': 'round',
    });
    add('path', {
      d: 'M22 38 Q32 48 42 38',
      fill: 'none', stroke: '#101013', 'stroke-width': '4', 'stroke-linecap': 'round',
    });

    return svg;
  }

  // Built by cloning one of Kick's own tab buttons and swapping the icon, rather
  // than recreating its markup: the tabs carry a nest of Tailwind classes for
  // padding, hover and the active underline, and a hand-written copy silently
  // drifts out of alignment (no underline, wrong spacing) the moment Kick
  // restyles them. Cloning inherits whatever they currently are.
  function pickerBuildTab(nativeTab) {
    const tab = nativeTab ? nativeTab.cloneNode(true) : document.createElement('button');
    const icon = pickerBuildTabIcon();

    if (nativeTab) {
      // Kick queries its own tabs by id and data-testid; a duplicate of either
      // would make our clone answer for the tab it was copied from.
      for (const node of [tab, ...tab.querySelectorAll('[id], [data-testid]')]) {
        node.removeAttribute('id');
        node.removeAttribute('data-testid');
      }
      // Any label text belongs to the tab we copied — strip it before ours goes in.
      const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) texts.push(walker.currentNode);
      for (const node of texts) node.remove();

      const nativeIcon = tab.querySelector('svg, img');
      if (nativeIcon) {
        // Only the class comes across. The button sizes its icon itself, via
        // `[&_svg]:size-7 [&_svg]:lg:size-6`, and those beat any width/height
        // attributes — copying the source icon's (21x16 on the Kick logo tab)
        // would just leave a wrong aspect ratio behind if that CSS ever lapses.
        const iconClass = nativeIcon.getAttribute('class');
        if (iconClass !== null) icon.setAttribute('class', iconClass);
        nativeIcon.replaceWith(icon);
      } else {
        tab.prepend(icon);
      }
    } else {
      tab.appendChild(icon);
      const underline = document.createElement('div');
      underline.className = 'z-common h-0.5 w-full transition-colors duration-300 group-data-[active=true]:bg-green-500! betterhover:group-hover:bg-[#475054]';
      tab.appendChild(underline);
    }

    tab.id = 'kte-picker-tab';
    tab.type = 'button';
    tab.removeAttribute('title');
    tab.dataset.kteTip = '7TV / BTTV / FFZ emotes';
    tab.addEventListener('mouseenter', () => showTooltip(tab));
    tab.addEventListener('mouseleave', hideTooltip);
    tab.setAttribute('aria-label', 'Third-party emotes');
    tab.setAttribute('data-active', 'false');
    return tab;
  }

  function pickerAttachSearch(panel, searchInput) {
    if (!searchInput || searchInput._ktePickerSearch) return;
    searchInput._ktePickerSearch = true;
    searchInput.addEventListener('input', () => {
      if (panel.querySelector('#kte-picker-tab')?.getAttribute('data-active') !== 'true') return;
      pickerRefreshContent(panel);
      pickerApplyActiveState(panel);
    });
  }

  function pickerAttachNativeTabs(panel, tabsRow) {
    if (tabsRow._ktePickerTabs) return;
    tabsRow._ktePickerTabs = true;
    tabsRow.addEventListener('click', e => {
      const button = e.target.closest('button[data-active]');
      if (!button || button.id === 'kte-picker-tab') return;
      setTimeout(() => pickerSetActive(panel, false), 0);
    });
  }

  function pickerInject(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return;

    let tab = panel.querySelector('#kte-picker-tab');
    if (!tab) {
      // Prefer an icon tab to clone. The first tab can be the channel's avatar
      // button, whose <img> carries avatar-specific classes we don't want.
      const nativeTabs = [...parts.tabsRow.querySelectorAll('button[data-active]')];
      tab = pickerBuildTab(nativeTabs.find(button => button.querySelector('svg')) ?? nativeTabs[0]);
      tab.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        pickerSetActive(panel, true, true);
      });
    }
    if (tab.parentElement !== parts.tabsRow) parts.tabsRow.appendChild(tab);

    const content = panel.querySelector('#kte-picker-content');
    const active = pickerIsActive(panel);
    const stale = content
      && (content.dataset.kteChannel !== (channelSlug ?? '')
        || content.dataset.kteEmoteVersion !== String(emoteVersion));

    if (active && (!content || stale)) {
      if (content?._kteAppendingMore) {
        content._kteRefreshAfterAppend = true;
        queuePickerInject(panel, PICKER_APPEND_REFRESH_DELAY);
        return;
      }
      pickerRefreshContent(panel);
    } else if (!active && stale) {
      pickerMarkContentStale(content);
      content.remove();
    }
    pickerAttachSearch(panel, parts.searchInput);
    pickerAttachNativeTabs(panel, parts.tabsRow);
    pickerApplyActiveState(panel);
  }

  function queuePickerInject(panel, delay = PICKER_INJECT_DELAY) {
    if (pickerInjectTimer) clearTimeout(pickerInjectTimer);
    const seq = initSeq;
    pickerInjectTimer = setTimeout(() => {
      pickerInjectTimer = null;
      requestAnimationFrame(() => {
        if (seq !== initSeq) return;
        const target = panel?.isConnected ? panel : document.getElementById('chat-emotes-picker-panel');
        if (target) pickerInject(target);
      });
    }, delay);
  }

  function resetPicker() {
    if (pickerInjectTimer) {
      clearTimeout(pickerInjectTimer);
      pickerInjectTimer = null;
    }
    if (pickerDeferredRefreshTimer) {
      clearTimeout(pickerDeferredRefreshTimer);
      pickerDeferredRefreshTimer = null;
    }

    const panel = document.getElementById('chat-emotes-picker-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-kte-native-hidden="1"]').forEach(child => {
      child.hidden = false;
      delete child.dataset.kteNativeHidden;
    });
    panel.querySelector('#kte-picker-tab')?.remove();
    const content = panel.querySelector('#kte-picker-content');
    pickerMarkContentStale(content);
    content?.remove();
  }

  // ─── Chat Observer ────────────────────────────────────────────────────────

  function startChatObserver() {
    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(mutations => {
      let pickerPanelToInject = null;

      for (const mut of mutations) {
        // Virtual list recycles elements by changing data-index — clear stale marks
        // so the recycled message container gets reprocessed with its new content.
        if (mut.type === 'attributes' && mut.attributeName === 'data-index') {
          delete mut.target.dataset.kteVersion;
          mut.target.querySelectorAll?.('[data-kte-version]').forEach(el => {
            delete el.dataset.kteVersion;
          });
          queueProcessMessageTree(mut.target);
        }
        for (const added of mut.addedNodes) {
          if (added.nodeType !== Node.ELEMENT_NODE) continue;
          if (isOwnUINode(added)) continue;
          if (added.id === 'chat-emotes-picker-panel') {
            pickerPanelToInject = added;
            continue;
          }
          const containingPicker = added.closest?.('#chat-emotes-picker-panel');
          if (containingPicker) {
            pickerPanelToInject = containingPicker;
            continue;
          }
          const nestedPicker = added.querySelector?.('#chat-emotes-picker-panel');
          if (nestedPicker) {
            pickerPanelToInject = nestedPicker;
            continue;
          }
          queueProcessMessageTree(added);
        }
      }

      if (pickerPanelToInject) queuePickerInject(pickerPanelToInject);
      // Kick may replace the chat input element during stream switches — piggyback
      // on this observer (already watching body subtree) to re-attach autocomplete
      // when the tracked input disconnects.
      if (!attachedAcInput?.isConnected) attemptAcAttach();
    });
    chatObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-index'] });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function currentChannelSlug() {
    const parts = location.pathname.replace(/^\//, '').split('/');
    // Popout chat lives at /popout/<channel>/chat, so the channel is the second
    // segment there. Verified against the live site: the popout page carries the
    // same chat DOM (MSG_SELECTORS[0]/[1] and [data-testid="chat-input"] all
    // match), so without this it renders global emotes only — and leaves
    // *_c_popout keys in the cache for every popout ever opened.
    const raw = (parts[0] ?? '').toLowerCase() === 'popout' ? (parts[1] ?? '') : (parts[0] ?? '');
    const slug = raw.toLowerCase();
    return NON_CHANNEL_SLUGS.has(slug) ? null : slug || null;
  }

  function pickerProviderInjectDelay() {
    return Date.now() - lastNavigationAt < 2500
      ? PICKER_ROUTE_INJECT_DELAY
      : PICKER_INJECT_DELAY;
  }

  function routeChatRefreshDelay() {
    return Date.now() - lastNavigationAt < 2500
      ? ROUTE_CHAT_REFRESH_DELAY
      : 0;
  }

  async function init() {
    const seq = ++initSeq;
    const slug = currentChannelSlug();
    loadedProviders = new Map();
    activeLoaders = [];
    preconnectEmoteHosts();

    if (!slug) {
      channelSlug = null;
      emoteMap.clear();
      emoteVersion++;
      acHide();
      hideTooltip();
      hideEmoteMenu();
      resetPicker();
      return;
    }

    channelSlug = slug;
    emoteMap.clear();
    emoteVersion++;
    acHide();
    hideTooltip();
    hideEmoteMenu();
    resetPicker();
    startChatObserver();
    waitForInput();
    log(`Loading emotes for /${channelSlug}…`);

    // Every provider is fetched regardless of the settings toggles: the fetches
    // are cache-backed and cheap, and keeping the layers loaded is what lets a
    // provider be switched back on instantly instead of waiting on a refetch.
    const allLoaders = [
      { key: 'bttv_g', provider: 'BTTV', fn: options => loadBTTVGlobal(options), isChannel: false },
      { key: '7tv_g', provider: '7TV', fn: options => load7TVGlobal(options), isChannel: false },
      { key: 'ffz_g', provider: 'FFZ', fn: options => loadFFZGlobal(options), isChannel: false },
      { key: `bttv_c_${slug}`, provider: 'BTTV', fn: options => loadBTTVChannel(slug, options), isChannel: true },
      { key: `7tv_c_${slug}`, provider: '7TV', fn: options => load7TVChannel(slug, options), isChannel: true },
      { key: `ffz_c_${slug}`, provider: 'FFZ', fn: options => loadFFZChannel(slug, options), isChannel: true },
    ];

    const failedLoaders = [];
    activeLoaders = allLoaders;

    function applyProviderEntries(loader, entries) {
      if (seq !== initSeq || currentChannelSlug() !== slug) return;
      if (!Array.isArray(entries)) return false;
      const previous = loadedProviders.get(loader.key);
      if (!entries.length && !previous) return false;
      if (previous && sameEmoteEntries(previous, entries)) return false;
      loadedProviders.set(loader.key, entries);
      rebuildEmoteMap();
      emoteVersion++;
      queueVisibleEmoteRefresh(routeChatRefreshDelay());
      queueProviderPickerRefresh();
      acRefreshOpen();
      return true;
    }

    // Update chat, autocomplete, and picker incrementally as each provider resolves.
    const promises = allLoaders.map(loader => loader.fn({
      onRefresh: entries => applyProviderEntries(loader, entries),
    }).then(entries => applyProviderEntries(loader, entries)).catch(err => {
      log(`${loader.key} failed:`, err?.message ?? err);
      failedLoaders.push(loader);
    }));

    await Promise.allSettled(promises);
    if (seq !== initSeq || currentChannelSlug() !== slug) return;

    log(`Ready – ${emoteMap.size} emotes for /${channelSlug}`);

    queueVisibleEmoteRefresh(routeChatRefreshDelay());
    queueProviderPickerRefresh();

    if (failedLoaders.length) {
      log(`${failedLoaders.length} provider(s) failed, retrying in 5s…`);
      setTimeout(async () => {
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        const retryResults = await Promise.allSettled(
          failedLoaders.map(loader => loader.fn()),
        );
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        let added = 0;
        for (let i = 0; i < retryResults.length; i++) {
          const r = retryResults[i];
          if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
          if (applyProviderEntries(failedLoaders[i], r.value)) added += r.value.length;
        }
        if (added) {
          log(`Retry loaded ${added} emotes`);
        }
      }, 5000);
    }
  }

  // ─── SPA Routing ──────────────────────────────────────────────────────────

  function handleNavigation() {
    initSeq++;
    lastNavigationAt = Date.now();
    chatObserver?.disconnect(); chatObserver = null;
    inputObserver?.disconnect(); inputObserver = null;
    if (visibleRefreshTimer) {
      clearTimeout(visibleRefreshTimer);
      visibleRefreshTimer = null;
    }
    messageProcessQueue = [];
    messageProcessQueued = false;
    emoteMap.clear();
    emoteVersion++;
    acHide();
    hideTooltip();
    hideEmoteMenu();
    // Full stale-mark (not just detach) so image src is cleared even when Kick
    // has already removed the picker panel — resetPicker bails on a missing
    // panel and would otherwise leave decoded image data alive.
    if (activePickerImageLoader) pickerMarkContentStale(activePickerImageLoader);
    resetPicker();
    waitForDOMThenInit();
  }

  function waitForDOMThenInit() {
    const seq = initSeq;
    let attempts = 0;
    const maxAttempts = 50; // ~25 seconds
    function tryInit() {
      if (seq !== initSeq) return;
      attempts++;
      const slug = currentChannelSlug();
      if (!slug) { init(); return; }
      const hasChatDOM = MSG_SELECTORS.some(sel => document.querySelector(sel))
        || INPUT_SELECTORS.some(sel => document.querySelector(sel));
      if (hasChatDOM || attempts >= maxAttempts) { init(); return; }
      setTimeout(tryInit, 500);
    }
    setTimeout(tryInit, 300);
  }

  function checkRouteChange() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    handleNavigation();
  }

  // Poll location.pathname as the source of truth — Kick's router may hold a
  // captured reference to history.pushState/replaceState from before this script
  // loaded, which would bypass any wrapper we install. Polling catches every
  // navigation regardless of mechanism.
  setInterval(checkRouteChange, 500);

  // Fast path for navigations that do route through the live history methods,
  // so we don't have to wait up to 500ms for the interval to notice.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      checkRouteChange();
      return result;
    };
  }

  window.addEventListener('popstate', () => {
    checkRouteChange();
  });

  // Re-parent floating overlays into / out of the fullscreen element so they
  // remain visible when Kick's chat enters fullscreen.
  document.addEventListener('fullscreenchange', () => {
    if (tipEl) reparentOverlay(tipEl);
    if (acDropdown) reparentOverlay(acDropdown);
    hideEmoteMenu();
  });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', waitForDOMThenInit)
    : waitForDOMThenInit();

  // One-time storage cleanup, off the critical path.
  RIC(sweepCache);
})();
