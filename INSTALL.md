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

4. Copy `kick-third-party-emotes.user.js` into that folder — Userscripts picks it up automatically.

   Alternatively, click the Userscripts icon while on any page and use  
   **"Open Scripts Directory"** to locate the right folder.

## Other browsers (untested)

The script uses standard GM APIs (only `GM_xmlhttpRequest`) and should work with any userscript manager that honours `@grant GM_xmlhttpRequest` and `@connect`. Tested only on Safari + Userscripts; the rest are listed for reference.

**[Tampermonkey](https://www.tampermonkey.net)** (Chrome, Firefox, Edge, Safari, Opera):
1. Install the Tampermonkey extension for your browser.
2. Open the Tampermonkey dashboard → **Create a new script**.
3. Replace the default content with the contents of `kick-third-party-emotes.user.js` and save.

**[Violentmonkey](https://violentmonkey.github.io)** (Chrome, Firefox, Edge):
1. Install the Violentmonkey extension.
2. Click the Violentmonkey icon → **+** → **New script**.
3. Paste the contents of `kick-third-party-emotes.user.js` and save.

**[Greasemonkey](https://www.greasespot.net)**:
1. Install the Greasemonkey add-on from [addons.mozilla.org](https://addons.mozilla.org/firefox/addon/greasemonkey/).
2. Click the Greasemonkey icon → **New user script…**.
3. Fill in any name, click **OK**, then paste the contents of `kick-third-party-emotes.user.js` over the template and save.

**[ScriptCat](https://scriptcat.org)** (Chrome, Firefox, Edge):
1. Install the ScriptCat extension.
2. Open the ScriptCat manager → **+** → **New script**.
3. Paste the contents of `kick-third-party-emotes.user.js` and save.

**Other managers** (e.g. AdGuard, Stay for Safari, Userscript Loader): the install flow is the same — create a new script in the manager's UI and paste the file contents. Auto-update via `@updateURL` works in any manager that honours that directive.

## How it works

| Source | Coverage |
|--------|----------|
| **BetterTTV** | ~65 global emotes + channel emotes from the streamer's Twitch account |
| **7TV** | ~45 global emotes + channel emotes (Kick account, Twitch as fallback) |
| **FrankerFaceZ** | ~10 global emotes + channel emotes from the streamer's Twitch room |

Global sets are each provider's small curated default; channel sets are where the hundreds of emotes come from. BetterTTV and FrankerFaceZ have no Kick support, so their channel emotes come from the Twitch account linked on the streamer's 7TV profile, or the Twitch channel with the same name.

- On every Kick channel page the script looks the channel up through Kick's own API, then fetches emotes from all three services.
- Chat messages are scanned as they arrive; any matching word is replaced with the emote image.
- Start typing an emote name in the chat input to get an autocomplete popup — ↑/↓ to navigate, Tab or Enter to insert, Esc to close. Favourites rank first, then your most-used emotes.
- Hover over an emote to see a large preview with its name and source; right-click it to favourite it, copy the name/image URL, or open its provider page.
- Favourited emotes get a ★, a **Favourites** section at the top of the picker, and first place in autocomplete.
- Open Kick's emote picker and choose the **7TV+** tab to browse/search loaded third-party emotes; clicking one inserts its text code into chat, and right-clicking one opens the same menu as in chat. The picker starts with 40 matches per provider for performance, offers **Load more** per provider, and search narrows across all loaded emotes.
- The chips at the top of the **7TV+** tab are the settings: turn 7TV, BTTV or FFZ off individually. Changes apply immediately, including to messages already on screen, and are remembered locally. The row tucks away while you scroll the grid and returns when you scroll back to the top.
- Navigating between channels reloads the channel-specific emote sets automatically. Kick's popout chat (`/popout/<channel>/chat`) is supported too.

## Updating

The userscript metadata includes `@updateURL` and `@downloadURL` pointing at the `main` branch on GitHub. Most managers (Tampermonkey, Violentmonkey, Greasemonkey, ScriptCat, or other) honour these and auto-update when a new `@version` is published. Greasemonkey uses a longer default check interval (set in its preferences). **Safari's Userscripts extension is the exception** — it runs from a local folder and does not fetch `@updateURL`, so you must re-copy the latest `kick-third-party-emotes.user.js` into your scripts folder to update. To update manually in any manager, replace `kick-third-party-emotes.user.js` with the new version.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No emotes appear | Open your browser's DevTools → Console on kick.com and look for `[KickEmotes]` log lines — the first is `[KickEmotes] v<version> active`. If missing, check the extension is enabled for kick.com. |
| Emotes from one provider are missing | That provider may be switched off — check its chip at the top of the **7TV+** picker tab. |
| Emotes appear for global but not channel | The streamer may not have BTTV/7TV/FFZ set up for their channel. BTTV and FFZ only find a channel through a Twitch account linked on the streamer's 7TV profile, or a Twitch channel with the same name. A `[KickEmotes] … failed:` line in the console means a provider was unreachable; it is retried once, and again on the next page load. |
| 7TV+ tab missing | Close and reopen Kick's native emote picker after the `[KickEmotes] Ready` log appears. |
| Console says `[KickEmotes] … is standing down` | Two copies of the script are installed — typically a manual copy next to the Greasy Fork or auto-updating one, or two managers both enabled for kick.com. The second copy stopped itself and the first is running normally; remove the duplicate. |
| Images broken after Kick update | Kick may have changed their chat DOM class names. Open an issue with the new class names found in the browser inspector. |
