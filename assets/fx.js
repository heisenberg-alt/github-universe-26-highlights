/* fx.js: the playful layer (boot screen, headline decode, tilt, cursor glow, matrix mode, toasts).
 * Everything here is optional polish: it is skipped for prefers-reduced-motion and when the animation toggle is off.
 * Exposes window.u26 = { toast, matrix, boot } for the command palette. */
(function () {
  var root = document.documentElement, body = document.body;
  var reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionOK = function () { return !reduceQ.matches && root.dataset.motion !== 'off'; };
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isHome = body.dataset.page === 'home';
  var el = function (tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; };
  var bin = function (s) { return Array.prototype.map.call(s, function (c) { return ('00000000' + c.charCodeAt(0).toString(2)).slice(-8); }).join(' '); };

  /* ---------- toasts ---------- */
  var toasts = el('div', 'toasts'); toasts.setAttribute('role', 'status'); toasts.setAttribute('aria-live', 'polite'); body.appendChild(toasts);
  function toast(html, ms) {
    var t = el('div', 'toast'); t.innerHTML = html; toasts.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 300); }, ms || 2600);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    return t;
  }

  /* click the Octocat -> it says hi in binary */
  var PHRASES = ['Hi', 'LGTM', 'Ship it', 'git push', 'Merged', 'Hello, world', '0 errors', 'Fork me'], lastPoke = 0;
  window.addEventListener('u26:poke', function () {
    var now = Date.now(); if (now - lastPoke < 900) return; lastPoke = now;
    var p = PHRASES[(Math.random() * PHRASES.length) | 0];
    toast('<code>' + bin(p) + '</code><span>&rarr; ' + p + '</span>', 2200);
  });

  /* ---------- boot screen (home page, first visit per session) ---------- */
  var BOOT_LINES = [
    ['$ gh universe recap --year 2026', 'cmd'],
    ['✔ 13 sessions', 'ok'], ['✔ 31 announcements', 'ok'], ['✔ 12 outside voices', 'ok'],
    ["✔ statuses checked against each feature's docs", 'ok'], ['→ rendering universe_26.sh', 'run']
  ];
  function runBoot() {
    if (document.querySelector('.boot')) return;
    root.classList.add('booting');
    var o = el('div', 'boot'); o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Intro');
    o.innerHTML = '<div class="boot-win"><div class="boot-bar"><i></i><i></i><i></i><span>universe_26 — zsh</span></div>' +
      '<pre class="boot-log"></pre><div class="boot-prog" aria-hidden="true"><div class="boot-fill"></div></div>' +
      '<button class="boot-skip" type="button">Skip <kbd>Esc</kbd></button></div>';
    body.appendChild(o);
    var log = o.querySelector('.boot-log'), fill = o.querySelector('.boot-fill'), i = 0, done = false, timers = [];
    function finish() {
      if (done) return; done = true; timers.forEach(clearTimeout);
      try { sessionStorage.setItem('u26-booted', '1'); } catch (e) {}
      o.classList.add('out'); root.classList.remove('booting');
      setTimeout(function () { o.remove(); }, 600);
      document.removeEventListener('keydown', finish);
      window.dispatchEvent(new CustomEvent('u26:boot-done'));
    }
    document.addEventListener('keydown', finish); o.addEventListener('click', finish);
    function type(line, cb) {
      var span = el('span', line[1]); log.appendChild(span); log.appendChild(document.createTextNode('\n'));
      var txt = line[0], j = 0, step = line[1] === 'cmd' ? 2 : 5;
      (function tick() { if (done) return; j += step; span.textContent = txt.slice(0, j); if (j < txt.length) timers.push(setTimeout(tick, 18)); else cb(); })();
    }
    (function next() {
      if (done) return;
      if (i >= BOOT_LINES.length) { fill.style.width = '100%'; timers.push(setTimeout(finish, 380)); return; }
      var line = BOOT_LINES[i++];
      type(line, function () { fill.style.width = Math.round(i / BOOT_LINES.length * 100) + '%'; timers.push(setTimeout(next, 100)); });
    })();
    timers.push(setTimeout(finish, 5000));                // failsafe
  }

  /* ---------- headline decode ---------- */
  function scramble(h, dur) {
    var walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push({ n: n, t: n.nodeValue });
    if (!nodes.length) return;
    var total = nodes.reduce(function (s, x) { return s + x.t.length; }, 0);
    var pool = nodes.map(function (x) { return x.t; }).join('').replace(/[^A-Za-z]/g, '') || 'abc';
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    var t0 = Date.now(), iv;
    function restore() { clearInterval(iv); nodes.forEach(function (x) { x.n.nodeValue = x.t; }); }
    function tick() {
      var p = Math.min(1, (Date.now() - t0) / dur), cut = Math.floor(p * (total + 4)) - 4, idx = 0;
      nodes.forEach(function (x) {
        var out = '';
        for (var k = 0; k < x.t.length; k++, idx++) { var c = x.t[k]; out += (idx < cut || /[^A-Za-z]/.test(c)) ? c : pool[(Math.random() * pool.length) | 0]; }
        x.n.nodeValue = out;
      });
      if (p >= 1) restore();
    }
    iv = setInterval(tick, 40); tick();
    setTimeout(restore, dur + 400);                       // guaranteed restore, even in a background tab
  }
  function decodeHeadline() { var h = document.querySelector('main h1'); if (h && motionOK()) scramble(h, 900); }

  /* ---------- 3D tilt + cursor glow + parallax ---------- */
  if (canHover && motionOK()) {
    document.querySelectorAll('.tilt').forEach(function (c) {
      var raf = 0;
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0; c.classList.add('tilting');
          c.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg'); c.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg'); c.style.setProperty('--ty', '-4px');
        });
      });
      c.addEventListener('pointerleave', function () { c.classList.remove('tilting'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); c.style.setProperty('--ty', '0px'); });
    });
    var glow = el('div', 'cursor-glow'); glow.setAttribute('aria-hidden', 'true'); body.appendChild(glow);
    var gx = 0, gy = 0, graf = 0;
    window.addEventListener('pointermove', function (e) {
      gx = e.clientX; gy = e.clientY; glow.classList.add('on');
      if (graf) return;
      graf = requestAnimationFrame(function () {
        graf = 0; glow.style.transform = 'translate3d(' + (gx - 300) + 'px,' + (gy - 300) + 'px,0)';
        root.style.setProperty('--px', ((gx / window.innerWidth - 0.5) * 2).toFixed(3)); root.style.setProperty('--py', ((gy / window.innerHeight - 0.5) * 2).toFixed(3));
      });
    }, { passive: true });
    document.addEventListener('mouseleave', function () { glow.classList.remove('on'); });
  }

  /* ---------- matrix mode ---------- */
  var M = { on: false };
  function matrixStart() {
    if (M.on) return;
    if (reduceQ.matches) { toast('Reduced motion is on, so matrix mode stays off.'); return; }
    M.on = true; root.classList.add('matrix-on');
    var c = el('canvas', 'matrix'); c.setAttribute('aria-hidden', 'true'); body.appendChild(c); M.canvas = c;
    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), FS = 15, CW = 11, CH = 18;
    var cols, rows, drops;
    var hint = el('div', 'matrix-hint'); hint.innerHTML = '<span>Matrix mode</span><button type="button">Exit <kbd>Esc</kbd></button>'; body.appendChild(hint); M.hint = hint;
    hint.querySelector('button').addEventListener('click', matrixStop);
    function size() {
      c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
      cols = Math.ceil(innerWidth / CW); rows = Math.ceil(innerHeight / CH);
      drops = [];
      for (var i = 0; i < cols; i++) {                    // start mid-fall with trails already drawn, so the rain is instant
        var len = 10 + ((Math.random() * 18) | 0), ch = []; for (var q = 0; q < len; q++) ch.push(Math.random() < 0.5 ? 0 : 1);
        drops.push({ y: -4 + Math.random() * rows * 0.95, v: 7 + Math.random() * 16, len: len, ch: ch });
      }
    }
    size(); M.resize = size; window.addEventListener('resize', size);
    var atlas = document.createElement('canvas'), LVL = 10, sw = Math.round(CW * dpr), sh = Math.round(CH * dpr);
    atlas.width = sw * LVL * 4; atlas.height = sh; var g = atlas.getContext('2d');
    g.font = '600 ' + Math.round(FS * dpr) + 'px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    var tile = 0, colour = ['#3fb950', '#e8ffe9'];
    for (var cc = 0; cc < 2; cc++) for (var l = 0; l < LVL; l++) for (var b = 0; b < 2; b++) { g.globalAlpha = (l + 1) / LVL; g.fillStyle = colour[cc]; g.fillText(String(b), tile * sw + sw / 2, sh / 2 + dpr * 0.5); tile++; }
    var last = performance.now();
    function frame(now) {
      if (!M.on) return;
      var dt = Math.min(0.06, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, c.width, c.height);
      for (var i = 0; i < cols; i++) {
        var d = drops[i], prev = Math.floor(d.y); d.y += d.v * dt;
        for (var s = prev; s < Math.floor(d.y); s++) { d.ch.unshift(Math.random() < 0.5 ? 0 : 1); if (d.ch.length > d.len) d.ch.pop(); }
        if (d.y - d.len > rows) { d.y = -Math.random() * 12; d.v = 7 + Math.random() * 16; d.len = 10 + ((Math.random() * 18) | 0); d.ch = []; }
        for (var k = 0; k < d.ch.length; k++) {
          var row = Math.floor(d.y) - k; if (row < 0 || row >= rows) continue;
          var lv = Math.max(0, Math.min(LVL - 1, Math.round(Math.pow(1 - k / d.len, 1.6) * (LVL - 1))));
          ctx.drawImage(atlas, (((k === 0 ? 1 : 0) * LVL + lv) * 2 + d.ch[k]) * sw, 0, sw, sh, Math.round(i * CW * dpr), Math.round(row * CH * dpr), sw, sh);
        }
      }
      M.raf = requestAnimationFrame(frame);
    }
    M.raf = requestAnimationFrame(frame);
    toast('Welcome to the matrix. <kbd>Esc</kbd> to leave.', 3200);
  }
  function matrixStop() {
    if (!M.on) return;
    M.on = false; cancelAnimationFrame(M.raf); window.removeEventListener('resize', M.resize);
    M.canvas.remove(); M.hint.remove(); root.classList.remove('matrix-on');
  }
  function matrixToggle() { if (M.on) matrixStop(); else matrixStart(); }

  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], kpos = 0;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { matrixStop(); return; }
    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = (k === KONAMI[kpos]) ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kpos === KONAMI.length) { kpos = 0; toast('↑↑↓↓←→←→ B A — cheat code accepted.', 2200); matrixStart(); }
  });

  /* ---------- footer controls + small touches ---------- */
  var replay = document.querySelector('[data-replay]');
  if (replay) replay.addEventListener('click', function () {
    if (!motionOK()) { toast('Animations are off. Turn them on in the footer to replay the intro.'); return; }
    if (isHome) { runBoot(); } else { location.href = (document.querySelector('.brand') || {}).href + '?boot=1'; }
  });
  var mbtn = document.querySelector('[data-matrix]');
  if (mbtn) mbtn.addEventListener('click', matrixToggle);
  document.querySelectorAll('[data-since]').forEach(function (n) {
    var days = Math.floor((Date.now() - new Date(n.dataset.since + 'T00:00:00Z').getTime()) / 86400000);
    if (days >= 0) n.textContent = ' Universe ’26 was ' + days + ' day' + (days === 1 ? '' : 's') + ' ago.';
  });
  try {
    console.log('%c01000111 01101001 01110100%c  hey, curious dev', 'color:#56d364;font:700 14px monospace', 'color:#a4aebc;font:13px monospace');
    console.log('%cTry Ctrl/⌘ K, the Konami code, clicking the Octocat, or reading the digits inside it.', 'color:#a4aebc;font:12px monospace');
  } catch (e) {}

  window.u26 = { toast: toast, matrix: matrixToggle, boot: runBoot };

  /* ---------- go ---------- */
  var force = /[?&]boot=1/.test(location.search);
  if (root.classList.contains('booting') || (force && isHome && motionOK())) {
    runBoot();
    window.addEventListener('u26:boot-done', function () { setTimeout(decodeHeadline, 120); }, { once: true });
  } else {
    setTimeout(decodeHeadline, 150);
  }
})();
