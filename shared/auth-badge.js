/* ─────────────────────────────────────────────────────────────────────────────
 * auth-badge.js — the account control in the tool header.
 *
 * LOAD ORDER: … → core.js → supabase.js → auth.js → auth-badge.js → tool script.
 * Paired CSS: .org-account* rules live in shared/header.css.
 *
 * Self-mounting: finds .org-header and appends
 *   <button class="org-account__trigger"><img avatar> <span>name</span></button>
 *   <div class="org-account__menu">  email · Admin (owner only) · Delete my
 *                                    account · Sign out
 * Signed out: Login + Sign Up buttons (.org-header__auth). Re-renders on every auth state change.
 * ───────────────────────────────────────────────────────────────────────────*/
(function (global) {
  'use strict';
  var Organica = global.Organica = global.Organica || {};
  if (!Organica.auth) return;

  var OWNER = '997a1f53-23b2-40bb-8a4a-90b0aacb7921';

  function ensureBox() {
    var header = document.querySelector('.org-header');
    if (!header) return null;
    var box = header.querySelector('[data-org-auth-box]');
    if (!box) {
      if (!header.querySelector('.org-header__spacer')) {
        var sp = document.createElement('div');
        sp.className = 'org-header__spacer';
        header.appendChild(sp);
      }
      box = document.createElement('div');
      box.setAttribute('data-org-auth-box', '');
      box.className = 'org-account';
      header.appendChild(box);
    }
    return box;
  }

  function initials(name, email) {
    var s = (name || email || '?').trim();
    var p = s.split(/\s+/);
    return ((p[0] && p[0][0]) || '' + (p[1] ? p[1][0] : '')).toUpperCase() ||
           s.slice(0, 1).toUpperCase();
  }

  function render() {
    var box = ensureBox();
    if (!box) return;
    Organica.auth.user().then(function (u) {
      box.innerHTML = '';
      if (!u) {
        // Signed out: Login + Sign Up. Sign Up is the same card with request-access copy
        // (sign-ups are invite-only while the beta lasts — see /sign-in?mode=signup).
        box.hidden = false;
        box.className = 'org-header__auth';
        var next = encodeURIComponent(location.pathname + location.search);
        var login = document.createElement('a');
        login.className = 'org-btn';
        login.href = '/sign-in?next=' + next;
        login.textContent = 'Login';
        var signup = document.createElement('a');
        signup.className = 'org-btn org-btn--primary';
        signup.href = '/sign-in?next=' + next + '&mode=signup';
        signup.textContent = 'Sign Up';
        box.appendChild(login);
        box.appendChild(signup);
        return;
      }
      box.className = 'org-account';
      box.hidden = false;

      var md = u.user_metadata || {};
      var name = md.full_name || md.name || u.email || 'account';
      var avatar = md.avatar_url || md.picture || '';
      var isOwner = u.id === OWNER;

      // trigger: avatar + name
      var trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'org-account__trigger';

      var av = document.createElement('span');
      av.className = 'org-account__avatar';
      if (avatar) {
        var img = document.createElement('img');
        img.referrerPolicy = 'no-referrer';
        img.alt = '';
        img.src = avatar;
        img.onerror = function () { av.textContent = initials(md.full_name || md.name, u.email); av.classList.add('is-fallback'); };
        av.appendChild(img);
      } else {
        av.textContent = initials(md.full_name || md.name, u.email);
        av.classList.add('is-fallback');
      }
      var label = document.createElement('span');
      label.className = 'org-account__name';
      label.textContent = name;
      trigger.appendChild(av);
      trigger.appendChild(label);

      // menu
      var menu = document.createElement('div');
      menu.className = 'org-account__menu';
      var mEmail = document.createElement('div');
      mEmail.className = 'org-account__email';
      mEmail.textContent = u.email || '';
      menu.appendChild(mEmail);

      if (isOwner) {
        var admin = document.createElement('a');
        admin.className = 'org-account__item';
        admin.href = '/admin';
        admin.textContent = 'Admin';
        menu.appendChild(admin);
      }

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'org-account__item org-account__item--danger';
      del.textContent = 'Delete my account';
      del.addEventListener('click', function () { confirmDeleteAccount(); });
      menu.appendChild(del);

      var out = document.createElement('button');
      out.type = 'button';
      out.className = 'org-account__item';
      out.textContent = 'Sign out';
      out.addEventListener('click', function () { out.disabled = true; Organica.auth.signOut(); });
      menu.appendChild(out);

      box.appendChild(trigger);
      box.appendChild(menu);

      if (Organica.popover) Organica.popover(trigger, menu);
      else trigger.addEventListener('click', function () {
        menu.dataset.open = menu.dataset.open === 'true' ? 'false' : 'true';
      });
    });
  }

  function confirmDeleteAccount() {
    var yes = global.prompt(
      'This permanently deletes your account and everything you have saved — ' +
      'seeds, presets, all of it. This cannot be undone.\n\n' +
      'Type DELETE to confirm.');
    if (yes !== 'DELETE') return;
    var sb = Organica.sb;
    if (!sb) return;
    sb.rpc('delete_own_account').then(function (r) {
      if (r.error) { global.alert('Could not delete: ' + r.error.message); return; }
      Organica.auth.signOut();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  if (Organica.auth.onChange) Organica.auth.onChange(render);
})(typeof window !== 'undefined' ? window : this);
