// Flexible Visual System · rt — the top-level variables more than one file assigns (an imported binding is
// read-only, so they live here as properties). Each file still sets its own initial value where it always did.
// Also the test flags the harnesses set through window.__fvs.
export const rt = {
  afterLoadSymbolGrid: null,   // test hook: called with the model after every loadSymbolGrid() (the regression battery pins Clip to cell)
};
