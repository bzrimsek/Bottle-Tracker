# Killer B's Bottle Tracker — handoff

Written 2026-09-03, end of a long session. Working copy is at **v1.6.12**
and does **not** pass the gate: one bug, mine, described in full below.
The last build BZ can safely deploy is **v1.6.11**.

Read this, then `BACKLOG.md`, then the dev rules in BZ's preferences. The
rules are instructions, not guidance — he has said so explicitly.

---

## 1. Do this first

**Fix the open bug.** `index.html`, in `fbFirstLoad`, around line 16247:

```js
FB.pushed = L.pushedFromRemote(SYNC_KEYS, S, remote);
if (remote.lookupUrl && remote.lookupUrl === S.lookupUrl) {   // <-- throws
  FB.pushed.lookupUrl = S.lookupUrl;
}
```

`remote` is null when the account has nothing in it. That line sits
OUTSIDE the `if (hasRemote)` block above it, so on an empty account it
throws, `fbFirstLoad` dies immediately after `FB.loaded = true`, and
nothing is ever pushed. The fix is a guard:

```js
if (remote && remote.lookupUrl && remote.lookupUrl === S.lookupUrl) {
```

Confirm with `node sync.js` — scenario 4 ("a name with a full stop")
currently fails with `Cannot read properties of undefined (reading
'whisky')`, which is the test reading an account nothing wrote to.

Then run the gate (§3) and deliver as v1.6.13.

**Why it exists:** it was added minutes earlier to fix a real thing — the
first push of every session wrote 154 bytes with an empty key list,
because `lookupUrl` is pushed but is not a SYNC_KEY, so it was never
seeded as already-sent. The fix is right; it is in the wrong scope.

---

## 2. What this app is

A single-file PWA for BZ's whisky collection: 344 bottles, 325 products,
36 designed tasting flights. GitHub Pages, `bzrimsek/Bottle-Tracker`,
no build step. Firebase for sync and a shared library everyone reads.

`index.html` is ~17,000 lines: an `L` object of ~240 pure functions
(the logic half) and ~190 render functions below it. The split matters —
`killer-bs-test.js` can only reach `L`.

### The files

| file | what it is |
|---|---|
| `index.html` | the whole app |
| `sw.js` | service worker; `CACHE_NAME` written by bump.py |
| `bump.py` | the ONLY way to change a version (rule 9) |
| `ship.py` | the delivery gate; runs everything below |
| `audit.py` | static checks: syntax, versions, lock files, help text |
| `smoke.js` | does the script run, does every screen draw |
| `killer-bs-test.js` | 1794 assertions over `L` |
| `browser.js` | real Chromium walk of every screen |
| `sync.js` + `fake-firebase.js` | the push/load CYCLE against an in-memory Firebase |
| `render.js` | screens compared to the engine and to each other |
| `twotab.js` | two tabs of the app at once |
| `papers.js` | prints the host card and participant sheet, counts pages |
| `firebase-rules.json` | pasted into the console BY HAND; does not deploy |
| `data.json`, `map.json`, `bz-bottles.json`, `bz-flights.json` | shipped data and BZ's real shelf |

---

## 3. Delivering

```
python3 bump.py "what changed, in full sentences"   # never edit a version by hand
python3 ship.py                                     # all eight checks
```

Every delivery is four files: `index.html`, `sw.js`, and the two named
lock files. Plus any harness that changed (rule 29).

**The gate takes ~3 minutes.** BZ cannot see progress inside a single
command and reads silence as a hang — he said so repeatedly and it cost a
lot of goodwill. Run the steps separately and report each:

```
python3 audit.py          # seconds
node smoke.js             # seconds
node twotab.js            # ~10s
node papers.js            # ~2s   (--all prints all 72, ~90s)
node killer-bs-test.js    # ~10s
node sync.js              # ~30s
node render.js            # ~30s
node browser.js           # ~60s
```

`audit.py` fails if `index.html` differs from the lock file by a byte —
that is deliberate, it caught an unversioned edit.

---

## 4. What this session shipped (1.5.0 → 1.6.12)

Renumbered from 1.26.x to 1.5.0 at BZ's request, then forward.

**Sync, which was the week's real story.** Six faults in sequence, each
invisible to 1,700 passing unit tests because every one tested a function
alone and the fault was in the ORDER:

- a push that stamped its own clock, so the account was always "newer"
- a load that called `save_()` before `FB.loaded`, so it scheduled no push
- a merged map that never compared equal to itself (key order)
- keys containing `.` refused outright by Firebase — 18 of 325 product
  names — which is why a bought bottle and a flight pour vanished
