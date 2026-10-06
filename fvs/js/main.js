// Flexible Visual System — entry module. The files evaluate in this order (each imports only earlier ones),
// which is the order the single inline script used to run in. Architecture: docs/FVS.md §Architecture.
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
import './13-figure-engine.js';
import './14-figure-ui.js';
import './15-export-library-view.js';
import './99-boot.js';
import './test-surface.js';
window.__fvs.markReady();
