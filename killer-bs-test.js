#!/usr/bin/env node
/*
 * Dram test harness.
 *
 * Every expected value below was computed by hand or in a separate Node
 * session BEFORE the assertion was written. No test derives its expected
 * value from the code under test.
 *
 * Run: node dram-test.js
 */
const fs = require('fs');
const path = require('path');

// Pull the logic object out of index.html without a browser. The script
// block assigns to `L` and exports it at the end.
function loadLogic() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const start = html.indexOf("const L = {};");
  const end = html.indexOf("/* =====================================================================\n   STATE + RENDER");
  if (start < 0 || end < 0) throw new Error('logic block not found in index.html');
  const src = html.slice(start, end);
  const module_ = { exports: {} };
  new Function('module', src + '\nmodule.exports = L;')(module_);
  return module_.exports;
}

const L = loadLogic();

let pass = 0, fail = 0;
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.log('  FAIL ' + label + '\n    got  ' + g + '\n    want ' + w); }
}
function sec(n) { console.log('\n' + n); }

/* ---------------- fixtures ---------------- */
// Modelled on the real shelf: Angel's Envy Single Barrel is one open plus
// two sealed; Barrell Private Release is two products sharing a name.
const bottles = [
  { id: 'B1', k: 'AE Single Barrel @ 119.8', status: 'open' },
  { id: 'B2', k: 'AE Single Barrel @ 119.8', status: 'sealed' },
  { id: 'B3', k: 'AE Single Barrel @ 119.8', status: 'sealed' },
  { id: 'B4', k: 'Lagavulin 16 @ 86.0', status: 'sealed' },
  { id: 'B5', k: 'Raasay Dun Cana @ 104.0', status: 'open' },
  { id: 'B6', k: 'Weller SiB @ 97.0', status: 'gone', exit: 'gifted' }
];

const catalog = {
  'AE Single Barrel @ 119.8': { k: 'AE Single Barrel @ 119.8', name: "Angel's Envy Single Barrel",
    dist: "Angel's Envy", proof: 119.8, sub: 'bourbon', fin: 'Port', wine: true,
    obsc: 'known', scar: 'limited', msrp: 89.99, sec: 0 },
  'Lagavulin 16 @ 86.0': { k: 'Lagavulin 16 @ 86.0', name: 'Lagavulin 16 Year',
    dist: 'Lagavulin', proof: 86.0, sub: 'scotch', fin: null, wine: null,
    obsc: 'known', scar: 'standard', msrp: 109.99, sec: 0 },
  'Raasay Dun Cana @ 104.0': { k: 'Raasay Dun Cana @ 104.0', name: 'Isle of Raasay Dun Cana',
    dist: 'Isle of Raasay', proof: 104.0, sub: 'scotch', fin: 'Pedro Ximenez+Oloroso',
    wine: true, obsc: 'obscure', scar: 'standard', msrp: 104.99, sec: 0 },
  'Weller SiB @ 97.0': { k: 'Weller SiB @ 97.0', name: 'Weller Single Barrel',
    dist: 'Buffalo Trace', proof: 97.0, sub: 'wheat', fin: null, wine: null,
    obsc: 'known', scar: 'limited', msrp: 49.99, sec: 200.00 }
};

/* ---------------- pourability ---------------- */
sec('pourability and ownership');
// One open plus two sealed -> pourable, three owned.
eq('open bottle is pourable', L.pourable('AE Single Barrel @ 119.8', bottles), true);
eq('all-sealed is not pourable', L.pourable('Lagavulin 16 @ 86.0', bottles), false);
eq('unknown key is not pourable', L.pourable('nope', bottles), false);
eq('owned counts sealed', L.ownedCount('AE Single Barrel @ 119.8', bottles), 3);
eq('owned excludes gone', L.ownedCount('Weller SiB @ 97.0', bottles), 0);

/* ---------------- premium ---------------- */
sec('allocation premium');
// 200 / 49.99 = 4.0008... -> 4.0 at two decimals. Verified by hand.
eq('weller premium', L.premium(49.99, 200.00), 4);
// 199 / 49.99 = 3.98079... -> 3.98
eq('eagle rare premium', L.premium(49.99, 199.00), 3.98);
// 0.0 in the source means "not recorded", not "worthless".
eq('zero secondary is null', L.premium(89.99, 0), null);
eq('zero msrp is null', L.premium(0, 100), null);
eq('missing both is null', L.premium(null, null), null);

/* ---------------- exits ---------------- */
sec('exit reasons');
eq('six exit reasons', L.EXITS.length, 6);
eq('drain pour detected', L.isDrain('drain pour'), true);
eq('gift is not a drain', L.isDrain('gifted'), false);

/* ---------------- shelf filter ---------------- */
sec('shelf filter');
const shelfProds = Object.values(catalog);
// bottles fixture: AE open, Lagavulin all sealed, Raasay open, Weller gone.
eq('open only', L.shelfFilter(shelfProds, bottles, { status: 'open' })
  .map(p => p.k).sort(), ['AE Single Barrel @ 119.8', 'Raasay Dun Cana @ 104.0']);
eq('sealed only', L.shelfFilter(shelfProds, bottles, { status: 'sealed' })
  .map(p => p.k), ['Lagavulin 16 @ 86.0']);
// A gone bottle is not on the shelf under any status.
eq('all excludes gone', L.shelfFilter(shelfProds, bottles, { status: 'all' }).length, 3);
eq('type filter', L.shelfFilter(shelfProds, bottles,
  { status: 'all', types: ['scotch'] }).map(p => p.k).sort(),
  ['Lagavulin 16 @ 86.0', 'Raasay Dun Cana @ 104.0']);
eq('empty type list means all types', L.shelfFilter(shelfProds, bottles,
  { status: 'all', types: [] }).length, 3);
eq('several types', L.shelfFilter(shelfProds, bottles,
  { status: 'all', types: ['scotch', 'bourbon'] }).length, 3);
// Text matches the distillery as well as the name.
eq('text matches name', L.shelfFilter(shelfProds, bottles,
  { status: 'all', q: 'lagavulin' }).length, 1);
eq('text matches distillery', L.shelfFilter(shelfProds, bottles,
  { status: 'all', q: 'isle of raasay' }).length, 1);
eq('text is case insensitive', L.shelfFilter(shelfProds, bottles,
  { status: 'all', q: 'LAGAVULIN' }).length, 1);
// Gates combine: scotch AND open excludes the sealed Lagavulin.
eq('type and status combine', L.shelfFilter(shelfProds, bottles,
  { status: 'open', types: ['scotch'] }).map(p => p.k), ['Raasay Dun Cana @ 104.0']);
eq('no match returns empty', L.shelfFilter(shelfProds, bottles,
  { status: 'open', q: 'zzz' }).length, 0);


sec('premium wording');
// A ratio under 1 means the secondary is BELOW retail. Calling that a
// premium states the opposite of what the number means -- Ardbeg Wee
// Beastie read "0.56x over MSRP" when 0.56x is a discount.
eq('above retail is a premium', L.premiumText(2.5), '2.5\u00d7 over MSRP');
eq('below retail says so', L.premiumText(0.56), '0.56\u00d7 MSRP \u2014 under retail');
eq('never says over when it is under', /over/.test(L.premiumText(0.56)), false);
eq('at retail is neither', L.premiumText(1), 'about MSRP');
eq('a whisker above is still about', L.premiumText(1.01), 'about MSRP');
eq('a whisker below is still about', L.premiumText(0.99), 'about MSRP');
eq('nothing to say when there is no ratio', L.premiumText(null), null);
eq('zero shows nothing', L.premiumText(0), null);
// The real bottle from the screenshot.
eq('wee beastie reads as under retail',
  /under retail/.test(L.premiumText(L.premium(53.99, 30))), true);

sec('shelf facets');
// Every facet is an independent AND gate; an empty list turns it off.
const facetCat = {
  a: { k: 'a', name: 'Alpha', dist: 'D1', sub: 'scotch', region: 'Islay',
       proof: 86, msrp: 40, obsc: 'known', scar: 'standard', age: 10,
       fin: 'Oloroso', wine: true },
  b: { k: 'b', name: 'Bravo', dist: 'D2', sub: 'bourbon', region: null,
       proof: 110, msrp: 150, obsc: 'obscure', scar: 'limited', age: null,
       fin: 'Toasted Oak', wine: false },
  c: { k: 'c', name: 'Charlie', dist: 'D3', sub: 'scotch', region: 'Speyside',
       proof: 125, msrp: 250, obsc: 'niche', scar: 'exclusive', age: 21,
       fin: null, wine: null }
};
const facetBottles = ['a', 'b', 'c'].map((k, i) => ({ id: 'F' + i, k, status: 'open' }));
const F = o => L.shelfFilter(Object.values(facetCat), facetBottles,
  Object.assign({ status: 'all' }, o)).map(p => p.k);

eq('no facets shows everything', F({}), ['a', 'b', 'c']);
eq('recognition', F({ obsc: ['obscure'] }), ['b']);
eq('recognition takes several', F({ obsc: ['obscure', 'niche'] }), ['b', 'c']);
eq('region', F({ regions: ['Islay'] }), ['a']);
eq('release', F({ scars: ['exclusive'] }), ['c']);
eq('occasion band', F({ bands: ['everyday'] }), ['a']);
eq('proof band', F({ proofs: ['ge120'] }), ['c']);
eq('proof band takes several', F({ proofs: ['le90', 'ge120'] }), ['a', 'c']);
// Cask is one-of-three: wine and wood-only are mutually exclusive, and
// "no finish" is a third state, not the absence of a selection.
eq('wine cask only', F({ cask: 'wine' }), ['a']);
eq('wood only', F({ cask: 'wood' }), ['b']);
eq('no finish at all', F({ cask: 'none' }), ['c']);
eq('unknown wine status is not wood', F({ cask: 'wood' }).indexOf('c'), -1);
eq('age stated', F({ age: 'stated' }), ['a', 'c']);
eq('no age stated', F({ age: 'nas' }), ['b']);
// Facets AND together: Scotch AND exclusive is only Charlie.
eq('facets combine', F({ types: ['scotch'], scars: ['exclusive'] }), ['c']);
eq('a contradiction shows nothing', F({ types: ['scotch'], obsc: ['obscure'] }), []);
// Status still applies on top of everything else.
eq('status gates the facets too', L.shelfFilter(Object.values(facetCat),
  [{ id: 'x', k: 'a', status: 'sealed' }, { id: 'y', k: 'b', status: 'open' }],
  { status: 'open', types: ['scotch'] }).length, 0);

sec('active facet count');
eq('nothing on', L.activeFacets({ types: [], obsc: [] }), 0);
eq('one list on', L.activeFacets({ types: ['scotch'], obsc: [] }), 1);
eq('several values in one list still count once',
  L.activeFacets({ types: ['scotch', 'irish'] }), 1);
eq('cask counts', L.activeFacets({ cask: 'wine' }), 1);
eq('age counts', L.activeFacets({ age: 'nas' }), 1);
eq('everything on', L.activeFacets({ types: ['a'], obsc: ['b'], regions: ['c'],
  bands: ['d'], proofs: ['e'], scars: ['f'], cask: 'wine', age: 'nas' }), 8);

sec('shelf sort');
const S3 = Object.values(facetCat);
eq('by name', L.shelfSort(S3, 'name').map(p => p.k), ['a', 'b', 'c']);
eq('proof ascending', L.shelfSort(S3, 'proof').map(p => p.proof), [86, 110, 125]);
eq('proof descending', L.shelfSort(S3, 'proofd').map(p => p.proof), [125, 110, 86]);
eq('dearest first', L.shelfSort(S3, 'price').map(p => p.msrp), [250, 150, 40]);
eq('cheapest first', L.shelfSort(S3, 'cheap').map(p => p.msrp), [40, 150, 250]);
eq('by distillery', L.shelfSort(S3, 'dist').map(p => p.dist), ['D1', 'D2', 'D3']);
// A no-age-stated bottle must sort LAST on age, not pose as the youngest.
eq('oldest first, NAS last', L.shelfSort(S3, 'age').map(p => p.k), ['c', 'a', 'b']);
// Same for a missing price on either direction.
const noPriceSet = S3.concat([{ k: 'z', name: 'Zulu', proof: 100, dist: 'D9' }]);
eq('missing price sorts last when dearest first',
  L.shelfSort(noPriceSet, 'price').map(p => p.k).slice(-1), ['z']);
eq('missing price sorts last when cheapest first',
  L.shelfSort(noPriceSet, 'cheap').map(p => p.k).slice(-1), ['z']);
// Ties fall back to name so the order never depends on insertion.
const tied = [{ k: 'y', name: 'Yankee', proof: 90 }, { k: 'x', name: 'Xray', proof: 90 }];
eq('ties break on name', L.shelfSort(tied, 'proof').map(p => p.k), ['x', 'y']);
eq('an unknown sort falls back to name', L.shelfSort(S3, 'zzz').map(p => p.k),
  ['a', 'b', 'c']);
eq('sorting does not mutate the input', S3.map(p => p.k), ['a', 'b', 'c']);
eq('every declared sort works',
  L.SORTS.every(s => L.shelfSort(S3, s.id).length === 3), true);

/* ---------------- pick my pour ---------------- */
sec('pick my pour');
// Raasay: never poured (+40), obscure (+18), finished in wine (+7) = 65.
const raasay = L.pourScore(catalog['Raasay Dun Cana @ 104.0'], {}, []);
eq('raasay score', raasay.score, 65);
eq('raasay reasons', raasay.why.length, 3);
// AE: never poured (+40), known (+0), limited (+6), wine finish (+7) = 53.
eq('ae score', L.pourScore(catalog['AE Single Barrel @ 119.8'], {}, []).score, 53);
// Poured twice -> -12 instead of +40. 65 - 40 - 12 = 13.
const twice = [{ k: 'Raasay Dun Cana @ 104.0' }, { k: 'Raasay Dun Cana @ 104.0' }];
eq('twice-poured raasay', L.pourScore(catalog['Raasay Dun Cana @ 104.0'], {}, twice).score, 13);
// Filters exclude rather than penalise.
eq('proof ceiling excludes', L.pourScore(catalog['AE Single Barrel @ 119.8'],
  { maxProof: 100 }, []), null);
eq('proof ceiling admits', L.pourScore(catalog['Lagavulin 16 @ 86.0'],
  { maxProof: 100 }, []).score, 40);
eq('style filter excludes', L.pourScore(catalog['Lagavulin 16 @ 86.0'],
  { style: ['bourbon'] }, []), null);
eq('obscurity filter admits', L.pourScore(catalog['Raasay Dun Cana @ 104.0'],
  { obsc: ['obscure'] }, []).score, 65);

// Only open bottles are candidates: Lagavulin is sealed, Weller is gone.
const picks = L.pickPour(catalog, bottles, {}, []);
eq('only open bottles offered', picks.length, 2);
eq('obscure ranks first', picks[0].k, 'Raasay Dun Cana @ 104.0');

/* ---------------- ladder ---------------- */
sec('proof ladder');
// 86, 92, 104 over a span of 18 -> 0, 0.3333, 1.
const off = L.ladderOffsets([86, 92, 104]);
eq('ladder low end', off[0], 0);
eq('ladder high end', off[2], 1);
eq('ladder middle', Math.round(off[1] * 10000) / 10000, 0.3333);
// Cairdeas: 104.4, 104.6, 104.8 -> span 0.4, midpoint exactly 0.5.
eq('cairdeas cluster mid', L.ladderOffsets([104.4, 104.6, 104.8])[1], 0.5);
// Single-barrel releases are ONE product; per-barrel proof lives on the
// bottle. Keying on name+proof made two products and broke the stocking rule.

// All identical proofs must not divide by zero.
eq('flat ladder', L.ladderOffsets([100, 100, 100]), [0.5, 0.5, 0.5]);
eq('empty ladder', L.ladderOffsets([]), []);

/* ---------------- validators ---------------- */
sec('flight validators');
const sixCat = {};
[86, 92, 100, 104, 110, 119].forEach((p, i) => {
  sixCat['P' + i] = { k: 'P' + i, name: 'Pour ' + i, dist: 'D' + i, proof: p,
    obsc: i === 3 ? 'obscure' : 'known', scar: 'standard', fin: null };
});
const sixBottles = Object.keys(sixCat).map((k, i) => ({ id: 'X' + i, k, status: 'open' }));
const sixPours = Object.keys(sixCat).map(k => ({ k }));

