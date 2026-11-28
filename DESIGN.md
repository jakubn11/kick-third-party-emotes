# kick-* family design

The shared design language of Jakub's Kick userscripts: **kick-chat-utils**, **kick-fullscreen-chat**, **kick-quality-saver**, **kick-third-party-emotes** and **kick-vod-resume**. Every UI element a script paints itself follows this file, so the five scripts read as one product.

**One file, five copies.** Every repo has this `DESIGN.md`, word for word. `test/family-style.js` (run by `test/run.sh`) fails when a sibling repo checked out next to this one has a different copy, and when a family colour isn't listed in the palette below. To change the design, edit it in one repo, copy it to the other four, and change every script that has the component:

```bash
for r in kick-chat-utils kick-fullscreen-chat kick-quality-saver kick-third-party-emotes kick-vod-resume; do cp DESIGN.md "../$r/DESIGN.md"; done
```

Each repo's `AGENTS.md` (*UI Design System*) keeps only what is specific to that script: its components, its reasons for any exception, and its reference implementations. Where the two disagree, this file wins and the `AGENTS.md` section is stale.

## Principles

1. **Clone Kick before painting.** Where Kick has the element already (a menu row, a picker tab, a channel card), clone Kick's node and change what must change; its sizing then follows Kick's restyles. A clone that wears the family look drops Kick's `hover:` / `focus…:` / `active:` / `highlighted` classes: Kick's `!important` utilities live in a cascade layer, which beats any unlayered `!important` a script can write, so CSS alone can't override them.
2. **One green accent per component.** `#22c55e` marks one thing — an icon, the selected state, a tile. Never a large green surface, a second green element, coloured accent borders or a green shadow.
3. **Opaque surfaces.** Floating UI sits on `#101013`. A tint is composited over that surface (`linear-gradient(tint, tint), #101013`), never painted alone, or the video shows through.
4. **Family colours only.** Every colour comes from the palette below. A script that needs another (a provider's brand colour, Kick's own neon on a cloned element) lists it in its `test/family-style.js` `EXCEPTIONS` with the reason.
5. **Literal values.** No CSS custom properties and no shared runtime: each script carries its own copy of the values, and this file is what keeps them equal.
6. **Paint as little as possible.** Each script lists its self-painted UI in its `AGENTS.md`. New UI is a design decision: add it to that list and follow this file.

## Palette

| Colour | Use |
|---|---|
| `#101013` | Surface: buttons, toasts, popups, cards, the family rows card |
| `#fff` | Primary text, titles |
| `#22c55e` | The accent: icons, header marks, tiles, the on switch, the resize divider |
| `#4ade80` | Green text on a green tint (selected chips, tags); `rgba(74,222,128,…)` for quieter green text, such as a count on a selected chip |
| `#f87171` | Red: bans, the armed danger chip's border |
| `#fca5a5` | Red glyphs and text: close buttons, danger chips |
| `#fb923c` | Amber: timeouts |
| `rgba(6,6,8,.6)` | Modal backdrop behind a centred settings card |

White alphas (`rgba(255,255,255,…)`):

| Alpha | Use |
|---|---|
| `.026` | Group fill inside a card |
| `.05` | Chip fill at rest; hairline between switch rows |
| `.06` | Group border; the inset top highlight in shadows |
| `.09` | Chip border at rest; chip fill on hover |
| `.1` | Neutral border of every floating surface |
| `.12` / `.14` | Switch track border / fill when off |
| `.13` | Scrollbar thumb |
| `.16` | Chip border on hover |
| `.4` | Section labels, notes, quiet glyphs |
| `.72` | Secondary names (the moderator on a kick-chat-utils card) |
| `.85` / `.88` | Chip text / switch row text |

Green alphas (`rgba(34,197,94,…)`):

| Alpha | Use |
|---|---|
| `.07` | Selected chip's outer ring |
| `.1` | Hover tint; tile and header-mark fill; the on switch's ring |
| `.14` / `.5` | Selected chip fill / border |
| `.18` / `.6` | Selected chip on hover (fill / border); a pressed button's tint |
| `.22` | Tile and header-mark border |
| `.65` | Focus ring |
| `.75` | The on switch's border |

