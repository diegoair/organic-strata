/* ─────────────────────────────────────────────────────────────
   ORGANICA — organica-palette-chip.js
   The RMX multi-colour chip UI, promoted to shared after it had
   independently drifted into four near-identical copies:
     camo-turing/index.html  (the original, GLSL-era, RMX_COLORS_MAX=5)
     membrane/js/main.js     (hand-copied from Camo Turing)
     vortex/js/palette.js    (ported from Membrane, cap raised to 8 —
                               no shader array-size constraint there)
     fvs/index.html          (cap 8, min 1 — a single flat colour is a
                               valid baseline for that tool)
   TuneSutra (2026-08-26) is the 5th consumer — past the point where
   extracting this is speculative. This module does NOT retrofit the
   four existing copies; each keeps its own inline version until Diego
   asks for that migration. Requires the host page to define its own
   .rmx-color / .rmx-x / .rmx-add CSS (organica-panel.css deliberately
   leaves this tool-local — see its own comment on .color-swatch-wrap).

   Every known bug from the four prior copies is fixed once, here:
     - the chip's own visible colour is the wrapping <label>'s
       background (the <input type=color> underneath is opacity:0) —
       must be repainted on every change, not just set once at build
     - a <select> or other control writing into a module-scoped `let`
       must go through an exported function, never a bare inline
       assignment, or it silently creates a disconnected global
   ───────────────────────────────────────────────────────────── */
(function (global) {
  const Organica = global.Organica;

  // opts: { wrap: HTMLElement, colors: string[], min, max, onChange(colors) }
  Organica.createPaletteChips = function (opts) {
    const wrap = opts.wrap;
    const min = opts.min || 1;
    const max = opts.max || 8;
    const onChange = opts.onChange || function () {};
    let colors = (opts.colors || ['#888888']).slice(0, max);
    while (colors.length < min) colors.push('#888888');

    function rebuild() {
      wrap.innerHTML = '';
      colors.forEach((col, i) => {
        const chip = document.createElement('label');
        chip.className = 'rmx-color';
        chip.style.background = col;
        chip.setAttribute('aria-label', 'Palette colour ' + (i + 1));
        const input = document.createElement('input');
        input.type = 'color';
        input.value = col;
        input.setAttribute('aria-label', 'Palette colour ' + (i + 1));
        input.addEventListener('input', e => setColor(i, e.target.value));
        chip.appendChild(input);
        if (colors.length > min) {
          const x = document.createElement('button');
          x.className = 'rmx-x';
          x.textContent = '×';
          x.title = 'Remove';
          x.setAttribute('aria-label', 'Remove colour ' + (i + 1));
          x.addEventListener('click', e => { e.preventDefault(); removeColor(i); });
          chip.appendChild(x);
        }
        wrap.appendChild(chip);
      });
      if (colors.length < max) {
        const add = document.createElement('button');
        add.className = 'rmx-add';
        add.textContent = '+';
        add.title = 'Add colour';
        add.setAttribute('aria-label', 'Add palette colour');
        add.addEventListener('click', addColor);
        wrap.appendChild(add);
      }
    }

    function setColor(i, hex) {
      colors[i] = hex;
      // Repaint the chip's own background, not just the input underneath —
      // the input is opacity:0, so without this every pick after the first
      // looks like it had no effect even though it did.
      const chip = wrap.children[i];
      if (chip) chip.style.background = hex;
      onChange(colors.slice(), i, 'edit');
    }

    function addColor() {
      if (colors.length >= max) return;
      colors.push('#888888');
      rebuild();
      onChange(colors.slice(), colors.length - 1, 'add');
    }

    function removeColor(i) {
      if (colors.length <= min) return;
      colors.splice(i, 1);
      rebuild();
      onChange(colors.slice(), Math.max(0, i - 1), 'remove');
    }

    function setColors(arr) {
      colors = arr.slice(0, max);
      while (colors.length < min) colors.push('#888888');
      rebuild();
    }

    rebuild();
    return { getColors: () => colors.slice(), setColors, rebuild };
  };
})(typeof window !== 'undefined' ? window : this);
