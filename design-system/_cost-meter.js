// Cost meter (Oct 10, 2026) — a dev-only drawer for VISUAL COST TESTS: the real tool in an <iframe>, a set of
// variants switched on it, and what each one costs, measured in the browser it runs in (real GPU, real screen).
//   · Cost now — frame time of the last second (median, slowest 5 %), late (> 20 ms) and dropped (> 33 ms) frames,
//     long animation frames (Chrome) — while you use the tool in the frame.
//   · Benchmark — the same scripted moves for every variant, back to back, then a table; a row is red when that
//     variant drops more frames than the first one (the reference) on the same move.
//   · Your own sections next to them (what each variant is, headless numbers…).
// It collapses to one line (its head: the variant, median / slowest 5 % / dropped — still live) and opens again
// from that line or the page's own toggle; it remembers which per browser. First used by
// design-system/_stage-shadow.html — copy that page's shape for the next visual test.
//
//   const meter = CostMeter.mount(hostEl, {
//     frame: iframeEl,                                   // the tool under test (same origin)
//     variants: [{ id: 'none', label: 'None' }, …],      // the first one is the reference
//     setVariant: async id => {…},                       // switch the variant in the frame
//     currentLabel: () => 'Ream',                        // the variant shown now (for the head)
//     moves: [{ label: 'Pan', before: async () => {…}, run: async win => {…} }],   // the benchmark's moves
//     sections: [{ title: 'Construction', el: someEl }], // optional extra columns
//   });
//   meter.reset();  meter.toggle(open);  meter.refresh();
(function () {
  const STORE = 'organica.dev.cost-meter.open';
  const CSS = `
  .cm { flex: 0 0 auto; border-top: 1px solid var(--border); font-family: var(--font); font-size: var(--fs-small); color: var(--ink); background: var(--paper); }
  .cm__head { display: flex; align-items: center; gap: var(--space-3); width: 100%; box-sizing: border-box; padding: var(--space-2) var(--space-4); font: inherit; color: inherit; background: none; border: 0; cursor: pointer; text-align: left; }
  .cm__head b { font-family: var(--font-display); font-size: var(--fs-base); font-weight: var(--w-semibold); }
  .cm__sum { flex: 1; color: var(--mid); font-family: var(--font-display); }
  .cm__chev { width: var(--space-2); height: var(--space-2); border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-135deg); transition: transform var(--dur-fast) var(--ease-standard); }   /* a drawn chevron: up = opens */
  .cm.is-open .cm__chev { transform: rotate(45deg); }
  .cm__body { max-height: 38vh; overflow-y: auto; padding: 0 var(--space-4) var(--space-3);
    display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--space-3) var(--space-5); align-content: start; }
  .cm:not(.is-open) .cm__body { display: none; }
  .cm section { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .cm h2 { font-family: var(--font-display); font-size: var(--fs-base); margin: 0; }
  .cm__meter { display: grid; grid-template-columns: auto 1fr; gap: var(--space-1) var(--space-3); margin: 0; }
  .cm__meter dt { color: var(--mid); } .cm__meter dd { margin: 0; font-family: var(--font-display); text-align: right; }
  .cm .bad { color: var(--danger); }
  .cm table { border-collapse: collapse; width: 100%; }
  .cm th, .cm td { text-align: right; padding: var(--space-1); border-bottom: 1px solid var(--border); font-size: var(--fs-micro); }
  .cm th:nth-child(-n+2), .cm td:nth-child(-n+2) { text-align: left; }
  .cm tr.bad td { color: var(--danger); }
  .cm__explain { color: var(--mid); margin: 0; } .cm__explain b { color: var(--ink); }
  .cm button.cm__run { font: inherit; padding: var(--space-1) var(--space-3); border: 1px solid var(--border-strong); background: var(--paper); color: var(--ink); cursor: pointer; }
  .cm button.cm__run:disabled { opacity: 0.42; cursor: not-allowed; }`;

  function mount(host, o) {
    if (!document.getElementById('cost-meter-css')) { const st = document.createElement('style'); st.id = 'cost-meter-css'; st.textContent = CSS; document.head.append(st); }
    const el = document.createElement('aside');
    el.className = 'cm'; el.setAttribute('aria-label', 'Cost meter');
    el.innerHTML = `<button type="button" class="cm__head" aria-expanded="true"><b>Cost meter</b><span class="cm__sum" data-cm="sum"></span><span class="cm__chev" aria-hidden="true"></span></button>
      <div class="cm__body"><section><h2>Cost now <span class="cm__explain" data-cm="label"></span></h2>
        <dl class="cm__meter">
          <dt>Frame time · median</dt><dd data-cm="p50">–</dd>
          <dt>Frame time · slowest 5 %</dt><dd data-cm="p95">–</dd>
          <dt>Late frames (&gt; 20 ms)</dt><dd data-cm="late">–</dd>
          <dt>Dropped (&gt; 33 ms)</dt><dd data-cm="drop">–</dd>
          <dt>Long frames (Chrome)</dt><dd data-cm="loaf">–</dd>
        </dl>
        <p class="cm__explain">The last second, while you use the tool above. <b>16.7 ms</b> is a smooth 60 fps; above it the picture lags a little, above <b>33 ms</b> you see a stutter. <b>Long frames</b> are frames the browser itself flags as slow (over 50 ms of work).</p></section>
      <section><h2>Benchmark</h2>
        <button type="button" class="cm__run" data-cm="run">Run benchmark · every variant</button>
        <p class="cm__explain" data-cm="status">The same moves for each variant, in this browser: ${o.moves.map(m => '<b>' + m.label + '</b>').join(', ')}. Keep the window still while it runs.</p>
        <table data-cm="table" hidden><thead><tr><th>Variant</th><th>Move</th><th>Median</th><th>5 %</th><th>&gt;33</th><th>Long</th></tr></thead><tbody></tbody></table>
        <p class="cm__explain" data-cm="tableNote" hidden>Red = more dropped frames than <b>${o.variants[0].label}</b> on the same move. Median / 5 % = frame time in ms; &gt;33 = dropped frames; Long = ms of long frames.</p></section></div>`;
    const body = el.querySelector('.cm__body');
    (o.sections || []).forEach(s => { const sec = document.createElement('section'); sec.innerHTML = `<h2>${s.title}</h2>`; sec.append(s.el); body.append(sec); });
    host.append(el);
    const q = k => el.querySelector(`[data-cm="${k}"]`);
    let open = true;
    try { open = localStorage.getItem(STORE) !== '0'; } catch (e) {}
    const head = el.querySelector('.cm__head');
    const toggle = v => { open = v == null ? !open : !!v; el.classList.toggle('is-open', open); head.setAttribute('aria-expanded', String(open)); try { localStorage.setItem(STORE, open ? '1' : '0'); } catch (e) {} if (o.onToggle) o.onToggle(open); };
    head.addEventListener('click', () => toggle());
    toggle(open);

    // live probes in the frame's own window
    let deltas = [], loaf = [], probing = null;
    const win = () => o.frame.contentWindow;
    function startProbes() {
      const w = win(); if (!w || probing === w) return; probing = w;
      let last = 0;
      const tick = t => { if (last) deltas.push({ t, d: t - last }); last = t; if (probing === w) w.requestAnimationFrame(tick); };
      w.requestAnimationFrame(tick);
      try { new w.PerformanceObserver(l => l.getEntries().forEach(e => loaf.push({ t: e.startTime + e.duration, d: e.duration }))).observe({ type: 'long-animation-frame', buffered: false }); }
      catch (e) { q('loaf').textContent = 'n/a in this browser'; }
    }
    o.frame.addEventListener('load', () => { probing = null; startProbes(); });
    if (o.frame.contentDocument && o.frame.contentDocument.readyState === 'complete') startProbes();
    const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    const stats = list => { const ds = list.map(x => x.d); return { p50: pct(ds, 0.5), p95: pct(ds, 0.95), late: ds.filter(x => x > 20).length, drop: ds.filter(x => x > 33.4).length }; };
    setInterval(() => {
      const w = win(); if (!w || !w.performance) return;
      const now = w.performance.now(), last = deltas.filter(x => now - x.t < 1000), lf = loaf.filter(x => now - x.t < 1000);
      deltas = deltas.filter(x => now - x.t < 5000); loaf = loaf.filter(x => now - x.t < 5000);
      const s = stats(last), set = (k, v, bad) => { q(k).textContent = v; q(k).classList.toggle('bad', !!bad); };
      set('p50', s.p50.toFixed(1) + ' ms', s.p50 > 17.5); set('p95', s.p95.toFixed(1) + ' ms', s.p95 > 20);
      set('late', String(s.late), s.late > 2); set('drop', String(s.drop), s.drop > 0);
      if (q('loaf').textContent !== 'n/a in this browser') set('loaf', lf.length ? `${lf.length} · ${Math.round(lf.reduce((a, x) => a + x.d, 0))} ms` : '0', lf.length > 0);
      q('label').textContent = o.currentLabel ? '· ' + o.currentLabel() : '';
      q('sum').textContent = `${o.currentLabel ? o.currentLabel() + ' · ' : ''}median ${s.p50.toFixed(1)} ms · 5 % ${s.p95.toFixed(1)} ms · dropped ${s.drop}`;
      q('sum').classList.toggle('bad', s.drop > 0 || s.p95 > 20);
    }, 500);

    // the benchmark
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function measure(fn) {
      const w = win();
      await new Promise(r => w.requestAnimationFrame(() => w.requestAnimationFrame(r)));
      const t0 = w.performance.now();
      await fn(w);
      await sleep(300);
      const t1 = w.performance.now(), list = deltas.filter(x => x.t >= t0 && x.t <= t1), lf = loaf.filter(x => x.t >= t0 && x.t <= t1);
      return { ...stats(list), long: Math.round(lf.reduce((a, x) => a + x.d, 0)) };
    }
    q('run').addEventListener('click', async () => {
      const btn = q('run'), status = q('status'); btn.disabled = true;
      const rows = [];
      for (const m of o.moves) {
        if (m.before) await m.before();
        for (const v of o.variants) {
          await o.setVariant(v.id); await sleep(500);
          status.textContent = `Running · ${m.label} · ${v.label}…`;
          rows.push({ v, m: m.label, ...(await measure(m.run)) });
        }
      }
      const base = {}; rows.filter(r => r.v === o.variants[0]).forEach(r => { base[r.m] = r.drop; });
      q('table').querySelector('tbody').innerHTML = rows.map(r => `<tr class="${r.drop > (base[r.m] || 0) ? 'bad' : ''}"><td>${r.v.label}</td><td>${r.m}</td><td>${r.p50.toFixed(1)}</td><td>${r.p95.toFixed(1)}</td><td>${r.drop}</td><td>${r.long}</td></tr>`).join('');
      q('table').hidden = false; q('tableNote').hidden = false;
      status.textContent = `Done · ${new Date().toLocaleTimeString()} · this browser, this screen, no CPU slow-down.`;
      btn.disabled = false;
      if (o.afterRun) await o.afterRun();
    });
    return { el, toggle, isOpen: () => open, reset: () => { deltas = []; loaf = []; } };
  }
  window.CostMeter = { mount };
})();
