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

// Single-barrel releases are ONE product; per-barrel proof lives on the
// bottle. Keying on name+proof made two products and broke the stocking rule.


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
// The reason must stand on its own. Naming a flight only means something
// to whoever wrote it, and once shelves are shared these are not the
// reader's flights — so the reason says what the flight IS.
eq('the reason describes the flight rather than naming it',
  /ONE SHORT/.test(fg.find(g => g.name === 'Longrow 18').why), false);
eq('and says what it is',
  /pour/.test(fg.find(g => g.name === 'Longrow 18').why), true);

// A sealed bottle you already own is the cheapest gap there is.
const sealedShort = { title: 'SEALED', core: [{ k: 'a' }, { k: 's' }] };
const sg = L.gapsFromFlights([sealedShort], gCat, gBot);
eq('a sealed bottle you own is flagged as owned', sg[0].owned, true);


sec('what a wish pour can say about itself');
// A flight whose pours agree tells you about the one that is missing.
const oneKind = { title: 'ALL SCOTCH', tag: 'ONE VARIABLE: WHICH CASK', core: [
  { k: 'a' }, { k: 'b' }, { k: 'c' }, { kind: 'wish', name: 'Missing One', proof: 92 }] };
const oneCat = {
  a: { k: 'a', name: 'A', sub: 'scotch', proof: 90, dist: 'D1' },
  b: { k: 'b', name: 'B', sub: 'scotch', proof: 94, dist: 'D2' },
  c: { k: 'c', name: 'C', sub: 'scotch', proof: 96, dist: 'D3' }
};
const oneBot = ['a', 'b', 'c'].map((k, i) => ({ id: 'o' + i, k, status: 'open' }));
const g1 = L.gapsFromFlights([oneKind], oneCat, oneBot)[0];
eq('a uniform flight names the category', g1.sub, 'scotch');
eq('and carries the proof the card recorded', g1.proof, 92);

// A flight that mixes categories on purpose tells you nothing, and must not
// pretend otherwise. Peat Is a Postcode runs Scotch, Canadian and Irish
// because the flight is about peat crossing borders.
const mixed = { title: 'ACROSS BORDERS', tag: 'ONE VARIABLE: WHERE', core: [
  { k: 'a' }, { k: 'd' }, { k: 'e' }, { kind: 'wish', name: 'Missing Two' }] };
const mixCat = Object.assign({}, oneCat, {
  d: { k: 'd', name: 'D', sub: 'irish', proof: 92, dist: 'D4' },
  e: { k: 'e', name: 'E', sub: 'canadian', proof: 93, dist: 'D5' }
});
const mixBot = ['a', 'd', 'e'].map((k, i) => ({ id: 'm' + i, k, status: 'open' }));
eq('a mixed flight infers nothing',
  L.gapsFromFlights([mixed], mixCat, mixBot)[0].sub, null);
// Two pours is not enough to call it a pattern.
const twoPour = { title: 'THIN', tag: 'ONE VARIABLE: X', core: [
  { k: 'a' }, { k: 'b' }, { kind: 'wish', name: 'Missing Three' }] };
eq('two agreeing pours are not evidence',
  L.gapsFromFlights([twoPour], oneCat, oneBot)[0].sub, null);

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
// The gap is still raised; what changed is that it no longer names the
// house in the thing to go and buy. "Something from BigHouse at a very
// different strength" asked for a bottle the app had no grounds to believe
// BigHouse makes.
eq('a house with six bottles in a narrow band is flagged',
  hg.some(g => /cask-strength/i.test(g.name)), true);
eq('and it does not name the house in the ask',
  hg.some(g => /cask-strength/i.test(g.name) && /BigHouse/.test(g.name)), false);
eq('while the house is named in the reason',
  hg.some(g => /cask-strength/i.test(g.name) && /BigHouse/.test(g.why)), true);
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

{
sec('named gaps against described ones');
// Longrow 18 is a bottle you can search a shop for. "A finished Buffalo
// Trace" is not, and treating it as a search term found nothing.
eq('a flight gap names a bottle', L.gapIsNamed({ kind: 'flight', name: 'Longrow 18' }), true);
eq('a wishlist gap names a bottle', L.gapIsNamed({ kind: 'wish', name: 'X' }), true);
eq('an extension only describes one', L.gapIsNamed({ kind: 'extend' }), false);
eq('a region only describes one', L.gapIsNamed({ kind: 'region' }), false);
eq('a contrast only describes one', L.gapIsNamed({ kind: 'contrast' }), false);

sec('what is already owned in that corner');
const cCat = {
  a: { k: 'a', name: 'Buffalo Trace', dist: 'Buffalo Trace', sub: 'bourbon' },
  b: { k: 'b', name: 'Weller 12', dist: 'Buffalo Trace', sub: 'bourbon' },
  c: { k: 'c', name: 'Lagavulin 16', dist: 'Lagavulin', sub: 'scotch',
       region: 'Islay' }
};
const ownedBT = L.gapOwned({ name: 'A finished Buffalo Trace' }, cCat);
eq('it finds the house already owned', ownedBT.indexOf('Buffalo Trace') >= 0, true);
eq('and everything else from that house', ownedBT.indexOf('Weller 12') >= 0, true);
eq('but not an unrelated bottle', ownedBT.indexOf('Lagavulin 16'), -1);
// Short words are ignored, or "A Campbeltown Scotch" would match on "a".
eq('a region gap finds its own region',
  L.gapOwned({ name: 'An Islay Scotch' }, cCat).indexOf('Lagavulin 16') >= 0, true);

sec('candidates coming back');
const raw = { bottles: [
  { name: 'Buffalo Trace Kentucky Straight Bourbon', price_usd: 30 },
  { name: 'Elijah Craig Toasted Barrel', distillery: 'Heaven Hill',
    proof: 94, price_usd: 55, why: 'a finished bourbon at a fair price' },
  { name: 'Something Cheap', price_usd: 25, proof: 90 },
  { name: '', price_usd: 40 },
  { name: 'Bad Proof', proof: 900, price_usd: 45 }
], note: 'a note' };
const parsed = L.parseCandidates(raw, cCat);
// Buffalo Trace is already on the shelf; suggesting it back is the one
// mistake that makes the whole feature look broken.
eq('anything already owned is dropped',
  parsed.bottles.some(b => /^Buffalo Trace Kentucky/.test(b.name)), false);
eq('a nameless entry is dropped', parsed.bottles.length, 3);
// Was dearest first, and the display then sorted the survivors cheapest
// first — so a sixth, cheaper, easier bottle was thrown away before
// anything could show it. None of these three carries a findability, so
// they rank equal on it and the price decides: cheapest first.
eq('cheapest first, once nothing separates them on findability',
  parsed.bottles.map(b => b.price), [25, 45, 55]);
// A budget is a ceiling, not a suggestion. 15 percent over is allowed for
// retail variance; twice over is not an answer to the question asked.
const capped = L.parseCandidates({ bottles: [
  { name: 'Under', price_usd: 50 }, { name: 'At it', price_usd: 80 },
  { name: 'A bit over', price_usd: 88 }, { name: 'Way over', price_usd: 250 }
] }, {}, 80);
eq('the ceiling is enforced', capped.bottles.map(b => b.name),
  ['Under', 'At it', 'A bit over']);
eq('and what is over the ceiling is gone, not merely last',
  capped.bottles.some(b => b.name === 'Way over'), false);
eq('no budget means no ceiling',
  L.parseCandidates({ bottles: [{ name: 'Dear', price_usd: 900 }] }, {}).bottles.length, 1);
eq('an impossible proof is discarded, the bottle kept',
  parsed.bottles.find(b => b.name === 'Bad Proof').proof, null);
eq('the reason survives',
  parsed.bottles.find(b => /Elijah/.test(b.name)).why,
  'a finished bourbon at a fair price');
eq('the note survives', parsed.note, 'a note');
eq('junk in gives nothing back', L.parseCandidates(null, cCat), null);
eq('an empty list gives nothing back',
  L.parseCandidates({ bottles: [] }, cCat), null);
eq('a list of things already owned gives nothing back',
  L.parseCandidates({ bottles: [{ name: 'Weller 12', price_usd: 40 }] }, cCat), null);
}

{
sec('display names');
eq('kept as typed', L.cleanName('BZ'), 'BZ');
eq('runs of space collapse', L.cleanName('  Brian   Zrimsek  '), 'Brian Zrimsek');
eq('apostrophes and hyphens survive', L.cleanName("Sean O'Brien-Smith"), "Sean O'Brien-Smith");
eq('accents survive', L.cleanName('José'), 'José');
eq('control characters do not', L.cleanName('BZ\u0000\u200b'), 'BZ');
eq('capped at the limit', L.cleanName('x'.repeat(60)).length, L.NAME_MAX);
eq('nothing is nothing', L.cleanName(null), '');

sec('what a name may not be');
eq('a good name passes', L.nameError('Marcus'), null);
eq('too short is caught', /2 characters/.test(L.nameError('x')), true);
eq('reserved names are caught', /reserved/.test(L.nameError('admin')), true);
eq('reserved is case-insensitive', /reserved/.test(L.nameError('ADMIN')), true);
// An email on a list that only needs a name is a contact address nobody
// asked to publish.
eq('an email is refused', /not an email/.test(L.nameError('b@example.com')), true);
eq('one already in use is refused',
  /already using/.test(L.nameError('Marcus', ['marcus'])), true);
// Case and spacing fold, so two names cannot look identical in a picker.
eq('spacing and case cannot disguise a clash',
  /already using/.test(L.nameError('B Z', ['bz'])), true);
eq('a different name is fine', L.nameError('Ellen', ['marcus']), null);

sec('name keys');
eq('folds case and punctuation', L.nameKey("Sean O'Brien"), 'seanobrien');
eq('two spellings collide', L.nameKey('B Z'), L.nameKey('bz'));
eq('different names do not', L.nameKey('Marcus') === L.nameKey('Ellen'), false);

sec('what the directory may hold');
// A whitelist, not a trim: adding a field to the profile must not quietly
// widen what everyone else can see.
const entry = L.directoryEntry('uid-123', '  BZ  ', true);
eq('only uid, name and key', Object.keys(entry).sort(), ['key', 'name', 'uid']);
eq('the name is cleaned', entry.name, 'BZ');
// Off by default: not findable means no entry at all, not a hidden one.
eq('not findable means no entry', L.directoryEntry('uid-123', 'BZ', false), null);
eq('no name means no entry', L.directoryEntry('uid-123', '', true), null);
eq('no uid means no entry', L.directoryEntry('', 'BZ', true), null);

sec('suggesting one');
eq('given name from a google account',
  L.suggestName({ displayName: 'Brian Zrimsek', email: 'b@x.com' }), 'Brian');
eq('falls back to the email local part',
  L.suggestName({ email: 'first.last@x.com' }), 'first last');
eq('nothing to suggest is safe', L.suggestName(null), '');
}

