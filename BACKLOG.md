# Backlog

Open work, in the order BZ set on 2026-09-03: security, then performance,
then finding the bottle. Exercising sharing with a second person came off
the top because it is not something he controls — it waits on somebody else
turning up. Everything under Closed is kept for the reasoning rather than
the task, and still carries the numbers the code comments refer to. Last
reconciled 2026-09-03, at v1.26.19.

## 1. Security

**A write ceiling on `upc`** — SHAPE DONE 2026-09-03, THE REST OPEN.
Every shared node bounded what may be written to it except the barcode
pairings, which any signed-in account could write anything to. The rule now
requires a key of exactly twelve digits, which is what upcKey produces; a
name that is a string between 2 and 100 characters; a timestamp that is a
number and not in the future; an optional price within a sane range and an
optional size under twenty characters; and nothing else at all. Writing over
an existing pairing is still admin-only, as it was.

What that does NOT do, and it is worth being plain about it: it stops junk
being stored, and it does not stop volume. Twelve digits is a trillion
possible keys and a determined account could still fill them one valid row
at a time. Realtime Database rules cannot express a rate limit.

DONE 2026-09-04. A learned pairing now goes to `contrib`, which is already
per-account and already reviewed, and `upc/$key` is admin-write-only like
the library. An admin still writes straight through, because a review step
where the reviewer is the author is a ceremony rather than a check. The
teach-it-once property is kept: the pairing is stored locally either way and
works offline immediately, it just is not shared until somebody looks at it.
Barcodes offered appears on the Library screen beside the products, with
Accept and Decline. Two people scanning the same bottle before either is
reviewed shows once, earliest offer winning. `contrib/$uid/upc` is bounded
to the same shape as the shared node, so nothing can be offered that could
not then be accepted.

Rules pasted 2026-09-04, and again at v1.6.36 (md5 20792bc8) for admin
delete-only writes and the `wiped` tombstone. `firebase-rules.json` does
not deploy with the app, so a paste is needed ONLY when that file changes —
say so then, and not on every delivery.

**Nothing else is unbounded.** Checked the whole file on 2026-09-03:
directory, requests, shares, sharedWith, shared, view, admins, stats and
contrib all bound both who may write and what shape it must be.

## 2. Performance

**The shelf redraws whole, and counts by scanning.** — DONE 2026-09-04.
`L.ownedCounts` builds the key-to-count map in one pass and the search box
is debounced at 150ms, with the filter chips still redrawing immediately.

What was still open on 2026-09-04 was the same fault in newer code: the
recommender, the portrait and the shape chart each filtered the whole
catalogue with a per-product `ownedCount`, which is the 111,800-comparison
shape again. `shelfAxes` was worse — it re-split every finish string once
per wood family and re-ran the peat match once per level, six and four full
passes for facts that do not change between them. Measured on BZ's 325
products and 344 bottles: tasteProfile 8.20ms to 4.33, shelfAxes 5.13 to
2.57, shelfGaps 14.08 to 12.44, and Home as a whole from about 15ms to 4.
Roughly ten times that on his phone. 2051 assertions unchanged, which is
the point: same answers, less work.

Still worth doing when it next matters: `shelfGaps` is 12ms and now the
slowest thing on the planning screen.

**Logic that ships untested** — DONE, and this entry was stale when it was
read on 2026-09-04. All three named here already delegate: `openSealed` to
`L.sealedPrompt`, `publishBatch` to `L.publishWrite`, and
`pendingForLibrary` to `L.pendingForLibrary`. Checked rather than assumed.

The rule still earned its keep the same day. Eleven more computations came
out of `renderShelf` and `renderShop` (§226, §227), and the ReferenceError
that had sat in `renderShop` through fourteen versions was exactly what
rule 30 predicts: the harness cannot call a render function, so anything
computed inside one ships untested however much of it is arithmetic.

## 3. Finding the bottle

**The Google button.** One link, the bottle name already in it, on the
bottle view and on any hunt or allocated tag. Reasoning under item 15 below,
including the three larger designs that were rejected — the secondary
market, OHLQ alone, and a shop list with search templates and a price
comparison, which was right in outline and far too much machinery.

## Waiting on somebody else

**Sharing has never been exercised end to end with another person.** The
library, the contribution queue, suspend, the shared shelves — all of it has
only ever been used by the account that owns it, and the week of 2026-09-03
shipped six changes into exactly those paths. Two devices on one account was
already enough to find opposite Accept and Drop buttons. Not actionable
alone; worth doing the hour somebody else signs in.

**The candidate finder has never put a bottle in BZ's hands.** Until a
suggestion is followed through to a purchase the feature is unproven in the
only way that counts.

## Accrues on its own

**Barcode coverage.** The scanner works and knows nothing until a listing is
pasted or somebody names a miss. About half the shelf appears on a retail
listing; single barrels and festival bottlings never will. Nothing to build.

## Deferred features

