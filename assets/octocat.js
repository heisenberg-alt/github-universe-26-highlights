/* Binary Octocat 2.0
 *
 * A field of 0s and 1s on a <canvas class="octo"> with an Octocat-style silhouette (my own stylised
 * drawing, not GitHub's artwork) lit in the middle. The digits inside the silhouette spell
 * "GitHub Universe 2026 " in 8-bit ASCII (read left to right, top to bottom); flicker reverts, so the
 * message stays intact.
 *
 * It is alive:
 *   - it assembles itself from scrambling digits (once, after the boot screen)
 *   - the eyes follow your cursor (or wander when you are idle) and it blinks
 *   - the tentacles sway (8 pre-rasterised frames)
 *   - click it: a shockwave rolls through the digits
 *   - a light sweep, shimmer, flicker, a neon outline and a cursor flashlight
 *
 * The faint digit field is pre-rendered once to an offscreen layer; each frame only the Octocat and the
 * cells being lit are redrawn. Pauses off-screen / in hidden tabs, draws one static frame for
 * prefers-reduced-motion or when the animation toggle is off, and re-themes on light/dark change.
 */
(function () {
  var canvases = document.querySelectorAll('canvas.octo');
  if (!canvases.length) return;

  var root = document.documentElement;
  var MESSAGE = 'GitHub Universe 2026 ';
  var BITS = '';
  for (var i = 0; i < MESSAGE.length; i++) BITS += ('00000000' + MESSAGE.charCodeAt(i).toString(2)).slice(-8);

  var LV = 16;                                           // alpha levels per colour class (alpha = (level + 1) / LV)
  var CLASSES = ['field', 'body', 'eye', 'hot'];
  var SWAY = 8;                                          // tentacle animation frames
  var INTRO_MS = 2000;
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionAllowed = function () { return !reduceQuery.matches && root.dataset.motion !== 'off'; };
  var PRESETS = { hero: { font: 13, alpha: 1, intro: true }, head: { font: 11, alpha: 0.85, intro: true } };

  /* ---- the silhouette (100 x 100 design space) ---- */
  var HEAD = 'M19 9 L39 21 C45 19 55 19 61 21 L81 9 C86 20 88 32 86 42 C96 52 91 71 75 75 C68 78 32 78 25 75 C9 71 4 52 14 42 C12 32 14 20 19 9 Z';
  var TENT = [                                           // x0 y0  x1 y1  x2 y2  x3 y3
    [26, 68, 26, 86, 14, 95, 6, 84], [38, 70, 38, 88, 32, 97, 25, 94], [50, 70, 50, 88, 52, 97, 59, 96],
    [62, 70, 62, 88, 68, 97, 75, 94], [74, 68, 74, 86, 86, 95, 94, 84]
  ];
  var EYES = [[38, 47], [62, 47]], EYE_R = [6.2, 7.6];

  function drawSilhouette(ctx, frame) {
    var th = frame / SWAY * Math.PI * 2;
    ctx.fillStyle = 'rgb(0,255,0)'; ctx.strokeStyle = 'rgb(0,255,0)';
    ctx.lineWidth = 12.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fill(new Path2D(HEAD));
    TENT.forEach(function (p, i) {                       // sway: later control points move more
      var ph = th + i * 0.9, dx = 3.2 * Math.sin(ph), dy = 1.3 * Math.cos(ph);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      ctx.bezierCurveTo(p[2] + dx * 0.3, p[3] + dy * 0.3, p[4] + dx * 0.7, p[5] + dy * 0.7, p[6] + dx, p[7] + dy);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgb(0,255,255)';                    // dimmer face plate (makes the eyes pop)
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(22, 35, 56, 27, 13); else ctx.rect(22, 35, 56, 27);
    ctx.fill();
    ctx.fillStyle = 'rgb(255,255,255)';                  // eyes
    EYES.forEach(function (e) { ctx.beginPath(); ctx.ellipse(e[0], e[1], EYE_R[0], EYE_R[1], 0, 0, 6.2832); ctx.fill(); });
  }

  function debounce(fn, ms) { var id; return function () { clearTimeout(id); id = setTimeout(fn, ms); }; }
  var lvOf = function (a) { return Math.min(LV - 1, Math.max(0, Math.round(a * LV - 1))); };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  /* ---- one instance per canvas ---- */
  function Octo(canvas) {
    var self = this;
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cfg = PRESETS[canvas.dataset.octo] || PRESETS.hero;
    this.mx = -9999; this.my = -9999;
    this.visible = true; this.last = 0; this.fps = 30; this.slow = 0; this.built = false;
    this.waves = []; this.introStart = null; this.introDone = false; this.nextBlink = 2500; this.blinkUntil = 0;

    new ResizeObserver(debounce(function () { self.build(); self.frame(performance.now(), true); }, 120)).observe(canvas);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; self.kick(); }).observe(canvas);
    window.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mx = e.clientX - r.left; self.my = e.clientY - r.top;
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {                  // click the Octocat -> shockwave
      if (!self.built || !self.visible || !motionAllowed()) return;
      if (e.target.closest && e.target.closest('a,button,input,textarea,select,summary,label,[role="button"],.palette,.boot')) return;
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, b = self.bbox;
      if (x < b.x || x > b.x + b.s || y < b.y || y > b.y + b.s) return;
      self.pulse(x, y);
      window.dispatchEvent(new CustomEvent('u26:poke'));
    });
    document.addEventListener('mouseleave', function () { self.mx = self.my = -9999; });
    this.build();
    this.frame(performance.now(), true);                 // always paint one frame immediately
  }

  Octo.prototype.pulse = function (x, y) { this.waves.push({ x: x, y: y, t0: performance.now() }); this.kick(); };

  Octo.prototype.theme = function () {
    var cs = getComputedStyle(root), g = function (n, d) { return (cs.getPropertyValue(n) || d).trim() || d; };
    this.colors = [g('--oc-field', '#8b98ad'), g('--oc-body', '#56d364'), g('--oc-eye', '#79e2ff'), g('--oc-hot', '#d2ffd8')];
    this.light = root.dataset.theme === 'light';
    this.fieldA = this.light ? 0.1 : 0.06;
  };

  Octo.prototype.build = function () {
    var c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) { this.built = false; return; }
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var narrow = w < 720, font = this.cfg.font * (narrow ? 0.85 : 1);
    this.dpr = dpr; this.w = w; this.h = h;
    this.cw = font * 0.6; this.ch = font * 1.2;
    var cols = this.cols = Math.ceil(w / this.cw), rows = this.rows = Math.ceil(h / this.ch), n = cols * rows;

    /* silhouette placement: right-aligned, clear of the text column */
    var S, ox, oy;
    if (narrow) { S = Math.min(w * 0.9, h * 0.6); ox = (w - S) / 2 + w * 0.14; oy = h * 0.03; }
    else if (this.cfg === PRESETS.head) { S = Math.min(h * 0.96, w * 0.42); ox = w - S - 28; oy = (h - S) / 2; }
    else { S = Math.min(h * 1.0, w * 0.47); ox = w - S - 14; oy = h * 0.015; }
    this.bbox = { x: ox, y: oy, s: S };

    /* one rasterised frame per sway phase: zone (0 none, 1 body, 2 eye, 3 face plate), rim, coverage */
    var big = document.createElement('canvas'); big.width = cols * 4; big.height = rows * 4;
    var bctx = big.getContext('2d'), px = big.width / w, py = big.height / h;
    var small = document.createElement('canvas'); small.width = cols; small.height = rows;
    var sctx = small.getContext('2d', { willReadFrequently: true }); sctx.imageSmoothingQuality = 'high';
    var frames = [], uni = new Uint8Array(n), f, i, x, y;
    for (f = 0; f < SWAY; f++) {
      bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, big.width, big.height);
      bctx.setTransform(px * S / 100, 0, 0, py * S / 100, px * ox, py * oy);
      drawSilhouette(bctx, f);
      sctx.clearRect(0, 0, cols, rows); sctx.drawImage(big, 0, 0, cols, rows);
      var d = sctx.getImageData(0, 0, cols, rows).data, zone = new Uint8Array(n), rim = new Uint8Array(n);
      for (i = 0; i < n; i++) {
        var a = d[i * 4 + 3] / 255, r = d[i * 4], b = d[i * 4 + 2];
        zone[i] = a < 0.12 ? 0 : (r > 150 ? 2 : (b > 150 ? 3 : 1));
        if (zone[i]) uni[i] = 1;
      }
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {            // neon rim = inside cells touching outside
        var j = y * cols + x;
        if (!zone[j]) continue;
        var up = y > 0 ? zone[j - cols] : 0, dn = y < rows - 1 ? zone[j + cols] : 0;
        var lf = x > 0 ? zone[j - 1] : 0, rt = x < cols - 1 ? zone[j + 1] : 0;
        rim[j] = (!up || !dn || !lf || !rt) ? 1 : 0;
      }
      frames.push({ zone: zone, rim: rim });
    }
    this.frames = frames;
    /* bits are assigned over the union of all frames so a cell keeps its digit when a tentacle sways over it */
    this.bit = new Uint8Array(n); this.flick = new Float64Array(n); this.rv = new Float32Array(n);
    var msg = 0, cx = 0, cy = 0, cnt = 0, maxd = 1;
    for (i = 0; i < n; i++) {
      if (uni[i]) { this.bit[i] = BITS.charCodeAt(msg++ % BITS.length) - 48; cx += i % cols; cy += (i / cols) | 0; cnt++; }
      else this.bit[i] = Math.random() < 0.5 ? 1 : 0;
    }
    cx /= Math.max(1, cnt); cy /= Math.max(1, cnt);
    for (i = 0; i < n; i++) if (uni[i]) maxd = Math.max(maxd, Math.hypot(i % cols - cx, ((i / cols) | 0) - cy));
    for (i = 0; i < n; i++) if (uni[i]) this.rv[i] = clamp(0.78 * Math.hypot(i % cols - cx, ((i / cols) | 0) - cy) / maxd + 0.22 * Math.random(), 0, 0.94);
    for (i = 0; i < n; i++) if (frames[0].zone[i] === 2) this.rv[i] = 0.9 + 0.08 * Math.random();   // the eyes light up last

    /* eye geometry in cell units (for the pupils) */
    this.eyes = EYES.map(function (e, k) {
      return { cx: (ox + S * e[0] / 100) / this.cw, cy: (oy + S * e[1] / 100) / this.ch, rx: S * EYE_R[0] / 100 / this.cw, ry: S * EYE_R[1] / 100 / this.ch, px: 0, py: 0 };
    }, this);
    this.atlas();
    this.built = true;
  };

  /* glyph atlas: every (class, level, digit) pre-rendered once */
  Octo.prototype.atlas = function () {
    this.theme();
    var sw = Math.max(1, Math.round(this.cw * this.dpr)), sh = Math.max(1, Math.round(this.ch * this.dpr));
    this.sw = sw; this.sh = sh;
    var a = document.createElement('canvas'); a.width = sw * CLASSES.length * LV * 2; a.height = sh;
    var g = a.getContext('2d');
    g.font = '600 ' + Math.round(this.cw / 0.6 * this.dpr) + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var tile = 0;
    for (var cl = 0; cl < CLASSES.length; cl++) for (var lv = 0; lv < LV; lv++) for (var bit = 0; bit < 2; bit++) {
      g.globalAlpha = (lv + 1) / LV; g.fillStyle = this.colors[cl];
      g.fillText(String(bit), tile * sw + sw / 2, sh / 2 + this.dpr * 0.5); tile++;
    }
    this.atlasCanvas = a;
    this.drawField();
  };

  Octo.prototype.glyph = function (g, cl, lv, bit, x, y) {
    g.drawImage(this.atlasCanvas, ((cl * LV + lv) * 2 + bit) * this.sw, 0, this.sw, this.sh,
                Math.round(x * this.cw * this.dpr), Math.round(y * this.ch * this.dpr), this.sw, this.sh);
  };

  /* the faint background digits (every cell) are drawn once to an offscreen layer and patched when a digit flips */
  Octo.prototype.drawField = function () {
    var f = document.createElement('canvas'); f.width = this.canvas.width; f.height = this.canvas.height;
    var g = f.getContext('2d'), lv = lvOf(this.fieldA);
    this.fieldCanvas = f; this.fieldCtx = g; this.fieldLv = lv;
    for (var y = 0; y < this.rows; y++) for (var x = 0; x < this.cols; x++) this.glyph(g, 0, lv, this.bit[y * this.cols + x], x, y);
  };

  Octo.prototype.kick = function () { if (this.visible && !this.running && (motionAllowed() || this.waves.length) && !document.hidden) { this.running = true; this.loop(); } };
  Octo.prototype.loop = function () {
    var self = this;
    if (!this.visible || document.hidden || !(motionAllowed() || this.waves.length)) { this.running = false; return; }
    requestAnimationFrame(function (t) {
      if (t - self.last >= 1000 / self.fps) {
        var t0 = performance.now(); self.frame(t, false);
        if (performance.now() - t0 > 20 && ++self.slow > 20) self.fps = 15;   // back off on slow devices
      }
      self.loop();
    });
  };

  Octo.prototype.frame = function (t, still) {
    if (!this.built) return;
    var ctx = this.ctx, cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch, i, k;
    var animate = !still && motionAllowed(), alphaScale = this.cfg.alpha * (this.w < 720 ? 0.55 : (this.w < 1000 ? 0.75 : 1));
    this.last = t;
    var fr = this.frames[animate ? ((t / 140) | 0) % SWAY : 0], zone = fr.zone, rim = fr.rim, bit = this.bit, flick = this.flick;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = alphaScale; ctx.drawImage(this.fieldCanvas, 0, 0); ctx.globalAlpha = 1;   // static digit field

    /* intro: hold until the boot screen is gone, then decode the Octocat out of scrambling digits */
    var booting = root.classList.contains('booting'), intro = false, ik = 1;
    if (animate && this.cfg.intro && !this.introDone) {
      if (booting) { ik = -1; intro = true; }
      else {
        if (this.introStart === null) this.introStart = t;
        ik = (t - this.introStart) / INTRO_MS;
        if (ik >= 1.15) this.introDone = true; else intro = true;
      }
    }

    var n = cols * rows;
    if (animate) {                                        // random flicker: field digits flip for good, Octocat digits flip briefly
      var flips = Math.ceil(n * 0.004);
      for (k = 0; k < flips; k++) {
        var ri = (Math.random() * n) | 0;
        if (zone[ri]) flick[ri] = t + 90 + Math.random() * 220;
        else {
          bit[ri] ^= 1; var fx = ri % cols, fy = (ri / cols) | 0, fc = this.fieldCtx;
          fc.clearRect(Math.round(fx * cw * this.dpr), Math.round(fy * ch * this.dpr), this.sw, this.sh);
          this.glyph(fc, 0, this.fieldLv, bit[ri], fx, fy);
        }
      }
    }

    /* eyes: pupils look at the cursor (or wander when idle); blink every few seconds */
    var mxc = this.mx / cw, myc = this.my / ch, mr = 120 / cw, hasMouse = this.mx > -999, E = this.eyes;
    var blink = animate && t < this.blinkUntil;
    if (animate && t > this.nextBlink) { this.blinkUntil = t + 150; this.nextBlink = t + 2600 + Math.random() * 3600; }
    for (k = 0; k < 2; k++) {
      var e = E[k], lx, ly;
      if (hasMouse) { lx = (mxc - e.cx) / (e.rx * 9); ly = (myc - e.cy) / (e.ry * 9); }
      else { lx = Math.sin(t * 0.0006 + k) * 0.5; ly = Math.cos(t * 0.00045) * 0.3; }
      e.px = e.cx + clamp(lx, -1, 1) * e.rx * 0.5; e.py = e.cy + clamp(ly, -1, 1) * e.ry * 0.5;
    }
    var prx = Math.max(0.9, E[0].rx * 0.45), pry = Math.max(0.9, E[0].ry * 0.4);

    /* shockwaves from clicks */
    var waves = this.waves;
    if (waves.length) { this.waves = waves = waves.filter(function (w) { return (t - w.t0) * 0.55 < 760; }); }

    var phase = animate ? ((t * 0.00016) % 1.5) - 0.25 : 0.55;   // sweep position across the canvas
    var eyeMid = (E[0].cx + E[1].cx) / 2;

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        i = y * cols + x;
        var z = zone[i], cl, a, b = bit[i], rv = z ? this.rv[i] : 0;
        if (z && intro && ik < rv + 0.14) {                // decoding: scrambling digits, then a white-hot flash
          if (ik < 0 || ik < rv) { if (ik < 0) continue; cl = 1; a = 0.22 + 0.2 * Math.random(); b = Math.random() < 0.5 ? 1 : 0; }
          else { cl = 3; a = 1; }
          this.glyph(ctx, cl, lvOf(a * alphaScale), b, x, y); continue;
        }
        var sweep = Math.max(0, 1 - Math.abs((x / cols) * 0.75 + (y / rows) * 0.25 - phase) / 0.07);
        var mouse = 0;
        if (animate && hasMouse) { var dx = x - mxc, dy = (y - myc) * 1.9, md = Math.sqrt(dx * dx + dy * dy); if (md < mr) mouse = 1 - md / mr; }
        var ring = 0;
        if (waves.length) {
          var cxp = x * cw + cw / 2, cyp = y * ch + ch / 2;
          for (k = 0; k < waves.length; k++) {
            var wv = waves[k], rr = (t - wv.t0) * 0.55, dd = Math.hypot(cxp - wv.x, cyp - wv.y), band = 1 - Math.abs(dd - rr) / 38;
            if (band > 0) ring = Math.max(ring, band * (1 - rr / 760));
          }
        }
        if (z) {
          var shimmer = animate ? Math.sin(t * 0.0012 + x * 0.17 + y * 0.11) : 0;
          cl = 1; a = 0.64 + 0.12 * shimmer + 0.3 * sweep + 0.3 * mouse;
          if (z === 3) a *= 0.5;                          // face plate (makes the eyes pop)
          if (rim[i]) { a = Math.max(a, 0.98); if (((i * 2654435761) >>> 0) % 5 < 2) cl = 3; }   // neon outline, sparkling
          if (sweep > 0.55 || mouse > 0.45) cl = 3;
          if (z === 2) {                                   // eyes: cyan sclera + pupil of round zeros
            var ek = x < eyeMid ? 0 : 1, ee = E[ek];
            var inP = Math.pow((x - ee.px) / prx, 2) + Math.pow((y - ee.py) / pry, 2) <= 1;
            if (blink) { cl = 2; a = 0.15; }
            else if (inP) { cl = 3; a = 1; b = 0; }
            else { cl = 2; a = 0.6 + 0.12 * shimmer; b = 1; }
          }
          if (ring > 0.05) { cl = 3; a = Math.max(a, 0.5 + ring * 0.5); }
        } else {
          if (sweep < 0.04 && mouse < 0.05 && ring < 0.05) continue;   // untouched field cells live on the static layer
          cl = (mouse > 0.5 || ring > 0.3) ? 1 : 0;
          a = this.fieldA + 0.1 * sweep + (mouse > 0.05 ? 0.12 + 0.6 * mouse : 0) + ring * 0.8;
          if (ring > 0.4) cl = 3;
        }
        a *= alphaScale;
        if (t < flick[i] || (mouse > 0.3 && ((t * 0.02 + i) | 0) % 5 === 0) || (ring > 0.3 && ((i + (t / 60 | 0)) & 1))) b ^= 1;
        this.glyph(ctx, cl, lvOf(a), b, x, y);
      }
    }
  };

  var octos = [];
  canvases.forEach(function (c) { octos.push(new Octo(c)); });

  /* re-theme on light/dark switch; start/stop on motion toggle; pause when the tab is hidden */
  new MutationObserver(function (recs) {
    var retheme = recs.some(function (r) { return r.attributeName === 'data-theme'; });
    octos.forEach(function (o) { if (retheme && o.built) { o.atlas(); o.frame(performance.now(), true); } o.kick(); });
  })
    .observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion', 'class'] });
  document.addEventListener('visibilitychange', function () { octos.forEach(function (o) { o.kick(); }); });
  reduceQuery.addEventListener && reduceQuery.addEventListener('change', function () { octos.forEach(function (o) { o.frame(performance.now(), true); o.kick(); }); });
  window.addEventListener('u26:pulse', function () { if (!motionAllowed()) return; octos.forEach(function (o) { if (o.built && o.visible) o.pulse(o.bbox.x + o.bbox.s / 2, o.bbox.y + o.bbox.s * 0.45); }); });
  octos.forEach(function (o) { o.kick(); });
  window.__octo = octos;                                  // handy for debugging / performance checks
})();
