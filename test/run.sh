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
  code=$?
  echo "$out"
  # A file that throws partway (jsc exits 3, prints "Exception:") still has
  # the PASS lines from before the throw, so the exit code counts too.
  if [ "$code" -ne 0 ] || echo "$out" | grep -q '^FAIL \|^Exception' || ! echo "$out" | grep -q '^PASS '; then
    [ "$code" -ne 0 ] && echo "FAIL $test exited with code $code"
    status=1
  fi
done

echo "── test/family-style.js"
"$JSC" test/family-style.js || status=1

[ "$status" -eq 0 ] && echo "all tests passed" || echo "TESTS FAILED"
exit "$status"