**Gifts** — the wishlist pointed outward (item 5b).
**Receipt ingest by email** (item 7).
**Road trip planner** — blocked on a routing decision (item 8).
**Tasting night on phones** — paper works; the phone variants are deferred
(item 10).
**A budget on a lookup run** (item 11). The circuit breaker added on
2026-09-03 stops a run after five consecutive errors, which was the
dangerous half. What is left is an estimate before a run starts and a total
after it, which is comfort rather than protection.
**Pooled flights cannot be fully blind** — noted, not blocking (item 12).

## New, from 2026-09-04

### Score the shelf, and hand back a roadmap
BZ: "come up with a metric and give people guidance to the bottles they
should buy to get to the next level - it may be cheesy, but dudes love to
compete and we can show them a roadmap."

The pieces already exist and were built this session. `L.tasteProfile`
knows depth, breadth, wood families, peat levels, proof quartiles and
mashbills. `L.shelfPortrait` already turns those into a named identity a
shelf has EARNED, with the number that earned it. `L.likelyToLike` already
produces ranked asks with reasons. A score is the same evidence read as a
position rather than a description, and the roadmap is the affinity list
filtered to the findings that would move it.

What has to be decided before building it:

- **What the score measures.** Breadth and depth pull opposite ways, and a
  metric that rewards both equally rewards neither. A 344-bottle shelf that
  is all bourbon and a 40-bottle shelf covering nine categories are both
  good collections and a single number will call one of them worse. The
  honest shape is probably several scores — depth, breadth, wood, strength,
  provenance — with no total, or a total the app refuses to rank against
  anybody else's.
- **Whether it compares people.** BZ named competition as the point, which
  needs the multi-user shelves to be real first, and needs a view on what
  happens to somebody whose shelf is small. A leaderboard of who owns more
  whisky is a leaderboard of who has more money, which is not a thing this
  app should be built to celebrate.
- **The roadmap has to be honest about cost.** "Next level" that requires a
  £400 bottle is not guidance, it is a shopping list. The candidate finder
  already tags allocated bottles and sinks them; the same rule applies here
  and harder.

Blocked on nothing technically. Worth doing after a second person is
actually using the app, since half of what makes it fun does not exist for
one user.

### Fill the library's gaps in bulk — DONE 2026-09-04
Built as specified below. `L.planLibraryFill` decides what to ask about and
what to skip in one pass, so the bill somebody approves is the same list
that runs. The count is a filter that composes with the type and the
search. The run reuses `askLookup` and the five-consecutive-error breaker,
and nothing is written until a review screen has been through it — named,
additive writes that never overrule a field the library already holds.

`L.recordLookup` is the ledger, keyed by product: two clean empty answers
stop a bottle being asked about, a hit wipes the doubt, an ERROR counts
against nothing, and a miss ages out after 90 days. It merges on sync, so
two admins filling from different devices share what each learned.

What is NOT done: the cost estimate is a count of lookups, not money. The
run says how many it will do and how many it skipped; it does not know what
a lookup costs. That is still item 11, and it now has one more caller.

Original entry follows.

### Fill the library's gaps in bulk
BZ, 2026-09-04, looking at "331 whiskies, 54 missing something": "where do
I run the library bulk update?" There is no such thing, and that is the
finding. The 54 are reachable only one at a time — tap a row carrying `!`,
read what it is short of, open the editor, repeat.

Two tools exist and neither does this:
- **Publish N to the library** pushes fields YOUR shelf already holds that
  the library lacks. It cannot fill a hole nobody has the answer to, which
  is why it can be absent while 54 entries are thin.
- **The enrichment run** works on your own shelf, not on library entries.

What to build, admin-only:
1. Make the count a filter. "54 missing something" should be tappable and
   show only those rows; right now it is a number with no way into it,
   which is the same fault as a chart you cannot drill.
2. A **Fill the 54** run against the lookup service, reusing what the shelf
   enrichment already learned the hard way: the circuit breaker after five
   consecutive errors, the identity gate, and parseLookup keeping the four
   sensory fields.
3. A review step before anything is written. `publishBatch` is the model —
   named writes only, never replacing the node, so a correction somebody
   else made is not destroyed.
4. A cost estimate before the run and a total after it. 54 lookups is real
   money and the budget item (item 11) is still open for the shelf run;
   build it once here and use it in both.
5. **Never pay for the same miss twice.** BZ, same conversation: "we also
   want to make sure we don't try the same bottle over and over and spend
   the money." A library entry that comes back with nothing is not a
   transient failure — an obscure bottling nobody has written up is still
   unwritten next week, and a run that re-asks all 54 every time pays for
   the misses for ever.

   The pattern already exists twice and must not be written a third time:
   `L.recordAsk` / `L.askScore` keep an ok/no tally per ask and sink the
   ones that keep coming back empty, and `deadGaps` removes the
   proven-impossible outright. Both key off `L.gapKey`. The library needs
   the same shape keyed by product: what was asked, when, and what came
   back, so a second run skips a known miss and says how many it skipped
   rather than silently doing less.

   Two rules that fell out of the shelf run and apply here unchanged. An
   error is not a miss: credits running out and a model timing out both
   look like "nothing found" and neither is evidence about the bottle, so
   only a clean empty answer counts as a no. And a miss is not permanent —
   the library grows, so a skipped entry needs a way back in, either an
   age-out or an explicit "try the skipped ones again".

