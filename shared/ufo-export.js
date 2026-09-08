/* ─────────────────────────────────────────────────────────────────────────────
 * ufo-export.js — Organica.ufoExport: browser-side UFO v3 + designspace writers
 * for Living Path's variable-font bundle.
 *
 * No in-browser variable-font (`gvar`) writer exists that fits Organica's
 * constraints, so Living Path exports the *masters* — a `.designspace` + one
 * UFO per master — and the actual variable binary is compiled outside with
 * standard tools:  `fontmake -m family.designspace -o variable`.
 *
 * The canonical glyph model (shared/glyph-model.js) guarantees every master
 * shares point structure per glyph, so each canonical point is emitted as a
 * cubic segment (offcurve, offcurve, on-curve) using the SAME Catmull-Rom
 * control formula as dFromSubs / subsToOTPath. Result: smooth outlines AND an
 * identical point sequence across masters → `varLib` builds `gvar` cleanly.
 *
 *   Organica.ufoExport.bundle(model, { familyName, glyphKeys }) →
 *     { 'family.designspace': xml, 'masters/<Style>.ufo/…': str, … }   (file map)
 *
 * LOAD ORDER: core.js → glyph-model.js → ufo-export.js.
 * ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';
  const Organica = global.Organica || (global.Organica = {});

  const xmlEsc = s => String(s).replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

  // ── plist ─────────────────────────────────────────────────────────────────
  function plistValue(v, ind) {
    const pad = '  '.repeat(ind);
    if (v === true) return `${pad}<true/>`;
    if (v === false) return `${pad}<false/>`;
    if (typeof v === 'number') return Number.isInteger(v)
      ? `${pad}<integer>${v}</integer>` : `${pad}<real>${v}</real>`;
    if (Array.isArray(v)) {
      if (!v.length) return `${pad}<array/>`;
      return `${pad}<array>\n${v.map(x => plistValue(x, ind + 1)).join('\n')}\n${pad}</array>`;
    }
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (!keys.length) return `${pad}<dict/>`;
      return `${pad}<dict>\n${keys.map(k =>
        `${'  '.repeat(ind + 1)}<key>${xmlEsc(k)}</key>\n${plistValue(v[k], ind + 1)}`).join('\n')}\n${pad}</dict>`;
    }
    return `${pad}<string>${xmlEsc(v)}</string>`;
  }
  function toPlist(obj) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n` +
      `<plist version="1.0">\n${plistValue(obj, 0)}\n</plist>\n`;
  }

  // ── glyph name → .glif filename (UFO spec, pragmatic subset) ──────────────
  function glifName(name, taken) {
    let base = String(name)
      .replace(/[A-Z]/g, m => m + '_')                 // "A" → "A_"
      .replace(/[^0-9a-zA-Z._-]/g, '_')
      .replace(/^\.+/, '_');                            // no leading dot
    if (!base) base = '_';
    let fn = base + '.glif', i = 1;
    while (taken.has(fn.toLowerCase())) fn = `${base}.${String(i++).padStart(6, '0')}.glif`;
    taken.add(fn.toLowerCase());
    return fn;
  }

  // ── one glyph → .glif (canonical contours → cubic points) ────────────────
  //  `cornerRef` (optional) — [contour][point] booleans from the DEFAULT
  //  master, so every master's glif shares the same line/curve structure and
  //  `varLib` can build `gvar`. Falls back to each point's own `.corner`.
  function glifForGlyph(name, g, cornerRef) {
    const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<glyph name="${xmlEsc(name)}" format="2">`];
    if (g.advance != null) lines.push(`  <advance width="${Math.round(g.advance)}"/>`);
    if (g.unicode != null && g.unicode > 0) lines.push(`  <unicode hex="${g.unicode.toString(16).toUpperCase().padStart(4, '0')}"/>`);
    if (g.contours && g.contours.length) {
      lines.push('  <outline>');
      g.contours.forEach((c, ci) => {
        const p = c.pts, n = p.length;
        const cor = (k) => (cornerRef && cornerRef[ci]) ? !!cornerRef[ci][k] : !!p[k].corner;
        if (n < 2) return;
        lines.push('    <contour>');
        // one path segment k→k2: a straight <line> when both ends are corners
        // (matches how fonts store edges), else a cubic (2 offcurve + curve)
        // via the same Catmull-Rom control formula as dFromSubs.
        const seg = (k0, k1, k2, k3) => {
          const p0 = p[k0], p1 = p[k1], p2 = p[k2], p3 = p[k3];
          if (cor(k1) && cor(k2)) {
            lines.push(`      <point x="${r(p2.x)}" y="${r(p2.y)}" type="line"/>`);
            return;
          }
          const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
          const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
          lines.push(`      <point x="${r(c1x)}" y="${r(c1y)}"/>`);
          lines.push(`      <point x="${r(c2x)}" y="${r(c2y)}"/>`);
          lines.push(`      <point x="${r(p2.x)}" y="${r(p2.y)}" type="curve"${cor(k2) ? '' : ' smooth="yes"'}/>`);
        };
        if (c.closed) {
          for (let i = 0; i < n; i++) seg((i - 1 + n) % n, i, (i + 1) % n, (i + 2) % n);
        } else {
          lines.push(`      <point x="${r(p[0].x)}" y="${r(p[0].y)}" type="move"/>`);
          for (let i = 0; i < n - 1; i++) seg(Math.max(0, i - 1), i, i + 1, Math.min(n - 1, i + 2));
        }
        lines.push('    </contour>');
      });
      lines.push('  </outline>');
    }
    lines.push('</glyph>', '');
    return lines.join('\n');
    function r(v) { return Math.round(v); }   // integer font units — fontmake rounds anyway
  }

  // ── one master → UFO file map (paths relative to the .ufo dir) ────────────
  function ufoFiles(model, masterIdx, opts) {
    const m = model.masters[masterIdx];
    const upm = model.unitsPerEm || 1000;
    const met = model.metrics || {};
    const keys = opts.glyphKeys || model.glyphOrder;
    const files = {};
    const taken = new Set(), contents = {}, order = [];

    for (const key of keys) {
      if (!(model._byKey && model._byKey[key])) continue;
      const base = model.masters[0].glyph(key);
      const g = (masterIdx === 0 || !model._masterGlyph) ? base : model._masterGlyph(masterIdx, key);
      const cornerRef = base.contours.map(c => c.pts.map(p => !!p.corner));
      const fn = glifName(key, taken);
      contents[key] = fn;
      order.push(key);
      files['glyphs/' + fn] = glifForGlyph(key, {
        advance: g.advance, unicode: base.unicode, contours: g.contours,
      }, cornerRef);
    }
    files['glyphs/contents.plist'] = toPlist(contents);
    files['metainfo.plist'] = toPlist({ creator: 'com.organica.livingpath', formatVersion: 3 });
    files['fontinfo.plist'] = toPlist({
      familyName: opts.familyName,
      styleName: opts.styleName,
      unitsPerEm: upm,
      ascender: Math.round(met.ascender != null ? met.ascender : upm * 0.8),
      descender: Math.round(met.descender != null ? met.descender : -upm * 0.2),
      xHeight: Math.round(met.xHeight || upm * 0.5),
      capHeight: Math.round(met.capHeight || upm * 0.7),
    });
    files['lib.plist'] = toPlist({ 'public.glyphOrder': order });
    return files;
  }

  // ── designspace XML ─────────────────────────────────────────────────────
  function designspaceXML(model, opts, styleFor) {
    const fam = opts.familyName;
    const axes = model.axes.map(a =>
      `    <axis tag="${xmlEsc(a.tag)}" name="${xmlEsc(a.name)}" minimum="${a.min}" maximum="${a.max}" default="${a.default}"/>`
    ).join('\n');
    const loc = (location) => model.axes.map(a => {
      const v = (location && location[a.tag] != null) ? location[a.tag] : a.default;
      return `        <dimension name="${xmlEsc(a.name)}" xvalue="${v}"/>`;
    }).join('\n');
    const sources = model.masters.map((m, i) => {
      const style = styleFor(i);
      return `    <source filename="masters/${xmlEsc(style)}.ufo" name="${xmlEsc(fam + ' ' + style)}" familyname="${xmlEsc(fam)}" stylename="${xmlEsc(style)}">\n` +
        (i === 0 ? '      <lib copy="1"/>\n      <info copy="1"/>\n' : '') +
        `      <location>\n${loc(m.location)}\n      </location>\n    </source>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<designspace format="4.1">\n` +
      `  <axes>\n${axes}\n  </axes>\n` +
      `  <sources>\n${sources}\n  </sources>\n` +
      `  <instances>\n    <instance familyname="${xmlEsc(fam)}" stylename="Regular" filename="instances/${xmlEsc(fam)}-Regular.ufo">\n` +
      `      <location>\n${loc(null)}\n      </location>\n    </instance>\n  </instances>\n</designspace>\n`;
  }

  // ── full bundle (file map for Organica.zip) ─────────────────────────────
  function bundle(model, opts) {
    opts = opts || {};
    const fam = (opts.familyName || 'LivingPath').trim() || 'LivingPath';
    const used = new Set();
    const styleFor = (i) => {
      let s = (model.masters[i].name || (i === 0 ? 'Base' : 'Master ' + i))
        .replace(/[^0-9a-zA-Z _-]/g, '').trim() || ('Master' + i);
      let base = s, n = 1;
      while (used.has(s.toLowerCase())) s = `${base} ${n++}`;
      used.add(s.toLowerCase());
      return s;
    };
    const styles = model.masters.map((_, i) => styleFor(i));
    const out = {};
    out[`${fam.replace(/\s+/g, '-')}.designspace`] = designspaceXML(model, { familyName: fam }, i => styles[i]);
    model.masters.forEach((m, i) => {
      const files = ufoFiles(model, i, { familyName: fam, styleName: styles[i], glyphKeys: opts.glyphKeys });
      for (const rel in files) out[`masters/${styles[i]}.ufo/${rel}`] = files[rel];
    });
    return out;
  }

  Organica.ufoExport = { toPlist, glifForGlyph, ufoFiles, designspaceXML, bundle };
})(typeof window !== 'undefined' ? window : this);
