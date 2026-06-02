# Organic Strata — Figma Plugin

Imports the latest traced SVG from the local backend directly into your Figma file.

## Install

1. In Figma: **Main menu → Plugins → Development → Import plugin from manifest…**
2. Select `figma-plugin/manifest.json` from this repo
3. The plugin appears under **Plugins → Development → Organic Strata**

## Usage

1. Start the backend: `cd backend && python3 server.py`
2. In the web app, trace a sketch and click **→ Figma**
3. Open the Figma plugin — you should see a green dot ("Backend ready")
4. Click **→ Import Latest Shape**
5. The SVG is placed into a frame named **↓ Incoming Shapes** on the current page

## Requirements

- Backend running on `http://localhost:5050`
- `FIGMA_TOKEN` set in `backend/.env`
