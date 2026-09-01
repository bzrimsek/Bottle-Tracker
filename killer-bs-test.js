#!/usr/bin/env node
/*
 * Killer B's Bottle Tracker test harness.
 *
 * Every expected value below was computed by hand or in a separate Node
 * session BEFORE the assertion was written. No test derives its expected
 * value from the code under test.
 *
 * Run: node killer-bs-test.js
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

/* ---------------- real data ---------------- */
sec('real collection data');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
eq('344 bottles', data.bottles.length, 344);
eq('325 products', Object.keys(data.catalog).length, 325);
eq('36 flights', data.flights.length, 36);
// Every duplicated product has exactly one open bottle -- BZ's stocking rule.
const byKey = {};
data.bottles.forEach(b => { (byKey[b.k] = byKey[b.k] || []).push(b); });
const violations = Object.keys(byKey).filter(k =>
  byKey[k].filter(b => b.status === 'open').length !== 1);
eq('every product has exactly one open bottle', violations.length, 0);
// The control set: finished, but no wine cask.
const woodOnly = Object.values(data.catalog).filter(p => p.fin && p.wine === false);
eq('seven wood-only products', woodOnly.length, 7);
const tripleOak = Object.values(data.catalog).find(p => /Triple Oak/.test(p.name));
eq('triple oak is finished', tripleOak.fin, 'Hungarian Oak+Chinkapin Oak+French Oak');
eq('triple oak has no wine', tripleOak.wine, false);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
