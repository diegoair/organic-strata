// Flexible Visual System · 99-boot — Boot — first render, tier, cloud sync of the libraries.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import {
  state
} from './engine/00-core.js';
import {
  ELEMENT_LIB
} from './engine/04-appearance.js';
import {
  LIBRARY, pruneAutoLibraryEntries
} from './engine/07-library.js';
import {
  SYMBOL_LIBRARY
} from './engine/11-symbol-ui.js';
import {
  elementLibraryChanged
} from './04-appearance.js';
import {
  renderGallery, renderSeedPreview
} from './05-render-component.js';
import {
  renderLibrary
} from './07-library.js';
import {
  renderSymbolLibrary
} from './11-symbol-ui.js';
import {
  setTier
} from './12-shell.js';
import {
  setRailOpen
} from './15-export-library-view.js';

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
