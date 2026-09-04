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
