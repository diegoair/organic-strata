# Organic Strata

> A generative shape system that learns your visual language.
> Sketch → SVG → Figma. No copy-paste.

## Architecture

```
strata/          → Vercel (static, always deployed)
backend/         → Local (Python + OpenCV + potrace)
figma-plugin/    → Figma MCP / Plugin API
```

## Quick Start

### Strata (Vercel)
Deployed automatically on push to `main`.

### Backend (Local)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 server.py
```
Server runs at `http://localhost:5050`

### Figma
Set your Figma file URL in `strata/.env.local`:
```
FIGMA_FILE_URL=https://figma.com/design/...
```

## Shape Grammar
Extracted from hand-drawn sketches. 8 core parameters:
- curve_tension · nesting_depth · density · variation_index
- boundary_pressure · stroke_weight_ratio · vertical_bias · composition_mode

## Roadmap
- [x] Phase 1 — Sketch → SVG pipeline
- [ ] Phase 2 — Language Engine (generative variations)
- [ ] Phase 3 — Figma Plugin (direct push)
- [ ] Phase 4 — Cloud backend (Railway)
