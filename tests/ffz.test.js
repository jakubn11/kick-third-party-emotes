// ffzEntries against a trimmed copy of a live FFZ room (lirik, 2026-10-12),
// which has one animated emote, fallDamage.

loadConst(['ALLOWED_CDN_HOSTS']);
load(['ffzEntries', 'safeUrl', 'isSafeTextToken', 'isSafeTextLabel', 'isValidCacheEntry', 'emotePageUrl']);

var room = JSON.parse(readFile('tests/fixtures/ffz-room-lirik.json'));
var entries = ffzEntries(room.sets, 'FFZ (channel)');
var fd = entries.find(([code]) => code === 'fallDamage')[1];
check('animated emote uses its animated URL', fd.url === 'https://cdn.frankerfacez.com/emote/739826/animated/2' && fd.animated === true);
check('its still frame becomes staticUrl', fd.staticUrl === 'https://cdn.frankerfacez.com/emote/739826/2');
check('emote page still derives from the URL', emotePageUrl(fd) === 'https://www.frankerfacez.com/emoticon/739826');
var still = entries.find(([, e]) => !e.animated)[1];
check('still emote unchanged, no staticUrl', !('staticUrl' in still) && /\/emote\/\d+\/2$/.test(still.url));
check(`every entry passes cache validation (${entries.length})`, entries.length > 1 && entries.every(isValidCacheEntry));

var synthetic = ffzEntries({ s: { emoticons: [
  { name: 'x', urls: { 1: '//cdn.frankerfacez.com/emote/1/1' }, animated: { 1: '//cdn.frankerfacez.com/emote/1/animated/1' } },
  { name: 'ffzSpin', modifier: true, urls: { 1: 'https://cdn.frankerfacez.com/emote/2/1' } },
] } }, 'FFZ');
check('protocol-relative URLs fixed, modifiers skipped', synthetic.length === 1
  && synthetic[0][1].url === 'https://cdn.frankerfacez.com/emote/1/animated/1'
  && synthetic[0][1].staticUrl === 'https://cdn.frankerfacez.com/emote/1/1');
