/* ─────────────────────────────────────────────────────────────────────────────
 * supabase.js — the Organica Supabase client (one per page).
 *
 * Organica is 18 static HTML tools, no build step. This wires the vendored
 * @supabase/supabase-js UMD (shared/vendor/supabase-js.min.js, MIT) into one
 * shared client hung off Organica, so auth.js + store.js can talk to it.
 *
 * LOAD ORDER: vendor/supabase-js.min.js → core.js → supabase.js → auth.js →
 *             store.js → tool script.
 *
 * The URL + publishable key below are PUBLIC by design (like a Firebase web
 * config or a Stripe publishable key). Every byte of an Organica tool is
 * client-side already; row-level security in Postgres is the actual guard —
 * a signed-out client, or one signed in as user B, cannot read user A's rows.
 *
 * ── Organica.sb ──────────────────────────────────────────────────────────────
 *   the live SupabaseClient. null only if the vendor script failed to load.
 * ── Organica.supabaseConfig ─────────────────────────────────────────────────
 *   { url, key } — read by nothing else, kept for reference / a future env swap.
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};

  var CONFIG = {
    url: 'https://dgzxsqdrktqgpnewxtwf.supabase.co',
    // anon / public key. Safe to ship in client code — it only grants the
    // `anon` Postgres role, and every table has RLS so a request still can't
    // touch a row unless it carries a valid user session.
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnenhzcWRya3RxZ3BuZXd4dHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMzU1MjcsImV4cCI6MjEwMzkxMTUyN30.zdLNQFzdh28PmjCAeUkS9jqcjGX8B2txkJ5nL-MvRTs',
  };
  Organica.supabaseConfig = CONFIG;

  // The UMD build defines a global `supabase` with .createClient.
  var lib = global.supabase;
  if (!lib || typeof lib.createClient !== 'function') {
    console.error('[Organica] shared/vendor/supabase-js.min.js did not load — ' +
      'auth and cloud sync are disabled for this page.');
    Organica.sb = null;
    return;
  }

  Organica.sb = lib.createClient(CONFIG.url, CONFIG.key, {
    auth: {
      // The session lives in localStorage under this key and is silently
      // refreshed. One key for the whole origin so every tool shares the login.
      storageKey: 'organica.auth.token',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,   // magic-link / OAuth redirects land with a hash
    },
  });
})(typeof window !== 'undefined' ? window : this);
