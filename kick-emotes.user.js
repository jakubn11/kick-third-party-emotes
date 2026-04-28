// ==UserScript==
// @name         Kick Third-Party Emotes
// @namespace    https://kick.com
// @version      2.4.7
// @description  BetterTTV, 7TV, FrankerFaceZ emotes on Kick.com — cache, zero-width, autocomplete, native picker (Safari)
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxODE4MWIiLz4KICA8Y2lyY2xlIGN4PSIzMiIgY3k9IjMwIiByPSIyMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjJjNTVlIiBzdHJva2Utd2lkdGg9IjMiLz4KICA8Y2lyY2xlIGN4PSIyMyIgY3k9IjI1IiByPSI0IiBmaWxsPSIjMjJjNTVlIi8+CiAgPGNpcmNsZSBjeD0iNDEiIGN5PSIyNSIgcj0iNCIgZmlsbD0iIzIyYzU1ZSIvPgogIDxwYXRoIGQ9Ik0yMCAzOCBRMzIgNDkgNDQgMzgiIHN0cm9rZT0iIzIyYzU1ZSIgc3Ryb2tlLXdpZHRoPSIzIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+Cg==
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

  const BTTV_CDN    = 'https://cdn.betterttv.net/emote';
  const BTTV_API    = 'https://api.betterttv.net/3';
  const SEVENTV_API = 'https://7tv.io/v3';
  const SEVENTV_GQL = 'https://7tv.io/v4/gql';
  const FFZ_API     = 'https://api.frankerfacez.com/v1';

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

  const INPUT_SELECTORS = [
    '[data-chat-input]',
    '.chat-input-wrapper [contenteditable]',
    '.chat-input [contenteditable]',
    '[contenteditable][placeholder]',
    'div[contenteditable="true"]',
  ];

  // ─── Cache ────────────────────────────────────────────────────────────────

  const CACHE_TTL = 60 * 60 * 1000; // 1 hour

  const Cache = {
    get(key) {
      try {
        const raw = localStorage.getItem(`kte_${key}`);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(`kte_${key}`); return null; }
        return data;
      } catch { return null; }
    },
    set(key, data) {
      try { localStorage.setItem(`kte_${key}`, JSON.stringify({ ts: Date.now(), data })); }
      catch { /* quota exceeded – skip silently */ }
    },
  };

  // ─── State ────────────────────────────────────────────────────────────────

  // emote value shape: { url, source, animated, zeroWidth }
  /** @type {Map<string, {url:string, source:string, animated:boolean, zeroWidth:boolean}>} */
  const emoteMap = new Map();
  const sectionEmotesMap = new WeakMap(); // section el → emotes[], for IO lazy fill

  let channelSlug  = null;
  let chatObserver = null;
  let pickerInjectQueued = false;
  let lastPath     = location.pathname;

  // Autocomplete
  let acDropdown   = null;
  let acFocusIdx   = -1;
  let acMatches    = [];
  let acInput      = null;

  // ─── Styles ───────────────────────────────────────────────────────────────

  const _style = document.createElement('style');
  _style.textContent = `
    /* Emote base wrapper */
    .kte-wrap {
      display: inline-block;
      position: relative;
      vertical-align: middle;
    }
    .kte-wrap:hover .kte-tip { display: block; }

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

    .kte-tip {
      display: none;
      position: absolute;
      bottom: calc(100% + 5px);
      left: 50%;
      transform: translateX(-50%);
      background: #18181b;
      color: #efeff1;
      font-size: 11px;
      font-family: sans-serif;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 9999;
      border: 1px solid #3f3f46;
      box-shadow: 0 2px 8px rgba(0,0,0,.45);
    }

    /* Autocomplete popup */
    #kte-ac {
      position: fixed;
      background: #18181b;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      box-shadow: 0 4px 20px rgba(0,0,0,.55);
      overflow: hidden;
      z-index: 99999;
      min-width: 220px;
      max-width: 320px;
      font-family: sans-serif;
    }
    #kte-ac-header {
      font-size: 10px;
      color: #71717a;
      padding: 6px 10px 3px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    .kte-ac-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 10px;
      cursor: pointer;
      user-select: none;
    }
    .kte-ac-row:hover,
    .kte-ac-row.kte-focused { background: #27272a; }
    .kte-ac-row img {
      height: 24px;
      width: auto;
      max-width: 72px;
      flex-shrink: 0;
    }
    .kte-ac-code {
      color: #efeff1;
      font-size: 13px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kte-ac-src {
      color: #52525b;
      font-size: 10px;
      flex-shrink: 0;
    }
    #kte-ac-footer {
      font-size: 10px;
      color: #52525b;
      padding: 3px 10px 6px;
      border-top: 1px solid #27272a;
    }

    /* Native emote picker tab — no custom styles needed; native Tailwind classes handle it */
    #kte-picker-content {
      padding: 4px 20px 12px;
      color: #efeff1;
      font-family: sans-serif;
    }
    .kte-picker-section--pending .kte-picker-provider {
      display: none;
    }
    #kte-picker-content[hidden] { display: none !important; }
    .kte-picker-provider {
      color: #a1a1aa;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      margin: 10px 0 5px;
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
    .kte-picker-empty {
      color: #71717a;
      font-size: 12px;
      text-align: center;
      padding: 18px 8px;
      margin: 0;
    }
  `;
  (document.head ?? document.documentElement).appendChild(_style);

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  function fetchJSON(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'application/json' },
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

  function fetchGQL(query) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: SEVENTV_GQL,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        data: JSON.stringify({ query }),
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
      return images.find(i => i.mime === 'image/gif'  && i.scale === 2)
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
    const cached = Cache.get(key);
    if (cached) {
      for (const [code, e] of cached) emoteMap.set(code, e);
      return;
    }
    const entries = await fetcher();
    for (const [code, e] of entries) emoteMap.set(code, e);
    Cache.set(key, entries);
  }

  // ─── Emote Loaders ────────────────────────────────────────────────────────

  async function loadBTTVGlobal() {
    await cachedLoad('bttv_g', async () => {
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
    await cachedLoad(`bttv_c_${slug}`, async () => {
      for (const platform of ['kick', 'twitch']) {
        try {
          const data = await fetchJSON(`${BTTV_API}/cached/users/${platform}/${slug}`);
          const all = [...(data.channelEmotes ?? []), ...(data.sharedEmotes ?? [])];
          if (!all.length) continue;
          return all.map(e => [e.code, {
            url: `${BTTV_CDN}/${e.id}/2x${e.animated ? '.gif' : ''}`,
            source: `BTTV (${platform})`,
            animated: e.animated,
            zeroWidth: false,
          }]);
        } catch { /* try next platform */ }
      }
      return [];
    });
  }

  async function load7TVGlobal() {
    await cachedLoad('7tv_g', async () => {
      const data = await fetchJSON(`${SEVENTV_API}/emote-sets/global`);
      const entries = [];
      for (const e of (data.emotes ?? [])) {
        const host = e.data?.host;
        if (!host) continue;
        const animated = e.data?.animated ?? false;
        const file = animated
          ? (host.files?.find(f => f.name === '2x.gif')   ?? host.files?.find(f => f.format === 'GIF')
          ?? host.files?.find(f => f.name === '2x.webp')  ?? host.files?.[0])
          : (host.files?.find(f => f.name === '2x.webp')  ?? host.files?.find(f => f.name === '2x.avif')
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
    await cachedLoad(`7tv_c_${slug}`, async () => {
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
        const res = await fetchGQL(query);
        const items = res?.data?.users?.search?.items ?? [];
        const slugLower = slug.toLowerCase();
        const user =
          items.find(u => u.connections?.some(c => c.platform === 'KICK'   && c.platformUsername.toLowerCase() === slugLower)) ??
          items.find(u => u.connections?.some(c => c.platform === 'TWITCH' && c.platformUsername.toLowerCase() === slugLower));
        if (!user) return [];
        const emotes = user.style?.activeEmoteSet?.emotes?.items ?? [];
        const entries = [];
        for (const e of emotes) {
          const img = pick7TVImage(e.emote?.images ?? [], e.emote?.flags?.animated ?? false);
          if (!img) continue;
          entries.push([e.alias, {
            url: img.url,
            source: '7TV',
            animated: e.emote?.flags?.animated ?? false,
            zeroWidth: e.flags?.zeroWidth ?? false,
          }]);
        }
        return entries;
      } catch { return []; }
    });
  }

  async function loadFFZGlobal() {
    await cachedLoad('ffz_g', async () => {
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
    await cachedLoad(`ffz_c_${slug}`, async () => {
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

  function makeEmoteWrap(code, emote) {
    const wrap = document.createElement('span');
    wrap.className = 'kte-wrap';

    const img = document.createElement('img');
    img.src = emote.url;
    img.alt = code;
    img.className = 'kte-img';
    img.loading = 'lazy';

    const tip = document.createElement('span');
    tip.className = 'kte-tip';
    tip.textContent = `${code}  ·  ${emote.source}`;

    wrap.appendChild(img);
    wrap.appendChild(tip);
    return wrap;
  }

  function processTextNode(node) {
    const text = node.textContent;
    if (!text || !text.trim()) return;

    const tokens = text.split(/(\s+)/);
    if (!tokens.some(t => emoteMap.has(t))) return;

    const frag = document.createDocumentFragment();
    let lastWrap = null; // anchor for zero-width overlays

    for (const token of tokens) {
      const emote = emoteMap.get(token);

      if (emote) {
        if (emote.zeroWidth && lastWrap) {
          // Overlay this image centred on the previous emote wrap
          const zw = document.createElement('img');
          zw.src = emote.url;
          zw.alt = token;
          zw.className = 'kte-zw';
          zw.loading = 'lazy';
          lastWrap.appendChild(zw);
          const tip = lastWrap.querySelector('.kte-tip');
          if (tip) tip.textContent += ` + ${token}`;
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
    for (const sel of MSG_SELECTORS) document.querySelectorAll(sel).forEach(processMessageEl);
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
    results.sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code));
    return results.slice(0, 8);
  }

  function acHide() {
    acDropdown?.remove();
    acDropdown = null;
    acFocusIdx = -1;
    acMatches  = [];
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
      const pos   = acInput.selectionStart ?? acInput.value.length;
      const head  = acInput.value.slice(0, pos).replace(/\S+$/, '');
      const tail  = acInput.value.slice(pos);
      acInput.value = head + code + ' ' + tail;
      const newPos = head.length + code.length + 1;
      acInput.setSelectionRange(newPos, newPos);
      acInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable — execCommand keeps Vue/React reactivity intact
      const sel = window.getSelection();
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0);
        const node  = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const offset    = range.startOffset;
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
    acInput   = inputEl;

    const rect  = inputEl.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.id    = 'kte-ac';

    const header = document.createElement('div');
    header.id = 'kte-ac-header';
    header.textContent = 'Emotes';
    popup.appendChild(header);

    for (let i = 0; i < matches.length; i++) {
      const { code, emote } = matches[i];
      const row = document.createElement('div');
      row.className = 'kte-ac-row';

      const img = document.createElement('img');
      img.src = emote.url;
      img.alt = code;

      const nameEl = document.createElement('span');
      nameEl.className = 'kte-ac-code';
      nameEl.textContent = code;

      const srcEl = document.createElement('span');
      srcEl.className = 'kte-ac-src';
      srcEl.textContent = emote.source.split(' ')[0]; // "BTTV", "7TV", "FFZ"

      row.append(img, nameEl, srcEl);
      row.addEventListener('mousedown', e => { e.preventDefault(); acCommit(code); });
      popup.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.id = 'kte-ac-footer';
    footer.textContent = '↑↓ navigate  ·  Tab / Enter select  ·  Esc close';
    popup.appendChild(footer);

    // Anchor to left edge of input, open upward
    popup.style.cssText = `left:${rect.left}px; bottom:${window.innerHeight - rect.top + 6}px;`;
    document.body.appendChild(popup);
    acDropdown = popup;
  }

  function acOnInput(e) {
    const word    = acWordBeforeCursor(e.currentTarget);
    const matches = acSearch(word);
    matches.length ? acRender(matches, e.currentTarget) : acHide();
  }

  function acOnKeydown(e) {
    if (!acDropdown) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); acSetFocus(Math.min(acFocusIdx + 1, acMatches.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); acSetFocus(Math.max(acFocusIdx - 1, 0)); }
    else if (e.key === 'Tab' || e.key === 'Enter') {
      if (acFocusIdx >= 0 && acMatches[acFocusIdx]) { e.preventDefault(); acCommit(acMatches[acFocusIdx].code); }
    }
    else if (e.key === 'Escape') { e.preventDefault(); acHide(); }
  }

  function attachAutocomplete(el) {
    if (el._kteAC) return;
    el._kteAC = true;
    el.addEventListener('input',   acOnInput);
    el.addEventListener('keydown', acOnKeydown);
    el.addEventListener('blur',    () => setTimeout(acHide, 150));
    console.log(`${TAG} Autocomplete attached`);
  }

  function waitForInput() {
    const el = acFindInput();
    if (el) { attachAutocomplete(el); return; }
    const obs = new MutationObserver(() => {
      const found = acFindInput();
      if (found) { obs.disconnect(); attachAutocomplete(found); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Emote Picker ─────────────────────────────────────────────────────────

  const RIC = typeof requestIdleCallback === 'function'
    ? (cb) => requestIdleCallback(cb, { timeout: 300 })
    : (cb) => setTimeout(cb, 16);

  const PICKER_CHUNK = 60; // buttons built per idle slice

  function pickerFillChunked(grid, emotes) {
    let i = 0;
    function step() {
      if (!grid.isConnected) return; // grid was replaced — stop the chain
      const frag = document.createDocumentFragment();
      const end = Math.min(i + PICKER_CHUNK, emotes.length);
      for (; i < end; i++) {
        const { code, emote } = emotes[i];
        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'kte-picker-btn';
        btn.title     = `${code} · ${emote.source}`;
        btn.setAttribute('aria-label', `Insert ${code}`);
        btn.dataset.code = code;
        const img = document.createElement('img');
        img.src       = emote.url;
        img.alt       = code;
        img.draggable = false;
        img.loading   = 'lazy';
        img.decoding  = 'async';
        btn.appendChild(img);
        frag.appendChild(btn);
      }
      grid.appendChild(frag);
      if (i < emotes.length) RIC(step);
    }
    RIC(step);
  }

  function pickerInsert(code) {
    const el = acFindInput();
    if (!el) return;
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const pos    = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, pos);
      const after  = el.value.slice(pos);
      const gap    = before && !before.endsWith(' ') ? ' ' : '';
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

  function pickerProviderName(source) {
    return source.split(' ')[0];
  }

  function pickerBuildContent(query) {
    const wrap  = document.createElement('div');
    wrap.id     = 'kte-picker-content';

    const lower = (query ?? '').trim().toLowerCase();
    const groups = new Map();
    for (const [code, emote] of emoteMap) {
      if (lower && !code.toLowerCase().includes(lower)) continue;
      const source = pickerProviderName(emote.source);
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push({ code, emote });
    }

    const providerOrder = ['7TV', 'BTTV', 'FFZ'];
    const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
      const ai = providerOrder.includes(a) ? providerOrder.indexOf(a) : providerOrder.length;
      const bi = providerOrder.includes(b) ? providerOrder.indexOf(b) : providerOrder.length;
      return ai - bi || a.localeCompare(b);
    });

    let any = false;
    let firstRendered = false;
    for (const [source, emotes] of orderedGroups) {
      if (!emotes.length) continue;
      any = true;
      emotes.sort((a, b) => a.code.localeCompare(b.code));

      const section = document.createElement('div');
      section.className = 'kte-picker-section';

      const hdr = document.createElement('div');
      hdr.className = 'kte-picker-provider';
      hdr.textContent = `${source} (${emotes.length})`;
      section.appendChild(hdr);

      const grid = document.createElement('div');
      grid.className = 'kte-picker-grid';
      grid.addEventListener('mousedown', e => { if (e.target.closest('.kte-picker-btn')) e.preventDefault(); });
      grid.addEventListener('click',     e => { const b = e.target.closest('.kte-picker-btn'); if (b?.dataset.code) pickerInsert(b.dataset.code); });

      if (!firstRendered) {
        // First provider: start chunked fill immediately (it's already in view).
        pickerFillChunked(grid, emotes);
        firstRendered = true;
      } else {
        // Remaining providers: defer until scrolled into view.
        section.classList.add('kte-picker-section--pending');
        sectionEmotesMap.set(section, { grid, emotes });
      }

      section.appendChild(grid);
      wrap.appendChild(section);
    }

    if (!any) {
      const msg = document.createElement('p');
      msg.className = 'kte-picker-empty';
      msg.textContent   = query ? 'No matching emotes' : 'Emotes loading…';
      wrap.appendChild(msg);
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
    return { tabsRow, header, mainGrid, searchInput };
  }

  function pickerNativeViews(parts, pickerContent) {
    return [...parts.mainGrid.children].filter(child => (
      child !== parts.header && child !== pickerContent
    ));
  }

  function pickerObserveSections(content) {
    if (content._kteIO) return;
    const pending = [...content.querySelectorAll('.kte-picker-section--pending')];
    if (!pending.length) return;
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        entry.target.classList.remove('kte-picker-section--pending');
        const data = sectionEmotesMap.get(entry.target);
        if (data?.grid.isConnected) pickerFillChunked(data.grid, data.emotes);
      }
    }, { rootMargin: '80px 0px' });
    pending.forEach(s => io.observe(s));
    content._kteIO = io;
  }

  function pickerRefreshContent(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return null;

    const oldContent = panel.querySelector('#kte-picker-content');
    oldContent?._kteIO?.disconnect();

    const tab = panel.querySelector('#kte-picker-tab');
    const content = pickerBuildContent(parts.searchInput?.value ?? '');
    content.dataset.kteChannel = channelSlug ?? '';
    content.hidden = tab?.getAttribute('data-active') !== 'true';

    if (oldContent) oldContent.replaceWith(content);
    else parts.mainGrid.appendChild(content);

    if (!content.hidden) pickerObserveSections(content);
    return content;
  }

  function pickerApplyActiveState(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return;

    const tab = panel.querySelector('#kte-picker-tab');
    const content = panel.querySelector('#kte-picker-content');
    const active = tab?.getAttribute('data-active') === 'true';

    if (content) {
      content.hidden = !active;
      if (active) pickerObserveSections(content);
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
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('width', '28');
    svg.setAttribute('height', '28');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const addCircle = (cx, cy, r, fill) => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy);
      c.setAttribute('r', r);   c.setAttribute('fill', fill);
      svg.appendChild(c);
    };
    addCircle(7.5, 8, 2, '#efeff1');   // left eye
    addCircle(12.5, 8, 2, '#efeff1');  // right eye

    const mouth = document.createElementNS(ns, 'path');
    mouth.setAttribute('d', 'M6 13 Q10 17.5 14 13');
    mouth.setAttribute('stroke', '#efeff1');
    mouth.setAttribute('stroke-width', '1.8');
    mouth.setAttribute('stroke-linecap', 'round');
    svg.appendChild(mouth);

    return svg;
  }

  function pickerBuildTab(nativeTab) {
    const tab = document.createElement('button');
    tab.id = 'kte-picker-tab';
    tab.type = 'button';
    tab.title = '7TV / BTTV / FFZ emotes';
    tab.setAttribute('aria-label', 'Third-party emotes');
    tab.setAttribute('data-active', 'false');
    if (nativeTab) tab.className = nativeTab.className;

    tab.appendChild(pickerBuildTabIcon());

    const label = document.createElement('span');
    label.className = 'text-xs font-medium text-neutral-400';
    label.textContent = '3PE';
    tab.appendChild(label);

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
    if (!content || content.dataset.kteChannel !== (channelSlug ?? '')) pickerRefreshContent(panel);
    pickerAttachSearch(panel, parts.searchInput);
    pickerAttachNativeTabs(panel, parts.tabsRow);
    pickerApplyActiveState(panel);
  }

  function pickerPanelFromNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (node.id === 'chat-emotes-picker-panel') return node;
    return node.querySelector?.('#chat-emotes-picker-panel') ?? null;
  }

  function queuePickerInject(panel) {
    if (pickerInjectQueued) return;
    pickerInjectQueued = true;
    requestAnimationFrame(() => {
      pickerInjectQueued = false;
      const target = panel?.isConnected ? panel : document.getElementById('chat-emotes-picker-panel');
      if (target) pickerInject(target);
    });
  }

  function resetPicker() {
    pickerInjectQueued = false;

    const panel = document.getElementById('chat-emotes-picker-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-kte-native-hidden="1"]').forEach(child => {
      child.hidden = false;
      delete child.dataset.kteNativeHidden;
    });
    panel.querySelector('#kte-picker-tab')?.remove();
    panel.querySelector('#kte-picker-content')?.remove();
  }

  function watchPicker() {
    queuePickerInject();
  }

  // ─── Chat Observer ────────────────────────────────────────────────────────

  function startChatObserver() {
    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(mutations => {
      for (const mut of mutations) {
        // Virtual list recycles elements by changing data-index — clear stale marks
        // so the recycled message container gets reprocessed with its new content.
        if (mut.type === 'attributes' && mut.attributeName === 'data-index') {
          mut.target.querySelectorAll?.('[data-kte-done]').forEach(el => {
            delete el.dataset.kteDone;
          });
        }
        for (const added of mut.addedNodes) {
          if (added.nodeType !== Node.ELEMENT_NODE) continue;
          const pickerPanel = pickerPanelFromNode(added);
          if (pickerPanel) queuePickerInject(pickerPanel);
          for (const sel of MSG_SELECTORS) {
            if (added.matches?.(sel)) processMessageEl(added);
            added.querySelectorAll?.(sel).forEach(processMessageEl);
          }
        }
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
    const slug = currentChannelSlug();
    if (!slug) {
      resetPicker();
      return;
    }

    channelSlug = slug;
    emoteMap.clear();
    acHide();
    console.log(`${TAG} Loading emotes for /${channelSlug}…`);

    await Promise.allSettled([loadBTTVGlobal(), load7TVGlobal(), loadFFZGlobal()]);
    await Promise.allSettled([loadBTTVChannel(slug), load7TVChannel(slug), loadFFZChannel(slug)]);

    console.log(`${TAG} Ready – ${emoteMap.size} emotes for /${channelSlug}`);

    startChatObserver();
    processAllVisible();
    waitForInput();
    watchPicker();
  }

  // ─── SPA Routing ──────────────────────────────────────────────────────────

  new MutationObserver(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    chatObserver?.disconnect(); chatObserver = null;
    resetPicker();
    setTimeout(init, 1200);
  }).observe(document.documentElement, { childList: true, subtree: false });

  window.addEventListener('popstate', () => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      chatObserver?.disconnect(); chatObserver = null;
      resetPicker();
      setTimeout(init, 1200);
    }
  });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => setTimeout(init, 800))
    : setTimeout(init, 800);
})();
