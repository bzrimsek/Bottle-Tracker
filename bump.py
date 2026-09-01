#!/usr/bin/env python3
"""
Version bumper for Killer B's Bottle Tracker.

The ONLY way versions change. Reads the system clock -- never accepts a
timestamp argument, never asks anyone what time it is.

Writes five locations, matching the MadGolf convention:
  1. index.html header comment  "Version : vX.Y.Z  Build <stamp>"
  2. index.html  const APP_VERSION
  3. index.html  const BUILD_TIME
  4. index.html  UI string  <span id="verString">
  5. sw.js       CACHE_NAME

Plus the changelog entry, written once to the single canonical CHANGELOG
block, newest first, in MadGolf's line format:
    // vX.Y.Z  YYYY-MM-DD  entry text

Build stamps are Eastern Time, as MadGolf's are.

Usage:
    python3 bump.py "changelog entry describing this change"
"""
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).parent
INDEX = HERE / 'index.html'
SW = HERE / 'sw.js'


def eastern_now():
    """Eastern Time without a tz-database dependency: EDT (UTC-4) from the
    second Sunday in March to the first Sunday in November, else EST."""
    utc = datetime.now(timezone.utc)

    def nth_sunday(year, month, n):
        d = datetime(year, month, 1, tzinfo=timezone.utc)
        d += timedelta(days=(6 - d.weekday()) % 7)      # first Sunday
        return d + timedelta(weeks=n - 1)

    y = utc.year
    dst_start = nth_sunday(y, 3, 2).replace(hour=7)     # 2am EST = 07:00 UTC
    dst_end = nth_sunday(y, 11, 1).replace(hour=6)      # 2am EDT = 06:00 UTC
    offset = -4 if dst_start <= utc < dst_end else -5
    return utc + timedelta(hours=offset)


def read_version(text):
    m = re.search(r"const APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'", text)
    if not m:
        sys.exit('APP_VERSION not found in index.html — cannot bump.')
    return [int(g) for g in m.groups()]


def next_version(major, minor, patch):
    patch += 1
    if patch >= 100:
        patch, minor = 0, minor + 1
    if minor >= 100:
        minor, major = 0, major + 1
    return major, minor, patch


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        sys.exit('Refusing to bump: a changelog entry is required.\n'
                 'Usage: python3 bump.py "what changed"')
    entry = ' '.join(sys.argv[1].split())
    if '[describe changes here]' in entry:
        sys.exit('Refusing to bump: changelog placeholder not filled in.')

    html = INDEX.read_text()
    sw = SW.read_text()

    major, minor, patch = next_version(*read_version(html))
    ver = '%d.%d.%d' % (major, minor, patch)
    now = eastern_now()
    stamp = now.strftime('%Y-%m-%d %I:%M %p ET')
    day = now.strftime('%Y-%m-%d')

    # 1. header comment
    html, n = re.subn(r'(     Version : v)[\d.]+(  Build ).*',
                      lambda m: m.group(1) + ver + m.group(2) + stamp, html, count=1)
    if not n:
        sys.exit('Header "Version :" line not found — cannot bump.')

    # changelog entry: newest first, directly under the CHANGELOG marker
    html, n = re.subn(r'(\nCHANGELOG\n)',
                      lambda m: m.group(1) + '// v%s  %s  %s\n' % (ver, day, entry),
                      html, count=1)
    if not n:
        sys.exit('CHANGELOG block not found — cannot bump.')

    # 2-4. constants and UI string
    html = re.sub(r"(const APP_VERSION\s*=\s*')[\d.]+(')",
                  lambda m: m.group(1) + ver + m.group(2), html, count=1)
    html = re.sub(r"(const BUILD_TIME\s*=\s*')[^']*(')",
                  lambda m: m.group(1) + stamp + m.group(2), html, count=1)
    html = re.sub(r'(<span id="verString">)[^<]*(</span>)',
                  lambda m: m.group(1) + 'v' + ver + m.group(2), html, count=1)

    # 5. service worker cache name
    sw, n = re.subn(r"(const CACHE_NAME\s*=\s*'killer-bs-v)[\d.]+(')",
                    lambda m: m.group(1) + ver + m.group(2), sw, count=1)
    if not n:
        sys.exit('CACHE_NAME not found in sw.js — cannot bump.')

    INDEX.write_text(html)
    SW.write_text(sw)
    print('bumped to v%s  Build %s' % (ver, stamp))
    print('changelog: // v%s  %s  %s' % (ver, day, entry))
    print('lock file: killer-bs-v%s.html' % ver)


if __name__ == '__main__':
    main()
