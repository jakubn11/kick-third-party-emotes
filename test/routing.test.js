// currentChannelSlug, the picker search debounce, and autocomplete attach.

// ─── Channel slug ─────────────────────────────────────────────────────────
loadConst(['NON_CHANNEL_SLUGS']);
load(['currentChannelSlug']);
var location = { pathname: '/' };
var slugAt = path => { location.pathname = path; return currentChannelSlug(); };

check('channel page', slugAt('/xqc') === 'xqc');
check('channel subpage keeps the channel', slugAt('/xqc/videos/abc') === 'xqc');
check('slug is lowercased', slugAt('/XQC') === 'xqc');
check('popout chat reads the second segment', slugAt('/popout/xqc/chat') === 'xqc');
check('home is not a channel', slugAt('/') === null);
for (var page of ['category/just-chatting', 'terms-of-service', 'privacy-policy', 'cookie-policy',
  'community-guidelines', 'dmca-policy', 'browse/clips', 'login']) {
  check(`/${page} is not a channel`, slugAt(`/${page}`) === null);
}

// ─── Picker search debounce ───────────────────────────────────────────────
loadConst(['PICKER_SEARCH_DELAY']);
var timers = new Map(), nextTimer = 1;
setTimeout = (fn, delay) => { var id = nextTimer++; timers.set(id, { fn, delay }); return id; };
clearTimeout = id => { timers.delete(id); };
var runTimers = () => { var due = [...timers.values()]; timers.clear(); due.forEach(t => t.fn()); };

var pickerSearchTimer = null, refreshes = 0, active = true;
var pickerIsActive = () => active;
var pickerRefreshContent = () => { refreshes++; };
var pickerApplyActiveState = () => {};
load(['pickerAttachSearch']);

var listeners = [];
var input = { addEventListener: (type, fn) => { if (type === 'input') listeners.push(fn); } };
var panel = { isConnected: true };
pickerAttachSearch(panel, input);
pickerAttachSearch(panel, input);
check('search listener attached once', listeners.length === 1);
for (var k = 0; k < 6; k++) listeners[0]();
check('a burst of keystrokes leaves one pending rebuild', timers.size === 1 && [...timers.values()][0].delay === PICKER_SEARCH_DELAY);
runTimers();
check('which rebuilds once', refreshes === 1);
active = false;
listeners[0]();
runTimers();
check('no rebuild when the tab has been switched away', refreshes === 1);

// ─── Autocomplete attach ──────────────────────────────────────────────────
var attachedAcInput = null, attached = [], found = null;
var acFindInput = () => found;
var attachAutocomplete = el => attached.push(el);
load(['attemptAcAttach', 'waitForInput']);

waitForInput();
check('no input yet: nothing attached, nothing observed', attached.length === 0 && attachedAcInput === null);
found = { isConnected: true };
attemptAcAttach();
check('the chat observer path attaches once the input appears', attached.length === 1 && attachedAcInput === found);
attemptAcAttach();
check('a connected input is not re-attached', attached.length === 1);
var second = { isConnected: true };
found = second;
waitForInput();
check('a new channel attaches its own input', attachedAcInput === second && attached.length === 2);