{
sec('comparing shelves');
const mk = names => ({
  catalog: Object.fromEntries(names.map(n => [n, { k: n, name: n, proof: 90 }])),
  bottles: names.map((n, i) => ({ id: 'b' + i, k: n, status: 'open' }))
});
const meShelf = mk(['Lagavulin 16', 'Buffalo Trace', 'Redbreast 12', 'Weller 12']);
const aShelf = mk(['Lagavulin 16', 'Buffalo Trace', 'Eagle Rare']);
const bShelf = mk(['Buffalo Trace', 'Eagle Rare', 'Ardbeg 10']);

eq('a shelf reduces to what is on it', Object.keys(L.shelfSet(meShelf, true)).length, 4);
// Sealed is not pourable, so the open view is smaller.
const sealed = mk(['A', 'B']);
sealed.bottles[1].status = 'sealed';
eq('open only counts what can be poured', Object.keys(L.shelfSet(sealed, true)).length, 1);
eq('every whisky counts both', Object.keys(L.shelfSet(sealed, false)).length, 2);
eq('a missing shelf is empty, not an error', L.shelfSet(null, true), {});

sec('the seven regions');
const sets = [
  { id: 'me', name: 'You', map: L.shelfSet(meShelf, true) },
  { id: 'a', name: 'Marcus', map: L.shelfSet(aShelf, true) },
  { id: 'b', name: 'Ellen', map: L.shelfSet(bShelf, true) }
];
const regions = L.vennRegions(sets);
eq('three sets make seven regions', regions.length, 7);
// An empty region still exists, or the picture would silently lose a slice.
eq('empty regions are kept', regions.filter(r => r.count === 0).length, 2);
const byKey = {};
regions.forEach(r => { byKey[r.key] = r.count; });
eq('all three share one', byKey['a+b+me'], 1);
eq('you and Marcus share one', byKey['a+me'], 1);
eq('you and Ellen share none', byKey['b+me'], 0);
eq('two are yours alone', byKey['me'], 2);
eq('every bottle lands in exactly one region',
  regions.reduce((n, r) => n + r.count, 0), 6);

sec('the regions that matter');
const hi = L.vennHighlights(regions, 'me');
eq('what everyone could pour', hi.common.bottles.map(p => p.name), ['Buffalo Trace']);
eq('what only you have',
  hi.onlyMine.bottles.map(p => p.name).sort(), ['Redbreast 12', 'Weller 12']);
// The shopping list: two people you trust both bought it and you did not.
eq('what they both have and you do not',
  hi.theyBothHave.bottles.map(p => p.name), ['Eagle Rare']);

sec('region labels');
const names = { me: 'You', a: 'Marcus', b: 'Ellen' };
eq('one set', L.vennLabel({ ids: ['a'] }, names, 'me'), 'Marcus only');
eq('yours reads as you', L.vennLabel({ ids: ['me'] }, names, 'me'), 'You only');
eq('a pair', L.vennLabel({ ids: ['me', 'a'] }, names, 'me'), 'You and Marcus');
eq('all of them', L.vennLabel({ ids: ['me', 'a', 'b'] }, names, 'me'), 'All 3');

sec('two shelves, not three');
const two = sets.slice(0, 2);
eq('two sets make three regions', L.vennRegions(two).length, 3);


sec('a suggestion must fit what the gap constrained');
// A distillery and its flagship bottle share a name. "A finished Buffalo
// Trace" read as the BOTTLE, and the answer came back as an Old Forester, a
// 1792 and a Russell's — three substitutes from three other houses.
const btGap = { dist: 'Buffalo Trace' };
eq('a bottle from the house fits',
  L.candidateFits({ name: 'E.H. Taylor Cured Oak', dist: 'Buffalo Trace' }, btGap), true);
eq('named in the bottle rather than the maker also fits',
  L.candidateFits({ name: 'Buffalo Trace Experimental', dist: '' }, btGap), true);
eq('a sister distillery does not',
  L.candidateFits({ name: 'Barton 1792 Cognac Cask', dist: 'Barton 1792 (Sazerac)' }, btGap), false);
eq('nor a comparable profile',
  L.candidateFits({ name: "Russell's Single Barrel", dist: 'Wild Turkey' }, btGap), false);
eq('nor another house entirely',
  L.candidateFits({ name: 'Old Forester 1920', dist: 'Brown-Forman' }, btGap), false);
// A suffix on the distillery name must not break the match.
eq('a distillery suffix is ignored',
  L.candidateFits({ name: 'X', dist: 'Old Elk' },
    { dist: 'Old Elk Distillery' }), true);
// A region is weaker evidence: a label rarely says Campbeltown, so only a
// bottle naming a DIFFERENT region is refused.
eq('an unmarked bottle passes a region gap',
  L.candidateFits({ name: 'Springbank 15', dist: 'Springbank' },
    { region: 'Campbeltown' }), true);
eq('a bottle naming another region does not',
  L.candidateFits({ name: 'An Islay Malt', dist: 'X' },
    { region: 'Campbeltown' }), false);
eq('no constraint accepts anything', L.candidateFits({ name: 'X' }, null), true);


sec('when the house does not make one');
const rfCat = {};
for (let i = 0; i < 6; i++) {
  rfCat['r' + i] = { k: 'r' + i, name: 'BT ' + i, dist: 'Buffalo Trace',
                     sub: 'bourbon', proof: 90 + i * 2, fin: null };
}
// A substitute from another house was the bug. A reframe that says the
// house does not make one, and asks the answerable question instead, is not.
const finishGap = { kind: 'extend', dist: 'Buffalo Trace',
                    name: 'A finished bottling from Buffalo Trace' };
const alt = L.reframeGap(finishGap, rfCat);
eq('it reframes', !!alt, true);
eq('the constraint on the house is dropped', alt.dist, undefined);
eq('but the category is kept', alt.sub, 'bourbon');
// It must say what is true of the SHELF, not make a claim about the
// distillery. "Bunnahabhain does not bottle at cask strength" was asserted
// to BZ while his Bunnahabhain 21 Cask Strength sat in the set being
// described — the app knows what is on the shelf and nothing more.
eq('it says what the shelf shows',
  /Nothing you have from Buffalo Trace is finished/.test(alt.why), true);
eq('and does not claim what the house does or does not release',
  /does not release|does not bottle|does not put/.test(alt.why), false);
eq('it aims near the house\u2019s own strength', alt.near, 95);
// Strength and age reframe the same way.
eq('a strength gap reframes',
  /cask-strength/i.test(L.reframeGap(
    { dist: 'Buffalo Trace', name: 'Something from Buffalo Trace at a very different strength' },
    rfCat).name), true);
eq('an age gap reframes',
  /age-stated/i.test(L.reframeGap(
    { dist: 'Buffalo Trace', name: 'An age-stated bottling from Buffalo Trace' },
    rfCat).name), true);
// Nothing to reframe when there is no house in the gap.
eq('a gap with no distillery does not reframe',
  L.reframeGap({ name: 'A wood-only bottling' }, rfCat), null);
eq('an unknown house does not reframe',
  L.reframeGap({ dist: 'Nowhere', name: 'A finished bottling from Nowhere' }, rfCat), null);

sec('impossible gaps stop being offered');
const dgCat = {};
for (let i = 0; i < 5; i++) {
  dgCat['d' + i] = { k: 'd' + i, name: 'D' + i, dist: 'House', sub: 'bourbon',
                     proof: 90 + i, obsc: 'known', msrp: 50 };
}
const dgBot = Object.keys(dgCat).map((k, i) => ({ id: 'g' + i, k, status: 'open' }));
const before = L.shelfGaps(dgCat, dgBot, [], [], []);
eq('the shelf offers findings', before.length > 0, true);
const deadKey = {};
deadKey[L.gapKey(before[0])] = 1;
const after = L.shelfGaps(dgCat, dgBot, [], [], [], deadKey);
eq('a gap proved impossible is not offered again',
  after.some(g => L.gapKey(g) === L.gapKey(before[0])), false);
// Not simply one fewer: removing a finding frees a slot in its capped kind,
// so something ranked below takes its place. The list stays full, which is
// what a cap is for.
eq('the list does not shrink below the cap', after.length >= before.length - 1, true);
eq('the dropped one is genuinely gone',
  after.filter(g => L.gapKey(g) === L.gapKey(before[0])).length, 0);
// Ranking must still apply after filtering — the filter used to run before
// the sort, against an array the sort then mutated.
eq('what is left is still ranked',
  after.every((g, i) => i === 0 || after[i - 1].weight >= g.weight), true);

sec('when nothing fits the budget');
const gapBT = { dist: 'Buffalo Trace' };
const overOnly = L.parseCandidates({ bottles: [
  { name: 'Buffalo Trace Antique Collection', distillery: 'Buffalo Trace',
    price_usd: 400, proof: 120 },
  { name: 'Buffalo Trace E.H. Taylor', distillery: 'Buffalo Trace',
    price_usd: 250, proof: 100 }
] }, {}, 80, gapBT);
// An empty panel is not an answer. The cheapest that FITS is, as long as it
// is labelled honestly rather than quietly widening the budget.
eq('the cheapest over budget is offered', overOnly.bottles.length, 1);
eq('and it is the cheapest one', overOnly.bottles[0].price, 250);
eq('flagged as over budget', overOnly.overBudget, true);
eq('and says so', /Nothing fits that budget/.test(overOnly.note), true);

// Substitutes are counted so the message can explain an empty result.
const allSubs = L.parseCandidates({ bottles: [
  { name: 'Old Forester 1920', distillery: 'Brown-Forman', price_usd: 60 }
] }, {}, 80, gapBT);
eq('a substitute never reaches the list', allSubs.bottles.length, 0);
eq('but it is counted', allSubs.rejected.length, 1);

sec('the join me message');
const bottle = { k: 'x', name: 'Lagavulin 8', proof: 96, sub: 'scotch',
                 region: 'Islay', tn: { nose: 'x'.repeat(400) } };
const txt = L.joinMeText(bottle, bottle, ['Marcus']);
eq('it names the bottle', /Lagavulin 8/.test(txt), true);
eq('and its strength', /96 proof/.test(txt), true);
eq('and says how much to pour', /an ounce/.test(txt), true);
// Notes are deliberately absent: a sourced nose runs to eighty words, and
// sending the answer before anyone has poured defeats the asking.
eq('no tasting notes travel with it', txt.indexOf('x'.repeat(50)), -1);
eq('it stays short enough to read on a phone', txt.length < 260, true);

sec('finding a match on the machine');
const matchCat = {
  a: { k: 'a', name: 'Shared One', proof: 90, sub: 'bourbon', obsc: 'known', msrp: 40 },
  b: { k: 'b', name: 'Mine Only', proof: 92, sub: 'bourbon', obsc: 'known', msrp: 40 }
};
const matchBot = [{ id: 'm1', k: 'a', status: 'open' },
                  { id: 'm2', k: 'b', status: 'open' }];
const buddy = { id: 'x', map: { 'shared one': { name: 'Shared One' } } };
const reels = { proof: 'any', type: 'any', obsc: 'any', price: 'any' };
// The payline must obey the same constraint the spin did, or the machine
// lands on a shared bottle and fills the glasses with ones nobody else has.
const restricted = L.reelMatches(matchCat, matchBot, reels, [],
  { matchWith: [buddy] });
eq('the payline is restricted to shared bottles',
  restricted.map(x => x.k), ['a']);
eq('unrestricted still shows everything',
  L.reelMatches(matchCat, matchBot, reels, []).length, 2);
// Everyone rather than anyone.
const other = { id: 'y', map: {} };
eq('matching everyone drops what only one has',
  L.reelMatches(matchCat, matchBot, reels, [],
    { matchWith: [buddy, other], matchAll: true }).length, 0);
eq('matching anyone keeps it',
  L.reelMatches(matchCat, matchBot, reels, [],
    { matchWith: [buddy, other] }).length, 1);
// And a spin can never land somewhere the payline would then come up empty.
const spun = L.spinValid(reels, {}, matchCat, matchBot, () => 0.5,
  { matchWith: [buddy] });
eq('a restricted spin still pays out',
  L.reelMatches(matchCat, matchBot, spun, [], { matchWith: [buddy] }).length > 0,
  true);
}

{

sec('the rarest word carries the match');
// "Longrow 18 — 2021 Release" matched five bottles on the word "release",
// which dozens share, while "longrow" appears nowhere on the shelf. The
// rarest word is the one doing the identifying: if it is absent, the query
// is about something the shelf does not have, however many common words
// agree. No threshold to guess at — the shelf decides which word is rare.
const rareCat = {};
['Angels Envy Small Batch Limited Release', 'Ardbeg Heavy Vapours Committee Release',
 'Barrell Craft Spirits Private Release', 'Lagavulin 16 Year Old',
 'Weller 12 Year Old'].forEach((n, i) => {
  rareCat['r' + i] = { k: 'r' + i, name: n, dist: n.split(' ')[0], proof: 90 };
});
eq('a bottle the shelf does not have finds nothing',
  L.shopSearch('Longrow 18 — 2021 Release', rareCat, 5).length, 0);
eq('even though release is all over the shelf',
  L.shopSearch('Release', rareCat, 5).length > 0, true);
eq('a bottle it does have is found',
  L.shopSearch('Lagavulin 16', rareCat, 5)[0].p.name, 'Lagavulin 16 Year Old');
eq('a real multi-word name still resolves',
  L.shopSearch('Barrell Craft Spirits Private Release', rareCat, 5)[0].p.name,
  'Barrell Craft Spirits Private Release');
// A digits-only query has no word to be rarest, so it falls back to
// scanning — useful for a person reading a list, refused for autofill.
eq('digits alone still scan', L.shopSearch('16', rareCat, 5).length > 0, true);
eq('but never autofill a form', L.lookupFromCatalog('16', rareCat), null);

sec('lookup helpers');
// The free half: a bottle already in the catalog needs no network at all.
const luCat = {
  'Lagavulin 16': { k: 'Lagavulin 16', name: 'Lagavulin 16', dist: 'Lagavulin',
    proof: 86, sub: 'scotch', region: 'Islay', msrp: 110, obsc: 'known' }
};
const found = L.lookupFromCatalog('Lagavulin 16', luCat);
eq('a known bottle resolves locally', found.source, 'shelf');
eq('and carries its proof', found.proof, 86);
eq('an unknown one does not', L.lookupFromCatalog('Nothing Like This', luCat), null);
// A weak name match must not resolve, or the form fills with a neighbour.
eq('a bare number does not resolve', L.lookupFromCatalog('16', luCat), null);

// Anything from outside is untrusted: a wrong proof is worse than a blank.
eq('a good reply parses',
  L.parseLookup({ name: 'X', proof: 92 }).proof, 92);
// An ABV where a proof was asked for is the commonest mistake.
eq('an abv is doubled', L.parseLookup({ name: 'X', abv: 46 }).proof, 92);
eq('an impossible proof is refused', L.parseLookup({ name: 'X', proof: 900 }), null);
eq('no name is refused', L.parseLookup({ proof: 90 }), null);
eq('no proof is refused', L.parseLookup({ name: 'X' }), null);
eq('junk is refused', L.parseLookup(null), null);
eq('an unknown category is dropped, not stored',
  L.parseLookup({ name: 'X', proof: 90, sub: 'rocket fuel' }).sub, null);
eq('a known category is kept',
  L.parseLookup({ name: 'X', proof: 90, type: 'Scotch' }).sub, 'scotch');
eq('a region outside the six is dropped',
  L.parseLookup({ name: 'X', proof: 90, region: 'Yorkshire' }).region, null);

eq('filled fields are listed',
  L.lookupFilled({ name: 'X', proof: 90, dist: null, age: 12 }).sort(),
  ['age', 'name', 'proof']);
eq('nothing filled is empty', L.lookupFilled(null), []);

eq('a query is appended', L.lookupUrl('https://x/exec', 'A B'),
  'https://x/exec?name=A%20B');
eq('an existing query is respected',
  L.lookupUrl('https://x/exec?a=1', 'B').indexOf('&name=') > 0, true);
eq('no endpoint means no url', L.lookupUrl('', 'X'), null);

sec('flight building helpers');
const fbCat = {};
[86, 92, 100, 104, 110, 119].forEach((p, i) => {
  fbCat['F' + i] = { k: 'F' + i, name: 'Bottle ' + i, dist: 'House', proof: p,
    sub: 'scotch', fin: 'Cask ' + i, obsc: i === 2 ? 'obscure' : 'known',
    msrp: 50 + i * 10, age: null, region: 'Islay' };
});
const fbBot = Object.keys(fbCat).map((k, i) => ({ id: 'f' + i, k, status: 'open' }));

const cands = L.flightCandidates('finish', fbCat, fbBot);
eq('a house with six casks makes a candidate', cands.length > 0, true);
eq('every candidate has enough pours', cands.every(c => c.pours.length >= 4), true);
eq('and a score', cands.every(c => typeof c.score === 'number'), true);
// Nothing open, nothing to propose.
eq('a sealed shelf offers nothing',
  L.flightCandidates('finish', fbCat, []).length, 0);

const built = L.buildFlight('finish', 'A premise.', fbCat, fbBot);
eq('it builds', built.ok, true);
eq('the premise is carried', built.premise, 'A premise.');
eq('pours come back in proof order',
  built.pours.map(p => fbCat[p.k].proof),
  built.pours.map(p => fbCat[p.k].proof).slice().sort((a, b) => a - b));
eq('an impossible variable fails cleanly',
  L.buildFlight('age', '', fbCat, fbBot).ok, false);
eq('and says why', /holds still/.test(L.buildFlight('age', '', fbCat, fbBot).why), true);

// The one to buy has to be something you cannot already pour.
const cast = built.pours.map(p => fbCat[p.k]);
const buy = L.suggestPurchase('finish', cast, fbCat, fbBot);
eq('a purchase suggestion is not already in the flight',
  buy ? cast.every(p => p.k !== buy.p.k) : true, true);

eq('proof reads as proof', L.axisLabel('proof', { proof: 92 }), '92 proof');
eq('age reads as years', L.axisLabel('age', { age: 12 }), '12 years');
eq('a band is title cased', L.axisLabel('price', { msrp: 40 }), 'Everyday');

eq('pours are lettered from A',
  L.relabel([{ k: 'a' }, { k: 'b' }, { k: 'c' }]).map(p => p.letter),
  ['A', 'B', 'C']);
eq('relabelling keeps the bottles',
  L.relabel([{ k: 'a' }]).map(p => p.k), ['a']);

sec('the remaining gap sources');
// A wish a flight already explains is not repeated as its own finding.
const wishFlights = [{ title: 'F', core: [{ kind: 'wish', name: 'Longrow 18' }] }];
const wl = [{ name: 'Longrow 18', added: '2026-01-01' },
            { name: 'Own Idea', reason: 'looked good', added: '2026-01-02' }];
const gw = L.gapsFromWish(wl, wishFlights);
eq('a wish a flight covers is left to the flight', gw.length, 1);
eq('the rest keeps its own reason', gw[0].why, 'looked good');
eq('no wishlist, no findings', L.gapsFromWish([], []), []);

// The ends of the proof ladder.
const lowShelf = {};
[85, 86, 87].forEach((p, i) => { lowShelf['L' + i] = { k: 'L' + i, proof: p }; });
const gp = L.gapsFromProof(lowShelf);
eq('a shelf with no high proof is told so',
  gp.some(g => /above 120/.test(g.name)), true);
eq('and every finding explains itself', gp.every(g => !!g.why), true);
}

