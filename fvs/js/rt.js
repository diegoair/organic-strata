// Flexible Visual System · rt — the top-level variables more than one file assigns (an imported binding is
// read-only, so they live here as properties). Each file still sets its own initial value where it always did.
// Also the test flags the harnesses set through window.__fvs.
export const rt = {
  cePicked: new Set(), cePart: null,   // Component Edit: the cells picked for part colours, the part being coloured
  partEdit: true, partSel: new Set(), layerAnchor: null, partMethod: null, partCount: null,   // Element › Divide into parts: parts editable on the board (always, since Oct 11, 2026 — no Element Edit mode), the parts ⌘-picked on the canvas, the Division chosen before dividing
  afterLoadSymbolGrid: null,   // test hook: called with the model after every loadSymbolGrid()
  figureGraph: false,   // true once the Figure graph (17-figure-graph.js) owns the Figure step — the old Figure UI's keys go quiet
  galleryGenerated: false,   // set by Generate (06-component-ui.js); the Component board frames a list it resized, then clears it (18-step-boards.js)
};
