# Kick Third-Party Emotes — Agent Context

Browser userscript that adds BetterTTV, 7TV, and FrankerFaceZ emotes to Kick.com chat.

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-third-party-emotes.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) on any browser; developed and tested on Safari + Userscripts  
**Git:** `git@github.com:jakubn11/kick-third-party-emotes.git` (default branch: `main`).

## Commands

There is no package manager, build step, linter, or automated test suite configured.

- Syntax check: `node --check kick-third-party-emotes.user.js`. Without Node installed, macOS ships a JavaScript engine that can parse-check without executing (the file is an IIFE, so it must not be *run* to be checked):
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -e 'try { new Function(readFile("kick-third-party-emotes.user.js")); print("syntax OK"); } catch (e) { print("SYNTAX ERROR: " + e); }'`
- No build step — the `.user.js` is shipped as-is.

Useful local checks:

```bash
sed -n '1,80p' kick-third-party-emotes.user.js
wc -l kick-third-party-emotes.user.js INSTALL.md
```

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid across all common userscript managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other):

- `@match` should remain scoped to `https://kick.com/*` unless the target changes.
- Add any new remote domains to `@connect`.
- Keep `@grant GM_xmlhttpRequest` if fetching third-party APIs cross-origin.
- `@updateURL` / `@downloadURL` point at the `main` branch on GitHub. If the repo or branch moves, update both.
- Bump `@version` when changing user-facing behavior or provider logic.

Do not add `Co-Authored-By:` trailers to git commits.

## Implementation Map

`kick-third-party-emotes.user.js` is organized into these areas:

- Userscript metadata and constants
- Cache helper using `localStorage` keys prefixed with `kte_v4_` (old-prefix and long-expired keys are swept once per page load)
- Local emote-usage tracker (`kte_v2_usage`) powering autocomplete ranking and the picker's "Recently used" section
- Local favourites store (`kte_v2_favs`) powering the picker's "Favourites" section, the top of the autocomplete ranking, and the ★ markers
- Local settings store (`kte_v2_settings`) — per-provider visibility — surfaced as the chip row at the top of the picker tab
- Module-level provider layers (`loadedProviders` / `activeLoaders`) and `rebuildEmoteMap()`, so a settings change can refilter `emoteMap` without re-running `init()`
- Emote context menu (`#kte-menu`) on right-clicked chat **and picker** emotes
- Channel lookup (`kickChannel` → `sevenTvKickUser` / `ffzRoom` → `channelTwitchId`), shared by the three channel loaders through the short-lived `channelLookups` memo
- Provider loaders for BTTV, 7TV, and FFZ
- DOM message processing and emote replacement
- Autocomplete popup and chat input handling
- Chat `MutationObserver`
- SPA route detection and reinitialization

The central data structure is:

```js
Map<string, { url: string, source: string, animated: boolean, zeroWidth: boolean, staticUrl?: string }>
```

`staticUrl` is optional: a frozen first-frame variant (populated for animated 7TV emotes) used by the picker's animate-on-hover behaviour.

Each provider loader should add `[code, emote]` entries through `cachedLoad()`.

### Storage keys

Two separate namespaces, deliberately:

