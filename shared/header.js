/* ─────────────────────────────────────────────────────────────────────────────
 * header.js — the two things the header builds for itself.
 *
 *  1. Mega menu   — the nav button (.org-header__nav, static in every page's
 *                   markup) opens a full-width panel of every tool, one column
 *                   per group, from Organica.tools (shared/tools.js).
 *  2. Pattern switcher — four round buttons (right of the bar) that set the
 *                   canvas pattern: <html data-canvas-pattern>, persisted in
 *                   localStorage['organica.ui.canvas-pattern'].
 *  3. Theme button — light/dark, only on pages that opt in with
 *                   <html data-theme-support>: <html data-theme="dark">,
 *                   persisted in localStorage['organica.ui.theme'] (applied
 *                   before paint by pattern-init.js). Dark flips the chrome
 *                   only; the sheet (.org-stage) stays light — see tokens.css.
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

    // The foot: Rhizome (chains the tools, so not a column) + the explorations, one line each.
    var foot = el('div', 'org-mega__foot');
    var pipe = Organica.toolsPipeline;
    if (pipe) {
      var row = el('div', 'org-mega__foot-row');
      row.appendChild(el('b', null, 'Chain them all'));
      row.appendChild(link('org-mega__foot-link', pipe[0] + ' →', pipe[1]));
      foot.appendChild(row);
    }
    var exp = Organica.explorations || [];
    if (exp.length) {
      var row2 = el('div', 'org-mega__foot-row');
      row2.appendChild(el('b', null, 'Explorations'));
      exp.forEach(function (it) { row2.appendChild(link('org-mega__foot-link', it[0], it[1])); });
      foot.appendChild(row2);
    }
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
    /* The hamburger morphs to an X while the menu is open (shared/menu-icon.js). */
    var icon = btn.querySelector('menu-icon');
    if (icon) {
      var syncIcon = function () { icon.setAttribute('state', btn.getAttribute('aria-expanded') === 'true' ? 'close' : 'menu'); };
      new MutationObserver(syncIcon).observe(btn, { attributes: true, attributeFilter: ['aria-expanded'] });
      syncIcon();
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

  /* ── 3. Theme button ────────────────────────────────────────────────────── */
  var THEME_KEY = 'organica.ui.theme';
  var SUN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>';
  var MOON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z"/></svg>';
  function mountTheme(header) {
    var root = document.documentElement;
    if (!root.hasAttribute('data-theme-support') || header.querySelector('.org-theme')) return;
    var b = el('button', 'org-theme');
    b.type = 'button';
    function sync() {
      var dark = root.getAttribute('data-theme') === 'dark';
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', 'Dark mode');
      b.title = dark ? 'Switch to light' : 'Switch to dark';
      b.innerHTML = dark ? SUN : MOON;
    }
    /* The switch itself — one synchronous DOM change, so a View Transition can snapshot around it. */
    function swap(dark) {
      if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) { /* not persisted */ }
      sync();
      document.dispatchEvent(new CustomEvent('organica:theme', { detail: { dark: dark } }));
    }
    /* Circular reveal from the button (the View Transitions technique of Magic UI's AnimatedThemeToggler,
       ported to vanilla — Oct 1, 2026). Falls back to the instant swap where the API is missing or the
       user prefers reduced motion. The default cross-fade is switched off in header.css. */
    b.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') !== 'dark';
      var still = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || still) { swap(dark); return; }
      var r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      var radius = Math.hypot(Math.max(x, global.innerWidth - x), Math.max(y, global.innerHeight - y));
      var t = document.startViewTransition(function () { swap(dark); });
      t.ready.then(function () {
        root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 400, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' });
      }, function () { /* transition skipped — the swap already ran */ });
    });
    header.appendChild(b);
    sync();
  }

  Organica.headerInit = function () {
    var header = document.querySelector('.org-header');
    if (!header) return;
    mountMega(header);
    mountPattern(header);
    mountTheme(header);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Organica.headerInit);
  else Organica.headerInit();
})(typeof window !== 'undefined' ? window : this);