let v = L.validate(sixPours, sixCat, { bottles: sixBottles });
eq('clean flight has no warnings', v.filter(m => m.level === 'warn').length, 0);
eq('clean flight reports obscure pour', v.some(m => m.level === 'ok' && /obscure/.test(m.msg)), true);

// Five pours instead of six.
v = L.validate(sixPours.slice(0, 5), sixCat, { bottles: sixBottles });
eq('short flight warns', v.some(m => m.level === 'warn' && /5 core pours/.test(m.msg)), true);

// Descending proof.
v = L.validate([...sixPours].reverse(), sixCat, { bottles: sixBottles });
eq('descent warns', v.some(m => /does not ascend/.test(m.msg)), true);
// ...unless deliberately flagged, which BZ has done three times.
v = L.validate([...sixPours].reverse(), sixCat, { bottles: sixBottles, allowDescent: true });
eq('flagged descent is silent', v.some(m => /does not ascend/.test(m.msg)), false);

// No obscure pour: the rule tests recognition, not price.
const allKnown = {};
Object.keys(sixCat).forEach(k => allKnown[k] = Object.assign({}, sixCat[k], { obsc: 'known' }));
v = L.validate(sixPours, allKnown, { bottles: sixBottles });
eq('no obscure pour warns', v.some(m => /no obscure pour/.test(m.msg)), true);

// A sealed pour is not pourable.
const oneSealed = sixBottles.map((b, i) => i === 2 ? Object.assign({}, b, { status: 'sealed' }) : b);
v = L.validate(sixPours, sixCat, { bottles: oneSealed });
eq('sealed pour warns', v.some(m => /not open/.test(m.msg)), true);

// Matched pairs: 104.4 and 104.6 are 0.2 apart -> one pair.
const pairCat = { A: { k: 'A', name: 'A', proof: 104.4, obsc: 'obscure' },
                  B: { k: 'B', name: 'B', proof: 104.6, obsc: 'known' } };
const pairB = [{ id: 'p1', k: 'A', status: 'open' }, { id: 'p2', k: 'B', status: 'open' }];
v = L.validate([{ k: 'A' }, { k: 'B' }], pairCat, { bottles: pairB, coreTarget: 2 });
eq('matched pair detected', v.some(m => m.level === 'ok' && /1 matched pair/.test(m.msg)), true);

/* ---------------- tasting notes ---------------- */
sec('distiller notes');
const tnP = { k: 'x', tn: { nose: 'Iodine, tar', colour: 'Pale gold',
                            finish: 'Very long', palate: 'Medicinal' } };
// Always colour, nose, palate, finish -- the order of the sheet columns,
// not the order the object happens to hold them in.
eq('notes come back in sheet order', L.tastingNotes(tnP).map(n => n.label),
  ['Colour', 'Nose', 'Palate', 'Finish']);
eq('text carried through', L.tastingNotes(tnP)[0].text, 'Pale gold');
eq('a partial set keeps its order',
  L.tastingNotes({ tn: { finish: 'Long', nose: 'Smoke' } }).map(n => n.label),
  ['Nose', 'Finish']);
eq('no notes is empty', L.tastingNotes({ k: 'y' }), []);

// Provenance: a card note, a sourced note and your own are three different
// levels of trust and must never read as the same claim.
// The flight-card notes were written FOR the cards, not taken from a
// producer. The label has to say so or they pose as sourced fact.
eq('card notes are marked as prompts',
  L.tnSource({ tn: { nose: 'x' }, tnFrom: 'SHERRY IS NOT ONE THING' }),
  'Written for the Sherry is not one thing card \u2014 a prompt, not a source');
eq('no source claims to be the producer',
  /producer/.test(L.tnSource({ tn: { nose: 'x' }, tnFrom: 'A FLIGHT' })), false);
eq('your own notes say so',
  L.tnSource({ tn: { nose: 'x' }, tnSrc: 'you' }), 'your own tasting');
eq('producer notes say so',
  L.tnSource({ tn: { nose: 'x' }, tnSrc: 'distiller' }), "the producer's own notes");
eq('an explicit source beats the card credit',
  L.tnSource({ tn: { nose: 'x' }, tnSrc: 'you', tnFrom: 'A FLIGHT' }),
  'your own tasting');
eq('no notes means no source', L.tnSource({ k: 'z' }), null);
eq('an unknown source falls back to the card wording',
  /prompt, not a source/.test(
    L.tnSource({ tn: { nose: 'x' }, tnSrc: 'zzz', tnFrom: 'A FLIGHT' })), true);

sec('tasting note coverage');
const covCat = { a: { tn: { nose: 'x' } }, b: { tn: { nose: 'y' }, tnSrc: 'you' },
                 c: {}, d: {} };
eq('counts the described', L.tnCoverage(covCat)['with'], 2);
eq('counts the blanks', L.tnCoverage(covCat).without, 2);
eq('totals', L.tnCoverage(covCat).total, 4);
eq('splits by source', L.tnCoverage(covCat).bySource, { card: 1, you: 1 });
eq('an empty catalog is safe', L.tnCoverage({}).total, 0);
eq('null product is safe', L.tastingNotes(null), []);

/* ---------------- dated logging ---------------- */
sec('recording when something happened');
// A completion is dated by the user, never assumed to be now.
eq('today is an ISO date', /^\d{4}-\d{2}-\d{2}$/.test(L.todayISO()), true);
eq('a real date passes', L.validDate('2026-08-31'), true);
eq('the 31st of February is rejected', L.validDate('2026-02-31'), false);
eq('the 30th of February is rejected', L.validDate('2026-02-30'), false);
eq('a leap day passes', L.validDate('2024-02-29'), true);
eq('a non-leap 29 February is rejected', L.validDate('2026-02-29'), false);
eq('a malformed date is rejected', L.validDate('31/08/2026'), false);
eq('empty is rejected', L.validDate(''), false);
eq('null is rejected', L.validDate(null), false);
// You cannot log a tasting you have not had yet.
const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
eq('a future date is rejected', L.validDate(future), false);

eq('a valid date is kept', L.logEntry('pour', { k: 'a' }, '2026-07-04').at, '2026-07-04');
eq('an invalid date falls back to today',
  L.logEntry('pour', { k: 'a' }, 'rubbish').at, L.todayISO());
eq('payload carried through', L.logEntry('pour', { k: 'a' }, '2026-07-04').k, 'a');
eq('kind carried through', L.logEntry('flight', {}, '2026-07-04').kind, 'flight');

/* ---------------- flight browsing ---------------- */
sec('flight readiness and browsing');
const fCat = {
  a: { k: 'a', name: 'Alpha', sub: 'scotch', proof: 86 },
  b: { k: 'b', name: 'Bravo', sub: 'scotch', proof: 110 },
  c: { k: 'c', name: 'Charlie', sub: 'bourbon', proof: 100 }
};
const fBottles = [{ id: 'q1', k: 'a', status: 'open' },
                  { id: 'q2', k: 'b', status: 'sealed' },
                  { id: 'q3', k: 'c', status: 'open' }];
const F1 = { title: 'SHERRY IS NOT ONE THING', tag: 'ONE VARIABLE: WHICH SHERRY',
             premise: 'Six malts.', core: [{ k: 'a' }, { k: 'b' }], ext: [] };
const F2 = { title: 'PROOF IS NOT A SCORE', tag: '', premise: 'Bourbon.',
             core: [{ k: 'c' }], ext: [] };
const fHist = [{ kind: 'flight', flight: 'PROOF IS NOT A SCORE', at: '2026-06-01' },
               { kind: 'flight', flight: 'PROOF IS NOT A SCORE', at: '2026-08-01' }];

eq('half the pours are open', L.flightReady(F1, fCat, fBottles).pct, 50);
eq('all pours open', L.flightReady(F2, fCat, fBottles).pct, 100);
eq('an empty flight is not ready', L.flightReady({ core: [] }, fCat, fBottles).pct, 0);
// The latest run wins when a flight has been run more than once.
eq('most recent run date', L.flightRunAt(F2, fHist), '2026-08-01');
eq('never run is null', L.flightRunAt(F1, fHist), null);
eq('lowest proof in the flight', L.flightProof(F1, fCat), 86);

const FF = o => L.filterFlights([F1, F2], fCat, fBottles, fHist, o).map(f => f.title);
eq('no filter shows both', FF({}).length, 2);
eq('not run', FF({ state: 'todo' }), ['SHERRY IS NOT ONE THING']);
eq('run', FF({ state: 'run' }), ['PROOF IS NOT A SCORE']);
eq('fully pourable', FF({ state: 'ready' }), ['PROOF IS NOT A SCORE']);
eq('by type of its pours', FF({ types: ['bourbon'] }), ['PROOF IS NOT A SCORE']);
// Search reaches the title, the premise and the names of the pours.
eq('search the title', FF({ q: 'sherry' }), ['SHERRY IS NOT ONE THING']);
eq('search the premise', FF({ q: 'six malts' }), ['SHERRY IS NOT ONE THING']);
eq('search a pour name', FF({ q: 'charlie' }), ['PROOF IS NOT A SCORE']);
eq('search the variable', FF({ q: 'which sherry' }), ['SHERRY IS NOT ONE THING']);
eq('no match is empty', FF({ q: 'zzzz' }), []);

const FS = id => L.sortFlights([F1, F2], fCat, fBottles, fHist, id).map(f => f.title);
eq('curriculum order is untouched', FS('curriculum'),
  ['SHERRY IS NOT ONE THING', 'PROOF IS NOT A SCORE']);
eq('by name', FS('title'), ['PROOF IS NOT A SCORE', 'SHERRY IS NOT ONE THING']);
eq('most ready first', FS('ready'), ['PROOF IS NOT A SCORE', 'SHERRY IS NOT ONE THING']);
eq('lowest proof first', FS('proof'), ['SHERRY IS NOT ONE THING', 'PROOF IS NOT A SCORE']);
// Never-run must sort LAST on recency, not first.
eq('recently run first, never-run last', FS('run'),
  ['PROOF IS NOT A SCORE', 'SHERRY IS NOT ONE THING']);
eq('curriculum sort does not mutate',
  L.sortFlights([F1, F2], fCat, fBottles, fHist, 'title')[0].title !== F1.title, true);

/* ---------------- history ---------------- */
sec('the log');
const hCat = { a: { k: 'a', name: 'Alpha' }, b: { k: 'b', name: 'Bravo' } };
const hFl = [{ title: 'PEAT IS A POSTCODE' }];
const log = [
  { kind: 'pour', k: 'a', at: '2026-06-01' },
  { kind: 'flight', flight: 'PEAT IS A POSTCODE', at: '2026-08-01', pours: ['a', 'b'] },
  { kind: 'pour', k: 'b', at: '2026-08-15' },
  { kind: 'pour', k: 'gone', at: '2026-08-20' },
  { kind: 'flight', flight: 'DELETED FLIGHT', at: '2026-08-21' }
];
eq('newest first', L.historyRows(log, hCat, hFl).map(x => x.at),
  ['2026-08-15', '2026-08-01', '2026-06-01']);
// An entry whose bottle or flight has been deleted is dropped, not shown as
// a bare key.
eq('deleted subjects are dropped', L.historyRows(log, hCat, hFl).length, 3);
eq('pours only', L.historyRows(log, hCat, hFl, 'pour').map(x => x.k), ['b', 'a']);
eq('flights only', L.historyRows(log, hCat, hFl, 'flight').map(x => x.flight),
  ['PEAT IS A POSTCODE']);
eq('names resolved', L.historyRows(log, hCat, hFl, 'pour')[0].label, 'Bravo');
eq('flight titles read as headings',
  L.historyRows(log, hCat, hFl, 'flight')[0].label, 'Peat is a postcode');
// The index is carried so a row can be removed from the real array.
eq('the original index is kept', L.historyRows(log, hCat, hFl, 'pour')[0]._i, 2);
// Two entries on one day keep their logged order rather than shuffling.
const sameDay = [{ kind: 'pour', k: 'a', at: '2026-08-01' },
                 { kind: 'pour', k: 'b', at: '2026-08-01' }];
eq('same-day order is last-logged first',
  L.historyRows(sameDay, hCat, hFl, 'pour').map(x => x.k), ['b', 'a']);
eq('an empty log is safe', L.historyRows([], hCat, hFl), []);
eq('a null log is safe', L.historyRows(null, hCat, hFl), []);

sec('history by month');
const months = L.historyByMonth([
  { kind: 'pour', at: L.todayISO() },
  { kind: 'pour', at: L.todayISO() },
  { kind: 'flight', at: L.todayISO() },
  { kind: 'pour', at: '2019-01-05' }
], 'pour', 6);
eq('six buckets', Object.keys(months).length, 6);
eq('this month counts the pours', months[L.todayISO().slice(0, 7)], 2);
eq('a flight does not count as a pour',
  L.historyByMonth([{ kind: 'flight', at: L.todayISO() }], 'pour', 6)[L.todayISO().slice(0, 7)], 0);
eq('anything outside the window is ignored',
  Object.values(months).reduce((a, b) => a + b, 0), 2);
eq('buckets run oldest to newest', Object.keys(months)[5], L.todayISO().slice(0, 7));

/* ---------------- flight builder ---------------- */
sec('what a variable reads and what it holds');
const bp = { k: 'x', name: 'X', dist: 'Ardbeg', sub: 'scotch', region: 'Islay',
             proof: 92, age: 10, fin: 'Oloroso', msrp: 60 };
eq('proof reads the strength', L.axisOf('proof', bp), 92);
eq('place reads the region', L.axisOf('region', bp), 'Islay');
// A house flight varies the EXPRESSION, not the distillery: holding the
// distillery and reading it as the axis put every bottle on one point.
eq('house reads the expression', L.axisOf('house', bp), 'Oloroso');
eq('grain reads the category', L.axisOf('grain', bp), 'scotch');
eq('price reads the band', L.axisOf('price', bp), 'good');
eq('an unknown variable reads nothing', L.axisOf('zzz', bp), null);
eq('a missing value reads null', L.axisOf('age', { proof: 90 }), null);
// Place holds the category still; a proof flight holds the house.
eq('proof holds the house', L.holdsFor('proof'), ['dist']);
eq('place holds the category', L.holdsFor('region'), ['sub']);
eq('every variable declares its holds',
  L.VARIABLES.every(v => Array.isArray(L.holdsFor(v.id))), true);

sec('spreading along the axis');
// Numeric: even steps across the range, not the first six.
const nums = [80, 86, 92, 100, 110, 120, 130].map((p, i) =>
  ({ k: 'n' + i, proof: p, name: 'N' + i }));
const spread = L.pickSpread('proof', nums, 4).map(p => p.proof);
eq('numeric spread takes the ends', [spread[0], spread[spread.length - 1]], [80, 130]);
eq('numeric spread is the size asked for', spread.length, 4);
eq('a short list comes back whole', L.pickSpread('proof', nums.slice(0, 3), 6).length, 3);
// Categorical: one of each value FIRST, then fill. Taking one of each and
// stopping gave three pours and failed the four-pour floor.
const cats = [
  { k: 'a', sub: 'bourbon', proof: 100, obsc: 'known' },
  { k: 'b', sub: 'bourbon', proof: 101, obsc: 'known' },
  { k: 'c', sub: 'rye', proof: 102, obsc: 'known' },
  { k: 'd', sub: 'wheat', proof: 103, obsc: 'known' },
  { k: 'e', sub: 'bourbon', proof: 104, obsc: 'known' }
];
const cs = L.pickSpread('grain', cats, 5);
eq('every value is represented', new Set(cs.map(p => p.sub)).size, 3);
eq('and the flight is filled to size', cs.length, 5);
eq('the spread comes back in proof order',
  cs.map(p => p.proof), cs.map(p => p.proof).slice().sort((a, b) => a - b));

sec('scoring a proposed flight');
const asc = [{ proof: 86, fin: 'A', obsc: 'known' }, { proof: 92, fin: 'B', obsc: 'known' },
             { proof: 100, fin: 'C', obsc: 'known' }];
const desc = asc.slice().reverse();
eq('ascending proof scores higher than descending',
  L.flightScore('finish', asc) > L.flightScore('finish', desc), true);