`L.libraryGaps` already defines thin: no proof, no distillery, no category,
or notes that are absent or came off a flight card. That definition is the
spec — do not write a second one.

### An admin with an empty queue cannot tell they are an admin
Same session. The library screen shows "Offered to the library — Nothing
waiting" and, when nothing on the shelf differs from the library, no admin
buttons at all. BZ read that as lost permissions and went to the Firebase
console to check; his uid was correctly under `bz-apps/whisky/admins` the
whole time. An empty queue and a missing feature look identical.

The fix is a line, not a feature: say on the library screen that you are an
admin and what would appear here when there is work. v1.6.21 made the
failing case say why in Diagnostics; the succeeding-but-idle case still
says nothing.

### Record what was actually poured, not what was designed
BZ, 2026-09-04: "when we do a flight, we need to record which extension
actually got poured and if we riff onto any others."

`runFlightNow` logs the CORE pours and nothing else. A flight's `ext` list
— the bench pours, the ringers — is designed and never recorded, so the log
says a flight ran and cannot say whether the extension that made the point
was opened. Anything poured on the night that was in no list at all is
invisible.

That matters more now than it did. Buy-against-drink, the collector line,
the tonight ordering and `L.useCount` all read the log, and the log is
currently a record of the DESIGN rather than the evening.

What to build:
- A run should end with the pours confirmed rather than assumed: the core
  ticked by default, the extensions unticked, and a way to add a bottle
  that was not in either list.
- The record grows two fields — which extensions were poured, and which
  riffs. Both optional, because every run already logged has neither and
  must keep reading correctly.
- Riffs are the interesting half. A bottle somebody reached for mid-flight
  is a stronger signal than one the flight designed, and nothing in the app
  can currently see it.

Do NOT make this a form. The point of a flight is the evening; a run that
demands six confirmations before it will record anything will be skipped,
and a skipped log is worse than an imprecise one. Default to what was
designed, make correcting it one tap.

### Share what a flight tasted, and let it seed a wishlist
BZ, same conversation: "if we are doing a flight with buddies, can we share
the tastes with them after we are complete and have it seed their wish
list, if they so choose and if they don't have the bottle?"

The good idea underneath: a flight run with somebody is the moment their
taste and yours are most comparable, because you drank the same things on
the same night. That is the one moment the app currently does nothing with.

What to build:
- After a run, offer to send the pours to whoever was there. The sharing
  pairs already exist (`shares` / `sharedWith`), so this is a message
  between accounts rather than new plumbing.
- On the receiving side it is an OFFER, never a write: they see what was
  poured, what each bottle was, and choose which to add to their wishlist.
- Filter to what they do not own. `L.ownedCounts` on their shelf answers
  it, and a wishlist entry for a bottle already on the shelf is noise.
- The wish entry should carry WHERE it came from — "poured at BZ's, 3
  September" — because a wishlist of bare names is the thing `L.wishEntry`
  was written to avoid.

**The job it replaces, which is the whole point.** BZ, 2026-09-04: it
"saves taking a photo of the bottle". That is what happens at a tasting
now — somebody likes the fourth pour, photographs the label so they can
find it later, and the photo sits in a camera roll with nothing attached to
it. Everything needed is already in the app: what it was, its proof, its
cask, and the note somebody wrote that night. Build for that and the
feature explains itself.

**Decided 2026-09-04.** The bottle facts travel, the tasting notes travel,
and the receiver chooses what goes on their wishlist.

What a note must NOT do is arrive as the reader's own. A note is the person
who wrote it saying what they found, and it keeps their name on it — "BZ,
3 September" beside the words. The receiver writes their own later, and if
they buy the bottle they will; a note nobody wrote silently becoming theirs
is how a shelf fills up with opinions no one holds. `tnSrc` already carries
that distinction and should be used rather than a new one.

**Also decided 2026-09-04, and this settles the shape of it.**

- **Who was there is chosen when the flight is RUN.** The button that
  records a run picks from your buddies first. That is the prerequisite
  both of these items were waiting on, and it belongs there rather than in
  a share step afterwards: at the end of an evening nobody is going to
  reopen the app and reconstruct who came.
- **Being there IS the consent.** No accept step on the receiving side for
  the tasting itself. You poured it for them; they drank it.
- **If they own the bottle, the pour is logged on their shelf.** They drank
  it, so their log should say so — which also means buy-against-drink and
  the collector line stay true for somebody who tastes mostly at other
  people's houses.
- **If they do not own it, it is offered to their wishlist**, their choice.
- **If you were not there, it never happened for you.** No forwarding, no
  audience beyond the room.

**The consequence worth designing around before any of it is built.** A
pour appearing on somebody else's shelf is the first time one account's
action changes another account's data, and the rules deliberately forbid
exactly that: `$uid` is writable only by its owner, and an admin may delete
but never write. That is a good rule and this should not break it.

