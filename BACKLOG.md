# Killer B's Bottle Tracker — backlog

Checked against the code and data at v0.1.36, not against memory. Two items
closed since the last revision (US coordinates completed, the two price
errors corrected).

---

## Blocked on you

### 1. Multi-user, sharing and tasting night
The largest missing feature, and what the app was originally scoped around.
Every shelf currently lives in one browser.

Needs from you: the Firebase project config, and one decision — do guests
join a tasting **by code** (fast, no accounts, nothing persists) or **by
account** (slower to start, but their answers carry across nights)?

Unbuilt on top of it:
- Tasting-night mode. You asked for all three: host-only with paper, guests
  scoring blind on their phones, and a live reveal. None exist.
- The blind column locking on submit, so an answer cannot change once
  anyone has seen the reveal.
- Post-night summary: what the room got right, which pour fooled everyone.
  Today the SMS carries the flight and its snacks, not what happened.

### 2. Turn on the lookup and design service
`lookup.gs` ships with the app and does nothing until you paste it into
script.google.com, add `ANTHROPIC_KEY` to Script Properties, deploy as a web
app, and paste the `/exec` URL into Settings.

Three features are inert without it:
- Filling a new bottle's fields from its name, in Shop and Add a bottle.
- AI flight design (Build a flight falls back to the local recommender).
- `fillMissingNotes()`, the batch run for item 4.

### 2b. Shared shelves, matched bottles, and Join Me Pour
Requested 2026-08-31. Decisions taken: **one bottle, not a flight** ·
**asynchronous** · **built for three from the start**. Sits on top of item 1.

**Part one — share a shelf.** A user grants another read access. Read-only
by construction: your corrections are yours, and a buddy must never be able
to retire your bottle. Two things must NOT travel with a shared shelf —
what you `paid`, and your private notes. MSRP is a public fact about a
bottle; what you paid is a fact about you.

**Part two — match across shelves.** Open bottles only: a sealed backup is
not a match, it is a maybe. One bottle in common is a low enough bar that
three shelves will clear it easily, which is why the one-bottle decision
makes this tractable.

**Part three — Join Me Pour, asynchronous, over text.** Pick a bottle you
all have open; everyone gets the same message with what to pour, how much,
and what to look for. Asynchronous means nobody needs a shared clock —
everyone pours within a day or two and the answers assemble as they arrive.
The message must stand alone: nobody installs anything to join a pour.

**Part four — three, not two.** Nothing in the message, the matching or the
results may assume a pair.

---

#### The barcode question — scan it, but do not key on it

Scanning is the right idea and solves the real problem, which is that two
people who own the same whisky must land on the same catalog entry or
nothing downstream works. A scan is typo-free and instant at a shop shelf.

But a UPC identifies a **SKU, not a liquid**, and this shelf proves it:

- **32 single barrels.** Every Blanton's bottle carries the same UPC and
  contains a different barrel. Keying on UPC would declare two different
  liquids identical — and single barrels are exactly the bottles worth
  comparing across shelves.
- **20 vintage or annual releases.** Ardbeg Committee, Fèis Ìle, Booker's
  batches. Some reuse a code across years at a different proof. Old Elk
  Infinity, the bottle still missing from the catalog, is precisely this
  case.
- **One product, several codes.** 750ml against 1L, US against EU, and any
  package redesign. A UPC-keyed catalog fragments one whisky into three.
- **The shipped catalog has no UPCs at all** and cannot be given them
  remotely — a code only exists once someone holds the bottle. So UPC can
  never be the primary key for the 325 already here; it can only accrue.

So: the catalog key stays the product identity, and barcodes become a
many-to-one **index onto it** — `barcodes: { "<code>": "<catalog key>" }`.
Several codes may point at one product; a scan resolves to that product;
per-bottle proof continues to distinguish one barrel from another, which the
app already models.

That gives the matcher a confidence ladder rather than a yes or no: a shared
UPC is a strong match, the same catalog key is a good one, the same
distillery and expression at a different barrel is a near match worth
showing. For the 256 standard releases here, a UPC match will be exact and
effortless, which is the majority of any Join Me Pour.

It also makes the barcode database a by-product of use: the first person to
scan an unknown code types the bottle once, that mapping is shared, and
nobody types it again. This supersedes item 6, which described the same idea
without the shelf-matching reason for it.

