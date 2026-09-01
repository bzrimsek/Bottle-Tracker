#!/usr/bin/env python3
"""validate.py — Killer B's Bottle Tracker data QA.

Checks the catalog against ITSELF and against the rules of the categories.
No network: every finding here is a contradiction already present in the
data, which makes them cheap to run and impossible to argue with.

  python3 validate.py [data.json]        report
  python3 validate.py --strict           exit 1 if any ERROR is found

Severity:
  ERROR  the data contradicts itself or the law of the category
  WARN   probably wrong, worth a human eye
  NOTE   missing, not wrong
"""
import sys, re, json, os
from collections import Counter, defaultdict

# --- category rules -------------------------------------------------------
# Minimum bottling strengths that are actually law, not convention.
MIN_PROOF = {
    'bourbon': 80, 'rye': 80, 'wheat': 80, 'tennessee': 80,
    'american single malt': 80, 'scotch': 80, 'irish': 80, 'canadian': 80,
    'japanese': 80,
}
# Words in a name that pin the category or the strength.
NAME_RULES = [
    (r'bottled[- ]in[- ]bond|\bbib\b', 'bottled in bond', 'proof', 100),
    (r'\b100\s*proof\b', 'says 100 proof', 'proof', 100),
    (r'\b90\s*proof\b', 'says 90 proof', 'proof', 90),
]
CATEGORY_WORDS = [
    ('bourbon', r'\bbourbon\b', ['bourbon', 'tennessee']),
    ('rye', r'\brye\b', ['rye', 'canadian', 'flavored']),
    ('single malt', r'\bsingle malt\b',
     ['scotch', 'irish', 'american single malt', 'japanese', 'world', 'canadian']),
]
SCOTCH_REGIONS = ['Islay', 'Speyside', 'Highland', 'Islands', 'Lowland', 'Campbeltown']
TYPES = ['bourbon', 'tennessee', 'rye', 'wheat', 'american single malt',
         'scotch', 'irish', 'canadian', 'japanese', 'world', 'flavored', 'tequila']

findings = []


def add(sev, prod, msg):
    findings.append((sev, prod, msg))


def age_in_name(name):
    """Age a label states, or None. Ignores batch and release numbers."""
    masked = re.sub(r'\b(batch|pact|chapter|build|no\.?)\s*\d+', ' ', name, flags=re.I)
    masked = re.sub(r'\b\d+\s*(proof|wood)\b', ' ', masked, flags=re.I)
    m = re.search(r'\b(\d{1,2})\s*(?:yr|yrs|year|years|yo)\b', masked, re.I)
    if m:
        n = int(m.group(1))
        return n if 2 <= n <= 50 else None
    return None


