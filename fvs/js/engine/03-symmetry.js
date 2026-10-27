// Flexible Visual System · engine/03-symmetry — plane symmetry groups over a part of a Symbol (Oct 27, 2026 — Diego:
// "seguendo le più complesse regole di geometria gli algoritmi mi suggerissero creazioni che da solo non riuscirei a
// vedere"). Pure maths, no state: cells in (their places), for each cell the cell it copies (its orbit's representative)
// and the turn / mirror it copies it with. A Zone that follows a group (engine/11-zones ZONE_FOLLOW 'wallpaper',
// 'rosette') then gives every cell its representative's content, posed by that operation — so the zone *is* a pattern of
// that group, whatever content the representatives hold.
//
// Poses are elements of the dihedral group: { r: degrees (clockwise on screen, as SVG rotate), f: mirrored (flipH) },
// meaning "mirror first, then turn" — the order a cell's transform has (flipV = turn 180° after flipH).
// Map docs/FVS.md §6c.

export const poseOf = c => {
  let r = +c.rotation || 0, f = !!c.flipH;
  if (c.flipV) { r += 180; f = !f; }
  return { r: ((r % 360) + 360) % 360, f };
};
// a ∘ b: first b, then a.  (R_a F^fa)(R_b F^fb) = R(a ± b) F^(fa xor fb), with F R_b = R_-b F.
export function composePose(a, b) {
  const r = a.r + (a.f ? -b.r : b.r);
  return { r: Math.round((((r % 360) + 360) % 360) * 1000) / 1000, f: a.f !== b.f };
}
const ID = { r: 0, f: false };
// A pose acting on a point (screen coordinates, y down) about the origin: mirror x, then turn clockwise.
function act(p, x, y) {
  if (p.f) x = -x;
  const t = p.r * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  return [x * c - y * s, x * s + y * c];
}

// ── The 12 wallpaper groups a square lattice carries, as generators on a tile of n × n cells (n even for the ones with a
// glide or a 4-fold centre off a cell). Each generator: { p: pose, t: [tx, ty] in tile units } acting about the tile's
// centre: q' = c + p(q − c) + t·n. The tile repeats by translation (p1). Names as the International Union of
// Crystallography writes them; the plain words for a tooltip in WALLPAPER_WORDS.
const G = (r, f, tx = 0, ty = 0) => ({ p: { r, f }, t: [tx, ty] });
export const WALLPAPER = {
  p1: [],
  p2: [G(180, false)],
  pm: [G(0, true)],
  pg: [G(0, true, 0, 0.5)],
  cm: [G(90, true)],
  pmm: [G(0, true), G(180, true)],
  pmg: [G(0, true), G(180, true, 0.5, 0)],
  pgg: [G(0, true, 0, 0.5), G(180, true, 0.5, 0)],
  cmm: [G(90, true), G(270, true)],
  p4: [G(90, false)],
  p4m: [G(90, false), G(0, true)],
  p4g: [G(90, false), G(0, true, 0.5, 0.5)],
};
export const WALLPAPER_WORDS = {
  p1: 'a tile repeated', p2: 'half turns', pm: 'mirrors', pg: 'glides', cm: 'diagonal mirrors', pmm: 'mirrors both ways',
  pmg: 'mirrors and glides', pgg: 'glides both ways', cmm: 'mirrors on both diagonals', p4: 'quarter turns',
  p4m: 'quarter turns and mirrors', p4g: 'quarter turns and glides',
};
const find = (par, a) => { while (par[a] !== a) a = par[a]; return a; };   // no path compression: each link carries a pose
// Cells by lattice place: idxs (the zone's cells), cr[i] = {col, row}. → Map(i → { rep, pose }) or null when the zone
// does not carry the group (fewer than 95 % of its cells map onto cells of the zone).
export function wallpaperMap(idxs, cr, group, n) {
  const gens = WALLPAPER[group];
  if (!gens || !idxs.length) return null;
  n = Math.max(1, Math.round(n || 2));
  const c0 = Math.min(...idxs.map(i => cr[i].col)), r0 = Math.min(...idxs.map(i => cr[i].row));
  const at = new Map(), local = new Map();
  idxs.forEach(i => { const u = cr[i].col - c0, v = cr[i].row - r0; at.set(u + ',' + v, i); local.set(i, [u, v]); });
  // the tile-local place of each cell, and its first copy (the one in the zone's first tile row / column)
  const key = (u, v) => (((u % n) + n) % n) + ',' + (((v % n) + n) % n);
  const firstOf = new Map();
  idxs.forEach(i => { const [u, v] = local.get(i), k = key(u, v); const f = firstOf.get(k); if (f == null || local.get(f)[1] > v || (local.get(f)[1] === v && local.get(f)[0] > u)) firstOf.set(k, i); });
  // union-find over the tile's places under the generators; track the pose from a place to its parent
  const places = [...firstOf.keys()], ix = new Map(places.map((k, j) => [k, j]));
  const par = places.map((_, j) => j), poseToPar = places.map(() => ID), onAxis = new Set();
  let mapped = 0, tried = 0;
  const half = n / 2;
  places.forEach((k, j) => {
    const [u, v] = k.split(',').map(Number);
    gens.forEach(g => {
      tried++;
      const [x, y] = act(g.p, u + 0.5 - half, v + 0.5 - half);
      const qu = Math.floor(x + half + g.t[0] * n + 1e-6), qv = Math.floor(y + half + g.t[1] * n + 1e-6);
      const j2 = ix.get(key(qu, qv));
      if (j2 == null) return;
      mapped++;
      // place j2 = g(place j): pose of j2 = g ∘ pose of j
      const a = find(par, j), b = find(par, j2);
      if (a === b) {   // already one orbit: a second path that disagrees = a place the group sends onto itself (a mirror or a centre runs through the cell)
        const want = composePose(g.p, relPose(par, poseToPar, j)), have = relPose(par, poseToPar, j2);
        if (want.f !== have.f || Math.abs(want.r - have.r) > 1e-6) { onAxis.add(j); onAxis.add(j2); }
        return;
      }
      // pose(j) = relJ ∘ pose(a), pose(j2) = relJ2 ∘ pose(b), pose(j2) = g ∘ pose(j) → pose(b) = relJ2⁻¹ ∘ g ∘ relJ ∘ pose(a)
      const relJ = relPose(par, poseToPar, j), relJ2 = relPose(par, poseToPar, j2);
      const want = composePose(invPose(relJ2), composePose(g.p, relJ));
      par[b] = a; poseToPar[b] = want;
    });
  });
  if (gens.length && tried && mapped / tried < 0.95) return null;
  if (gens.length && onAxis.size * 2 > places.length) return null;   // a tile too small for the group: most places on an axis
  const out = new Map();
  idxs.forEach(i => {
    const [u, v] = local.get(i), j = ix.get(key(u, v)), root = find(par, j);
    out.set(i, { rep: firstOf.get(places[root]), pose: relPose(par, poseToPar, j), ...(onAxis.has(j) ? { axis: true } : {}) });
  });
  return out;   // m.axis: the cell lies on a mirror or a centre of the group — exact only for a content that is itself symmetric
}
function invPose(p) { return p.f ? { r: p.r, f: true } : { r: ((360 - p.r) % 360), f: false }; }   // a mirror-then-turn is its own inverse
function relPose(par, poseToPar, j) {   // pose(j) = relPose(j) ∘ pose(root): T_j ∘ T_parent ∘ … (each link: pose(k) = T_k ∘ pose(par[k]))
  let p = ID, k = j;
  while (par[k] !== k) { p = composePose(p, poseToPar[k]); k = par[k]; }
  return p;
}

