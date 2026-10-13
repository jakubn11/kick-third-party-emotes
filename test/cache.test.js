// Cache.set's budget and quota handling, cacheValueTs, and sweepCache.

function FakeStorage(quota) {
  var m = new Map();
  this.m = m;
  Object.defineProperty(this, 'length', { get: () => m.size });
  this.key = i => [...m.keys()][i] ?? null;
  this.getItem = k => (m.has(k) ? m.get(k) : null);
  this.removeItem = k => { m.delete(k); };
  this.used = () => [...m].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
  this.setItem = (k, v) => {
    var prev = m.has(k) ? k.length + m.get(k).length : 0;
    if (this.used() - prev + k.length + String(v).length > quota) throw new Error('QuotaExceededError');
    m.set(k, String(v));
  };
}

loadConst(['CACHE_PREFIX', 'USAGE_KEY', 'FAVS_KEY', 'SETTINGS_KEY', 'PRESERVED_KEYS',
  'CACHE_SWEEP_MAX_AGE', 'CACHE_BUDGET', 'Cache']);
load(['cacheValueTs', 'cacheEntriesByAge', 'sweepCache']);
var isValidCacheEntry = () => true;
var now = 1e12;
Date.now = () => now;
var set = n => Array.from({ length: n }, (_, i) => [`e${i}`, {
  url: `https://cdn.7tv.app/emote/${'X'.repeat(26)}/2x.webp`, source: '7TV',
}]);
var ours = () => [...localStorage.m].filter(([k]) => k.startsWith(CACHE_PREFIX));

// ─── Budget ───────────────────────────────────────────────────────────────
localStorage = new FakeStorage(5e6);
localStorage.setItem('kick_own', 'k'.repeat(1000));
localStorage.setItem(FAVS_KEY, '{"ts":1,"codes":[]}');
for (var c = 0; c < 20; c++) { now += 1000; Cache.set(`7tv_c_ch${c}`, set(1000)); }
var size = ours().reduce((sum, [k, v]) => sum + k.length + v.length, 0);
check(`stays under budget (${size} <= ${CACHE_BUDGET})`, size <= CACHE_BUDGET);
var kept = ours().map(([k]) => +k.match(/ch(\d+)/)[1]).sort((a, b) => a - b);
check(`keeps the newest run (${kept[0]}–${kept[kept.length - 1]})`, kept[kept.length - 1] === 19 && kept.length === 20 - kept[0] && kept[0] > 0);
check('leaves Kick and user-state keys alone', localStorage.getItem('kick_own') && localStorage.getItem(FAVS_KEY));
check('reads back what it wrote', Cache.read('7tv_c_ch19').data.length === 1000 && Cache.read('7tv_c_ch19').ts === now);
var neighbour = localStorage.getItem(`${CACHE_PREFIX}7tv_c_ch18`);
now += 1000;
Cache.set('7tv_c_ch19', set(1000));
check('rewriting a key does not count its old value', localStorage.getItem(`${CACHE_PREFIX}7tv_c_ch18`) === neighbour);

// ─── Browser quota tighter than the budget ────────────────────────────────
localStorage = new FakeStorage(600000);
localStorage.setItem('kick_own', 'k'.repeat(300000));
for (var c = 0; c < 5; c++) { now += 1000; Cache.set(`ch${c}`, set(1000)); }
check('write still lands', localStorage.getItem(`${CACHE_PREFIX}ch4`) !== null);
check("Kick's data survives", localStorage.getItem('kick_own').length === 300000);
check('older entries of ours make room', localStorage.getItem(`${CACHE_PREFIX}ch0`) === null);

localStorage = new FakeStorage(100);
Cache.set('x', set(10));
check('nothing to evict: gives up quietly', localStorage.getItem(`${CACHE_PREFIX}x`) === null);

// ─── Timestamps and sweep ─────────────────────────────────────────────────
check('ts read from the front of the value', cacheValueTs('{"ts":1234,"data":[]}') === 1234);
check('other shapes read as 0', cacheValueTs('{"data":[],"ts":5}') === 0 && cacheValueTs(null) === 0);
localStorage = new FakeStorage(5e6);
localStorage.setItem(`${CACHE_PREFIX}fresh`, JSON.stringify({ ts: now - 1000, data: [] }));
localStorage.setItem(`${CACHE_PREFIX}old`, JSON.stringify({ ts: now - CACHE_SWEEP_MAX_AGE - 1, data: [] }));
localStorage.setItem(`${CACHE_PREFIX}junk`, 'nope');
localStorage.setItem('kte_v3_prev', JSON.stringify({ ts: now, data: [] }));
localStorage.setItem(USAGE_KEY, '{}');
sweepCache();
check('sweep keeps fresh and user state, drops expired, junk and old prefixes',
  [...localStorage.m.keys()].sort().join() === [`${CACHE_PREFIX}fresh`, USAGE_KEY].sort().join());
