# Organica UI-motion audit (read-only, 2026-10-02)

Method: Python/grep scan of 168 tracked css/html/js files (generative engines, vendor, archive, explorations, figma-plugin excluded for UI counts). Scripts: scratchpad/scan.py, scan1.txt. Line numbers are as of HEAD acb3fef + dirty tree. Counts are of declarations, not computed styles. A few multi-line `transition:` blocks (floatbar) are counted by hand.

## 0. Headline findings

1. **There are no motion tokens at all.** `shared/tokens.css` has no `--dur-*`, `--ease-*`, `--motion-*`. The only named motion vars are component-local: `--ind-stretch/--ind-settle/--ind-move/--ind-size` (floatbar.css:84-87) and `--duration/--ease` inside the `<menu-icon>` shadow DOM (menu-icon.js:27). `--t-*` in tokens.css is typography, not time.
2. **UI motion is small in volume** (~58 `transition:` declarations, 17 UI `@keyframes`, 1 WAAPI call) but split across 3 layers with 3 different philosophies: (a) hand-typed CSS transitions with raw seconds, (b) JS spring integrators (slider, switch, checkbox in core.js; floatbar pill = CSS transitions driven by JS phases), (c) one-off bespoke easing (fvs flyout, hub reveal, theme reveal).
3. **Reduced-motion coverage is partial**: ~14 guards, written in 5 different dialects (`transition:none!important`, `transition-duration:1ms`, `animation-duration:1ms`, `animation:none`, JS `matchMedia`). ~30 motions are unguarded (section 4).
4. **Duration values: ~24 distinct raw values** for what is really ~6 intents. Easing: 99 bare `ease` + 15 distinct `cubic-bezier()` (5 of them near-identical overshoot curves).
5. **Popover, mega menu, choose-content overlay, panel-section collapse, layer reorder, select-picker menu, auth menu all open/close with `display:none ↔ block`** (no enter or exit motion). Only the notice, the fvs flyout and the Symbol arrival animate in.

---

## 1. Inventory

### 1a. Shared CSS (applies to every tool)

