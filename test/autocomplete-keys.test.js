// Autocomplete keys run in window capture, ahead of Kick's editor. A key the
// popup takes must be stopped there, or Lexical's own Enter handler (on the
// editor, registered first) sends the half-typed message before the pick goes
// in. Keys from elsewhere, and Enter with nothing highlighted, pass through.

load(['acOnKeydown']);

var editor = { contains: n => n === editor || n === inner };
var inner = {};
var acDropdown, acInput, acMatches, acFocusIdx, committed, hidden;
function reset(focus) {
  acDropdown = {}; acInput = editor; acMatches = [{ code: 'KEK' }, { code: 'KEKW' }];
  acFocusIdx = focus; committed = null; hidden = 0;
}
function acCommit(code) { committed = code; }
function acHide() { hidden++; }
function acSetFocus(i) { acFocusIdx = i; }
function key(k, target) {
  var e = { key: k, target: target ?? inner, prevented: false, stopped: false };
  e.preventDefault = () => { e.prevented = true; };
  e.stopPropagation = () => { e.stopped = true; };
  acOnKeydown(e);
  return e;
}

reset(1);
var e = key('Enter');
check('Enter on a highlighted row inserts it', committed === 'KEKW');
check('and is kept from Kick (stopped and prevented)', e.stopped && e.prevented);

reset(-1);
e = key('Enter');
check('Enter with nothing highlighted closes the popup', hidden === 1 && committed === null);
check('and goes on to Kick, so the message sends', !e.stopped && !e.prevented);

reset(-1);
e = key('Tab');
check('Tab completes the top match and is stopped', committed === 'KEK' && e.stopped && e.prevented);

reset(-1);
e = key('ArrowDown');
check('ArrowDown moves the highlight and is stopped', acFocusIdx === 0 && e.stopped);
e = key('ArrowUp');
check('ArrowUp is stopped too', acFocusIdx === 0 && e.stopped);

reset(-1);
e = key('Escape');
check('Escape closes the popup and is stopped', hidden === 1 && e.stopped);

reset(1);
e = key('Enter', {});
check('a key from outside the chat input is left alone', committed === null && !e.stopped && !e.prevented);

reset(1);
acDropdown = null;
e = key('Enter');
check('with the popup closed every key passes', committed === null && !e.stopped && !e.prevented);

reset(-1);
e = key('a');
check('other keys pass', !e.stopped && !e.prevented);
