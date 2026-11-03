// ==UserScript==
// @name         Kick Third-Party Emotes
// @namespace    https://kick.com
// @version      2.13.0
// @description  Adds BetterTTV, 7TV & FrankerFaceZ emotes to Kick.com chat — animated & zero-width emotes, usage-ranked autocomplete, favourites, hover previews, right-click emote menu, native picker tab with recents, and settings for providers, global sets, animation, emote size, previews & autocomplete
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         https://raw.githubusercontent.com/jakubn11/kick-third-party-emotes/main/icon.svg
// @match        https://kick.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.betterttv.net
// @connect      cdn.betterttv.net
// @connect      7tv.io
// @connect      cdn.7tv.app
// @connect      api.frankerfacez.com
// @connect      cdn.frankerfacez.com
// @updateURL    https://github.com/jakubn11/kick-third-party-emotes/releases/latest/download/kick-third-party-emotes.user.js
// @downloadURL  https://github.com/jakubn11/kick-third-party-emotes/releases/latest/download/kick-third-party-emotes.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Bumped on every release with the `@version` in the metadata header above.
  // It names the running build in the boot line and in the duplicate warning
  // below — the only way to tell which copy is running once auto-update, a
  // Greasy Fork install and a manual copy can all be in play.
  const VERSION = '2.13.0';

  // ── Single instance ────────────────────────────────────────────────────
  // Two copies on one page — a manual install left beside the Greasy Fork or
  // auto-updating one, or two managers both enabled — would both scan chat
  // and both drive the picker and autocomplete. The second copy stands down.
  //
  // The marker lives on `<html>` rather than on `window`: this script runs
  // sandboxed (`@grant GM_xmlhttpRequest`), and managers disagree on whether
  // sandboxed userscripts share a JS context — but they always share the DOM.
  // Same pattern as kick-fullscreen-chat and kick-quality-saver.
  const INSTANCE_ATTR = 'data-kte-running';
  const alreadyRunning = document.documentElement.getAttribute(INSTANCE_ATTR);
  if (alreadyRunning) {
    console.warn(
      `[KickEmotes] v${VERSION} is standing down: v${alreadyRunning} is already running ` +
        'on this page. Disable or uninstall the duplicate copy.'
    );
    return;
  }
  document.documentElement.setAttribute(INSTANCE_ATTR, VERSION);

  const log = (...a) => console.log('[KickEmotes]', ...a);
  log(`v${VERSION} active`);

  // Site pages, not channels. Several of these are also real Kick usernames
  // (`home`, `login`, `clips` all resolve on the channel API), so the API
  // can't tell them apart — the route wins on kick.com, and it must here too.
  // The policy pages and `category` were checked against the live site.
  const NON_CHANNEL_SLUGS = new Set([
    '', 'home', 'browse', 'following', 'categories', 'category', 'search',
    'login', 'register', 'dashboard', 'settings', 'clips', 'videos',
    'subscriptions', 'notifications', 'messages', 'wallet',
    'terms-of-service', 'privacy-policy', 'cookie-policy',
    'community-guidelines', 'dmca-policy',
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

  // ── Cache ────────────────────────────────────────────────────────────────

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
  // stopped being cached as empty sets, and to `kte_v5_` when animated FFZ
  // emotes stopped being cached as their still frame. Orphaned keys from older
  // prefixes are removed by sweepCache below.
  const CACHE_PREFIX = 'kte_v5_';

  // User state, not cached provider data: it has no schema tied to the emote
  // shape, so it deliberately keeps its own stable prefix and survives every
  // cache-prefix bump. sweepCache skips these keys.
  const USAGE_KEY = 'kte_v2_usage';
  const FAVS_KEY = 'kte_v2_favs';
  const SETTINGS_KEY = 'kte_v2_settings';
  const PRESERVED_KEYS = new Set([USAGE_KEY, FAVS_KEY, SETTINGS_KEY]);

  // Every visited channel leaves kte_v5_*_c_<slug> keys behind and localStorage
  // never evicts them. Drop old-prefix keys and anything long expired; the
  // CACHE_BUDGET cap in Cache.set bounds what is left inside the week.
  const CACHE_SWEEP_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  // Cache writes keep our provider data under this many UTF-16 code units —
  // the unit browsers count against localStorage's ~5M quota. That quota is
  // kick.com's, shared with Kick's own data, and one big channel's sets run to
  // ~200K (xqc's 7TV set alone is 988 emotes, ~190K). Uncapped, a week of
  // channel surfing filled it: our writes then failed silently, and so would
  // Kick's. Oldest entries go first.
  const CACHE_BUDGET = 1.5 * 1024 * 1024;

  // A cache value's write time, read off the front of the string instead of
  // parsing a whole emote set. Cache.set always writes `{"ts":…` first; any
  // other shape reads as 0, i.e. oldest.
  function cacheValueTs(raw) {
    const m = /^\{"ts":(\d+)[,}]/.exec(raw ?? '');
    return m ? Number(m[1]) : 0;
  }

  // Our provider-data entries other than `exceptKey`, oldest first.
  function cacheEntriesByAge(exceptKey) {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX) || key === exceptKey || PRESERVED_KEYS.has(key)) continue;
      const raw = localStorage.getItem(key) ?? '';
      entries.push({ key, ts: cacheValueTs(raw), size: key.length + raw.length });
    }
    return entries.sort((a, b) => a.ts - b.ts);
  }

  function sweepCache() {
    const doomed = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('kte_')) continue;
        if (PRESERVED_KEYS.has(key)) continue; // usage + favourites persist indefinitely
        if (!key.startsWith(CACHE_PREFIX)) { doomed.push(key); continue; }
        const ts = cacheValueTs(localStorage.getItem(key));
        if (!ts || Date.now() - ts > CACHE_SWEEP_MAX_AGE) doomed.push(key);
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
      const fullKey = `${CACHE_PREFIX}${key}`;
      try {
        const raw = JSON.stringify({ ts: Date.now(), data });
        const size = fullKey.length + raw.length;
        if (size > CACHE_BUDGET) return;
        // fullKey's current value is left out: this write replaces it.
        const others = cacheEntriesByAge(fullKey);
        let total = others.reduce((sum, entry) => sum + entry.size, 0);
        while (total + size > CACHE_BUDGET && others.length) {
          const oldest = others.shift();
          localStorage.removeItem(oldest.key);
          total -= oldest.size;
        }
        for (;;) {
          try {
            localStorage.setItem(fullKey, raw);
            return;
          } catch {
            // Over the browser's quota while still inside our budget — Kick's
            // own data holds the rest. Give up our oldest entries before
            // giving up the write; that frees room for Kick's writes too.
            const oldest = others.shift();
            if (!oldest) return;
            localStorage.removeItem(oldest.key);
          }
        }
      } catch { /* storage access denied – skip */ }
    },
  };

  // ── Emote usage tracker ──────────────────────────────────────────────────
  // Local-only counter of inserted emotes (autocomplete + picker). Powers
  // usage-first autocomplete ranking and the picker's "Recently used" section.

  const USAGE_MAX_ENTRIES = 200;

  let usageMap = null; // code → { n: insert count, t: last-used timestamp }

  // Usage, favourites and settings all follow one rule, because every open
  // Kick tab writes the same keys: a change re-reads the stored copy, applies
  // itself, and writes straight back. Saving this tab's in-memory copy instead
  // would put back whatever another tab changed since — a cleared list, a
  // star, a setting. Between writes, the `storage` listener (Cross-tab sync)
  // keeps reads current.

  // The stored map, or null when storage can't be read — then the caller
  // keeps what it has rather than starting from empty.
  function usageRead() {
    try {
      const map = new Map();
      const raw = localStorage.getItem(USAGE_KEY);
      if (raw) {
        const { counts } = JSON.parse(raw);
        for (const [code, v] of Object.entries(counts ?? {})) {
          if (!isSafeTextToken(code, 100)) continue;
          if (typeof v?.[0] !== 'number' || typeof v?.[1] !== 'number') continue;
          map.set(code, { n: v[0], t: v[1] });
        }
      }
      return map;
    } catch { return null; }
  }

  function usageLoad() {
    if (!usageMap) usageMap = usageRead() ?? new Map();
    return usageMap;
  }

  function usageCount(code) {
    return usageLoad().get(code)?.n ?? 0;
  }

  function usageBump(code) {
    const map = usageMap = usageRead() ?? usageLoad();
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

  // Forgets every insert, which empties "Recently used" and drops the usage
  // ranking from autocomplete. Favourites are a separate store and stay.
  function usageClear() {
    usageMap = new Map();
    usageSave();
  }

  function usageSave() {
    try {
      const counts = {};
      for (const [code, v] of usageLoad()) counts[code] = [v.n, v.t];
      localStorage.setItem(USAGE_KEY, JSON.stringify({ ts: Date.now(), counts }));
    } catch { /* quota exceeded – skip silently */ }
  }

  // ── Favourites ───────────────────────────────────────────────────────────
  // Local-only starred emote codes. Favourites outrank usage in autocomplete
  // and get their own picker section above "Recently used".

  const FAVS_MAX_ENTRIES = 100;

  let favSet = null; // insertion-ordered Set of codes, oldest first

  // The stored set, or null when storage can't be read (see usageRead).
  function favRead() {
    try {
      const set = new Set();
      const raw = localStorage.getItem(FAVS_KEY);
      if (raw) {
        const { codes } = JSON.parse(raw);
        for (const code of Array.isArray(codes) ? codes : []) {
          if (isSafeTextToken(code, 100)) set.add(code);
        }
      }
      return set;
    } catch { return null; }
  }

  function favLoad() {
    if (!favSet) favSet = favRead() ?? new Set();
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
    const set = favSet = favRead() ?? favLoad();
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
    try {
      localStorage.setItem(FAVS_KEY, JSON.stringify({ ts: Date.now(), codes: [...favLoad()] }));
    } catch { /* quota exceeded – skip silently */ }
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  // Local-only preferences: provider visibility as chips at the top of the
  // picker's 7TV+ tab, everything else in the settings panel. User state like
  // usage and favourites, so it keeps its own stable key and is exempt from the
  // cache sweep.

  const PROVIDERS = ['7TV', 'BTTV', 'FFZ'];
  // 'always' animates everywhere, 'hover' shows still frames until the pointer
  // is on the emote, 'never' keeps them still. Only 7TV and FFZ serve a still
  // frame, so BTTV's animated emotes move in every mode.
  const MOTION_MODES = ['always', 'hover', 'never'];
  // Chat emote height in px; 'medium' is the size before it was a setting.
  const EMOTE_SIZES = { small: 24, medium: 28, large: 36 };

  let settings = null;

  function settingsDefaults() {
    const defaults = {
      providers: {}, globals: {}, autocomplete: true, motion: 'always', size: 'medium', preview: true,
    };
    for (const provider of PROVIDERS) {
      defaults.providers[provider] = true;
      defaults.globals[provider] = true;
    }
    return defaults;
  }

  // Field by field, so a record from before a field existed (2.12 stored only
  // `providers`) keeps what it has and takes the default for the rest.
  function settingsFromRecord(saved) {
    const next = settingsDefaults();
    for (const group of ['providers', 'globals']) {
      for (const provider of PROVIDERS) {
        if (typeof saved?.[group]?.[provider] === 'boolean') next[group][provider] = saved[group][provider];
      }
    }
    if (typeof saved?.autocomplete === 'boolean') next.autocomplete = saved.autocomplete;
    if (MOTION_MODES.includes(saved?.motion)) next.motion = saved.motion;
    if (Object.hasOwn(EMOTE_SIZES, saved?.size ?? '')) next.size = saved.size;
    if (typeof saved?.preview === 'boolean') next.preview = saved.preview;
    return next;
  }

  // The stored settings, or null when storage can't be read (see usageRead).
  function settingsRead() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return settingsFromRecord(raw ? JSON.parse(raw) : null);
    } catch { return null; }
  }

  function settingsLoad() {
    if (!settings) settings = settingsRead() ?? settingsDefaults();
    return settings;
  }

  // The only way to change a setting: mutate the freshly read copy, then save.
  function settingsUpdate(mutate) {
    settings = settingsRead() ?? settingsLoad();
    mutate(settings);
    try {
      const { providers, globals, autocomplete, motion, size, preview } = settings;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        ts: Date.now(), providers, globals, autocomplete, motion, size, preview,
      }));
    } catch { /* quota exceeded – skip silently */ }
  }

  // Anything outside the known set — a future provider, or the 'Other' bucket
  // sourceName falls back to — stays visible rather than silently disappearing.
  function providerEnabled(provider) {
    return settingsLoad().providers[provider] ?? true;
  }

  function globalsEnabled(provider) {
    return settingsLoad().globals[provider] ?? true;
  }

  // Chat emotes size themselves from this variable, so a change restyles
  // every rendered emote at once with no re-render. On <html> so it also
  // reaches into a fullscreen chat.
  function applyEmoteSize() {
    document.documentElement.style.setProperty('--kte-emote-size', `${EMOTE_SIZES[settingsLoad().size]}px`);
  }

  // ── State ────────────────────────────────────────────────────────────────

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
  let initSeq = 0;
  let emoteVersion = 0;
  // Whether this channel's first round of provider loads has finished, so an
  // empty picker can say why instead of "loading" forever.
  let emotesSettled = false;
  let visibleRefreshTimer = null;
  let pickerInjectTimer = null;
  let pickerDeferredRefreshTimer = null;
  let pickerSearchTimer = null;
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

  // ── Styles ───────────────────────────────────────────────────────────────

  const _style = document.createElement('style');
  _style.textContent = `
    /* Emote base wrapper */
    .kte-wrap {
      display: inline-block;
      position: relative;
      vertical-align: middle;
    }
    .kte-img {
      height: var(--kte-emote-size, 28px);
      width: auto;
      max-width: calc(var(--kte-emote-size, 28px) * 4);
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
      height: var(--kte-emote-size, 28px);
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
      font-weight: 600;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1;
      padding: 7px 12px;
      border-radius: 8px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 9999;
      border: 1px solid rgba(255,255,255,.1);
      box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
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

    /* Autocomplete popup — a panel, so it takes the family panel radius and
       shadow (kick-fullscreen-chat's and kick-quality-saver's settings cards). */
    #kte-ac {
      position: fixed;
      background: #101013;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      box-shadow:
        0 24px 64px -16px rgba(0,0,0,.8),
        0 2px 10px rgba(0,0,0,.45),
        inset 0 1px 0 rgba(255,255,255,.06);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
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
      font-weight: 600;
      color: #22c55e;
      padding: 8px 12px 4px;
      text-transform: uppercase;
      letter-spacing: .09em;
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
      font-weight: 600;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kte-ac-src {
      font-size: 10px;
      font-weight: 600;
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
      font-weight: 600;
      opacity: .85;
    }
    #kte-ac-footer {
      font-size: 10px;
      font-weight: 500;
      color: rgba(255,255,255,.4);
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
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
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
      font-weight: 600;
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
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      background: #101013;
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      transition: opacity .12s ease, transform .12s ease;
    }
    /* Out of the way while the grid is scrolled, so it never sits on emotes. */
    .kte-picker-settings[data-kte-hidden="1"] {
      opacity: 0;
      transform: translateY(-100%);
      pointer-events: none;
    }
    /* The family chip (kick-fullscreen-chat's .kfc-settings-chip,
       kick-quality-saver's .kqs-chip): neutral at rest, green tint when on. */
    .kte-chip {
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      color: rgba(255,255,255,.85);
      font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      padding: 6px 10px;
      cursor: pointer;
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .kte-chip:hover,
    .kte-chip:focus-visible {
      background: rgba(255,255,255,.09);
      border-color: rgba(255,255,255,.16);
      color: #fff;
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
      border-radius: 8px;
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
    /* Opens the settings panel; pushed to the far end of the chip row. */
    .kte-picker-settings .kte-chip-panel {
      margin-left: auto;
    }

    /* Settings panel — the family settings card. Values follow
       kick-quality-saver's .kqs-card and kick-fullscreen-chat's
       #kfc-settings-panel; keep them in step with both. */
    .kte-panel-backdrop {
      /* Kick's narrow-screen drawer is a modal that sets pointer-events: none
         on <body>; the backdrop must not inherit it while that closes. */
      pointer-events: auto;
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(6,6,8,.6);
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
      animation: kte-panel-fade .16s ease-out;
    }
    #kte-panel {
      box-sizing: border-box;
      width: min(380px, calc(100vw - 32px));
      max-height: 76vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: .7rem;
      padding: 1rem;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      background: #101013;
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      box-shadow: 0 24px 64px -16px rgba(0,0,0,.8), 0 2px 10px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
      color: #fff;
      font: 500 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      animation: kte-panel-rise .2s cubic-bezier(.16,1,.3,1);
    }
    @keyframes kte-panel-fade {
      from { opacity: 0; }
    }
    /* A centred card, so it rises with kick-quality-saver's scale too. */
    @keyframes kte-panel-rise {
      from { opacity: 0; transform: translateY(8px) scale(.97); }
    }
    #kte-panel :focus-visible {
      outline: 2px solid rgba(34,197,94,.65);
      outline-offset: 2px;
    }
    #kte-panel button {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    /* The family scrollbar: thin, translucent, inset by a transparent border
       so the thumb clears the card's rounded edge. */
    #kte-panel::-webkit-scrollbar {
      width: 8px;
    }
    #kte-panel::-webkit-scrollbar-track {
      background: transparent;
    }
    #kte-panel::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.13);
      border: 2px solid transparent;
      background-clip: padding-box;
      border-radius: 999px;
    }
    /* Header: icon mark, title, close — kick-fullscreen-chat's header. */
    .kte-panel-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .kte-panel-mark {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid rgba(34,197,94,.22);
      border-radius: 9px;
      background: rgba(34,197,94,.1);
    }
    .kte-panel-mark svg {
      width: 16px;
      height: 16px;
      color: #22c55e;
    }
    .kte-panel-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .kte-panel-title {
      font: 600 13.5px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: -.01em;
      color: #fff;
    }
    /* A red glyph on the neutral chip surface, red tint on hover — the
       siblings' close button. */
    .kte-panel-close {
      margin-left: auto;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      color: #fca5a5;
      font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease;
    }
    .kte-panel-close:hover,
    .kte-panel-close:focus-visible {
      background: rgba(239,68,68,.14);
      border-color: rgba(248,113,113,.5);
      color: #fca5a5;
    }
    .kte-panel-close:active {
      transform: scale(.97);
    }
    /* One inset group per topic. */
    .kte-panel-group {
      display: flex;
      flex-direction: column;
      gap: .6rem;
      padding: .7rem;
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 11px;
      background: rgba(255,255,255,.026);
    }
    .kte-panel-label {
      font: 600 10px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: .09em;
      text-transform: uppercase;
      color: rgba(255,255,255,.4);
    }
    .kte-panel-chips {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    /* The panel chip is the family's grid chip (kqs .kqs-chip, kfc
       .kfc-settings-chip): taller, centred, and pressed-in on click, with a
       faint ring when selected. The picker row keeps the compact .kte-chip. */
    #kte-panel .kte-chip {
      box-sizing: border-box;
      min-width: 0;
      min-height: 32px;
      padding: 0 .4rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-appearance: none;
      appearance: none;
      transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease;
    }
    #kte-panel .kte-chip:active {
      transform: scale(.97);
    }
    #kte-panel .kte-chip[data-on="1"] {
      box-shadow: 0 0 0 3px rgba(34,197,94,.07);
    }
    #kte-panel .kte-chip[data-on="1"][data-provider="7TV"] {
      box-shadow: 0 0 0 3px rgba(77,166,255,.07);
    }
    #kte-panel .kte-chip[data-on="1"][data-provider="BTTV"] {
      box-shadow: 0 0 0 3px rgba(255,107,107,.07);
    }
    #kte-panel .kte-chip[data-on="1"][data-provider="FFZ"] {
      box-shadow: 0 0 0 3px rgba(192,132,252,.07);
    }
    /* Destructive action: a red glyph at rest, red tint on hover, solid red
       once armed — kick-quality-saver's .kqs-chip--danger. */
    #kte-panel .kte-chip-danger {
      color: #fca5a5;
    }
    #kte-panel .kte-chip-danger:hover,
    #kte-panel .kte-chip-danger:focus-visible {
      background: rgba(239,68,68,.14);
      border-color: rgba(248,113,113,.5);
      color: #fca5a5;
    }
    #kte-panel .kte-chip-danger[data-on="1"],
    #kte-panel .kte-chip-danger[data-on="1"]:hover {
      background: rgba(248,113,113,.18);
      border-color: #f87171;
      color: #fca5a5;
      box-shadow: 0 0 0 3px rgba(248,113,113,.08);
    }
    #kte-panel .kte-chip:disabled,
    #kte-panel .kte-chip:disabled:hover {
      background: rgba(255,255,255,.02);
      border-color: rgba(255,255,255,.05);
      color: rgba(255,255,255,.28);
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }
    .kte-panel-note {
      font: 500 11px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: rgba(255,255,255,.4);
    }
    /* Switch rows sit in a gap-less container, so each row's own 7px padding
       is the only spacing and the hairline falls midway between rows. When the
       block ends a group, the last row's bottom padding is pulled back so the
       group is as tight at the bottom as under its label. */
    .kte-switches {
      display: flex;
      flex-direction: column;
    }
    .kte-panel-group > .kte-switches:last-child {
      margin-bottom: -7px;
    }
    .kte-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 7px 0;
      font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: rgba(255,255,255,.88);
    }
    .kte-switch-row + .kte-switch-row {
      border-top: 1px solid rgba(255,255,255,.05);
    }
    .kte-switch {
      position: relative;
      flex: none;
      width: 34px;
      height: 19px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      cursor: pointer;
      transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
    }
    .kte-switch[aria-checked="true"] {
      background: #22c55e;
      border-color: rgba(34,197,94,.75);
      box-shadow: 0 0 0 3px rgba(34,197,94,.1);
    }
    .kte-switch::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 2px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.5);
      transform: translateY(-50%);
      transition: transform .18s cubic-bezier(.2,.8,.2,1);
    }
    .kte-switch[aria-checked="true"]::after {
      transform: translate(15px, -50%);
    }
    @media (prefers-reduced-motion: reduce) {
      .kte-panel-backdrop,
      #kte-panel {
        animation: none;
      }
      #kte-panel .kte-chip,
      .kte-panel-close,
      .kte-switch,
      .kte-switch::after {
        transition: none;
      }
    }
  `;
  (document.head ?? document.documentElement).appendChild(_style);

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Reject URLs that aren't https: or don't come from a known emote CDN.
  // Prevents a compromised provider API from loading arbitrary tracking pixels.
  function safeUrl(url) {
    try {
      const { protocol, hostname } = new URL(url);
      return protocol === 'https:' && ALLOWED_CDN_HOSTS.has(hostname) ? url : '';
    } catch { return ''; }
  }

  // With the OS "reduce motion" setting on, emotes show their still frame
  // everywhere — chat, autocomplete, the hover preview and the picker, hover
  // included. That needs a still frame to exist: 7TV and FFZ animated emotes
  // have one (`staticUrl`); BTTV serves none, so its animated emotes still move.
  const reducedMotionQuery = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function prefersReducedMotion() {
    return Boolean(reducedMotionQuery?.matches);
  }

  // The system's reduce-motion setting wins over the user's choice here.
  function motionMode() {
    return prefersReducedMotion() ? 'never' : settingsLoad().motion;
  }

  // The image to show for an emote, already through safeUrl: its still frame
  // unless motion is 'always' and it has one, otherwise the emote itself.
  function emoteDisplayUrl(emote) {
    const still = motionMode() !== 'always' && emote.staticUrl ? safeUrl(emote.staticUrl) : '';
    return still || safeUrl(emote.url);
  }

  // The image to show while the pointer is on an emote, and in the hover
  // preview: animated unless motion is off entirely.
  function emoteHoverUrl(emote) {
    return motionMode() === 'never' ? emoteDisplayUrl(emote) : safeUrl(emote.url);
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

  // ── HTTP ─────────────────────────────────────────────────────────────────

  const FETCH_TIMEOUT = 15000;
  // Delays before each retry of a provider that failed to load (see init).
  const PROVIDER_RETRY_DELAYS = [5000, 15000, 45000];

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
        // Managers call onerror with the response object, not an Error, so a
        // bare `reject` logged `failed: undefined`. An abort is handled too: a
        // request that ends without onload/onerror/ontimeout would otherwise
        // leave this promise, and the retry pass waiting on it, pending forever.
        onerror: res => reject(new Error(typeof res?.error === 'string' && res.error
          ? `network error: ${res.error}`
          : 'network error')),
        onabort: () => reject(new Error('aborted')),
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

  // ── Cache-aware load helper ──────────────────────────────────────────────

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

  // When two layers share a code, the higher-ranked one wins: every channel set
  // outranks every global set, and within a tier 7TV beats BTTV beats FFZ (the
  // PROVIDERS order). 7TV leads because it is the only provider that knows
  // Kick accounts — BTTV and FFZ channel sets are the streamer's Twitch ones.
  // This used to fall out of loader order instead, which had channel sets
  // last-wins and globals first-wins, so an old Twitch FFZ emote shadowed the
  // streamer's 7TV emote of the same name.
  function loaderRank(loader) {
    const i = PROVIDERS.indexOf(loader.provider);
    const providerRank = i < 0 ? PROVIDERS.length : i;
    return (loader.isChannel ? 0 : PROVIDERS.length + 1) + providerRank;
  }

  // Resolution order is non-deterministic, so rebuild from the known layers
  // whenever a provider updates or is toggled in settings.
  function rebuildEmoteMap() {
    emoteMap.clear();
    const ranked = [...activeLoaders].sort((a, b) => loaderRank(a) - loaderRank(b));
    for (const loader of ranked) {
      if (!providerEnabled(loader.provider)) continue;
      if (!loader.isChannel && !globalsEnabled(loader.provider)) continue;
      const entries = loadedProviders.get(loader.key);
      if (!Array.isArray(entries)) continue;
      for (const [code, e] of entries) {
        if (!emoteMap.has(code)) emoteMap.set(code, e);
      }
    }
  }

  // ── Channel lookup ───────────────────────────────────────────────────────
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

  // ── Emote Loaders ────────────────────────────────────────────────────────

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
  //
  // An animated emote carries a second URL map, `animated`, beside `urls`
  // (`…/emote/<id>/animated/2`, an animated WebP); `urls` is then its still
  // first frame (PNG), which the picker shows until hover, as with 7TV.
  function ffzEntries(sets, source) {
    const https = raw => (raw.startsWith('//') ? `https:${raw}` : raw);
    const entries = [];
    for (const set of Object.values(sets ?? {})) {
      for (const e of (set?.emoticons ?? [])) {
        if (e?.modifier) continue;
        const stillRaw = e?.urls?.['2'] ?? e?.urls?.['1'];
        const animRaw = e?.animated?.['2'] ?? e?.animated?.['1'];
        const animated = typeof animRaw === 'string';
        const raw = animated ? animRaw : stillRaw;
        if (typeof raw !== 'string') continue;
        const entry = {
          url: https(raw),
          source,
          animated,
          zeroWidth: false,
        };
        if (animated && typeof stillRaw === 'string') entry.staticUrl = https(stillRaw);
        entries.push([e.name, entry]);
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

  // ── DOM Processing ───────────────────────────────────────────────────────

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

    // Large preview above the label, unless switched off in settings — the
    // emote is already decoded from chat or the picker, so this costs nothing
    // beyond layout.
    const previewUrl = settingsLoad().preview ? safeUrl(wrap.dataset.kteTipUrl ?? '') : '';
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

  // ── Emote context menu ───────────────────────────────────────────────────

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
    pickerRefreshIfBuilt();
    acRefreshOpen();
    return added;
  }

  function pickerRefreshIfBuilt() {
    const panel = document.getElementById('chat-emotes-picker-panel');
    if (panel?.querySelector('#kte-picker-content')) {
      pickerRefreshContent(panel);
      pickerApplyActiveState(panel);
    }
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

  // Records an image's hover frame when it differs from what it shows at rest,
  // so emoteWrapAnimate can swap between them under motion 'hover'.
  function setEmoteHoverSrc(img, emote, url) {
    const hoverUrl = emoteHoverUrl(emote);
    if (!hoverUrl || hoverUrl === url) return;
    img.dataset.kteSrc = url;
    img.dataset.kteAnimSrc = hoverUrl;
  }

  // Covers zero-width overlays too: they are images inside the same wrap.
  function emoteWrapAnimate(wrap, hover) {
    for (const img of wrap.querySelectorAll('img[data-kte-anim-src]')) {
      const url = safeUrl((hover ? img.dataset.kteAnimSrc : img.dataset.kteSrc) ?? '');
      if (url) img.src = url;
    }
  }

  function makeEmoteWrap(code, emote) {
    const url = emoteDisplayUrl(emote);
    const wrap = document.createElement('span');
    wrap.className = 'kte-wrap';
    setEmoteTooltip(wrap, code, emote.source, emoteHoverUrl(emote));
    wrap.addEventListener('mouseenter', () => {
      showTooltip(wrap);
      emoteWrapAnimate(wrap, true);
    });
    wrap.addEventListener('mouseleave', () => {
      hideTooltip();
      emoteWrapAnimate(wrap, false);
    });
    wrap.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      showEmoteMenu(e.clientX, e.clientY, code, emote);
    });

    if (!url) return document.createTextNode(code);

    const img = document.createElement('img');
    img.src = url;
    img.alt = code;
    img.className = 'kte-img';
    setEmoteHoverSrc(img, emote, url);
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
          const zwUrl = emoteDisplayUrl(emote);
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
          setEmoteHoverSrc(zw, emote, zwUrl);
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
    rerenderEmotes();
  }

  // Puts every rendered chat emote back to text and renders it again from the
  // current emoteMap and motion setting, and refreshes an open autocomplete.
  function rerenderEmotes() {
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
      || node.id === CHAT_SETTINGS_ROW_ID
      || node.classList.contains('kte-wrap')
      || node.classList.contains('kte-panel-backdrop')
      || Boolean(node.closest?.(`#kte-picker-content, #kte-ac, #kte-menu, .kte-wrap, .kte-panel-backdrop, #${CHAT_SETTINGS_ROW_ID}`));
  }

  // ── Autocomplete ─────────────────────────────────────────────────────────

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

      const acUrl = emoteDisplayUrl(emote);
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

  // Switching autocomplete off leaves the listeners attached and lets them
  // idle here: acOnKeydown does nothing without an open popup, so Tab and
  // Enter go straight to Kick.
  function acOnInput(e) {
    if (!settingsLoad().autocomplete) return;
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

  // Forgets the previous channel's input and attaches to the current one if
  // it is already there. If it isn't yet, there is nothing to wait on here:
  // the chat observer, already watching the whole body, calls attemptAcAttach
  // whenever the tracked input is missing. This used to run a second
  // body-wide MutationObserver for the same job.
  function waitForInput() {
    attachedAcInput = null;
    attemptAcAttach();
  }

  // ── Settings panel ───────────────────────────────────────────────────────
  // Everything in kte_v2_settings in one modal card. Opened from the picker's
  // settings row and the userscript manager's menu; every change applies at
  // once, and the card re-renders from the store after each one.

  let panelBackdrop = null;
  // Clearing recents takes two clicks; this is the armed state in between.
  // Never survives a close, so the panel can't reopen one click from wiping.
  let panelConfirmClear = false;

  const MOTION_LABELS = { always: 'Always', hover: 'On hover', never: 'Never' };
  const SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' };

  // The 7TV+ face as a line glyph in currentColor, for the header mark: the
  // siblings put a flat green icon on that tinted tile, and the filled tab
  // icon reads as a solid blob at 16px.
  function panelMarkIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '5.5 5.5 53 53');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const add = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      svg.appendChild(node);
    };
    const line = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round' };
    add('circle', { cx: '32', cy: '32', r: '22', ...line, 'stroke-width': '5' });
    add('circle', { cx: '24.5', cy: '27.5', r: '3.5', fill: 'currentColor' });
    add('path', { d: 'M36 27.5 Q39.5 24 43 27.5', ...line, 'stroke-width': '4.5' });
    add('path', { d: 'M22 38 Q32 48 42 38', ...line, 'stroke-width': '5' });
    return svg;
  }

  function panelSwitch(label, on, flip) {
    const row = panelEl('div', 'kte-switch-row');
    const toggle = panelEl('button', 'kte-switch');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-checked', String(on));
    toggle.addEventListener('click', () => {
      settingsUpdate(flip);
      settingsPanelRender();
    });
    row.append(panelEl('span', null, label), toggle);
    return row;
  }

  function panelEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function panelChip(label, on, onClick) {
    const chip = panelEl('button', 'kte-chip', label);
    chip.type = 'button';
    pickerChipState(chip, on);
    chip.addEventListener('click', onClick);
    return chip;
  }

  function panelGroup(label, ...children) {
    const group = panelEl('div', 'kte-panel-group');
    group.append(panelEl('div', 'kte-panel-label', label), ...children);
    return group;
  }

  function panelProviderChips(isOn, flip) {
    const row = panelEl('div', 'kte-panel-chips');
    for (const provider of PROVIDERS) {
      const chip = panelChip(provider, isOn(provider), () => {
        settingsUpdate(store => flip(store, provider));
        applyProviderSettings(); // hides the tooltip and re-renders chat
        pickerRefreshIfBuilt();
        settingsPanelRender();
      });
      chip.dataset.provider = provider;
      row.appendChild(chip);
    }
    return row;
  }

  function settingsPanelRender() {
    const card = panelBackdrop?.querySelector('#kte-panel');
    if (!card) return;
    const store = settingsLoad();
    card.textContent = '';

    const head = panelEl('div', 'kte-panel-head');
    const mark = panelEl('div', 'kte-panel-mark');
    mark.appendChild(panelMarkIcon());
    const titles = panelEl('div', 'kte-panel-titles');
    titles.appendChild(panelEl('div', 'kte-panel-title', 'Third-party emotes'));
    const close = panelEl('button', 'kte-panel-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close emote settings');
    close.addEventListener('click', settingsPanelClose);
    head.append(mark, titles, close);
    card.appendChild(head);

    card.appendChild(panelGroup('Providers',
      panelProviderChips(providerEnabled, (store, provider) => {
        store.providers[provider] = !store.providers[provider];
      }),
      panelEl('div', 'kte-panel-note', 'Hiding a provider removes all of its emotes, from chat too.'),
    ));

    card.appendChild(panelGroup('Global emotes',
      panelProviderChips(globalsEnabled, (store, provider) => {
        store.globals[provider] = !store.globals[provider];
      }),
      panelEl('div', 'kte-panel-note', 'Each provider\'s emotes for every channel. Turn them off to keep only the streamer\'s own set.'),
    ));

    const motionRow = panelEl('div', 'kte-panel-chips');
    for (const mode of MOTION_MODES) {
      motionRow.appendChild(panelChip(MOTION_LABELS[mode], store.motion === mode, () => {
        settingsUpdate(store => { store.motion = mode; });
        rerenderEmotes();
        pickerRefreshIfBuilt();
        settingsPanelRender();
      }));
    }
    const motionNote = prefersReducedMotion()
      ? 'Your system\'s Reduce motion setting is on, so emotes stay still whatever you pick.'
      : 'BTTV serves no still frames, so its animated emotes always move.';
    card.appendChild(panelGroup('Animated emotes', motionRow, panelEl('div', 'kte-panel-note', motionNote)));

    const sizeRow = panelEl('div', 'kte-panel-chips');
    for (const size of Object.keys(EMOTE_SIZES)) {
      sizeRow.appendChild(panelChip(SIZE_LABELS[size], store.size === size, () => {
        settingsUpdate(store => { store.size = size; });
        applyEmoteSize();
        hideTooltip(); // anchored to an emote that just changed size
        settingsPanelRender();
      }));
    }
    card.appendChild(panelGroup('Emote size in chat', sizeRow));

    const switches = panelEl('div', 'kte-switches');
    switches.append(
      panelSwitch('Suggest emotes while typing', store.autocomplete, next => {
        next.autocomplete = !next.autocomplete;
        if (!next.autocomplete) acHide();
      }),
      panelSwitch('Large preview on hover', store.preview, next => {
        next.preview = !next.preview;
      }),
    );
    card.appendChild(panelGroup('Options', switches));

    const used = usageLoad().size;
    const clearRow = panelEl('div', 'kte-panel-chips');
    clearRow.style.gridTemplateColumns = panelConfirmClear ? 'repeat(2, minmax(0, 1fr))' : '1fr';
    const clear = panelChip(panelConfirmClear ? 'Confirm clear' : 'Clear recently used', panelConfirmClear, () => {
      if (!panelConfirmClear) {
        panelConfirmClear = true;
        settingsPanelRender();
        return;
      }
      panelConfirmClear = false;
      usageClear();
      pickerRefreshIfBuilt();
      acRefreshOpen();
      settingsPanelRender();
    });
    clear.classList.add('kte-chip-danger');
    clear.disabled = !used;
    clearRow.appendChild(clear);
    if (panelConfirmClear) {
      clearRow.appendChild(panelChip('Cancel', false, () => {
        panelConfirmClear = false;
        settingsPanelRender();
      }));
    }
    const usedNote = used
      ? `${used} emote${used === 1 ? '' : 's'} remembered for the picker's Recently used section and the autocomplete ranking. Favourites are kept.`
      : 'Nothing remembered yet. Emotes you insert show up in the picker\'s Recently used section.';
    card.appendChild(panelGroup('Recently used', panelEl('div', 'kte-panel-note', usedNote), clearRow));
  }

  // Escape closes the panel, swallowed so the same press can't also close
  // something of Kick's. Only listening while the panel is open.
  function settingsPanelKeydown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    settingsPanelClose();
  }

  function settingsPanelOpen() {
    if (panelBackdrop) return;
    hideTooltip();
    hideEmoteMenu();
    panelBackdrop = panelEl('div', 'kte-panel-backdrop');
    const card = panelEl('div');
    card.id = 'kte-panel';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'Third-party emote settings');
    panelBackdrop.addEventListener('click', e => {
      if (e.target === panelBackdrop) settingsPanelClose();
    });
    panelBackdrop.appendChild(card);
    overlayParent().appendChild(panelBackdrop);
    document.addEventListener('keydown', settingsPanelKeydown, true);
    settingsPanelRender();
    card.querySelector('.kte-panel-close')?.focus();
  }

  function settingsPanelClose() {
    panelConfirmClear = false;
    panelBackdrop?.remove();
    panelBackdrop = null;
    document.removeEventListener('keydown', settingsPanelKeydown, true);
  }

  // ── Chat settings row ────────────────────────────────────────────────────
  // A row in Kick's own chat settings menu (the gear beside Chat, signed-in
  // viewers only) that opens the settings panel. The menu is
  // #chat-settings-panel: an inline popover on desktop, a bottom drawer on
  // narrow screens, with the same list markup in both. Its top level is the
  // one list whose rows carry a ChevronRight icon — sub-pages have a
  // ChevronLeft back button and toggle rows instead. Kick re-renders the list
  // on every open and on coming back from a sub-page, so the chat observer
  // re-injects whenever the panel changes.

  const CHAT_SETTINGS_ROW_ID = 'kte-chat-settings-row';

  function chatSettingsMenuList(panel) {
    return panel?.querySelector('li svg[data-ds-icon="ChevronRight"]')?.closest('ul') ?? null;
  }

  // Kick's close button is the only one in the header with a Cross icon.
  function chatSettingsMenuClose(panel) {
    panel.querySelector('button svg[data-ds-icon="Cross"]')?.closest('button')?.click();
  }

  function chatSettingsRowOpen() {
    const panel = document.getElementById('chat-settings-panel');
    if (panel) chatSettingsMenuClose(panel);
    // A tick later, so the narrow-screen drawer has let go of focus and
    // pointer events before the panel opens over it.
    setTimeout(settingsPanelOpen, 0);
  }

  // Cloned from Kick's own row for the same reason as the picker tab: its
  // padding, hover and height are Tailwind classes a hand-written copy would
  // drift from.
  function chatSettingsBuildRow(template) {
    const row = template.cloneNode(true);
    for (const node of [row, ...row.querySelectorAll('[id], [data-testid]')]) {
      node.removeAttribute('id');
      node.removeAttribute('data-testid');
    }
    row.id = CHAT_SETTINGS_ROW_ID;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');

    const label = row.querySelector('span');
    if (label) label.textContent = 'Third-party emotes';
    const nativeIcon = row.querySelector('svg');
    if (nativeIcon) {
      const icon = pickerBuildTabIcon();
      icon.setAttribute('class', nativeIcon.getAttribute('class') ?? '');
      nativeIcon.replaceWith(icon);
    }

    row.addEventListener('click', chatSettingsRowOpen);
    row.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      chatSettingsRowOpen();
    });
    return row;
  }

  function chatSettingsInject(panel) {
    const list = chatSettingsMenuList(panel);
    if (!list || list.querySelector(`#${CHAT_SETTINGS_ROW_ID}`)) return;
    const template = [...list.children].find(li => li.querySelector('svg[data-ds-icon="ChevronRight"]'));
    if (!template) return;
    list.appendChild(chatSettingsBuildRow(template));
  }

  // ── Emote Picker ─────────────────────────────────────────────────────────

  const PICKER_PROVIDER_LIMIT = 40;
  const PICKER_RECENT_LIMIT = 16;
  const PICKER_INJECT_DELAY = 120;
  const PICKER_SEARCH_DELAY = 150;
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
    setEmoteTooltip(btn, code, emote.source, emoteHoverUrl(emote));
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
    // With motion off (or under reduced motion) the still frame stays put on
    // hover too.
    if (motionMode() !== 'never' && staticUrl && animUrl && staticUrl !== animUrl) {
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
        settingsUpdate(store => { store.providers[provider] = !store.providers[provider]; });
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

    const more = pickerBuildChip('Settings', 'All emote settings');
    more.classList.add('kte-chip-panel');
    more.addEventListener('click', settingsPanelOpen);
    row.appendChild(more);

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

    const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
      const ai = PROVIDERS.includes(a) ? PROVIDERS.indexOf(a) : PROVIDERS.length;
      const bi = PROVIDERS.includes(b) ? PROVIDERS.indexOf(b) : PROVIDERS.length;
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
      msg.textContent = pickerEmptyMessage(query);
      wrap.appendChild(msg);
    } else {
      wrap.appendChild(sectionsContainer);
    }
    return wrap;
  }

  function pickerEmptyMessage(query) {
    if (query) return 'No matching emotes';
    const shown = PROVIDERS.filter(provider => providerEnabled(provider));
    if (!shown.length) return 'Every provider is hidden — turn one back on above';
    if (!emotesSettled) return 'Emotes loading…';
    if (shown.some(provider => !globalsEnabled(provider))) {
      return 'No channel emotes here, and global emotes are off — turn them back on in Settings';
    }
    return 'No emotes for this channel';
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

  // A search rebuilds the whole tab — every section and its first 40 buttons
  // — so wait for a pause in typing instead of rebuilding on every keystroke.
  function pickerAttachSearch(panel, searchInput) {
    if (!searchInput || searchInput._ktePickerSearch) return;
    searchInput._ktePickerSearch = true;
    searchInput.addEventListener('input', () => {
      if (pickerSearchTimer) clearTimeout(pickerSearchTimer);
      pickerSearchTimer = setTimeout(() => {
        pickerSearchTimer = null;
        if (!panel.isConnected || !pickerIsActive(panel)) return;
        pickerRefreshContent(panel);
        pickerApplyActiveState(panel);
      }, PICKER_SEARCH_DELAY);
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
    if (pickerSearchTimer) {
      clearTimeout(pickerSearchTimer);
      pickerSearchTimer = null;
    }
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

  // ── Chat Observer ────────────────────────────────────────────────────────

  function startChatObserver() {
    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(mutations => {
      let pickerPanelToInject = null;
      let chatSettingsChanged = false;

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
          if (added.id === 'chat-settings-panel' || added.closest?.('#chat-settings-panel')
            || added.querySelector?.('#chat-settings-panel')) {
            chatSettingsChanged = true;
            continue;
          }
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
      if (chatSettingsChanged) chatSettingsInject(document.getElementById('chat-settings-panel'));
      // Kick may replace the chat input element during stream switches — piggyback
      // on this observer (already watching body subtree) to re-attach autocomplete
      // when the tracked input disconnects.
      if (!attachedAcInput?.isConnected) attemptAcAttach();
    });
    chatObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-index'] });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

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
    emotesSettled = false;
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
    emotesSettled = true;

    log(`Ready – ${emoteMap.size} emotes for /${channelSlug}`);

    queueVisibleEmoteRefresh(routeChatRefreshDelay());
    queueProviderPickerRefresh();

    // 7TV in particular answers with sporadic 502s, and a single retry 5 s
    // later often lands in the same bad patch, leaving the channel without
    // those emotes until the next navigation. Back off instead; each pass
    // retries only the loaders that are still failing.
    function retryFailedLoaders(loaders, attempt) {
      const delay = PROVIDER_RETRY_DELAYS[attempt];
      log(`${loaders.length} provider(s) failed, retrying in ${delay / 1000}s…`);
      setTimeout(async () => {
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        const results = await Promise.allSettled(loaders.map(loader => loader.fn()));
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        const stillFailing = [];
        let added = 0;
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status !== 'fulfilled') {
            log(`${loaders[i].key} failed again:`, r.reason?.message ?? r.reason);
            stillFailing.push(loaders[i]);
            continue;
          }
          if (Array.isArray(r.value) && applyProviderEntries(loaders[i], r.value)) {
            added += r.value.length;
          }
        }
        if (added) log(`Retry loaded ${added} emotes`);
        if (!stillFailing.length) return;
        if (attempt + 1 < PROVIDER_RETRY_DELAYS.length) {
          retryFailedLoaders(stillFailing, attempt + 1);
        } else {
          log(`Giving up on ${stillFailing.map(loader => loader.key).join(', ')} until the next page load`);
        }
      }, delay);
    }

    if (failedLoaders.length) retryFailedLoaders(failedLoaders, 0);
  }

  // ── Cross-tab sync ───────────────────────────────────────────────────────
  // `storage` fires only in the other tabs, after one of them wrote. Take the
  // new value and repaint whatever shows it, the same way a local change does.
  // Chat re-renders only when something it draws from changed: a size or
  // preview change needs no re-render, and every insert in another tab
  // rewrites the usage key.

  function settingsRenderKey(s) {
    return JSON.stringify([s.providers, s.globals, s.motion]);
  }

  function onStorageSync(e) {
    if (e.storageArea !== localStorage) return;
    const all = e.key === null; // another tab cleared localStorage
    if (all || e.key === SETTINGS_KEY) {
      const before = settingsRenderKey(settingsLoad());
      settings = settingsRead() ?? settings;
      applyEmoteSize();
      if (!settings.autocomplete) acHide();
      if (settingsRenderKey(settings) !== before) {
        applyProviderSettings(); // rebuilds emoteMap and re-renders chat
        pickerRefreshIfBuilt();
      }
    }
    if (all || e.key === USAGE_KEY || e.key === FAVS_KEY) {
      if (all || e.key === USAGE_KEY) usageMap = usageRead() ?? usageMap;
      if (all || e.key === FAVS_KEY) favSet = favRead() ?? favSet;
      pickerRefreshIfBuilt();
      acRefreshOpen();
    }
    settingsPanelRender();
  }

  window.addEventListener('storage', onStorageSync);

  // ── SPA Routing ──────────────────────────────────────────────────────────

  function handleNavigation() {
    initSeq++;
    emotesSettled = false;
    lastNavigationAt = Date.now();
    chatObserver?.disconnect(); chatObserver = null;
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
  // Follow the reduce-motion setting live: re-render chat with the other frame
  // and rebuild the picker, which bakes the choice into its buttons.
  reducedMotionQuery?.addEventListener?.('change', () => {
    rerenderEmotes();
    pickerRefreshIfBuilt();
    settingsPanelRender();
  });

  document.addEventListener('fullscreenchange', () => {
    if (tipEl) reparentOverlay(tipEl);
    if (acDropdown) reparentOverlay(acDropdown);
    hideEmoteMenu();
    settingsPanelClose();
  });

  applyEmoteSize();

  // Not every manager has a menu (Safari's Userscripts extension doesn't); the
  // picker's settings row opens the same panel there.
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Emote settings', settingsPanelOpen);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', waitForDOMThenInit)
    : waitForDOMThenInit();

  // One-time storage cleanup, off the critical path.
  RIC(sweepCache);
})();
