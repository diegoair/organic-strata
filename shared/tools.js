/* tools.js — the tool list, as data. Read by the header's mega menu (shared/header.js).
   Mirrors the hub's side-nav (index.html), minus Explorations; scripts/check.py fails if a
   hub nav link is missing here. Load BEFORE header.js. */
(function (global) {
  var Organica = global.Organica = global.Organica || {};
  Organica.tools = [
    { group: 'Seed / Form',              items: [['Genesis', '/genesis/']] },
    { group: 'Coloring & palette',       items: [['TuneSutra', '/tunesutra/'], ['Colornet', '/colornet/']] },
    { group: 'Grid & composition',       items: [['Loom', '/loom/'], ['Flexible Visual System', '/fvs/']] },
    { group: 'Tracing & vectorization',  items: [['Halide', '/halide/'], ['Living Path', '/livingpath/'], ['Sinew', '/sinew/'], ['Apostate', '/apostate/']] },
    { group: 'Generative patterns',      items: [['Komorebi', '/komorebi/'], ['Camo Turing', '/camo-turing/'], ['Warping', '/warping/'], ['Radial', '/radial/']] },
    { group: 'Stippling & marks',        items: [['Spore', '/spore/'], ['Pollen', '/pollen/']] },
    { group: 'Motion & growth',          items: [['Membrane', '/membrane/'], ['Vortex', '/vortex/'], ['Pulsar', '/pulsar/'], ['Mycel', '/mycel/'], ['Mote', '/mote/'], ['Blob Boundary', '/blob-boundary/'], ['Trellis', '/trellis/']] },
    { group: 'Workflow & pipelines',     items: [['Rhizome', '/rhizome/']] }
  ];
})(typeof window !== 'undefined' ? window : this);