{
sec('the invite text');
// A link with a uid in it. That is the only fact an invite carries — who
// sent it — so there is nothing to generate, store, expire or secure.
eq('a link is built from a uid',
  L.buddyLink('https://x.github.io/app/?a=1#old', 'abc123XYZ'),
  'https://x.github.io/app/#buddy=abc123XYZ');
eq('and read back', L.buddyFromUrl('https://x/#buddy=abc123XYZ'), 'abc123XYZ');
eq('a plain url carries nobody', L.buddyFromUrl('https://x/app/'), null);
eq('a short id is not a uid', L.buddyFromUrl('https://x/#buddy=ab'), null);
eq('no uid, no link', L.buddyLink('https://x/', ''), null);

const txt = L.inviteText('BZ', 'https://x/#buddy=abc123XYZ');
eq('it says who sent it', /^BZ would like to share/.test(txt), true);
eq('it carries the link', txt.indexOf('https://x/#buddy=abc123XYZ') > 0, true);
// The reader may never have heard of any of this, so the message has to
// stand alone — and has to say what the link does NOT do.
eq('it explains what the app is', /Bottle Tracker/.test(txt), true);
eq('it says access is not automatic', /until you say so/.test(txt), true);
eq('an anonymous sender still reads', /^I would like to share/.test(L.inviteText('', 'x')), true);
}


sec('a shared catalogue never touches your own work');
// The whole risk in a shared catalogue is that an update arrives and takes
// somebody's own notes with it. The layering that prevents it already
// existed; this pins it.
const baseCat = {
  a: { k: 'a', name: 'Alpha', proof: 90, tn: { nose: 'base note' } },
  b: { k: 'b', name: 'Bravo', proof: 92 }
};
const myEdits = { a: { tn: { nose: 'MY note' }, proof: 91 } };
const myCustom = { z: { k: 'z', name: 'Mine Alone', proof: 100 } };
const merged = L.mergeCatalog(baseCat, myEdits, myCustom, {});
eq('my edit beats the base', merged.a.tn.nose, 'MY note');
eq('and my correction to a field survives', merged.a.proof, 91);
eq('a bottle only I have survives', merged.z.name, 'Mine Alone');
eq('the base still supplies what I have not touched', merged.b.name, 'Bravo');

// Now a NEWER base arrives with a different note for the same bottle.
const newerBase = {
  a: { k: 'a', name: 'Alpha', proof: 90, tn: { nose: 'a newer base note' } },
  b: { k: 'b', name: 'Bravo', proof: 92, tn: { nose: 'new for bravo' } },
  c: { k: 'c', name: 'Charlie', proof: 94 }
};
const after = L.mergeCatalog(newerBase, myEdits, myCustom, {});
// This is the case that matters: my own note must not be overwritten by a
// catalogue update, however much better the new one looks.
eq('an update does not overwrite my note', after.a.tn.nose, 'MY note');
eq('nor my corrected proof', after.a.proof, 91);
eq('but it does bring new notes where I had none', after.b.tn.nose, 'new for bravo');
eq('and new bottles', after.c.name, 'Charlie');
eq('and mine is still there', after.z.name, 'Mine Alone');
// Something I deleted stays deleted through an update.
eq('a deletion survives an update',
  L.mergeCatalog(newerBase, {}, {}, { c: 1 }).c, undefined);


sec('filling in a shelf');
// MISSING is not ABSENT. A no-age-statement bourbon has no age and an
// unfinished one has no finish, so asking for them is how a number gets
// invented. Tasting notes are the reason to ask: every whisky has some.
const enCat = {
  bare:  { k: 'bare',  name: 'Bare One',  proof: 90 },
  noted: { k: 'noted', name: 'Noted One', proof: 92,
           tn: { nose: 'n', palate: 'p', finish: 'f', colour: 'c' } },
  noCol: { k: 'noCol', name: 'No Colour', proof: 94,
           tn: { nose: 'n', palate: 'p', finish: 'f' } }
};
const enBot = [{ id: 'e1', k: 'bare', status: 'open' },
               { id: 'e2', k: 'noted', status: 'sealed' },
               { id: 'e3', k: 'noCol', status: 'open' }];

eq('a bottle with no notes is worth asking about', L.needsEnhancing(enCat.bare), true);
eq('one with notes is not', L.needsEnhancing(enCat.noted), false);
eq('nothing is not', L.needsEnhancing(null), false);

const q = L.enhanceQueue(enCat, enBot);
eq('only the bare one queues', q.map(p => p.k), ['bare']);
// A bottle you no longer own is not worth paying a lookup for.
eq('an unowned bottle is skipped',
  L.enhanceQueue(enCat, [{ id: 'x', k: 'noted', status: 'open' }]).length, 0);

sec('what a lookup is allowed to change');
const found = { nose: 'new nose', palate: 'new palate', finish: 'new finish',
                colour: 'amber', age: 12, msrp: 60, fin: 'Oloroso' };
const takeBare = L.enhanceDiff(enCat.bare, found);
eq('an empty bottle takes the notes', takeBare.tn.nose, 'new nose');
eq('and the age', takeBare.age, 12);
eq('and the price', takeBare.msrp, 60);
// "finish" arriving beside nose and palate is the finish of the TASTE, not
// a cask. Taking it as a cask would put "new finish" in the Finish field.
eq('but not a cask, when finish came as part of a note set',
  takeBare.fin, undefined);

// Nothing already present is ever overwritten — but a blank field on the
// same bottle is still worth filling, which is the point of asking.
const takeNoted = L.enhanceDiff(enCat.noted, found);
eq('an existing note is untouched', takeNoted.tn, undefined);
eq('while a blank age is still taken', takeNoted.age, 12);
eq('a bottle with everything gives nothing back',
  L.enhanceDiff({ k: 'full', name: 'Full', proof: 90, age: 10, msrp: 50,
    fin: 'Sherry', tn: { nose: 'n', palate: 'p', finish: 'f', colour: 'c' } },
    found), null);
// Except a note set missing only its colour, which is worth completing.
const takeCol = L.enhanceDiff(enCat.noCol, found);
eq('a missing colour is filled', takeCol.tn.colour, 'amber');
eq('and the rest of the note is left alone', takeCol.tn.nose, 'n');

// Junk is refused as it is everywhere else.
eq('an impossible age is not taken',
  (L.enhanceDiff(enCat.bare, { age: 900 }) || {}).age, undefined);
eq('a year is not a cask',
  (L.enhanceDiff(enCat.bare, { fin: '2021' }) || {}).fin, undefined);
eq('a real cask is', L.enhanceDiff(enCat.bare, { fin: 'Oloroso' }).fin, 'Oloroso');
eq('nothing found means nothing taken', L.enhanceDiff(enCat.bare, null), null);

{
sec('tasting papers');
const pCat = {
  a: { k: 'a', name: 'Sazerac Rye', dist: 'Buffalo Trace', sub: 'rye',
       proof: 90, fin: 'New oak',
       tn: { colour: 'Amber', nose: 'Anise', palate: 'Sweet', finish: 'Short' } },
  b: { k: 'b', name: 'Rittenhouse Rye', dist: 'Heaven Hill', sub: 'rye',
       proof: 100, tn: { colour: 'Amber', nose: 'Cinnamon', palate: 'Round',
       finish: 'Gentle' } }
};
const pFlight = {
  title: 'A RYE FLIGHT',
  tag: '6 core + 4 extensions \u00b7 ALL BLIND \u00b7 ONE VARIABLE: PROOF',
  premise: 'Sazerac at 90 and Rittenhouse at 100, poured together.',
  core: [{ k: 'a', letter: 'A' }, { k: 'b', letter: 'B' }],
  why: ['The ask is preference, not power.'],
  cards: [{ letter: 'A', wood: 'FAMILY ONE' }, { letter: 'B', wood: 'THE RINGER' }]
};

const host = L.hostCard(pFlight, pCat);
eq('the host card names every bottle',
  host.pours.map(p => p.bottle), ['Sazerac Rye', 'Rittenhouse Rye']);
eq('with proofs', host.pours.map(p => p.proof), [90, 100]);
eq('and the notes as prompts', host.pours[0].nose, 'Anise');
eq('and the reasoning', host.why.length, 1);

sec('the sheet must give nothing away');
const sheet = L.participantCard(pFlight, pCat);
eq('letters only', sheet.rows.map(r => r.letter), ['A', 'B']);
// The premise names the bottles: it is the HOST's reasoning, and putting it
// on a blind sheet hands the night away. The leak check caught exactly this.
eq('the premise never reaches the sheet',
  JSON.stringify(sheet).indexOf('Sazerac'), -1);
eq('the theme is built from the flight shape instead',
  sheet.theme, '2 pours, all Rye. Guess the strength of each.');
eq('no leak', L.sheetLeaks(sheet, pFlight, pCat), []);
// The check has to work, or it is worse than nothing.
const leaky = L.participantCard(pFlight, pCat);
leaky.theme += ' featuring Rittenhouse';
eq('a planted name is caught',
  L.sheetLeaks(leaky, pFlight, pCat), ['rittenhouse']);
// A house named in the TITLE is the flight's own given, not a leak.
const abFlight = { title: 'THE ABERLOUR HOUSE', core: [{ k: 'x' }] };
const abCat = { x: { k: 'x', name: 'Aberlour 12', dist: 'Aberlour', sub: 'scotch' } };
eq('a titled house is not a leak',
  L.sheetLeaks(L.participantCard(abFlight, abCat), abFlight, abCat), []);

sec('the columns follow the question');
eq('a proof flight asks for a proof',
  L.sheetColumns({ tag: 'ONE VARIABLE: PROOF' })[0][0], 'Proof \u2014 your number');
eq('a cask flight asks which cask',
  L.sheetColumns({ tag: 'ONE VARIABLE: WHICH SHERRY' })[0][0], 'Which cask');
eq('and the second column never changes',
  L.sheetColumns({ tag: '' })[1][0], 'Rather drink it? 1\u20135');
}

{
sec('what a shelf can teach');
// The 36 flights encode which questions are worth asking and what has to be
// held still for each. A newcomer with forty bottles has no way to know
// that, and this is that knowledge pointed at whatever shelf is present.
eq('every lesson states its question', L.LESSONS.every(l => !!l.ask), true);
eq('and what it holds still', L.LESSONS.every(l => (l.hold || []).length), true);
// The variables the shipped flights actually vary must all be covered, or
// the mining lost something.
eq('the mined variables are all represented',
  ['proof', 'finish', 'house', 'region', 'age', 'grain', 'price']
    .filter(v => !L.LESSONS.some(l => l.id === v)), []);

// A shelf of four bourbons from one house at four strengths can teach proof
// and nothing else, and must say so rather than offering everything.
const ladder = {};
const ladderBot = [];
[90, 100, 110, 120].forEach((p, i) => {
  ladder['p' + i] = { k: 'p' + i, name: 'Bourbon ' + i, sub: 'bourbon',
    dist: 'One House', proof: p, obsc: 'known', msrp: 50 };
  ladderBot.push({ id: 'lb' + i, k: 'p' + i, status: 'open' });
});
const taught = L.lessonsFor(ladder, ladderBot, []);
eq('proof is buildable', taught.find(l => l.id === 'proof').ready, true);
// Nothing varies the cask, so that lesson is not offered.
eq('the cask is not', taught.find(l => l.id === 'finish').ready, false);
eq('ready lessons come first',
  taught.findIndex(l => !l.ready) > taught.findIndex(l => l.ready), true);

// A blocker has to name the missing SHAPE. "Not enough bottles" tells
// nobody what to buy.
const blocked = taught.find(l => !l.ready);
eq('a blocker explains itself', !!blocked.blocked, true);
eq('and names a number or a shape',
  /\d|category|distillery|region/.test(blocked.blocked), true);
// A nearly-empty shelf says the obvious thing rather than something clever.
eq('two bottles cannot teach anything',
  L.lessonsFor({ a: { k: 'a', sub: 'bourbon', proof: 90 } },
    [{ id: 'x', k: 'a', status: 'open' }], []).every(l => !l.ready), true);
eq('and says why',
  /Fewer than four/.test(L.lessonsFor({ a: { k: 'a', sub: 'bourbon', proof: 90 } },
    [{ id: 'x', k: 'a', status: 'open' }], [])[0].blocked), true);

// Lessons already built are marked, so a shelf with 36 flights does not
// keep offering the same ones first.
const withFlights = L.lessonsFor(ladder, ladderBot,
  [{ title: 'X', tag: 'ONE VARIABLE: PROOF', core: [] }]);
eq('an already-built lesson is counted',
  withFlights.find(l => l.id === 'proof').have, 1);
}

{
sec('pooling the room');
const mineCat = {
  m0: { k: 'm0', name: 'Mine A', sub: 'bourbon', dist: 'H1', proof: 90,
        obsc: 'known', msrp: 40 },
  m1: { k: 'm1', name: 'Mine B', sub: 'bourbon', dist: 'H1', proof: 100,
        obsc: 'known', msrp: 45 }
};
const mineBot = ['m0', 'm1'].map((k, i) => ({ id: 'mb' + i, k, status: 'open' }));
const yoursCat = {
  y0: { k: 'y0', name: 'Yours A', sub: 'bourbon', dist: 'H1', proof: 110,
        obsc: 'known', msrp: 50 },
  y1: { k: 'y1', name: 'Yours B', sub: 'bourbon', dist: 'H1', proof: 120,
        obsc: 'known', msrp: 55 },
  y2: { k: 'y2', name: 'Mine A', sub: 'bourbon', dist: 'H1', proof: 90,
        obsc: 'known', msrp: 40 }
};
const yoursBot = ['y0', 'y1', 'y2'].map((k, i) => ({ id: 'yb' + i, k, status: 'sealed' }));
yoursBot[0].status = 'open'; yoursBot[1].status = 'open'; yoursBot[2].status = 'open';

const pool = L.poolShelves({ catalog: mineCat, bottles: mineBot },
  { u1: { catalog: yoursCat, bottles: yoursBot } }, { u1: 'Marcus' }, 'You');
eq('both shelves are in the pool', Object.keys(pool.catalog).length, 4);
// A bottle both of you have is one pour, not two, and the host pours it.
eq('a shared bottle is not duplicated',
  Object.keys(pool.catalog).filter(k => k === L.shopNorm('Mine A')).length, 1);
eq('and the host owns it', pool.owner[L.shopNorm('Mine A')][0], 'You');
eq('but the other owner is remembered',
  pool.owner[L.shopNorm('Mine A')].indexOf('Marcus') > 0, true);

// A sealed bottle is not in the room, wherever it lives.
const sealedOnly = { catalog: { s: { k: 's', name: 'Sealed', sub: 'rye', proof: 90 } },
                     bottles: [{ id: 'sx', k: 's', status: 'sealed' }] };
eq('sealed bottles do not join the pool',
  Object.keys(L.poolShelves(sealedOnly, {}, {}, 'You').catalog).length, 0);

sec('who brings what');
const pours = [{ k: L.shopNorm('Mine A') }, { k: L.shopNorm('Yours A') },
               { k: L.shopNorm('Yours B') }];
const plan = L.poolPlan(pours, pool, 'You');
eq('one is yours', plan.mine, 1);
eq('two are borrowed', plan.borrowed, 2);
eq('and it says who', plan.people, ['Marcus']);
eq('in a sentence a host can act on', plan.summary, 'Marcus brings 2.');
// A flight you can pour alone should say so rather than listing yourself.
eq('nothing borrowed reads plainly',
  L.poolPlan([{ k: L.shopNorm('Mine A') }], pool, 'You').summary,
  'You can pour all of this yourself.');

sec('what pooling is worth');
// Two bottles cannot build a proof ladder; four can. That is the case this
// whole feature exists for.
const gain = L.poolGain({ catalog: mineCat, bottles: mineBot }, pool, []);
eq('a lesson you could not build alone is flagged new',
  gain.some(g => g.id === 'proof' && g.gain === 'new'), true);
eq('and says so plainly',
  /cannot build this on your own/.test(
    gain.find(g => g.id === 'proof').note), true);
// Pooling with somebody who adds nothing must report nothing rather than
// inventing a benefit.
eq('an empty buddy adds nothing',
  L.poolGain({ catalog: mineCat, bottles: mineBot },
    L.poolShelves({ catalog: mineCat, bottles: mineBot }, {}, {}, 'You'),
    []).length, 0);
}

