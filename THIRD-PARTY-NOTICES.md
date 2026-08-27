# Third-party notices

This project is proprietary (see `LICENSE`), but it vendors a small number
of third-party libraries under their own open-source licenses. Each is
listed here with the exact license, source, and where it's used — audited
directly against the license banner in each vendored file, August 27, 2026.

---

### GSAP core + MorphSVGPlugin + DrawSVGPlugin
- **Files**: `shared/gsap.min.js`, `shared/gsap-morphsvg.min.js`, `shared/gsap-drawsvg.min.js`
- **License**: GreenSock "No Charge" Standard License — https://gsap.com/standard-license
- **Used by**: Soul (`soul/index.html`, `shared/organica-motion.js`)
- **Note**: GSAP's paid "Club GreenSock" plugins (including MorphSVG/DrawSVG) became free under the Standard license after Webflow's acquisition of GreenSock. Confirmed live from gsap.com before vendoring.

### Kiwi.js
- **File**: `shared/kiwi.min.js`
- **License**: Modified BSD License (BSD-3-Clause) — Copyright (c) 2014-2019, Nucleic Development Team & H. Rutjes
- **Source**: npm registry tarball (`kiwi.js`)
- **Used by**: Loom's Bento generator (Cassowary constraint solver)

### Paper.js
- **File**: `shared/paper-full.min.js`
- **Version**: 0.12.17
- **License**: MIT — Copyright (c) 2011-2020, Jürg Lehni & Jonathan Puckey
- **Used by**: Genesis Creator's Draw mode (`Organica.createPaperDrawEditor`, `shared/organica-paper.js`)

### Three.js
- **File**: `shared/three.module.js`
- **Version**: r160
- **License**: MIT — Copyright 2010-2023 Three.js Authors
- **Used by**: Camo Turing (WebGL2 Gray-Scott reaction-diffusion rendering)

### opentype.js
- **File**: `shared/opentype.min.js`
- **License**: MIT
- **Source**: https://github.com/opentypejs/opentype.js
- **Used by**: Soul, Membrane, Camo Turing (text-seed glyph-to-path extraction)
- **Note**: the vendored minified build does not carry its own license banner (unlike the other libraries above) — this file records that gap and supplies the required MIT notice on the library's behalf:

  > Copyright (c) 2018- The opentype.js authors — MIT License. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, subject to the standard MIT conditions (see https://github.com/opentypejs/opentype.js/blob/master/LICENSE).

### p5.js
- **Loaded from**: `https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js` (CDN, not vendored — used unmodified)
- **License**: LGPL-2.1
- **Used by**: Soul's Flow field pattern, `explorations/flow-field/`

### Manrope (typeface)
- **Loaded via**: Google Fonts (`shared/organica-tokens.css`'s `@import`) for on-screen display; a local copy at `shared/manrope-variable.ttf` for glyph-outline extraction (opentype.js) in Soul/Membrane/Camo Turing's text-seed features
- **License**: SIL Open Font License 1.1 — permits bundling/embedding in software, including commercial use; the only real restriction is not selling the font file standalone and preserving its Reserved Font Name if modified (it isn't, here)

---

No other third-party code is vendored in this repository. `shared/organica-*.js`/`.css` and every tool's own code are original work.