So the host does not write to the guest. The host records the run under
their OWN uid, naming who was there, and the guest's device reads it on
next load and applies it — the same shape `sharedWith` already uses, where
a share is written by the owner and read by the viewer. Consent is implied
by attendance and the write still happens on the guest's own device with
their own credentials. No rules change, no account writing into another,
and a guest who never opens the app simply has nothing applied.

That also answers the forwarding question for free: the record names who
was there, so a device that is not on that list has nothing to read.

Both of these want the same thing first: the run has to know who was there,
which it currently does not.

### Scan a barcode from the add-a-bottle form — DONE 2026-09-04
Built as described. `scanBarcode` takes an optional callback now, so a
caller can have the number instead of the default routing to Shop; the
Shop header button passes none and behaves as before.

One trap worth recording: `$('#scanBtn').onclick = scanBarcode` would have
handed the Event in as the callback, and an Event is truthy and not
callable. The handler is `() => scanBarcode()` and the check inside is
`typeof onCode === 'function'` rather than truthiness.

Checked by driving both paths: a known code fills the name, an unknown one
is held and taught on save.

Original entry follows.

### Scan a barcode from the add-a-bottle form
BZ, 2026-09-04: "when we add a bottle manually a barcode scan would be
useful."

`scanBarcode` exists and works on both engines since v1.6.44, but it is
wired to exactly one button — `#scanBtn` in the Shop header. Somebody who
went Shelf, Add bottle is typing a name that is printed on a barcode eight
inches away, and the app can read it.

Small, and mostly plumbing:
- A scan control in `productForm`, next to the name field.
- On a hit, `knownUpcs` may already name the bottle; if it does the form
  fills and there is nothing to type. If it does not, the number is kept so
  that adding the bottle TEACHES the pairing — which is the half that
  compounds, because the next person to scan it gets the name.
- The form is also where a bottle arrives with no pairing at all, so it is
  the best place in the app to collect them.

Worth doing before the group starts, not after: every scan somebody makes
in the first month is a pairing the library keeps, and a form that cannot
scan is a month of pairings not collected.

### Is this offer actually a good price
BZ, same conversation: "when looking at an offer a deal check based on
offer price would also be cool."

`L.offerNames` strips prices out and throws them away, and `L.offerFacts`
never looks for one. The shelf can answer the question and does not get
asked: `msrp` is on every catalogue product, `L.paidFor` knows what was
actually paid for each bottle and averages it, and `L.priceBand` already
sorts bottles into everyday, good, special and vault.

**Two verdicts, never one.** BZ, 2026-09-04: "we would eval on shelf and
on cost." Fit and price are independent questions and blending them into a
single score destroys the only thing worth knowing — a bottle that suits
the shelf at a poor price and a bottle that suits nothing at a bargain both
come out middling, and they call for opposite actions.

So two readings side by side, and the pair IS the recommendation:

    fits the shelf + good price   buy it
    fits the shelf + poor price   want it, wait — it comes round again
    wrong for you  + good price   cheap is not a reason
    wrong for you  + poor price   no

The existing verdicts (for you / worth a look / unknown) are the fit axis
and stay as they are. Price is a second, separate line. Where price cannot
be judged — no figure in the paste, or a currency with no rate set — the
fit verdict still stands alone rather than being dragged toward the middle
by a missing number, which is what a blended score would do.

**And scarcity, which is a third thing and not a third axis.** BZ,
2026-09-04: "need to include a notion of that's allocated, buy it!"

Allocation does not change whether a bottle is for you or whether the price
is fair. It changes how long the question stays open. An allocated bottle
at its normal price is a BUY NOW, because the alternative is not buying it
cheaper next month, it is not seeing it again. The same bottle at a poor
price is a real decision rather than an easy no — which is exactly the case
a blended score would have flattened.

The data is already there and nothing new needs collecting: `alloc` carries
common, uncommon, rare and unicorn, and `scar` carries standard, batched,
limited and exclusive. On BZ's shelf that is 58 rare, 8 unicorn, 46 limited
and 8 exclusive — enough that the words mean something.

    fits + fair price + allocated      buy it now, it will not wait
    fits + fair price                  buy it
    fits + poor price + allocated      your call, and it is a real one
    fits + poor price                  want it, wait
    wrong for you + allocated          still not a reason

That last line matters most and is the one an app is tempted to get wrong.
Scarcity is the strongest pressure in whisky buying and the easiest to
exploit; a shelf that does not want a bottle does not want it because it is
rare. The app should say so plainly rather than joining in.

Honest about where it knows this from: the library, not the market. A
bottle nobody has published as allocated will not be flagged, and the app
should not infer scarcity from a price.

**Where each signal belongs.** BZ, 2026-09-04: "the allocated idea is more
in store, and price is in store and in email and in web page."

That is the right cut, and it says something about the whole Shop tab
rather than just this feature. All four situations are asking the same
question — is this bottle for me — and each has been answering it in its
own words. They should share one verdict vocabulary and weight it by where
the person is standing:

