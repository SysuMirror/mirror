/* 沕鉴 Mirror 首页增强：黑色星空 + 碎片光标 + 漂浮小 Mirror。
 * 原生 canvas，无第三方库；尊重 prefers-reduced-motion，触屏不启用自定义光标。
 *
 * 1) 碎片光标：一枚镜片碎片 + 两枚小碎片，随移动方向倾斜；悬停可交互元素时炸成三片，
 *    按下收拢，首屏碎镜区缓慢自旋。原创造型，不是圆环/取景框。
 * 2) 星空版块：白底版块翻成黑色星空（CSS 变量重定义），canvas 铺星点 + 流星，
 *    星点随鼠标排斥、随滚动视差。
 * 3) 漂浮小 Mirror：首屏炸开的碎片在星空里漂成一个个小 “Mirror” 字，由碎片拼成，
 *    鼠标靠近会把碎片拨开、移开后弹回重组；进入视口时从四散状态汇聚成形。
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var DPR_CAP = 1.5;

  var mouse = { x: -9999, y: -9999, vx: 0, vy: 0, inside: false };
  var scrollVel = 0, lastScrollY = window.pageYOffset, lastScrollT = performance.now();

  window.addEventListener("pointermove", function (e) {
    var nx = e.clientX, ny = e.clientY;
    if (mouse.inside) {
      mouse.vx = mouse.vx * 0.7 + (nx - mouse.x) * 0.3;
      mouse.vy = mouse.vy * 0.7 + (ny - mouse.y) * 0.3;
    }
    mouse.x = nx; mouse.y = ny; mouse.inside = true;
  }, { passive: true });
  document.addEventListener("mouseleave", function () { mouse.inside = false; });
  window.addEventListener("scroll", function () {
    var now = performance.now();
    var dt = Math.max(16, now - lastScrollT);
    var dy = window.pageYOffset - lastScrollY;
    scrollVel = scrollVel * 0.7 + (dy / dt) * 16 * 0.3;
    lastScrollY = window.pageYOffset; lastScrollT = now;
  }, { passive: true });

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------------------------------------------------------- 碎片光标 */
  function initCursor() {
    if (!finePointer || reduce) return;
    document.documentElement.classList.add("hm-fx-cursor-on");

    var cur = document.createElement("div");
    cur.className = "hm-fx-cursor";
    cur.innerHTML = '<div class="hm-fx-shard s1"></div><div class="hm-fx-shard s2"></div><div class="hm-fx-shard s0"></div>';
    document.body.appendChild(cur);

    var x = innerWidth / 2, y = innerHeight / 2, px = x, py = y, angle = 0, shown = false;

    function classify(target) {
      if (!target || !target.closest) return;
      var active = !!target.closest("a, button, [data-jump], [data-top], .hm-apps__item, .hm-service-row, .hm-rise__card, .hm-eco__nav button, .hm-gallery__dots i, .hm-about__link, input, select, textarea");
      var hero = !!target.closest(".hm-hero");
      cur.classList.toggle("is-active", active);
      cur.classList.toggle("is-hero", hero);
    }
    window.addEventListener("pointermove", function (e) {
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; px = x; py = y; cur.style.opacity = "1"; }
      classify(e.target);
    }, { passive: true });
    window.addEventListener("pointerdown", function () { cur.classList.add("is-down"); });
    window.addEventListener("pointerup", function () { cur.classList.remove("is-down"); });
    document.addEventListener("mouseleave", function () { shown = false; cur.style.opacity = "0"; });

    function loop() {
      var dx = x - px, dy = y - py;
      px = x; py = y;
      var speed = Math.sqrt(dx * dx + dy * dy);
      if (speed > 0.6) {
        var target = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        var diff = ((target - angle + 540) % 360) - 180;
        angle += diff * 0.18;
      }
      cur.style.setProperty("--a", angle.toFixed(1) + "deg");
      cur.style.transform = "translate3d(" + x + "px," + y + "px,0)";
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- 小 Mirror 碎片模板 */
  var WORD_TEMPLATE = null;
  function buildTemplate() {
    if (WORD_TEMPLATE) return WORD_TEMPLATE;
    var fontSize = 60, step = 7;
    var c = document.createElement("canvas");
    var g = c.getContext("2d");
    if (!g) return null;
    var font = "600 " + fontSize + 'px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    g.font = font;
    var text = "Mirror";
    var w = Math.ceil(g.measureText(text).width) + fontSize * 0.3;
    var h = Math.ceil(fontSize * 1.5);
    c.width = w; c.height = h;
    g.font = font; g.textBaseline = "middle"; g.fillStyle = "#fff";
    g.fillText(text, fontSize * 0.15, h / 2);
    var data;
    try { data = g.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    var shards = [];
    for (var yy = 0; yy < h; yy += step) {
      for (var xx = 0; xx < w; xx += step) {
        if (data[(yy * w + xx) * 4 + 3] > 120) {
          shards.push({
            hx: xx - w / 2, hy: yy - h / 2,
            s: step * rnd(0.62, 1.0),
            ang: rnd(0, Math.PI),
            spin: rnd(-0.4, 0.4),
            tone: rnd(0.55, 1)
          });
        }
      }
    }
    if (shards.length > 150) { // 控制密度
      shards = shards.filter(function (_, i) { return i % Math.ceil(shards.length / 150) === 0; });
    }
    WORD_TEMPLATE = { shards: shards, w: w, h: h };
    return WORD_TEMPLATE;
  }

  function makeMiniMirror(W, H, tpl, sideX) {
    var scale = rnd(0.62, 0.95);
    var half = tpl.w * scale / 2;
    var cx = clamp(W * sideX, half + 12, W - half - 12);
    var cy = rnd(H * 0.28, H * 0.72);
    var shards = tpl.shards.map(function (s) {
      return {
        hx: s.hx, hy: s.hy, s: s.s, ang: s.ang, spin: s.spin, tone: s.tone,
        ox: rnd(-160, 160), oy: rnd(-120, 120), vx: 0, vy: 0
      };
    });
    return {
      cx: cx, cy: cy, scale: scale,
      vx: rnd(-0.12, 0.12), vy: rnd(-0.08, 0.08),
      rot: rnd(-0.05, 0.05), vrot: rnd(-0.0006, 0.0006),
      shards: shards, born: performance.now()
    };
  }

  /* ---------------------------------------------------------------- 星空 + 小 Mirror 场 */
  function createStarfield(host, opts) {
    opts = opts || {};
    var withMirrors = opts.mirrors !== false;
    var canvas = document.createElement("canvas");
    canvas.className = "hm-fx-field";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var W = 0, H = 0, dpr = 1;
    var stars = [], meteors = [], mirrors = [];
    var inView = false, raf = 0, booted = false;
    var tpl = withMirrors ? buildTemplate() : null;

    function resize() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      if (W * H * dpr * dpr > 2800000) dpr = Math.sqrt(2800000 / (W * H));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      seed();
      if (reduce && booted) draw(performance.now());
    }

    function seed() {
      var n = clamp(Math.round(W * H / 2400), 160, 760);
      stars = [];
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: rnd(0.35, 1.7), a: rnd(0.22, 0.95),
          ph: rnd(0, 6.2832), tw: rnd(0.4, 1.9),
          depth: rnd(0.25, 1.3), warm: Math.random() < 0.14,
          spark: Math.random() < 0.10
        });
      }
      mirrors = [];
      if (tpl) {
        var count = W < 720 ? 1 : 2;
        var margin = Math.max(90, (W - 1320) / 2);
        for (var m = 0; m < count; m++) {
          var sideX = count === 2 ? (m === 0 ? margin * 0.5 / W : 1 - margin * 0.5 / W) : 1 - margin * 0.5 / W;
          mirrors.push(makeMiniMirror(W, H, tpl, sideX));
        }
      }
    }

    function localMouse() {
      if (!mouse.inside) return null;
      var r = host.getBoundingClientRect();
      var mx = mouse.x - r.left, my = mouse.y - r.top;
      if (mx < -100 || my < -100 || mx > r.width + 100 || my > r.height + 100) return null;
      return { x: mx, y: my };
    }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var m = localMouse();
      var vel = clamp(scrollVel, -3.5, 3.5);
      var i, s;

      /* 星点 */
      for (i = 0; i < stars.length; i++) {
        s = stars[i];
        if (!reduce) {
          s.y -= vel * 0.05 * s.depth;
          s.x += Math.sin(t * 0.00012 + s.ph) * 0.03;
          if (m) {
            var dx = s.x - m.x, dy = s.y - m.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d < 175) {
              var f = 1 - d / 175;
              s.x += (dx / d) * f * f * 2.1;
              s.y += (dy / d) * f * f * 2.1;
              /* 切向旋涡 + 跟随鼠标移动方向拖曳 */
              s.x += (-dy / d) * f * 0.7 + (mouse.vx || 0) * f * 0.10;
              s.y += (dx / d) * f * 0.7 + (mouse.vy || 0) * f * 0.10;
            }
          }
          if (s.y < -6) s.y = H + 4; else if (s.y > H + 6) s.y = -4;
          if (s.x < -6) s.x = W + 4; else if (s.x > W + 6) s.x = -4;
        }
        var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph);
        var a = s.a * tw;
        var near = 0;
        if (m) {
          var gx = s.x - m.x, gy = s.y - m.y;
          var gd = Math.sqrt(gx * gx + gy * gy);
          if (gd < 175) { near = 1 - gd / 175; a += near * 0.65; }
        }
        ctx.fillStyle = s.warm ? "rgba(255,226,196," + clamp(a, 0, 1).toFixed(3) + ")"
          : "rgba(214,232,255," + clamp(a, 0, 1).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r + near * 0.7, 0, 6.2832); ctx.fill();
        if (s.spark) {
          var sl = s.r * (2.2 + near * 4.5);
          ctx.strokeStyle = s.warm ? "rgba(255,226,196," + clamp(a * 0.55, 0, 0.8).toFixed(3) + ")"
            : "rgba(214,232,255," + clamp(a * 0.55, 0, 0.8).toFixed(3) + ")";
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(s.x - sl, s.y); ctx.lineTo(s.x + sl, s.y);
          ctx.moveTo(s.x, s.y - sl); ctx.lineTo(s.x, s.y + sl);
          ctx.stroke();
        }
      }

      /* 流星：快速滚动时划过 */
      if (!reduce && ((Math.abs(vel) > 1.2 && Math.random() < 0.16) || Math.random() < 0.012) && meteors.length < 5) {
        meteors.push({ x: rnd(0, W), y: rnd(-20, H * 0.3), vx: rnd(-2.4, -1.2), vy: rnd(1.4, 2.6), life: rnd(500, 900), born: t });
      }
      for (i = meteors.length - 1; i >= 0; i--) {
        var mt = meteors[i];
        var u = (t - mt.born) / mt.life;
        if (u >= 1) { meteors.splice(i, 1); continue; }
        mt.x += mt.vx; mt.y += mt.vy;
        var ma = (1 - u) * 0.7;
        ctx.strokeStyle = "rgba(214,232,255," + ma.toFixed(3) + ")";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(mt.x, mt.y);
        ctx.lineTo(mt.x - mt.vx * 7, mt.y - mt.vy * 7);
        ctx.stroke();
      }

      /* 漂浮小 Mirror（碎片拼字，可鼠标拨玩） */
      if (tpl) {
        for (i = 0; i < mirrors.length; i++) {
          var mm = mirrors[i];
          if (!reduce) {
            mm.cx += mm.vx; mm.cy += mm.vy; mm.rot += mm.vrot;
            var pad = 60;
            if (mm.cx < pad || mm.cx > W - pad) mm.vx *= -1;
            if (mm.cy < pad || mm.cy > H - pad) mm.vy *= -1;
            mm.cx = clamp(mm.cx, pad, W - pad);
            mm.cy = clamp(mm.cy, pad, H - pad);
          }
          var cos = Math.cos(mm.rot), sin = Math.sin(mm.rot);
          for (var j = 0; j < mm.shards.length; j++) {
            s = mm.shards[j];
            if (!reduce) {
              /* 弹回_home：碎片被拨开后重组 */
              s.vx += -s.ox * 0.018;
              s.vy += -s.oy * 0.018;
              s.vx *= 0.9; s.vy *= 0.9;
              var wx = mm.cx + (s.hx * cos - s.hy * sin) * mm.scale + s.ox;
              var wy = mm.cy + (s.hx * sin + s.hy * cos) * mm.scale + s.oy;
              if (m) {
                var mdx = wx - m.x, mdy = wy - m.y;
                var md = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
                if (md < 110) {
                  var mf = 1 - md / 110;
                  s.vx += (mdx / md) * mf * mf * 2.6;
                  s.vy += (mdy / md) * mf * mf * 2.6;
                }
              }
              s.ox += s.vx; s.oy += s.vy;
              s.ang += s.spin * 0.02;
            }
            var px = mm.cx + (s.hx * cos - s.hy * sin) * mm.scale + s.ox;
            var py = mm.cy + (s.hx * sin + s.hy * cos) * mm.scale + s.oy;
            var size = s.s * mm.scale;
            var alpha = 0.82 * s.tone;
            var glow = 0;
            if (m) {
              var gdx = px - m.x, gdy = py - m.y;
              var gd2 = Math.sqrt(gdx * gdx + gdy * gdy);
              if (gd2 < 150) { glow = 1 - gd2 / 150; alpha += glow * 0.5; }
            }
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(s.ang + mm.rot);
            ctx.fillStyle = "rgba(" + (glow > 0.3 ? "247,251,255" : "162,182,207") + "," + clamp(alpha, 0, 0.95).toFixed(3) + ")";
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.6);
            ctx.lineTo(size * 0.5, -size * 0.1);
            ctx.lineTo(size * 0.32, size * 0.55);
            ctx.lineTo(-size * 0.42, size * 0.4);
            ctx.lineTo(-size * 0.5, -size * 0.2);
            ctx.closePath();
            ctx.fill();
            if (glow > 0.25) {
              ctx.strokeStyle = "rgba(214,232,255," + (glow * 0.7).toFixed(3) + ")";
              ctx.lineWidth = 0.6;
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }
    }

    function loop(t) {
      raf = 0;
      if (!inView || document.hidden) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && inView && !document.hidden && !reduce) raf = requestAnimationFrame(loop); }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var e = entries[0], was = inView;
        inView = e.isIntersecting;
        if (inView && !was) {
          /* 进入视口：碎片四散后汇聚成小 Mirror */
          if (!reduce) mirrors.forEach(function (mm) {
            mm.shards.forEach(function (s) { s.ox = rnd(-180, 180); s.oy = rnd(-140, 140); s.vx = 0; s.vy = 0; });
          });
          kick();
        }
        if (!inView && raf) { cancelAnimationFrame(raf); raf = 0; }
      }, { threshold: 0.04 }).observe(host);
    } else { inView = true; }

    var rt = 0;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 140); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });

    resize();
    booted = true;
    if (reduce) draw(0); else kick();
  }

  /* ---------------------------------------------------------------- 挂载 */
  function init() {
    try { initCursor(); } catch (e) { report(e, "cursor"); }
    var sections = ["#hm-eco", ".hm-pitch", "#hm-rise", "#hm-apps", "#hm-foundation", "#hm-services"];
    sections.forEach(function (sel) {
      var host = document.querySelector(sel);
      if (!host) return;
      host.classList.add("hm-star", "hm-fx-host");
      try { createStarfield(host, { mirrors: true }); } catch (e) { report(e, "field:" + sel); }
    });
    var slogan = document.querySelector(".hm-slogan");
    if (slogan) {
      slogan.classList.add("hm-fx-host");
      try { createStarfield(slogan, { mirrors: false }); } catch (e) { report(e, "field:slogan"); }
    }
    window.__mirrorFxLoaded = true;
  }
  function report(e, where) {
    try {
      if (window.__mirrorDebug) window.__mirrorDebug.errors.push({ msg: "fx:" + where + ": " + (e && e.message), stack: e && e.stack });
      if (window.__mirrorDebugSend) window.__mirrorDebugSend({ phase: "fx-error", where: where });
    } catch (ignored) {}
    if (window.console) console.error("[mirror-fx]", where, e);
  }

  if (window.console) console.info("[mirror] landing-fx v3 (side mirrors, no cursor halo)");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();