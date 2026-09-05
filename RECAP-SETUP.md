# Adding the recap to your lookup script

Ten minutes. Two things to do, both mechanical.

You already have everything else — your `lookup.gs` has the API key, the
headers, the `json()` helper and the Sonnet model constant, so the recap
needs none of that set up again.

---

## Step 1 — add the new file

1. Go to **script.google.com** and open your lookup project (the one with
   `lookup.gs` in it).
2. In the left sidebar, at the top of the **Files** list, click the **+**.
3. Choose **Script**.
4. It asks for a name. Type `recap` and press Enter. (Google adds the
   `.gs` itself.)
5. It creates the file with `function myFunction() {}` in it. Select all of
   that — click in the editor, **Ctrl-A** on Windows or **Cmd-A** on a
   Mac — and press **Delete**.
6. Open `recap.gs` from the drop, select all, copy.
7. Click back in the empty Apps Script editor and paste.
8. Press **Ctrl-S** (or **Cmd-S**) to save.

---

## Step 2 — one line in `doPost`

1. In the left sidebar, click **lookup.gs**.
2. Press **Ctrl-F** and search for `body.mode === 'flight'`.

You will find this:

```
  try {
    if (body.mode === 'flight') return json(designFlight(body));
    if (body.mode === 'candidates') return json(suggestBottles(body));
  } catch (err) {
```

3. Click at the end of the `candidates` line, press Enter, and type this
   as the new line beneath it:

```
    if (body.mode === 'recap') return json({ recap: writeRecap_(body) });
```

So it ends up reading:

```
  try {
    if (body.mode === 'flight') return json(designFlight(body));
    if (body.mode === 'candidates') return json(suggestBottles(body));
    if (body.mode === 'recap') return json({ recap: writeRecap_(body) });
  } catch (err) {
```

4. **Ctrl-S** to save.

That is the entire change to your existing file. One line.

---

## Step 3 — test it before deploying

1. At the top of the editor there is a dropdown of function names. Choose
   **probeRecap**.
2. Click **Run**.
3. Look at the **Execution log** at the bottom of the screen.

**If it prints `WORKS:` and a paragraph** — go on to step 4.

**If it prints `NOTHING CAME BACK`** — stop. The lines above it in the log
say why. Send me the log; do not deploy, because the app would show you
"does not answer this yet" and you would be no wiser than you are now.

---

## Step 4 — deploy

1. Click **Deploy** at the top right → **Manage deployments**.
2. Click the **pencil** icon on the deployment that is already there.

   **Do not click "New deployment."** A new one gets a new URL, and the app
   is pointed at the old one — the change would appear to do nothing.

3. Under **Version**, open the dropdown and choose **New version**.
4. Click **Deploy**.
5. Close the dialog.

**Done.** Nothing in the app changes; it is already calling that URL.

---

## Step 5 — see it work

1. Open Bottlefolio, go to **Taste**.
2. The recap is the first card. Pick a stretch that has something in it.
3. Press **Write it up**.

A few seconds, then a paragraph appears in a box where the button was.

If it still says the service does not answer this yet, the deployment did
not take — go back to step 4 and check you edited the existing deployment
rather than making a new one.
