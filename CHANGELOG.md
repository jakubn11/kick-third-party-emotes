# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.5] - 2026-07-19

### Changed
- **The picker's "Load more" button now uses the kick-\* family accent values.** It was the one control in the family painting its own greens — a `.55` border over a `.12` fill with `#dcfce7` text, brightening to `.85`/`.2`/`#f0fdf4` on hover. It now matches the selected-chip treatment used by kick-fullscreen-chat and kick-quality-saver: `rgba(34,197,94,.14)` fill, `rgba(34,197,94,.5)` border and `#4ade80` text, hovering to `.18`/`.6`. Slightly softer, and consistent with every other accented control in the family.
- **Popups now use the full family font stack** (`system-ui, -apple-system, "Segoe UI", sans-serif`) instead of a bare `sans-serif`. On Windows this picks Segoe UI like the sibling scripts, rather than falling through to the browser's generic sans-serif.

## [2.8.4] - 2026-07-11

### Changed
- Redesigned the project `icon.svg` from the four-dot rounded grid to a winking emote face, keeping the same `#22c55e` green on the `#101013` rounded-square background. The `@icon` URL is unchanged. No functional changes.

## [2.8.3] - 2026-07-11

### Changed
- Renamed the userscript file to `kick-third-party-emotes.user.js` and the GitHub repository to `kick-third-party-emotes`, matching the script's `@name` and the rest of the `kick-*` family. Updated the `@icon`, `@updateURL`, and `@downloadURL` metadata (and the doc references) to the new repo path. No functional changes.

## [2.8.2] - 2026-07-07

### Changed
- Final wording pass on the `@description` metadata: dropped the "Userscript that" lead-in and the Safari compatibility sentence (still documented in README/INSTALL). Matches the GitHub repo description exactly.

## [2.8.1] - 2026-07-07

### Changed
- Rewrote the `@description` metadata to cover the 2.8.0 feature set (usage-ranked autocomplete, right-click emote menu, picker recents) and to match the GitHub repo description word-for-word. No code changes.

## [2.8.0] - 2026-07-07

### Added
- **Usage-aware autocomplete ranking.** The script now counts every emote you insert (autocomplete or picker) in a local `kte_v2_usage` record and ranks autocomplete suggestions most-used-first within the prefix and substring groups; shortest-name order remains the tiebreak. Usage data never leaves the machine, is capped at 200 emotes (least-recently-used evicted), and is exempt from the cache sweep.
- **"Recently used" picker section.** The 7TV+ picker tab now opens with a section of your most recently inserted emotes (up to 16) above the provider groups, filtered by the picker search like everything else.
- **Right-click context menu on chat emotes.** Right-clicking a third-party emote in chat opens a small menu to copy the emote name, copy the image URL, or open the emote's page on its provider (7TV/BTTV/FFZ, derived from the allowlisted CDN URL).

## [2.7.4] - 2026-07-07

### Fixed
- The autocomplete popup now follows the chat input when the chat pane or window is resized while it's open. It was positioned once on open and stayed at stale fixed coordinates; a `ResizeObserver` on the input plus a window `resize` listener now re-anchor it (including the width/height clamps) whenever the layout moves.

## [2.7.3] - 2026-07-07

### Added
- Autocomplete falls back to substring matching: when fewer than 8 emote names start with the typed text, the remaining slots are filled with names that contain it anywhere (prefix matches still rank first).

### Changed
- Autocomplete rows give the emote image a fixed 40px slot (`object-fit: contain`), so the emote names align in a clean column instead of starting at a different x-position per row.
- Tab in the autocomplete now completes the top match even when several matches are listed and none is arrow-key focused, matching Twitch/7TV behaviour (and what the popup footer already claimed). Previously Tab did nothing in that state and just moved browser focus, closing the popup.
- Old cache entries are now swept from localStorage once per page load: pre-v2 `kte_` keys and any `kte_v2_` record older than 7 days are removed. Previously every visited channel left its cache keys behind forever, which would eventually exhaust the storage quota and silently disable caching.