- **In a store, holding it.** Allocation matters most here and nowhere
  else: you cannot come back, so scarcity is the difference between
  deciding now and deciding never. Price matters too, and it is the one
  place the answer has to be readable in the four seconds before somebody
  behind you wants the aisle.
- **An email or a drop list.** Price on every line, because a drop list is
  mostly a price list. Allocation is usually why the email exists at all,
  so flagging it says little that the sender has not already said louder.
- **A web page.** Price, and here it is worth the most: a listing carries
  one, the person has time to weigh it, and this is the surface where a
  comparison against what they actually paid is most likely to change a
  decision.
- **Deciding what to buy next.** Neither. There is no bottle and no price
  yet, which is why this screen is the recommender rather than a verdict.

So: price on three of the four, allocation on one, fit on all of them. And
the in-store answer is the one to design for brevity — the others are read
sitting down.

What to build:
- Keep the price when parsing rather than discarding it, on both paths — a
  drop list has one per line, a shop listing has one in the prose.
- Judge it against what is knowable, in this order: what YOU paid for the
  same bottle, then the library's `msrp`, then the band its peers sit in. A
  verdict with a number behind it, in the shape everything else on that
  screen uses.
- Say which comparison was used. "Under the £52 you paid last time" and
  "about what bottles like it cost" are different claims and should not
  read the same.
- Currency. The listing that started this was in pounds and the shelf is in
  dollars, and USD/GBP is the pairing that will actually come up. BZ,
  2026-09-04: a setting with a manual periodic lookup is fine. So: one rate,
  typed in Settings, with the date it was set, and no network call — a
  conversion the person entered is one they know the age of, which is
  exactly what a silently-fetched rate is not.

  What that buys, and what it obliges. It obliges the app to SHOW its
  working: "£44.95 is about $57 at your rate of 1.27, set 4 September"
  rather than "$57". A converted number that does not say it was converted
  is a number somebody will quote back later as though the app knew it.
  And a rate months old should say so rather than quietly still applying —
  the same shape as the lookup ledger's ninety days, and for the same
  reason.

  Unset is not an error: say the price in the currency it came in, compare
  nothing, and offer the setting. A comparison is worth having only when
  both sides are real.

What this must not become: a market-price feature. Only Drams does
location-based pricing and users report it wrong often enough to inflate
their collection value. The honest version answers a narrower question —
is this a good price FOR YOU, given what you have paid — and says nothing
when it cannot.

### Does the recommender actually work — MEASURED 2026-09-04
The open question since the engine was built: it was plausible and never
checked. Checked now, against the strongest ground truth on the shelf —
14 whiskies BZ bought more than once, a decision made twice.

Method: hold ONE bottle out, so the shelf stands as it did the day before
the second was bought, and ask whether the engine names that house. Not
whether it names the bottle: the engine emits asks, not bottles. A first
attempt dropped the whole product and was wrong — that erases the repeat
itself, which is the thing under test.

A loose matcher gave 14 of 14 and meant nothing: 11 of those matched on
CATEGORY, and on a shelf that is 129 bourbons "the ask says bourbon and
the bottle is a bourbon" is very nearly vacuous. Strictly — the ask has to
name the house or the brand:

    before   5 of 14 repeat buys, 0 of 14 bought-once control
    after    9 of 14 repeat buys, 2 of 14 control

**Precision was perfect and stayed perfect.** Both control hits are
bottles from Spot Whiskey and Penelope, houses BZ DOES go back to, so
naming them is correct — the control was the flawed measure, not the
engine. It has never once pointed at a house somebody did not return to.

**Recall was the problem, and it was two lines.** `t.repeats.slice(0, 6)`
meant eight of fourteen houses could not produce an ask however strong the
evidence. And a house where every obvious move had already been made —
owned at strength AND aged AND finished — fell through all three branches
and produced nothing, which is precisely the deepest relationship on a
shelf. Buying a fourth is itself the pattern; there is a fourth branch now
that says so.

What this does NOT establish: that the asks are good, only that they point
at the right houses. Whether "A stronger Rabbit Hole" leads to a bottle
worth owning is a different question and needs the group.

## Cross-connections, 2026-09-04

Four things the app already holds that do not yet talk to each other. BZ
took all of these and declined a fifth — a second identity read off the
pour log, "you buy sherry and you drink Islay" — as too temporal. He is
right: a shelf is cumulative and a pour log swings with the season, so a
drinking identity would rename itself every few months and mean less each
time. The buy-against-drink 2x2 already surfaces that gap without claiming
it is who somebody is.

### Nothing reads the tasting notes
The largest unused asset in the app. 930 note fields on BZ's shelf, and the
flavour vocabulary is sitting in them: spice 145, sweet 140, fruit 134,
vanilla 118, caramel 111, honey 63, chocolate 50, smoke 50.

Every recommendation reasons from STRUCTURE — house, wood, proof, region,
age, mashbill. None reasons from FLAVOUR, which is the thing a person
actually tastes and the axis they think in. "You have written caramel on
111 bottles and this one is described the same way" is a different argument
from "same distillery", and probably a better one.