| Pattern / element | Trigger | Props | Dur | Easing | File:line |
|---|---|---|---|---|---|
| Floatbar button colour | hover/pressed | color | 0.15s | ease | floatbar.css:185 |
| Floatbar glyph quiet→full | hover/focus/pressed | opacity (on svg/span) | 260ms | cubic-bezier(.32,.72,.24,1) | floatbar.css:194 |
| Floatbar pill (indicator) stretch phase | pointer/focus change | **transform, width**, opacity | 190ms (`--ind-stretch`), 160ms opacity | (.32,.72,.24,1) | floatbar.css:156-160, core.js:1535-1560 (150ms setTimeout hands off to settle) |
| Floatbar pill settle phase | after 150ms | transform, width | 420ms (`--ind-settle`) | overshoot (.28,1.28,.36,1) / (.24,1.34,.38,1) | floatbar.css:162-166 |
| Floatbar pill leave-delay | pointerout | JS timer | 120ms | n/a | core.js:1605 |
| Floatbar tooltip (`:hover::after`) | hover | (checked: no transition) | - | - | floatbar.css ~200-235 |
| Slider liquid + handle | drag/value | `--sf`/`--sedge` via rAF spring | spring (stiff .34-.29s, damp .74+.22s) | spring | core.js:1040-1140; panel.css:215-300 (explicitly "no transitions") |
| Switch droplet (pos/stretch/hover swell) | toggle/hover/drag | transform (`--lx,--lsx,--lsy,--hw`) via rAF spring | spring | spring 170/21.5/0.9 | core.js:1244-1313; panel.css:470-505 |
| Switch/checkbox colour | toggle | background-color | 320ms | ease | panel.css:377, 475, 498 (x3) |
| Checkbox tick | toggle/hover | `--cx,--csx,--csy` spring; hover previews 40% | spring | spring | core.js:1384-1430 |
| Seg button | hover/press | background, color | 0.12s | linear(default ease) | panel.css:539 |
| Preset trigger (select-picker) | hover | border-color | .14s | ease | panel.css:802 |
| Mega link | hover | background-color | **0.085s** | ease-out | header.css:291 |
| Header icon buttons / org-btn / etc. | hover | bg/colour/border/outline | 0.15s x6 | ease | header.css:78,182,220,452,593 |
| Notice enter | Organica.notice() | opacity, translateY(12px) | 0.18s | ease-out | header.css:154-160 (`org-notice-in`) |
| Notice busy dot | busy | opacity .35↔1 infinite | 1s | ease-in-out | header.css:168-169 (`org-pulse`) |
| Notice close | hover | background, color | 0.15s | ease | header.css:182 |
| Notice dismissal | 12s timer / Esc / x | **instant remove()** (no exit) | - | - | core.js:803, 820 |
| Theme switch reveal | click moon | clip-path circle() on ::view-transition-new(root) via WAAPI | 200ms | cubic-bezier(.2,.7,.2,1) | header.js:186-193; header.css:204-207 |
| Menu icon (hamburger/x) | state/hover | transform, opacity (bars) | 420ms (`--duration`), opacity x0.6 | overshoot (.34,1.45,.64,1) | menu-icon.js:27-38 |
| Drop-hint fade | file loaded (.hidden) | opacity | 0.3s | ease | shell.css:113 |
| Drop-icon hover | hover | border-color, color | 0.15s | ease | shell.css:130 |
| Zoom HUD reset button | hover | opacity .6→1 | 0.15s | ease | shell.css:170 |
| Zoom HUD show/hide | zoom change | `.visible` -> display:flex, **no fade** (camo-turing has its own 1s timer + opacity fade, see tools) | - | - | shell.css:150-170; camo-turing/index.html:2035 |
| Stage (zoom/pan) | wheel/drag | transform (JS-written), will-change: transform | none | - | shell.css:91 |
| Popover open/close | click trigger / Esc / click-out | `data-open` -> display only | **none** | - | core.js:835, header.css:518-531 |
| Mega menu + backdrop | nav click | display grid/block only | **none** | - | header.css:238-263 |
| Panel section collapse (`.collapsed`) | click header | display:none | none | - | apostate/index.html:139, livingpath, sinew |
| Select-picker thumbs | menu open | 1 rAF/thumbnail queue (not visual motion) | - | - | select-picker.js:83-93 |
| Armed two-click confirm | 1st click | **no transition**; colour swap on class | timeout 2600ms (apostate, livingpath), 3000 (genesis), 4000 (admin) | - | floatbar.css:204,237; livingpath:157,1362; apostate:2627; genesis:115,1753; admin:187 |

### 1b. Tool-local CSS/JS

