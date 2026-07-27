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

  function collectPaths(root) {
    const paths = [];
    walkItems(root, item => {
      if (item.className === 'Path' || item.className === 'CompoundPath') {
        paths.push(item);
      }
    });
    return paths;
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
   * @param {{ onChange?: Function, sketchOpacity?: number, fill?: string }} opts
   */
  Organica.createTraceEditor = function (canvasEl, opts) {
    opts = opts || {};
    const onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    let viewBox = null;
    let sourceHeader = null;
    let traceRoot = null;
    let resizeObserver = null;
    let sourceSvg = '';

    paper.setup(canvasEl);

    const selectTool = new paper.Tool();
    let activeSegment = null;

    selectTool.onMouseDown = function (event) {
      const hit = paper.project.hitTest(event.point, {
        segments: true,
        stroke: true,
        fill: true,
        tolerance: 8 / paper.view.zoom,
        match: item => item.name !== 'sketch'
      });
      activeSegment = null;
      if (hit) {
        if (hit.type === 'segment') {
          activeSegment = hit.segment;
          hit.item.selected = true;
        } else if (hit.item) {
          paper.project.deselectAll();
          hit.item.selected = true;
        }
      } else {
        paper.project.deselectAll();
      }
    };

    selectTool.onMouseDrag = function (event) {
      if (activeSegment) {
        activeSegment.point = activeSegment.point.add(event.delta);
        notifyChange();
      }
    };

    selectTool.onMouseUp = function () {
      activeSegment = null;
    };

    selectTool.activate();

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
        raster.position = new paper.Point(
          viewBox.x + viewBox.width / 2,
          viewBox.y + viewBox.height / 2
        );
        const sx = viewBox.width / raster.width;
        const sy = viewBox.height / raster.height;
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

    function smoothAll() {
      if (!traceRoot) return;
      collectPaths(traceRoot).forEach(path => {
        try { path.smooth(); } catch (_) { /* open paths */ }
      });
      notifyChange();
    }

    function simplifyAll(tolerance) {
      if (!traceRoot) return;
      const tol = tolerance == null ? 2.5 : tolerance;
      collectPaths(traceRoot).forEach(path => {
        try { path.simplify(tol); } catch (_) { /* skip */ }
      });
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
      notifyChange();
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
      paper.project.clear();
      traceRoot = null;
      sourceSvg = '';
      viewBox = null;
    }

    bindResize();

    return {
      load,
      exportSvg,
      smoothAll,
      simplifyAll,
      uniteAll,
      reset,
      setSketchVisible,
      fitToView,
      destroy,
      setSketchUrl(url) { opts._sketchUrl = url; }
    };
  };

  global.Organica = Organica;
}(typeof window !== 'undefined' ? window : global));
