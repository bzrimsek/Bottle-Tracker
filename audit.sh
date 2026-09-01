#!/bin/bash
# Pre-delivery audit. All checks must pass. No exceptions, no skipping.
set -u; fail=0
chk(){ if [ "$2" = "0" ]; then echo "  PASS $1"; else echo "  FAIL $1"; fail=1; fi }

V=$(grep -o "const APP_VERSION = '[0-9.]*'" index.html | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+")
echo "version $V"
grep -q "dram-v$V'" sw.js; chk "sw.js CACHE_NAME matches APP_VERSION" $?
grep -q "Bottle Tracker v$V" index.html; chk "file header matches" $?
grep -q ">v$V<" index.html; chk "UI version string matches" $?
grep -q "\[describe changes here\]" index.html; [ $? -ne 0 ]; chk "no changelog placeholder" $?
grep -q "localStorage" index.html; chk "storage present" $?
node -e "JSON.parse(require('fs').readFileSync('data.json','utf8'))" 2>/dev/null; chk "data.json parses" $?
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))" 2>/dev/null; chk "manifest.json parses" $?
node killer-bs-test.js >/dev/null 2>&1; chk "test harness green" $?
sed -n "/^'use strict';/,/^<\/script>/p" index.html | sed '$d' > /tmp/dram-inline.js
node --check /tmp/dram-inline.js 2>/dev/null; chk "inline script parses" $?
for f in mark.png icon-192.png icon-512.png; do
  [ -f "$f" ]; chk "asset $f present" $?
  grep -q "$f" sw.js; chk "$f precached in sw.js" $?
done
[ -f "killer-bs-v$V.html" ]; chk "named lock file exists" $?
exit $fail
