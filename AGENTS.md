# Kick Third-Party Emotes — Agent Context

Browser userscript that adds BetterTTV, 7TV, and FrankerFaceZ emotes to Kick.com chat.

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-emotes.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, Safari Userscripts, etc.) on any browser; developed and tested on Safari + Userscripts  
**Git:** This directory may not be initialized as a git repository.

## Commands

There is no package manager, build step, linter, or automated test suite configured.

Useful local checks:

```bash
sed -n '1,80p' kick-emotes.user.js
wc -l kick-emotes.user.js INSTALL.md
```

Manual testing is required in a browser with a userscript manager installed:

1. Install the userscript via your manager (e.g. drag the `.user.js` file into Tampermonkey/Violentmonkey, or copy it into the folder configured in the Userscripts extension on Safari).
2. Open a Kick channel page.
3. Check the browser developer console for `[KickEmotes]` log lines.
4. Verify global and channel emotes render in chat.
5. Verify autocomplete attaches to the chat input and supports arrow navigation, Tab selection, and Esc close.
6. Navigate between Kick channels and confirm channel-specific emotes reload.

## Userscript Metadata

The userscript header controls permissions and host access. Keep it valid across all common userscript managers (Tampermonkey, Violentmonkey, Greasemonkey, Userscripts, etc.):

- `@match` should remain scoped to `https://kick.com/*` unless the target changes.
- Add any new remote domains to `@connect`.
- Keep `@grant GM_xmlhttpRequest` if fetching third-party APIs cross-origin.
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

## Security

### Rules — always follow these

- **Never use `innerHTML`, `outerHTML`, or `insertAdjacentHTML`** with any data that comes from a provider API, the DOM, or user input. Use `textContent` for text and `createElement` + `appendChild` for structure.
- **Always pass emote image URLs through `safeUrl()`** before assigning to `img.src`. `safeUrl` validates both the protocol (`https:`) and the hostname against `ALLOWED_CDN_HOSTS`. Never bypass it.
- **Never add a new CDN domain to `ALLOWED_CDN_HOSTS` without a clear reason.** Each entry is a trusted image source. Adding one carelessly expands the attack surface.
- **Never use native `title` attributes** on script-injected elements. Use `data-kte-tip` + `showTooltip`/`hideTooltip` instead (see UI Design System).
- **Never use `eval`, `new Function(string)`, `setTimeout(string)`, or `setInterval(string)`.**
- **Never trust provider API responses without validation.** Use optional chaining (`?.`) and nullish defaults. Validate shapes before use — see `isValidCacheEntry` as a reference.
- **Never store sensitive data in `localStorage`.** The cache only stores emote codes, URLs, and source names — nothing user-specific.
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

## UI Design System

All script-injected UI must follow this design language consistently. Do not deviate from it when adding new popups, overlays, or controls.

### Palette

| Token | Value | Usage |
|---|---|---|
| `--kte-bg` | `#101013` | All popup/overlay backgrounds |
| `--kte-green` | `#22c55e` | Signature accent — used exactly once per component |
| `--kte-border` | `rgba(255,255,255,.1)` | Neutral borders on all sides |
| `--kte-text` | `#ffffff` | Primary text (emote names, labels) |
| `--kte-muted` | `rgba(255,255,255,.25)` | Secondary / hint text |
| `--kte-hover` | `rgba(34,197,94,.1)` | Row / button hover/focus background |

### Rules

- **One green accent per component.** Use `#22c55e` for one structural element only — a border stripe, a header label, or a badge. Never paint large surfaces green.
- **Backgrounds:** `#101013` with `backdrop-filter: blur(8–12px)`.
- **Borders:** `rgba(255,255,255,.1)` on most sides; the single green accent replaces one border (left stripe or top bar).
- **Box shadow:** `0 8–12px 24–32px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)`.
- **Border radius:** `8px` for small popups (tooltip), `10px` for larger ones (autocomplete, picker panels).
- **Typography:** `font-family: sans-serif`. Bold (`font-weight: 700`) for primary labels. `font-weight: 600` for secondary text.
- **Source badges** (7TV, BTTV, FFZ): `#22c55e` at `opacity: .7`, `font-size: 10px`, `font-weight: 700`.
- **Hover states:** `rgba(34,197,94,.1)` background, no border change.
- **Transitions:** `transition: background .08s` on interactive rows/buttons.
- **No drop shadows in green.** Shadows are always `rgba(0,0,0,…)`.
- **Tooltips** (`#kte-tip`): use the shared `showTooltip(el)` / `hideTooltip()` helpers. Wire via `data-kte-tip` attribute and `mouseenter`/`mouseleave` events. Do not use native `title` attributes on any script-injected element.

### Reference implementations

- `#kte-tip` — tooltip/hint popup (green left border stripe)
- `#kte-ac` — autocomplete dropdown (green top border + green header label)
- `.kte-picker-more` — picker action button (green background tint, green border)

## Documentation

Update `INSTALL.md` when installation steps, supported providers, troubleshooting guidance, or user-visible behavior changes.

Keep docs browser-agnostic. When mentioning installation steps, cover the general flow and call out manager-specific differences (Userscripts for Safari, Tampermonkey, Violentmonkey, etc.) where they matter.

## Before Every Commit

Before committing any change, always:

1. **Bump `@version`** in the `kick-emotes.user.js` metadata header using these rules:

   | Change | Bump | Example |
   |---|---|---|
   | New user-facing feature — new provider, new UI component, new keyboard shortcut | **minor** `x.+1.0` | `2.6.x → 2.7.0` |
   | Bug fix, style tweak, refactor, internal change | **patch** `x.x.+1` | `2.6.x → 2.6.x+1` |
   | Breaking change or full rewrite | **major** `+1.0.0` | `2.x.x → 3.0.0` |

2. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
3. **Update `README.md`** if the change is user-facing: new or removed features, changed behaviour, new keyboard shortcuts, provider changes, or updated troubleshooting steps. Internal refactors and bug fixes that don't change user-facing behaviour do not require a README update.
4. **Suggest a GitHub Release** after every commit if any of the following apply — say "this looks like a good point to publish a GitHub Release":
   - A security fix was made
   - A user-facing feature was added (new provider, new UI component, new keyboard shortcut)
   - A bug affecting core functionality was fixed (emotes not loading, autocomplete broken, picker missing)

   Do NOT suggest a release for: docs-only changes, internal refactors, formatting, style tweaks the user won't notice.
