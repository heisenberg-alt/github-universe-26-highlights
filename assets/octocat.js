/* Binary Octocat
 *
 * Renders a field of 0s and 1s on a <canvas class="octo"> and lights an Octocat-style silhouette
 * (my own stylised drawing, not GitHub's artwork) in the middle of it. The digits inside the
 * silhouette are not random: read left to right, top to bottom they spell "GitHub Universe 2026 "
 * in 8-bit ASCII. Flicker is transient and reverts, so the message stays intact.
 *
 * Effects: breathing shimmer, a diagonal light sweep, random flicker, a neon outline, and a cursor
 * "flashlight". The faint digit field is pre-rendered once to an offscreen layer; each frame only the
 * Octocat and the cells being lit are redrawn. It pauses when off-screen / tab hidden, draws a single
 * static frame for prefers-reduced-motion or when the user switches the animation off (footer toggle),
 * and re-themes on light/dark change.
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
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionAllowed = function () { return !reduceQuery.matches && root.dataset.motion !== 'off'; };
  var PRESETS = { hero: { font: 13, alpha: 1 }, head: { font: 11, alpha: 0.85 } };

  /* ---- the silhouette (100 x 100 design space) ---- */
  var HEAD = 'M19 9 L39 21 C45 19 55 19 61 21 L81 9 C86 20 88 32 86 42 C96 52 91 71 75 75 C68 78 32 78 25 75 C9 71 4 52 14 42 C12 32 14 20 19 9 Z';
  var TENTACLES = [
    'M26 68 C26 86 14 95 6 84', 'M38 70 C38 88 32 97 25 94', 'M50 70 C50 88 52 97 59 96',
    'M62 70 C62 88 68 97 75 94', 'M74 68 C74 86 86 95 94 84'
  ];
  function drawSilhouette(ctx) {
    ctx.fillStyle = 'rgb(0,255,0)';                      // body
    ctx.strokeStyle = 'rgb(0,255,0)';
    ctx.lineWidth = 12.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fill(new Path2D(HEAD));
    TENTACLES.forEach(function (d) { ctx.stroke(new Path2D(d)); });
    ctx.fillStyle = 'rgb(0,255,255)';                    // dimmer face plate (makes the eyes pop)
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(22, 35, 56, 27, 13); else ctx.rect(22, 35, 56, 27);
    ctx.fill();
    ctx.fillStyle = 'rgb(255,255,255)';                  // eyes
    [[38, 47], [62, 47]].forEach(function (e) { ctx.beginPath(); ctx.ellipse(e[0], e[1], 6.2, 7.6, 0, 0, 6.2832); ctx.fill(); });
  }

  function debounce(fn, ms) { var id; return function () { clearTimeout(id); id = setTimeout(fn, ms); }; }
  var lvOf = function (a) { return Math.min(LV - 1, Math.max(0, Math.round(a * LV - 1))); };

  /* ---- one instance per canvas ---- */
  function Octo(canvas) {
    var self = this;
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cfg = PRESETS[canvas.dataset.octo] || PRESETS.hero;
    this.mx = -9999; this.my = -9999;
    this.visible = true; this.last = 0; this.fps = 30; this.slow = 0; this.built = false;

    new ResizeObserver(debounce(function () { self.build(); self.frame(performance.now(), true); }, 120)).observe(canvas);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; self.kick(); }).observe(canvas);
    window.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mx = e.clientX - r.left; self.my = e.clientY - r.top;
    }, { passive: true });
    document.addEventListener('mouseleave', function () { self.mx = self.my = -9999; });
    this.build();
    this.frame(performance.now(), true);                 // always paint one frame immediately
  }

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
    this.cols = Math.ceil(w / this.cw); this.rows = Math.ceil(h / this.ch);
    var n = this.cols * this.rows, cols = this.cols, rows = this.rows;
    this.zone = new Uint8Array(n); this.rim = new Uint8Array(n); this.cov = new Float32Array(n); this.bit = new Uint8Array(n); this.flick = new Float64Array(n);

    /* silhouette placement: right-aligned, clear of the text column */
    var S, ox, oy;
    if (narrow) { S = Math.min(w * 0.9, h * 0.6); ox = (w - S) / 2 + w * 0.14; oy = h * 0.03; }
    else if (this.cfg === PRESETS.head) { S = Math.min(h * 0.96, w * 0.42); ox = w - S - 28; oy = (h - S) / 2; }
    else { S = Math.min(h * 1.0, w * 0.47); ox = w - S - 14; oy = h * 0.015; }

    /* silhouette -> per-cell coverage + zone (rendered large, then box-filtered down to one pixel per cell) */
    var big = document.createElement('canvas'); big.width = cols * 4; big.height = rows * 4;
    var bctx = big.getContext('2d');
    var px = big.width / w, py = big.height / h;         // CSS px -> mask px (keeps the cell aspect right)
    bctx.setTransform(px * S / 100, 0, 0, py * S / 100, px * ox, py * oy);
    drawSilhouette(bctx);
    var small = document.createElement('canvas'); small.width = cols; small.height = rows;
    var sctx = small.getContext('2d'); sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(big, 0, 0, cols, rows);
    var d = sctx.getImageData(0, 0, cols, rows).data, msg = 0, i;
    for (i = 0; i < n; i++) {
      var a = d[i * 4 + 3] / 255; this.cov[i] = a;
      var r = d[i * 4], b = d[i * 4 + 2];
      this.zone[i] = a < 0.12 ? 0 : (r > 150 ? 2 : (b > 150 ? 3 : 1));
      this.bit[i] = this.zone[i] ? BITS.charCodeAt(msg++ % BITS.length) - 48 : (Math.random() < 0.5 ? 1 : 0);
    }
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {        // neon rim = inside cells touching outside
      var j = y * cols + x;
      if (!this.zone[j]) continue;
      var up = y > 0 ? this.zone[j - cols] : 0, dn = y < rows - 1 ? this.zone[j + cols] : 0;
      var lf = x > 0 ? this.zone[j - 1] : 0, rt = x < cols - 1 ? this.zone[j + 1] : 0;
      this.rim[j] = (!up || !dn || !lf || !rt) ? 1 : 0;
    }
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

  /* the faint background digits are drawn once to an offscreen layer and only patched when a digit flips */
  Octo.prototype.drawField = function () {
    var f = document.createElement('canvas'); f.width = this.canvas.width; f.height = this.canvas.height;
    var g = f.getContext('2d'), lv = lvOf(this.fieldA);
    this.fieldCanvas = f; this.fieldCtx = g; this.fieldLv = lv;
    for (var y = 0; y < this.rows; y++) for (var x = 0; x < this.cols; x++) {
      var i = y * this.cols + x;
      if (!this.zone[i]) this.glyph(g, 0, lv, this.bit[i], x, y);
    }
  };

  Octo.prototype.kick = function () { if (this.visible && !this.running && motionAllowed() && !document.hidden) { this.running = true; this.loop(); } };
  Octo.prototype.loop = function () {
    var self = this;
    if (!this.visible || !motionAllowed() || document.hidden) { this.running = false; return; }
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
    var ctx = this.ctx, cols = this.cols, rows = this.rows, cw = this.cw, ch = this.ch;
    var zone = this.zone, rim = this.rim, bit = this.bit, flick = this.flick;
    var animate = !still && motionAllowed(), alphaScale = this.cfg.alpha * (this.w < 720 ? 0.55 : (this.w < 1000 ? 0.75 : 1));
    this.last = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = alphaScale; ctx.drawImage(this.fieldCanvas, 0, 0); ctx.globalAlpha = 1;   // static digit field

    var n = cols * rows, k;
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
    var phase = animate ? ((t * 0.00016) % 1.5) - 0.25 : 0.55;   // sweep position across the canvas
    var mxc = this.mx / cw, myc = this.my / ch, mr = 120 / cw;

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x, z = zone[i], cl, a;
        var sweep = Math.max(0, 1 - Math.abs((x / cols) * 0.75 + (y / rows) * 0.25 - phase) / 0.07);
        var mouse = 0;
        if (animate && this.mx > -999) { var dx = x - mxc, dy = (y - myc) * 1.9, md = Math.sqrt(dx * dx + dy * dy); if (md < mr) mouse = 1 - md / mr; }
        if (z) {
          var shimmer = animate ? Math.sin(t * 0.0012 + x * 0.17 + y * 0.11) : 0;
          cl = 1; a = 0.64 + 0.12 * shimmer + 0.3 * sweep + 0.3 * mouse;
          if (z === 3) a *= 0.5;                          // face plate (makes the eyes pop)
          if (rim[i]) { a = Math.max(a, 0.98); if (((i * 2654435761) >>> 0) % 5 < 2) cl = 3; }   // neon outline, sparkling
          if (z === 2) { cl = 2; a = 0.95 + 0.05 * shimmer; }
          if (sweep > 0.55 || mouse > 0.45) cl = 3;
        } else {
          if (sweep < 0.04 && mouse < 0.05) continue;     // untouched field cells live on the static layer
          cl = mouse > 0.5 ? 1 : 0; a = this.fieldA + 0.1 * sweep + (mouse > 0.05 ? 0.12 + 0.6 * mouse : 0);
        }
        a *= alphaScale;
        var b = (t < flick[i] || (mouse > 0.3 && ((t * 0.02 + i) | 0) % 5 === 0)) ? bit[i] ^ 1 : bit[i];
        this.glyph(ctx, cl, lvOf(a), b, x, y);
      }
    }
  };

  var octos = [];
  canvases.forEach(function (c) { octos.push(new Octo(c)); });

  /* re-theme on light/dark switch; start/stop on motion toggle; pause when the tab is hidden */
  new MutationObserver(function () { octos.forEach(function (o) { if (o.built) { o.atlas(); o.frame(performance.now(), true); } o.kick(); }); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
  document.addEventListener('visibilitychange', function () { octos.forEach(function (o) { o.kick(); }); });
  reduceQuery.addEventListener && reduceQuery.addEventListener('change', function () { octos.forEach(function (o) { o.frame(performance.now(), true); o.kick(); }); });
  octos.forEach(function (o) { o.kick(); });
  window.__octo = octos;                                  // handy for debugging / performance checks
})();
