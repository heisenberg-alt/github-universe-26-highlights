/* GitHub Universe '26 Highlights: small progressive enhancements. The site works without this file. */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* theme toggle */
  var btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.addEventListener('click', function () {
    var next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('u26-theme', next); } catch (e) {}
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

  /* session filter tabs */
  var tabs = document.querySelector('[data-tabs]');
  if (tabs) {
    tabs.hidden = false;
    var rows = document.querySelectorAll('.sess[data-cat]');
    var buttons = tabs.querySelectorAll('[data-filter]');
    var empty = document.querySelector('.empty');
    buttons.forEach(function (b) {
      var f = b.dataset.filter, n = 0;
      rows.forEach(function (r) { if (f === 'all' || r.dataset.cat === f) n++; });
      var c = b.querySelector('.counter'); if (c) c.textContent = n;
      b.addEventListener('click', function () {
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        var shown = 0;
        rows.forEach(function (r) { var ok = f === 'all' || r.dataset.cat === f; r.hidden = !ok; if (ok) shown++; });
        if (empty) empty.hidden = shown > 0;
      });
    });
  }

  /* announcements sidebar scrollspy: the active topic is the last section whose top has passed the trigger line */
  var links = document.querySelectorAll('.side-nav a[href^="#"]');
  if (links.length) {
    var secs = [];
    links.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); if (s) secs.push({ el: s, link: a }); });
    var spy = function () {
      var line = window.innerHeight * 0.3, cur = secs[0];
      secs.forEach(function (x) { if (x.el.getBoundingClientRect().top <= line) cur = x; });
      if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) cur = secs[secs.length - 1];
      secs.forEach(function (x) { x.link.classList.toggle('active', x === cur); });
    };
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    spy();
  }
})();
