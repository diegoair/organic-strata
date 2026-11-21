# Third-party notices

This project is proprietary (see `LICENSE`), but it vendors a small number
of third-party libraries under their own open-source licenses. Each is
listed here with the exact license, source, and where it's used — audited
directly against the license banner in each vendored file, August 27, 2026.

---

### GSAP core + MorphSVGPlugin
- **Files**: `shared/vendor/gsap.min.js`, `shared/vendor/gsap-morphsvg.min.js`
- **License**: GreenSock "No Charge" Standard License — https://gsap.com/standard-license
- **Used by**: Blob Boundary (`blob-boundary/index.html` — mask-shape morph). `shared/motion.js` also references the `gsap`/`MorphSVGPlugin`/`DrawSVGPlugin` globals at runtime *if present*, degrading gracefully when absent (its only current consumer, Rhizome, loads no GSAP).
- **Note**: GSAP's paid "Club GreenSock" plugins (including MorphSVG) became free under the Standard license after Webflow's acquisition of GreenSock. Confirmed live from gsap.com before vendoring. (`gsap-drawsvg.min.js` was removed August 31, 2026 with the Soul tool — its only consumer.)

### Kiwi.js
- **File**: `shared/vendor/kiwi.min.js`
- **License**: Modified BSD License (BSD-3-Clause) — Copyright (c) 2014-2019, Nucleic Development Team & H. Rutjes
- **Source**: npm registry tarball (`kiwi.js`)
- **Used by**: Loom's Bento generator (Cassowary constraint solver)

### Paper.js
- **File**: `shared/vendor/paper-full.min.js`
- **Version**: 0.12.17
- **License**: MIT — Copyright (c) 2011-2020, Jürg Lehni & Jonathan Puckey
- **Used by**: Genesis's Draw + Edit modes (`Organica.createPaperDrawEditor`, `shared/paper.js`)

### Three.js
- **File**: `shared/vendor/three.module.js`
- **Version**: r160
- **License**: MIT — Copyright 2010-2023 Three.js Authors
- **Used by**: Camo Turing (WebGL2 Gray-Scott reaction-diffusion rendering)

