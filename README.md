<div align="center">

<img src="icon.svg" width="108" height="108" alt="Kick Third-Party Emotes">

<h1>Kick Third-Party Emotes</h1>

<p>
  BetterTTV, 7TV, and FrankerFaceZ emotes directly in Kick.com chat.<br>
  Animated GIFs · Zero-width overlays · Autocomplete · Favourites · Native emote picker tab.
</p>

<p>
  <img alt="Userscript" src="https://img.shields.io/badge/Userscript-Any%20Manager-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="License GPLv3" src="https://img.shields.io/badge/license-GPLv3-55d2ce?style=flat-square&labelColor=555555">
  &nbsp;
  <img alt="Tested on Safari" src="https://img.shields.io/badge/Tested%20on-Safari-22c55e?style=flat-square&logo=safari&logoColor=fff&labelColor=101013">
  &nbsp;
  <img alt="Providers" src="https://img.shields.io/badge/Providers-BTTV%20%C2%B7%207TV%20%C2%B7%20FFZ-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="Animated emotes" src="https://img.shields.io/badge/Animated-GIF%20%2B%20Zero%E2%80%91Width-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="Autocomplete" src="https://img.shields.io/badge/Tab-Autocomplete-22c55e?style=flat-square&labelColor=101013">
</p>

</div>

## Features