- **`CACHE_PREFIX` (`kte_v4_`)** — provider data. Bump the prefix whenever the emote schema *or the meaning of a field* changes, so stale entries are refetched instead of served for up to their TTL. (`v2` added `staticUrl`; `v3` gave BTTV entries real `zeroWidth` flags; `v4` fixed 7TV's `zeroWidth` bit and dropped channel sets that had been cached as empty after a failed or misaddressed lookup.) `sweepCache` deletes keys from older prefixes.
- **`USAGE_KEY` / `FAVS_KEY` / `SETTINGS_KEY` (`kte_v2_*`)** — user state. All three are listed in `PRESERVED_KEYS` and are skipped by the sweep, so a cache-prefix bump never wipes someone's favourites, ranking, or settings. Do not derive them from `CACHE_PREFIX`.

### Settings

`kte_v2_settings` holds `{ providers: { '7TV': bool, BTTV: bool, FFZ: bool } }`. Two things are load-bearing:

- **Hidden providers are still fetched.** `allLoaders` runs every provider regardless; `rebuildEmoteMap()` is what filters by `providerEnabled()`. The fetches are cache-backed and cheap, and keeping the layers in `loadedProviders` is what makes re-enabling instant. Do not "optimize" this into skipping the fetch — re-enabling would then need a refetch, and the obvious way to trigger one (`init()`) tears down the picker the user is clicking in.
- **Turning a provider off has to un-render.** Message processing only ever goes text → image, so `unrenderEmoteWraps()` walks `.kte-wrap` elements back to text before the reprocess. It rebuilds tokens from each `img`'s `alt`, which is why the alt must stay set to the emote code on both `.kte-img` and `.kte-zw`. `processTextNode` drops the whitespace preceding an absorbed overlay for the same reason: left in, it orphans on un-render and grows the gap by one space on every toggle cycle. Round-trip stability was verified against a live page across three render/un-render cycles.

`pickerBuildTab()` clones a native tab button (preferring one with an `svg`, so it doesn't copy the avatar tab's `<img>` classes) and replaces its icon with `pickerBuildTabIcon()`, carrying over only the icon's `class`. Do not go back to hand-writing the button's markup: the tabs' sizing, hover and active underline are all Tailwind classes on Kick's side, and a hand-written copy drifts as soon as they restyle — that is how the tab lost its underline once already (`group-data-[active=true]:!bg-green-500` became `group-data-[active=true]:bg-green-500!`). The clone has its `id`/`data-testid` attributes and any label text stripped.

Adding a sixth tab overflows Kick's strip: it is sized to fit its own tabs exactly, and its scroller (`overflow-x: auto`, the `relative w-full max-w-full overflow-y-auto pr-3` box) then paints a horizontal scrollbar under the icons. The `div:has(> #kte-picker-tab)` rules tighten the row's gap to 6px and let the tabs shrink to a 32px floor to claw that width back. Keep the floor above the 28px icon, and don't be tempted to hide the scrollbar instead — the tab would just sit off-screen.

The tab button sizes its own icon (`[&_svg]:size-7 [&_svg]:lg:size-6`) and rounds it (`[&_svg]:rounded-full`), so don't copy width/height attributes onto the icon and don't give it a backplate: an SVG root clips to its border radius, so the corners would be shaved. `pickerBuildTabIcon()` therefore draws `icon.svg`'s winking face without its dark plate, reusing that file's path data verbatim — edit the two together. Its viewBox (`5.5 5.5 53 53`) crops to just outside the face, which spans 10-54, leaving the circle at ~83% of the icon box; widen the crop to shrink the face, tighten it to grow it. Kick's emote icons are images with their own transparent margin, which is why a face drawn edge to edge looks oversized next to them.

The chip row is `position: sticky`, so it would sit on top of the grid once scrolled. `pickerAttachSettingsAutoHide()` observes a 1px `.kte-settings-sentinel` at the very top of `#kte-picker-content` and toggles `data-kte-hidden` on the row. A sentinel rather than a scroll listener because the scroller is not always the same element — the tab scrolls itself when its content overflows, and Kick's panel scrolls it otherwise; an `IntersectionObserver` against the viewport accounts for either one's clipping for free. Detach it in `pickerMarkContentStale()` alongside the image loader.

## External APIs

Current provider endpoints:

- Kick: `/api/v2/channels/<slug>` → `user_id` and `user.username`. Fetched **same-origin with the page's `fetch`**, the way Kick's frontend does, so it is not a GM request and needs no `@connect` entry.
- BetterTTV: `https://api.betterttv.net/3` (`/cached/emotes/global`, `/cached/users/twitch/<twitch id>`)
- 7TV: `https://7tv.io/v3` (`/emote-sets/global`, `/users/kick/<kick user id>`, `/users/twitch/<twitch id>`)
- FrankerFaceZ: `https://api.frankerfacez.com/v1` (`/set/global`, `/room/id/<twitch id>`, `/room/<twitch login>`)

### Channel lookup

The URL slug is not an identity any provider accepts, so channel emotes go through one resolution step (`kickChannel` and friends, memoised per slug for 60 s in `channelLookups` so the three loaders share it):

1. **Kick** turns the slug into the Kick user ID and username. A slug is not always the username: newer accounts with an underscore get a dash in the URL (`xqc_lobotomy` lives at `/xqc-lobotomy`).
2. **7TV** is looked up by Kick user ID. Its user record lists linked accounts, which gives the streamer's **Twitch ID**.
3. Without a 7TV Twitch link, the Twitch ID comes from the **FFZ room** for the Kick username taken as a Twitch login (`room.twitch_id`).
4. **BTTV** uses that Twitch ID. **FFZ** uses the room from step 3, or `room/id/<twitch id>` when 7TV supplied it. **7TV** falls back to `users/twitch/<id>` when Kick isn't linked there.

Order and fallbacks to preserve: 7TV is Kick first, Twitch second; BTTV and FFZ are Twitch only, because neither supports Kick. BTTV's `/cached/users/kick/<id>` 404s for every ID, exactly like a made-up provider name does. Re-check that before adding a Kick attempt back. The Kick lookup is the one hard dependency of every channel loader; a 7TV outage is deliberately swallowed in `linkedTwitchId` so BTTV and FFZ degrade to the by-name lookup instead of failing too.

### Provider quirks

Worth knowing before "fixing" a loader:

- **BTTV's user endpoint takes a numeric platform ID, never a name.** `/cached/users/twitch/forsen` is a 404; `/cached/users/twitch/22484632` is forsen's 269 emotes. Until 2.11.1 the slug was sent, so BTTV channel emotes never loaded.
- **BTTV exposes no zero-width flag.** `BTTV_ZERO_WIDTH` is the same hardcoded overlay list BTTV's own clients ship. If BTTV adds seasonal overlay emotes, extend the set.
- **7TV's zero-width flag is bit `1` on the set entry** (`ActiveEmoteFlag.ZeroWidth`). `data.flags & 256` is the emote's own default, which a set can override; reading `256` off the set entry, as the global loader once did, flags nothing.
- **7TV v3 has no separate `_static` files.** Each entry in `host.files` names its frozen first frame in `static_name` (`2x.webp` → `2x_static.webp`), which is where `staticUrl` comes from.
- **FFZ `modifier: true` entries are not emotes.** They're effect modifiers (`ffzSpin`, `ffzRainbow`, `ffzX`, …) that FFZ clients apply as CSS to the preceding emote. Both FFZ loaders skip them; rendering them standalone produces meaningless 32px icons.
- **Global sets are small** (BTTV ~65, 7TV ~45, FFZ ~10 after modifiers are dropped). A low emote count is not by itself evidence of a broken loader — check the channel sets.
- **7TV's API returns sporadic 502s.** Expect them in testing; they are what the failure handling below is for.

### Failures versus empty sets

Prefer preserving the current graceful-failure behavior. Provider failures should not stop other providers from loading.

A loader may return `[]` only when the provider *answered* that the channel has no emotes there, which means a 404 (`fetchJSONOrNull` / `fetchKickJSONOrNull` turn exactly that into `null`). Every other error has to propagate. A rejected loader is retried once by `init()`, leaves a stale cached set in place, and caches nothing. An empty result is cached for 15 minutes and, on a background refresh, *replaces* the cached set, which is how a single timeout used to blank a channel's emotes mid-session.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `MSG_SELECTORS`
- `SKIP_TEXT_SELECTORS` — ancestors whose text is chrome, not message content. The username is a plain `<button>` inside the message row, so without it a chatter named after an emote gets their name replaced by an image. Keep the button rules narrow: the reply-preview button carries neither `data-prevent-expand` nor `font-bold`, which is what lets emotes still render inside reply quotes.
- `INPUT_SELECTORS`
- `NON_CHANNEL_SLUGS` — plus the popout special case in `currentChannelSlug()`: Kick's popout chat is `/popout/<channel>/chat`, so the channel is the *second* segment there. Verified against the live page — it carries the same chat DOM as embedded chat, so the only thing that ever broke was the slug.

These can be checked against the live site without a Kick account: open a **live** channel (an offline one has no chat DOM at all), then in the console count hits per selector and walk a message row's text nodes through the same `acceptNode` logic `processMessageEl` uses. Measured this way in July 2026: only `MSG_SELECTORS[0]`/`[1]` and the last `INPUT_SELECTORS` fallback matched anything, and chat produced roughly 5 added message elements and 22 mutation batches per 20 s — the body-wide `MutationObserver` costs well under a millisecond of selector work over that window, so it is not worth scoping to the chat container.

When fixing Kick DOM breakage, prefer adding fallback selectors rather than replacing working selectors. After selector changes, manually test:

- Existing visible chat messages
- Newly arriving messages
- Chat input autocomplete
- Channel navigation without a full page reload

## Emote Rendering Notes

- Emote images use `.kte-img`, at 28px, with zero-width overlays matching at `.kte-zw`. Change both together.
- Zero-width emotes overlay the previous emote via `.kte-zw` — 7TV emotes flagged by the provider, plus the BTTV codes in `BTTV_ZERO_WIDTH`. The whitespace token preceding an absorbed overlay is dropped: the overlay is absolutely positioned, so that space renders as a stray gap (chat is `pre-wrap`) and orphans on un-render, growing by one space per toggle cycle.
- Every emote `img` keeps its code in `alt`, on `.kte-zw` overlays as much as on `.kte-img`. That is not just for copy/paste — `unrenderEmoteWraps()` reconstructs the original message tokens from the alts when a provider is switched off.
- `makeEmoteWrap` returns a plain text node when `safeUrl()` rejects the emote's URL. Only elements may anchor a zero-width overlay — a text node has no `dataset` and throws on `appendChild`, which would abort rendering for the whole message. Keep the element check on the zero-width anchor.
- Text nodes are split on whitespace; exact token matches are replaced. Text under a `SKIP_TEXT_SELECTORS` ancestor (links, the username button) is left alone — see DOM And Routing Notes.
- Processed message elements receive `data-kte-version="<emoteVersion>"` to avoid duplicate rendering; bumping `emoteVersion` (provider refresh, channel change, provider toggled in settings) makes them eligible for reprocessing.

Be careful when changing text processing: chat messages can contain links, existing elements, and text nodes inserted incrementally by the Kick frontend.

## Autocomplete Notes

Autocomplete is intentionally lightweight and local:

- It searches loaded emote names with prefix matching first, padding remaining slots with substring matches. Within each group, favourites rank first, then local usage counts (most-used first), with shortest-name-then-alphabetical as the stable tiebreak.
- It displays up to 8 results.
- It supports contenteditable inputs and textarea/input fallbacks.
- It uses `document.execCommand('insertText')` for contenteditable insertion to preserve frontend reactivity.
- Tab completes the top match; Enter completes only an explicitly focused row and otherwise closes the popup and lets Kick send. Closing on Enter is not cosmetic: Kick clears the Lexical editor programmatically, which fires no `input` event, so nothing else would take the popup down.

If modifying autocomplete, test both insertion and keyboard handling in the actual Kick chat input.

## Security

### Rules — always follow these

- **Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML`** with any data that comes from a provider API, the DOM, or user input. Use `textContent` for text and `createElement` + `appendChild` for structure.
- **Always pass emote image URLs through `safeUrl()`** before assigning to `img.src`. `safeUrl` validates both the protocol (`https:`) and the hostname against `ALLOWED_CDN_HOSTS`. Never bypass it.
- **Never add a new CDN domain to `ALLOWED_CDN_HOSTS` without a clear reason.** Each entry is a trusted image source. Adding one carelessly expands the attack surface.
- **Never use native `title` attributes** on script-injected elements. Use `data-kte-tip` + `showTooltip`/`hideTooltip` instead (see UI Design System).
- **Never use `eval`, `new Function(string)`, `setTimeout(string)`, or `setInterval(string)`.**
- **Never trust provider API responses without validation.** Use optional chaining (`?.`) and nullish defaults. Validate shapes before use — see `isValidCacheEntry` as a reference.
- **Never store sensitive data in `localStorage`.** The cache stores emote codes, URLs, and source names; the usage record stores emote codes with insert counts and timestamps; the favourites record stores emote codes. Nothing sensitive, and nothing leaves the machine.
- **Never read back `localStorage` data without validation.** Always run it through the cache schema check (`isValidCacheEntry`) before putting it into `emoteMap`.

### Checks — run mentally before every commit

- Does any new code assign untrusted data to `innerHTML` or similar? → Fix it.
- Does any new code load an image URL without going through `safeUrl`? → Fix it.
- Does any new code add a `title` attribute to an injected element? → Replace with `data-kte-tip`.
- Does any new code fetch from a domain not in `@connect`? → Add it to the metadata and justify why.
- Does any new code introduce a new `localStorage` key? → Make sure reads are validated.
- Does any new code use string-based dynamic execution (`eval`, etc.)? → Remove it.

### Existing security measures (do not remove or weaken)

- `safeUrl()` — CDN allowlist + `https:` protocol check on all emote image URLs
- `isValidCacheEntry()` — schema validation on every `localStorage` cache read
- `ALLOWED_CDN_HOSTS` — explicit set of trusted image hostnames
- `try/catch` on all `localStorage` reads — handles quota errors and malformed JSON silently
- All DOM text written via `textContent` — no HTML injection possible
- Channel slug percent-encoded (`encodeURIComponent`) when interpolated into the Kick API path, and the Kick username likewise in the FFZ by-name path — a crafted kick.com URL can't steer a request to a different path. Kick user IDs and Twitch IDs are checked against `isNumericId` before they go into any provider URL.

## UI Design System

Part of the **kick-\* family** design language (shared with the sibling `kick-fullscreen-chat`, `kick-quality-saver`, `kick-chat-utils`, and `kick-vod-resume` userscripts). All script-injected UI must follow this design language consistently. Do not deviate from it when adding new popups, overlays, or controls.

> **These are literal values, not CSS variables.** This table used to list `--kte-bg`, `--kte-green`, `--kte-border`, `--kte-text`, `--kte-muted` and `--kte-hover` as though the script defined custom properties. **It never has** — every value below is hardcoded in `_style.textContent`. If you came here looking for those variables, they don't exist; don't add them, and don't write `var(--kte-…)` in new rules. The family has no build step and no auto-update, so each script stays self-contained.

### Palette

Values as actually used in the script (verified against `_style.textContent`):

| Value | Usage |
|---|---|
| `#101013` | All popup/overlay backgrounds (`#kte-tip`, `#kte-ac`, `#kte-menu`) |
| `#22c55e` | Signature accent — used exactly once per component |
| `rgba(255,255,255,.1)` | Neutral borders on all sides |
| `#fff` | Primary text (emote names, labels) |
| `rgba(255,255,255,.25)` | Secondary / hint text |
| `rgba(34,197,94,.1)` | Row / button hover/focus background |
| `#71717a` | Dimmed/disabled hint text |

Provider brand colours are **deliberately not** family colours — telling sources apart at a
glance is the feature: 7TV `#4da6ff`, BTTV `#ff6b6b`, FFZ `#c084fc`, anything else `#22c55e`.

The favourite star (`#facc15`, used by `.kte-tip-star`, `.kte-ac-fav`, and the picker button's
`::after` badge) is a semantic colour in the same sense: gold is the universal "starred"
affordance, and reusing `#22c55e` would both break the one-accent-per-component rule and make
the marker read as structure rather than state. It is the only non-provider colour outside the
family palette — do not add more without the same kind of justification.

### Rules

- **One green accent per component.** Use `#22c55e` for one structural element only — a border stripe, a header label, or a badge. Never paint large surfaces green.
- **Backgrounds:** `#101013` with `backdrop-filter: blur(8–12px)`.
- **Borders:** `rgba(255,255,255,.1)` on most sides; the single green accent replaces one border (left stripe or top bar).
- **Box shadow:** `0 8–12px 24–32px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)`.
- **Border radius:** `8px` for popups (`#kte-tip`, `#kte-menu`), `10px` for the larger autocomplete (`#kte-ac`), `4px`/`6px` for small picker controls, `999px` for the picker's pill.
- **Typography:** `font-family: system-ui, -apple-system, "Segoe UI", sans-serif` — the family stack, shared with the sibling scripts. Bold (`font-weight: 700`) for primary labels, `font-weight: 600` for secondary text. *(Until 2.8.5 this was a bare `sans-serif`, which fell through to the browser default on Windows instead of Segoe UI.)*
- **Source badges**: per-provider colors at `opacity: .85`, `font-size: 10px`, `font-weight: 700` — 7TV `#4da6ff`, BTTV `#ff6b6b`, FFZ `#c084fc`, other `#22c55e`.
- **Hover states:** rows and menu items take a `rgba(34,197,94,.1)` background with no border change. The picker's **Load more** — the one accent-filled button — uses the family's selected-chip treatment instead: `rgba(34,197,94,.14)` fill / `rgba(34,197,94,.5)` border / `#4ade80` text at rest, hovering to `.18` / `.6`. Keep it in step with kick-fullscreen-chat's `.kfc-settings-chip.kfc-selected` and kick-quality-saver's `.kqs-chip[data-active]`.
- **Transitions:** `transition: background .08s` on interactive rows/buttons (the picker uses `.12s ease`).
- **No drop shadows in green.** Shadows are always `rgba(0,0,0,…)`.
- **Tooltips** (`#kte-tip`): use the shared `showTooltip(el)` / `hideTooltip()` helpers. Wire via `data-kte-tip` attribute and `mouseenter`/`mouseleave` events. Do not use native `title` attributes on any script-injected element. The tooltip is `position: fixed` and tracks its anchor through the module-level `tipAnchor` plus a capture-phase `scroll` listener — `mouseenter`/`mouseleave` alone are not enough, because chat scrolls under a stationary cursor and a recycled row is removed without ever firing `mouseleave`.

### Reference implementations

- `#kte-tip` — tooltip/hint popup (green left border stripe); a column of `.kte-tip-preview` (64px emote image, box reserved in CSS so positioning is stable before load) above `.kte-tip-label`
- `#kte-ac` — autocomplete dropdown (green top border + green header label)
- `#kte-menu` — emote context menu (green left border stripe)
- `.kte-picker-more` — picker action button (green background tint, green border)
- `.kte-picker-settings` / `.kte-chip` — the picker's settings row, a rounded card (14px radius, hairline border) that auto-hides while the grid is scrolled. It counts as its own component for the one-accent rule: its accent is the selected-chip treatment (matching kick-fullscreen-chat's `.kfc-settings-chip.kfc-selected`), which is why green appears here as well as on `.kte-picker-more`. Provider chips override it with their own brand colour when enabled — same justification as the source badges.

