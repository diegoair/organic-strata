/* ─────────────────────────────────────────────────────────────
   ORGANICA — paper.js
   Paper.js helpers for post-trace vector refinement.

   Contract: import is always a raster sketch → backend trace → SVG.
   This module never loads user SVG files; it only ingests trace output
   and optionally shows the same crop as a dim underlay.

   Requires shared/vendor/paper-full.min.js before this file.
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

  // ─────────────────────────────────────────────────────────────
  // createPaperDrawEditor — a bezier editor with two modes:
  //   'draw'  (default) — click-to-place freehand drawing on a single
  //                       paper.Path (Genesis "Create / Freehand").
  //   'multi' — every contour of an imported SVG as an editable
  //             paper.CompoundPath (Genesis "Edit" of a raw-SVG seed),
  //             reached via importSVG() or load({kind:'compound'}).
  // Draw-mode behaviour and its serialize() shape are unchanged, so
  // existing freehand seeds keep loading.
  //
  // Distinct from createTraceEditor above: that factory is Strata-shaped
  // (sketch underlay, cross-shape boolean unite). This one either draws one
  // path from nothing or turns an SVG into per-contour editable anchors —
  // anchors dragged by their point, mirrored tangent handles for smoothing.
  // Additive: createTraceEditor is untouched.
  //
  // Smooth is "live" the way Creator's own hand-rolled tangentOf() was:
  // every add/drag re-derives ALL auto segments' handles via the real
  // path.smooth(), since paper.js has no live-recompute mode of its own.
  // A segment whose handle was dragged by hand is remembered in
  // manualSegments and restored after each re-smooth, so a manual edit
  // survives editing elsewhere on the path — the same persistence
  // Creator's own p.h field gave a manually-set tangent. Double-click a
  // segment to release it back to auto, matching Creator's own dblclick
  // convention for resetting a tangent.
  //
  // @param {HTMLCanvasElement} canvasEl
  // @param {{ onChange?: Function, strokeColor?: string, strokeWidth?: number }} opts
  Organica.createPaperDrawEditor = function (canvasEl, opts) {
    opts = opts || {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};

    paper.setup(canvasEl);
    canvasEl.style.cursor = 'crosshair';

    // Map project-space coordinates onto the canvas's own declared box —
    // needed when the host page draws the actual shape somewhere else (e.g.
    // Genesis's own SVG form-layer) and wants clicks/segments to land in
    // that same coordinate space (Genesis's 0–200 artboard box) rather than
    // raw canvas pixels. No-op when omitted (project space = canvas pixels
    // 1:1, the prototype test page's own default).
    if (opts.fitBox) {
      const b = opts.fitBox;
      paper.view.zoom = paper.view.viewSize.width / b.width;
      paper.view.center = new paper.Point(b.x + b.width / 2, b.y + b.height / 2);
    }
    const FIT = opts.fitBox || { x: 0, y: 0, width: paper.view.viewSize.width, height: paper.view.viewSize.height };

    const tool = new paper.Tool();

    // ── editor mode ───────────────────────────────────────────
    //  'draw'  — one hand-drawn paper.Path, anchors added by click
    //            (Genesis "Create / Freehand"). Unchanged from before.
    //  'multi' — a paper.CompoundPath whose .children are the contours of
    //            an imported seed, every anchor + handle independently
    //            editable (Genesis "Edit" of a raw-SVG seed). Reached only
    //            via importSVG() / load({kind:'compound'}).
    // Paper.js's own selection overlay (hollow anchor squares + handle
    // circles/lines) is the ONLY visual affordance for handles here — the
    // host page renders no marker layer of its own.
    let mode = 'draw';
    let path = null;               // the draw-mode path
    let root = null;               // the multi-mode CompoundPath
    let smooth = true;
    let preserveImported = false;  // multi: keep the imported curve handles until Smooth is toggled off
    let dragCtx = null;            // { kind:'segment'|'handleIn'|'handleOut', contour, index }
    let dragMoved = false;
    let lastImportedSVG = '';
    let baselineJSON = '';         // fallback undo target / simplify source
    const undoStack = [];          // multi-mode per-gesture snapshots (root.exportJSON)
    const UNDO_CAP = 20;

    function newDrawPath() {
      return new paper.Path({
        strokeColor: opts.strokeColor || '#0a0a0a',
        strokeWidth: opts.strokeWidth || 2,
        fullySelected: true,
      });
    }
    // Per-contour manual-tangent set (replaces the old single module-level
    // Set) — stored on the contour so a multi seed tracks each ring's
    // hand-tuned anchors independently.
    function manualOf(contour) {
      if (!contour.data._manual) contour.data._manual = new Set();
      return contour.data._manual;
    }
    function contourList() {
      return mode === 'multi' ? (root ? root.children : []) : (path ? [path] : []);
    }
    function snapshotBaseline() {
      baselineJSON = mode === 'multi'
        ? (root ? root.exportJSON() : '')
        : (path ? path.exportJSON() : '');
    }
    function pushUndo() {
      if (mode !== 'multi' || !root) return;
      undoStack.push(root.exportJSON());
      if (undoStack.length > UNDO_CAP) undoStack.shift();
    }
    // Full teardown so the (never-destroyed) editor can be re-seeded — a
    // fresh freehand draw, a raw-SVG import, then a freehand seed again —
    // without leaking mode / root / per-contour state / undo history.
    function resetInternal() {
      if (root) { root.remove(); root = null; }
      if (path) { path.remove(); path = null; }
      dragCtx = null;
      dragMoved = false;
      undoStack.length = 0;
      preserveImported = false;
      mode = 'draw';
      path = newDrawPath();
      snapshotBaseline();
    }

    path = newDrawPath();
    snapshotBaseline();

    function notify() { onChange(); }

    // Recompute one contour's AUTO segment handles from current point
    // positions, then restore whichever were manually tangent-edited — the
    // one deliberate divergence from a plain path.smooth(), so dragging one
    // anchor doesn't silently erase a hand-tuned tangent elsewhere.
    function resmoothContour(c) {
      if (!smooth) {
        c.segments.forEach(s => {
          s.handleIn = new paper.Point(0, 0);
          s.handleOut = new paper.Point(0, 0);
        });
        return;
      }
      // path.smooth() throws on under 2 segments (nothing to smooth yet) —
      // reachable, since a host page can toggle Closed/Smooth before the
      // user has clicked a single anchor.
      if (c.segments.length < 2) return;
      const man = manualOf(c);
      const saved = [];
      man.forEach(i => {
        const s = c.segments[i];
        if (s) saved.push({ i, hIn: s.handleIn.clone(), hOut: s.handleOut.clone() });
      });
      c.smooth({ type: 'continuous' });
      saved.forEach(({ i, hIn, hOut }) => {
        const s = c.segments[i];
        if (s) { s.handleIn = hIn; s.handleOut = hOut; }
      });
    }
    function resmooth() {
      // An imported seed's <circle>/<ellipse> contours are curved 4-segment
      // paths — re-smoothing them from scratch would diamond them. Keep
      // their handles until the user explicitly toggles Smooth off.
      if (mode === 'multi' && preserveImported) return;
      contourList().forEach(resmoothContour);
    }

    function addPoint(point) {
      if (mode !== 'draw') return;   // clicking empty canvas is inert in multi mode
      path.add(point);
      resmooth();
      snapshotBaseline();
      notify();
    }

    // Double-click a segment → release its manual tangent back to auto.
    // paper.js's Tool has no native dblclick, so it's two same-segment
    // mousedowns within 350ms.
    let lastClickTime = 0, lastClickCtx = null;
    tool.onMouseDown = function (event) {
      const list = contourList();
      let hit = null, hitContour = null;
      for (let i = 0; i < list.length; i++) {
        const h = list[i].hitTest(event.point, {
          segments: true, handles: true, tolerance: 8 / paper.view.zoom,
        });
        if (h) { hit = h; hitContour = list[i]; break; }
      }
      if (hit && hit.type === 'segment') {
        const idx = hitContour.segments.indexOf(hit.segment);
        const now = Date.now();
        if (lastClickCtx && lastClickCtx.contour === hitContour && lastClickCtx.index === idx
            && now - lastClickTime < 350) {
          manualOf(hitContour).delete(idx);
          resmoothContour(hitContour);
          notify();
          lastClickTime = 0;
          lastClickCtx = null;
          return;
        }
        lastClickTime = now;
        lastClickCtx = { contour: hitContour, index: idx };
        dragCtx = { kind: 'segment', contour: hitContour, index: idx };
        return;
      }
      lastClickCtx = null;
      if (hit && (hit.type === 'handle-in' || hit.type === 'handle-out')) {
        const idx = hitContour.segments.indexOf(hit.segment);
        dragCtx = { kind: hit.type === 'handle-in' ? 'handleIn' : 'handleOut', contour: hitContour, index: idx };
        manualOf(hitContour).add(idx);
        return;
      }
      addPoint(event.point);
    };

    tool.onMouseDrag = function (event) {
      if (!dragCtx) return;
      if (!dragMoved && mode === 'multi') pushUndo();   // snapshot the pre-drag state, once per gesture
      dragMoved = true;
      const c = dragCtx.contour;
      const seg = c.segments[dragCtx.index];
      if (!seg) return;
      if (dragCtx.kind === 'segment') {
        seg.point = seg.point.add(event.delta);
        if (smooth && !(mode === 'multi' && preserveImported)) resmoothContour(c);
        notify();
      } else if (dragCtx.kind === 'handleOut') {
        // Mirror the dragged handle onto its opposite so the anchor stays
        // smooth (a continuous tangent) rather than a hard corner.
        seg.handleOut = seg.handleOut.add(event.delta);
        seg.handleIn = seg.handleOut.multiply(-1);
        notify();
      } else {
        seg.handleIn = seg.handleIn.add(event.delta);
        seg.handleOut = seg.handleIn.multiply(-1);
        notify();
      }
    };

    tool.onMouseUp = function () {
      if (dragMoved && dragCtx && mode !== 'multi') snapshotBaseline();
      dragCtx = null;
      dragMoved = false;
    };

    tool.activate();

    function setSmooth(value) {
      smooth = !!value;
      if (!smooth) preserveImported = false;   // an explicit un-smooth straightens the imported curves
      resmooth();
      snapshotBaseline();
      notify();
    }

    function setClosed(value) {
      // Closing/opening changes which segments are adjacent (the wraparound
      // segment only exists once closed), so smoothed handles are recomputed
      // here too. Applied to every contour in multi mode.
      contourList().forEach(c => { c.closed = !!value; });
      resmooth();
      snapshotBaseline();
      notify();
    }

    function undo() {
      if (mode === 'multi') {
        if (!root) return;
        let json = undoStack.pop();
        if (json == null) json = baselineJSON;
        if (json) restoreMulti(json);
        notify();
        return;
      }
      if (!path.segments.length) return;
      const lastIndex = path.segments.length - 1;
      manualOf(path).delete(lastIndex);
      path.removeSegments(lastIndex);
      resmooth();
      snapshotBaseline();
      notify();
    }

    function clear() {
      if (mode === 'multi') { resetInternal(); notify(); return; }
      path.removeSegments();
      manualOf(path).clear();
      snapshotBaseline();
      notify();
    }

    // Re-derives from baselineJSON every call rather than compounding on the
    // previous simplify() output.
    function simplify(tolerance) {
      const tol = tolerance == null ? 2.5 : tolerance;
      if (mode === 'multi') {
        if (baselineJSON) restoreMulti(baselineJSON);
        contourList().forEach(c => { c.simplify(tol); manualOf(c).clear(); });
        notify();
        return;
      }
      path.importJSON(baselineJSON);
      path.simplify(tol);
      manualOf(path).clear();
      notify();
    }

    function getPathData() {
      if (mode === 'multi') return root ? root.pathData : '';   // one compound "M…C…Z M…C…Z" string
      return path.segments.length >= 2 ? path.pathData : '';
    }

    function getSegmentCount() {
      return contourList().reduce((n, c) => n + c.segments.length, 0);
    }

    // Serialize / restore so a host page can save a shape and re-open it
    // fully editable. Draw mode keeps the historic {json,closed,smooth,
    // manual} shape (legacy freehand seeds keep loading); multi mode is
    // tagged {kind:'compound'}.
    function serialize() {
      if (mode === 'multi') {
        return { kind: 'compound', json: root ? root.exportJSON() : '', smooth: smooth };
      }
      return {
        json: path.exportJSON(),
        closed: path.closed,
        smooth: smooth,
        manual: Array.from(manualOf(path)),
      };
    }
    function restoreMulti(json) {
      if (root) { root.remove(); root = null; }
      root = paper.project.activeLayer.importJSON(json);
      root.fillColor = null;
      root.strokeColor = opts.strokeColor || null;
      root.fullySelected = true;
      mode = 'multi';
    }
    function load(data) {
      if (!data || !data.json) return;
      if (data.kind === 'compound') {
        resetInternal();
        if (path) { path.remove(); path = null; }
        restoreMulti(data.json);
        smooth = data.smooth !== false;
        preserveImported = true;
        undoStack.length = 0;
        snapshotBaseline();
        notify();
        return;
      }
      resetInternal();
      path.importJSON(data.json);
      path.fullySelected = true;
      smooth = data.smooth !== false;
      path.closed = !!data.closed;
      const man = manualOf(path);
      man.clear();
      (data.manual || []).forEach(i => man.add(i));
      snapshotBaseline();
      notify();
    }

    // Turn an arbitrary SVG string into a CompoundPath of independently
    // editable contours. expandShapes converts <circle>/<ellipse>/<rect>/
    // <line>/<polygon> to real paths; applyMatrix bakes nested <g>
    // transforms into segment coordinates.
    function importSVG(svgString) {
      resetInternal();
      if (path) { path.remove(); path = null; }
      lastImportedSVG = svgString || '';

      let imported = null;
      try {
        imported = paper.project.importSVG(svgString, { expandShapes: true, insert: true, applyMatrix: true });
      } catch (e) { imported = null; }
      if (!imported) { path = newDrawPath(); mode = 'draw'; snapshotBaseline(); notify(); return; }

      const leaves = [];
      (function walk(item) {
        if (!item) return;
        if (item.className === 'Path') { leaves.push(item); return; }
        if (item.className === 'CompoundPath') { (item.children || []).slice().forEach(c => leaves.push(c)); return; }
        if (item.children) item.children.slice().forEach(walk);
      })(imported);

      // viewBox → fitBox (defensive; Genesis seeds are already "0 0 200 200")
      const vb = Organica.parseSvgViewBox(svgString);
      const needFit = vb && (vb.x !== FIT.x || vb.y !== FIT.y || vb.width !== FIT.width || vb.height !== FIT.height);
      const m = needFit
        ? new paper.Matrix().translate(FIT.x, FIT.y).scale(FIT.width / vb.width, FIT.height / vb.height).translate(-vb.x, -vb.y)
        : null;

      const cloned = leaves.map(function (p) {
        const c = p.clone({ insert: false });
        if (m) c.transform(m);
        c.fillColor = null;
        c.strokeColor = opts.strokeColor || null;
        return c;
      });
      imported.remove();

      root = new paper.CompoundPath({ children: cloned, insert: true });
      root.fillColor = null;
      root.strokeColor = opts.strokeColor || null;
      root.fullySelected = true;

      mode = 'multi';
      preserveImported = true;
      smooth = true;
      undoStack.length = 0;
      snapshotBaseline();
      notify();
    }

    // Which of fill / stroke the source SVG actually used, so the host can
    // pick the right render style (a stroke-authored seed like a sunburst
    // has open contours that only read as strokes).
    function getImportedStyleHint() {
      const res = { fill: false, stroke: false, strokeWidth: 0 };
      try {
        const doc = new DOMParser().parseFromString(lastImportedSVG || '', 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (!svg) { res.fill = true; return res; }
        const els = [svg].concat(Array.prototype.slice.call(
          svg.querySelectorAll('path,circle,ellipse,rect,line,polygon,polyline,g')));
        els.forEach(function (el) {
          const style = el.getAttribute('style') || '';
          const f = (el.getAttribute('fill') || '').trim();
          const s = (el.getAttribute('stroke') || '').trim();
          if ((f && f !== 'none') || /fill\s*:\s*(?!none)[^;]+/i.test(style)) res.fill = true;
          if ((s && s !== 'none') || /stroke\s*:\s*(?!none)[^;]+/i.test(style)) res.stroke = true;
          const wAttr = parseFloat(el.getAttribute('stroke-width'));
          const wStyle = parseFloat((style.match(/stroke-width\s*:\s*([\d.]+)/i) || [])[1]);
          if (!isNaN(wAttr)) res.strokeWidth = wAttr;
          else if (!isNaN(wStyle)) res.strokeWidth = wStyle;
        });
        // <line>/<polyline> have no fill area — a seed built from them (a
        // sunburst, a hatch) only reads as strokes, even when the source left
        // styling to CSS classes and set no attributes at all.
        if (svg.querySelector('line,polyline')) res.stroke = true;
        if (!res.fill && !res.stroke) res.fill = true;   // SVG default is fill:black
      } catch (e) { res.fill = true; }
      return res;
    }

    function isMulti() { return mode === 'multi'; }

    function destroy() {
      tool.remove();
      if (root) root.remove();
      if (path) path.remove();
    }

    return {
      setSmooth,
      setClosed,
      undo,
      clear,
      simplify,
      getPathData,
      getSegmentCount,
      serialize,
      load,
      importSVG,
      getImportedStyleHint,
      isMulti,
      destroy,
    };
  };

  global.Organica = Organica;
}(typeof window !== 'undefined' ? window : global));
