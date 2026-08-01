/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-paper.js
   Paper.js helpers for post-trace vector refinement.

   Contract: import is always a raster sketch → backend trace → SVG.
   This module never loads user SVG files; it only ingests trace output
   and optionally shows the same crop as a dim underlay.

   Requires paper-full.min.js before this file.
   ───────────────────────────────────────────────────────────── */

(function (global) {
  'use strict';

  const Organica = global.Organica || {};

  Organica.parseSvgViewBox = function (svgString) {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { x: 0, y: 0, width: 100, height: 100 };

    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
        return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    }

    const w = parseFloat(String(svg.getAttribute('width') || '100').replace(/[^\d.]/g, ''));
    const h = parseFloat(String(svg.getAttribute('height') || '100').replace(/[^\d.]/g, ''));
    return { x: 0, y: 0, width: w || 100, height: h || 100 };
  };

  // The <svg> header attributes exactly as the tracer wrote them, so the
  // export can reproduce them verbatim. Re-emitting the parsed NUMBERS
  // instead silently dropped the unit suffix: the backend writes
  // width="570.000000pt", and "570" (unitless = px) is a different physical
  // size — 570pt is 760px at 96dpi, so a refined export landed in Figma
  // 1.33x smaller than the unrefined one.
  Organica.parseSvgHeader = function (svgString) {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { width: null, height: null, viewBox: null };
    return {
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      viewBox: svg.getAttribute('viewBox')
    };
  };

  function walkItems(item, fn) {
    if (!item) return;
    fn(item);
    if (item.children) item.children.slice().forEach(child => walkItems(child, fn));
  }

  // Recurses through Groups (the trace's primary/secondary/detail layers)
  // but STOPS at the first Path/CompoundPath match, same rule as
  // collectTopShapes below. A CompoundPath's own children are its hole/outer
  // sub-paths, not separate drawn shapes — recursing into them too (as this
  // used to) made smoothAll/simplifyAll call .smooth()/.simplify() on both
  // the CompoundPath AND each of its own sub-paths, double-processing it
  // (harmless for simplify's math but wasted work, and the double pass on a
  // CompoundPath.smooth() briefly went through this same tree twice).
  function collectPaths(root) {
    const paths = [];
    function walk(item) {
      if (!item) return;
      if (item.className === 'Path' || item.className === 'CompoundPath') {
        paths.push(item);
        return;
      }
      if (item.children) item.children.slice().forEach(walk);
    }
    walk(root);
    return paths;
  }

  // Like collectPaths, but stops at the first Path/CompoundPath instead of
  // recursing into it — a CompoundPath's own children are its hole/outer
  // sub-paths, not separate drawn shapes, so recursing there double-counts
  // one shape as two. Used for anything shape-identity-based: labelling,
  // selection, per-shape style — collectPaths (recurses through everything)
  // stays as-is for smooth/simplify, which legitimately want every sub-path.
  function collectTopShapes(root) {
    const shapes = [];
    function walk(item) {
      if (!item) return;
      if (item.className === 'Path' || item.className === 'CompoundPath') {
        shapes.push(item);
        return;
      }
      if (item.children) item.children.slice().forEach(walk);
    }
    if (root && root.children) root.children.slice().forEach(walk);
    return shapes;
  }

  // Keep whatever style the traced SVG already carries — do NOT force a fill.
  //
  // This used to unconditionally set strokeColor=null, strokeWidth=0 and a
  // black fillColor on every path. That made the editor easy to click, but
  // the export reads back from these same items, so touching Refine silently
  // rewrote a "stroke only" trace into filled shapes and threw away Strata's
  // own Fill mode setting. Preview and export must agree (the same WYSIWYG
  // rule the rest of Organica follows), so the style survives untouched.
  //
  // The one intervention: a path with neither fill nor stroke is invisible
  // AND unhittable, which would strand the user with nothing to edit. Those
  // get the fallback fill purely so they exist on screen.
  function ensureVisible(item, fillHex) {
    walkItems(item, node => {
      if (node.className !== 'Path' && node.className !== 'CompoundPath') return;
      const hasFill = !!node.fillColor;
      const hasStroke = !!node.strokeColor && node.strokeWidth > 0;
      if (!hasFill && !hasStroke) {
        node.fillColor = new paper.Color(fillHex || '#0a0a0a');
      }
    });
  }

  /**
   * @param {HTMLCanvasElement} canvasEl
   * @param {{ onChange?: Function, sketchOpacity?: number, fill?: string,
   *           onSelectionChange?: Function, onViewChange?: Function }} opts
   */
  Organica.createTraceEditor = function (canvasEl, opts) {
    opts = opts || {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    const onSelectionChange = typeof opts.onSelectionChange === 'function' ? opts.onSelectionChange : function () {};
    const onViewChange = typeof opts.onViewChange === 'function' ? opts.onViewChange : function () {};
    let viewBox = null;
    let sourceHeader = null;
    let traceRoot = null;
    let resizeObserver = null;
    let sourceSvg = '';
    // The zoom fitToView() computes for the current content — the "100%"
    // reference point. Absolute zoom bounds don't make sense across sketches
    // (a viewBox can be 300 units wide or 4000), so wheel-zoom clamps
    // relative to this instead.
    let baseZoom = 1;

    paper.setup(canvasEl);
    canvasEl.style.cursor = 'default';   // the arrow — spacebar is what switches this to a hand

    const selectTool = new paper.Tool();
    let activeSegment = null;
    let panning = false;
    let spaceHeld = false;

    function isTypingTarget(el) {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    // Space = the pan tool, same convention as Figma/Photoshop/Illustrator.
    // Held-but-not-dragging shows the open hand ("grab"); actively dragging
    // shows the closed hand ("grabbing") — two distinct cursor states so the
    // arrow only ever means "you're selecting/editing," never "you might pan."
    // Delete/Backspace on a selected shape removes it — same convention too.
    function onKeyDown(event) {
      if (isTypingTarget(event.target)) return;
      if (event.code === 'Space') {
        if (spaceHeld) return;
        spaceHeld = true;
        if (!panning) canvasEl.style.cursor = 'grab';
        event.preventDefault();
        return;
      }
      if ((event.code === 'Delete' || event.code === 'Backspace') && selectedShape) {
        deleteSelected();
        event.preventDefault();
      }
    }
    function onKeyUp(event) {
      if (event.code !== 'Space') return;
      spaceHeld = false;
      if (!panning) canvasEl.style.cursor = 'default';
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Walk up from whatever hitTest returned to the ancestor carrying a
    // shapeLabel — a hit on a CompoundPath's hole sub-path, for instance,
    // still needs to resolve to the one labelled/selectable shape.
    function findTopShape(item) {
      let node = item;
      while (node && !(node.data && node.data.shapeLabel)) node = node.parent;
      return node || item;
    }

    let selectedShape = null;

    function notifySelectionChange() {
      onSelectionChange(getSelectedShapeStyle());
    }

    selectTool.onMouseDown = function (event) {
      if (spaceHeld) {
        panning = true;
        canvasEl.style.cursor = 'grabbing';
        return;
      }
      const hit = paper.project.hitTest(event.point, {
        segments: true,
        stroke: true,
        fill: true,
        tolerance: 8 / paper.view.zoom,
        match: item => item.name !== 'sketch'
      });
      activeSegment = null;
      panning = false;
      const prevSelected = selectedShape;
      if (hit) {
        if (hit.type === 'segment') {
          activeSegment = hit.segment;
          hit.item.selected = true;
          selectedShape = findTopShape(hit.item);
        } else if (hit.item) {
          paper.project.deselectAll();
          hit.item.selected = true;
          selectedShape = findTopShape(hit.item);
        }
      } else {
        paper.project.deselectAll();
        selectedShape = null;
      }
      if (selectedShape !== prevSelected) notifySelectionChange();
    };

    selectTool.onMouseDrag = function (event) {
      if (panning) {
        paper.view.center = paper.view.center.subtract(event.delta);
        onViewChange();
      } else if (activeSegment) {
        activeSegment.point = activeSegment.point.add(event.delta);
        notifyChange();
      }
    };

    selectTool.onMouseUp = function () {
      activeSegment = null;
      if (panning) {
        panning = false;
        canvasEl.style.cursor = spaceHeld ? 'grab' : 'default';
      }
    };

    selectTool.activate();

    // Wheel = zoom, centred on the cursor (not the view centre) — the
    // standard paper.js formula: convert the old centre→cursor vector by the
    // ratio of old/new zoom, so the point under the cursor stays put.
    function onWheel(event) {
      if (!viewBox) return;
      event.preventDefault();
      const oldZoom = paper.view.zoom;
      const factor = Math.pow(1.15, -event.deltaY / 100);
      const newZoom = Math.min(Math.max(oldZoom * factor, baseZoom * 0.05), baseZoom * 40);
      if (newZoom === oldZoom) return;

      const cursor = paper.view.viewToProject(new paper.Point(event.offsetX, event.offsetY));
      const beta = oldZoom / newZoom;
      const center = paper.view.center;
      paper.view.zoom = newZoom;
      paper.view.center = cursor.add(center.subtract(cursor).multiply(beta));
      onViewChange();
    }
    canvasEl.addEventListener('wheel', onWheel, { passive: false });

    // + / − zoom buttons — the two UI controls for zoom, alongside the wheel:
    // not everyone has a scroll wheel or trackpad handy, and buttons make the
    // zoom range discoverable instead of hidden behind a gesture.
    function zoomByFactor(factor) {
      if (!viewBox) return;
      const oldZoom = paper.view.zoom;
      const newZoom = Math.min(Math.max(oldZoom * factor, baseZoom * 0.05), baseZoom * 40);
      paper.view.zoom = newZoom;   // buttons zoom on the view centre, not a cursor point
      onViewChange();
    }
    function zoomIn() { zoomByFactor(1.25); }
    function zoomOut() { zoomByFactor(1 / 1.25); }

    function fitToView() {
      if (!viewBox) return;
      // Measure the CONTAINER, never the canvas. paper.js writes its own
      // inline width/height onto the canvas element whenever viewSize is set,
      // so measuring the canvas makes this a one-way ratchet: once paper has
      // shrunk it, getBoundingClientRect() reports the shrunken size and the
      // canvas can never grow back to fill its parent. bindResize() already
      // observes the parent, so this is also the element that drives re-fits.
      const host = canvasEl.parentElement || canvasEl;
      const rect = host.getBoundingClientRect();
      // Nothing to fit into yet — the view was just un-hidden and layout has
      // not settled. The ResizeObserver on the parent will call us again.
      if (rect.width < 2 || rect.height < 2) return;

      // viewSize is in CSS pixels — paper.js owns the backing store and
      // multiplies by its own pixelRatio internally. Setting canvasEl.width
      // /height here as well double-applied the device pixel ratio, giving a
      // canvas twice the size of its container on any HiDPI screen.
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      paper.view.viewSize = new paper.Size(w, h);
      const bounds = new paper.Rectangle(viewBox.x, viewBox.y, viewBox.width, viewBox.height);
      // paper.View has no fitBounds() — that is an Item method. Fitting a
      // rectangle into the view is done by setting zoom + center directly.
      // (The previous `paper.view.fitBounds(bounds, true)` threw a TypeError
      // inside importSVG's onLoad, so the editor never finished loading.)
      const pad = 0.94;
      paper.view.zoom = Math.min(w / bounds.width, h / bounds.height) * pad;
      paper.view.center = bounds.center;
      baseZoom = paper.view.zoom;
      onViewChange();
    }

    function notifyChange() {
      onChange();
    }

    function loadSketchUnderlay(sketchUrl) {
      if (!sketchUrl) return;
      const raster = new paper.Raster({ source: sketchUrl, crossOrigin: 'anonymous' });
      raster.name = 'sketch';
      raster.locked = true;
      raster.onLoad = function () {
        // The trace's own viewBox is padded on every side by the backend
        // (copyMakeBorder, see backend/process.py) before tracing, but the
        // sketch image is the unpadded crop — scaling it to the FULL
        // viewBox stretched it into that padding, leaving the sketch
        // ~2·pad/dimension too big and its content sitting `pad` above/left
        // of where the real traced paths start. Center position is
        // unaffected (padding is symmetric), only the scale needs the inset
        // subtracted so the sketch's own content lines up with the interior
        // box the trace was actually generated from.
        const pad = (opts.sketchPadding || 0) * 2;
        raster.position = new paper.Point(
          viewBox.x + viewBox.width / 2,
          viewBox.y + viewBox.height / 2
        );
        const sx = (viewBox.width - pad) / raster.width;
        const sy = (viewBox.height - pad) / raster.height;
        raster.scale(Math.min(sx, sy));
        raster.opacity = opts.sketchOpacity == null ? 0.32 : opts.sketchOpacity;
        raster.sendToBack();
      };
    }

    function load(svgString, sketchUrl) {
      sourceSvg = svgString;
      viewBox = Organica.parseSvgViewBox(svgString);
      sourceHeader = Organica.parseSvgHeader(svgString);
      paper.project.clear();
      traceRoot = null;

      return new Promise((resolve, reject) => {
        paper.project.importSVG(svgString, {
          expandShapes: true,
          insert: true,
          onLoad: function (item) {
            traceRoot = item;
            traceRoot.name = 'trace';
            ensureVisible(traceRoot, opts.fill || '#0a0a0a');
            // Stable per-shape identity for the whole session: labelling,
            // selection and per-shape style all key off this, not off array
            // index (which would drift the moment a shape is united/removed).
            selectedShape = null;
            collectTopShapes(traceRoot).forEach((shape, i) => {
              shape.data = shape.data || {};
              shape.data.shapeLabel = 'Shape_' + (i + 1);
              // Baseline for the live simplify slider: simplify() has to
              // recompute from the SAME starting geometry every time it
              // runs, or dragging the slider back down couldn't recover
              // detail it already discarded — it would only ever get more
              // aggressive, never less, as tolerance goes up and back down.
              shape.data.originalPathData = shape.pathData;
            });
            loadSketchUnderlay(sketchUrl);
            fitToView();
            resolve();
          },
          onError: function (err) {
            reject(err || new Error('Paper.js could not import traced SVG'));
          }
        });
      });
    }

    function exportSvg() {
      if (!traceRoot || !viewBox) return sourceSvg;
      const markup = traceRoot.exportSVG({ asString: true });
      const vb = viewBox;
      // Reuse the source's own width/height/viewBox strings so units survive
      // (see Organica.parseSvgHeader). Falling back to the parsed numbers only
      // when the source had no such attribute.
      const h = sourceHeader || {};
      const widthAttr = h.width != null ? h.width : String(vb.width);
      const heightAttr = h.height != null ? h.height : String(vb.height);
      const viewBoxAttr = h.viewBox != null ? h.viewBox
        : `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `width="${widthAttr}" height="${heightAttr}" ` +
        `viewBox="${viewBoxAttr}">\n` +
        markup +
        '\n</svg>'
      );
    }

    // A path/compound path that simplify() has reduced to zero segments is
    // invisible, unhittable and exportSVG() silently drops it from the
    // markup — but it's still sitting in traceRoot with its shapeLabel, so
    // the shape count and the style-panel pills kept referring to a "ghost"
    // shape the exported file didn't actually contain. Remove it from the
    // live model the moment it goes degenerate, so pills/count and export
    // always agree.
    function isDegenerate(shape) {
      if (shape.className === 'Path') return !shape.segments || shape.segments.length === 0;
      if (shape.className === 'CompoundPath') {
        return !shape.children || shape.children.length === 0 ||
          shape.children.every(c => !c.segments || c.segments.length === 0);
      }
      return false;
    }

    function pruneDegenerateShapes() {
      if (!traceRoot) return;
      collectTopShapes(traceRoot).forEach(shape => {
        if (isDegenerate(shape)) {
          if (shape === selectedShape) selectedShape = null;
          shape.remove();
        }
      });
    }

    // Same selection rule as style edits/simplify: a selected shape only
    // smooths itself, nothing selected smooths every shape.
    function smoothAll() {
      if (!traceRoot) return;
      const targets = selectedShape ? [selectedShape] : collectTopShapes(traceRoot);
      targets.forEach(shape => {
        collectPaths(shape).forEach(path => {
          try { path.smooth(); } catch (_) { /* open paths */ }
        });
      });
      notifyChange();
    }

    function simplifyAll(tolerance) {
      if (!traceRoot) return;
      const tol = tolerance == null ? 2.5 : tolerance;
      collectPaths(traceRoot).forEach(path => {
        try { path.simplify(tol); } catch (_) { /* skip */ }
      });
      pruneDegenerateShapes();
      notifyChange();
    }

    function uniteAll() {
      if (!traceRoot) return;
      const paths = collectPaths(traceRoot);
      if (paths.length < 2) return;

      let merged = paths[0].clone({ insert: false });
      for (let i = 1; i < paths.length; i++) {
        const next = merged.unite(paths[i], { insert: false });
        merged.remove();
        merged = next;
      }

      traceRoot.removeChildren();
      traceRoot.addChild(merged);
      // paper's boolean ops carry the first operand's style onto the result,
      // so the union already looks like the trace did. Only guard against the
      // degenerate "no fill and no stroke" case, same as on load.
      ensureVisible(merged, opts.fill || '#0a0a0a');
      // One shape now — relabel and re-baseline, or the overlay/selection/
      // live-simplify slider have nothing to point at.
      merged.data = { shapeLabel: 'Shape_1', originalPathData: merged.pathData };
      selectedShape = null;
      notifyChange();
      notifySelectionChange();
    }

    // Figma-style live simplify: re-derives from each shape's ORIGINAL
    // geometry (captured on load) every call, not from whatever the previous
    // call left behind — so dragging the slider back down actually recovers
    // detail instead of only ever being able to get more aggressive.
    // Same selection rule as style edits: a selected shape only affects
    // itself, nothing selected affects every shape.
    function simplifyLive(tolerance) {
      if (!traceRoot) return;
      const tol = tolerance == null ? 2.5 : tolerance;
      const targets = selectedShape ? [selectedShape] : collectTopShapes(traceRoot);
      targets.forEach(shape => {
        if (!shape.data || shape.data.originalPathData == null) return;
        shape.pathData = shape.data.originalPathData;
        try { shape.simplify(tol); } catch (_) { /* skip */ }
      });
      notifyChange();
    }

    // Screen-space (canvas CSS px) position for each shape's own Shape_N
    // pill — recomputed on demand rather than cached, since it must track
    // pan/zoom, which is exactly what onViewChange tells the caller to do.
    function getShapeMarkers() {
      if (!traceRoot) return [];
      return collectTopShapes(traceRoot).map(shape => {
        const pt = paper.view.projectToView(shape.position);
        return { label: shape.data.shapeLabel, x: pt.x, y: pt.y, selected: shape === selectedShape };
      });
    }

    function selectShape(label) {
      const shape = collectTopShapes(traceRoot).find(s => s.data.shapeLabel === label);
      paper.project.deselectAll();
      if (shape) shape.selected = true;
      selectedShape = shape || null;
      notifySelectionChange();
    }

    function clearSelection() {
      paper.project.deselectAll();
      selectedShape = null;
      notifySelectionChange();
    }

    function colorToHex(color, fallback) {
      return color ? color.toCSS(true) : fallback;
    }

    function getSelectedShapeStyle() {
      if (!selectedShape) return null;
      return {
        label: selectedShape.data.shapeLabel,
        fill: colorToHex(selectedShape.fillColor, null),
        stroke: colorToHex(selectedShape.strokeColor, null),
        strokeWidth: selectedShape.strokeWidth || 0,
      };
    }

    // fill/stroke/strokeWidth are each optional — only the ones passed get
    // touched, so e.g. changing just the stroke width doesn't require also
    // re-sending the current fill. No selection = every shape, so styling
    // the whole trace doesn't require clicking through 37 pills first;
    // select one shape and the same controls narrow to just it.
    function setSelectedShapeStyle(style) {
      if (!traceRoot || !style) return;
      const targets = selectedShape ? [selectedShape] : collectTopShapes(traceRoot);
      targets.forEach(shape => {
        if ('fill' in style) shape.fillColor = style.fill ? new paper.Color(style.fill) : null;
        if ('stroke' in style) shape.strokeColor = style.stroke ? new paper.Color(style.stroke) : null;
        if ('strokeWidth' in style) shape.strokeWidth = Number(style.strokeWidth) || 0;
      });
      notifyChange();
    }

    // Only ever the SELECTED shape — unlike style/simplify there is no
    // "delete all" fallback when nothing is selected, since that would
    // silently empty the whole trace from what looks like a no-op click.
    function deleteSelected() {
      if (!selectedShape) return;
      selectedShape.remove();
      selectedShape = null;
      notifyChange();
      notifySelectionChange();
    }

    function reset() {
      if (!sourceSvg) return Promise.resolve();
      return load(sourceSvg, opts._sketchUrl);
    }

    function setSketchVisible(visible) {
      const sketch = paper.project.getItem({ name: 'sketch' });
      if (sketch) sketch.visible = visible !== false;
    }

    function bindResize() {
      if (resizeObserver || typeof ResizeObserver === 'undefined') return;
      resizeObserver = new ResizeObserver(() => fitToView());
      resizeObserver.observe(canvasEl.parentElement || canvasEl);
    }

    function destroy() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      // Without this, reset()-then-retrace left the old keydown/keyup/wheel
      // listeners attached (initPaperEditor only creates a new editor when
      // state.paperEditor is null, but nothing was clearing THESE), so every
      // reset cycle stacked another copy — panning would drift multiples of
      // event.delta and zoom would compound per extra listener.
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvasEl.removeEventListener('wheel', onWheel);
      paper.project.clear();
      traceRoot = null;
      sourceSvg = '';
      viewBox = null;
      selectedShape = null;
    }

    bindResize();

    return {
      load,
      exportSvg,
      smoothAll,
      simplifyAll,
      simplifyLive,
      uniteAll,
      reset,
      setSketchVisible,
      fitToView,
      zoomIn,
      zoomOut,
      getShapeMarkers,
      selectShape,
      clearSelection,
      getSelectedShapeStyle,
      setSelectedShapeStyle,
      deleteSelected,
      destroy,
      setSketchUrl(url) { opts._sketchUrl = url; }
    };
  };

  global.Organica = Organica;
}(typeof window !== 'undefined' ? window : global));