// An obscure pour is a build rule, so it must move the score.
const withObscure = asc.map((p, i) => i === 0 ? Object.assign({}, p, { obsc: 'obscure' }) : p);
eq('an obscure pour scores higher',
  L.flightScore('finish', withObscure) > L.flightScore('finish', asc), true);
// A matched pair at one proof is the strongest shape available.
const paired = [{ proof: 92, fin: 'A', obsc: 'known' }, { proof: 92, fin: 'B', obsc: 'known' },
                { proof: 100, fin: 'C', obsc: 'known' }];
eq('a matched pair scores higher than none',
  L.flightScore('finish', paired) > L.flightScore('finish', asc), true);
eq('an empty set scores nothing', L.flightScore('proof', []), 0);
// A wide proof range helps a proof flight and hurts every other one.
const wide = [{ proof: 80, fin: 'A', obsc: 'known' }, { proof: 130, fin: 'B', obsc: 'known' },
              { proof: 131, fin: 'C', obsc: 'known' }];
eq('range helps a proof flight',
  L.flightScore('proof', wide) > L.flightScore('proof', asc), true);
eq('range hurts a cask flight',
  L.flightScore('finish', wide) < L.flightScore('finish', asc), true);

/* ---------------- one map ---------------- */
{
sec('detail follows the zoom');
// Three separate maps became one surface: what is drawn is a function of the
// zoom, so there is no mode to switch.
eq('the world shows countries', L.detailAt(1).countries, true);
eq('the world shows no states', L.detailAt(1).states, false);
eq('states appear at 4x', L.detailAt(4).states, true);
eq('country dots give way to states', L.detailAt(8).countries, false);
eq('pins appear at 8x, where the US fills the window', L.detailAt(8).usPins, true);
eq('no pins at 7x', L.detailAt(7).usPins, false);
eq('irish pins arrive with the rest', L.detailAt(8).iePins, true);
eq('the coastline appears at 26x', L.detailAt(26).coast, true);
eq('every pin set arrives together',
  L.detailAt(8).usPins && L.detailAt(8).iePins && L.detailAt(8).scotPins, true);
// The detail set is monotone: zooming in never takes detail away except the
// country dots, which are replaced by something better.
const seq = [1, 4, 14, 30, 100, 5000].map(z => L.detailAt(z));
eq('states never turn off once on',
  seq.slice(2).every(d => d.states), true);
eq('pins never turn off once on',
  seq.slice(3).every(d => d.usPins && d.scotPins && d.iePins), true);

sec('redrawing only when the detail changes');
// A pinch must not rebuild the geometry on every frame.
eq('same band, same key', L.detailKey(31), L.detailKey(90));
eq('crossing a band changes the key', L.detailKey(7) !== L.detailKey(8), true);
eq('the key names what is on', L.detailKey(1), 'countries');
eq('at full detail everything but the dots is on',
  L.detailKey(100), 'states,usPins,iePins,scotPins,coast');

sec('one ceiling for every cluster');
// Bardstown needs about 5,100x of the world span; Islay about 3,600x.
eq('the ceiling clears Bardstown', L.MAP_ZOOM.max >= 5100, true);
eq('the floor is the whole world', L.clampZoom(0.01), 1);
eq('the ceiling is applied', L.clampZoom(999999), L.MAP_ZOOM.max);
eq('clampZoom takes no layer any more', L.clampZoom.length, 1);

sec('flying to a place');
const worldFull = { x: -100, y: -70, w: 200, h: 140 };
const isl = L.MAP_PLACES.find(p => p.id === 'islay');
const islayView = L.viewFor(isl, worldFull);
eq('the view is centred on the place',
  Math.round((islayView.x + islayView.w / 2) * 100) / 100,
  Math.round(L.project(isl.lon, isl.lat)[0] * 100) / 100);
eq('a tighter span means a smaller window',
  L.viewFor(isl, worldFull).w < L.viewFor(
    L.MAP_PLACES.find(p => p.id === 'scotland'), worldFull).w, true);
eq('the world view fills the map',
  L.viewFor(L.MAP_PLACES.find(p => p.id === 'world'), worldFull).w, 200);
eq('every place has a span', L.MAP_PLACES.every(p => p.span > 0), true);
eq('every place has coordinates',
  L.MAP_PLACES.every(p => isFinite(p.lon) && isFinite(p.lat)), true);

sec('culling to the window');
const cullWin = { x: -10, y: -10, w: 20, h: 20 };
eq('a point inside is in view', L.inView(0, 0, cullWin), true);
// project() flips latitude, so a point far north is far off the top.
eq('a point far away is out', L.inView(-120, 60, cullWin), false);
eq('the margin keeps an edge pin', L.inView(11 / Math.cos(56.8 * Math.PI / 180),
  -8, cullWin, 0.5), true);
eq('no margin drops it', L.inView(11 / Math.cos(56.8 * Math.PI / 180),
  -8, cullWin, 0), false);

}

/* ---------------- AI proposals ---------------- */
{
sec('what the model is shown');
const aiCat = {
  a: { k: 'a', name: 'Alpha 10', dist: 'D1', proof: 92, sub: 'scotch',
       obsc: 'known', fin: 'Oloroso', region: 'Islay', age: 10, msrp: 60 },
  b: { k: 'b', name: 'Bravo 12', dist: 'D2', proof: 100, sub: 'bourbon',
       obsc: 'obscure' },
  c: { k: 'c', name: 'Charlie 15', dist: 'D3', proof: 110, sub: 'rye',
       obsc: 'niche' },
  d: { k: 'd', name: 'Delta Sealed', dist: 'D4', proof: 90, sub: 'irish',
       obsc: 'known' }
};
const aiBot = [{ id: 'a1', k: 'a', status: 'open' }, { id: 'b1', k: 'b', status: 'open' },
               { id: 'c1', k: 'c', status: 'open' }, { id: 'd1', k: 'd', status: 'sealed' }];
const payload = L.flightPayload(aiCat, aiBot);
// Only what is open goes: the model must not reach for a bottle you cannot
// pour tonight.
eq('sealed bottles are not offered', payload.length, 3);
eq('the sealed one is absent', payload.some(x => x.n === 'Delta Sealed'), false);
eq('names go with the payload', payload.map(x => x.n).sort(),
  ['Alpha 10', 'Bravo 12', 'Charlie 15']);
// Null fields are dropped rather than sent as nulls.
const bravo = payload.find(x => x.n === 'Bravo 12');
eq('an absent finish is omitted, not null', 'f' in bravo, false);
eq('a present finish is sent',
  'f' in payload.find(x => x.n === 'Alpha 10'), true);
eq('the house rules go with every request', L.FLIGHT_RULES.length >= 6, true);
eq('the rules forbid inventing a bottle',
  L.FLIGHT_RULES.some(r => /never invent/i.test(r)), true);

sec('verifying what comes back');
const good = { title: 'A FLIGHT', variable: 'proof', premise: 'Testing.',
  pours: [{ name: 'Alpha 10', note: 'the control' }, { name: 'Charlie 15' },
          { name: 'Bravo 12' }],
  why: ['Because.'], buy: { name: 'Springbank 15', why: 'would extend it' } };
const v = L.verifyProposal(good, aiCat, aiBot);
eq('a good proposal verifies', v.ok, true);
eq('all three pours resolve', v.pours.length, 3);
// The app sorts, not the model: proof ascends whatever order came back.
eq('pours come back in proof order',
  v.pours.map(x => aiCat[x.k].proof), [92, 100, 110]);
eq('per-pour notes survive',
  v.pours.find(x => x.k === 'a').note, 'the control');
eq('the reasoning survives', v.why, ['Because.']);
eq('a purchase suggestion is kept', v.buy.name, 'Springbank 15');
eq('and marked as not on the shelf', v.buy.onShelf, false);

// The whole point of the layer: a name that is not there cannot be poured.
const bad = L.verifyProposal({ pours: [
  { name: 'Alpha 10' }, { name: 'Bravo 12' }, { name: 'Charlie 15' },
  { name: 'Completely Invented Whisky 12' },   // does not exist
  { name: 'Delta Sealed' },                     // exists but is not open
  { name: 'Alpha 10' }                          // listed twice
] }, aiCat, aiBot);
eq('only real open bottles are poured', bad.pours.length, 3);
eq('three suggestions are dropped', bad.rejected.length, 3);
eq('an invented bottle is named as not on the shelf',
  bad.rejected.find(r => /Invented/.test(r.name)).why, 'not on the shelf');
eq('a sealed bottle is named as not open',
  bad.rejected.find(r => r.name === 'Delta Sealed').why, 'not open');
eq('a repeat is named as such',
  bad.rejected.find(r => r.why === 'listed twice').name, 'Alpha 10');

// A one-token name is not evidence: "Bourbon 12" reduces to "12", which
// matched anything containing 12 before the two-token floor.
const oneToken = L.verifyProposal({ pours: [
  { name: 'Alpha 10' }, { name: 'Bravo 12' }, { name: 'Charlie 15' },
  { name: 'Bourbon 12' }] }, aiCat, aiBot);
eq('a one-token name never fuzzy-matches', oneToken.pours.length, 3);
eq('the match threshold is strict', L.PROPOSAL_MATCH >= 0.7, true);

// Too few real pours is a failure, not a short flight served anyway.
const thin = L.verifyProposal({ pours: [{ name: 'Nope' }, { name: 'Also Nope' }] },
  aiCat, aiBot);
eq('a proposal that does not survive verification fails', thin.ok, false);
eq('and says why', /open on your shelf/.test(thin.why), true);
eq('junk in gives a clean failure', L.verifyProposal(null, aiCat, aiBot).ok, false);
eq('an empty object fails', L.verifyProposal({}, aiCat, aiBot).ok, false);

// Strings are trimmed, so an over-long field cannot blow up the screen.
const longish = L.verifyProposal({
  title: 'x'.repeat(500), premise: 'y'.repeat(2000),
  pours: [{ name: 'Alpha 10' }, { name: 'Bravo 12' }, { name: 'Charlie 15' }]
}, aiCat, aiBot);
eq('the title is capped', longish.title.length <= 60, true);
eq('the premise is capped', longish.premise.length <= 400, true);

sec('the request body');
const body = L.flightRequestBody('Proof', 'A premise.', aiCat, aiBot);
eq('mode names the job', body.mode, 'flight');
eq('the variable travels', body.variable, 'Proof');
eq('the premise travels', body.premise, 'A premise.');
eq('the rules travel', body.rules.length, L.FLIGHT_RULES.length);
eq('only the open shelf travels', body.shelf.length, 3);
}

/* ---------------- chart drill-through ---------------- */
{
sec('a bar resolves to its bottles');
// Every chart on the dashboard has to be able to answer "which bottles is
// this bar?" or the bar is not worth tapping.
const drillCat = {
  a: { k: 'a', name: 'Alpha', sub: 'scotch', region: 'Islay', obsc: 'known', msrp: 40 },
  b: { k: 'b', name: 'Bravo', sub: 'scotch', region: 'Speyside', obsc: 'obscure', msrp: 150 },
  c: { k: 'c', name: 'Charlie', sub: 'bourbon', region: null, obsc: 'niche', msrp: 250 },
  d: { k: 'd', name: 'Delta', sub: 'bourbon', region: null, obsc: 'known', msrp: 75 }
};
const drillAll = Object.values(drillCat);
const where = fn => drillAll.filter(fn);

// By type: the bar label is Title Case, the data is not.
eq('type bar finds its bottles',
  where(p => L.titleCase(p.sub) === 'Scotch').map(p => p.k), ['a', 'b']);
eq('every type bar label round-trips',
  Object.keys(L.countBy(drillAll, p => L.titleCase(p.sub)))
    .every(lbl => where(p => L.titleCase(p.sub) === lbl).length > 0), true);
// Region.
eq('region bar finds its bottles', where(p => p.region === 'Islay').map(p => p.k), ['a']);
// Occasion: the bar is Title Case, priceBand is lower.
eq('occasion bar finds its bottles',
  where(p => L.priceBand(p.msrp) === 'Vault'.toLowerCase()).map(p => p.k), ['c']);
eq('every occasion band round-trips',
  ['Everyday', 'Good', 'Special', 'Vault'].every(lbl =>
    where(p => L.priceBand(p.msrp) === lbl.toLowerCase()).length
    === drillAll.filter(p => L.priceBand(p.msrp) === lbl.toLowerCase()).length), true);
// Recognition.
eq('recognition bar finds its bottles',
  where(p => L.titleCase(p.obsc) === 'Obscure').map(p => p.k), ['b']);

// The counts on a bar must equal the number the bar opens, or the chart is
// lying about itself.
const typeCounts = L.countBy(drillAll, p => L.titleCase(p.sub));
Object.keys(typeCounts).forEach(lbl => {
  eq('the ' + lbl + ' bar count matches what it opens',
    typeCounts[lbl], where(p => L.titleCase(p.sub) === lbl).length);
});
}

/* ---------------- pours that are not a bottle ---------------- */
{
sec('the three kinds of pour');
const wCat = {
  a: { k: 'a', name: 'Weller 12', proof: 90 },
  d: { k: 'd', name: 'Weller Antique 107', proof: 107 },
  s: { k: 's', name: 'Sealed One', proof: 100 }
};
const wBot = [{ id: 'w1', k: 'a', status: 'open' }, { id: 'w2', k: 'd', status: 'open' },
              { id: 'w3', k: 's', status: 'sealed' }];
const shelfPour = { k: 'a' };
const wishPour = { kind: 'wish', name: 'Pappy Van Winkle 15 Year', proof: 107 };
const blendPour = { kind: 'blend', name: "Poor Man's Pappy", parts: ['a', 'd'],
                    ratio: [1, 1] };

eq('a bare key is a shelf pour', L.pourKind(shelfPour), 'shelf');
eq('a wish is a wish', L.pourKind(wishPour), 'wish');
eq('a blend is a blend', L.pourKind(blendPour), 'blend');
eq('nothing is a shelf pour', L.pourKind(null), 'shelf');

// A blend of two open bottles CAN be poured tonight, which is the whole
// reason it is modelled rather than dropped.
eq('an open bottle is pourable', L.pourAvailable(shelfPour, wCat, wBot), true);
eq('a blend of open bottles is pourable',
  L.pourAvailable(blendPour, wCat, wBot), true);
eq('a wish never is', L.pourAvailable(wishPour, wCat, wBot), false);
eq('a blend needing a sealed bottle is not',
  L.pourAvailable({ kind: 'blend', parts: ['a', 's'] }, wCat, wBot), false);
eq('a blend with no parts is not',
  L.pourAvailable({ kind: 'blend', parts: [] }, wCat, wBot), false);

// Equal parts of 90 and 107 is 98.5 — the ladder must place it there, not
// treat it as unknown.
eq('a blend proof is the weighted mean', L.blendProof(blendPour, wCat), 98.5);
eq('an uneven blend weights correctly',
  L.blendProof({ parts: ['a', 'd'], ratio: [3, 1] }, wCat), 94.3);
eq('a blend with an unknown part is null',
  L.blendProof({ parts: ['zzz'] }, wCat), null);
eq('pourProof reads a shelf bottle', L.pourProof(shelfPour, wCat), 90);
eq('pourProof reads a blend', L.pourProof(blendPour, wCat), 98.5);
eq('pourProof reads a stated wish proof', L.pourProof(wishPour, wCat), 107);

eq('a shelf pour is labelled from the catalog', L.pourLabel(shelfPour, wCat), 'Weller 12');
eq('a blend is labelled by its own name', L.pourLabel(blendPour, wCat), "Poor Man's Pappy");

sec('flight shape');
const mixed = { title: 'MIXED', core: [shelfPour, wishPour, blendPour, { k: 'd' }] };
const shape = L.flightShape(mixed, wCat, wBot);
eq('counts every kind', [shape.shelf, shape.wish, shape.blend], [2, 1, 1]);
eq('three of four are pourable tonight', shape.ready, 3);
// A design with a wish in it is complete but not runnable — a different
// thing from a broken flight, which is what the old count reported.
eq('not runnable while a wish is unmet', shape.runnable, false);
eq('runnable once nothing is missing',
  L.flightShape({ core: [shelfPour, { k: 'd' }, blendPour, { k: 'a' }] },
    wCat, wBot).runnable, true);

sec('the wishlist');
let wl = [];
wl = L.wishAdd(wl, { name: 'Pappy 15', reason: 'completes a flight', added: '2026-01-01' });
eq('adds one', wl.length, 1);
eq('keeps the reason', wl[0].reason, 'completes a flight');
wl = L.wishAdd(wl, { name: 'pappy 15', added: '2026-06-01' });
eq('the same bottle does not duplicate', wl.length, 1);
// Re-adding keeps what you knew before rather than blanking it.
eq('the original date is kept', wl[0].added, '2026-01-01');
eq('the earlier reason survives a bare re-add', wl[0].reason, 'completes a flight');
eq('recognised however it is typed', L.onWishlist(wl, 'PAPPY 15'), true);
eq('not on the list', L.onWishlist(wl, 'Something Else'), false);
wl = L.wishRemove(wl, 'Pappy 15');
eq('removing works', wl.length, 0);
eq('removing something absent is safe', L.wishRemove([], 'x').length, 0);
eq('a nameless entry is ignored', L.wishAdd([], { name: '  ' }).length, 0);

// A bottle wanted by two flights is one entry naming both.
const flights = [
  { title: 'ONE', core: [{ kind: 'wish', name: 'Longrow 18' }] },
  { title: 'TWO', core: [{ kind: 'wish', name: 'Longrow 18' }, { k: 'a' }] }
];
const fromFlights = L.wishFromFlights(flights);
eq('one entry per bottle', fromFlights.length, 1);
eq('naming every flight it unlocks', fromFlights[0].flights, ['ONE', 'TWO']);
eq('no flights, no wishes', L.wishFromFlights([]), []);
}