## Manual Testing

Manual testing is required in a browser with a userscript manager installed:

1. Install the userscript via your manager (e.g. drag the `.user.js` file into Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other, or copy it into the folder configured in the Userscripts extension on Safari).
2. Open a Kick channel page.
3. Check the browser developer console for `[KickEmotes]` log lines.
4. Verify global and channel emotes render in chat.
5. Verify autocomplete attaches to the chat input and supports arrow navigation, Tab selection, Enter selection (and plain Enter sending with nothing highlighted), and Esc close.
6. Navigate between Kick channels and confirm channel-specific emotes reload.
7. Right-click a rendered emote and verify the context menu (favourite, copy name, copy image URL, open provider page).
8. Insert a few emotes, reopen the picker's 7TV+ tab, and verify the "Recently used" section and usage-ranked autocomplete.
9. Favourite an emote from chat and from the picker; verify the ★ appears in the tooltip, the autocomplete row, and the picker badge, that the "Favourites" section updates while the picker is open, and that unstarring reverses all of it.
10. Hover an emote in chat and in the picker and verify the tooltip shows the large preview without jumping once the image loads.
11. Hover an emote in a busy chat without moving the cursor: the tooltip should track the emote as messages scroll it up, and disappear once the emote scrolls out or its row is recycled.
12. Toggle a provider chip off and on in the picker: its section and emotes should vanish from the picker, autocomplete, and *already-rendered* chat messages, and come back intact. Toggle repeatedly and confirm no spaces accumulate around zero-width emotes.
13. Scroll the picker grid and confirm the settings chip row hides, then scroll back to the top and confirm it returns. Check both scroll cases: the tab's own scrollbar, and a short tab where Kick's panel is the scroller.
14. Open `/popout/<channel>/chat` and confirm channel emotes load, not just globals.
15. Post `cvMask` after another emote in a channel with BTTV loaded and verify it overlays rather than sitting beside it.
16. Compare the 7TV+ tab button against Kick's native tabs: same size and spacing, the active underline appears under it when the tab is selected, and no horizontal scrollbar shows under the tab strip.
17. Open a channel whose URL has a dash where the username has an underscore (e.g. `/xqc-lobotomy`) and confirm its 7TV channel emotes load. Open one with Twitch BTTV emotes (e.g. `/trainwreckstv`) and confirm BTTV channel emotes load, tagged `BTTV (twitch)`.