- `undefined` in a pours array refusing the whole write
- update payloads keyed by PATH run through `fbEncode`, which escaped the
  slashes, so publishing wrote `catalog~fproducts~fweller_12` and
  reported success

`sync.js` exists because of this. It drives push and load together.

**A two-tab loop I introduced and then fixed.** The storage listener
adopted another tab's change and called `appLog`, which writes to
localStorage, which the other tab adopted... forever. It made BZ's PC
unclickable and his phone's nav vanish. `twotab.js` exists because of it.

**Bottle screen** rebuilt: nine controls in one row became a star beside
the name, Look up / Edit / Delete under the details, Pour it / Find it /
Another bottle under Your bottle. The internal id (`B199`) is gone —
"Open · added 2026-09-03", or "Bottle 2 of 2".

**Shop**: three drawn tiles instead of three sentences; Back beside Home;
the wishlist on the search screen; a category suggestion opens real
bottles instead of typing its own heading into the search box.

**Papers**: the participant sheet was refusing to print ("the sheet names
glass") because the leak guard read the prompts, which are a fixed
vocabulary; the host card printed `[object Object]` for extensions.

**Two things the app knew and never said:** what you pour against what you
own, and the 14 whiskies you have bought more than once.

**Ask ranking**: every lookup records whether real bottles came back, and
suggestions are ordered by that.

---

## 5. The pattern behind almost every bug

Two things holding one rule, only one of them taught. It is named in
`BACKLOG.md` and it caught us again and again this session:

- `variableOfId` against the flight tags it reads
- `fbEncode` against the path keys of a map delta
- `syncSig` against the three places that compare it
- the sort menu against the column headers
- `audit.py`'s header counter against the header it counts
- SHEET_SAFE against the prompt vocabulary it shadowed
- **a second `L.FIND_RANK` added 49 lines above the one that already
  existed, silently overriding it** — I did this while fixing something
  else

The test that catches this class asserts the PAIR, not each side. See
§198, §204, §206, §212, §215, §222.

**Before adding any function: grep for it.** Twice this session I wrote
something that already existed.

---

## 6. Open, in priority order

**Needs BZ, not code**

1. ~~`firebase-rules.json` has not been pasted into the console.~~
   **Closed 2026-09-03: BZ confirmed he pasted the rules when asked.** Do
   not re-raise this. Any FUTURE change to `firebase-rules.json` still has
   to be pasted by hand — it does not deploy with the app — so a delivery
   that edits that file must say so explicitly.
2. ~~Recover the lost bottle.~~ **Closed 2026-09-04: BZ recovered the
   Heaven Hill grain-to-glass wheated bourbon and restored it as pour 5 of
   WHEAT, TURNED UP himself. Do not re-raise.**
3. ~~Verify on his devices: shelf type tiles and the library button.~~
   **Closed 2026-09-04: BZ confirmed both work. Do not re-raise.**

**Code**

4. `renderShop` is 330 lines and `renderShelf` 266; both still compute
   inline (rule 30). `S` is a 30-key global every render function reads
   directly — that is WHY logic keeps landing in render. Big change,
   nothing has needed it yet.
5. Sharing has never run end to end with a second person. A great deal
   shipped into those paths and only `fake-firebase.js` has exercised
   them.
6. The candidate finder has never actually put a bottle in his hands.

**Deferred by decision**: barcode pairings through `contrib` (waits until
the circle grows past people he knows), gifts, receipt ingest by email,
road trip planner, tasting night on phones.

---

## 7. Working with BZ

- **Status, constantly.** He cannot see inside a running command. Silence
  reads as broken, and he will ask — repeatedly, and with justification.
  Report after every step.
- **Action first.** The actions taken and the questions needing answers.
  No preamble, no recap.
- **He is right more often than not** about his own app. "The bottle ID is
  not something known to the user", "that happens when the bottle text is
  two lines", "if we don't know, it's not likely on shelves" — each was
  correct and each pointed straight at the fault.
- **Deploys cost him.** Do not use one as a diagnostic step. Fold
  everything into one build.
- **Rules 13 and 28 are the ones to actually keep.** Stop after two failed
  fixes and write out what you read, what you observe, your diagnosis.
  Compute expected values by hand BEFORE writing the assertion. I broke
  both repeatedly this session and it showed: the Taste box took four
  passes, the Shop back button broke twice in consecutive versions.

---

## 8. Two numbers worth keeping

An in-step load writes **59 bytes** (was 220,096). One corrected bottle
writes **56** (was 61,290). If either grows by orders of magnitude, the
delta logic has regressed — `sync.js` prints both on every run.