/* ---------------- what is missing ---------------- */
{
sec('gaps from flights');
const gCat = {
  a: { k: 'a', name: 'Alpha', dist: 'D1', sub: 'scotch', region: 'Islay', proof: 90 },
  b: { k: 'b', name: 'Bravo', dist: 'D1', sub: 'scotch', region: 'Islay', proof: 100 },
  s: { k: 's', name: 'Sealed', dist: 'D2', sub: 'bourbon', proof: 95 }
};
const gBot = [{ id: 'g1', k: 'a', status: 'open' }, { id: 'g2', k: 'b', status: 'open' },
              { id: 'g3', k: 's', status: 'sealed' }];

// One pour short is worth acting on; four short is a different flight.
const oneShort = { title: 'ONE SHORT', core: [{ k: 'a' }, { k: 'b' },
  { kind: 'wish', name: 'Longrow 18' }] };
const manyShort = { title: 'MANY SHORT', core: [{ k: 'a' },
  { kind: 'wish', name: 'W1' }, { kind: 'wish', name: 'W2' },
  { kind: 'wish', name: 'W3' }] };
const complete = { title: 'COMPLETE', core: [{ k: 'a' }, { k: 'b' }] };

const fg = L.gapsFromFlights([oneShort, manyShort, complete], gCat, gBot);
eq('one bottle short is reported', fg.some(g => g.name === 'Longrow 18'), true);
eq('a complete flight is not', fg.some(g => g.flight === 'COMPLETE'), false);
// Three missing is not a shopping list, it is a redesign.
eq('three short is not reported', fg.some(g => g.flight === 'MANY SHORT'), false);
eq('the only missing pour scores highest',
  fg.find(g => g.name === 'Longrow 18').weight, 100);
eq('it names the flight it unlocks',
  fg.find(g => g.name === 'Longrow 18').flight, 'ONE SHORT');

// A sealed bottle you already own is the cheapest gap there is.
const sealedShort = { title: 'SEALED', core: [{ k: 'a' }, { k: 's' }] };
const sg = L.gapsFromFlights([sealedShort], gCat, gBot);
eq('a sealed bottle you own is flagged as owned', sg[0].owned, true);

sec('gaps from thinness');
const thin = L.gapsFromThinness(gCat);
eq('a region with nothing is reported',
  thin.some(g => g.kind === 'region' && /Speyside/.test(g.name)), true);
eq('a region with two islay bottles is still thin',
  thin.some(g => /Islay/.test(g.name)), true);
eq('a lone category is reported',
  thin.some(g => g.kind === 'category' && /Bourbon/.test(g.name)), true);
// Two scotches is not enough to compare, so scotch is thin too.
eq('every finding carries a reason', thin.every(g => !!g.why), true);

sec('gaps from matched pairs');
// A house with three bottles and no two at one strength cannot hold the
// variable still, which is what a matched pair is for.
const pairCat = {
  x: { k: 'x', dist: 'House', proof: 90 }, y: { k: 'y', dist: 'House', proof: 100 },
  z: { k: 'z', dist: 'House', proof: 110 }
};
const pairBot = ['x', 'y', 'z'].map((k, i) => ({ id: 'p' + i, k: k, status: 'open' }));
eq('a house with no pair is reported',
  L.gapsFromPairs(pairCat, pairBot).length, 1);
// Add a second at 90 and the pair exists, so the gap goes away.
const paired = Object.assign({}, pairCat, { w: { k: 'w', dist: 'House', proof: 90 } });
const pairedBot = pairBot.concat([{ id: 'p9', k: 'w', status: 'open' }]);
eq('a house with a pair is not', L.gapsFromPairs(paired, pairedBot).length, 0);

sec('ranking and de-duplication');
// A sealed bottle you own outranks anything you would have to buy.
const ranked = L.shelfGaps(gCat, gBot, [sealedShort, oneShort], []);
eq('the owned one comes first', ranked[0].owned, true);
eq('flights outrank thinness',
  L.GAP_KINDS.indexOf(ranked[0].kind) < L.GAP_KINDS.indexOf('region'), true);
// A bottle two flights want is one thing to buy, not two.
const twice = [{ title: 'F1', core: [{ k: 'a' }, { kind: 'wish', name: 'Same One' }] },
               { title: 'F2', core: [{ k: 'b' }, { kind: 'wish', name: 'Same One' }] }];
eq('one entry for a bottle two flights want',
  L.shelfGaps(gCat, gBot, twice, []).filter(g => g.name === 'Same One').length, 1);

// A wishlist entry a flight already explains is not repeated.
const wl = [{ name: 'Longrow 18', added: '2026-01-01' },
            { name: 'Just Because', reason: 'looked good', added: '2026-01-02' }];
const withWish = L.shelfGaps(gCat, gBot, [oneShort], wl);
eq('a wish covered by a flight is not repeated',
  withWish.filter(g => g.name === 'Longrow 18').length, 1);
eq('a wish nothing explains still appears',
  withWish.some(g => g.name === 'Just Because'), true);
eq('and it keeps the reason you gave',
  withWish.find(g => g.name === 'Just Because').why, 'looked good');
eq('an empty shelf is safe', L.shelfGaps({}, [], [], []).length >= 0, true);
}

{
sec('extension and contrast');
// A house you have committed to is not a gap, it is a preference. The
// useful suggestion works WITH it rather than telling you to buy elsewhere.
const houseCat = {};
for (let i = 0; i < 6; i++) {
  houseCat['h' + i] = { k: 'h' + i, name: 'House ' + i, dist: 'BigHouse',
                        proof: 90 + i, sub: 'bourbon' };
}
const houseBot = Object.keys(houseCat).map((k, i) =>
  ({ id: 'hb' + i, k: k, status: 'open' }));
const hg = L.gapsFromHouses(houseCat, houseBot);
eq('a house with six bottles in a narrow band is flagged',
  hg.some(g => /very different strength/.test(g.name)), true);
eq('and it is an extension, not a hole', hg[0].kind, 'extend');
// Three bottles is not yet a commitment worth a suggestion.
const small = { a: { k: 'a', dist: 'Small', proof: 90 },
                b: { k: 'b', dist: 'Small', proof: 91 },
                c: { k: 'c', dist: 'Small', proof: 92 } };
eq('three bottles is not a commitment', L.gapsFromHouses(small, []).length, 0);
// A wide spread of strengths means that axis is already explored; the
// suggestion should move to a different one.
const wide = {};
[90, 95, 100, 120, 130].forEach((p, i) => {
  wide['w' + i] = { k: 'w' + i, dist: 'Wide', proof: p };
});
eq('a house already spread on proof gets a different suggestion',
  /strength/.test((L.gapsFromHouses(wide, [])[0] || {}).name || ''), false);
// Never more than three, or the list is eight near-identical lines.
const many = {};
for (let d = 0; d < 8; d++) {
  for (let i = 0; i < 5; i++) {
    many['d' + d + 'b' + i] = { k: 'd' + d + 'b' + i, dist: 'H' + d, proof: 90 + i };
  }
}
eq('at most three extensions', L.gapsFromHouses(many, []).length, 3);
// Deeper commitment outranks shallower.
eq('the biggest house ranks first',
  L.gapsFromHouses(many, [])[0].weight >= L.gapsFromHouses(many, [])[2].weight, true);

sec('contrast');
const lop = {};
for (let i = 0; i < 30; i++) {
  lop['c' + i] = { k: 'c' + i, name: 'W' + i, wine: true, fin: 'Sherry', proof: 90 };
}
lop.wood = { k: 'wood', name: 'Wood', wine: false, fin: 'Toasted Oak', proof: 90 };
const cg = L.gapsFromContrast(lop, []);
eq('a lopsided cask split is reported',
  cg.some(g => /wood-only/.test(g.name)), true);
eq('it is a contrast, not a shortage', cg.find(g => /wood-only/.test(g.name)).kind,
  'contrast');
// A balanced shelf has nothing to say here.
const balanced = { a: { k: 'a', wine: true, proof: 90 },
                   b: { k: 'b', wine: false, proof: 90 } };
eq('a balanced shelf raises no contrast',
  L.gapsFromContrast(balanced, []).some(g => /wood-only/.test(g.name)), false);

sec('flights only count when flights get run');
const fCat2 = { a: { k: 'a', name: 'A', dist: 'D', proof: 90 } };
const fBot2 = [{ id: 'x', k: 'a', status: 'open' }];
const oneAway = { title: 'ONE AWAY',
  core: [{ k: 'a' }, { kind: 'wish', name: 'Missing One' }] };
const never = L.shelfGaps(fCat2, fBot2, [oneAway], [], []);
const often = L.shelfGaps(fCat2, fBot2, [oneAway], [],
  Array.from({ length: 6 }, (_, i) => ({ kind: 'flight', flight: 'F' + i })));
const wNever = never.find(g => g.name === 'Missing One').weight;
const wOften = often.find(g => g.name === 'Missing One').weight;
// 36 flights designed and none run makes unlocking one a hypothesis.
eq('unlocking a flight is worth less when none are run', wNever < wOften, true);
eq('and worth full value once they are', wOften, 100);
eq('history is optional', L.shelfGaps(fCat2, fBot2, [oneAway], []).length > 0, true);
}

{
sec('running a flight again');
const rCat = {};
['a','b','c','d','e','f','g','h'].forEach((k, i) => {
  rCat[k] = { k: k, name: 'Bottle ' + k.toUpperCase(), dist: 'House',
              sub: 'scotch', proof: 90 + i * 4, fin: 'Fin' + i, obsc: 'known' };
});
rCat.x = { k: 'x', name: 'Bourbon One', dist: 'Other', sub: 'bourbon',
           proof: 100, fin: 'Sherry', obsc: 'known' };
const rBot = Object.keys(rCat).map((k, i) => ({ id: 'r' + i, k: k, status: 'open' }));
const flight = { title: 'A CASK FLIGHT', tag: 'ONE VARIABLE: WHICH CASK',
                 core: ['a','b','c','d'].map(k => ({ k: k })) };

// The variable is read back from the tag, so a re-cast knows what to hold.
eq('the variable is read from the tag', L.variableOfId(flight), 'finish');
eq('a proof flight reads as proof',
  L.variableOfId({ tag: 'ONE VARIABLE: PROOF' }), 'proof');
eq('an untagged flight has no variable', L.variableOfId({ tag: '' }), null);

sec('run history');
const hist = [
  { kind: 'flight', flight: 'A CASK FLIGHT', at: '2026-03-01', pours: ['a','b'] },
  { kind: 'flight', flight: 'A CASK FLIGHT', at: '2026-01-01', pours: ['c'] },
  { kind: 'flight', flight: 'ANOTHER', at: '2026-02-01', pours: ['d'] },
  { kind: 'pour', k: 'a', at: '2026-02-02' }
];
const runs = L.flightRuns(flight, hist);
eq('only this flight counts', runs.length, 2);
eq('oldest first, numbered', runs.map(r => r.run), [1, 2]);
eq('and dated in order', runs.map(r => r.at), ['2026-01-01', '2026-03-01']);
eq('every bottle it has ever used',
  Object.keys(L.pouredBefore(flight, hist)).sort(), ['a', 'b', 'c']);
eq('a flight never run has no history', L.flightRuns(flight, []), []);

sec('re-casting');
const rc = L.recastFlight(flight, rCat, rBot, hist);
eq('it produces a cast', rc.ok, true);
eq('numbered as the next run', rc.run, 3);
eq('the same variable is held', rc.variable, 'finish');
// The flight is all Scotch; the re-cast must not quietly become bourbon.
eq('the cast keeps the flight\u2019s own category', rc.held, 'scotch');
eq('and no bourbon creeps in',
  rc.pours.every(p => rCat[p.k].sub === 'scotch'), true);
// Bottles poured before are pushed back, so run three is not run one again.
eq('it prefers bottles not used before', rc.fresh >= 3, true);
eq('pours come back in proof order',
  rc.pours.map(p => rCat[p.k].proof),
  rc.pours.map(p => rCat[p.k].proof).slice().sort((a, b) => a - b));
eq('previous run is reported', rc.previous.at, '2026-03-01');

// A flight with no stated variable cannot be re-cast, and says so.
eq('no variable, no re-cast',
  L.recastFlight({ title: 'X', tag: '', core: [] }, rCat, rBot, []).ok, false);
eq('and it explains why',
  /single variable/.test(L.recastFlight({ title: 'X', tag: '', core: [] },
    rCat, rBot, []).why), true);
// A first re-cast of a never-run flight is run 1.
eq('never run means run one',
  L.recastFlight(flight, rCat, rBot, []).run, 1);
}

/* ---------------- overuse ---------------- */
sec('overuse control');
const flights = [
  { title: 'F1', core: [{ k: 'A' }, { k: 'B' }], ext: [] },
  { title: 'F2', core: [{ k: 'A' }], ext: [] },
  { title: 'F3', core: [{ k: 'A' }], ext: [] }
];
const hist = [{ flight: 'F1', pours: ['A', 'B'] }];
// A appears in three flights plus one recorded run = 4.
eq('use count across flights and runs', L.useCount('A', flights, hist), 4);
eq('use count for B', L.useCount('B', flights, hist), 2);
eq('unused product', L.useCount('Z', flights, hist), 0);
eq('overused at default cap 3', L.overused(['A', 'B'], flights, hist), ['A']);
eq('nothing overused at cap 5', L.overused(['A', 'B'], flights, hist, 5), []);

/* ---------------- snacks ---------------- */
sec('snack suggestions');
// BZ's rule: simple bowls, no vinegar, no citrus. Verify nothing sour or
// citrus leaks into any list.
const bad = /vinegar|lemon|lime|orange|citrus|pickle/i;
Object.keys(L.SNACKS).forEach(k => {
  eq('no citrus or vinegar in ' + k, L.SNACKS[k].some(s => bad.test(s)), false);
  eq('three snacks for ' + k, L.SNACKS[k].length, 3);
});
eq('peated wins over sherry', L.snacksFor([
  { name: 'Laphroaig 10', dist: 'Laphroaig', fin: 'Sherry' }]), L.SNACKS.peat);
eq('sherry flight', L.snacksFor([
  { name: 'Macallan 12', dist: 'Macallan', fin: 'Oloroso' }]), L.SNACKS.sherry);
eq('port flight', L.snacksFor([
  { name: "Angel's Envy", dist: "Angel's Envy", fin: 'Port' }]), L.SNACKS.wine);
eq('wood-only flight', L.snacksFor([
  { name: 'Triple Oak', dist: "Angel's Envy", fin: 'Hungarian Oak+French Oak' }]), L.SNACKS.wood);
eq('unfinished flight', L.snacksFor([
  { name: 'Eagle Rare', dist: 'Buffalo Trace', fin: null }]), L.SNACKS.plain);

/* ---------------- variable + sms ---------------- */
sec('variable extraction and SMS');
eq('variable from tag', L.variableOf(
  { tag: '6 core + 4 extensions \u00b7 ALL BLIND \u00b7 ONE VARIABLE: WHICH SHERRY' }),
  'One variable: which sherry');
