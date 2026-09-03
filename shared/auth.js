/* ─────────────────────────────────────────────────────────────────────────────
 * auth.js — Organica's thin wrapper over Supabase Auth + the site gate.
 *
 * LOAD ORDER: vendor/supabase-js.min.js → core.js → supabase.js → auth.js →
 *             store.js → tool script.
 *
 * The gate is CLIENT-SIDE (no framework, no edge middleware): a tool calls
 * Organica.auth.requireAuth() near the top of its init; with no session the
 * page is replaced by /sign-in?next=<path>. Data is safe regardless — RLS
 * blocks every read/write without a valid session — so serving the static
 * tool shell to a signed-out visitor for the ~1 frame before redirect is fine.
 *
 * ── Organica.auth ───────────────────────────────────────────────────────────
 *   session()            → Promise<Session|null>   (fast; no network unless refreshing)
 *   user()               → Promise<User|null>
 *   userIdSync()         → string|null  — from the persisted token, no await,
 *                          for store.js to decide local-only vs synced at load
 *   signIn(email, pw)    → Promise<{ error }>
 *   signInOtp(email)     → Promise<{ error }>   — magic link
 *   signInWithGoogle(next) → Promise<{ error }> — redirects to Google; on return
 *                          lands back on /sign-in?next=<next> with the session
 *   signOut()            → Promise   — clears the session, sends to /sign-in
 *   onChange(cb)         → unsubscribe fn; cb(session) on every auth state change
 *   requireAuth(opts?)   → Promise<Session>   — redirects to /sign-in if none.
 *                          opts.redirect = false to just resolve null instead.
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};
  var sb = Organica.sb;

  var SIGN_IN = '/sign-in';
  var TOKEN_KEY = 'organica.auth.token';

  function onSignInPage() {
    return location.pathname === SIGN_IN || location.pathname === SIGN_IN + '/' ||
           location.pathname === SIGN_IN + '/index.html';
  }

  // Read the user id straight out of the persisted session — no await, no
  // network. store.js uses this at construction to pick local-only vs synced.
  function userIdSync() {
    try {
      var raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      // supabase-js stores { access_token, user: {...}, ... } (shape has been
      // stable across v2). Fall back through the couple of nestings seen.
      var u = (obj && (obj.user || (obj.currentSession && obj.currentSession.user)));
      return (u && u.id) || null;
    } catch (e) { return null; }
  }

  var auth = {
    userIdSync: userIdSync,

    session: function () {
      if (!sb) return Promise.resolve(null);
      return sb.auth.getSession().then(function (r) {
        return (r && r.data && r.data.session) || null;
      });
    },

    user: function () {
      return auth.session().then(function (s) { return s ? s.user : null; });
    },

    signIn: function (email, password) {
      if (!sb) return Promise.resolve({ error: new Error('auth unavailable') });
      return sb.auth.signInWithPassword({ email: email, password: password })
        .then(function (r) { return { error: r.error || null }; });
    },

    signInOtp: function (email) {
      if (!sb) return Promise.resolve({ error: new Error('auth unavailable') });
      return sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + SIGN_IN },
      }).then(function (r) { return { error: r.error || null }; });
    },

    signInWithGoogle: function (next) {
      if (!sb) return Promise.resolve({ error: new Error('auth unavailable') });
      var back = location.origin + SIGN_IN +
        (next ? '?next=' + encodeURIComponent(next) : '');
      return sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: back },
      }).then(function (r) { return { error: r.error || null }; });
    },

    signOut: function () {
      if (!sb) { location.replace(SIGN_IN); return Promise.resolve(); }
      return sb.auth.signOut().then(function () { location.replace(SIGN_IN); });
    },

    onChange: function (cb) {
      if (!sb) return function () {};
      var r = sb.auth.onAuthStateChange(function (_evt, session) { cb(session); });
      return function () {
        try { r.data.subscription.unsubscribe(); } catch (e) {}
      };
    },

    requireAuth: function (opts) {
      opts = opts || {};
      return auth.session().then(function (s) {
        if (s) return s;
        if (opts.redirect === false) return null;
        if (!onSignInPage()) {
          var next = encodeURIComponent(location.pathname + location.search);
          location.replace(SIGN_IN + '?next=' + next);
        }
        // Never resolves — the page is being replaced.
        return new Promise(function () {});
      });
    },
  };

  Organica.auth = auth;

  // ── Auto-gate ──────────────────────────────────────────────────────────────
  // Any page that loads auth.js requires a session. The sign-in / privacy /
  // terms pages are public; a page can also opt out with
  //   <script>window.ORGANICA_PUBLIC = true;</script>  BEFORE auth.js.
  // Local dev (localhost / 127.0.0.1 / *.local) is never gated — the no-cache
  // dev server is used signed-out; store.js already falls back to the
  // localStorage cache with no session. Data is safe regardless (RLS) — the
  // gate just spares a signed-out visitor the broken-looking empty tool.
  var DEV_HOSTS = { 'localhost': 1, '127.0.0.1': 1, '::1': 1, '0.0.0.0': 1 };
  auth.isLocalDev = function () {
    var h = location.hostname;
    return !!DEV_HOSTS[h] || h.slice(-6) === '.local';
  };
  (function () {
    if (auth.isLocalDev()) return;
    var PUBLIC = ['/sign-in', '/privacy', '/terms'];
    var p = location.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/';
    if (PUBLIC.indexOf(p) !== -1) return;
    if (global.ORGANICA_PUBLIC === true) return;
    auth.requireAuth();
  })();
})(typeof window !== 'undefined' ? window : this);
