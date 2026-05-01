# Kick Third-Party Emotes — Installation

Adds **BetterTTV**, **7TV**, and **FrankerFaceZ** emotes to Kick.com chat.

## Safari (recommended)

Safari requires a userscript host app. **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** (free, by Justin Wasack) is the recommended one.

1. Install **[Userscripts](https://apps.apple.com/app/userscripts/id1463298887)** from the Mac App Store.

2. Open Safari → **Settings** → **Extensions** → enable **Userscripts**.

3. Click the Userscripts toolbar icon and choose a folder to store your scripts  
   (e.g. `~/Documents/Userscripts`).

4. Copy `kick-emotes.user.js` into that folder — Userscripts picks it up automatically.

   Alternatively, click the Userscripts icon while on any page and use  
   **"Open Scripts Directory"** to locate the right folder.

## Other browsers (untested)

The script uses standard GM APIs and should work with any userscript manager, but has not been tested outside Safari.

**[Tampermonkey](https://www.tampermonkey.net)** (Chrome, Firefox, Edge, Safari):
1. Install the Tampermonkey extension for your browser.
2. Open the Tampermonkey dashboard → **Create a new script**.
3. Replace the default content with the contents of `kick-emotes.user.js` and save.

**[Violentmonkey](https://violentmonkey.github.io)** (Chrome, Firefox, Edge):
1. Install the Violentmonkey extension.
2. Click the Violentmonkey icon → **+** → **New script**.
3. Paste the contents of `kick-emotes.user.js` and save.

## How it works

| Source | Coverage |
|--------|----------|
| **BetterTTV** | ~2 000 global emotes + channel emotes (when available) |
| **7TV** | ~1 000 global emotes + channel emotes (via Kick or Twitch lookup) |
| **FrankerFaceZ** | ~500 global emotes + channel emotes |

- On every Kick channel page the script fetches emotes from all three services.
- Chat messages are scanned as they arrive; any matching word is replaced with the emote image.
- Hover over an emote to see its name and which service it came from.
- Open Kick's emote picker and choose the **7TV+** tab to browse/search loaded third-party emotes; clicking one inserts its text code into chat. The picker starts with 80 matches per provider for performance, offers **Load more** per provider, and search narrows across all loaded emotes.
- Navigating between channels reloads the channel-specific emote sets automatically.

## Updating

Replace `kick-emotes.user.js` with the new version. Userscripts and Tampermonkey hot-reload the script automatically.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open your browser's DevTools → Console on kick.com and look for `[KickEmotes]` log lines. If missing, check the extension is enabled for kick.com. |
| Emotes appear for global but not channel | The streamer may not have BTTV/7TV/FFZ set up for their Kick channel. |
| 7TV+ tab missing | Close and reopen Kick's native emote picker after the `[KickEmotes] Ready` log appears. |
| Images broken after Kick update | Kick may have changed their chat DOM class names. Open an issue with the new class names found in the browser inspector. |
