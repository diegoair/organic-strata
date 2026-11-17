/* figures.js — TuneSutra's figures, as data.
   A figure shows a palette IN PROPORTION: each colour role owns zones of a fixed
   share of the figure's visible area. The Garment is the reference — measured
   (visible area, later zones painting over earlier ones):

       Base 52.0%  ·  Secondary 32.2%  ·  Accent 10.9%  ·  trim (4th colour) 4.8%

   — and the House was built from a few parameters and tuned until its own
   shares land on those (within 0.2 points). With 3 colours the trim zones
   take the Accent: 52 / 32 / 16.

   window.TUNESUTRA_FIGURES = [{ id, name, note, w, h, zones: [{ role, trim?, pts }] }]
     w, h   the figure's own box; zones are drawn in order (painter's algorithm)
     role   0 Base · 1 Secondary · 2 Accent;  trim: true → colour 4 when there is one
     pts    a closed polygon, [x, y] pairs

   window.TUNESUTRA_FIGURE_SHARES(fig) → [base, secondary, accent, trim] in % of
   the visible area ([wall, floor, body, hem, collar] for TUNESUTRA_SCENE5) — measured, so the legend on the sheet and
   scripts/test-figures.mjs read the same numbers.

   Garment: from a vector Diego supplied ("Group 34.svg") — a body, a flared hem,
   a V collar and two bottom triangles. House (Nov 17, 2026, after Diego's
   photo of a wooden model house; Room and Poster retired the same day): a box
   in isometric axonometry — (x, y, z) → ((x − y)·cos30°, (x + y)/2 − z) — in
   model units W 100 · D 59 · H 80; on the left face an open side (x 3–26,
   up to 70.5) dark inside, on the right face a window band (y 25–82.5,
   z 32–42.5), a step in front of the open side (12 deep, 3.2 high, x −10–32)
   and a flat roof slab 1.6 thick (1.4 out). Base = the walls, Secondary = the
   roof, Accent = the open side and the window, trim = the step and the roof
   edge. Scaled to h 670 like the Garment. PORT AS DATA. */
window.TUNESUTRA_FIGURES = [
  {
    id: 'garment', name: 'Garment', note: 'Body, hem, collar, trim. The reference: every other figure is tuned to its shares.',
    w: 326, h: 670,
    zones: [
      { role: 0, pts: [[48, 61], [278, 61], [278, 467], [48, 467]] },
      { role: 1, pts: [[48.15, 428], [277.85, 428], [326, 584], [0, 584]] },
      { role: 2, pts: [[162.5, 241], [81.53, 60.25], [243.47, 60.25]] },
      { role: 2, trim: true, pts: [[82, 670], [43.89, 584.5], [120.11, 584.5]] },
      { role: 2, trim: true, pts: [[243, 670], [204.9, 584.5], [281.11, 584.5]] },
    ],
  },
  {
    id: 'house', name: 'House', note: 'Walls, flat roof, an open side and a window band, a step and the roof edge. Isometric.',
    w: 656.29, h: 670,
    zones: [
      { role: 0, pts: [[78.56, 463.85], [435.62, 670], [646.29, 548.37], [646.29, 218.52], [435.62, 340.15], [78.56, 134]] },   // walls (both faces, one zone)
      { role: 2, pts: [[89.27, 456.84], [171.39, 504.25], [171.39, 226.77], [89.27, 179.35]] },   // the open side — dark interior
      { role: 2, pts: [[557.03, 467.97], [351.71, 586.51], [351.71, 543.22], [557.03, 424.68]] },   // window band, right face
      { role: 2, trim: true, pts: [[42.85, 430.04], [192.82, 516.62], [149.97, 541.36], [0, 454.78]] },   // step, top
      { role: 2, trim: true, pts: [[0, 467.97], [149.97, 554.55], [149.97, 541.36], [0, 454.78]] },   // step, front
      { role: 2, trim: true, pts: [[192.82, 529.82], [149.97, 554.55], [149.97, 541.36], [192.82, 516.62]] },   // step, end
      { role: 2, trim: true, pts: [[68.56, 134], [435.62, 345.93], [435.62, 339.33], [68.56, 127.4]] },   // roof edge, left
      { role: 2, trim: true, pts: [[656.29, 218.52], [435.62, 345.93], [435.62, 339.33], [656.29, 211.93]] },   // roof edge, right
      { role: 1, pts: [[289.23, 0], [656.29, 211.93], [435.62, 339.33], [68.56, 127.4]] },   // roof
    ],
  },
];

// The 5-colour figure (Diego, Nov 17, 2026: "per 5 facciamo così", after a book page of
// small figures standing in a room — our own drawing, not a copy): a back wall (Base), a floor
// in perspective (Secondary) and the Garment standing on it — its body, hem and V collar
// (zones 0–2 of the Garment). Retuned the same day to the book's proportions, measured on its
// yellow panel (~72 / 20 / 5 / 3 / 0.7 %): wall 387 × 300 (1.29 : 1), floor 0.29 of the wall's
// height deep and skewed a quarter of its width, the garment's body 18.5 % of the wall's width
// (scale 0.3113), centred on the wall, its hem resting half way down the floor. Measured:
//     Wall 71.8 · Floor 20.0 · Body 4.6 · Hem 2.8 · Collar 1.0 %
// Not in TUNESUTRA_FIGURES (the 3–4 colour picker); used whenever the palette has 5 colours.
// PORT AS DATA.
window.TUNESUTRA_SCENE5 = {
  id: 'scene', name: 'Scene', note: 'A wall, a floor and the garment standing on it. Five colours.',
  w: 484, h: 387,
  zones: [
    { role: 0, pts: [[96.75, 0], [483.75, 0], [483.75, 300], [96.75, 300]] },
    { role: 1, pts: [[96.75, 300], [483.75, 300], [387, 387], [0, 387]] },
    { role: 2, pts: [[254.45, 180.7], [326.05, 180.7], [326.05, 307.08], [254.45, 307.08]] },
    { role: 3, pts: [[254.5, 294.94], [326, 294.94], [340.99, 343.5], [239.51, 343.5]] },
    { role: 4, pts: [[290.09, 236.73], [264.89, 180.47], [315.3, 180.47]] },
  ],
};

window.TUNESUTRA_FIGURE_SHARES = function (fig) {
  const zones = fig.zones.map(function (z) {
    const xs = z.pts.map(function (p) { return p[0]; }), ys = z.pts.map(function (p) { return p[1]; });
    return { role: z.trim ? 3 : z.role, pts: z.pts, x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
  });
  function inside(x, y, pts) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  const roles = Math.max(4, 1 + Math.max.apply(null, zones.map(function (z) { return z.role; })));   // 4 for the 3–4 colour figures, 5 for the Scene
  const count = []; for (let r = 0; r < roles; r++) count.push(0);
  for (let y = 0.5; y < fig.h; y++) {
    for (let x = 0.5; x < fig.w; x++) {
      let top = -1;
      for (let k = 0; k < zones.length; k++) {
        const z = zones[k];
        if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 && inside(x, y, z.pts)) top = z.role;
      }
      if (top >= 0) count[top]++;
    }
  }
  const total = count.reduce(function (a, b) { return a + b; }, 0);
  return count.map(function (c) { return 100 * c / total; });
};