### opentype.js
- **File**: `shared/vendor/opentype.min.js`
- **License**: MIT
- **Source**: https://github.com/opentypejs/opentype.js
- **Used by**: Membrane, Camo Turing, and the shared seeds panel (`shared/seeds-panel.js`) — text-seed glyph-to-path extraction
- **Note**: the vendored minified build does not carry its own license banner (unlike the other libraries above) — this file records that gap and supplies the required MIT notice on the library's behalf:

  > Copyright (c) 2018- The opentype.js authors — MIT License. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, subject to the standard MIT conditions (see https://github.com/opentypejs/opentype.js/blob/master/LICENSE).

### p5.js
- **Loaded from**: `https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js` (CDN, not vendored — used unmodified)
- **License**: LGPL-2.1
- **Used by**: `explorations/flow-field/`, and Membrane's p5 canvas

### @supabase/supabase-js
- **File**: `shared/vendor/supabase-js.min.js`
- **Version**: 2.113.0 (UMD build, `dist/umd/supabase.js`)
- **License**: MIT — Copyright (c) 2020 Supabase
- **Source**: npm registry tarball (`@supabase/supabase-js`)
- **Used by**: the cloud sync layer (`shared/supabase.js` → `Organica.sb`), consumed by `shared/auth.js` and `shared/store.js` on every tool page — per-user auth (Google OAuth / magic link) and preset/seed persistence in Postgres with row-level security.

### IBM Plex Mono (typeface)
- **Files**: `shared/vendor/ibm-plex-mono-{regular,italic,medium,semibold,bold}.ttf` (licence text alongside: `shared/vendor/ibm-plex-mono-OFL.txt`) — the default text face since Sep 29, 2026, self-hosted via `@font-face` in `shared/tokens.css`.
- **Source**: https://github.com/IBM/plex. Copyright © 2017 IBM Corp. with Reserved Font Name "Plex".
- **License**: SIL Open Font License 1.1 — same terms as Manrope below.

### Space Grotesk (typeface)
- **File**: `shared/vendor/space-grotesk-variable.ttf` (licence text alongside: `shared/vendor/space-grotesk-OFL.txt`) — the display face (headings, buttons, numbers) since Sep 29, 2026, self-hosted via `@font-face` in `shared/tokens.css`.
- **Source**: https://github.com/floriankarsten/space-grotesk. Copyright 2020 The Space Grotesk Project Authors.
- **License**: SIL Open Font License 1.1 — same terms as Manrope below.

### Wix Madefor Display (typeface)
- **File**: `shared/vendor/wix-madefor-display-variable.ttf` (licence text alongside: `shared/vendor/wix-madefor-display-OFL.txt`) — first fallback in `--font` (was the interface typeface earlier on Sep 29, 2026), self-hosted via `@font-face` in `shared/tokens.css`.
- **Source**: https://github.com/wix/wixmadefor. Copyright 2023 The Wix Madefor Project Authors.
- **License**: SIL Open Font License 1.1 — same terms as Manrope below.

### Manrope (typeface)
- **Loaded via**: self-hosted `@font-face` in `shared/tokens.css` (the `--font` fallback; the interface typeface until Sep 29, 2026); a local copy at `shared/vendor/manrope-variable.ttf` for glyph-outline extraction (opentype.js) in Membrane / Camo Turing's text-seed features and the shared seeds panel
- **License**: SIL Open Font License 1.1 — permits bundling/embedding in software, including commercial use; the only real restriction is not selling the font file standalone and preserving its Reserved Font Name if modified (it isn't, here)

### Archivo Black (typeface)
- **File**: `shared/vendor/archivo-black.ttf` — glyph-outline extraction only (opentype.js), used as Living Path's default type-tester face so the tester is never empty on boot. Not `@font-face`'d for page text.
- **Source**: https://github.com/Omnibus-Type/ArchivoBlack (Omnibus-Type). Copyright 2017 The Archivo Black Project Authors.
- **License**: SIL Open Font License 1.1 — permits bundling/embedding in software, including commercial use; the only real restriction is not selling the font file standalone and preserving its Reserved Font Name if modified (it isn't, here). Same terms as Manrope above.

### Bencho (interface patterns)
- **Used in**: `shared/floatbar.css` + `Organica.floatbarPill` in `shared/core.js` (the glass icon bar and its travelling indicator, after Bencho's IconBar) and the Anchor flyout in Flexible Visual System (`fvs/fvs.css` + `fvs/js/08-symbol-grid.js`; after Bencho's canvas toolbar: the rise animation, the selected pad that arrives, the concentric corners), and the arrival of the Symbol step's first grid in the same file (after Bencho's Generate: a frame that starts empty with one button in the middle, and a picture that arrives from blank paper through a heavy blur to sharp — with its contrast about the paper and its drifting ripple, here on one pane per grid cell, without Bencho's count or picture), and `shared/fvs-field.js` (`Organica.fvsField`, the *arrival* motion of the field under `/404.html`: the same arrival and its constants, re-typed from `fvs/index.html` `runSymbolArrival`, with each pane filtering only its cell and the eight around it). Re-typed in plain CSS/JS with this project's tokens — no file is copied whole and nothing is vendored; several of Bencho's own comments are kept because they explain the numbers.
- **Source**: https://bencho.dev
- **License**: MIT — https://bencho.dev/licence. *(To do: paste the copyright line and the MIT text from that page here; they were not available when this entry was written.)*

---

### d3-contour (algorithm, re-typed)
- **Used in**: `shared/core.js` — `Organica.isoContours` (marching squares with linear crossings, the stitching of segments into rings) — for the Wash fill of `shared/shading.js` (Nov 21, 2026). Re-typed in plain JS, made standalone (no d3 dependency); the 16-case table and the stitch logic follow d3-contour's `contours.js`. Nothing is vendored.
- **Source**: https://github.com/d3/d3-contour — Copyright 2012–2023 Mike Bostock.
- **License**: ISC — Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

### RAL Classic colour table (data)
- **File**: `shared/vendor/ral-classic.js`
- **License**: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/ (applies to this data file only)
- **Source**: Wikipedia, "List of RAL colours" — https://en.wikipedia.org/wiki/List_of_RAL_colours (retrieved Nov 17, 2026; 210 RAL Classic codes, names and sRGB hex)
- **Used by**: the shared colour picker's *Nearest RAL* value (`shared/colour-picker.js`), TuneSutra first.
- **Note**: screen approximations, not official RAL references. RAL is a trademark of RAL gGmbH; no affiliation. RAL lists online configurators among its licensable uses — on the pre-launch licence checklist (Diego, Nov 17, 2026). No Pantone data is bundled.

No other third-party code is vendored in this repository. `shared/*.js` / `.css` and every tool's own code are original work, except the re-typed algorithms credited above.
