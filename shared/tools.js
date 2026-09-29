/* tools.js — the tool list, as data. Read by the header's mega menu (shared/header.js).
   The only tool navigation since the hub's side-nav was removed (Sep 29, 2026 — the old hub is
   kept at /archive/hub-bento/); scripts/check.py fails if a link here doesn't resolve to a file.
   Load BEFORE header.js.

   Grouped (Sep 29, 2026) by what you start from, left → right the way work flows:
   shape → source image → pattern → colour → type → motion. One row of six columns,
   at most five links each. Rhizome is not one tool among the others — it chains
   them — so it lives in the menu's foot (toolsPipeline), with the explorations. */
(function (global) {
  var Organica = global.Organica = global.Organica || {};
  Organica.tools = [
    { group: 'Form & grid',    items: [['Genesis', '/genesis/'], ['Flexible Visual System', '/fvs/'], ['Loom', '/loom/'], ['Trellis', '/trellis/']] },
    { group: 'From an image',  items: [['Halide', '/halide/'], ['Spore', '/spore/'], ['Pollen', '/pollen/'], ['Mote', '/mote/']] },
    { group: 'Patterns',       items: [['Warping', '/warping/'], ['Camo Turing', '/camo-turing/'], ['Radial', '/radial/'], ['Komorebi', '/komorebi/']] },
    { group: 'Colour',         items: [['TuneSutra', '/tunesutra/'], ['Colornet', '/colornet/']] },
    { group: 'Type & vector',  items: [['Living Path', '/livingpath/'], ['Apostate', '/apostate/'], ['Sinew', '/sinew/']] },
    { group: 'Motion',         items: [['Pulsar', '/pulsar/'], ['Membrane', '/membrane/'], ['Vortex', '/vortex/'], ['Mycel', '/mycel/'], ['Blob Boundary', '/blob-boundary/']] }
  ];
  Organica.toolsPipeline = ['Rhizome', '/rhizome/'];
  Organica.explorations = [['Camo Cells', '/loom/_test-camo-cells.html'], ['Slice Reposition', '/loom/_test-slice-reposition.html'], ['Mix Restructure', '/loom/_test-mix-restructure.html'], ['Flow Field', '/explorations/flow-field/']];
})(typeof window !== 'undefined' ? window : this);
