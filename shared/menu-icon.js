// <menu-icon> — animated hamburger icon. Zero dependencies.
// Usage:  <script src="menu-icon.js"></script>
//         <button aria-label="Open menu" aria-expanded="false"><menu-icon state="menu"></menu-icon></button>
// States: menu | close | minus      Attributes: state, size (px), line-cap="square"
// Hover emphasis is automatic (on the icon or its parent button/link); add no-hover to disable.
// CSS vars: --color, --thickness (in 24-unit grid, default 2), --duration, --ease
// JS: el.state = 'close'; el.toggle('menu','close'); el.addEventListener('statechange', e => e.detail.state)

(() => {
  // Per bar: [x, y, rotateDeg, scaleX, opacity] on a 24×24 grid, bars 18 long.
  const STATES = {
    menu:  [[0, -6, 0, 1, 1], [0, 0, 0, 1, 1], [0, 6, 0, 1, 1]],
    close: [[0, 0, 45, 1, 1], [0, 0, 0, 0, 0], [0, 0, -45, 1, 1]],
    minus: [[0, 0, 0, 1, 1], [0, 0, 0, 1, 1], [0, 0, 0, 1, 1]],
  };
  // Hover emphasis: applied while the icon (or its button/link) is hovered or focused.
  const HOVER = {
    menu:  [[0, -7, 0, 1, 1], [-3, 0, 0, 0.66, 1], [0, 7, 0, 1, 1]],
    close: [[0, 0, 45, 1.12, 1], [0, 0, 0, 0, 0], [0, 0, -45, 1.12, 1]],
    minus: [[0, 0, 0, 0.8, 1], [0, 0, 0, 0.8, 1], [0, 0, 0, 0.8, 1]],
  };
  const u = (n) => `calc(var(--size) * ${n} / 24)`;

  class MenuIcon extends HTMLElement {
    static observedAttributes = ['state', 'size'];
    static STATES = STATES;
    static HOVER = HOVER;
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{--size:24px;--color:currentColor;--thickness:2;--duration:420ms;--ease:cubic-bezier(.34,1.45,.64,1);
          display:inline-block;position:relative;width:var(--size);height:var(--size);vertical-align:middle;flex:none}
        i{position:absolute;left:12.5%;top:50%;width:75%;height:calc(var(--size) * var(--thickness) / 24);
          margin-top:calc(var(--size) * var(--thickness) / -48);background:var(--color);border-radius:999px;
          transition:transform var(--duration) var(--ease),opacity calc(var(--duration) * .6) ease}
        :host([line-cap="square"]) i{border-radius:0}
        @media (prefers-reduced-motion:reduce){i{transition:none}}
      </style><i></i><i></i><i></i>`;
      this._bars = [...root.querySelectorAll('i')];
    }
    connectedCallback() {
      if (!this.hasAttribute('aria-hidden')) this.setAttribute('aria-hidden', 'true');
      // Hover target: nearest button/link, else the icon itself. Add no-hover to opt out.
      this._target = this.closest('button,a,[role="button"]') || this;
      this._on = () => { this._hover = !this.hasAttribute('no-hover'); this._apply(); };
      this._off = () => { this._hover = false; this._apply(); };
      for (const [e, f] of [['pointerenter', this._on], ['pointerleave', this._off], ['focusin', this._on], ['focusout', this._off]]) this._target.addEventListener(e, f);
      this._apply();
    }
    disconnectedCallback() {
      for (const [e, f] of [['pointerenter', this._on], ['pointerleave', this._off], ['focusin', this._on], ['focusout', this._off]]) this._target?.removeEventListener(e, f);
    }
    attributeChangedCallback(name, prev, next) {
      if (name === 'size') this.style.setProperty('--size', /^\d+(\.\d+)?$/.test(next) ? next + 'px' : next);
      if (name === 'state') {
        this._apply();
        if (prev !== null && prev !== next) this.dispatchEvent(new CustomEvent('statechange', { detail: { state: this.state, previous: prev }, bubbles: true }));
      }
    }
    get state() { const s = this.getAttribute('state'); return STATES[s] ? s : 'menu'; }
    set state(v) { this.setAttribute('state', v); }
    toggle(a = 'menu', b = 'close') { this.state = this.state === a ? b : a; return this.state; }
    _apply() {
      (this._hover ? HOVER : STATES)[this.state].forEach(([x, y, r, s, o], i) => {
        const bar = this._bars[i];
        bar.style.transform = `translate(${u(x)}, ${u(y)}) rotate(${r}deg) scaleX(${s})`;
        bar.style.opacity = o;
      });
    }
  }
  if (!customElements.get('menu-icon')) customElements.define('menu-icon', MenuIcon);
})();
