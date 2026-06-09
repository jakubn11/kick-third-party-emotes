<div align="center">

<img src="icon.svg" width="108" height="108" alt="Kick Third-Party Emotes">

<h1>Kick Third-Party Emotes</h1>

<p>
  BetterTTV, 7TV, and FrankerFaceZ emotes directly in Kick.com chat.<br>
  Animated GIFs · Zero-width overlays · Autocomplete · Native emote picker tab.
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
- Zero-width 7TV emote overlays
- Hover tooltips showing emote name and provider
- Autocomplete popup when typing (prefix match, keyboard navigation)
- Third-party emote tab inside Kick's native emote picker with search, animated emotes, and per-provider **Load more**
- Stale-while-revalidate local cache per provider to show repeat-visit emotes immediately while refreshing in the background
- Works with Kick's SPA routing — no page reload needed when switching channels

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
3. Copy `kick-emotes.user.js` into that folder

**Other browsers (untested):**
1. Install [Tampermonkey](https://www.tampermonkey.net), [Violentmonkey](https://violentmonkey.github.io), [Greasemonkey](https://www.greasespot.net), [ScriptCat](https://scriptcat.org) or other
2. Open `kick-emotes.user.js` and paste it into a new script, or drag the file into the extension dashboard

**Updates:** The script carries `@updateURL` / `@downloadURL` pointing at this repo, so managers that support remote updates (Tampermonkey, Violentmonkey, ScriptCat, …) pick up new versions automatically — no reinstall needed. Safari's Userscripts extension runs from a local folder and does **not** auto-update; re-copy the latest `kick-emotes.user.js` to update there.

See [INSTALL.md](INSTALL.md) for full per-manager steps.

## Providers

| Provider | Global emotes | Channel emotes |
|----------|--------------|----------------|
| BetterTTV | ~2 000 | Kick + Twitch fallback |
| 7TV | ~1 000 | Kick + Twitch fallback |
| FrankerFaceZ | ~500 | Kick channel |

Provider failures are isolated — if one fails, the others still load.

## Usage

Open any Kick channel. Emotes load automatically and replace matching words in chat.

**Autocomplete:** start typing an emote name in the chat input to open the suggestion popup.

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate suggestions |
| Tab | Insert selected emote (auto-inserts if only one match) |
| Esc | Close autocomplete |

**Emote picker:** open Kick's native emote picker and choose the **7TV+** tab to browse animated third-party emotes. The picker starts with 80 matches per provider for performance, then offers **Load more** per provider. Search narrows across all loaded emotes. Clicking an emote inserts its code into the chat input. Animated 7TV emotes show their frozen first frame in the picker and start animating when you hover them — this keeps the page responsive when browsing large emote sets.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open your browser's DevTools → Console and look for `[KickEmotes]` log lines. If absent, check that your userscript extension is enabled for kick.com. |
| Only global emotes load | The streamer may not have BTTV/7TV/FFZ configured for their channel. |
| Emotes stop working after a Kick update | Kick may have changed their chat DOM selectors. Open an issue with the relevant class names from the browser inspector. |
| Stale emotes after a script update | Clear the cache: `Object.keys(localStorage).filter(k => k.startsWith('kte_')).forEach(k => localStorage.removeItem(k))` |

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
