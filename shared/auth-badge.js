/* ─────────────────────────────────────────────────────────────────────────────
 * auth-badge.js — the signed-in / sign-out control in the tool header.
 *
 * LOAD ORDER: … → supabase.js → auth.js → auth-badge.js → tool script.
 * Paired CSS: .org-account rules live in shared/header.css.
 *
 * Self-mounting: finds .org-header on the page and appends a compact
 *   <div class="org-account"><span>email</span><button>Sign out</button></div>
 * Hidden when signed out. Re-renders on every auth state change, so a
 * login / logout in another tab updates this one too.
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};
  if (!Organica.auth) return;

  function ensureBox() {
    var header = document.querySelector('.org-header');
    if (!header) return null;
    var box = header.querySelector('.org-account');
    if (!box) {
      if (!header.querySelector('.org-header__spacer')) {
        var sp = document.createElement('div');
        sp.className = 'org-header__spacer';
        header.appendChild(sp);
      }
      box = document.createElement('div');
      box.className = 'org-account';
      header.appendChild(box);
    }
    return box;
  }

  function render() {
    var box = ensureBox();
    if (!box) return;
    Organica.auth.user().then(function (u) {
      box.innerHTML = '';
      if (!u) { box.hidden = true; return; }
      box.hidden = false;

      var email = document.createElement('span');
      email.className = 'org-account__email';
      email.title = u.email || '';
      email.textContent = u.email || 'signed in';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'org-account__btn';
      btn.textContent = 'Sign out';
      btn.addEventListener('click', function () {
        btn.disabled = true;
        Organica.auth.signOut();
      });

      box.appendChild(email);
      box.appendChild(btn);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  if (Organica.auth.onChange) Organica.auth.onChange(render);
})(typeof window !== 'undefined' ? window : this);
