// Flexible Visual System — entry module. First the Project (project.js): which one this page works on, its board
// stores filled from IndexedDB. Then the app (app.js, every FVS file in order): the files that make a board store at
// their top level find it ready. No Project to open → the home, Your projects (home.js), without the app.
// Architecture: docs/FVS.md §11, Projects: docs/FVS.md § Projects.
import { chooseProject, openProject } from './project.js';
const id = await chooseProject();
if (id) {
  await openProject(id);
  await import('./app.js');
  (await import('./home.js')).wireProjectButton();
} else {
  (await import('./home.js')).showHome({ standalone: true });
}