| Tool / element | Trigger | Props | Dur | Easing | File:line |
|---|---|---|---|---|---|
| **Hub** tile reveal | IntersectionObserver `.is-in` | opacity, translateY(--space-7) | .9s, delay i%3*0.08s | ease / (.2,.7,.2,1) | index.html:104; JS 673, 689 |
| Hub manifesto words | scroll | opacity .12→1 | .5s | ease | index.html:172 |
| Hub module hover | hover | background, color | .25s | ease | index.html:215 |
| Hub dots (6 pattern previews) | infinite | hubBreath/Press/Drop/Trace/Wind/Spin | 4.2/1.4/2.2/3/1.8/3.4/6s | 5 different cubic-beziers | index.html:155-243 (these are decorative "pattern" demos, but are UI-surface motion) |
| Hub reduced-motion | media | `*{animation:none!important;transition:none!important}` + resets | - | - | index.html:281-285 (best guard in repo) |
| **Gallery** tile reveal | IO | opacity, translateY(--space-6) | .8s, stagger .08s | ease / (.2,.7,.2,1) | gallery/index.html:44, 138 |
| Gallery caption slide | hover | opacity, translateX | .3s | ease | gallery:59 |
| **FVS flyout** open | data-open | opacity, translate, scale(.965) keyframes | 300ms | (.22,1.14,.36,1) | fvs:251-257 |
| FVS flyout pad hover | hover | background | 200ms | ease | fvs:262 |
| FVS selected pad | data-on | `scale` .72→1 + opacity | 300ms / 140ms | (.3,1.42,.4,1) / ease | fvs:270, 277 |
| FVS pad press | :active | `scale` .92 | 90ms | - | fvs:284 |
| FVS Generate button leave | click | opacity | 220ms (+ JS wait 200ms) | ease | fvs:295, 6772 |
| **FVS Symbol arrival** | Generate | SVG filter per cell, rAF (blur/contrast/ripple) | cell 1000ms, sweep 1200ms, ripple 50 | custom smoothstep | fvs:6680-6760 (`GEN_ARRIVE`); guarded by reduced-motion in JS |
| FVS thumb border/shadow | hover | border-color, box-shadow | 0.12s | ease | fvs:73 |
| FVS quick-save badge | thumb hover | opacity, border, bg, colour | 0.12s x4 | ease | fvs:105 |
| FVS Figma button | click | text swap, 1600ms timer | - | - | fvs:11172 |
| Livingpath `.drop` | hover/drag-over | **transition:.16s (= all)** | .16s | ease | livingpath:46 |
| Livingpath chev | open | transform rotate | .14s | ease | livingpath:62 |
| Livingpath `.layer` idle | toggle | opacity | .16s | ease | livingpath:83 |
| Livingpath processing overlay | rendering | procPulse (opacity) 1.1s infinite; procFill width 0→100% .55s | | ease-in-out / ease-out | livingpath:186-198 (animates `width`) |
| Apostate chev | collapse | transform rotate | .15s | ease | apostate:137 |
| Apostate phrase btn | hover | bg/border/colour/transform | .12s | ease | apostate:148 |
| Sinew chev | open | **transition:.16s (all)** | .16s | ease | sinew:48 |
| Pollen/Spore/Mote progress bar | compute | **width** | 0.1s / 0.1s / .12s | ease | pollen:121; spore:108; mote:44 (+ reset via setTimeout 500/600 ms) |
| Pollen spinner | compute | rotate infinite | 0.6s | linear | pollen:38-40 |
| Pollen/Spore shape-thumb | hover | border, bg | 0.12s | ease | pollen:55; spore:47 |
| Mote kiosk hint | kiosk | opacity | .4s (+2600ms timer) | ease | mote:66, 1391 |
| Camo zoom badge | zoom | opacity | 0.2s (+1000ms timer) | ease | camo-turing:103, 2035 |
| Camo canvas | zoom | transform | 0.08s ease-out (**lags wheel zoom**) | | camo-turing:89 |
| Genesis tile | hover | background | 0.15s | ease | genesis:144 |
| Genesis `.btn-icon` | hover | **transition: all** | 0.1s | ease | genesis:243 |
| Loom track handle | hover | background | 0.1s | ease | loom:131 |
| Mycel growth playback | Play | stroke-dash edges, tips, core pulse | `--dur` / state.duration | ease-in-out | mycel:53-81, 682-713 (functional, JS-driven delays) |
| Blob Boundary | auto | GSAP timeline (generative) | - | - | blob-boundary:335 (not UI) |
| Rhizome | - | **zero CSS transitions/animations in the whole tool** (drag/wire are JS-direct) | | | rhizome/* |
| Genesis archive 55 forms | - | 77 keyframes (generative art, excluded) | 1.4-14s | | genesis/animations.css |
| design-system | demo | 2 transitions, 3 `animation:none` overrides | | | design-system/index.html:1436-38 |

Tools with **no** hover/transition at all (only rely on shared): halide, komorebi, membrane, murmur, undertow, dapple, pulsar, radial, trellis, vortex, warping, rhizome, privacy/terms/sign-in, blob-boundary. Tools with `:hover` but no `transition`: admin, colornet (2), mycel (2), tunesutra (2).

### 1c. JS animation loops (UI-related)

- core.js rAF x6: slosh (slider), switch spring, liquidCheck (3 loops, each parks at rest = good), plus `floatbarPill` using setTimeout phases.
- select-picker.js: rAF queue, 1 thumbnail per frame, parks when empty.
- header.js: one WAAPI `root.animate({clipPath})` on a view-transition pseudo.
- fvs: arrival rAF; hub index.html:2 rAFs (hero stipple + IO-gated sketches); gallery 2 (IO-gated tile loop).
- All other rAFs belong to engines (excluded).

---

## 2. Token proposal

### 2a. Observed duration clusters (UI only)
| Raw values seen | ~uses | Intent |
|---|---|---|
| 85, 90, 100 ms | 5 | instant press / list hover |
| .12s (x29), .14, .15s (x15), .16 (x4), 160 ms | ~50 | **control state** (colour/border/bg/opacity) |
| 180, 190, 200, 220 ms | 8 | small enter/exit, pill stretch, theme reveal |
| 250, 260, .25s, .3s, 300, 320 ms | 12 | emphasised state / glyph fade / flyout / switch colour |
| 400, 420, .5s | 4 | stretch/settle, hint fade, menu icon |
| .8s, .9s | 2 | scroll reveal |
| 1.1s, 1s, 0.6s, 2.6-4 s | loops | spinner / busy pulse / timers |

### 2b. Proposed
```css
/* duration */
--dur-instant: 90ms;    /* press, tiny list hover (mega link 85, flyout :active 90) */
--dur-fast:   150ms;    /* hover wash, border/colour/opacity on controls  <- collapses .12 .14 .15 .16 */
--dur-base:   220ms;    /* small enter/exit: notice, popover, hint, drop-hint, pill stretch (190) , theme reveal (200) */
--dur-slow:   320ms;    /* emphasised: switch/checkbox colour (exists: 320ms), flyout (300), glyph fade (260), caption slide (300) */
--dur-settle: 420ms;    /* overshoot landings: pill settle, menu-icon */
--dur-reveal: 800ms;    /* scroll reveals (hub .9s, gallery .8s) */
--dur-stagger: 80ms;    /* per-item reveal offset (exists as 0.08s in 2 JS places) */
--dur-loop-pulse: 1000ms; /* busy dot / processing pulse */
/* easing */
--ease-standard: ease;                               /* 99 uses today: keep as the default */
--ease-out:      cubic-bezier(0.2, 0.7, 0.2, 1);      /* 3 uses: hub, gallery, theme reveal  -> reveals, popover, notice (replace bare ease-out) */
--ease-glide:    cubic-bezier(0.32, 0.72, 0.24, 1);   /* 3 uses: floatbar glyph + pill stretch  -> "travel" */
--ease-overshoot-soft: cubic-bezier(0.28, 1.28, 0.36, 1);  /* pill settle, fvs flyout (1.14), pill size (1.34): unify 3 curves to this */
--ease-overshoot: cubic-bezier(0.3, 1.42, 0.4, 1);         /* fvs pad, menu-icon (1.45): unify 2 */
--ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1);        /* loops + symmetrical moves */
--ease-linear:   linear;                              /* spinner, ticker */
```
Also consider `@media (prefers-reduced-motion: reduce) { :root { --dur-instant:1ms; --dur-fast:1ms; --dur-base:1ms; --dur-slow:1ms; --dur-settle:1ms; --dur-reveal:1ms; --dur-stagger:0ms; } }` — one switch that neutralises every tokenised transition (the 14 hand-written guards then only remain for JS springs/keyframes). Note that `1ms` (not 0) is what panel.css/fvs already use, so `transitionend` still fires.

Already existing: only `--ind-stretch` (190 -> `--dur-base`), `--ind-settle` (420 -> `--dur-settle`), `--ind-move/--ind-size` (-> `--ease-overshoot-soft`), menu-icon `--duration/--ease` (local; point at tokens). Spring params (170/21.5/0.9, slosh stiff/damp) are not CSS-expressible; document them as `--spring-*` in tokens.json or a JS constants block in core.js.

Mapping examples: `border-color .12s` / `0.15s` / `.14s` -> `var(--dur-fast) var(--ease-standard)`; hub tile `.9s` -> `--dur-reveal --ease-out`; fvs flyout `300ms (.22,1.14,.36,1)` -> `--dur-slow --ease-overshoot-soft`.

---

## 3. Inconsistencies

**Same interaction, different timing**
- Hover colour wash: 0.085s (mega link), 0.1s (genesis btn-icon, loom handle), 0.12s (seg-btn, thumbs, apostate, pollen/spore, fvs), 0.14s (preset-trigger), 0.15s (header/shell/floatbar/genesis tile), 0.16s (livingpath/sinew), 200ms (fvs pad), .25s (hub module). Eight values for one gesture.
- Chevron rotate (disclosure): .14s (livingpath) / .15s (apostate) / .16s `all` (sinew) — and no transition at all for the section body (display:none).
- Progress bar `width`: 0.1s (pollen, spore) vs .12s (mote); livingpath uses a keyframe `procFill .55s`.
- Auto-hiding badge: camo zoom 0.2s fade + 1000ms timer; mote kiosk hint .4s + 2600ms; drop-hint .3s; notice has no fade-out at all.
- Reveal: hub .9s vs gallery .8s (same code copy-pasted, `i%3*0.08` stagger also duplicated in two JS files).
- Armed two-click timeouts: 2600 (apostate, livingpath), 3000 (genesis), 4000 (admin). Only floatbar `.is-armed` colours the state; genesis `.sm-del`, livingpath `.mini-btn`, admin `.btn--danger.armed` each restyle it, **none animate the arming**.
- Overshoot curves: five (1.14, 1.28, 1.34, 1.42, 1.45) for the same "settle with a little give" feel.
- `ease` vs `ease-out` vs bare: notice enter uses ease-out 0.18s while hub uses (.2,.7,.2,1) at .9s.

**Raw ms / cubic-bezier**: every one of the ~58 transition decls and 15 curves is raw; zero reference a token. Also magic offsets inside keyframes (`translateY(9px)`, `calc(-50% + var(--space-3))` is the only tokenised one).

**`transition: all` / implicit all**: genesis/index.html:243 (`all 0.1s`); livingpath/index.html:46 (`transition:.16s`) and sinew/index.html:48 (`transition:.16s`) — shorthand with only a time = `all`.

**Layout properties animated** (non-compositor): floatbar pill **width** (floatbar.css:157-165; also `will-change: transform, width`); progress bars **width** (pollen:121, spore:108, mote:44, livingpath `procFill` keyframe); livingpath `.drop` (`all`); loom none. Everything else is transform/opacity/colour/box-shadow (fvs thumb box-shadow).

**Missing hover transitions**: ~20 `:hover` rules in panel.css, ~17 in header.css; hover states with **no** paired transition: `.panel-select`/fields, `.org-btn` variants partially, mycel (2), colornet (2), tunesutra (2), admin (1), prose links, palette.css (1), genesis (6 of 8 `:hover` vs 2 transitions), fvs (25 hovers vs 10 transitions). Checkbox/switch: hover swell is spring-driven (fine).

**focus-visible**: shared CSS has 15 focus-visible rules (panel 7, header 5, floatbar 2, shell 1). Tools with `:hover` and zero `focus-visible`: admin, apostate, colornet(?0), genesis (8 hovers/0), livingpath, loom, mycel, spore, tunesutra(2 ok), pollen(1). fvs has 7. Sliders and checkboxes have rings; arbitrary tool buttons rely on UA default outline.

**Exit motion absent** everywhere: notice, popover, mega menu + backdrop, flyout (display:none on close; only an enter exists), Choose-content overlay, panel collapse.

**Guard dialects** (see below): `transition:none!important`, `transition-duration:1ms`, `animation-duration:1ms`, `animation:none`, JS matchMedia early-return, blanket `*{...!important}` (hub only).

### Reduced-motion: guarded vs unguarded

Guarded (14): floatbar btn+glyph+pill (floatbar.css:278); notice enter + busy dot (header.css:185); switch/checkbox colour (panel.css:513); menu-icon (shadow style); slosh/switch/liquidCheck (core.js:1059, 1271, 1398 -> rigid); theme reveal -> instant (header.js:186); hub (blanket, index.html:281); gallery tile (63) + animation loop stills (106); fvs flyout/pads/gen-go (285, 297) + arrival (6684) + generate wait (6770).

**Unguarded** (every one runs for reduced-motion users):
- shared: `.seg-btn` .12s; `.preset-trigger` .14s; header `.org-mega__link`, header buttons (78,182[unguard of the close btn only; notice guarded],220,452,593); shell `#drop-hint` .3s, `.drop-icon`, `#zoom-hud .zoom-reset`; floatbar tooltip (if any). *(Short colour washes — low risk; list for completeness.)*
- Spinner/pulse: pollen `pollen-spin`; livingpath `procPulse` (infinite opacity) and `procFill`; notice `org-pulse` is guarded.
- Reveals/large movement: none unguarded in hub/gallery; **mote kiosk-hint** (.4s opacity); **camo-turing** canvas `transform .08s`, zoom badge; **apostate** chev + phrase button; **livingpath** `.drop`, `.fx-cat-chev`, `.layer`; **sinew** chev; **pollen/spore/mote** progress width; **genesis** tile bg, btn-icon `all`; **loom** handle; **fvs** thumb (73), quicksave (105) — fvs guard block does not include them.
- Mycel growth playback + dash animation (functional playback; arguably exempt but has no static fallback).
- Genesis `animations.css` (archive only; the live Genesis page sets `animation: none !important` on tiles at genesis/index.html:153, 260 = effectively guarded).
- design-system demos.
- All tools using `createZoomPan` write transform every frame; no inertia, fine.

