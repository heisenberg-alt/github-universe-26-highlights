/* GitHub Universe '26 Highlights: small progressive enhancements. The site works without this file. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* theme toggle */
  var btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.addEventListener('click', function () {
    var next = root.dataset.theme === 'light' ? 'dark' : 'light';
    var apply = function () { root.dataset.theme = next; try { localStorage.setItem('u26-theme', next); } catch (e) {} };
    if (document.startViewTransition && !reduce && root.dataset.motion !== 'off') {     // circular reveal from the button
      var r = btn.getBoundingClientRect();
      root.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px'); root.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
      root.classList.add('theme-vt');
      var vt = document.startViewTransition(apply);
      vt.ready.catch(function () {}); vt.updateCallbackDone.catch(function () {});     // hidden tabs abort transitions; that is fine
      vt.finished.then(function () { root.classList.remove('theme-vt'); }, function () { root.classList.remove('theme-vt'); });
    } else apply();
  });

  /* scroll progress bar */
  var bar = document.querySelector('.progress');
  if (bar) {
    var ticking = false;
    var update = function () {
      var h = root.scrollHeight - window.innerHeight;
      bar.style.setProperty('--p', h > 0 ? Math.min(1, window.scrollY / h) : 0);
      ticking = false;
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* spotlight cards follow the pointer */
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.spot');
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  /* reveal on scroll */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el, i) { el.style.setProperty('--rd', (i % 4) * 70 + 'ms'); io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* hero: a contribution graph that gets denser to the right */
  var graph = document.querySelector('.graph');
  if (graph) {
    var seed = 26;
    var rnd = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    var build = function () {
      var cell = parseFloat(getComputedStyle(graph).getPropertyValue('--cell')) || 17;
      var cols = Math.min(60, Math.ceil((graph.parentElement.clientWidth + 40) / (cell + 5)));
      var frag = document.createDocumentFragment();
      for (var c = 0; c < cols; c++) {
        var prog = c / (cols - 1 || 1);
        for (var r = 0; r < 7; r++) {
          var d = document.createElement('span');
          var p = 0.12 + 0.85 * Math.pow(prog, 1.25);
          var cls = 'cell';
          if (rnd() < p) cls += ' l' + Math.min(4, 1 + Math.floor(rnd() * (1 + prog * 3.4)));
          if (prog > .55 && rnd() < .05) cls += ' tw';
          d.className = cls;
          d.style.setProperty('--d', (c * 14 + r * 22) + 'ms');
          d.style.setProperty('--t', (rnd() * 4).toFixed(2) + 's');
          frag.appendChild(d);
        }
      }
      graph.textContent = '';
      graph.appendChild(frag);
    };
    build();
  }

  /* count-up stats */
  var counters = document.querySelectorAll('[data-count]');
  var fmt = function (el, v) {
    var dec = +(el.dataset.dec || 0);
    el.textContent = (el.dataset.pre || '') + v.toFixed(dec) + (el.dataset.suf || '');
  };
  if (counters.length && 'IntersectionObserver' in window && !reduce) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, to = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1300;
        (function step(now) {
          var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          fmt(el, to * e);
          if (k < 1) requestAnimationFrame(step); else { fmt(el, to); el.dataset.done = '1'; }
        })(t0);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { fmt(el, 0); cio.observe(el); });
    window.addEventListener('beforeprint', function () { counters.forEach(function (el) { fmt(el, parseFloat(el.dataset.count)); }); });
  }

  /* saved sessions live in localStorage */
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem('u26-saved') || '[]'); } catch (e) {}
  var persistSaved = function () { try { localStorage.setItem('u26-saved', JSON.stringify(saved)); } catch (e) {} };
  document.querySelectorAll('.sess[id]').forEach(function (r) {
    var on = saved.indexOf(r.id) >= 0; r.classList.toggle('is-saved', on);
    var sb = r.querySelector('.save'); if (sb) sb.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  /* filter tabs: each [data-tabs] filters the items matched by data-items.
     Optional: data-groups (sections hidden when empty, sidebar counters kept in step) and data-notes (items hidden unless "All"). */
  var tabSets = [];
  document.querySelectorAll('[data-tabs]').forEach(function (tabs) {
    tabs.hidden = false;
    var rows = Array.prototype.slice.call(document.querySelectorAll(tabs.dataset.items));
    var groups = tabs.dataset.groups ? document.querySelectorAll(tabs.dataset.groups) : [];
    var notes = tabs.dataset.notes ? document.querySelectorAll(tabs.dataset.notes) : [];
    var buttons = tabs.querySelectorAll('[data-filter]'), cur = 'all';
    var match = function (r, f) { return f === 'all' || (f === 'saved' ? r.classList.contains('is-saved') : r.dataset.cat === f); };
    var counts = function () {
      buttons.forEach(function (b) {
        var n = rows.filter(function (r) { return match(r, b.dataset.filter); }).length, c = b.querySelector('.counter'); if (c) c.textContent = n;
      });
    };
    var apply = function (f) {
      cur = f;
      buttons.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.filter === f ? 'true' : 'false'); });
      rows.forEach(function (r) { r.hidden = !match(r, f); });
      notes.forEach(function (r) { r.hidden = f !== 'all'; });
      groups.forEach(function (g) {
        var vis = g.querySelectorAll('[data-cat]:not([hidden])').length;
        g.hidden = vis === 0;
        var link = document.querySelector('.side-nav a[href="#' + g.id + '"]');
        if (link) { var k = link.querySelector('.counter'); if (k) k.textContent = vis; link.classList.toggle('dim', vis === 0); }
      });
      var empty = document.querySelector('.empty-saved');
      if (empty && rows.length && rows[0].classList.contains('sess')) empty.hidden = !(f === 'saved' && !rows.some(function (r) { return !r.hidden; }));
      window.dispatchEvent(new Event('resize'));          // let the scrollspy recompute
    };
    buttons.forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.filter); }); });
    counts();
    tabs._u26 = { apply: apply, counts: counts, cur: function () { return cur; }, sessions: !!(rows[0] && rows[0].classList.contains('sess')) };
    tabSets.push(tabs);
  });

  /* star a session */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.save'); if (!b) return;
    var r = b.closest('.sess'); if (!r) return;
    var i = saved.indexOf(r.id); if (i >= 0) saved.splice(i, 1); else saved.push(r.id);
    persistSaved();
    var on = saved.indexOf(r.id) >= 0; r.classList.toggle('is-saved', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    tabSets.forEach(function (t) { if (t._u26 && t._u26.sessions) { t._u26.counts(); if (t._u26.cur() === 'saved') t._u26.apply('saved'); } });
    if (window.u26) window.u26.toast(on ? 'Saved. Find it under “★ Saved”.' : 'Removed from saved.');
  });

  /* copy-link buttons on every item that has an id */
  document.querySelectorAll('.sess[id] h3, .item[data-cat][id] .card-top h3, .comment[id] .comment-body h3').forEach(function (h) {
    var host = h.closest('[id]'); if (!host) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copylink'; b.setAttribute('aria-label', 'Copy link to this item'); b.title = 'Copy link';
    b.innerHTML = '<svg class="i"><use href="#i-link"/></svg>';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var url = location.href.split('#')[0] + '#' + host.id;
      var done = function () { if (window.u26) window.u26.toast('Link copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done); else done();
    });
    h.appendChild(b);
  });

  /* deep links (#s3, #a12, #v4): reveal if a filter hides it, scroll to it, and flash it */
  var ITEM_ID = /^(s\d+|a\d+|a-[a-z]+|v\d+)$/;
  function revealTarget(initial) {
    var id = decodeURIComponent((location.hash || '').slice(1)); if (!ITEM_ID.test(id)) return;
    var t = document.getElementById(id); if (!t) return;
    if (t.hidden || t.closest('[hidden]')) tabSets.forEach(function (ts) { if (ts._u26) ts._u26.apply('all'); });
    t.classList.add('in');
    t.scrollIntoView({ block: 'center', behavior: initial || reduce ? 'auto' : 'smooth' });
    t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
    setTimeout(function () { t.classList.remove('flash'); }, 2400);
  }
  window.addEventListener('hashchange', function () { revealTarget(false); });
  window.addEventListener('load', function () { setTimeout(function () { revealTarget(true); }, 300); });

  /* expand / collapse every "More detail" disclosure */
  var expand = document.querySelector('[data-expand]');
  if (expand) {
    expand.hidden = false;
    var open = false;
    expand.addEventListener('click', function () {
      open = !open;
      document.querySelectorAll('details.more-detail').forEach(function (d) { d.open = open; });
      expand.textContent = open ? 'Collapse all details' : 'Expand all details';
    });
  }

  /* announcements sidebar scrollspy: the active topic is the last visible section whose top has passed the trigger line */
  var links = document.querySelectorAll('.side-nav a[href^="#"]');
  if (links.length) {
    var secs = [];
    links.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); if (s) secs.push({ el: s, link: a }); });
    var spy = function () {
      var line = window.innerHeight * 0.3, cur = null, last = null;
      secs.forEach(function (x) {
        if (x.el.hidden) return;
        last = x; if (!cur) cur = x;
        if (x.el.getBoundingClientRect().top <= line) cur = x;
      });
      if (window.innerHeight + window.scrollY >= root.scrollHeight - 4 && last) cur = last;
      secs.forEach(function (x) { x.link.classList.toggle('active', x === cur); });
    };
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    spy();
  }

  /* back to top */
  var top = document.createElement('button');
  top.className = 'to-top'; top.type = 'button'; top.setAttribute('aria-label', 'Back to top');
  top.innerHTML = '<svg class="i"><use href="#i-arrow"/></svg>';
  top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
  document.body.appendChild(top);
  var topTick = function () { top.classList.toggle('show', window.scrollY > 900); };
  window.addEventListener('scroll', topTick, { passive: true }); topTick();

  /* background animation on/off (also honours prefers-reduced-motion in octocat.js) */
  var mbtn = document.querySelector('[data-motion-toggle]');
  if (mbtn) {
    var label = function () { mbtn.textContent = 'Background animation: ' + (root.dataset.motion === 'off' ? 'off' : 'on'); mbtn.setAttribute('aria-pressed', root.dataset.motion === 'off' ? 'false' : 'true'); };
    label();
    mbtn.addEventListener('click', function () {
      var next = root.dataset.motion === 'off' ? 'on' : 'off';
      root.dataset.motion = next;
      try { localStorage.setItem('u26-motion', next); } catch (e) {}
      label();
    });
  }
})();
