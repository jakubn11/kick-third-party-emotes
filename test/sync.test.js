// Cross-tab sync: every write re-reads the stored copy, and the storage
// listener takes in another tab's writes. "Other tab" here is a direct write
// to the shared fake localStorage, which is all another tab can do.

function FakeStorage() {
  var m = new Map();
  this.getItem = k => (m.has(k) ? m.get(k) : null);
  this.setItem = (k, v) => { m.set(k, String(v)); };
  this.removeItem = k => { m.delete(k); };
}
localStorage = new FakeStorage();
var now = 1e12;
Date.now = () => now;

loadConst(['USAGE_KEY', 'FAVS_KEY', 'SETTINGS_KEY', 'USAGE_MAX_ENTRIES', 'FAVS_MAX_ENTRIES',
  'PROVIDERS', 'MOTION_MODES', 'EMOTE_SIZES']);
load(['isSafeTextToken', 'usageRead', 'usageLoad', 'usageCount', 'usageBump', 'usageClear', 'usageSave',
  'favRead', 'favLoad', 'favHas', 'favToggle', 'favSave',
  'settingsDefaults', 'settingsFromRecord', 'settingsRead', 'settingsLoad', 'settingsUpdate',
  'settingsRenderKey', 'onStorageSync']);
var usageMap = null, favSet = null, settings = null;

var calls;
function resetCalls() { calls = { size: 0, acHide: 0, rerender: 0, picker: 0, ac: 0, panel: 0 }; }
resetCalls();
var applyEmoteSize = () => calls.size++;
var acHide = () => calls.acHide++;
var applyProviderSettings = () => calls.rerender++;
var pickerRefreshIfBuilt = () => calls.picker++;
var acRefreshOpen = () => calls.ac++;
var settingsPanelRender = () => calls.panel++;
var otherTab = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  onStorageSync({ storageArea: localStorage, key });
};

// ─── Usage ────────────────────────────────────────────────────────────────
usageBump('A'); usageBump('B');
check('bumps are written straight away', JSON.parse(localStorage.getItem(USAGE_KEY)).counts.A[0] === 1);
usageClear();
localStorage.setItem(USAGE_KEY, JSON.stringify({ counts: { A: [1, 1], B: [1, 1] } })); // a tab with the old list...
usageMap = new Map([['A', { n: 1, t: 1 }], ['B', { n: 1, t: 1 }]]);
localStorage.setItem(USAGE_KEY, JSON.stringify({ counts: {} })); // ...while another clears it
usageBump('C');
var stored = JSON.parse(localStorage.getItem(USAGE_KEY)).counts;
check('a bump after another tab cleared does not bring the old list back', !stored.A && !stored.B && stored.C[0] === 1);

resetCalls();
otherTab(USAGE_KEY, { counts: { Z: [5, 1] } });
check('another tab\'s inserts are read in', usageCount('Z') === 5 && usageCount('C') === 0);
check('and refresh the picker, autocomplete and panel', calls.picker === 1 && calls.ac === 1 && calls.panel === 1);
check('without re-rendering chat', calls.rerender === 0);

// ─── Favourites ───────────────────────────────────────────────────────────
favToggle('X');
localStorage.setItem(FAVS_KEY, JSON.stringify({ codes: ['X', 'Y'] })); // another tab stars Y
favToggle('W');
var codes = JSON.parse(localStorage.getItem(FAVS_KEY)).codes;
check('starring keeps another tab\'s star', codes.includes('Y') && codes.includes('W') && codes.includes('X'));
otherTab(FAVS_KEY, { codes: ['Q'] });
check('another tab\'s favourites are read in', favHas('Q') && !favHas('X'));

// ─── Settings ─────────────────────────────────────────────────────────────
settingsUpdate(s => { s.size = 'large'; });
check('a setting is written straight away', JSON.parse(localStorage.getItem(SETTINGS_KEY)).size === 'large');
localStorage.setItem(SETTINGS_KEY, JSON.stringify({ size: 'large', motion: 'never' })); // another tab, no event yet
settingsUpdate(s => { s.preview = false; });
var rec = JSON.parse(localStorage.getItem(SETTINGS_KEY));
check('a change keeps another tab\'s newer setting', rec.motion === 'never' && rec.preview === false && rec.size === 'large');

resetCalls();
otherTab(SETTINGS_KEY, Object.assign({}, rec, { size: 'small' }));
check('another tab\'s size is applied', settingsLoad().size === 'small' && calls.size === 1);
check('a size change does not re-render chat', calls.rerender === 0 && calls.panel === 1);

resetCalls();
otherTab(SETTINGS_KEY, Object.assign({}, rec, { globals: { BTTV: false } }));
check('a global-set change re-renders chat and the picker', calls.rerender === 1 && calls.picker === 1);

resetCalls();
otherTab(SETTINGS_KEY, Object.assign({}, rec, { autocomplete: false }));
check('autocomplete switched off elsewhere closes the popup', calls.acHide === 1 && settingsLoad().autocomplete === false);

// ─── Unreadable storage ───────────────────────────────────────────────────
var before = settingsLoad();
localStorage.getItem = () => { throw new Error('SecurityError'); };
settingsUpdate(s => { s.preview = true; });
check('unreadable storage keeps the in-memory settings', settings.motion === before.motion && settings.preview === true);
usageMap = new Map([['K', { n: 2, t: 1 }]]);
usageBump('K');
check('unreadable storage keeps the in-memory usage', usageCount('K') === 3);