What it needs:
- A flavour profile beside `L.tasteProfile`: which words recur, how often,
  and on what. Stop words and structure words ("palate", "long", "medium")
  are noise and have to come out; the list above is what survives that.
- Care about where a note CAME FROM. `tnSrc` and `tnFrom` already
  distinguish what somebody wrote from what a flight card prompted and what
  a model produced. A profile built from model-written notes is a profile of
  the model, and the app has been careful about this distinction everywhere
  else.
- The obvious use is matching a candidate's description against the
  profile. The subtler one is the portrait: what a shelf IS structurally
  versus what it TASTES like are two different sentences, and only one is
  currently written.

### Flights built around a flavour — "can you find the caramel?"
BZ, 2026-09-04. The best idea of the session, and a better use of the notes
than the recommender was.

Every flight this app designs varies something STRUCTURAL: a wood, a proof,
a region, an age, a mashbill. A flavour is a variable nobody has used, and
it is the one a person tasting actually thinks in. Two shapes, both honest
comparisons:

- **Find it.** Every pour is described as carrying the note; everything
  else — house, wood, category, strength — varies as widely as possible.
  You learn what "caramel" means by hearing it in six different contexts,
  which is how anybody learns a flavour word.
- **Odd one out.** Three carry it, one does not, and the card does not say
  which. Falsifiable in the room, which the structural flights are not.

**BZ's shelf can build these today.** Pourable bottles whose notes carry
the word, and how widely they range:

    caramel    90 across 7 types, 48 houses
    vanilla    93 across 8 types, 57 houses
    honey      72 across 8 types, 43 houses
    pepper     59 across 5 types, 36 houses
    chocolate  38 across 5 types, 30 houses
    salt       15 across 5 types, 11 houses
    leather    14 across 3 types, 13 houses

Caramel and vanilla are almost too easy — that much spread means the
flavour is the only constant, which is exactly the right shape. Salt,
leather and tobacco are the interesting ones: scarce enough that the flight
is a hunt.

**The catch, and why it makes the idea stronger rather than weaker.**
Checked on 2026-09-04: of the notes on BZ's shelf, 113 are `tnSrc: model`,
185 carry a `tnFrom` flight prompt, and 12 came from reviews. Almost none
were written by him. So a flight asserting "these four all have caramel" is
currently testing the MODEL'S vocabulary and not the whisky.

Do not paper over that. Build it in:

- The flight's premise is a CLAIM to be tested, not a fact to be taught.
  "The library says all six of these carry caramel. Do you agree?" A flight
  that can be wrong is a better flight, and this one can be.
- Running it produces the person's OWN notes on those pours, which is the
  only way the app ever gets real flavour data. The flavour flight is the
  mechanism that converts model notes into human ones — it bootstraps the
  thing the recommender would need.
- Which means it should be built BEFORE the flavour profile in the
  recommender, not after. A profile built on 113 model notes is a profile
  of the model; a profile built on notes somebody wrote after tasting six
  bottles side by side is the real thing.
- Show provenance on the card. A pour whose note came from a model and one
  a person wrote are different evidence, and `tnSrc` already knows.

That ordering is the point: flavour flights first, flavour recommendations
once there are enough human notes to stand on.

### Flights and the shape chart do not know about each other
A thin axis has a consequence that is not being surfaced: it means certain
designed comparisons cannot be poured. "Origin is at 67%, which is why
these three flights are unrunnable" turns a percentage into a reason, and
`L.flightReady` already computes exactly what is missing.

The reverse is worth more. A bottle that completes a designed flight beats
one that fills an abstract axis, because the flight is a comparison
somebody already decided they wanted. `gapsFromFlights` exists and was
deliberately demoted when affinity took the lead; now that the recommender
argues from taste, "and it completes ONE STILL FOUR RECIPES" is a second
reason to hang on an affinity finding rather than a competing source.

### Two shelves, side by side
The sharing feature that has not been built. `L.shelfAxes` run twice
answers a question neither shelf answers alone: what can I taste at their
house that I cannot at mine. That is the reason to open the app while
standing in somebody's kitchen, and it needs no new data.

It also gives the flights somewhere to go: a flight neither of you can run
alone but both of you can run together is the strongest argument for
sharing a shelf that this app could make.

### The map is disconnected from Origin
The Origin axis counts Scotch regions only. The map knows countries, and
`L.countryCounts` already computes them. World coverage is an axis the data
supports and nothing scores, and the map is currently a picture rather than
a measure — tapping a country says what is there, and never what is not.

## Not looked at

The visual pass covered contrast, the liquid band, one dark surface per
screen and the type scale. Nothing else.

## A pattern worth keeping

Every serious fault in the week of 2026-09-03 was two functions holding one
rule with only one of them taught: parseLookup against cleanFinish, the reel
help against the reels, needsEnhancing against enhanceDiff, the parse
against the diff, bottleGaps against needsEnhancing, libraryEntry against
everything else. In every case both sides had tests and both passed, because
each was tested alone. The assertions that caught them test the PAIR, and
each is two lines at the end of a section that already exists: what the
queue asks about, the diff must be able to use; what the parse emits, the
diff must be able to read; what one screen publishes, another must not
immediately queue.

