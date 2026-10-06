// Flexible Visual System — entry module. The files evaluate in this order (each imports only earlier ones),
// which is the order the single inline script used to run in. Figure (4 files) is not here: it loads on
// demand through ./lazy.js → ./figure.js. Architecture: docs/FVS.md §11.
import './engine/00-core.js';
import './engine/01-geometry.js';
import './engine/02-seed-ui.js';
import './engine/03-rules.js';
import './engine/04-appearance.js';
import './engine/05-render-component.js';
import './engine/06-component-ui.js';
import './engine/07-library.js';
import './engine/08-symbol-grid.js';
import './engine/09-symbol-render.js';
import './engine/10-suggest.js';
import './engine/11-symbol-ui.js';
import './engine/12-shell.js';
import './engine/15-export-library-view.js';
import './00-core.js';
import './01-geometry.js';
import './02-seed-ui.js';
import './03-rules.js';
import './04-appearance.js';
import './05-render-component.js';
import './06-component-ui.js';
import './07-library.js';
import './08-symbol-grid.js';
import './09-symbol-render.js';
import './10-suggest.js';
import './11-symbol-ui.js';
import './12-shell.js';
import './15-export-library-view.js';
import './99-boot.js';
import './test-surface.js';
window.__fvs.markReady();
