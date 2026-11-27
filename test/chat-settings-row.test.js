// The "Third-party emotes" row in Kick's chat settings menu. The chat observer
// adds it when the menu changes; init() also adds it once at startup, so a
// menu that was already open when the script loaded gets it too (2.15.9).

loadConst(['CHAT_SETTINGS_ROW_ID']);
load(['chatSettingsMenuList', 'chatSettingsInject']);

var built = 0;
var chatSettingsBuildRow = () => { built++; return { id: CHAT_SETTINGS_ROW_ID }; };

// A stand-in for the menu's top-level list: rows with a ChevronRight icon.
function makeMenu() {
  var rows = [{ querySelector: sel => (sel === 'svg[data-ds-icon="ChevronRight"]' ? {} : null) }];
  var list = {
    children: rows,
    appendChild(row) { rows.push(row); },
    querySelector: sel => rows.find(r => sel === '#' + r.id) || null,
  };
  return {
    list: list,
    querySelector: sel => (sel === 'li svg[data-ds-icon="ChevronRight"]' ? { closest: () => list } : null),
  };
}

chatSettingsInject(null);
check('menu closed (no panel): nothing is built', built === 0);

var menu = makeMenu();
chatSettingsInject(menu);
check('an open menu gets the row', built === 1 && menu.list.children.length === 2);
chatSettingsInject(menu);
check('a second pass does not add it twice', built === 1 && menu.list.children.length === 2);

var initSrc = fnSource('init');
var observerAt = initSrc.indexOf('startChatObserver();');
var injectAt = initSrc.indexOf("chatSettingsInject(document.getElementById('chat-settings-panel'));");
check('init() adds the row at startup, after starting the observer', observerAt >= 0 && injectAt > observerAt);

// The row's family look (2.15.10): it keeps Kick's cloned row (and so its
// place and metrics) but is tagged for the shared stylesheet and the chevron
// becomes the green tile.
(function () {
  function Node(tag, cls) {
    this.tag = tag; this.attrs = {}; this.kids = []; this.parent = null; this.listeners = {};
    if (cls) this.attrs.class = cls;
  }
  Node.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
  Node.prototype.getAttribute = function (k) { return k in this.attrs ? this.attrs[k] : null; };
  Node.prototype.hasAttribute = function (k) { return k in this.attrs; };
  Node.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
  Node.prototype.appendChild = function (c) { c.parent = this; this.kids.push(c); return c; };
  Node.prototype.addEventListener = function (t, f) { this.listeners[t] = f; };
  Node.prototype.all = function () { return this.kids.reduce((a, k) => a.concat(k, k.all()), []); };
  Node.prototype.querySelectorAll = function (sel) {
    if (sel === '*') return this.all();
    if (sel === '[id], [data-testid]') return this.all().filter(n => n.hasAttribute('id') || n.hasAttribute('data-testid'));
    return this.all().filter(n => n.tag === sel);
  };
  Node.prototype.querySelector = function (sel) { return this.querySelectorAll(sel)[0] || null; };
  Node.prototype.replaceWith = function (n) { var k = this.parent.kids; k[k.indexOf(this)] = n; n.parent = this.parent; };
  Node.prototype.cloneNode = function () {
    var c = new Node(this.tag); Object.assign(c.attrs, this.attrs);
    this.kids.forEach(k => c.appendChild(k.cloneNode())); return c;
  };
  Object.defineProperty(Node.prototype, 'textContent', { set(v) { this.text = v; this.kids = []; } });

  var savedDoc = typeof document === 'undefined' ? undefined : document;
  globalThis.document = {
    createElement: t => new Node(t),
    createElementNS: (ns, t) => new Node(t),
  };
  globalThis.chatSettingsRowOpen = () => {};
  loadConst(['CHAT_SETTINGS_ROW_LABELS']);
  load(['panelMarkIcon', 'kickLang', 'chatSettingsRowLabel', 'chatSettingsBuildRow']);

  var li = new Node('li', 'h-10 px-1.5');
  var div = li.appendChild(new Node('div', 'flex items-center hover:bg-surface-tint rounded'));
  div.appendChild(new Node('span'));
  var chev = div.appendChild(new Node('svg')); chev.setAttribute('data-ds-icon', 'ChevronRight');

  var row = chatSettingsBuildRow(li);
  var tile = row.all().find(n => n.hasAttribute('data-kick-family-tile'));
  check('the row is tagged as a family row and keeps Kick\'s classes',
    row.hasAttribute('data-kick-family-row') && row.getAttribute('class') === 'h-10 px-1.5');
  check('the chevron is swapped for the tile holding the panel mark',
    !!tile && tile.kids[0].tag === 'svg' && !row.all().some(n => n.getAttribute('data-ds-icon') === 'ChevronRight'));
  check('Kick\'s own row is untouched', !li.hasAttribute('data-kick-family-row') && div.kids[1] === chev);

  var labelOf = r => r.all().find(n => n.hasAttribute('data-kick-family-label'));
  check('the label is English by default, and tagged', labelOf(row) && labelOf(row).text === 'Third-party emotes');

  // Kick's language (2.16.0), read from <html lang>.
  globalThis.document.documentElement = { lang: 'cs' };
  check('Kick in Czech: Czech label', labelOf(chatSettingsBuildRow(li)).text === 'Emoty třetích stran');
  document.documentElement.lang = 'pt-BR';
  check('a regional code uses its language (pt-BR → pt)', labelOf(chatSettingsBuildRow(li)).text === 'Emotes de terceiros');
  document.documentElement.lang = 'xx';
  check('no translation: English', labelOf(chatSettingsBuildRow(li)).text === 'Third-party emotes');
  check('every Kick language has a label, and none is empty',
    ['en', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'fi', 'fr', 'hu', 'id', 'it', 'ja', 'ko', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'vi', 'zh']
      .every(l => typeof CHAT_SETTINGS_ROW_LABELS[l] === 'string' && CHAT_SETTINGS_ROW_LABELS[l].length > 0) &&
    Object.keys(CHAT_SETTINGS_ROW_LABELS).length === 28);

  if (savedDoc !== undefined) globalThis.document = savedDoc;
})();