**Visibility.** A buddy sees your whole shelf — that is the fun of it, and
it invites "you have WHAT open?". The overlap is computed and shown only
when a pour is being set up, where it is the thing you actually need.

**No structure around the pour.** It is a pour, not an event: pick a bottle
you both have open, send the text, and that is the whole of it. No scoring,
no scheduling, no reveal, no results to assemble. Anything that would need a
protocol belongs in tasting night, which is item 1.

**The slot machine is where a match should surface.** Time for a Taste
already knows what is open and already lands on one bottle. If a buddy's
shelf is shared, the payline is the natural place to say so — a mark on the
glass, and a line reading that Marcus has this open too. It turns a match
into something you stumble on while deciding what to drink, rather than a
screen you have to go and look at, and it costs nothing beyond an
intersection the app already has to compute.

**Find me a match, as an option rather than a badge.** Better than marking
matches passively: a mode on the machine that spins only across bottles a
buddy also has open. That way a match is something you ask for when you want
company, not a badge quietly steering you back toward the bottle you always
reach for — which was the risk with the passive version.

The code is already the right shape for it. `spinValid` builds its candidate
pool with a single filter and then describes whatever it picked; adding
"and someone else has this open" is one more predicate on that filter, and
every guarantee the machine already has comes along unchanged — the payline
can still never come up empty, holds are still honoured, and an impossible
combination still says which hold to release rather than spinning to
nothing. The message when it fails writes itself: nothing Marcus has open
matches Islay and 120-plus, release a hold.

**Duo and trio shown separately, and it stops there.** A result says either
"you and Marcus" or "all three of you", as two distinct outcomes rather than
one blurred list — a trio match is the rarer and better find, and burying it
among the duos wastes it. Past three the combinatorics stop being worth it:
four people give eleven possible groupings and the interesting one is still
just everybody. Cap the feature at the two shapes and let a fourth buddy
count toward the trio-or-more case rather than opening a new tier.

That also keeps the shape simple where it matters — the pool filter takes a
list of shelves and a rule of any or all, and the UI shows two results.

Still true either way: a spin is judged on your own shelf first. The match
decides which bottles are eligible, not which one is good.

#### Our shelves, as a picture — settled

Three circles, the count of common bottles written in each overlap, and a
tap on any region opens the list. Decided 2026-08-31.

Deliberately NOT area-proportional. Three circles can only carry correct
proportional overlaps across a narrow range of set sizes, and this is well
outside it — a 325-bottle shelf against a buddy's eighty is a 2:1 radius
before any overlap is considered, and the seven regions will not resolve.
Equal circles with the counts written in carry the magnitude honestly; a
Venn that quietly lies about area is worse than one that plainly does not
encode it.

The drill-through is not new mechanism. Tapping a region and getting a
tappable bottle list that leads to the bottle is exactly what the dashboard
charts already do — same helper, different source set.

Seven regions, and the two that matter most are not the obvious ones:

- **All three** — the Join Me Pour list.
- **You and one buddy** — two of these, and the reason duo and trio are
  shown separately elsewhere in this item.
- **They both have it, you do not** — the shopping list. Two people you
  trust both bought it.
- **Only you** — what you bring to the group that nobody else can.

The last two are the reason to draw the picture at all. The outer totals are
scaffolding.

A toggle between WHISKIES and OPEN bottles, defaulting to open. Open is
honest for pouring and makes every region smaller; whiskies is the better
shopping list, since a sealed bottle still says something about taste.

A fourth person breaks the shape — four sets need ellipses or a bar per
intersection — which is another reason the feature caps at duo and trio.

#### Holding a bottle back

You buy something, it goes in inventory, and your friends can see it — but
sometimes the whole point is that nobody knows until you pour it. Every
bottle needs a **held back** state: yours in every way, invisible to
everyone else.

The naive version is a private flag on the bottle, and it does not work,
which is probably why Only Drams has not solved it. **The aggregates leak.**
If a buddy sees your shelf reading 324 today and 325 tomorrow with no new
bottle appearing, they have learned there was something hidden and roughly
when you bought it. The same leak runs through every shared number: the
totals, the by-type chart, the Scotch-by-region bars, the map pin counts,
the Venn regions, and the shelf value.

So the rule has to be stronger than hiding a row. A held-back bottle is
absent from EVERY shared surface, and what a buddy sees is a smaller,
internally consistent shelf rather than yours with a gap in it. Their view
should be indistinguishable from you simply not owning the bottle. If that
property does not hold everywhere, the feature is decorative.

