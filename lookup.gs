/**
 * lookup.gs — Killer B's Bottle Tracker lookup backend.
 *
 * Two jobs, one deployment:
 *   1. doGet(?name=…)        one bottle, for the Add a bottle form.
 *   2. fillMissingNotes()    a batch run that sources tasting notes for the
 *                            bottles that have none, and writes a CSV to
 *                            your Drive for review.
 *
 * WHY IT IS A SCRIPT AND NOT IN THE APP
 * An API key in a page served from GitHub Pages is a public API key. This
 * runs on Google's side, holds the key in Script Properties, and the app
 * only ever sees the JSON that comes back.
 *
 * SETUP
 *   1. script.google.com → New project → paste this in.
 *   2. Project Settings → Script Properties → add
 *        ANTHROPIC_KEY = sk-ant-…
 *   3. Deploy → New deployment → Web app
 *        Execute as: Me.   Who has access: Anyone with the link.
 *   4. Copy the /exec URL into the app: Info → Our data → Bottle lookup.
 *
 * COST
 * A lookup is roughly 500 input and 250 output tokens. On Haiku that is a
 * fraction of a cent; the 138 missing notes cost well under a dollar in
 * total, and every answer is cached in your catalog so no bottle is ever
 * paid for twice.
 *
 * WHAT IT WILL NOT DO
 * The prompt tells the model to return null rather than guess, and every
 * field is range-checked again in the app before it is shown. A blank field
 * is the correct answer when the truth is not known — an invented proof or a
 * plausible-sounding tasting note is worse than nothing, because you cannot
 * tell it from a real one afterwards.
 */

var MODEL = 'claude-haiku-4-5-20251001';
var API = 'https://api.anthropic.com/v1/messages';

/** One bottle, for the Add a bottle form. */
function doGet(e) {
  var name = (e && e.parameter && e.parameter.name) || '';
  if (!name || name.length < 3) return json({ error: 'name required' });
  try {
    return json(askAbout(name, false));
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ask for one bottle. notesOnly narrows the answer to the four sensory
 * columns, which is what the batch run needs.
 */
function askAbout(name, notesOnly) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_KEY');
  if (!key) throw new Error('ANTHROPIC_KEY is not set in Script Properties');

  var shape = notesOnly
    ? '{"name":string,"colour":string|null,"nose":string|null,' +
      '"palate":string|null,"finish":string|null,"source":string|null}'
    : '{"name":string,"dist":string|null,"proof":number|null,' +
      '"sub":string|null,"age":number|null,"fin":string|null,' +
      '"msrp":number|null,"scar":string|null,"region":string|null,' +
      '"colour":string|null,"nose":string|null,"palate":string|null,' +
      '"finish":string|null,"source":string|null}';

  var rules = [
    'Return ONLY the JSON object. No prose, no markdown fences.',
    'Use null for anything you do not actually know. Never estimate, never',
    'infer from a similar bottling, never write a plausible-sounding tasting',
    'note. A null is the correct answer when the fact is not established.',
    'proof is US proof (twice ABV), not ABV.',
    'sub is one of: bourbon, tennessee, rye, wheat, american single malt,',
    'scotch, irish, canadian, japanese, world, flavored, tequila.',
    'scar is one of: standard, batched, limited, exclusive.',
    'region applies to Scotch only: Islay, Speyside, Highland, Islands,',
    'Lowland, Campbeltown.',
    'colour, nose, palate and finish must come from the producer or a named',
    'published review, not from your impression of what it probably tastes',
    'like. Keep each under 90 characters.',
    'source names where the tasting notes came from, or null.'
  ].join(' ');

  var body = {
    model: MODEL,
    max_tokens: 1000,
    system: 'You answer with a single JSON object matching: ' + shape + ' ' + rules,
    messages: [{ role: 'user', content: 'Whisky bottling: ' + name }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
  };

  var res = UrlFetchApp.fetch(API, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }

  // Find the text blocks by type rather than by position: with web search on,
  // the response interleaves tool use and results around the answer.
  var data = JSON.parse(res.getContentText());
  var text = (data.content || [])
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join('\n')
    .replace(/```json|```/g, '')
    .trim();
  var start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no JSON in the reply');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Batch: source tasting notes for the bottles that have none.
 *
 * Paste the missing names into MISSING below (the app can hand you the list:
 * Info → Our data → Bottle lookup shows the count, and the browser console
 * command is printed there). Run this from the editor. It writes
 * killer-bs-notes.csv to your Drive root for review before anything is
 * merged, because nothing should reach the shelf unread.
 *
 * Apps Script caps a run at six minutes. LIMIT keeps each run inside that;
 * run it again and it picks up where it stopped, since already-done names
 * are skipped by re-reading the CSV.
 */
var MISSING = [
  // 'Old Forester 1924 10 Year Old Kentucky Straight Bourbon Whiskey',
  // 'Lagavulin 16 Year Old Single Malt Scotch Whisky',
];
var LIMIT = 25;
var OUT = 'killer-bs-notes.csv';

function fillMissingNotes() {
  var done = {};
  var files = DriveApp.getFilesByName(OUT);
  var rows = [];
  if (files.hasNext()) {
    var existing = Utilities.parseCsv(files.next().getBlob().getDataAsString());
    existing.forEach(function (r, i) {
      if (i === 0) return;
      done[r[0]] = true;
      rows.push(r);
    });
  }
  if (!rows.length) rows.push(['name', 'colour', 'nose', 'palate', 'finish', 'source']);

  var count = 0;
  for (var i = 0; i < MISSING.length && count < LIMIT; i++) {
    var name = MISSING[i];
    if (done[name]) continue;
    try {
      var r = askAbout(name, true);
      rows.push([name, r.colour || '', r.nose || '', r.palate || '',
                 r.finish || '', r.source || '']);
      Logger.log('ok   ' + name);
    } catch (err) {
      // Record the failure rather than dropping it, so a rerun can see it.
      rows.push([name, '', '', '', '', 'ERROR: ' + err]);
      Logger.log('fail ' + name + ' — ' + err);
    }
    count++;
    Utilities.sleep(1200);          // stay well inside the rate limit
  }

  var csv = rows.map(function (r) {
    return r.map(function (c) {
      return '"' + String(c).replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\n');

  var old = DriveApp.getFilesByName(OUT);
  while (old.hasNext()) old.next().setTrashed(true);
  DriveApp.createFile(OUT, csv, MimeType.CSV);
  Logger.log('wrote ' + (rows.length - 1) + ' rows to ' + OUT +
             ' (' + count + ' this run)');
}
