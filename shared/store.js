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
  // ── Genesis library ───────────────────────────────────────────────────────
  // The library is { sets, forms }: `sets` is a small ordered structure (ids,
  // names, ordered member-id lists), `forms` is the pool of user seeds, each a
  // {id, name, svg, type, genType?, genParams?} object with a possibly-large
  // inline SVG. This stores ONE ROW PER SEED in the `seeds` table (visible,
  // per-user, typed columns for name/svg/type/gen_* + `data` holding the whole
  // seed verbatim so tool-specific fields survive), and the `sets` structure as
  // one small `presets` row (tool='library', name='meta'). Saving one seed
  // upserts one row, not the whole library.
  //
  //   Organica.store.library → { read(), write({sets,forms}), pull(), push(),
  //                              onSync(cb), isRemote() }
  //
  // read()/write() are synchronous over the same organica.library.forms cache
  // key + { sets, forms } shape that Genesis, FVS and Colornet already use, so
  // those readers are unchanged.
  function makeLibrary() {
    var CACHE = 'organica.library.forms';
    var LEGACY = 'organica_library';
    var lastSeeds = null;   // { seed_id: JSON.stringify(seed) } — last server state
    var lastMeta = null;    // JSON.stringify({ sets })
    var remote = false, pending = false, flushTimer = null;
    var subs = [];

    function read() {
      try {
        var cur = localStorage.getItem(CACHE);
        if (cur === null) {
          var old = localStorage.getItem(LEGACY);
          if (old !== null) { localStorage.setItem(CACHE, old); cur = old; }
        }
        if (cur === null) return { sets: [], forms: [] };
        var o = JSON.parse(cur);
        return {
          sets: Array.isArray(o.sets) ? o.sets : [],
          forms: Array.isArray(o.forms) ? o.forms : [],
        };
      } catch (e) { return { sets: [], forms: [] }; }
    }
    function writeCache(lib) {
      try { localStorage.setItem(CACHE, JSON.stringify(lib)); return true; }
      catch (e) { return false; }
    }
    function fire(lib) { subs.forEach(function (cb) { try { cb(lib); } catch (e) {} }); }

    function seedRow(uid, f) {
      return {
        user_id: uid, seed_id: f.id,
        name: f.name || null, svg: f.svg || null, type: f.type || null,
        gen_type: f.genType || null, gen_params: f.genParams || null,
        data: f,
      };
    }

    function flush() {
      flushTimer = null;
      if (!remote || !sb) return;
      var lib = read();
      var uid = auth && auth.userIdSync();

      var nextSeeds = {};
      (lib.forms || []).forEach(function (f) {
        if (f && f.id) nextSeeds[f.id] = JSON.stringify(f);
      });
      var base = lastSeeds || {};
      var upserts = [], deletes = [];
      (lib.forms || []).forEach(function (f) {
        if (f && f.id && nextSeeds[f.id] !== base[f.id]) upserts.push(seedRow(uid, f));
      });
      Object.keys(base).forEach(function (id) {
        if (!(id in nextSeeds)) deletes.push(id);
      });

      var metaStr = JSON.stringify({ sets: lib.sets || [] });
      var metaChanged = metaStr !== lastMeta;

      var jobs = [];
      if (upserts.length) jobs.push(sb.from('seeds')
        .upsert(upserts, { onConflict: 'user_id,seed_id' }));
      if (deletes.length) jobs.push(sb.from('seeds')
        .delete().eq('user_id', uid).in('seed_id', deletes));
      if (metaChanged) jobs.push(sb.from('presets').upsert(
        { user_id: uid, tool: 'library', name: 'meta', data: { sets: lib.sets || [] } },
        { onConflict: 'user_id,tool,name' }));

      if (!jobs.length) { pending = false; return; }
      Promise.all(jobs).then(function (rs) {
        if (rs.some(function (r) { return r && r.error; })) { pending = true; return; }
        lastSeeds = nextSeeds; lastMeta = metaStr; pending = false; fire(lib);
      }).catch(function () { pending = true; });
    }
    function queueFlush() {
      pending = true;
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(flush, FLUSH_MS);
    }

    var api = {
      read: read,
      write: function (lib) {
        var ok = writeCache(lib);
        if (remote) queueFlush();
        return ok;
      },
      pull: function () {
        var uid = auth && auth.userIdSync();
        if (!sb || !uid) return Promise.resolve(read());
        return Promise.all([
          sb.from('seeds').select('seed_id,data'),
          sb.from('presets').select('data').eq('tool', 'library').eq('name', 'meta').maybeSingle(),
          sb.from('presets').select('data').eq('tool', 'library').eq('name', '__blob__').maybeSingle(),
        ]).then(function (res) {
          if (res[0].error) return read();
          remote = true;
          var rows = res[0].data || [];
          var meta = (res[1] && res[1].data && res[1].data.data) || null;
          var blob = (res[2] && res[2].data && res[2].data.data) || null;

          // First-login migration: nothing in seeds/meta yet, but the old
          // single-blob row (or a purely-local library) exists — adopt it once.
          if (!rows.length && !meta) {
            var src = (blob && Array.isArray(blob.forms)) ? blob : read();
            if ((src.forms || []).length || (src.sets || []).length) {
              var seed = { sets: src.sets || [], forms: src.forms || [] };
              lastSeeds = {}; lastMeta = null;   // force a full upload
              writeCache(seed);
              queueFlush();
              fire(seed);
              return seed;
            }
          }

          var forms = rows.map(function (r) { return r.data; }).filter(Boolean);
          var sets = (meta && Array.isArray(meta.sets)) ? meta.sets : [];
          var lib = { sets: sets, forms: forms };
          lastSeeds = {};
          rows.forEach(function (r) { lastSeeds[r.seed_id] = JSON.stringify(r.data); });
          lastMeta = JSON.stringify({ sets: sets });
          writeCache(lib);
          if (pending) queueFlush();
          fire(lib);
          return lib;
        }).catch(function () { return read(); });
      },
      push: function () {
        if (!remote) return Promise.resolve();
        lastSeeds = {}; lastMeta = null;
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
        else { remote = false; lastSeeds = null; lastMeta = null; }
      });
    }
    return api;
  }
  Organica.store.library = makeLibrary();
})(typeof window !== 'undefined' ? window : this);
