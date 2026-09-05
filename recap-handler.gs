/* Bottlefolio — the recap write-up.
 *
 * Paste this into the SAME Apps Script project that already answers bottle
 * lookups, then redeploy. Nothing else in the app changes.
 *
 * The app posts { mode: 'recap', ... } and expects { recap: "…" } back.
 * Everything else it posts — mode: 'candidates', or a bare name — carries
 * on going wherever it already goes.
 *
 * WHAT ARRIVES. Counts only, never the log: no dates, no log entries,
 * nothing about who was there, no note anybody wrote. The service is being
 * asked to find the shape in a tally, which is the one thing arithmetic
 * cannot do — a month where every Irish whiskey was drunk out somewhere is
 * a real observation and no count says it.
 *
 *   { mode:'recap', span:'the last month',
 *     pours:16, different:11, flights:2, away:3, home:13,
 *     again:4, notForMe:1,
 *     whiskies:[{name,n}…], houses:[{name,n}…],
 *     places:[{name,n}…],  kinds:[{name,n}…], cities:[{name,n}…] }
 */

/* ------------------------------------------------------------------ */
/* 1. ROUTING. Add this branch at the TOP of your existing doPost, before
      whatever handles a bottle lookup. If your doPost is named something
      else, put the two lines in that one instead.                      */
/* ------------------------------------------------------------------ */

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }

  // THE NEW BRANCH. Two lines.
  if (body.mode === 'recap') {
    return jsonOut({ recap: writeRecap_(body) });
  }

  // ... your existing handling carries on below, untouched ...
  return handleExistingLookup_(e, body);
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* 2. THE WRITE-UP.                                                    */
/* ------------------------------------------------------------------ */

function writeRecap_(r) {
  // The app refuses anything under 40 characters, so a failure here shows
  // as "your lookup service does not answer this yet" rather than as a
  // sentence that says nothing.
  var facts = recapFacts_(r);

  var prompt =
    'You are writing two or three sentences for somebody about their own '
    + 'whisky drinking over ' + (r.span || 'this stretch') + '.\n\n'
    + 'These are the counts:\n' + facts + '\n\n'
    + 'Rules:\n'
    + '- Say something the counts do not already say. A pattern, a '
    + 'contrast, a change of habit. Do not read the numbers back.\n'
    + '- Two or three sentences. No heading, no bullet points, no '
    + 'preamble, no sign-off.\n'
    + '- Address them as "you". Never invent a whisky, a place or a '
    + 'number that is not above.\n'
    + '- If the counts are thin, say so plainly and briefly rather than '
    + 'padding.\n'
    + '- Plain language. No tasting-note flourish, no "it seems", no '
    + '"appears to".';

  return askModel_(prompt);
}

// The counts as lines a model can read, and nothing else.
function recapFacts_(r) {
  var out = [];
  out.push('pours: ' + (r.pours || 0));
  out.push('different whiskies: ' + (r.different || 0));
  if (r.flights) out.push('flights run: ' + r.flights);
  out.push('poured at home: ' + (r.home || 0)
    + ', poured somewhere else: ' + (r.away || 0));
  if (r.again || r.notForMe) {
    out.push('would pour again: ' + (r.again || 0)
      + ', would not: ' + (r.notForMe || 0));
  }
  out.push(listLine_('most poured', r.whiskies));
  out.push(listLine_('houses', r.houses));
  out.push(listLine_('places', r.places));
  out.push(listLine_('kinds of place', r.kinds));
  out.push(listLine_('cities', r.cities));
  return out.filter(function (x) { return x; }).join('\n');
}

function listLine_(label, rows) {
  if (!rows || !rows.length) return '';
  var bits = rows.slice(0, 8).map(function (x) {
    return x.name + (x.n > 1 ? ' (' + x.n + ')' : '');
  });
  return label + ': ' + bits.join(', ');
}

/* ------------------------------------------------------------------ */
/* 3. THE MODEL CALL.                                                  */
/*                                                                     */
/* If your script already talks to a model for bottle lookups, DELETE   */
/* askModel_ below and call your existing one instead — it only needs   */
/* to take a prompt and return text.                                   */
/*                                                                     */
/* Otherwise: Project Settings → Script Properties → add a property     */
/* named ANTHROPIC_KEY with your API key as the value. Do not paste the */
/* key into this file; a key in source is a key in every copy of it.    */
/* ------------------------------------------------------------------ */

function askModel_(prompt) {
  var key = PropertiesService.getScriptProperties()
    .getProperty('ANTHROPIC_KEY');
  if (!key) return '';

  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (res.getResponseCode() !== 200) {
    // Returning nothing is right: the app then says the service could not
    // answer, rather than showing an error as though it were a recap.
    return '';
  }
  var out = JSON.parse(res.getContentText());
  var text = (out.content || [])
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join(' ')
    .trim();
  return text;
}

/* ------------------------------------------------------------------ */
/* 4. TESTING IT, before touching the app.                             */
/*                                                                     */
/* Run this from the Apps Script editor and read the log. If it prints  */
/* a paragraph, the deployment will work; if it prints nothing, the key */
/* or the model call is wrong and the app would have shown you the same */
/* "does not answer this yet" message without telling you why.          */
/* ------------------------------------------------------------------ */

function testRecap() {
  var sample = {
    mode: 'recap', span: 'the last month',
    pours: 16, different: 11, flights: 2, away: 3, home: 13,
    again: 4, notForMe: 1,
    whiskies: [{ name: 'Connemara 12 Year Peated', n: 2 },
               { name: 'Glen Scotia 12 Year Old', n: 2 },
               { name: 'Laphroaig 10 Cask Strength', n: 2 }],
    houses: [{ name: 'Glen Scotia', n: 2 }, { name: 'Kilbeggan', n: 2 },
             { name: 'Laphroaig', n: 2 }],
    places: [{ name: 'The Bucket Shop, Atlanta, GA', n: 2 },
             { name: 'Jack Rose, Washington, DC', n: 1 }],
    kinds: [{ name: 'bar', n: 3 }],
    cities: [{ name: 'Atlanta', n: 2 }, { name: 'Washington', n: 1 }]
  };
  Logger.log(writeRecap_(sample));
}
