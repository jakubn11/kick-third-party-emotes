// Test harness for the macOS JavaScriptCore shell (`jsc`). Loaded before each
// *.test.js by test/run.sh, from the repo root.
//
// The userscript is one IIFE that touches the DOM at load, so it can't simply
// be run here. Instead this pulls individual functions or `const`s out of its
// source and evaluates them globally; a test stubs whatever they reference.

var SRC = readFile('kick-third-party-emotes.user.js');

// jsc has no URL global; safeUrl and emotePageUrl only need these three parts.
if (typeof URL === 'undefined') {
  URL = function (u) {
    var m = /^([a-z][a-z0-9+.-]*:)\/\/([^\/?#:]+)(?::\d+)?([^?#]*)/i.exec(String(u));
    if (!m) throw new TypeError('Invalid URL');
    this.protocol = m[1].toLowerCase();
    this.hostname = m[2].toLowerCase();
    this.pathname = m[3] || '/';
  };
}

// Source of a top-level `function name(` / `async function name(`, by brace matching.
function fnSource(name) {
  var m = new RegExp('\\n  (async )?function ' + name + '\\(').exec(SRC);
  if (!m) throw new Error('no function ' + name);
  var i = SRC.indexOf('{', m.index), depth = 0, j = i;
  for (; j < SRC.length; j++) {
    var c = SRC[j];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return SRC.slice(m.index + 1, j + 1);
}

// Source of a top-level `const NAME = …;`, rewritten to `var` so it lands globally.
function constSource(name) {
  var m = new RegExp('\\n  const ' + name + ' = ').exec(SRC);
  if (!m) throw new Error('no const ' + name);
  var depth = 0, j = m.index + m[0].length;
  for (; j < SRC.length; j++) {
    var c = SRC[j];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ';' && depth === 0) break;
  }
  return SRC.slice(m.index + 1, j + 1).replace(/^  const /, 'var ');
}

function load(names) { for (var n of names) (0, eval)(fnSource(n)); }
function loadConst(names) { for (var n of names) (0, eval)(constSource(n)); }

var failures = 0;
function check(label, cond) {
  if (!cond) failures++;
  print((cond ? 'PASS ' : 'FAIL ') + label);
}