---

## 4. Pattern catalogue + canonical specs

(`R` = reduced-motion behaviour. "Today" = what exists.)

1. **Hover wash** — bg/border/colour of a control. `var(--dur-fast) var(--ease-standard)`; props listed explicitly, never `all`. R: tokens collapse to 1ms. Today: header.css, panel.css (.seg-btn), shell.css, fvs/pollen/spore/genesis/apostate/livingpath (8 timings).
2. **Glyph quiet->full** — opacity on the child glyph, not button (so tooltip doesn't fade). `--dur-slow --ease-glide`. floatbar.css:194.
3. **Pill slide (floatbar indicator)** — two-phase: stretch `--dur-base --ease-glide`, settle `--dur-settle --ease-overshoot-soft`; keep, but animate `transform` + `scaleX` instead of `width` (needs left-origin transform: scaleX with measured width) to stay on compositor. R: none (exists). core.js:1535-1605, floatbar.css:140-170.
4. **Press scale** — `scale: .92`, `--dur-instant`, release returns on `--dur-fast`. Only fvs flyout pad uses it (fvs:284). Candidate for all `.org-btn`/`.mini-btn`. R: omit.
5. **Selected pad arrival** — individual `scale` .72->1 + opacity; `--dur-slow --ease-overshoot` (opacity `--dur-fast`). fvs:270-282.
6. **Popover / flyout fade-scale (open)** — opacity 0->1, translateY(`--space-2`), scale .965->1; `--dur-base --ease-out` (flyout today: 300ms overshoot, keep for flyout as a "rise"). Close: opposite at `--dur-fast` (needs `[data-open]`→`[data-closing]` or `@starting-style` + `transition-behavior: allow-discrete` for display). Today: `.org-popover`, `.org-mega`, `.fvs-flyout` — only the flyout animates, popover/mega are instant. R: opacity only.
7. **Mega menu + backdrop** — panel: opacity + translateY(-`--space-2`) `--dur-base --ease-out`; backdrop opacity `--dur-base` linear. Today instant (header.css:238-263).
8. **Modal scrim / overlay** (fvs Choose content): scrim opacity `--dur-base`, panel scale .98->1 `--dur-base --ease-out`. Today instant. R: opacity only.
9. **Notice / toast** — enter: opacity + translateY(`--space-3`), `--dur-base --ease-out` (now .18s ease-out, header.css:154). Exit: reverse `--dur-fast` (missing; core.js:820 `remove()` immediately). Busy dot: `org-pulse` 1000ms ease-in-out infinite (R: none). Livingpath `#toast` and `#procMsg` are separate re-implementations — should be `Organica.notice`.
10. **Armed confirm (two-click)** — arming: colour/border -> `--danger` `--dur-fast`, label swap, timeout **3000ms** single constant (`Organica.ARM_MS`); disarm on blur/other click. Today 4 timeouts, 3 styles; only floatbar `.is-armed` standardised.
11. **Disclosure (collapsible section / fx-cat / layer)** — chevron `rotate(90deg)` `--dur-fast --ease-standard`; body height via `grid-template-rows: 0fr->1fr` `--dur-base --ease-out` (not height). Today chevron only (livingpath .14s, apostate .15s, sinew .16s "all"), body is display:none.
12. **Switch / checkbox / slider (spring)** — JS spring (170/21.5/0.9), colour `--dur-slow ease` (320ms), R: rigid. Canonical already (core.js 1040-1430). Document spring constants as tokens.
13. **Spinner / progress** — spinner: rotate 600ms linear infinite (pollen); determinate bar: `transform: scaleX(var(--p))`, transform-origin left, `--dur-fast linear`, reset by fade not width->0 timeouts; busy: `org-pulse`. Today: width transitions (3 tools) + keyframe `procFill`; no shared spinner component.
14. **Arrival / reveal (scroll)** — opacity 0->1 + translateY(`--space-6`) `--dur-reveal --ease-out`, stagger `--dur-stagger * (i%3)`; IntersectionObserver sets `.is-in`, unobserve. Today duplicated in index.html:104/673 and gallery:44/138. R: shown, no motion. Candidate for `Organica.reveal(selector)` + `.org-reveal` class.
15. **Arrival (Symbol cells)** — rAF, per-cell blur->contrast->ripple, 1000ms/cell, sweep 1200ms total; R: skip (exists). fvs:6680-6760.
16. **Theme reveal** — circular clip-path 200ms `--ease-out` from toggle; R: instant swap. header.js:186-193. (Make `200ms` = `--dur-base`.)
17. **Drag feedback** — draggable layer/fx cards: `.is-dragging` (opacity), no transition on reorder. Add `opacity/scale .98` `--dur-fast`, FLIP for list reorder is out of scope. livingpath:864, fvs:5763.
18. **Zoom HUD autohide** — `.visible` opacity 0->1 `--dur-fast`; hide after 1000ms idle (camo) `--dur-base` fade. Today display toggle in shell.css (no fade) except camo (opacity .2s); `canvasZoomHud` could own the fade.
19. **Drop-zone** — border/colour hover `--dur-fast`; drag-over `outline`/bg; drop-hint fade `--dur-base`. shell.css:113-130, livingpath .drop (all .16s).
20. **Hover caption slide** — opacity + translateX(`--space-3`), `--dur-slow --ease-out`. gallery:59.
21. **Menu icon morph** — transform `--dur-settle --ease-overshoot`; opacity x0.6. menu-icon.js.
22. **Status pill text swap** (Copy params / Figma "Sent ↗") — text swap + timer 1400/1600ms; use one `Organica.flash(btn, text, ms=1500)`. index.html:591, murmur:426, fvs:11172.
23. **Pulse/loop (decorative)** — hub dots; pattern demo only; ease-in-out/linear infinite; R: none (hub guard OK).

---

## 5. Performance risks

1. **`width` transitions** on floatbar pill (every pointer move across the bar triggers layout of an absolutely-positioned span; small, but combined with backdrop-filter on the bar parent it re-rasterises the glass blur on a changing region), and on progress bars updated per-chunk (pollen/spore/mote: `style.width` set from workers many times/sec + `transition width .1s` = layout+paint each time). Convert to `transform: scaleX`.
2. **`backdrop-filter: blur()+saturate+brightness` floatbar** (floatbar.css ~90) with an animated child (`will-change: transform, width`) — the filter region is repainted whenever the indicator moves; and `will-change` on `.org-floatbar__ind` is permanent (one layer per bar, acceptable but `width` in `will-change` is meaningless/harmful: it does not promote).
3. **`will-change: transform` permanent on `.org-stage` (shell.css:91), `loom` (41), `membrane` canvas (45)** — keeps a full-size compositor layer for large canvases at all times (GPU memory = canvas size x layers). It is justified for zoom/pan only while interacting; ok for a single stage, but flag for >8k canvases / Pollen 70k-mark SVG stage (SVG will-change: transform can force re-raster blur at scale).
4. **camo-turing canvas `transition: transform .08s ease-out`** on a zoom/pan transform written every wheel/mouse-move frame: transition restarts each write -> sluggish, and fights the HUD zoom.
5. **Spring loops (core.js)**: well-behaved — each parks itself via `rest()`, `dt` is clamped, and the slosh writes `input` events each tick only while coasting (momentum default 0). One risk: `Organica.slosh` runs `getComputedStyle(documentElement).getPropertyValue('--knob-r')` on every `knobW()` call (called per paint) — a forced style recalc inside rAF; cache once. Dozens of sliders each with a loop may animate simultaneously only when touched, fine.
6. **FVS Symbol arrival**: SVG feTurbulence + feDisplacementMap + feGaussianBlur filter per cell over a `<use>` of the whole Symbol. CLAUDE.md measures 54 fps for 6x6 and 41 fps on 45 hexagons — the 1000ms/cell with filters scales O(cells x symbol complexity); no cap on cell count (`n` cap?) — add a ceiling (e.g. skip arrival >60 cells).
7. **box-shadow transition** on fvs thumb (73) — repaints; fine at 96px thumbs but a gallery of 100+ thumbs hovering is cheap anyway. `box-shadow` on `.org-notice`/popover is static.
8. **Floatbar `floatbarPill` MutationObserver** on `style, class` attributes of the whole bar subtree + ResizeObserver: any tool that updates a style inside the bar (e.g. type-tester slider thumb custom props `--sf`? those are on inputs in `.fb-tester` inside the bar!) fires `go()` repeatedly; the observer filters only mutations on its own indicator. During slider drag in the Living Path/Apostate floatbar every `--sf`/`--fv` style write triggers a mutation record -> `go()` -> `measure()` (layout reads). Worth verifying: `attributeFilter` includes `'style'`.
9. **Long-lived rAF**: hub hero + sketches are IO-gated (good); gallery one loop that only advances on-screen tiles (good); mycel uses CSS animations with hundreds of `.edge` elements each with `animationDelay` inline (mycel:706) — N compositor-unfriendly stroke-dashoffset animations (stroke-dashoffset is paint-only, not compositor) — can be heavy on large networks. Genesis archive: 55 infinite keyframe sets incl. `d:path()` morphs (paint-heavy) but archived.
10. **`transition: all`** (genesis btn-icon, livingpath .drop, sinew chev): picks up unintended property changes (e.g. width on resize).
11. **View Transition theme reveal** snapshots the whole root, including huge SVG stages and canvases; on heavy pages (Pollen 70k marks, Spore) the snapshot + 200ms circle clip may drop frames — header.js already falls back instantly when API missing/reduced; consider skipping when `document.querySelectorAll('svg *').length > N`.
12. **Timers vs transitions drift**: `setTimeout(..., 150)` hands the pill from stretch to settle independent of `--ind-stretch` (190ms): if the token changes, JS must read it. Same for `fvs` 200ms wait vs 220ms opacity transition. Read durations from `getComputedStyle` or use `transitionend`.

---

## 6. Suggested rollout (low risk first)
1. Add `--dur-*`/`--ease-*` + reduced-motion collapse to tokens.css (+tokens.json, design-system "Motion" section with live demos in both themes).
2. Replace raw values in shared css (header/panel/shell/floatbar) -> tokens; point `--ind-*` and menu-icon at tokens.
3. One `Organica.reveal()` (hub+gallery), one `Organica.ARM_MS`, one `Organica.flash()`; tool-local transitions swapped to tokens; remove 3 `transition: all`.
4. Add exit motion for notice/popover/mega/flyout via `[data-open]` + `@starting-style` (`transition-behavior: allow-discrete`).
5. Convert width transitions (pill, progress bars) to `transform: scaleX`.
6. Fill unguarded motions (list in §3) — most vanish after step 1 because the token collapse handles them.