- Emotes from three providers rendered inline in chat messages
- Per-channel emote sets loaded automatically on navigation
- Animated emote support (GIF)
- Zero-width emote overlays (7TV overlay emotes and BTTV's `cvMask`, `SoSnowy`, `SantaHat` & co.)
- Hover tooltips showing a large emote preview with its name and provider
- Favourite emotes — star them from the right-click menu for a pinned picker section and top billing in autocomplete
- Settings in the picker — turn individual providers off, applied instantly
- Autocomplete popup when typing (prefix match with substring fallback, favourites then your most-used emotes first, keyboard navigation)
- Right-click context menu on chat and picker emotes — favourite it, copy the name or image URL, or open the emote's 7TV/BTTV/FFZ page
- Third-party emote tab inside Kick's native emote picker with **Favourites** and **Recently used** sections, search, animated emotes, and per-provider **Load more**
- Stale-while-revalidate local cache per provider to show repeat-visit emotes immediately while refreshing in the background
- Works with Kick's SPA routing — no page reload needed when switching channels
- A clean dark glass popup style with a green accent, matching the sibling [kick-fullscreen-chat](https://github.com/jakubn11/kick-fullscreen-chat), [kick-quality-saver](https://github.com/jakubn11/kick-quality-saver), [kick-chat-utils](https://github.com/jakubn11/kick-chat-utils), and [kick-vod-resume](https://github.com/jakubn11/kick-vod-resume) userscripts' design language

## Requirements

The script works with any userscript manager (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat or other) but is developed and tested on **Safari + Userscripts** only. Other browsers and managers may work but are untested.

**Recommended setup:**
- macOS with Safari
- [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension (free, by Justin Wasack)

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step instructions.

**Quick install:** open the script on **[Greasy Fork](https://greasyfork.org/cs/scripts/578174-kick-third-party-emotes)** and use the install button if your userscript manager supports web installs.

**Safari (recommended):**
1. Install the **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** extension from the Mac App Store
2. Configure a scripts folder in the extension settings
3. Copy `kick-third-party-emotes.user.js` into that folder

**Other browsers (untested):**
1. Install [Tampermonkey](https://www.tampermonkey.net), [Violentmonkey](https://violentmonkey.github.io), [Greasemonkey](https://www.greasespot.net), [ScriptCat](https://scriptcat.org) or other
2. Open `kick-third-party-emotes.user.js` and paste it into a new script, or drag the file into the extension dashboard

**Updates:** The script carries `@updateURL` / `@downloadURL` pointing at this repo, so managers that support remote updates (Tampermonkey, Violentmonkey, ScriptCat, …) pick up new versions automatically — no reinstall needed. Safari's Userscripts extension runs from a local folder and does **not** auto-update; re-copy the latest `kick-third-party-emotes.user.js` to update there.

See [INSTALL.md](INSTALL.md) for full per-manager steps.

## Providers

| Provider | Global emotes | Channel emotes |
|----------|--------------|----------------|
| BetterTTV | ~65 | The streamer's Twitch account |
| 7TV | ~45 | The streamer's Kick account, Twitch as fallback |
| FrankerFaceZ | ~10 | The streamer's Twitch room |

BetterTTV and FrankerFaceZ don't support Kick, so their channel emotes come from the streamer's Twitch account: the one linked on their 7TV profile, or failing that the Twitch channel with the same name as the Kick account.

Global sets are small by design — they're each provider's curated default set. The bulk of what you see comes from the channel sets, which is where streamers put hundreds of emotes. FFZ's global "emote effects" (`ffzSpin`, `ffzRainbow`, …) are skipped: they're modifiers meant to animate the preceding emote, not emotes in their own right.

Provider failures are isolated — if one fails, the others still load.

## Usage

Open any Kick channel. Emotes load automatically and replace matching words in chat.

**Autocomplete:** start typing an emote name in the chat input to open the suggestion popup.

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate suggestions |
| Tab | Insert the selected emote (top match if none is selected) |
| Enter | Insert the highlighted emote — sends the message as usual when nothing is highlighted |
| Esc | Close autocomplete |

**Context menu:** right-click any third-party emote — in chat or in the picker — to favourite it, copy its name or image URL, or open its page on the source provider.

**Favourites:** starred emotes get a ★ marker wherever they appear, a **Favourites** section at the top of the picker (most recently starred first), and first place in the autocomplete ranking, ahead of your most-used emotes. Up to 100 are kept locally; starring a 101st drops the oldest.

**Settings:** the 7TV+ picker tab opens with a row of chips that turn 7TV, BTTV and FFZ on or off. Changes apply straight away — already-rendered messages update in place. The row hides itself as soon as you scroll the grid and slides back when you scroll to the top, so it never covers emotes. Hidden providers are still fetched in the background so switching one back on is instant. Your choices are stored locally in `kte_v2_settings`.

**Emote picker:** open Kick's native emote picker and choose the **7TV+** tab to browse animated third-party emotes. **Favourites** and **Recently used** sections appear above the provider groups. The picker starts with 40 matches per provider for performance, then offers **Load more** per provider. Search narrows across all loaded emotes. Clicking an emote inserts its code into the chat input. Animated 7TV emotes show their frozen first frame in the picker and start animating when you hover them — this keeps the page responsive when browsing large emote sets.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Emotes from one provider are missing | Check the provider chips at the top of the 7TV+ picker tab — a greyed-out chip means that provider is switched off. |
| No emotes appear | Open your browser's DevTools → Console and look for `[KickEmotes]` log lines. If absent, check that your userscript extension is enabled for kick.com. |
| Only global emotes load | The streamer may not have BTTV/7TV/FFZ configured for their channel. BTTV and FFZ emotes only show up if the streamer's Twitch account is linked on their 7TV profile or has the same name as their Kick account. |
| Console says `[KickEmotes] … is standing down` | Two copies of the script are installed — typically a manual copy next to the Greasy Fork or auto-updating one, or two managers both enabled for kick.com. The second copy stopped itself and the first is running normally; remove the duplicate. |
| Emotes stop working after a Kick update | Kick may have changed their chat DOM selectors. Open an issue with the relevant class names from the browser inspector. |
| Stale emotes after a script update | Clear the cache: `Object.keys(localStorage).filter(k => k.startsWith('kte_') && !['kte_v2_usage', 'kte_v2_favs', 'kte_v2_settings'].includes(k)).forEach(k => localStorage.removeItem(k))` — the `kte_v2_usage`, `kte_v2_favs` and `kte_v2_settings` keys are excluded so your favourites, recently-used emotes, autocomplete ranking, and settings survive. |

## How it works

On each channel page the script resolves the channel once through Kick's own API — its Kick user ID and username — then loads channel and global emotes from all three providers: **7TV** by the Kick user ID, **BTTV** and **FFZ** through the streamer's Twitch account (taken from 7TV's linked accounts, or FFZ's same-named room). The Kick lookup is a same-origin request to `kick.com`, the way Kick's own frontend makes it; provider requests go only to the providers' hosts, through `GM_xmlhttpRequest` and the `@connect` list in the metadata. Each provider's set is cached locally, so a repeat visit shows emotes straight away while a fresh copy loads; a provider that fails keeps its last good set and never takes the other two down. Chat messages are scanned as they arrive and matching words are replaced with the emote image, with zero-width emotes stacked on the one before them. Autocomplete, the context menu and the **7TV+** picker tab all work from the same loaded sets. Favourites, usage counts and provider settings live in their own `localStorage` keys and survive a cache clear.

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