def check(cat, bottles, flights):
    by_name = defaultdict(list)
    for p in cat.values():
        by_name[p['name'].strip().lower()].append(p)

    for key, p in sorted(cat.items()):
        n, sub, proof = p['name'], p.get('sub'), p.get('proof')

        # ---- identity ----------------------------------------------------
        if not n or len(n) < 3:
            add('ERROR', key, 'name is missing or too short')
        if sub not in TYPES:
            add('ERROR', n, 'category "%s" is not one the app recognises' % sub)
        if not proof:
            add('ERROR', n, 'no proof')
        else:
            if proof < 20 or proof > 200:
                add('ERROR', n, 'proof %.1f is outside 20-200' % proof)
            floor = MIN_PROOF.get(sub)
            if floor and proof < floor:
                add('ERROR', n, '%s must be bottled at %d proof or above, has %.1f'
                    % (sub, floor, proof))
            # A proof that is a whole ABV doubled is fine; one that looks like
            # an ABV was probably entered as one.
            if proof < 60:
                add('WARN', n, 'proof %.1f looks like an ABV, not a proof' % proof)

        # ---- what the label says vs what we stored ------------------------
        for pat, why, field, want in NAME_RULES:
            if re.search(pat, n, re.I) and p.get(field) is not None:
                if abs(p[field] - want) > 0.05:
                    add('ERROR', n, 'name %s but %s is %.1f' % (why, field, p[field]))

        stated = age_in_name(n)
        if stated is not None:
            if p.get('age') is None:
                add('WARN', n, 'name states %d years but no age is stored' % stated)
            elif int(p['age']) != stated:
                add('ERROR', n, 'name states %d years, stored age is %s'
                    % (stated, p['age']))

        for label, pat, allowed in CATEGORY_WORDS:
            if re.search(pat, n, re.I) and sub not in allowed:
                add('WARN', n, 'name says "%s" but it is filed as %s' % (label, sub))

        if re.search(r'cask\s*strength|barrel\s*proof|\bfull\s*proof\b', n, re.I) \
                and proof and proof < 100:
            add('WARN', n, 'called cask strength but only %.1f proof' % proof)

        # ---- region ------------------------------------------------------
        region = p.get('region')
        if region and sub != 'scotch':
            add('ERROR', n, 'has region %s but is not Scotch' % region)
        if region and region not in SCOTCH_REGIONS:
            add('ERROR', n, 'region "%s" is not one of the six' % region)

        # ---- cask --------------------------------------------------------
        fin, wine = p.get('fin'), p.get('wine')
        if wine is not None and not fin:
            add('ERROR', n, 'wine_cask is set but there is no finish')
        if fin and wine is None and not re.search(r'multi-cask|STR', fin):
            add('WARN', n, 'finish "%s" but wine status unknown' % fin)
        if fin and re.search(r'\bsherry\b', fin) \
                and re.search(r'pedro|oloroso|fino|amontillado|manzanilla|cream', fin, re.I):
            add('WARN', n, 'finish "%s" carries both a named sherry and the generic one' % fin)

        # ---- price -------------------------------------------------------
        msrp, sec = p.get('msrp'), p.get('sec')
        if msrp is None:
            add('NOTE', n, 'no price')
        elif msrp <= 0:
            add('ERROR', n, 'price is %s' % msrp)
        elif msrp > 2000:
            add('WARN', n, 'price $%.0f is very high — check it' % msrp)
        if sec and msrp and sec < msrp * 0.25:
            add('WARN', n, 'secondary $%.0f is far below MSRP $%.0f' % (sec, msrp))

        # ---- tasting notes ------------------------------------------------
        tn = p.get('tn')
        if tn:
            missing = [k for k in ('colour', 'nose', 'palate', 'finish') if not tn.get(k)]
            if missing:
                add('NOTE', n, 'tasting notes missing ' + ', '.join(missing))
        else:
            add('NOTE', n, 'no tasting notes')

        # ---- distillery ---------------------------------------------------
        if not p.get('dist'):
            add('WARN', n, 'no distillery')

    # ---- shelf-wide ------------------------------------------------------
    for name, group in by_name.items():
        if len(group) > 1:
            add('ERROR', group[0]['name'], 'name appears %d times in the catalog'
                % len(group))

    keys = set(cat)
    for b in bottles:
        if b['k'] not in keys:
            add('ERROR', b['k'], 'bottle %s points at a product that is not there' % b['id'])
    seen = Counter(b['id'] for b in bottles)
    for bid, c in seen.items():
        if c > 1:
            add('ERROR', bid, 'bottle id used %d times' % c)

    # The stocking rule: anything owned more than once has exactly one open.
    owned = defaultdict(list)
    for b in bottles:
        if b['status'] != 'gone':
            owned[b['k']].append(b['status'])
    for k, sts in owned.items():
        if sts.count('open') != 1:
            add('ERROR', cat.get(k, {}).get('name', k),
                '%d bottles, %d open — the rule is exactly one'
                % (len(sts), sts.count('open')))

    for f in flights:
        for p in f.get('core', []):
            if p.get('k') and p['k'] not in keys:
                add('ERROR', f['title'], 'core pour %s is not in the catalog' % p['k'])
        n_core = len(f.get('core', []))
        if n_core < 4 or n_core > 9:
            add('WARN', f['title'], '%d core pours' % n_core)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    strict = '--strict' in sys.argv
    path = args[0] if args else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'data.json')
    d = json.load(open(path, encoding='utf-8'))
    check(d['catalog'], d['bottles'], d.get('flights', []))

    counts = Counter(s for s, _, _ in findings)
    print('\nData QA: %s' % path)
    print('  %d products, %d bottles\n' % (len(d['catalog']), len(d['bottles'])))

    for sev in ('ERROR', 'WARN', 'NOTE'):
        rows = [(p, m) for s, p, m in findings if s == sev]
        if not rows:
            continue
        print('%s (%d)' % (sev, len(rows)))
        # Notes are counted, not listed one by one: 138 "no tasting notes"
        # lines would bury the errors that need reading.
        if sev == 'NOTE':
            for msg, c in Counter(m for _, m in rows).most_common():
                print('   %4d  %s' % (c, msg))
        else:
            for p, m in rows[:60]:
                print('   %-46s %s' % (str(p)[:46], m))
            if len(rows) > 60:
                print('   ... and %d more' % (len(rows) - 60))
        print()

    bad = counts.get('ERROR', 0)
    print('%d errors, %d warnings, %d notes\n'
          % (bad, counts.get('WARN', 0), counts.get('NOTE', 0)))
    return 1 if (strict and bad) else 0


if __name__ == '__main__':
    sys.exit(main())
