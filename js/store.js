/* ==========================================================================
   Lamina — enregistrement des projets (localStorage).
   Les projets s'exportent / s'importent en fichier .json.
   ========================================================================== */
(function () {
  'use strict';
  const KEY = 'lamina.v1';
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !Array.isArray(db.projects)) db = { projects: [], curs: {} };
    if (!db.curs) db.curs = {};
    return db;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
  }
  function usage() {
    try { const s = localStorage.getItem(KEY) || ''; return s.length * 2; } catch (e) { return 0; }
  }

  window.LaminaStore = { load, save, usage, uid };
})();
