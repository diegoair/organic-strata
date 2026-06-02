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

      // Separate-layers mode: path elements with data-class → sub-groups
      const svgOpenTag = (svg.match(/<svg\b[^>]*>/) || ['<svg xmlns="http://www.w3.org/2000/svg">'])[0];
      const pathElems = [...svg.matchAll(/<path\b[^>]*\bid="(shape-\d+)"[^>]*\/?>/g)];
      if (pathElems.length > 1) {
        const ts = Date.now();

        // Bucket nodes by data-class
        const buckets = { primary: [], secondary: [], detail: [] };
        for (const m of pathElems) {
          const fullElem = m[0];
          const shapeId  = m[1];
          const clsMatch = fullElem.match(/data-class="([^"]+)"/);
          const cls      = clsMatch ? clsMatch[1] : 'detail';
          const singleSvg = `${svgOpenTag}\n${fullElem}\n</svg>`;
          try {
            const node = figma.createNodeFromSvg(singleSvg);
            node.name = `${shapeId} [${cls}]`;
            (buckets[cls] || buckets.detail).push(node);
          } catch (_) {}
        }

        const allNodes = [...buckets.primary, ...buckets.secondary, ...buckets.detail];
        if (allNodes.length === 0) {
          figma.ui.postMessage({ type: 'error', message: 'No paths imported' });
          return;
        }

        // Build sub-groups (skip empty buckets)
        const subGroups = [];
        const subGroupDefs = [
          { key: 'primary',   name: 'Primary'   },
          { key: 'secondary', name: 'Secondary' },
          { key: 'detail',    name: 'Details'   },
        ];
        for (const def of subGroupDefs) {
          const nodes = buckets[def.key];
          if (nodes.length === 0) continue;
          const sg = figma.group(nodes, figma.currentPage);
          sg.name = def.name;
          subGroups.push(sg);
        }

        const topGroup = figma.group(subGroups, figma.currentPage);
        topGroup.name = `organic-trace-${ts}`;
        frame.appendChild(topGroup);
        figma.viewport.scrollAndZoomIntoView([topGroup]);
        figma.ui.postMessage({ type: 'done', nodeId: topGroup.id });
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
