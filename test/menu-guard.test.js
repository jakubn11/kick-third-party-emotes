// The emote menu's presses must not reach Kick's listeners: an emote picker
// that closes on outside presses closed when a menu item opened from it was
// clicked. emoteMenuGuard runs in window capture, before any of them.

var hidden = 0;
var hideEmoteMenu = () => { hidden++; };
load(['emoteMenuGuard', 'emoteMenuKeydown']);

function node(inside, action) {
  var item = action ? { _kteAction: action } : null;
  return { inside: inside, closest: sel => (sel === '.kte-menu-item' ? item : null) };
}
var menuEl = { contains: t => t.inside };
function fire(type, target) {
  var e = { type: type, target: target, stopped: false, prevented: false,
    stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
  emoteMenuGuard(e);
  return e;
}

var ran = 0;
var item = node(true, () => { ran++; });
var down = fire('pointerdown', item);
check('pointerdown on the menu is stopped', down.stopped);
check('pointerdown on the menu keeps focus put', down.prevented);
check('mousedown on the menu is stopped and cancelled', (e => e.stopped && e.prevented)(fire('mousedown', item)));
check('touchstart is stopped but not cancelled (taps still click)', (e => e.stopped && !e.prevented)(fire('touchstart', item)));
var click = fire('click', item);
check('click on an item is stopped', click.stopped);
check('click on an item runs its action', ran === 1);
check('click on an item closes the menu', hidden === 1);

check('click on the header runs nothing', (fire('click', node(true, null)), ran === 1 && hidden === 1));
var outside = fire('pointerdown', node(false, () => { ran++; }));
check('a press outside the menu is left alone', !outside.stopped && !outside.prevented);
check('a click outside runs nothing', (fire('click', node(false, () => { ran++; })), ran === 1));
menuEl = null;
check('no menu open: nothing is stopped', !fire('click', item).stopped);

// Escape closes the menu and stops there: Kick takes the player out of theatre
// mode on the same key.
function keydown(k) {
  var e = { key: k, stopped: false, prevented: false,
    stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
  emoteMenuKeydown(e);
  return e;
}
hidden = 0;
var esc = keydown('Escape');
check('Escape closes the menu', hidden === 1);
check('and is kept from Kick (stopped and prevented)', esc.stopped && esc.prevented);
var other = keydown('a');
check('other keys leave the menu open and pass through', hidden === 1 && !other.stopped && !other.prevented);