Red and amber alphas: `rgba(239,68,68,.14)` is the red hover tint (close, danger chips, unpin), with `rgba(248,113,113,.5)` as its border. The armed danger chip is `rgba(248,113,113,.18)` fill, `#f87171` border and a `rgba(248,113,113,.08)` ring. Action colours tint at `.12` (cards, history rows) or `.14` / `.5` (a pressed filter chip): red `rgb(248,113,113)`, amber `rgb(251,146,60)`, green `rgb(34,197,94)`. Shadows are always black, `rgba(0,0,0,…)`.

## Typography

Always the family stack: `system-ui, -apple-system, "Segoe UI", sans-serif`. Never a bare `sans-serif`, which falls back to the browser default on Windows.

| Style | Use |
|---|---|
| `600 13.5px/1.2`, `letter-spacing: -.01em`, `#fff` | Card title |
| `500 13px/1.3` | Toast text |
| `500 13px/1.2` | Floating buttons |
| `600 13px/1` | Close glyph (✕) |
| `500 12px/1.35` | Card body |
| `600 12px/1` | Chips, switch rows |
| `600 12px/1.3` | Small text buttons (kick-chat-utils' Clear all) |
| `600 10px/1`, `letter-spacing: .09em`, uppercase, `rgba(255,255,255,.4)` | Section labels |
| `500 11px/1.45`, `rgba(255,255,255,.4)` | Notes under a group or list |

Numbers that line up (times, counts) use `font-variant-numeric: tabular-nums`.

## Shape and depth

**Radii.** `8px` for controls, buttons, toasts and small popups; `11px` for groups; `14px` for cards and large panels; `9px` for a card's header mark; `999px` for pills, switches and scrollbar thumbs; `50%` for dots and switch thumbs. A box inset in another keeps its corners concentric: outer radius = inner radius + inset (a `6px` inset around `8px` chips gives `14px`). The one reason to depart is mirroring Kick where the element sits inside Kick's own component (the emote picker's `4px` cells, kick-vod-resume's `4px` card badge).

**Shadows.**
- Small surfaces (buttons, toasts, tooltips, menus): `0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)`
- Cards and large panels: `0 24px 64px -16px rgba(0,0,0,.8), 0 2px 10px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)`
- Switch thumb: `0 1px 3px rgba(0,0,0,.5)`
- Where a container clips the outer shadow (a scrolling stack), keep only the inset highlight rather than a shadow cut off at a hard edge.

**Blur.** `backdrop-filter: blur(10px)` (with `-webkit-`) on floating buttons, toasts and popups. Leave it off where it only adds a compositing layer over the video for no visible effect (kick-fullscreen-chat's settings panel). A modal backdrop uses `blur(3px)`.

## Components

### Floating button

Buttons over the player and on toasts: kick-fullscreen-chat's Chat and control buttons, kick-quality-saver's video button, kick-vod-resume's Start over, skip and mark buttons.

- `#101013`, `1px solid rgba(255,255,255,.1)`, `8px` radius, the small shadow, `blur(10px)`, `#fff` text in `500 13px/1.2`
- Padding `7px 12px` with text, `7px` icon-only; an `18px` icon in `#22c55e`. Every one is 34px tall, so they line up side by side.
- Hover and focus: `linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013`, faded with `transition: background .08s`
- Pressed (a toggle that is on): `linear-gradient(rgba(34,197,94,.18), rgba(34,197,94,.18)), #101013` with a `rgba(34,197,94,.5)` border. A one-shot action has no pressed state.
- Disabled: `opacity: .3; pointer-events: none`

### Toast

- `#101013`, `1px solid rgba(255,255,255,.1)`, `8px` radius, the small shadow, `blur(10px)`, `8px 12px` padding, `500 13px/1.3` text
- Fades over `.2s`. A toast that slides in fades in place under reduced motion.
- `role="status"` so screen readers announce it.
- Allowed variants: an action-coloured `3px` left border with a `.12` tint (kick-chat-utils' moderation cards); no green at all on an error toast (kick-fullscreen-chat).

### Settings card

kick-fullscreen-chat's settings panel, kick-quality-saver's settings card, kick-third-party-emotes' settings panel and kick-chat-utils' Moderation history.

- **Card:** `#101013`, `1px solid rgba(255,255,255,.1)`, `14px` radius, the card shadow, `1rem` padding, `.7rem` gap, `500 12px/1.35` text. `max-height: 76vh` and it scrolls. Prefer grid rows to a flex column: in Safari a flex group came out a line short.
- **Scrollbar:** `8px` wide, transparent track, `rgba(255,255,255,.13)` thumb inset by a `2px` transparent border with `background-clip: padding-box`, `999px` radius. Under `@supports selector(::-webkit-scrollbar)` the card uses `overflow-y: scroll` and `padding-right: calc(1rem - 8px)`, so the track is always reserved and both insets stay equal.
- **Opening:** rises in with `.2s cubic-bezier(.16,1,.3,1)`. A centred card sits on the modal backdrop, which fades in over `.16s ease-out`. A card anchored under a button fades and drops `8px` instead of scaling, so its edge doesn't slide.
- **Header:** a flex row with a `10px` gap. A `30px` mark (`9px` radius, `rgba(34,197,94,.1)` fill, `rgba(34,197,94,.22)` border, a flat `#22c55e` line icon), the title, then the close button pushed right.
- **Close button:** `28px` square, `8px` radius, chip surface (`rgba(255,255,255,.05)` fill, `.09` border), `#fca5a5` ✕ in `600 13px/1`. Hover and focus: `rgba(239,68,68,.14)` fill, `rgba(248,113,113,.5)` border.
- **Group:** `.7rem` padding, `11px` radius, `rgba(255,255,255,.026)` fill, `1px solid rgba(255,255,255,.06)`, `.6rem` gap, headed by a section label.
- **Chip:** `min-height: 32px`, `0 .4rem` padding, `8px` radius, `600 12px/1`, `rgba(255,255,255,.05)` fill, `.09` border, `.85` text.
  - Hover and focus: `.09` fill, `.16` border, `#fff` text. Pressed: `transform: scale(.97)`.
  - Selected: `rgba(34,197,94,.14)` fill, `rgba(34,197,94,.5)` border, `#4ade80` text, `0 0 0 3px rgba(34,197,94,.07)` ring; on hover and focus `.18` / `.6`.
  - Disabled: `rgba(255,255,255,.02)` fill, `.05` border, `.28` text, `cursor: not-allowed`, no ring.
  - Danger: `#fca5a5` text, the red hover tint on hover and focus; armed, `rgba(248,113,113,.18)` fill, `#f87171` border, `rgba(248,113,113,.08)` ring.
  - Chips sit in a grid, `repeat(n, minmax(0, 1fr))` with a `6px` gap, so they share the row evenly.
  - Transition: `background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease`
- **Switch:** `34×19px`, `999px` radius. Off: `rgba(255,255,255,.14)` fill, `.12` border. On: `#22c55e` fill, `rgba(34,197,94,.75)` border, `0 0 0 3px rgba(34,197,94,.1)` ring. A white `13px` thumb with the thumb shadow travels `15px` over `.18s cubic-bezier(.2,.8,.2,1)`. The track fades its colours over `.18s ease`.
- **Switch rows:** a gap-less column. Each row has `7px 0` padding, `600 12px/1` text in `rgba(255,255,255,.88)` and a `1px solid rgba(255,255,255,.05)` hairline above every row but the first. A block that ends its group takes `margin-bottom: -7px`, so the group's padding is equal top and bottom.
- **Note:** the note style, under the group it explains.

### Popups, menus and tooltips

- Small popups (tooltip, context menu): `#101013`, `1px solid rgba(255,255,255,.1)`, `8px` radius, the small shadow, `blur(10px)`. Large ones (the autocomplete panel) take `14px` and the card shadow.
- Rows and menu items: `rgba(34,197,94,.1)` on hover and focus, with no border change.
- Tooltips: a script that paints its own tooltip uses it on every control it adds, never the browser's `title` (kick-third-party-emotes: `data-kte-tip`). The others don't paint tooltips: an icon-only button there carries `aria-label` and a matching `title`.

### Family rows in Kick's chat settings menu

Rows a script adds to Kick's chat settings menu (kick-chat-utils' Moderation history, kick-third-party-emotes' Third-party emotes):

- A clone of Kick's own row, with Kick's state classes stripped (see the principles), tagged `data-kick-family-row`
- Together they sit on one `#101013` card with a `rgba(255,255,255,.08)` hairline border and `10px` outer corners, set `8px` apart from Kick's rows.
- Kick's chevron becomes a `26px` tile: `8px` radius, `rgba(34,197,94,.1)` fill, `rgba(34,197,94,.22)` border, a `#22c55e` icon.
- Hover and focus: the green tint over `#101013`, the tile going to `.16` fill and `.45` border.
- The CSS block between `/* Family rows in Kick's chat settings menu` and `/* End of family rows` is identical in both scripts; `test/family-style.js` compares them.

### Marks on Kick's own UI

A script that annotates Kick's elements (kick-chat-utils' message badges, kick-vod-resume's card badge and progress bar) marks them in place with its own `data-*` attributes and CSS scoped to those, rather than wrapping or rebuilding Kick's nodes. A mark inside a Kick component follows that component's metrics, as the principles allow for radii.

## States

| State | Neutral controls (chips) | Floating buttons, rows, menu items | Destructive (close, danger, unpin) |
|---|---|---|---|
| Hover | `.09` white fill, `.16` border, `#fff` text | green `.1` tint over `#101013` | red `.14` tint, `.5` red border |
| Keyboard focus | as hover, plus the focus ring | as hover, plus the focus ring | as hover, plus the focus ring |
| Pressed | `scale(.97)` | — | `scale(.97)` |
| Selected / on | green `.14` fill, `.5` border, `#4ade80` text, `.07` ring | green `.18` tint, `.5` green border | armed: red `.18`, `#f87171` border, `.08` ring |
| Disabled | dimmed, `cursor: not-allowed` | `opacity: .3`, no pointer events | dimmed |

- **Focus ring:** `outline: 2px solid rgba(34,197,94,.65)` with `outline-offset: 2px`; `-2px` on a row whose container would clip the ring.
- **Write hover and focus together** (`:hover, :focus-visible`), so the keyboard sees what the mouse sees.
- A button clicked with the pointer that would otherwise keep focus and catch the player's Space/Enter blurs itself after the click (`if (e.detail)`), so keyboard activations keep focus.
- A row that isn't a control (a pinned channel, a history entry) gets no hover fill: the family fills only what you can click.

## Motion

| Duration | Use |
|---|---|
| `.08s` | Floating buttons' background |
| `.1s` | A chip or close button's press scale |
| `.12s` | Small fades: family rows, tiles, auto-hiding rows |
| `.15s ease` | Chip and close-button colours |
| `.16s ease-out` | Modal backdrop fade |
| `.18s` | Switches |
| `.2s` | Card rise, toast fade |

Easing: `cubic-bezier(.16,1,.3,1)` for a card rising in, `cubic-bezier(.2,.8,.2,1)` for a switch thumb, `ease` elsewhere.

**Reduced motion.** Under `@media (prefers-reduced-motion: reduce)` every keyframe animation and every transition that moves or scales something is turned off. Anything that slides fades in place instead. Short colour fades may stay. Motion run from script checks `matchMedia('(prefers-reduced-motion: reduce)')`.

## Layers

| `z-index` | Use |
|---|---|
| `2147483647` | UI that must sit above everything in fullscreen: kick-fullscreen-chat's controls and toast, kick-quality-saver's button while its card is open |
| `2147483646` | Settings card backdrops; kick-fullscreen-chat's resize divider and info overlay |
| `2147483000`–`2147483001` | Toast stacks and the panels opened beside them |
| Chosen against Kick's live values | UI inside the player (kick-vod-resume's skip bar at `300`: above the control bar, below Kick's quality and speed menus) |

UI that must appear in fullscreen is appended to the fullscreen element, not `document.body`.

## Accessibility and text

- Icon-only buttons carry an `aria-label`; decorative icons are `aria-hidden`.
- Switches are `role="switch"` with `aria-checked`. Toggle chips expose their state with `aria-pressed`. Toasts are `role="status"`. Cards are `role="dialog"` with a name.
- Settings cards close on Esc, on a click outside and on their ✕, and keep keyboard focus inside while open: Tab from the last control wraps to the first, Shift+Tab from the first to the last, and a Tab from outside lands in the card. Every script with a card does this with the same `familyTrapTab(e, card)` function, called from the card's keydown listener; change all four copies together.
- Every visible word comes from the script's translation tables and follows the language Kick is shown in. Words that must fit a fixed width (chips, badges) are checked in the longest languages.

## Known gaps

Places where a script doesn't meet this file yet. Fix them when touching that code, and remove the line here (in every copy) once fixed.

None right now.