## Documentation

Update `INSTALL.md` when installation steps, supported providers, troubleshooting guidance, or user-visible behavior changes.

Keep docs browser-agnostic. When mentioning installation steps, cover the general flow and call out manager-specific differences (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) where they matter.

## Before Every Commit

Before committing any change, always:

1. **Run the syntax check** (see **Commands**) — it must print `syntax OK`.
2. **Bump `@version`** in the `kick-third-party-emotes.user.js` metadata header using these rules:

   | Change | Bump | Example |
   |---|---|---|
   | New user-facing feature — new provider, new UI component, new keyboard shortcut | **minor** `x.+1.0` | `2.6.x → 2.7.0` |
   | Bug fix, style tweak, refactor, internal change | **patch** `x.x.+1` | `2.6.x → 2.6.x+1` |
   | Breaking change or full rewrite | **major** `+1.0.0` | `2.x.x → 3.0.0` |

3. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
4. **Update `README.md`** if the change is user-facing: new or removed features, changed behaviour, new keyboard shortcuts, provider changes, or updated troubleshooting steps. Internal refactors and bug fixes that don't change user-facing behaviour do not require a README update.
5. **Suggest a GitHub Release** after every commit if any of the following apply — say "this looks like a good point to publish a GitHub Release":
   - A security fix was made
   - A user-facing feature was added (new provider, new UI component, new keyboard shortcut)
   - A bug affecting core functionality was fixed (emotes not loading, autocomplete broken, picker missing)

   Do NOT suggest a release for: docs-only changes, internal refactors, formatting, style tweaks the user won't notice.
