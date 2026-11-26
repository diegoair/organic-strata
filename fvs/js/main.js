// Flexible Visual System — entry module. First the Project (project.js): which one this page works on, its board
// stores filled from IndexedDB. Then the app (app.js, every FVS file in order): the files that make a board store at
// their top level find it ready. Architecture: docs/FVS.md §11, Projects: docs/FVS.md § Projects.
import { openProject } from './project.js';
await openProject();
await import('./app.js');
