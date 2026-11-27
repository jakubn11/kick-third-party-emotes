// The settings panel (2.17.0), the picker tab (2.18.0), the right-click menu
// and the autocomplete (2.19.0) in Kick's language: UI_TEXT, picked by
// <html lang> like the chat settings row, English for anything else.

loadConst(['UI_TEXT', 'CHAT_SETTINGS_ROW_LABELS', 'MOTION_MODES', 'EMOTE_SIZES']);
load(['kickLang', 'uiText']);

var savedDoc = typeof document === 'undefined' ? undefined : document;
globalThis.document = { documentElement: { lang: 'cs' } };

check('Czech panel text for a Czech Kick', uiText().providers === 'Poskytovatelé' && uiText().close === 'Zavřít');
document.documentElement.lang = 'pt-BR';
check('a regional code uses its language (pt-BR → pt)', uiText().cancel === 'Cancelar');
document.documentElement.lang = 'xx';
check('a language without a translation is English', uiText() === UI_TEXT.en);
document.documentElement.lang = 'toString';
check('an inherited property name is not a language', uiText() === UI_TEXT.en);

var en = UI_TEXT.en;
var keys = Object.keys(en).filter(k => k !== 'usedOne');
var langs = Object.keys(UI_TEXT);
check('the same languages as the chat settings row',
  langs.slice().sort().join() === Object.keys(CHAT_SETTINGS_ROW_LABELS).sort().join());
check('every language has every string, none empty', langs.every(l =>
  keys.every(k => typeof UI_TEXT[l][k] === 'string' && UI_TEXT[l][k].trim() !== '')));
check('…and nothing English lacks', langs.every(l => Object.keys(UI_TEXT[l]).every(k => k in en)));
check('every chip has its label', langs.every(l =>
  MOTION_MODES.concat(Object.keys(EMOTE_SIZES)).every(k => !!UI_TEXT[l][k])));
check('the count goes in {n}, once, and the empty note has none', langs.every(l =>
  UI_TEXT[l].usedNote.split('{n}').length === 2 && UI_TEXT[l].usedNone.indexOf('{n}') < 0));
check('English says "1 emote" for one', en.usedOne.indexOf('1 emote remembered') === 0);
check('each placeholder is there, once', langs.every(l => [['insert', '{code}'], ['chipTip', '{provider}'],
  ['showing', '{shown}'], ['showing', '{total}'], ['openOn', '{provider}']].every(([k, ph]) => UI_TEXT[l][k].split(ph).length === 2)));

// No English left behind in the panel itself.
var src = fnSource('settingsPanelRender');
check('the panel takes its words from uiText()', /const t = uiText\(\);/.test(src) &&
  !/'(Providers|Global emotes|Options|Recently used|Cancel|Confirm clear|Close emote settings)'/.test(src));
var pickerSrc = ['pickerBuildButton', 'pickerBuildFooter', 'pickerBuildContent', 'pickerBuildSettings', 'pickerEmptyMessage', 'pickerBuildTab']
  .map(fnSource).join('\n');
check('…and so does the picker tab', !/'(Load more|Show less|Loading\.\.\.|Favourites'\, favourites|No matching emotes|Third-party emotes|7TV \/ BTTV \/ FFZ emotes)'/.test(pickerSrc) &&
  !/`(Insert|Showing|Show or hide) /.test(pickerSrc));
var popupSrc = fnSource('showEmoteMenu') + '\n' + fnSource('acRender');
check('…and the right-click menu and autocomplete', /uiText\(\)/.test(fnSource('showEmoteMenu')) && /uiText\(\)/.test(fnSource('acRender')) &&
  !/'(Add to favourites|Remove from favourites|Copy name|Copy image URL|Emotes)'/.test(popupSrc) && !/`Open on /.test(popupSrc) && !/navigate {2}·/.test(popupSrc));
check('the autocomplete hint keeps the keys as they are on the keyboard', langs.every(l => /^↑↓ .+ {2}· {2}Tab\/(Enter|Entrée|Invio) .+ {2}· {2}(Esc|Échap) /.test(UI_TEXT[l].acHint)));

if (savedDoc !== undefined) globalThis.document = savedDoc;
