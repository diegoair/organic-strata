/* house.js — TuneSutra's figure: a house generated from a seed (Nov 18, 2026).
   It replaces the hand-drawn Garment, House and 5-colour Scene of figures.js
   (Diego: "porta il generatore in TuneSutra … la Figura rimane unica generata
   da questo"). Built on the design canvas "House illustration", then moved here.

   window.TUNESUTRA_HOUSE.generate(seed, n) → {
     w, h,                       the figure's own box
     zones: [{ role, d, bb }],   drawn in order (painter's algorithm); role = the colour index;
                                 bb = [x0, y0, x1, y1], the shape's own (visible) box, for its shading
     shares: [..n],              % of the figure each role covers — exact, not sampled
     parts: 'roof polygon 6 · door rectangle · window circle'
   }
   Same seed + same n → the same house, so a palette keeps its house by keeping
   its seed; the carousel steps the seed. A different n is a different house.

   THE RULES (the shares are TuneSutra's role weights, SHARES below):
     3 colours  wall 52.0 · roof 32.2 · door (+ window) 15.8
     4 colours  wall 52.0 · roof 32.2 · door 10.9 · windows 4.9
     5 colours  background 71.6 · ground 20.0 · wall 4.6 · roof 2.8 · door 1.0
     6 colours  background 71.6 · ground 20.0 · wall 3.8 · roof 2.8 · door 1.0 · windows 0.8
     7 colours  background 57.6 · ground 20.0 · hill 14.0 · wall 3.8 · roof 2.8 · door 1.0 · windows 0.8
                (Nov 19, 2026: the Hue × tone lab's rule for 6–7 colours — the 5-colour space plus a second
                accent, then a middle plane; the windows come out of the wall's share, the hill out of the
                background's. The hill is a convex arc behind the house, its height solved for its share.)
   Every part is an FVS shape (Organica.shapes), polygonal only — corner 0,
   curve 0, irregular 0 — plus the circle for windows and the curved roofs:
     roof     triangleGeometry (apex at random, kept near the middle) · dome · vault · onion · gothic
              (curved profiles sampled as fine polygons, squashed to the solved height) · the top half of a
              polygonGeometry 4–8 sides, cut at the eaves line — always above the wall, never
              hanging beside it, its base the widest part (Nov 18, 2026: Diego, "il tetto dovrebbe
              in teoria essere sempre sopra, ma delle volte la forma del tetto è strana o troppo
              grande"). The flat slab was dropped: at the roof's share it could only be a block.
     door     rectangle · polygon 5 (pointed)
     windows  circle · polygon 3–8 sides · rectangle (one, or two either side of the door)
   The wall is drawn at random; the roof height, door and windows are then SOLVED
   so each role lands on its share (a polygon stretched about the eaves line
   grows its visible area linearly, so one measurement gives the height; the
   circle's area is πr²). A draw that breaks a limit (a flat roof, a door wider
   than 42% of the wall, a window that does not fit) is thrown away and drawn again.

   LOAD ORDER: core.js (Organica.mulberry32) → shapes.js → this. PORT AS DATA + MATHS. */
