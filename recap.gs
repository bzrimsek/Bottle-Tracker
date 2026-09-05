/**
 * recap.gs — the written recap, for Bottlefolio's Taste screen.
 *
 * A companion to lookup.gs in the SAME project. It uses that file's json(),
 * apiHeaders_(), API and FLIGHT_MODEL, so there is nothing to configure and
 * no key to set: if bottle lookups work, this works.
 *
 * WHAT ARRIVES
 * Counts only, never the log. No dates, no log entries, nothing about who
 * was there, no note anybody wrote — the app strips all of that before it
 * posts. What is being asked for is the shape in a tally, which is the one
 * thing arithmetic cannot do: a month where every Irish whiskey was drunk
 * out somewhere is a real observation and no count states it.
 *
 *   { mode:'recap', span:'the last month',
 *     pours:16, different:11, flights:2, away:3, home:13,
 *     again:4, notForMe:1,
 *     whiskies:[{name,n}…], houses:[{name,n}…],
 *     places:[{name,n}…],  kinds:[{name,n}…], cities:[{name,n}…] }
 *
 * WHY SONNET
 * Same reasoning as designFlight: this is judgement across a shelf's worth
 * of habit, not a fact lookup. It runs when somebody presses a button, not
 * once per bottle, so the cost is a rounding error.
 *
 * WHAT IT WILL NOT DO
 * The prompt forbids inventing a whisky, a place or a number that is not in
 * the counts, and forbids reading the numbers back — the app already shows
 * those above it. An empty string is a valid answer: the app then says the
 * service could not write one, rather than showing an error as though it
 * were a recap.
 */

function writeRecap_(r) {
  var system = [
    'You write two or three sentences for somebody about their own whisky',
    'drinking over a stretch of time. You are given counts and nothing',
    'else.',
    '',
    'RULES:',
    '1. Say something the counts do not already say. A pattern, a contrast,',
    '   a change of habit, a thing they may not have noticed. The app has',
    '   already shown them the numbers directly above your sentences, so',
    '   reading them back is wasted space.',
    '2. Two or three sentences. No heading, no bullets, no preamble, no',
    '   sign-off, no markdown.',
    '3. Address them as "you". Write plainly. No tasting-note flourish, no',
    '   "it seems", no "appears to", no "interestingly".',
    '4. NAME THINGS. A bottle, a distillery, a bar, a city — if it is in',
    '   the counts, say it. "You went back to Laphroaig twice" is worth',
    '   reading; "you favoured peated expressions" is a horoscope. Be as',
    '   specific as the counts let you be.',
    '5. But NEVER name a whisky, a place, a house or a number that is not',
    '   in the counts below. Everything you say has to be traceable to a',
    '   line you were given — naming things is only worth doing if every',
    '   name is real.',
    '6. If the counts are thin, say so briefly and stop. Padding a quiet',
    '   month into a paragraph is worse than a short honest line.',
    '7. Return the sentences as plain text. Nothing else.'
  ].join('\n');

  var user = [
    'THE STRETCH: ' + (r.span || 'this stretch'),
    '',
    recapFacts_(r)
  ].join('\n');

  var res = UrlFetchApp.fetch(API, {
    method: 'post',
    contentType: 'application/json',
    headers: apiHeaders_(),
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: FLIGHT_MODEL,
      max_tokens: 400,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });

  if (res.getResponseCode() !== 200) {
    // Empty rather than an error string: the app checks the length and
    // tells them the service could not answer, which is the truth. An
    // error message shown as a recap would read as one.
    Logger.log('recap: API %s — %s', res.getResponseCode(),
      res.getContentText().slice(0, 200));
    return '';
  }

  var data = JSON.parse(res.getContentText());
  return (data.content || [])
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join(' ')
    // Same citation strip the other handlers use: the model annotates its
    // sources inline and they render as literal angle brackets.
    .replace(/<\/?cite[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The counts as lines a model can read, and nothing else. */
function recapFacts_(r) {
  var out = [];
  out.push('pours: ' + (r.pours || 0));
  out.push('different whiskies: ' + (r.different || 0));
  if (r.flights) out.push('flights run: ' + r.flights);
  out.push('poured at home: ' + (r.home || 0)
    + ' — poured somewhere else: ' + (r.away || 0));
  if (r.again || r.notForMe) {
    out.push('would pour again: ' + (r.again || 0)
      + ' — would not: ' + (r.notForMe || 0));
  }
  out.push(recapList_('most poured', r.whiskies));
  out.push(recapList_('distilleries', r.houses));
  out.push(recapList_('places', r.places));
  out.push(recapList_('kinds of place', r.kinds));
  out.push(recapList_('cities', r.cities));
  return out.filter(String).join('\n');
}

function recapList_(label, rows) {
  if (!rows || !rows.length) return '';
  return label + ': ' + rows.slice(0, 8).map(function (x) {
    return x.name + (x.n > 1 ? ' (' + x.n + ')' : '');
  }).join(', ');
}

/**
 * Run this from the editor BEFORE deploying.
 *
 * A paragraph in the log means the deployment will work. Nothing in the log
 * means it will not, and the app would have shown you the same "does not
 * answer this yet" message without telling you why.
 */
function probeRecap() {
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
  var out = writeRecap_(sample);
  Logger.log(out ? 'WORKS:\n\n' + out
                 : 'NOTHING CAME BACK — do not deploy. The lines above say why.');
}