eq('variable falls back to last segment', L.variableOf(
  { tag: '6 core \u00b7 ALL BLIND \u00b7 THREE MATCHED PAIRS' }), 'THREE MATCHED PAIRS');

const smsFlight = { title: 'SHERRY IS NOT ONE THING',
  tag: 'x \u00b7 ONE VARIABLE: WHICH SHERRY' };
const smsProds = [
  { name: 'Oban Distillers Edition', fin: 'Fino', proof: 86, dist: 'Oban' },
  { name: 'Macallan Sherry Oak 12', fin: 'Oloroso', proof: 86, dist: 'Macallan' }
];
const body = L.smsBody(smsFlight, smsProds);
const lines = body.split('\n');
eq('sms line count', lines.length, 5);      // title, variable, 2 pours, snacks
eq('sms title', lines[0], 'SHERRY IS NOT ONE THING');
eq('sms variable', lines[1], 'One variable: which sherry');
eq('sms first pour lettered A', lines[2].startsWith('A \u00b7 Oban'), true);
eq('sms second pour lettered B', lines[3].startsWith('B \u00b7 Macallan'), true);
eq('sms ends with snacks', lines[4].startsWith('Snacks:'), true);
// Macallan is not peated and Oban is not in the peat list; sherry wins.
eq('sms snack line matches sherry', lines[4],
  'Snacks: dark chocolate, dried cherries, salted pecans');

/* ---------------- reels ---------------- */
sec('reels: faces and matching');
// Proof bands are exclusive at the boundaries: 90 is <=90, 90.1 is 90-105.
eq('90 is le90', L.faceMatch('proof', 'le90', { proof: 90 }), true);
eq('90.1 is not le90', L.faceMatch('proof', 'le90', { proof: 90.1 }), false);
eq('90.1 is mid', L.faceMatch('proof', '90-105', { proof: 90.1 }), true);
eq('105 is mid', L.faceMatch('proof', '90-105', { proof: 105 }), true);
eq('105.1 is upper', L.faceMatch('proof', '105-120', { proof: 105.1 }), true);
eq('120 is upper', L.faceMatch('proof', '105-120', { proof: 120 }), true);
eq('120.1 is ge120', L.faceMatch('proof', 'ge120', { proof: 120.1 }), true);
eq('any always matches', L.faceMatch('proof', 'any', { proof: 200 }), true);

eq('bourbon matches', L.faceMatch('type', 'bourbon', { sub: 'bourbon' }), true);
// Every face is an exact category. No catch-all bucket exists to hide in.
eq('ASM is its own face', L.faceMatch('type', 'american single malt',
  { sub: 'american single malt' }), true);
eq('scotch is not ASM', L.faceMatch('type', 'american single malt', { sub: 'scotch' }), false);
eq('tennessee is not bourbon', L.faceMatch('type', 'bourbon', { sub: 'tennessee' }), false);
eq('japanese has its own face', L.faceMatch('type', 'japanese', { sub: 'japanese' }), true);
eq('canadian has its own face', L.faceMatch('type', 'canadian', { sub: 'canadian' }), true);
eq('no other face exists', L.REELS.find(r => r.id === 'type')
  .faces.some(f => f.v === 'other' || f.v === 'malt'), false);
eq('every declared type has a face', L.TYPES.every(s =>
  L.REELS.find(r => r.id === 'type').faces.some(f => f.v === s)), true);

eq('recognition matches', L.faceMatch('obsc', 'obscure', { obsc: 'obscure' }), true);
eq('recognition rejects', L.faceMatch('obsc', 'obscure', { obsc: 'known' }), false);

sec('occasion bands');
// Boundaries: 49.99 everyday, 50 good, 99.99 good, 100 special, 200 vault.
eq('49.99 everyday', L.priceBand(49.99), 'everyday');
eq('50 good', L.priceBand(50), 'good');
eq('99.99 good', L.priceBand(99.99), 'good');
eq('100 special', L.priceBand(100), 'special');
eq('199.99 special', L.priceBand(199.99), 'special');
eq('200 vault', L.priceBand(200), 'vault');
eq('no price is null', L.priceBand(null), null);
eq('zero price is null', L.priceBand(0), null);

sec('spin and holds');
// A held reel keeps its face; an unheld one takes the rng's pick. rng at 0
// always selects face index 0, which is 'any' on every reel.
const zero = () => 0;
let cur = { proof: 'ge120', type: 'scotch', obsc: 'obscure', price: 'vault' };
let spun = L.spin(cur, { type: true }, zero);
eq('held reel keeps its face', spun.type, 'scotch');
eq('unheld reel rerolled', spun.proof, 'any');
eq('all four reels present', Object.keys(spun).sort(), ['obsc', 'price', 'proof', 'type']);
// rng just under 1 selects the last face on each reel.
const last = () => 0.999999;
spun = L.spin(cur, {}, last);
eq('last face on proof', spun.proof, 'ge120');
eq('last face on type', spun.type, 'tequila');
eq('last face on recognition', spun.obsc, 'obscure');
eq('last face on occasion', spun.price, 'vault');
// Holding everything makes a spin a no-op.
eq('all held is a no-op', L.spin(cur, { proof: 1, type: 1, obsc: 1, price: 1 }, last), cur);

sec('a spin always pays out');
// The machine must never land on a combination nothing satisfies. Rather
// than rolling blind, spinValid picks a bottle that satisfies the held reels
// and describes it with the unheld ones.
eq('a bottle maps to a face on every reel',
  Object.keys(L.facesOf(catalog['Raasay Dun Cana @ 104.0'])).sort(),
  ['obsc', 'price', 'proof', 'type']);
eq('raasay is obscure on the recognition reel',
  L.facesOf(catalog['Raasay Dun Cana @ 104.0']).obsc, 'obscure');
eq('raasay at 104 lands in the 90-105 band',
  L.facesOf(catalog['Raasay Dun Cana @ 104.0']).proof, '90-105');
eq('AE at 119.8 lands in 105-120',
  L.facesOf(catalog['AE Single Barrel @ 119.8']).proof, '105-120');

// Every spin over the fixture shelf must leave at least one pour standing.
// rnd cycles so the harness walks a spread of picks rather than one.
let seed = 0;
const cycling = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
let emptyPaylines = 0;
let reelState = { proof: 'any', type: 'any', obsc: 'any', price: 'any' };
for (let i = 0; i < 300; i++) {
  const nxt = L.spinValid(reelState, {}, catalog, bottles, cycling);
  if (!nxt) { emptyPaylines++; continue; }
  reelState = nxt;
  if (L.reelMatches(catalog, bottles, reelState, []).length === 0) emptyPaylines++;
}
eq('300 spins, no empty payline', emptyPaylines, 0);

// A held reel is respected and still pays.
let heldFails = 0;
reelState = { proof: 'any', type: 'scotch', obsc: 'any', price: 'any' };
for (let i = 0; i < 100; i++) {
  const nxt = L.spinValid(reelState, { type: true }, catalog, bottles, cycling);
  if (!nxt) { heldFails++; continue; }
  reelState = nxt;
  if (reelState.type !== 'scotch') heldFails++;
  if (L.reelMatches(catalog, bottles, reelState, []).length === 0) heldFails++;
}
eq('holds are kept and still pay out', heldFails, 0);

// Holds that rule out everything return null so the caller can say so,
// rather than spinning to an empty line.
eq('unsatisfiable holds return null',
  L.spinValid({ proof: 'le90', type: 'bourbon', obsc: 'any', price: 'any' },
    { proof: true, type: true }, catalog, bottles, cycling), null);
// A sealed-only shelf can never pay out either.
eq('nothing open returns null', L.spinValid(
  { proof: 'any', type: 'any', obsc: 'any', price: 'any' }, {},
  catalog, [{ id: 'z', k: 'Lagavulin 16 @ 86.0', status: 'sealed' }], cycling), null);
// A drained bottle is not a candidate.
eq('drained bottles cannot be spun to', L.spinValid(
  { proof: 'any', type: 'any', obsc: 'any', price: 'any' }, {},
  { x: { k: 'x', name: 'X', proof: 90, sub: 'bourbon', obsc: 'known', msrp: 40,
         drained: true } },
  [{ id: 'z', k: 'x', status: 'open' }], cycling), null);

sec('the payout line');
// Fixture: Raasay is open/obscure/104 proof/$104.99 -> special.
//          AE Single Barrel is open/known/119.8/$89.99 -> good.
//          Lagavulin is sealed, Weller is gone: neither can ever line up.
const anyReels = { proof: 'any', type: 'any', obsc: 'any', price: 'any' };
eq('open bottles only', L.reelMatches(catalog, bottles, anyReels, []).length, 2);
eq('obscure narrows to one', L.reelMatches(catalog, bottles,
  Object.assign({}, anyReels, { obsc: 'obscure' }), []).map(x => x.k),
  ['Raasay Dun Cana @ 104.0']);
eq('special occasion narrows to raasay', L.reelMatches(catalog, bottles,
  Object.assign({}, anyReels, { price: 'special' }), []).map(x => x.k),
  ['Raasay Dun Cana @ 104.0']);
eq('good occasion narrows to AE', L.reelMatches(catalog, bottles,
  Object.assign({}, anyReels, { price: 'good' }), []).map(x => x.k),
  ['AE Single Barrel @ 119.8']);
eq('impossible combination pays nothing', L.reelMatches(catalog, bottles,
  Object.assign({}, anyReels, { obsc: 'obscure', price: 'vault' }), []).length, 0);
eq('at most three glasses', L.pourGlasses(catalog, bottles, anyReels, []).length <= 3, true);
eq('a tight filter fills fewer glasses', L.pourGlasses(catalog, bottles,
  Object.assign({}, anyReels, { obsc: 'obscure' }), []).length, 1);
// A drained bottle never comes back up.
const drainedCat = JSON.parse(JSON.stringify(catalog));
drainedCat['Raasay Dun Cana @ 104.0'].drained = true;
eq('drain pours stay out', L.reelMatches(drainedCat, bottles, anyReels, [])
  .some(x => x.k === 'Raasay Dun Cana @ 104.0'), false);
// Every reel has an 'any' face, so the machine can always pay out.
eq('every reel has an any face',
  L.REELS.every(r => r.faces.some(f => f.v === 'any')), true);
eq('four reels', L.REELS.length, 4);

/* ---------------- capitalization ---------------- */
sec('capitalization');
// Title Case: data values shown as a label or chip.
eq('common noun', L.titleCase('bourbon'), 'Bourbon');
eq('two words', L.titleCase('drain pour'), 'Drain Pour');
eq('acronym stays whole', L.titleCase('msrp'), 'MSRP');
eq('long name is shortened for a chip', L.titleCase('american single malt'), 'American Malt');
eq('house spelling applied', L.titleCase('flavored'), 'Flavoured');
eq('proper noun', L.titleCase('islay'), 'Islay');
eq('cask name', L.titleCase('pedro ximenez'), 'Pedro Ximenez');
eq('interior capital survives', L.titleCase("A'Bunadh"), "A'Bunadh");
eq('mixed-case name survives', L.titleCase('McKenna'), 'McKenna');
eq('empty is empty', L.titleCase(''), '');
eq('null is empty', L.titleCase(null), '');
eq('already correct is unchanged', L.titleCase('Scotch'), 'Scotch');

// Sentence case: headings, including the shouted flight titles.
eq('flight title', L.sentenceCase('SHERRY IS NOT ONE THING'), 'Sherry is not one thing');
eq('proper noun kept up', L.sentenceCase('IS TENNESSEE JUST FILTERED BOURBON?'),
  'Is Tennessee just filtered bourbon?');
eq('two-word proper noun', L.sentenceCase('WHAT DOES GRAY LABEL BUY?'),
  'What does Gray Label buy?');
eq('distillery name kept up', L.sentenceCase('FOUR WAYS TO WOOD A LAPHROAIG'),
  'Four ways to wood a Laphroaig');
eq('demonym kept up', L.sentenceCase('CAN YOU FIND THE AMERICANS?'),
  'Can you find the Americans?');
eq('colon survives', L.sentenceCase('CAIRDEAS: THE ANNUAL EXPERIMENT'),
  'Cairdeas: the annual experiment');
eq('apostrophe survives', L.sentenceCase("WHO'S YOUR DADDY?"), "Who's your daddy?");
eq('price token survives', L.sentenceCase('IS IT WORTH $100 MORE?'),
  'Is it worth $100 more?');
eq('empty heading', L.sentenceCase(''), '');

/* ---------------- notes ---------------- */
sec('notes');
const noteFlights = [
  { title: 'SHERRY IS NOT ONE THING',
    core: [{ k: 'X' }, { k: 'Raasay Dun Cana @ 104.0' }],
    cards: [{ wood: 'OLOROSO' }, { wood: 'PX AND OLOROSO QUARTER CASKS' }] },
  { title: 'PEAT IS A POSTCODE', core: [{ k: 'Z' }], cards: [{ wood: 'ISLAY' }] }
];
const np = { k: 'Raasay Dun Cana @ 104.0', name: 'Raasay', fin: 'Pedro Ximenez+Oloroso',
             wine: true, region: 'Islands', notes: 'Bot. no. 12551.', msrpNote: 'GBP 91 @ 1.35' };
let ns = L.notesFor(np, noteFlights, 'Poured this blind in August.');
eq('every source contributes', ns.length, 6);
eq('sources in order', ns.map(n => n.src),
  ['inventory', 'price', 'cask', 'region', 'sherry is not one thing', 'you']);
eq('cask note names the casks', ns[2].text, 'Pedro Ximenez, Oloroso \u2014 a wine cask');
eq('user note is last', ns[5].text, 'Poured this blind in August.');
// Only the flights this bottle is actually in contribute a line.
eq('unrelated flight excluded', ns.some(n => n.src === 'peat is a postcode'), false);
// A wood-only finish says so, and an unknown one says neither.
eq('wood-only is labelled', L.notesFor({ k: 'A', fin: 'Toasted Oak', wine: false }, [], null)[0].text,
  'Toasted Oak \u2014 wood only, no wine');
eq('unknown cask is not labelled', L.notesFor({ k: 'A', fin: 'Multi-cask', wine: null }, [], null)[0].text,
  'Multi-cask');
eq('a bare bottle has no notes', L.notesFor({ k: 'A' }, [], null).length, 0);
eq('a user note alone still shows', L.notesFor({ k: 'A' }, [], 'mine').length, 1);
eq('null product is safe', L.notesFor(null, [], 'mine').length, 0);

/* ---------------- catalog layers ---------------- */
sec('catalog merge');
const base = { A: { k: 'A', name: 'Alpha', proof: 90 }, B: { k: 'B', name: 'Beta', proof: 100 } };
eq('base passes through', Object.keys(L.mergeCatalog(base, {}, {}, {})).sort(), ['A', 'B']);
eq('edit overrides one field', L.mergeCatalog(base, { A: { proof: 92 } }, {}, {}).A.proof, 92);
eq('edit keeps other fields', L.mergeCatalog(base, { A: { proof: 92 } }, {}, {}).A.name, 'Alpha');
eq('base is not mutated', base.A.proof, 90);
eq('custom is added', L.mergeCatalog(base, {}, { C: { k: 'C', name: 'Gamma' } }, {}).C.name, 'Gamma');
eq('deleted is hidden', Object.keys(L.mergeCatalog(base, {}, {}, { A: true })), ['B']);
eq('deleted custom is hidden too',
  Object.keys(L.mergeCatalog(base, {}, { C: { k: 'C' } }, { C: true })).sort(), ['A', 'B']);

sec('product validation');
eq('valid product passes', L.validateProduct({ name: 'Ardbeg 10', proof: '92' }), []);
eq('missing name fails', L.validateProduct({ name: '', proof: '92' }).length, 1);
eq('one-char name fails', L.validateProduct({ name: 'A', proof: '92' }).length, 1);
eq('missing proof fails', L.validateProduct({ name: 'Ardbeg 10', proof: '' }).length, 1);
eq('proof below 20 fails', L.validateProduct({ name: 'X Y', proof: '19' }).length, 1);
eq('proof above 200 fails', L.validateProduct({ name: 'X Y', proof: '201' }).length, 1);
eq('proof 20 is allowed', L.validateProduct({ name: 'X Y', proof: '20' }), []);
eq('blank price is allowed', L.validateProduct({ name: 'X Y', proof: '92', msrp: '' }), []);
eq('non-numeric price fails', L.validateProduct({ name: 'X Y', proof: '92', msrp: 'abc' }).length, 1);
eq('age 80 allowed', L.validateProduct({ name: 'X Y', proof: '92', age: '80' }), []);
eq('age 81 fails', L.validateProduct({ name: 'X Y', proof: '92', age: '81' }).length, 1);
eq('two problems report two', L.validateProduct({ name: '', proof: '' }).length, 2);