## Closed

### 6. Barcode scanning — DONE
The camera and the decoding are the browser's own, so it costs nothing.
The barcode store answers FIRST, because a number cannot be searched on a
shelf keyed by name, and says so plainly when nothing knows the code. A
miss where you then type the name teaches the pairing and shares it, so
the next person to scan that bottle does not type it again. Listings are
pasted rather than fetched. See item 14 for what it does not know yet.

### 13a. Dimensions — DONE
Findings were computed from what is ABSENT, and absence is unbounded.
Seven axes chosen by the user instead: region, distillery, cask,
strength, age, price, category. Each returns bounded, named things to
find rather than categories to translate, works on a shelf with no
flights, and narrows a search as readily as it shapes a suggestion.

## Closed

### 1. Multi-user, sharing and tasting night — DONE
Google sign-in, per-user rules, a directory, requests and shares, all live. Tasting-night mode is NOT built and moves to item 10.

### 2. Turn on the lookup and design service — DONE
Key in Script Properties, deployed, working. The workspace header was the catch: an identity-linked key will not authenticate without it.

### 2b. Shared shelves, matched bottles, and Join Me Pour — DONE
Shared shelves, the three-circle Venn with counts in the overlaps, Join Me Pour and find-a-match on the slot machine. Untested with a second person.

### 2b-ii. An imported shelf needs enriching, and someone pays for it — DONE
Fill in your shelf, behind the gear. Writes to the user own edits, never the shared catalogue. Cost is still uncapped — see item 11.

### 2b-i. One resolver, not a batch script — DONE
The resolver is lookup.gs and the app calls the same endpoint. Fill in your shelf runs it over a whole collection.

### 2c. Where the missing tasting notes could come from — DONE
Settled. WHISKY:EDITION has notes and hit 7 of 14; Pour Picks has none at all, only flavour tags. The model with web search did the rest.

### 2c-ii. Pour Picks — the bourbon half, and the best of the four — DONE
Wrong. Pour Picks carries no tasting notes — that assumption cost a projection of 131 bottles that turned out to be zero from that source.

### 2c-iii. Probe, then run the whole shelf — not just the gaps — DONE
Run, three times. Each pass found a matcher bug; the third was clean.

### 2d. Whiskybase via parse.bot — worth it, for QA and obscurity — DONE
Not needed. Obscurity came from Pour Picks popularity_tier, and notes from elsewhere.

### 3. Old Elk Infinity Blend — closed
Consumed before it was ever catalogued, so there is nothing to add. Closed
2026-09-01.

### 4. The 138 bottles with no tasting notes — DONE
310 of 325 now carry notes. The 15 left are single barrels and private picks with nothing published anywhere.

### 5. Wishlist, and what is missing from the shelf — DONE
Wishlist, what to look for, extension and contrast findings, the candidate finder with a budget, and dead-end memory.

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

### 9. Flight re-instantiation — DONE
Run it again, keeping the variable AND the flight own constraints.

### 10. Tasting night
Split out of item 1, which is otherwise done. Nothing here is built. The
specification below is BZ's, from early on, and was nearly lost when item 1
was closed with a one-line summary.

**BZ is fine with paper for now (2026-09-01), which changes the order.**
The phone variants were always the expensive half — blind submission, a
locked column, a synchronised reveal, and every one of them needing shared
shelves to work with people who are in the room rather than across the
country. Paper needs none of it.

- Host-only with paper. **The one worth building.** The app prints or shows
  the flight, the pours in order, and what to write down; the answers live
  on the card and go in afterwards if they go in at all.
- Guests scoring blind on their phones. Deferred.
- A live reveal. Deferred, and pointless without the one above.

The post-night summary still stands on its own: whatever gets typed in
afterwards is enough to say what the room got right.

**The blind column locks on submit.** An answer cannot be changed once
anyone has seen the reveal. This is the rule the whole thing turns on —
without it, blind scoring is not blind, and a late edit is invisible.

**Post-night summary.** What the room got right, and which pour fooled
everyone. Today the SMS carries the flight and its snacks, not what
happened.

Wants shared shelves exercised with a real second person first. That has
never been done.

### 11. A cap on what a lookup run can spend
Fill in your shelf calls the API once per bottle on BZ's key. Three hundred
bottles is a few dollars and fine; a stranger importing a shelf is not.
Needs a per-user ceiling before anybody outside the three uses it.

### 12. Pooled flights cannot be fully blind
Raised 2026-09-01, after it was built. Marcus knows what he brought, so a
flight cast across the room is at best partly blind for whoever supplied
the pours. This is a real limit, not a bug.

**What it does not affect.** Most of the value is in flights where nothing
is being guessed: a house comparison, a cask lesson, anything whose point is
what you learn rather than what you spot. Those lose nothing at all.

