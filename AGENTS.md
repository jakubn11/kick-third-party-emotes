# Kick Third-Party Emotes — Agent Context

Browser userscript that adds BetterTTV, 7TV, and FrankerFaceZ emotes to Kick.com chat.

This file holds the rules. The reasons behind them, the verification history and the full maps are in [docs/implementation-notes.md](docs/implementation-notes.md), and the full manual test steps are in [docs/manual-testing.md](docs/manual-testing.md). **Before changing a mechanism, read its section in the notes.**

## Project Overview

**Type:** Single-file JavaScript userscript  
**Primary file:** `kick-third-party-emotes.user.js`  
**Install docs:** `INSTALL.md`  
**Target:** Any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) on any browser; developed and tested on Safari + Userscripts  
**Git:** `git@github.com:jakubn11/kick-third-party-emotes.git` (default branch: `main`).

## Commands

There is no package manager, build step, or linter. Tests run on macOS's built-in JavaScript engine, with no Node or dependencies:

- Tests: `test/run.sh` — the one entry point: runs the syntax check below, then every `test/*.test.js`, then `test/family-style.js` (shared by all five kick-* repos; only its config block differs) checks that every colour in the script is a family colour or a listed exception with its reason, and that the *Family rows* CSS block (up to its `/* End of family rows` marker) matches the copy in kick-chat-utils, when that repo is checked out next to this one, that `DESIGN.md` matches every sibling repo's copy and names every family colour. It exits non-zero on any failure, including a test file that throws partway (jsc's exit code is checked, not just the FAIL/PASS lines).
- There is no CI — don't add GitHub workflows. `test/run.sh` is the gate, run locally before every commit.

- Syntax check: `node --check kick-third-party-emotes.user.js`. Without Node installed, macOS ships a JavaScript engine that can parse-check without executing (the file is an IIFE, so it must not be *run* to be checked):
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -e 'try { new Function(readFile("kick-third-party-emotes.user.js")); print("syntax OK"); } catch (e) { print("SYNTAX ERROR: " + e); }'`
- No build step — the `.user.js` is shipped as-is.

### Tests

The userscript is one IIFE that touches the DOM as it loads, so the tests don't run it. `test/harness.js` pulls individual functions (`load([...])`) or top-level `const`s (`loadConst([...])`) out of the source by name and evaluates them globally; each test stubs whatever those reference (`localStorage`, `GM_xmlhttpRequest`, `setTimeout`, `matchMedia`, sibling functions) and calls `check(label, condition)`. jsc has no `URL`, so the harness supplies a minimal one. Each test file runs in its own `jsc` process.

What is covered: emote precedence (`rebuildEmoteMap`), `fetchJSON`'s error paths and `init()`'s retry backoff, the cache budget, sweep and timestamps, `ffzEntries` against a trimmed live FFZ room (`test/fixtures/`), `emoteDisplayUrl` under reduced motion, `currentChannelSlug`, the emote menu's press guard and Esc (`emoteMenuGuard`, `emoteMenuKeydown`), the picker search debounce and result order (`pickerCompareEmotes`), the picker's restore of expanded groups across rebuilds (`pickerShownCounts` / `pickerRestoredShown`), autocomplete attach, saved settings and cross-tab sync (`settingsFromRecord`, `settingsUpdate`, `onStorageSync`), which control the settings panel refocuses after a rebuild (`panelFocusTarget`), the settings panel's, picker's, right-click menu's and autocomplete's text in every language (`uiText`, `UI_TEXT`), and which keys autocomplete takes from Kick (`acOnKeydown`). DOM processing, the picker and autocomplete are not — they still need the manual steps below; `familyTrapTab`'s Tab wrapping and what it skips (`test/focus-trap.test.js`).

Renaming a function or `const` that a test loads breaks that test loudly (`no function …`), which is the point: update the test with it. When fixing a bug in pure logic, add a check that fails without the fix.

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
- `@grant GM_registerMenuCommand` only adds **Emote settings** (`uiText().menuSettings`, in Kick's language at page load since 2.20.0) to the manager's menu. Keep the call behind its `typeof` check: Safari's Userscripts and Greasemonkey 4 don't define it, and the row in Kick's chat settings menu is the entry point there.
- `@updateURL` / `@downloadURL` point at the latest GitHub release's attached script, `https://github.com/jakubn11/kick-third-party-emotes/releases/latest/download/kick-third-party-emotes.user.js`. Pushing to `main` reaches no one; publishing a release ships it. **Every release must attach the script as exactly `kick-third-party-emotes.user.js`** — a release without it breaks auto-update until the next one. If the repo moves, update both URLs.
- Bump `@version` when changing user-facing behavior or provider logic.

