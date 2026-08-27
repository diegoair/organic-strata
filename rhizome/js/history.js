/* ─────────────────────────────────────────────────────────────
   Rhizome — undo/redo.

   A plain snapshot stack of the canonical graph model (graph-model.js's
   own {nodes, edges} — already pure serializable data, no functions, no
   DOM refs), same "one canonical object, everything else derived"
   discipline the model itself follows. Snapshots are pushed at
   meaningful checkpoints (add/remove node, connect/disconnect, drag
   END, a param commit) — never on every mousemove/slider-input tick,
   or dragging a node three pixels would blow the stack with
   indistinguishable states.
   ───────────────────────────────────────────────────────────── */

const MAX_HISTORY = 100;

export function createHistory() {
  let stack = [];
  let index = -1;   // points at the currently-applied snapshot

  function snapshot(model) {
    return JSON.stringify({ nodes: model.nodes, edges: model.edges });
  }

  function push(model) {
    const snap = snapshot(model);
    if (index >= 0 && stack[index] === snap) return;   // no-op change, don't pollute history
    stack = stack.slice(0, index + 1);
    stack.push(snap);
    if (stack.length > MAX_HISTORY) stack.shift(); else index++;
    if (stack.length > MAX_HISTORY) index = stack.length - 1;
  }

  function canUndo() { return index > 0; }
  function canRedo() { return index < stack.length - 1; }

  function undo() {
    if (!canUndo()) return null;
    index--;
    return JSON.parse(stack[index]);
  }

  function redo() {
    if (!canRedo()) return null;
    index++;
    return JSON.parse(stack[index]);
  }

  return { push, undo, redo, canUndo, canRedo };
}
