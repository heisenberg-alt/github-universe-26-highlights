/* Command palette: Ctrl/⌘+K or "/" opens a GitHub-style search over every page, session, announcement and article
 * (window.U26_INDEX is generated at build time), plus a few actions. Keyboard first: ↑ ↓ ↵ Esc. */
(function () {
  var root = document.documentElement, body = document.body;
  var INDEX = window.U26_INDEX || [];
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  document.querySelectorAll('.search-btn kbd').forEach(function (k) { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

  var click = function (sel) { var b = document.querySelector(sel); if (b) b.click(); };
  var ACTIONS = [
    { t: 'action', title: 'Toggle light / dark theme', sub: 'Switch the colour theme', run: function () { click('[data-theme-toggle]'); } },
    { t: 'action', title: 'Pause or resume the background animation', sub: 'Also respects your OS reduced-motion setting', run: function () { click('[data-motion-toggle]'); } },
    { t: 'action', title: 'Poke the Octocat', sub: 'Send a shockwave through the digits', run: function () { window.dispatchEvent(new CustomEvent('u26:pulse')); window.dispatchEvent(new CustomEvent('u26:poke')); } },
    { t: 'action', title: 'Enter the matrix', sub: 'Digital rain. Esc to leave', run: function () { window.u26 && window.u26.matrix(); } },
    { t: 'action', title: 'Replay the intro', sub: 'The boot screen and the Octocat assembling', run: function () { click('[data-replay]'); } },
    { t: 'action', title: 'Copy link to this page', sub: location.pathname.split('/').pop() || 'index.html', run: function () {
        var done = function () { window.u26 && window.u26.toast('Link copied'); };
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done); else done();
      } },
    { t: 'action', title: 'Back to top', sub: 'Scroll to the top of this page', run: function () { window.scrollTo({ top: 0, behavior: 'smooth' }); } }
  ];
  var TYPES = ['action', 'page', 'session', 'announcement', 'voice', 'link'];
  var LABELS = { action: 'Actions', page: 'Pages', session: 'Sessions', announcement: 'Announcements', voice: 'Outside voices', link: 'More coverage' };
  var ICONS = { action: 'i-spark', page: 'i-arrow', session: 'i-play', announcement: 'i-list', voice: 'i-chat', link: 'i-ext' };

  var ui = null, results = [], active = 0, lastFocus = null;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function build() {
    var wrap = document.createElement('div'); wrap.className = 'palette'; wrap.hidden = true;
    wrap.innerHTML =
      '<div class="palette-backdrop"></div>' +
      '<div class="palette-box" role="dialog" aria-modal="true" aria-label="Search Universe \'26">' +
        '<div class="palette-input"><svg class="i" aria-hidden="true"><use href="#i-search"/></svg>' +
        '<input type="text" placeholder="Search sessions, announcements, articles… or run a command" aria-label="Search" aria-controls="palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div>' +
        '<ul id="palette-list" role="listbox"></ul>' +
        '<div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span><span class="palette-count"></span></div>' +
      '</div>';
    body.appendChild(wrap);
    ui = { wrap: wrap, input: wrap.querySelector('input'), list: wrap.querySelector('ul'), count: wrap.querySelector('.palette-count') };
    wrap.querySelector('.palette-backdrop').addEventListener('click', close);
    ui.input.addEventListener('input', function () { render(search(ui.input.value)); });
    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
    });
    ui.list.addEventListener('mousemove', function (e) { var li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== active) setActive(+li.dataset.i, false); });
    ui.list.addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) choose(+li.dataset.i); });
  }

  function search(q) {
    q = q.trim().toLowerCase();
    var pool = ACTIONS.concat(INDEX);
    if (!q) {
      var pages = INDEX.filter(function (x) { return x.t === 'page'; });
      var top = INDEX.filter(function (x) { return x.t === 'session'; }).slice(0, 5);
      return ACTIONS.slice(0, 4).concat(pages, top);
    }
    var toks = q.split(/\s+/), out = [];
    pool.forEach(function (it) {
      var title = it.title.toLowerCase(), sub = (it.sub || '').toLowerCase(), desc = (it.desc || '').toLowerCase(), score = 0;
      for (var i = 0; i < toks.length; i++) {
        var tk = toks[i], s;
        if (title.indexOf(tk) === 0) s = 7; else if (title.indexOf(' ' + tk) >= 0) s = 6; else if (title.indexOf(tk) >= 0) s = 5;
        else if (sub.indexOf(tk) >= 0) s = 3; else if (desc.indexOf(tk) >= 0) s = 1; else return;
        score += s;
      }
      out.push({ s: score + (it.t === 'page' ? 1 : 0), it: it });
    });
    out.sort(function (a, b) { return b.s - a.s || TYPES.indexOf(a.it.t) - TYPES.indexOf(b.it.t); });
    var best = {}, byType = {};                           // group by type; order the groups by their best match
    out.forEach(function (x) { (byType[x.it.t] = byType[x.it.t] || []).push(x.it); if (!(x.it.t in best)) best[x.it.t] = x.s; });
    return Object.keys(byType).sort(function (a, b) { return best[b] - best[a] || TYPES.indexOf(a) - TYPES.indexOf(b); })
      .reduce(function (acc, t) { return acc.concat(byType[t].slice(0, 6)); }, []).slice(0, 18);
  }

  function mark(text, q) {
    var t = esc(text); if (!q) return t;
    q.trim().split(/\s+/).forEach(function (tk) { if (tk.length > 1) t = t.replace(new RegExp('(' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return t;
  }

  function render(list) {
    results = list; active = 0;
    var q = ui.input.value, html = '', lastType = '';
    // group by type, keeping relevance order inside groups
    list.forEach(function (it, i) {
      if (it.t !== lastType) { html += '<li class="palette-group" role="presentation">' + LABELS[it.t] + '</li>'; lastType = it.t; }
      var badge = it.st ? '<span class="status ' + esc(it.sc || '') + '">' + esc(it.st) + '</span>' : '';
      html += '<li role="option" id="pal-' + i + '" data-i="' + i + '"' + (i === 0 ? ' aria-selected="true" class="on"' : '') + '>' +
        '<svg class="i" aria-hidden="true"><use href="#' + ICONS[it.t] + '"/></svg>' +
        '<div class="pal-text"><b>' + mark(it.title, q) + '</b><span>' + mark(it.sub || '', q) + '</span></div>' + badge + '</li>';
    });
    if (!list.length) html = '<li class="palette-empty" role="presentation">No matches for “' + esc(q) + '”. Try “fusion”, “security” or “review”.</li>';
    ui.list.innerHTML = html;
    ui.count.textContent = list.length ? list.length + ' result' + (list.length === 1 ? '' : 's') : '';
    ui.input.setAttribute('aria-activedescendant', list.length ? 'pal-0' : '');
  }

  function setActive(i, scroll) {
    var lis = ui.list.querySelectorAll('li[data-i]'); if (!lis.length) return;
    active = (i + lis.length) % lis.length;
    lis.forEach(function (li) { var on = +li.dataset.i === active; li.classList.toggle('on', on); li.setAttribute('aria-selected', on ? 'true' : 'false'); });
    ui.input.setAttribute('aria-activedescendant', 'pal-' + active);
    if (scroll !== false) { var cur = ui.list.querySelector('li.on'); if (cur) cur.scrollIntoView({ block: 'nearest' }); }
  }
  function move(d) { setActive(active + d, true); }

  function choose(i) {
    var it = results[i]; if (!it) return;
    close();
    if (it.run) { setTimeout(it.run, 30); return; }
    if (/^https?:/.test(it.url)) { window.open(it.url, '_blank', 'noopener'); return; }
    var here = (location.pathname.split('/').pop() || 'index.html'), parts = it.url.split('#'), file = parts[0] || 'index.html';
    if (file === './') file = 'index.html';
    if (file === here && parts[1]) { if (location.hash === '#' + parts[1]) window.dispatchEvent(new Event('hashchange')); else location.hash = parts[1]; }
    else location.href = it.url;
  }

  function open() {
    if (!ui) build();
    if (!ui.wrap.hidden) return;
    lastFocus = document.activeElement; ui.wrap.hidden = false; body.classList.add('palette-open');
    ui.input.value = ''; render(search('')); ui.input.focus();
  }
  function close() {
    if (!ui || ui.wrap.hidden) return;
    ui.wrap.hidden = true; body.classList.remove('palette-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); (ui && !ui.wrap.hidden) ? close() : open(); return; }
    var t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (k === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });
  document.querySelectorAll('[data-palette-open]').forEach(function (b) { b.addEventListener('click', open); });
  window.u26 = window.u26 || {}; window.u26.search = open;
})();
