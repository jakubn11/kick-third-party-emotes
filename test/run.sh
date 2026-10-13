#!/bin/sh
# Syntax-checks the userscript, then runs every test/*.test.js under macOS's
# JavaScriptCore shell, each in its own process after test/harness.js.
# Exits non-zero on a syntax error or any FAIL line.
set -u
cd "$(dirname "$0")/.." || exit 1

JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ ! -x "$JSC" ]; then
  echo "jsc not found at $JSC (macOS only)" >&2
  exit 1
fi

status=0
syntax=$("$JSC" -e 'try { new Function(readFile("kick-third-party-emotes.user.js")); print("syntax OK"); } catch (e) { print("SYNTAX ERROR: " + e); }')
echo "$syntax"
[ "$syntax" = "syntax OK" ] || status=1

for test in test/*.test.js; do
  echo "── $test"
  out=$("$JSC" test/harness.js "$test" 2>&1)
  echo "$out"
  if echo "$out" | grep -q '^FAIL ' || ! echo "$out" | grep -q '^PASS '; then
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "all tests passed" || echo "TESTS FAILED"
exit "$status"