Two specific places it must reach beyond the obvious:
- **Matching and Join Me Pour.** A held-back bottle must never be matchable,
  or a buddy gets offered a pour of something they cannot see.
- **The trio region of the Venn.** If both buddies own it and you are hidden,
  the region correctly reads as a duo. That is the intended lie and it is a
  consistent one.

**Default is shared.** Held back is the deliberate act, because the reverse
default makes sharing useless the first time you forget. But forgetting the
other way costs you a surprise, so the shelf needs a standing, visible count
— "3 bottles held back" — somewhere you cannot miss it, and each held-back
bottle should be marked on its own row too.

**Release** should be one tap from that count, and it should support
releasing all of them at once, since the natural moment is the drive home
from the tasting where you poured them. An optional release-on-date is worth
having for a bottle bought well ahead of a specific night, but the manual
path is the one that will get used.

Worth noting for whoever builds it: this is easier to get right if held-back
is filtered at the point the shared view is BUILT rather than at the point
it is rendered — one filtered copy of the shelf, and every chart, count and
match computed from that copy. Filtering per surface is how one of them gets
missed, and the one that gets missed is the leak.

### 2b-i. One resolver, not a batch script
Design constraint agreed 2026-08-31, and it governs 2, 2c and 2d.

Whatever fills in the 138 has to be the same code path that fills in bottle
number 326. The failure mode to avoid is obvious once named: build a batch
enrichment script, run it once against the backlog, and then every bottle
bought afterwards goes through a different and worse path — hand-typed at
the shop, with none of the sources the script had. The backlog gets clean
once and starts rotting again the same week.

So: **one resolver**. Give it a bottle name, get back fields with a source
attached to each. The batch run is that resolver in a loop over 138 names;
Shop and Add a bottle are that resolver called once. Nothing about the
sources, the ordering or the trust rules is duplicated between them.

**Sources tried in order, cheapest and most trusted first:**
1. The shared catalog — free, instant, and already correct for anything a
   user has resolved before.
2. WHISKY:EDITION — free, official, carries notes. Scotch-heavy.
3. Whiskybase — obscurity, age, strength, coordinates, market price.
4. The model via `lookup.gs` — the only one that can reach a bottle nobody
   has catalogued, and the only one that can be wrong in a fluent way, so it
   goes last and is told to return null rather than guess.

**Provenance has to be per FIELD, not per bottle.** This is the part that
will be got wrong if it is not written down now. Once sources are mixed, a
single bottle can carry an age from Whiskybase, notes from WHISKY:EDITION, a
price you typed off the OHLQ shelf, and a finish I read off a label. Storing
one source per bottle throws that away, and the current `tnSrc` field is
already bottle-level — it works today only because every note came from one
place. It will not survive the second source.

**Whatever is resolved goes back into the shared catalog.** That is what
makes the cost fall to nothing over time: the first person to resolve a
bottle pays for it, everyone after gets it free, and it is the same
convergence the join key in 2b needs. A resolver that only writes to one
user's shelf is a resolver that pays for the same whisky forever.

**Review before write stays.** Batch or single, nothing lands on the shelf
unread. For the batch that is the CSV on your Drive; for a single bottle it
is the form fields marked as looked-up, which the app already does.

### 2c. Where the missing tasting notes could come from
Three sources evaluated 2026-08-31. Ranked by what they actually solve.

**BottleDB (bottledb.org) — ruled out.** Its own front page reads
"gratefully serving everyone with information about 13 bottles". Thirteen.
An early-access project that has not been populated. Nothing to evaluate.

**WHISKY:EDITION (thewhiskyedition.com/developer) — try this first.**
The best fit on paper and the only one of the three that returns tasting
notes at all:
- Free, official, no key, published OpenAPI spec, Creative Commons 4.0.
  Attribution required — a link to WHISKY:EDITION wherever the data is used,
  which is a fair price and belongs in the Info tab.
- `/api/whisky-reviews/{slug}` returns `tasting_notes` as **nose, palate,
  finish** — no colour, so our fourth column would stay empty from this
  source.
- Metadata carries type, country, region, distillery, bottler, age, abv,
  price per litre and a flavour tag. Ratings are per-author, 0-100, from four
  named reviewers, plus a value-for-money score.
- Full-text search plus filters on distillery, region, abv, age and price,
  so a coverage probe is cheap to run.

