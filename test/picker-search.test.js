// Picker search order within a provider group: exact match, then names that
// start with the query, then the rest; alphabetical within each, and plain
// alphabetical with no search.

load(['pickerCompareEmotes']);

function order(query, codes) {
  return codes.map(code => ({ code })).sort(pickerCompareEmotes(query)).map(e => e.code).join(' ');
}

var codes = ['AYAYApog', 'POGGERS', 'Pog', 'catPOG', 'PogU', 'KEKW'];
check('no search: alphabetical', order('', codes) === 'AYAYApog KEKW POGGERS Pog PogU catPOG');
check('exact, then prefix, then substring', order('pog', codes.filter(c => /pog/i.test(c))) === 'Pog POGGERS PogU AYAYApog catPOG');
check('no exact match: prefix first', order('pogg', ['xPOGGERS', 'POGGERS', 'POGGIES']) === 'POGGERS POGGIES xPOGGERS');
check('case-insensitive exact match', order('kekw', ['KEKWait', 'KEKW', 'aKEKW']) === 'KEKW KEKWait aKEKW');
