// Flexible Visual System — the Figure tier, loaded on demand (lazy.js loadFigureTier(), first used by setTier('figure')).
// Imports the Figure files in order; each provides its hooks as it evaluates. Then exposes them on window.__fvs.
import * as e13 from './engine/13-figure-engine.js';
import * as e14 from './engine/14-figure-ui.js';
import * as m13 from './13-figure-engine.js';
import * as m14 from './14-figure-ui.js';
import * as e16 from './engine/16-figure-eval.js';
window.__fvs.expose([e13, e14, m13, m14, e16]);