**The catch, and it is the whole question: coverage.** They have reviewed
close to a thousand whiskies, and the published index is overwhelmingly
Scotch and European — Nc'Nean, Littlemill, Talisker, Springbank, German
craft. **194 of our 325 bottles are American or Canadian.** So the expected
hit rate on the 138 missing notes is probably low, and low exactly where the
gap is biggest.

**Do the probe before building anything.** Take twenty bottles from the
missing 138 — ten bourbon, five Scotch, five Irish — search each by name,
and count the hits. That is twenty free calls and it decides the whole
question. Above roughly a third, wire it up; below that, it is a nice source
for the Scotch shelf and not an answer for the rest.

**Provenance, and the mistake not to repeat.** These are the considered
notes of four named reviewers. That is a FOURTH category, distinct from the
distiller's own notes, from your tasting, and from the prompts I wrote for
the flight cards. The source list needs a `review` entry crediting
WHISKY:EDITION by name, and it must never be presented as the distiller's.

### 2c-ii. Pour Picks — the bourbon half, and the best of the four
Found 2026-08-31. `github.com/bguillow-rgb/pour-picks-mcp`, MIT, the catalog
behind the Pour Picks iOS journal. 4,700+ bottles, **bourbon-focused** —
precisely where WHISKY:EDITION is thin and where our gap is biggest.

**The important detail is not the MCP wrapper.** An MCP server over stdio is
the wrong shape for a static PWA and for Apps Script. But the README says
the query paths are plain SELECTs against publicly readable Supabase tables
under row-level security, and there is a streamable HTTP endpoint published
as well. So the data is reachable over ordinary HTTPS from `lookup.gs` — no
npm, no MCP client, no key. That is what makes it fit the one-resolver rule
in 2b-i instead of being a thing only an AI client can use.

**What it carries:** structured tasting profiles, price, pairings, community
ratings WITH rating counts so sample size is visible, and freshness dates per
bottle. Attribution requested, not required by licence, and easily given.

**Two claims in the README worth taking seriously.** All scoring is
deterministic with no AI calls inside the server, and every response carries
source attribution and a citation-ready line. That is a project being honest
about provenance, which is the quality that matters most here.

**Where it also helps beyond notes:** `find_similar` and
`find_cheaper_alternative` are exactly the question the Shop tab asks and
the flight builder's "one to buy" answers today from our own shelf alone.
A second opinion grounded in 4,700 bottles is a real improvement on a
suggestion drawn from 325.

**Risks, stated plainly.** Zero stars, zero forks, fourteen commits, one
author — this is days old. It depends on someone's Supabase project staying
up, which is a weaker guarantee than an official API and a stronger one than
a scraper. And it logs every query: tool name, arguments, client and
duration go to a write-only table. Your bottle searches would be in
somebody's telemetry. Not disqualifying for public catalogue lookups, but it
is a reason to send only the bottle name and nothing about your shelf.

---

#### The two together cover almost all of it

Splitting the 138 missing notes by which source would plausibly hold them:

| | bottles | source |
|---|---|---|
| American | 79 | Pour Picks |
| Scotch, Irish, world | 52 | WHISKY:EDITION |
| Canadian, tequila, other | 7 | neither — the model |

**131 of 138, about 95%, in principle reachable from two free sources**, with
the model in `lookup.gs` as the backstop for the remainder. That is a much
better answer than any one source, and it is the direct argument for the
resolver design in 2b-i: a chain of sources, cheapest first, each field
carrying where it came from.

Probe both before building. Ten bourbons against Pour Picks, ten Scotch
against WHISKY:EDITION, count the hits, and let the real numbers decide
rather than this table.

### 2c-iii. Probe, then run the whole shelf — not just the gaps
Decided 2026-08-31. Probe both sources first; if they hold up, run all 325
rather than only the 138 missing notes.

**Why the whole shelf is the right call.** Filling blanks is the smaller
half. The larger half is checking what is already there, and a full run is
the only thing that can catch the class of error `validate.py` structurally
cannot: a record that is internally consistent and simply wrong. Ardbeg Wee
Beastie is the proof — no age stored, five years on the label, and every
consistency check passes because nothing contradicts anything. There are
**241 bottles with no age stored**, and no way to know how many are false
negatives without asking a second source.

What a full run is actually reconciling:

