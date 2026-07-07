# Kick Third-Party Emotes — Installation

Adds **BetterTTV**, **7TV**, and **FrankerFaceZ** emotes to Kick.com chat.

## Quick install

Open **[Kick Third-Party Emotes on Greasy Fork](https://greasyfork.org/cs/scripts/578174-kick-third-party-emotes)** and use the install button if your userscript manager supports web installs.

If your manager does not catch Greasy Fork installs automatically, use the manual steps below.

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

The script uses standard GM APIs (only `GM_xmlhttpRequest`) and should work with any userscript manager that honours `@grant GM_xmlhttpRequest` and `@connect`. Tested only on Safari + Userscripts; the rest are listed for reference.

**[Tampermonkey](https://www.tampermonkey.net)** (Chrome, Firefox, Edge, Safari, Opera):
1. Install the Tampermonkey extension for your browser.
2. Open the Tampermonkey dashboard → **Create a new script**.
3. Replace the default content with the contents of `kick-emotes.user.js` and save.

**[Violentmonkey](https://violentmonkey.github.io)** (Chrome, Firefox, Edge):
1. Install the Violentmonkey extension.
2. Click the Violentmonkey icon → **+** → **New script**.
3. Paste the contents of `kick-emotes.user.js` and save.

**[Greasemonkey](https://www.greasespot.net)**:
1. Install the Greasemonkey add-on from [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/greasemonkey/).
2. Click the Greasemonkey icon → **New user script…**.
3. Fill in any name, click **OK**, then paste the contents of `kick-emotes.user.js` over the template and save.

**[ScriptCat](https://scriptcat.org)** (Chrome, Firefox, Edge):
1. Install the ScriptCat extension.
2. Open the ScriptCat manager → **+** → **New script**.
3. Paste the contents of `kick-emotes.user.js` and save.

**Other managers** (e.g. AdGuard, Stay for Safari, Userscript Loader): the install flow is the same — create a new script in the manager's UI and paste the file contents. Auto-update via `@updateURL` works in any manager that honours that directive.

## How it works

| Source | Coverage |
|--------|----------|
| **BetterTTV** | ~2 000 global emotes + channel emotes (when available) |
| **7TV** | ~1 000 global emotes + channel emotes (via Kick or Twitch lookup) |
| **FrankerFaceZ** | ~500 global emotes + channel emotes |

- On every Kick channel page the script fetches emotes from all three services.
- Chat messages are scanned as they arrive; any matching word is replaced with the emote image.
- Hover over an emote to see its name and which service it came from.
- Open Kick's emote picker and choose the **7TV+** tab to browse/search loaded third-party emotes; clicking one inserts its text code into chat. The picker starts with 40 matches per provider for performance, offers **Load more** per provider, and search narrows across all loaded emotes.
- Navigating between channels reloads the channel-specific emote sets automatically.

## Updating

The userscript metadata includes `@updateURL` and `@downloadURL` pointing at the `main` branch on GitHub. Most managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) honour these and auto-update when a new `@version` is published. Greasemonkey uses a longer default check interval (set in its preferences). **Safari's Userscripts extension is the exception** — it runs from a local folder and does not fetch `@updateURL`, so you must re-copy the latest `kick-emotes.user.js` into your scripts folder to update. To update manually in any manager, replace `kick-emotes.user.js` with the new version.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open your browser's DevTools → Console on kick.com and look for `[KickEmotes]` log lines. If missing, check the extension is enabled for kick.com. |
| Emotes appear for global but not channel | The streamer may not have BTTV/7TV/FFZ set up for their Kick channel. |
| 7TV+ tab missing | Close and reopen Kick's native emote picker after the `[KickEmotes] Ready` log appears. |
| Images broken after Kick update | Kick may have changed their chat DOM class names. Open an issue with the new class names found in the browser inspector. |
