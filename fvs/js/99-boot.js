// Flexible Visual System · 99-boot — Boot — first render, tier, cloud sync of the libraries.
// One of the classic scripts fvs/index.html loads in order (fvs/js/00 … 99); they share one global scope.
// Architecture + file map: docs/FVS.md §Architecture.
'use strict';
setRailOpen(false);   // always starts closed — the saved library stays out of the way until asked for (was restored from organica.fvs.rail)

renderGallery();
renderSeedPreview();
pruneAutoLibraryEntries();
renderLibrary();
setTier(state.activeTier);   // 'element' by default — syncs the stepnav, export hint, and the Element canvas
Organica.autoLabelPanel(document);
// Cloud sync (shared/store.js): hydrate component + symbol libraries from Supabase.
LIBRARY.pull().then(() => { pruneAutoLibraryEntries(); renderLibrary(); });        LIBRARY.onSync(() => renderLibrary());
SYMBOL_LIBRARY.pull().then(() => renderSymbolLibrary()); SYMBOL_LIBRARY.onSync(() => renderSymbolLibrary());
ELEMENT_LIB.pull().then(() => elementLibraryChanged());   ELEMENT_LIB.onSync(() => elementLibraryChanged());   // saved Elements from the account show on a new device / session without a reload
// Genesis library (seed picker) — hydrate the cache from Supabase; the picker
// reads it live each time it opens, so no re-render needed here.
Organica.store.library.pull();

Organica.enhanceSliders(document);
