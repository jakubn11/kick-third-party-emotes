# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
