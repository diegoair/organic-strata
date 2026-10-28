// Flexible Visual System · 99-boot — Boot — first render, tier, cloud sync of the libraries.
// An ES module of fvs/js/main.js. It imports what it uses from earlier files; later files it reaches through hooks.*.
// Architecture + file map: docs/FVS.md §11.
import { rt } from './rt.js';
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
  ASSET_LIBRARY, SYMBOL_LIBRARY
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
  railWanted, renderLibraryRail, setRailOpen
} from './15-export-library-view.js';

setRailOpen(railWanted()); rt.railBooted = true;   // open unless it was closed by hand (Diego, Oct 28, 2026 — reverses Oct 5's always-closed start; organica.fvs.rail, the old key, is left unread)

renderGallery();
renderSeedPreview();
pruneAutoLibraryEntries();
renderLibrary();
setTier(state.activeTier);   // 'element' by default — syncs the stepnav, export hint, and the Element canvas
Organica.autoLabelPanel(document);
// Cloud sync (shared/store.js): hydrate component + symbol libraries from Supabase.
LIBRARY.pull().then(() => { pruneAutoLibraryEntries(); renderLibrary(); });        LIBRARY.onSync(() => renderLibrary());
SYMBOL_LIBRARY.pull().then(() => renderSymbolLibrary()); SYMBOL_LIBRARY.onSync(() => renderSymbolLibrary());
ASSET_LIBRARY.pull().then(() => renderLibraryRail()); ASSET_LIBRARY.onSync(() => renderLibraryRail());   // Assets (Oct 28, 2026)
ELEMENT_LIB.pull().then(() => elementLibraryChanged());   ELEMENT_LIB.onSync(() => elementLibraryChanged());   // saved Elements from the account show on a new device / session without a reload
// Genesis library (seed picker) — hydrate the cache from Supabase; the picker
// reads it live each time it opens, so no re-render needed here.
Organica.store.library.pull();

Organica.enhanceSliders(document);