### Fixed
- The autocomplete popup no longer overflows the right edge of the viewport when the chat pane is narrow. Its width is now capped to the viewport, it shifts left when the input's left edge would push it off-screen, and long emote names truncate with an ellipsis as intended instead of being clipped by the screen edge.
- The autocomplete popup also caps its height to the space above the input and scrolls its rows instead of clipping past the top of a short window. Interacting with the popup (e.g. dragging its scrollbar) no longer blurs the chat input, which would have closed the popup mid-scroll.
- Provider API requests now time out after 15 s. A hung request previously never settled, which permanently blocked the "retry failed providers in 5 s" pass for that page load.
- A provider refresh that only changes an emote's static-frame URL (`staticUrl`) is no longer misdetected as "no change" and dropped.

## [2.7.2] - 2026-07-01

### Security
- The channel slug taken from the page URL is now percent-encoded before being interpolated into the BTTV and FFZ API request paths. Previously a crafted kick.com URL could steer the request to a different path on those API hosts; hardening only, no behaviour change for real channel names. (7TV was already safe — the slug goes through `JSON.stringify` into its GraphQL query.)

## [2.7.1] - 2026-05-16

### Changed
- Add the Greasy Fork install link to the README and installation guide.

## [2.7.0] - 2026-05-15

### Changed
- Animate picker emotes only while hovered. Picker thumbnails now show the frozen first frame by default and start animating when the cursor is over them, then freeze again on mouseout. Drops the background-animation cost from "every loaded animated emote, forever" to "at most one at a time", which keeps Safari's image-decode cache from growing without bound during heavy picker browsing.
- Add optional `staticUrl` field to the emote cache schema. Populated automatically for animated 7TV emotes (using 7TV's `_static` variant URLs); BTTV animated emotes still animate by default because BTTV doesn't serve a static frame URL. Chat emote rendering is unchanged.
- Bump cache key prefix to `kte_v2_` so the schema change takes effect immediately on next page load instead of waiting up to 12h for the existing cache to expire. Old `kte_` entries become unused.

## [2.6.54] - 2026-05-15

### Changed
- Replace the picker's per-scroll DOM-scan visibility check with an `IntersectionObserver`. With "Load all" expanded to thousands of buttons, the previous code re-walked the entire unloaded set on every scroll frame (`querySelectorAll` + `getBoundingClientRect` per element); the new code is O(visibility-changes) instead of O(total-buttons), so scrolling stays smooth no matter how many emotes are loaded. Animated emotes continue to render normally.

## [2.6.53] - 2026-05-15

### Fixed
- Add `content-visibility: auto` + `contain: layout style paint` to every picker emote button. With "Load all" expanded into thousands of buttons, the browser was paying layout/paint cost for every one on each scroll frame; the containment hints let it skip work for off-screen buttons entirely, so scrolling the fully-expanded picker no longer lags the rest of the page.

## [2.6.52] - 2026-05-15

### Fixed
- Tighten picker image budget for fullscreen use: hard cap 100 → 40, unload buffer 300 → 200, unload delay 400 → 250. Scrolling up and down through a fully-expanded picker while the fullscreen video player was running could pile up enough animated emotes to push Safari's GPU over the edge; the previous cap left too little headroom alongside the fullscreen video texture.

## [2.6.51] - 2026-05-15

### Fixed
- Shrink the picker image "stay loaded" zone (`PICKER_IMAGE_UNLOAD_BUFFER` 700 → 300) and run the unload pass more often (`PICKER_IMAGE_UNLOAD_DELAY` 700 → 400) so far fewer animated GIFs sit in GPU memory at once.
- Hard cap simultaneously loaded picker images at 100. Heavy scroll-and-"Load more" sessions could otherwise pile up hundreds of decoded GIFs, costing Safari's video player its WebGL context after a stream switch and leaving the whole page laggy until reload.

## [2.6.50] - 2026-05-15

### Fixed
- Throttle (not debounce) the picker's far-image unload pass so heavy continuous scrolling can't keep deferring it. Previously a long uninterrupted scroll — especially after "Load more" — kept every visited emote image loaded simultaneously, leaving a large pile of decoded animated GIFs behind that made the whole Kick page laggy after a stream switch.
- On stream switch, fully stale-mark the active picker content (clearing image `src`) instead of only detaching its scroll listeners, so decoded image data is released even when Kick has already removed the picker panel.

## [2.6.49] - 2026-05-15

### Fixed
- Restore the 500ms pathname polling that detects SPA stream switches. The pushState/replaceState wrappers added in 2.6.45 missed navigations when Kick's router called a captured reference to the original method, so `emoteMap` never cleared and new channels kept showing the previous channel's emotes. The wrappers stay in place as a fast path; polling is now the safety net.

## [2.6.48] - 2026-05-15

### Fixed
- Restore page responsiveness on stream switches by removing the always-on body MutationObserver added in 2.6.47 (it duplicated the chat observer's body-wide scope). Autocomplete re-attachment now piggybacks on the existing chat observer, so Kick swapping the chat input element on stream switch is still handled without a second observer.

## [2.6.47] - 2026-05-15

### Fixed
- Re-attach autocomplete listeners when Kick replaces the chat input element during initial routing or stream switches. The input observer now stays alive for the whole session and re-attaches as soon as a new input appears, instead of disconnecting after the first match.

## [2.6.46] - 2026-05-15

### Fixed
- Force-detach the picker's viewport scroll and window resize listeners on stream switch even when Kick has already removed the picker panel, so the page no longer stays laggy after browsing the picker and then navigating away.
- Track the `pickerPumpImageQueue` setTimeout so detaching the picker image loader cancels the chain synchronously instead of letting it spin down on its own.

## [2.6.45] - 2026-05-15

### Changed
- Trigger SPA route handling from `history.pushState`/`replaceState` hooks instead of a 500ms polling interval, so channel switches are detected immediately and the script stays idle in between.
- Cache a pre-sorted lowercase autocomplete index per emote version, avoiding a full `emoteMap` scan and per-keystroke `toLowerCase` calls.

### Removed
- Drop unused `visibleRefreshQueued` and `pickerInjectQueued` state flags.

## [2.6.44] - 2026-05-15

### Fixed
- Render autocomplete dropdown and emote tooltip inside the fullscreen element when Kick's chat is in fullscreen, so they're no longer hidden by the browser's top layer.

## [2.6.43] - 2026-05-10

### Fixed
- Defer provider-triggered picker rebuilds while the third-party picker is active after switching streams, preventing retry/background refreshes from interrupting picker scrolling.

## [2.6.42] - 2026-05-10

### Fixed
- Reduce page lag after clicking **Load more** in large 7TV picker sections by appending new emote buttons in small idle chunks.
- Pace picker thumbnail URL assignment so animated emote decoding is spread out instead of bursting all at once.
- Coalesce picker rebuilds for a short window after stream switches and defer stale refreshes while **Load more** is still appending.
- Preserve third-party picker scroll position when provider updates refresh the same channel's picker content.
- Replace global chat processed-mark clearing with versioned message processing to reduce DOM work after stream switches.
- Stop stale picker thumbnails immediately when picker content is removed during stream navigation.

## [2.6.41] - 2026-05-10

### Fixed
- Load BTTV and FFZ picker thumbnails while scrolling inside the third-party picker content, without needing to click **Load more** first.

## [2.6.40] - 2026-05-10

### Fixed
- Reduce Kick page lag while scrolling the third-party emote picker by throttling picker image scans.
- Delay off-screen picker thumbnail unloading until scrolling settles, avoiding repeated layout work during active scroll.
- Contain scroll behavior on Kick's detected native picker viewport while the third-party tab is active.
- Avoid re-checking the picker on unrelated chat DOM mutations while the picker is open.

## [2.6.39] - 2026-05-10

### Changed
- Load cached emote lists immediately with stale-while-revalidate refreshes in the background.
- Cache global, channel, and empty provider results with separate TTLs so repeat visits avoid more API requests while empty channels update sooner.
- Deduplicate in-flight provider requests and refresh visible chat as each provider finishes loading.

### Security
- Harden cached emote validation so cached URLs must pass the trusted CDN allowlist before reuse.
- Reject malformed cached emote codes and provider labels with whitespace, control characters, or excessive length.

## [2.6.38] - 2026-05-10

### Fixed
- Channel emotes no longer get clobbered when a global provider's response resolves after a channel response with a colliding name — channel entries now take precedence over globals.
- Tooltip on a stacked zero-width emote now shows the zero-width name (e.g. `POGGERS + cvHazmat`) instead of just the base emote name.

## [2.6.37] - 2026-05-05

### Fixed
- Prevent picker lag after loading hundreds of emotes by only keeping thumbnail image URLs assigned near the visible picker viewport.
- Delegate picker thumbnail hover handlers at the grid level instead of adding listeners to every emote button.

## [2.6.36] - 2026-05-05

### Fixed
- Reduce Kick page lag by avoiding repeated full picker-panel subtree searches in the global DOM observer and scanning new nodes with one combined chat-message selector.
- Lower the initial third-party picker batch size and slow thumbnail loading chunks so opening the picker does not overwhelm the page.

## [2.6.35] - 2026-05-05

### Fixed
- Coalesce picker refreshes after stream navigation and avoid building/loading the third-party picker content while its tab is inactive.
- Reserve hidden thumbnail slots before picker images load, preventing unloaded image fallback boxes and layout churn.

## [2.6.34] - 2026-05-05

### Fixed
- Make picker thumbnails fill promptly again while still pacing image URL assignment to avoid large decode spikes.

## [2.6.33] - 2026-05-05

### Fixed
- Lazy-load picker thumbnails with a manual scroll check so off-screen emote images do not all decode at once after switching streams.

## [2.6.32] - 2026-05-05

### Fixed
- Reduce page lag when loading more picker emotes after switching streams by appending extra picker batches in small idle chunks and cancelling stale batches after picker rebuilds.

## [2.6.31] - 2026-05-05

### Reverted
- Remove IntersectionObserver-based lazy loading from the picker — the custom root approach failed to fire, leaving all images blank. Back to direct `img.src` assignment.

## [2.6.30] - 2026-05-05

### Changed
- Picker now populates incrementally as each provider finishes loading instead of waiting for all six to complete.

## [2.6.29] - 2026-05-05

### Fixed
- Replace eager picker image loading (caused page lag) with IntersectionObserver-based lazy loading rooted to the picker's own scroll container — images load as the user scrolls, not all at once.

## [2.6.28] - 2026-05-05

### Fixed
- Remove `loading="lazy"` from picker emote images — fixed-position overlays are outside the viewport intersection zone so lazy images never loaded.
- Fetch BTTV channel emotes for Kick and Twitch platforms in parallel instead of sequentially.

## [2.6.27] - 2026-05-05

### Fixed
- Load global and channel emotes in parallel instead of sequentially, cutting initial load time.
- Auto-retry emote images that fail to load (once after 2 seconds).
- Skip broken emotes when `safeUrl` rejects a URL instead of showing broken image placeholders.
- Remove `loading="lazy"` from chat emote images — they're small, in-viewport, and should load immediately.

## [2.6.26] - 2026-05-05

### Changed
- Match chat emote tooltip provider colors to the autocomplete popup: 7TV in blue, BTTV in red, FFZ in purple.

## [2.6.25] - 2026-05-03

### Fixed
- Fix emotes not rendering in recycled virtual-list chat messages (reprocess after `data-index` change).
- Start chat observer before emote loading completes so messages arriving during init aren't missed.
- Retry failed provider API calls after 5 seconds instead of silently dropping them.

## [2.6.24] - 2026-05-02

### Changed
- Color-code provider badges in the autocomplete popup: 7TV in blue, BTTV in red, FFZ in purple.

## [2.6.23] - 2026-05-02

### Security
- Tighten `safeUrl`: validate emote image URLs against an allowlist of known CDN hostnames (`cdn.betterttv.net`, `cdn.7tv.app`, `cdn.frankerfacez.com`) in addition to requiring `https:` — prevents a compromised provider API from loading arbitrary URLs.
- Validate the shape of each entry read back from the `localStorage` cache; discard and evict the cache key if any entry fails validation.

## [2.6.22] - 2026-05-02

### Fixed
- Replace stale `#101512` (greenish-black) with the correct `#101013` background in the picker tab icon dots and Load More button cross — consistent with all other UI components.

## [2.6.21] - 2026-05-02

### Changed
- Replace native `title` tooltips on emote picker buttons with the shared custom `#kte-tip` popup, matching the style used in chat.

## [2.6.20] - 2026-05-02

### Changed
- Redesign autocomplete popup and emote tooltip: bold white-on-dark glass style with `#22c55e` as a single structural accent per component (green left stripe on tooltip, green top border and header on autocomplete, green source badges and hover highlight).

## [2.6.18] - 2026-05-01

### Fixed
- Match the third-party emote picker tab to Kick's native content height and padding, removing the dynamic max-height fitting that could resize the picker area.

## [2.6.17] - 2026-05-01

### Changed
- Restyle the chat emote tooltip with the same dark/green visual language as the picker controls.

## [2.6.16] - 2026-05-01

### Fixed
- Show chat emote hover text through a single top-level tooltip, preventing overlapping duplicate tooltips around emotes and zero-width overlays.

## [2.6.15] - 2026-05-01

### Changed
- Replace the third-party emote picker tab smiley with a green rounded-grid icon using the same button color palette.

## [2.6.14] - 2026-05-01

### Changed
- Restyle the third-party emote picker tab icon as a green circular emote face, matching the visual language of the **Load more** button.

## [2.6.13] - 2026-05-01

### Changed
- Place each emote picker **Load more** button inline next to its `Showing X of Y` progress text.

## [2.6.12] - 2026-05-01

### Fixed
- Center the **Load more** plus icon by drawing it with CSS instead of relying on the font `+` glyph.

## [2.6.11] - 2026-05-01

### Fixed
- Polish the emote picker **Load more** button styling so it reads as a compact action instead of a large plain rectangle.
- Fit the third-party picker content to the visible native picker viewport and add more bottom padding, preventing the last row of emotes from being clipped.

## [2.6.10] - 2026-05-01

### Changed
- Keep the emote picker **Load more** button label static and update the `Showing X of Y` progress text after each batch loads.

## [2.6.9] - 2026-05-01

### Added
- Add a **Load more** button to each emote picker provider section. The picker still starts with 80 emotes per provider for performance, then appends the next batch on demand.

## [2.6.8] - 2026-05-01

### Fixed
- Reverted the virtualized picker layer and static thumbnail preview path because it could interfere with Kick chat scrolling/input on some picker DOM layouts.
- Stop locking or scrolling Kick's native picker/container elements from the third-party picker. The custom tab now uses its own bounded scroll area instead of modifying parent scroll state.
- Keep animated emotes animated in the picker again.
- Cap picker rendering to 80 matches per provider, with search filtering across the full loaded emote set, to avoid recreating the full page-wide lag.

## [2.6.7] - 2026-05-01

### Fixed
- Replace the emote picker's full-DOM rendering with a virtualized row renderer. The picker now keeps only the visible rows plus a small buffer in the DOM, preventing hundreds of live emote buttons/images from slowing the whole Kick page.
- Keep provider cache entries in memory after the first load during a page session, avoiding repeated synchronous `localStorage` JSON parsing on every SPA channel switch.
- Defer provider cache writes to idle time so fresh API responses do not synchronously serialize large emote arrays during channel initialization.
- Process already-visible chat messages in small idle chunks after emotes load, reducing page stalls when a channel finishes initializing.
- Replace the body-wide SPA route `MutationObserver` with a lightweight path poll plus `popstate`, so Kick's own DOM churn no longer wakes the route detector on every page mutation.
- Use static low-priority thumbnails in the picker for animated BTTV/7TV emotes where available, reducing GIF decode pressure while browsing.

## [2.6.6] - 2026-05-01

### Fixed
- Refresh the third-party picker when emote data finishes loading, even if the picker was already injected for the current channel. This prevents the picker from getting stuck in its loading/empty state after SPA channel switches.
- Load picker images only when their buttons enter the picker viewport. This avoids starting hundreds of CDN image/GIF requests at once when opening the picker after changing channels, reducing Safari page-wide lag and failed image loads.
- Restore reserved height for pending provider sections so off-screen providers remain truly lazy instead of intersecting immediately at zero height.
- Reset picker scroll position only when replacing picker content instead of on every active-state pass.

## [2.6.5] - 2026-05-01

### Fixed
- Prevent stale provider loads from previous channels from writing into the active emote map after SPA navigation. This keeps channel-specific emotes from getting mixed or stuck after switching channels.
- Reduce emote picker lag by ignoring DOM mutations created inside Kick's native picker and the injected third-party picker, instead of scanning every emote button as if it might be a chat message.
- Disconnect stale autocomplete observers and picker lazy-load observers during navigation/reset so repeated channel switches do not leave extra observers behind.

## [2.6.4] - 2026-05-01

### Performance
- Replace `localeCompare` with direct string comparison in the emote picker sort and autocomplete sort — eliminates locale-sensitive collation overhead on every channel switch and every autocomplete keystroke.

## [2.6.3] - 2026-05-01

### Fixed
- Autocomplete now updates when deleting letters. Lexical intercepts `beforeinput` for deletions so the `input` event doesn't always fire; added a `keyup` fallback for Backspace and Delete.

## [2.6.2] - 2026-05-01

### Fixed
- Reverted history.pushState/replaceState patching — Kick's Next.js framework calls replaceState during hydration which triggered handleNavigation(), resetting waitForDOMThenInit mid-poll and breaking first-load. Restored the MutationObserver approach which is immune to this.

## [2.6.1] - 2026-05-01

### Security
- Validate all API-supplied emote URLs against `https://` before assigning to `img.src`, guarding against a compromised provider CDN returning `javascript:` or `data:` URIs.
- Validate localStorage cache entries are arrays before iterating; corrupted or tampered cache entries are now evicted rather than trusted.

### Performance
- Replace the always-on `document.body` MutationObserver used for SPA navigation detection with `history.pushState` / `history.replaceState` patches and a `popstate` listener — eliminates a callback that previously fired on every DOM mutation across the page.
- Merge 7 separate `document.querySelectorAll` calls in `processAllVisible` into a single call with a joined selector.

## [2.6.0] - 2026-05-01

### Changed
- `acHide` now clears `acInput` to avoid holding a stale element reference after the autocomplete closes.
- Simplified `processTextNode` early-return — `node.textContent` is always a string so the redundant `!text` check is removed.
- Removed redundant JSDoc `@type` annotation and duplicate comment on `emoteMap`; collapsed into a single inline comment.
- Updated README for clarity and accuracy.

## [2.5.2] - 2026-05-01

### Removed
- Live emote preview bar — inline replacement is not feasible in Kick's Lexical editor without API access, and the strip approach was not the right UX. Autocomplete remains the primary emote input method.

## [2.5.1] - 2026-05-01

### Fixed
- Preview bar now hides after sending a message (Enter clears the Lexical editor programmatically with no input event).
- Preview bar now hides when the chat input loses focus.
- Preview bar now updates correctly as you type each character of an emote name (deferred textContent read to after Lexical's DOM reconciliation).

## [2.5.0] - 2026-05-01

### Added
- Live emote preview bar above the chat input: as you type, any recognised emote codes are rendered as images in a preview strip above the input. The preview hides automatically when there are no emotes in the message or when the input is cleared. The actual message text is unchanged so messages send correctly for all viewers.

## [2.4.14] - 2026-05-01

### Fixed
- Emote images in the picker now load reliably — removed `loading="lazy"` from picker buttons since the browser's native lazy loading uses viewport proximity, not the picker's custom scroll container.

## [2.4.13] - 2026-05-01

### Fixed
- Script now reliably loads on first page visit by waiting for Kick's chat DOM instead of a fixed 800ms timeout.
- SPA navigation observer watches `document.body` subtree instead of shallow `document.documentElement`, fixing missed route changes.

## [2.4.12] - 2026-04-30

### Changed
- Merged `fetchJSON` and `fetchGQL` into a single HTTP helper (reduces duplication).
- Removed trivial `watchPicker` and `pickerProviderName` wrapper functions; inlined at call sites.
- Extracted duplicate SPA navigation reset logic into `handleNavigation()`.

## [2.4.11] - 2026-04-30

### Changed
- Autocomplete popup now accepts selection with **Tab only** (Enter no longer selects).
- When only one match is shown, pressing Tab immediately commits it without needing to select it first.

## [2.4.10] - 2026-04-28

### Fixed
- The **7TV+** picker tab now keeps scrolling contained to the emote list without changing the picker height. The injected picker content locks to the existing native picker viewport and uses that internal scroller for lazy-loading provider sections.

## [2.4.9] - 2026-04-28

### Fixed
- Provider section headers in the emote picker now have the same spacing above them as native Kick picker sections. Each section uses `grid gap-2` (matching Kick's `div.grid.gap-2` structure), and all sections are wrapped in a `grid gap-2` container for consistent inter-section gaps. Removed the manual `margin: 10px 0 5px` from `.kte-picker-provider`.

## [2.4.0] - 2026-04-28

### Added
- Project icon (`icon.svg`): green emote face on dark rounded background, using Kick's green (#22c55e).
- `@icon` metadata in the userscript — Tampermonkey/Userscripts now shows the icon next to the script name.
- Emote picker tab now shows the icon (inline SVG face) instead of the "7TV+" text badge.

### Fixed
- Green underline on the picker tab was unreliable — it depended on Tailwind's `group-data-[active]` variant which requires an ancestor with the `group` class. Replaced with a direct CSS selector (`#kte-picker-tab[data-active="true"] .kte-picker-underline`) that works unconditionally, matching the full-width style of native tabs.

## [2.3.4] - 2026-04-28

### Fixed
- Page freeze when scrolling the emote picker up and down repeatedly. `content-visibility: auto` was deferring layout for off-screen sections and then forcing a full layout burst for all child buttons the moment a section scrolled back into view. Since IntersectionObserver lazy loading already ensures off-screen sections contain no buttons, `content-visibility: auto` was redundant and only caused scroll jank. Removed.

## [2.3.3] - 2026-04-28

### Fixed
- Progressive lag when the emote picker stays open. Each time Kick re-rendered the picker panel, `pickerRefreshContent` replaced the content but the `requestIdleCallback` chain from the previous render kept firing indefinitely (the grid was detached but `isConnected` was never checked). Over time multiple orphaned chains accumulated. Fixed by bailing out of each chunk step when `grid.isConnected` is false.

## [2.3.2] - 2026-04-28

### Changed
- Emote picker provider sections beyond the first are now lazily rendered using `IntersectionObserver`. DOM nodes for off-screen providers are only created when the user scrolls them into view (with an 80px pre-load margin). Each pending section reserves `160px` of height so the scrollbar stays accurate. IO is disconnected and recreated whenever the picker content is replaced (e.g. on search).

## [2.3.1] - 2026-04-28

### Fixed
- Page lag after opening the emote picker. Root causes: (1) each emote button had its own `click` and `mousedown` closure — with 500+ emotes across three providers this created thousands of GC-tracked listener objects. Replaced with event delegation (two listeners per provider grid). (2) All buttons were created synchronously on the main thread. Now uses `requestIdleCallback` to build buttons in chunks of 60 across idle frames, keeping the page responsive.

## [2.3.0] - 2026-04-28

### Changed
- Native emote picker now shows all emotes for every provider instead of capping at 240 per provider.
- Each provider section wrapped in a `content-visibility: auto` container so the browser skips layout and paint for off-screen sections, keeping scrolling fast even with large emote sets.
- Grid buttons built with `DocumentFragment` and inserted in one DOM operation per provider to reduce reflow overhead.

## [2.1.3] - 2026-04-28

### Fixed
- 7TV **global** animated emotes also rendered as static — `load7TVGlobal` was picking `2x.webp` (animated WebP) which Safari does not play back. Updated to prefer `2x.gif` for animated emotes, same as the v4 channel loader.

## [2.1.2] - 2026-04-28

### Fixed
- Animated emotes rendered as frozen first frame. Root cause: 7TV v4 uses a `_static` suffix on non-animating variants (e.g. `2x_static.webp`) while the animated files have no suffix (`2x.webp`, `2x.gif`). `pick7TVImage` was not aware of this distinction and could pick the static variant for animated emotes.
- `pick7TVImage` now accepts an `animated` flag and prefers `2x.gif` for animated emotes (universally supported), falling back to non-`_static` WebP.
- BTTV animated emotes now use an explicit `.gif` CDN URL suffix instead of relying on content-negotiation, which could serve a static format.

## [2.1.1] - 2026-04-28

### Fixed
- Emotes not rendering in chat — Kick's current DOM uses `div[style*="--chatroom-font-size"]` as the message container and `span.leading-[1.55].font-normal` for message text; neither matched any existing `MSG_SELECTORS` entry. Both selectors added as highest-priority fallbacks.

## [2.1.0] - 2026-04-28

### Fixed
- 7TV channel emotes broken — migrated from deprecated v3 REST endpoints (`/v3/users/kick/{slug}`) to the v4 GraphQL API (`/v4/gql`). The old endpoints returned 404 for all channels.

### Changed
- `load7TVChannel` now queries the 7TV GQL `users.search` endpoint, locates the user by matching their KICK (or TWITCH as fallback) `platformUsername` against the channel slug, then fetches the active emote set. The numeric Kick user ID is no longer needed.
- Image selection for 7TV emotes updated to match the v4 `Image` schema (`url`, `mime`, `scale` fields instead of the old `host.files[].name` pattern).
- Added `fetchGQL` (POST helper) and `pick7TVImage` (2x webp preference) helpers.

## [2.0.0] - 2026-04-28

### Added
- Autocomplete popup (`#kte-ac`) with prefix-matching, up to 8 results, source badge, and keyboard navigation (↑↓ / Tab / Enter / Esc).
- Zero-width 7TV emote support — overlays stack centred on the base emote via `.kte-zw`.
- Hover tooltip on every emote showing code and provider source.
- `localStorage` cache with a 1-hour TTL (`kte_` prefix) for all provider responses.
- Kick-first, Twitch-fallback lookup for both BTTV and 7TV channel emotes.
- SPA route detection via `MutationObserver` + `popstate` — channel emotes reload on navigation without a full page refresh.
- Multiple fallback selectors for chat messages (`MSG_SELECTORS`) and chat input (`INPUT_SELECTORS`) to survive Kick DOM changes.
- `data-kte-done="1"` guard on processed message elements to prevent duplicate rendering.
- `NON_CHANNEL_SLUGS` set to skip non-channel pages (home, browse, settings, etc.).

### Providers
- BetterTTV: global and per-channel emotes.
- 7TV: global emote set and per-channel emote sets (webp/avif preferred).
- FrankerFaceZ: global sets and per-channel room emotes.

## [1.0.0] - 2026-04-28

### Added
- Initial release.