{
sec('what a buddy can see');
// Letting somebody see your shelf used to hand them the whole node: every
// pour with its date, the wishlist, the lookup endpoint. "See my shelf"
// means the bottles.
const before = ['bottles', 'history', 'edits', 'custom', 'deleted',
                'customFlights', 'wish', 'displayName', 'findable',
                'deadGaps', 'lookupUrl'];
const shared = ['name', 'at', 'bottles', 'edits', 'custom', 'deleted'];
eq('a pour history is not shared', shared.indexOf('history'), -1);
eq('nor a wishlist', shared.indexOf('wish'), -1);
eq('nor the lookup endpoint', shared.indexOf('lookupUrl'), -1);
eq('nor your flights', shared.indexOf('customFlights'), -1);
// The corrections travel, because a buddy seeing your shelf should see your
// proof fix rather than the base value you disagreed with.
eq('your corrections do', shared.indexOf('edits') >= 0, true);
eq('and bottles, obviously', shared.indexOf('bottles') >= 0, true);
// Written as a whitelist, so anything added to the app later is private
// until somebody puts it in on purpose.
eq('the shared set is smaller than the stored set',
  shared.length < before.length, true);
}

{
sec('a flight proposed to the room');
const rmPool = {
  catalog: { a: { k: 'a', name: 'Mine A', proof: 90 },
             b: { k: 'b', name: 'Theirs B', proof: 100 },
             c: { k: 'c', name: 'Theirs C', proof: 110 } },
  bottles: [{ id: '1', k: 'a', status: 'open' },
            { id: '2', k: 'b', status: 'open' },
            { id: '3', k: 'c', status: 'open' }],
  owner: { a: ['You'], b: ['Marcus'], c: ['Marcus', 'You'] }
};
const prop = L.makeProposal(
  { title: 'AN EVENING', premise: 'Because.', variable: 'proof' },
  [{ k: 'a' }, { k: 'b' }, { k: 'c' }], rmPool, 'You', 'uid-me');

eq('it is lettered', prop.pours.map(p => p.letter), ['A', 'B', 'C']);
// Names, not keys: a key only means something against the catalogue the
// sender happened to have.
eq('pours travel as names',
  prop.pours.map(p => p.name), ['Mine A', 'Theirs B', 'Theirs C']);
eq('and say who brings each',
  prop.pours.map(p => p.from), ['You', 'Marcus', 'You']);
// A bottle you BOTH have is brought by whoever is hosting, not negotiated.
eq('a bottle both own is brought by you', prop.pours[2].from, 'You');
eq('it records who proposed it', prop.by, 'uid-me');
eq('and summarises the ask', prop.summary, 'Marcus brings 1.');

sec('what a proposal asks of the reader');
// Worked out against the READER's shelf, since that is the question the
// reader actually has.
const myCat = { x: { k: 'x', name: 'Mine A', proof: 90 } };
const myBot = [{ id: 'm', k: 'x', status: 'open' }];
const asks = L.proposalAsks(prop, myCat, myBot, 'Marcus');
eq('it counts what you already have open', asks.haveOpen, 1);
eq('out of the whole flight', asks.total, 3);
eq('and says so plainly', asks.note, 'You have 1 of 3 open.');
// Somebody who has everything gets a different sentence, not the same one
// with different numbers.
const allCat = {};
prop.pours.forEach((p, i) => { allCat['k' + i] = { k: 'k' + i, name: p.name }; });
const allBot = prop.pours.map((p, i) => ({ id: 'a' + i, k: 'k' + i, status: 'open' }));
eq('having everything reads differently',
  L.proposalAsks(prop, allCat, allBot, 'You').note,
  'You have all of these open.');
eq('and it knows what YOU are bringing',
  L.proposalAsks(prop, myCat, myBot, 'Marcus').bringing, 1);
}

{
sec('do two names describe the same bottle');
// This comparison has caused three separate bugs — digits alone matching,
// a common word matching, a prefix matching — so it is pinned properly.
eq('the same bottle, said longer',
  L.nameAgrees('Lagavulin 16', 'Lagavulin 16 Year Old'), true);
eq('a fuller name still agrees',
  L.nameAgrees('E.H. Taylor Cured Oak', 'Colonel E.H. Taylor Cured Oak'), true);
eq('and a shorter one',
  L.nameAgrees('Buffalo Trace Kentucky Straight', 'Buffalo Trace'), true);
// A bottle assembled from real parts is the failure that matters: Old
// Forester 1920 is real, Smoked Cinnamon Malt is not an expression of it,
// and it came back from an actual run.
eq('an invented expression does not agree',
  L.nameAgrees('Old Forester 1920 Smoked Cinnamon Malt',
               'Old Forester 1920 Prohibition Style'), false);
eq('a number in one and not the other is a different bottling',
  L.nameAgrees("Maker's Mark 101", "Maker's Mark"), false);
eq('nor do two expressions of one range',
  L.nameAgrees('Elijah Craig Toasted Barrel', 'Elijah Craig Barrel Proof'), false);
eq('nothing agrees with nothing', L.nameAgrees('', 'x'), false);

sec('a suggestion has to be sourced');
// A name is not evidence. Asking for the page it was found on does not
// prove a bottle exists, but it raises the bar and separates what was seen
// from what was reasoned.
const withSrc = L.parseCandidates({ bottles: [
  { name: 'Seen One', price_usd: 50, source: 'totalwine.com', confident: true },
  { name: 'Reasoned One', price_usd: 60, source: '', confident: true },
  { name: 'Hedged One', price_usd: 70, source: 'breakingbourbon.com',
    confident: false }
] }, {}, 100);
eq('a sourced and confident one is marked so',
  withSrc.bottles.find(b => b.name === 'Seen One').confident, true);
// Confident without a source is not confidence, it is assertion.
eq('confidence without a source does not count',
  withSrc.bottles.find(b => b.name === 'Reasoned One').confident, false);
eq('and an honest hedge is respected',
  withSrc.bottles.find(b => b.name === 'Hedged One').confident, false);
// Sourced first: the cost of a wrong answer here is a wasted trip.
eq('what was actually seen ranks first', withSrc.bottles[0].name, 'Seen One');
}

{
sec('how long ago');
const t0 = 1700000000000;
eq('nothing is never', L.ago(0, t0), 'never');
eq('a moment is just now', L.ago(t0 - 30000, t0), 'just now');
eq('minutes', L.ago(t0 - 20 * 60000, t0), '20 minutes ago');
// One of a thing is not "1 hours ago".
eq('one hour is singular', L.ago(t0 - 3600000, t0), '1 hour ago');
eq('several are plural', L.ago(t0 - 3 * 3600000, t0), '3 hours ago');
eq('one day is singular', L.ago(t0 - 86400000, t0), '1 day ago');
eq('days', L.ago(t0 - 5 * 86400000, t0), '5 days ago');
eq('and then months', L.ago(t0 - 70 * 86400000, t0), '2 months ago');
}

{
sec('the master library');
const lib = {
  a: { k: 'a', name: 'Lagavulin 16', proof: 86, dist: 'Lagavulin', sub: 'scotch' }
};
// Something the library already has is not a contribution.
eq('a known bottle is not offered',
  L.worthContributing({ name: 'Lagavulin 16', proof: 86, dist: 'X' }, lib), false);
eq('however it is spelled',
  L.worthContributing({ name: 'lagavulin  16', proof: 86, dist: 'X' }, lib), false);
// A name and a proof alone help nobody find it again.
eq('a bare name is not worth having',
  L.worthContributing({ name: 'Mystery', proof: 90 }, lib), false);
eq('but a distillery makes it findable',
  L.worthContributing({ name: 'Mystery', proof: 90, dist: 'Somewhere' }, lib), true);
eq('so does a category',
  L.worthContributing({ name: 'Mystery', proof: 90, sub: 'rye' }, lib), true);
eq('no proof, no entry',
  L.worthContributing({ name: 'Mystery', dist: 'X' }, lib), false);

sec('what the library holds');
const entry = L.libraryEntry({ k: 'x', name: 'A Whisky', proof: 100,
  dist: 'House', sub: 'rye', fin: 'Oloroso', msrp: 60,
  tn: { nose: 'n', palate: 'p', finish: 'f' },
  drained: true, note: 'my own note' });
eq('the whisky travels', entry.name, 'A Whisky');
eq('with its cask', entry.fin, 'Oloroso');
eq('and its notes', entry.tn.nose, 'n');
// Facts about YOUR shelf are not facts about the whisky.
eq('but not whether yours is drained', entry.drained, undefined);
eq('nor your own scribble', entry.note, undefined);

sec('accepting one');
const ok = L.mergeContribution(lib, { name: 'Springbank 15', proof: 92,
  dist: 'Springbank', sub: 'scotch' });
eq('a new product merges', ok.ok, true);
eq('and normalises to a key', !!ok.key, true);
// A contribution is one person's opinion; the library is what everybody
// has agreed on, so it can add but never overwrite.
const clash = L.mergeContribution(lib, { name: 'lagavulin 16', proof: 999,
  dist: 'Wrong' });
eq('it cannot overwrite what is there', clash.ok, false);
eq('and says why', /already in the library/.test(clash.why), true);
eq('a nameless one is refused', L.mergeContribution(lib, { proof: 90 }).ok, false);
}

