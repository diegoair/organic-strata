/* ─────────────────────────────────────────────────────────────────────────────
 * seeds-panel.js — the Organica tabbed seed-source picker.
 *
 * Consolidates the Genesis / SVG / Text (/ Image) source picker + Genesis
 * thumbnail grid that Soul, Camo Turing and Membrane each hand-rolled. Living
 * Path is a deliberate hold-out (bespoke .seg / .drop markup, no shared CSS,
 * CDN opentype — see docs/SHARED-COMPONENTS.md).
 *
 * LOAD ORDER: core.js → (palette.js) → seeds-panel.js
 * → tool script. Pairs with shared/seeds-panel.css. The `opentype`
 * global is required only when a `text` tab is configured.
 *
 * ── Organica.seedsPanel(config) → panel ─────────────────────────────────────
 *   target        HTMLElement ⇒ GENERATE mode (build the DOM into it)
 *                 string      ⇒ ATTACH mode (wire pre-existing #<prefix>-* nodes)
 *   idPrefix      generate mode: namespace for generated ids (default 'seeds').
 *                 A page with two panels (Camo Turing) passes distinct prefixes.
 *   tabs          built-in kinds, in order — subset of
 *                 ['genesis','svg','text','image']. Default ['genesis','svg','text'].
 *   order         full display order incl. custom slot ids (default: tabs then slots)
 *   initial       id of the tab active on construct (default order[0])
 *   slots         [{ id, label, render(pane), onActivate, onDeactivate }]
 *                 tool-specific tabs. render(pane) is called ONCE; the pane is
 *                 shown/hidden, never rebuilt.
 *   subControls   { <builtinKind>(pane) } — inject tool rows INTO a built-in pane, once.
 *   extraControls (hostEl) — mount tool rows BELOW the pane stack, once.
 *   genesis       { forms, initialForm, bakeGeometry, animationsCss, hint }
 *   text          { initial, maxLength, perGlyph, allowFontUpload, preloadFont,
 *                   applyButton, hint }
 *   svg           { accept, hint }
 *   image         { accept, hint }
 *   applyMode     'immediate' (fire onSeed on every pick/upload/apply) | 'manual'
 *                 (never auto-fire; the tool calls panel.apply())
 *   onSeed(result)        result = { kind, svgString|null, descriptor, source }
 *   onTabChange(id)       fires for built-in AND slot ids
 *   onFontReady(font)     text kind: Manrope (or an upload) parsed
 *   onError(msg)          parse failures, WOFF2, empty form, font not ready
 *
 * panel → { el, getTab, setTab, getDescriptor, getSVGString, apply, emit,
 *           slot, refreshGenesisGrid, setFont, setText, destroy }
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PRIMORDIAL = [7, 56, 1, 2, 14, 33, 38, 31];

  const LABELS = { genesis: 'Genesis', svg: 'SVG', text: 'Text', image: 'Image' };

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function withXmlns(text) {
    return /xmlns=/.test(text) ? text : text.replace('<svg', '<svg xmlns="' + SVG_NS + '"');
  }

  // ── Genesis form geometry baking (ported verbatim from Camo Turing) ─────────
  // Several Genesis forms encode geometry through animations.css only,
  // so the form must be mounted live in the page (with that stylesheet linked)
  // and its computed cx/cy/r/… baked into literal attributes before it can be
  // serialised to a standalone SVG string an <img> can load.
  let rasterHost = null;
  function ensureRasterHost() {
    if (rasterHost) return rasterHost;
    rasterHost = document.createElement('div');
    rasterHost.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:200px;height:200px';
    document.body.appendChild(rasterHost);
    return rasterHost;
  }
  function bakeComputedGeometry(svgEl) {
    svgEl.querySelectorAll('*').forEach(node => {
      const cs = getComputedStyle(node);
      ['cx', 'cy', 'r', 'rx', 'ry'].forEach(p => {
        const v = cs.getPropertyValue(p);
        if (v && parseFloat(v) !== 0) node.setAttribute(p, parseFloat(v));
      });
      const isLine = node.tagName.toLowerCase() === 'line';
      node.setAttribute('fill', (cs.fill === 'none' || isLine) ? 'none' : '#000');
      node.setAttribute('stroke', (cs.fill === 'none' || isLine) ? '#000' : 'none');
      if (cs.fill === 'none' || isLine) {
        node.setAttribute('stroke-width', cs.strokeWidth && parseFloat(cs.strokeWidth) > 0 ? cs.strokeWidth : '2');
      }
      node.removeAttribute('class');
    });
  }
  function bakeFormSVG(rawSvg) {
    const host = ensureRasterHost();
    host.innerHTML = rawSvg;
    const svgEl = host.querySelector('svg');
    if (!svgEl) { host.innerHTML = ''; return null; }
    bakeComputedGeometry(svgEl);
    svgEl.setAttribute('xmlns', SVG_NS);
    const out = svgEl.outerHTML;
    host.innerHTML = '';
    return out;
  }
  function ensureAnimationsCss(href) {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (let i = 0; i < links.length; i++) {
      if ((links[i].getAttribute('href') || '').indexOf('animations.css') >= 0) return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href || '/genesis/animations.css';
    document.head.appendChild(link);
  }

  Organica.seedsPanel = function (config) {
    config = config || {};
    const genOpt = config.genesis || {};
    const txtOpt = config.text || {};
    const svgOpt = config.svg || {};
    const imgOpt = config.image || {};
    const forms = genOpt.forms || PRIMORDIAL;
    const tabKinds = config.tabs || ['genesis', 'svg', 'text'];
    const slots = config.slots || [];
    const slotIds = slots.map(s => s.id);
    const order = config.order || tabKinds.concat(slotIds);
    const applyMode = config.applyMode || 'immediate';
    const perGlyph = !!txtOpt.perGlyph;
    const onSeed = config.onSeed || function () {};
    const onTabChange = config.onTabChange || function () {};
    const onFontReady = config.onFontReady || function () {};
    const onError = config.onError || function () {};
    const prefix = config.idPrefix || 'seeds';

    const hasText = tabKinds.indexOf('text') >= 0;
    if (genOpt.bakeGeometry) ensureAnimationsCss(genOpt.animationsCss);

    // ── state ──
    let activeTab = config.initial || order[0];
    let genesisForm = ('initialForm' in genOpt) ? genOpt.initialForm : forms[0];
    let svgText = null;
    let imageEl = null;
    let font = txtOpt.font || null;
    let textValue = txtOpt.initial != null ? txtOpt.initial : 'A';

    // ── font ──
    function setFont(src) {
      try {
        if (src && typeof src.getPath === 'function') { font = src; }
        else if (src) { font = opentype.parse(src); }
        onFontReady(font);
      } catch (e) {
        onError('Could not read that font (WOFF2 is not supported — use TTF/OTF)');
      }
    }
    if (hasText && txtOpt.preloadFont !== false && !font && typeof opentype !== 'undefined') {
      fetch('/shared/vendor/manrope-variable.ttf')
        .then(r => r.arrayBuffer())
        .then(buf => { font = opentype.parse(buf); onFontReady(font); })
        .catch(() => onError('Font failed to load'));
    }

    // ── descriptor + canonical SVG string ──
    function getDescriptor() {
      if (slotIds.indexOf(activeTab) >= 0) return null;
      const d = { kind: activeTab, perGlyph: perGlyph };
      if (activeTab === 'genesis') d.formId = genesisForm;
      else if (activeTab === 'svg') d.svgText = svgText;
      else if (activeTab === 'text') {
        d.text = textValue;
        d.font = font;
        if (font && textValue) {
          const fs = 150;
          d.glyphPaths = font.getPaths(textValue, 0, fs, fs);
          d.fusedPath = font.getPath(textValue, 0, 0, fs);
        }
      } else if (activeTab === 'image') d.imageEl = imageEl;
      return d;
    }

    function textSVGString() {
      if (!font) { onError('Font still loading — try again in a moment'); return null; }
      const text = (textValue || '').trim();
      if (!text) { onError('Type some text first'); return null; }
      const fontSize = 150;
      if (perGlyph) {
        const paths = font.getPaths(text, 0, fontSize, fontSize);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const dList = paths.map(p => {
          const bb = p.getBoundingBox();
          minX = Math.min(minX, bb.x1); minY = Math.min(minY, bb.y1);
          maxX = Math.max(maxX, bb.x2); maxY = Math.max(maxY, bb.y2);
          return p.toPathData(2);
        });
        const pad = 20;
        const w = (maxX - minX) + pad * 2, h = (maxY - minY) + pad * 2;
        let s = '<svg xmlns="' + SVG_NS + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
        s += '<g fill="#0a0a0a" transform="translate(' + (pad - minX) + ' ' + (pad - minY) + ')">';
        dList.forEach(d => { s += '<path d="' + d + '"/>'; });
        s += '</g></svg>';
        return s;
      }
      const p = font.getPath(text, 0, 0, fontSize);
      const bb = p.getBoundingBox();
      const pad = 20;
      const w = (bb.x2 - bb.x1) + pad * 2, h = (bb.y2 - bb.y1) + pad * 2;
      let s = '<svg xmlns="' + SVG_NS + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
      s += '<path fill="#0a0a0a" transform="translate(' + (pad - bb.x1) + ' ' + (pad - bb.y1) + ')" d="' + p.toPathData(2) + '"/>';
      s += '</svg>';
      return s;
    }

    function getSVGString() {
      if (activeTab === 'genesis') {
        const raw = (global.ORGANIC_FORMS && global.ORGANIC_FORMS[genesisForm]) || '';
        if (!raw) { onError('Genesis form ' + genesisForm + ' not found'); return null; }
        return genOpt.bakeGeometry ? bakeFormSVG(raw) : raw;
      }
      if (activeTab === 'svg') return svgText ? withXmlns(svgText) : null;
      if (activeTab === 'text') return textSVGString();
      return null; // image / slots
    }

    // ── emit ──
    function buildResult(source) {
      const d = getDescriptor();
      return {
        kind: activeTab,
        svgString: (activeTab === 'genesis' || activeTab === 'svg' || activeTab === 'text') ? getSVGString() : null,
        descriptor: d,
        source: source || 'programmatic',
      };
    }
    function fire(source) { onSeed(buildResult(source)); }
    function apply() {
      if (slotIds.indexOf(activeTab) >= 0) return;
      fire('apply');
    }
    function emit(result) { onSeed(result); }

    // ── DOM (generate mode) ──
    const isAttach = typeof config.target === 'string';
    let root, tabStrip, panes = {}, grid, textInput;

    function id(suffix) { return prefix + '-' + suffix; }

    function buildGenerate(host) {
      root = el('div', 'seeds-panel');
      root.id = id('root');

      const row = el('div', 'ctrl-row');
      tabStrip = el('div', 'seg-ctrl');
      tabStrip.id = id('tabs');
      tabStrip.setAttribute('role', 'tablist');
      order.forEach(k => {
        const slot = slots.find(s => s.id === k);
        const b = el('button', 'seg-btn', slot ? slot.label : (LABELS[k] || k));
        b.dataset.v = k;
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => setTab(k));
        tabStrip.appendChild(b);
      });
      row.appendChild(tabStrip);
      root.appendChild(row);

      order.forEach(k => {
        const pane = el('div');
        pane.id = id('pane-' + k);
        panes[k] = pane;
        const slot = slots.find(s => s.id === k);
        if (slot) {
          if (typeof slot.render === 'function') slot.render(pane);
        } else {
          buildBuiltinPane(k, pane);
        }
        root.appendChild(pane);
      });

      if (typeof config.extraControls === 'function') {
        const extra = el('div');
        extra.id = id('extra');
        config.extraControls(extra);
        root.appendChild(extra);
      }

      host.appendChild(root);
      applyActiveTab(true);
    }

    function fileInput(accept, onText, asBuffer) {
      const inp = el('input', 'org-file-input');
      inp.type = 'file';
      inp.accept = accept;
      inp.addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onText(reader.result, file);
        if (asBuffer) reader.readAsArrayBuffer(file); else reader.readAsText(file);
        e.target.value = '';
      });
      return inp;
    }

    function buildBuiltinPane(kind, pane) {
      if (kind === 'genesis') {
        grid = el('div', 'shape-grid');
        grid.id = id('genesis-grid');
        pane.appendChild(grid);
        populateGrid();
        if (genOpt.hint) pane.appendChild(el('p', 'org-panel__hint', genOpt.hint));

      } else if (kind === 'svg') {
        const btn = el('button', 'upload-btn', '+ Upload SVG');
        const inp = fileInput(svgOpt.accept || '.svg,image/svg+xml', (txt, file) => {
          svgText = txt;
          btn.textContent = '✓ ' + file.name;
          if (applyMode === 'immediate' && activeTab === 'svg') fire('upload');
        });
        btn.addEventListener('click', () => inp.click());
        pane.appendChild(btn);
        pane.appendChild(inp);
        if (svgOpt.hint) pane.appendChild(el('p', 'org-panel__hint', svgOpt.hint));

      } else if (kind === 'text') {
        const wrap = el('div', 'ctrl-row');
        textInput = el('input', 'panel-select seeds-text-input');
        textInput.type = 'text';
        textInput.value = textValue;
        textInput.maxLength = txtOpt.maxLength || 24;
        textInput.placeholder = 'Type text…';
        textInput.setAttribute('aria-label', 'Seed text');
        textInput.addEventListener('input', () => {
          textValue = textInput.value;
          if (applyMode === 'immediate' && txtOpt.applyButton === false && activeTab === 'text') fire('input');
        });
        wrap.appendChild(textInput);
        pane.appendChild(wrap);

        if (txtOpt.applyButton !== false) {
          const ab = el('button', 'mini-btn seeds-apply', 'Apply text');
          ab.addEventListener('click', () => { if (activeTab === 'text') fire('apply'); });
          pane.appendChild(ab);
        }
        if (txtOpt.allowFontUpload) {
          const fb = el('button', 'upload-btn', 'Font: Manrope (upload to change)');
          const finp = fileInput('.ttf,.otf', (buf, file) => {
            setFont(buf);
            fb.textContent = 'Font: ' + file.name;
          }, true);
          fb.addEventListener('click', () => finp.click());
          pane.appendChild(fb);
          pane.appendChild(finp);
        }
        if (txtOpt.hint) pane.appendChild(el('p', 'org-panel__hint', txtOpt.hint));

      } else if (kind === 'image') {
        const btn = el('button', 'upload-btn', '+ Upload image');
        const inp = el('input', 'org-file-input');
        inp.type = 'file';
        inp.accept = imgOpt.accept || 'image/*';
        inp.addEventListener('change', e => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const im = new Image();
          im.onload = () => {
            imageEl = im;
            btn.textContent = '✓ ' + file.name;
            if (applyMode === 'immediate' && activeTab === 'image') fire('upload');
          };
          im.src = URL.createObjectURL(file);
          e.target.value = '';
        });
        btn.addEventListener('click', () => inp.click());
        pane.appendChild(btn);
        pane.appendChild(inp);
        if (imgOpt.hint) pane.appendChild(el('p', 'org-panel__hint', imgOpt.hint));
      }

      if (config.subControls && typeof config.subControls[kind] === 'function') {
        config.subControls[kind](pane);
      }
    }

    function populateGrid() {
      if (!grid) return;
      grid.innerHTML = '';
      forms.forEach(fid => {
        const svg = (global.ORGANIC_FORMS && global.ORGANIC_FORMS[fid]) || '';
        const thumb = el('div', 'shape-thumb' + (fid === genesisForm ? ' active' : ''),
          svg + '<span class="thumb-num">' + fid + '</span>');
        thumb.setAttribute('role', 'button');
        thumb.setAttribute('aria-label', 'Genesis form ' + fid);
        thumb.addEventListener('click', () => {
          genesisForm = fid;
          grid.querySelectorAll('.shape-thumb').forEach(t => t.classList.remove('active'));
          thumb.classList.add('active');
          if (applyMode === 'immediate' && activeTab === 'genesis') fire('pick');
        });
        grid.appendChild(thumb);
      });
    }

    // ── ATTACH mode — wire pre-existing markup by id convention ──
    function wireAttach() {
      root = document.getElementById(config.target) || document.body;
      tabStrip = document.getElementById('seg-' + config.target) ||
        document.querySelector('#' + config.target + ' .seg-ctrl');
      grid = document.getElementById(config.target + '-genesis-grid') ||
        document.getElementById('genesis-grid');
      if (tabStrip) {
        tabStrip.querySelectorAll('.seg-btn').forEach(b => {
          b.addEventListener('click', () => setTab(b.dataset.v));
        });
      }
      if (grid) {
        // rebuild the grid so clicks route through the component
        grid.innerHTML = '';
        forms.forEach(fid => {
          const svg = (global.ORGANIC_FORMS && global.ORGANIC_FORMS[fid]) || '';
          const thumb = el('div', 'shape-thumb' + (fid === genesisForm ? ' active' : ''),
            svg + '<span class="thumb-num">' + fid + '</span>');
          thumb.addEventListener('click', () => {
            genesisForm = fid;
            grid.querySelectorAll('.shape-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
            if (applyMode === 'immediate' && activeTab === 'genesis') fire('pick');
          });
          grid.appendChild(thumb);
        });
      }
      applyActiveTab(true);
    }

    // ── tab switching ──
    function applyActiveTab(silent) {
      if (tabStrip) {
        tabStrip.querySelectorAll('.seg-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.v === activeTab));
      }
      order.forEach(k => {
        const pane = panes[k] || document.getElementById(config.target + '-pane-' + k) ||
          document.getElementById('seedsrc-' + k);
        if (pane) pane.style.display = (k === activeTab) ? 'block' : 'none';
      });
      const slot = slots.find(s => s.id === activeTab);
      if (slot && typeof slot.onActivate === 'function') slot.onActivate();
      if (!silent) onTabChange(activeTab);
    }
    function setTab(k) {
      if (k === activeTab) return;
      const prev = slots.find(s => s.id === activeTab);
      if (prev && typeof prev.onDeactivate === 'function') prev.onDeactivate();
      activeTab = k;
      applyActiveTab(false);
    }

    // ── build ──
    if (isAttach) wireAttach();
    else buildGenerate(config.target);

    return {
      el: root,
      getTab: () => activeTab,
      setTab: setTab,
      getDescriptor: getDescriptor,
      getSVGString: getSVGString,
      apply: apply,
      emit: emit,
      slot: (sid) => panes[sid] || null,
      refreshGenesisGrid: populateGrid,
      setFont: setFont,
      setText: (s) => { textValue = s; if (textInput) textInput.value = s; },
      destroy: () => { if (root && root.parentNode && !isAttach) root.parentNode.removeChild(root); },
    };
  };

  Organica.seedsPanel.PRIMORDIAL = PRIMORDIAL;
})(typeof window !== 'undefined' ? window : this);
