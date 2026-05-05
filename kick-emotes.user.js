// ==UserScript==
// @name         Kick Third-Party Emotes
// @namespace    https://kick.com
// @version      2.6.36
// @description  BetterTTV, 7TV, FrankerFaceZ emotes on Kick.com — cache, zero-width, autocomplete, native picker. Developed for Safari + Userscripts; other browsers/managers untested.
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxMDEwMTMiLz48cmVjdCB4PSIxNCIgeT0iMTQiIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiIgcng9IjEyIiBmaWxsPSIjMjJjNTVlIi8+PGNpcmNsZSBjeD0iMjUiIGN5PSIyNSIgcj0iNCIgZmlsbD0iIzEwMTAxMyIvPjxjaXJjbGUgY3g9IjM5IiBjeT0iMjUiIHI9IjQiIGZpbGw9IiMxMDEwMTMiLz48Y2lyY2xlIGN4PSIyNSIgY3k9IjM5IiByPSI0IiBmaWxsPSIjMTAxMDEzIi8+PGNpcmNsZSBjeD0iMzkiIGN5PSIzOSIgcj0iNCIgZmlsbD0iIzEwMTAxMyIvPjwvc3ZnPg==
// @match        https://kick.com/*
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

  const TAG = '[KickEmotes]';

  const NON_CHANNEL_SLUGS = new Set([
    '', 'home', 'browse', 'following', 'categories', 'search',
    'login', 'register', 'dashboard', 'settings', 'clips', 'videos',
    'subscriptions', 'notifications', 'messages', 'wallet',
  ]);

  const BTTV_CDN = 'https://cdn.betterttv.net/emote';
  const BTTV_API = 'https://api.betterttv.net/3';
  const SEVENTV_API = 'https://7tv.io/v3';
  const SEVENTV_GQL = 'https://7tv.io/v4/gql';
  const FFZ_API = 'https://api.frankerfacez.com/v1';

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

  const INPUT_SELECTORS = [
    '[data-chat-input]',
    '.chat-input-wrapper [contenteditable]',
    '.chat-input [contenteditable]',
    '[contenteditable][placeholder]',
    'div[contenteditable="true"]',
  ];

  // ─── Cache ────────────────────────────────────────────────────────────────

  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  function isValidCacheEntry(e) {
    return Array.isArray(e) && typeof e[0] === 'string' &&
      typeof e[1]?.url === 'string' && e[1].url.startsWith('https://') &&
      typeof e[1]?.source === 'string';
  }

  const Cache = {
    get(key) {
      try {
        const raw = localStorage.getItem(`kte_${key}`);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (!Array.isArray(data) || Date.now() - ts > CACHE_TTL || !data.every(isValidCacheEntry)) {
          localStorage.removeItem(`kte_${key}`);
          return null;
        }
        return data;
      } catch { return null; }
    },
    set(key, data) {
      try { localStorage.setItem(`kte_${key}`, JSON.stringify({ ts: Date.now(), data })); }
      catch { /* quota exceeded – skip silently */ }
    },
  };

  // ─── State ────────────────────────────────────────────────────────────────

  const emoteMap = new Map(); // code → { url, source, animated, zeroWidth }
  const memoryCache = new Map(); // provider key → entries, avoids sync localStorage parse on SPA nav

  let channelSlug = null;
  let chatObserver = null;
  let inputObserver = null;
  let initSeq = 0;
  let emoteVersion = 0;
  let pickerInjectQueued = false;
  let pickerInjectTimer = null;
  let messageProcessQueue = [];
  let messageProcessQueued = false;
  let lastPath = location.pathname;

  let acDropdown = null;
  let acFocusIdx = -1;
  let acMatches = [];
  let acInput = null;
  let tipEl = null;

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
      font-family: sans-serif;
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
      overflow: hidden;
      z-index: 99999;
      min-width: 230px;
      max-width: 320px;
      font-family: sans-serif;
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
      width: auto;
      max-width: 72px;
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
    .kte-src-7tv  { color: #4da6ff; }
    .kte-src-bttv { color: #ff6b6b; }
    .kte-src-ffz  { color: #c084fc; }
    .kte-src-other { color: #22c55e; }

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

    /* Native emote picker tab content */
    #kte-picker-content {
      height: 15rem;
      padding: 8px 10px 8px 20px;
      margin-right: 10px;
      color: #efeff1;
      font-family: sans-serif;
      box-sizing: border-box;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    #kte-picker-content[hidden] { display: none !important; }
    .kte-picker-provider {
      display: block;
    }
    .kte-picker-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .kte-picker-btn {
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
    }
    .kte-picker-btn:hover,
    .kte-picker-btn:focus-visible {
      background: rgba(255, 255, 255, .1);
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
      border: 1px solid rgba(34, 197, 94, .55);
      border-radius: 6px;
      background: rgba(34, 197, 94, .12);
      color: #dcfce7;
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
      background: rgba(34, 197, 94, .2);
      border-color: rgba(34, 197, 94, .85);
      color: #f0fdf4;
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

  function setEmoteTooltip(el, code, source) {
    el.dataset.kteTip = `${code}  ·  ${source}`;
    el.dataset.kteTipCode = code;
    el.dataset.kteTipSource = source;
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  function fetchJSON(url, body) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: body ? 'POST' : 'GET',
        url,
        headers: body
          ? { 'Content-Type': 'application/json', Accept: 'application/json' }
          : { Accept: 'application/json' },
        data: body ? JSON.stringify(body) : undefined,
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            try { resolve(JSON.parse(res.responseText)); }
            catch (e) { reject(e); }
          } else {
            reject(new Error(`HTTP ${res.status}`));
          }
        },
        onerror: reject,
      });
    });
  }

  function pick7TVImage(images, animated) {
    if (animated) {
      // For animated emotes prefer GIF (universally supported) over animated WebP.
      // 7TV v4 uses _static suffix for frozen first-frame variants — avoid those.
      return images.find(i => i.mime === 'image/gif' && i.scale === 2)
        ?? images.find(i => i.mime === 'image/gif')
        ?? images.find(i => i.mime === 'image/webp' && i.scale === 2 && !i.url.includes('_static'))
        ?? images.find(i => i.mime === 'image/webp' && !i.url.includes('_static'))
        ?? images[0];
    }
    return images.find(i => i.mime === 'image/webp' && i.scale === 2)
      ?? images.find(i => i.scale === 2)
      ?? images.find(i => i.mime === 'image/webp')
      ?? images[0];
  }

  // ─── Cache-aware load helper ──────────────────────────────────────────────

  // `fetcher` must return an array of [code, emoteObj] pairs.
  async function cachedLoad(key, fetcher) {
    if (memoryCache.has(key)) return memoryCache.get(key);

    const cached = Cache.get(key);
    if (cached) {
      memoryCache.set(key, cached);
      return cached;
    }

    const entries = await fetcher();
    const safeEntries = Array.isArray(entries) ? entries : [];
    memoryCache.set(key, safeEntries);
    RIC(() => Cache.set(key, safeEntries));
    return safeEntries;
  }

  function applyLoadResults(results) {
    for (const result of results) {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
      for (const [code, e] of result.value) emoteMap.set(code, e);
    }
  }

  // ─── Emote Loaders ────────────────────────────────────────────────────────

  async function loadBTTVGlobal() {
    return cachedLoad('bttv_g', async () => {
      const emotes = await fetchJSON(`${BTTV_API}/cached/emotes/global`);
      return emotes.map(e => [e.code, {
        url: `${BTTV_CDN}/${e.id}/2x${e.animated ? '.gif' : ''}`,
        source: 'BTTV',
        animated: e.animated,
        zeroWidth: false,
      }]);
    });
  }

  async function loadBTTVChannel(slug) {
    return cachedLoad(`bttv_c_${slug}`, async () => {
      const results = await Promise.allSettled(['kick', 'twitch'].map(async platform => {
        const data = await fetchJSON(`${BTTV_API}/cached/users/${platform}/${slug}`);
        const all = [...(data.channelEmotes ?? []), ...(data.sharedEmotes ?? [])];
        return { platform, all };
      }));
      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value.all.length) continue;
        const { platform, all } = r.value;
        return all.map(e => [e.code, {
          url: `${BTTV_CDN}/${e.id}/2x${e.animated ? '.gif' : ''}`,
          source: `BTTV (${platform})`,
          animated: e.animated,
          zeroWidth: false,
        }]);
      }
      return [];
    });
  }

  async function load7TVGlobal() {
    return cachedLoad('7tv_g', async () => {
      const data = await fetchJSON(`${SEVENTV_API}/emote-sets/global`);
      const entries = [];
      for (const e of (data.emotes ?? [])) {
        const host = e.data?.host;
        if (!host) continue;
        const animated = e.data?.animated ?? false;
        const file = animated
          ? (host.files?.find(f => f.name === '2x.gif') ?? host.files?.find(f => f.format === 'GIF')
            ?? host.files?.find(f => f.name === '2x.webp') ?? host.files?.[0])
          : (host.files?.find(f => f.name === '2x.webp') ?? host.files?.find(f => f.name === '2x.avif')
            ?? host.files?.[0]);
        if (!file) continue;
        // ActiveEmoteFlag.ZeroWidth = 1 << 8 = 256 on the emote-set entry flags
        entries.push([e.name, {
          url: `https:${host.url}/${file.name}`,
          source: '7TV',
          animated,
          zeroWidth: (e.flags & 256) !== 0,
        }]);
      }
      return entries;
    });
  }

  async function load7TVChannel(slug) {
    return cachedLoad(`7tv_c_${slug}`, async () => {
      // v4 GQL: search by username, find the user with a matching KICK (or TWITCH) connection
      const query = `{ users { search(query: ${JSON.stringify(slug)}, page: 1, perPage: 10) {
        items {
          connections { platform platformUsername }
          style { activeEmoteSet { emotes { items {
            alias flags { zeroWidth }
            emote { defaultName flags { animated } images { url mime scale } }
          } } } }
        }
      } } }`;
      try {
        const res = await fetchJSON(SEVENTV_GQL, { query });
        const items = res?.data?.users?.search?.items ?? [];
        const slugLower = slug.toLowerCase();
        const user =
          items.find(u => u.connections?.some(c => c.platform === 'KICK' && c.platformUsername.toLowerCase() === slugLower)) ??
          items.find(u => u.connections?.some(c => c.platform === 'TWITCH' && c.platformUsername.toLowerCase() === slugLower));
        if (!user) return [];
        const emotes = user.style?.activeEmoteSet?.emotes?.items ?? [];
        const entries = [];
        for (const e of emotes) {
          const animated = e.emote?.flags?.animated ?? false;
          const images = e.emote?.images ?? [];
          const img = pick7TVImage(images, animated);
          if (!img) continue;
          entries.push([e.alias, {
            url: img.url,
            source: '7TV',
            animated,
            zeroWidth: e.flags?.zeroWidth ?? false,
          }]);
        }
        return entries;
      } catch { return []; }
    });
  }

  async function loadFFZGlobal() {
    return cachedLoad('ffz_g', async () => {
      const data = await fetchJSON(`${FFZ_API}/set/global`);
      const entries = [];
      for (const set of Object.values(data.sets ?? {})) {
        for (const e of (set.emoticons ?? [])) {
          const raw = e.urls?.['2'] ?? e.urls?.['1'];
          if (!raw) continue;
          entries.push([e.name, {
            url: raw.startsWith('//') ? `https:${raw}` : raw,
            source: 'FFZ',
            animated: false,
            zeroWidth: false,
          }]);
        }
      }
      return entries;
    });
  }

  async function loadFFZChannel(slug) {
    return cachedLoad(`ffz_c_${slug}`, async () => {
      try {
        const data = await fetchJSON(`${FFZ_API}/room/${slug}`);
        const entries = [];
        for (const set of Object.values(data.sets ?? {})) {
          for (const e of (set.emoticons ?? [])) {
            const raw = e.urls?.['2'] ?? e.urls?.['1'];
            if (!raw) continue;
            entries.push([e.name, {
              url: raw.startsWith('//') ? `https:${raw}` : raw,
              source: 'FFZ (channel)',
              animated: false,
              zeroWidth: false,
            }]);
          }
        }
        return entries;
      } catch { return []; }
    });
  }

  // ─── DOM Processing ───────────────────────────────────────────────────────

  function hideTooltip() {
    if (tipEl) tipEl.style.display = 'none';
  }

  function showTooltip(wrap) {
    const text = wrap.dataset.kteTip;
    if (!text) return;

    if (!tipEl) {
      tipEl = document.createElement('span');
      tipEl.id = 'kte-tip';
      document.body.appendChild(tipEl);
    }

    tipEl.textContent = '';

    const code = wrap.dataset.kteTipCode;
    const source = wrap.dataset.kteTipSource;
    if (code && source) {
      const codeEl = document.createElement('span');
      codeEl.className = 'kte-tip-code';
      codeEl.textContent = code;

      const sepEl = document.createElement('span');
      sepEl.className = 'kte-tip-sep';
      sepEl.textContent = '·';

      const sourceEl = document.createElement('span');
      sourceEl.className = `kte-tip-source ${sourceClass(source)}`;
      sourceEl.textContent = source;

      tipEl.append(codeEl, sepEl, sourceEl);
    } else {
      tipEl.textContent = text;
    }

    tipEl.style.display = 'inline-flex';

    const rect = wrap.getBoundingClientRect();
    const tipRect = tipEl.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + rect.width / 2, tipRect.width / 2 + 4), window.innerWidth - tipRect.width / 2 - 4);
    const top = Math.max(4, rect.top - tipRect.height - 5);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }

  function makeEmoteWrap(code, emote) {
    const wrap = document.createElement('span');
    wrap.className = 'kte-wrap';
    setEmoteTooltip(wrap, code, emote.source);
    wrap.addEventListener('mouseenter', () => showTooltip(wrap));
    wrap.addEventListener('mouseleave', hideTooltip);

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
          // Overlay this image centred on the previous emote wrap
          const zwUrl = safeUrl(emote.url);
          if (!zwUrl) continue;
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
          // Keep lastWrap — multiple ZW emotes can stack on the same base
        } else {
          const wrap = makeEmoteWrap(token, emote);
          frag.appendChild(wrap);
          lastWrap = wrap;
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
    if (el.dataset.kteDone) return;
    el.dataset.kteDone = '1';

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.classList.contains('kte-wrap') || p.tagName === 'A') return NodeFilter.FILTER_REJECT;
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
      || node.classList.contains('kte-wrap')
      || Boolean(node.closest?.('#kte-picker-content, #kte-ac, .kte-wrap'));
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

  function acSearch(query) {
    if (query.length < 2) return [];
    const lower = query.toLowerCase();
    const results = [];
    for (const [code, emote] of emoteMap) {
      if (code.toLowerCase().startsWith(lower)) results.push({ code, emote });
    }
    results.sort((a, b) => a.code.length - b.code.length || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    return results.slice(0, 8);
  }

  function acHide() {
    acDropdown?.remove();
    acDropdown = null;
    acFocusIdx = -1;
    acMatches = [];
    acInput = null;
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

    acHide();
  }

  function acRender(matches, inputEl) {
    acHide();
    if (!matches.length) return;
    acMatches = matches;
    acInput = inputEl;

    const rect = inputEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.id = 'kte-ac';

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
      if (acUrl) img.addEventListener('error', () => {
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

      row.append(img, nameEl, srcEl);
      row.addEventListener('mousedown', e => { e.preventDefault(); acCommit(code); });
      popup.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.id = 'kte-ac-footer';
    footer.textContent = '↑↓ navigate  ·  Tab select  ·  Esc close';
    popup.appendChild(footer);

    // Anchor to left edge of input, open upward
    popup.style.cssText = `left:${rect.left}px; bottom:${window.innerHeight - rect.top + 6}px;`;
    document.body.appendChild(popup);
    acDropdown = popup;
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
      if (acMatches.length === 1) { e.preventDefault(); acCommit(acMatches[0].code); }
      else if (acFocusIdx >= 0 && acMatches[acFocusIdx]) { e.preventDefault(); acCommit(acMatches[acFocusIdx].code); }
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
    console.log(`${TAG} Autocomplete attached`);
  }

  function waitForInput() {
    inputObserver?.disconnect();
    inputObserver = null;

    const el = acFindInput();
    if (el) { attachAutocomplete(el); return; }

    inputObserver = new MutationObserver(() => {
      const found = acFindInput();
      if (found) {
        inputObserver?.disconnect();
        inputObserver = null;
        attachAutocomplete(found);
      }
    });
    inputObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Emote Picker ─────────────────────────────────────────────────────────

  const PICKER_PROVIDER_LIMIT = 40;
  const PICKER_INJECT_DELAY = 120;
  const PICKER_IMAGE_LOAD_CHUNK = 6;
  const PICKER_IMAGE_LOAD_DELAY = 50;

  function pickerBuildButton(code, emote) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kte-picker-btn';
    btn.setAttribute('aria-label', `Insert ${code}`);
    btn.dataset.code = code;
    setEmoteTooltip(btn, code, emote.source);
    btn.addEventListener('mouseenter', () => showTooltip(btn));
    btn.addEventListener('mouseleave', hideTooltip);

    const url = safeUrl(emote.url);
    if (!url) return null;
    const img = document.createElement('img');
    img.alt = code;
    img.draggable = false;
    img.decoding = 'async';
    img.setAttribute('fetchpriority', 'low');
    img.dataset.kteSrc = url;
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

      if (content._kteImageQueue.length) setTimeout(step, PICKER_IMAGE_LOAD_DELAY);
      else content._kteImageLoading = false;
    }

    requestAnimationFrame(step);
  }

  function pickerQueuePendingImages(content) {
    if (!content) return;
    const pending = [...content.querySelectorAll('img[data-kte-src]:not([data-kte-loaded="1"]):not([data-kte-queued="1"])')];
    if (!content._kteImageQueue) content._kteImageQueue = [];
    for (const img of pending) {
      img.dataset.kteQueued = '1';
      content._kteImageQueue.push(img);
    }
    pickerPumpImageQueue(content);
  }

  function pickerAppendButtons(grid, emotes, start, end) {
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const { code, emote } = emotes[i];
      const btn = pickerBuildButton(code, emote);
      if (btn) frag.appendChild(btn);
    }
    grid.appendChild(frag);
  }

  function pickerMarkContentStale(content) {
    if (content) {
      content.dataset.kteStale = '1';
      content._kteImageQueue = [];
      content._kteImageLoading = false;
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
      pickerAppendButtons(grid, emotes, shown, next);
      shown = next;
      limitEl.textContent = `Showing ${shown} of ${emotes.length}`;
      pickerQueuePendingImages(grid.closest('#kte-picker-content'));
      if (shown >= emotes.length) {
        more.remove();
      } else {
        more.disabled = false;
        more.textContent = 'Load more';
      }
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
  }

  function pickerBuildContent(query) {
    const wrap = document.createElement('div');
    wrap.id = 'kte-picker-content';
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
    for (const [source, emotes] of orderedGroups) {
      if (!emotes.length) continue;
      any = true;
      emotes.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

      const section = document.createElement('div');
      section.className = 'kte-picker-section grid gap-2';

      const hdr = document.createElement('span');
      hdr.className = 'kte-picker-provider text-xs font-medium text-neutral-400';
      hdr.textContent = `${source} (${emotes.length})`;
      section.appendChild(hdr);

      const grid = document.createElement('div');
      grid.className = 'kte-picker-grid';
      grid.addEventListener('mousedown', e => { if (e.target.closest('.kte-picker-btn')) e.preventDefault(); });
      grid.addEventListener('click', e => {
        const b = e.target.closest('.kte-picker-btn');
        if (b?.dataset.code) pickerInsert(b.dataset.code);
      });

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

      sectionsContainer.appendChild(section);
    }

    if (!any) {
      const msg = document.createElement('p');
      msg.className = 'kte-picker-empty';
      msg.textContent = query ? 'No matching emotes' : 'Emotes loading…';
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

  function pickerUnlockElementHeight(el) {
    if (!el?._kteHeightLock) return;
    el.style.height = el._kteHeightLock.height;
    el.style.minHeight = el._kteHeightLock.minHeight;
    el.style.maxHeight = el._kteHeightLock.maxHeight;
    delete el._kteHeightLock;
  }

  function pickerUnlockSize(panel, parts) {
    pickerUnlockElementHeight(parts?.scrollViewport);
    pickerUnlockElementHeight(panel);
  }

  function pickerRefreshContent(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return null;

    const oldContent = panel.querySelector('#kte-picker-content');

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

    if (!content.hidden) {
      content.scrollTop = 0;
      pickerQueuePendingImages(content);
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
      } else {
        pickerQueuePendingImages(content);
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
    if (!active) {
      pickerUnlockSize(panel, parts);
    }
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

  function pickerBuildTabIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 28 28');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const tile = document.createElementNS(ns, 'rect');
    tile.setAttribute('x', '4');
    tile.setAttribute('y', '4');
    tile.setAttribute('width', '20');
    tile.setAttribute('height', '20');
    tile.setAttribute('rx', '7');
    tile.setAttribute('fill', '#22c55e');
    svg.appendChild(tile);

    const addDot = (cx, cy) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('r', '2.2');
      dot.setAttribute('fill', '#101013');
      svg.appendChild(dot);
    };
    addDot('10', '10');
    addDot('18', '10');
    addDot('10', '18');
    addDot('18', '18');

    return svg;
  }

  function pickerBuildTab(nativeTab) {
    const tab = document.createElement('button');
    tab.id = 'kte-picker-tab';
    tab.type = 'button';
    tab.dataset.kteTip = '7TV / BTTV / FFZ emotes';
    tab.addEventListener('mouseenter', () => showTooltip(tab));
    tab.addEventListener('mouseleave', hideTooltip);
    tab.setAttribute('aria-label', 'Third-party emotes');
    tab.setAttribute('data-active', 'false');
    if (nativeTab) tab.className = nativeTab.className;

    tab.appendChild(pickerBuildTabIcon());

    const underline = document.createElement('div');
    underline.className = 'betterhover:group-hover:bg-[#475054] z-common h-0.5 w-full transition-colors duration-300 group-data-[active=true]:!bg-green-500';
    tab.appendChild(underline);
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
      tab = pickerBuildTab(parts.tabsRow.querySelector('button[data-active]'));
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
      pickerRefreshContent(panel);
    } else if (!active && stale) {
      pickerMarkContentStale(content);
      content.remove();
    }
    pickerAttachSearch(panel, parts.searchInput);
    pickerAttachNativeTabs(panel, parts.tabsRow);
    pickerApplyActiveState(panel);
  }

  function queuePickerInject(panel) {
    if (pickerInjectTimer) clearTimeout(pickerInjectTimer);
    pickerInjectQueued = true;
    const seq = initSeq;
    pickerInjectTimer = setTimeout(() => {
      pickerInjectTimer = null;
      requestAnimationFrame(() => {
        pickerInjectQueued = false;
        if (seq !== initSeq) return;
        const target = panel?.isConnected ? panel : document.getElementById('chat-emotes-picker-panel');
        if (target) pickerInject(target);
      });
    }, PICKER_INJECT_DELAY);
  }

  function resetPicker() {
    pickerInjectQueued = false;
    if (pickerInjectTimer) {
      clearTimeout(pickerInjectTimer);
      pickerInjectTimer = null;
    }

    const panel = document.getElementById('chat-emotes-picker-panel');
    if (!panel) return;
    const parts = pickerFindParts(panel);
    pickerUnlockSize(panel, parts);
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
      let shouldCheckPicker = false;

      for (const mut of mutations) {
        // Virtual list recycles elements by changing data-index — clear stale marks
        // so the recycled message container gets reprocessed with its new content.
        if (mut.type === 'attributes' && mut.attributeName === 'data-index') {
          mut.target.querySelectorAll?.('[data-kte-done]').forEach(el => {
            delete el.dataset.kteDone;
          });
          queueProcessMessageTree(mut.target);
        }
        for (const added of mut.addedNodes) {
          if (added.nodeType !== Node.ELEMENT_NODE) continue;
          if (isOwnUINode(added)) continue;
          const containingPicker = added.closest?.('#chat-emotes-picker-panel');
          if (containingPicker) {
            queuePickerInject(containingPicker);
            continue;
          }
          if (added.id === 'chat-emotes-picker-panel') {
            queuePickerInject(added);
            continue;
          }
          shouldCheckPicker = true;
          queueProcessMessageTree(added);
        }
      }

      if (shouldCheckPicker) {
        const pickerPanel = document.getElementById('chat-emotes-picker-panel');
        if (pickerPanel) queuePickerInject(pickerPanel);
      }
    });
    chatObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-index'] });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function currentChannelSlug() {
    const slug = location.pathname.replace(/^\//, '').split('/')[0].toLowerCase();
    return NON_CHANNEL_SLUGS.has(slug) ? null : slug || null;
  }

  async function init() {
    const seq = ++initSeq;
    const slug = currentChannelSlug();
    if (!slug) {
      channelSlug = null;
      emoteMap.clear();
      emoteVersion++;
      acHide();
      hideTooltip();
      resetPicker();
      return;
    }

    channelSlug = slug;
    emoteMap.clear();
    emoteVersion++;
    acHide();
    hideTooltip();
    resetPicker();
    startChatObserver();
    console.log(`${TAG} Loading emotes for /${channelSlug}…`);

    const allLoaders = [loadBTTVGlobal, load7TVGlobal, loadFFZGlobal,
      () => loadBTTVChannel(slug), () => load7TVChannel(slug), () => loadFFZChannel(slug)];

    const failedLoaders = [];

    // Update picker incrementally as each provider resolves
    const promises = allLoaders.map(fn => fn().then(entries => {
      if (seq !== initSeq || currentChannelSlug() !== slug) return;
      if (!Array.isArray(entries) || !entries.length) return;
      for (const [code, e] of entries) emoteMap.set(code, e);
      emoteVersion++;
      queuePickerInject();
    }).catch(() => { failedLoaders.push(fn); }));

    await Promise.allSettled(promises);
    if (seq !== initSeq || currentChannelSlug() !== slug) return;

    console.log(`${TAG} Ready – ${emoteMap.size} emotes for /${channelSlug}`);

    processAllVisible();
    waitForInput();
    queuePickerInject();

    if (failedLoaders.length) {
      console.log(`${TAG} ${failedLoaders.length} provider(s) failed, retrying in 5s…`);
      setTimeout(async () => {
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        const retryResults = await Promise.allSettled(
          failedLoaders.map(fn => fn()),
        );
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        let added = 0;
        for (const r of retryResults) {
          if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
          for (const [code, e] of r.value) { emoteMap.set(code, e); added++; }
        }
        if (added) {
          emoteVersion++;
          console.log(`${TAG} Retry loaded ${added} emotes`);
          document.querySelectorAll('[data-kte-done]').forEach(el => { delete el.dataset.kteDone; });
          processAllVisible();
          queuePickerInject();
        }
      }, 5000);
    }
  }

  // ─── SPA Routing ──────────────────────────────────────────────────────────

  function handleNavigation() {
    initSeq++;
    chatObserver?.disconnect(); chatObserver = null;
    inputObserver?.disconnect(); inputObserver = null;
    emoteMap.clear();
    emoteVersion++;
    acHide();
    hideTooltip();
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

  setInterval(checkRouteChange, 500);

  window.addEventListener('popstate', () => {
    checkRouteChange();
  });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', waitForDOMThenInit)
    : waitForDOMThenInit();
})();