sec('product normalisation');
const norm = L.normalizeProduct({ name: '  Ardbeg 10 ', proof: '92', sub: 'scotch',
  age: '10', msrp: '59.99', fin: 'Oloroso', sec: '', size: '' });
eq('name trimmed', norm.name, 'Ardbeg 10');
eq('proof numeric', norm.proof, 92);
eq('age numeric', norm.age, 10);
eq('blank secondary is null', norm.sec, null);
eq('size defaults to 750', norm.size, 750);
eq('sherry finish is wine', norm.wine, true);
eq('toasted oak is not wine', L.normalizeProduct(
  { name: 'X Y', proof: '90', fin: 'Toasted Oak' }).wine, false);
// Multi-cask says how many, not which: unknown, never false.
eq('multi-cask is unknown', L.normalizeProduct(
  { name: 'X Y', proof: '90', fin: 'Multi-cask' }).wine, null);
eq('no finish is null', L.normalizeProduct({ name: 'X Y', proof: '90', fin: '' }).wine, null);
eq('mixed wood and wine is wine', L.finIsWine('Oloroso+American Oak'), true);
eq('two woods is not wine', L.finIsWine('French Oak+Toasted Oak'), false);

sec('bottle ids and deletion');
eq('next id after B344', L.nextBottleId([{ id: 'B344' }, { id: 'B012' }]), 'B345');
eq('first id on an empty shelf', L.nextBottleId([]), 'B001');
eq('non-matching ids ignored', L.nextBottleId([{ id: 'x' }, { id: 'B009' }]), 'B010');
eq('cannot delete with bottles', L.canDeleteProduct('AE Single Barrel @ 119.8', bottles), false);
eq('can delete when all gone', L.canDeleteProduct('Weller SiB @ 97.0', bottles), true);
eq('can delete an unknown key', L.canDeleteProduct('nope', bottles), true);

/* ---------------- flight editing ---------------- */
sec('flight editing');
const nf = L.newFlight('sherry night');
eq('title upper-cased', nf.title, 'SHERRY NIGHT');
eq('new flight is empty', nf.core.length, 0);
eq('new flight is marked custom', nf.custom, true);

let pours = L.addPour([], 'A');
pours = L.addPour(pours, 'B');
pours = L.addPour(pours, 'C');
eq('three pours added', pours.length, 3);
eq('letters assigned', pours.map(p => p.letter), ['A', 'B', 'C']);
eq('order assigned', pours.map(p => p.ord), [1, 2, 3]);

// Removing B must relabel: old C becomes B, not stay C.
const removed = L.removePour(pours, 1);
eq('removal shortens', removed.length, 2);
eq('removal relabels', removed.map(p => p.letter), ['A', 'B']);
eq('removal keeps the right keys', removed.map(p => p.k), ['A', 'C']);

const moved = L.movePour(pours, 0, 1);
eq('move down reorders', moved.map(p => p.k), ['B', 'A', 'C']);
eq('move relabels', moved.map(p => p.letter), ['A', 'B', 'C']);
eq('move up past the top is a no-op', L.movePour(pours, 0, -1).map(p => p.k), ['A', 'B', 'C']);
eq('move down past the end is a no-op', L.movePour(pours, 2, 1).map(p => p.k), ['A', 'B', 'C']);

// Sorting by proof is the house rule in one call.
const sortCat = { A: { proof: 110 }, B: { proof: 86 }, C: { proof: 100 } };
const sorted = L.sortByProof(pours, sortCat);
eq('sorted ascending by proof', sorted.map(p => p.k), ['B', 'C', 'A']);
eq('sorting relabels', sorted.map(p => p.letter), ['A', 'B', 'C']);
// A pour whose product is missing sorts to the front rather than throwing.
eq('missing product does not throw',
  L.sortByProof([{ k: 'zz' }, { k: 'B' }], sortCat).length, 2);

/* ---------------- the map ---------------- */
sec('map projection and view');
// Longitude is scaled by cos(56.8 deg) = 0.5471, so a degree of longitude is
// about 55% the width of a degree of latitude at Scotland's middle.
const k = Math.cos(56.8 * Math.PI / 180);
eq('longitude is scaled', L.project(-6, 55.6)[0], -6 * k);
eq('latitude is flipped for screen space', L.project(-6, 55.6)[1], -55.6);
eq('north is above south', L.project(-6, 58)[1] < L.project(-6, 55)[1], true);

// Extent over a known box: lon -6..-2, lat 55..58, with a 0.5 pad.
const ext = L.mapExtent([[[-6, 55], [-2, 58]]], 0.5);
eq('extent x', Math.round(ext.x * 1000) / 1000, Math.round((-6 * k - 0.5) * 1000) / 1000);
eq('extent width', Math.round(ext.w * 1000) / 1000,
   Math.round((4 * k + 1) * 1000) / 1000);
eq('extent height', ext.h, 4);           // 3 degrees of latitude plus 2 x 0.5
eq('zero pad is honoured', L.mapExtent([[[-6, 55], [-2, 58]]], 0).h, 3);

sec('pins');
const mapCat = {
  a: { k: 'a', sub: 'scotch', dist: 'Ardbeg', region: 'Islay' },
  b: { k: 'b', sub: 'scotch', dist: 'Ardbeg', region: 'Islay' },
  c: { k: 'c', sub: 'scotch', dist: 'Oban', region: 'Highland' },
  d: { k: 'd', sub: 'bourbon', dist: 'Ardbeg', region: null },
  e: { k: 'e', sub: 'scotch', dist: 'Nowhere', region: 'Islay' }
};
const mapCoords = { 'Ardbeg': [-6.1083, 55.6408], 'Oban': [-5.4728, 56.4139] };
const mapBottles = [{ id: 'M1', k: 'a', status: 'open' },
                    { id: 'M2', k: 'b', status: 'sealed' },
                    { id: 'M3', k: 'c', status: 'open' }];
const pins = L.mapPins(mapCat, mapCoords, mapBottles);
eq('one pin per distillery', pins.length, 2);
eq('busiest distillery first', pins[0].dist, 'Ardbeg');
eq('bottles counted', pins[0].total, 2);
eq('open counted separately', pins[0].open, 1);
// A bourbon from a Scottish distillery name is not a Scotch pin, and a
// distillery with no coordinates is left off rather than placed at 0,0.
eq('non-scotch excluded', pins[0].total, 2);
eq('uncoordinated distillery dropped', pins.some(p => p.dist === 'Nowhere'), false);
eq('region carried onto the pin', pins[0].region, 'Islay');

// Radius is a FRACTION OF THE MAP, not a pixel count. A fixed 1.45 on a map
// 4.55 degrees wide was 64% of Scotland; this is the bug that made the pins
// swallow the country.
// Scotland: span 4.55, largest distillery 12 bottles.
eq('smallest pin is the floor', L.pinRadius(1, 100, 1), 4.5);
eq('a single bottle in a busy set is near the floor',
  Math.round(L.pinRadius(1, 100, 100) * 100) / 100, 1.53);
eq('the largest count reaches the ceiling', L.pinRadius(100, 100, 100), 4.5);
eq('growth is sub-linear', L.pinRadius(4, 100, 16) < L.pinRadius(16, 100, 16), true);
// No pin may exceed 9% of the map width, whatever the counts.
[1, 12, 80, 185, 5000].forEach(n => {
  eq('pin at n=' + n + ' stays under a tenth of the map',
    L.pinRadius(n, 100, n) * 2 <= 9.01, true);
});
eq('a zero count still draws something', L.pinRadius(0, 100, 10) > 0, true);
eq('a missing span does not produce NaN', isNaN(L.pinRadius(3)), false);

sec('map type sizes');
// Type is in map units too, for the same reason the radii are.
eq('name type scales with the map', L.mapFont(100, 'name'), 2.6);
eq('count type is smaller', L.mapFont(100, 'count'), 2);
eq('a narrow map gets small type', L.mapFont(4.55, 'name') < 0.13, true);

sec('zoom ceiling');
// Pins hold a constant SCREEN size, so they must shrink by the zoom, not by
// its square root -- otherwise a cluster can never come apart.
// Ardbeg and Lagavulin are 0.011 map units apart; their radii sum is 0.336
// at 1x, so they separate once 0.336 / z < 0.011, i.e. above about 31x.
eq('the ceiling clears the tightest cluster', L.MAP_ZOOM.max > 31, true);
eq('zoom floor is the whole map', L.MAP_ZOOM.min, 1);

sec('co-located pins fan out');
// Two pins on one coordinate means one can never be tapped.
const sameSpot = {
  A: { k: 'A', sub: 'bourbon', dist: 'Alpha Co' },
  B: { k: 'B', sub: 'bourbon', dist: 'Bravo Co' }
};
const sameCoords = { 'Alpha Co': [-85.47, 37.82], 'Bravo Co': [-85.47, 37.82] };
const fanned = L.mapPins(sameSpot, sameCoords, [], ['bourbon']);
eq('both pins survive', fanned.length, 2);
eq('both are marked as moved', fanned.every(p => p.fanned), true);
eq('they no longer share a point',
  fanned[0].lat !== fanned[1].lat || fanned[0].lon !== fanned[1].lon, true);
// And they stay in the right town: under a mile from where they really are.
const fanMiles = Math.max.apply(null, fanned.map(p =>
  Math.hypot((p.lat - 37.82) * 69, (p.lon + 85.47) * 54)));
eq('nothing moves more than a mile', fanMiles < 1, true);
// A lone pin is left exactly where it belongs.
const solo = L.mapPins({ A: sameSpot.A }, sameCoords, [], ['bourbon']);
eq('a single pin is not moved', solo[0].fanned, undefined);
eq('a single pin keeps its latitude', solo[0].lat, 37.82);
// Fanning is deterministic: a pin must not wander between renders.
const again = L.mapPins(sameSpot, sameCoords, [], ['bourbon']);
eq('fanning is stable across calls', again[0].lat, fanned[0].lat);

sec('zoom and clamping');
eq('zoom floor', L.clampZoom(0.2), 1);
eq('the ceiling holds', L.clampZoom(999999), L.MAP_ZOOM.max);
eq('zoom passes through', L.clampZoom(7), 7);

const full = { x: 0, y: 0, w: 100, h: 100 };
eq('a view cannot start left of the map',
  L.clampView({ x: -50, y: 0, w: 50, h: 50 }, full).x, 0);
eq('a view cannot run off the right',
  L.clampView({ x: 90, y: 0, w: 50, h: 50 }, full).x, 50);
eq('a view wider than the map is capped',
  L.clampView({ x: 0, y: 0, w: 300, h: 300 }, full).w, 100);

// Zooming about a point keeps that point still.
const win = { x: 0, y: 0, w: 100, h: 100 };
const zoomed = L.zoomAbout(win, full, 2, 50, 50);
eq('zoom halves the window', zoomed.w, 50);
eq('the focus point holds', zoomed.x + zoomed.w / 2, 50);
eq('zooming out past the map is clamped', L.zoomAbout(zoomed, full, 0.01, 25, 25).w, 100);
// full.w is 100 and the ceiling is 5200x, so the tightest window is 100/5200.
eq('zoom in stops at the ceiling',
  Math.round(L.zoomAbout(win, full, 1e9, 50, 50).w * 1e6) / 1e6,
  Math.round((100 / L.MAP_ZOOM.max) * 1e6) / 1e6);

/* ---------------- summary ---------------- */
sec('shelf statistics');
// bottles fixture: 3 AE (1 open, 2 sealed), 1 Lagavulin sealed, 1 Raasay
// open, 1 Weller gone. So 5 live, 2 open, 3 sealed, 1 gone.
const st = L.shelfStats(catalog, bottles);
eq('live bottles', st.bottles, 5);
eq('open bottles', st.open, 2);
eq('sealed bottles', st.sealed, 3);
eq('gone excluded from live', st.gone, 1);
eq('distinct whiskies on the shelf', st.products, 3);

sec('shelf value');
// AE 89.99 x3 + Lagavulin 109.99 + Raasay 104.99 = 484.96 -> 485. The gone
// Weller does not count: it is not on the shelf.
eq('msrp total', L.shelfValue(catalog, bottles).msrp, 485);
eq('priced bottles counted', L.shelfValue(catalog, bottles).priced, 5);
eq('gone bottles counted separately', L.shelfValue(catalog, bottles).gone, 1);
// A bottle whose product has no price is skipped, not counted as zero.
const noPrice = { X: { k: 'X', name: 'X', proof: 90 } };
eq('unpriced product does not inflate the count',
  L.shelfValue(noPrice, [{ id: 'n1', k: 'X', status: 'open' }]).priced, 0);
// Paid is separate from MSRP and comes off the bottle, not the product.
eq('paid totals from bottles',
  L.shelfValue(catalog, [{ id: 'p1', k: 'Lagavulin 16 @ 86.0', status: 'open', paid: 178 }]).paid,
  178);

sec('bar rows');
const rows = L.barRows({ bourbon: 130, scotch: 80, irish: 47 });
eq('sorted descending', rows.map(r => r.label), ['bourbon', 'scotch', 'irish']);
eq('largest is full width', rows[0].pct, 100);
// 80/130 = 61.5%, 47/130 = 36.2% -- computed by hand.
eq('second bar scaled to the largest', rows[1].pct, 61.5);
eq('third bar scaled to the largest', rows[2].pct, 36.2);
// An ordered scale keeps its order rather than being sorted by size.
const scale = L.barRows({ Known: 5, Niche: 90, Obscure: 20 }, { keepOrder: true });
eq('ordered scale keeps sequence', scale.map(r => r.label), ['Known', 'Niche', 'Obscure']);
eq('still scaled to the largest', scale[1].pct, 100);
eq('empty input gives no rows', L.barRows({}).length, 0);
eq('all zeros do not divide by zero', L.barRows({ a: 0, b: 0 })[0].pct, 0);

sec('counting and recency');
eq('count by a key', L.countBy([{ s: 'a' }, { s: 'b' }, { s: 'a' }], x => x.s), { a: 2, b: 1 });
eq('nulls are skipped', L.countBy([{ s: null }, { s: 'a' }], x => x.s), { a: 1 });
/* ---------------- map layers ---------------- */
sec('country and state counts');
const layerCat = {
  a: { k: 'a', sub: 'bourbon', dist: 'Jim Beam' },
  b: { k: 'b', sub: 'scotch', dist: 'Ardbeg' },
  c: { k: 'c', sub: 'irish', dist: 'Midleton' },
  d: { k: 'd', sub: 'world', dist: 'Pokeno Whiskey' },
  e: { k: 'e', sub: 'world', dist: 'Rampur Distillery' }
};
const subC = { bourbon: 'United States', scotch: 'Scotland', irish: 'Ireland' };
const wD = { 'Pokeno Whiskey': 'New Zealand', 'Rampur Distillery': 'India' };
const cc = L.countryCounts(layerCat, subC, wD, []);
eq('five countries', cc.length, 5);
// The two 'world' bottles are from different countries and must not merge.
eq('world bottles placed individually',
  cc.filter(c => c.name === 'New Zealand' || c.name === 'India').length, 2);
eq('distillery beats category', L.countryOf(layerCat.d, subC, wD), 'New Zealand');
eq('category used when no override', L.countryOf(layerCat.a, subC, wD), 'United States');
eq('unknown category places nothing', L.countryOf({ sub: 'zzz', dist: 'zzz' }, subC, wD), null);