**If a pooled flight does need to be blind**, the way tasting clubs handle
it is to bring MORE than is needed and let the host choose. Marcus brings
four, two make the cut, and he does not know which — the only thing he knows
is that some of his might be in there, which is true of the host as well.
That needs nothing from the app beyond casting from a wider pool than the
flight uses, so it is a small change if it is ever wanted.

**Not building it yet.** BZ was unsure the pooled flight would get used at
all. If it is not reached for in three months that is an answer, and it cost
an hour.

### 13. Paste a shop URL for a verdict — DONE
Shipped as the third situation, Looking at it on a website. It reads the
name, proof, age, cask, region, size, price, the bonded, cask-strength and
single-barrel flags and the shop's own tasting note. Most retailers refuse
a cross-origin fetch, so pasting the page text is the path that actually
gets used — and v1.26.2 fixed the name parser, which had been reading a
pasted page BODY with a function written for a title tag.

### 15. Where a hard bottle can actually be got
Raised by BZ 2026-09-03. What he does today: search the bottle in Google,
find the shops that have it, look at the prices, buy it. He uses Hard To
Find Whiskey, Frootbat and others.

**It is one button.** A Google search with the bottle name already in it,
on the bottle view and on any `hunt` or `allocated` tag. That returns the
shops, the prices and the ones he has not found yet. Nothing stored,
nothing fetched, nothing to keep fresh, nothing that breaks when a shop
redesigns its site. The only thing the app adds is that the exact name is
already typed — which is the whole of the work, since the name is the bit
that is fiddly to get right and the app is holding it.

**Three worse designs were proposed first, and are recorded so they are not
proposed again.**

1. *Auctions, lotteries, the secondary market.* A different question — how
   to acquire a trophy — and not what anybody does about a bottle they
   cannot find.
2. *OHLQ only.* Reasoned from Ohio being a control state to the conclusion
   that nothing can ship in. False: licensed out-of-state retailers ship
   spirits to Ohio and those are the shops he uses. This came from
   reasoning about the law instead of asking what he does.
3. *A shop list in Settings, with search URL templates, and a lookup mode
   that fetches each shop's search page for a price comparison.* Correct
   in outline and far too much machinery: a per-shop config to maintain,
   a fetch per shop per bottle to pay for, and a fresh way to break every
   time one of them changes its markup. Google already does all of it and
   maintains itself.

**Worth keeping from the OHLQ dig**, since it answers something Google does
not: Ohio is a control state, so there is one authoritative answer to which
store near BZ has a bottle right now — per-store stock as full, limited or
out, updated at 3:30am and again around 11am and 2pm, with an availability
map per product. Its pages render in the browser, so a plain fetch returns
an empty document and it can only ever be a link. If a second button is
ever wanted, that is the one, and it is still just a link.

### 16. Firebase write ceilings
Raised again 2026-09-03. Every shared node has a rule bounding what may be
written to it except `upc`, the barcode pairings, which anybody signed in
may write to without limit. A single script could fill it, and the cost
lands on this project's account rather than on whoever wrote it.

What the other nodes do that this one does not: bound the payload, bound
the key, and require the fields to be the shape the app writes. A barcode
pairing is a code and a name, so the rule is small — a key of digits within
a plausible length, a value of a name under a hundred characters and a
timestamp, and nothing else accepted.

Worth doing before the app is shared with anybody outside the current
circle, and not urgent while it is not.

### 17. The shelf redraws whole, and counts by scanning
Measured before this session: `renderShelf` is undebounced, so every
keystroke in the search box rebuilds the entire list, and `ownedCount`
walks all 345 bottles for each of the 327 products — 111,800 comparisons,
about 67ms per redraw. Typing a six-letter search runs that six times.

Neither is subtle to fix and neither needs a redesign:

- **Count once, not per product.** One pass over `S.bottles` building a map
  of key to count, handed to the render, turns 111,800 comparisons into
  345. This is the whole of the 67ms.
- **Debounce the search.** A redraw per keystroke is a redraw per keystroke
  whatever it costs; roughly 150ms of quiet is the usual answer, and the
  filter chips should still redraw immediately since a tap is a decision
  rather than a letter.

BZ has deferred this twice, both times correctly — a screen that is
slightly slow is a smaller problem than a screen that is wrong, and this
week has been full of screens that were wrong. It is now the largest thing
left that is neither a feature nor a fault.

### Also worth naming, from the week of 2026-09-03
Every serious fault this week was the same shape: two functions holding one
rule, and only one of them taught. parseLookup against cleanFinish. The
reel help against the reels. needsEnhancing against enhanceDiff. The parse
against the diff. bottleGaps against needsEnhancing. libraryEntry against
everything else. In each case both sides had tests and both sides passed,
because each was tested alone.

The tests that caught these assert the PAIR: what the queue asks about, the
diff must be able to use; what the parse emits, the diff must be able to
read; what one screen publishes, another must not immediately queue. That
is the pattern worth keeping, and it is cheap — every one of those is two
lines at the end of a section that already exists.
