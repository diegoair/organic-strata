/* Genesis Creator — select-then-fill organic composer */
(function(){
  'use strict';

  // ===== inject SVG <defs> once =====
  if (window.ORGANIC_DEFS) {
    const tmp = document.createElement('div');
    tmp.innerHTML = window.ORGANIC_DEFS;
    document.body.insertBefore(tmp.firstElementChild, document.body.firstChild);
  }

  // ===== fix form 35 (phyllotaxis) =====
  (function fillSpiral(){
    const N=44, GA=Math.PI*(3-Math.sqrt(5)), C=12;
    let s='';
    for(let i=1;i<=N;i++){
      const r=C*Math.sqrt(i);
      const a=i*GA;
      const x=(100+r*Math.cos(a)).toFixed(2);
      const y=(100+r*Math.sin(a)).toFixed(2);
      const rad=(1.4+i*0.08).toFixed(2);
      const delay=(-i*0.05).toFixed(2);
      s+=`<circle cx="${x}" cy="${y}" r="${rad}" style="animation-delay:${delay}s"/>`;
    }
    if (window.ORGANIC_FORMS && window.ORGANIC_FORMS[35]) {
      window.ORGANIC_FORMS[35] = window.ORGANIC_FORMS[35]
        .replace('></svg>', '>' + s + '</svg>');
    }
  })();

  // ===== palettes =====
  const PALETTES = [
    { name:'sky & sun',  colors:['#8ecae6','#219ebc','#023047','#ffb703','#fb8500'] },
    { name:'earth',      colors:['#001219','#005f73','#0a9396','#94d2bd','#e9d8a6','#ee9b00','#ca6702','#bb3e03','#ae2012','#9b2226'] },
    { name:'deep sea',   colors:['#03045e','#0077b6','#00b4d8','#90e0ef','#caf0f8'] },
  ];

  // ===== state =====
  const state = {
    gridSize: 10,
    paletteIndex: 0,
    brushColor: null,         // null = random from palette
    showGrid: true,
    shapes: [],               // {id, row, col, w, h, formId, color, mode}
    occ: null,                // [N][N] -> shape id or -1
    nextId: 1,

    // selection
    selection: null,          // {r1,c1,r2,c2} normalized
    dragging: false,
    dragAnchor: null,

    // background
    background: { kind:'empty', color:null },
  };

  // ===== DOM =====
  const composerFrame = document.getElementById('composerFrame');
  const composerEl = document.getElementById('composer');
  const formsGridEl = document.getElementById('formsGrid');
  const palettesEl = document.getElementById('palettes');
  const brushColorsEl = document.getElementById('brushColors');
  const bgRowEl = document.getElementById('bgRow');
  const bgColorRowEl = document.getElementById('bgColorRow');
  const gridSizeInput = document.getElementById('gridSize');
  const gridValEl = document.getElementById('gridVal');
  const gridToggle = document.getElementById('gridToggle');
  const gridLabel = document.getElementById('gridLabel');
  const placedLabel = document.getElementById('placedLabel');
  const selLabel = document.getElementById('selLabel');
  const statusEl = document.getElementById('status');
  const randomizeBtn = document.getElementById('randomize');
  const clearBtn = document.getElementById('clear');

  // ===== helpers =====
  const pad2 = n => String(n).padStart(2,'0');
  const rand = (a,b) => a + Math.floor(Math.random()*(b-a+1));
  const choice = arr => arr[Math.floor(Math.random()*arr.length)];
  const lum = hex => {
    const c=hex.replace('#','');
    const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
    return 0.2126*r+0.7152*g+0.0722*b;
  };
  const mixWithWhite = (hex,t) => {
    const c=hex.replace('#','');
    let r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
    r=Math.round(r*(1-t)+255*t);
    g=Math.round(g*(1-t)+255*t);
    b=Math.round(b*(1-t)+255*t);
    return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  };

  function pickRandomPaletteColor(){
    const cs = PALETTES[state.paletteIndex].colors.slice().sort((a,b)=>lum(b)-lum(a));
    return choice(cs.slice(1)); // skip very lightest
  }

  function inkOnBg(bgHex){
    // pick darkest palette color for contrast
    const cs = PALETTES[state.paletteIndex].colors.slice().sort((a,b)=>lum(a)-lum(b));
    return cs[0];
  }

  // ===== background patterns =====
  function buildPatternSvg(kind, ink){
    if (kind==='dots'){
      return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="10" cy="10" r="1.1" fill="${ink}" opacity=".35"/>
        <circle cx="30" cy="22" r="0.9" fill="${ink}" opacity=".28"/>
        <circle cx="18" cy="32" r="1" fill="${ink}" opacity=".22"/>
      </svg>`;
    }
    if (kind==='waves'){
      return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40">
        <path d="M0 14 Q20 6 40 14 T80 14" fill="none" stroke="${ink}" stroke-width="0.8" opacity=".22"/>
        <path d="M0 28 Q20 20 40 28 T80 28" fill="none" stroke="${ink}" stroke-width="0.8" opacity=".18"/>
      </svg>`;
    }
    if (kind==='hatch'){
      return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
        <path d="M-2 4 L4 -2 M0 14 L14 0 M10 16 L16 10" stroke="${ink}" stroke-width="0.6" opacity=".22"/>
      </svg>`;
    }
    return '';
  }

  function applyBackground(){
    const bg = state.background;
    let canvasColor = canvasBaseColor();
    let patternUrl = '';

    if (bg.kind==='color' && bg.color){
      canvasColor = bg.color;
    }
    if (bg.kind==='dots' || bg.kind==='waves' || bg.kind==='hatch'){
      // pattern ink chosen to contrast with canvasColor
      const ink = lum(canvasColor) > 160 ? '#15140f' : '#ffffff';
      const svg = buildPatternSvg(bg.kind, ink);
      patternUrl = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    }

    composerEl.style.background = patternUrl
      ? `${patternUrl} ${canvasColor}`
      : canvasColor;
    composerEl.style.backgroundSize = 'auto';
    composerEl.style.backgroundRepeat = 'repeat';

    // also keep frame's background-aware shadow legible by setting --canvas
    document.documentElement.style.setProperty('--canvas', canvasColor);
  }

  function canvasBaseColor(){
    // lightest palette color mixed with white for an airy default
    const pal = PALETTES[state.paletteIndex].colors.slice().sort((a,b)=>lum(b)-lum(a));
    return mixWithWhite(pal[0], 0.6);
  }

  // ===== UI rendering =====
  function renderPalettes(){
    palettesEl.innerHTML = '';
    PALETTES.forEach((p,idx)=>{
      const el = document.createElement('button');
      el.className = 'pal' + (state.paletteIndex===idx ? ' active' : '');
      el.title = p.name;
      p.colors.forEach(c=>{
        const sw = document.createElement('span');
        sw.className = 'sw';
        sw.style.background = c;
        el.appendChild(sw);
      });
      el.addEventListener('click', ()=>{
        state.paletteIndex = idx;
        state.brushColor = null;
        if (state.background.kind==='color') {
          state.background.color = PALETTES[idx].colors[0];
        }
        applyBackground();
        renderPalettes();
        renderBrushColors();
        renderBgColors();
      });
      palettesEl.appendChild(el);
    });
  }

  function renderBrushColors(){
    brushColorsEl.innerHTML = '';
    const auto = document.createElement('div');
    auto.className = 'bc auto' + (state.brushColor===null ? ' active' : '');
    auto.title = 'random from palette';
    auto.addEventListener('click', ()=>{ state.brushColor=null; renderBrushColors(); });
    brushColorsEl.appendChild(auto);
    PALETTES[state.paletteIndex].colors.forEach(c=>{
      const el = document.createElement('div');
      el.className = 'bc' + (state.brushColor===c ? ' active' : '');
      el.style.background = c;
      el.title = c;
      el.addEventListener('click', ()=>{ state.brushColor=c; renderBrushColors(); });
      brushColorsEl.appendChild(el);
    });
  }

  function renderBgRow(){
    bgRowEl.querySelectorAll('.bg-opt').forEach(el=>{
      el.classList.toggle('active', el.dataset.bg === state.background.kind);
    });
    bgColorRowEl.classList.toggle('hidden', state.background.kind !== 'color');
    paintBgSwatches();
    renderBgColors();
  }

  function paintBgSwatches(){
    // give each thumb a mini preview of its pattern using the current palette
    const base = canvasBaseColor();
    bgRowEl.querySelectorAll('.bg-opt').forEach(el=>{
      const k = el.dataset.bg;
      if (k==='empty'){
        el.style.background = '';
        el.classList.add('empty');
      } else if (k==='color'){
        el.classList.remove('empty');
        el.style.background = pickRandomPaletteColor();
      } else {
        el.classList.remove('empty');
        const ink = lum(base) > 160 ? '#15140f' : '#ffffff';
        const svg = buildPatternSvg(k, ink);
        const url = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
        el.style.background = url + ' ' + base;
        el.style.backgroundSize = 'auto';
      }
    });
  }

  function renderBgColors(){
    bgColorRowEl.innerHTML = '';
    PALETTES[state.paletteIndex].colors.forEach(c=>{
      const el = document.createElement('div');
      el.className = 'bg-color' + (state.background.color===c ? ' active' : '');
      el.style.background = c;
      el.title = c;
      el.addEventListener('click', ()=>{
        state.background = { kind:'color', color:c };
        applyBackground();
        renderBgRow();
      });
      bgColorRowEl.appendChild(el);
    });
  }

  function renderFormsPicker(){
    formsGridEl.innerHTML = '';
    // erase card up front
    const erase = document.createElement('div');
    erase.className = 'erase-card' + (state.selection ? '' : ' disabled');
    erase.textContent = 'Erase';
    erase.title = 'Remove shapes in selection';
    erase.addEventListener('click', ()=>{
      if (!state.selection) return;
      eraseSelection();
    });
    formsGridEl.appendChild(erase);

    for (let i=1; i<=55; i++) {
      const t = document.createElement('div');
      t.className = 'form-thumb' + (state.selection ? '' : ' disabled');
      t.title = pad2(i) + ' · ' + (window.ORGANIC_LABELS[i]||'');
      t.dataset.form = i;
      t.innerHTML = '<span class="n">'+pad2(i)+'</span>' + (window.ORGANIC_FORMS[i]||'');
      t.addEventListener('click', () => {
        if (!state.selection) {
          // briefly flash hint
          flashStatus('Select cells on the canvas first ↑');
          return;
        }
        fillSelection(i);
      });
      formsGridEl.appendChild(t);
    }
  }

  let flashTimer = null;
  function flashStatus(msg){
    statusEl.innerHTML = '<strong>' + msg + '</strong>';
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(updateStatus, 1600);
  }

  function updateStatus(){
    if (state.selection){
      const w = state.selection.c2 - state.selection.c1 + 1;
      const h = state.selection.r2 - state.selection.r1 + 1;
      statusEl.innerHTML = '<strong>' + w + ' × ' + h + ' selected</strong> · click a form to fill';
    } else {
      statusEl.textContent = 'drag on the canvas to select cells';
    }
  }

  // ===== composer build =====
  function rebuildComposer(){
    const N = state.gridSize;
    state.occ = Array.from({length:N},()=>Array(N).fill(-1));
    const surviving = [];
    state.shapes.forEach(sh=>{
      if (sh.row + sh.h > N || sh.col + sh.w > N) return;
      surviving.push(sh);
      for(let r=0;r<sh.h;r++) for(let c=0;c<sh.w;c++) {
        state.occ[sh.row+r][sh.col+c] = sh.id;
      }
    });
    state.shapes = surviving;

    composerEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
    composerEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;
    composerEl.classList.toggle('show-grid', state.showGrid);

    composerEl.innerHTML = '';
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        const cell = document.createElement('div');
        cell.className = 'gcell';
        cell.dataset.r = r; cell.dataset.c = c;
        composerEl.appendChild(cell);
      }
    }
    state.shapes.forEach(renderShape);
    renderSelection();
    applyBackground();
    updateMeta();
  }

  function renderShape(sh){
    const el = document.createElement('div');
    el.className = 'shape';
    el.dataset.id = sh.id;
    el.style.gridColumn = `${sh.col+1} / span ${sh.w}`;
    el.style.gridRow = `${sh.row+1} / span ${sh.h}`;
    el.style.setProperty('--ink', sh.color);
    el.style.setProperty('--bg-cell', 'transparent');
    let svg = window.ORGANIC_FORMS[sh.formId] || '';
    if (sh.mode === 'crop'){
      // override preserveAspectRatio to slice (crops to center)
      svg = svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
    }
    el.innerHTML = svg;
    composerEl.appendChild(el);
  }

  function renderSelection(){
    const old = composerEl.querySelector('.sel-overlay');
    if (old) old.remove();
    composerEl.querySelectorAll('.gcell.in-sel').forEach(c=>c.classList.remove('in-sel'));
    if (!state.selection) return;
    const sel = state.selection;
    for(let r=sel.r1;r<=sel.r2;r++){
      for(let c=sel.c1;c<=sel.c2;c++){
        const idx = r * state.gridSize + c;
        // gcells are first N*N children
        const cell = composerEl.children[idx];
        if (cell && cell.classList.contains('gcell')) cell.classList.add('in-sel');
      }
    }
    const ov = document.createElement('div');
    ov.className = 'sel-overlay';
    ov.style.gridColumn = `${sel.c1+1} / ${sel.c2+2}`;
    ov.style.gridRow = `${sel.r1+1} / ${sel.r2+2}`;
    composerEl.appendChild(ov);
  }

  // ===== selection (drag) =====
  function cellFromEvent(e){
    const target = e.target.closest('.gcell');
    if (!target) return null;
    return { r: +target.dataset.r, c: +target.dataset.c };
  }

  function cellFromPoint(x, y){
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const cell = el.closest('.gcell');
    if (!cell || !composerEl.contains(cell)) return null;
    return { r: +cell.dataset.r, c: +cell.dataset.c };
  }

  composerEl.addEventListener('mousedown', e=>{
    if (e.button !== 0) return;
    const c = cellFromEvent(e);
    if (!c) return;
    e.preventDefault();
    closePopover();
    state.dragging = true;
    state.dragAnchor = c;
    state.selection = { r1:c.r, c1:c.c, r2:c.r, c2:c.c };
    renderSelection();
    updateMeta();
    updateStatus();
    refreshFormsArmed();
  });

  window.addEventListener('mousemove', e=>{
    if (!state.dragging) return;
    const c = cellFromPoint(e.clientX, e.clientY);
    if (!c) return;
    const a = state.dragAnchor;
    state.selection = {
      r1: Math.min(a.r,c.r), c1: Math.min(a.c,c.c),
      r2: Math.max(a.r,c.r), c2: Math.max(a.c,c.c),
    };
    renderSelection();
    updateMeta();
    updateStatus();
  });

  window.addEventListener('mouseup', e=>{
    if (!state.dragging) return;
    state.dragging = false;
  });

  // click outside composer clears selection (but not when interacting with panels/popover)
  document.addEventListener('mousedown', e=>{
    if (e.button !== 0) return;
    if (composerEl.contains(e.target)) return;
    if (e.target.closest('.popover')) return;
    if (e.target.closest('.forms-panel')) return;
    if (e.target.closest('.tools-panel')) return;
    // click hit canvas-frame margin or far away → clear selection
    if (state.selection){
      state.selection = null;
      renderSelection();
      updateMeta();
      updateStatus();
      refreshFormsArmed();
      closePopover();
    }
  });

  // ESC to clear
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape'){
      state.selection = null;
      renderSelection();
      updateMeta();
      updateStatus();
      refreshFormsArmed();
      closePopover();
    } else if ((e.key === 'Backspace' || e.key === 'Delete') && state.selection){
      e.preventDefault();
      eraseSelection();
    }
  });

  function refreshFormsArmed(){
    const has = !!state.selection;
    formsGridEl.querySelectorAll('.form-thumb, .erase-card').forEach(el=>{
      el.classList.toggle('disabled', !has);
    });
  }

  // ===== fill / erase =====
  function fillSelection(formId){
    if (!state.selection) return;
    const sel = state.selection;
    const w = sel.c2 - sel.c1 + 1;
    const h = sel.r2 - sel.r1 + 1;
    const color = state.brushColor || pickRandomPaletteColor();

    if (w === h){
      // single shape fills the square
      removeOverlapping(sel.r1, sel.c1, w, h);
      placeShape(sel.r1, sel.c1, w, h, formId, color, 'single');
      finishFill();
    } else {
      // ask repeat vs crop
      openPopover(sel, mode => {
        removeOverlapping(sel.r1, sel.c1, w, h);
        if (mode === 'repeat'){
          for (let r = sel.r1; r <= sel.r2; r++){
            for (let c = sel.c1; c <= sel.c2; c++){
              placeShape(r, c, 1, 1, formId, color, 'single');
            }
          }
        } else { // crop
          placeShape(sel.r1, sel.c1, w, h, formId, color, 'crop');
        }
        finishFill();
      });
    }
  }

  function finishFill(){
    state.selection = null;
    renderSelection();
    updateMeta();
    updateStatus();
    refreshFormsArmed();
    closePopover();
  }

  function removeOverlapping(r,c,w,h){
    const toRemove = state.shapes.filter(sh =>
      !(sh.col + sh.w <= c || sh.col >= c + w ||
        sh.row + sh.h <= r || sh.row >= r + h));
    toRemove.forEach(sh => removeShape(sh.id));
  }

  function placeShape(r,c,w,h,formId,color,mode){
    const id = state.nextId++;
    const sh = { id, row:r, col:c, w, h, formId, color, mode };
    state.shapes.push(sh);
    for(let dr=0;dr<h;dr++) for(let dc=0;dc<w;dc++) {
      state.occ[r+dr][c+dc] = id;
    }
    renderShape(sh);
    updateMeta();
  }

  function removeShape(id){
    const idx = state.shapes.findIndex(s=>s.id===id);
    if (idx<0) return;
    const sh = state.shapes[idx];
    for(let dr=0;dr<sh.h;dr++) for(let dc=0;dc<sh.w;dc++) {
      state.occ[sh.row+dr][sh.col+dc] = -1;
    }
    state.shapes.splice(idx,1);
    const el = composerEl.querySelector('.shape[data-id="'+id+'"]');
    if (el) el.remove();
    updateMeta();
  }

  function eraseSelection(){
    const sel = state.selection;
    if (!sel) return;
    removeOverlapping(sel.r1, sel.c1, sel.c2-sel.c1+1, sel.r2-sel.r1+1);
    finishFill();
  }

  function clearCanvas(){
    state.shapes = [];
    state.selection = null;
    rebuildComposer();
    updateStatus();
    refreshFormsArmed();
  }

  // ===== popover =====
  let popoverEl = null;
  function openPopover(sel, onPick){
    closePopover();
    const ov = composerEl.querySelector('.sel-overlay');
    const ovRect = ov ? ov.getBoundingClientRect() : composerEl.getBoundingClientRect();
    const frameRect = composerFrame.getBoundingClientRect();
    popoverEl = document.createElement('div');
    popoverEl.className = 'popover';
    popoverEl.innerHTML = `
      <span class="pophead">non-square</span>
      <button data-m="repeat">Repeat</button>
      <button data-m="crop">Crop center</button>
      <button class="x" data-m="cancel" title="cancel">×</button>
    `;
    composerFrame.appendChild(popoverEl);
    // position above the selection, fall back below if off-screen
    const pop = popoverEl;
    pop.style.visibility = 'hidden';
    requestAnimationFrame(()=>{
      const popRect = pop.getBoundingClientRect();
      let left = ovRect.left - frameRect.left + (ovRect.width - popRect.width)/2;
      let top = ovRect.top - frameRect.top - popRect.height - 10;
      if (top < 4) top = ovRect.bottom - frameRect.top + 10;
      left = Math.max(4, Math.min(left, frameRect.width - popRect.width - 4));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.style.visibility = 'visible';
    });
    pop.addEventListener('click', e=>{
      const b = e.target.closest('button');
      if (!b) return;
      const m = b.dataset.m;
      if (m === 'cancel'){ closePopover(); return; }
      onPick(m);
    });
  }

  function closePopover(){
    if (popoverEl){ popoverEl.remove(); popoverEl = null; }
  }

  // ===== meta =====
  function updateMeta(){
    gridLabel.textContent = state.gridSize + ' × ' + state.gridSize;
    let used = 0;
    state.shapes.forEach(s=>used += s.w*s.h);
    placedLabel.textContent = state.shapes.length + ' shapes · ' + used + '/' + (state.gridSize*state.gridSize) + ' cells';
    if (state.selection){
      const w = state.selection.c2-state.selection.c1+1;
      const h = state.selection.r2-state.selection.r1+1;
      selLabel.textContent = w + ' × ' + h;
    } else {
      selLabel.textContent = '—';
    }
  }

  // ===== randomize =====
  function randomize(){
    clearCanvas();
    const N = state.gridSize;
    const sizesByWeight = [
      ...Array(8).fill(1),
      ...Array(5).fill(2),
      ...Array(2).fill(3),
      ...Array(1).fill(4),
    ];
    for(let r=0;r<N;r++){
      for(let c=0;c<N;c++){
        if (state.occ[r][c] !== -1) continue;
        let s = choice(sizesByWeight);
        while (s>1 && (r+s>N || c+s>N || !rectFree(r,c,s,s))) s--;
        if (s<1) continue;
        if (Math.random() < 0.18 && s===1) continue;
        const formId = rand(1,55);
        const color = pickRandomPaletteColor();
        placeShape(r,c,s,s,formId,color,'single');
      }
    }
    updateStatus();
  }
  function rectFree(r,c,w,h){
    for(let dr=0;dr<h;dr++) for(let dc=0;dc<w;dc++){
      if (state.occ[r+dr][c+dc] !== -1) return false;
    }
    return true;
  }

  // ===== wire controls =====
  bgRowEl.querySelectorAll('.bg-opt').forEach(el=>{
    el.addEventListener('click', ()=>{
      const k = el.dataset.bg;
      if (k === 'color'){
        if (!state.background.color) {
          state.background = { kind:'color', color: PALETTES[state.paletteIndex].colors[0] };
        } else {
          state.background = { kind:'color', color: state.background.color };
        }
      } else {
        state.background = { kind:k, color:null };
      }
      applyBackground();
      renderBgRow();
    });
  });

  gridSizeInput.addEventListener('input', ()=>{
    state.gridSize = parseInt(gridSizeInput.value,10);
    gridValEl.textContent = state.gridSize;
    state.selection = null;
    rebuildComposer();
    updateStatus();
    refreshFormsArmed();
  });

  gridToggle.addEventListener('change', ()=>{
    state.showGrid = gridToggle.checked;
    composerEl.classList.toggle('show-grid', state.showGrid);
  });

  randomizeBtn.addEventListener('click', randomize);
  clearBtn.addEventListener('click', clearCanvas);

  // ===== boot =====
  applyBackground();
  renderPalettes();
  renderBrushColors();
  renderBgRow();
  renderFormsPicker();
  rebuildComposer();
  updateStatus();
  refreshFormsArmed();
})();
