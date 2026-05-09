# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
