// Family style checks, shared by every kick-* script. Run from the repo root
// with macOS's JavaScriptCore shell (test/run.sh does):
//
//   jsc test/family-style.js
//
// 1. Palette: every colour in the script is one of the family's (FAMILY
//    below), or listed in EXCEPTIONS with the reason it may differ. This is
//    what would have caught Kick's neon green on kick-chat-utils' Clear all.
// 2. Shared CSS: the "Family rows" block that kick-chat-utils and
//    kick-third-party-emotes both ship must match the sibling's copy.
//
// Only the config block differs between repos.

// ── Config for this repo ────────────────────────────────────────────────────
var SCRIPT = 'kick-third-party-emotes.user.js';
var SIBLINGS = ['../kick-chat-utils/kick-chat-utils.user.js'];
var EXCEPTIONS = {
  '#4da6ff':          "7TV's brand blue on its provider chip",
  'rgb(77,166,255)':  "7TV's chip tints",
  '#ff6b6b':          "BTTV's brand red on its provider chip",
  'rgb(255,107,107)': "BTTV's chip tints",
  '#c084fc':          "FFZ's brand purple on its provider chip",
  'rgb(192,132,252)': "FFZ's chip tints",
  '#facc15':          "the gold favourite star",
  '#efeff1':          "text in the 7TV+ tab, matching Kick's own emote picker around it",
  '#71717a':          "muted text in the 7TV+ tab, matching Kick's emote picker",
  '#475054':          "inside a Kick class name copied for the picker tab's underline",
};

// ── Shared code: keep everything below identical in every kick-* repo ──────
var FAMILY = [
  '#101013',          // surface
  '#ffffff',          // text
  '#22c55e',          // accent green
  '#4ade80',          // green text on a green tint
  '#f87171',          // red: bans, danger
  '#fca5a5',          // red glyphs (close, danger chips)
  '#fb923c',          // amber: timeouts
  'rgb(255,255,255)', // white alphas: borders, chips, muted text
  'rgb(0,0,0)',       // shadows
  'rgb(34,197,94)',   // green tints, focus ring
  'rgb(74,222,128)',
  'rgb(248,113,113)',
  'rgb(239,68,68)',   // red hover tint
  'rgb(251,146,60)',
  'rgb(6,6,8)',       // modal backdrop
];
var START = "/* Family rows in Kick's chat settings menu";
var END = '/* End of family rows';

var failures = 0;
function ok(msg) { print('ok   ' + msg); }
function fail(msg) { print('FAIL ' + msg); failures++; }

var source = readFile(SCRIPT);

// 1. Palette.
var seen = {};
var m;
var hex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
while ((m = hex.exec(source))) {
  var h = m[1].toLowerCase();
  if (h.length === 3) h = h.replace(/./g, '$&$&');
  seen['#' + h] = true;
}
var rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
while ((m = rgb.exec(source))) seen['rgb(' + m[1] + ',' + m[2] + ',' + m[3] + ')'] = true;
var used = Object.keys(seen);
var off = used.filter(function (c) { return FAMILY.indexOf(c) < 0 && !EXCEPTIONS[c]; });
if (off.length) fail('colours outside the family palette (use a family one, or list it in EXCEPTIONS with why): ' + off.join(', '));
else ok('every colour is a family colour or a listed exception');
var stale = Object.keys(EXCEPTIONS).filter(function (c) { return !seen[c]; });
if (stale.length) fail('EXCEPTIONS lists colours the script no longer uses: ' + stale.join(', '));
else ok('every listed exception is still used');

// 2. Blocks of CSS shipped by two scripts must stay equal (comments and
// whitespace aside). A sibling that isn't checked out next to this repo is
// skipped, not failed.
function block(text) {
  var a = text.indexOf(START);
  if (a < 0) return null;
  var b = text.indexOf(END, a);
  if (b < 0) return null;
  return text.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}
if (SIBLINGS.length) {
  var own = block(source);
  if (!own) fail('no family rows block between "' + START + '" and "' + END + '"');
  SIBLINGS.forEach(function (path) {
    var text;
    try { text = readFile(path); } catch (e) { print('skip ' + path + ' is not checked out next to this repo'); return; }
    var other = block(text);
    if (!other) { fail(path + ' has no family rows block'); return; }
    if (!own) return;
    if (other === own) { ok('family rows block matches ' + path); return; }
    var i = 0;
    while (i < own.length && own[i] === other[i]) i++;
    fail('family rows block differs from ' + path + ' at:\n       here:  ...' + own.slice(Math.max(0, i - 40), i + 60) +
      '\n       there: ...' + other.slice(Math.max(0, i - 40), i + 60));
  });
}

if (failures) throw new Error(failures + ' family style check(s) failed');
print('all family style checks passed');
