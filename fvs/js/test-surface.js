// Flexible Visual System · test surface — window.__fvs: every name the files export, as live getters, plus the
// variables on rt (get + set) and the test flags. For fvs/_test-regression.html (it runs its battery inside
// `with (window.__fvs)`, so the battery's bare names still resolve) and scripts/test-fvs-*.mjs.
import { rt } from './rt.js';
import { loadFigureTier } from './lazy.js';
import * as e00 from './engine/00-core.js';
import * as e01 from './engine/01-geometry.js';
import * as e02 from './engine/02-seed-ui.js';
import * as e03 from './engine/03-rules.js';
import * as e04 from './engine/04-appearance.js';
import * as e05 from './engine/05-render-component.js';
import * as e06 from './engine/06-component-ui.js';
import * as e07 from './engine/07-library.js';
import * as e08 from './engine/08-symbol-grid.js';
import * as e09 from './engine/09-symbol-render.js';
import * as e10 from './engine/10-suggest.js';
import * as e11 from './engine/11-symbol-ui.js';
import * as e12 from './engine/12-shell.js';
import * as e15 from './engine/15-export-library-view.js';
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
import * as m15 from './15-export-library-view.js';
import * as m99 from './99-boot.js';

const api = {};
const expose = list => { for (const ns of list) for (const name of Object.keys(ns)) Object.defineProperty(api, name, { get: () => ns[name], enumerable: true, configurable: true }); };
expose([e00, e01, e02, e03, e04, e05, e06, e07, e08, e09, e10, e11, e12, e15, m00, m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m15, m99]);
// Figure loads on demand: until then its names say so (await __fvs.loadFigureTier()) instead of being missing.
for (const name of ["BUILTIN_RECIPES","FG_GRID_TYPES","FG_HUE_TURNS","FG_ICONS","FG_LATTICE_OF","FG_LOCK_GROUPS","FG_SEEDS","FG_SEED_MAIN","FG_SEED_POOL","FG_STR_OF","FIGURE_CLASSIC_LABELS","FIGURE_MAX_SHAPES","FIGURE_MUTATIONS","FIGURE_RECIPES_V1_AS_V2","FIGURE_TOOLS","LEAF_CELLS","applyClassRules","applyFigureRecipe","applyHandle","capMap","closeFigureGallery","closeFigureVariations","componentCellsFromRule","describeRule","drawFigureRef","evalFigure","fgBaseColours","fgLastGridTransform","fgPick","fgSymbol","figureCardHTML","figureCatalog","figureChecks","figureClassWhen","figureEndStroke","figureFirstLevelOf","figureFormFromRecipe","figureGalleryCache","figureHandleAction","figureHandleTarget","figureHistory","figureHistoryStep","figureMutate","figureMutateOnce","figureNeighbours","figureNudgeSize","figurePaintAt","figurePaintable","figureRecipeFromForm","figureRef","figureRun","figureSVGOf","figureSetTransform","figureShuffle","figureShuffleNow","figureStepCache","figureStepIds","figureStepSVGs","figureStroke","figureThumb","figureVarSeed","figureVarToken","galleryToken","gridTypeFromLattice","hexFigureRecipes","isFormRule","isSealedSymbol","maskIoU","normMask","openFigureGallery","openFigureVariations","paintCell","promoteFigureToTile","pushFigureHistory","rasterMask","recursiveFigureRecipes","refreshFigureChecks","renderFigureChips","renderFigureHandles","renderFigurePipeline","renderFigurePlay","renderFigureReport","renderFigureStepPanel","renderFigureTier","renderFigureToolbar","ruleMatches","runBuiltinRecipe","runFigureRecipe","runSealedSymbolLevel","setFigureStep","showFigureStep","slotClassContext","svgURI","symbolLevelFromLiveState","syncFgNOptions","syncFigureFormUI","syncFigureHistoryUI","triangleFigureRecipes","validateFigureRecipe","ruleOf","recipeElementKey","isLattice","gridSpec","graphFromRecipe","elementEntryFromRecipe","REPEAT_LATTICES","FIT_PRESET","FIGURE_LATTICES","renderFigureGraph","FIGURE_PORT_TYPES","gridSummary","gridDefaults","figureNodeTypes","entrySnapshot","contentPatch","compileFigure","canvasSummary","canvasOf","withFigureSandbox"])
  Object.defineProperty(api, name, { get: () => { throw new Error(name + ': the Figure tier is not loaded — await __fvs.loadFigureTier()'); }, enumerable: true, configurable: true });
api.expose = expose;
api.loadFigureTier = loadFigureTier;
api.figureLazy = true;
for (const name of Object.keys(rt)) Object.defineProperty(api, name, { get: () => rt[name], set: v => { rt[name] = v; }, enumerable: true });
let ready;
api.ready = new Promise(r => { ready = r; });
api.isReady = false;
api.markReady = () => { api.isReady = true; ready(); };
window.__fvs = api;