Do not add `Co-Authored-By:` trailers to git commits.

## Implementation Map

`kick-third-party-emotes.user.js`, in order. Full write-ups are under the same headings in the notes.

- Metadata and constants; `VERSION` (logged at boot, named in the duplicate warning); `UI_TEXT`; single-instance guard on `<html>` (the sandbox may not share `window`).
- Cache (`kte_v5_` prefix, swept once per load), usage tracker (`kte_v2_usage`), favourites (`kte_v2_favs`), settings (`kte_v2_settings`).
- Settings panel `#kte-panel`, opened from a row in Kick's chat settings menu (`#kte-chat-settings-row`) and the manager menu command. The picker's chip row stays providers-only.
- Cross-tab sync `onStorageSync()`.
- Provider layers `loadedProviders` / `activeLoaders`, `rebuildEmoteMap()`, `loaderRank`.
- Emote context menu `#kte-menu` (chat and picker emotes).
- Channel lookup `kickChannel` → `sevenTvKickUser` / `ffzRoom` → `channelTwitchId`, memoised in `channelLookups`.
- Provider loaders (BTTV, 7TV, FFZ) through `cachedLoad()`; message processing; autocomplete; the one body-wide chat `MutationObserver`; SPA route detection.

Central structure: `Map<code, { url, source, animated, zeroWidth, staticUrl? }>`. On a code clash, every channel set outranks every global set, then `PROVIDERS` order (7TV, BTTV, FFZ).

### Invariants: do not undo

- **Two storage namespaces.** `CACHE_PREFIX` is provider data; `Cache.set` writes `ts` first (`cacheValueTs` reads it unparsed). The `kte_v2_*` user-state keys are in `PRESERVED_KEYS`, skipped by the sweep and never derived from `CACHE_PREFIX`.
- **Every tab writes the user-state keys.** Every write goes read → change → write (`usageBump()`, `usageClear()`, `favToggle()`, `settingsUpdate()`, the only way to change a setting). Never save an in-memory copy on a timer. A read that throws keeps the in-memory copy. Chat re-renders on sync only when `settingsRenderKey()` changed.
- `settingsFromRecord()` reads field by field against `settingsDefaults()`.
- **Hidden providers are still fetched**; `rebuildEmoteMap()` filters by `providerEnabled()` and the globals switch. Don't skip the fetch (re-enabling would need `init()`, which tears down the picker).
- **Turning a provider off un-renders** via `unrenderEmoteWraps()`, which rebuilds tokens from each image's `alt`. Keep `alt` = the emote code on `.kte-img` and `.kte-zw`.
- `size` is the `--kte-emote-size` CSS variable, not a re-render. `autocomplete: false` leaves the listeners attached and returns early. `preview: false` drops only the image.
- Context-menu item actions stay inside the menu's guard, not their own `click` listeners.
- `waitForInput()` observes nothing; the chat observer re-attaches autocomplete.
- **Picker tab**: `pickerBuildTab()` clones a native tab button (one with an `svg`) and swaps the icon via `pickerBuildTabIcon()`. Don't hand-write it. Size lives in `flex-basis` with `width: auto`, and the floor stays above the 28px icon. Don't copy size attributes onto the icon or give it a backplate. Don't hide the strip's scrollbar.
- The sticky chip row hides by `IntersectionObserver` sentinel, not a scroll listener (the scroller varies).

## External APIs

- Kick `/api/v2/channels/<slug>`, same-origin with the page's `fetch` (no `@connect`).
- BTTV `https://api.betterttv.net/3`, 7TV `https://7tv.io/v3`, FFZ `https://api.frankerfacez.com/v1`. Endpoints, quirks and the channel-lookup steps are in the notes (*External APIs*).

Rules:
- The slug is not an identity: resolve through the Kick lookup (slug dashes can be username underscores). 7TV is Kick first, then Twitch. BTTV and FFZ are Twitch only. A 7TV outage is swallowed in `linkedTwitchId` so BTTV and FFZ degrade to the by-name lookup.
- BTTV's user endpoint takes a numeric id, never a name. `BTTV_ZERO_WIDTH` is a hardcoded list. 7TV zero-width is bit `1` on the **set entry**, not `flags & 256`. 7TV stills come from `static_name`. FFZ animated URLs are a second map. FFZ `modifier: true` entries are not emotes.
- One provider failing never stops the others. A loader returns `[]` only for a 404 (`fetchJSONOrNull` / `fetchKickJSONOrNull`). A rejected loader is retried after `PROVIDER_RETRY_DELAYS` (5, 15, 45 s), keeps any stale cache and caches nothing. `fetchJSON` wraps `GM_xmlhttpRequest`'s `onerror` / `onabort` in a real `Error`.
- Small global sets are normal. 7TV returns sporadic 502s.

