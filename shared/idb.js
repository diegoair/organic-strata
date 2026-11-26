/* ─────────────────────────────────────────────────────────────────────────────
 * idb.js — Organica.idb, a tiny key → string store on IndexedDB (Nov 26, 2026).
 *
 * WHY: localStorage is ~5 MB for the whole site and every organica.* key shares it.
 * Work that can grow (an FVS project's boards) lives here instead: IndexedDB is
 * limited by the disk, not by a fixed quota. Used by shared/store.js when a store
 * is made with { backend: 'idb' }.
 *
 * LOAD ORDER: core.js → idb.js → store.js (store.js falls back to localStorage
 *             when this file is not loaded).
 *
 * API (all promises):
 *   get(key)        → string | null
 *   set(key, text)  → true
 *   del(key)        → true
 *   keys(prefix)    → [key, …] starting with prefix
 *   ok()            → bool: false when IndexedDB could not be opened (private mode
 *                     on some browsers) and the data lives only in memory for this
 *                     page — the caller is told once by an Organica.notice.
 *
 * One database 'organica', one object store 'kv' (out-of-line keys). Never add a
 * second store without bumping VERSION and handling onupgradeneeded for both.
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};
  var DB = 'organica', STORE = 'kv', VERSION = 1;

  var memory = {};        // fallback when IndexedDB is unavailable
  var broken = false;
  var warned = false;
  function fallBack() {
    broken = true;
    if (!warned && Organica.notice) {
      warned = true;
      Organica.notice('Not saved for later: this browser blocks storage for large work, so changes last only until the page closes.', { kind: 'error' });
    }
  }

  var dbPromise = null;
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (res) {
      var req;
      try { req = global.indexedDB && global.indexedDB.open(DB, VERSION); } catch (e) { req = null; }
      if (!req) { fallBack(); res(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { fallBack(); res(null); };
      req.onblocked = function () { /* another tab on an older version: wait, it resolves when that tab closes */ };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode);
        var out = fn(t.objectStore(STORE));
        t.oncomplete = function () { res(out && 'result' in out ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }

  Organica.idb = {
    get: function (key) {
      return tx('readonly', function (s) {
        if (!s) return { result: key in memory ? memory[key] : null };
        return s.get(key);
      }).then(function (v) { return v == null ? null : v; })
        .catch(function () { return key in memory ? memory[key] : null; });
    },
    set: function (key, text) {
      memory[key] = text;   // also the read-back while the transaction is in flight
      return tx('readwrite', function (s) { if (s) s.put(text, key); return { result: true }; })
        .then(function () { if (!broken) delete memory[key]; return true; })
        .catch(function (e) {
          if (e && e.name === 'QuotaExceededError' && Organica.storageFull) Organica.storageFull('idb');
          return false;
        });
    },
    del: function (key) {
      delete memory[key];
      return tx('readwrite', function (s) { if (s) s.delete(key); return { result: true }; })
        .then(function () { return true; }).catch(function () { return false; });
    },
    keys: function (prefix) {
      prefix = prefix || '';
      return tx('readonly', function (s) {
        if (!s) return { result: Object.keys(memory) };
        return s.getAllKeys();
      }).then(function (ks) {
        var all = (ks || []).map(String).concat(Object.keys(memory));
        return all.filter(function (k, i) { return k.indexOf(prefix) === 0 && all.indexOf(k) === i; });
      }).catch(function () { return []; });
    },
    ok: function () { return !broken; },
  };
})(window);