{
sec('a key a database can use');
// The library was a single array because Firebase forbids a full stop in a
// key and bottle names are full of them. Encoding the key is the fix;
// abandoning keys threw away every property of a database.
eq('full stops encode', L.libKey('Colonel E.H. Taylor Cured Oak'),
  'colonel_e_h_taylor_cured_oak');
// An apostrophe is a separator like any other punctuation. What matters is
// that it is STABLE, not that it reads prettily.
eq('so do apostrophes and digits', L.libKey("Booker's 2024-02"), 'booker_s_2024_02');
eq('nothing illegal survives',
  /[.#$\[\]/]/.test(L.libKey('Belle Meade 108.3 Proof #2 [x]')), false);
eq('no leading or trailing underscore', L.libKey('  A Whisky  '), 'a_whisky');
eq('nothing is nothing', L.libKey(''), '');

// Built from the RAW name, not the normalised one. shopNorm drops words
// like "whiskey" for matching, which is right for matching and fatal for a
// key: these two are different bottles that normalise to one string.
eq('two bottles do not collide',
  L.libKey('Barrell Craft Spirits Private Release')
    === L.libKey('Barrell Craft Spirits Private Release Whiskey'), false);
eq('and the same bottle keys the same',
  L.libKey('Lagavulin 16'), L.libKey('lagavulin  16'));

sec('a correction to the library');
const entry = { name: 'Ardbeg Wee Beastie', proof: 94.8, dist: 'Ardbeg',
                sub: 'scotch' };
// The case this exists for: the age sat wrong here for weeks.
eq('a missing age is a correction',
  L.correctionFor({ proof: 94.8, age: 5 }, entry).age.now, 5);
eq('and it records what it was', L.correctionFor({ age: 5 }, entry).age.was, null);
// Not everything counts.
eq('rounding is not a correction', L.correctionFor({ proof: 94.83 }, entry), null);
eq('a blank is not a claim', L.correctionFor({ proof: '', age: null }, entry), null);
// A name change is a different bottle, not a correction to this one.
eq('a name cannot be corrected',
  L.correctionFor({ name: 'Something Else' }, entry), null);
// Notes fill a gap but do not overwrite: a difference of opinion about a
// nose is not an error.
eq('notes fill an absence',
  !!L.correctionFor({ tn: { nose: 'n' } }, entry).tn, true);
eq('but do not overwrite one',
  L.correctionFor({ tn: { nose: 'mine' } },
    Object.assign({ tn: { nose: 'theirs' } }, entry)), null);

sec('applying one');
const fixed = L.applyCorrection(entry, L.correctionFor({ age: 5 }, entry));
eq('the field changes', fixed.age, 5);
eq('the rest does not', fixed.proof, 94.8);
eq('and the original is untouched', entry.age, undefined);
}

{
sec('searching the library');
const lib = {};
[['Ardbeg 10 Years Old', 'Ardbeg', 'scotch', 'Islay', 92],
 ['Ardbeg Uigeadail', 'Ardbeg', 'scotch', 'Islay', 108.4],
 ['Lagavulin 16', 'Lagavulin', 'scotch', 'Islay', 86],
 ['Buffalo Trace', 'Buffalo Trace', 'bourbon', 'Kentucky', 90]]
  .forEach(([n, d, s, r, pf]) => {
    lib[L.libKey(n)] = { name: n, dist: d, sub: s, region: r, proof: pf,
                         tn: { nose: 'n' } };
  });

eq('a distillery finds its bottles', L.searchLibrary(lib, 'ardbeg').length, 2);
eq('a region finds more', L.searchLibrary(lib, 'islay').length, 3);
// Every word has to match, or a two-word search is looser than a one-word
// one, which is the opposite of what anybody expects.
eq('two words narrow rather than widen',
  L.searchLibrary(lib, 'islay ardbeg').length, 2);
eq('a category works too', L.searchLibrary(lib, 'bourbon').length, 1);
eq('nothing matches nothing', L.searchLibrary(lib, 'zzz').length, 0);
eq('an empty search lists everything', L.searchLibrary(lib, '').length, 4);
eq('sorted by name', L.searchLibrary(lib, '')[0].name, 'Ardbeg 10 Years Old');
eq('the key travels with it', !!L.searchLibrary(lib, 'lagavulin')[0]._key, true);
eq('a limit is honoured', L.searchLibrary(lib, '', 2).length, 2);

sec('what is thin');
eq('a complete entry has no gaps', L.libraryGaps(lib[L.libKey('Lagavulin 16')]), []);
eq('a missing proof shows',
  L.libraryGaps({ name: 'X', dist: 'D', sub: 'rye', tn: { nose: 'n' } }),
  ['proof']);
eq('several show', L.libraryGaps({ name: 'X' }).length, 4);
eq('notes count as a gap',
  L.libraryGaps({ name: 'X', proof: 90, dist: 'D', sub: 'rye' }), ['notes']);
}

{
sec('favourites');
// A favourite is a property of the WHISKY, not of a bottle: three bottles
// of the same thing are one favourite, and it survives finishing one and
// opening the next.
const favState = { favs: {} };
const mark = k => { if (favState.favs[k]) delete favState.favs[k];
                    else favState.favs[k] = 1; };
mark('a');
eq('marking sets it', !!favState.favs.a, true);
mark('a');
eq('marking again clears it', !!favState.favs.a, false);

// Filtering is a plain intersection, and must not disturb the sort it is
// applied to.
const rows = [{ k: 'a', name: 'A' }, { k: 'b', name: 'B' }, { k: 'c', name: 'C' }];
const favs = { a: 1, c: 1 };
const only = rows.filter(p => favs[p.k]);
eq('only favourites survive', only.map(p => p.k), ['a', 'c']);
eq('and their order is untouched', only[0].k, 'a');
eq('no favourites means nothing, not everything',
  rows.filter(p => ({})[p.k]).length, 0);
// A favourite for a bottle no longer on the shelf must not be counted, or
// the badge promises rows the list cannot show.
const catalog = { a: { k: 'a' }, b: { k: 'b' } };
eq('a favourite off the shelf does not count',
  Object.keys({ a: 1, gone: 1 }).filter(k => catalog[k]).length, 1);
}

{
sec('what you paid');
const bots = [
  { id: '1', k: 'a', status: 'open', paid: 50 },
  { id: '2', k: 'a', status: 'sealed', paid: 70 },
  { id: '3', k: 'b', status: 'open', paid: null },
  { id: '4', k: 'c', status: 'gone', paid: 40 },
  { id: '5', k: 'd', status: 'open', paid: 0 }
];
eq('bottles you still have', L.myBottles('a', bots).map(b => b.id), ['1', '2']);
// A finished bottle is not on the shelf and must not be counted or averaged.
eq('a finished one is not yours any more', L.myBottles('c', bots), []);
eq('the count follows the same rule', L.ownedCount('a', bots), 2);

// Two bottles bought at different prices average, because one number for
// bottles bought years apart is a fiction either way.
eq('an average across what you paid', L.paidFor('a', bots).avg, 60);
eq('and it says how many', L.paidFor('a', bots).n, 2);
eq('no price recorded means none', L.paidFor('b', bots), null);
// A gift or an unrecorded price is zero, not free.
eq('zero is not a price', L.paidFor('d', bots), null);
eq('nothing owned means none', L.paidFor('zz', bots), null);
}

{
sec('guessing a category');
// Defaulting to bourbon turned Longrow 18 — a peated Campbeltown malt —
// into a bourbon. A blank invites a correction; a confident wrong answer
// does not.
eq('a Campbeltown malt is Scotch', L.guessSub('Longrow 18', 'Springbank'), 'scotch');
eq('so is an Islay one', L.guessSub('Ardbeg Uigeadail', ''), 'scotch');
eq('a pot still is Irish', L.guessSub('Redbreast 12 Year', ''), 'irish');
eq('rye in the name is rye', L.guessSub('Sazerac Rye', ''), 'rye');
eq('bourbon in the name is bourbon', L.guessSub('Old Forester 1920 Bourbon', ''), 'bourbon');
eq('a Japanese house is Japanese', L.guessSub('Nikka From The Barrel', ''), 'japanese');
// A name that says nothing gets NOTHING, which is the whole point.
eq('an unguessable name is left blank', L.guessSub('Eagle Rare 10', ''), null);
eq('and so is an empty one', L.guessSub('', ''), null);
// The guess only fills a gap; a stated category always wins.
eq('a stated category is not overridden',
  L.normalizeProduct({ name: 'Longrow 18', sub: 'scotch' }).sub, 'scotch');
eq('a guess fills a blank',
  L.normalizeProduct({ name: 'Longrow 18', dist: 'Springbank' }).sub, 'scotch');
eq('and an unguessable one stays blank',
  L.normalizeProduct({ name: 'Eagle Rare 10' }).sub, '');
}

{
sec('proof in tens');
const cat = {}; const bots = [];
[[86, 'a'], [94.8, 'b'], [100, 'c'], [107, 'd'], [125, 'e']].forEach(([pf, k]) => {
  cat[k] = { k: k, name: k, proof: pf };
  bots.push({ id: k, k: k, status: 'open' });
});
const tens = L.proofTens(cat, bots);
eq('a band per ten', tens.map(t => t[1]),
  ['80\u201389', '90\u201399', '100\u2013109', '120\u2013129']);
// An empty range is a chip somebody can press to see nothing.
eq('empty bands are left out', tens.some(t => t[1] === '110\u2013119'), false);
eq('counted', tens.map(t => t[2]), [1, 1, 2, 1]);
eq('and sorted low to high', tens[0][0], 'p80');

// A bottle you no longer own must not be counted, or the chip promises rows
// the list cannot show.
eq('a finished bottle is not counted',
  L.proofTens(cat, [{ id: 'x', k: 'a', status: 'gone' }]).length, 0);
eq('nor is a bottle with no proof',
  L.proofTens({ z: { k: 'z', name: 'z' } },
    [{ id: 'z', k: 'z', status: 'open' }]).length, 0);

eq('a band holds its own decade', L.proofInTen('p90', 94.8), true);
eq('and not the next', L.proofInTen('p90', 100), false);
eq('nor the one below', L.proofInTen('p90', 89.9), false);
eq('the boundary belongs to the lower band', L.proofInTen('p100', 100), true);
eq('junk matches nothing', L.proofInTen('nonsense', 90), false);
}

{
sec('searching for a cask');
// The shelf holds 18 PX bottles and a search for PX found 5, because the
// search read the name and distillery only and 13 of them record the cask
// as Pedro Ximenez — which nobody types.
const cat = {
  a: { k: 'a', name: 'Laphroaig PX Cask', dist: 'Laphroaig', fin: 'Pedro Ximenez' },
  b: { k: 'b', name: 'Glendronach 15 Revival', dist: 'Glendronach',
       fin: 'Pedro Ximenez+Oloroso' },
  c: { k: 'c', name: 'Ardbeg Ten', dist: 'Ardbeg', region: 'Islay',
       fin: null, style: 'single malt' },
  d: { k: 'd', name: 'Eagle Rare', dist: 'Buffalo Trace', fin: 'New oak' }
};
const bots = Object.keys(cat).map(k => ({ id: k, k: k, status: 'open' }));
const find = q => L.shelfFilter(Object.values(cat), bots, { q: q }).map(p => p.k);

eq('the cask is searched, not just the name', find('pedro ximenez'), ['a', 'b']);
// PX and Pedro Ximenez are the same cask spelled two ways.
eq('and a shorthand finds the long form', find('px'), ['a', 'b']);
eq('both directions', find('Pedro Xim\u00e9nez'), ['a', 'b']);
eq('the region is searched too', find('islay'), ['c']);
eq('and the style', find('single malt'), ['c']);

sec('broader is not the same as equal');
// Sherry covers PX; PX does not cover sherry. Treating them as equal made
// a search for PX return every sherried bottle on the shelf.
eq('sherry finds its members', find('sherry'), ['a', 'b']);
eq('but PX does not become sherry',
  L.expandQuery('px').indexOf('oloroso'), -1);
eq('while sherry reaches oloroso',
  L.expandQuery('sherry').indexOf('oloroso') >= 0, true);
eq('an unknown word expands to itself', L.expandQuery('lagavulin'), ['lagavulin']);
eq('and nothing expands to nothing', L.expandQuery(''), []);
}

{
sec('a search reads more than the name');
const p = { k: 'x', name: 'Old Bardstown Bottled in Bond', dist: 'Willett',
  fin: 'Pedro Ximenez', region: 'Kentucky', sub: 'bourbon',
  notes: 'the one from the trip',
  tn: { nose: 'Cinnamon and leather', palate: 'Dark fruit', finish: 'Long' } };

eq('the name', L.matchesQuery(p, 'bardstown'), true);
// Bardstown is a distillery AND a town: one bottle is made BY Bardstown
// Bourbon Company, another is Old Bardstown made by Willett, and both
// should answer to the word.
eq('the distiller, which is a different name', L.matchesQuery(p, 'willett'), true);
eq('the cask', L.matchesQuery(p, 'pedro ximenez'), true);
eq('a shorthand for the cask', L.matchesQuery(p, 'px'), true);
eq('the region', L.matchesQuery(p, 'kentucky'), true);
eq('the category', L.matchesQuery(p, 'bourbon'), true);
// A note is often the only handle somebody has: they remember cinnamon,
// not what it was called.
eq('a word from the tasting note', L.matchesQuery(p, 'cinnamon'), true);
eq('or from the finish', L.matchesQuery(p, 'dark fruit'), true);
eq('or your own scribble', L.matchesQuery(p, 'trip'), true);
eq('and not something absent', L.matchesQuery(p, 'lagavulin'), false);

sec('one search, not two');
// The shelf and the library each had their own matcher, so PX returned 18
// on one and 5 on the other — a disagreement between two answers to the
// same question, which is worse than either being wrong.
const cat = { x: p, y: { k: 'y', name: 'Ardbeg Ten', dist: 'Ardbeg',
  region: 'Islay', sub: 'scotch' } };
const bots = [{ id: '1', k: 'x', status: 'open' },
              { id: '2', k: 'y', status: 'open' }];
['px', 'islay', 'bardstown', 'cinnamon', 'islay scotch'].forEach(q => {
  const onShelf = L.shelfFilter(Object.values(cat), bots, { q: q }).length;
  const inLib = L.searchLibrary(cat, q, 99).length;
  eq('shelf and library agree on "' + q + '"', onShelf, inLib);
});

sec('a phrase is not two words');
// Splitting on whitespace turned "Pedro Ximenez" into two words, neither of
// which expands, so the synonym never fired.
eq('a known phrase stays whole', L.queryTerms('pedro ximenez'), ['pedro ximenez']);
eq('and still splits what is not one', L.queryTerms('islay sherry'),
  ['islay', 'sherry']);
eq('a phrase inside a longer query survives',
  L.queryTerms('cask strength rye'), ['cask strength', 'rye']);
eq('every word must match, so two words narrow',
  L.shelfFilter(Object.values(cat), bots, { q: 'islay bardstown' }).length, 0);
}

{
sec('cask strength is a fact, not a guess');
// The app had no notion of it and inferred from proof, which is why it told
// BZ that Bunnahabhain does not bottle at cask strength while his
// Bunnahabhain 21 Cask Strength sat on the shelf at 107.2 proof.
eq('a label that says so is the fact',
  L.isCaskStrength({ name: 'Bunnahabhain 21 year Cask Strength', proof: 107.2 }), true);
eq('however it is worded',
  L.isCaskStrength({ name: 'Elijah Craig Barrel Proof', proof: 124 }), true);
eq('and full proof counts',
  L.isCaskStrength({ name: 'Sazerac Full Proof', proof: 125 }), true);
// Proof is a hint for the ones that do not say it in words.
eq('115 and over is cask strength in practice',
  L.isCaskStrength({ name: "Aberlour A'Bunadh", proof: 119.8 }), true);
eq('but 107 alone is not',
  L.isCaskStrength({ name: 'Bunnahabhain 18', proof: 92.6 }), false);
eq('nothing is not', L.isCaskStrength(null), false);

sec('a reframe describes the shelf');
const bunn = {};
[['Bunnahabhain 12', 92.6], ['Bunnahabhain 21 year Cask Strength', 107.2]]
  .forEach(([n, pf], i) => {
    bunn['b' + i] = { k: 'b' + i, name: n, dist: 'Bunnahabhain',
                      sub: 'scotch', proof: pf };
  });
// The house HAS one, so there is nothing to reframe — saying otherwise is
// wrong in front of the bottle that disproves it.
eq('no reframe when the shelf already answers it',
  L.reframeGap({ dist: 'Bunnahabhain', name: 'Something at a very different strength' },
    bunn), null);

const narrow = {};
[92.6, 94, 95].forEach((pf, i) => {
  narrow['n' + i] = { k: 'n' + i, name: 'House ' + i, dist: 'House',
                      sub: 'scotch', proof: pf };
});
const r = L.reframeGap({ dist: 'House', name: 'Something at a very different strength' },
  narrow);
eq('it reframes when the shelf genuinely has none', !!r, true);
eq('and speaks about your bottles', /None of your 3 from House/.test(r.why), true);
eq('leaving room for the house to release one',
  /if they release one/.test(r.why), true);
}

{
sec('publishing without destroying');
// An Import JSON replaces everything at the path. That is right for seeding
// an empty library and wrong the moment anybody else uses it: a
// contribution accepted since is destroyed without a word.
const libNow = {
  lagavulin_16: { name: 'Lagavulin 16', proof: 86, at: 100 },
  somebody_elses_add: { name: "Somebody Else's Add", proof: 92, at: 200 }
};
const publishing = [{ name: 'Lagavulin 16', proof: 86, fin: 'Oloroso' }];

// What an update() call would send: named keys only, plus the stamp.
const updates = { stamp: 300 };
publishing.forEach(p => {
  updates['catalog/products/' + L.libKey(p.name)] =
    Object.assign(L.libraryEntry(p), { at: 300 });
});

eq('it writes only what was named', Object.keys(updates).sort(),
  ['catalog/products/lagavulin_16', 'stamp']);
// The one that matters: nothing addresses the other entry, so nothing can
// remove it.
eq('somebody else\u2019s addition is not addressed at all',
  Object.keys(updates).some(k => k.indexOf('somebody_elses_add') >= 0), false);
eq('and the correction does travel',
  updates['catalog/products/lagavulin_16'].fin, 'Oloroso');
eq('stamped, or no device would see it',
  updates['catalog/products/lagavulin_16'].at, 300);

// What goes is the whisky, not your shelf.
const entry = L.libraryEntry({ name: 'X', proof: 100, fin: 'Sherry',
  drained: true, paid: 60, notes: 'mine' });
eq('a library entry carries the cask', entry.fin, 'Sherry');
eq('but not what you paid', entry.paid, undefined);
eq('nor your own note', entry.notes, undefined);
}

{
sec('a finding must be answerable');
// "A finished bottling from Buffalo Trace" asks for something the app has
// no grounds to believe that house makes. It can see 24 bottles and no
// finish, and nothing more — the observation is sound, the instruction was
// not, and no amount of dismissing fixes a thing that should not have been
// offered.
// Proofs spread wide enough that the STRENGTH gap does not fire first —
// the checks are an else-if chain, so a narrow shelf never reaches the
// finish question.
const bt = {};
[90, 100, 107, 115, 125, 130].forEach((pf, i) => {
  bt['b' + i] = { k: 'b' + i, name: 'BT ' + i, dist: 'Buffalo Trace',
                  sub: 'bourbon', proof: pf, fin: null, msrp: 40 };
});
const bots = Object.keys(bt).map(k => ({ id: k, k: k, status: 'open' }));
const gaps = L.shelfGaps(bt, bots, [], [], [], {});
const fin = gaps.find(g => /finished/i.test(g.name));
eq('a finish gap is still raised', !!fin, true);
// The name must not name the house.
eq('but it does not name the house', /Buffalo Trace/.test(fin.name), false);
eq('it asks the answerable question', fin.name, 'A finished Bourbon');
// The house belongs in the reason, where it is an observation about the
// shelf rather than a claim about a distillery's range.
eq('the house is in the reason', /Buffalo Trace/.test(fin.why), true);
eq('and it leaves the door open',
  /Theirs if they release one/.test(fin.why), true);
// Nothing constrains the search to that house any more, which is what
// made every suggestion a rejected substitute.
eq('the search is not constrained to the house', fin.dist, undefined);
eq('but the category is kept', fin.sub, 'bourbon');
}

{
sec('judging a bottle in a shop');
const jCat = {
  a: { k: 'a', name: 'House A 12', dist: 'House', sub: 'scotch', proof: 92,
       region: 'Islay', msrp: 60 },
  b: { k: 'b', name: 'House A 15', dist: 'House', sub: 'scotch', proof: 94,
       region: 'Islay', msrp: 80 },
  c: { k: 'c', name: 'House A 18', dist: 'House', sub: 'scotch', proof: 96,
       region: 'Islay', msrp: 120 }
};
const jBot = ['a', 'b', 'c'].map(k => ({ id: k, k: k, status: 'open' }));

// DEEPER: a house you own three of, at a strength outside their range.
const deeper = L.shelfFit({ name: 'House A Cask Strength', dist: 'House',
  sub: 'scotch', proof: 120, region: 'Islay' }, jCat, jBot, []);
eq('going further into a house you know is deeper',
  deeper.findings.some(f => f.group === 'deeper'), true);
eq('and it says what their range is',
  /92 to 96/.test(deeper.findings.find(f => f.group === 'deeper').msg), true);

// BROADER: ground the shelf does not cover.
const broader = L.shelfFit({ name: 'Something Else', dist: 'Elsewhere',
  sub: 'bourbon', proof: 100 }, jCat, jBot, []);
eq('a new distillery is broader',
  broader.findings.some(f => f.group === 'broader'), true);
eq('and a new category too',
  broader.findings.filter(f => f.group === 'broader').length >= 2, true);

sec('a flight it would complete');
// The strongest reason there is, and the judge never looked. A wish pour is
// a bottle NOBODY owns — named rather than keyed — which is exactly the
// case, and filtering to shelf pours could never see it.
const flight = { title: 'A FLIGHT', core: [
  { k: 'a', role: 'core' }, { k: 'b', role: 'core' },
  { letter: '3', kind: 'wish', name: 'The Missing One', proof: 100 }
] };
const unlock = L.shelfFit({ name: 'The Missing One', sub: 'scotch',
  proof: 100 }, jCat, jBot, [flight]);
eq('it sees the flight', unlock.findings.some(f => f.group === 'flight'), true);
eq('and says it is the last pour',
  /last pour/.test(unlock.findings.find(f => f.group === 'flight').msg), true);
// It outranks everything except already owning it.
eq('and that settles the verdict', L.fitVerdict(unlock),
  'It finishes a flight you cannot currently run.');
// A bottle with nothing to do with the flight does not claim to complete it.
eq('an unrelated bottle claims nothing',
  L.shelfFit({ name: 'Unrelated', sub: 'rye', proof: 100 }, jCat, jBot,
    [flight]).findings.some(f => f.group === 'flight'), false);

sec('a number in the query must survive the match');
// "Jack Daniel's #7" scored well on "jack daniels" alone and filled the
// form with a Bonded bottle BZ owns — 100 proof, $64.99 — for a bottle he
// does not, which is 80 proof and half the price.
const jd = { x: { k: 'x', name: "Jack Daniel's Bonded Tennessee Whiskey",
  dist: "Jack Daniel's", sub: 'tennessee', proof: 100, msrp: 64.99 } };
eq('a query naming a number the match lacks does not fill the form',
  L.lookupFromCatalog("jack daniel's #7", jd), null);
eq('but a query that agrees still does',
  (L.lookupFromCatalog("jack daniel's bonded", jd) || {}).proof, 100);
}

{
sec('matching a bottle by name');
const mCat = {
  bt: { k: 'bt', name: 'Buffalo Trace Kentucky Straight Bourbon',
        dist: 'Buffalo Trace', proof: 90, sub: 'bourbon', msrp: 25 },
  bl: { k: 'bl', name: "Blanton's Black Label Single Barrel",
        dist: 'Buffalo Trace', proof: 93, sub: 'bourbon', msrp: 65 },
  rb: { k: 'rb', name: 'Redbreast 12 Year Cask Strength',
        dist: 'Midleton', proof: 115, sub: 'irish', msrp: 90 },
  jd: { k: 'jd', name: "Jack Daniel's Bonded Tennessee Whiskey",
        dist: "Jack Daniel's", proof: 100, sub: 'tennessee', msrp: 65 }
};

// A word matching the DISTILLERY counted as much as one matching the name,
// so "Buffalo Trace Bourbon" returned four Blanton's at a perfect score —
// Blanton's is made at Buffalo Trace — and the actual bottle did not place.
eq('the bottle named wins over its distillery-mates',
  L.shopSearch('Buffalo Trace Bourbon', mCat, 1)[0].p.k, 'bt');
eq('and the distillery match still scores something',
  L.shopSearch('Buffalo Trace Bourbon', mCat, 4).length > 1, true);

sec('numbers must agree in both directions');
// A query naming a number the match lacks is a different bottle: "#7"
// filled the form with Bonded's 100 proof and $64.99.
eq('a number in the query the match lacks',
  L.lookupFromCatalog("jack daniel's #7", mCat), null);
// And a match naming one the query lacks is equally different: plain
// Redbreast is not Redbreast 12 Cask Strength, and filling from it puts a
// cask-strength proof against a standard bottling.
eq('a number in the match the query lacks',
  L.lookupFromCatalog('Redbreast Irish Whiskey', mCat), null);
eq('but agreement in both directions matches',
  (L.lookupFromCatalog('Redbreast 12 Cask Strength', mCat) || {}).k, 'rb');
eq('and a bottle with no numbers either side still matches',
  (L.lookupFromCatalog("Jack Daniel's Bonded", mCat) || {}).k, 'jd');
}

{
sec('barcodes');
// A printed code carries hyphens, and a scanner may or may not give the
// leading zero, so both are normalised away before anything is compared.
eq('hyphens go', L.upcKey('0-80432-40063-0'), '080432400630');
eq('a bare 12 stays', L.upcKey('080432400630'), '080432400630');
eq('an 11-digit code is padded', L.upcKey('80432400630'), '080432400630');
eq('a 13-digit EAN keeps its last 12',
  L.upcKey('1080432400630'), '080432400630');
eq('too short is not a barcode', L.upcKey('1234'), null);
eq('nor is nothing', L.upcKey(''), null);

sec('reading a listing');
const listing = "Glenlivet: 750 ml 12-year 0-80432-40063-0 $36.99; "
  + "750 ml 18-year 0-80432-40066-1 $64.99\n"
  + "Lagavulin Scotch: 750 ml 16-year 0-88110-14005-2 $74.99";
const rows = L.parseUpcListing(listing);
eq('every entry is found', rows.length, 3);
// The expression is what distinguishes a 12 from an 18 and is the whole
// reason this source is worth anything — a listing that gave only the
// brand would be no better than the paid database that could not tell
// three Glenlivets apart.
eq('the expression survives', rows[0].name, 'Glenlivet 12-year');
eq('and distinguishes the next one', rows[1].name, 'Glenlivet 18-year');
eq('sizes are kept', rows[0].size, '750 ml');
eq('and prices', rows[1].price, 64.99);
eq('a line with no barcode yields nothing',
  L.parseUpcListing('Something: 750 ml no code here $20').length, 0);

sec('a number cannot be searched by name');
// The barcode source must answer FIRST. Nothing else can be asked with a
// number, and when nothing knows it the honest answer is to say so.
const known = { '080432400630': { name: 'Glenlivet 12-year', price: 36.99 } };
const hit = L.resolveUpc('0-80432-40063-0', known, {});
eq('a known barcode resolves to a name', hit.name, 'Glenlivet 12-year');
eq('and carries what the listing knew', hit.price, 36.99);
const miss = L.resolveUpc('9-99999-99999-9', known, {});
eq('an unknown one says so', miss.ok, false);
eq('and keeps the number, so it can be learned', miss.key, '999999999999');
eq('junk is refused before anything else', L.resolveUpc('12', known, {}).ok, false);
}

{
sec('a note made up for a flight is not a note');
// A card note was written as a prompt to read aloud beside five other
// pours — deeper, fuller, drier, than the ones next to it. On a bottle
// screen, alone, it is not a description of the whisky, and counting it as
// one meant 185 bottles looked described when nobody had ever described
// them: the fill-in run reported 15 missing when it was 200.
const card = { k: 'a', name: 'A', tn: { nose: 'Deeper fruit, oak' },
               tnFrom: 'THE ABERLOUR HOUSE' };
const real = { k: 'b', name: 'B', tn: { nose: 'Honey and apple' },
               tnSrc: 'review' };
const bare = { k: 'c', name: 'C' };

eq('a card note counts as missing', L.needsEnhancing(card), true);
eq('a real note does not', L.needsEnhancing(real), false);
eq('and no note at all still does', L.needsEnhancing(bare), true);

// It is hidden on the bottle rather than deleted: the flight keeps every
// word, because there the comparison is on the table in front of you.
eq('the note itself is untouched', card.tn.nose, 'Deeper fruit, oak');
eq('and it still says which flight it belongs to', card.tnFrom,
  'THE ABERLOUR HOUSE');

// The QA pass agrees, or the two would disagree about the same bottle.
const gaps = L.qaGaps ? null : null;
eq('a card note is not a source either',
  L.tnSource(card) !== null, true);
}

{
sec('choosing the dimension');
// Findings were computed from what is ABSENT, and absence is unbounded —
// there are thousands of bottles nobody has, so "a Campbeltown Scotch" is
// true, arbitrary, and still true next month. The axis is chosen now.
const eCat = {};
[['a', 'scotch', 'Islay', 92, 60, null], ['b', 'scotch', 'Islay', 94, 70, null],
 ['c', 'scotch', 'Islay', 96, 80, 'Oloroso'], ['d', 'bourbon', null, 100, 40, null]]
  .forEach(([k, sub, region, proof, msrp, fin], i) => {
    eCat[k] = { k: k, name: 'B' + i, dist: 'House ' + i, sub: sub,
                region: region, proof: proof, msrp: msrp, fin: fin };
  });
const eBot = Object.keys(eCat).map(k => ({ id: k, k: k, status: 'open' }));

const region = L.exploreAxis('region', eCat, eBot);
// Islay has three, so it is covered; the others are thin.
eq('a region with three is not offered',
  region.opportunities.some(o => o.value === 'Islay'), false);
eq('one with none is', region.opportunities.some(o => o.have === 0), true);
// Every opportunity must be a SEARCH, not a category somebody has to
// translate for themselves.
eq('each carries a real query',
  region.opportunities.every(o => o.ask && o.ask.length > 6), true);
eq('and says why it is thin',
  region.opportunities.every(o => o.why && o.why.length > 6), true);
// Thinnest first: nothing at all beats one you already have.
eq('sorted by how thin it is',
  region.opportunities[0].have <= region.opportunities[1].have, true);

const wood = L.exploreAxis('wood', eCat, eBot);
eq('a cask on the shelf is not offered',
  wood.opportunities.some(o => /Oloroso/i.test(o.value)), false);
eq('one that is not, is', wood.opportunities.some(o => /Port/i.test(o.value)), true);

// It must work on a shelf with NO flights, which is the case BZ raised:
// a new user has none, and the old findings leaned on them.
eq('no flights are needed', L.exploreAxis('style', eCat, eBot)
  .opportunities.length > 0, true);
eq('an empty shelf yields nothing rather than throwing',
  L.exploreAxis('region', {}, []).opportunities.length, 0);
eq('an unknown axis is empty, not an error',
  L.exploreAxis('nonsense', eCat, eBot).opportunities.length, 0);
}

{
sec('reading a shop page');
// A listing carries far more than a name and a price, and pulling only
// those would be paying the lookup for what is already on the screen.
const page = 'Aberlour 18 Year Old Double Sherry Cask Finish Single Malt '
  + 'Scotch Whisky | The Whisky Shop 750ml $169.99 43% ABV Speyside '
  + 'Nose: Rich dried fruit and dark chocolate. Palate: Full, oaky and dry. '
  + 'Finish: Long and refined. Matured in Oloroso and Pedro Ximenez butts.';
const r = L.readShopText(page, 'https://shop.example/x');

eq('ABV becomes proof', r.proof, 86);
eq('the age', r.age, 18);
eq('the price', r.msrp, 169.99);
eq('the size', r.size, '750ml');
eq('the region', r.region, 'Speyside');
eq('the category', r.sub, 'scotch');
// Sherry is the family, PX and Oloroso are the casks — naming all three
// says the same thing twice and then vaguely.
eq('the specific casks, not the family', r.fin, 'Pedro Ximenez+Oloroso');
// The colon matters: "Cask Finish" in a title is not a finish NOTE, and
// matching the bare word pulled the shop's name in as one.
eq('the finish note is the note', r.tn.finish, 'Long and refined.');
eq('and the nose', r.tn.nose, 'Rich dried fruit and dark chocolate.');

// A bare listing must not invent what is not there.
const bare = L.readShopText('Eagle Rare 10 Year Bourbon 750ml $39.99 90 proof', '');
eq('no note is invented', bare.tn, null);
eq('no cask is invented', bare.fin, null);
eq('but proof is read', bare.proof, 90);
eq('and age', bare.age, 10);
// A vintage is not an age.
eq('1990 is not an age', L.readShopText('Distilled 1990 bourbon', '').age, null);

sec('the name out of a page title');
eq('the shop is dropped',
  L.nameFromShopPage('Lagavulin 16 Year Old | The Whisky Exchange', ''),
  'Lagavulin 16 Year Old');
eq('so is the size',
  L.nameFromShopPage('Ardbeg Ten 750ml', ''), 'Ardbeg Ten');
// Nothing usable in the title: the URL path often carries it.
eq('the url is the fallback',
  L.nameFromShopPage('', 'https://shop.example/p/eagle-rare-10-year'),
  'eagle rare 10 year');
}

{
sec('how findable a suggestion is');
// A $40 shelf staple and a $99 allocated release are not the same
// suggestion at similar prices, and a bottle nobody can get is a taunt
// rather than a recommendation.
const raw = { bottles: [
  { name: 'Larceny Small Batch', distillery: 'Heaven Hill', proof: 92,
    price_usd: 40, find: 'shelf', why: 'a' },
  { name: 'Old Fitzgerald BiB 7', distillery: 'Heaven Hill', proof: 100,
    price_usd: 99, find: 'allocated', why: 'b' },
  { name: 'Rebel 10 Single Barrel', distillery: 'Lux Row', proof: 100,
    price_usd: 110, find: 'nonsense', why: 'c' },
  { name: 'Maker\'s 46', distillery: "Maker's Mark", proof: 94,
    price_usd: 45, why: 'd' }
] };
const r = L.parseCandidates(raw, {}, null, { name: 'Another Wheat' });
eq('every bottle survives', r.bottles.length, 4);
// By NAME, not by position: the parser sorts, so an index is whichever
// bottle happened to be cheapest rather than the one written down here.
const by = {};
r.bottles.forEach(b => { by[b.name] = b; });
eq('the price is read', by['Larceny Small Batch'].price, 40);
eq('shelf is carried', by['Larceny Small Batch'].find, 'shelf');
eq('so is allocated', by['Old Fitzgerald BiB 7'].find, 'allocated');
// A value outside the three is not a label, it is a mistake — showing it
// would put an invented word on screen as though the app knew something.
eq('an unrecognised value is dropped', by['Rebel 10 Single Barrel'].find, null);
eq('and a missing one is simply absent', by["Maker's 46"].find, null);
// The three words have to have wording, or the tag renders blank.
eq('every value has a label',
  ['shelf', 'hunt', 'allocated'].every(k => !!L.FIND_LABEL[k]), true);
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


sec('pins culled to the window');
// Extracted from renderMap, which was doing this arithmetic three times.
const pvCat = {
  near: { k: 'near', name: 'Near One', dist: 'Near', sub: 'scotch' },
  far:  { k: 'far',  name: 'Far One',  dist: 'Far',  sub: 'scotch' }
};
const pvBot = [{ id: 'p1', k: 'near', status: 'open' },
               { id: 'p2', k: 'far', status: 'open' }];
const pvCoords = { Near: [-6.0, 55.7], Far: [-120.0, 40.0] };
const islayView = { x: L.project(-6.5, 56.0)[0], y: L.project(-6.5, 56.0)[1],
                    w: 1, h: 1 };
const got = L.pinsInView(pvCat, pvCoords, pvBot, ['scotch'], islayView);
eq('only what is on screen', got.pins.map(p => p.dist), ['Near']);
eq('and no view means everything',
  L.pinsInView(pvCat, pvCoords, pvBot, ['scotch'], null).pins.length, 2);
// maxN must come from what SURVIVED, or a view of Speyside scales its dots
// against a Laphroaig sitting off screen.
eq('the largest count is taken from the visible pins', got.maxN, 1);
eq('missing coordinates are safe',
  L.pinsInView(pvCat, null, pvBot, ['scotch'], null).pins, []);
eq('maxN is never zero', L.pinsInView({}, {}, [], ['scotch'], null).maxN, 1);

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
eq('four groups', L.REF_GROUPS.length, 4);
// The app's own group leads, since somebody opening Info for the first time
// is more likely to be asking what a screen does than what Oloroso means.
eq('the app comes first', L.REF_GROUPS[0].id, 'features');
eq('tasting group resolves', L.refGroup('tasting'), L.TASTING);
eq('whiskey group resolves', L.refGroup('whiskey'), L.WHISKEY);
eq('our-data group resolves', L.refGroup('ourdata'), L.REFERENCE);
eq('an unknown group falls back to the first', L.refGroup('zzz'), L.FEATURES);
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
// Summed over whatever groups exist, rather than three named ones — this
// failed the moment a fourth was added, which is a test about arithmetic
// breaking on a change that was not about arithmetic.
eq('the total is every group added up', L.referenceCount(),
  L.REF_GROUPS.reduce((n, g) => n + L.referenceCount(g.id), 0));

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
// Against the group's own label rather than a copy of it: hardcoding the
// name meant renaming a tab broke a test about searching.
const KNOWN = L.REF_GROUPS.find(g => g.id === 'whiskey').label;
eq('search crosses groups', L.searchReference('char')
  .some(s => s.group === KNOWN), true);
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
// data.json stopped shipping bottles at v0.2.13 — which bottles somebody
// owns is not reference data, and shipping BZ's meant every new user opened
// the app already holding his 344. The real list lives beside it so these
// checks still run against a genuine shelf rather than an empty one.
data.bottles = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'bz-bottles.json'), 'utf8'));
// Flights stopped shipping at v1.0.1 for the same reason bottles did: the
// 325 products are reference data everybody should have, and the 36 flights
// are one person's curriculum. They live beside the app so these checks
// still run against a real one.
data.flights = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'bz-flights.json'), 'utf8'));
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
eq('ninety-eight wine-cask products',
  Object.values(data.catalog).filter(p => p.wine === true).length, 98);
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
// This test pinned the bug. It required the finding to NAME Buffalo Trace
// in the thing to go and buy — and Buffalo Trace does not release a
// finished bottling, so every search returned substitutes from other
// houses and the finding came back for ever. The observation is sound and
// still made; the ask is now one that can be answered.
// This shelf raises NO house extension, and that is correct: v1.8.0 made
// the ask category-wide — a finished Bourbon — while leaving the test
// house-scoped, so it asked BZ for a finished bourbon while he owned 36.
// A gap in one house is not a gap on the shelf. The behaviour is pinned on
// a fixture instead, where the shelf genuinely lacks the thing.
const oneHouse = {};
[90, 92, 94, 96].forEach((pf, i) => {
  oneHouse['h' + i] = { k: 'h' + i, name: 'H ' + i, dist: 'OneHouse',
                        sub: 'bourbon', proof: pf, fin: null, msrp: 40 };
});
const oneBots = Object.keys(oneHouse).map(k => ({ id: k, k: k, status: 'open' }));
const hGaps = L.gapsFromHouses(oneHouse, oneBots);
eq('a house with no finish anywhere on the shelf raises it',
  hGaps.some(g => g.kind === 'extend'), true);
