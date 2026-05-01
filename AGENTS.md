# Kick Third-Party Emotes — Agent Context

Safari userscript that adds BetterTTV, 7TV, and FrankerFaceZ emotes to Kick.com chat.

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-emotes.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Safari on macOS using the Userscripts extension  
**Git:** This directory may not be initialized as a git repository.

## Commands

There is no package manager, build step, linter, or automated test suite configured.

Useful local checks:

```bash
sed -n '1,80p' kick-emotes.user.js
wc -l kick-emotes.user.js INSTALL.md
```

Manual testing is required in Safari:

1. Copy `kick-emotes.user.js` into the folder configured in the Userscripts Safari extension.
2. Open a Kick channel page.
3. Check the Safari developer console for `[KickEmotes]` log lines.
4. Verify global and channel emotes render in chat.
5. Verify autocomplete attaches to the chat input and supports arrow navigation, Tab selection, and Esc close.
6. Navigate between Kick channels and confirm channel-specific emotes reload.

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid for Userscripts/Tampermonkey-style hosts:

- `@match` should remain scoped to `https://kick.com/*` unless the target changes.
- Add any new remote domains to `@connect`.
- Keep `@grant GM_xmlhttpRequest` if fetching third-party APIs from Safari.
- Bump `@version` when changing user-facing behavior or provider logic.

Do not add `Co-Authored-By:` trailers to git commits.

## Implementation Map

`kick-emotes.user.js` is organized into these areas:

- Userscript metadata and constants
- Cache helper using `localStorage` keys prefixed with `kte_`
- Provider loaders for BTTV, 7TV, and FFZ
- DOM message processing and emote replacement
- Autocomplete popup and chat input handling
- Chat `MutationObserver`
- SPA route detection and reinitialization

The central data structure is:

```js
Map<string, { url: string, source: string, animated: boolean, zeroWidth: boolean }>
```

Each provider loader should add `[code, emote]` entries through `cachedLoad()`.

## External APIs

Current provider endpoints:

- BetterTTV: `https://api.betterttv.net/3`
- 7TV: `https://7tv.io/v3`
- FrankerFaceZ: `https://api.frankerfacez.com/v1`

Prefer preserving the current graceful-failure behavior. Provider failures should not stop other providers from loading.

For channel emotes, the script currently tries Kick first and Twitch fallback where supported. Preserve that order unless there is a specific reason to change it.

## DOM And Routing Notes

Kick is a single-page app and may change class names. The fragile selectors live near the top of the userscript:

- `MSG_SELECTORS`
- `INPUT_SELECTORS`
- `NON_CHANNEL_SLUGS`

When fixing Kick DOM breakage, prefer adding fallback selectors rather than replacing working selectors. After selector changes, manually test:

- Existing visible chat messages
- Newly arriving messages
- Chat input autocomplete
- Channel navigation without a full page reload

## Emote Rendering Notes

- Emote images use `.kte-img` with a 28px height.
- Zero-width 7TV emotes overlay the previous emote via `.kte-zw`.
- Text nodes are split on whitespace; exact token matches are replaced.
- Processed message elements receive `data-kte-done="1"` to avoid duplicate rendering.

Be careful when changing text processing: chat messages can contain links, existing elements, and text nodes inserted incrementally by the Kick frontend.

## Autocomplete Notes

Autocomplete is intentionally lightweight and local:

- It searches loaded emote names with prefix matching.
- It displays up to 8 results.
- It supports contenteditable inputs and textarea/input fallbacks.
- It uses `document.execCommand('insertText')` for contenteditable insertion to preserve frontend reactivity.

If modifying autocomplete, test both insertion and keyboard handling in the actual Kick chat input.

## Documentation

Update `INSTALL.md` when installation steps, supported providers, troubleshooting guidance, or user-visible behavior changes.

Keep docs oriented around Safari and the Userscripts extension unless support for another host is explicitly added.

## Before Every Commit

Before committing any change, always:

1. **Bump `@version`** in the `kick-emotes.user.js` metadata header (patch for fixes/tweaks, minor for new features).
2. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
3. **Check `README.md`** — ask: does this change affect anything a user would read about? Update if yes. This includes: new or removed features, changed behaviour, new keyboard shortcuts, provider changes, or updated troubleshooting steps. Internal refactors and bug fixes that don't change user-facing behaviour do not require a README update.
