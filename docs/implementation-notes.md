# Kick Third-Party Emotes — Implementation Notes

The long form of [AGENTS.md](../AGENTS.md): why each piece is the way it is, what was verified and when, and the bugs each rule prevents. AGENTS.md keeps the short rules and points here. Read the section for the code you are changing before changing it. Section names in bold, like **Commands**, refer to AGENTS.md.

When something new is learned (a verification, a root cause, an upstream change), record it here and in `CHANGELOG.md`. Add to AGENTS.md only if it creates a new rule.

## Implementation Map

`kick-third-party-emotes.user.js` is organized into these areas:

- Userscript metadata and constants
- `VERSION` — bumped with `@version` on every release; logged once at boot (`[KickEmotes] v… active`) and named in the duplicate warning
- Single-instance guard (2.11.2) — right after `VERSION` and the `UI_TEXT` table, before any state or listener exists. Marks `<html>` with `data-kte-running="<version>"`; a later copy sees the marker, `console.warn`s naming both versions (`uiText().duplicate`, since 2.20.0 — which is why `UI_TEXT` / `uiText()` sit above the guard: a `const` read before its line throws; `kickLang()` is a hoisted function declaration further down), and `return`s. On `<html>`, not `window`, because the script runs sandboxed and managers disagree on whether sandboxes share a JS context — they always share the DOM
- Cache helper using `localStorage` keys prefixed with `kte_v5_` (old-prefix and long-expired keys are swept once per page load)
- Local emote-usage tracker (`kte_v2_usage`) powering autocomplete ranking and the picker's "Recently used" section
- Local favourites store (`kte_v2_favs`) powering the picker's "Favourites" section, the top of the autocomplete ranking, and the ★ markers
- Local settings store (`kte_v2_settings`) — provider visibility, global sets, autocomplete, motion, emote size and hover preview — the providers surfaced as the chip row at the top of the picker tab, everything in the settings panel
- Settings panel (`#kte-panel` in `.kte-panel-backdrop`) — a modal card opened by a row in Kick's chat settings menu and the manager menu command. The picker's chip row stays providers-only: a **Settings** chip there wrapped onto a second line, the same reason 2.11.0 took the size chips out of it. Its words (2.17.0) come from `uiText()` — `UI_TEXT[kickLang()]`, the same languages as `CHAT_SETTINGS_ROW_LABELS` (the panel's title), else English — read on every `settingsPanelRender()`. Chip labels are keyed by the `MOTION_MODES` / `EMOTE_SIZES` keys; `usedNote` takes the count as `{n}` in a count-first wording that needs no plural, and English alone adds `usedOne`. Chip labels must fit the 3-column grid at 380px without the ellipsis (several were shortened for that: *Beim Hover*, *Ao passar*, …); `test/ui-text.test.js` checks every language has every key and placeholder. The 7TV+ tab takes its words from the same table since 2.18.0 (headings, Load more / Show less, the *Showing* count, empty messages, tooltips and labels; read on every build). Its sections keep English keys in `data-kte-label` (`pickerBuildSection(label, emotes, saved, key)`), so the shown-count restore doesn't depend on the language. The right-click menu (`showEmoteMenu()`) and the autocomplete's heading and key hint (`acRender()`) use it too since 2.19.0; `acHint` keeps the key names. Since 2.20.0 the console lines do too — the boot line (`active`), the duplicate warning (`duplicate`), *Autocomplete attached* and the load / ready / retry / give-up status lines in `init()` — and the manager-menu entry (`menuSettings`, registered once at boot, so it keeps the language of page load). A provider's `… failed:` / `… failed again:` lines stay English, for bug reports. Provider names stay as they are
- Cross-tab sync (`onStorageSync`, the `storage` listener) — takes in the user-state keys written by other Kick tabs; see Storage keys
- Chat settings row (`#kte-chat-settings-row`) — **Third-party emotes** in Kick's own chat settings menu; see DOM And Routing Notes
- Module-level provider layers (`loadedProviders` / `activeLoaders`) and `rebuildEmoteMap()`, so a settings change can refilter `emoteMap` without re-running `init()`
- Emote context menu (`#kte-menu`) on right-clicked chat **and picker** emotes. It lives in `<body>`, outside Kick's picker, which closes on any outside press; `emoteMenuGuard` stops presses on the menu in window capture (ahead of any of Kick's document listeners) and cancels mousedown so focus stays put, then runs the clicked item's `_kteAction` itself. Don't move item actions back to their own `click` listeners — the guard stops the event before it reaches them
- Channel lookup (`kickChannel` → `sevenTvKickUser` / `ffzRoom` → `channelTwitchId`), shared by the three channel loaders through the short-lived `channelLookups` memo
- Provider loaders for BTTV, 7TV, and FFZ
- DOM message processing and emote replacement
- Autocomplete popup and chat input handling
- Chat `MutationObserver` — the only body-wide observer; it also (re)attaches autocomplete whenever the tracked input is missing, which is why `waitForInput()` doesn't observe anything itself
- SPA route detection and reinitialization