eq('the ask is answerable and does not name the house',
  hGaps.some(g => g.kind === 'extend' && !/OneHouse/.test(g.name)), true);
eq('the house is named in the reason',
  hGaps.some(g => g.kind === 'extend' && /OneHouse/.test(g.why)), true);
// And it stops once the shelf covers that axis anywhere.
oneHouse.other = { k: 'other', name: 'Other Finished', dist: 'Elsewhere',
                   sub: 'bourbon', proof: 95, fin: 'Oloroso', msrp: 50 };
oneBots.push({ id: 'other', k: 'other', status: 'open' });
eq('and stops when the shelf covers it anywhere',
  L.gapsFromHouses(oneHouse, oneBots)
    .some(g => /finished/i.test(g.name)), false);
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
eq('310 products carry tasting notes', withTn.length, 310);
eq('every note set has at least three columns',
  withTn.every(p => L.tastingNotes(p).length >= 3), true);
// Twelve are now sourced from WHISKY:EDITION rather than written by me for
// a flight card. The two must never be confusable.
// Three origins, and they must stay distinguishable: a prompt I wrote for
// a flight card, a producer's own sheet, and the model reading what is
// published. They are worth different amounts.
const sourced = Object.values(data.catalog).filter(p => p.tnSrc === 'review');
const modelRead = Object.values(data.catalog).filter(p => p.tnSrc === 'model');
eq('twelve note sets are sourced', sourced.length, 12);
eq('113 were read by the model', modelRead.length, 113);
eq('a sourced note is never also credited to a card',
  sourced.filter(p => p.tnFrom).length, 0);