const stCat = {
  a: { k: 'a', sub: 'bourbon', dist: 'Jim Beam' },
  b: { k: 'b', sub: 'bourbon', dist: 'Jim Beam' },
  c: { k: 'c', sub: 'scotch', dist: 'Ardbeg' },
  d: { k: 'd', sub: 'rye', dist: 'Unconfirmed Co' }
};
const stMap = { 'Jim Beam': 'Kentucky' };
const sc = L.stateCounts(stCat, stMap, []);
eq('one entry per state', Object.keys(sc), ['Kentucky']);
eq('bottles counted', sc.Kentucky.total, 2);
eq('scotch is not placed in a state', sc.Kentucky.keys.indexOf('c'), -1);
eq('an unconfirmed bottler is left off rather than guessed',
  Object.keys(sc).length, 1);

sec('choropleth steps');
// Kentucky holds 126 and Nevada 1: a linear ramp would flatten everything
// but Kentucky, so the steps are banded.
eq('no bottles', L.choroStep(0), 0);
eq('one bottle', L.choroStep(1), 1);
eq('two bottles', L.choroStep(2), 1);
eq('three bottles', L.choroStep(3), 2);
eq('eight bottles', L.choroStep(8), 3);
eq('twenty bottles', L.choroStep(20), 4);
eq('kentucky tops out', L.choroStep(126), 5);
eq('steps never exceed the palette', L.choroStep(99999), 5);

/* ---------------- shopping ---------------- */
sec('shop name matching');
// The shelf and the label rarely agree on punctuation or filler words.
eq('apostrophes ignored', L.shopNorm("Aberlour A'Bunadh Alba"), 'aberlour abunadh alba');
eq('filler words dropped', L.shopNorm('Ardbeg 10 Year Old Single Malt Scotch Whisky'),
  'ardbeg 10');
eq('case and punctuation ignored', L.shopNorm('LAGAVULIN, 16-YEAR!'), 'lagavulin 16');
eq('empty is empty', L.shopNorm(''), '');

const shopCat = {
  'Ardbeg 10': { k: 'Ardbeg 10', name: 'Ardbeg 10 Year Old', dist: 'Ardbeg',
    sub: 'scotch', region: 'Islay', proof: 92, msrp: 59.99, fin: null },
  'Lagavulin 16': { k: 'Lagavulin 16', name: 'Lagavulin 16 Year', dist: 'Lagavulin',
    sub: 'scotch', region: 'Islay', proof: 86, msrp: 109.99, fin: null },
  'Ardbeg Corry': { k: 'Ardbeg Corry', name: 'Ardbeg Corryvreckan', dist: 'Ardbeg',
    sub: 'scotch', region: 'Islay', proof: 114.2, msrp: 89.99, fin: null }
};
const shopBottles = [{ id: 'S1', k: 'Ardbeg 10', status: 'open' },
                     { id: 'S2', k: 'Lagavulin 16', status: 'open' },
                     { id: 'S3', k: 'Ardbeg Corry', status: 'open' }];

eq('search finds by name', L.shopSearch('ardbeg', shopCat).length, 2);
eq('search finds by distillery', L.shopSearch('Lagavulin', shopCat)[0].p.k, 'Lagavulin 16');
eq('a one-character query returns nothing', L.shopSearch('a', shopCat).length, 0);
eq('no match returns nothing', L.shopSearch('zzzzz', shopCat).length, 0);
eq('limit honoured', L.shopSearch('ardbeg', shopCat, 1).length, 1);

sec('shelf fit');
// Already owned, single open bottle: a backup fits the stocking rule.
let fit = L.shelfFit({ name: 'Ardbeg 10 Year Old', dist: 'Ardbeg', sub: 'scotch',
  proof: 92 }, shopCat, shopBottles);
eq('recognised as owned', fit.own.key, 'Ardbeg 10');
eq('one open bottle reads as a backup opportunity',
  fit.findings.some(f => f.level === 'ok' && /stocking rule/.test(f.msg)), true);

// Owned twice already: no longer a gap.
const twoBottles = shopBottles.concat([{ id: 'S4', k: 'Ardbeg 10', status: 'sealed' }]);
fit = L.shelfFit({ name: 'Ardbeg 10 Year Old', dist: 'Ardbeg', sub: 'scotch', proof: 92 },
  shopCat, twoBottles);
eq('two owned warns', fit.findings.some(f => f.level === 'warn' && /already own 2/.test(f.msg)), true);
eq('verdict when covered', L.fitVerdict(fit), 'You have this covered.');
// Owning one open bottle is a backup decision, not new ground -- the verdict
// must not read as "adds something" just because the stocking finding is
// tagged ok.
const owned1 = L.shelfFit({ name: 'Ardbeg 10 Year Old', dist: 'Ardbeg',
  sub: 'scotch', proof: 92 }, shopCat, shopBottles);
eq('owning one reads as the backup', L.fitVerdict(owned1),
  'You have it open. This would be the backup.');

sec('plurals');
// A naive plural gives "scotchs" and "irishs".
eq('countable plural', L.plural('bourbon', 3), 'bourbons');
eq('one stays singular', L.plural('bourbon', 1), 'bourbon');
eq('mass noun takes bottles', L.plural('scotch', 29), 'scotch bottles');
eq('irish takes bottles', L.plural('irish', 4), 'irish bottles');
eq('multi-word category', L.plural('american single malt', 2),
  'american single malt bottles');

// Genuinely new: unknown distillery, unknown category.
fit = L.shelfFit({ name: 'Kavalan Solist', dist: 'Kavalan', sub: 'world', proof: 114 },
  shopCat, shopBottles);
eq('new distillery flagged', fit.findings.some(f => /distillery you do not own/.test(f.msg)), true);
eq('new category flagged', fit.findings.some(f => /category you do not own/.test(f.msg)), true);
eq('verdict when it adds', L.fitVerdict(fit), 'It adds something the shelf lacks.');

// Matched pair: same house, within one proof point.
fit = L.shelfFit({ name: 'Ardbeg Uigeadail', dist: 'Ardbeg', sub: 'scotch', proof: 114.6 },
  shopCat, shopBottles);
eq('matched pair spotted',
  fit.findings.some(f => /Matched pair with Ardbeg Corryvreckan/.test(f.msg)), true);
// 114.6 against Corryvreckan's 114.2 is 0.4 apart -- inside the one-point rule.
eq('the pair is the near-proof bottle', fit.pairs[0].k, 'Ardbeg Corry');

// A crowded corner: five or more of the same category within five proof.
const crowded = {};
for (let i = 0; i < 6; i++) {
  crowded['B' + i] = { k: 'B' + i, name: 'Bourbon ' + i, dist: 'D' + i,
    sub: 'bourbon', proof: 100 + i * 0.5, msrp: 60 };
}
fit = L.shelfFit({ name: 'Another Bourbon', dist: 'New Co', sub: 'bourbon', proof: 101 },
  crowded, []);
eq('crowded corner warns',
  fit.findings.some(f => f.level === 'warn' && /within five proof points/.test(f.msg)), true);
eq('neighbours counted', fit.neighbours.length, 6);

// An empty corner is worth saying too.
fit = L.shelfFit({ name: 'Odd One', dist: 'New Co', sub: 'bourbon', proof: 140 },
  crowded, []);
eq('empty corner noted',
  fit.findings.some(f => /Nothing else on the shelf sits near it/.test(f.msg)), true);

// Price is reported against the median for that category, not in the abstract.
fit = L.shelfFit({ name: 'Pricey', dist: 'New Co', sub: 'bourbon', proof: 140, msrp: 250 },
  crowded, []);
eq('price band reported',
  fit.findings.some(f => /Vault/.test(f.msg) && /median is \$60/.test(f.msg)), true);

sec('median');
eq('odd count', L.median([1, 5, 3]), 3);
eq('even count averages the middle', L.median([1, 2, 3, 4]), 2.5);
eq('single value', L.median([7]), 7);
eq('empty is zero', L.median([]), 0);

