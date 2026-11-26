// Settings panel focus: every change rebuilds the card, and panelFocusTarget
// picks the rebuilt control that takes focus back. A fake card answers the one
// selector shape it uses, `[data-kte-key="name"]:not(:disabled)`.

load(['panelFocusTarget']);

function card(controls) {
  return {
    querySelector(selector) {
      var m = /^\[data-kte-key="([^"]+)"\]:not\(:disabled\)$/.exec(selector);
      if (!m) throw new Error('unexpected selector ' + selector);
      return controls.find(c => c.key === m[1] && !c.disabled) ?? null;
    },
  };
}

var close = { key: 'close' };
var large = { key: 'size:large' };
var clear = { key: 'clear' };

check('the same control takes focus back', panelFocusTarget(card([close, large, clear]), 'size:large') === large);
check('a provider chip is told apart from its global-set twin',
  panelFocusTarget(card([close, { key: 'globals:7TV' }, { key: 'providers:7TV', id: 1 }]), 'providers:7TV').id === 1);
check('Cancel, once gone, hands focus to Clear', panelFocusTarget(card([close, clear]), 'cancel') === clear);
check('a disabled Clear hands focus to Close',
  panelFocusTarget(card([close, { key: 'clear', disabled: true }]), 'clear') === close);
check('Cancel with Clear disabled ends on Close',
  panelFocusTarget(card([close, { key: 'clear', disabled: true }]), 'cancel') === close);
check('an unknown key ends on Close', panelFocusTarget(card([close, large]), 'gone') === close);
