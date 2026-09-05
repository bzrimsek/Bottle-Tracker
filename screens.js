/* Every screen, driven directly, in seconds.
 *
 * The gap this fills. browser.js walks the app like a person — clicking
 * nav, waiting for selectors — and takes two minutes, so it is run at the
 * end and a failure in it is expensive to diagnose. Most of what it
 * catches is a screen that THREW while drawing, and that does not need
 * clicking: calling the render function is enough.
 *
 * Written after a split of renderShop broke the walk and the cause took
 * two full runs and a revert to find. The cause was a NAME COLLISION —
 * the new function reused a name that already existed, so the app called
 * the wrong body. This probe reproduced it in seven seconds, and
 * consistency.js now refuses a build with two functions sharing a name.
 *
 * It does not replace the walk. It catches the throw; the walk catches the
 * button that no longer leads anywhere.
 */
const { chromium } = require('playwright');
const path=require('path'), fs=require('fs');
const dir='/home/claude/kb';
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:900,height:900}});
  const threw=[];
  p.on('pageerror',e=>threw.push(e.message));
  await p.route('http://app.local/**', r=>{
    const n=r.request().url().split('app.local/')[1].split('?')[0]||'index.html';
    const f=path.join(dir,n);
    if(!fs.existsSync(f)) return r.fulfill({status:404,body:''});
    const t=n.endsWith('.json')?'application/json':n.endsWith('.js')?'text/javascript':n.endsWith('.png')?'image/png':'text/html';
    r.fulfill({status:200,contentType:t,body:fs.readFileSync(f)});
  });
  await p.goto('http://app.local/index.html'); await p.waitForTimeout(1200);
  const bots=JSON.parse(fs.readFileSync(path.join(dir,'bz-bottles.json'),'utf8'));
  // drive the screen directly: no clicking, no waiting on selectors
  const out = await p.evaluate(b=>{
    S.bottles=b; save_(); rebuildCatalog();
    const r={};
    ['store','plan','offer','online'].forEach(m=>{
      S.shopMode=m; S.shop={}; S.shopFound=null;
      const box=document.getElementById('shopQ'); if(box) box.value='';
      try { renderShop(); r[m]=document.querySelectorAll('#scr-shop .sheet,#scr-shop .modetile').length; }
      catch(e){ r[m]='THREW '+e.message; }
    });
    /* Every OTHER screen, called directly. The walk clicks its way to
       these and takes two minutes; a screen that throws while drawing
       does not need clicking to prove it. */
    [['home', 'renderHome'], ['shelf', 'renderShelf'],
     ['flights', 'renderFlights'], ['settings', 'renderSettings'],
     ['library', 'renderLibraryScreen'], ['shared', 'renderShared'],
     ['pour', 'renderReels'], ['info', 'renderReference'],
     ['map', 'renderMap'], ['log', 'renderHistory']].forEach(([nm, fn]) => {
      if (typeof window[fn] !== 'function') { r[nm] = 'MISSING ' + fn; return; }
      try { window[fn](); r[nm] = 'ok'; }
      catch (e) { r[nm] = 'THREW ' + e.message; }
    });

    // and a named bottle, which is the half being extracted
    try {
      S.shopMode='store'; document.getElementById('shopQ').value='Ardbeg Ten';
      renderShop();
      r.named=document.querySelectorAll('#scr-shop .sheet').length;
      r.backs=document.querySelectorAll('#shopBack').length;
    } catch(e){ r.named='THREW '+e.message; r.where=(e.stack||'').split('\n')[1]; }
    return r;
  },bots);
  const bad = Object.keys(out).filter(k => /THREW/.test(String(out[k])));
  if (bad.length || threw.length) {
    bad.forEach(k => console.log('  \u2716 ' + k + ': ' + out[k]));
    threw.forEach(t => console.log('  \u2716 threw while loading: ' + t));
    process.exitCode = 1;
  } else {
    const missing = Object.keys(out).filter(k => /MISSING/.test(String(out[k])));
    missing.forEach(k => console.log('  \u00b7 ' + k + ' ' + out[k]));
    console.log('  \u2713 ' + (Object.keys(out).length - missing.length)
      + ' screens draw without throwing, a named bottle answers ('
      + out.named + ' sheets, ' + out.backs + ' back)');
  }
  await b.close();
})();
