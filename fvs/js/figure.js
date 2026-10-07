// Flexible Visual System — the Figure tier, loaded on demand (lazy.js loadFigureTier(), first used by setTier('figure')).
// Imports the Figure files in order (the graph replaced the old Figure UI, 14-figure-ui.js, Oct 2026); each provides its hooks as it evaluates. Then exposes them on window.__fvs.
import * as e13 from './engine/13-figure-engine.js';
import * as e14 from './engine/14-figure-ui.js';
import * as m13 from './13-figure-engine.js';
import * as e16 from './engine/16-figure-eval.js';
import * as e17 from './engine/17-figure-nodes.js';
import * as m17 from './17-figure-graph.js';
window.__fvs.expose([e13, e14, m13, e16, e17, m17]);
