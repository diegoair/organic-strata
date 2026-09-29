/* ─────────────────────────────────────────────────────────────────────────────
 * header.js — the two things the header builds for itself.
 *
 *  1. Mega menu   — the nav button (.org-header__nav, static in every page's
 *                   markup) opens a full-width panel of every tool, one column
 *                   per group, from Organica.tools (shared/tools.js).
 *  2. Pattern switcher — four round buttons (right of the bar) that set the
 *                   canvas pattern: <html data-canvas-pattern>, persisted in
 *                   localStorage['organica.ui.canvas-pattern'].
 *
 * LOAD ORDER: … → core.js (Organica.popover, optional) → tools.js → header.js.
 * Sign Up / Login + the account control are auth-badge.js's job, not this file's.
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};

  var PATTERNS = [
    { id: 'dots',  label: 'Dots' },
    { id: 'grid',  label: 'Grid' },
    { id: 'lines', label: 'Lines' },
    { id: 'plain', label: 'Plain' }
  ];
  var KEY = 'organica.ui.canvas-pattern';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ── 1. Mega menu — Pinterest's top-left menu, in our tokens (see header.css) ── */
  function mountMega(header) {
    var btn = header.querySelector('.org-header__nav');
    if (!btn || header.querySelector('.org-mega')) return;
    var tools = Organica.tools || [];
    var here = location.pathname.replace(/\/index\.html$/, '');

    function link(cls, name, href) {
      var a = el('a', cls, name);
      a.href = href;
      var path = href.replace(/\/$/, '');
      if (href === '/' ? here === '/' : here.indexOf(path) === 0) a.setAttribute('aria-current', 'page');
      return a;
    }

    var panel = el('nav', 'org-mega');
    panel.id = btn.getAttribute('aria-controls') || 'org-mega';
    panel.setAttribute('aria-label', 'All tools');

    tools.forEach(function (g) {
      var col = el('div', 'org-mega__group');
      col.appendChild(el('div', 'org-mega__title', g.group));
      var links = el('div', 'org-mega__links');
      g.items.forEach(function (it) { links.appendChild(link('org-mega__link', it[0], it[1])); });
      col.appendChild(links);
      panel.appendChild(col);
    });

    var foot = el('div', 'org-mega__foot');
    foot.appendChild(el('b', null, 'Organica:'));
    foot.appendChild(document.createTextNode('Visual Design Language System'));
    panel.appendChild(foot);
    header.appendChild(panel);

    var backdrop = el('div', 'org-mega__backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    header.appendChild(backdrop);       // a sibling AFTER the panel: `.org-mega[data-open] ~ .org-mega__backdrop`

    var api = null;
    if (Organica.popover) {
      api = Organica.popover(btn, panel);
      btn.setAttribute('aria-haspopup', 'true');   // a menu of links, not a dialog
      panel.removeAttribute('role');
    } else {
      btn.addEventListener('click', function () {
        var o = panel.dataset.open !== 'true';
        panel.dataset.open = String(o);
        btn.setAttribute('aria-expanded', String(o));
      });
    }
    backdrop.addEventListener('click', function () {
      if (api) api.close(); else { panel.dataset.open = 'false'; btn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ── 2. Pattern switcher ────────────────────────────────────────────────── */
  function current() {
    return document.documentElement.getAttribute('data-canvas-pattern') || 'dots';
  }
  function apply(id) {
    if (id === 'dots') document.documentElement.removeAttribute('data-canvas-pattern');
    else document.documentElement.setAttribute('data-canvas-pattern', id);
    try { localStorage.setItem(KEY, id); } catch (e) { /* not persisted */ }
  }
  function mountPattern(header) {
    if (header.querySelector('.org-pattern')) return;
    var group = el('div', 'org-pattern');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Canvas pattern');
    var buttons = PATTERNS.map(function (p) {
      var b = el('button', 'org-pattern__dot');
      b.type = 'button';
      b.dataset.pattern = p.id;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', p.label);
      b.title = p.label;
      b.addEventListener('click', function () { apply(p.id); sync(); });
      group.appendChild(b);
      return b;
    });
    function sync() {
      var c = current();
      buttons.forEach(function (b) {
        var on = b.dataset.pattern === c;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
    }
    group.addEventListener('keydown', function (e) {
      var i = PATTERNS.map(function (p) { return p.id; }).indexOf(current());
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (i + 1) % PATTERNS.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (i + PATTERNS.length - 1) % PATTERNS.length;
      else return;
      e.preventDefault();
      apply(PATTERNS[i].id); sync(); buttons[i].focus();
    });
    header.appendChild(group);
    sync();
  }

  Organica.headerInit = function () {
    var header = document.querySelector('.org-header');
    if (!header) return;
    mountMega(header);
    mountPattern(header);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Organica.headerInit);
  else Organica.headerInit();
})(typeof window !== 'undefined' ? window : this);