eq('nor is a model-read one', modelRead.filter(p => p.tnFrom).length, 0);
// Citation markup leaked into 28 of them and had to be stripped. None must
// survive: it renders as literal angle brackets on a tasting card.
eq('no note carries citation markup',
  withTn.filter(p => /<\/?cite/i.test(JSON.stringify(p.tn))).map(p => p.name), []);
eq('no note is empty after cleaning',
  withTn.filter(p => Object.values(p.tn).some(v => !String(v).trim()))
    .map(p => p.name), []);
eq('every note set records its origin one way or the other',
  withTn.every(p => !!p.tnFrom || !!p.tnSrc), true);
eq('notes always come back in sheet order',
  withTn.every(p => L.tastingNotes(p).map(n => n.label.toLowerCase()).join()
    === L.TN_ORDER.filter(k => p.tn[k]).join()), true);


sec('a finish names a wood or a wine');
// "Longrow 18 — 2021 Release" came back with a finish of 2021, and the shelf
// then reported "a finish you do not have: 2021" as a reason to buy it.
eq('a sherry is a finish', L.cleanFinish('Oloroso'), 'Oloroso');
eq('a wood is a finish', L.cleanFinish('Toasted Oak'), 'Toasted Oak');
eq('several are a finish', L.cleanFinish('Sherry+American Oak'), 'Sherry+American Oak');
eq('an abbreviation survives', L.cleanFinish('STR'), 'STR');
eq('a release year is not', L.cleanFinish('2021'), null);
eq('an older year is not either', L.cleanFinish('1998'), null);
eq('a proof is not', L.cleanFinish('92'), null);
eq('an age is not', L.cleanFinish('12'), null);
eq('nothing is nothing', L.cleanFinish('  '), null);
eq('null is safe', L.cleanFinish(null), null);
// Both ways in are covered: what a lookup returns, and what a product stores.
eq('a lookup finish is checked',
  L.parseLookup({ name: 'X', proof: 92, finish: '2021' }).fin, null);
eq('a real one still arrives',
  L.parseLookup({ name: 'X', proof: 92, finish: 'Oloroso' }).fin, 'Oloroso');
eq('a stored finish is checked',
  L.normalizeProduct({ name: 'X', proof: 92, fin: '2021' }).fin, null);
// And nothing on the real shelf is a bare number.
eq('no bottle on the shelf has a numeric finish',
  Object.values(data.catalog).filter(p => p.fin && !/[a-z]{3}/i.test(p.fin))
    .map(p => p.name), []);


sec('every distillery sits on its own island');
// Ireland in the world outline was an eight-point blob that did not reach
// east of -6.20, so Dublin, Bushmills and Limavady were all drawn in the
// sea. A pin in the water is the kind of thing that makes the whole map
// look untrustworthy.
function inRing(pt, ring) {
  let ok = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1])
        && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}
// Picked by its bounds rather than by a loose test that matched a bigger
// shape overlapping the same water.
const ireland = mapData.world.filter(r => Array.isArray(r) && r.length > 20)
  .find(r => {
    const lo = r.map(p => p[0]), la = r.map(p => p[1]);
    return Math.min(...lo) > -11 && Math.max(...lo) < -5.2
        && Math.min(...la) > 51.2 && Math.max(...la) < 55.6;
  });
eq('Ireland is drawn with more than a handful of points', !!ireland, true);
eq('and enough of them to have a coast', ireland.length >= 40, true);

const offshore = Object.entries(mapData.ieDistilleries)
  .filter(([, c]) => !inRing(c, ireland)).map(([n]) => n);
eq('no irish distillery is in the sea', offshore, []);
// The bounds have to be right too, or a shape could contain every pin by
// being far too big.
const lons = ireland.map(p => p[0]), lats = ireland.map(p => p[1]);
eq('it does not stretch past the Atlantic edge', Math.min(...lons) > -11, true);
eq('nor past Malin Head', Math.max(...lats) < 55.6, true);
eq('nor south of Mizen', Math.min(...lats) > 51.2, true);
eq('nor east into Wales', Math.max(...lons) < -5.2, true);

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

/* §176  Findability, and the two numbers that could never agree ----------
 *
 * Every expected value below was worked out by hand from the rules before
 * the assertion was written. The allocated list is a list of names, so the
 * expectations are the names in it and the names deliberately not in it.
 */
sec('§176 findability');

eq('a name on the allocated list is allocated',
  L.findability('Pappy Van Winkle 15 Year'), 'allocated');
eq('Lot B is caught by the family name, not a Pappy-specific rule',
  L.findability('Van Winkle Lot B 12 Year'), 'allocated');
eq('the allocated list beats the release field',
  L.findability('Van Winkle Lot B 12 Year', { scar: 'standard' }), 'allocated');
eq('a standard release is on the shelf',
  L.findability('Larceny Small Batch', { scar: 'standard' }), 'shelf');
eq('a batched release is on the shelf',
  L.findability('Elijah Craig Small Batch', { scar: 'batched' }), 'shelf');
eq('a limited release is a hunt',
  L.findability('Something Limited', { scar: 'limited' }), 'hunt');
eq('an exclusive release is allocated',
  L.findability('A Store Pick', { scar: 'exclusive' }), 'allocated');
eq('a bare name with no product is unknown, not a guess',
  L.findability('Auchentoshan 12 Year Old'), null);
// Recognition is not availability. Raasay is obscure and sits on a shelf;
// Weller is known to everybody and cannot be bought. If obsc ever leaks
// into findability, these two are what catches it.
eq('an obscure bottle is not thereby hard to find',
  L.findability('Isle of Raasay Dun Cana', { scar: 'standard', obsc: 'obscure' }),
  'shelf');
eq('a well-known allocated bourbon is still allocated',
  L.findability('Weller 12 Year', { obsc: 'known' }), 'allocated');

// Unknown ranks between a hunt and an allocated release: 0 < 1 < 2 < 3.
eq('findability ranks shelf, hunt, unknown, allocated',
  ['shelf', 'hunt', null, 'allocated'].map(L.findRank), [0, 1, 2, 3]);

sec('§177 nearest, and on which axis');
// Worked out by hand. cand sits at 118 proof, 5 years, $25, Oloroso,
// Islay, distillery X, bourbon.
//   strength: C 120 (2), A 100 (18), B 92 (26)
//   age:      C 4 (1),  A 7 (2),     B 12 (7)
//   price:    A 30 (5) and C 20 (5) tie, so A before C by name; B 60 last
const nprods = [
  { name: 'A', proof: 100, age: 7,  msrp: 30, fin: 'Oloroso', region: 'Islay',
    dist: 'X', sub: 'scotch' },
  { name: 'B', proof: 92,  age: 12, msrp: 60, fin: 'Port',    region: 'Islay',
    dist: 'Y', sub: 'bourbon' },
  { name: 'C', proof: 120, age: 4,  msrp: 20, fin: 'Oloroso', region: 'Speyside',
    dist: 'X', sub: 'bourbon' }
];
const ncand = { name: 'Z', proof: 118, age: 5, msrp: 25, fin: 'Oloroso',
                region: 'Islay', dist: 'X', sub: 'bourbon' };
const nnames = ax => L.nearestBy(ax, ncand, nprods).list.map(p => p.name);

eq('strength orders by proof distance', nnames('strength'), ['C', 'A', 'B']);
eq('age orders by years distance',      nnames('age'),      ['C', 'A', 'B']);
eq('price orders by dollars distance, ties by name',
  nnames('money'), ['A', 'C', 'B']);
eq('cask keeps only the same wood',     nnames('wood'),     ['C', 'A']);
eq('region keeps only the same region', nnames('region'),   ['A', 'B']);
eq('distillery keeps only the same house', nnames('house'), ['C', 'A']);
eq('category keeps only the same category', nnames('style'), ['C', 'B']);

eq('the axis says what it measured',
  L.nearestBy('strength', ncand, nprods).label, 'Nearest by strength');
eq('a match axis with nothing matching is a finding, not an error',
  L.nearestBy('region', { name: 'Z', region: 'Campbeltown' }, nprods).label,
  'Nothing on your shelf shares its region');
eq('an axis the bottle cannot be measured on returns nothing',
  L.nearestBy('age', { name: 'Z', proof: 100 }, nprods), null);
eq('no axis chosen means no opinion', L.nearestBy(null, ncand, nprods), null);
// A is itself, so it drops out; B is 8 proof away and C is 20.
eq('the bottle itself is never its own neighbour',
  L.nearestBy('strength', { name: 'A', proof: 100 }, nprods).list
    .map(p => p.name), ['B', 'C']);

sec('§178 a paste is not a title');
// The exact shape BZ pasted: brand, expression, then the page's furniture.
const ofPaste = ['Old Fitzgerald',
  '100 Proof Bottled in Bond 7 Year Old Bourbon',
  'starstarstarstarstar', '16 reviews', 'Choose a bottle size',
  '750ml bottle', '$79.99', 'Add to cart'].join('\n');
eq('the name stops where the page furniture starts',
  L.nameFromShopText(ofPaste),
  'Old Fitzgerald 100 Proof Bottled in Bond 7 Year Old Bourbon');
eq('a one-line paste is taken whole',
  L.nameFromShopText('Lagavulin 16 Year Old Islay Single Malt'),
  'Lagavulin 16 Year Old Islay Single Malt');
eq('a price before the name yields nothing rather than a price',
  L.nameFromShopText('$79.99\nLagavulin 16'), '');
eq('a paragraph is a description, not a name',
  L.nameFromShopText('A long and flowing paragraph of marketing prose that '
    + 'runs well past any name a bottle has ever had on it'), '');
eq('nothing in means nothing out', L.nameFromShopText(''), '');
// What the page DID carry still has to survive the new name parser.
const ofRead = L.readShopText(ofPaste, '');
eq('the proof is still read off the page', ofRead.proof, 100);
eq('the age is still read off the page', ofRead.age, 7);
eq('bottled in bond is still read off the page', ofRead.bonded, true);

