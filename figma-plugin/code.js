figma.showUI(__html__, { width: 300, height: 260 });

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'import-svg') return;

  const svg = msg.svg;
  if (!svg) {
    figma.ui.postMessage({ type: 'error', message: 'No SVG data received' });
    return;
  }

  try {
    const node = figma.createNodeFromSvg(svg);
    node.name = `organic-trace-${Date.now()}`;

    // Resize to 800px wide, keep aspect ratio
    const scale = 800 / node.width;
    node.resize(800, node.height * scale);

    // Find or create "↓ Incoming Shapes" frame
    let frame = figma.currentPage.children.find(
      n => n.type === 'FRAME' && n.name === '↓ Incoming Shapes'
    );
    if (!frame) {
      frame = figma.createFrame();
      frame.name = '↓ Incoming Shapes';
      frame.resize(900, 900);
      frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      frame.clipsContent = false;
    }

    frame.appendChild(node);
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.ui.postMessage({ type: 'done', nodeId: node.id });
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String(e) });
  }
};
