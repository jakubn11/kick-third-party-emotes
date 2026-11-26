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