| | count | what the run does |
|---|---|---|
| notes already stored | 187 | second opinion on notes I wrote, unsourced |
| notes missing | 138 | fill |
| age stored | 84 | verify |
| age missing | 241 | the Wee Beastie class |
| finish stored | 110 | verify |
| secondary price | 125 | replace Only Drams figures with live ones |
| obscurity | 325 | every one still seeded, never corrected |

**The output is a reconciliation, not a write.** At 325 rows nobody can
review a flat list meaningfully, so the report has to be sorted by what
needs a decision:

- **CONFLICT** — a source disagrees with a stored value on a checkable fact.
  Few rows, highest value, read every one.
- **FILL** — the field was empty and a source has it. Bulk, low risk,
  approve wholesale.
- **SUPERSEDE** — a sourced note where one of my card prompts sits today.
  A real source beats a prompt I wrote, but that is your call to make, not
  the script's.
- **CONFIRM** — source agrees. No action, but the count is the number that
  tells you whether to trust the run at all.
- **MISS** — nothing found. Feeds the model backstop.

**Make it re-runnable.** 650 calls exceeds the six-minute Apps Script limit
at any sane rate, so it batches and resumes — `fillMissingNotes()` already
works this way. Do the same and the run becomes something worth repeating
in a year, reporting only what changed since. Pour Picks supplies freshness
dates per bottle, which makes that diff cheap.

**Nothing is written until you have read the CONFLICT rows.** That rule has
already caught two errors this session from a single OHLQ page; at 325 rows
across two sources it will earn its keep several times over.

### 2d. Whiskybase via parse.bot — worth it, for QA and obscurity
Found 2026-08-31. An unofficial but maintained REST wrapper over
whiskybase.com. Six endpoints: search, distilleries with coordinates,
distillery catalogues, new releases, marketplace listings, and the Top 1000.

**It checked out on the one bottle we could verify.** The published sample
response is Ardbeg Wee Beastie, which is on the shelf. Strength came back
47.4 %vol — 94.8 proof, matching our data exactly. And it caught a real gap:
it states an age of 5, where we have no age at all. Wee Beastie IS a
five-year-old Ardbeg, so our record is wrong. 241 of 325 bottles have no age
stored, and at least one of those is a false negative.

**What it is genuinely good for, in order:**

1. **Fixing obscurity.** Every one of the 325 bottles still carries the
   `obscurity` value I seeded from distillery footprint, never corrected by
   hand, and it drives an entire reel of the tasting machine. Whiskybase
   rating and vote count are a real measure of how known a bottle is —
   vastly better than my guess. This is the highest-value use and it is not
   obvious from the endpoint list.
2. **Age and strength QA.** Cross-check the enriched fields against a second
   source and report disagreements rather than overwriting. The Wee Beastie
   miss is exactly the class of error `validate.py` cannot find on its own,
   because internally the record is consistent.
3. **Distillery coordinates.** `get_distilleries` with `include_location`
   returns latitude and longitude. This would have saved hand-placing 94
   distilleries, and could place the 17 bottles still off the map — the
   Canadian, Japanese, world and tequila categories.
4. **Secondary prices.** `get_marketplace_listings` gives real listings. The
   `sec` field on 125 bottles came from the Only Drams export and two of
   them were wrong enough to trip QA, so a live source is an improvement.

**What it does NOT solve, and this matters:**

- **Tasting notes.** The API explicitly does not return tasting notes,
  flavour profiles or user reviews. So it does nothing for item 4, the 138
  bottles with no notes — which is probably the first thing you would hope
  it did.
- **Barcodes.** No UPC field, so it does not help the shared-catalogue join
  key in item 2b.
- **MSRP.** Marketplace listings are secondary prices, not retail. OHLQ
  remains the better source for what you actually pay.

**Coverage risk.** Whiskybase is strongest on Scotch and European single
malt. 194 of 325 bottles here are American or Canadian, which is where its
coverage thins. Worth a cheap test before committing: search twenty bourbons
off the shelf and count the hits.

**Cost and terms.** Free tier is 200 credits a month at 5 requests a minute;
search is 1 credit, so the whole shelf is two free months or one $30 month.
But it is not an official API — Whiskybase publishes none — it is a scraper
with a self-healing layer in front of it. That means a terms-of-service
question and a dependency that can break, and it would be a second key
alongside the Anthropic one from item 2.

