# What to do with the files

## Every delivery: upload these four to the repo root

    index.html
    sw.js
    killer-bs-v<version>.html
    killer-bs-v<version>-sw.js

That is the whole deployment. GitHub Pages serves them; the app updates
itself on next open. The two `killer-bs-v…` files are frozen copies of the
other two — they are never edited, they exist so you can roll back.

## Sometimes, only when I say so

    data.json     the shelf — only when bottles or their fields changed
    map.json      distillery coordinates — only when the map changed
    manifest.json, mark.png, icon-192.png, icon-512.png
                  the icons and install metadata — rarely, months apart

If I do not mention them, they have not changed and you can skip them.
`python3 ship.py` prints the list, and after you upload, `python3 ship.py
--shipped` records it so the next run only lists what moved.

## Never uploaded — repo only, or ignore entirely

    bump.py  audit.py  ship.py  validate.py  enrich.py  killer-bs-test.js
    lookup.gs  CHANGELOG.md  BACKLOG.md  DEPLOY.md

These are the workshop, not the app. The browser never asks for them.
Commit them so they are not lost, and otherwise ignore them — I run them,
not you.

The one exception is `enrich.py`, below.

## enrich.py — the only file that needs you

It reaches out to WHISKY:EDITION and Pour Picks to check the shelf against
outside sources. I cannot run it: this container has no network route to
either site. So it sits there until you run it, or until we find another
way.

It needs Python 3 and the file sitting next to `data.json`.

    python3 enrich.py --probe

Twenty bottles, about a minute. It prints a summary and writes
`enrich-report.csv`. If the CONFIRM count is healthy and MISS is small, the
sources are worth using; if almost everything is MISS, they do not cover
your shelf and we stop there. That is the whole point of the probe — it is
a decision, not a chore.

If it looks good:

    python3 enrich.py --full

All 325 bottles, roughly forty minutes, and it resumes if interrupted.
Then open `enrich-report.csv` in a spreadsheet. It is sorted so the rows
needing a decision come first:

  CONFLICT   a source disagrees with what we hold. Read every one.
  WEAK       matched a similar name, not the same one. Check `source_name`;
             if it is right, change the bucket to the `would_be` value.
  FILL       a field we had empty. Safe to accept in bulk.
  SUPERSEDE  a sourced note where one of mine sits. Your call.
  CONFIRM    agrees with us. Nothing to do; the count is the confidence.
  MISS       neither source had it.

Delete any row you do not want. Then send me the file, or run:

    python3 enrich.py --apply enrich-report.csv

Nothing changes in `data.json` until that last command.

## If you would rather not run anything

Say so. The app is complete without it — enrichment fills gaps and checks
old data, it does not make anything work. It can wait indefinitely.
