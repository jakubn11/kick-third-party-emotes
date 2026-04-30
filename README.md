# Kick Third-Party Emotes

Safari userscript that adds **BetterTTV**, **7TV**, and **FrankerFaceZ** emotes to [Kick.com](https://kick.com) chat.

## Features

- Emotes from three providers rendered inline in chat messages
- Per-channel emote sets loaded automatically on navigation
- Animated emote support (GIF)
- Zero-width 7TV emote overlays
- Autocomplete popup when typing in chat (prefix match, keyboard navigation)
- Native Kick emote picker integration with a third-party emotes tab
- Hover tooltips showing emote name and provider
- 1-hour localStorage cache to avoid redundant API requests
- Works with Kick's SPA routing — no full page reload needed between channels

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

Open any Kick channel. Emotes load automatically and replace matching words in chat. Type an emote name in the chat input to trigger autocomplete.

You can also open Kick's native emote picker and choose the **7TV+** tab to browse or search loaded third-party emotes. Clicking an emote inserts its text code into chat, and the emote list scrolls independently like Kick's native picker tabs.

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate suggestions |
| Tab | Insert selected emote (auto-inserts if only one match) |
| Esc | Close autocomplete |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open Safari DevTools → Console and check for `[KickEmotes]` log lines. If absent, verify the Userscripts extension is enabled for kick.com. |
| Only global emotes load | The streamer may not have BTTV/7TV/FFZ configured for their channel. |
| Emotes stop working after a Kick update | Kick may have changed their chat DOM. Open an issue with the class names from Safari Inspector. |
| Stale emotes after script update | Clear the cache in the console: `Object.keys(localStorage).filter(k => k.startsWith('kte_')).forEach(k => localStorage.removeItem(k))` |

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
