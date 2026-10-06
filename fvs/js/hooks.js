// Flexible Visual System · hooks — the references from an earlier file to a later one. The import graph only
// points backwards (files evaluate in order: 00 → 99), so a later file puts the names earlier files call
// at run time here, as live getters (provide() is the first statement of that file). No hook is read while
// the files load before the file that provides it.
export const hooks = {};
export function provide(getters) {
  for (const [name, get] of Object.entries(getters)) Object.defineProperty(hooks, name, { get, enumerable: true, configurable: true });
}