// ── Rosettes: m-fold turns about the zone's centre (Cm), + mirrors (Dm). Any grid — radial, hexagonal, triangular,
// square — whose cells map onto each other within tol (a share of the median cell size). pts[i] = [x, y] centres.
export function rosetteMap(idxs, pts, m, mirror, tol) {
  if (!idxs.length || m < 1) return null;
  const cx = idxs.reduce((t, i) => t + pts[i][0], 0) / idxs.length, cy = idxs.reduce((t, i) => t + pts[i][1], 0) / idxs.length;
  const near = (x, y) => { let bi = -1, bd = Infinity; idxs.forEach(i => { const d = Math.hypot(pts[i][0] - x, pts[i][1] - y); if (d < bd) { bd = d; bi = i; } }); return bd <= tol ? bi : -1; };
  const gens = [{ r: 360 / m, f: false }];
  if (mirror) gens.push({ r: 0, f: true });
  const ord = idxs.slice().sort((a, b) => (Math.hypot(pts[a][0] - cx, pts[a][1] - cy) - Math.hypot(pts[b][0] - cx, pts[b][1] - cy)) || (Math.atan2(pts[a][1] - cy, pts[a][0] - cx) - Math.atan2(pts[b][1] - cy, pts[b][0] - cx)));
  const pos = new Map(ord.map((i, k) => [i, k]));
  const par = ord.map((_, k) => k), poseToPar = ord.map(() => ID);
  let mapped = 0, tried = 0;
  ord.forEach((i, k) => gens.forEach(g => {
    tried++;
    const [x, y] = act(g, pts[i][0] - cx, pts[i][1] - cy), j = near(x + cx, y + cy);
    if (j < 0) return;
    mapped++;
    const k2 = pos.get(j), a = find(par, k), b = find(par, k2);
    if (a === b) return;
    const want = composePose(invPose(relPose(par, poseToPar, k2)), composePose(g, relPose(par, poseToPar, k)));
    par[b] = a; poseToPar[b] = want;
  }));
  if (tried && mapped / tried < 0.95) return null;
  const out = new Map();
  ord.forEach((i, k) => { const root = find(par, k); out.set(i, { rep: ord[root], pose: relPose(par, poseToPar, k) }); });
  return out;
}
