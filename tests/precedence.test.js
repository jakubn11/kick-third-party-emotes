// rebuildEmoteMap: which layer wins when two sets share a code.

loadConst(['PROVIDERS']);
var hidden = new Set();
var providerEnabled = p => !hidden.has(p);
var emoteMap = new Map(), loadedProviders = new Map();
load(['loaderRank', 'rebuildEmoteMap']);

var e = source => ({ url: 'https://cdn.7tv.app/emote/x/2x.webp', source });
var activeLoaders = [
  { key: 'bttv_g', provider: 'BTTV', isChannel: false },
  { key: '7tv_g', provider: '7TV', isChannel: false },
  { key: 'ffz_g', provider: 'FFZ', isChannel: false },
  { key: 'bttv_c', provider: 'BTTV', isChannel: true },
  { key: '7tv_c', provider: '7TV', isChannel: true },
  { key: 'ffz_c', provider: 'FFZ', isChannel: true },
];
loadedProviders.set('bttv_g', [['A', e('BTTV')], ['G', e('BTTV')]]);
loadedProviders.set('7tv_g', [['A', e('7TV')], ['G', e('7TV')]]);
loadedProviders.set('ffz_g', [['A', e('FFZ')], ['F', e('FFZ')]]);
loadedProviders.set('bttv_c', [['C', e('BTTV (twitch)')], ['A', e('BTTV (twitch)')]]);
loadedProviders.set('7tv_c', [['C', e('7TV')]]);
loadedProviders.set('ffz_c', [['C', e('FFZ (channel)')], ['F', e('FFZ (channel)')]]);

rebuildEmoteMap();
check('7TV channel beats BTTV and FFZ channel', emoteMap.get('C').source === '7TV');
check('any channel set beats every global set', emoteMap.get('A').source === 'BTTV (twitch)');
check('7TV global beats BTTV global', emoteMap.get('G').source === '7TV');
check('FFZ channel beats FFZ global', emoteMap.get('F').source === 'FFZ (channel)');

hidden.add('7TV');
rebuildEmoteMap();
check('hiding 7TV falls through to BTTV', emoteMap.get('C').source === 'BTTV (twitch)' && emoteMap.get('G').source === 'BTTV');