(function (global) {
  'use strict';
  const SHARES = { 2: [61.8, 38.2], 3: [52.0, 32.2, 15.8], 4: [52.0, 32.2, 10.9, 4.9], 5: [71.6, 20.0, 4.6, 2.8, 1.0], 6: [71.6, 20.0, 3.8, 2.8, 1.0, 0.8], 7: [57.6, 20.0, 14.0, 3.8, 2.8, 1.0, 0.8], 8: [47.6, 20.0, 14.0, 10.0, 3.8, 2.8, 1.0, 0.8], 9: [47.6, 19.4, 14.0, 10.0, 3.8, 2.8, 1.0, 0.8, 0.6] };   // 5: the Scene's 71.8 / 20.0 / 4.6 / 2.8 / 1.0 summed to 100.2 (rounding); the background takes the difference

  const area = p => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const areaOf = p => p.c ? Math.PI * p.c[2] * p.c[2] : area(p);
  // Sutherland–Hodgman: the part of convex `subj` inside convex `cl`
  function clip(subj, cl) {
    const sg = Math.sign(cl.reduce((s, p, i) => { const q = cl[(i + 1) % cl.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0));
    let out = subj;
    for (let i = 0; i < cl.length && out.length; i++) {
      const A = cl[i], B = cl[(i + 1) % cl.length];
      const ins = p => sg * ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0])) >= 0;
      const inp = out; out = [];
      for (let j = 0; j < inp.length; j++) {
        const cur = inp[j], prev = inp[(j + inp.length - 1) % inp.length];
        const X = () => {
          const d1 = [cur[0] - prev[0], cur[1] - prev[1]], d2 = [B[0] - A[0], B[1] - A[1]];
          const t = ((A[0] - prev[0]) * d2[1] - (A[1] - prev[1]) * d2[0]) / (d1[0] * d2[1] - d1[1] * d2[0]);
          return [prev[0] + t * d1[0], prev[1] + t * d1[1]];
        };
        if (ins(cur)) { if (!ins(prev)) out.push(X()); out.push(cur); } else if (ins(prev)) out.push(X());
      }
    }
    return out;
  }
  // Curved roofs (Nov 18, 2026: Diego, "tutte e 4, schiacciate"): a profile on a base from x −1 to 1, y up
  // as negative, sampled finely enough to read as a curve. The drawn path IS the sampled polygon, so its
  // area — and the shares — stay exact. fit() then stretches it to the eaves × the solved height: on a
  // wide house that height is under the shape's natural one, so it is squashed (a dome turns elliptic).
  const ARC_N = 32;
  const mirror = L => L.concat(L.slice(0, -1).reverse().map(q => [-q[0], q[1]]));   // left half (base → apex) → whole
  const bez = (a, b, c, d, u) => [0, 1].map(i => (1 - u) ** 3 * a[i] + 3 * (1 - u) ** 2 * u * b[i] + 3 * (1 - u) * u * u * c[i] + u ** 3 * d[i]);
  const steps = f => Array.from({ length: ARC_N + 1 }, (_, i) => f(i / ARC_N));
  const CURVED = {
    // a half circle
    dome: () => steps(u => [Math.cos(Math.PI * (1 - u)), -Math.sin(Math.PI * (1 - u))]),
    // a circular segment, rise 0.45 of the half-base: meets the eaves at an angle, not upright
    vault: () => { const s = 0.45, R = (1 + s * s) / (2 * s), ph = Math.asin(1 / R);
      return steps(u => { const a = Math.PI / 2 + ph - 2 * ph * u; return [R * Math.cos(a), -(R * Math.sin(a) - (R - s))]; }); },
    // an ogee bulb with a point
    onion: () => mirror(steps(u => bez([-1, 0], [-1, -0.62], [0, -0.5], [0, -1], u))),
    // a pointed arch: two arcs of radius 1.5 half-bases, centred on the base line
    gothic: () => { const R = 1.5, end = Math.atan2(Math.sqrt(2 * R - 1), 1 - R);
      return mirror(steps(u => { const a = Math.PI + (end - Math.PI) * u; return [R - 1 + R * Math.cos(a), -R * Math.abs(Math.sin(a))]; })); },
  };
  const pts = d => d.replace(/[MZ]/g, '').trim().split(/\s*L\s*/).map(s => s.split(',').map(Number));
  const bbox = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)]; };
  const fit = (p, x0, y0, w, h) => { const b = bbox(p); return p.map(q => [x0 + (q[0] - b[0]) / (b[2] - b[0]) * w, y0 + (q[1] - b[1]) / (b[3] - b[1]) * h]); };
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const r1 = v => Math.round(v * 10) / 10;
  // one path for several shapes of one colour; a circle { c: [cx, cy, r] } as circleGeometry draws it (two arcs)
  const D = ps => ps.filter(p => p && (p.c || p.length)).map(p => p.c
    ? `M${r1(p.c[0] - p.c[2])} ${r1(p.c[1])}A${r1(p.c[2])} ${r1(p.c[2])} 0 1 1 ${r1(p.c[0] + p.c[2])} ${r1(p.c[1])}A${r1(p.c[2])} ${r1(p.c[2])} 0 1 1 ${r1(p.c[0] - p.c[2])} ${r1(p.c[1])}Z`
    : 'M' + p.map(q => r1(q[0]) + ' ' + r1(q[1])).join('L') + 'Z').join('');

  function generate(seed, n) {
    const O = global.Organica, S = O && O.shapes;
    if (!S || !O.mulberry32) throw new Error('house.js needs core.js and shapes.js');
    n = n >= 9 ? 9 : n >= 8 ? 8 : n >= 7 ? 7 : n >= 6 ? 6 : n >= 5 ? 5 : n <= 2 ? 2 : n === 3 ? 3 : 4;
    const scene = n >= 5;   // 5–9: a house in a landscape (2–4: the house alone)
    const rnd = O.mulberry32(((seed >>> 0) * 31 + n * 7919) >>> 0);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const roofPick = () => {
      const k = pick(['triangle', 'triangle', 'polygon', 'polygon', 'dome', 'vault', 'onion', 'gothic']);
      if (CURVED[k]) return { label: k, p: CURVED[k]() };
      if (k === 'triangle') { const apex = Math.round((rnd() * 2 - 1) * 30); return { label: 'triangle', p: pts(S.triangleGeometry(100, 100, apex).d) }; }
      const sides = ri(4, 8), up = sides % 2 === 1 || sides === 4 || rnd() < 0.5;
      // the polygon's top half: fitted to a 1 × 2 box centred on y = 0, cut at y = 0
      const half = clip(fit(pts(S.polygonGeometry(sides, 0, 0, 1, 100, up ? undefined : { base: 0 }).d), 0, -1, 1, 2), rect(-1, -2, 3, 2));
      const hb = bbox(half), base = half.filter(q => Math.abs(q[1]) < 1e-6).map(q => q[0]);
      // its base must be its widest part, or it reads as a mushroom over the wall
      if (base.length < 2 || Math.max.apply(null, base) - Math.min.apply(null, base) < 0.97 * (hb[2] - hb[0])) return null;
      return { label: 'polygon ' + sides, p: half };
    };
    const doorPick = () => {
      const k = pick(['rect', 'rect', 'pentagon']);   // a triangle door was tried: at half its box's area it is almost never narrow enough
      if (k === 'pentagon') return { label: 'polygon 5', p: pts(S.polygonGeometry(5, 0, 0, 1, 100).d) };
      return { label: 'rectangle', p: pts(S.roundedRectGeometry(60, 100, 0).d) };
    };
    const winPick = () => {
      if (rnd() < 0.25) { S.circleGeometry(100); return { label: 'circle', p: rect(0, 0, 100, 100), A: Math.PI * 2500, circle: true }; }
      const sides = ri(3, 8), diamond = sides === 4 && rnd() < 0.5;
      if (sides === 4 && !diamond) return { label: 'rectangle', p: pts(S.roundedRectGeometry(100, 100, 0).d) };
      return { label: 'polygon ' + sides, p: pts(S.polygonGeometry(sides, 0, 0, 1, 100).d) };
    };
    const BW = 300, BH = 240;
    for (let tries = 0; tries < 5000; tries++) {
      const roofS = roofPick(), doorS = doorPick();
      if (!roofS) continue;
      let W, H, T, R, DA, XA, x0, wallTop, yb = null, gL = 48, gR = 48;
      if (n === 2) {   // wall and roof only (Nov 19, 2026): the golden ratio, no door
        W = 60 + rnd() * 80; H = 50 + rnd() * 60; T = W * H / 0.618; R = 0.382 * T; x0 = 0; wallTop = 0; DA = 0; XA = 0;
      } else if (n < 5) {
        W = 60 + rnd() * 80; H = 50 + rnd() * 60; T = W * H / 0.678; R = 0.322 * T; x0 = 0; wallTop = 0;
        const winFrac = n === 3 && rnd() < 0.5 ? 0.25 + rnd() * 0.15 : 0;
        DA = n === 3 ? 0.158 * T * (1 - winFrac) : 0.109 * T; XA = n === 3 ? 0.158 * T * winFrac : 0.049 * T;
      } else {
        T = BW * BH; if (rnd() < 0.5) { gL = 48 + (rnd() - 0.5) * 44; gR = 96 - gL; }
        yb = x => BH - (gL + (gR - gL) * x / BW);
        W = 30 + rnd() * 60; H = T * 0.056 / W; if (H < 30 || H > 110) continue;
        x0 = 24 + rnd() * (BW - 48 - W); wallTop = (yb(x0) + yb(x0 + W)) / 2 - H; R = T * 0.028; DA = T * 0.01; XA = n >= 6 ? T * 0.008 : 0;
      }
      const wall = n < 5 ? rect(x0, wallTop, W, H) : [[x0, wallTop], [x0 + W, wallTop], [x0 + W, yb(x0 + W)], [x0, yb(x0)]];
      // the eaves overhang, in proportion to the wall: a wider roof need not climb. A triangle (half its
      // box's area) needs more of it to stay under 80% of the wall — the classic gable overhang.
      const e = (roofS.label === 'triangle' || roofS.label === 'onion' ? 0.1 + rnd() * 0.1 : rnd() * 0.12) * W, B = W + 2 * e;
      // the roof sits on the eaves line, all of it above the wall: its area grows linearly with its height
      const unit = rh => fit(roofS.p, x0 - e, wallTop - rh, B, rh);
      const vis1 = area(unit(1)) - area(clip(unit(1), wall));
      const rh = R / vis1, roof = unit(rh);
      if (rh < 0.3 * H || rh > 0.8 * H) continue;   // not flat, not a spire: never taller than 80% of the wall
      if (scene && wallTop - rh < 8) continue;
      let door = null, dx = 0, dw = 0, dh = 0, footY = 0;
      if (n !== 2) {
        const db = bbox(doorS.p), dFill = area(doorS.p) / ((db[2] - db[0]) * (db[3] - db[1]));
        dh = H * (0.42 + rnd() * 0.35); dw = DA / (dFill * dh);
        if (dw < 0.12 * W || dw > 0.42 * W) continue;
        dx = x0 + (rnd() < 0.5 ? 0.1 * W + rnd() * 0.15 * W : W - 0.1 * W - dw - rnd() * 0.15 * W);
        footY = n < 5 ? wallTop + H : Math.min(yb(dx), yb(dx + dw));
        if (scene && footY - dh < wallTop + 0.12 * H) continue;
        door = fit(doorS.p, dx, footY - dh, dw, dh);
      }
      let win = [], winLabel = '';
      if (XA > 0) {
        const ws = winPick(), two = (n === 4 || n >= 6) && rnd() < 0.4, each = two ? XA / 2 : XA;
        const freeL = dx - x0, freeR = x0 + W - (dx + dw), wy = wallTop + H * (0.18 + rnd() * 0.14);
        const k = Math.sqrt(each / (ws.A || area(ws.p))), wb = bbox(ws.p), sw = (wb[2] - wb[0]) * k, sh = (wb[3] - wb[1]) * k;
        if (wy + sh > wallTop + H * 0.82) continue;
        const place = cx => ws.circle ? { c: [cx, wy + sh / 2, sw / 2] } : fit(ws.p, cx - sw / 2, wy, sw, sh);
        if (two) { if (freeL < sw + 0.1 * W || freeR < sw + 0.1 * W) continue; win = [place(x0 + freeL / 2), place(dx + dw + freeR / 2)]; }
        else { const fr = Math.max(freeL, freeR); if (fr < sw * 1.15 + 0.1 * W) continue; win = [place(freeL > freeR ? x0 + freeL / 2 : dx + dw + freeR / 2)]; }
        winLabel = (two ? '2 × ' : '') + ws.label;
      }
      const roofVis = area(roof) - area(clip(roof, wall)), winA = win.reduce((s, p) => s + areaOf(p), 0), wallVis = area(wall) - (door ? area(door) : 0) - winA;
      // Each zone's own box (bb), for its shading (TuneSutra: every shape lit from its own top).
      // The roof's is its VISIBLE part: a polygon roof's lower half is behind the wall.
      const bbOf = p => p.c ? [p.c[0] - p.c[2], p.c[1] - p.c[2], p.c[0] + p.c[2], p.c[1] + p.c[2]] : bbox(p);
      const wb0 = bbox(wall), far = 1e5;
      const roofParts = [rect(-far, -far, 2 * far, wb0[1] + far), rect(-far, -far, wb0[0] + far, 2 * far), rect(wb0[2], -far, far, 2 * far)]
        .map(r => clip(roof, r)).filter(p => p.length > 2);
      const roofBB = bbox([].concat.apply([], roofParts.length ? roofParts : [roof]));
      const parts = 'roof ' + roofS.label + ' · door ' + doorS.label + (winLabel ? ' · window ' + winLabel : '');
      if (scene) {
        const ground = [[0, BH - gL], [BW, BH - gR], [BW, BH], [0, BH]];
        // painter's order: background, far band, hill, ground, path, the house
        const zones = [{ role: 0, d: D([rect(0, 0, BW, BH)]), bb: [0, 0, BW, BH] }];
        const off = n >= 8 ? 2 : n === 7 ? 1 : 0;   // the planes take roles 2 (hill) and 3 (far band): the house's roles move up
        const houseParts = [wall].concat(roofParts);
        // a convex arc standing on the bottom edge, cut to the frame (what is outside does not count)
        const arcOf = (cx, half) => top => { const p = []; for (let i = 0; i <= 32; i++) { const a = Math.PI * i / 32; p.push([cx - half * Math.cos(a), BH - (BH - top) * Math.sin(a)]); } return clip(p, rect(0, 0, BW, BH)); };
        // the top y whose visible area hits the target: lower top = taller arc = more area
        const solve = (arc, visOf, target) => {
          let lo = 0, hi = Math.min(BH - gL, BH - gR), poly = null, vis = 0;
          for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2, hp = arc(mid), v = visOf(hp); if (v > target) lo = mid; else hi = mid; poly = hp; vis = v; }
          return Math.abs(vis - target) > T * 0.001 ? null : { poly, vis };
        };
        let hill = null, hillVis = 0, farB = null, farVis = 0, path = null, pathVis = 0;
        if (n >= 7) {
          // the hill: in front of everything but the ground and the house (Nov 19, 2026)
          const cx = BW * (0.25 + rnd() * 0.5), half = BW * (0.75 + rnd() * 0.35);
          const visOf = hp => area(hp) - area(clip(hp, ground)) - houseParts.reduce((s2, rp) => s2 + area(clip(rp, hp)), 0);
          const h = solve(arcOf(cx, half), visOf, T * 0.14);
          if (!h) continue;   // the house is too big to leave room for the hill
          hill = h.poly; hillVis = h.vis;
        }
        if (n >= 8) {
          // the far band: a wider arc behind the hill; what the hill, the ground and the house hide does not count
          const cx = BW * (0.2 + rnd() * 0.6), half = BW * (0.95 + rnd() * 0.4);
          const visOf = fp => {
            const inHill = clip(fp, hill);
            return area(fp) - area(inHill) - area(clip(fp, ground)) + area(clip(inHill, ground))
              - houseParts.reduce((s2, rp) => { const f = clip(rp, fp); return s2 + area(f) - area(clip(f, hill)); }, 0);
          };
          const f = solve(arcOf(cx, half), visOf, T * 0.10);
          if (!f) continue;
          farB = f.poly; farVis = f.vis;
        }
        if (n >= 9) {
          // the path: a trapezoid from the door's foot to the bottom edge, its foot width solved for its share
          const cxp = dx + dw / 2, tw = dw * 0.5, hgt = BH - footY;
          const shape = bw => [[cxp - tw / 2, footY], [cxp + tw / 2, footY], [cxp + bw / 2, BH], [cxp - bw / 2, BH]];
          const visOf = bw => { const p = shape(bw); return area(p) - area(clip(p, wall)); };
          let lo = 0, hi = BW;
          if (visOf(lo) > T * 0.006 || visOf(hi) < T * 0.006 || hgt < 10) continue;
          for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (visOf(mid) > T * 0.006) hi = mid; else lo = mid; }
          path = shape((lo + hi) / 2); pathVis = visOf((lo + hi) / 2);
        }
        if (farB) zones.push({ role: 3, d: D([farB]), bb: bbOf(farB) });
        if (hill) zones.push({ role: 2, d: D([hill]), bb: bbOf(hill) });
        zones.push({ role: 1, d: D([ground]), bb: bbOf(ground) });
        if (path) zones.push({ role: 8, d: D([path]), bb: bbOf(path) });
        zones.push({ role: 3 + off, d: D([roof]), bb: roofBB }, { role: 2 + off, d: D([wall]), bb: bbOf(wall) }, { role: 4 + off, d: D([door]), bb: bbOf(door) });
        win.forEach(w => zones.push({ role: 5 + off, d: D([w]), bb: bbOf(w) }));   // one zone per window
        const bg = T - area(ground) - area(wall) - roofVis - hillVis - farVis;
        const sh = [bg, area(ground) - pathVis].concat(hill ? [hillVis] : [], farB ? [farVis] : [], [wallVis, roofVis, area(door)], n >= 6 ? [winA] : [], path ? [pathVis] : []);
        return { w: BW, h: BH, parts: parts + (hill ? ' · hill' : '') + (farB ? ' · far band' : '') + (path ? ' · path' : ''), shares: sh.map(v => 100 * v / T), zones: zones };
      }
      // the house alone: moved to the origin of its own box
      const b = bbox([].concat(wall, roof)), mv = p => p.c ? { c: [p.c[0] - b[0], p.c[1] - b[1], p.c[2]] } : p.map(q => [q[0] - b[0], q[1] - b[1]]);
      const tot = area(wall) + roofVis;
      const mb = q => [q[0] - b[0], q[1] - b[1], q[2] - b[0], q[3] - b[1]];
      const zones = [{ role: 1, d: D([mv(roof)]), bb: mb(roofBB) }, { role: 0, d: D([mv(wall)]), bb: mb(bbOf(wall)) }];
      if (door) zones.push({ role: 2, d: D([mv(door)]), bb: mb(bbOf(door)) });
      win.forEach(w => zones.push({ role: n === 3 ? 2 : 3, d: D([mv(w)]), bb: mb(bbOf(w)) }));   // one zone per window
      return {
        w: b[2] - b[0], h: b[3] - b[1], parts: parts, zones: zones,
        shares: (n === 2 ? [wallVis, roofVis] : n === 3 ? [wallVis, roofVis, area(door) + winA] : [wallVis, roofVis, area(door), winA]).map(v => 100 * v / tot),
      };
    }
    throw new Error('house.js: no house for seed ' + seed);
  }

  global.TUNESUTRA_HOUSE = { generate: generate, SHARES: SHARES };
})(typeof window !== 'undefined' ? window : globalThis);
