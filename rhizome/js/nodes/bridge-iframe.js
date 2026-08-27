/* ─────────────────────────────────────────────────────────────
   Rhizome node — Tier 2 iframe bridge factory (Piano Parte 3.1).

   Generic node compute() for any "legacy bridge" node: loads the real
   tool's own page in a hidden iframe, drives it via postMessage, and
   resolves with whatever the tool reports as its current output.
   compute() returns a Promise — the execution engine already needs to
   await every node's output regardless of tier (Tier 1's synchronous
   return is just Promise.resolve()'d), so this isn't a special case.

   Protocol (new — see the postMessage listener added to genesis/creator.html
   itself, right after its own init(), for the receiving end):
     Rhizome  -> iframe : {type:'rhizome-set-input', payload, nodeId}
     iframe   -> Rhizome: {type:'rhizome-output-ready', payload, nodeId}
   An 8s timeout marks the node errored rather than hanging forever —
   nothing in the bridged tools was built expecting to be driven headless.
   ───────────────────────────────────────────────────────────── */

// 15s, not the original 8s: Camo Turing's bridge (Phase 2) runs up to a
// few thousand synchronous WebGL steps before responding — measured
// comfortably under this, but 8s cut it too close for a slow machine or
// a high step count. Every other bridge responds in well under a second,
// so this only widens the window for the one genuinely slow case.
const TIMEOUT_MS = 15000;
const pending = new Map();   // nodeId -> {resolve, reject, timer}

let listenerBound = false;
function ensureListener() {
  if (listenerBound) return;
  listenerBound = true;
  window.addEventListener('message', e => {
    const msg = e.data;
    if (!msg || msg.type !== 'rhizome-output-ready') return;
    const p = pending.get(msg.nodeId);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(msg.nodeId);
    p.resolve(msg.payload);
  });
}

const iframes = new Map();   // nodeId -> HTMLIFrameElement

function getIframe(nodeId, src) {
  let el = iframes.get(nodeId);
  if (el) return el;
  el = document.createElement('iframe');
  el.src = src;
  el.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  el.style.cssText = 'position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;';
  document.body.appendChild(el);
  iframes.set(nodeId, el);
  return el;
}

// `src`: the bridged tool's own URL. `buildPayload(inputs, params)`: what
// to send it. Returns a node-shaped {meta, compute} pair.
export function makeBridgeNode({ id, label, src, inputs, outputs, params, buildPayload }) {
  return {
    meta: { id, label, category: 'bridge', inputs, outputs, params },
    compute(nodeInputs, nodeParams, ctx) {
      ensureListener();
      const nodeId = ctx.nodeId;
      const iframe = getIframe(nodeId, src);
      const payload = buildPayload(nodeInputs, nodeParams);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(nodeId);
          reject(new Error(`${label}: bridged tool did not respond within ${TIMEOUT_MS}ms.`));
        }, TIMEOUT_MS);
        pending.set(nodeId, { resolve, reject, timer });

        const send = () => iframe.contentWindow.postMessage({ type: 'rhizome-set-input', payload, nodeId }, '*');
        if (iframe.dataset.loaded) send();
        else iframe.addEventListener('load', () => { iframe.dataset.loaded = '1'; send(); }, { once: true });
      });
    },
  };
}
