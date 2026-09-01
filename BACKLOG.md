# Killer B's Bottle Tracker — backlog

Deferred work, tracked so it does not carry silently across sessions
(rule 31). Each entry says what it is, why it is not built yet, and what
it needs before it can be.

---

## 1. Road trip planner  — requested 2026-08-31, backlogged by BZ

Pick distilleries and build a driving route between them.

**What exists already that it would build on**
- `map.json` carries real coordinates for all 23 Scottish distilleries.
- US distilleries are mapped to states, not to points — a route needs
  points, so 53 US distilleries would each need a latitude and longitude.

**What it needs**
- Distillery coordinates for the US (and Ireland, if the trip is Irish).
- A routing decision. Straight lines between pins are free and honest but
  are not roads. Real driving routes need a routing API, which means a
  key, a proxy, and a cost — the same shape as the bottle-lookup decision.
  Ferry legs matter on Islay, and no free router handles them well.
- An ordering rule: nearest-neighbour is simple and usually close enough;
  a true optimal tour is the travelling-salesman problem and overkill for
  six stops.

**Open question for BZ:** straight-line "as the crow flies" ordering with
distances, which costs nothing and works offline — or real road routing
with an API key behind the Apps Script proxy?

---

## 2. Multi-user / Firebase  — blocked on BZ

Auth and shared data are designed but not wired. Needs the Firebase
project config, and a decision on whether guests join a tasting by code
or by account. Until then all data is local to the browser.

---

## 3. Bottle lookup by name  — deferred to v2 by design

The Shop tab (v0.1.16) does the shelf-fit half of this offline: you type
the proof, price and type from the label and it judges the bottle against
your collection. What is still missing is having those fields filled in
for you.

Type a name, get proof/distillery/age/finish back for confirmation.
Decided: Claude Haiku first, escalating to Sonnet with web search only on
low confidence, key held in Apps Script, results written back to the
shared catalog so each whisky is paid for once. Not built — the catalog
already covers what BZ drinks, so the miss rate is unknown until the app
has been used for a while.

---

## 4. Receipt ingest by email  — deferred to v2 by design

Forward a receipt to a dedicated Gmail account; Apps Script polls every
15 minutes, parses, and drops parsed acquisitions into a pending queue
for confirmation. No domain required. Parser templates are per retailer.

---

## Closed

- Scotland map — shipped v0.1.10.
- World and US map layers — shipped v0.1.13.
- Home summary page — shipped v0.1.13.
- Reference tab — shipped v0.1.14.
- Bottle counts on map pins — shipped v0.1.14.
