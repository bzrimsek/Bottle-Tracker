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

// Radius grows with the square root, so twelve does not swamp one.
eq('one bottle', L.pinRadius(1), 1.45);
eq('four bottles', L.pinRadius(4), 2);
eq('nine bottles', L.pinRadius(9), 2.55);
eq('growth is sub-linear', L.pinRadius(16) < L.pinRadius(1) * 4, true);

sec('zoom and clamping');
eq('zoom floor', L.clampZoom(0.2), 1);
eq('zoom ceiling', L.clampZoom(999), 40);
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
eq('zoom in stops at the ceiling',
  Math.round(L.zoomAbout(win, full, 1000, 50, 50).w * 100) / 100, 2.5);

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
// Recent is newest-first and drops entries whose product is gone.
const recentLog = [{ k: 'Lagavulin 16 @ 86.0' }, { k: 'gone-product' },
                   { k: 'Raasay Dun Cana @ 104.0' }];
eq('newest first', L.recent(recentLog, catalog, 5).map(x => x.k),
  ['Raasay Dun Cana @ 104.0', 'Lagavulin 16 @ 86.0']);
eq('limit honoured', L.recent(recentLog, catalog, 1).length, 1);
eq('empty history is safe', L.recent([], catalog, 5), []);
eq('null history is safe', L.recent(null, catalog, 5), []);

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
const woodOnly = Object.values(data.catalog).filter(p => p.fin && p.wine === false);
eq('seven wood-only products', woodOnly.length, 7);
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
// Every real flight title survives sentence-casing without losing a capital
// that a proper noun needs.
eq('no flight title starts lower-case',
  data.flights.map(f => L.sentenceCase(f.title)).filter(t => /^[a-z]/.test(t)), []);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