The central data structure is:

```js
Map<string, { url: string, source: string, animated: boolean, zeroWidth: boolean, staticUrl?: string }>
```

`staticUrl` is optional: a frozen first-frame variant (populated for animated 7TV and FFZ emotes; BTTV has none) used by the picker's animate-on-hover behaviour and, under reduced motion, everywhere an emote is shown (`emoteDisplayUrl`).

Each provider loader should add `[code, emote]` entries through `cachedLoad()`.

When two sets share a code, `rebuildEmoteMap()` keeps the one from the higher-ranked layer (`loaderRank`): every channel set outranks every global set, and within a tier the `PROVIDERS` order applies — 7TV, then BTTV, then FFZ. 7TV leads because it is the only provider that knows Kick accounts. Precedence is explicit on purpose: it used to fall out of `allLoaders` order, which made channel sets last-wins and let an old Twitch FFZ emote shadow the streamer's 7TV one. Reordering `allLoaders` changes nothing now.

### Storage keys

Two separate namespaces, deliberately:

- **`CACHE_PREFIX` (`kte_v5_`)** — provider data. Bump the prefix whenever the emote schema *or the meaning of a field* changes, so stale entries are refetched instead of served for up to their TTL. (`v2` added `staticUrl`; `v3` gave BTTV entries real `zeroWidth` flags; `v4` fixed 7TV's `zeroWidth` bit and dropped channel sets that had been cached as empty after a failed or misaddressed lookup; `v5` replaced FFZ's cached still frames with animated URLs.) `sweepCache` deletes keys from older prefixes.
  Provider data is capped at `CACHE_BUDGET` (1.5M UTF-16 code units, the unit browsers count against the ~5M quota): `Cache.set` evicts our oldest entries until the write fits, and if the browser still throws on quota it keeps evicting ours before giving up the write. The quota belongs to kick.com and is shared with Kick's own data, and one big channel's sets run to ~200K, so uncapped the cache could fill it within the 7-day sweep window and break Kick's writes as well as ours. Ages come from `cacheValueTs`, which reads the `ts` off the front of the string without parsing the set — `Cache.set` must keep writing `ts` as the first property.