**Recommendation:** worth doing, as a one-off enrichment run rather than a
live dependency. Pull once, write the results into `data.json` behind a
review step exactly like `fillMissingNotes()`, and record where each field
came from. Nothing in the app should call it at runtime — a shelf that stops
working because a scraper broke is a bad trade for data that changes once a
year.

**Order of play, decided 2026-08-31.** Probe WHISKY:EDITION first, since it
is free and is the only source that carries notes. Use Whiskybase for what
it is uniquely good at regardless — obscurity from vote counts, age and
strength QA, distillery coordinates — since those do not overlap. And if
neither closes the gap on the American half of the shelf, fall back to the
one-off enrichment run through `lookup.gs`, which is the only option that
can reach any bottle rather than only the ones somebody has already
catalogued.

### 3. Old Elk Infinity Blend
Still not in the catalog. It is an annual release and the proof changes each
year, so that number has to come off your bottle. Add it through Shop.

---

## Loose ends I created and have not closed

### 4. The 138 bottles with no tasting notes
187 of 325 carry colour, nose, palate and finish — all lifted off the flight
cards, and all of them prompts I wrote rather than sourced. The other 138
have nothing. `fillMissingNotes()` sources them into a CSV on your Drive for
review, which needs item 2. Your own notes on a bottle you have actually
tasted are the better answer wherever you have one.

### 5. Wishlist, and what is missing from the shelf
Extended 2026-08-31 at BZ's request. Three parts; the first is overdue.

**Part one — the wishlist itself.** Six bottles referenced by the flight
cards are ones you do not own: Pappy Van Winkle 15, Van Winkle Lot B, Old
Rip Van Winkle 10, Longrow 18, and two Heaven Hill Grain to Glass releases.
That is why Who's Your Daddy? is a three-pour flight and Peat Is a Postcode
is five, and why QA reports one as short on every run. A wishlist state
models those rather than dropping them.

Shop gets an **Add to wishlist** beside I bought it — the common case is
seeing a bottle, not buying it today, and wanting to remember why. It should
record the reason, not just the name: which flight it would complete, which
gap it fills.

**Part two — what is missing.** The valuable half, and most of it needs no
AI at all. The app already knows enough to compute real gaps:

- **Thin categories.** Wheat 1, tequila 1, Japanese 2, world 2, flavoured 3.
- **Thin Scotch regions.** Lowland 1 and Campbeltown 1, against Islay 39.
  A region flight cannot be built on one bottle.
- **Proof distribution.** 159 bottles under 100 proof against 27 above 120,
  so a proof ladder runs out at the top.
- **Flights that cannot be run.** Two are short of pours. The builder
  already computes a "one to buy" per flight; aggregating that across all
  36 gives a shopping list where every entry names the flight it unlocks.
  That is the strongest version of this and it is nearly free.
- **Matched pairs one bottle short.** Same distillery, same proof, one
  variable apart — the app can already find where a pair is incomplete.

AI's job is narrow and comes last: turning a computed gap into named bottles
that would fill it at a price worth paying. The gap analysis stays local and
honest; the model only suggests what to buy, and a suggestion that does not
verify gets dropped — the same shape as the flight builder.

**The failure mode to design against:** a recommender that says buy Pappy.
Expensive, obvious, useless. The good version is biased toward cheap bottles
that unlock something — a $40 Lowland that makes a region flight possible
beats a $400 bourbon that changes nothing. Rank by what it enables per
dollar, not by prestige.

**Part three — the same view across buddies.** Once shelves are shared, the
question becomes what is missing from the GROUP. The Venn's "they both have
it and I do not" region is the personal version. The group version asks what
one bottle, bought by any of the three, would most improve what you can all
taste together — a better question than what any single shelf lacks, and the
natural thing to look at while setting up a pour.

Depends on item 1 for shared shelves and item 2b for the matching.


### 5b. Gifts — the wishlist pointed outward
Requested 2026-08-31. Two features that share one hard requirement.

**The gift finder.** Point the gap analysis from item 5 at somebody else's
shelf instead of your own, with a budget as an input: "forty dollars for
Marcus" returns what his shelf lacks that costs under forty. Most of the
machinery already exists — thin categories, thin regions, flights he cannot
run, matched pairs one bottle short. The only new things are the budget
filter and running it against a shelf that is not yours.

Budget is not optional and should be the first field, not a refinement.
Without it the answer is always the most expensive gap, which is the same
buy-Pappy failure as before and worse when someone else is paying. With it
the question becomes interesting: the best forty-dollar gift is a genuinely
different bottle from the best four-hundred-dollar one, and usually a more
thoughtful choice.

