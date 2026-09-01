#!/usr/bin/env python3
"""
Version bumper for Killer B's Bottle Tracker.

The ONLY way versions change. Reads the system clock -- never accepts a
timestamp argument, never asks anyone what time it is.

Writes five locations:
  1. index.html file header comment
  2. index.html  const APP_VERSION
  3. index.html  const BUILD_TIME
  4. index.html  UI version string (footer)
  5. sw.js       CACHE_NAME

Versions are three-part major.minor.patch. Patch rolls to the next minor
at 100.

Usage:
    python3 bump.py "changelog entry describing this change"
"""
import re
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
INDEX = HERE / 'index.html'
SW = HERE / 'sw.js'


def read_version(text):
    m = re.search(r"const APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'", text)
    if not m:
        sys.exit('APP_VERSION not found in index.html — cannot bump.')
    return [int(g) for g in m.groups()]


def next_version(major, minor, patch):
    patch += 1
    if patch >= 100:
        patch = 0
        minor += 1
    if minor >= 100:
        minor = 0
        major += 1
    return major, minor, patch


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        sys.exit('Refusing to bump: a changelog entry is required.\n'
                 'Usage: python3 bump.py "what changed"')
    entry = sys.argv[1].strip()
    if '[describe changes here]' in entry:
        sys.exit('Refusing to bump: changelog placeholder not filled in.')

    html = INDEX.read_text()
    sw = SW.read_text()

    major, minor, patch = next_version(*read_version(html))
    ver = f'{major}.{minor}.{patch}'
    now = datetime.now()
    build = now.strftime('%Y-%m-%d %H:%M:%S')

    # 1. file header comment
    html = re.sub(r'(<!--\s*Killer B.s Bottle Tracker v)\d+\.\d+\.\d+', r'\g<1>' + ver, html, count=1)
    # changelog entry lands in the single canonical header block
    html = re.sub(r'(  CHANGELOG\n)',
                  f'  CHANGELOG\n    {ver} ({build}) — {entry}\n', html, count=1)
    # 2. APP_VERSION
    html = re.sub(r"(const APP_VERSION\s*=\s*')[\d.]+(')",
                  r'\g<1>' + ver + r'\g<2>', html, count=1)
    # 3. BUILD_TIME
    html = re.sub(r"(const BUILD_TIME\s*=\s*')[^']*(')",
                  r'\g<1>' + build + r'\g<2>', html, count=1)
    # 4. UI string
    html = re.sub(r'(<span id="verString">)[^<]*(</span>)',
                  r'\g<1>v' + ver + r'\g<2>', html, count=1)
    # 5. service worker cache name
    sw = re.sub(r"(const CACHE_NAME\s*=\s*'dram-v)[\d.]+(')",
                r'\g<1>' + ver + r'\g<2>', sw, count=1)

    INDEX.write_text(html)
    SW.write_text(sw)
    print(f'bumped to {ver} at {build}')
    print(f'changelog: {entry}')
    print(f'lock file: killer-bs-v{ver}.html')


if __name__ == '__main__':
    main()
