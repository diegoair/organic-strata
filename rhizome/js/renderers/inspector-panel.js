/* ─────────────────────────────────────────────────────────────
   Rhizome — node inspector, rendered into the shared #panel
   (shared/organica-panel.css) when a node is selected (Piano Parte
   3.4e). Organica.autoLabelPanel(document) is called after every
   rebuild — a panel that rebuilds on every selection is a much higher-
   frequency rebuild site than Genesis Creator's own single-page rebuild,
   where exactly this omission (22 unlabeled controls) was found and
   fixed earlier this session — so it is not being skipped again here.
   ───────────────────────────────────────────────────────────── */

export function renderInspector(panelEl, node, nodeType, onChange, exportActions) {
  panelEl.innerHTML = '';
  if (!node) {
    panelEl.innerHTML = '<div class="panel-section"><p class="hint">Select a node to edit its parameters.</p></div>';
    return;
  }

  const section = document.createElement('div');
  section.className = 'panel-section';
  const h3 = document.createElement('h3');
  h3.textContent = nodeType.meta.label;
  section.appendChild(h3);

  for (const p of nodeType.meta.params) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';

    const label = document.createElement('span');
    label.className = 'ctrl-label';
    label.textContent = p.name;
    row.appendChild(label);

    let control;
    if (p.type === 'select') {
      control = document.createElement('select');
      control.className = 'panel-select';
      for (const opt of p.options) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        control.appendChild(o);
      }
      control.value = node.params[p.name];
      control.addEventListener('change', () => { node.params[p.name] = control.value; onChange(); });
    } else if (p.type === 'file') {
      control = document.createElement('button');
      control.className = 'mini-btn';
      control.type = 'button';
      control.textContent = node.params[p.name] ? 'Replace…' : 'Upload…';
      control.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = p.accept || '*';
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => { node.params[p.name] = reader.result; onChange(); };
          reader.readAsText(file);
        });
        input.click();
      });
    } else {
      control = document.createElement('input');
      control.type = 'range';
      control.min = p.min; control.max = p.max; control.step = p.step || 1;
      control.value = node.params[p.name];
      const val = document.createElement('span');
      val.className = 'ctrl-val';
      val.textContent = node.params[p.name];
      control.addEventListener('input', () => {
        node.params[p.name] = parseFloat(control.value);
        val.textContent = control.value;
        onChange();
      });
      row.appendChild(control);
      row.appendChild(val);
      section.appendChild(row);
      continue;
    }
    row.appendChild(control);
    section.appendChild(row);
  }

  if (!nodeType.meta.params.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'This node has no parameters.';
    section.appendChild(p);
  }

  panelEl.appendChild(section);

  if (nodeType.meta.id === 'export' && exportActions) {
    const actions = document.createElement('div');
    actions.className = 'panel-section';
    const rowBtns = document.createElement('div');
    rowBtns.className = 'row-btns';
    const btnPNG = document.createElement('button');
    btnPNG.className = 'mini-btn'; btnPNG.textContent = 'PNG';
    btnPNG.addEventListener('click', () => exportActions.png());
    const btnSVG = document.createElement('button');
    btnSVG.className = 'mini-btn'; btnSVG.textContent = 'SVG';
    btnSVG.addEventListener('click', () => exportActions.svg());
    const btnFigma = document.createElement('button');
    btnFigma.className = 'mini-btn'; btnFigma.textContent = '→ Figma';
    btnFigma.addEventListener('click', () => exportActions.figma());
    rowBtns.append(btnPNG, btnSVG, btnFigma);
    actions.appendChild(rowBtns);
    panelEl.appendChild(actions);
  }

  Organica.autoLabelPanel(panelEl);
}
