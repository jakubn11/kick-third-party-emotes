<p align="center">
  <img src="icon.svg" width="96" height="96" alt="Kick Third-Party Emotes icon">
</p>

<h1 align="center">Kick Third-Party Emotes</h1>

<p align="center">
  <strong>Safari userscript that adds BetterTTV, 7TV, and FrankerFaceZ emotes to Kick.com chat.</strong>
</p>

<p align="center">
  <img alt="Safari userscript" src="https://img.shields.io/badge/Safari-Userscript-22c55e?style=flat-square&logo=safari&logoColor=fff&labelColor=101013">
  &nbsp;
  <img alt="Providers" src="https://img.shields.io/badge/Providers-BTTV%20%C2%B7%207TV%20%C2%B7%20FFZ-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="Animated emotes" src="https://img.shields.io/badge/Animated-GIF%20%2B%20Zero%E2%80%91Width-22c55e?style=flat-square&labelColor=101013">
  &nbsp;
  <img alt="Autocomplete" src="https://img.shields.io/badge/Tab-Autocomplete-22c55e?style=flat-square&labelColor=101013">
</p>

## Features

- Emotes from three providers rendered inline in chat messages
- Per-channel emote sets loaded automatically on navigation
- Animated emote support (GIF)
- Zero-width 7TV emote overlays
- Hover tooltips showing emote name and provider
- Autocomplete popup when typing (prefix match, keyboard navigation)
- Third-party emote tab inside Kick's native emote picker with search, animated emotes, and per-provider **Load more**
- 1-hour localStorage cache per provider to avoid redundant API requests
- Works with Kick's SPA routing — no page reload needed when switching channels

## Requirements

- macOS with Safari
- [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension (free, by Justin Wasack)

## Installation

See [INSTALL.md](INSTALL.md) for step-by-step instructions.

Short version:
1. Install the **Userscripts** Safari extension from the Mac App Store
2. Configure a scripts folder in the extension settings
3. Copy `kick-emotes.user.js` into that folder

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

**Emote picker:** open Kick's native emote picker and choose the **7TV+** tab to browse animated third-party emotes. The picker starts with 80 matches per provider for performance, then offers **Load more** per provider. Search narrows across all loaded emotes. Clicking an emote inserts its code into the chat input.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open Safari DevTools → Console and look for `[KickEmotes]` log lines. If absent, check that the Userscripts extension is enabled for kick.com. |
| Only global emotes load | The streamer may not have BTTV/7TV/FFZ configured for their channel. |
| Emotes stop working after a Kick update | Kick may have changed their chat DOM selectors. Open an issue with the relevant class names from Safari Inspector. |
| Stale emotes after a script update | Clear the cache: `Object.keys(localStorage).filter(k => k.startsWith('kte_')).forEach(k => localStorage.removeItem(k))` |

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
