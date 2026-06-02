figma.showUI(__html__, { width: 300, height: 280 });

function getOrCreateFrame() {
  let frame = figma.currentPage.children.find(
    n => n.type === 'FRAME' && n.name === '↓ Incoming Shapes'
  );
  if (!frame) {
    frame = figma.createFrame();
    frame.name = '↓ Incoming Shapes';
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    frame.clipsContent = false;
  }
  return frame;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import-svg') {
    const svg = msg.svg;
    if (!svg) {
      figma.ui.postMessage({ type: 'error', message: 'No SVG data received' });
      return;
    }
    try {
      const frame = getOrCreateFrame();

      // Separate-paths mode: each <path id="shape-NNN"> becomes its own vector node
      const svgOpenTag = (svg.match(/<svg\b[^>]*>/) || ['<svg xmlns="http://www.w3.org/2000/svg">'])[0];
      const pathElems = [...svg.matchAll(/<path\b[^>]*\bid="(shape-\d+)"[^>]*\/?>/g)];
      if (pathElems.length > 1) {
        const ts = Date.now();
        const nodes = [];
        for (const m of pathElems) {
          const shapeId = m[1];
          const pathElem = m[0];
          const singleSvg = `${svgOpenTag}\n${pathElem}\n</svg>`;
          try {
            const node = figma.createNodeFromSvg(singleSvg);
            node.name = shapeId;
            nodes.push(node);
          } catch (_) {}
        }
        if (nodes.length === 0) {
          figma.ui.postMessage({ type: 'error', message: 'No paths imported' });
          return;
        }
        const group = figma.group(nodes, figma.currentPage);
        group.name = `organic-trace-${ts}`;
        frame.appendChild(group);
        figma.viewport.scrollAndZoomIntoView([group]);
        figma.ui.postMessage({ type: 'done', nodeId: group.id });
        return;
      }

      // Single / simplified mode: import as one node
      const node = figma.createNodeFromSvg(svg);
      node.name = `organic-trace-${Date.now()}`;
      const scale = 800 / node.width;
      node.resize(800, node.height * scale);
      frame.appendChild(node);
      figma.viewport.scrollAndZoomIntoView([node]);
      figma.ui.postMessage({ type: 'done', nodeId: node.id });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: String(e) });
    }

  } else if (msg.type === 'import-regions') {
    const items = msg.items; // [{label, svg}, ...]
    if (!items || items.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'No region data received' });
      return;
    }
    try {
      const frame = getOrCreateFrame();
      const nodes = [];
      let cursorX = 0;

      for (const item of items) {
        const node = figma.createNodeFromSvg(item.svg);
        node.name = `organic-trace-${item.label}`;
        const scale = 800 / node.width;
        node.resize(800, node.height * scale);
        node.x = cursorX;
        node.y = 0;
        frame.appendChild(node);
        nodes.push(node);
        cursorX += 800 + 40;
      }

      const maxH = Math.max(...nodes.map(n => n.height));
      frame.resize(cursorX - 40, maxH);

      figma.viewport.scrollAndZoomIntoView(nodes);
      figma.ui.postMessage({ type: 'done-regions', count: nodes.length });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: String(e) });
    }
  }
};
