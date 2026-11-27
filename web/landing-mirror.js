/* Mirror 字标碎裂，碎片旋转拼成首页镜面。 */
(function () {
  var hero = document.querySelector(".hm-hero");
  var frame = document.querySelector(".hm-hero__frame");
  var enter = document.querySelector(".hero-enter");
  var intro = document.getElementById("intro");
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!root.classList.contains("mirror-opening-active")) return;
  if (reduce.matches || window.scrollY > 8 || (location.hash && location.hash !== "#hm-top") ||
      !hero || !frame || !enter || !intro) {
    root.classList.remove("mirror-opening-active");
    return;
  }

  var art = intro.querySelector(".intro-art img");
  var underlay = [document.querySelector(".site-header"), document.querySelector("main"), document.querySelector(".site-footer")];

  var canvas = document.createElement("canvas");
  canvas.className = "hm-hero__mirror";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");
  if (!ctx) {
    root.classList.remove("mirror-opening-active");
    return;
  }
  frame.appendChild(canvas);
  var assembly = document.createElement("canvas");
  assembly.className = "hm-hero__assembly";
  assembly.setAttribute("aria-hidden", "true");
  var assemblyCtx = assembly.getContext("2d");
  if (assemblyCtx && art) frame.appendChild(assembly);
  else assemblyCtx = null;

  var WW = 1500, WH = 470, WORD = "Mirror";
  var word = null, mask = null, glow = null, refl = null, reflH = 0, glint = null, gctx = null;
  var flash = null, dotCold = null, dotWarm = null;
  var bg = null, maskData = null, box = null, baseY = 0;
  var shards = [], dust = [], lensShards = [];
  var W = 0, H = 0, DPR = 1, raf = 0;
  var tin = 0, t0 = 0;
  var burstOn = false, burstAt = 0, burstDur = 1600;
  var handoffDelay = 300, assemblyDuration = 1150;
  var tiles = null, focusIntro = false;
  var hoverT = 0, hover = 0, hmx = 0, hmy = 0, pmx = 0, pmy = 0, pmInit = false;
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var sparks = [], burstCx = 0, burstCy = 0;
  /* 不规则碎片透镜：随机多边形顶点，随时间轻微morph，绝不画圆 */
  var lensSeed = [], lensAt = 0;
  function buildLensSeed() {
    lensSeed = [];
    var nv = 18;
    for (var i = 0; i < nv; i++) {
      lensSeed.push({ a: i / nv * 6.2832 + rnd(-0.05, 0.05), r: rnd(0.84, 1.12), ph: rnd(0, 6.2832) });
    }
  }
  function trand(a, b, k) {
    var x = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function lensTrace(c, cx, cy, base, t) {
    for (var i = 0; i < lensSeed.length; i++) {
      var v = lensSeed[i];
      var rr = base * v.r * (1 + 0.05 * Math.sin(t * 1.6 + v.ph));
      var x = cx + Math.cos(v.a) * rr, y = cy + Math.sin(v.a) * rr;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }
  if (canHover) {
    frame.addEventListener("pointermove", function (ev) {
      var r = frame.getBoundingClientRect();
      hmx = ev.clientX - r.left; hmy = ev.clientY - r.top;
      if (!pmInit) { pmx = hmx; pmy = hmy; pmInit = true; }
      hoverT = 1;
    });
    frame.addEventListener("pointerleave", function () { hoverT = 0; });
  }

  function make(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function buildWord() {
    word = make(WW, WH);
    var g = word.getContext("2d");
    var fam = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
    var fs = 210;
    g.font = "500 " + fs + "px " + fam;
    var track = fs * 0.11;
    var widths = [], total = 0, i;
    for (i = 0; i < WORD.length; i++) {
      var w = g.measureText(WORD[i]).width;
      widths.push(w); total += w;
    }
    total += track * (WORD.length - 1);
    var fit = (WW * 0.84) / total;
    fs = fs * fit;
    track = fs * 0.11;
    g.font = "500 " + fs + "px " + fam;
    widths = []; total = 0;
    for (i = 0; i < WORD.length; i++) {
      var w2 = g.measureText(WORD[i]).width;
      widths.push(w2); total += w2;
    }
    total += track * (WORD.length - 1);
    baseY = Math.round(WH * 0.5 + fs * 0.30);

    var grad = g.createLinearGradient(0, baseY - fs * 0.80, 0, baseY + fs * 0.18);
    grad.addColorStop(0.00, "#ffffff");
    grad.addColorStop(0.14, "#e4effb");
    grad.addColorStop(0.31, "#a2b6cf");
    grad.addColorStop(0.41, "#f7fbff");
    grad.addColorStop(0.56, "#7e93ae");
    grad.addColorStop(0.70, "#dfeafa");
    grad.addColorStop(0.86, "#b2c4da");
    grad.addColorStop(1.00, "#8da1bb");
    g.fillStyle = grad;
    g.textBaseline = "alphabetic";
    var x = (WW - total) / 2;
    for (i = 0; i < WORD.length; i++) {
      g.fillText(WORD[i], x, baseY);
      x += widths[i] + track;
    }

    mask = make(WW, WH);
    var m = mask.getContext("2d");
    m.font = "500 " + fs + "px " + fam;
    m.fillStyle = "#fff";
    m.textBaseline = "alphabetic";
    x = (WW - total) / 2;
    for (i = 0; i < WORD.length; i++) {
      m.fillText(WORD[i], x, baseY);
      x += widths[i] + track;
    }
    maskData = m.getImageData(0, 0, WW, WH).data;

    var bx0 = WW, by0 = WH, bx1 = 0, by1 = 0;
    for (var y = 0; y < WH; y++) {
      for (var xx = 0; xx < WW; xx++) {
        if (maskData[(y * WW + xx) * 4 + 3] > 26) {
          if (xx < bx0) bx0 = xx;
          if (xx > bx1) bx1 = xx;
          if (y < by0) by0 = y;
          if (y > by1) by1 = y;
        }
      }
    }
    box = { x0: bx0, y0: by0, x1: bx1, y1: by1, cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2 };

    // 柔光底
    glow = make(WW / 2, WH / 2);
    var gg = glow.getContext("2d");
    gg.filter = "blur(9px)";
    gg.drawImage(mask, 0, 0, WW / 2, WH / 2);
    gg.filter = "none";
    gg.globalCompositeOperation = "source-in";
    gg.fillStyle = "rgba(158,196,255,0.95)";
    gg.fillRect(0, 0, WW / 2, WH / 2);
    gg.globalCompositeOperation = "source-over";

    // 镜面倒影
    reflH = Math.round(fs * 0.36);
    refl = make(WW, reflH);
    var rg = refl.getContext("2d");
    rg.filter = "blur(11px)";
    rg.setTransform(1, 0, 0, -1, 0, baseY);
    rg.drawImage(word, 0, 0);
    rg.setTransform(1, 0, 0, 1, 0, 0);
    rg.filter = "none";
    var fg = rg.createLinearGradient(0, 0, 0, reflH);
    fg.addColorStop(0, "rgba(0,0,0,0.55)");
    fg.addColorStop(0.32, "rgba(0,0,0,0.2)");
    fg.addColorStop(0.82, "rgba(0,0,0,0)");
    rg.globalCompositeOperation = "destination-in";
    rg.fillStyle = fg;
    rg.fillRect(0, 0, WW, reflH);
    rg.globalCompositeOperation = "source-over";

    glint = make(WW, WH);
    gctx = glint.getContext("2d");
  }

  function coverage(p, bx0, by0, bx1, by1) {
    var hit = 0, all = 0;
    for (var y = Math.floor(by0); y < by1; y += 3) {
      for (var x = Math.floor(bx0); x < bx1; x += 3) {
        all++;
        if (maskData[(y * WW + x) * 4 + 3] > 40) hit++;
      }
    }
    return all ? hit / all : 0;
  }

  function buildShards(step, out) {
    var pad = Math.max(8, (box.y1 - box.y0) * 0.06);
    var x0 = box.x0 - pad, y0 = box.y0 - pad, x1 = box.x1 + pad, y1 = box.y1 + pad;
    var cols = Math.max(2, Math.round((x1 - x0) / step));
    var rows = Math.max(2, Math.round((y1 - y0) / step));
    var cw = (x1 - x0) / cols, chh = (y1 - y0) / rows;
    var grid = [], r, c;
    for (r = 0; r <= rows; r++) {
      grid[r] = [];
      for (c = 0; c <= cols; c++) {
        var jx = (c === 0 || c === cols) ? 0 : 0.42;
        var jy = (r === 0 || r === rows) ? 0 : 0.42;
        grid[r][c] = [x0 + c * cw + rnd(-jx, jx) * cw, y0 + r * chh + rnd(-jy, jy) * chh];
      }
    }
    var list = [];
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        list.push([grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]]);
      }
    }

    var cxw = box.cx, cyw = box.cy;
    var maxR = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)) / 2;
    for (var s = 0; s < list.length; s++) {
      var poly = list[s];
      var px0 = 1e9, py0 = 1e9, px1 = -1e9, py1 = -1e9;
      for (var k = 0; k < poly.length; k++) {
        var v = poly[k];
        if (v[0] < px0) px0 = v[0];
        if (v[0] > px1) px1 = v[0];
        if (v[1] < py0) py0 = v[1];
        if (v[1] > py1) py1 = v[1];
      }
      var cov = coverage(poly, Math.max(0, px0), Math.max(0, py0), Math.min(WW, px1), Math.min(WH, py1));
      if (cov < 0.05) continue;

      var sw = Math.ceil(px1 - px0) + 8, sh = Math.ceil(py1 - py0) + 8;
      var sc = make(sw, sh);
      var sg = sc.getContext("2d");
      sg.translate(4 - px0, 4 - py0);
      sg.beginPath();
      sg.moveTo(poly[0][0], poly[0][1]);
      for (var q = 1; q < poly.length; q++) sg.lineTo(poly[q][0], poly[q][1]);
      sg.closePath();
      sg.clip();
      sg.drawImage(word, 0, 0);
      sg.globalCompositeOperation = "source-atop";
      sg.fillStyle = Math.random() < 0.5 ? "rgba(104,148,208,0.12)" : "rgba(255,255,255,0.06)";
      sg.fillRect(px0 - 4, py0 - 4, sw, sh);
      sg.globalCompositeOperation = "source-atop";
      var shd = sg.createLinearGradient(px0, py0, px1, py1);
      shd.addColorStop(0, "rgba(150,188,230,0.24)");
      shd.addColorStop(0.5, "rgba(255,255,255,0)");
      shd.addColorStop(0.62, "rgba(255,255,255,0.10)");
      shd.addColorStop(1, "rgba(118,154,198,0.20)");
      sg.fillStyle = shd;
      sg.fillRect(px0 - 4, py0 - 4, sw, sh);
      sg.globalCompositeOperation = "source-atop";
      sg.strokeStyle = "rgba(255,255,255," + rnd(0.14, 0.4).toFixed(2) + ")";
      sg.lineWidth = rnd(0.9, 1.5);
      sg.stroke();
      sg.globalCompositeOperation = "source-over";
      sg.setTransform(1, 0, 0, 1, 0, 0);

      var fc = make(sw, sh);
      var fg2 = fc.getContext("2d");
      fg2.translate(4 - px0, 4 - py0);
      fg2.beginPath();
      fg2.moveTo(poly[0][0], poly[0][1]);
      for (var fp = 1; fp < poly.length; fp++) fg2.lineTo(poly[fp][0], poly[fp][1]);
      fg2.closePath();
      var fgr = fg2.createLinearGradient(px0, py0, px1, py1);
      fgr.addColorStop(0, "rgba(226,240,255,0.13)");
      fgr.addColorStop(0.5, "rgba(150,188,228,0.03)");
      fgr.addColorStop(1, "rgba(255,255,255,0.09)");
      fg2.fillStyle = fgr;
      fg2.fill();
      fg2.strokeStyle = "rgba(214,236,255,0.14)";
      fg2.lineWidth = 1.2;
      fg2.stroke();
      fg2.setTransform(1, 0, 0, 1, 0, 0);

      var ccx = (px0 + px1) / 2, ccy = (py0 + py1) / 2;
      var rr = Math.sqrt(Math.pow(ccx - cxw, 2) + Math.pow(ccy - cyw, 2)) / maxR;
      var outAng = Math.atan2(ccy - cyw, ccx - cxw) + rnd(-0.4, 0.4);
      if (rr < 0.12) outAng = rnd(0, 6.283);

      out.push({
        c: sc, f: fc, w: sw, h: sh, cx: ccx, cy: ccy,
        ang: rnd(0, 6.283), r: rnd(0.2, 0.7),
        rot0: rnd(-1.15, 1.15), sc0: rnd(0.8, 1.15),
        delay: 0.1 + 0.75 * rr + rnd(0, 0.12), dur: rnd(0.9, 1.15),
        sdir: outAng, dist: rnd(0.2, 0.66), spin: rnd(-1.4, 1.4),
        depth: rnd(0.5, 1.3), gd: Math.random()
      });
    }
  }

  function buildFX() {
    function dotSprite(rgb) {
      var c = make(24, 24), g = c.getContext("2d");
      var gg = g.createRadialGradient(12, 12, 0, 12, 12, 12);
      gg.addColorStop(0, "rgba(" + rgb + ",1)");
      gg.addColorStop(0.22, "rgba(" + rgb + ",0.85)");
      gg.addColorStop(0.5, "rgba(" + rgb + ",0.22)");
      gg.addColorStop(1, "rgba(" + rgb + ",0)");
      g.fillStyle = gg;
      g.fillRect(0, 0, 24, 24);
      return c;
    }
    dotCold = dotSprite("222,240,255");
    dotWarm = dotSprite("255,234,206");

    flash = make(256, 256);
    var fg = flash.getContext("2d");
    var gf = fg.createRadialGradient(128, 128, 0, 128, 128, 128);
    gf.addColorStop(0, "rgba(255,255,255,0.95)");
    gf.addColorStop(0.18, "rgba(238,247,255,0.55)");
    gf.addColorStop(0.46, "rgba(190,220,255,0.18)");
    gf.addColorStop(1, "rgba(150,190,240,0)");
    fg.fillStyle = gf;
    fg.fillRect(0, 0, 256, 256);
  }

  function buildSparks() {
    sparks.length = 0;
    var n = W > 560 ? 110 : 78;
    var nd = W > 560 ? 260 : 130;
    for (var d0 = 0; d0 < nd; d0++) {
      sparks.push({
        dot: true,
        a: rnd(0, 6.2832),
        r0: rnd(0, 0.5),
        sp: rnd(0.1, 0.42),
        life: rnd(1.4, 2.4),
        sz: rnd(0.7, 1.8),
        warm: Math.random() < 0.24
      });
    }
    for (var i = 0; i < n; i++) {
      sparks.push({
        a: rnd(0, 6.2832),
        r0: rnd(0.3, 1.0),
        sp: rnd(0.3, 0.95),
        life: rnd(0.3, 0.62),
        sz: rnd(0.5, 1.6),
        warm: Math.random() < 0.22
      });
    }
  }

  function buildBG() {
    bg = make(canvas.width, canvas.height);
    var g = bg.getContext("2d");
    var w = bg.width, h = bg.height;
    g.fillStyle = "#000000";
    g.fillRect(0, 0, w, h);


    var vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.82);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.52)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
  }

  function buildDust() {
    dust.length = 0;
    var n = Math.round(clamp(W * 0.3, 200, 620));
    for (var i = 0; i < n; i++) {
      dust.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 0.4 + Math.random() * 1.3, a: 0.12 + Math.random() * 0.4,
        sp: 0.25 + Math.random() * 0.9, ph: Math.random() * 6.2832,
        warm: Math.random() < 0.16, spark: Math.random() < 0.12,
        vx: rnd(-0.07, 0.07), vy: rnd(-0.05, 0.05)
      });
    }
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, frame.clientWidth);
    H = Math.max(1, frame.clientHeight);
    if (W * H * dpr * dpr > 2400000) dpr = Math.sqrt(2400000 / (W * H));
    DPR = dpr;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    buildBG();
    buildDust();
    if (assemblyCtx) {
      assembly.width = canvas.width;
      assembly.height = canvas.height;
    }
  }

  function drawGlint(phase, alpha, wx, wy, k) {
    if (alpha <= 0.01) return;
    var bx = -0.5 * WW + phase * 1.95 * WW;
    var bw = 460;
    var x0 = Math.max(0, Math.floor(bx - bw * 0.55));
    var x1 = Math.min(WW, Math.floor(bx + bw * 0.45));
    var wpx = x1 - x0;
    if (wpx <= 2) return;
    gctx.globalCompositeOperation = "source-over";
    gctx.clearRect(x0, 0, wpx + 2, WH);
    gctx.drawImage(mask, x0, 0, wpx, WH, x0, 0, wpx, WH);
    gctx.globalCompositeOperation = "source-in";
    var grad = gctx.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.44, "rgba(255,255,255,0.32)");
    grad.addColorStop(0.63, "rgba(255,255,255,0.92)");
    grad.addColorStop(0.78, "rgba(206,232,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    gctx.fillStyle = grad;
    gctx.fillRect(x0, 0, wpx + 2, WH);
    gctx.globalCompositeOperation = "source-over";

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(glint, x0, 0, wpx, WH, wx + x0 * k, wy, wpx * k, WH * k);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function releaseOpening(focus) {
    if (!root.classList.contains("mirror-opening-active")) return;
    cancelAnimationFrame(raf);
    root.classList.remove("mirror-opening-active", "mirror-opening-handoff", "mirror-opening-settled");
    underlay.forEach(function (el) { el.inert = false; });
    if (focus) intro.focus({ preventScroll: true });
  }

  function leaveOpening(now, focus) {
    if (burstOn || !root.classList.contains("mirror-opening-active")) return;
    burstOn = true;
    burstAt = now;
    focusIntro = focus;
  }

  function createAssembly() {
    var gridSize = 5;
    var grid = [];
    for (var row = 0; row <= gridSize; row++) {
      var points = [];
      for (var col = 0; col <= gridSize; col++) {
        var x = col === 0 || col === gridSize ? col : col + (trand(col, row, 1) - 0.5) * 0.6;
        var y = row === 0 || row === gridSize ? row : row + (trand(col, row, 2) - 0.5) * 0.6;
        points.push([x / gridSize, y / gridSize]);
      }
      grid.push(points);
    }
    var tiles = [];
    for (var r = 0; r < gridSize; r++) {
      for (var c = 0; c < gridSize; c++) {
        var polygon = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]];
        var xs = polygon.map(function (point) { return point[0]; });
        var ys = polygon.map(function (point) { return point[1]; });
        var left = Math.min.apply(null, xs), top = Math.min.apply(null, ys);
        var width = Math.max.apply(null, xs) - left, height = Math.max.apply(null, ys) - top;
        var i = r * gridSize + c;
        var shard = shards[Math.floor((i + 0.5) / (gridSize * gridSize) * shards.length)];
        tiles.push({
          polygon: polygon,
          left: left, top: top, width: width, height: height,
          x: left + width / 2, y: top + height / 2,
          originX: shard.exitX, originY: shard.exitY,
          rotation: (trand(c, r, 4) - 0.5) * 3.3,
          bend: (trand(c, r, 5) - 0.5) * 0.38,
          delay: trand(c, r, 6) * 0.14
        });
      }
    }
    return tiles;
  }

  function drawAssembly(progress) {
    if (!assemblyCtx || !art.complete || !art.naturalWidth) return;
    if (!tiles && progress < 0.25) tiles = createAssembly();
    if (!tiles) return;

    var rect = art.getBoundingClientRect();
    var ctx = assemblyCtx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    tiles.forEach(function (tile) {
      var p = clamp((progress - tile.delay) / (0.88 - tile.delay), 0, 1);
      if (p === 0) return;
      var settle = 1 - Math.pow(1 - p, 2.6);
      var destX = rect.left + tile.x * rect.width;
      var destY = rect.top + tile.y * rect.height;
      var orbit = Math.sin(Math.PI * settle) * Math.min(W, H) * tile.bend;
      var x = tile.originX + (destX - tile.originX) * settle + orbit;
      var y = tile.originY + (destY - tile.originY) * settle - orbit * 0.54;
      var scale = 0.42 + 0.58 * settle;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 5) * (1 - clamp((progress - 0.89) / 0.11, 0, 1));
      ctx.translate(x, y);
      ctx.rotate((tile.rotation + 0.45) * (1 - settle));
      ctx.scale(scale, scale);
      ctx.beginPath();
      tile.polygon.forEach(function (point, index) {
        var px = (point[0] - tile.x) * rect.width;
        var py = (point[1] - tile.y) * rect.height;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(art,
        tile.left * art.naturalWidth, tile.top * art.naturalHeight,
        tile.width * art.naturalWidth, tile.height * art.naturalHeight,
        (tile.left - tile.x) * rect.width, (tile.top - tile.y) * rect.height,
        tile.width * rect.width, tile.height * rect.height
      );
      ctx.restore();
    });
  }

  function draw(now) {
    var el = (now - t0) / 1000;
    var b = burstOn ? clamp((now - burstAt) / burstDur, 0, 1) : 0;
    tin = burstOn ? Math.max(el, 3.2) : el;

    var targetGlyph = W / H < 0.95 ? Math.min(W * 0.8, 720) : Math.min(W * 0.72, 1060);
    var k = targetGlyph / (box.x1 - box.x0);
    var gs = 1 + 0.006 * Math.sin(tin * 0.55);
    var gx = W / 2 + Math.sin(tin * 0.4) * 5;
    var gy = H * 0.47 + Math.cos(tin * 0.33) * 4;
    if (burstOn && sparks.length === 0) { burstCx = gx; burstCy = gy; buildSparks(); }
    var wx = gx - box.cx * k * gs;
    var wy = gy - box.cy * k * gs;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (burstOn && b < 0.13) {
      var shk = Math.pow(1 - b / 0.13, 1.6) * 17;
      ctx.translate((Math.random() - 0.5) * shk, (Math.random() - 0.5) * shk);
    }

    var built = clamp((tin - 0.7) / 1.4, 0, 1);
    var sol = burstOn ? 0 : clamp((tin - 2.55) / 0.75, 0, 1);

    // 反光：入场后首次，之后循环
    var gAlpha = 0, gPhase = 0;
    var cycle = 6.6, start = 2.9;
    if (tin >= start) {
      var tt = (tin - start) % cycle;
      if (tt < 1.25) {
        gPhase = tt / 1.25;
        gAlpha = Math.sin(3.1416 * Math.min(1, gPhase)) * 1.05;
      }
    }
    if (built < 0.9) gAlpha = 0;
    var gSweep = wx + (-0.5 * WW + gPhase * 1.95 * WW) * k * gs;
    var gBand = 0.3 * WW * k * gs;

    ctx.globalCompositeOperation = "lighter";
    var maxDim = Math.max(W, H);
    hover += (hoverT - hover) * 0.11;
    var drift = b > 0.5 ? clamp((b - 0.5) / 0.5, 0, 1) * 0.1 : 0;
    if (pmInit) { pmx += (hmx - pmx) * 0.1; pmy += (hmy - pmy) * 0.1; }
    var n = shards.length;
    if (sol < 0.99) for (var i = 0; i < n; i++) {
      var s = shards[i];
      var app = clamp((tin - s.delay) / s.dur, 0, 1);
      var e = app >= 1 ? 1 : 1 - Math.pow(2, -9 * app);
      var px = wx + s.cx * k * gs;
      var py = wy + s.cy * k * gs;
      if (hover > 0.02 && built > 0.9 && b < 0.05) {
        px += ((pmx - W * 0.5) / W) * 16 * s.depth * hover;
        py += ((pmy - H * 0.47) / H) * 11 * s.depth * hover;
        /* 鼠标排斥：靠近光标的碎片被轻轻推开，形成“拨开碎镜”的手感 */
        var rdx = px - pmx, rdy = py - pmy;
        var rd2 = rdx * rdx + rdy * rdy;
        if (rd2 < 28900 && rd2 > 0.01) {
          var rd = Math.sqrt(rd2);
          var rf = 1 - rd / 170;
          px += (rdx / rd) * rf * rf * 54 * hover;
          py += (rdy / rd) * rf * rf * 54 * hover;
        }
      }
      var rot = (1 - e) * s.rot0;
      var scl = k * gs * (1 + (1 - e) * (s.sc0 - 1));

      px += (1 - e) * Math.cos(s.ang) * s.r * maxDim;
      py += (1 - e) * Math.sin(s.ang) * s.r * maxDim;

      var fm = clamp((b - 0.05) / 0.5, 0, 1);
      var f = fm * fm * (3 - 2 * fm);
      var d = (f * s.dist + drift) * maxDim;
      px += Math.cos(s.sdir) * d;
      py += Math.sin(s.sdir) * d;
      rot += f * s.spin;
      s.exitX = clamp(px, -W * 0.15, W * 1.15);
      s.exitY = clamp(py, -H * 0.15, H * 1.15);
      scl *= 1 - 0.42 * f;
      if (b > 0 && b < 0.05) scl *= 1 + 0.06 * (1 - b / 0.05);
      if (b < 0.14) scl *= 1 + 0.16 * (1 - b / 0.14);

      var alpha = (0.32 + 0.68 * e) * (1 - clamp((b - 0.42) / 0.38, 0, 1)) * (1 - 0.25 * clamp(b, 0, 1));
      alpha *= 1 - sol;
      if (alpha < 0.01) continue;

      var ov = 1 + 0.006 * e;
      var fa = clamp((1 - e) * 0.8 + b * 0.35, 0, 0.55) * (1 - clamp((b - 0.16) / 0.46, 0, 1));
      var stx = 1 + 1.15 * f * (1 - 0.55 * f);
      var sty = 1 - 0.2 * f;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(s.sdir);
      ctx.scale(stx, sty);
      ctx.rotate(-s.sdir + rot);
      if (fa > 0.01) {
        ctx.globalAlpha = fa;
        ctx.drawImage(s.f, -s.w * scl / 2, -s.h * scl / 2, s.w * scl, s.h * scl);
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(s.c, -s.w * scl * ov / 2, -s.h * scl * ov / 2, s.w * scl * ov, s.h * scl * ov);
      if (hover > 0.02 && built > 0.9 && b < 0.04) {
        var hdx = px - pmx, hdy = py - pmy;
        var hb = Math.exp(-(hdx * hdx + hdy * hdy) / 16000) * hover * 0.66;
        if (hb > 0.02) {
          ctx.globalAlpha = Math.min(1, hb);
          ctx.drawImage(s.c, -s.w * scl * ov / 2, -s.h * scl * ov / 2, s.w * scl * ov, s.h * scl * ov);
        }
      }
      if (gAlpha > 0.02) {
        var gd = (px - gSweep) / gBand;
        var gb = Math.exp(-gd * gd) * gAlpha * 0.85;
        if (gb > 0.02) {
          ctx.globalAlpha = Math.min(1, gb);
          ctx.drawImage(s.c, -s.w * scl * ov / 2, -s.h * scl * ov / 2, s.w * scl * ov, s.h * scl * ov);
        }
      }
      ctx.restore();

      if (b > 0.02 && b < 0.5 && i % 11 === 3) {
        var gl = Math.pow(Math.sin(tin * 9.1 + i * 2.3), 2) * (1 - b / 0.5);
        if (gl > 0.05) {
          var sl = (5 + 9 * gl) * (0.5 + 0.5 * f);
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = gl * 0.9;
          ctx.strokeStyle = "rgba(255,255,255,1)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(px - sl, py); ctx.lineTo(px + sl, py);
          ctx.moveTo(px, py - sl); ctx.lineTo(px, py + sl);
          ctx.stroke();
          ctx.globalAlpha = gl;
          ctx.fillStyle = "rgba(255,255,255,1)";
          ctx.beginPath();
          ctx.arc(px, py, 1.1, 0, 6.2832);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
      }

      var ea = clamp((b - 0.6) / 0.36, 0, 1);
      if (ea > 0.01) {
        var ex = wx + s.cx * k * gs + Math.cos(s.sdir) * (f * s.dist + drift) * maxDim;
        var ey = wy + s.cy * k * gs + Math.sin(s.sdir) * (f * s.dist + drift) * maxDim;
        ctx.globalAlpha = ea * (0.6 + 0.4 * Math.sin(tin * 1.6 + i)) * 0.9;
        ctx.fillStyle = "rgba(216,234,255,1)";
        ctx.beginPath();
        ctx.arc(ex, ey, 1.5, 0, 6.2832);
        ctx.fill();
      }
    }
    if (sol > 0.01) {
      ctx.globalCompositeOperation = "source-over";
      var wordW = WW * k * gs, wordH = WH * k * gs;
      var inWord = pmx > wx - 40 && pmx < wx + wordW + 40 && pmy > wy - 40 && pmy < wy + wordH + 40;
      var lensOn = hover > 0.02 && built > 0.9 && b < 0.05 && pmInit && inWord;
      var lensR = 40 + 22 * hover;
      if (lensOn) {
        if (!lensSeed.length || now - lensAt > 1400) { buildLensSeed(); lensAt = now; }
        /* 鼠标罩住的那一小块（不规则碎片形）：实心字挖空，换成被拨开的碎片 */
        ctx.save();
        ctx.globalAlpha = sol;
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        lensTrace(ctx, pmx, pmy, lensR, tin);
        ctx.clip("evenodd");
        ctx.drawImage(word, wx, wy, wordW, wordH);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        lensTrace(ctx, pmx, pmy, lensR, tin);
        ctx.clip();
        /* 与炸开阶段同源的镜片碎片（更细一步网格），在透镜内被鼠标拨开 */
        var sc = k * gs;
        for (var li = 0; li < lensShards.length; li++) {
          var ls = lensShards[li];
          var lpx = wx + ls.cx * sc, lpy = wy + ls.cy * sc;
          var ldx = lpx - pmx, ldy = lpy - pmy;
          var ld = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
          if (ld > lensR * 1.35) continue;
          var lf = clamp(1 - ld / (lensR * 1.35), 0, 1);
          lpx += (ldx / ld) * lf * lf * 30;
          lpy += (ldy / ld) * lf * lf * 30;
          ctx.save();
          ctx.translate(lpx, lpy);
          ctx.rotate(lf * ls.spin * 0.3);
          ctx.globalAlpha = sol * (0.65 + 0.35 * lf);
          ctx.drawImage(ls.c, -ls.w * sc / 2, -ls.h * sc / 2, ls.w * sc, ls.h * sc);
          if (lf > 0.3) {
            ctx.globalAlpha = sol * lf * 0.25;
            ctx.drawImage(ls.f, -ls.w * sc / 2, -ls.h * sc / 2, ls.w * sc, ls.h * sc);
          }
          ctx.restore();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = sol;
        ctx.drawImage(word, wx, wy, wordW, wordH);
        ctx.globalAlpha = 1;
      }
    }
    if (burstOn) {
      ctx.globalCompositeOperation = "lighter";
      var bt2 = b * burstDur / 1000;
      var halfW = WW * k * gs * 0.5, halfH = WH * k * gs * 0.5;
      for (var sk2 = 0; sk2 < sparks.length; sk2++) {
        var sk3 = sparks[sk2];
        var u3 = bt2 / sk3.life;
        if (u3 >= 1) continue;
        if (sk3.dot) {
          var qd = 1 - Math.pow(1 - u3, 1.8);
          var cad = Math.cos(sk3.a), sad = Math.sin(sk3.a) * 0.6;
          var exd = burstCx + cad * (halfW * sk3.r0 + sk3.sp * maxDim * qd);
          var eyd = burstCy + sad * (halfH * sk3.r0 + sk3.sp * maxDim * qd);
          var ad = Math.pow(1 - u3, 1.7) * (1 - clamp((b - 0.5) / 0.5, 0, 1));
          var dr = sk3.sz * 4.2;
          ctx.globalAlpha = ad * 0.95;
          ctx.drawImage(sk3.warm ? dotWarm : dotCold, exd - dr, eyd - dr, dr * 2, dr * 2);
          continue;
        }
        var q3 = 1 - Math.pow(1 - u3, 2.4);
        var ca3 = Math.cos(sk3.a), sa3 = Math.sin(sk3.a) * 0.56;
        var ex3 = burstCx + ca3 * (halfW * sk3.r0 + sk3.sp * maxDim * q3);
        var ey3 = burstCy + sa3 * (halfH * sk3.r0 + sk3.sp * maxDim * q3);
        var ln3 = (10 + sk3.sp * 32) * (0.3 + 0.7 * u3) * (1 - u3);
        ctx.globalAlpha = Math.pow(1 - u3, 1.5) * 0.92;
        ctx.strokeStyle = sk3.warm ? "rgba(255,228,196,1)" : "rgba(222,240,255,1)";
        ctx.lineWidth = sk3.sz * (1 - u3) + 0.35;
        ctx.beginPath();
        ctx.moveTo(ex3 - ca3 * ln3, ey3 - sa3 * ln3);
        ctx.lineTo(ex3, ey3);
        ctx.stroke();
        ctx.globalAlpha = Math.pow(1 - u3, 2) * 0.92;
        ctx.fillStyle = sk3.warm ? "rgba(255,240,214,1)" : "rgba(240,250,255,1)";
        ctx.beginPath();
        ctx.arc(ex3, ey3, sk3.sz * 0.85 + 0.3, 0, 6.2832);
        ctx.fill();
      }
      if (flash) {
        var fp = clamp(b / 0.32, 0, 1);
        var fr = maxDim * (0.16 + fp * 1.0);
        ctx.globalAlpha = 0.7 * Math.pow(1 - fp, 2.6);
        ctx.drawImage(flash, burstCx - fr, burstCy - fr * 0.6, fr * 2, fr * 0.6 * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (burstOn && b < 0.12) {
      var fl = 1 - b / 0.12;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.3 * fl * fl;
      var fw = WW * k * gs * 1.06, fh = WH * k * gs * 1.06;
      ctx.drawImage(glow, wx - (fw - WW * k * gs) / 2, wy - (fh - WH * k * gs) / 2, fw, fh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawGlint(gPhase, gAlpha * Math.max(0, 1 - b * 2.6), wx, wy, k * gs);

    ctx.globalCompositeOperation = "lighter";
    for (var d2 = 0; d2 < dust.length; d2++) {
      var du = dust[d2];
      if (!reduce.matches) {
        du.x += du.vx + Math.sin(tin * 0.35 + du.ph) * 0.05;
        du.y += du.vy + Math.cos(tin * 0.28 + du.ph) * 0.04;
        if (du.x < -8) du.x = W + 6; else if (du.x > W + 8) du.x = -6;
        if (du.y < -8) du.y = H + 6; else if (du.y > H + 8) du.y = -6;
      }
      var da = du.a * (0.55 + 0.45 * Math.sin(tin * du.sp * 2.4 + du.ph));
      var ddx = du.x, ddy = du.y, dnear = 0;
      if (hover > 0.02 && pmInit) {
        var mdx = du.x - pmx, mdy = du.y - pmy;
        var md = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
        if (md < 175) {
          var mf = 1 - md / 175;
          dnear = mf;
          ddx += (mdx / md) * mf * mf * 30 + (-mdy / md) * mf * 9 + (hmx - pmx) * mf * 0.6;
          ddy += (mdy / md) * mf * mf * 30 + (mdx / md) * mf * 9 + (hmy - pmy) * mf * 0.6;
          da += mf * 0.55 * hover;
        }
      }
      ctx.globalAlpha = clamp(da, 0, 0.95);
      ctx.fillStyle = du.warm ? "rgba(255,226,196,1)" : "rgba(214,232,255,1)";
      ctx.beginPath();
      ctx.arc(ddx, ddy, du.r + dnear * 0.8, 0, 6.2832);
      ctx.fill();
      if (du.spark) {
        var dsl = du.r * (2.4 + dnear * 5);
        ctx.globalAlpha = clamp(da * 0.6, 0, 0.85);
        ctx.strokeStyle = du.warm ? "rgba(255,226,196,1)" : "rgba(214,232,255,1)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(ddx - dsl, ddy); ctx.lineTo(ddx + dsl, ddy);
        ctx.moveTo(ddx, ddy - dsl); ctx.lineTo(ddx, ddy + dsl);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    raf = 0;
    if (document.hidden || !root.classList.contains("mirror-opening-active")) return;
    if (!burstOn && now - t0 >= 4150) leaveOpening(now, false);

    var elapsed = now - burstAt;
    if (!burstOn || elapsed < handoffDelay + 420) draw(now);
    if (burstOn && elapsed >= handoffDelay) {
      var progress = clamp((elapsed - handoffDelay) / assemblyDuration, 0, 1);
      root.classList.add("mirror-opening-handoff");
      drawAssembly(progress);
      if (progress >= 0.89) root.classList.add("mirror-opening-settled");
      if (progress === 1) {
        releaseOpening(focusIntro);
        return;
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function kick() {
    if (!raf && !document.hidden && root.classList.contains("mirror-opening-active"))
      raf = requestAnimationFrame(loop);
  }

  window.addEventListener("mirror-opening-timeout", function () { releaseOpening(false); }, { once: true });
  buildWord();
  buildFX();
  buildShards(38, shards);
  buildShards(16, lensShards);
  resize();
  t0 = performance.now();
  underlay.forEach(function (el) { el.inert = true; });
  draw(t0);
  kick();

  enter.addEventListener("click", function (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    leaveOpening(performance.now(), true);
  });
  hero.addEventListener("wheel", function () { leaveOpening(performance.now(), false); }, { passive: true });
  window.addEventListener("resize", function () {
    if (root.classList.contains("mirror-opening-active")) resize();
  });
  window.addEventListener("hashchange", function () { releaseOpening(false); });
  window.addEventListener("scroll", function () {
    if (window.scrollY > 8) releaseOpening(false);
  }, { passive: true });
  document.addEventListener("visibilitychange", kick);
  reduce.addEventListener?.("change", function () {
    if (reduce.matches) releaseOpening(false);
  });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted || window.scrollY > 8) releaseOpening(false);
  });
})();