His wishlist should sit alongside the computed gaps, since a bottle he has
actually asked for beats one an algorithm inferred. Both, ranked together,
with the reason shown: "completes Peat Is a Postcode" or "he has wanted this
since March".

**Discretion, which is the hard part.** A gift only works if the recipient
does not know it is coming. So a buddy must be able to mark a bottle as
claimed — otherwise two of you buy the same thing — and the owner must never
see that claim.

This is the hold-back rule from item 2b, mirrored. There, you hide a bottle
you own from your friends; here, your friends hide an intention from you.
Both fail the same way: **through the aggregates.** If your wishlist reads
"6 bottles" to you and one of them renders differently, or a count moves, or
an item quietly sorts to the bottom, the surprise is gone. Your view of your
own wishlist must be **byte-identical whether or not anything is claimed.**
Claims live in a space you cannot read at all, not in a field that is
filtered out of your view — filtering is how one surface gets missed, and
the one that gets missed is the leak.

Two more that follow from it:
- **A claim has to expire or be released,** or the list silently rots as
  bottles stay claimed by gifts that were never bought. Released after the
  occasion, or on a date the claimer sets.
- **Two buddies must see each other's claims** while you see none. That is
  the whole point, and it is a three-way visibility rule rather than a
  two-way one: not "public or private" but "everyone except the subject".

Worth saying plainly: this is the most privacy-sensitive thing in the
backlog. It is not that a leak is dangerous, it is that a leak makes the
feature pointless — a gift finder that spoils gifts is worse than none.


### 6. Barcode scanning
Folded into item 2b, which supplies the reason to build it: barcodes are the
index that makes two shelves agree on what a bottle is. The camera half is
straightforward; the lookup half is what item 2 solves.

---

## Deferred by design

### 7. Receipt ingest by email
Forward a receipt to a dedicated Gmail account; Apps Script polls every
fifteen minutes, parses it, and drops the acquisition into a pending queue
for confirmation. No domain needed. Parsers are per retailer, so it grows
one shop at a time. Same script project as item 2.

### 8. Road trip planner
You backlogged this yourself, and the data side is now finished: all 56 US
distilleries, 23 Scottish and 18 Irish carry real coordinates.

The open question is routing. Straight-line ordering with distances costs
nothing and works offline but is not roads; real driving directions need an
API, a key and a proxy, and no free router handles the Islay ferry well.
Nearest-neighbour ordering is fine for six stops.

### 9. Flight re-instantiation
A flight as a template, its six bottles as one cast, so Sherry Is Not One
Thing can run again next year with different pours. The AI builder covers
part of this — ask for the same variable and it proposes from what is open
now — but there is no "re-cast this flight" button and no record that run
two is a second instance of one flight rather than a different flight.

---

## Small, open

- Four QA warnings are the checker being conservative and are correct as
  filed: Baker's High Rye Bourbon, Powers Rye Irish Whiskey, the VDC Goose
  Island Bourbon County Stout (a stout name, not a bourbon), and Who's Your
  Daddy? being short, which item 5 would explain properly.
- 17 bottles are not on the map: the Canadian, Japanese, world and tequila
  categories have no coordinate set. Four Scotch entries are blenders —
  Dewar's, Johnnie Walker, Orphan Barrel, Ian Macleod — and correctly have
  no dot, since a blend has no single place.
- The `obscurity` field on every bottle was seeded from distillery footprint
  and marked `seeded`. It has never been corrected by hand, and it drives
  one whole reel of the tasting machine.

---

## Closed

Scotland map (v0.1.10) · world and US layers (v0.1.13) · home summary
(v0.1.13) · reference tab and pin counts (v0.1.14) · Shop (v0.1.16) ·
installable with auto-update (v0.1.17) · split changelog (v0.1.18) · ship
gate (v0.1.19) · data QA and US coordinates (v0.1.25) · header actions and
CSV import (v0.1.26) · one continuous map and Irish coordinates (v0.1.29) ·
AI flight design with local verification (v0.1.30) · clickable charts
(v0.1.31) · changed-file tracking (v0.1.32) · MadGolf flex-column layout so
the nav cannot cover content (v0.1.34) · last three US bottlers placed and
the Montelena and Basil Hayden price corrections (v0.1.35).
