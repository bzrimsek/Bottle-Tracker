#!/usr/bin/env python3
"""ship.py — Killer B's Bottle Tracker pre-ship gate.

Runs the pre-delivery audit AND the test harness. Refuses to ship unless BOTH
pass. This is the single gate: run `python3 ship.py` before every push.
Nothing ships red.

Usage: python3 ship.py [path/to/index.html]     (default: index.html beside this script)
Exit 0 = safe to ship.  Exit 1 = do not ship.

Expects audit.py, killer-bs-test.js, sw.js and index.html in the same folder.
"""
import sys, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))


def locate(name, alt_dir):
    for d in (HERE, alt_dir):
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None


def main():
    index = os.path.abspath(sys.argv[1] if len(sys.argv) > 1
                            else os.path.join(HERE, 'index.html'))
    base = os.path.dirname(index)

    if not os.path.exists(index):
        print(f'\n  \u2716 index.html not found at {index}\n')
        return 1

    audit = locate('audit.py', base)
    tests = locate('killer-bs-test.js', base)

    m = re.search(r"APP_VERSION\s*=\s*'([\d.]+)'", open(index, encoding='utf-8').read())
    ver = m.group(1) if m else '?'

    print(f'\n\u2550\u2550\u2550\u2550\u2550\u2550 ship gate \u2014 Killer B\u2019s Bottle Tracker v{ver} \u2550\u2550\u2550\u2550\u2550\u2550\n')
    ok = True

    # 1) Audit ────────────────────────────────────────────────
    if not audit:
        print('  \u2716 audit.py not found alongside index.html'); ok = False
    else:
        print('\u25b8 audit')
        r = subprocess.run(['python3', audit, index], capture_output=True, text=True)
        if r.returncode != 0:
            sys.stdout.write(r.stdout + r.stderr)
            print('  \u2716 AUDIT FAILED'); ok = False
        else:
            print('  \u2713 audit passed')

    # 2) Data QA ──────────────────────────────────────────────
    qa = locate('validate.py', base)
    if qa:
        print('▸ data')
        r = subprocess.run(['python3', qa, os.path.join(base, 'data.json'), '--strict'],
                           capture_output=True, text=True)
        if r.returncode != 0:
            sys.stdout.write(r.stdout + r.stderr)
            print('  ✖ DATA QA FAILED'); ok = False
        else:
            line = next((l.strip() for l in r.stdout.splitlines() if 'errors' in l), '')
            print(f'  ✓ {line}')

    # 3) Tests ────────────────────────────────────────────────
    if not tests:
        print('  \u2716 killer-bs-test.js not found alongside index.html'); ok = False
    else:
        print('\u25b8 tests')
        r = subprocess.run(['node', tests], capture_output=True, text=True, cwd=base)
        out = r.stdout + r.stderr
        if r.returncode != 0:
            sys.stdout.write(out)
            print('  \u2716 TESTS FAILED'); ok = False
        else:
            summary = next((l.strip() for l in out.splitlines() if 'passed' in l),
                           'tests passed')
            print(f'  \u2713 {summary}')

    # Verdict ─────────────────────────────────────────────────
    print()
    if ok:
        print(f'  \u2714 SAFE TO SHIP \u2014 v{ver}')
        print(f'    upload: index.html, sw.js, killer-bs-v{ver}.html, killer-bs-v{ver}-sw.js')
        print('    (+ killer-bs-test.js if tests changed this session — rule 29)')
        print('    (+ data.json / map.json if the shelf or the map changed)')
        print('    (+ CHANGELOG.md, BACKLOG.md when they change)\n')
        return 0
    print('  \u2716 DO NOT SHIP \u2014 fix the failure(s) above\n')
    return 1


if __name__ == '__main__':
    sys.exit(main())
