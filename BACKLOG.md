# Killer B's Bottle Tracker — backlog

Everything not built, why, and what it needs. Checked against the code at
v0.1.33 rather than against memory — several entries in the previous version
had gone stale (US coordinates were listed as missing after they were added).

---

## Blocked on you

### 1. Multi-user, sharing and tasting night
The largest missing feature, and the one the app was originally scoped
around. Right now every shelf lives in one browser.

Needs from you: the Firebase project config, and one decision — do guests
join a tasting **by code** (fast, no accounts, no history) or **by account**
(slower to start, but their answers persist across nights)?

Designed but unbuilt on top of it:
- Tasting-night mode. You asked for all three: host-only with paper, guests
  scoring blind on their phones, and a live reveal. None exist.
- The blind column locking on submit, so an answer cannot be changed once
  anyone has seen the reveal.
- Post-night summary: what the room got right, which pour fooled everyone.
  Today the SMS is the flight and its snacks, not what happened.

### 2. Turn on the lookup and design service
`lookup.gs` is written and ships with the app. None of it runs until you
paste it into script.google.com, add `ANTHROPIC_KEY` to Script Properties,
deploy as a web app, and paste the `/exec` URL into Settings.

It powers three things that are otherwise inert:
- Filling a new bottle's fields from its name, in Shop and Add a bottle.
- AI flight design in Build a flight (it falls back to the local
  recommender without it).
- `fillMissingNotes()`, the batch run for item 5.

### 3. Old Elk Infinity Blend
Missing from the catalog. Not added because it is an annual release and the
proof changes each year, so that number has to come off your bottle. Add it
through Shop once you have the label in front of you.

---

## Loose ends I created and did not close

### 4. Wishlist
When the flight cards were imported, six bottles turned out to be ones you
do not own — Pappy Van Winkle 15, Van Winkle Lot B, Old Rip Van Winkle 10,
Longrow 18, and two Heaven Hill Grain to Glass releases. Who's Your Daddy?
is a three-pour flight for that reason, and Peat Is a Postcode is five.

I said at the time the app needed a wishlist state so those pours are
modelled rather than dropped. It was never built. Without it the validators
will keep reporting those two flights as short — correctly, but unhelpfully.

### 5. The 138 bottles with no tasting notes
187 of 325 carry colour, nose, palate and finish, all lifted off the flight
cards, and all of them prompts I wrote rather than sourced. The other 138
have nothing. `fillMissingNotes()` sources them into a CSV on your Drive for
review; it needs item 2 first. You can also add your own on any bottle,
which is the better answer wherever you have actually tasted it.

### 6. Barcode scanning
Discussed early, never built. The camera half is straightforward; the lookup
half is the problem item 2 solves. The design that survives: the first
person to scan an unknown barcode types the bottle once, and that mapping is
shared — so the barcode database is a by-product of use rather than a
purchase.

### 7. Three unplaced bottlers
Silver Screen Bottling Company, River Roots Barrel Company and Three Chord
have no coordinates because I could not confirm where they bottle. They are
on the shelf and in every count, absent only from the map. One line each
once you know.

---

## Deferred by design

### 8. Receipt ingest by email
Forward a receipt to a dedicated Gmail account; Apps Script polls every
fifteen minutes, parses it, and drops the acquisition into a pending queue
for confirmation. No domain needed. Parsers are per retailer, so it grows
one shop at a time. Waits on item 2, since it is the same script project.

### 9. Road trip planner
You backlogged this yourself. Every distillery on the shelf now has real
coordinates — 53 US, 23 Scottish, 18 Irish — so the data side is done.

The open question is still routing: straight-line ordering with distances
costs nothing and works offline but is not roads. Real driving directions
need a routing API, a key and a proxy, and no free router handles the Islay
ferry well. Nearest-neighbour ordering is fine for six stops; a true optimal
tour is overkill.

### 10. Flight re-instantiation
The idea that a flight is a template and its six bottles are one cast of it,
so Sherry Is Not One Thing can run again next year with different pours. The
AI builder covers part of this — ask for the same variable and it proposes
from what is open now — but there is no "re-cast this flight" button, and no
record that run two is a second instance of one flight rather than a
different flight.

---

## Data questions, small

- Two secondary prices look wrong: Basil Hayden at $20 against an $85 MSRP,
  and Green Spot Montelena at $25 against $110. Both flagged by the QA run.
- Four QA warnings are the checker being conservative and are correct as
  filed: Baker's High Rye Bourbon, Powers Rye Irish Whiskey, and the VDC
  Goose Island Bourbon County Stout, where Bourbon County is a stout name.

---

## Closed

Scotland map (v0.1.10) · world and US layers (v0.1.13) · home summary
(v0.1.13) · reference tab and pin counts (v0.1.14) · tasting and whiskey
reference (v0.1.15) · Shop (v0.1.16) · installable with auto-update
(v0.1.17) · split changelog (v0.1.18) · ship gate (v0.1.19) · data QA and US
coordinates (v0.1.25) · header actions and CSV import (v0.1.26) · one
continuous map and Irish coordinates (v0.1.29) · AI flight design with local
verification (v0.1.30) · clickable charts (v0.1.31) · changed-file tracking
(v0.1.32).
