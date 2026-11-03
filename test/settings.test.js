// settingsFromRecord: reading kte_v2_settings back, old records included.

loadConst(['PROVIDERS', 'MOTION_MODES', 'EMOTE_SIZES']);
load(['settingsDefaults', 'settingsFromRecord']);

var d = settingsFromRecord(null);
check('no record: every provider on', PROVIDERS.every(p => d.providers[p] === true));
check('no record: every global set on', PROVIDERS.every(p => d.globals[p] === true));
check('no record: autocomplete on, motion always', d.autocomplete === true && d.motion === 'always');
check('no record: medium emotes, preview on', d.size === 'medium' && d.preview === true);

var old = settingsFromRecord({ ts: 1, providers: { '7TV': true, BTTV: false, FFZ: true } });
check('2.12 record: provider choice kept', old.providers.BTTV === false && old.providers['7TV'] === true);
check('2.12 record: new fields take defaults', old.globals.BTTV === true && old.autocomplete === true && old.motion === 'always'
  && old.size === 'medium' && old.preview === true);

var full = settingsFromRecord({ globals: { FFZ: false }, autocomplete: false, motion: 'hover', size: 'large', preview: false });
check('globals read per provider', full.globals.FFZ === false && full.globals['7TV'] === true);
check('autocomplete and motion read', full.autocomplete === false && full.motion === 'hover');
check('size and preview read', full.size === 'large' && full.preview === false);

var bad = settingsFromRecord({ providers: { BTTV: 'no' }, globals: [], autocomplete: 1, motion: 'sometimes', size: 'huge', preview: 'yes' });
check('malformed fields fall back to defaults',
  bad.providers.BTTV === true && bad.globals.BTTV === true && bad.autocomplete === true && bad.motion === 'always'
  && bad.size === 'medium' && bad.preview === true);
check('an inherited key is not a size', settingsFromRecord({ size: 'toString' }).size === 'medium');

var proto = settingsFromRecord(JSON.parse('{"__proto__": {"motion": "never"}, "providers": {"__proto__": {"BTTV": false}}}'));
check('prototype keys are not read as settings', proto.motion === 'always' && proto.providers.BTTV === true);

// pickerEmptyMessage: why the 7TV+ tab is empty.
load(['pickerEmptyMessage']);
var shownSet = new Set(PROVIDERS), globalsOn = new Set(PROVIDERS), emotesSettled = false;
var providerEnabled = p => shownSet.has(p);
var globalsEnabled = p => globalsOn.has(p);
check('empty: a search says no match', pickerEmptyMessage('xyz') === 'No matching emotes');
check('empty: still loading', pickerEmptyMessage('') === 'Emotes loading…');
emotesSettled = true;
check('empty: loaded, nothing anywhere', pickerEmptyMessage('') === 'No emotes for this channel');
globalsOn.clear();
check('empty: global sets off points at Settings', /global emotes are off/.test(pickerEmptyMessage('')));
shownSet.clear();
check('empty: every provider hidden', /Every provider is hidden/.test(pickerEmptyMessage('')));
