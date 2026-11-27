// ==UserScript==
// @name         Kick Third-Party Emotes
// @namespace    https://kick.com
// @version      2.20.0
// @description  Adds BetterTTV, 7TV & FrankerFaceZ emotes to Kick.com chat — animated & zero-width emotes, usage-ranked autocomplete, favourites, hover previews, right-click emote menu, native picker tab with recents, and settings for providers, global sets, animation, emote size, previews & autocomplete
// @author       jakubnl94@gmail.com
// @license      GPL-3.0-only
// @icon         https://raw.githubusercontent.com/jakubn11/kick-third-party-emotes/main/icon.svg
// @match        https://kick.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.betterttv.net
// @connect      cdn.betterttv.net
// @connect      7tv.io
// @connect      cdn.7tv.app
// @connect      api.frankerfacez.com
// @connect      cdn.frankerfacez.com
// @updateURL    https://github.com/jakubn11/kick-third-party-emotes/releases/latest/download/kick-third-party-emotes.user.js
// @downloadURL  https://github.com/jakubn11/kick-third-party-emotes/releases/latest/download/kick-third-party-emotes.user.js
// ==/UserScript==

(function () {
  'use strict';

  // Bumped on every release with the `@version` in the metadata header above.
  // It names the running build in the boot line and in the duplicate warning
  // below — the only way to tell which copy is running once auto-update, a
  // Greasy Fork install and a manual copy can all be in play.
  const VERSION = '2.20.0';

  // ── Words in Kick's language ───────────────────────────────────────────
  // Every word the script shows, in Kick's language, English for any other:
  // the settings panel (2.17.0), the picker tab (2.18.0), the right-click
  // menu and the autocomplete (2.19.0), and the console and the manager-menu
  // entry (2.20.0). The same languages as the chat settings row
  // (CHAT_SETTINGS_ROW_LABELS, which is also the panel's title and the tab's
  // name). Read on every build, so a language change shows the next time
  // each one draws; the manager-menu entry is registered once, so it keeps
  // the language Kick was in when the page loaded. Up here, before the
  // single-instance guard, because the guard's own warning uses it (a const
  // read before its line would throw; kickLang() is a function declaration,
  // so it can stay with the chat settings row). Provider names stay as they
  // are, and so do the error-style console lines (a provider's failure), for
  // bug reports. `usedNote` takes the count as {n}, phrased so no plural form
  // is needed; English alone has a `usedOne` for a count of 1. `insert`,
  // `chipTip`, `openOn` and `showing` take {code}, {provider} and
  // {shown}/{total}; `active` and `duplicate` take {v} and {running},
  // `loadingFor` and `ready` {slug} (and {n}), `retrying` {n} and {s},
  // `givingUp` the failing loaders as {providers}. `acHint` keeps the key
  // names (↑↓, Tab/Enter, Esc) as they are on the keyboard.
  const UI_TEXT = Object.freeze({
    en: Object.freeze({
      close: 'Close',
      providers: 'Providers',
      globals: 'Global emotes',
      animated: 'Animated emotes',
      size: 'Emote size in chat',
      options: 'Options',
      recent: 'Recently used',
      providersNote: 'Hiding a provider removes all of its emotes, from chat too.',
      globalsNote: 'Each provider\'s emotes for every channel. Turn them off to keep only the streamer\'s own set.',
      reducedNote: 'Your system\'s Reduce motion setting is on, so emotes stay still whatever you pick.',
      bttvNote: 'BTTV serves no still frames, so its animated emotes always move.',
      always: 'Always',
      hover: 'On hover',
      never: 'Never',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      suggest: 'Suggest emotes while typing',
      preview: 'Large preview on hover',
      clear: 'Clear recently used',
      confirmClear: 'Confirm clear',
      cancel: 'Cancel',
      usedNote: '{n} emotes remembered for the picker\'s Recently used section and the autocomplete ranking. Favourites are kept.',
      usedNone: 'Nothing remembered yet. Emotes you insert show up in the picker\'s Recently used section.',
      favourites: 'Favourites',
      insert: 'Insert {code}',
      loadMore: 'Load more',
      loadMoreLabel: 'Load more emotes',
      showLess: 'Show less',
      showLessLabel: 'Show fewer emotes',
      showing: 'Showing {shown} of {total}',
      loading: 'Loading…',
      chipTip: 'Show or hide {provider} emotes',
      tabTip: '7TV / BTTV / FFZ emotes',
      emptySearch: 'No matching emotes',
      emptyHidden: 'Every provider is hidden — turn one back on above',
      emptyLoading: 'Emotes loading…',
      emptyGlobalsOff: 'No channel emotes here, and global emotes are off — turn them back on in Settings',
      emptyChannel: 'No emotes for this channel',
      favAdd: 'Add to favourites',
      favRemove: 'Remove from favourites',
      copyName: 'Copy name',
      copyUrl: 'Copy image URL',
      openOn: 'Open on {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ navigate  ·  Tab/Enter select  ·  Esc close',
      active: 'v{v} active',
      duplicate: 'v{v} is standing down: v{running} is already running on this page. Disable or uninstall the duplicate copy.',
      autocomplete: 'Autocomplete attached',
      loadingFor: 'Loading emotes for /{slug}…',
      ready: 'Ready – {n} emotes for /{slug}',
      retrying: '{n} provider(s) failed, retrying in {s}s…',
      retryLoaded: 'Retry loaded {n} emotes',
      givingUp: 'Giving up on {providers} until the next page load',
      menuSettings: 'Emote settings',
      usedOne: '1 emote remembered for the picker\'s Recently used section and the autocomplete ranking. Favourites are kept.',
    }),
    ar: Object.freeze({
      close: 'إغلاق',
      providers: 'المزوّدون',
      globals: 'الرموز العامة',
      animated: 'الرموز المتحركة',
      size: 'حجم الرموز في الدردشة',
      options: 'خيارات',
      recent: 'المستخدمة مؤخرًا',
      providersNote: 'إخفاء مزوّد يزيل كل رموزه، من الدردشة أيضًا.',
      globalsNote: 'رموز كل مزوّد المتاحة في جميع القنوات. أوقفها لتبقى رموز صاحب القناة فقط.',
      reducedNote: 'إعداد تقليل الحركة في نظامك مفعّل، لذا تبقى الرموز ثابتة مهما اخترت.',
      bttvNote: 'لا يوفّر BTTV إطارات ثابتة، لذا تتحرك رموزه المتحركة دائمًا.',
      always: 'دائمًا',
      hover: 'عند التمرير',
      never: 'أبدًا',
      small: 'صغير',
      medium: 'متوسط',
      large: 'كبير',
      suggest: 'اقتراح الرموز أثناء الكتابة',
      preview: 'معاينة كبيرة عند التمرير',
      clear: 'مسح المستخدمة مؤخرًا',
      confirmClear: 'تأكيد المسح',
      cancel: 'إلغاء',
      usedNote: 'رموز محفوظة: {n}. تُستخدم لقسم «المستخدمة مؤخرًا» في المنتقي ولترتيب الإكمال التلقائي. المفضلة تبقى.',
      usedNone: 'لا شيء محفوظ بعد. الرموز التي تُدرجها تظهر في قسم «المستخدمة مؤخرًا» في المنتقي.',
      favourites: 'المفضلة',
      insert: 'إدراج {code}',
      loadMore: 'تحميل المزيد',
      loadMoreLabel: 'تحميل المزيد من الرموز',
      showLess: 'عرض أقل',
      showLessLabel: 'عرض رموز أقل',
      showing: 'معروض {shown} من {total}',
      loading: 'جارٍ التحميل…',
      chipTip: 'إظهار رموز {provider} أو إخفاؤها',
      tabTip: 'رموز 7TV / BTTV / FFZ',
      emptySearch: 'لا توجد رموز مطابقة',
      emptyHidden: 'كل المزوّدين مخفيون — أعد تشغيل أحدهم في الأعلى',
      emptyLoading: 'جارٍ تحميل الرموز…',
      emptyGlobalsOff: 'لا رموز للقناة هنا، والرموز العامة متوقفة — أعد تشغيلها من الإعدادات',
      emptyChannel: 'لا توجد رموز لهذه القناة',
      favAdd: 'إضافة إلى المفضلة',
      favRemove: 'إزالة من المفضلة',
      copyName: 'نسخ الاسم',
      copyUrl: 'نسخ رابط الصورة',
      openOn: 'فتح في {provider}',
      acHeader: 'الرموز',
      acHint: '↑↓ تنقّل  ·  Tab/Enter اختيار  ·  Esc إغلاق',
      active: 'v{v} يعمل',
      duplicate: 'v{v} يتوقف: v{running} يعمل بالفعل في هذه الصفحة. عطّل النسخة المكررة أو أزلها.',
      autocomplete: 'الإكمال التلقائي مُفعّل',
      loadingFor: 'جارٍ تحميل الرموز لـ /{slug}…',
      ready: 'جاهز – الرموز لـ /{slug}: {n}',
      retrying: 'مزوّدون فشلوا: {n}، إعادة المحاولة بعد {s} ث…',
      retryLoaded: 'رموز حمّلتها إعادة المحاولة: {n}',
      givingUp: 'التوقف عن المحاولة مع {providers} حتى إعادة تحميل الصفحة',
      menuSettings: 'إعدادات الرموز',
    }),
    bg: Object.freeze({
      close: 'Затвори',
      providers: 'Доставчици',
      globals: 'Глобални емоути',
      animated: 'Анимирани емоути',
      size: 'Размер на емоутите в чата',
      options: 'Опции',
      recent: 'Наскоро използвани',
      providersNote: 'Скриването на доставчик премахва всичките му емоути, и от чата.',
      globalsNote: 'Емоутите на всеки доставчик за всички канали. Изключи ги, за да остане само наборът на стриймъра.',
      reducedNote: 'Системната настройка „Намаляване на движението“ е включена, така че емоутите остават неподвижни, каквото и да избереш.',
      bttvNote: 'BTTV не предоставя неподвижни кадри, затова анимираните му емоути винаги се движат.',
      always: 'Винаги',
      hover: 'При курсор',
      never: 'Никога',
      small: 'Малък',
      medium: 'Среден',
      large: 'Голям',
      suggest: 'Предлагай емоути при писане',
      preview: 'Голям преглед при посочване',
      clear: 'Изчисти наскоро използваните',
      confirmClear: 'Потвърди',
      cancel: 'Отказ',
      usedNote: 'Запомнени емоути: {n}. За секцията „Наскоро използвани“ и за подредбата при автодовършване. Любимите остават.',
      usedNone: 'Още нищо не е запомнено. Емоутите, които вмъкнеш, се появяват в „Наскоро използвани“.',
      favourites: 'Любими',
      insert: 'Вмъкни {code}',
      loadMore: 'Зареди още',
      loadMoreLabel: 'Зареди още емоути',
      showLess: 'Покажи по-малко',
      showLessLabel: 'Покажи по-малко емоути',
      showing: '{shown} от {total}',
      loading: 'Зареждане…',
      chipTip: 'Покажи или скрий емоутите от {provider}',
      tabTip: 'Емоути от 7TV / BTTV / FFZ',
      emptySearch: 'Няма съвпадащи емоути',
      emptyHidden: 'Всички доставчици са скрити — включи някой отгоре',
      emptyLoading: 'Емоутите се зареждат…',
      emptyGlobalsOff: 'Тук няма емоути на канала, а глобалните са изключени — включи ги в настройките',
      emptyChannel: 'Няма емоути за този канал',
      favAdd: 'Добави в любими',
      favRemove: 'Премахни от любими',
      copyName: 'Копирай името',
      copyUrl: 'Копирай URL на изображението',
      openOn: 'Отвори в {provider}',
      acHeader: 'Емоути',
      acHint: '↑↓ придвижване  ·  Tab/Enter избор  ·  Esc затваряне',
      active: 'v{v} е активен',
      duplicate: 'v{v} се спира: v{running} вече работи на тази страница. Изключи или премахни дублираното копие.',
      autocomplete: 'Автодовършването е свързано',
      loadingFor: 'Зареждане на емоути за /{slug}…',
      ready: 'Готово – емоути за /{slug}: {n}',
      retrying: 'Неуспешни доставчици: {n}, нов опит след {s} с…',
      retryLoaded: 'Повторният опит зареди емоути: {n}',
      givingUp: 'Отказ от {providers} до следващото зареждане на страницата',
      menuSettings: 'Настройки на емоутите',
    }),
    cs: Object.freeze({
      close: 'Zavřít',
      providers: 'Poskytovatelé',
      globals: 'Globální emoty',
      animated: 'Animované emoty',
      size: 'Velikost emotů v chatu',
      options: 'Možnosti',
      recent: 'Nedávno použité',
      providersNote: 'Skrytím poskytovatele zmizí všechny jeho emoty, i z chatu.',
      globalsNote: 'Emoty každého poskytovatele pro všechny kanály. Vypni je a zůstane jen vlastní sada streamera.',
      reducedNote: 'V systému je zapnuté Omezit pohyb, takže emoty zůstanou v klidu, ať vybereš cokoli.',
      bttvNote: 'BTTV nemá statické snímky, takže jeho animované emoty se hýbou vždy.',
      always: 'Vždy',
      hover: 'Při najetí',
      never: 'Nikdy',
      small: 'Malé',
      medium: 'Střední',
      large: 'Velké',
      suggest: 'Navrhovat emoty při psaní',
      preview: 'Velký náhled při najetí',
      clear: 'Vymazat nedávno použité',
      confirmClear: 'Potvrdit vymazání',
      cancel: 'Zrušit',
      usedNote: 'Zapamatované emoty: {n}. Slouží pro Nedávno použité ve výběru a pořadí našeptávače. Oblíbené zůstanou.',
      usedNone: 'Zatím nic zapamatováno. Emoty, které vložíš, se objeví v Nedávno použitých ve výběru.',
      favourites: 'Oblíbené',
      insert: 'Vložit {code}',
      loadMore: 'Načíst další',
      loadMoreLabel: 'Načíst další emoty',
      showLess: 'Zobrazit méně',
      showLessLabel: 'Zobrazit méně emotů',
      showing: 'Zobrazeno {shown} z {total}',
      loading: 'Načítání…',
      chipTip: 'Zobrazit nebo skrýt emoty {provider}',
      tabTip: 'Emoty 7TV / BTTV / FFZ',
      emptySearch: 'Žádné odpovídající emoty',
      emptyHidden: 'Všichni poskytovatelé jsou skrytí — zapni některého výše',
      emptyLoading: 'Emoty se načítají…',
      emptyGlobalsOff: 'Kanál tu nemá žádné emoty a globální emoty jsou vypnuté — zapni je v nastavení',
      emptyChannel: 'Tento kanál nemá žádné emoty',
      favAdd: 'Přidat do oblíbených',
      favRemove: 'Odebrat z oblíbených',
      copyName: 'Kopírovat název',
      copyUrl: 'Kopírovat URL obrázku',
      openOn: 'Otevřít na {provider}',
      acHeader: 'Emoty',
      acHint: '↑↓ pohyb  ·  Tab/Enter výběr  ·  Esc zavřít',
      active: 'v{v} běží',
      duplicate: 'v{v} se vypíná: na této stránce už běží v{running}. Vypni nebo odinstaluj duplicitní kopii.',
      autocomplete: 'Našeptávač připojen',
      loadingFor: 'Načítám emoty pro /{slug}…',
      ready: 'Hotovo – emoty pro /{slug}: {n}',
      retrying: 'Selhalo poskytovatelů: {n}, další pokus za {s} s…',
      retryLoaded: 'Další pokus načetl emoty: {n}',
      givingUp: 'Vzdávám {providers} do dalšího načtení stránky',
      menuSettings: 'Nastavení emotů',
    }),
    da: Object.freeze({
      close: 'Luk',
      providers: 'Udbydere',
      globals: 'Globale emotes',
      animated: 'Animerede emotes',
      size: 'Emote-størrelse i chatten',
      options: 'Indstillinger',
      recent: 'Senest brugt',
      providersNote: 'Skjuler du en udbyder, forsvinder alle dens emotes, også fra chatten.',
      globalsNote: 'Hver udbyders emotes til alle kanaler. Slå dem fra for kun at beholde streamerens eget sæt.',
      reducedNote: 'Systemets Reducer bevægelse er slået til, så emotes står stille, uanset hvad du vælger.',
      bttvNote: 'BTTV har ingen stillbilleder, så dens animerede emotes bevæger sig altid.',
      always: 'Altid',
      hover: 'Ved hover',
      never: 'Aldrig',
      small: 'Lille',
      medium: 'Mellem',
      large: 'Stor',
      suggest: 'Foreslå emotes, mens du skriver',
      preview: 'Stor forhåndsvisning ved hover',
      clear: 'Ryd senest brugt',
      confirmClear: 'Bekræft rydning',
      cancel: 'Annuller',
      usedNote: 'Huskede emotes: {n}. Bruges til vælgerens Senest brugt og rækkefølgen i autofuldførelse. Favoritter beholdes.',
      usedNone: 'Intet husket endnu. Emotes, du indsætter, vises under Senest brugt i vælgeren.',
      favourites: 'Favoritter',
      insert: 'Indsæt {code}',
      loadMore: 'Indlæs flere',
      loadMoreLabel: 'Indlæs flere emotes',
      showLess: 'Vis færre',
      showLessLabel: 'Vis færre emotes',
      showing: 'Viser {shown} af {total}',
      loading: 'Indlæser…',
      chipTip: 'Vis eller skjul emotes fra {provider}',
      tabTip: 'Emotes fra 7TV / BTTV / FFZ',
      emptySearch: 'Ingen matchende emotes',
      emptyHidden: 'Alle udbydere er skjult — slå en til igen ovenfor',
      emptyLoading: 'Emotes indlæses…',
      emptyGlobalsOff: 'Ingen kanal-emotes her, og globale emotes er slået fra — slå dem til igen i indstillingerne',
      emptyChannel: 'Ingen emotes til denne kanal',
      favAdd: 'Føj til favoritter',
      favRemove: 'Fjern fra favoritter',
      copyName: 'Kopiér navn',
      copyUrl: 'Kopiér billed-URL',
      openOn: 'Åbn på {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ naviger  ·  Tab/Enter vælg  ·  Esc luk',
      active: 'v{v} aktiv',
      duplicate: 'v{v} trækker sig: v{running} kører allerede på siden. Slå den dobbelte kopi fra, eller afinstaller den.',
      autocomplete: 'Autofuldførelse tilknyttet',
      loadingFor: 'Indlæser emotes for /{slug}…',
      ready: 'Klar – emotes for /{slug}: {n}',
      retrying: 'Udbydere der fejlede: {n}, prøver igen om {s} s…',
      retryLoaded: 'Nyt forsøg indlæste emotes: {n}',
      givingUp: 'Opgiver {providers} indtil næste sideindlæsning',
      menuSettings: 'Emote-indstillinger',
    }),
    de: Object.freeze({
      close: 'Schließen',
      providers: 'Anbieter',
      globals: 'Globale Emotes',
      animated: 'Animierte Emotes',
      size: 'Emote-Größe im Chat',
      options: 'Optionen',
      recent: 'Zuletzt verwendet',
      providersNote: 'Ein ausgeblendeter Anbieter verliert alle seine Emotes, auch im Chat.',
      globalsNote: 'Die Emotes jedes Anbieters für alle Kanäle. Aus, und es bleibt nur das eigene Set des Streamers.',
      reducedNote: 'In deinem System ist „Bewegung reduzieren“ an, daher bleiben Emotes still, egal was du wählst.',
      bttvNote: 'BTTV liefert keine Standbilder, daher bewegen sich seine animierten Emotes immer.',
      always: 'Immer',
      hover: 'Beim Hover',
      never: 'Nie',
      small: 'Klein',
      medium: 'Mittel',
      large: 'Groß',
      suggest: 'Emotes beim Tippen vorschlagen',
      preview: 'Große Vorschau beim Darüberfahren',
      clear: 'Zuletzt verwendet leeren',
      confirmClear: 'Leeren bestätigen',
      cancel: 'Abbrechen',
      usedNote: 'Gemerkte Emotes: {n}. Für „Zuletzt verwendet“ in der Auswahl und die Reihenfolge der Vorschläge. Favoriten bleiben.',
      usedNone: 'Noch nichts gemerkt. Eingefügte Emotes erscheinen unter „Zuletzt verwendet“ in der Auswahl.',
      favourites: 'Favoriten',
      insert: '{code} einfügen',
      loadMore: 'Mehr laden',
      loadMoreLabel: 'Mehr Emotes laden',
      showLess: 'Weniger',
      showLessLabel: 'Weniger Emotes zeigen',
      showing: '{shown} von {total}',
      loading: 'Lädt…',
      chipTip: 'Emotes von {provider} zeigen oder ausblenden',
      tabTip: 'Emotes von 7TV / BTTV / FFZ',
      emptySearch: 'Keine passenden Emotes',
      emptyHidden: 'Alle Anbieter sind ausgeblendet — schalte oben einen wieder ein',
      emptyLoading: 'Emotes werden geladen…',
      emptyGlobalsOff: 'Keine Kanal-Emotes hier, und globale Emotes sind aus — schalte sie in den Einstellungen wieder ein',
      emptyChannel: 'Keine Emotes für diesen Kanal',
      favAdd: 'Zu Favoriten hinzufügen',
      favRemove: 'Aus Favoriten entfernen',
      copyName: 'Namen kopieren',
      copyUrl: 'Bild-URL kopieren',
      openOn: 'Auf {provider} öffnen',
      acHeader: 'Emotes',
      acHint: '↑↓ navigieren  ·  Tab/Enter auswählen  ·  Esc schließen',
      active: 'v{v} aktiv',
      duplicate: 'v{v} hält an: v{running} läuft bereits auf dieser Seite. Deaktiviere oder deinstalliere die doppelte Kopie.',
      autocomplete: 'Autovervollständigung verbunden',
      loadingFor: 'Lade Emotes für /{slug}…',
      ready: 'Bereit – Emotes für /{slug}: {n}',
      retrying: 'Fehlgeschlagene Anbieter: {n}, neuer Versuch in {s} s…',
      retryLoaded: 'Neuer Versuch lud Emotes: {n}',
      givingUp: 'Gebe {providers} bis zum nächsten Seitenaufruf auf',
      menuSettings: 'Emote-Einstellungen',
    }),
    el: Object.freeze({
      close: 'Κλείσιμο',
      providers: 'Πάροχοι',
      globals: 'Καθολικά emotes',
      animated: 'Κινούμενα emotes',
      size: 'Μέγεθος emotes στη συνομιλία',
      options: 'Επιλογές',
      recent: 'Πρόσφατα',
      providersNote: 'Η απόκρυψη ενός παρόχου αφαιρεί όλα τα emotes του, και από τη συνομιλία.',
      globalsNote: 'Τα emotes κάθε παρόχου για όλα τα κανάλια. Απενεργοποίησέ τα για να μείνει μόνο το σετ του streamer.',
      reducedNote: 'Η ρύθμιση Μείωση κίνησης του συστήματος είναι ενεργή, οπότε τα emotes μένουν ακίνητα ό,τι κι αν διαλέξεις.',
      bttvNote: 'Το BTTV δεν δίνει στατικά καρέ, οπότε τα κινούμενα emotes του κινούνται πάντα.',
      always: 'Πάντα',
      hover: 'Στο πέρασμα',
      never: 'Ποτέ',
      small: 'Μικρό',
      medium: 'Μεσαίο',
      large: 'Μεγάλο',
      suggest: 'Προτάσεις emotes κατά την πληκτρολόγηση',
      preview: 'Μεγάλη προεπισκόπηση στο πέρασμα',
      clear: 'Εκκαθάριση πρόσφατων',
      confirmClear: 'Επιβεβαίωση',
      cancel: 'Άκυρο',
      usedNote: 'Αποθηκευμένα emotes: {n}. Για την ενότητα Πρόσφατα του επιλογέα και τη σειρά της αυτόματης συμπλήρωσης. Τα αγαπημένα μένουν.',
      usedNone: 'Τίποτα ακόμη. Τα emotes που εισάγεις εμφανίζονται στα Πρόσφατα του επιλογέα.',
      favourites: 'Αγαπημένα',
      insert: 'Εισαγωγή {code}',
      loadMore: 'Περισσότερα',
      loadMoreLabel: 'Φόρτωση περισσότερων emotes',
      showLess: 'Λιγότερα',
      showLessLabel: 'Λιγότερα emotes',
      showing: '{shown} από {total}',
      loading: 'Φόρτωση…',
      chipTip: 'Εμφάνιση ή απόκρυψη emotes του {provider}',
      tabTip: 'Emotes 7TV / BTTV / FFZ',
      emptySearch: 'Κανένα emote δεν ταιριάζει',
      emptyHidden: 'Όλοι οι πάροχοι είναι κρυμμένοι — ενεργοποίησε έναν παραπάνω',
      emptyLoading: 'Φόρτωση emotes…',
      emptyGlobalsOff: 'Δεν υπάρχουν emotes καναλιού και τα καθολικά είναι ανενεργά — ενεργοποίησέ τα στις ρυθμίσεις',
      emptyChannel: 'Δεν υπάρχουν emotes για αυτό το κανάλι',
      favAdd: 'Προσθήκη στα αγαπημένα',
      favRemove: 'Αφαίρεση από τα αγαπημένα',
      copyName: 'Αντιγραφή ονόματος',
      copyUrl: 'Αντιγραφή URL εικόνας',
      openOn: 'Άνοιγμα στο {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ πλοήγηση  ·  Tab/Enter επιλογή  ·  Esc κλείσιμο',
      active: 'v{v} ενεργό',
      duplicate: 'Το v{v} σταματά: το v{running} τρέχει ήδη σε αυτή τη σελίδα. Απενεργοποίησε ή απεγκατέστησε το διπλό αντίγραφο.',
      autocomplete: 'Η αυτόματη συμπλήρωση συνδέθηκε',
      loadingFor: 'Φόρτωση emotes για /{slug}…',
      ready: 'Έτοιμο – emotes για /{slug}: {n}',
      retrying: 'Πάροχοι που απέτυχαν: {n}, νέα προσπάθεια σε {s} δ…',
      retryLoaded: 'Η νέα προσπάθεια φόρτωσε emotes: {n}',
      givingUp: 'Εγκατάλειψη για {providers} μέχρι την επόμενη φόρτωση της σελίδας',
      menuSettings: 'Ρυθμίσεις emotes',
    }),
    es: Object.freeze({
      close: 'Cerrar',
      providers: 'Proveedores',
      globals: 'Emotes globales',
      animated: 'Emotes animados',
      size: 'Tamaño de los emotes en el chat',
      options: 'Opciones',
      recent: 'Usados recientemente',
      providersNote: 'Ocultar un proveedor quita todos sus emotes, también del chat.',
      globalsNote: 'Los emotes de cada proveedor para todos los canales. Desactívalos para quedarte solo con los del streamer.',
      reducedNote: 'La opción Reducir movimiento de tu sistema está activada, así que los emotes quedan quietos elijas lo que elijas.',
      bttvNote: 'BTTV no ofrece fotogramas fijos, así que sus emotes animados siempre se mueven.',
      always: 'Siempre',
      hover: 'Al pasar',
      never: 'Nunca',
      small: 'Pequeño',
      medium: 'Mediano',
      large: 'Grande',
      suggest: 'Sugerir emotes al escribir',
      preview: 'Vista previa grande al pasar el ratón',
      clear: 'Borrar usados recientemente',
      confirmClear: 'Confirmar borrado',
      cancel: 'Cancelar',
      usedNote: 'Emotes recordados: {n}. Para Usados recientemente del selector y el orden del autocompletado. Los favoritos se conservan.',
      usedNone: 'Aún no hay nada. Los emotes que insertes aparecen en Usados recientemente del selector.',
      favourites: 'Favoritos',
      insert: 'Insertar {code}',
      loadMore: 'Cargar más',
      loadMoreLabel: 'Cargar más emotes',
      showLess: 'Ver menos',
      showLessLabel: 'Ver menos emotes',
      showing: '{shown} de {total}',
      loading: 'Cargando…',
      chipTip: 'Mostrar u ocultar los emotes de {provider}',
      tabTip: 'Emotes de 7TV / BTTV / FFZ',
      emptySearch: 'Ningún emote coincide',
      emptyHidden: 'Todos los proveedores están ocultos: activa uno arriba',
      emptyLoading: 'Cargando emotes…',
      emptyGlobalsOff: 'Este canal no tiene emotes y los globales están desactivados: actívalos en los ajustes',
      emptyChannel: 'Este canal no tiene emotes',
      favAdd: 'Añadir a favoritos',
      favRemove: 'Quitar de favoritos',
      copyName: 'Copiar nombre',
      copyUrl: 'Copiar URL de la imagen',
      openOn: 'Abrir en {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ moverse  ·  Tab/Enter elegir  ·  Esc cerrar',
      active: 'v{v} activo',
      duplicate: 'v{v} se detiene: v{running} ya se está ejecutando en esta página. Desactiva o desinstala la copia duplicada.',
      autocomplete: 'Autocompletado conectado',
      loadingFor: 'Cargando emotes de /{slug}…',
      ready: 'Listo – emotes de /{slug}: {n}',
      retrying: 'Proveedores con error: {n}, reintentando en {s} s…',
      retryLoaded: 'El reintento cargó emotes: {n}',
      givingUp: 'Se abandona {providers} hasta la próxima carga de la página',
      menuSettings: 'Ajustes de emotes',
    }),
    fi: Object.freeze({
      close: 'Sulje',
      providers: 'Palveluntarjoajat',
      globals: 'Yleiset emotet',
      animated: 'Animoidut emotet',
      size: 'Emotejen koko chatissa',
      options: 'Asetukset',
      recent: 'Viimeksi käytetyt',
      providersNote: 'Piilotetun palveluntarjoajan kaikki emotet katoavat, myös chatista.',
      globalsNote: 'Jokaisen palveluntarjoajan emotet kaikilla kanavilla. Poista ne käytöstä, niin jäljelle jää vain striimaajan oma setti.',
      reducedNote: 'Järjestelmän Vähennä liikettä on päällä, joten emotet pysyvät paikallaan valinnasta riippumatta.',
      bttvNote: 'BTTV ei tarjoa pysäytyskuvia, joten sen animoidut emotet liikkuvat aina.',
      always: 'Aina',
      hover: 'Osoitettaessa',
      never: 'Ei koskaan',
      small: 'Pieni',
      medium: 'Keskikoko',
      large: 'Suuri',
      suggest: 'Ehdota emoteja kirjoittaessa',
      preview: 'Suuri esikatselu osoitettaessa',
      clear: 'Tyhjennä viimeksi käytetyt',
      confirmClear: 'Vahvista tyhjennys',
      cancel: 'Peruuta',
      usedNote: 'Muistettuja emoteja: {n}. Valitsimen Viimeksi käytetyt -osioon ja automaattitäydennyksen järjestykseen. Suosikit säilyvät.',
      usedNone: 'Mitään ei ole vielä muistettu. Lisäämäsi emotet näkyvät valitsimen Viimeksi käytetyissä.',
      favourites: 'Suosikit',
      insert: 'Lisää {code}',
      loadMore: 'Lataa lisää',
      loadMoreLabel: 'Lataa lisää emoteja',
      showLess: 'Näytä vähemmän',
      showLessLabel: 'Näytä vähemmän emoteja',
      showing: '{shown}/{total}',
      loading: 'Ladataan…',
      chipTip: 'Näytä tai piilota {provider}-emotet',
      tabTip: '7TV / BTTV / FFZ -emotet',
      emptySearch: 'Ei osuvia emoteja',
      emptyHidden: 'Kaikki palveluntarjoajat on piilotettu — ota yksi käyttöön yllä',
      emptyLoading: 'Emoteja ladataan…',
      emptyGlobalsOff: 'Kanavalla ei ole emoteja, ja yleiset emotet ovat pois päältä — ota ne käyttöön asetuksista',
      emptyChannel: 'Tällä kanavalla ei ole emoteja',
      favAdd: 'Lisää suosikkeihin',
      favRemove: 'Poista suosikeista',
      copyName: 'Kopioi nimi',
      copyUrl: 'Kopioi kuvan URL',
      openOn: 'Avaa palvelussa {provider}',
      acHeader: 'Emotet',
      acHint: '↑↓ liiku  ·  Tab/Enter valitse  ·  Esc sulje',
      active: 'v{v} käytössä',
      duplicate: 'v{v} väistyy: v{running} on jo käynnissä tällä sivulla. Poista kaksoiskappale käytöstä tai asennuksesta.',
      autocomplete: 'Automaattitäydennys liitetty',
      loadingFor: 'Ladataan emoteja kanavalle /{slug}…',
      ready: 'Valmis – emoteja kanavalle /{slug}: {n}',
      retrying: 'Epäonnistuneita palveluntarjoajia: {n}, uusi yritys {s} s kuluttua…',
      retryLoaded: 'Uusi yritys latasi emoteja: {n}',
      givingUp: 'Luovutetaan {providers} seuraavaan sivun lataukseen asti',
      menuSettings: 'Emote-asetukset',
    }),
    fr: Object.freeze({
      close: 'Fermer',
      providers: 'Fournisseurs',
      globals: 'Emotes globales',
      animated: 'Emotes animées',
      size: 'Taille des emotes dans le chat',
      options: 'Options',
      recent: 'Utilisées récemment',
      providersNote: 'Masquer un fournisseur retire toutes ses emotes, du chat aussi.',
      globalsNote: 'Les emotes de chaque fournisseur pour toutes les chaînes. Désactivez-les pour ne garder que celles du streamer.',
      reducedNote: 'Le réglage Réduire les animations de votre système est activé : les emotes restent fixes, quel que soit votre choix.',
      bttvNote: 'BTTV ne fournit pas d’images fixes, ses emotes animées bougent donc toujours.',
      always: 'Toujours',
      hover: 'Au survol',
      never: 'Jamais',
      small: 'Petite',
      medium: 'Moyenne',
      large: 'Grande',
      suggest: 'Suggérer des emotes pendant la saisie',
      preview: 'Grand aperçu au survol',
      clear: 'Effacer les utilisées récemment',
      confirmClear: 'Confirmer l’effacement',
      cancel: 'Annuler',
      usedNote: 'Emotes mémorisées : {n}. Pour la section Utilisées récemment du sélecteur et l’ordre de l’autocomplétion. Les favoris sont conservés.',
      usedNone: 'Rien de mémorisé pour l’instant. Les emotes que vous insérez apparaissent dans Utilisées récemment.',
      favourites: 'Favoris',
      insert: 'Insérer {code}',
      loadMore: 'Plus',
      loadMoreLabel: 'Charger plus d’emotes',
      showLess: 'Moins',
      showLessLabel: 'Afficher moins d’emotes',
      showing: '{shown} sur {total}',
      loading: 'Chargement…',
      chipTip: 'Afficher ou masquer les emotes {provider}',
      tabTip: 'Emotes 7TV / BTTV / FFZ',
      emptySearch: 'Aucune emote correspondante',
      emptyHidden: 'Tous les fournisseurs sont masqués : réactivez-en un ci-dessus',
      emptyLoading: 'Chargement des emotes…',
      emptyGlobalsOff: 'Aucune emote de chaîne ici et les emotes globales sont désactivées : réactivez-les dans les réglages',
      emptyChannel: 'Aucune emote pour cette chaîne',
      favAdd: 'Ajouter aux favoris',
      favRemove: 'Retirer des favoris',
      copyName: 'Copier le nom',
      copyUrl: 'Copier l’URL de l’image',
      openOn: 'Ouvrir sur {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ naviguer  ·  Tab/Entrée choisir  ·  Échap fermer',
      active: 'v{v} actif',
      duplicate: 'v{v} s’arrête : v{running} tourne déjà sur cette page. Désactivez ou désinstallez la copie en double.',
      autocomplete: 'Autocomplétion branchée',
      loadingFor: 'Chargement des emotes de /{slug}…',
      ready: 'Prêt – emotes de /{slug} : {n}',
      retrying: 'Fournisseurs en échec : {n}, nouvel essai dans {s} s…',
      retryLoaded: 'Le nouvel essai a chargé des emotes : {n}',
      givingUp: 'Abandon de {providers} jusqu’au prochain chargement de la page',
      menuSettings: 'Paramètres des emotes',
    }),
    hu: Object.freeze({
      close: 'Bezárás',
      providers: 'Szolgáltatók',
      globals: 'Globális emote-ok',
      animated: 'Animált emote-ok',
      size: 'Emote-méret a chatben',
      options: 'Beállítások',
      recent: 'Legutóbb használt',
      providersNote: 'Egy szolgáltató elrejtése az összes emote-ját eltünteti, a chatből is.',
      globalsNote: 'Minden szolgáltató emote-jai minden csatornán. Kapcsold ki, és csak a streamer saját készlete marad.',
      reducedNote: 'A rendszerben be van kapcsolva a Mozgás csökkentése, így az emote-ok állók maradnak, bármit is választasz.',
      bttvNote: 'A BTTV nem ad állóképet, ezért az animált emote-jai mindig mozognak.',
      always: 'Mindig',
      hover: 'Rámutatáskor',
      never: 'Soha',
      small: 'Kicsi',
      medium: 'Közepes',
      large: 'Nagy',
      suggest: 'Emote-javaslatok gépelés közben',
      preview: 'Nagy előnézet rámutatáskor',
      clear: 'Legutóbb használtak törlése',
      confirmClear: 'Törlés megerősítése',
      cancel: 'Mégse',
      usedNote: 'Megjegyzett emote-ok: {n}. A választó Legutóbb használt részéhez és az automatikus kiegészítés sorrendjéhez. A kedvencek megmaradnak.',
      usedNone: 'Még nincs megjegyzett emote. A beszúrt emote-ok a választó Legutóbb használt részében jelennek meg.',
      favourites: 'Kedvencek',
      insert: '{code} beszúrása',
      loadMore: 'Továbbiak',
      loadMoreLabel: 'További emote-ok betöltése',
      showLess: 'Kevesebb',
      showLessLabel: 'Kevesebb emote',
      showing: '{shown} / {total}',
      loading: 'Betöltés…',
      chipTip: '{provider} emote-ok megjelenítése vagy elrejtése',
      tabTip: '7TV / BTTV / FFZ emote-ok',
      emptySearch: 'Nincs egyező emote',
      emptyHidden: 'Minden szolgáltató el van rejtve — kapcsolj be egyet fent',
      emptyLoading: 'Emote-ok betöltése…',
      emptyGlobalsOff: 'Itt nincsenek csatorna-emote-ok, a globálisak pedig ki vannak kapcsolva — kapcsold be őket a beállításokban',
      emptyChannel: 'Ennek a csatornának nincsenek emote-jai',
      favAdd: 'Hozzáadás a kedvencekhez',
      favRemove: 'Eltávolítás a kedvencekből',
      copyName: 'Név másolása',
      copyUrl: 'Kép URL-jének másolása',
      openOn: 'Megnyitás: {provider}',
      acHeader: 'Emote-ok',
      acHint: '↑↓ mozgás  ·  Tab/Enter kiválasztás  ·  Esc bezárás',
      active: 'v{v} aktív',
      duplicate: 'A v{v} leáll: a v{running} már fut ezen az oldalon. Kapcsold ki vagy távolítsd el a dupla példányt.',
      autocomplete: 'Automatikus kiegészítés csatolva',
      loadingFor: 'Emote-ok betöltése: /{slug}…',
      ready: 'Kész – /{slug} emote-jai: {n}',
      retrying: 'Sikertelen szolgáltatók: {n}, újra {s} mp múlva…',
      retryLoaded: 'Újrapróbálással betöltött emote-ok: {n}',
      givingUp: '{providers} feladva a következő oldalbetöltésig',
      menuSettings: 'Emote-beállítások',
    }),
    id: Object.freeze({
      close: 'Tutup',
      providers: 'Penyedia',
      globals: 'Emote global',
      animated: 'Emote animasi',
      size: 'Ukuran emote di chat',
      options: 'Opsi',
      recent: 'Baru dipakai',
      providersNote: 'Menyembunyikan penyedia menghapus semua emote-nya, dari chat juga.',
      globalsNote: 'Emote tiap penyedia untuk semua channel. Matikan agar hanya set milik streamer yang tersisa.',
      reducedNote: 'Pengaturan Kurangi gerakan di sistemmu aktif, jadi emote tetap diam apa pun pilihanmu.',
      bttvNote: 'BTTV tidak menyediakan bingkai diam, jadi emote animasinya selalu bergerak.',
      always: 'Selalu',
      hover: 'Saat diarahkan',
      never: 'Tidak pernah',
      small: 'Kecil',
      medium: 'Sedang',
      large: 'Besar',
      suggest: 'Sarankan emote saat mengetik',
      preview: 'Pratinjau besar saat diarahkan',
      clear: 'Hapus yang baru dipakai',
      confirmClear: 'Konfirmasi hapus',
      cancel: 'Batal',
      usedNote: 'Emote yang diingat: {n}. Untuk bagian Baru dipakai di pemilih dan urutan pelengkapan otomatis. Favorit tetap disimpan.',
      usedNone: 'Belum ada yang diingat. Emote yang kamu sisipkan muncul di bagian Baru dipakai di pemilih.',
      favourites: 'Favorit',
      insert: 'Sisipkan {code}',
      loadMore: 'Muat lagi',
      loadMoreLabel: 'Muat lebih banyak emote',
      showLess: 'Lebih sedikit',
      showLessLabel: 'Tampilkan lebih sedikit emote',
      showing: '{shown} dari {total}',
      loading: 'Memuat…',
      chipTip: 'Tampilkan atau sembunyikan emote {provider}',
      tabTip: 'Emote 7TV / BTTV / FFZ',
      emptySearch: 'Tidak ada emote yang cocok',
      emptyHidden: 'Semua penyedia disembunyikan — aktifkan lagi salah satu di atas',
      emptyLoading: 'Memuat emote…',
      emptyGlobalsOff: 'Channel ini tidak punya emote dan emote global mati — aktifkan lagi di pengaturan',
      emptyChannel: 'Tidak ada emote untuk channel ini',
      favAdd: 'Tambah ke favorit',
      favRemove: 'Hapus dari favorit',
      copyName: 'Salin nama',
      copyUrl: 'Salin URL gambar',
      openOn: 'Buka di {provider}',
      acHeader: 'Emote',
      acHint: '↑↓ pindah  ·  Tab/Enter pilih  ·  Esc tutup',
      active: 'v{v} aktif',
      duplicate: 'v{v} berhenti: v{running} sudah berjalan di halaman ini. Nonaktifkan atau hapus salinan gandanya.',
      autocomplete: 'Pelengkapan otomatis terpasang',
      loadingFor: 'Memuat emote untuk /{slug}…',
      ready: 'Siap – {n} emote untuk /{slug}',
      retrying: '{n} penyedia gagal, mencoba lagi dalam {s} dtk…',
      retryLoaded: 'Percobaan ulang memuat {n} emote',
      givingUp: 'Menyerah pada {providers} sampai halaman dimuat ulang',
      menuSettings: 'Pengaturan emote',
    }),
    it: Object.freeze({
      close: 'Chiudi',
      providers: 'Fornitori',
      globals: 'Emote globali',
      animated: 'Emote animate',
      size: 'Dimensione delle emote in chat',
      options: 'Opzioni',
      recent: 'Usate di recente',
      providersNote: 'Nascondere un fornitore rimuove tutte le sue emote, anche dalla chat.',
      globalsNote: 'Le emote di ogni fornitore per tutti i canali. Disattivale per tenere solo il set dello streamer.',
      reducedNote: 'L’impostazione Riduci movimento del sistema è attiva, quindi le emote restano ferme qualunque cosa scegli.',
      bttvNote: 'BTTV non fornisce fotogrammi fissi, quindi le sue emote animate si muovono sempre.',
      always: 'Sempre',
      hover: 'Al passaggio',
      never: 'Mai',
      small: 'Piccola',
      medium: 'Media',
      large: 'Grande',
      suggest: 'Suggerisci emote mentre scrivi',
      preview: 'Anteprima grande al passaggio',
      clear: 'Cancella usate di recente',
      confirmClear: 'Conferma cancellazione',
      cancel: 'Annulla',
      usedNote: 'Emote memorizzate: {n}. Per la sezione Usate di recente del selettore e l’ordine del completamento automatico. I preferiti restano.',
      usedNone: 'Ancora niente. Le emote che inserisci compaiono in Usate di recente nel selettore.',
      favourites: 'Preferiti',
      insert: 'Inserisci {code}',
      loadMore: 'Carica altre',
      loadMoreLabel: 'Carica altre emote',
      showLess: 'Mostra meno',
      showLessLabel: 'Mostra meno emote',
      showing: '{shown} di {total}',
      loading: 'Caricamento…',
      chipTip: 'Mostra o nascondi le emote di {provider}',
      tabTip: 'Emote di 7TV / BTTV / FFZ',
      emptySearch: 'Nessuna emote corrispondente',
      emptyHidden: 'Tutti i fornitori sono nascosti: riattivane uno qui sopra',
      emptyLoading: 'Caricamento emote…',
      emptyGlobalsOff: 'Nessuna emote del canale e le emote globali sono disattivate: riattivale nelle impostazioni',
      emptyChannel: 'Nessuna emote per questo canale',
      favAdd: 'Aggiungi ai preferiti',
      favRemove: 'Rimuovi dai preferiti',
      copyName: 'Copia nome',
      copyUrl: 'Copia URL immagine',
      openOn: 'Apri su {provider}',
      acHeader: 'Emote',
      acHint: '↑↓ sposta  ·  Tab/Invio scegli  ·  Esc chiudi',
      active: 'v{v} attivo',
      duplicate: 'v{v} si ferma: v{running} è già in esecuzione su questa pagina. Disattiva o disinstalla la copia doppia.',
      autocomplete: 'Completamento automatico collegato',
      loadingFor: 'Caricamento emote per /{slug}…',
      ready: 'Pronto – emote per /{slug}: {n}',
      retrying: 'Fornitori non riusciti: {n}, nuovo tentativo tra {s} s…',
      retryLoaded: 'Il nuovo tentativo ha caricato emote: {n}',
      givingUp: 'Rinuncio a {providers} fino al prossimo caricamento della pagina',
      menuSettings: 'Impostazioni emote',
    }),
    ja: Object.freeze({
      close: '閉じる',
      providers: 'プロバイダー',
      globals: 'グローバルエモート',
      animated: 'アニメーションエモート',
      size: 'チャットでのエモートサイズ',
      options: 'オプション',
      recent: '最近使用',
      providersNote: 'プロバイダーを非表示にすると、そのエモートはチャットからも消えます。',
      globalsNote: '各プロバイダーの全チャンネル共通エモート。オフにすると配信者自身のセットだけが残ります。',
      reducedNote: 'システムの「視差効果を減らす」がオンなので、どれを選んでもエモートは静止したままです。',
      bttvNote: 'BTTVは静止画を提供しないため、アニメーションエモートは常に動きます。',
      always: '常に',
      hover: 'ホバー時',
      never: 'しない',
      small: '小',
      medium: '中',
      large: '大',
      suggest: '入力中にエモートを候補表示',
      preview: 'ホバーで大きくプレビュー',
      clear: '最近使用をクリア',
      confirmClear: 'クリアを確定',
      cancel: 'キャンセル',
      usedNote: '記憶しているエモート: {n}。ピッカーの「最近使用」と入力補完の並び順に使います。お気に入りは残ります。',
      usedNone: 'まだ記憶はありません。挿入したエモートはピッカーの「最近使用」に表示されます。',
      favourites: 'お気に入り',
      insert: '{code} を挿入',
      loadMore: 'さらに読み込む',
      loadMoreLabel: 'エモートをさらに読み込む',
      showLess: '表示を減らす',
      showLessLabel: '表示するエモートを減らす',
      showing: '{total}件中{shown}件',
      loading: '読み込み中…',
      chipTip: '{provider} のエモートを表示/非表示',
      tabTip: '7TV / BTTV / FFZ のエモート',
      emptySearch: '一致するエモートはありません',
      emptyHidden: 'すべてのプロバイダーが非表示です — 上でどれかをオンにしてください',
      emptyLoading: 'エモートを読み込み中…',
      emptyGlobalsOff: 'チャンネルのエモートがなく、グローバルエモートもオフです — 設定でオンにしてください',
      emptyChannel: 'このチャンネルのエモートはありません',
      favAdd: 'お気に入りに追加',
      favRemove: 'お気に入りから削除',
      copyName: '名前をコピー',
      copyUrl: '画像URLをコピー',
      openOn: '{provider} で開く',
      acHeader: 'エモート',
      acHint: '↑↓ 移動  ·  Tab/Enter 選択  ·  Esc 閉じる',
      active: 'v{v} 動作中',
      duplicate: 'v{v} は停止します: このページではすでに v{running} が動作しています。重複したコピーを無効にするか削除してください。',
      autocomplete: '入力補完を接続しました',
      loadingFor: '/{slug} のエモートを読み込み中…',
      ready: '準備完了 – /{slug} のエモート {n} 個',
      retrying: '{n} 件のプロバイダーが失敗、{s} 秒後に再試行…',
      retryLoaded: '再試行で {n} 個のエモートを読み込みました',
      givingUp: '{providers} は次のページ読み込みまで諦めます',
      menuSettings: 'エモート設定',
    }),
    ko: Object.freeze({
      close: '닫기',
      providers: '제공자',
      globals: '전역 이모트',
      animated: '움직이는 이모트',
      size: '채팅 이모트 크기',
      options: '옵션',
      recent: '최근 사용',
      providersNote: '제공자를 숨기면 해당 이모트가 채팅에서도 모두 사라집니다.',
      globalsNote: '모든 채널에서 쓰는 각 제공자의 이모트입니다. 끄면 스트리머 자신의 세트만 남습니다.',
      reducedNote: '시스템의 동작 줄이기 설정이 켜져 있어 무엇을 고르든 이모트가 멈춰 있습니다.',
      bttvNote: 'BTTV는 정지 프레임을 제공하지 않아 움직이는 이모트가 항상 움직입니다.',
      always: '항상',
      hover: '마우스를 올릴 때',
      never: '안 함',
      small: '작게',
      medium: '보통',
      large: '크게',
      suggest: '입력할 때 이모트 추천',
      preview: '마우스를 올리면 크게 미리 보기',
      clear: '최근 사용 지우기',
      confirmClear: '지우기 확인',
      cancel: '취소',
      usedNote: '기억된 이모트: {n}개. 선택기의 최근 사용 섹션과 자동 완성 순서에 쓰입니다. 즐겨찾기는 유지됩니다.',
      usedNone: '아직 기억된 것이 없습니다. 넣은 이모트는 선택기의 최근 사용에 표시됩니다.',
      favourites: '즐겨찾기',
      insert: '{code} 넣기',
      loadMore: '더 보기',
      loadMoreLabel: '이모트 더 불러오기',
      showLess: '접기',
      showLessLabel: '이모트 적게 보기',
      showing: '{total}개 중 {shown}개',
      loading: '불러오는 중…',
      chipTip: '{provider} 이모트 표시/숨기기',
      tabTip: '7TV / BTTV / FFZ 이모트',
      emptySearch: '일치하는 이모트가 없습니다',
      emptyHidden: '모든 제공자가 숨겨져 있습니다 — 위에서 하나를 켜세요',
      emptyLoading: '이모트를 불러오는 중…',
      emptyGlobalsOff: '채널 이모트가 없고 전역 이모트가 꺼져 있습니다 — 설정에서 다시 켜세요',
      emptyChannel: '이 채널의 이모트가 없습니다',
      favAdd: '즐겨찾기에 추가',
      favRemove: '즐겨찾기에서 제거',
      copyName: '이름 복사',
      copyUrl: '이미지 URL 복사',
      openOn: '{provider}에서 열기',
      acHeader: '이모트',
      acHint: '↑↓ 이동  ·  Tab/Enter 선택  ·  Esc 닫기',
      active: 'v{v} 실행 중',
      duplicate: 'v{v} 중지: 이 페이지에서 이미 v{running}이(가) 실행 중입니다. 중복된 사본을 끄거나 제거하세요.',
      autocomplete: '자동 완성 연결됨',
      loadingFor: '/{slug} 이모트 불러오는 중…',
      ready: '준비 완료 – /{slug} 이모트 {n}개',
      retrying: '제공자 {n}개 실패, {s}초 후 재시도…',
      retryLoaded: '재시도로 이모트 {n}개를 불러옴',
      givingUp: '다음 페이지 로드까지 {providers} 포기',
      menuSettings: '이모트 설정',
    }),
    nl: Object.freeze({
      close: 'Sluiten',
      providers: 'Aanbieders',
      globals: 'Globale emotes',
      animated: 'Geanimeerde emotes',
      size: 'Emotegrootte in de chat',
      options: 'Opties',
      recent: 'Recent gebruikt',
      providersNote: 'Een verborgen aanbieder verliest al zijn emotes, ook in de chat.',
      globalsNote: 'De emotes van elke aanbieder voor alle kanalen. Zet ze uit om alleen de eigen set van de streamer te houden.',
      reducedNote: 'De systeeminstelling Verminder beweging staat aan, dus emotes blijven stil wat je ook kiest.',
      bttvNote: 'BTTV levert geen stilstaande beelden, dus de geanimeerde emotes bewegen altijd.',
      always: 'Altijd',
      hover: 'Bij aanwijzen',
      never: 'Nooit',
      small: 'Klein',
      medium: 'Middel',
      large: 'Groot',
      suggest: 'Emotes voorstellen tijdens typen',
      preview: 'Grote voorvertoning bij aanwijzen',
      clear: 'Recent gebruikt wissen',
      confirmClear: 'Wissen bevestigen',
      cancel: 'Annuleren',
      usedNote: 'Onthouden emotes: {n}. Voor Recent gebruikt in de kiezer en de volgorde van automatisch aanvullen. Favorieten blijven.',
      usedNone: 'Nog niets onthouden. Emotes die je invoegt, verschijnen bij Recent gebruikt in de kiezer.',
      favourites: 'Favorieten',
      insert: '{code} invoegen',
      loadMore: 'Meer laden',
      loadMoreLabel: 'Meer emotes laden',
      showLess: 'Minder',
      showLessLabel: 'Minder emotes tonen',
      showing: '{shown} van {total}',
      loading: 'Laden…',
      chipTip: 'Emotes van {provider} tonen of verbergen',
      tabTip: 'Emotes van 7TV / BTTV / FFZ',
      emptySearch: 'Geen passende emotes',
      emptyHidden: 'Alle aanbieders zijn verborgen — zet er hierboven een aan',
      emptyLoading: 'Emotes laden…',
      emptyGlobalsOff: 'Geen kanaalemotes hier, en globale emotes staan uit — zet ze weer aan in de instellingen',
      emptyChannel: 'Geen emotes voor dit kanaal',
      favAdd: 'Toevoegen aan favorieten',
      favRemove: 'Verwijderen uit favorieten',
      copyName: 'Naam kopiëren',
      copyUrl: 'Afbeeldings-URL kopiëren',
      openOn: 'Openen op {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ navigeren  ·  Tab/Enter kiezen  ·  Esc sluiten',
      active: 'v{v} actief',
      duplicate: 'v{v} stopt: v{running} draait al op deze pagina. Schakel de dubbele kopie uit of verwijder hem.',
      autocomplete: 'Automatisch aanvullen gekoppeld',
      loadingFor: 'Emotes laden voor /{slug}…',
      ready: 'Klaar – emotes voor /{slug}: {n}',
      retrying: 'Mislukte aanbieders: {n}, nieuwe poging over {s} s…',
      retryLoaded: 'Nieuwe poging laadde emotes: {n}',
      givingUp: 'Opgegeven voor {providers} tot de volgende paginalading',
      menuSettings: 'Emote-instellingen',
    }),
    no: Object.freeze({
      close: 'Lukk',
      providers: 'Leverandører',
      globals: 'Globale emotes',
      animated: 'Animerte emotes',
      size: 'Emote-størrelse i chatten',
      options: 'Alternativer',
      recent: 'Nylig brukt',
      providersNote: 'Skjuler du en leverandør, forsvinner alle emotene dens, også fra chatten.',
      globalsNote: 'Hver leverandørs emotes for alle kanaler. Slå dem av for å beholde bare streamerens eget sett.',
      reducedNote: 'Systemets Reduser bevegelse er på, så emotes står stille uansett hva du velger.',
      bttvNote: 'BTTV har ingen stillbilder, så de animerte emotene beveger seg alltid.',
      always: 'Alltid',
      hover: 'Ved peking',
      never: 'Aldri',
      small: 'Liten',
      medium: 'Middels',
      large: 'Stor',
      suggest: 'Foreslå emotes mens du skriver',
      preview: 'Stor forhåndsvisning ved peking',
      clear: 'Tøm nylig brukt',
      confirmClear: 'Bekreft tømming',
      cancel: 'Avbryt',
      usedNote: 'Husket emotes: {n}. Brukes til Nylig brukt i velgeren og rekkefølgen i autofullføring. Favoritter beholdes.',
      usedNone: 'Ingenting husket ennå. Emotes du setter inn, vises under Nylig brukt i velgeren.',
      favourites: 'Favoritter',
      insert: 'Sett inn {code}',
      loadMore: 'Last inn flere',
      loadMoreLabel: 'Last inn flere emotes',
      showLess: 'Vis færre',
      showLessLabel: 'Vis færre emotes',
      showing: 'Viser {shown} av {total}',
      loading: 'Laster…',
      chipTip: 'Vis eller skjul emotes fra {provider}',
      tabTip: 'Emotes fra 7TV / BTTV / FFZ',
      emptySearch: 'Ingen samsvarende emotes',
      emptyHidden: 'Alle leverandører er skjult — slå på en ovenfor',
      emptyLoading: 'Laster emotes…',
      emptyGlobalsOff: 'Ingen kanal-emotes her, og globale emotes er av — slå dem på igjen i innstillingene',
      emptyChannel: 'Ingen emotes for denne kanalen',
      favAdd: 'Legg til i favoritter',
      favRemove: 'Fjern fra favoritter',
      copyName: 'Kopier navn',
      copyUrl: 'Kopier bilde-URL',
      openOn: 'Åpne på {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ naviger  ·  Tab/Enter velg  ·  Esc lukk',
      active: 'v{v} aktiv',
      duplicate: 'v{v} trekker seg: v{running} kjører allerede på siden. Slå av eller avinstaller den doble kopien.',
      autocomplete: 'Autofullføring koblet til',
      loadingFor: 'Laster emotes for /{slug}…',
      ready: 'Klar – emotes for /{slug}: {n}',
      retrying: 'Leverandører som feilet: {n}, prøver igjen om {s} s…',
      retryLoaded: 'Nytt forsøk lastet emotes: {n}',
      givingUp: 'Gir opp {providers} til neste sideinnlasting',
      menuSettings: 'Emote-innstillinger',
    }),
    pl: Object.freeze({
      close: 'Zamknij',
      providers: 'Dostawcy',
      globals: 'Emotki globalne',
      animated: 'Emotki animowane',
      size: 'Rozmiar emotek na czacie',
      options: 'Opcje',
      recent: 'Ostatnio używane',
      providersNote: 'Ukrycie dostawcy usuwa wszystkie jego emotki, także z czatu.',
      globalsNote: 'Emotki każdego dostawcy na wszystkich kanałach. Wyłącz je, by zostawić tylko zestaw streamera.',
      reducedNote: 'Systemowe Ogranicz ruch jest włączone, więc emotki pozostają nieruchome bez względu na wybór.',
      bttvNote: 'BTTV nie udostępnia nieruchomych klatek, więc jego animowane emotki zawsze się ruszają.',
      always: 'Zawsze',
      hover: 'Po najechaniu',
      never: 'Nigdy',
      small: 'Małe',
      medium: 'Średnie',
      large: 'Duże',
      suggest: 'Podpowiadaj emotki podczas pisania',
      preview: 'Duży podgląd po najechaniu',
      clear: 'Wyczyść ostatnio używane',
      confirmClear: 'Potwierdź czyszczenie',
      cancel: 'Anuluj',
      usedNote: 'Zapamiętane emotki: {n}. Do sekcji Ostatnio używane w wyborze i kolejności podpowiedzi. Ulubione zostają.',
      usedNone: 'Nic jeszcze nie zapamiętano. Wstawione emotki pojawią się w Ostatnio używanych w wyborze.',
      favourites: 'Ulubione',
      insert: 'Wstaw {code}',
      loadMore: 'Wczytaj więcej',
      loadMoreLabel: 'Wczytaj więcej emotek',
      showLess: 'Pokaż mniej',
      showLessLabel: 'Pokaż mniej emotek',
      showing: '{shown} z {total}',
      loading: 'Wczytywanie…',
      chipTip: 'Pokaż lub ukryj emotki {provider}',
      tabTip: 'Emotki 7TV / BTTV / FFZ',
      emptySearch: 'Brak pasujących emotek',
      emptyHidden: 'Wszyscy dostawcy są ukryci — włącz któregoś powyżej',
      emptyLoading: 'Wczytywanie emotek…',
      emptyGlobalsOff: 'Brak emotek kanału, a globalne są wyłączone — włącz je w ustawieniach',
      emptyChannel: 'Ten kanał nie ma emotek',
      favAdd: 'Dodaj do ulubionych',
      favRemove: 'Usuń z ulubionych',
      copyName: 'Kopiuj nazwę',
      copyUrl: 'Kopiuj URL obrazu',
      openOn: 'Otwórz w {provider}',
      acHeader: 'Emotki',
      acHint: '↑↓ nawigacja  ·  Tab/Enter wybór  ·  Esc zamknij',
      active: 'v{v} działa',
      duplicate: 'v{v} wyłącza się: na tej stronie działa już v{running}. Wyłącz lub odinstaluj zduplikowaną kopię.',
      autocomplete: 'Podpowiedzi podłączone',
      loadingFor: 'Wczytywanie emotek dla /{slug}…',
      ready: 'Gotowe – emotki dla /{slug}: {n}',
      retrying: 'Nieudani dostawcy: {n}, ponowna próba za {s} s…',
      retryLoaded: 'Ponowna próba wczytała emotki: {n}',
      givingUp: 'Rezygnacja z {providers} do następnego wczytania strony',
      menuSettings: 'Ustawienia emotek',
    }),
    pt: Object.freeze({
      close: 'Fechar',
      providers: 'Provedores',
      globals: 'Emotes globais',
      animated: 'Emotes animados',
      size: 'Tamanho dos emotes no chat',
      options: 'Opções',
      recent: 'Usados recentemente',
      providersNote: 'Ocultar um provedor remove todos os emotes dele, do chat também.',
      globalsNote: 'Os emotes de cada provedor para todos os canais. Desative para manter só o conjunto do streamer.',
      reducedNote: 'A opção Reduzir movimento do sistema está ativa, então os emotes ficam parados seja qual for a escolha.',
      bttvNote: 'O BTTV não oferece quadros estáticos, então os emotes animados dele sempre se mexem.',
      always: 'Sempre',
      hover: 'Ao passar',
      never: 'Nunca',
      small: 'Pequeno',
      medium: 'Médio',
      large: 'Grande',
      suggest: 'Sugerir emotes ao digitar',
      preview: 'Prévia grande ao passar o mouse',
      clear: 'Limpar usados recentemente',
      confirmClear: 'Confirmar limpeza',
      cancel: 'Cancelar',
      usedNote: 'Emotes lembrados: {n}. Para Usados recentemente no seletor e a ordem do preenchimento automático. Os favoritos ficam.',
      usedNone: 'Nada lembrado ainda. Os emotes que você inserir aparecem em Usados recentemente no seletor.',
      favourites: 'Favoritos',
      insert: 'Inserir {code}',
      loadMore: 'Carregar mais',
      loadMoreLabel: 'Carregar mais emotes',
      showLess: 'Ver menos',
      showLessLabel: 'Ver menos emotes',
      showing: '{shown} de {total}',
      loading: 'Carregando…',
      chipTip: 'Mostrar ou ocultar emotes do {provider}',
      tabTip: 'Emotes do 7TV / BTTV / FFZ',
      emptySearch: 'Nenhum emote corresponde',
      emptyHidden: 'Todos os provedores estão ocultos — ative um acima',
      emptyLoading: 'Carregando emotes…',
      emptyGlobalsOff: 'Sem emotes do canal aqui, e os globais estão desativados — ative-os nas configurações',
      emptyChannel: 'Nenhum emote neste canal',
      favAdd: 'Adicionar aos favoritos',
      favRemove: 'Remover dos favoritos',
      copyName: 'Copiar nome',
      copyUrl: 'Copiar URL da imagem',
      openOn: 'Abrir no {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ navegar  ·  Tab/Enter escolher  ·  Esc fechar',
      active: 'v{v} ativo',
      duplicate: 'v{v} vai parar: v{running} já está rodando nesta página. Desative ou desinstale a cópia duplicada.',
      autocomplete: 'Preenchimento automático conectado',
      loadingFor: 'Carregando emotes de /{slug}…',
      ready: 'Pronto – emotes de /{slug}: {n}',
      retrying: 'Provedores com falha: {n}, tentando de novo em {s} s…',
      retryLoaded: 'A nova tentativa carregou emotes: {n}',
      givingUp: 'Desistindo de {providers} até o próximo carregamento da página',
      menuSettings: 'Configurações de emotes',
    }),
    ro: Object.freeze({
      close: 'Închide',
      providers: 'Furnizori',
      globals: 'Emote-uri globale',
      animated: 'Emote-uri animate',
      size: 'Mărimea emote-urilor în chat',
      options: 'Opțiuni',
      recent: 'Folosite recent',
      providersNote: 'Ascunderea unui furnizor elimină toate emote-urile lui, și din chat.',
      globalsNote: 'Emote-urile fiecărui furnizor pentru toate canalele. Dezactivează-le ca să rămână doar setul streamerului.',
      reducedNote: 'Setarea Reducere mișcare a sistemului este activă, deci emote-urile rămân statice orice ai alege.',
      bttvNote: 'BTTV nu oferă cadre statice, așa că emote-urile lui animate se mișcă mereu.',
      always: 'Mereu',
      hover: 'La trecere',
      never: 'Niciodată',
      small: 'Mică',
      medium: 'Medie',
      large: 'Mare',
      suggest: 'Sugerează emote-uri la scriere',
      preview: 'Previzualizare mare la trecerea mouse-ului',
      clear: 'Șterge folosite recent',
      confirmClear: 'Confirmă ștergerea',
      cancel: 'Anulează',
      usedNote: 'Emote-uri reținute: {n}. Pentru secțiunea Folosite recent și ordinea completării automate. Favoritele rămân.',
      usedNone: 'Nimic reținut încă. Emote-urile pe care le inserezi apar în Folosite recent.',
      favourites: 'Favorite',
      insert: 'Inserează {code}',
      loadMore: 'Încarcă mai multe',
      loadMoreLabel: 'Încarcă mai multe emote-uri',
      showLess: 'Mai puține',
      showLessLabel: 'Arată mai puține emote-uri',
      showing: '{shown} din {total}',
      loading: 'Se încarcă…',
      chipTip: 'Arată sau ascunde emote-urile {provider}',
      tabTip: 'Emote-uri 7TV / BTTV / FFZ',
      emptySearch: 'Niciun emote potrivit',
      emptyHidden: 'Toți furnizorii sunt ascunși — activează unul mai sus',
      emptyLoading: 'Se încarcă emote-urile…',
      emptyGlobalsOff: 'Niciun emote al canalului aici, iar cele globale sunt oprite — activează-le din setări',
      emptyChannel: 'Niciun emote pentru acest canal',
      favAdd: 'Adaugă la favorite',
      favRemove: 'Elimină din favorite',
      copyName: 'Copiază numele',
      copyUrl: 'Copiază URL-ul imaginii',
      openOn: 'Deschide pe {provider}',
      acHeader: 'Emote-uri',
      acHint: '↑↓ navigare  ·  Tab/Enter alege  ·  Esc închide',
      active: 'v{v} activ',
      duplicate: 'v{v} se oprește: v{running} rulează deja pe această pagină. Dezactivează sau dezinstalează copia dublă.',
      autocomplete: 'Completarea automată conectată',
      loadingFor: 'Se încarcă emote-urile pentru /{slug}…',
      ready: 'Gata – emote-uri pentru /{slug}: {n}',
      retrying: 'Furnizori eșuați: {n}, reîncercare în {s} s…',
      retryLoaded: 'Reîncercarea a încărcat emote-uri: {n}',
      givingUp: 'Renunț la {providers} până la următoarea încărcare a paginii',
      menuSettings: 'Setări emote-uri',
    }),
    ru: Object.freeze({
      close: 'Закрыть',
      providers: 'Источники',
      globals: 'Глобальные эмоуты',
      animated: 'Анимированные эмоуты',
      size: 'Размер эмоутов в чате',
      options: 'Настройки',
      recent: 'Недавние',
      providersNote: 'Если скрыть источник, исчезнут все его эмоуты, и в чате тоже.',
      globalsNote: 'Эмоуты каждого источника для всех каналов. Выключите, чтобы остался только набор стримера.',
      reducedNote: 'В системе включено «Уменьшение движения», поэтому эмоуты не двигаются, что бы вы ни выбрали.',
      bttvNote: 'BTTV не отдаёт статичные кадры, поэтому его анимированные эмоуты всегда движутся.',
      always: 'Всегда',
      hover: 'Под курсором',
      never: 'Никогда',
      small: 'Маленький',
      medium: 'Средний',
      large: 'Большой',
      suggest: 'Подсказывать эмоуты при вводе',
      preview: 'Крупный просмотр при наведении',
      clear: 'Очистить недавние',
      confirmClear: 'Подтвердить очистку',
      cancel: 'Отмена',
      usedNote: 'Запомнено эмоутов: {n}. Для раздела «Недавние» и порядка подсказок. Избранное сохраняется.',
      usedNone: 'Пока ничего не запомнено. Вставленные эмоуты появятся в разделе «Недавние».',
      favourites: 'Избранное',
      insert: 'Вставить {code}',
      loadMore: 'Загрузить ещё',
      loadMoreLabel: 'Загрузить ещё эмоуты',
      showLess: 'Свернуть',
      showLessLabel: 'Показать меньше эмоутов',
      showing: '{shown} из {total}',
      loading: 'Загрузка…',
      chipTip: 'Показать или скрыть эмоуты {provider}',
      tabTip: 'Эмоуты 7TV / BTTV / FFZ',
      emptySearch: 'Нет подходящих эмоутов',
      emptyHidden: 'Все источники скрыты — включите один выше',
      emptyLoading: 'Эмоуты загружаются…',
      emptyGlobalsOff: 'Здесь нет эмоутов канала, а глобальные выключены — включите их в настройках',
      emptyChannel: 'У этого канала нет эмоутов',
      favAdd: 'Добавить в избранное',
      favRemove: 'Убрать из избранного',
      copyName: 'Копировать название',
      copyUrl: 'Копировать URL изображения',
      openOn: 'Открыть на {provider}',
      acHeader: 'Эмоуты',
      acHint: '↑↓ выбор  ·  Tab/Enter вставить  ·  Esc закрыть',
      active: 'v{v} работает',
      duplicate: 'v{v} отключается: на этой странице уже работает v{running}. Отключите или удалите дублирующую копию.',
      autocomplete: 'Подсказки подключены',
      loadingFor: 'Загрузка эмоутов для /{slug}…',
      ready: 'Готово – эмоутов для /{slug}: {n}',
      retrying: 'Не ответило источников: {n}, повтор через {s} с…',
      retryLoaded: 'Повтор загрузил эмоутов: {n}',
      givingUp: 'Отказ от {providers} до следующей загрузки страницы',
      menuSettings: 'Настройки эмоутов',
    }),
    sk: Object.freeze({
      close: 'Zavrieť',
      providers: 'Poskytovatelia',
      globals: 'Globálne emoty',
      animated: 'Animované emoty',
      size: 'Veľkosť emotov v chate',
      options: 'Možnosti',
      recent: 'Nedávno použité',
      providersNote: 'Skrytím poskytovateľa zmiznú všetky jeho emoty, aj z chatu.',
      globalsNote: 'Emoty každého poskytovateľa pre všetky kanály. Vypni ich a ostane len vlastná sada streamera.',
      reducedNote: 'V systéme je zapnuté Obmedziť pohyb, takže emoty ostanú v pokoji, nech vyberieš čokoľvek.',
      bttvNote: 'BTTV nemá statické snímky, takže jeho animované emoty sa hýbu vždy.',
      always: 'Vždy',
      hover: 'Pri prejdení',
      never: 'Nikdy',
      small: 'Malé',
      medium: 'Stredné',
      large: 'Veľké',
      suggest: 'Navrhovať emoty pri písaní',
      preview: 'Veľký náhľad pri prejdení',
      clear: 'Vymazať nedávno použité',
      confirmClear: 'Potvrdiť vymazanie',
      cancel: 'Zrušiť',
      usedNote: 'Zapamätané emoty: {n}. Slúžia pre Nedávno použité vo výbere a poradie návrhov. Obľúbené ostanú.',
      usedNone: 'Zatiaľ nič zapamätané. Emoty, ktoré vložíš, sa objavia v Nedávno použitých vo výbere.',
      favourites: 'Obľúbené',
      insert: 'Vložiť {code}',
      loadMore: 'Načítať ďalšie',
      loadMoreLabel: 'Načítať ďalšie emoty',
      showLess: 'Zobraziť menej',
      showLessLabel: 'Zobraziť menej emotov',
      showing: 'Zobrazené {shown} z {total}',
      loading: 'Načítava sa…',
      chipTip: 'Zobraziť alebo skryť emoty {provider}',
      tabTip: 'Emoty 7TV / BTTV / FFZ',
      emptySearch: 'Žiadne zodpovedajúce emoty',
      emptyHidden: 'Všetci poskytovatelia sú skrytí — zapni niektorého vyššie',
      emptyLoading: 'Emoty sa načítavajú…',
      emptyGlobalsOff: 'Kanál tu nemá žiadne emoty a globálne emoty sú vypnuté — zapni ich v nastaveniach',
      emptyChannel: 'Tento kanál nemá žiadne emoty',
      favAdd: 'Pridať do obľúbených',
      favRemove: 'Odobrať z obľúbených',
      copyName: 'Kopírovať názov',
      copyUrl: 'Kopírovať URL obrázka',
      openOn: 'Otvoriť na {provider}',
      acHeader: 'Emoty',
      acHint: '↑↓ pohyb  ·  Tab/Enter výber  ·  Esc zavrieť',
      active: 'v{v} beží',
      duplicate: 'v{v} sa vypína: na tejto stránke už beží v{running}. Vypni alebo odinštaluj duplicitnú kópiu.',
      autocomplete: 'Návrhy pripojené',
      loadingFor: 'Načítavam emoty pre /{slug}…',
      ready: 'Hotovo – emoty pre /{slug}: {n}',
      retrying: 'Zlyhaní poskytovatelia: {n}, ďalší pokus o {s} s…',
      retryLoaded: 'Ďalší pokus načítal emoty: {n}',
      givingUp: 'Vzdávam {providers} do ďalšieho načítania stránky',
      menuSettings: 'Nastavenia emotov',
    }),
    sv: Object.freeze({
      close: 'Stäng',
      providers: 'Leverantörer',
      globals: 'Globala emotes',
      animated: 'Animerade emotes',
      size: 'Emote-storlek i chatten',
      options: 'Alternativ',
      recent: 'Senast använda',
      providersNote: 'Döljer du en leverantör försvinner alla dess emotes, även från chatten.',
      globalsNote: 'Varje leverantörs emotes för alla kanaler. Stäng av dem för att bara behålla streamerns egen uppsättning.',
      reducedNote: 'Systemets Minska rörelse är på, så emotes står still vad du än väljer.',
      bttvNote: 'BTTV har inga stillbilder, så dess animerade emotes rör sig alltid.',
      always: 'Alltid',
      hover: 'Vid hovring',
      never: 'Aldrig',
      small: 'Liten',
      medium: 'Mellan',
      large: 'Stor',
      suggest: 'Föreslå emotes medan du skriver',
      preview: 'Stor förhandsvisning vid hovring',
      clear: 'Rensa senast använda',
      confirmClear: 'Bekräfta rensning',
      cancel: 'Avbryt',
      usedNote: 'Ihågkomna emotes: {n}. För väljarens Senast använda och ordningen i autoslutförandet. Favoriter behålls.',
      usedNone: 'Inget ihågkommet än. Emotes du infogar visas under Senast använda i väljaren.',
      favourites: 'Favoriter',
      insert: 'Infoga {code}',
      loadMore: 'Läs in fler',
      loadMoreLabel: 'Läs in fler emotes',
      showLess: 'Visa färre',
      showLessLabel: 'Visa färre emotes',
      showing: 'Visar {shown} av {total}',
      loading: 'Läser in…',
      chipTip: 'Visa eller dölj emotes från {provider}',
      tabTip: 'Emotes från 7TV / BTTV / FFZ',
      emptySearch: 'Inga matchande emotes',
      emptyHidden: 'Alla leverantörer är dolda — slå på en ovan',
      emptyLoading: 'Läser in emotes…',
      emptyGlobalsOff: 'Inga kanal-emotes här, och globala emotes är av — slå på dem igen i inställningarna',
      emptyChannel: 'Inga emotes för den här kanalen',
      favAdd: 'Lägg till i favoriter',
      favRemove: 'Ta bort från favoriter',
      copyName: 'Kopiera namn',
      copyUrl: 'Kopiera bild-URL',
      openOn: 'Öppna på {provider}',
      acHeader: 'Emotes',
      acHint: '↑↓ navigera  ·  Tab/Enter välj  ·  Esc stäng',
      active: 'v{v} aktiv',
      duplicate: 'v{v} kliver åt sidan: v{running} körs redan på sidan. Stäng av eller avinstallera den dubbla kopian.',
      autocomplete: 'Autoslutförande anslutet',
      loadingFor: 'Läser in emotes för /{slug}…',
      ready: 'Klart – emotes för /{slug}: {n}',
      retrying: 'Leverantörer som misslyckades: {n}, försöker igen om {s} s…',
      retryLoaded: 'Nytt försök läste in emotes: {n}',
      givingUp: 'Ger upp {providers} till nästa sidinläsning',
      menuSettings: 'Emote-inställningar',
    }),
    th: Object.freeze({
      close: 'ปิด',
      providers: 'ผู้ให้บริการ',
      globals: 'อีโมตทั่วไป',
      animated: 'อีโมตเคลื่อนไหว',
      size: 'ขนาดอีโมตในแชท',
      options: 'ตัวเลือก',
      recent: 'ใช้ล่าสุด',
      providersNote: 'การซ่อนผู้ให้บริการจะลบอีโมตทั้งหมดของผู้ให้บริการนั้น รวมถึงในแชทด้วย',
      globalsNote: 'อีโมตของผู้ให้บริการแต่ละรายสำหรับทุกช่อง ปิดไว้เพื่อเหลือเฉพาะชุดของสตรีมเมอร์',
      reducedNote: 'การตั้งค่าลดการเคลื่อนไหวของระบบเปิดอยู่ อีโมตจึงหยุดนิ่งไม่ว่าคุณจะเลือกอะไร',
      bttvNote: 'BTTV ไม่มีเฟรมภาพนิ่ง อีโมตเคลื่อนไหวของ BTTV จึงขยับเสมอ',
      always: 'เสมอ',
      hover: 'เมื่อชี้',
      never: 'ไม่เลย',
      small: 'เล็ก',
      medium: 'กลาง',
      large: 'ใหญ่',
      suggest: 'แนะนำอีโมตขณะพิมพ์',
      preview: 'ดูตัวอย่างขนาดใหญ่เมื่อชี้',
      clear: 'ล้างรายการใช้ล่าสุด',
      confirmClear: 'ยืนยันการล้าง',
      cancel: 'ยกเลิก',
      usedNote: 'อีโมตที่จำไว้: {n} ใช้สำหรับส่วนใช้ล่าสุดในตัวเลือกและลำดับการเติมอัตโนมัติ รายการโปรดยังอยู่',
      usedNone: 'ยังไม่มีอะไรจำไว้ อีโมตที่คุณแทรกจะแสดงในส่วนใช้ล่าสุดของตัวเลือก',
      favourites: 'รายการโปรด',
      insert: 'แทรก {code}',
      loadMore: 'โหลดเพิ่ม',
      loadMoreLabel: 'โหลดอีโมตเพิ่ม',
      showLess: 'แสดงน้อยลง',
      showLessLabel: 'แสดงอีโมตน้อยลง',
      showing: '{shown} จาก {total}',
      loading: 'กำลังโหลด…',
      chipTip: 'แสดงหรือซ่อนอีโมตของ {provider}',
      tabTip: 'อีโมต 7TV / BTTV / FFZ',
      emptySearch: 'ไม่มีอีโมตที่ตรงกัน',
      emptyHidden: 'ซ่อนผู้ให้บริการทั้งหมดอยู่ — เปิดสักรายด้านบน',
      emptyLoading: 'กำลังโหลดอีโมต…',
      emptyGlobalsOff: 'ช่องนี้ไม่มีอีโมต และอีโมตทั่วไปปิดอยู่ — เปิดได้ในการตั้งค่า',
      emptyChannel: 'ไม่มีอีโมตสำหรับช่องนี้',
      favAdd: 'เพิ่มในรายการโปรด',
      favRemove: 'นำออกจากรายการโปรด',
      copyName: 'คัดลอกชื่อ',
      copyUrl: 'คัดลอก URL รูปภาพ',
      openOn: 'เปิดใน {provider}',
      acHeader: 'อีโมต',
      acHint: '↑↓ เลื่อน  ·  Tab/Enter เลือก  ·  Esc ปิด',
      active: 'v{v} ทำงานอยู่',
      duplicate: 'v{v} หยุดทำงาน: หน้านี้มี v{running} ทำงานอยู่แล้ว ปิดหรือถอนการติดตั้งสำเนาที่ซ้ำ',
      autocomplete: 'เชื่อมต่อการเติมอัตโนมัติแล้ว',
      loadingFor: 'กำลังโหลดอีโมตสำหรับ /{slug}…',
      ready: 'พร้อมแล้ว – อีโมต {n} รายการสำหรับ /{slug}',
      retrying: 'ผู้ให้บริการล้มเหลว {n} ราย ลองใหม่ใน {s} วินาที…',
      retryLoaded: 'ลองใหม่แล้วโหลดอีโมตได้ {n} รายการ',
      givingUp: 'เลิกลอง {providers} จนกว่าจะโหลดหน้าใหม่',
      menuSettings: 'การตั้งค่าอีโมต',
    }),
    tr: Object.freeze({
      close: 'Kapat',
      providers: 'Sağlayıcılar',
      globals: 'Genel emote’lar',
      animated: 'Hareketli emote’lar',
      size: 'Sohbette emote boyutu',
      options: 'Seçenekler',
      recent: 'Son kullanılanlar',
      providersNote: 'Bir sağlayıcıyı gizlemek tüm emote’larını sohbetten de kaldırır.',
      globalsNote: 'Her sağlayıcının tüm kanallardaki emote’ları. Kapatırsan yalnızca yayıncının kendi seti kalır.',
      reducedNote: 'Sistemindeki Hareketi azalt ayarı açık; ne seçersen seç emote’lar sabit kalır.',
      bttvNote: 'BTTV sabit kare sunmuyor, bu yüzden hareketli emote’ları hep hareket eder.',
      always: 'Her zaman',
      hover: 'Üzerindeyken',
      never: 'Asla',
      small: 'Küçük',
      medium: 'Orta',
      large: 'Büyük',
      suggest: 'Yazarken emote öner',
      preview: 'Üzerine gelince büyük önizleme',
      clear: 'Son kullanılanları temizle',
      confirmClear: 'Temizlemeyi onayla',
      cancel: 'İptal',
      usedNote: 'Hatırlanan emote: {n}. Seçicinin Son kullanılanlar bölümü ve otomatik tamamlama sırası için. Favoriler kalır.',
      usedNone: 'Henüz hatırlanan yok. Eklediğin emote’lar seçicinin Son kullanılanlar bölümünde görünür.',
      favourites: 'Favoriler',
      insert: '{code} ekle',
      loadMore: 'Daha fazla',
      loadMoreLabel: 'Daha fazla emote yükle',
      showLess: 'Daha az',
      showLessLabel: 'Daha az emote göster',
      showing: '{shown} / {total}',
      loading: 'Yükleniyor…',
      chipTip: '{provider} emote’larını göster veya gizle',
      tabTip: '7TV / BTTV / FFZ emote’ları',
      emptySearch: 'Eşleşen emote yok',
      emptyHidden: 'Tüm sağlayıcılar gizli — yukarıdan birini aç',
      emptyLoading: 'Emote’lar yükleniyor…',
      emptyGlobalsOff: 'Burada kanal emote’u yok ve genel emote’lar kapalı — ayarlardan aç',
      emptyChannel: 'Bu kanal için emote yok',
      favAdd: 'Favorilere ekle',
      favRemove: 'Favorilerden çıkar',
      copyName: 'Adı kopyala',
      copyUrl: 'Görsel URL’sini kopyala',
      openOn: '{provider} üzerinde aç',
      acHeader: 'Emote’lar',
      acHint: '↑↓ gezin  ·  Tab/Enter seç  ·  Esc kapat',
      active: 'v{v} etkin',
      duplicate: 'v{v} devre dışı kalıyor: bu sayfada zaten v{running} çalışıyor. Yinelenen kopyayı kapat veya kaldır.',
      autocomplete: 'Otomatik tamamlama bağlandı',
      loadingFor: '/{slug} için emote’lar yükleniyor…',
      ready: 'Hazır – /{slug} için {n} emote',
      retrying: '{n} sağlayıcı başarısız, {s} sn sonra yeniden deneniyor…',
      retryLoaded: 'Yeniden deneme {n} emote yükledi',
      givingUp: '{providers} bir sonraki sayfa yüklemesine kadar bırakıldı',
      menuSettings: 'Emote ayarları',
    }),
    vi: Object.freeze({
      close: 'Đóng',
      providers: 'Nhà cung cấp',
      globals: 'Emote toàn cục',
      animated: 'Emote động',
      size: 'Cỡ emote trong chat',
      options: 'Tùy chọn',
      recent: 'Dùng gần đây',
      providersNote: 'Ẩn một nhà cung cấp sẽ gỡ mọi emote của họ, cả trong chat.',
      globalsNote: 'Emote của từng nhà cung cấp cho mọi kênh. Tắt đi để chỉ giữ bộ riêng của streamer.',
      reducedNote: 'Cài đặt Giảm chuyển động của hệ thống đang bật, nên emote đứng yên dù bạn chọn gì.',
      bttvNote: 'BTTV không có khung hình tĩnh, nên emote động của nó luôn chuyển động.',
      always: 'Luôn luôn',
      hover: 'Khi rê chuột',
      never: 'Không bao giờ',
      small: 'Nhỏ',
      medium: 'Vừa',
      large: 'Lớn',
      suggest: 'Gợi ý emote khi gõ',
      preview: 'Xem trước cỡ lớn khi rê chuột',
      clear: 'Xóa mục dùng gần đây',
      confirmClear: 'Xác nhận xóa',
      cancel: 'Hủy',
      usedNote: 'Emote đã nhớ: {n}. Dùng cho mục Dùng gần đây trong bộ chọn và thứ tự tự hoàn thành. Mục yêu thích được giữ.',
      usedNone: 'Chưa nhớ gì. Emote bạn chèn sẽ hiện trong mục Dùng gần đây của bộ chọn.',
      favourites: 'Yêu thích',
      insert: 'Chèn {code}',
      loadMore: 'Tải thêm',
      loadMoreLabel: 'Tải thêm emote',
      showLess: 'Thu gọn',
      showLessLabel: 'Hiện ít emote hơn',
      showing: '{shown}/{total}',
      loading: 'Đang tải…',
      chipTip: 'Hiện hoặc ẩn emote {provider}',
      tabTip: 'Emote 7TV / BTTV / FFZ',
      emptySearch: 'Không có emote phù hợp',
      emptyHidden: 'Mọi nhà cung cấp đều đang ẩn — bật lại một cái ở trên',
      emptyLoading: 'Đang tải emote…',
      emptyGlobalsOff: 'Kênh không có emote, còn emote toàn cục đang tắt — bật lại trong phần cài đặt',
      emptyChannel: 'Kênh này không có emote',
      favAdd: 'Thêm vào yêu thích',
      favRemove: 'Bỏ khỏi yêu thích',
      copyName: 'Sao chép tên',
      copyUrl: 'Sao chép URL ảnh',
      openOn: 'Mở trên {provider}',
      acHeader: 'Emote',
      acHint: '↑↓ di chuyển  ·  Tab/Enter chọn  ·  Esc đóng',
      active: 'v{v} đang chạy',
      duplicate: 'v{v} dừng lại: v{running} đã chạy trên trang này. Tắt hoặc gỡ bản trùng lặp.',
      autocomplete: 'Đã gắn tự hoàn thành',
      loadingFor: 'Đang tải emote cho /{slug}…',
      ready: 'Sẵn sàng – {n} emote cho /{slug}',
      retrying: '{n} nhà cung cấp lỗi, thử lại sau {s} giây…',
      retryLoaded: 'Lần thử lại đã tải {n} emote',
      givingUp: 'Bỏ qua {providers} cho đến lần tải trang sau',
      menuSettings: 'Cài đặt emote',
    }),
    zh: Object.freeze({
      close: '关闭',
      providers: '提供方',
      globals: '全局表情',
      animated: '动态表情',
      size: '聊天中的表情大小',
      options: '选项',
      recent: '最近使用',
      providersNote: '隐藏某个提供方会移除它的所有表情，聊天中也是。',
      globalsNote: '每个提供方在所有频道通用的表情。关闭后只保留主播自己的表情。',
      reducedNote: '系统已开启“减弱动态效果”，所以无论选什么，表情都保持静止。',
      bttvNote: 'BTTV 不提供静止帧，所以它的动态表情总是在动。',
      always: '始终',
      hover: '悬停时',
      never: '从不',
      small: '小',
      medium: '中',
      large: '大',
      suggest: '输入时推荐表情',
      preview: '悬停时大图预览',
      clear: '清除最近使用',
      confirmClear: '确认清除',
      cancel: '取消',
      usedNote: '已记住的表情：{n}。用于选择器的“最近使用”和自动补全排序。收藏会保留。',
      usedNone: '还没有记住任何表情。你插入的表情会出现在选择器的“最近使用”中。',
      favourites: '收藏',
      insert: '插入 {code}',
      loadMore: '加载更多',
      loadMoreLabel: '加载更多表情',
      showLess: '收起',
      showLessLabel: '显示更少表情',
      showing: '{shown} / {total}',
      loading: '加载中…',
      chipTip: '显示或隐藏 {provider} 表情',
      tabTip: '7TV / BTTV / FFZ 表情',
      emptySearch: '没有匹配的表情',
      emptyHidden: '所有提供方都已隐藏 — 在上方重新打开一个',
      emptyLoading: '表情加载中…',
      emptyGlobalsOff: '此频道没有表情，全局表情也已关闭 — 在设置中重新打开',
      emptyChannel: '此频道没有表情',
      favAdd: '添加到收藏',
      favRemove: '从收藏中移除',
      copyName: '复制名称',
      copyUrl: '复制图片链接',
      openOn: '在 {provider} 打开',
      acHeader: '表情',
      acHint: '↑↓ 移动  ·  Tab/Enter 选择  ·  Esc 关闭',
      active: 'v{v} 已启用',
      duplicate: 'v{v} 停止运行：此页面已在运行 v{running}。请停用或卸载重复的副本。',
      autocomplete: '自动补全已接入',
      loadingFor: '正在加载 /{slug} 的表情…',
      ready: '就绪 – /{slug} 共 {n} 个表情',
      retrying: '{n} 个提供方失败，{s} 秒后重试…',
      retryLoaded: '重试加载了 {n} 个表情',
      givingUp: '放弃 {providers}，直到下次加载页面',
      menuSettings: '表情设置',
    }),
  });
  function uiText() {
    const lang = kickLang();
    return Object.hasOwn(UI_TEXT, lang) ? UI_TEXT[lang] : UI_TEXT.en;
  }

  // ── Single instance ────────────────────────────────────────────────────
  // Two copies on one page — a manual install left beside the Greasy Fork or
  // auto-updating one, or two managers both enabled — would both scan chat
  // and both drive the picker and autocomplete. The second copy stands down.
  //
  // The marker lives on `<html>` rather than on `window`: this script runs
  // sandboxed (`@grant GM_xmlhttpRequest`), and managers disagree on whether
  // sandboxed userscripts share a JS context — but they always share the DOM.
  // Same pattern as kick-fullscreen-chat and kick-quality-saver.
  const INSTANCE_ATTR = 'data-kte-running';
  const alreadyRunning = document.documentElement.getAttribute(INSTANCE_ATTR);
  if (alreadyRunning) {
    console.warn('[KickEmotes] ' + uiText().duplicate.replace('{v}', VERSION).replace('{running}', alreadyRunning));
    return;
  }
  document.documentElement.setAttribute(INSTANCE_ATTR, VERSION);

  const log = (...a) => console.log('[KickEmotes]', ...a);
  log(uiText().active.replace('{v}', VERSION));

  // Site pages, not channels. Several of these are also real Kick usernames
  // (`home`, `login`, `clips` all resolve on the channel API), so the API
  // can't tell them apart — the route wins on kick.com, and it must here too.
  // The policy pages and `category` were checked against the live site.
  const NON_CHANNEL_SLUGS = new Set([
    '', 'home', 'browse', 'following', 'categories', 'category', 'search',
    'login', 'register', 'dashboard', 'settings', 'clips', 'videos',
    'subscriptions', 'notifications', 'messages', 'wallet',
    'terms-of-service', 'privacy-policy', 'cookie-policy',
    'community-guidelines', 'dmca-policy',
  ]);

  const BTTV_CDN = 'https://cdn.betterttv.net/emote';
  const BTTV_API = 'https://api.betterttv.net/3';
  const SEVENTV_API = 'https://7tv.io/v3';
  const FFZ_API = 'https://api.frankerfacez.com/v1';
  // Same-origin, so it goes through the page's fetch — no GM request, no @connect.
  const KICK_CHANNEL_API = '/api/v2/channels';

  // BTTV's API exposes no overlay flag, so its own clients carry this fixed
  // list of zero-width emotes. Without it `cvMask`/`cvHazmat` — both in BTTV
  // global today — render side by side instead of stacking on the base emote.
  const BTTV_ZERO_WIDTH = new Set([
    'SoSnowy', 'IceCold', 'SantaHat', 'TopHat', 'ReinDeer', 'CandyCane',
    'cvMask', 'cvHazmat',
  ]);

  const ALLOWED_CDN_HOSTS = new Set([
    'cdn.betterttv.net',
    'cdn.7tv.app',
    'cdn.frankerfacez.com',
  ]);

  // Kick may change class names; list fallbacks in priority order.
  const MSG_SELECTORS = [
    'div[style*="--chatroom-font-size"]',   // current Kick DOM (2025+)
    'span.leading-\\[1\\.55\\].font-normal', // text span fallback
    '.chat-entry-content',
    '.chat-message-content',
    '.message-content',
    '[data-chat-entry] .message',
    '.chat-entry .message',
  ];
  const MSG_SELECTOR = MSG_SELECTORS.join(', ');

  // Text inside these is chrome, not message content. Kick renders the chatter's
  // name as a plain <button> inside the message row, so without the button rule
  // a chatter called e.g. `Sadge` has their name replaced by an emote image and
  // loses Kick's click-to-mention control. Both button selectors are deliberately
  // narrow: the reply-preview button ("Replying to X: …") carries neither, so
  // emotes still render inside reply quotes.
  const SKIP_TEXT_SELECTORS = [
    'a',
    'button[data-prevent-expand]',           // current Kick DOM (2025+)
    'button.font-bold',                      // class fallback for the same button
  ];
  const SKIP_TEXT_SELECTOR = SKIP_TEXT_SELECTORS.join(', ');

  const INPUT_SELECTORS = [
    '[data-testid="chat-input"]',            // current Kick DOM (2025+)
    '.editor-input[contenteditable]',        // Lexical editor class fallback
    '[data-chat-input]',
    '.chat-input-wrapper [contenteditable]',
    '.chat-input [contenteditable]',
    '[contenteditable][placeholder]',
    'div[contenteditable="true"]',
  ];

  // ── Cache ────────────────────────────────────────────────────────────────

  const GLOBAL_CACHE_TTL = 12 * 60 * 60 * 1000;
  const CHANNEL_CACHE_TTL = 3 * 60 * 60 * 1000;
  const EMPTY_CACHE_TTL = 15 * 60 * 1000;

  function isSafeTextToken(value, maxLength) {
    return typeof value === 'string'
      && value.length > 0
      && value.length <= maxLength
      && !/[\s\u0000-\u001f\u007f]/.test(value);
  }

  function isSafeTextLabel(value, maxLength) {
    return typeof value === 'string'
      && value.length > 0
      && value.length <= maxLength
      && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function isValidCacheEntry(e) {
    if (!Array.isArray(e)
      || !isSafeTextToken(e[0], 100)
      || typeof e[1]?.url !== 'string'
      || e[1].url.length > 2048
      || !safeUrl(e[1].url)
      || !isSafeTextLabel(e[1]?.source, 64)) return false;
    if (e[1].staticUrl !== undefined) {
      if (typeof e[1].staticUrl !== 'string'
        || e[1].staticUrl.length > 2048
        || !safeUrl(e[1].staticUrl)) return false;
    }
    return true;
  }

  // Prefix bumped from `kte_` to `kte_v2_` when adding `staticUrl` to the emote
  // schema, to `kte_v3_` when BTTV emotes gained real zeroWidth flags — cached
  // v2 entries all claim `zeroWidth: false` — and to `kte_v4_` when 7TV's
  // zeroWidth started reading the right flag bit and failed channel lookups
  // stopped being cached as empty sets, and to `kte_v5_` when animated FFZ
  // emotes stopped being cached as their still frame. Orphaned keys from older
  // prefixes are removed by sweepCache below.
  const CACHE_PREFIX = 'kte_v5_';

  // User state, not cached provider data: it has no schema tied to the emote
  // shape, so it deliberately keeps its own stable prefix and survives every
  // cache-prefix bump. sweepCache skips these keys.
  const USAGE_KEY = 'kte_v2_usage';
  const FAVS_KEY = 'kte_v2_favs';
  const SETTINGS_KEY = 'kte_v2_settings';
  const PRESERVED_KEYS = new Set([USAGE_KEY, FAVS_KEY, SETTINGS_KEY]);

  // Every visited channel leaves kte_v5_*_c_<slug> keys behind and localStorage
  // never evicts them. Drop old-prefix keys and anything long expired; the
  // CACHE_BUDGET cap in Cache.set bounds what is left inside the week.
  const CACHE_SWEEP_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  // Cache writes keep our provider data under this many UTF-16 code units —
  // the unit browsers count against localStorage's ~5M quota. That quota is
  // kick.com's, shared with Kick's own data, and one big channel's sets run to
  // ~200K (xqc's 7TV set alone is 988 emotes, ~190K). Uncapped, a week of
  // channel surfing filled it: our writes then failed silently, and so would
  // Kick's. Oldest entries go first.
  const CACHE_BUDGET = 1.5 * 1024 * 1024;

  // A cache value's write time, read off the front of the string instead of
  // parsing a whole emote set. Cache.set always writes `{"ts":…` first; any
  // other shape reads as 0, i.e. oldest.
  function cacheValueTs(raw) {
    const m = /^\{"ts":(\d+)[,}]/.exec(raw ?? '');
    return m ? Number(m[1]) : 0;
  }

  // Our provider-data entries other than `exceptKey`, oldest first.
  function cacheEntriesByAge(exceptKey) {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CACHE_PREFIX) || key === exceptKey || PRESERVED_KEYS.has(key)) continue;
      const raw = localStorage.getItem(key) ?? '';
      entries.push({ key, ts: cacheValueTs(raw), size: key.length + raw.length });
    }
    return entries.sort((a, b) => a.ts - b.ts);
  }

  function sweepCache() {
    const doomed = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('kte_')) continue;
        if (PRESERVED_KEYS.has(key)) continue; // usage + favourites persist indefinitely
        if (!key.startsWith(CACHE_PREFIX)) { doomed.push(key); continue; }
        const ts = cacheValueTs(localStorage.getItem(key));
        if (!ts || Date.now() - ts > CACHE_SWEEP_MAX_AGE) doomed.push(key);
      }
      doomed.forEach(key => localStorage.removeItem(key));
    } catch { /* storage access denied – skip */ }
  }

  const Cache = {
    read(key) {
      try {
        const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (typeof ts !== 'number' || !Array.isArray(data) || !data.every(isValidCacheEntry)) {
          localStorage.removeItem(`${CACHE_PREFIX}${key}`);
          return null;
        }
        return { ts, data };
      } catch {
        try { localStorage.removeItem(`${CACHE_PREFIX}${key}`); }
        catch { /* ignore */ }
        return null;
      }
    },
    set(key, data) {
      const fullKey = `${CACHE_PREFIX}${key}`;
      try {
        const raw = JSON.stringify({ ts: Date.now(), data });
        const size = fullKey.length + raw.length;
        if (size > CACHE_BUDGET) return;
        // fullKey's current value is left out: this write replaces it.
        const others = cacheEntriesByAge(fullKey);
        let total = others.reduce((sum, entry) => sum + entry.size, 0);
        while (total + size > CACHE_BUDGET && others.length) {
          const oldest = others.shift();
          localStorage.removeItem(oldest.key);
          total -= oldest.size;
        }
        for (;;) {
          try {
            localStorage.setItem(fullKey, raw);
            return;
          } catch {
            // Over the browser's quota while still inside our budget — Kick's
            // own data holds the rest. Give up our oldest entries before
            // giving up the write; that frees room for Kick's writes too.
            const oldest = others.shift();
            if (!oldest) return;
            localStorage.removeItem(oldest.key);
          }
        }
      } catch { /* storage access denied – skip */ }
    },
  };

  // ── Emote usage tracker ──────────────────────────────────────────────────
  // Local-only counter of inserted emotes (autocomplete + picker). Powers
  // usage-first autocomplete ranking and the picker's "Recently used" section.

  const USAGE_MAX_ENTRIES = 200;

  let usageMap = null; // code → { n: insert count, t: last-used timestamp }

  // Usage, favourites and settings all follow one rule, because every open
  // Kick tab writes the same keys: a change re-reads the stored copy, applies
  // itself, and writes straight back. Saving this tab's in-memory copy instead
  // would put back whatever another tab changed since — a cleared list, a
  // star, a setting. Between writes, the `storage` listener (Cross-tab sync)
  // keeps reads current.

  // The stored map, or null when storage can't be read — then the caller
  // keeps what it has rather than starting from empty.
  function usageRead() {
    try {
      const map = new Map();
      const raw = localStorage.getItem(USAGE_KEY);
      if (raw) {
        const { counts } = JSON.parse(raw);
        for (const [code, v] of Object.entries(counts ?? {})) {
          if (!isSafeTextToken(code, 100)) continue;
          if (typeof v?.[0] !== 'number' || typeof v?.[1] !== 'number') continue;
          map.set(code, { n: v[0], t: v[1] });
        }
      }
      return map;
    } catch { return null; }
  }

  function usageLoad() {
    if (!usageMap) usageMap = usageRead() ?? new Map();
    return usageMap;
  }

  function usageCount(code) {
    return usageLoad().get(code)?.n ?? 0;
  }

  function usageBump(code) {
    const map = usageMap = usageRead() ?? usageLoad();
    const cur = map.get(code) ?? { n: 0, t: 0 };
    cur.n++;
    cur.t = Date.now();
    map.set(code, cur);
    if (map.size > USAGE_MAX_ENTRIES) {
      // Evict the least-recently-used code (bumps add at most one entry)
      let worst = null;
      for (const [c, v] of map) {
        if (!worst || v.t < worst[1].t) worst = [c, v];
      }
      if (worst) map.delete(worst[0]);
    }
    usageSave();
  }

  // Forgets every insert, which empties "Recently used" and drops the usage
  // ranking from autocomplete. Favourites are a separate store and stay.
  function usageClear() {
    usageMap = new Map();
    usageSave();
  }

  function usageSave() {
    try {
      const counts = {};
      for (const [code, v] of usageLoad()) counts[code] = [v.n, v.t];
      localStorage.setItem(USAGE_KEY, JSON.stringify({ ts: Date.now(), counts }));
    } catch { /* quota exceeded – skip silently */ }
  }

  // ── Favourites ───────────────────────────────────────────────────────────
  // Local-only starred emote codes. Favourites outrank usage in autocomplete
  // and get their own picker section above "Recently used".

  const FAVS_MAX_ENTRIES = 100;

  let favSet = null; // insertion-ordered Set of codes, oldest first

  // The stored set, or null when storage can't be read (see usageRead).
  function favRead() {
    try {
      const set = new Set();
      const raw = localStorage.getItem(FAVS_KEY);
      if (raw) {
        const { codes } = JSON.parse(raw);
        for (const code of Array.isArray(codes) ? codes : []) {
          if (isSafeTextToken(code, 100)) set.add(code);
        }
      }
      return set;
    } catch { return null; }
  }

  function favLoad() {
    if (!favSet) favSet = favRead() ?? new Set();
    return favSet;
  }

  function favHas(code) {
    return favLoad().has(code);
  }

  // Newest first — the picker section reads most-recently-starred at the top.
  function favCodes() {
    return [...favLoad()].reverse();
  }

  function favToggle(code) {
    const set = favSet = favRead() ?? favLoad();
    const added = !set.delete(code);
    if (added) {
      set.add(code);
      // Drop the oldest star once full (adds grow the set by at most one).
      if (set.size > FAVS_MAX_ENTRIES) set.delete(set.values().next().value);
    }
    favSave();
    return added;
  }

  function favSave() {
    try {
      localStorage.setItem(FAVS_KEY, JSON.stringify({ ts: Date.now(), codes: [...favLoad()] }));
    } catch { /* quota exceeded – skip silently */ }
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  // Local-only preferences: provider visibility as chips at the top of the
  // picker's 7TV+ tab, everything else in the settings panel. User state like
  // usage and favourites, so it keeps its own stable key and is exempt from the
  // cache sweep.

  const PROVIDERS = ['7TV', 'BTTV', 'FFZ'];
  // 'always' animates everywhere, 'hover' shows still frames until the pointer
  // is on the emote, 'never' keeps them still. Only 7TV and FFZ serve a still
  // frame, so BTTV's animated emotes move in every mode.
  const MOTION_MODES = ['always', 'hover', 'never'];
  // Chat emote height in px; 'medium' is the size before it was a setting.
  const EMOTE_SIZES = { small: 24, medium: 28, large: 36 };

  let settings = null;

  function settingsDefaults() {
    const defaults = {
      providers: {}, globals: {}, autocomplete: true, motion: 'always', size: 'medium', preview: true,
    };
    for (const provider of PROVIDERS) {
      defaults.providers[provider] = true;
      defaults.globals[provider] = true;
    }
    return defaults;
  }

  // Field by field, so a record from before a field existed (2.12 stored only
  // `providers`) keeps what it has and takes the default for the rest.
  function settingsFromRecord(saved) {
    const next = settingsDefaults();
    for (const group of ['providers', 'globals']) {
      for (const provider of PROVIDERS) {
        if (typeof saved?.[group]?.[provider] === 'boolean') next[group][provider] = saved[group][provider];
      }
    }
    if (typeof saved?.autocomplete === 'boolean') next.autocomplete = saved.autocomplete;
    if (MOTION_MODES.includes(saved?.motion)) next.motion = saved.motion;
    if (Object.hasOwn(EMOTE_SIZES, saved?.size ?? '')) next.size = saved.size;
    if (typeof saved?.preview === 'boolean') next.preview = saved.preview;
    return next;
  }

  // The stored settings, or null when storage can't be read (see usageRead).
  function settingsRead() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return settingsFromRecord(raw ? JSON.parse(raw) : null);
    } catch { return null; }
  }

  function settingsLoad() {
    if (!settings) settings = settingsRead() ?? settingsDefaults();
    return settings;
  }

  // The only way to change a setting: mutate the freshly read copy, then save.
  function settingsUpdate(mutate) {
    settings = settingsRead() ?? settingsLoad();
    mutate(settings);
    try {
      const { providers, globals, autocomplete, motion, size, preview } = settings;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        ts: Date.now(), providers, globals, autocomplete, motion, size, preview,
      }));
    } catch { /* quota exceeded – skip silently */ }
  }

  // Anything outside the known set — a future provider, or the 'Other' bucket
  // sourceName falls back to — stays visible rather than silently disappearing.
  function providerEnabled(provider) {
    return settingsLoad().providers[provider] ?? true;
  }

  function globalsEnabled(provider) {
    return settingsLoad().globals[provider] ?? true;
  }

  // Chat emotes size themselves from this variable, so a change restyles
  // every rendered emote at once with no re-render. On <html> so it also
  // reaches into a fullscreen chat.
  function applyEmoteSize() {
    document.documentElement.style.setProperty('--kte-emote-size', `${EMOTE_SIZES[settingsLoad().size]}px`);
  }

  // ── State ────────────────────────────────────────────────────────────────

  const emoteMap = new Map(); // code → { url, source, animated, zeroWidth }
  const memoryCache = new Map(); // provider key → { ts, data }, avoids sync localStorage parse on SPA nav
  const pendingLoads = new Map(); // provider key → Promise<entries>, deduplicates in-flight API fetches

  // Each channel visit leaves three channel keys in memoryCache, each holding
  // its provider's full entry array. Nothing ever dropped them, so a long
  // channel-surfing session kept every set it had ever seen in memory. Cap it
  // LRU-style with room for the three globals plus a handful of channels.
  const MEMORY_CACHE_MAX = 24;

  function memoryCacheTouch(key, record) {
    memoryCache.delete(key);
    memoryCache.set(key, record);
    if (memoryCache.size > MEMORY_CACHE_MAX) {
      memoryCache.delete(memoryCache.keys().next().value); // oldest use first
    }
  }

  let channelSlug = null;
  let chatObserver = null;
  let initSeq = 0;
  let emoteVersion = 0;
  // Whether this channel's first round of provider loads has finished, so an
  // empty picker can say why instead of "loading" forever.
  let emotesSettled = false;
  let visibleRefreshTimer = null;
  let pickerInjectTimer = null;
  let pickerDeferredRefreshTimer = null;
  let pickerSearchTimer = null;
  let messageProcessQueue = [];
  let messageProcessQueued = false;
  let lastNavigationAt = 0;
  let lastPath = location.pathname;

  let acDropdown = null;
  let acFocusIdx = -1;
  let acMatches = [];
  let acInput = null;
  let tipEl = null;
  let tipAnchor = null; // element the open tooltip is positioned against

  // Tracks the picker content currently holding viewport scroll + window resize
  // listeners. Lets handleNavigation force-detach even if Kick already removed
  // the picker panel from the DOM.
  let activePickerImageLoader = null;

  // Currently-attached autocomplete input. Lets the input observer skip work
  // while the input is still connected, and re-attach when Kick swaps it out.
  let attachedAcInput = null;

  // ── Styles ───────────────────────────────────────────────────────────────

  const _style = document.createElement('style');
  _style.textContent = `
    /* Emote base wrapper */
    .kte-wrap {
      display: inline-block;
      position: relative;
      vertical-align: middle;
    }
    .kte-img {
      height: var(--kte-emote-size, 28px);
      width: auto;
      max-width: calc(var(--kte-emote-size, 28px) * 4);
      vertical-align: middle;
      display: block;
      cursor: default;
    }

    /* Zero-width overlay: sits centred on top of the base emote */
    .kte-zw {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      height: var(--kte-emote-size, 28px);
      width: auto;
      pointer-events: none;
    }

    #kte-tip {
      display: none;
      position: fixed;
      transform: translateX(-50%);
      background: #101013;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1;
      padding: 7px 12px;
      border-radius: 8px;
      white-space: nowrap;
      pointer-events: none;
      /* Above the settings panel's backdrop, for its Recently used emotes. */
      z-index: 2147483647;
      border: 1px solid rgba(255,255,255,.1);
      box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      flex-direction: column;
      align-items: center;
      gap: 7px;
    }
    .kte-tip-preview {
      height: 64px;
      min-width: 64px;
      max-width: 168px;
      width: auto;
      object-fit: contain;
      display: block;
    }
    .kte-tip-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    /* Autocomplete popup — a panel, so it takes the family panel radius and
       shadow (kick-fullscreen-chat's and kick-quality-saver's settings cards). */
    #kte-ac {
      position: fixed;
      background: #101013;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      box-shadow:
        0 24px 64px -16px rgba(0,0,0,.8),
        0 2px 10px rgba(0,0,0,.45),
        inset 0 1px 0 rgba(255,255,255,.06);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      z-index: 99999;
      min-width: min(230px, calc(100vw - 16px));
      max-width: min(320px, calc(100vw - 16px));
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    #kte-ac-header {
      font-size: 10px;
      font-weight: 600;
      color: #22c55e;
      padding: 8px 12px 4px;
      text-transform: uppercase;
      letter-spacing: .09em;
    }
    .kte-ac-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
      transition: background .08s;
    }
    .kte-ac-row:hover,
    .kte-ac-row.kte-focused { background: rgba(34,197,94,.1); }
    .kte-ac-row img {
      height: 26px;
      width: 40px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .kte-ac-code {
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .kte-ac-src {
      font-size: 10px;
      font-weight: 600;
      flex-shrink: 0;
      opacity: .85;
    }
    .kte-ac-fav {
      font-size: 10px;
      line-height: 1;
      flex-shrink: 0;
    }
    .kte-src-7tv  { color: #4da6ff; }
    .kte-src-bttv { color: #ff6b6b; }
    .kte-src-ffz  { color: #c084fc; }
    .kte-src-other { color: #22c55e; }

    .kte-tip-star,
    .kte-picker-btn[data-kte-fav="1"]::after,
    .kte-panel-recent-emote[data-kte-fav="1"]::after,
    .kte-ac-fav {
      color: #facc15;
    }
    .kte-tip-code {
      color: #fff;
    }
    .kte-tip-sep {
      color: rgba(255,255,255,.25);
      font-weight: 600;
    }
    .kte-tip-source {
      font-size: 10px;
      font-weight: 600;
      opacity: .85;
    }
    #kte-ac-footer {
      font-size: 10px;
      font-weight: 500;
      color: rgba(255,255,255,.4);
      padding: 4px 12px 7px;
      border-top: 1px solid rgba(255,255,255,.08);
    }

    /* Emote context menu */
    #kte-menu {
      position: fixed;
      z-index: 99999;
      min-width: 160px;
      background: #101013;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      overflow: hidden;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      padding: 4px 0;
    }
    .kte-menu-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px 5px;
      margin-bottom: 3px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      font-size: 13px;
      font-weight: 600;
      color: #fff;
    }
    .kte-menu-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 0;
      color: #fff;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 7px 12px;
      cursor: pointer;
      transition: background .08s;
    }
    .kte-menu-item:hover,
    .kte-menu-item:focus-visible {
      background: rgba(34,197,94,.1);
      outline: none;
    }

    /* Native emote picker tab content */
    #kte-picker-content {
      height: 15rem;
      padding: 8px 10px 8px 20px;
      margin-right: 10px;
      color: #efeff1;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      box-sizing: border-box;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }
    #kte-picker-content[hidden] { display: none !important; }
    .kte-picker-provider {
      display: block;
      /* Kick's text-xs leaves no room above the caps, so the row's bottom edge
         crops the header when it sits right under it. */
      line-height: 1.5;
      padding-top: 2px;
    }
    /* As many 38px columns as fit, stretched to share the row's width the way
       Kick's own picker grid does. Fixed-width wrapping items left the row's
       remainder (up to a whole slot) as a gap on the right. */
    .kte-picker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
      gap: 2px;
    }
    .kte-picker-btn {
      position: relative;
      min-width: 0;
      height: 38px;
      border: 0;
      border-radius: 4px;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: transparent;
      contain: layout style paint;
      content-visibility: auto;
      contain-intrinsic-size: 38px 38px;
    }
    .kte-picker-btn:hover,
    .kte-picker-btn:focus-visible {
      background: rgba(255,255,255,.1);
      outline: none;
    }
    .kte-picker-btn img {
      max-width: 32px;
      max-height: 32px;
      width: auto;
      height: auto;
      object-fit: contain;
      pointer-events: none;
    }
    .kte-picker-btn img[data-kte-src] {
      width: 32px;
      height: 32px;
      object-fit: contain;
      visibility: hidden;
    }
    .kte-picker-btn img[data-kte-loaded="1"] {
      visibility: visible;
    }
    .kte-picker-btn[data-kte-fav="1"]::after,
    .kte-panel-recent-emote[data-kte-fav="1"]::after {
      content: '★';
      position: absolute;
      top: 1px;
      right: 2px;
      font-size: 9px;
      line-height: 1;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,.9);
    }
    /* Kick sizes the tab strip to fit exactly the tabs it ships with, so our
       extra one tips its scroller (overflow-x: auto) into scrolling. Tighten the row
       instead of overflowing it: a slightly smaller gap, and tabs allowed to
       give up a few pixels down to a floor that still holds their 28px icon.
       With enough native tabs it will scroll anyway, exactly as Kick's own
       does — this only buys back the width our one tab costs. */
    div:has(> #kte-picker-tab) {
      gap: 6px;
    }
    div:has(> #kte-picker-tab) > button {
      flex: 0 1 44px; /* Kick's size-11 */
      width: auto;
      min-width: 32px;
    }
    @media (min-width: 1024px) {
      div:has(> #kte-picker-tab) > button {
        flex-basis: 40px; /* Kick's lg:size-10 */
      }
    }
    /* The grey track under the tabs is Kick's own absolutely positioned
       sibling of the row (left-0 right-3 bottom-1.5 h-0.5), so it spans the
       scroller's visible width, not its content: once the strip scrolls, the
       last tab — ours — sits past its end. Draw the track on the row instead,
       and let the row grow to hold its tabs at their floor. The tabs' width
       moves into flex-basis above for that: with a fixed width, max-content
       would count each at full size and they would never shrink. The tab
       underlines are z-index 1 flex items, so they still paint over it. */
    div:has(> #kte-picker-tab) {
      position: relative;
      min-width: max-content;
    }
    div:has(> #kte-picker-tab)::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 6px;
      height: 2px;
      background: var(--color-surface-fg-decorative, rgba(255,255,255,.15));
      pointer-events: none;
    }
    div:has(> #kte-picker-tab) + div.absolute[class~="h-0.5"] {
      display: none;
    }
    /* Zero-height marker at the very top of the tab. While it is in view the
       tab is scrolled to the top; once it scrolls out, the settings row hides. */
    .kte-settings-sentinel {
      height: 1px;
      margin-bottom: -1px;
    }
    /* Settings row at the top of the picker tab */
    .kte-picker-settings {
      position: sticky;
      top: 0;
      z-index: 2;
      /* The provider chips share the row's width evenly, like the settings
         panel's chip grid, rather than bunching at the left of a wide card. */
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      /* A rounded card rather than a full-bleed bar. It auto-hides once the grid
         scrolls, so it no longer needs the negative margin that made it cover
         #kte-picker-content's top padding. The bottom margin keeps the first
         section header clear of it. */
      margin: 0 0 12px;
      /* One inset on every side, and a corner radius of the chip's 8px plus
         that inset, so the chips' corners sit concentric with the card's. */
      padding: 6px;
      /* The settings panel's inset-group surface: a faint lift off Kick's
         panel, not the opaque #101013 of the floating popups, which read as a
         black hole inside the grey picker. It hides as soon as the grid
         scrolls, so nothing ever has to stay legible through it. */
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 14px;
      background: rgba(255,255,255,.026);
      transition: opacity .12s ease, transform .12s ease;
    }
    /* Out of the way while the grid is scrolled, so it never sits on emotes. */
    .kte-picker-settings[data-kte-hidden="1"] {
      opacity: 0;
      transform: translateY(-100%);
      pointer-events: none;
    }
    .kte-picker-settings .kte-chip {
      box-sizing: border-box;
      min-width: 0;
      min-height: 30px;
      padding: 0 .4rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* The family chip (kick-fullscreen-chat's .kfc-settings-chip,
       kick-quality-saver's .kqs-chip): neutral at rest, green tint when on. */
    .kte-chip {
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      color: rgba(255,255,255,.85);
      font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      padding: 6px 10px;
      cursor: pointer;
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .kte-chip:hover,
    .kte-chip:focus-visible {
      background: rgba(255,255,255,.09);
      border-color: rgba(255,255,255,.16);
      color: #fff;
      outline: none;
    }
    .kte-chip[data-on="1"] {
      background: rgba(34,197,94,.14);
      border-color: rgba(34,197,94,.5);
      color: #4ade80;
    }
    .kte-chip[data-on="1"]:hover,
    .kte-chip[data-on="1"]:focus-visible {
      background: rgba(34,197,94,.18);
      border-color: rgba(34,197,94,.6);
    }
    /* An enabled provider chip wears its own brand colour, for the same reason
       the source badges do — telling providers apart at a glance is the point. */
    .kte-chip[data-on="1"][data-provider="7TV"] {
      background: rgba(77,166,255,.14); border-color: rgba(77,166,255,.5); color: #4da6ff;
    }
    .kte-chip[data-on="1"][data-provider="7TV"]:hover,
    .kte-chip[data-on="1"][data-provider="7TV"]:focus-visible {
      background: rgba(77,166,255,.2); border-color: rgba(77,166,255,.6);
    }
    .kte-chip[data-on="1"][data-provider="BTTV"] {
      background: rgba(255,107,107,.14); border-color: rgba(255,107,107,.5); color: #ff6b6b;
    }
    .kte-chip[data-on="1"][data-provider="BTTV"]:hover,
    .kte-chip[data-on="1"][data-provider="BTTV"]:focus-visible {
      background: rgba(255,107,107,.2); border-color: rgba(255,107,107,.6);
    }
    .kte-chip[data-on="1"][data-provider="FFZ"] {
      background: rgba(192,132,252,.14); border-color: rgba(192,132,252,.5); color: #c084fc;
    }
    .kte-chip[data-on="1"][data-provider="FFZ"]:hover,
    .kte-chip[data-on="1"][data-provider="FFZ"]:focus-visible {
      background: rgba(192,132,252,.2); border-color: rgba(192,132,252,.6);
    }
    .kte-picker-empty {
      color: #71717a;
      font-size: 12px;
      text-align: center;
      padding: 18px 8px;
      margin: 0;
    }
    .kte-picker-limit {
      color: #71717a;
      font-size: 11px;
      margin: 0;
    }
    .kte-picker-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin: 4px 0 2px;
    }
    .kte-picker-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kte-picker-more {
      width: fit-content;
      border: 1px solid rgba(34,197,94,.5);
      border-radius: 8px;
      background: rgba(34,197,94,.14);
      color: #4ade80;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 7px 12px;
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .kte-picker-more::before {
      content: '';
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background:
        linear-gradient(#101013, #101013) center / 9px 2px no-repeat,
        linear-gradient(#101013, #101013) center / 2px 9px no-repeat,
        #22c55e;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .kte-picker-more:hover,
    .kte-picker-more:focus-visible {
      background: rgba(34,197,94,.18);
      border-color: rgba(34,197,94,.6);
      color: #4ade80;
      outline: none;
    }
    .kte-picker-more:disabled {
      cursor: progress;
      opacity: .68;
    }
    /* Show less is the family chip at rest: the green stays Load more's alone.
       Its minus disc matches Load more's plus disc, which is what sets both
       buttons' height — keep the two in step. */
    .kte-picker-less {
      width: fit-content;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      color: rgba(255,255,255,.85);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      padding: 7px 12px;
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      transition: background .12s ease, border-color .12s ease, color .12s ease;
    }
    .kte-picker-less::before {
      content: '';
      width: 16px;
      height: 16px;
      border-radius: 999px;
      background:
        linear-gradient(#101013, #101013) center / 9px 2px no-repeat,
        rgba(255,255,255,.7);
      flex: none;
    }
    .kte-picker-less:hover,
    .kte-picker-less:focus-visible {
      background: rgba(255,255,255,.09);
      border-color: rgba(255,255,255,.16);
      color: #fff;
      outline: none;
    }
    .kte-picker-less:disabled {
      cursor: progress;
      opacity: .68;
    }
    .kte-picker-more[hidden],
    .kte-picker-less[hidden] {
      display: none;
    }

    /* Settings panel — the family settings card. Values follow
       kick-quality-saver's .kqs-card and kick-fullscreen-chat's
       #kfc-settings-panel; keep them in step with both. */
    .kte-panel-backdrop {
      /* Kick's narrow-screen drawer is a modal that sets pointer-events: none
         on <body>; the backdrop must not inherit it while that closes. */
      pointer-events: auto;
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(6,6,8,.6);
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
      animation: kte-panel-fade .16s ease-out;
    }
    #kte-panel {
      box-sizing: border-box;
      width: min(380px, calc(100vw - 32px));
      max-height: 76vh;
      overflow-y: auto;
      display: grid;
      align-content: start;
      gap: .7rem;
      padding: 1rem;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 14px;
      background: #101013;
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      box-shadow: 0 24px 64px -16px rgba(0,0,0,.8), 0 2px 10px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
      color: #fff;
      font: 500 12px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
      animation: kte-panel-rise .2s cubic-bezier(.16,1,.3,1);
    }
    @keyframes kte-panel-fade {
      from { opacity: 0; }
    }
    /* A centred card, so it rises with kick-quality-saver's scale too. */
    @keyframes kte-panel-rise {
      from { opacity: 0; transform: translateY(8px) scale(.97); }
    }
    #kte-panel :focus-visible {
      outline: 2px solid rgba(34,197,94,.65);
      outline-offset: 2px;
    }
    #kte-panel button {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    /* The family scrollbar: thin, translucent, inset by a transparent border
       so the thumb clears the card's rounded edge. */
    #kte-panel::-webkit-scrollbar {
      width: 8px;
    }
    #kte-panel::-webkit-scrollbar-track {
      background: transparent;
    }
    #kte-panel::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.13);
      border: 2px solid transparent;
      background-clip: padding-box;
      border-radius: 999px;
    }
    /* That 8px track comes out of the content box, on the right only, so a
       card tall enough to scroll sat 8px off-centre (17px of inset on the
       left, 25px on the right). Always reserving the track and taking its
       width back out of the right padding keeps both insets equal, and keeps
       the content the same width whether the card scrolls or not. The track
       is transparent and has no thumb until there is something to scroll, so
       a card that fits shows nothing. Only where ::-webkit-scrollbar sets the
       width: elsewhere the scrollbar is the platform's, of unknown size. */
    @supports selector(::-webkit-scrollbar) {
      #kte-panel {
        overflow-y: scroll;
        padding-right: calc(1rem - 8px);
      }
    }
    /* Header: icon mark, title, close — kick-fullscreen-chat's header. */
    .kte-panel-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .kte-panel-mark {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid rgba(34,197,94,.22);
      border-radius: 9px;
      background: rgba(34,197,94,.1);
    }
    .kte-panel-mark svg {
      width: 16px;
      height: 16px;
      color: #22c55e;
    }
    .kte-panel-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .kte-panel-title {
      font: 600 13.5px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: -.01em;
      color: #fff;
    }
    /* A red glyph on the neutral chip surface, red tint on hover — the
       siblings' close button. */
    .kte-panel-close {
      margin-left: auto;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.09);
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      color: #fca5a5;
      font: 600 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease;
    }
    .kte-panel-close:hover,
    .kte-panel-close:focus-visible {
      background: rgba(239,68,68,.14);
      border-color: rgba(248,113,113,.5);
      color: #fca5a5;
    }
    .kte-panel-close:active {
      transform: scale(.97);
    }
    /* One inset group per topic. The card and its groups are grid rows, not
       flex columns: in Safari a group came out a note line short of its
       content, with the Clear recently used button poking out through its
       bottom edge, and grid rows always size to what they hold. */
    .kte-panel-group {
      display: grid;
      gap: .6rem;
      padding: .7rem;
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 11px;
      background: rgba(255,255,255,.026);
    }
    .kte-panel-label {
      font: 600 10px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: .09em;
      text-transform: uppercase;
      color: rgba(255,255,255,.4);
    }
    .kte-panel-chips {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }
    /* The panel chip is the family's grid chip (kqs .kqs-chip, kfc
       .kfc-settings-chip): taller, centred, and pressed-in on click, with a
       faint ring when selected. The picker row keeps the compact .kte-chip. */
    #kte-panel .kte-chip {
      box-sizing: border-box;
      min-width: 0;
      min-height: 32px;
      padding: 0 .4rem;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      -webkit-appearance: none;
      appearance: none;
      transition: background .15s ease, border-color .15s ease, color .15s ease, transform .1s ease;
    }
    #kte-panel .kte-chip:active {
      transform: scale(.97);
    }
    #kte-panel .kte-chip[data-on="1"] {
      box-shadow: 0 0 0 3px rgba(34,197,94,.07);
    }
    #kte-panel .kte-chip[data-on="1"][data-provider="7TV"] {
      box-shadow: 0 0 0 3px rgba(77,166,255,.07);
    }
    #kte-panel .kte-chip[data-on="1"][data-provider="BTTV"] {
      box-shadow: 0 0 0 3px rgba(255,107,107,.07);
    }
    #kte-panel .kte-chip[data-on="1"][data-provider="FFZ"] {
      box-shadow: 0 0 0 3px rgba(192,132,252,.07);
    }
    /* Destructive action: a red glyph at rest, red tint on hover, solid red
       once armed — kick-quality-saver's .kqs-chip--danger. */
    #kte-panel .kte-chip-danger {
      color: #fca5a5;
    }
    #kte-panel .kte-chip-danger:hover,
    #kte-panel .kte-chip-danger:focus-visible {
      background: rgba(239,68,68,.14);
      border-color: rgba(248,113,113,.5);
      color: #fca5a5;
    }
    #kte-panel .kte-chip-danger[data-on="1"],
    #kte-panel .kte-chip-danger[data-on="1"]:hover {
      background: rgba(248,113,113,.18);
      border-color: #f87171;
      color: #fca5a5;
      box-shadow: 0 0 0 3px rgba(248,113,113,.08);
    }
    #kte-panel .kte-chip:disabled,
    #kte-panel .kte-chip:disabled:hover {
      background: rgba(255,255,255,.02);
      border-color: rgba(255,255,255,.05);
      color: rgba(255,255,255,.28);
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }
    /* Eight to a row, as square tiles on the chip surface. */
    .kte-panel-recent {
      display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      gap: 4px;
    }
    .kte-panel-recent-emote {
      position: relative;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      transition: background .15s ease, border-color .15s ease;
    }
    .kte-panel-recent-emote:hover {
      background: rgba(255,255,255,.09);
      border-color: rgba(255,255,255,.16);
    }
    .kte-panel-recent-emote img {
      max-width: 70%;
      max-height: 70%;
      object-fit: contain;
      pointer-events: none;
    }
    .kte-panel-note {
      font: 500 11px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: rgba(255,255,255,.4);
    }
    /* Switch rows sit in a gap-less container, so each row's own 7px padding
       is the only spacing and the hairline falls midway between rows. When the
       block ends a group, the last row's bottom padding is pulled back so the
       group is as tight at the bottom as under its label. */
    .kte-switches {
      display: flex;
      flex-direction: column;
    }
    .kte-panel-group > .kte-switches:last-child {
      margin-bottom: -7px;
    }
    .kte-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 7px 0;
      font: 600 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      color: rgba(255,255,255,.88);
    }
    .kte-switch-row + .kte-switch-row {
      border-top: 1px solid rgba(255,255,255,.05);
    }
    .kte-switch {
      position: relative;
      flex: none;
      width: 34px;
      height: 19px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      cursor: pointer;
      transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
    }
    .kte-switch[aria-checked="true"] {
      background: #22c55e;
      border-color: rgba(34,197,94,.75);
      box-shadow: 0 0 0 3px rgba(34,197,94,.1);
    }
    .kte-switch::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 2px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.5);
      transform: translateY(-50%);
      transition: transform .18s cubic-bezier(.2,.8,.2,1);
    }
    .kte-switch[aria-checked="true"]::after {
      transform: translate(15px, -50%);
    }
    /* Family rows in Kick's chat settings menu (2.15.12). They keep their
       place and Kick's row metrics (cloned), but wear the family look so they
       read as added by a script: together they sit on one card of the family
       surface (#101013, hairline border), set a little apart from Kick's rows,
       with the green icon tile and a green hover. The same block ships in
       kick-chat-utils for its "Moderation history" row; keep the two equal. */
    #chat-settings-panel li[data-kick-family-row] {
      cursor: pointer;
      box-sizing: content-box;
      border: 0 solid rgba(255,255,255,.08);
      border-left-width: 1px;
      border-right-width: 1px;
      border-radius: 0;
      background-color: #101013;
    }
    /* First of the group: the card's top edge, apart from Kick's rows. */
    #chat-settings-panel li:not([data-kick-family-row]) + li[data-kick-family-row] {
      margin-top: 8px;
      padding-top: 4px;
      border-top-width: 1px;
      border-top-left-radius: 10px;
      border-top-right-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
    }
    /* Last of the group: the card's bottom edge. */
    #chat-settings-panel li[data-kick-family-row]:not(:has(+ li[data-kick-family-row])) {
      padding-bottom: 4px;
      border-bottom-width: 1px;
      border-bottom-left-radius: 10px;
      border-bottom-right-radius: 10px;
    }
    /* Hover and keyboard focus: the family button hover, the green tint
       over #101013 (kick-fullscreen-chat's control buttons, kick-vod-resume's
       toast buttons), painted by the row itself. Kick's own grey hover can sit
       on the row, on any element inside it or on a pseudo-element, so all of
       those are cleared rather than guessing which one Kick uses this week. */
    #chat-settings-panel li[data-kick-family-row] {
      transition: background-color .12s ease;
    }
    #chat-settings-panel li[data-kick-family-row]:hover,
    #chat-settings-panel li[data-kick-family-row]:focus-visible {
      background: linear-gradient(rgba(34,197,94,.1), rgba(34,197,94,.1)), #101013 !important;
    }
    #chat-settings-panel li[data-kick-family-row] *:not([data-kick-family-tile]):not([data-kick-family-tile] *),
    #chat-settings-panel li[data-kick-family-row]::before,
    #chat-settings-panel li[data-kick-family-row]::after,
    #chat-settings-panel li[data-kick-family-row] *::before,
    #chat-settings-panel li[data-kick-family-row] *::after {
      background: transparent !important;
    }
    #chat-settings-panel li[data-kick-family-row]:focus-visible {
      outline: 2px solid rgba(34,197,94,.65);
      outline-offset: -2px;
    }
    #chat-settings-panel [data-kick-family-tile] {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 26px;
      height: 26px;
      border: 1px solid rgba(34,197,94,.22);
      border-radius: 8px;
      background: rgba(34,197,94,.1);
      color: #22c55e;
      transition: border-color .12s ease, background-color .12s ease;
    }
    #chat-settings-panel [data-kick-family-tile] svg {
      display: block;
      width: 15px;
      height: 15px;
    }
    #chat-settings-panel li[data-kick-family-row]:hover [data-kick-family-tile],
    #chat-settings-panel li[data-kick-family-row]:focus-visible [data-kick-family-tile] {
      border-color: rgba(34,197,94,.45);
      background: rgba(34,197,94,.16);
    }
    @media (prefers-reduced-motion: reduce) {
      #chat-settings-panel li[data-kick-family-row],
      #chat-settings-panel [data-kick-family-tile] {
        transition: none;
      }
    }
    /* End of family rows (test/family-style.js compares the block above with the sibling's copy) */
    @media (prefers-reduced-motion: reduce) {
      .kte-panel-backdrop,
      #kte-panel {
        animation: none;
      }
      #kte-panel .kte-chip,
      .kte-panel-recent-emote,
      .kte-panel-close,
      .kte-switch,
      .kte-switch::after {
        transition: none;
      }
    }
  `;
  (document.head ?? document.documentElement).appendChild(_style);

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Reject URLs that aren't https: or don't come from a known emote CDN.
  // Prevents a compromised provider API from loading arbitrary tracking pixels.
  function safeUrl(url) {
    try {
      const { protocol, hostname } = new URL(url);
      return protocol === 'https:' && ALLOWED_CDN_HOSTS.has(hostname) ? url : '';
    } catch { return ''; }
  }

  // With the OS "reduce motion" setting on, emotes show their still frame
  // everywhere — chat, autocomplete, the hover preview and the picker, hover
  // included. That needs a still frame to exist: 7TV and FFZ animated emotes
  // have one (`staticUrl`); BTTV serves none, so its animated emotes still move.
  const reducedMotionQuery = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function prefersReducedMotion() {
    return Boolean(reducedMotionQuery?.matches);
  }

  // The system's reduce-motion setting wins over the user's choice here.
  function motionMode() {
    return prefersReducedMotion() ? 'never' : settingsLoad().motion;
  }

  // The image to show for an emote, already through safeUrl: its still frame
  // unless motion is 'always' and it has one, otherwise the emote itself.
  function emoteDisplayUrl(emote) {
    const still = motionMode() !== 'always' && emote.staticUrl ? safeUrl(emote.staticUrl) : '';
    return still || safeUrl(emote.url);
  }

  // The image to show while the pointer is on an emote, and in the hover
  // preview: animated unless motion is off entirely.
  function emoteHoverUrl(emote) {
    return motionMode() === 'never' ? emoteDisplayUrl(emote) : safeUrl(emote.url);
  }

  function RIC(cb) {
    return typeof requestIdleCallback === 'function'
      ? requestIdleCallback(cb, { timeout: 300 })
      : setTimeout(cb, 16);
  }

  function sourceName(source) {
    return (source ?? '').split(' ')[0] || 'Other';
  }

  function sourceClass(source) {
    const name = sourceName(source);
    return { '7TV': 'kte-src-7tv', BTTV: 'kte-src-bttv', FFZ: 'kte-src-ffz' }[name] ?? 'kte-src-other';
  }

  function setEmoteTooltip(el, code, source, url) {
    el.dataset.kteTip = `${code}  ·  ${source}`;
    el.dataset.kteTipCode = code;
    el.dataset.kteTipSource = source;
    // kteTipCode picks up " + <code>" suffixes as zero-width emotes stack on
    // this wrap; kteTipBase stays the single code the star state belongs to.
    el.dataset.kteTipBase = code;
    if (url) el.dataset.kteTipUrl = url;
  }

  function preconnectEmoteHosts() {
    const origins = [
      BTTV_API,
      BTTV_CDN,
      SEVENTV_API,
      'https://cdn.7tv.app',
      FFZ_API,
      'https://cdn.frankerfacez.com',
    ].map(url => new URL(url).origin);

    const existing = new Set(
      [...document.querySelectorAll('link[rel="preconnect"]')].map(link => link.href.replace(/\/$/, '')),
    );

    for (const origin of origins) {
      if (existing.has(origin)) continue;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      (document.head ?? document.documentElement).appendChild(link);
      existing.add(origin);
    }
  }

  // ── HTTP ─────────────────────────────────────────────────────────────────

  const FETCH_TIMEOUT = 15000;
  // Delays before each retry of a provider that failed to load (see init).
  const PROVIDER_RETRY_DELAYS = [5000, 15000, 45000];

  // Errors carry the HTTP status so a 404 can be told apart from a failure.
  function httpError(status) {
    const err = new Error(`HTTP ${status}`);
    err.status = status;
    return err;
  }

  function fetchJSON(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: { Accept: 'application/json' },
        // Without this a hung provider request never settles, which blocks the
        // failed-provider retry pass in init() forever.
        timeout: FETCH_TIMEOUT,
        ontimeout: () => reject(new Error('timeout')),
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            try { resolve(JSON.parse(res.responseText)); }
            catch (e) { reject(e); }
          } else {
            reject(httpError(res.status));
          }
        },
        // Managers call onerror with the response object, not an Error, so a
        // bare `reject` logged `failed: undefined`. An abort is handled too: a
        // request that ends without onload/onerror/ontimeout would otherwise
        // leave this promise, and the retry pass waiting on it, pending forever.
        onerror: res => reject(new Error(typeof res?.error === 'string' && res.error
          ? `network error: ${res.error}`
          : 'network error')),
        onabort: () => reject(new Error('aborted')),
      });
    });
  }

  // A 404 is the provider answering "no such user/room": the channel really has
  // no emotes there, and an empty set is safe to cache. Anything else — timeout,
  // 5xx, rate limit — still throws. Swallowing those used to cache an outage as
  // an empty set for 15 minutes, and a failed background refresh would replace
  // a good cached set with nothing mid-session.
  async function fetchJSONOrNull(url) {
    try { return await fetchJSON(url); }
    catch (e) {
      if (e?.status === 404) return null;
      throw e;
    }
  }

  // Kick's own API, fetched same-origin the way Kick's frontend does. Same 404
  // contract as fetchJSONOrNull.
  async function fetchKickJSONOrNull(path) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
    try {
      const res = await fetch(`${location.origin}${path}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) throw httpError(res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Cache-aware load helper ──────────────────────────────────────────────

  function cacheTtlFor(key, data) {
    if (!data.length) return EMPTY_CACHE_TTL;
    return key.endsWith('_g') ? GLOBAL_CACHE_TTL : CHANNEL_CACHE_TTL;
  }

  function cachedRecord(key) {
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key);
      memoryCacheTouch(key, cached); // re-mark as most recently used
      return cached;
    }

    const record = Cache.read(key);
    if (record) memoryCacheTouch(key, record);
    return record;
  }

  function isFreshCacheRecord(key, record) {
    return Date.now() - record.ts <= cacheTtlFor(key, record.data);
  }

  function sameEmoteEntry(a, b) {
    return a?.[0] === b?.[0]
      && a?.[1]?.url === b?.[1]?.url
      && a?.[1]?.staticUrl === b?.[1]?.staticUrl
      && a?.[1]?.source === b?.[1]?.source
      && Boolean(a?.[1]?.animated) === Boolean(b?.[1]?.animated)
      && Boolean(a?.[1]?.zeroWidth) === Boolean(b?.[1]?.zeroWidth);
  }

  function sameEmoteEntries(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!sameEmoteEntry(a[i], b[i])) return false;
    }
    return true;
  }

  function fetchAndCache(key, fetcher) {
    if (pendingLoads.has(key)) return pendingLoads.get(key);

    const pending = Promise.resolve()
      .then(fetcher)
      .then(entries => {
        const safeEntries = Array.isArray(entries) ? entries.filter(isValidCacheEntry) : [];
        const record = { ts: Date.now(), data: safeEntries };
        memoryCacheTouch(key, record);
        RIC(() => Cache.set(key, safeEntries));
        return safeEntries;
      })
      .finally(() => {
        pendingLoads.delete(key);
      });

    pendingLoads.set(key, pending);
    return pending;
  }

  // `fetcher` must return an array of [code, emoteObj] pairs.
  async function cachedLoad(key, fetcher, options = {}) {
    const record = cachedRecord(key);

    if (record) {
      if (!isFreshCacheRecord(key, record) && options.revalidate !== false) {
        const cachedData = record.data;
        fetchAndCache(key, fetcher).then(entries => {
          if (typeof options.onRefresh === 'function' && !sameEmoteEntries(cachedData, entries)) {
            options.onRefresh(entries, cachedData, key);
          }
        }).catch(() => {
          // Keep serving stale cache when a background refresh fails.
        });
      }
      return record.data;
    }

    return fetchAndCache(key, fetcher);
  }

  // Provider layers for the current channel, kept at module scope so a settings
  // change can rebuild emoteMap without re-running init() — which would tear the
  // picker down under the user while they click a chip inside it.
  let loadedProviders = new Map(); // loader key → validated entries
  let activeLoaders = [];          // loader descriptors for the current channel

  // When two layers share a code, the higher-ranked one wins: every channel set
  // outranks every global set, and within a tier 7TV beats BTTV beats FFZ (the
  // PROVIDERS order). 7TV leads because it is the only provider that knows
  // Kick accounts — BTTV and FFZ channel sets are the streamer's Twitch ones.
  // This used to fall out of loader order instead, which had channel sets
  // last-wins and globals first-wins, so an old Twitch FFZ emote shadowed the
  // streamer's 7TV emote of the same name.
  function loaderRank(loader) {
    const i = PROVIDERS.indexOf(loader.provider);
    const providerRank = i < 0 ? PROVIDERS.length : i;
    return (loader.isChannel ? 0 : PROVIDERS.length + 1) + providerRank;
  }

  // Resolution order is non-deterministic, so rebuild from the known layers
  // whenever a provider updates or is toggled in settings.
  function rebuildEmoteMap() {
    emoteMap.clear();
    const ranked = [...activeLoaders].sort((a, b) => loaderRank(a) - loaderRank(b));
    for (const loader of ranked) {
      if (!providerEnabled(loader.provider)) continue;
      if (!loader.isChannel && !globalsEnabled(loader.provider)) continue;
      const entries = loadedProviders.get(loader.key);
      if (!Array.isArray(entries)) continue;
      for (const [code, e] of entries) {
        if (!emoteMap.has(code)) emoteMap.set(code, e);
      }
    }
  }

  // ── Channel lookup ───────────────────────────────────────────────────────
  // The URL slug is not a usable identity on its own. BTTV's user endpoint takes
  // a numeric platform ID, never a name, so a slug always 404s there. And a Kick
  // slug isn't always the username: newer accounts with an underscore get a
  // dash in the URL (`xqc_lobotomy` lives at /xqc-lobotomy), which no provider
  // knows them by. So the channel is resolved once through Kick's API and every
  // channel loader keys off that:
  //
  //   Kick user ID ───► 7TV user (via its Kick connection) ───► linked Twitch ID
  //   Kick username ──► FFZ room (as a Twitch login) ─────────► Twitch ID fallback
  //
  // The Twitch ID is what BTTV needs, and 7TV's fallback when Kick isn't linked.

  // Shares lookups between the three channel loaders, which all start at once.
  // Short-lived so a background revalidation hours later fetches afresh, and a
  // rejected lookup is dropped immediately so the retry pass refetches it.
  const CHANNEL_LOOKUP_TTL = 60 * 1000;
  const channelLookups = new Map(); // `${kind}:${slug}` → { ts, promise }

  function channelLookup(kind, slug, fn) {
    const now = Date.now();
    for (const [key, hit] of channelLookups) {
      if (now - hit.ts > CHANNEL_LOOKUP_TTL) channelLookups.delete(key);
    }
    const key = `${kind}:${slug}`;
    let hit = channelLookups.get(key);
    if (!hit) {
      hit = { ts: now, promise: fn() };
      channelLookups.set(key, hit);
      hit.promise.catch(() => {
        if (channelLookups.get(key) === hit) channelLookups.delete(key);
      });
    }
    return hit.promise;
  }

  function isNumericId(value) {
    return typeof value === 'string' && /^\d{1,20}$/.test(value);
  }

  // → { userId, username }, or null when Kick has no such channel. The one hard
  // dependency of every channel loader: without it there is nothing to look up.
  function kickChannel(slug) {
    return channelLookup('kick', slug, async () => {
      const data = await fetchKickJSONOrNull(`${KICK_CHANNEL_API}/${encodeURIComponent(slug)}`);
      if (!data) return null;
      const userId = String(data.user_id ?? '');
      const username = data.user?.username;
      if (!isNumericId(userId) || !isSafeTextToken(username, 64)) {
        throw new Error('unexpected Kick channel response');
      }
      return { userId, username };
    });
  }

  // The streamer's 7TV account, found through its Kick connection →
  // { emotes, twitchId }, or null when they haven't linked Kick on 7TV.
  function sevenTvKickUser(slug) {
    return channelLookup('7tv', slug, async () => {
      const kick = await kickChannel(slug);
      if (!kick) return null;
      const data = await fetchJSONOrNull(`${SEVENTV_API}/users/kick/${kick.userId}`);
      if (!data) return null;
      const twitch = Array.isArray(data.user?.connections)
        ? data.user.connections.find(c => c?.platform === 'TWITCH')
        : null;
      return {
        emotes: parse7TVEmotes(data.emote_set?.emotes),
        twitchId: isNumericId(twitch?.id) ? twitch.id : null,
      };
    });
  }

  // The Twitch account linked on 7TV, or null. A 7TV outage also reads as null
  // here, so it degrades BTTV and FFZ to the by-name lookup instead of failing
  // them too — one provider being down must not take the others with it.
  async function linkedTwitchId(slug) {
    try { return (await sevenTvKickUser(slug))?.twitchId ?? null; }
    catch { return null; }
  }

  // The channel's FFZ room. FFZ has no Kick support, so this is a Twitch room:
  // the one the streamer linked on 7TV when there is one, otherwise the Kick
  // username taken as a Twitch login.
  function ffzRoom(slug) {
    return channelLookup('ffz', slug, async () => {
      const kick = await kickChannel(slug);
      if (!kick) return null;
      const linked = await linkedTwitchId(slug);
      return fetchJSONOrNull(linked
        ? `${FFZ_API}/room/id/${linked}`
        : `${FFZ_API}/room/${encodeURIComponent(kick.username.toLowerCase())}`);
    });
  }

  // → the Twitch account's numeric ID as a string, or null.
  async function channelTwitchId(slug) {
    const linked = await linkedTwitchId(slug);
    if (linked) return linked;
    const id = String((await ffzRoom(slug))?.room?.twitch_id ?? '');
    return isNumericId(id) ? id : null;
  }

  // ── Emote Loaders ────────────────────────────────────────────────────────

  function bttvEntries(emotes, source) {
    return (Array.isArray(emotes) ? emotes : []).map(e => [e?.code, {
      url: `${BTTV_CDN}/${e?.id}/2x${e?.animated ? '.gif' : ''}`,
      source,
      animated: Boolean(e?.animated),
      zeroWidth: BTTV_ZERO_WIDTH.has(e?.code),
    }]);
  }

  async function loadBTTVGlobal(options) {
    return cachedLoad('bttv_g', async () => {
      return bttvEntries(await fetchJSON(`${BTTV_API}/cached/emotes/global`), 'BTTV');
    }, options);
  }

  // Twitch only: BTTV has no Kick provider. `/cached/users/kick/<id>` answers
  // exactly like a made-up provider name does — 404 for every ID — so asking it
  // first would just add a request that always fails.
  async function loadBTTVChannel(slug, options) {
    return cachedLoad(`bttv_c_${slug}`, async () => {
      const twitchId = await channelTwitchId(slug);
      if (!twitchId) return [];
      const data = await fetchJSONOrNull(`${BTTV_API}/cached/users/twitch/${twitchId}`);
      const all = [...(data?.channelEmotes ?? []), ...(data?.sharedEmotes ?? [])];
      return bttvEntries(all, 'BTTV (twitch)');
    }, options);
  }

  // 7TV's v3 emote list, the same shape for the global set and a user's set:
  // each entry is an active emote whose `name` is the set's alias, wrapping the
  // emote itself in `data`.
  //
  // Zero-width is the active emote's flag, ActiveEmoteFlag.ZeroWidth = 1 << 0.
  // `data.flags & 256` is EmoteFlags.ZeroWidth — the emote's own default, which
  // a set can override — and is never set on the active emote, so testing
  // `flags & 256` there (as this used to) flagged nothing at all.
  function parse7TVEmotes(emotes) {
    const entries = [];
    for (const e of Array.isArray(emotes) ? emotes : []) {
      const host = e?.data?.host;
      const files = Array.isArray(host?.files) ? host.files : [];
      if (typeof host?.url !== 'string' || !files.length) continue;
      const animated = Boolean(e.data.animated);
      const named = name => files.find(f => f?.name === name);
      // Animated: prefer GIF (universally supported) over animated WebP.
      const file = animated
        ? (named('2x.gif') ?? files.find(f => f?.format === 'GIF') ?? named('2x.webp') ?? files[0])
        : (named('2x.webp') ?? named('2x.avif') ?? files[0]);
      if (typeof file?.name !== 'string') continue;
      const entry = {
        url: `https:${host.url}/${file.name}`,
        source: '7TV',
        animated,
        zeroWidth: ((e.flags ?? 0) & 1) !== 0,
      };
      // The frozen first frame isn't a file of its own in the list: each file
      // names its variant in `static_name`. The picker shows it until hover.
      const staticName = animated ? named('2x.webp')?.static_name : null;
      if (typeof staticName === 'string' && staticName !== file.name) {
        entry.staticUrl = `https:${host.url}/${staticName}`;
      }
      entries.push([e.name, entry]);
    }
    return entries;
  }

  async function load7TVGlobal(options) {
    return cachedLoad('7tv_g', async () => {
      const data = await fetchJSON(`${SEVENTV_API}/emote-sets/global`);
      return parse7TVEmotes(data?.emotes);
    }, options);
  }

  async function load7TVChannel(slug, options) {
    return cachedLoad(`7tv_c_${slug}`, async () => {
      const user = await sevenTvKickUser(slug);
      if (user) return user.emotes;
      // Kick isn't linked on 7TV — fall back to the channel's Twitch account.
      const twitchId = await channelTwitchId(slug);
      if (!twitchId) return [];
      const data = await fetchJSONOrNull(`${SEVENTV_API}/users/twitch/${twitchId}`);
      return parse7TVEmotes(data?.emote_set?.emotes);
    }, options);
  }

  // FFZ "modifier" entries (ffzSpin, ffzRainbow, ffzX, …) are effects applied
  // to the preceding emote, not emotes. They're over half of the global set
  // and render as meaningless 32px icons on their own.
  //
  // An animated emote carries a second URL map, `animated`, beside `urls`
  // (`…/emote/<id>/animated/2`, an animated WebP); `urls` is then its still
  // first frame (PNG), which the picker shows until hover, as with 7TV.
  function ffzEntries(sets, source) {
    const https = raw => (raw.startsWith('//') ? `https:${raw}` : raw);
    const entries = [];
    for (const set of Object.values(sets ?? {})) {
      for (const e of (set?.emoticons ?? [])) {
        if (e?.modifier) continue;
        const stillRaw = e?.urls?.['2'] ?? e?.urls?.['1'];
        const animRaw = e?.animated?.['2'] ?? e?.animated?.['1'];
        const animated = typeof animRaw === 'string';
        const raw = animated ? animRaw : stillRaw;
        if (typeof raw !== 'string') continue;
        const entry = {
          url: https(raw),
          source,
          animated,
          zeroWidth: false,
        };
        if (animated && typeof stillRaw === 'string') entry.staticUrl = https(stillRaw);
        entries.push([e.name, entry]);
      }
    }
    return entries;
  }

  async function loadFFZGlobal(options) {
    return cachedLoad('ffz_g', async () => {
      const data = await fetchJSON(`${FFZ_API}/set/global`);
      return ffzEntries(data?.sets, 'FFZ');
    }, options);
  }

  async function loadFFZChannel(slug, options) {
    return cachedLoad(`ffz_c_${slug}`, async () => {
      const room = await ffzRoom(slug);
      return ffzEntries(room?.sets, 'FFZ (channel)');
    }, options);
  }

  // ── DOM Processing ───────────────────────────────────────────────────────

  // Fullscreen API hides everything outside the fullscreen element's subtree,
  // so floating overlays must live inside it while it's active.
  function overlayParent() {
    return document.fullscreenElement ?? document.body;
  }

  function reparentOverlay(el) {
    if (!el) return;
    const parent = overlayParent();
    if (el.parentNode !== parent) parent.appendChild(el);
  }

  function hideTooltip() {
    if (tipEl) tipEl.style.display = 'none';
    tipAnchor = null;
  }

  function positionTooltip(wrap) {
    if (!tipEl || tipEl.style.display === 'none') return;
    // The anchor can vanish under a stationary cursor — chat's virtual list
    // recycles rows out from under it, and removing an element fires no
    // mouseleave — which would strand the tooltip until the next hover.
    if (!wrap.isConnected) { hideTooltip(); return; }
    const rect = wrap.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) { hideTooltip(); return; }
    const tipRect = tipEl.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + rect.width / 2, tipRect.width / 2 + 4), window.innerWidth - tipRect.width / 2 - 4);
    const top = Math.max(4, rect.top - tipRect.height - 5);
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
  }

  function showTooltip(wrap) {
    const text = wrap.dataset.kteTip;
    if (!text) return;

    if (!tipEl) {
      tipEl = document.createElement('span');
      tipEl.id = 'kte-tip';
    }
    reparentOverlay(tipEl);

    tipEl.textContent = '';

    // Large preview above the label, unless switched off in settings — the
    // emote is already decoded from chat or the picker, so this costs nothing
    // beyond layout.
    const previewUrl = settingsLoad().preview ? safeUrl(wrap.dataset.kteTipUrl ?? '') : '';
    if (previewUrl) {
      const preview = document.createElement('img');
      preview.className = 'kte-tip-preview';
      preview.src = previewUrl;
      preview.alt = '';
      // CSS reserves the box, but the intrinsic width only lands on load —
      // re-anchor once it does so a cold image doesn't leave the tip off-centre.
      // isConnected gates the stale case: hovering another emote rebuilds the
      // tip's children, and this image's late load must not drag the tip back
      // to the emote it belonged to.
      preview.addEventListener('load', () => {
        if (preview.isConnected) positionTooltip(wrap);
      });
      // Drop the reserved box rather than show an empty frame on a dead URL.
      preview.addEventListener('error', () => {
        if (!preview.isConnected) return;
        preview.remove();
        positionTooltip(wrap);
      });
      tipEl.appendChild(preview);
    }

    const label = document.createElement('span');
    label.className = 'kte-tip-label';

    const code = wrap.dataset.kteTipCode;
    const source = wrap.dataset.kteTipSource;
    if (code && source) {
      if (favHas(wrap.dataset.kteTipBase ?? code)) {
        const starEl = document.createElement('span');
        starEl.className = 'kte-tip-star';
        starEl.textContent = '★';
        label.appendChild(starEl);
      }

      const codeEl = document.createElement('span');
      codeEl.className = 'kte-tip-code';
      codeEl.textContent = code;

      const sepEl = document.createElement('span');
      sepEl.className = 'kte-tip-sep';
      sepEl.textContent = '·';

      const sourceEl = document.createElement('span');
      sourceEl.className = `kte-tip-source ${sourceClass(source)}`;
      sourceEl.textContent = source;

      label.append(codeEl, sepEl, sourceEl);
    } else {
      label.textContent = text;
    }
    tipEl.appendChild(label);

    tipEl.style.display = 'inline-flex';
    tipAnchor = wrap;
    positionTooltip(wrap);
  }

  // #kte-tip is position:fixed, so chat scrolling past a hovered emote (or the
  // picker grid scrolling under the cursor) leaves the tooltip behind where the
  // emote used to be. Re-anchor on any scroll while one is open.
  function repositionTooltip() {
    if (tipAnchor) positionTooltip(tipAnchor);
  }
  document.addEventListener('scroll', repositionTooltip, { capture: true, passive: true });
  window.addEventListener('resize', repositionTooltip, { passive: true });

  // ── Emote context menu ───────────────────────────────────────────────────

  let menuEl = null;

  function hideEmoteMenu() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    document.removeEventListener('mousedown', emoteMenuDismiss, true);
    document.removeEventListener('keydown', emoteMenuKeydown, true);
    for (const type of MENU_GUARD_EVENTS) window.removeEventListener(type, emoteMenuGuard, true);
  }

  // Kick's emote picker closes on any press outside it, and the menu lives in
  // <body>, so clicking an item opened from the picker closed the picker.
  // Presses on the menu are stopped in window capture, ahead of every document
  // or element listener Kick has, and mousedown's default is cancelled so
  // focus stays put and a focus-outside check can't fire either. That stops
  // the click from reaching the item too, so the item's action runs from here.
  const MENU_GUARD_EVENTS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchstart', 'touchend', 'click'];

  function emoteMenuGuard(e) {
    if (!menuEl?.contains(e.target)) return;
    e.stopPropagation();
    if (e.type === 'pointerdown' || e.type === 'mousedown') e.preventDefault();
    if (e.type === 'click') {
      const action = e.target.closest?.('.kte-menu-item')?._kteAction;
      if (action) {
        action();
        hideEmoteMenu();
      }
    }
  }

  function emoteMenuDismiss(e) {
    if (!menuEl?.contains(e.target)) hideEmoteMenu();
  }

  // Escape closes the menu, swallowed like the panel's so the same press can't
  // also reach Kick, which would take the player out of theatre mode.
  function emoteMenuKeydown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    hideEmoteMenu();
  }

  // Derive the emote's public page from its (already allowlisted) CDN URL.
  function emotePageUrl(emote) {
    const url = safeUrl(emote.url);
    if (!url) return null;
    const { hostname, pathname } = new URL(url);
    let m;
    if (hostname === 'cdn.betterttv.net' && (m = pathname.match(/^\/emote\/([a-f0-9]+)\//i))) {
      return `https://betterttv.com/emotes/${m[1]}`;
    }
    if (hostname === 'cdn.7tv.app' && (m = pathname.match(/^\/emote\/([A-Za-z0-9]+)\//))) {
      return `https://7tv.app/emotes/${m[1]}`;
    }
    if (hostname === 'cdn.frankerfacez.com' && (m = pathname.match(/^\/emote\/(\d+)\//))) {
      return `https://www.frankerfacez.com/emoticon/${m[1]}`;
    }
    return null;
  }

  function copyText(text) {
    try { navigator.clipboard?.writeText(text)?.catch?.(() => {}); }
    catch { /* clipboard unavailable */ }
  }

  // A star changes three things at once: the picker's badge and Favourites
  // section, the autocomplete ranking, and the tooltip. Rebuild the picker even
  // when its tab is hidden — pickerRefreshContent preserves the hidden state,
  // and nothing else would rebuild it before the user switches back.
  function favToggleAndRefresh(code) {
    const added = favToggle(code);
    pickerRefreshIfBuilt();
    acRefreshOpen();
    return added;
  }

  function pickerRefreshIfBuilt() {
    const panel = document.getElementById('chat-emotes-picker-panel');
    if (panel?.querySelector('#kte-picker-content')) {
      pickerRefreshContent(panel);
      pickerApplyActiveState(panel);
    }
  }

  function showEmoteMenu(x, y, code, emote) {
    hideEmoteMenu();

    const menu = document.createElement('div');
    menu.id = 'kte-menu';

    const header = document.createElement('div');
    header.className = 'kte-menu-header';
    const nameEl = document.createElement('span');
    nameEl.textContent = code;
    const srcEl = document.createElement('span');
    srcEl.className = `kte-ac-src ${sourceClass(emote.source)}`;
    srcEl.textContent = sourceName(emote.source);
    header.append(nameEl, srcEl);
    menu.appendChild(header);

    const addItem = (label, action) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kte-menu-item';
      btn.textContent = label;
      btn._kteAction = action; // run by emoteMenuGuard
      menu.appendChild(btn);
    };

    const t = uiText();
    addItem(favHas(code) ? t.favRemove : t.favAdd, () => favToggleAndRefresh(code));
    addItem(t.copyName, () => copyText(code));
    const imgUrl = safeUrl(emote.url);
    if (imgUrl) addItem(t.copyUrl, () => copyText(imgUrl));
    const pageUrl = emotePageUrl(emote);
    if (pageUrl) addItem(t.openOn.replace('{provider}', sourceName(emote.source)), () => window.open(pageUrl, '_blank', 'noopener'));

    overlayParent().appendChild(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    menuEl = menu;

    document.addEventListener('mousedown', emoteMenuDismiss, true);
    document.addEventListener('keydown', emoteMenuKeydown, true);
    for (const type of MENU_GUARD_EVENTS) window.addEventListener(type, emoteMenuGuard, true);
  }

  // Records an image's hover frame when it differs from what it shows at rest,
  // so emoteWrapAnimate can swap between them under motion 'hover'.
  function setEmoteHoverSrc(img, emote, url) {
    const hoverUrl = emoteHoverUrl(emote);
    if (!hoverUrl || hoverUrl === url) return;
    img.dataset.kteSrc = url;
    img.dataset.kteAnimSrc = hoverUrl;
  }

  // Covers zero-width overlays too: they are images inside the same wrap.
  function emoteWrapAnimate(wrap, hover) {
    for (const img of wrap.querySelectorAll('img[data-kte-anim-src]')) {
      const url = safeUrl((hover ? img.dataset.kteAnimSrc : img.dataset.kteSrc) ?? '');
      if (url) img.src = url;
    }
  }

  function makeEmoteWrap(code, emote) {
    const url = emoteDisplayUrl(emote);
    const wrap = document.createElement('span');
    wrap.className = 'kte-wrap';
    setEmoteTooltip(wrap, code, emote.source, emoteHoverUrl(emote));
    wrap.addEventListener('mouseenter', () => {
      showTooltip(wrap);
      emoteWrapAnimate(wrap, true);
    });
    wrap.addEventListener('mouseleave', () => {
      hideTooltip();
      emoteWrapAnimate(wrap, false);
    });
    wrap.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      showEmoteMenu(e.clientX, e.clientY, code, emote);
    });

    if (!url) return document.createTextNode(code);

    const img = document.createElement('img');
    img.src = url;
    img.alt = code;
    img.className = 'kte-img';
    setEmoteHoverSrc(img, emote, url);
    img.addEventListener('error', () => {
      if (img._kteRetry) return;
      img._kteRetry = true;
      setTimeout(() => { img.src = url; }, 2000);
    });

    wrap.appendChild(img);
    return wrap;
  }

  function processTextNode(node) {
    const text = node.textContent;
    if (!text.trim()) return;

    const tokens = text.split(/(\s+)/);
    if (!tokens.some(t => emoteMap.has(t))) return;

    const frag = document.createDocumentFragment();
    let lastWrap = null; // anchor for zero-width overlays

    for (const token of tokens) {
      const emote = emoteMap.get(token);

      if (emote) {
        if (emote.zeroWidth && lastWrap) {
          // Overlay this image centred on the previous emote wrap.
          // The whitespace token that preceded the overlay is dropped: the
          // overlay is absolutely positioned, so that space renders as a stray
          // gap after the emote, and un-rendering the message (provider toggled
          // off) would leave it orphaned and grow the run by one space on every
          // render/un-render cycle.
          const prev = frag.lastChild;
          if (prev?.nodeType === Node.TEXT_NODE && !prev.textContent.trim()) frag.removeChild(prev);
          const zwUrl = emoteDisplayUrl(emote);
          if (!zwUrl) {
            // Same fallback makeEmoteWrap uses for a rejected URL: show the code
            // as text rather than dropping the token out of the message.
            frag.appendChild(document.createTextNode(token));
            lastWrap = null;
            continue;
          }
          const zw = document.createElement('img');
          zw.src = zwUrl;
          zw.alt = token;
          zw.className = 'kte-zw';
          setEmoteHoverSrc(zw, emote, zwUrl);
          zw.addEventListener('error', () => {
            if (zw._kteRetry) return;
            zw._kteRetry = true;
            setTimeout(() => { zw.src = zwUrl; }, 2000);
          });
          lastWrap.appendChild(zw);
          lastWrap.dataset.kteTip += ` + ${token}`;
          lastWrap.dataset.kteTipCode += ` + ${token}`;
          // Keep lastWrap — multiple ZW emotes can stack on the same base
        } else {
          const wrap = makeEmoteWrap(token, emote);
          frag.appendChild(wrap);
          // makeEmoteWrap falls back to a bare text node when safeUrl rejects the
          // emote's URL. Only an element can anchor a zero-width overlay.
          lastWrap = wrap.nodeType === Node.ELEMENT_NODE ? wrap : null;
        }
      } else {
        frag.appendChild(document.createTextNode(token));
        // Whitespace between emotes keeps the ZW chain alive ("POGGERS cvHazmat")
        if (token.trim()) lastWrap = null;
      }
    }

    node.parentNode.replaceChild(frag, node);
  }

  function processMessageEl(el) {
    const version = String(emoteVersion);
    if (el.dataset.kteVersion === version) return;
    el.dataset.kteVersion = version;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        // closest, not tagName — Kick nests both link and username text in spans.
        if (p.classList.contains('kte-wrap') || p.closest(SKIP_TEXT_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
  }

  function processAllVisible() {
    const seq = initSeq;
    const nodes = [...document.querySelectorAll(MSG_SELECTOR)];
    let i = 0;

    function step() {
      if (seq !== initSeq) return;
      const end = Math.min(i + 25, nodes.length);
      for (; i < end; i++) {
        if (nodes[i].isConnected) processMessageEl(nodes[i]);
      }
      if (i < nodes.length) RIC(step);
    }

    RIC(step);
  }

  // Turning a provider off has to put its already-rendered emotes back to text:
  // processing only ever goes text → image, so nothing else would undo them. Each
  // img's alt is its emote code — including every zero-width overlay stacked on
  // the wrap — so the original tokens reconstruct exactly. Clearing the version
  // mark and normalizing makes the element eligible for a clean reprocess.
  function unrenderEmoteWraps() {
    for (const el of document.querySelectorAll(MSG_SELECTOR)) {
      const wraps = el.querySelectorAll('.kte-wrap');
      if (!wraps.length) continue;
      for (const wrap of wraps) {
        const codes = [...wrap.querySelectorAll('img')].map(img => img.alt).filter(Boolean);
        wrap.replaceWith(document.createTextNode(codes.join(' ')));
      }
      el.normalize();
      delete el.dataset.kteVersion;
    }
  }

  function applyProviderSettings() {
    rebuildEmoteMap();
    rerenderEmotes();
  }

  // Puts every rendered chat emote back to text and renders it again from the
  // current emoteMap and motion setting, and refreshes an open autocomplete.
  function rerenderEmotes() {
    emoteVersion++;
    hideTooltip();
    unrenderEmoteWraps();
    queueVisibleEmoteRefresh(0);
    acRefreshOpen();
  }

  function queueVisibleEmoteRefresh(delay = 0) {
    if (visibleRefreshTimer) clearTimeout(visibleRefreshTimer);

    const seq = initSeq;
    visibleRefreshTimer = setTimeout(() => {
      visibleRefreshTimer = null;
      RIC(() => {
        if (seq !== initSeq) return;
        processAllVisible();
      });
    }, delay);
  }

  function processMessageTree(root) {
    if (root.matches?.(MSG_SELECTOR)) processMessageEl(root);
    root.querySelectorAll?.(MSG_SELECTOR).forEach(processMessageEl);
  }

  function queueProcessMessageTree(root) {
    if (!root?.isConnected) return;
    messageProcessQueue.push(root);
    if (messageProcessQueued) return;
    messageProcessQueued = true;

    const seq = initSeq;
    function drain() {
      if (seq !== initSeq) {
        messageProcessQueue = [];
        messageProcessQueued = false;
        return;
      }

      for (let i = 0; i < 20 && messageProcessQueue.length; i++) {
        const next = messageProcessQueue.shift();
        if (next?.isConnected) processMessageTree(next);
      }

      if (messageProcessQueue.length) RIC(drain);
      else messageProcessQueued = false;
    }

    RIC(drain);
  }

  function isOwnUINode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    return node.id === 'kte-picker-content'
      || node.id === 'kte-ac'
      || node.id === 'kte-menu'
      || node.id === CHAT_SETTINGS_ROW_ID
      || node.classList.contains('kte-wrap')
      || node.classList.contains('kte-panel-backdrop')
      || Boolean(node.closest?.(`#kte-picker-content, #kte-ac, #kte-menu, .kte-wrap, .kte-panel-backdrop, #${CHAT_SETTINGS_ROW_ID}`));
  }

  // ── Autocomplete ─────────────────────────────────────────────────────────

  function acFindInput() {
    for (const sel of INPUT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function acWordBeforeCursor(inputEl) {
    if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
      const before = inputEl.value.slice(0, inputEl.selectionStart ?? inputEl.value.length);
      return (before.match(/(\S+)$/) ?? [])[1] ?? '';
    }
    // contenteditable
    const sel = window.getSelection();
    if (!sel?.rangeCount) return '';
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';
    const before = node.textContent.slice(0, range.startOffset);
    return (before.match(/(\S+)$/) ?? [])[1] ?? '';
  }

  let acIndex = null;
  let acIndexVersion = -1;

  function acGetIndex() {
    if (acIndexVersion === emoteVersion && acIndex) return acIndex;
    acIndex = [];
    for (const [code, emote] of emoteMap) {
      acIndex.push({ code, lower: code.toLowerCase(), emote });
    }
    acIndex.sort((a, b) => a.code.length - b.code.length || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    acIndexVersion = emoteVersion;
    return acIndex;
  }

  const AC_RESULTS = 8;
  // Collect more candidates than displayed so usage ranking can promote a
  // frequently-used emote that index order (shortest name first) would drop.
  const AC_SCAN_CAP = 48;

  function acSearch(query) {
    if (query.length < 2) return [];
    const lower = query.toLowerCase();
    const index = acGetIndex();
    const prefix = [];
    const substr = [];
    for (const entry of index) {
      if (entry.lower.startsWith(lower)) {
        if (prefix.length < AC_SCAN_CAP) prefix.push(entry);
      } else if (substr.length < AC_SCAN_CAP && entry.lower.includes(lower)) {
        substr.push(entry);
      }
      if (prefix.length >= AC_SCAN_CAP && substr.length >= AC_SCAN_CAP) break;
    }
    // Favourites first, then most-used, within each group (stable sort keeps
    // the index order — shortest, then alphabetical — as tiebreak); prefix
    // matches always outrank substring matches.
    const byRank = (a, b) =>
      (Number(favHas(b.code)) - Number(favHas(a.code)))
      || (usageCount(b.code) - usageCount(a.code));
    prefix.sort(byRank);
    substr.sort(byRank);
    return prefix.concat(substr)
      .slice(0, AC_RESULTS)
      .map(entry => ({ code: entry.code, emote: entry.emote }));
  }

  function acHide() {
    acResizeObserver?.disconnect();
    window.removeEventListener('resize', acPosition);
    acDropdown?.remove();
    acDropdown = null;
    acFocusIdx = -1;
    acMatches = [];
    acInput = null;
  }

  let acResizeObserver = null;

  // (Re)position the open popup from the input's current rect: anchor to the
  // input's left edge, open upward, cap height to the space above the input,
  // and shift left if it would overflow the right viewport edge.
  function acPosition() {
    if (!acDropdown || !acInput?.isConnected) return;
    const rect = acInput.getBoundingClientRect();
    acDropdown.style.left = `${rect.left}px`;
    acDropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    acDropdown.style.maxHeight = `${Math.max(120, rect.top - 14)}px`;
    const overflow = acDropdown.getBoundingClientRect().right - (window.innerWidth - 8);
    if (overflow > 0) acDropdown.style.left = `${Math.max(8, rect.left - overflow)}px`;
  }

  // The chat pane can be resized without a window resize (dragging Kick's
  // divider), which moves the input under the fixed-position popup — track the
  // input's size too, not just the window.
  function acWatchReposition() {
    if (!acResizeObserver) acResizeObserver = new ResizeObserver(() => acPosition());
    acResizeObserver.observe(acInput);
    window.addEventListener('resize', acPosition, { passive: true });
  }

  function acRefreshOpen() {
    if (!acInput?.isConnected) return;
    const word = acWordBeforeCursor(acInput);
    const matches = acSearch(word);
    matches.length ? acRender(matches, acInput) : acHide();
  }

  function acSetFocus(idx) {
    acFocusIdx = idx;
    acDropdown?.querySelectorAll('.kte-ac-row').forEach((r, i) => {
      r.classList.toggle('kte-focused', i === acFocusIdx);
      if (i === acFocusIdx) r.scrollIntoView({ block: 'nearest' });
    });
  }

  function acCommit(code) {
    if (!acInput) return;
    // The edit below fires input, and acOnInput can close the popup and clear
    // acInput before this function is done with the editor.
    const editor = acInput;
    editor.focus();

    if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
      const pos = editor.selectionStart ?? editor.value.length;
      const head = editor.value.slice(0, pos).replace(/\S+$/, '');
      const tail = editor.value.slice(pos);
      editor.value = head + code + ' ' + tail;
      const newPos = head.length + code.length + 1;
      editor.setSelectionRange(newPos, newPos);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable — execCommand keeps Vue/React reactivity intact
      const sel = window.getSelection();
      let keep = 0; // leading characters of the word left in place, see below
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const offset = range.startOffset;
          const wordStart = node.textContent.slice(0, offset).search(/\S+$/);
          if (wordStart >= 0) {
            // Replacing all of a text node's text (a word that starts the
            // message) swaps the node out, and Lexical, Kick's editor, puts
            // the old one back: the word stayed as typed. Leave its first
            // character in place so the node survives; acFixFirstChar swaps
            // that one in a second edit.
            if (wordStart === 0 && offset === node.textContent.length) keep = 1;
            const wr = document.createRange();
            wr.setStart(node, wordStart + keep);
            wr.setEnd(node, offset);
            sel.removeAllRanges();
            sel.addRange(wr);
          }
        }
      }
      document.execCommand('insertText', false, code.slice(keep) + ' ');
      if (keep) acFixFirstChar(editor, code);
    }

    usageBump(code);
    acHide();
  }

  // The second half of acCommit for a word that started the message: the node
  // now reads its typed first character, then the rest of `code` and a space
  // ("lOL " for `lo` → LOL). Lexical takes a second edit only once it has
  // caught up with the first, so each step waits a tick; the caret then goes
  // back after the space, where the first edit left it.
  function acFixFirstChar(editor, code) {
    setTimeout(() => {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      if (node?.nodeType !== Node.TEXT_NODE || !editor.contains(node)) return;
      const text = node.textContent;
      if (text[0] === code[0] || !text.startsWith(code.slice(1) + ' ', 1)) return;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 1);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, code[0]);
      setTimeout(() => {
        const at = sel.anchorNode;
        if (at?.nodeType === Node.TEXT_NODE && editor.contains(at)) {
          sel.collapse(at, Math.min(code.length + 1, at.textContent.length));
        }
      }, 0);
    }, 0);
  }

  function acRender(matches, inputEl) {
    acHide();
    // Filter before storing: acMatches indexes into the rendered rows, so a row
    // skipped further down would make arrow-key focus commit the wrong emote.
    matches = matches.filter(m => safeUrl(m.emote.url));
    if (!matches.length) return;
    acMatches = matches;
    acInput = inputEl;

    const popup = document.createElement('div');
    popup.id = 'kte-ac';
    // Keep the chat input focused when interacting with the popup — a scrollbar
    // drag would otherwise blur the input and close the popup mid-scroll.
    popup.addEventListener('mousedown', e => e.preventDefault());

    const header = document.createElement('div');
    header.id = 'kte-ac-header';
    const t = uiText();
    header.textContent = t.acHeader;
    popup.appendChild(header);

    for (let i = 0; i < matches.length; i++) {
      const { code, emote } = matches[i];
      const row = document.createElement('div');
      row.className = 'kte-ac-row';

      const acUrl = emoteDisplayUrl(emote);
      const img = document.createElement('img');
      img.src = acUrl;
      img.alt = code;
      img.addEventListener('error', () => {
        if (img._kteRetry) return;
        img._kteRetry = true;
        setTimeout(() => { img.src = acUrl; }, 2000);
      });

      const nameEl = document.createElement('span');
      nameEl.className = 'kte-ac-code';
      nameEl.textContent = code;

      const srcEl = document.createElement('span');
      const srcName = sourceName(emote.source);
      srcEl.className = `kte-ac-src ${sourceClass(emote.source)}`;
      srcEl.textContent = srcName;

      row.append(img, nameEl);
      if (favHas(code)) {
        const favEl = document.createElement('span');
        favEl.className = 'kte-ac-fav';
        favEl.textContent = '★';
        row.appendChild(favEl);
      }
      row.appendChild(srcEl);
      row.addEventListener('mousedown', e => { e.preventDefault(); acCommit(code); });
      popup.appendChild(row);
    }

    const footer = document.createElement('div');
    footer.id = 'kte-ac-footer';
    footer.textContent = t.acHint;
    popup.appendChild(footer);

    overlayParent().appendChild(popup);
    acDropdown = popup;
    acPosition();
    acWatchReposition();
  }

  // Switching autocomplete off leaves the listeners attached and lets them
  // idle here: acOnKeydown does nothing without an open popup, so Tab and
  // Enter go straight to Kick.
  function acOnInput(e) {
    if (!settingsLoad().autocomplete) return;
    const word = acWordBeforeCursor(e.currentTarget);
    const matches = acSearch(word);
    matches.length ? acRender(matches, e.currentTarget) : acHide();
  }

  // Runs in window capture (see attachAutocomplete), ahead of every listener
  // Kick has, so a key the popup takes is stopped before Kick's editor sees
  // it: Lexical's own keydown listener sits on the editor itself, registered
  // before ours, and an Enter that picks a suggestion could reach it first and
  // send the half-typed message.
  function acOnKeydown(e) {
    if (!acDropdown || !acInput?.contains(e.target)) return;
    const take = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') { take(); acSetFocus(Math.min(acFocusIdx + 1, acMatches.length - 1)); }
    else if (e.key === 'ArrowUp') { take(); acSetFocus(Math.max(acFocusIdx - 1, 0)); }
    else if (e.key === 'Tab') {
      // No explicit focus → complete the top match (matches Twitch/7TV behaviour)
      const pick = acMatches[acFocusIdx >= 0 ? acFocusIdx : 0];
      if (pick) { take(); acCommit(pick.code); }
    }
    else if (e.key === 'Enter') {
      // An explicitly focused row means the user navigated to it — insert it
      // instead of sending. With no focus, let the message send, but close the
      // popup: Kick clears the Lexical editor programmatically, which fires no
      // input event, so the suggestions would hang around over an empty input.
      const pick = acFocusIdx >= 0 ? acMatches[acFocusIdx] : null;
      if (pick) { take(); acCommit(pick.code); }
      else acHide();
    }
    else if (e.key === 'Escape') { take(); acHide(); }
  }

  function attachAutocomplete(el) {
    if (el._kteAC) return;
    el._kteAC = true;
    el.addEventListener('input', acOnInput);
    // Lexical intercepts beforeinput for deletions so input doesn't always fire;
    // keyup is a reliable fallback for backspace/delete.
    el.addEventListener('keyup', e => {
      if (e.key === 'Backspace' || e.key === 'Delete') acOnInput(e);
    });
    el.addEventListener('blur', () => setTimeout(acHide, 150));
    log(uiText().autocomplete);
  }

  function attemptAcAttach() {
    if (attachedAcInput?.isConnected) return;
    const found = acFindInput();
    if (!found) return;
    attachAutocomplete(found);
    attachedAcInput = found;
  }

  // Forgets the previous channel's input and attaches to the current one if
  // it is already there. If it isn't yet, there is nothing to wait on here:
  // the chat observer, already watching the whole body, calls attemptAcAttach
  // whenever the tracked input is missing. This used to run a second
  // body-wide MutationObserver for the same job.
  function waitForInput() {
    attachedAcInput = null;
    attemptAcAttach();
  }

  // ── Settings panel ───────────────────────────────────────────────────────
  // Everything in kte_v2_settings in one modal card. Opened from the row in
  // Kick's chat settings menu and the userscript manager's menu; every change
  // applies at once, and the card re-renders from the store after each one.

  let panelBackdrop = null;
  // Clearing recents takes two clicks; this is the armed state in between.
  // Never survives a close, so the panel can't reopen one click from wiping.
  let panelConfirmClear = false;

  // The 7TV+ face as a line glyph in currentColor, for the header mark: the
  // siblings put a flat green icon on that tinted tile, and the filled tab
  // icon reads as a solid blob at 16px.
  function panelMarkIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '5.5 5.5 53 53');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const add = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      svg.appendChild(node);
    };
    const line = { fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round' };
    add('circle', { cx: '32', cy: '32', r: '22', ...line, 'stroke-width': '5' });
    add('circle', { cx: '24.5', cy: '27.5', r: '3.5', fill: 'currentColor' });
    add('path', { d: 'M36 27.5 Q39.5 24 43 27.5', ...line, 'stroke-width': '4.5' });
    add('path', { d: 'M22 38 Q32 48 42 38', ...line, 'stroke-width': '5' });
    return svg;
  }

  function panelSwitch(key, label, on, flip) {
    const row = panelEl('div', 'kte-switch-row');
    const toggle = panelEl('button', 'kte-switch');
    toggle.type = 'button';
    toggle.dataset.kteKey = key;
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-checked', String(on));
    toggle.addEventListener('click', () => {
      settingsUpdate(flip);
      settingsPanelRender();
    });
    row.append(panelEl('span', null, label), toggle);
    return row;
  }

  function panelEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function panelChip(label, on, onClick) {
    const chip = panelEl('button', 'kte-chip', label);
    chip.type = 'button';
    pickerChipState(chip, on);
    chip.addEventListener('click', onClick);
    return chip;
  }

  function panelGroup(label, ...children) {
    const group = panelEl('div', 'kte-panel-group');
    group.append(panelEl('div', 'kte-panel-label', label), ...children);
    return group;
  }

  function panelProviderChips(group, isOn, flip) {
    const row = panelEl('div', 'kte-panel-chips');
    for (const provider of PROVIDERS) {
      const chip = panelChip(provider, isOn(provider), () => {
        settingsUpdate(store => flip(store, provider));
        applyProviderSettings(); // hides the tooltip and re-renders chat
        pickerRefreshIfBuilt();
        settingsPanelRender();
      });
      chip.dataset.provider = provider;
      chip.dataset.kteKey = `${group}:${provider}`;
      row.appendChild(chip);
    }
    return row;
  }

  // Every change rebuilds the card, which removes the control that had focus
  // (sending focus to <body>, behind the modal) and any Recently used emote
  // the tooltip is anchored to. Each control carries a data-kte-key naming
  // it, so the rebuilt one takes focus back; the scroll position is kept too.
  function settingsPanelRender() {
    const card = panelBackdrop?.querySelector('#kte-panel');
    if (!card) return;
    const active = document.activeElement;
    const focusKey = active && card.contains(active) ? active.dataset?.kteKey : null;
    const scrollTop = card.scrollTop;
    if (tipAnchor && card.contains(tipAnchor)) hideTooltip();
    const store = settingsLoad();
    const t = uiText();
    card.textContent = '';

    const head = panelEl('div', 'kte-panel-head');
    const mark = panelEl('div', 'kte-panel-mark');
    mark.appendChild(panelMarkIcon());
    const titles = panelEl('div', 'kte-panel-titles');
    titles.appendChild(panelEl('div', 'kte-panel-title', chatSettingsRowLabel()));
    const close = panelEl('button', 'kte-panel-close', '✕');
    close.type = 'button';
    close.dataset.kteKey = 'close';
    close.setAttribute('aria-label', t.close);
    close.title = t.close;
    close.addEventListener('click', settingsPanelClose);
    head.append(mark, titles, close);
    card.appendChild(head);

    card.setAttribute('aria-label', chatSettingsRowLabel());
    card.appendChild(panelGroup(t.providers,
      panelProviderChips('providers', providerEnabled, (store, provider) => {
        store.providers[provider] = !store.providers[provider];
      }),
      panelEl('div', 'kte-panel-note', t.providersNote),
    ));

    card.appendChild(panelGroup(t.globals,
      panelProviderChips('globals', globalsEnabled, (store, provider) => {
        store.globals[provider] = !store.globals[provider];
      }),
      panelEl('div', 'kte-panel-note', t.globalsNote),
    ));

    const motionRow = panelEl('div', 'kte-panel-chips');
    for (const mode of MOTION_MODES) {
      const chip = panelChip(t[mode], store.motion === mode, () => {
        settingsUpdate(store => { store.motion = mode; });
        rerenderEmotes();
        pickerRefreshIfBuilt();
        settingsPanelRender();
      });
      chip.dataset.kteKey = `motion:${mode}`;
      motionRow.appendChild(chip);
    }
    const motionNote = prefersReducedMotion() ? t.reducedNote : t.bttvNote;
    card.appendChild(panelGroup(t.animated, motionRow, panelEl('div', 'kte-panel-note', motionNote)));

    const sizeRow = panelEl('div', 'kte-panel-chips');
    for (const size of Object.keys(EMOTE_SIZES)) {
      const chip = panelChip(t[size], store.size === size, () => {
        settingsUpdate(store => { store.size = size; });
        applyEmoteSize();
        hideTooltip(); // anchored to an emote that just changed size
        settingsPanelRender();
      });
      chip.dataset.kteKey = `size:${size}`;
      sizeRow.appendChild(chip);
    }
    card.appendChild(panelGroup(t.size, sizeRow));

    const switches = panelEl('div', 'kte-switches');
    switches.append(
      panelSwitch('autocomplete', t.suggest, store.autocomplete, next => {
        next.autocomplete = !next.autocomplete;
        if (!next.autocomplete) acHide();
      }),
      panelSwitch('preview', t.preview, store.preview, next => {
        next.preview = !next.preview;
      }),
    );
    card.appendChild(panelGroup(t.options, switches));

    const used = usageLoad().size;
    const clearRow = panelEl('div', 'kte-panel-chips');
    clearRow.style.gridTemplateColumns = panelConfirmClear ? 'repeat(2, minmax(0, 1fr))' : '1fr';
    const clear = panelChip(panelConfirmClear ? t.confirmClear : t.clear, panelConfirmClear, () => {
      if (!panelConfirmClear) {
        panelConfirmClear = true;
        settingsPanelRender();
        return;
      }
      panelConfirmClear = false;
      usageClear();
      pickerRefreshIfBuilt();
      acRefreshOpen();
      settingsPanelRender();
    });
    clear.classList.add('kte-chip-danger');
    clear.dataset.kteKey = 'clear';
    clear.disabled = !used;
    clearRow.appendChild(clear);
    if (panelConfirmClear) {
      const cancel = panelChip(t.cancel, false, () => {
        panelConfirmClear = false;
        settingsPanelRender();
      });
      cancel.dataset.kteKey = 'cancel';
      clearRow.appendChild(cancel);
    }
    const usedNote = !used ? t.usedNone
      : used === 1 && t.usedOne ? t.usedOne
      : t.usedNote.replace('{n}', String(used));
    const recent = pickerRecentEmotes('');
    card.appendChild(panelGroup(t.recent,
      ...(recent.length ? [panelRecentStrip(recent)] : []),
      panelEl('div', 'kte-panel-note', usedNote),
      clearRow,
    ));

    card.scrollTop = scrollTop;
    if (focusKey) panelFocusTarget(card, focusKey)?.focus({ preventScroll: true });
  }

  // The rebuilt control to focus after a render. Cancel is gone once used, so
  // its focus goes to the Clear button beside it; a control that is now
  // disabled (Clear, once there is nothing left to clear) hands it to Close,
  // which keeps focus inside the dialog.
  function panelFocusTarget(card, key) {
    const find = name => card.querySelector(`[data-kte-key="${name}"]:not(:disabled)`);
    return find(key) ?? (key === 'cancel' ? find('clear') : null) ?? find('close');
  }

  // The picker's Recently used emotes, to look at before clearing them: the
  // hover tooltip and animate-on-hover as in chat, but no click — the chat
  // input sits behind the modal.
  function panelRecentStrip(recent) {
    const strip = panelEl('div', 'kte-panel-recent');
    for (const { code, emote } of recent) {
      const url = emoteDisplayUrl(emote);
      if (!url) continue;
      const cell = panelEl('span', 'kte-panel-recent-emote');
      setEmoteTooltip(cell, code, emote.source, emoteHoverUrl(emote));
      if (favHas(code)) cell.dataset.kteFav = '1';
      const img = panelEl('img');
      img.src = url;
      img.alt = code;
      img.draggable = false;
      img.decoding = 'async';
      setEmoteHoverSrc(img, emote, url);
      cell.appendChild(img);
      cell.addEventListener('mouseenter', () => {
        showTooltip(cell);
        emoteWrapAnimate(cell, true);
      });
      cell.addEventListener('mouseleave', () => {
        hideTooltip();
        emoteWrapAnimate(cell, false);
      });
      strip.appendChild(cell);
    }
    return strip;
  }

  // Escape closes the panel, swallowed so the same press can't also close
  // something of Kick's. Only listening while the panel is open.
  function settingsPanelKeydown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    settingsPanelClose();
  }

  function settingsPanelOpen() {
    if (panelBackdrop) return;
    hideTooltip();
    hideEmoteMenu();
    panelBackdrop = panelEl('div', 'kte-panel-backdrop');
    const card = panelEl('div');
    card.id = 'kte-panel';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    panelBackdrop.addEventListener('click', e => {
      if (e.target === panelBackdrop) settingsPanelClose();
    });
    panelBackdrop.appendChild(card);
    overlayParent().appendChild(panelBackdrop);
    document.addEventListener('keydown', settingsPanelKeydown, true);
    settingsPanelRender();
    card.querySelector('.kte-panel-close')?.focus();
  }

  function settingsPanelClose() {
    panelConfirmClear = false;
    hideTooltip(); // may be anchored to a Recently used emote
    panelBackdrop?.remove();
    panelBackdrop = null;
    document.removeEventListener('keydown', settingsPanelKeydown, true);
  }

  // ── Chat settings row ────────────────────────────────────────────────────
  // A row in Kick's own chat settings menu (the gear beside Chat, signed-in
  // viewers only) that opens the settings panel. The menu is
  // #chat-settings-panel: an inline popover on desktop, a bottom drawer on
  // narrow screens, with the same list markup in both. Its top level is the
  // one list whose rows carry a ChevronRight icon — sub-pages have a
  // ChevronLeft back button and toggle rows instead. Kick re-renders the list
  // on every open and on coming back from a sub-page, so the chat observer
  // re-injects whenever the panel changes.

  const CHAT_SETTINGS_ROW_ID = 'kte-chat-settings-row';

  function chatSettingsMenuList(panel) {
    return panel?.querySelector('li svg[data-ds-icon="ChevronRight"]')?.closest('ul') ?? null;
  }

  // Kick's close button is the only one in the header with a Cross icon.
  function chatSettingsMenuClose(panel) {
    panel.querySelector('button svg[data-ds-icon="Cross"]')?.closest('button')?.click();
  }

  function chatSettingsRowOpen() {
    const panel = document.getElementById('chat-settings-panel');
    if (panel) chatSettingsMenuClose(panel);
    // A tick later, so the narrow-screen drawer has let go of focus and
    // pointer events before the panel opens over it.
    setTimeout(settingsPanelOpen, 0);
  }

  // Cloned from Kick's own row for the same reason as the picker tab: its
  // padding, hover and height are Tailwind classes a hand-written copy would
  // drift from.
  function chatSettingsBuildRow(template) {
    const row = template.cloneNode(true);
    for (const node of [row, ...row.querySelectorAll('[id], [data-testid]')]) {
      node.removeAttribute('id');
      node.removeAttribute('data-testid');
    }
    row.id = CHAT_SETTINGS_ROW_ID;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');

    const label = row.querySelector('span');
    if (label) {
      label.textContent = chatSettingsRowLabel();
      label.setAttribute('data-kick-family-label', '');
    }

    // Family look (2.15.10): tagged for the shared stylesheet (card, hover),
    // and Kick's chevron becomes the panel header's green icon tile.
    row.setAttribute('data-kick-family-row', '');
    const nativeIcon = row.querySelector('svg');
    if (nativeIcon) {
      const tile = document.createElement('span');
      tile.setAttribute('data-kick-family-tile', '');
      tile.setAttribute('aria-hidden', 'true');
      tile.appendChild(panelMarkIcon());
      nativeIcon.replaceWith(tile);
    }

    row.addEventListener('click', chatSettingsRowOpen);
    row.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      chatSettingsRowOpen();
    });
    return row;
  }

  // The row's label in Kick's language (2.16.0), English for any other.
  // Kept in step with kick-chat-utils' Moderation history row.
  const CHAT_SETTINGS_ROW_LABELS = Object.freeze({
    en: 'Third-party emotes',
    ar: 'رموز تعبيرية من جهات خارجية',
    bg: 'Емоути от трети страни',
    cs: 'Emoty třetích stran',
    da: 'Emotes fra tredjepart',
    de: 'Drittanbieter-Emotes',
    el: 'Emotes τρίτων',
    es: 'Emotes de terceros',
    fi: 'Kolmannen osapuolen emotet',
    fr: 'Emotes tierces',
    hu: 'Külső emote-ok',
    id: 'Emote pihak ketiga',
    it: 'Emote di terze parti',
    ja: 'サードパーティのエモート',
    ko: '서드파티 이모트',
    nl: 'Emotes van derden',
    no: 'Emotes fra tredjeparter',
    pl: 'Emotki zewnętrzne',
    pt: 'Emotes de terceiros',
    ro: 'Emote-uri terțe',
    ru: 'Сторонние эмоуты',
    sk: 'Emoty tretích strán',
    sv: 'Emotes från tredje part',
    th: 'อีโมตจากบุคคลที่สาม',
    tr: "Üçüncü taraf emote'lar",
    vi: 'Emote bên thứ ba',
    zh: '第三方表情',
  });
  // Kick's UI language, from <html lang> (Kick sets it from the viewer's
  // language: "cs", "pt", … — checked 2026-11-27 for the 28 it serves).
  function kickLang() {
    const lang = (document.documentElement && document.documentElement.lang) || '';
    return String(lang).toLowerCase().split('-')[0];
  }
  function chatSettingsRowLabel() {
    const lang = kickLang();
    return Object.hasOwn(CHAT_SETTINGS_ROW_LABELS, lang) ? CHAT_SETTINGS_ROW_LABELS[lang] : CHAT_SETTINGS_ROW_LABELS.en;
  }

  function chatSettingsInject(panel) {
    const list = chatSettingsMenuList(panel);
    if (!list) return;
    const existing = list.querySelector(`#${CHAT_SETTINGS_ROW_ID}`);
    if (existing) {
      // Kick can switch language without re-rendering a menu it keeps mounted.
      const label = existing.querySelector?.('[data-kick-family-label]');
      if (label) {
        const text = chatSettingsRowLabel();
        if (label.textContent !== text) label.textContent = text;
      }
      return;
    }
    // One of Kick's own rows, never another kick-* script's restyled one.
    const template = [...list.children].find(li =>
      !li.hasAttribute?.('data-kick-family-row') && li.querySelector('svg[data-ds-icon="ChevronRight"]'));
    if (!template) return;
    list.appendChild(chatSettingsBuildRow(template));
  }

  // ── Emote Picker ─────────────────────────────────────────────────────────

  const PICKER_PROVIDER_LIMIT = 40;
  const PICKER_RECENT_LIMIT = 16;
  const PICKER_INJECT_DELAY = 120;
  const PICKER_SEARCH_DELAY = 150;
  const PICKER_ROUTE_INJECT_DELAY = 700;
  const PICKER_APPEND_REFRESH_DELAY = 260;
  const PICKER_ACTIVE_PROVIDER_DEFER_WINDOW = 15000;
  const PICKER_DEFERRED_RETRY_DELAY = 2000;
  const ROUTE_CHAT_REFRESH_DELAY = 500;
  const PICKER_APPEND_CHUNK = 10;
  const PICKER_APPEND_DELAY = 24;
  const PICKER_IMAGE_LOAD_CHUNK = 4;
  const PICKER_IMAGE_LOAD_DELAY = 60;
  const PICKER_IMAGE_UNLOAD_DELAY = 250;
  const PICKER_IMAGE_VIEWPORT_BUFFER = 180;
  const PICKER_IMAGE_UNLOAD_BUFFER = 200;
  // Hard cap on simultaneously loaded picker images. Even within the unload
  // zone, anything past this count gets evicted (furthest from viewport first).
  // Has to be tight because in fullscreen the video player is already holding
  // a large GPU texture, so we share what's left with very little headroom.
  const PICKER_MAX_LOADED = 40;

  function pickerBuildButton(code, emote) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kte-picker-btn';
    btn.setAttribute('aria-label', uiText().insert.replace('{code}', code));
    btn.dataset.code = code;
    setEmoteTooltip(btn, code, emote.source, emoteHoverUrl(emote));
    if (favHas(code)) btn.dataset.kteFav = '1';

    const animUrl = safeUrl(emote.url);
    const staticUrl = emote.staticUrl ? safeUrl(emote.staticUrl) : null;
    const defaultUrl = staticUrl ?? animUrl;
    if (!defaultUrl) return null;
    const img = document.createElement('img');
    img.alt = code;
    img.draggable = false;
    img.decoding = 'async';
    img.setAttribute('fetchpriority', 'low');
    img.dataset.kteSrc = defaultUrl;
    // Static-by-default + animate-on-hover: only set kteAnimSrc when the static
    // and animated URLs actually differ (i.e. the provider serves a separate
    // frozen frame). Without that, the emote either is naturally static or has
    // no static variant available, so we just show whatever the default is.
    // With motion off (or under reduced motion) the still frame stays put on
    // hover too.
    if (motionMode() !== 'never' && staticUrl && animUrl && staticUrl !== animUrl) {
      img.dataset.kteAnimSrc = animUrl;
    }
    img.addEventListener('error', () => {
      if (img._kteRetry) return;
      img._kteRetry = true;
      setTimeout(() => {
        const retryUrl = safeUrl(img.dataset.kteSrc ?? '');
        if (retryUrl && img.dataset.kteLoaded === '1') img.src = retryUrl;
      }, 2000);
    });
    btn.appendChild(img);

    return btn;
  }

  function pickerHoverAnimate(btn, hover) {
    const img = btn.querySelector('img');
    if (!img?.dataset.kteAnimSrc || img.dataset.kteLoaded !== '1') return;
    if (hover) {
      const animUrl = safeUrl(img.dataset.kteAnimSrc);
      if (animUrl) img.src = animUrl;
    } else {
      const baseUrl = safeUrl(img.dataset.kteSrc ?? '');
      if (baseUrl) img.src = baseUrl;
    }
  }

  function pickerLoadImage(img) {
    if (img.dataset.kteLoaded === '1') return;
    const url = safeUrl(img.dataset.kteSrc ?? '');
    if (!url) return;
    img.dataset.kteLoaded = '1';
    img.src = url;
  }

  function pickerPumpImageQueue(content) {
    if (!content || content._kteImageLoading || !content._kteImageQueue?.length) return;
    content._kteImageLoading = true;

    function step() {
      content._kteImagePumpTimer = null;
      if (!content.isConnected || content.dataset.kteStale === '1') {
        content._kteImageQueue = [];
        content._kteImageLoading = false;
        return;
      }
      if (content.hidden) {
        content._kteImageLoading = false;
        return;
      }

      const batch = content._kteImageQueue.splice(0, PICKER_IMAGE_LOAD_CHUNK);
      batch.forEach(pickerLoadImage);

      if (content._kteImageQueue.length) {
        content._kteImagePumpTimer = setTimeout(step, PICKER_IMAGE_LOAD_DELAY);
      } else {
        content._kteImageLoading = false;
        // Initial IO callback can queue more than the hard cap. The scroll-based
        // unload pass only fires on scroll, so run cap enforcement once after
        // the pump drains to bound memory even when the user never scrolls.
        if (content._kteImageScrollTarget) {
          pickerEvictFarOrCapped(content, content._kteImageScrollTarget);
        }
      }
    }

    requestAnimationFrame(step);
  }

  function pickerFindImageViewport(content) {
    const panel = content?.closest?.('#chat-emotes-picker-panel');
    let el = content?.parentElement;
    while (el && el !== panel) {
      const className = typeof el.className === 'string' ? el.className : '';
      const overflowY = getComputedStyle(el).overflowY;
      if (className.includes('overflow-y-auto') || className.includes('overflow-y-scroll') || /auto|scroll/.test(overflowY)) {
        return el;
      }
      el = el.parentElement;
    }
    return panel ?? content;
  }

  function pickerActiveImageViewport(content, fallback) {
    if (!content) return fallback;
    return content.scrollHeight > content.clientHeight + 1
      ? content
      : (fallback ?? pickerFindImageViewport(content));
  }

  function pickerUnloadImg(img) {
    img.removeAttribute('src');
    delete img.dataset.kteLoaded;
    delete img.dataset.kteQueued;
    delete img._kteRetry;
  }

  function pickerEvictFarOrCapped(content, viewport) {
    if (!content || content.hidden) return;
    const viewportRect = viewport?.getBoundingClientRect?.() ?? { top: 0, bottom: window.innerHeight };
    const unloadTop = viewportRect.top - PICKER_IMAGE_UNLOAD_BUFFER;
    const unloadBottom = viewportRect.bottom + PICKER_IMAGE_UNLOAD_BUFFER;
    const center = (viewportRect.top + viewportRect.bottom) / 2;
    const survivors = [];
    content.querySelectorAll('img[data-kte-loaded="1"]').forEach(img => {
      const rect = (img.parentElement ?? img).getBoundingClientRect();
      if (rect.bottom < unloadTop || rect.top > unloadBottom) {
        pickerUnloadImg(img);
        return;
      }
      survivors.push({ img, dist: Math.abs((rect.top + rect.bottom) / 2 - center) });
    });
    if (survivors.length > PICKER_MAX_LOADED) {
      survivors.sort((a, b) => b.dist - a.dist);
      for (let i = 0; i < survivors.length - PICKER_MAX_LOADED; i++) {
        pickerUnloadImg(survivors[i].img);
      }
    }
  }

  function pickerObserveButton(content, btn) {
    if (!content?._kteLoadObserver) return;
    const img = btn.querySelector('img');
    if (!img || img._kteObserved) return;
    img._kteObserved = true;
    content._kteLoadObserver.observe(img);
  }

  function pickerDetachImageLoader(content) {
    if (!content) return;
    if (content._kteImageScrollTarget && content._kteImageScrollHandler) {
      content._kteImageScrollTarget.removeEventListener('scroll', content._kteImageScrollHandler);
      window.removeEventListener('resize', content._kteImageScrollHandler);
    }
    content._kteLoadObserver?.disconnect();
    content._kteLoadObserver = null;
    if (content._kteImageUnloadTimer) clearTimeout(content._kteImageUnloadTimer);
    if (content._kteImagePumpTimer) clearTimeout(content._kteImagePumpTimer);
    if (content._kteImageScrollTarget && content._kteScrollContainValue !== undefined) {
      content._kteImageScrollTarget.style.overscrollBehavior = content._kteScrollContainValue;
    }
    content._kteImageScrollTarget = null;
    content._kteImageScrollHandler = null;
    content._kteImageUnloadTimer = null;
    content._kteImagePumpTimer = null;
    content._kteImageViewportFallback = null;
    content._kteScrollContainValue = undefined;
    content._kteImageLoading = false;
    if (activePickerImageLoader === content) activePickerImageLoader = null;
  }

  function pickerAttachImageLoader(content, viewport = pickerFindImageViewport(content)) {
    if (!content) return;
    content._kteImageViewportFallback = viewport;
    viewport = pickerActiveImageViewport(content, viewport);
    if (!viewport) return;

    if (content._kteImageScrollTarget === viewport && content._kteImageScrollHandler) {
      // Same viewport — IntersectionObserver is already wired up. Just observe
      // any imgs added since attach (e.g. Load more chunks).
      if (content._kteLoadObserver) {
        content.querySelectorAll('.kte-picker-btn img[data-kte-src]').forEach(img => {
          if (img._kteObserved) return;
          img._kteObserved = true;
          content._kteLoadObserver.observe(img);
        });
      }
      return;
    }

    pickerDetachImageLoader(content);
    content._kteImageViewportFallback = viewport === content ? pickerFindImageViewport(content) : viewport;
    content._kteScrollContainValue = viewport.style.overscrollBehavior;
    viewport.style.overscrollBehavior = 'contain';

    // IntersectionObserver tracks visible buttons natively — no per-scroll DOM
    // walk. The browser only fires our callback for buttons whose visibility
    // actually changed, so scrolling a fully-expanded "Load all" grid stays
    // O(1) in our code regardless of total button count.
    if (!content._kteImageQueue) content._kteImageQueue = [];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const img = entry.target;
        if (!img.dataset.kteSrc) continue;
        if (entry.isIntersecting) {
          if (img.dataset.kteLoaded === '1' || img.dataset.kteQueued === '1') continue;
          img.dataset.kteQueued = '1';
          content._kteImageQueue.push(img);
        } else if (img.dataset.kteQueued === '1') {
          delete img.dataset.kteQueued;
          const idx = content._kteImageQueue.indexOf(img);
          if (idx >= 0) content._kteImageQueue.splice(idx, 1);
        }
      }
      pickerPumpImageQueue(content);
    }, { root: viewport, rootMargin: `${PICKER_IMAGE_VIEWPORT_BUFFER}px` });
    content._kteLoadObserver = observer;
    content.querySelectorAll('.kte-picker-btn img[data-kte-src]').forEach(img => {
      img._kteObserved = true;
      observer.observe(img);
    });

    // Unload throttle: periodically evict far-from-viewport images and enforce
    // the hard cap. Runs at most once per PICKER_IMAGE_UNLOAD_DELAY during
    // scroll. The actual visibility-tracking is the IO above; this just bounds
    // memory.
    const schedule = () => {
      if (content._kteImageUnloadTimer) return;
      content._kteImageUnloadTimer = setTimeout(() => {
        content._kteImageUnloadTimer = null;
        pickerEvictFarOrCapped(content, viewport);
      }, PICKER_IMAGE_UNLOAD_DELAY);
    };

    content._kteImageScrollTarget = viewport;
    content._kteImageScrollHandler = schedule;
    viewport.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    if (activePickerImageLoader && activePickerImageLoader !== content) {
      pickerDetachImageLoader(activePickerImageLoader);
    }
    activePickerImageLoader = content;
  }

  function pickerAppendButtons(grid, emotes, start, end) {
    const frag = document.createDocumentFragment();
    const newButtons = [];
    for (let i = start; i < end; i++) {
      const { code, emote } = emotes[i];
      const btn = pickerBuildButton(code, emote);
      if (btn) {
        frag.appendChild(btn);
        newButtons.push(btn);
      }
    }
    grid.appendChild(frag);
    const content = grid.closest('#kte-picker-content');
    if (content?._kteLoadObserver) {
      for (const btn of newButtons) pickerObserveButton(content, btn);
    }
  }

  function pickerAppendButtonsChunked(grid, emotes, start, end, onChunk, onDone) {
    let index = start;

    function step() {
      if (!grid.isConnected) {
        onDone?.();
        return;
      }
      const next = Math.min(index + PICKER_APPEND_CHUNK, end);
      pickerAppendButtons(grid, emotes, index, next);
      index = next;
      onChunk?.(index);

      if (index < end) {
        setTimeout(() => RIC(step), PICKER_APPEND_DELAY);
      } else {
        onDone?.();
      }
    }

    RIC(step);
  }

  function pickerMarkContentStale(content) {
    if (content) {
      pickerDetachImageLoader(content);
      pickerDetachSettingsAutoHide(content);
      content.querySelectorAll('img[data-kte-loaded="1"]').forEach(img => {
        img.removeAttribute('src');
        delete img.dataset.kteLoaded;
        delete img.dataset.kteQueued;
        delete img._kteRetry;
      });
      content.dataset.kteStale = '1';
      content._kteImageQueue = [];
      content._kteImageLoading = false;
      content._kteAppendingMore = false;
      content._kteRefreshAfterAppend = false;
      content._kteDeferredProviderRefresh = false;
    }
  }

  // How many emotes each section showed, by label, so a rebuild (a star, a
  // provider refresh, another tab's insert) doesn't fold expanded groups back.
  function pickerShownCounts(content) {
    const counts = new Map();
    content?.querySelectorAll('.kte-picker-section[data-kte-shown]').forEach(section => {
      const shown = Number(section.dataset.kteShown);
      if (section.dataset.kteLabel && Number.isInteger(shown)) counts.set(section.dataset.kteLabel, shown);
    });
    return counts;
  }

  // A remembered count, clamped to what the section has now. Never below the
  // first page: the group may have grown since, and that page is the floor.
  function pickerRestoredShown(saved, total) {
    const base = Math.min(PICKER_PROVIDER_LIMIT, total);
    return Number.isInteger(saved) && saved > base ? Math.min(saved, total) : base;
  }

  // Count line, Load more and Show less for a section that starts trimmed to
  // PICKER_PROVIDER_LIMIT. Built right after the first page is appended, so
  // the grid's current child count is what Show less trims back to
  // (pickerBuildButton skips emotes whose URL fails safeUrl, so it can differ
  // from the limit). Anything past the first page up to `restoreTo` is added
  // here, at once: it is a group the user had already loaded.
  function pickerBuildFooter(section, grid, emotes, restoreTo) {
    const baseShown = PICKER_PROVIDER_LIMIT;
    const baseCount = grid.children.length;
    let shown = baseShown;
    if (restoreTo > shown) {
      pickerAppendButtons(grid, emotes, shown, restoreTo);
      shown = restoreTo;
    }

    const t = uiText();
    const footer = document.createElement('div');
    footer.className = 'kte-picker-footer';
    const limitEl = document.createElement('p');
    limitEl.className = 'kte-picker-limit';

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'kte-picker-more';
    more.textContent = t.loadMore;
    more.setAttribute('aria-label', t.loadMoreLabel);

    const less = document.createElement('button');
    less.type = 'button';
    less.className = 'kte-picker-less';
    less.textContent = t.showLess;
    less.setAttribute('aria-label', t.showLessLabel);

    function sync() {
      limitEl.textContent = t.showing.replace('{shown}', String(shown)).replace('{total}', String(emotes.length));
      section.dataset.kteShown = String(shown);
      more.hidden = shown >= emotes.length;
      less.hidden = shown <= baseShown;
    }

    more.addEventListener('mousedown', e => e.preventDefault());
    more.addEventListener('click', () => {
      const next = Math.min(shown + PICKER_PROVIDER_LIMIT, emotes.length);
      more.disabled = true;
      less.disabled = true;
      more.textContent = t.loading;
      const content = grid.closest('#kte-picker-content');
      if (content) content._kteAppendingMore = true;

      pickerAppendButtonsChunked(grid, emotes, shown, next, current => {
        shown = current;
        sync();
        pickerAttachImageLoader(content, content?._kteImageViewportFallback ?? content?._kteImageScrollTarget);
      }, () => {
        if (content) {
          content._kteAppendingMore = false;
          if (content._kteRefreshAfterAppend) {
            content._kteRefreshAfterAppend = false;
            const panel = content.closest('#chat-emotes-picker-panel');
            if (panel) queuePickerInject(panel, PICKER_APPEND_REFRESH_DELAY);
          }
        }
        if (!more.isConnected) return;
        more.disabled = false;
        less.disabled = false;
        more.textContent = t.loadMore;
        sync();
      });
    });

    less.addEventListener('mousedown', e => e.preventDefault());
    less.addEventListener('click', () => {
      const content = grid.closest('#kte-picker-content');
      hideTooltip();
      while (grid.children.length > baseCount) {
        const btn = grid.lastElementChild;
        const img = btn.querySelector('img');
        if (img) {
          content?._kteLoadObserver?.unobserve(img);
          const idx = content?._kteImageQueue?.indexOf(img) ?? -1;
          if (idx >= 0) content._kteImageQueue.splice(idx, 1);
          pickerUnloadImg(img);
        }
        btn.remove();
      }
      shown = baseShown;
      sync();
      // The footer was just below a long grid; bring it back under the cursor
      // instead of leaving the view scrolled into the next section.
      footer.scrollIntoView({ block: 'nearest' });
      more.focus({ preventScroll: true });
    });

    // The pair wraps as one, under the count, when the picker is narrow.
    const actions = document.createElement('div');
    actions.className = 'kte-picker-actions';
    actions.append(more, less);
    footer.append(limitEl, actions);
    sync();
    return footer;
  }

  function pickerInsert(code) {
    const el = acFindInput();
    if (!el) return;
    el.focus();
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const pos = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, pos);
      const after = el.value.slice(pos);
      const gap = before && !before.endsWith(' ') ? ' ' : '';
      const insert = gap + code + ' ';
      el.value = before + insert + after;
      const newPos = before.length + insert.length;
      el.setSelectionRange(newPos, newPos);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const sel = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      const before = range?.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.textContent.slice(0, range.startOffset)
        : '';
      const gap = before && !/\s$/.test(before) ? ' ' : '';
      document.execCommand('insertText', false, gap + code + ' ');
    }
    usageBump(code);
  }

  function pickerBuildGrid() {
    const grid = document.createElement('div');
    grid.className = 'kte-picker-grid';
    grid.addEventListener('mousedown', e => { if (e.target.closest('.kte-picker-btn')) e.preventDefault(); });
    grid.addEventListener('mouseover', e => {
      const b = e.target.closest('.kte-picker-btn');
      if (b && grid.contains(b)) {
        showTooltip(b);
        pickerHoverAnimate(b, true);
      }
    });
    grid.addEventListener('mouseout', e => {
      const b = e.target.closest('.kte-picker-btn');
      if (b && !b.contains(e.relatedTarget)) {
        hideTooltip();
        pickerHoverAnimate(b, false);
      }
    });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.kte-picker-btn');
      if (b?.dataset.code) pickerInsert(b.dataset.code);
    });
    // Same menu as chat emotes — starring is the point, but copy/open work too.
    grid.addEventListener('contextmenu', e => {
      const b = e.target.closest('.kte-picker-btn');
      const emote = b?.dataset.code ? emoteMap.get(b.dataset.code) : null;
      if (!emote) return;
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      showEmoteMenu(e.clientX, e.clientY, b.dataset.code, emote);
    });
    return grid;
  }

  // `key` names the section for the shown-count restore (pickerShownCounts),
  // so it stays the same whatever language `label` is in.
  function pickerBuildSection(label, emotes, savedShown, key = label) {
    const section = document.createElement('div');
    section.className = 'kte-picker-section grid gap-2';
    section.dataset.kteLabel = key;

    const hdr = document.createElement('span');
    hdr.className = 'kte-picker-provider text-xs font-medium text-neutral-400';
    hdr.textContent = `${label} (${emotes.length})`;
    section.appendChild(hdr);

    const grid = pickerBuildGrid();
    const shown = Math.min(PICKER_PROVIDER_LIMIT, emotes.length);
    pickerAppendButtons(grid, emotes, 0, shown);
    section.appendChild(grid);

    if (shown < emotes.length) {
      section.appendChild(pickerBuildFooter(section, grid, emotes, pickerRestoredShown(savedShown, emotes.length)));
    }
    return section;
  }

  // Starred emotes still present in the current emote set, newest star first,
  // filtered by the active picker search.
  function pickerFavouriteEmotes(lowerQuery) {
    const favourites = [];
    for (const code of favCodes()) {
      if (lowerQuery && !code.toLowerCase().includes(lowerQuery)) continue;
      const emote = emoteMap.get(code);
      if (emote) favourites.push({ code, emote });
    }
    return favourites;
  }

  // Most recently inserted emotes still present in the current emote set,
  // filtered by the active picker search.
  function pickerRecentEmotes(lowerQuery) {
    const byRecency = [...usageLoad().entries()].sort((a, b) => b[1].t - a[1].t);
    const recent = [];
    for (const [code] of byRecency) {
      if (recent.length === PICKER_RECENT_LIMIT) break;
      if (lowerQuery && !code.toLowerCase().includes(lowerQuery)) continue;
      const emote = emoteMap.get(code);
      if (emote) recent.push({ code, emote });
    }
    return recent;
  }

  function pickerChipState(chip, on) {
    chip.dataset.on = on ? '1' : '0';
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function pickerBuildChip(label, tip) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'kte-chip';
    chip.textContent = label;
    chip.dataset.kteTip = tip;
    chip.addEventListener('mouseenter', () => showTooltip(chip));
    chip.addEventListener('mouseleave', hideTooltip);
    // Keep the chat input focused, same as the grid buttons and Load more.
    chip.addEventListener('mousedown', e => e.preventDefault());
    return chip;
  }

  // Settings row pinned to the top of the tab: which providers render. Toggles
  // apply immediately — no reload, no channel change.
  function pickerBuildSettings() {
    const row = document.createElement('div');
    row.className = 'kte-picker-settings';

    for (const provider of PROVIDERS) {
      const chip = pickerBuildChip(provider, uiText().chipTip.replace('{provider}', provider));
      chip.dataset.provider = provider;
      pickerChipState(chip, providerEnabled(provider));
      chip.addEventListener('click', () => {
        settingsUpdate(store => { store.providers[provider] = !store.providers[provider]; });
        applyProviderSettings(); // hides the tooltip and re-renders chat
        // The section list changes, so the tab content has to be rebuilt.
        const panel = document.getElementById('chat-emotes-picker-panel');
        if (panel) {
          pickerRefreshContent(panel);
          pickerApplyActiveState(panel);
        }
      });
      row.appendChild(chip);
    }

    return row;
  }

  // The settings row is sticky, so once the grid scrolls it would cover the top
  // row of emotes. Hide it while the tab is scrolled away from the top and bring
  // it back on return. Observing a sentinel instead of listening for scroll keeps
  // this working for either scroller — the tab's own overflow, and Kick's panel
  // scroller when the tab itself isn't the one scrolling.
  function pickerAttachSettingsAutoHide(content) {
    if (!content || content._kteSettingsObserver) return;
    const sentinel = content.querySelector('.kte-settings-sentinel');
    const row = content.querySelector('.kte-picker-settings');
    if (!sentinel || !row) return;
    const observer = new IntersectionObserver(entries => {
      const atTop = entries[entries.length - 1].isIntersecting;
      row.dataset.kteHidden = atTop ? '0' : '1';
      if (!atTop) hideTooltip(); // a chip tooltip would outlive the row otherwise
    });
    observer.observe(sentinel);
    content._kteSettingsObserver = observer;
  }

  function pickerDetachSettingsAutoHide(content) {
    content?._kteSettingsObserver?.disconnect();
    if (content) content._kteSettingsObserver = null;
  }

  function pickerBuildContent(query, savedShown = new Map()) {
    const wrap = document.createElement('div');
    wrap.id = 'kte-picker-content';
    const sentinel = document.createElement('div');
    sentinel.className = 'kte-settings-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    wrap.appendChild(sentinel);
    wrap.appendChild(pickerBuildSettings());
    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'grid gap-2';

    const t = uiText();
    const lower = (query ?? '').trim().toLowerCase();
    const groups = new Map();
    for (const [code, emote] of emoteMap) {
      if (lower && !code.toLowerCase().includes(lower)) continue;
      const source = sourceName(emote.source);
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push({ code, emote });
    }

    const orderedGroups = [...groups.entries()].sort(([a], [b]) => {
      const ai = PROVIDERS.includes(a) ? PROVIDERS.indexOf(a) : PROVIDERS.length;
      const bi = PROVIDERS.includes(b) ? PROVIDERS.indexOf(b) : PROVIDERS.length;
      return ai - bi || (a < b ? -1 : a > b ? 1 : 0);
    });

    let any = false;

    const favourites = pickerFavouriteEmotes(lower);
    if (favourites.length) {
      any = true;
      sectionsContainer.appendChild(pickerBuildSection(t.favourites, favourites, savedShown.get('Favourites'), 'Favourites'));
    }

    const recent = pickerRecentEmotes(lower);
    if (recent.length) {
      any = true;
      sectionsContainer.appendChild(pickerBuildSection(t.recent, recent, savedShown.get('Recently used'), 'Recently used'));
    }

    for (const [source, emotes] of orderedGroups) {
      if (!emotes.length) continue;
      any = true;
      emotes.sort(pickerCompareEmotes(lower));
      sectionsContainer.appendChild(pickerBuildSection(source, emotes, savedShown.get(source)));
    }

    if (!any) {
      const msg = document.createElement('p');
      msg.className = 'kte-picker-empty';
      msg.textContent = pickerEmptyMessage(query);
      wrap.appendChild(msg);
    } else {
      wrap.appendChild(sectionsContainer);
    }
    return wrap;
  }

  // Provider groups are alphabetical. Under a search, an exact match comes
  // first, then names that start with the query, then the rest — the same
  // prefix-first order autocomplete uses, so `pog` puts POGGERS ahead of
  // AYAYApog.
  function pickerCompareEmotes(lowerQuery) {
    const rank = code => {
      if (!lowerQuery) return 0;
      const lower = code.toLowerCase();
      return lower === lowerQuery ? 0 : lower.startsWith(lowerQuery) ? 1 : 2;
    };
    return (a, b) => rank(a.code) - rank(b.code)
      || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  }

  function pickerEmptyMessage(query) {
    const t = uiText();
    if (query) return t.emptySearch;
    const shown = PROVIDERS.filter(provider => providerEnabled(provider));
    if (!shown.length) return t.emptyHidden;
    if (!emotesSettled) return t.emptyLoading;
    if (shown.some(provider => !globalsEnabled(provider))) return t.emptyGlobalsOff;
    return t.emptyChannel;
  }

  function pickerCommonAncestor(a, b, limit) {
    let el = a;
    while (el && el !== limit) {
      if (el.contains(b)) return el;
      el = el.parentElement;
    }
    return null;
  }

  function pickerFindScrollViewport(mainGrid, panel) {
    let el = mainGrid;
    while (el && el !== panel) {
      const className = typeof el.className === 'string' ? el.className : '';
      const overflowY = getComputedStyle(el).overflowY;
      if (className.includes('overflow-y-auto') || className.includes('overflow-y-scroll') || /auto|scroll/.test(overflowY)) {
        return el;
      }
      el = el.parentElement;
    }
    return panel;
  }

  function pickerFindParts(panel) {
    const tabButtons = [...panel.querySelectorAll('button[data-active]')];
    const tabsRow = tabButtons
      .map(button => button.parentElement)
      .find(row => row && row.querySelectorAll(':scope > button[data-active]').length >= 2)
      ?? tabButtons[0]?.parentElement;
    if (!tabsRow) return null;

    const searchInput = panel.querySelector('#search-emotes-input');
    let header = searchInput ? pickerCommonAncestor(searchInput, tabsRow, panel) : null;
    let mainGrid = header?.parentElement ?? null;

    if (!header || !mainGrid || header === panel) {
      const scrollable = panel.querySelector('[class*="overflow-y-auto"]');
      mainGrid = scrollable?.firstElementChild ?? null;
      header = mainGrid ? [...mainGrid.children].find(child => child.contains(tabsRow)) : null;
    }

    if (!header || !mainGrid || header === panel || !mainGrid.contains(header)) return null;
    return {
      tabsRow,
      header,
      mainGrid,
      searchInput,
      scrollViewport: pickerFindScrollViewport(mainGrid, panel),
    };
  }

  function pickerNativeViews(parts, pickerContent) {
    return [...parts.mainGrid.children].filter(child => (
      child !== parts.header && child !== pickerContent
    ));
  }

  function pickerRefreshContent(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return null;

    const oldContent = panel.querySelector('#kte-picker-content');
    const keepScroll = oldContent?.dataset.kteChannel === (channelSlug ?? '');
    const scrollTop = keepScroll ? oldContent.scrollTop : 0;

    const tab = panel.querySelector('#kte-picker-tab');
    const active = tab?.getAttribute('data-active') === 'true';

    const query = parts.searchInput?.value ?? '';
    // Expanded groups survive a rebuild of the same view; a new channel or
    // search starts every group at its first page again.
    const sameView = keepScroll && oldContent.dataset.kteQuery === query.trim().toLowerCase();
    const content = pickerBuildContent(query, sameView ? pickerShownCounts(oldContent) : undefined);
    content.dataset.kteChannel = channelSlug ?? '';
    content.dataset.kteQuery = query.trim().toLowerCase();
    content.dataset.kteEmoteVersion = String(emoteVersion);
    content.hidden = !active;

    if (oldContent) {
      pickerMarkContentStale(oldContent);
      oldContent.replaceWith(content);
    }
    else parts.mainGrid.appendChild(content);
    pickerAttachSettingsAutoHide(content);

    if (!content.hidden) {
      content.scrollTop = scrollTop;
      pickerAttachImageLoader(content, parts.scrollViewport);
    }
    return content;
  }

  function pickerIsActive(panel) {
    return panel.querySelector('#kte-picker-tab')?.getAttribute('data-active') === 'true';
  }

  function pickerApplyActiveState(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return;

    const tab = panel.querySelector('#kte-picker-tab');
    const content = panel.querySelector('#kte-picker-content');
    const active = tab?.getAttribute('data-active') === 'true';

    if (content) {
      content.hidden = !active;
      if (!active) {
        content.style.height = '';
        if (content._kteDeferredProviderRefresh) {
          pickerMarkContentStale(content);
          content.remove();
        } else {
          pickerDetachImageLoader(content);
        }
      } else {
        pickerAttachImageLoader(content, parts.scrollViewport);
      }
    }
    for (const child of pickerNativeViews(parts, content)) {
      if (active) {
        child.dataset.kteNativeHidden = '1';
        child.hidden = true;
      } else if (child.dataset.kteNativeHidden === '1') {
        child.hidden = false;
        delete child.dataset.kteNativeHidden;
      }
    }
  }

  function queueProviderPickerRefresh() {
    const panel = document.getElementById('chat-emotes-picker-panel');
    const content = panel?.querySelector('#kte-picker-content');
    const active = panel ? pickerIsActive(panel) : false;
    const deferActiveRefresh = active && content
      && (Date.now() - lastNavigationAt < PICKER_ACTIVE_PROVIDER_DEFER_WINDOW
        || content._kteAppendingMore
        || content._kteImageLoading
        || Boolean(content._kteImageQueue?.length));

    if (deferActiveRefresh) {
      content._kteDeferredProviderRefresh = true;
      // Only another provider resolving would call this again. If this was the
      // last one and the user stays on the tab, the picker would keep showing
      // the pre-refresh set — re-check once the defer reason has had time to
      // clear (the navigation window expires; appends and image loads finish).
      if (!pickerDeferredRefreshTimer) {
        const seq = initSeq;
        pickerDeferredRefreshTimer = setTimeout(() => {
          pickerDeferredRefreshTimer = null;
          if (seq === initSeq) queueProviderPickerRefresh();
        }, PICKER_DEFERRED_RETRY_DELAY);
      }
      return;
    }

    queuePickerInject(panel, pickerProviderInjectDelay());
  }

  function pickerSetActive(panel, active, refresh = false) {
    const tab = panel.querySelector('#kte-picker-tab');
    if (!tab) return;

    if (active) {
      panel.querySelectorAll('button[data-active="true"]').forEach(button => {
        if (button !== tab) button.setAttribute('data-active', 'false');
      });
    }

    tab.setAttribute('data-active', active ? 'true' : 'false');
    if (refresh) pickerRefreshContent(panel);
    pickerApplyActiveState(panel);
  }

  // The project icon (`icon.svg`) — the same winking face, minus its dark rounded
  // plate, since the tab icons sit on the panel background and the buttons round
  // them anyway (`[&_svg]:rounded-full`, which would shave a plate's corners off).
  // The path data below is icon.svg's, unchanged; keep the two in step. Only the
  // viewBox differs: it crops to just outside the face (which spans 10-54) so the
  // circle fills ~83% of the icon box. Kick's own emote icons are images with
  // their own transparent margin, so a face drawn edge to edge reads too large.
  // Widen the crop to shrink the face, tighten it to grow it.
  function pickerBuildTabIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '5.5 5.5 53 53');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const add = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
      svg.appendChild(node);
    };

    add('circle', { cx: '32', cy: '32', r: '22', fill: '#22c55e' });
    add('circle', { cx: '24.5', cy: '27.5', r: '3.5', fill: '#101013' });
    add('path', {
      d: 'M36 27.5 Q39.5 24 43 27.5',
      fill: 'none', stroke: '#101013', 'stroke-width': '3.5', 'stroke-linecap': 'round',
    });
    add('path', {
      d: 'M22 38 Q32 48 42 38',
      fill: 'none', stroke: '#101013', 'stroke-width': '4', 'stroke-linecap': 'round',
    });

    return svg;
  }

  // Built by cloning one of Kick's own tab buttons and swapping the icon, rather
  // than recreating its markup: the tabs carry a nest of Tailwind classes for
  // padding, hover and the active underline, and a hand-written copy silently
  // drifts out of alignment (no underline, wrong spacing) the moment Kick
  // restyles them. Cloning inherits whatever they currently are.
  function pickerBuildTab(nativeTab) {
    const tab = nativeTab ? nativeTab.cloneNode(true) : document.createElement('button');
    const icon = pickerBuildTabIcon();

    if (nativeTab) {
      // Kick queries its own tabs by id and data-testid; a duplicate of either
      // would make our clone answer for the tab it was copied from.
      for (const node of [tab, ...tab.querySelectorAll('[id], [data-testid]')]) {
        node.removeAttribute('id');
        node.removeAttribute('data-testid');
      }
      // Any label text belongs to the tab we copied — strip it before ours goes in.
      const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) texts.push(walker.currentNode);
      for (const node of texts) node.remove();

      const nativeIcon = tab.querySelector('svg, img');
      if (nativeIcon) {
        // Only the class comes across. The button sizes its icon itself, via
        // `[&_svg]:size-7 [&_svg]:lg:size-6`, and those beat any width/height
        // attributes — copying the source icon's (21x16 on the Kick logo tab)
        // would just leave a wrong aspect ratio behind if that CSS ever lapses.
        const iconClass = nativeIcon.getAttribute('class');
        if (iconClass !== null) icon.setAttribute('class', iconClass);
        nativeIcon.replaceWith(icon);
      } else {
        tab.prepend(icon);
      }
    } else {
      tab.appendChild(icon);
      const underline = document.createElement('div');
      underline.className = 'z-common h-0.5 w-full transition-colors duration-300 group-data-[active=true]:bg-kick-voltGreen-150! betterhover:group-hover:bg-[#475054]';
      tab.appendChild(underline);
    }

    tab.id = 'kte-picker-tab';
    tab.type = 'button';
    tab.removeAttribute('title');
    tab.dataset.kteTip = uiText().tabTip;
    tab.addEventListener('mouseenter', () => showTooltip(tab));
    tab.addEventListener('mouseleave', hideTooltip);
    tab.setAttribute('aria-label', chatSettingsRowLabel());
    tab.setAttribute('data-active', 'false');
    return tab;
  }

  // A search rebuilds the whole tab — every section and its first 40 buttons
  // — so wait for a pause in typing instead of rebuilding on every keystroke.
  function pickerAttachSearch(panel, searchInput) {
    if (!searchInput || searchInput._ktePickerSearch) return;
    searchInput._ktePickerSearch = true;
    searchInput.addEventListener('input', () => {
      if (pickerSearchTimer) clearTimeout(pickerSearchTimer);
      pickerSearchTimer = setTimeout(() => {
        pickerSearchTimer = null;
        if (!panel.isConnected || !pickerIsActive(panel)) return;
        pickerRefreshContent(panel);
        pickerApplyActiveState(panel);
      }, PICKER_SEARCH_DELAY);
    });
  }

  function pickerAttachNativeTabs(panel, tabsRow) {
    if (tabsRow._ktePickerTabs) return;
    tabsRow._ktePickerTabs = true;
    tabsRow.addEventListener('click', e => {
      const button = e.target.closest('button[data-active]');
      if (!button || button.id === 'kte-picker-tab') return;
      setTimeout(() => pickerSetActive(panel, false), 0);
    });
  }

  function pickerInject(panel) {
    const parts = pickerFindParts(panel);
    if (!parts) return;

    let tab = panel.querySelector('#kte-picker-tab');
    if (!tab) {
      // Prefer an icon tab to clone. The first tab can be the channel's avatar
      // button, whose <img> carries avatar-specific classes we don't want.
      const nativeTabs = [...parts.tabsRow.querySelectorAll('button[data-active]')];
      tab = pickerBuildTab(nativeTabs.find(button => button.querySelector('svg')) ?? nativeTabs[0]);
      tab.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        pickerSetActive(panel, true, true);
      });
    }
    if (tab.parentElement !== parts.tabsRow) parts.tabsRow.appendChild(tab);

    const content = panel.querySelector('#kte-picker-content');
    const active = pickerIsActive(panel);
    const stale = content
      && (content.dataset.kteChannel !== (channelSlug ?? '')
        || content.dataset.kteEmoteVersion !== String(emoteVersion));

    if (active && (!content || stale)) {
      if (content?._kteAppendingMore) {
        content._kteRefreshAfterAppend = true;
        queuePickerInject(panel, PICKER_APPEND_REFRESH_DELAY);
        return;
      }
      pickerRefreshContent(panel);
    } else if (!active && stale) {
      pickerMarkContentStale(content);
      content.remove();
    }
    pickerAttachSearch(panel, parts.searchInput);
    pickerAttachNativeTabs(panel, parts.tabsRow);
    pickerApplyActiveState(panel);
  }

  function queuePickerInject(panel, delay = PICKER_INJECT_DELAY) {
    if (pickerInjectTimer) clearTimeout(pickerInjectTimer);
    const seq = initSeq;
    pickerInjectTimer = setTimeout(() => {
      pickerInjectTimer = null;
      requestAnimationFrame(() => {
        if (seq !== initSeq) return;
        const target = panel?.isConnected ? panel : document.getElementById('chat-emotes-picker-panel');
        if (target) pickerInject(target);
      });
    }, delay);
  }

  function resetPicker() {
    if (pickerSearchTimer) {
      clearTimeout(pickerSearchTimer);
      pickerSearchTimer = null;
    }
    if (pickerInjectTimer) {
      clearTimeout(pickerInjectTimer);
      pickerInjectTimer = null;
    }
    if (pickerDeferredRefreshTimer) {
      clearTimeout(pickerDeferredRefreshTimer);
      pickerDeferredRefreshTimer = null;
    }

    const panel = document.getElementById('chat-emotes-picker-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-kte-native-hidden="1"]').forEach(child => {
      child.hidden = false;
      delete child.dataset.kteNativeHidden;
    });
    panel.querySelector('#kte-picker-tab')?.remove();
    const content = panel.querySelector('#kte-picker-content');
    pickerMarkContentStale(content);
    content?.remove();
  }

  // ── Chat Observer ────────────────────────────────────────────────────────

  function startChatObserver() {
    if (chatObserver) chatObserver.disconnect();
    chatObserver = new MutationObserver(mutations => {
      let pickerPanelToInject = null;
      let chatSettingsChanged = false;

      for (const mut of mutations) {
        // Virtual list recycles elements by changing data-index — clear stale marks
        // so the recycled message container gets reprocessed with its new content.
        if (mut.type === 'attributes' && mut.attributeName === 'data-index') {
          delete mut.target.dataset.kteVersion;
          mut.target.querySelectorAll?.('[data-kte-version]').forEach(el => {
            delete el.dataset.kteVersion;
          });
          queueProcessMessageTree(mut.target);
        }
        for (const added of mut.addedNodes) {
          if (added.nodeType !== Node.ELEMENT_NODE) continue;
          if (isOwnUINode(added)) continue;
          if (added.id === 'chat-settings-panel' || added.closest?.('#chat-settings-panel')
            || added.querySelector?.('#chat-settings-panel')) {
            chatSettingsChanged = true;
            continue;
          }
          if (added.id === 'chat-emotes-picker-panel') {
            pickerPanelToInject = added;
            continue;
          }
          const containingPicker = added.closest?.('#chat-emotes-picker-panel');
          if (containingPicker) {
            pickerPanelToInject = containingPicker;
            continue;
          }
          const nestedPicker = added.querySelector?.('#chat-emotes-picker-panel');
          if (nestedPicker) {
            pickerPanelToInject = nestedPicker;
            continue;
          }
          queueProcessMessageTree(added);
        }
      }

      if (pickerPanelToInject) queuePickerInject(pickerPanelToInject);
      if (chatSettingsChanged) chatSettingsInject(document.getElementById('chat-settings-panel'));
      // Kick may replace the chat input element during stream switches — piggyback
      // on this observer (already watching body subtree) to re-attach autocomplete
      // when the tracked input disconnects.
      if (!attachedAcInput?.isConnected) attemptAcAttach();
    });
    chatObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-index'] });
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function currentChannelSlug() {
    const parts = location.pathname.replace(/^\//, '').split('/');
    // Popout chat lives at /popout/<channel>/chat, so the channel is the second
    // segment there. Verified against the live site: the popout page carries the
    // same chat DOM (MSG_SELECTORS[0]/[1] and [data-testid="chat-input"] all
    // match), so without this it renders global emotes only — and leaves
    // *_c_popout keys in the cache for every popout ever opened.
    const raw = (parts[0] ?? '').toLowerCase() === 'popout' ? (parts[1] ?? '') : (parts[0] ?? '');
    const slug = raw.toLowerCase();
    return NON_CHANNEL_SLUGS.has(slug) ? null : slug || null;
  }

  function pickerProviderInjectDelay() {
    return Date.now() - lastNavigationAt < 2500
      ? PICKER_ROUTE_INJECT_DELAY
      : PICKER_INJECT_DELAY;
  }

  function routeChatRefreshDelay() {
    return Date.now() - lastNavigationAt < 2500
      ? ROUTE_CHAT_REFRESH_DELAY
      : 0;
  }

  async function init() {
    const seq = ++initSeq;
    const slug = currentChannelSlug();
    emotesSettled = false;
    loadedProviders = new Map();
    activeLoaders = [];
    preconnectEmoteHosts();

    if (!slug) {
      channelSlug = null;
      emoteMap.clear();
      emoteVersion++;
      acHide();
      hideTooltip();
      hideEmoteMenu();
      resetPicker();
      return;
    }

    channelSlug = slug;
    emoteMap.clear();
    emoteVersion++;
    acHide();
    hideTooltip();
    hideEmoteMenu();
    resetPicker();
    startChatObserver();
    // The observer only sees the chat settings menu CHANGE. One already open
    // when the script starts (a late load) would go without the row until Kick
    // re-rendered it, so add it now. A no-op with the menu closed, or already
    // holding the row.
    chatSettingsInject(document.getElementById('chat-settings-panel'));
    waitForInput();
    log(uiText().loadingFor.replace('{slug}', channelSlug));

    // Every provider is fetched regardless of the settings toggles: the fetches
    // are cache-backed and cheap, and keeping the layers loaded is what lets a
    // provider be switched back on instantly instead of waiting on a refetch.
    const allLoaders = [
      { key: 'bttv_g', provider: 'BTTV', fn: options => loadBTTVGlobal(options), isChannel: false },
      { key: '7tv_g', provider: '7TV', fn: options => load7TVGlobal(options), isChannel: false },
      { key: 'ffz_g', provider: 'FFZ', fn: options => loadFFZGlobal(options), isChannel: false },
      { key: `bttv_c_${slug}`, provider: 'BTTV', fn: options => loadBTTVChannel(slug, options), isChannel: true },
      { key: `7tv_c_${slug}`, provider: '7TV', fn: options => load7TVChannel(slug, options), isChannel: true },
      { key: `ffz_c_${slug}`, provider: 'FFZ', fn: options => loadFFZChannel(slug, options), isChannel: true },
    ];

    const failedLoaders = [];
    activeLoaders = allLoaders;

    function applyProviderEntries(loader, entries) {
      if (seq !== initSeq || currentChannelSlug() !== slug) return;
      if (!Array.isArray(entries)) return false;
      const previous = loadedProviders.get(loader.key);
      if (!entries.length && !previous) return false;
      if (previous && sameEmoteEntries(previous, entries)) return false;
      loadedProviders.set(loader.key, entries);
      rebuildEmoteMap();
      emoteVersion++;
      queueVisibleEmoteRefresh(routeChatRefreshDelay());
      queueProviderPickerRefresh();
      acRefreshOpen();
      return true;
    }

    // Update chat, autocomplete, and picker incrementally as each provider resolves.
    const promises = allLoaders.map(loader => loader.fn({
      onRefresh: entries => applyProviderEntries(loader, entries),
    }).then(entries => applyProviderEntries(loader, entries)).catch(err => {
      log(`${loader.key} failed:`, err?.message ?? err);
      failedLoaders.push(loader);
    }));

    await Promise.allSettled(promises);
    if (seq !== initSeq || currentChannelSlug() !== slug) return;
    emotesSettled = true;

    log(uiText().ready.replace('{n}', emoteMap.size).replace('{slug}', channelSlug));

    queueVisibleEmoteRefresh(routeChatRefreshDelay());
    queueProviderPickerRefresh();

    // 7TV in particular answers with sporadic 502s, and a single retry 5 s
    // later often lands in the same bad patch, leaving the channel without
    // those emotes until the next navigation. Back off instead; each pass
    // retries only the loaders that are still failing.
    function retryFailedLoaders(loaders, attempt) {
      const delay = PROVIDER_RETRY_DELAYS[attempt];
      log(uiText().retrying.replace('{n}', loaders.length).replace('{s}', delay / 1000));
      setTimeout(async () => {
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        const results = await Promise.allSettled(loaders.map(loader => loader.fn()));
        if (seq !== initSeq || currentChannelSlug() !== slug) return;
        const stillFailing = [];
        let added = 0;
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          if (r.status !== 'fulfilled') {
            log(`${loaders[i].key} failed again:`, r.reason?.message ?? r.reason);
            stillFailing.push(loaders[i]);
            continue;
          }
          if (Array.isArray(r.value) && applyProviderEntries(loaders[i], r.value)) {
            added += r.value.length;
          }
        }
        if (added) log(uiText().retryLoaded.replace('{n}', added));
        if (!stillFailing.length) return;
        if (attempt + 1 < PROVIDER_RETRY_DELAYS.length) {
          retryFailedLoaders(stillFailing, attempt + 1);
        } else {
          log(uiText().givingUp.replace('{providers}', stillFailing.map(loader => loader.key).join(', ')));
        }
      }, delay);
    }

    if (failedLoaders.length) retryFailedLoaders(failedLoaders, 0);
  }

  // ── Cross-tab sync ───────────────────────────────────────────────────────
  // `storage` fires only in the other tabs, after one of them wrote. Take the
  // new value and repaint whatever shows it, the same way a local change does.
  // Chat re-renders only when something it draws from changed: a size or
  // preview change needs no re-render, and every insert in another tab
  // rewrites the usage key.

  function settingsRenderKey(s) {
    return JSON.stringify([s.providers, s.globals, s.motion]);
  }

  function onStorageSync(e) {
    if (e.storageArea !== localStorage) return;
    const all = e.key === null; // another tab cleared localStorage
    // Other tabs also write the emote caches and Kick's own keys; none of
    // those show here, and rebuilding the open panel for them would cost it
    // its hover state.
    if (!all && e.key !== SETTINGS_KEY && e.key !== USAGE_KEY && e.key !== FAVS_KEY) return;
    if (all || e.key === SETTINGS_KEY) {
      const before = settingsRenderKey(settingsLoad());
      settings = settingsRead() ?? settings;
      applyEmoteSize();
      if (!settings.autocomplete) acHide();
      if (settingsRenderKey(settings) !== before) {
        applyProviderSettings(); // rebuilds emoteMap and re-renders chat
        pickerRefreshIfBuilt();
      }
    }
    if (all || e.key === USAGE_KEY || e.key === FAVS_KEY) {
      if (all || e.key === USAGE_KEY) usageMap = usageRead() ?? usageMap;
      if (all || e.key === FAVS_KEY) favSet = favRead() ?? favSet;
      pickerRefreshIfBuilt();
      acRefreshOpen();
    }
    settingsPanelRender();
  }

  window.addEventListener('storage', onStorageSync);
  window.addEventListener('keydown', acOnKeydown, true);

  // ── SPA Routing ──────────────────────────────────────────────────────────

  function handleNavigation() {
    initSeq++;
    emotesSettled = false;
    lastNavigationAt = Date.now();
    chatObserver?.disconnect(); chatObserver = null;
    if (visibleRefreshTimer) {
      clearTimeout(visibleRefreshTimer);
      visibleRefreshTimer = null;
    }
    messageProcessQueue = [];
    messageProcessQueued = false;
    emoteMap.clear();
    emoteVersion++;
    acHide();
    hideTooltip();
    hideEmoteMenu();
    // Full stale-mark (not just detach) so image src is cleared even when Kick
    // has already removed the picker panel — resetPicker bails on a missing
    // panel and would otherwise leave decoded image data alive.
    if (activePickerImageLoader) pickerMarkContentStale(activePickerImageLoader);
    resetPicker();
    waitForDOMThenInit();
  }

  function waitForDOMThenInit() {
    const seq = initSeq;
    let attempts = 0;
    const maxAttempts = 50; // ~25 seconds
    function tryInit() {
      if (seq !== initSeq) return;
      attempts++;
      const slug = currentChannelSlug();
      if (!slug) { init(); return; }
      const hasChatDOM = MSG_SELECTORS.some(sel => document.querySelector(sel))
        || INPUT_SELECTORS.some(sel => document.querySelector(sel));
      if (hasChatDOM || attempts >= maxAttempts) { init(); return; }
      setTimeout(tryInit, 500);
    }
    setTimeout(tryInit, 300);
  }

  function checkRouteChange() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    handleNavigation();
  }

  // Poll location.pathname as the source of truth — Kick's router may hold a
  // captured reference to history.pushState/replaceState from before this script
  // loaded, which would bypass any wrapper we install. Polling catches every
  // navigation regardless of mechanism.
  setInterval(checkRouteChange, 500);

  // Fast path for navigations that do route through the live history methods,
  // so we don't have to wait up to 500ms for the interval to notice.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      checkRouteChange();
      return result;
    };
  }

  window.addEventListener('popstate', () => {
    checkRouteChange();
  });

  // Re-parent floating overlays into / out of the fullscreen element so they
  // remain visible when Kick's chat enters fullscreen.
  // Follow the reduce-motion setting live: re-render chat with the other frame
  // and rebuild the picker, which bakes the choice into its buttons.
  reducedMotionQuery?.addEventListener?.('change', () => {
    rerenderEmotes();
    pickerRefreshIfBuilt();
    settingsPanelRender();
  });

  document.addEventListener('fullscreenchange', () => {
    if (tipEl) reparentOverlay(tipEl);
    if (acDropdown) reparentOverlay(acDropdown);
    hideEmoteMenu();
    settingsPanelClose();
  });

  applyEmoteSize();

  // Not every manager has a menu (Safari's Userscripts extension doesn't); the
  // row in Kick's chat settings menu opens the same panel there.
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand(uiText().menuSettings, settingsPanelOpen);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', waitForDOMThenInit)
    : waitForDOMThenInit();

  // One-time storage cleanup, off the critical path.
  RIC(sweepCache);
})();
