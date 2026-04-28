# Kick Third-Party Emotes — Safari Installation

Adds **BetterTTV**, **7TV**, and **FrankerFaceZ** emotes to Kick.com chat in Safari.

## Requirements

Safari on macOS requires a userscript host app.  
**Userscripts** (free, by Justin Wasack) is the recommended one:

1. Install **Userscripts** from the Mac App Store:  
   `https://apps.apple.com/app/userscripts/id1463298887`

2. Open Safari → **Settings** → **Extensions** → enable **Userscripts**.

3. Click the Userscripts toolbar icon and choose a folder to store your scripts  
   (e.g. `~/Documents/Userscripts`).

## Install the script

Copy `kick-emotes.user.js` into the folder you chose in step 3.  
Userscripts picks it up automatically — no reload needed.

Alternatively, click the Userscripts icon while on any page and use  
**"Open Scripts Directory"** to locate the right folder.

## How it works

| Source | Coverage |
|--------|----------|
| **BetterTTV** | ~2 000 global emotes + channel emotes (when available) |
| **7TV** | ~1 000 global emotes + channel emotes (via Kick or Twitch lookup) |
| **FrankerFaceZ** | ~500 global emotes + channel emotes |

- On every Kick channel page the script fetches emotes from all three services.  
- Chat messages are scanned as they arrive; any matching word is replaced with  
  the emote image.  
- Hover over an emote to see its name and which service it came from.  
- Open Kick's emote picker and choose the **7TV+** tab to browse/search loaded
  third-party emotes; clicking one inserts its text code into chat. The emote
  list scrolls independently, like Kick's native picker tabs.
- Navigating between channels reloads the channel-specific emote sets automatically.

## Updating

Replace `kick-emotes.user.js` with the new version — Userscripts hot-reloads it.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open the Safari developer console on kick.com and look for `[KickEmotes]` log lines. If missing, check the extension is enabled. |
| Emotes appear for global but not channel | The streamer may not have BTTV/7TV/FFZ set up for their Kick channel. |
| 7TV+ tab missing | Close and reopen Kick's native emote picker after the `[KickEmotes] Ready` log appears. |
| Images broken after Kick update | Kick may have changed their chat DOM class names. Open an issue with the new class names found in the inspector. |