## DOM And Routing Notes

Kick is an SPA and renames classes. Selectors: `MSG_SELECTORS`, `SKIP_TEXT_SELECTORS` (chrome text, not message content), `INPUT_SELECTORS`, `NON_CHANNEL_SLUGS`. When fixing breakage, **add fallback selectors, don't replace working ones**. How to check them on a live channel without an account, and the measured observer cost (not worth scoping), are in the notes.

- **Chat settings menu** `#chat-settings-panel` (signed-in only): an inline popover on desktop, a vaul drawer on narrow screens. Find the top level by its `ChevronRight` rows; `init()` also runs the row injection once for a menu already open. The template is always a native row, never one tagged `data-kick-family-row`.
- **Emote picker** `#chat-emotes-picker-panel` exists only where you can post (not logged out, not followers-only you don't follow).
- Keep working: existing messages, new messages, autocomplete, and channel navigation without a reload.

## Emote Rendering Notes

- Emote images use `.kte-img`, sized by `--kte-emote-size` (28px by default; the size setting changes it), with zero-width overlays matching at `.kte-zw`. Change both together.
- Zero-width emotes overlay the previous emote via `.kte-zw` — 7TV emotes flagged by the provider, plus the BTTV codes in `BTTV_ZERO_WIDTH`. The whitespace token preceding an absorbed overlay is dropped: the overlay is absolutely positioned, so that space renders as a stray gap (chat is `pre-wrap`) and orphans on un-render, growing by one space per toggle cycle.
- **Motion.** Every place that shows an emote image takes it from `emoteDisplayUrl(emote)`, not `emote.url`, and the hover preview from `emoteHoverUrl(emote)`. Both follow `motionMode()`: the `motion` setting, forced to `'never'` under `prefers-reduced-motion: reduce`. Anything but `'always'` shows the `staticUrl` still frame at rest (7TV and FFZ animated emotes have one; BTTV has none, so its animated emotes keep moving); `'hover'` records the animated URL on chat images (`setEmoteHoverSrc()`, the same `data-kte-src` / `data-kte-anim-src` pair the picker uses) and `emoteWrapAnimate()` swaps it in on `mouseenter`, overlays included. `'never'` also drops the picker's animate-on-hover. The `reducedMotionQuery` `change` listener calls `rerenderEmotes()` and `pickerRefreshIfBuilt()`, so the switch is live. `emote.url` is still what *Copy image URL* and the provider-page link use — they describe the emote, not what is on screen.
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

The family spec is [DESIGN.md](DESIGN.md), identical in every kick-* repo and checked by `test/family-style.js`. Where it and this file disagree, DESIGN.md wins. Full component notes and reference implementations are in the notes (*UI Design System*).

- Every value is a literal in `_style.textContent`. The script defines **no CSS variables** for colours; don't add `var(--kte-…)`.
- Allowed non-family colours, and no others without the same kind of reason: provider badges (7TV `#4da6ff`, BTTV `#ff6b6b`, FFZ `#c084fc`, other `#22c55e`, at `opacity: .85`, 10px, 600), the favourite star `#facc15`, hint grey `rgba(255,255,255,.4)`, the tooltip separator `rgba(255,255,255,.25)`, and `#71717a` / `#efeff1` in the 7TV+ tab to match Kick's picker.
- `#kte-tip` and `#kte-menu` are small popups; `#kte-ac` is a large one. Picker cells use `4px` radius like Kick's grid.
- Tooltips only through `showTooltip()` / `hideTooltip()`, never a native `title`. The tooltip tracks its anchor via `tipAnchor` plus a capture-phase `scroll` listener.
- `#kte-panel` is the family settings card, identical to kqs's `.kqs-card` and kfc's `#kfc-settings-panel`. Its card and groups are **grid**, not flex (a Safari bug). Change it together with the siblings.
- The picker's chip row uses the panel's inset-group surface, not `#101013`. Under reduced motion it only fades.

## Code Style

The kick-* scripts share these conventions. Follow them in new and edited code; don't reformat whole files just to comply — existing code converges as it's touched.

- 2-space indent, no tabs, no trailing whitespace; semicolons; single-quoted strings, template literals when interpolating.
- `const` by default, `let` only when the binding is reassigned, never `var`; `===` / `!==` only.
- Named functions are `function` declarations (`function applyQuality() {…}`); arrow functions are for callbacks and short inline helpers.
- Injected CSS is one readable template literal, one declaration per line.
- Section dividers: `// ── Name ───…` — two box-drawing dashes, a space, the name, then a run of dashes.
- Log through the script's `log()` / `warn()` helpers, which carry the `[Name]` prefix.
- Comments say why, not what. History belongs in `CHANGELOG.md`, not in comments.

## Manual Testing

Run `test/run.sh` first. Live checks need a **live** Kick channel (offline ones have no chat). The full steps are in [docs/manual-testing.md](docs/manual-testing.md):

- **1–6** install, console lines, global and channel emotes, autocomplete, channel navigation
- **7–14** context menu, Recently used, favourites, tooltip preview and tracking, provider chips, Load more / Show less, the sticky chip row
- **15–18** popout chat, zero-width overlays, the 7TV+ tab against Kick's tabs, dash/underscore slugs
- **19–21** two copies, Reduce motion, the chat settings row

## Documentation

Update `INSTALL.md` when installation steps, supported providers, troubleshooting guidance, or user-visible behavior changes.

`DESIGN.md` is the kick-* family design spec, shared word for word by all five repos: change it in every repo at once (the command is at its top), never in one.

`GREASYFORK.md` is the Greasy Fork page description, written for people reading the listing: what the script does now, a **Latest changes** section for the newest version, and no installation steps. Keep its features, numbers, permissions and storage keys in step with the code, as for `README.md`.

Keep docs browser-agnostic. When mentioning installation steps, cover the general flow and call out manager-specific differences (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) where they matter.

## Before Every Commit

Before committing any change, always:

1. **Run `test/run.sh`** (see **Commands**) — it runs the syntax check and the tests, and must end with `all tests passed`. Add or update tests for any logic you change.
2. **Bump `@version`** in the `kick-third-party-emotes.user.js` metadata header using these rules:

   | Change | Bump | Example |
   |---|---|---|
   | New user-facing feature — new provider, new UI component, new keyboard shortcut | **minor** `x.+1.0` | `2.6.x → 2.7.0` |
   | Bug fix, style tweak, refactor, internal change | **patch** `x.x.+1` | `2.6.x → 2.6.x+1` |
   | Breaking change or full rewrite | **major** `+1.0.0` | `2.x.x → 3.0.0` |

   Bump the `VERSION` constant inside the IIFE to the same value — it is what the boot line and the duplicate warning report. Verify both with:

   ```bash
   grep -n "@version\|const VERSION" kick-third-party-emotes.user.js
   ```

3. **Update `CHANGELOG.md`** — add an entry under the new version with a short summary of what changed.
4. **Update `README.md`** if the change is user-facing: new or removed features, changed behaviour, new keyboard shortcuts, provider changes, or updated troubleshooting steps. Internal refactors and bug fixes that don't change user-facing behaviour do not require a README update.
5. **Suggest a GitHub Release** after every commit if any of the following apply — say "this looks like a good point to publish a GitHub Release":
   - A security fix was made
   - A user-facing feature was added (new provider, new UI component, new keyboard shortcut)
   - A bug affecting core functionality was fixed (emotes not loading, autocomplete broken, picker missing)

   Do NOT suggest a release for: docs-only changes, internal refactors, formatting, style tweaks the user won't notice.

   A release is what ships to users. Create it from the `vX.Y.Z` tag, attach `kick-third-party-emotes.user.js` under exactly that name, and use notes from the `release-notes` skill. Publish it promptly after pushing a version: until then, auto-updating users stay on the previous release. Before tagging, refresh **Latest changes** in `GREASYFORK.md` (the `release-notes` skill does this). Once the [Greasy Fork](https://greasyfork.org/scripts/578174-kick-third-party-emotes) listing's sync is set up (code from the latest-release URL above, page description from `GREASYFORK.md` on `main`, plus a GitHub webhook), publishing the release updates Greasy Fork too. Until then, upload the same version there by hand — Greasy Fork installs update only from Greasy Fork.

**Commit when a task is finished** and the checks above pass — one commit per finished task, in this repo's commit-message style. **Push only when the user asks.**
