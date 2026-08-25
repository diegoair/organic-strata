/* ─────────────────────────────────────────────────────────────
   Vortex — Palette. The RMX chip UI ported from Membrane's own
   buildRmxPalette/rmxSetColor/rmxAddColor/rmxRemoveColor (itself a port
   of Camo Turing's GLSL-era RMX palette), wired the same way (plain
   addEventListener at chip-creation time, not Organica.createColorSwatch
   — that factory assumes fixed static DOM ids per colour, which doesn't
   fit a variable-length list).

   Max raised from Membrane's 5 to 8: Membrane's 5 was a leftover of
   Camo Turing's own fixed-size GLSL uniform array (uPalette[5]) — a
   real hardware/shader constraint. Vortex has no shader at all; its
   colour is a plain `i % colors.length` cycle with no array-size bound,
   and "repeating groups of N along the spiral" (the exploration's own
   documented visual read) is a genuine expressive axis worth extending.
   Min stays 2, same guard reasoning as Membrane's own.
   ───────────────────────────────────────────────────────────── */
import { state } from './state.js';

const COLORS_MAX = 8;

export function colorAt(i) {
  return state.colors[i % state.colors.length];
}

function ctrl(id) { return document.getElementById(id); }

export function buildPalette() {
  const wrap = ctrl('rmx-palette');
  wrap.innerHTML = '';
  state.colors.forEach((col, i) => {
    const chip = document.createElement('label');
    chip.className = 'rmx-color';
    chip.style.background = col;
    chip.setAttribute('aria-label', 'Palette colour ' + (i + 1));
    const input = document.createElement('input');
    input.type = 'color'; input.value = col;
    input.setAttribute('aria-label', 'Palette colour ' + (i + 1));
    input.addEventListener('input', e => setColor(i, e.target.value));
    chip.appendChild(input);
    if (state.colors.length > 2) {
      const x = document.createElement('button');
      x.className = 'rmx-x'; x.textContent = '×'; x.title = 'Remove';
      x.setAttribute('aria-label', 'Remove colour ' + (i + 1));
      x.addEventListener('click', e => { e.preventDefault(); removeColor(i); });
      chip.appendChild(x);
    }
    wrap.appendChild(chip);
  });
  if (state.colors.length < COLORS_MAX) {
    const add = document.createElement('button');
    add.className = 'rmx-add'; add.textContent = '+'; add.title = 'Add colour';
    add.setAttribute('aria-label', 'Add palette colour');
    add.addEventListener('click', addColor);
    wrap.appendChild(add);
  }
}

export function setColor(i, hex) {
  state.colors[i] = hex;
  // Same real bug Camo Turing's/Membrane's own rmxSetColor already
  // documents: the chip's own visible background (the wrapping <label>
  // — the <input type=color> underneath is opacity:0) is only painted
  // once in buildPalette(). Without repainting it here, every colour
  // pick after the first would visually look like it had no effect.
  const chip = ctrl('rmx-palette').children[i];
  if (chip) chip.style.background = hex;
}

export function addColor() {
  if (state.colors.length >= COLORS_MAX) return;
  state.colors.push('#888888');
  buildPalette();
}

export function removeColor(i) {
  if (state.colors.length <= 2) return;
  state.colors.splice(i, 1);
  buildPalette();
}
