// Flexible Visual System · test surface — window.__fvs: every name the files export, as live getters, plus the
// variables on rt (get + set) and the test flags. For fvs/_test-regression.html (it runs its battery inside
// `with (window.__fvs)`, so the battery's bare names still resolve) and scripts/test-fvs-*.mjs.
import { rt } from './rt.js';
import * as m00 from './00-core.js';
import * as m01 from './01-geometry.js';
import * as m02 from './02-seed-ui.js';
import * as m03 from './03-rules.js';
import * as m04 from './04-appearance.js';
import * as m05 from './05-render-component.js';
import * as m06 from './06-component-ui.js';
import * as m07 from './07-library.js';
import * as m08 from './08-symbol-grid.js';
import * as m09 from './09-symbol-render.js';
import * as m10 from './10-suggest.js';
import * as m11 from './11-symbol-ui.js';
import * as m12 from './12-shell.js';
import * as m13 from './13-figure-engine.js';
import * as m14 from './14-figure-ui.js';
import * as m15 from './15-export-library-view.js';
import * as m99 from './99-boot.js';

const api = {};
for (const ns of [m00, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13, m14, m15, m99])
  for (const name of Object.keys(ns)) Object.defineProperty(api, name, { get: () => ns[name], enumerable: true });
for (const name of Object.keys(rt)) Object.defineProperty(api, name, { get: () => rt[name], set: v => { rt[name] = v; }, enumerable: true });
let ready;
api.ready = new Promise(r => { ready = r; });
api.isReady = false;
api.markReady = () => { api.isReady = true; ready(); };
window.__fvs = api;
