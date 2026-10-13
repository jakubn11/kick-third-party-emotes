// fetchJSON's error paths, and init()'s retry backoff for failed providers.

loadConst(['FETCH_TIMEOUT', 'PROVIDER_RETRY_DELAYS']);
var logs = [];
var log = (...a) => logs.push(a.join(' '));

// ─── fetchJSON ────────────────────────────────────────────────────────────
var nextGM;
var GM_xmlhttpRequest = o => nextGM(o);
load(['httpError', 'fetchJSON']);

var errors = [];
nextGM = o => o.onerror({ status: 0, error: 'blocked' });
fetchJSON('x').catch(err => errors.push(err.message));
nextGM = o => o.onerror({});
fetchJSON('x').catch(err => errors.push(err.message));
nextGM = o => o.onabort();
fetchJSON('x').catch(err => errors.push(err.message));
nextGM = o => o.onload({ status: 502 });
fetchJSON('x').catch(err => errors.push(`${err.message}/${err.status}`));
nextGM = o => o.onload({ status: 200, responseText: '{"ok":1}' });
var ok;
fetchJSON('x').then(v => { ok = v; });
drainMicrotasks();
check('onerror carries the manager detail', errors[0] === 'network error: blocked');
check('onerror without detail', errors[1] === 'network error');
check('onabort rejects instead of hanging', errors[2] === 'aborted');
check('non-2xx keeps its status', errors[3] === 'HTTP 502/502');
check('2xx resolves parsed JSON', ok?.ok === 1);

// ─── init() retries ───────────────────────────────────────────────────────
var timers = [];
setTimeout = (fn, delay) => { timers.push({ fn, delay }); };
function runTimers() {
  var due = timers;
  timers = [];
  due.forEach(t => t.fn());
  drainMicrotasks();
  return due.map(t => t.delay);
}

var initSeq = 0, emoteMap = new Map(), loadedProviders, activeLoaders, emoteVersion = 0, channelSlug;
var currentChannelSlug = () => 'chan';
for (var noop of ['preconnectEmoteHosts', 'acHide', 'hideTooltip', 'hideEmoteMenu', 'resetPicker',
  'startChatObserver', 'waitForInput', 'queueVisibleEmoteRefresh', 'queueProviderPickerRefresh',
  'acRefreshOpen', 'rebuildEmoteMap']) this[noop] = () => {};
var routeChatRefreshDelay = () => 0;
var sameEmoteEntries = () => false;

// Failures left per loader key; 7tv_g recovers on the second retry, 7tv_c never.
var fails = { bttv_g: 0, '7tv_g': 2, ffz_g: 0, bttv_c: 0, '7tv_c': 99, ffz_c: 0 };
var stub = key => async () => {
  if (fails[key]-- > 0) throw new Error('HTTP 502');
  return [[key, {}]];
};
var loadBTTVGlobal = stub('bttv_g'), load7TVGlobal = stub('7tv_g'), loadFFZGlobal = stub('ffz_g');
var loadBTTVChannel = stub('bttv_c'), load7TVChannel = stub('7tv_c'), loadFFZChannel = stub('ffz_c');
(0, eval)(fnSource('init').replace(/`(\w+)_c_\$\{slug\}`/g, "'$1_c'"));

init();
drainMicrotasks();
var delays = [];
for (var pass = 0; pass < 5; pass++) delays.push(...runTimers());
check(`retries after 5/15/45 s, then stops (${delays})`, delays.join() === '5000,15000,45000');
check('a provider that recovers on a retry is applied', loadedProviders.has('7tv_g'));
check('a provider that never recovers stays out', !loadedProviders.has('7tv_c'));
check('later passes retry only the still-failing', logs.filter(l => /retrying/.test(l)).join('|')
  === '2 provider(s) failed, retrying in 5s…|2 provider(s) failed, retrying in 15s…|1 provider(s) failed, retrying in 45s…');
check('giving up is logged', logs.some(l => /^Giving up on 7tv_c until the next page load$/.test(l)));
