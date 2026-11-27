// The settings panel in Kick's language (2.17.0): PANEL_TEXT, picked by
// <html lang> like the chat settings row, English for anything else.

loadConst(['PANEL_TEXT', 'CHAT_SETTINGS_ROW_LABELS', 'MOTION_MODES', 'EMOTE_SIZES']);
load(['kickLang', 'panelText']);

var savedDoc = typeof document === 'undefined' ? undefined : document;
globalThis.document = { documentElement: { lang: 'cs' } };

check('Czech panel text for a Czech Kick', panelText().providers === 'Poskytovatelé' && panelText().close === 'Zavřít');
document.documentElement.lang = 'pt-BR';
check('a regional code uses its language (pt-BR → pt)', panelText().cancel === 'Cancelar');
document.documentElement.lang = 'xx';
check('a language without a translation is English', panelText() === PANEL_TEXT.en);
document.documentElement.lang = 'toString';
check('an inherited property name is not a language', panelText() === PANEL_TEXT.en);

var en = PANEL_TEXT.en;
var keys = Object.keys(en).filter(k => k !== 'usedOne');
var langs = Object.keys(PANEL_TEXT);
check('the same languages as the chat settings row',
  langs.slice().sort().join() === Object.keys(CHAT_SETTINGS_ROW_LABELS).sort().join());
check('every language has every string, none empty', langs.every(l =>
  keys.every(k => typeof PANEL_TEXT[l][k] === 'string' && PANEL_TEXT[l][k].trim() !== '')));
check('…and nothing English lacks', langs.every(l => Object.keys(PANEL_TEXT[l]).every(k => k in en)));
check('every chip has its label', langs.every(l =>
  MOTION_MODES.concat(Object.keys(EMOTE_SIZES)).every(k => !!PANEL_TEXT[l][k])));
check('the count goes in {n}, once, and the empty note has none', langs.every(l =>
  PANEL_TEXT[l].usedNote.split('{n}').length === 2 && PANEL_TEXT[l].usedNone.indexOf('{n}') < 0));
check('English says "1 emote" for one', en.usedOne.indexOf('1 emote remembered') === 0);

// No English left behind in the panel itself.
var src = fnSource('settingsPanelRender');
check('the panel takes its words from panelText()', /const t = panelText\(\);/.test(src) &&
  !/'(Providers|Global emotes|Options|Recently used|Cancel|Confirm clear|Close emote settings)'/.test(src));

if (savedDoc !== undefined) globalThis.document = savedDoc;
