// Tab stays inside an open settings card (2.21.3, DESIGN.md). familyTrapTab is
// the same function in all four kick-* scripts that have a card; a fake card
// answers its one querySelectorAll and reports what took focus.

load(['familyTrapTab']);

function control(name, opts) {
  opts = opts || {};
  return {
    name: name,
    disabled: !!opts.disabled,
    tabIndex: opts.tabIndex === undefined ? 0 : opts.tabIndex,
    getClientRects() { return opts.hidden ? [] : [{}]; },
    focus() { document.activeElement = this; },
  };
}

function fakeCard(controls) {
  return {
    isConnected: true,
    querySelectorAll() { return controls; },
    contains(el) { return controls.indexOf(el) >= 0; },
  };
}

function press(card, shift, extra) {
  var e = Object.assign({ key: 'Tab', shiftKey: !!shift, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }, extra || {});
  familyTrapTab(e, card);
  return e;
}

var close = control('close');
var chip = control('chip');
var off = control('off', { disabled: true });
var hidden = control('hidden', { hidden: true });
var skipped = control('skipped', { tabIndex: -1 });
var clear = control('clear');
var card = fakeCard([close, chip, off, hidden, skipped, clear]);
var outside = { name: 'outside' };
globalThis.document = { activeElement: chip };

var e = press(card);
check('Tab inside the card is left to the browser', !e.prevented && document.activeElement === chip);

document.activeElement = clear;
e = press(card);
check('Tab from the last control wraps to the first', e.prevented && e.stopped && document.activeElement === close);

document.activeElement = close;
e = press(card, true);
check('Shift+Tab from the first control wraps to the last', e.prevented && document.activeElement === clear);

check('disabled, hidden and tabindex=-1 controls are skipped',
  (document.activeElement = clear, press(card), document.activeElement === close));

document.activeElement = outside;
press(card);
check('Tab with focus outside the card brings it to the first control', document.activeElement === close);
document.activeElement = outside;
press(card, true);
check('…and Shift+Tab to the last', document.activeElement === clear);

document.activeElement = clear;
e = press(card, false, { key: 'Enter' });
check('other keys are ignored', !e.prevented && document.activeElement === clear);
e = press(card, false, { metaKey: true });
check('a modified Tab is ignored', !e.prevented && document.activeElement === clear);

e = press(null);
check('no card: nothing happens', !e.prevented);
e = press(Object.assign(fakeCard([close]), { isConnected: false }));
check('a card no longer in the page: nothing happens', !e.prevented);
e = press(fakeCard([off, hidden]));
check('a card with nothing focusable: nothing happens', !e.prevented);