- **`USAGE_KEY` / `FAVS_KEY` / `SETTINGS_KEY` (`kte_v2_*`)** — user state. **Every open Kick tab writes these keys**, so each store has a `*Read()` (the stored copy, or `null` when storage can't be read), and every write goes read → change → write at once: `usageBump()` / `usageClear()`, `favToggle()`, and `settingsUpdate(mutate)`, the only way to change a setting. Never save a tab's in-memory copy on a timer — that is how a cleared *Recently used* list came back before 2.13.0. Between writes, `onStorageSync()` (the `storage` listener, which fires only in the other tabs) takes in the new value and repaints: chat re-renders only when `settingsRenderKey()` (providers, globals, motion) changed, since every insert anywhere rewrites the usage key. A read that throws keeps the in-memory copy; don't let it fall back to defaults and get written over the store. All three are listed in `PRESERVED_KEYS` and are skipped by the sweep, so a cache-prefix bump never wipes someone's favourites, ranking, or settings. Do not derive them from `CACHE_PREFIX`.

### Settings

`kte_v2_settings` holds `{ providers: { '7TV': bool, BTTV: bool, FFZ: bool }, globals: { same keys }, autocomplete: bool, motion: 'always' | 'hover' | 'never', size: 'small' | 'medium' | 'large', preview: bool }`. `settingsFromRecord()` reads it field by field against `settingsDefaults()`, so a 2.12 record (`providers` only) keeps its choices and takes the defaults for the rest. Add new fields the same way rather than versioning the key.

- **`globals` filters in `rebuildEmoteMap()`**, next to `providerEnabled()`: a loader with `isChannel: false` is skipped when its provider's globals are off. Same reasoning as below — the set stays loaded.
- **`size` is a CSS variable, not a re-render.** `applyEmoteSize()` sets `--kte-emote-size` on `<html>` (from `EMOTE_SIZES`, px) at boot and on change; `.kte-img` and `.kte-zw` read it, so rendered emotes resize in place, inside fullscreen too.
- **`preview: false` drops only the image** from `showTooltip()`; the name/provider label still shows.
- **The Recently used group shows the emotes** from `pickerRecentEmotes('')`, the picker's own list, so the two always agree (only codes in the current `emoteMap`; the count in the note is every remembered code). `panelRecentStrip()` tiles carry the chat tooltip and animate-on-hover but no click or context menu, since the chat input and Kick's UI sit behind the modal. `#kte-tip` is at the top `z-index` so it shows above the panel's backdrop.
- **Clear recently used** is `usageClear()` on `kte_v2_usage`, not a setting. Two clicks (`panelConfirmClear`, reset by `settingsPanelClose()`), the same arm-then-confirm as kick-quality-saver's *Reset all pins*. Favourites are their own key and stay.
- **`autocomplete: false` leaves the listeners attached.** `acOnInput()` returns early, and `acOnKeydown()` already does nothing without an open popup, so Tab and Enter reach Kick untouched. Switching it back on needs no re-attach.

Two things are load-bearing for the provider toggles:

- **Hidden providers are still fetched.** `allLoaders` runs every provider regardless; `rebuildEmoteMap()` is what filters by `providerEnabled()`. The fetches are cache-backed and cheap, and keeping the layers in `loadedProviders` is what makes re-enabling instant. Do not "optimize" this into skipping the fetch — re-enabling would then need a refetch, and the obvious way to trigger one (`init()`) tears down the picker the user is clicking in.
- **Turning a provider off has to un-render.** Message processing only ever goes text → image, so `unrenderEmoteWraps()` walks `.kte-wrap` elements back to text before the reprocess. It rebuilds tokens from each `img`'s `alt`, which is why the alt must stay set to the emote code on both `.kte-img` and `.kte-zw`. `processTextNode` drops the whitespace preceding an absorbed overlay for the same reason: left in, it orphans on un-render and grows the gap by one space on every toggle cycle. Round-trip stability was verified against a live page across three render/un-render cycles.

`pickerBuildTab()` clones a native tab button (preferring one with an `svg`, so it doesn't copy the avatar tab's `<img>` classes) and replaces its icon with `pickerBuildTabIcon()`, carrying over only the icon's `class`. Do not go back to hand-writing the button's markup: the tabs' sizing, hover and active underline are all Tailwind classes on Kick's side, and a hand-written copy drifts as soon as they restyle — that is how the tab lost its underline once already (`group-data-[active=true]:!bg-green-500` became `group-data-[active=true]:bg-green-500!`, and by November 2026 the green itself was `bg-kick-voltGreen-150!`). The hand-built fallback, used only when there is no native tab to clone, carries that class; refresh it from a live tab when Kick restyles. The clone has its `id`/`data-testid` attributes and any label text stripped.

Adding a sixth tab overflows Kick's strip: it is sized to fit its own tabs exactly, and its scroller (`overflow-x: auto`, the `relative w-full max-w-full overflow-y-auto pr-3` box) then paints a horizontal scrollbar under the icons. The `div:has(> #kte-picker-tab)` rules tighten the row's gap to 6px and let the tabs shrink to a 32px floor to claw that width back. Keep the floor above the 28px icon, and don't be tempted to hide the scrollbar instead — the tab would just sit off-screen. The tabs' size lives in `flex-basis` (44px, 40px from 1024px up — Kick's `size-11 lg:size-10`) with `width: auto`, not in their width: that keeps their max-content contribution at the 32px floor, so the row's `min-width: max-content` only grows it once every tab is at the floor.

The grey track under the tabs is Kick's own `div.absolute h-0.5` (`left-0 right-3 bottom-1.5`), a sibling of the row inside that scroller. Being absolute, it spans the scroller's *visible* width, not its content, so once the strip scrolls it stops short of the last tab — ours (checked November 2026). With our tab present that div is hidden and the row draws the track itself as a `::after` in Kick's `--color-surface-fg-decorative`; the tab underlines are `z-index: 1` flex items and paint over it.

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
- **FFZ animated emotes come in a second URL map.** An animated entry has `animated: { '1', '2', '4' }` (`…/emote/<id>/animated/2`, animated WebP) beside `urls`, which is then its still PNG frame — `ffzEntries` uses the first as `url` and the second as `staticUrl`. They are rare (lirik's `fallDamage` is one); most rooms have none.
- **FFZ `modifier: true` entries are not emotes.** They're effect modifiers (`ffzSpin`, `ffzRainbow`, `ffzX`, …) that FFZ clients apply as CSS to the preceding emote. Both FFZ loaders skip them; rendering them standalone produces meaningless 32px icons.
- **Global sets are small** (BTTV ~65, 7TV ~45, FFZ ~10 after modifiers are dropped). A low emote count is not by itself evidence of a broken loader — check the channel sets.
- **7TV's API returns sporadic 502s.** Expect them in testing; they are what the failure handling below is for, and why it backs off over three retries rather than trying once.
- **`GM_xmlhttpRequest` calls `onerror` with the response object, not an `Error`.** `fetchJSON` wraps it (and `onabort`) in a real `Error`, so the `failed:` log line has a reason and an aborted request can't leave a loader pending forever.

### Failures versus empty sets

Prefer preserving the current graceful-failure behavior. Provider failures should not stop other providers from loading.

A loader may return `[]` only when the provider *answered* that the channel has no emotes there, which means a 404 (`fetchJSONOrNull` / `fetchKickJSONOrNull` turn exactly that into `null`). Every other error has to propagate. A rejected loader is retried by `init()` after each of `PROVIDER_RETRY_DELAYS` (5 s, 15 s, 45 s — only the still-failing loaders each time), leaves a stale cached set in place, and caches nothing. An empty result is cached for 15 minutes and, on a background refresh, *replaces* the cached set, which is how a single timeout used to blank a channel's emotes mid-session.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `MSG_SELECTORS`
- `SKIP_TEXT_SELECTORS` — ancestors whose text is chrome, not message content. The username is a plain `<button>` inside the message row, so without it a chatter named after an emote gets their name replaced by an image. Keep the button rules narrow: the reply-preview button carries neither `data-prevent-expand` nor `font-bold`, which is what lets emotes still render inside reply quotes.
- `INPUT_SELECTORS`
- `NON_CHANNEL_SLUGS` — site pages that would otherwise read as a channel slug. The channel API can't decide this: short words like `home`, `login` and `clips` are real usernames there, but on kick.com the route wins. Check a candidate by fetching `https://kick.com/<path>` and reading its `<title>` (a channel reads `<Name> Stream - Watch Live on Kick`). Plus the popout special case in `currentChannelSlug()`: Kick's popout chat is `/popout/<channel>/chat`, so the channel is the *second* segment there. Verified against the live page — it carries the same chat DOM as embedded chat, so the only thing that ever broke was the slug.

These can be checked against the live site without a Kick account: open a **live** channel (an offline one has no chat DOM at all), then in the console count hits per selector and walk a message row's text nodes through the same `acceptNode` logic `processMessageEl` uses. Measured this way in July 2026: only `MSG_SELECTORS[0]`/`[1]` and the last `INPUT_SELECTORS` fallback matched anything, and chat produced roughly 5 added message elements and 22 mutation batches per 20 s — the body-wide `MutationObserver` costs well under a millisecond of selector work over that window, so it is not worth scoping to the chat container.

### Chat settings menu

The gear beside **Chat** opens `#chat-settings-panel`, and only for signed-in viewers — logged out, it opens a sign-in dialog, so inspecting it needs a Kick account in the browser. Two layouts carry the same id and the same `ul > li` rows (checked November 2026):

- **Desktop:** an inline popover inside `#chatroom-footer`. Closing it collapses it to height 0 and leaves it mounted, with our row still in it.
- **Narrow screens:** a vaul bottom drawer (`data-vaul-drawer`, Radix dialog). It is modal, so `<body>` gets `pointer-events: none` until it has finished closing — why `.kte-panel-backdrop` sets `pointer-events: auto` itself, and why `chatSettingsRowOpen()` opens the panel a tick after closing the menu.

The top level is found by its rows' `ChevronRight` icons (`svg[data-ds-icon="ChevronRight"]`); sub-pages (*Identity*, *Chat appearance*, *Muted users*) have a `ChevronLeft` back button and no such list. Kick re-renders the list on every visit, so the chat observer calls `chatSettingsInject()` whenever nodes land in the panel. The observer only sees the menu *change*, so `init()` also calls it once right after `startChatObserver()`, for a menu that was already open when the script started (2.15.9). `chatSettingsInject()` is idempotent (it skips a list that already holds the row) and a no-op with the menu closed. Our row is a clone of a native one with its text swapped (the label from `chatSettingsRowLabel()`, 2.16.0: `CHAT_SETTINGS_ROW_LABELS[kickLang()]`, the primary subtag of `<html lang>`, which Kick sets from the viewer's language for the 28 languages it serves, else English; the span is tagged `data-kick-family-label` and `chatSettingsInject()` relabels an existing row in place when the language changes; keep the table in step with kick-chat-utils' `HISTORY_ROW_LABELS`), appended last, below *Pop out chat*. It keeps Kick's metrics but wears the family look (2.15.10): `data-kick-family-row` on the `li` and the chevron replaced by a `[data-kick-family-tile]` span holding `panelMarkIcon()`. The stylesheet's *Family rows* block puts the family rows on one `#101013` card (top edge on the first, after Kick's rows; bottom edge on the last, found with `:has()`), plus the green tile and a hover/focus the row paints itself — the family button hover, green tint over `#101013` — with Kick's own hover cleared on everything inside the row (2.15.12), and, since 2.21.1, Kick's `hover:` / `focus…:` / `active:` / `highlighted` classes dropped from the clone by `familyRowStripKickStates()` — Kick's `betterhover:hover:bg-[#2A2D32]!` is a `!important` inside Tailwind's cascade layer, which outranks the stylesheet's unlayered `!important`, so CSS alone can't clear it (kick-chat-utils has the same helper); kick-chat-utils ships the identical block for its **Moderation history** row, so keep the two in step. The template is always a native row, never one tagged `data-kick-family-row`. The menu is closed through its `Cross` button before the panel opens.

### Emote picker

`#chat-emotes-picker-panel` only exists where you can post: logged out, the emote button opens a sign-in dialog, and on a **followers-only** chat you don't follow the button isn't rendered at all (no `Smile` icon in `#chatroom-footer`). To inspect the picker, use a signed-in browser on a channel whose chat is open to you.

When fixing Kick DOM breakage, prefer adding fallback selectors rather than replacing working selectors. After selector changes, manually test:

- Existing visible chat messages
- Newly arriving messages
- Chat input autocomplete
- Channel navigation without a full page reload

## UI Design System

The family-wide spec (palette, type, radii, shadows, components, states, motion, layers) is [DESIGN.md](DESIGN.md), word for word the same in every kick-* repo and checked by `test/family-style.js`. Read it before adding or restyling UI. This section keeps only what is specific to this script; where the two disagree, DESIGN.md wins.

Every value is a literal in `_style.textContent`. Earlier versions of this file listed `--kte-bg`, `--kte-green` and similar as if the script defined CSS variables; it never has, so don't add them or write `var(--kte-…)`.

### Script-specific colours

| Value | Usage |
|---|---|
| `rgba(255,255,255,.4)` | Hint text (`#kte-ac-footer`) — the family's note grey |
| `rgba(255,255,255,.25)` | The tooltip's `·` separator |
| `#71717a` / `#efeff1` | Muted and primary text inside the 7TV+ tab, matching Kick's own emote picker around it |

Provider brand colours are **deliberately not** family colours — telling sources apart at a
glance is the feature: 7TV `#4da6ff`, BTTV `#ff6b6b`, FFZ `#c084fc`, anything else `#22c55e`.

The favourite star (`#facc15`, used by `.kte-tip-star`, `.kte-ac-fav`, and the picker button's
`::after` badge) is a semantic colour in the same sense: gold is the universal "starred"
affordance, and reusing `#22c55e` would both break the one-accent-per-component rule and make
the marker read as structure rather than state. Apart from the 7TV+ tab's Kick-matching text, it is the only non-provider colour outside the
family palette — do not add more without the same kind of justification.

### Rules

- **Popups:** `#kte-tip` and `#kte-menu` are DESIGN.md's small popups; `#kte-ac` (autocomplete) is a large one (`14px`, the card shadow). Their rows and menu items take the green hover tint.
- **Radius exception:** the picker's emote cells are `4px`, mirroring Kick's own grid.
- **Source badges**: per-provider colors at `opacity: .85`, `font-size: 10px`, `font-weight: 600` — 7TV `#4da6ff`, BTTV `#ff6b6b`, FFZ `#c084fc`, other `#22c55e`.
- **Load more and Show less:** the picker's **Load more** — the one accent-filled button — uses the family's selected-chip treatment: `rgba(34,197,94,.14)` fill / `rgba(34,197,94,.5)` border / `#4ade80` text at rest, hovering to `.18` / `.6`. Keep it in step with kick-fullscreen-chat's `.kfc-settings-chip.kfc-selected` and kick-quality-saver's `.kqs-chip[data-active]`. **Show less** (`.kte-picker-less`), beside it once a group has been expanded, is the neutral family chip at rest so the green stays Load more's alone, with a grey minus disc matching Load more's plus disc (the disc is what sets both buttons' 32px height). The pair sits in `.kte-picker-actions` so it wraps as one under the count on a narrow picker; it trims the grid back to the children it had when the footer was built, unobserving and unloading the removed images. Each section records its count in `data-kte-shown` (keyed by `data-kte-label`), and `pickerRefreshContent()` passes those counts into the rebuild when the channel and search are unchanged, so starring an emote, a provider refresh or another tab's insert doesn't fold expanded groups back to 40.
- **Transitions:** popup rows and buttons fade their background over `.08s`; the picker's chips and buttons use `.12s ease`.
- **Tooltips** (`#kte-tip`): use the shared `showTooltip(el)` / `hideTooltip()` helpers. Wire via `data-kte-tip` attribute and `mouseenter`/`mouseleave` events. Do not use native `title` attributes on any script-injected element. The tooltip is `position: fixed` and tracks its anchor through the module-level `tipAnchor` plus a capture-phase `scroll` listener — `mouseenter`/`mouseleave` alone are not enough, because chat scrolls under a stationary cursor and a recycled row is removed without ever firing `mouseleave`.

### Reference implementations

- `#kte-tip` — tooltip/hint popup (its colour is the source badge); a column of `.kte-tip-preview` (64px emote image, box reserved in CSS so positioning is stable before load) above `.kte-tip-label`
- `#kte-ac` — autocomplete dropdown (green header label; green-tint focused row)
- `#kte-menu` — emote context menu (green-tint hover/focus)
- `#kte-panel` — settings panel, the family settings card. `settingsPanelKeydown()` closes it on Escape and, since 2.21.3, `familyTrapTab(e, card)` keeps Tab inside it (Tab wraps last → first, Shift+Tab first → last, a Tab from outside lands on the first or last control); the function is word for word the same in the four kick-* scripts with a settings card, so change them together. Every value is kick-quality-saver's `.kqs-card` / kick-fullscreen-chat's `#kfc-settings-panel`: 14px card rising in over .2s on a fading backdrop, the thin family scrollbar, a header with the 30px green icon mark (`panelMarkIcon()`, the 7TV+ face as a green line glyph — the siblings put a flat green icon there, not a filled one), the title (no subtitle, as in kick-fullscreen-chat), and the red-glyph close button; 11px groups with uppercase labels; grid chips (32px, pressed-in on click, faint ring when selected); switch rows in a gap-less `.kte-switches` block with 7px row padding and hairline separators. The card and its groups lay out as grid rows, not flex columns — in Safari a flex group came out a note line short and the last button poked out through its bottom edge; keep them grid. Under `@supports selector(::-webkit-scrollbar)` the card uses `overflow-y: scroll` with `padding-right: calc(1rem - 8px)`, so the transparent track is always reserved and paid for by the padding: both insets stay 17px and the content width doesn't depend on whether the card scrolls. Keep the `8px` in that calc in step with the scrollbar width. Its accent is the selected chip and the on switch; provider chips wear their brand colour as in the picker. Change it together with the siblings, not on its own.
- `.kte-picker-more` — picker action button (green background tint, green border)
- `.kte-picker-settings` / `.kte-chip` — the picker's settings row, a rounded card that auto-hides while the grid is scrolled. Its three chips share the row in equal grid columns, with a 6px inset all round and a 14px radius (the chip's 8px plus the inset). Its surface is the settings panel's inset group (`rgba(255,255,255,.026)`, `rgba(255,255,255,.06)` border), not the popups' opaque `#101013`, which reads as a black hole on Kick's grey panel; it hides before the grid scrolls under it, so it needs no opacity. It slides up as it hides; under `prefers-reduced-motion` it only fades (2.21.2). It counts as its own component for the one-accent rule: its accent is the selected-chip treatment (matching kick-fullscreen-chat's `.kfc-settings-chip.kfc-selected`), which is why green appears here as well as on `.kte-picker-more`. Provider chips override it with their own brand colour when enabled — same justification as the source badges.

