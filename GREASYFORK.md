# Kick Third-Party Emotes

Brings **BetterTTV**, **7TV** and **FrankerFaceZ** emotes to **Kick.com chat** — animated and zero-width emotes, autocomplete, favourites and a third-party tab in Kick's own emote picker.

## Latest changes

**2.21.2** — Close button tooltip and reduced motion

- **Close button tooltip** — the settings panel's ✕ showed the browser's plain tooltip; it now shows the same dark tooltip as the script's other controls.
- **Reduced motion** — with *reduce motion* on in your system, the provider row at the top of the 7TV+ tab now fades in place as the grid scrolls instead of sliding up.

Full history: [CHANGELOG.md](https://github.com/jakubn11/kick-third-party-emotes/blob/main/CHANGELOG.md)

## Features

- **Emotes from 7TV, BTTV and FFZ** rendered inline in chat, with each channel's own sets loaded automatically as you switch channels
- **Animated emotes** (GIF and animated WebP) — play always, only on hover, or never; with your system's *Reduce motion* setting on, 7TV and FFZ animated emotes show a still frame
- **Zero-width emotes** layered over the previous emote (7TV overlays and BTTV's `cvMask`, `SoSnowy`, `SantaHat` and similar)
- **Hover previews** — a large preview with the emote's name and provider (can be switched off)
- **Autocomplete** while typing — favourites first, then your most-used emotes, with keyboard navigation
- **Favourites** — star emotes from the right-click menu; up to 100 are kept
- **Right-click menu** — favourite an emote, copy its name or image URL, or open its 7TV/BTTV/FFZ page
- **7TV+ picker tab** inside Kick's emote picker, with Favourites and Recently used sections, search (closest names first), and **Load more** / **Show less** per provider (40 at a time)
- **Settings** — turn 7TV, BTTV or FFZ off from chips in the picker; the settings panel switches off each provider's global emotes, sets how animated emotes play, resizes emotes in chat (24, 28 or 36 px), turns autocomplete or the large preview off, and shows your recently used emotes with a button to clear them. Changes apply instantly and carry over to your other open Kick tabs. Everything the script shows follows the language Kick is shown in (28 languages, English otherwise)
- **Fast repeat visits** — emote sets are cached locally and refreshed in the background
- A dark popup style with a green accent that matches the other kick-* userscripts

## How to use

Open any Kick channel. Emotes load automatically and replace matching words in chat. Start typing an emote name to open autocomplete:

| Key | Action |
|--------|--------|
| ↑ / ↓ | Move through suggestions |
| Tab | Insert the selected emote (the top match if none is selected) |
| Enter | Insert the highlighted emote, or send the message if nothing is highlighted |
| Esc | Close autocomplete |

Open Kick's emote picker and choose the **7TV+** tab to browse, search and toggle providers; the settings panel is under **Third-party emotes** in Kick's chat settings menu (the gear beside **Chat**) and **Emote settings** (in Kick's language) in your userscript manager's menu. Right-click any third-party emote for the context menu.

## Privacy & permissions

- `@grant GM_xmlhttpRequest`, used only to fetch emote lists and images from `api.betterttv.net`, `cdn.betterttv.net`, `7tv.io`, `cdn.7tv.app`, `api.frankerfacez.com` and `cdn.frankerfacez.com`.
- `@grant GM_registerMenuCommand`, used only to add **Emote settings** to your userscript manager's menu.
- Settings (`kte_v2_settings`), favourites (`kte_v2_favs`), emote usage counts (`kte_v2_usage`) and the emote-set cache (`kte_v5_*` keys) are kept in `localStorage` and never leave your machine. No analytics, no tracking.

## Compatibility

Developed and tested on **Safari** with the [Userscripts](https://apps.apple.com/app/userscripts/id1463298887) extension. Tampermonkey, Violentmonkey, ScriptCat and other managers should work too.

## Links

- Source code, changelog and issues: [github.com/jakubn11/kick-third-party-emotes](https://github.com/jakubn11/kick-third-party-emotes)
- What's new: [CHANGELOG.md](https://github.com/jakubn11/kick-third-party-emotes/blob/main/CHANGELOG.md)

Licensed under GPL-3.0.