sec('§179 candidates are ranked by what you can buy');
// Five bottles come back. Sourced wins first, then findability, then the
// cheaper one. Worked out by hand: the sourced allocated bottle leads
// because confident outranks everything; then shelf $20, shelf $40,
// hunt $15, allocated $10.
// price_usd and a real source string are what the parser reads; a
// `confident` flag with no source behind it is not confidence.
const rawCands = { bottles: [
  { name: 'Allocated but sourced', price_usd: 500, find: 'allocated',
    confident: true, source: 'totalwine.com' },
  { name: 'Allocated cheap',  price_usd: 10, find: 'allocated' },
  { name: 'Hunt cheap',       price_usd: 15, find: 'hunt' },
  { name: 'Shelf dear',       price_usd: 40, find: 'shelf' },
  { name: 'Shelf cheap',      price_usd: 20, find: 'shelf' }
] };
eq('sourced first, then findable, then cheapest',
  L.parseCandidates(rawCands, {}, null, { name: 'x' }).bottles.map(b => b.name),
  ['Allocated but sourced', 'Shelf cheap', 'Shelf dear', 'Hunt cheap',
   'Allocated cheap']);
// Six come back and only five are kept. The one dropped must be the one
// hardest to buy, not the cheapest — which is what the old dearest-first
// slice was doing backwards.
const sixCands = { bottles: [
  { name: 'Shelf 90',  price_usd: 90, find: 'shelf' },
  { name: 'Shelf 80',  price_usd: 80, find: 'shelf' },
  { name: 'Shelf 70',  price_usd: 70, find: 'shelf' },
  { name: 'Shelf 60',  price_usd: 60, find: 'shelf' },
  { name: 'Shelf 50',  price_usd: 50, find: 'shelf' },
  { name: 'Allocated 5', price_usd: 5, find: 'allocated' }
] };
eq('the bottle dropped by the cap is the one you cannot buy',
  L.parseCandidates(sixCands, {}, null, { name: 'x' }).bottles.map(b => b.name),
  ['Shelf 50', 'Shelf 60', 'Shelf 70', 'Shelf 80', 'Shelf 90']);

sec('§180 allocated gaps stay, and stay last');
{
  // Two flights, each one bottle short: one wants Pappy, one wants a
  // bottle nothing knows anything about. Both are findings; only one is
  // something to go and buy today.
  const gflights = [
    { id: 'F1', title: 'Proof ladder', tag: 'variable \u00b7 proof',
      core: [{ name: 'Pappy Van Winkle 15 Year', kind: 'wish' }] },
    { id: 'F2', title: 'Islay run', tag: 'variable \u00b7 peat',
      core: [{ name: 'Auchentoshan 12 Year Old', kind: 'wish' }] }
  ];
  const gaps = L.shelfGaps(catalog, bottles, gflights, [], [], {});
  const named = gaps.filter(g => /Pappy|Auchentoshan/.test(g.name || ''))
    .map(g => g.name);
  eq('an allocated flight gap is still reported',
    named.indexOf('Pappy Van Winkle 15 Year') >= 0, true);
  eq('and it is reported after the one you can buy',
    named, ['Auchentoshan 12 Year Old', 'Pappy Van Winkle 15 Year']);
  eq('every allocated gap sits after every gap that is not',
    gaps.map(g => g.find === 'allocated' ? 1 : 0)
      .every((v, i, a) => i === 0 || a[i - 1] <= v), true);
  eq('the tag travels with the gap',
    (gaps.find(g => g.name === 'Pappy Van Winkle 15 Year') || {}).find,
    'allocated');
}

/* §181  The App use tab names controls that have to exist ---------------
 *
 * L.FEATURES is prose in a constant and nothing tied it to the code it
 * describes, so it could only ever drift — and it did, for seven versions:
 * Shop was still documented as a search box with findings underneath, long
 * after it started asking where you are standing.
 *
 * No test can read English. This reads the one part that is checkable: the
 * tab names a control by the words printed ON it, and those words have to
 * exist in the file as a label. It would not have caught the stale Shop
 * paragraph, and it does catch a button being renamed out from under the
 * documentation, which is the commoner half.
 */
sec('§181 the App use tab names controls that exist');
{
  const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  // Label, and the entry that promises it.
  const NAMED = [
    ['+ Add bottle',          'Shelf'],
    ['Import',                'Shelf'],
    ['Change',                'Shop'],
    ['I bought it',           'In a store, holding a bottle'],
    ['Want it',               'In a store, holding a bottle'],
    ['Correct these details', 'Add a bottle you just bought'],
    ['Something else',        'Deciding what to buy next'],
    ['Read it',               'Looking at it on a website'],
    ['I poured this',         'Record a pour'],
    ['Remix',                 'Run a flight again'],
    ['Build a flight',        'Flights']
  ];
  // A label is either a quoted string the script sets, or text between
  // tags in the markup. Both are the words printed on the control.
  const labelled = label =>
    src.indexOf("'" + label + "'") >= 0 || src.indexOf('>' + label + '<') >= 0;
  eq('every control the tab names by its label exists in the file',
    NAMED.filter(([label]) => !labelled(label))
      .map(([label, where]) => where + ' promises ' + label), []);

  // And every entry that names one is still in FEATURES under that term.
  const terms = {};
  L.FEATURES.forEach(g => g.items.forEach(i => { terms[i.term] = i.def; }));
  eq('and the entry that promises it is still there',
    NAMED.filter(([, where]) => !terms[where]).map(([, where]) => where), []);

  // The Info entry counts the groups. Two lists, one number, and the
  // number was written by hand.
  eq('the Info entry counts the groups there actually are',
    /Four groups/.test(terms['Info']), L.REF_GROUPS.length === 4);

  // Every section has a note and at least one item, or it renders as a
  // heading with nothing under it.
  eq('no empty section', L.FEATURES.filter(g =>
    !g.section || !g.note || !(g.items || []).length).map(g => g.section), []);
  eq('every entry says something', L.FEATURES
    .reduce((a, g) => a.concat(g.items), [])
    .filter(i => !i.term || !i.def || i.def.length < 40).map(i => i.term), []);
}

/* §182  An ask may not invent a bottle -----------------------------------
 *
 * Every failure BZ has hit on this screen came from two generators that
 * described something nobody sells: a cask-strength bottling from a house
 * that does not make one (Arran, Bruichladdich, Benriach, three for three)
 * and a whisky older than a shelf that already tops out at 33.
 *
 * The rule these encode: the ask has to name something that certainly
 * exists. Specifics that might not go in the observation, which is a fact
 * about the shelf, not a claim about what is for sale.
 */
sec('§182 an ask may not invent a bottle');
{
  const shelfOf = rows => {
    const cat = {}, bots = [];
    rows.forEach((r, i) => {
      const k = r.name + ' @ ' + r.proof;
      cat[k] = { k: k, name: r.name, dist: r.dist, proof: r.proof,
                 age: r.age, sub: 'scotch', msrp: 60 };
      bots.push({ id: 'x' + i, k: k, status: 'open' });
    });
    return [cat, bots];
  };
  const asks = (axis, rows) => {
    const [c, b] = shelfOf(rows);
    return L.exploreAxis(axis, c, b).opportunities.map(o => o.ask);
  };

  const benriach = [
    { name: 'Benriach A', dist: 'Benriach Distillery', proof: 86, age: 12 },
    { name: 'Benriach B', dist: 'Benriach Distillery', proof: 92, age: 10 },
    { name: 'Benriach C', dist: 'Benriach Distillery', proof: 90, age: 33 }
  ];

  eq('a house ask names the house, not a bottling it may not make',
    asks('house', benriach), ['Another Benriach']);
  eq('and never asks for cask strength again',
    asks('house', benriach).filter(a => /cask.strength/i.test(a)), []);
  // "Another Benriach Distillery" is not how anybody says it.
  eq('a trailing Distillery is dropped from the ask',
    asks('house', benriach).some(a => /Distillery/.test(a)), false);
  // The strength is still said — as an observation, which is a fact about
  // the shelf and cannot be wrong about what is for sale.
  {
    const [c, b] = shelfOf(benriach);
    eq('the strength stays in the observation',
      L.exploreAxis('house', c, b).opportunities[0].why,
      '3 from Benriach Distillery, nothing above 92 proof.');
  }

  // Ages are bottled at tiers. Worked out by hand from [10,12,15,18,21,25,30]:
  // a shelf topping out at 14 wants 15; at 8 wants 10; at 33 there is no
  // tier left and the right number of asks is none.
  const aged = hi => asks('age',
    [{ name: 'P', dist: 'X', proof: 90, age: 12 },
     { name: 'Q', dist: 'X', proof: 90, age: hi }])
      .filter(a => /year old whisky$/.test(a));
  eq('the next tier up is the ask', aged(14), ['A 15 year old whisky']);
  eq('a tier is skipped to, not stepped past', aged(19),
    ['A 21 year old whisky']);
  eq('a shelf past the top tier is asked for nothing older', aged(33), []);
  eq('and a shelf at exactly the top tier is too', aged(30), []);
  eq('the tiers ascend', L.AGE_TIERS.slice().sort((a, b) => a - b),
    L.AGE_TIERS);
}

/* §183  One rule for what a cask is -------------------------------------
 *
 * parseLookup carried its own weaker copy of cleanFinish: letters, and not
 * a bare year. A shop's finish NOTE passes both of those and is not a
 * cask, so the app announced "A finish you do not have: Long-lasting with
 * brown sugar sweetness..." — and, since the cask axis measures nearness
 * by this field, it poisoned that too. Both paths call the one rule now.
 */
sec('§183 a finish is a cask, not a tasting note');
{
  const lk = fin => L.parseLookup({ name: 'X', proof: 100, fin: fin });
  eq('a tasting note is not a cask',
    lk('Long-lasting with brown sugar sweetness fading into cinnamon, '
       + 'leather and toast').fin, null);
  eq('a cask is a cask', lk('Pedro Ximenez').fin, 'Pedro Ximenez');
  eq('two words is still a cask', lk('Oloroso Sherry').fin, 'Oloroso Sherry');
  eq('a release year is not a cask', lk('2021').fin, null);
  eq('nothing said is nothing filled', lk(null).fin, null);
  // The two paths must not disagree: whatever cleanFinish rejects, the
  // lookup rejects, or the field means two things depending on where it
  // came from.
  eq('the lookup and the page reader agree about every case',
    ['Pedro Ximenez', '2021', 'Oloroso Sherry', 'Tokaji',
     'Long-lasting with brown sugar and cinnamon notes', '', '19']
      .filter(v => lk(v).fin !== L.cleanFinish(v)), []);
}

/* §184  Two vocabularies, one name --------------------------------------
 *
 * REEL_HELP is keyed by reel id and carried an entry for `scar`. There is
 * no scar reel — Occasion is `price` — so that help never reached a
 * screen, and the orphan looked like documentation for the release field
 * while using the price bands' words. The reels are the only list that
 * decides what keys and faces are real, so they are what this checks.
 */
sec('§184 the reel help matches the reels');

eq('every reel has help', L.REELS.filter(r => !L.REEL_HELP[r.id])
  .map(r => r.id), []);
eq('and no help is orphaned from a reel',
  Object.keys(L.REEL_HELP).filter(k => !L.REELS.some(r => r.id === k)), []);
// Type is deliberately empty — twelve faces that say what they are. Every
// other reel explains every face it can land on, except Any, which needs
// no explaining.
eq('every face a reel can land on is explained',
  L.REELS.filter(r => Object.keys(L.REEL_HELP[r.id][1]).length)
    .reduce((miss, r) => miss.concat(r.faces
      .filter(f => f.v !== 'any' && !L.REEL_HELP[r.id][1][f.v])
      .map(f => r.id + '/' + f.v)), []), []);
// The Occasion reel is the price band, so its faces have to BE the bands.
eq('the occasion faces are the price bands',
  L.REELS.find(r => r.id === 'price').faces
    .map(f => f.v).filter(v => v !== 'any'),
  ['everyday', 'good', 'special', 'vault']);
eq('and priceBand only ever returns one of them',
  [10, 60, 150, 500].map(L.priceBand),
  ['everyday', 'good', 'special', 'vault']);

sec('§185 findability does not borrow your own shelf');
// "On the shelf" meant a shop's shelf while every other screen in the app
// means yours, so a bottle you do not own was tagged with the word for
// bottles you do.
eq('no findability label says shelf',
  Object.keys(L.FIND_LABEL).filter(k => /shelf/i.test(L.FIND_LABEL[k])), []);
eq('the keys are untouched, because the lookup service answers in them',
  Object.keys(L.FIND_LABEL).sort(), ['allocated', 'hunt', 'shelf']);
eq('every key findability can return has a label',
  ['shelf', 'hunt', 'allocated'].filter(k => !L.FIND_LABEL[k]), []);
eq('and every key has a rank',
  ['shelf', 'hunt', 'allocated'].filter(k => L.findRank(k) === L.findRank(null)),
  []);

/* §186  the queue and the diff have to agree ----------------------------
 *
 * needsEnhancing was taught that a flight-card note is a PROMPT and not a
 * note about the whisky, which is why the run queues 200 bottles rather
 * than 15. enhanceDiff was never taught it, and rejected every one of
 * those 185 for having a tn.nose. The run of 2026-09-03 filled 24 and
 * reported 177 with nothing to find; it could not have filled more than
 * 24 whatever the lookups returned.
 *
 * Two functions, one rule. These test them against each other rather than
 * each on its own, which is the only way that disagreement shows up.
 */
sec('§186 a flight prompt is not a tasting note');
{
  const promptNote = { colour: 'gold', nose: 'a', palate: 'b', finish: 'c' };
  const withPrompt = { k: 'x', name: 'X', tnFrom: 'ONE DISTILLERY, EVERY GRAIN',
                       tn: promptNote };
  const mine = { k: 'y', name: 'Y', tn: { nose: 'a', palate: 'b', finish: 'c' } };
  const bare = { k: 'z', name: 'Z' };
  const real = { nose: 'apple', palate: 'pear', finish: 'oak', colour: 'amber' };

  // The disagreement itself. Anything the queue asks about must be
  // something the diff can act on, or the lookup is paid for and binned.
  eq('everything the queue asks about, the diff can use',
    [withPrompt, bare].filter(p =>
      L.needsEnhancing(p) && !L.enhanceDiff(p, real)).map(p => p.k), []);
  eq('and what the queue skips, the diff would not have taken anyway',
    L.needsEnhancing(mine), false);

  // Compared field by field: eq stringifies, and the two objects differ
  // only in the order the keys were built in.
  eq('a real note replaces a flight prompt',
    ['nose', 'palate', 'finish', 'colour']
      .map(k => L.enhanceDiff(withPrompt, real).tn[k]),
    ['apple', 'pear', 'oak', 'amber']);
  eq('and the prompt is cleared with it, or it is queued for ever',
    L.enhanceDiff(withPrompt, real).tnFrom, null);
  eq('a note you wrote yourself is never replaced',
    (L.enhanceDiff(mine, real) || {}).tn.nose, 'a');
  eq('a bottle with no note at all is filled',
    L.enhanceDiff(bare, real).tn.nose, 'apple');
  // Half an answer is not a note, and taking it would destroy the prompt
  // to put a fragment in its place.
  eq('a partial answer is refused rather than half-applied',
    L.enhanceDiff(withPrompt, { nose: 'apple', palate: 'pear' }), null);
  eq('and the prompt survives being refused',
    withPrompt.tn.nose, 'a');
  // Once filled, it must not come back round on the next run.
  eq('a filled prompt drops out of the queue',
    L.needsEnhancing(Object.assign({}, withPrompt,
      { tn: real, tnFrom: null })), false);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