/* ---------------- import ---------------- */
sec('CSV parsing');
eq('plain rows', L.parseCSV('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
// A quoted field holding a comma is why a hand-rolled split fails.
eq('quoted comma', L.parseCSV('a,b\n"x, y",2')[1], ['x, y', '2']);
eq('doubled quotes become one', L.parseCSV('a\n"he said ""hi"""')[1], ['he said "hi"']);
eq('CRLF handled', L.parseCSV('a,b\r\n1,2')[1], ['1', '2']);
eq('a trailing newline adds no row', L.parseCSV('a,b\n1,2\n').length, 2);
eq('blank lines are dropped', L.parseCSV('a,b\n\n1,2').length, 2);
eq('a BOM is stripped', L.parseCSV('\ufeffname\nx')[0], ['name']);
eq('empty input', L.parseCSV(''), []);

sec('column matching');
eq('exact names', L.matchColumns(['name', 'proof']), { name: 0, proof: 1 });
eq('Only Drams headings', L.matchColumns(['Name', 'Distillery', 'ABV', 'Type']),
  { name: 0, dist: 1, proof: 2, sub: 3 });
eq('underscores and case', L.matchColumns(['Bottle_Name', 'Retail Price']),
  { name: 0, msrp: 1 });
eq('unknown columns are ignored', L.matchColumns(['name', 'zzz']), { name: 0 });
eq('the first match wins', L.matchColumns(['name', 'title']).name, 0);

sec('proof from a column that may hold ABV');
// Only Drams exports ABV. For a whisky, anything under 60 can only be ABV.
eq('43 ABV becomes 86 proof', L.readProof('43'), 86);
eq('46 ABV becomes 92', L.readProof(46), 92);
eq('57.5 becomes 115', L.readProof('57.5'), 115);
eq('a real proof passes through', L.readProof('100'), 100);
eq('115.2 is left alone', L.readProof('115.2'), 115.2);
eq('60 is treated as a proof', L.readProof('60'), 60);
eq('59.9 is treated as an ABV', L.readProof('59.9'), 119.8);
eq('units are stripped', L.readProof('46% ABV'), 92);
eq('nothing usable is null', L.readProof('n/a'), null);
eq('empty is null', L.readProof(''), null);

sec('category from loose spellings');
eq('exact', L.readSub('bourbon'), 'bourbon');
eq('single malt scotch', L.readSub('Single Malt Scotch'), 'scotch');
eq('a region names its country', L.readSub('Islay'), 'scotch');
eq('irish pot still', L.readSub('Single Pot Still'), 'irish');
eq('a longer phrase still matches', L.readSub('Straight Bourbon Whiskey'), 'bourbon');
eq('american single malt', L.readSub('American Single Malt'), 'american single malt');
eq('unknown is null', L.readSub('zzz'), null);
eq('empty is null', L.readSub(''), null);

sec('preparing an import');
const impCat = { 'Ardbeg 10 Years Old': { k: 'Ardbeg 10 Years Old',
  name: 'Ardbeg 10 Years Old', proof: 92 } };
const impCsv = 'Name,ABV,Type\n'
  + '"Ardbeg 10 Years Old",46,Islay\n'
  + '"Ardbeg 10 Years Old",46,Islay\n'
  + '"New Bottle",50,Bourbon\n'
  + '"No Proof Here",,Bourbon\n'
  + '"Odd Category",100,Sasparilla\n'
  + ',,\n';
const prep = L.prepareImport(L.parseCSV(impCsv), impCat);
eq('blank lines produce no rows', prep.rows.length, 5);
eq('owned reads as exists', prep.rows[0].action, 'exists');
// A repeat inside the file must stay a duplicate: reading it as "exists"
// would add a second sealed spare for the same line.
eq('a repeat inside the file is a duplicate', prep.rows[1].action, 'duplicate');
eq('new is added', prep.rows[2].action, 'add');
eq('no proof is skipped', prep.rows[3].action, 'skip');
eq('summary counts', L.importSummary(prep), { add: 2, exists: 1, duplicate: 1, skip: 1 });
eq('line numbers point at the file', prep.rows[3].line, 5);
eq('a missing proof is flagged', prep.rows[3].issues, ['no proof']);
// A category the app does not know falls back to bourbon and says so, rather
// than silently filing a rum as a bourbon.
eq('an unrecognised category is flagged',
  prep.rows[4].issues, ['category guessed']);
eq('the guess is a real category', prep.rows[4].sub, 'bourbon');
eq('a recognised category is not flagged',
  prep.rows[0].issues.indexOf('category guessed'), -1);
eq('no header is fatal', !!L.prepareImport([['a', 'b']], {}).fatal, true);
eq('no name column is fatal', !!L.prepareImport([['zzz'], ['1']], {}).fatal, true);
eq('an empty file is fatal', !!L.prepareImport([], {}).fatal, true);

sec('the template');
// The template has to survive its own importer, or it is not a template.
const tmpl = L.prepareImport(L.parseCSV(L.templateCSV()), {});
eq('template parses', tmpl.fatal, null);
eq('every template row imports', L.importSummary(tmpl),
  { add: 3, exists: 0, duplicate: 0, skip: 0 });
eq('no template row has an issue', tmpl.rows.every(r => r.issues.length === 0), true);
eq('the template ABV example doubles', tmpl.rows[2].proof, 92);
eq('sealed status is read', tmpl.rows[1].status, 'sealed');
eq('every documented column is recognised',
  L.TEMPLATE_COLS.filter(c => Object.keys(L.matchColumns([c])).length === 0), []);

/* ---------------- reference ---------------- */
sec('reference');
eq('three groups', L.REF_GROUPS.length, 3);
eq('tasting group resolves', L.refGroup('tasting'), L.TASTING);
eq('whiskey group resolves', L.refGroup('whiskey'), L.WHISKEY);
eq('our-data group resolves', L.refGroup('ourdata'), L.REFERENCE);
eq('an unknown group falls back to the first', L.refGroup('zzz'), L.TASTING);
eq('every group has content',
  L.REF_GROUPS.every(g => L[g.data].length > 0), true);
eq('tasting and whiskey items are substantial',
  L.TASTING.concat(L.WHISKEY).every(s => s.items.every(i => i.def.length > 40)), true);
eq('sections present', L.REFERENCE.length, 6);
eq('every section has items', L.REFERENCE.every(s => s.items.length > 0), true);
eq('every item has a term and a definition',
  L.REFERENCE.every(s => s.items.every(i => i.term && i.def && i.def.length > 20)), true);
// The split by authority is the point: a legal standard and a house
// convention must not read as the same kind of claim.
const legal = L.REFERENCE.find(s => /defined in law/.test(s.section));
eq('legal categories cite a source', legal.items.every(i => !!i.src), true);
const ours = L.REFERENCE.find(s => /own conventions/.test(s.section));
eq('house conventions claim no legal source',
  ours.items.every(i => !i.src), true);
// Every category the app can file a bottle under must be defined somewhere.
const defined = L.REFERENCE.reduce((a, s) => a.concat(s.items.map(i => i.term.toLowerCase())), []);
const NAMED = { 'bourbon': 'bourbon', 'rye': 'rye whiskey', 'wheat': 'wheat whiskey',
  'tennessee': 'tennessee whiskey', 'american single malt': 'american single malt',
  'scotch': 'scotch whisky', 'irish': 'irish whiskey', 'canadian': 'canadian whisky',
  'japanese': 'japanese whisky', 'world': 'world whisky', 'flavored': 'flavoured whiskey',
  'tequila': 'tequila' };
eq('every type has a definition',
  L.TYPES.filter(t => defined.indexOf(NAMED[t]) < 0), []);
// Every Scotch region is defined too.
eq('every scotch region is defined',
  L.SCOTCH_REGIONS.filter(r => defined.indexOf(r.toLowerCase()) < 0), []);
eq('our-data term count', L.referenceCount('ourdata'), defined.length);
eq('total spans all three groups', L.referenceCount(),
  L.referenceCount('tasting') + L.referenceCount('whiskey') + L.referenceCount('ourdata'));

sec('reference search');
eq('search finds a term', L.searchReference('lincoln county')
  .some(s => s.items.some(i => /Tennessee/.test(i.term))), true);
eq('search is case insensitive', L.searchReference('ISLAY').length > 0, true);
eq('search matches the definition text', L.searchReference('700 litres').length > 0, true);
eq('search matches the source', L.searchReference('27 CFR').length > 0, true);
eq('no match returns nothing', L.searchReference('zzzzz').length, 0);
eq('empty sections are dropped',
  L.searchReference('lincoln county').every(s => s.items.length > 0), true);
// An empty query browses the chosen group only.
eq('empty query returns the tasting group',
  L.searchReference('', 'tasting').length, L.TASTING.length);
eq('empty query respects the group', L.searchReference('', 'whiskey').length, L.WHISKEY.length);
// A search crosses groups: someone looking for "char" does not know which
// tab it lives on.
eq('search crosses groups', L.searchReference('char')
  .some(s => s.group === 'Whiskey'), true);
eq('search results are labelled with their group',
  L.searchReference('alligator').every(s => !!s.group), true);
// Terms that must exist because BZ's own flights turn on them.
['angel', 'chill filtration', 'bottled in bond', 'solera', 'peat',
 'single barrel', 'no age statement'].forEach(term => {
  eq('reference covers ' + term, L.searchReference(term).length > 0, true);
});

/* ---------------- real data ---------------- */
sec('real collection data');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
// The map geometry was never loaded here, which is why the map assertions
// could be dropped without anything failing.
const mapData = JSON.parse(fs.readFileSync(path.join(__dirname, 'map.json'), 'utf8'));
eq('344 bottles', data.bottles.length, 344);
eq('325 products', Object.keys(data.catalog).length, 325);
// Macaloney's is in Victoria BC and Crown Royal in Gimli, Manitoba: both were
// filed elsewhere until the taxonomy pass.
eq('macaloney is canadian', Object.values(data.catalog)
  .filter(p => /Macaloney/.test(p.dist)).every(p => p.sub === 'canadian'), true);
eq('crown royal is canadian', Object.values(data.catalog)
  .filter(p => p.dist === 'Crown Royal').every(p => p.sub === 'canadian'), true);
// Bourbon-forward blends of straight whiskeys read as bourbon on this shelf;
// style keeps 'blended' so the construction is not lost.
eq('barrell blends file as bourbon', Object.values(data.catalog)
  .filter(p => /Barrell.*(Dovetail|Anniversary)/.test(p.name))
  .every(p => p.sub === 'bourbon' && p.style === 'blended'), true);
eq("keeper's heart notes the Irish half", Object.values(data.catalog)
  .find(p => /Keeper/.test(p.name)).notes.indexOf('Half Irish') === 0, true);
// Barrell 33 Year is distilled in Canada and only bottled in Kentucky:
// country beats the bottler's address.
const b33 = Object.values(data.catalog).find(p => /33 Year/.test(p.name));
eq('barrell 33 is canadian', b33.sub, 'canadian');
eq('barrell 33 keeps its blended style', b33.style, 'blended');
eq('barrell 33 names its casks', b33.fin, 'Oloroso+French Oak');
eq('barrell 33 met a wine cask', b33.wine, true);
eq('barrell 33 is 33 years old', b33.age, 33);
// Country beats grain where a country category exists (Crown Royal), and
// grain decides among the American categories -- Wheat N Rye has no corn.
eq('old elk wheat n rye is rye', Object.values(data.catalog)
  .find(p => p.name === 'Old Elk Wheat N Rye').sub, 'rye');
eq('wheat holds the one straight wheat whiskey', Object.values(data.catalog)
  .filter(p => p.sub === 'wheat').map(p => p.name),
  ['Old Elk 10 Year Old Straight Wheat Whiskey']);
eq('blended is gone from the data', Object.values(data.catalog)
  .filter(p => p.sub === 'blended').length, 0);
eq('blended is gone from the reel', L.TYPES.indexOf('blended'), -1);
// No reel face may exist that nothing on the shelf can satisfy: a face that
// never pays out is a dud spin.
const subsInData = new Set(Object.values(data.catalog).map(p => p.sub));
eq('every type face has at least one bottle',
  L.TYPES.filter(s => !subsInData.has(s)), []);
// Region is Scotch-only, and only where a distillery can carry one.
const scotch = Object.values(data.catalog).filter(p => p.sub === 'scotch');
eq('scotch regions assigned', scotch.filter(p => p.region).length, 76);
eq('islay is the largest region',
  scotch.filter(p => p.region === 'Islay').length, 39);
eq('regions are all recognised', scotch.filter(p => p.region)
  .every(p => L.SCOTCH_REGIONS.indexOf(p.region) >= 0), true);
eq('no non-scotch carries a region', Object.values(data.catalog)
  .filter(p => p.sub !== 'scotch' && p.region).length, 0);
// No subcategory exists that the type reel cannot name.
const subs = [...new Set(Object.values(data.catalog).map(p => p.sub))].sort();
eq('every subcategory in the data has a reel face',
  subs.filter(s => L.TYPES.indexOf(s) < 0), []);
eq('36 flights', data.flights.length, 36);
// Every duplicated product has exactly one open bottle -- BZ's stocking rule.
const byKey = {};
data.bottles.forEach(b => { (byKey[b.k] = byKey[b.k] || []).push(b); });
const violations = Object.keys(byKey).filter(k =>
  byKey[k].filter(b => b.status === 'open').length !== 1);
eq('every product has exactly one open bottle', violations.length, 0);
// The control set: finished, but no wine cask.
// Every bottle with a known finish must have a wine verdict. A finish and
// a null verdict was a 44-bottle gap the QA pass found.
eq('no finish is left unclassified', Object.values(data.catalog)
  .filter(p => p.fin && p.wine === null).length, 0);
const woodOnly = Object.values(data.catalog).filter(p => p.fin && p.wine === false);
eq('thirteen wood-only products', woodOnly.length, 13);
eq('wood-only means no wine in any component', woodOnly.every(p =>
  p.fin.split('+').every(c => /Oak|Mizunara|Amburana/.test(c))), true);
eq('ninety-seven wine-cask products',
  Object.values(data.catalog).filter(p => p.wine === true).length, 97);
const tripleOak = Object.values(data.catalog).find(p => /Triple Oak/.test(p.name));
eq('triple oak is finished', tripleOak.fin, 'Hungarian Oak+Chinkapin Oak+French Oak');
eq('triple oak has no wine', tripleOak.wine, false);

// Coverage: every product must be reachable by some non-'any' face on every
// reel. A bottle no spin can name is a bottle the machine can never pour.
const REELS_BY = {};
L.REELS.forEach(r => { REELS_BY[r.id] = r.faces.filter(f => f.v !== 'any'); });
const unreachable = Object.values(data.catalog).filter(p =>
  !Object.keys(REELS_BY).every(id =>
    REELS_BY[id].some(f => L.faceMatch(id, f.v, p))));
eq('every product is reachable by the reels', unreachable.map(p => p.name), []);
// The occasion reel depends on a price: all 325 carry one.
eq('every product has a price band',
  Object.values(data.catalog).filter(p => !L.priceBand(p.msrp)).map(p => p.name), []);

// No reel face may be lower-case: the faces sit side by side as labels, and
// one lower-case face among Title Case neighbours is the inconsistency this
// pass removed.
const badFace = [];
L.REELS.forEach(r => r.faces.forEach(f => {
  if (f.t && /^[a-z]/.test(f.t)) badFace.push(r.id + ':' + f.t);
}));
eq('every reel face is Title Case', badFace, []);
// --- the map, against the real shelf -------------------------------------
// These were lost when the per-layer ceiling tests were removed; without
// them a distillery can go missing from the map and nothing complains.
const usPins = L.mapPins(data.catalog, mapData.usDistilleries, data.bottles, L.US_SUBS);
const scPins = L.mapPins(data.catalog, mapData.distilleries, data.bottles, ['scotch']);
const iePins = L.mapPins(data.catalog, mapData.ieDistilleries, data.bottles, ['irish']);
// The gap analysis against the real shelf.
// No flights have been run, so the list is led by what the shelf says on
// its own merits rather than by a flight nobody has poured.
const realGaps = L.shelfGaps(data.catalog, data.bottles, data.flights, [], []);
eq('the shelf produces findings', realGaps.length > 0, true);
eq('with no flights run, a shelf observation leads',
  ['contrast', 'extend'].indexOf(realGaps[0].kind) >= 0, true);
// 97 wine-cask against 13 wood-only is a contrast BZ cannot currently taste.
eq('the lopsided cask split is the top finding',
  /wood-only/.test(realGaps[0].name), true);
// Once flights get run, the bottle that completes one takes the lead.
const runGaps = L.shelfGaps(data.catalog, data.bottles, data.flights, [],
  Array.from({ length: 6 }, (_, i) => ({ kind: 'flight', flight: 'F' + i })));
eq('once flights are run, the bottle that unlocks one leads',
  /Longrow 18/.test(runGaps[0].name), true);
eq('and it names the flight', runGaps[0].flight, 'PEAT IS A POSTCODE');
// Buffalo Trace is 24 bottles with no finished bottling — a real
// observation about the shelf that has nothing to do with flights.
eq('the deepest house gets an extension suggestion',
  realGaps.some(g => g.kind === 'extend' && /Buffalo Trace/.test(g.name)), true);
eq('every finding has a name and a reason',
  realGaps.every(g => g.name && g.why), true);
eq('every finding is a known kind',
  realGaps.every(g => L.GAP_KINDS.indexOf(g.kind) >= 0), true);
// Campbeltown and Lowland hold one bottle each and cannot carry a flight.
eq('both thin scotch regions are flagged',
  ['Campbeltown', 'Lowland'].every(r =>
    realGaps.some(g => g.kind === 'region' && g.name.indexOf(r) >= 0)), true);
// Never suggest buying something already open on the shelf.
eq('nothing suggested is already pourable',
  realGaps.filter(g => g.kind === 'flight' && !g.owned)
    .filter(g => Object.values(data.catalog).some(p =>
      p.name === g.name && L.pourable(p.k, data.bottles))).length, 0);

// Re-casting a real flight: same question, different whisky, and the
// flight's own constraints survive.
const sherry = data.flights.find(f => f.title === 'SHERRY IS NOT ONE THING');
const sherryHist = [{ kind: 'flight', flight: sherry.title, at: '2026-01-15',
                      pours: sherry.core.map(p => p.k) }];
const recast = L.recastFlight(sherry, data.catalog, data.bottles, sherryHist);
eq('a real flight re-casts', recast.ok, true);
eq('it is run two', recast.run, 2);
// The flight is all Scotch, no smoke. Holding only the variable produced
// five Irish Spots — a fine flight, and a different one.
eq('it stays all scotch', recast.held, 'scotch');
eq('and every pour really is scotch',
  recast.pours.every(p => data.catalog[p.k].sub === 'scotch'), true);
eq('nothing from the first run is reused', recast.fresh, recast.pours.length);


// Tasting notes across the real shelf, and where each set came from.
const withTn = Object.values(data.catalog).filter(p => p.tn);
eq('197 products carry tasting notes', withTn.length, 197);
eq('every note set has at least three columns',
  withTn.every(p => L.tastingNotes(p).length >= 3), true);
// Twelve are now sourced from WHISKY:EDITION rather than written by me for
// a flight card. The two must never be confusable.
const sourced = Object.values(data.catalog).filter(p => p.tnSrc === 'review');
eq('twelve note sets are sourced', sourced.length, 12);
eq('a sourced note is never also credited to a card',
  sourced.filter(p => p.tnFrom).length, 0);
eq('every note set records its origin one way or the other',
  withTn.every(p => !!p.tnFrom || !!p.tnSrc), true);
eq('notes always come back in sheet order',
  withTn.every(p => L.tastingNotes(p).map(n => n.label.toLowerCase()).join()
    === L.TN_ORDER.filter(k => p.tn[k]).join()), true);

eq('56 US distilleries plotted', usPins.length, 56);
eq('185 US bottles sit on a pin', usPins.reduce((n, p) => n + p.total, 0), 185);
eq('47 irish bottles sit on a pin', iePins.reduce((n, p) => n + p.total, 0), 47);
// 76 of 80: the other four are blends and independent bottlings whose
// "distillery" is a blender with no single place -- Dewar's, Johnnie Walker,
// Orphan Barrel and Ian Macleod. A blend has no dot on a map, and inventing
// one would be worse than leaving it off.
eq('76 of 80 scotch bottles sit on a pin',
  scPins.reduce((n, p) => n + p.total, 0), 76);

// Nothing may appear in a count and be absent from the map.
const unplaced = (subs, coords) => [...new Set(Object.values(data.catalog)
  .filter(p => subs.indexOf(p.sub) >= 0).map(p => p.dist))]
  .filter(dd => !coords[dd]);
eq('no US distillery is unplaced', unplaced(L.US_SUBS, mapData.usDistilleries), []);
eq('no irish distillery is unplaced', unplaced(['irish'], mapData.ieDistilleries), []);
// Only real distilleries are expected to have coordinates.
const BLENDERS = ["Dewar's", 'Johnnie Walker',
                  'Orphan Barrel Whiskey Distilling Co.', 'Ian Macleod Distillers'];
eq('every scotch DISTILLERY is placed',
  unplaced(['scotch'], mapData.distilleries).filter(d => BLENDERS.indexOf(d) < 0), []);
eq('the four unplaced scotch names are all blenders',
  unplaced(['scotch'], mapData.distilleries).sort(), BLENDERS.slice().sort());

// 308 of 325: the remainder are Canadian, Japanese, world and tequila, which
// have no coordinate set of their own.
eq('308 bottles are placeable',
  usPins.concat(scPins, iePins).reduce((n, p) => n + p.total, 0), 308);

// Pins must come apart at the ceiling, or a cluster can never be read.
const worldSpan = L.mapExtent(mapData.world, 3).w;
function overlapCount(pins, z) {
  const maxN = pins.reduce((m, p) => Math.max(m, p.total), 1);
  let n = 0;
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const A = L.project(pins[i].lon, pins[i].lat);
      const B = L.project(pins[j].lon, pins[j].lat);
      const gap = Math.hypot(A[0] - B[0], A[1] - B[1]);
      const rr = (L.pinRadius(pins[i].total, worldSpan, maxN)
                + L.pinRadius(pins[j].total, worldSpan, maxN)) / z;
      if (gap < rr) n++;
    }
  }
  return n;
}
eq('no US pins overlap at the ceiling', overlapCount(usPins, L.MAP_ZOOM.max), 0);
eq('no scotch pins overlap at the ceiling', overlapCount(scPins, L.MAP_ZOOM.max), 0);
eq('pins do overlap when zoomed out', overlapCount(usPins, 1) > 0, true);

// Prices corrected from Ohio state retail, which is what BZ actually pays.
eq('Green Spot Montelena is Zinfandel, not Bordeaux',
  data.catalog['Green Spot Montelena'].fin, 'Zinfandel');
eq('and priced at Ohio retail', data.catalog['Green Spot Montelena'].msrp, 99.99);
eq('Basil Hayden is a forty dollar bourbon',
  data.catalog['Basil Hayden Bourbon'].msrp, 39.99);
// Ages confirmed off the label, both found by following a single correction.
eq('Wee Beastie is a five year old',
  data.catalog['Ardbeg Wee Beastie'].age, 5);
eq("Booker's Beam House states seven in its own name",
  data.catalog["Booker's 2024-02 The Beam House Batch 7 Year Old Kentucky Straight Bourbon Whiskey"].age, 7);
// Every age stated in a name must be stored. validate.py enforces this, but
// it missed the Booker's because its batch mask ate the age; pin the shape
// here too so the harness would catch a repeat independently.
const nameAge = n => {
  const masked = String(n)
    .replace(/\b(batch|pact|chapter|build|no\.?)\s*\d+(?!\s*(?:yr|yrs|year|years|yo)\b)/gi, ' ')
    .replace(/\b\d+\s*(proof|wood)\b/gi, ' ');
  const m = masked.match(/\b(\d{1,2})\s*(?:yr|yrs|year|years|yo)\b/i);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return v >= 2 && v <= 50 ? v : null;
};
eq('a batch number is not read as an age', nameAge("Booker's 2020-02 Boston Batch"), null);
eq('a batch number does not swallow the age that follows it',
  nameAge("Booker's 2024-02 The Beam House Batch 7 Year Old"), 7);
eq('a chapter number is not an age',
  nameAge('Little Book Chapter 8 Path Not Taken'), null);
eq('every age stated in a name is stored', Object.values(data.catalog)
  .filter(p => nameAge(p.name) !== null && p.age !== nameAge(p.name))
  .map(p => p.name), []);

// A secondary far below its own MSRP is a data error, not a market price.
eq('no secondary sits far below its MSRP', Object.values(data.catalog)
  .filter(p => p.sec && p.msrp && p.sec < p.msrp * 0.25).map(p => p.name), []);

// Every real flight title survives sentence-casing without losing a capital
// that a proper noun needs.
eq('no flight title starts lower-case',
  data.flights.map(f => L.sentenceCase(f.title)).filter(t => /^[a-z]/.test(t)), []);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
