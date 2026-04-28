# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
