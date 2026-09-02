/* ─────────────────────────────────────────────────────────────────────────────
 * store.js — Organica's per-user cloud store, a drop-in superset of
 * Organica.presetStore (shared/core.js).
 *
 * LOAD ORDER: vendor/supabase-js.min.js → core.js → supabase.js → auth.js →
 *             store.js → tool script.  (store.js reassigns Organica.presetStore.)
 *
 * WHY A SUPERSET: every tool already does
 *     const PRESETS = Organica.presetStore('mytool'[, legacyKey]);
 *     PRESETS.read()  // sync → { [name]: snapshot }
 *     PRESETS.write(obj)
 * store.js keeps read()/write() SYNCHRONOUS against a localStorage cache (byte
 * identical to today), so nothing breaks if a tool never migrates. On top:
 *
 *   pull()        → Promise<obj>  — refresh the cache from Postgres. No-op that
 *                   just resolves read() when signed out. Call once on init and
 *                   render the preset list from the result.
 *   push()        → Promise      — upsert the whole current cache (rarely needed;
 *                   write() already syncs incrementally).
 *   onSync(cb)    → unsub fn      — cb(obj) after every successful pull, and
 *                   after a background write flush, so the UI can re-render.
 *   isRemote()    → bool          — signed in AND the cloud reachable this session.
 *
 * SIGNED OUT  → pure local mode, identical to the old presetStore (incl. the
 *               legacyKey forward-migration).
 * SIGNED IN   → first pull() with an empty server + non-empty local cache pushes
 *               the local copy up once (the "first-login migration"), then the
 *               server is source of truth. Writes are debounced + diffed +
 *               retried; a failed flush stays queued.
 *
 * TABLE: presets (user_id uuid default auth.uid(), tool text, name text,
 *                 data jsonb, updated_at timestamptz, pk (user_id, tool, name))
 *        RLS: using / with check (user_id = auth.uid())
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};
  var sb = Organica.sb;
  var auth = Organica.auth;

  var FLUSH_MS = 700;
  var instances = {};   // tool → store (one per tool per page)

  function makeStore(tool, legacyKey) {
    if (instances[tool]) return instances[tool];

    var cacheKey = 'organica.' + tool + '.presets';
    var lastSynced = null;      // { [name]: data } snapshot of the server state
    var flushTimer = null;
    var pending = false;        // a diff is waiting to go up
    var remote = false;         // signed in + a pull has succeeded
    var syncSubs = [];

    function readCache() {
      try {
        var cur = localStorage.getItem(cacheKey);
        if (cur !== null) return JSON.parse(cur || '{}');
        if (legacyKey) {
          var old = localStorage.getItem(legacyKey);
          if (old !== null) {
            localStorage.setItem(cacheKey, old);   // migrate forward, keep original
            return JSON.parse(old || '{}');
          }
        }
        return {};
      } catch (e) { return {}; }
    }

    function writeCache(obj) {
      try { localStorage.setItem(cacheKey, JSON.stringify(obj)); return true; }
      catch (e) { return false; }
    }

    function fireSync(obj) {
      syncSubs.forEach(function (cb) { try { cb(obj); } catch (e) {} });
    }

    // ── the diff between the cache and the last known server state ──
    function computeDiff(next) {
      var base = lastSynced || {};
      var uid = auth && auth.userIdSync();
      var upserts = [], deletes = [];
      Object.keys(next).forEach(function (name) {
        if (JSON.stringify(next[name]) !== JSON.stringify(base[name])) {
          upserts.push({ user_id: uid, tool: tool, name: name, data: next[name] });
        }
      });
      Object.keys(base).forEach(function (name) {
        if (!(name in next)) deletes.push(name);
      });
      return { upserts: upserts, deletes: deletes };
    }

    function flush() {
      flushTimer = null;
      if (!remote || !sb) return;
      var next = readCache();
      var d = computeDiff(next);
      if (!d.upserts.length && !d.deletes.length) { pending = false; return; }

      var jobs = [];
      if (d.upserts.length) {
        jobs.push(sb.from('presets')
          .upsert(d.upserts, { onConflict: 'user_id,tool,name' }));
      }
      if (d.deletes.length) {
        jobs.push(sb.from('presets').delete()
          .eq('tool', tool).in('name', d.deletes));
      }
      Promise.all(jobs).then(function (results) {
        var err = results.find(function (r) { return r && r.error; });
        if (err) { pending = true; return; }        // keep the diff, retry later
        lastSynced = next;
        pending = false;
        fireSync(next);
      }).catch(function () { pending = true; });
    }

    function queueFlush() {
      pending = true;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, FLUSH_MS);
    }

    var store = {
      key: cacheKey,

      // ── unchanged sync contract ──
      read: readCache,
      write: function (obj) {
        var ok = writeCache(obj);
        if (remote) queueFlush();
        return ok;
      },

      // ── cloud ──
      pull: function () {
        var uid = auth && auth.userIdSync();
        if (!sb || !uid) return Promise.resolve(readCache());   // local-only mode
        return sb.from('presets').select('name,data').eq('tool', tool)
          .then(function (r) {
            if (r.error) { return readCache(); }                // offline / paused
            var server = {};
            (r.data || []).forEach(function (row) { server[row.name] = row.data; });

            var local = readCache();
            var serverEmpty = Object.keys(server).length === 0;
            var localHas = Object.keys(local).length > 0;

            remote = true;

            if (serverEmpty && localHas) {
              // first-login migration: push the local library up once
              lastSynced = {};
              writeCache(local);
              queueFlush();
              fireSync(local);
              return local;
            }
            lastSynced = server;
            writeCache(server);
            // a diff may still be pending from an offline edit — send it
            if (pending) queueFlush();
            fireSync(server);
            return server;
          })
          .catch(function () { return readCache(); });
      },

      push: function () {
        if (!remote) return Promise.resolve();
        lastSynced = {};            // force every row to count as changed
        return new Promise(function (res) { flush(); res(); });
      },

      onSync: function (cb) {
        syncSubs.push(cb);
        return function () {
          var i = syncSubs.indexOf(cb);
          if (i >= 0) syncSubs.splice(i, 1);
        };
      },

      isRemote: function () { return remote; },
    };

    // Re-pull when the user signs in / out mid-session.
    if (auth && auth.onChange) {
      auth.onChange(function (session) {
        if (session) { store.pull(); }
        else { remote = false; lastSynced = null; }
      });
    }

    instances[tool] = store;
    return store;
  }

  Organica.store = makeStore;
  // Back-compat: every existing `Organica.presetStore('x'[, legacy])` call now
  // gets the synced store. .read()/.write() stay synchronous, so no call site
  // breaks; tools opt into cloud by calling .pull() and .onSync().
  Organica.presetStore = makeStore;

  // ── Single-blob variant ────────────────────────────────────────────────────
  // For stores that persist ONE JSON object under ONE key rather than a
  // { name: snapshot } map — Genesis's library (`organica.library.forms` =
  // { sets, forms }), read/written by Genesis and also read by FVS + Colornet.
  //
  //   Organica.store.blob(tool, { cacheKey, legacyKey }) → {
  //     read()          sync → the object (or null)
  //     write(obj)      sync cache write + debounced upsert of the single row
  //     pull()          Promise<obj|null> — refresh cache from Postgres
  //     onSync(cb)      unsub fn — cb(obj) after a pull / flush
  //     isRemote()      bool
  //   }
  //
  // Stored server-side in the SAME `presets` table, row name '__blob__'.
  var blobs = {};
  function makeBlob(tool, opts) {
    opts = opts || {};
    if (blobs[tool]) return blobs[tool];
    var cacheKey = opts.cacheKey || ('organica.' + tool + '.blob');
    var legacyKey = opts.legacyKey || null;
    var ROW = '__blob__';
    var lastSynced = undefined;   // JSON string of the last server state
    var remote = false, pending = false, flushTimer = null;
    var subs = [];

    function read() {
      try {
        var cur = localStorage.getItem(cacheKey);
        if (cur === null && legacyKey) {
          var old = localStorage.getItem(legacyKey);
          if (old !== null) { localStorage.setItem(cacheKey, old); cur = old; }
        }
        return cur === null ? null : JSON.parse(cur);
      } catch (e) { return null; }
    }
    function writeCache(obj) {
      try { localStorage.setItem(cacheKey, JSON.stringify(obj)); return true; }
      catch (e) { return false; }
    }
    function fire(obj) { subs.forEach(function (cb) { try { cb(obj); } catch (e) {} }); }

    function flush() {
      flushTimer = null;
      if (!remote || !sb) return;
      var obj = read();
      var s = JSON.stringify(obj);
      if (s === lastSynced) { pending = false; return; }
      var uid = auth && auth.userIdSync();
      sb.from('presets').upsert(
        { user_id: uid, tool: tool, name: ROW, data: obj },
        { onConflict: 'user_id,tool,name' }
      ).then(function (r) {
        if (r.error) { pending = true; return; }
        lastSynced = s; pending = false; fire(obj);
      }).catch(function () { pending = true; });
    }
    function queueFlush() {
      pending = true;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, FLUSH_MS);
    }

    var api = {
      read: read,
      write: function (obj) {
        var ok = writeCache(obj);
        if (remote) queueFlush();
        return ok;
      },
      pull: function () {
        var uid = auth && auth.userIdSync();
        if (!sb || !uid) return Promise.resolve(read());
        return sb.from('presets').select('data').eq('tool', tool).eq('name', ROW)
          .maybeSingle()
          .then(function (r) {
            if (r.error) return read();
            remote = true;
            var local = read();
            if (!r.data) {
              // first-login migration — push whatever's local
              lastSynced = undefined;
              if (local != null) { queueFlush(); }
              return local;
            }
            lastSynced = JSON.stringify(r.data);
            writeCache(r.data);
            if (pending) queueFlush();
            fire(r.data);
            return r.data;
          })
          .catch(function () { return read(); });
      },
      push: function () {
        if (!remote) return Promise.resolve();
        lastSynced = undefined;
        return new Promise(function (res) { flush(); res(); });
      },
      onSync: function (cb) {
        subs.push(cb);
        return function () { var i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
      },
      isRemote: function () { return remote; },
    };

    if (auth && auth.onChange) {
      auth.onChange(function (session) {
        if (session) api.pull();
        else { remote = false; lastSynced = undefined; }
      });
    }
    blobs[tool] = api;
    return api;
  }
  Organica.store.blob = makeBlob;
})(typeof window !== 'undefined' ? window : this);
