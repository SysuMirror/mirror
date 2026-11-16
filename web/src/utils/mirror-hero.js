/**
 * 沕鉴·Mirror 首屏字效 / 粒子引擎（来源：用户提供的首屏 hero 合并片段）。
 * 只做三处工程化改动：IIFE → ES module、去掉自动挂载、改由 Vue 生命周期
 * 调用 mount()/destroy()。WebGL 与 2D 降级逻辑保持原样，不在此文件里加业务代码。
 * 容器必须有确定高度；卸载时务必调用返回实例的 destroy()。
 */
var VS = [
  'attribute vec2 aPos;',
  'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
].join('\n');

var FS = [
  'precision highp float;',
  'uniform sampler2D uTex;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform float uImgAspect;',
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
  'void main(){',
  '  vec2 uv = gl_FragCoord.xy / uRes;',
  '  float t = uTime + 0.85 * sin(uTime * 0.40);'   /* 时间做非线性伸缩：偶尔慢下来、停一拍再涌 */,
  '  vec2 c = vec2(0.44, 0.52);',
  '  vec2 d = uv - c;',
  '  float r = length(d);',
  '  float ang = atan(d.y, d.x);',
  '',
  '  /* 光束整体缓慢旋涌：越靠近亮结转得越多 */',
  '  float swirl = 0.095 * sin(t * 0.5 + r * 6.0) * smoothstep(0.78, 0.10, r);',
  '  float a2 = ang + swirl;',
  '  vec2 duv = c + vec2(cos(a2), sin(a2)) * r;',
  '',
  '  /* 细密起伏，让每条纤维像在呼吸 */',
  '  duv += vec2(0.0016, 0.0011) * sin(duv.y * 42.0 + duv.x * 14.0 + uTime * 1.35 * 1.0);',
  '',
  '  float A = uImgAspect;',
  '  float S = uRes.x / uRes.y;',
  '  vec2 st = duv;',
  '  if (S > A) { st.y = 0.5 + (duv.y - 0.5) * (A / S); }',
  '  else { st.x = 0.5 + (duv.x - 0.5) * (S / A); }',
  '',
  '  vec3 colWarp = texture2D(uTex, st).rgb;',
  '  float Lw = dot(colWarp, vec3(0.2126, 0.7152, 0.0722));',
  '',
  '  /* 亮度沿光束快速流过 */',
  '  float ph = (duv.x * 9.0 + duv.y * 4.2) * 3.14159 - t * 3.2;',
  '  float w = 0.5 + 0.5 * sin(ph);',
  '  colWarp += colWarp * pow(w, 2.6) * 0.55;',
  '',
  '  float ph2 = (duv.x * 4.0 + duv.y * 2.0) * 3.14159 - t * 1.15 + 2.1;',
  '  float w2 = 0.5 + 0.5 * sin(ph2);',
  '  colWarp += colWarp * pow(w2, 4.0) * 0.42;',
  '',
  '  /* 纤维内部的细密闪点 */',
  '  vec2 g = floor(gl_FragCoord.xy / 2.0);',
  '  float n = hash(g + floor(t * 7.0) * 13.0);',
  '  float tw = step(0.982, n) * pow(Lw, 2.2);',
  '  colWarp += vec3(0.92, 0.97, 1.0) * tw * 1.15;',
  '',
  '  /* 静止的底图：星空不该跟着银河一起晃 */',
  '  vec2 stBase = uv;',
  '  if (S > A) { stBase.y = 0.5 + (uv.y - 0.5) * (A / S); }',
  '  else { stBase.x = 0.5 + (uv.x - 0.5) * (S / A); }',
  '  vec3 colBase = texture2D(uTex, stBase).rgb;',
  '  float Lb = dot(colBase, vec3(0.2126, 0.7152, 0.0722));',
  '',
  '  /* 只在银河范围内应用涌动，暗空保持原样 */',
  '  float wg = smoothstep(0.09, 0.42, Lb);',
  '  vec3 col = mix(colBase, colWarp, wg);',
  '',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function mount(root, opts) {
  if (!root || root.__fmMounted) return null;
  var glCanvas = root.querySelector('.fm-hero__gl');
  var fxCanvas = root.querySelector('.fm-hero__fx');
  var src = root.querySelector('.fm-hero__src');
  if (!glCanvas || !fxCanvas || !src) return null;

  opts = opts || {};
  var SPEED = Math.min(2.4, Math.max(0.35, +opts.speed || 1));
  var DENSITY = Math.min(2, Math.max(0.3, +opts.density || 1));

  var W = 0, H = 0, DPR = 1, small = false;
  var rafId = 0, running = false, last = 0, clock = 0;
  var reduced = false, offscreen = false;
  var gl = null, prog = null, tex = null, uRes = null, uTime = null, uAspect = null;
  var boost = 1, boostTarget = 1;
  var fx = fxCanvas.getContext('2d');
  var imgW = 0, imgH = 0;

  var lum = null, dirX = null, dirY = null, FW = 0, FH = 0, seeds = [], parts = [], stars = [];
  var titleBox = null, dust = [], dustAcc = 0;
  var typeCanvas = root.querySelector('.fm-hero__type');
  var tc = typeCanvas ? typeCanvas.getContext('2d') : null;
  var typeOff = null, typeGlow = null, typeTex = null, typeW = 0, typeH = 0, typePad = 0;

  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------------- WebGL ---------------- */
  function initGL() {
    gl = glCanvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) return false;

    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VS);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return false;

    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, FS);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uRes = gl.getUniformLocation(prog, 'uRes');
    uTime = gl.getUniformLocation(prog, 'uTime');
    uAspect = gl.getUniformLocation(prog, 'uImgAspect');

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return true;
  }

  function drawGL(time) {
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    gl.uniform2f(uRes, glCanvas.width, glCanvas.height);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uAspect, imgW / imgH);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /* ---------------- 2D 粒子层 ---------------- */
  function buildField() {
    var fw = small ? 150 : 240;
    var fh = Math.max(2, Math.round(fw * (H / W)));
    var off = document.createElement('canvas');
    off.width = fw; off.height = fh;
    var octx = off.getContext('2d');

    var scale = Math.max(W / imgW, H / imgH);
    var sw = W / scale, sh = H / scale;
    var sx = (imgW - sw) / 2, sy = (imgH - sh) / 2;

    var ok = true, data;
    try {
      octx.drawImage(src, sx, sy, sw, sh, 0, 0, fw, fh);
      data = octx.getImageData(0, 0, fw, fh).data;
    } catch (e) { ok = false; }

    FW = fw; FH = fh;
    lum = new Float32Array(fw * fh);
    dirX = new Float32Array(fw * fh);
    dirY = new Float32Array(fw * fh);

    var i, x, y, idx;
    if (ok) {
      for (i = 0; i < fw * fh; i++) {
        lum[i] = Math.min(1, (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255 * 1.3);
      }
    } else {
      for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
        var u = x / fw, v = y / fh;
        lum[y * fw + x] = Math.max(0, 1 - Math.abs(v - (0.72 - u * 0.42)) * 5);
      }
    }

    for (y = 0; y < fh; y++) for (x = 0; x < fw; x++) {
      idx = y * fw + x;
      var xm = Math.max(0, x - 1), xp = Math.min(fw - 1, x + 1);
      var ym = Math.max(0, y - 1), yp = Math.min(fh - 1, y + 1);
      var gx = lum[y * fw + xp] - lum[y * fw + xm];
      var gy = lum[yp * fw + x] - lum[ym * fw + x];
      var len = Math.hypot(gx, gy);
      if (len < 1e-4) { dirX[idx] = 1; dirY[idx] = 0; }
      else { dirX[idx] = -gy / len; dirY[idx] = gx / len; }
    }

    seeds = [];
    for (y = 1; y < fh - 1; y++) for (x = 1; x < fw - 1; x++) {
      idx = y * fw + x;
      var L = lum[idx];
      if (L > 0.58) seeds.push({ x: (x + Math.random()) / fw * W, y: (y + Math.random()) / fh * H, w: L * L });
    }
    if (!seeds.length) seeds.push({ x: W * 0.45, y: H * 0.5, w: 1 });
  }

  function pickSeed() {
    var total = 0, i;
    for (i = 0; i < seeds.length; i++) total += seeds[i].w;
    var r = Math.random() * total;
    for (i = 0; i < seeds.length; i++) { r -= seeds[i].w; if (r <= 0) return seeds[i]; }
    return seeds[seeds.length - 1];
  }

  function sampleAt(px, py) {
    var x = Math.floor(px / W * FW), y = Math.floor(py / H * FH);
    if (x < 0 || y < 0 || x >= FW || y >= FH) return -1;
    return y * FW + x;
  }

  function buildParts() {
    parts = [];
    var scale = Math.min(1.6, Math.max(0.6, (W * H) / (1600 * 900)));
    var n = Math.round((small ? 160 : 420) * scale * DENSITY);
    for (var i = 0; i < n; i++) {
      var s = pickSeed();
      parts.push({
        x: s.x, y: s.y,
        vx: 0, vy: 0,
        sp: (55 + Math.random() * 110) * (small ? 0.7 : 1) * SPEED,
        r: 0.35 + Math.random() * 0.95,
        a: 0.5 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
        tws: 1.6 + Math.random() * 3,
        life: 0.6 + Math.random() * 1.8,
        age: 0
      });
    }
  }

  /* ---------- 电影字效：把标题画进 canvas，做像素级噪点侵蚀 ---------- */
  function hashN(x, y) {
    var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function buildTitleCanvas() {
    var el = root.querySelector('.fm-hero__title');
    if (!el || !tc) return;
    var spans = [];
    ['cn', 'sep', 'en'].forEach(function (k) {
      var sp = root.querySelector('.fm-hero__' + k);
      if (sp) spans.push(sp);
    });
    if (!spans.length) return;

    var rr = root.getBoundingClientRect(), tr = el.getBoundingClientRect();
    if (tr.width < 8) return;
    titleBox = { x: tr.left - rr.left, y: tr.top - rr.top, w: tr.width, h: tr.height };

    var SC = 2;
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(titleBox.w * SC));
    off.height = Math.max(1, Math.round(titleBox.h * SC));
    var c = off.getContext('2d');
    var baseY = Math.round((titleBox.h * 0.80) * SC);

    var grd = c.createLinearGradient(0, 0, off.width, off.height * 0.25);
    grd.addColorStop(0.00, '#f2fbff');
    grd.addColorStop(0.16, '#cfe9ff');
    grd.addColorStop(0.33, '#86c8ff');
    grd.addColorStop(0.50, '#3f8dff');
    grd.addColorStop(0.64, '#77bcff');
    grd.addColorStop(0.82, '#d9edff');
    grd.addColorStop(1.00, '#ffffff');
    c.fillStyle = grd;

    /* 按顺序自己排版：不依赖 span 的布局位置，避免字体未就绪时错位 */
    var penX = 0, baseline = baseY;
    spans.forEach(function (sp) {
      var cs = window.getComputedStyle(sp);
      var fs = parseFloat(cs.fontSize) * SC;
      c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
      try { c.letterSpacing = (parseFloat(cs.letterSpacing) * SC || 0) + 'px'; } catch (e) {}
      var w = c.measureText(sp.textContent).width;
      c.textBaseline = 'alphabetic';
      c.fillText(sp.textContent, penX, baseline);
      penX += w;
    });

    /* 像素级侵蚀：越靠右、越靠上越碎，靠噪点决定哪些笔画断掉 */
    var img = c.getImageData(0, 0, off.width, off.height);
    var d = img.data, iw = off.width, ih = off.height;
    for (var i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      var px = (i / 4) % iw, py = Math.floor((i / 4) / iw);
      var u = px / iw, v = py / ih;
      var keep = 1
        - 0.78 * Math.max(0, Math.min(1, (u - 0.50) / 0.50))
        - 0.40 * Math.max(0, Math.min(1, (0.20 - v) / 0.20));
      var nz = hashN(px * 0.9, py * 0.9);
      var e = keep * 1.45 - (1 - nz) * 0.70;
      d[i + 3] = Math.max(0, Math.min(255, Math.round(d[i + 3] * Math.max(0, Math.min(1, e)))));
    }
    c.putImageData(img, 0, 0);
    typeOff = off;

    typeTex = img;
    typeW = iw; typeH = ih;

    /* 柔光：把同一张字做两层模糊垫底 */
    var PAD = Math.round(40 * SC);
    var glow = document.createElement('canvas');
    glow.width = off.width + PAD * 2;
    glow.height = off.height + PAD * 2;
    var g2 = glow.getContext('2d');
    g2.shadowColor = 'rgba(96,168,255,.85)';
    g2.shadowBlur = 22 * SC;
    g2.drawImage(off, PAD, PAD);
    g2.shadowColor = 'rgba(150,205,255,.55)';
    g2.shadowBlur = 10 * SC;
    g2.drawImage(off, PAD, PAD);
    typeGlow = glow;
    typePad = PAD;
  }

  /* 星尘：只在有笔画的地方生成，顺右上旋流飘走 */
  function stepDust(dt, time) {
    if (!titleBox || !typeTex) return;
    var i, d, tries;
    dustAcc += dt * (small ? 40 : 78);
    while (dustAcc >= 1) {
      dustAcc--;
      for (tries = 0; tries < 12; tries++) {
        var sx = Math.random(), sy = Math.random();
        if (sx < 0.34 && sy > 0.5) continue;                 /* 权重偏向右侧与上方 */
        var px = Math.floor(sx * typeW), py = Math.floor(sy * typeH);
        if (typeTex.data[(py * typeW + px) * 4 + 3] < 60) continue;
        var bx = titleBox.x + sx * titleBox.w;
        var by = titleBox.y + sy * titleBox.h;
        var ang = -0.58 + (Math.random() - 0.5) * 0.46;
        var spd = 46 + Math.random() * 118;
        dust.push({
          x: bx, y: by,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          r: 0.5 + Math.random() * 1.15,
          life: 1.0 + Math.random() * 2.1, age: 0,
          a: 0.30 + Math.random() * 0.5,
          sw: 0.5 + Math.random() * 1.2,
          ph: Math.random() * 6.28
        });
        break;
      }
    }

    for (i = dust.length - 1; i >= 0; i--) {
      d = dust[i];
      d.age += dt;
      if (d.age >= d.life) { dust.splice(i, 1); continue; }
      d.vy -= d.sw * dt * 28;
      d.vx += Math.sin(time * 1.5 + d.ph) * dt * 16;
      d.x += d.vx * dt; d.y += d.vy * dt;

      var k = d.age / d.life;
      var al = d.a * (k < 0.16 ? k / 0.16 : Math.pow(1 - (k - 0.16) / 0.84, 1.5));
      var sz = d.r * 5.4 * (1 + k * 0.7);
      tc.globalAlpha = al;
      tc.drawImage(dotSprite, d.x - sz * 0.5, d.y - sz * 0.5, sz, sz);
    }
    tc.globalAlpha = 1;
  }

  function drawTitle(time) {
    if (!tc || !typeOff) return;
    tc.clearRect(0, 0, W, H);
    tc.globalCompositeOperation = 'lighter';
    var breathe = 0.72 + 0.28 * Math.sin(time * 0.55);
    tc.globalAlpha = breathe;
    tc.drawImage(typeGlow, typePad, typePad, typeOff.width, typeOff.height,
      titleBox.x, titleBox.y, titleBox.w, titleBox.h);
    tc.globalAlpha = 1;
    tc.globalCompositeOperation = 'source-over';
    tc.drawImage(typeOff, titleBox.x, titleBox.y, titleBox.w, titleBox.h);

    stepDust(runningDt, time);
  }

  /* 暗空里的星：只闪不跑    /* 暗空里的星：只闪不跑，和束内的粒子分工明确 */
  function buildStars() {
    stars = [];
    var want = small ? 130 : 380, guard = 0;
    while (stars.length < want && guard < want * 12) {
      guard++;
      var px = Math.random() * W, py = Math.random() * H;
      var idx = sampleAt(px, py);
      if (idx < 0) continue;
      if (lum[idx] > 0.20) continue;           /* 亮处交给粒子 */

      var big = Math.random() < 0.04;
      stars.push({
        x: px, y: py,
        r: big ? 1.6 + Math.random() * 1.3 : 0.5 + Math.random() * 1.1,
        a: big ? 0.8 : 0.25 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
        sp: 0.5 + Math.random() * 2.2,
        flare: big
      });
    }
  }

  function drawStars2D(time) {
    var st, a, i;
    for (i = 0; i < stars.length; i++) {
      st = stars[i];
      a = st.a * (0.18 + 0.82 * Math.pow(Math.max(0, Math.sin(time * st.sp + st.ph)), 3));
      if (a < 0.02) continue;

      fx.fillStyle = 'rgba(212,232,255,' + a.toFixed(3) + ')';
      fx.beginPath();
      fx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      fx.fill();

      if (st.flare && a > 0.45) {
        var L2 = st.r * 5.5;
        fx.strokeStyle = 'rgba(196,224,255,' + (a * 0.42).toFixed(3) + ')';
        fx.lineWidth = 0.7;
        fx.beginPath();
        fx.moveTo(st.x - L2, st.y); fx.lineTo(st.x + L2, st.y);
        fx.moveTo(st.x, st.y - L2); fx.lineTo(st.x, st.y + L2);
        fx.stroke();
      }
    }
  }

  var dotSprite = null;
  function buildSprite() {
    dotSprite = document.createElement('canvas');
    dotSprite.width = dotSprite.height = 64;
    var g2 = dotSprite.getContext('2d');
    var grd = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.22, 'rgba(226,242,255,.86)');
    grd.addColorStop(0.5, 'rgba(170,215,255,.30)');
    grd.addColorStop(1, 'rgba(120,180,255,0)');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 64, 64);
  }

  function stepParts(dt, time) {
    var p, idx, L, dx, dy, tx, ty, a;
    fx.clearRect(0, 0, W, H);
    fx.globalCompositeOperation = 'lighter';
    if (!dotSprite) buildSprite();

    for (var i = 0; i < parts.length; i++) {
      p = parts[i];
      p.age += dt;
      idx = sampleAt(p.x, p.y);
      L = idx < 0 ? 0 : lum[idx];

      if (idx < 0 || L < 0.52 || p.age > p.life) {
        var s = pickSeed();
        p.x = s.x; p.y = s.y; p.vx = p.vy = 0;
        p.age = 0; p.life = 0.6 + Math.random() * 1.8;
        continue;
      }

      dx = dirX[idx]; dy = dirY[idx];
      var wob = Math.sin(time * 2 + p.ph) * 0.22;
      tx = dx * p.sp + (-dy) * wob * p.sp;
      ty = dy * p.sp + (dx) * wob * p.sp;

      p.vx += (tx - p.vx) * Math.min(1, dt * 8);
      p.vy += (ty - p.vy) * Math.min(1, dt * 8);
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      a = Math.min(1, L * p.a * 1.3) * (0.55 + 0.45 * Math.sin(time * p.tws + p.ph));
      if (a <= 0.03) continue;

      var s2 = p.r * 5.2;
      fx.globalAlpha = a * 0.95;
      fx.drawImage(dotSprite, p.x - s2 * 0.5, p.y - s2 * 0.5, s2, s2);
    }
    fx.globalAlpha = 1;
    drawStars2D(time);
    fx.globalCompositeOperation = 'source-over';
  }

  /* ---------------- 降级：2D 切片波动 ---------------- */
  function drawFallback(time) {
    var g = glCanvas.getContext('2d');
    if (!g) return;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);

    var scale = Math.max(W / imgW, H / imgH);
    var dw = imgW * scale, dh = imgH * scale;
    var dx0 = (W - dw) / 2, dy0 = (H - dh) / 2;

    var slices = 90, sw = dw / slices, i, x, off;
    for (i = 0; i < slices; i++) {
      x = dx0 + i * sw;
      off = Math.sin(i * 0.22 + time * 1.6) * 7;
      g.drawImage(src, i * (imgW / slices), 0, imgW / slices, imgH,
        x, dy0 + off, sw + 1, dh);
    }
  }

  /* ---------------- 尺寸 ---------------- */
  function resize() {
    var rect = root.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    DPR = Math.min(2, window.devicePixelRatio || 1);
    small = W < 760;

    imgW = src.naturalWidth || 2047;
    imgH = src.naturalHeight || 1152;

    [glCanvas, fxCanvas].forEach(function (cv) {
      cv.width = Math.round(W * DPR);
      cv.height = Math.round(H * DPR);
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
    });

    if (fx) fx.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (gl) {
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }

    if (typeCanvas) {
      typeCanvas.width = Math.round(W * DPR);
      typeCanvas.height = Math.round(H * DPR);
      typeCanvas.style.width = W + 'px';
      typeCanvas.style.height = H + 'px';
    }
    if (tc) tc.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (grainCanvas) {
      grainCanvas.width = Math.round(W * DPR);
      grainCanvas.height = Math.round(H * DPR);
      grainCanvas.style.width = W + 'px';
      grainCanvas.style.height = H + 'px';
    }
    if (gc) gc.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!grainTile) buildGrain();

    buildField();
    buildParts();
    buildStars();
    buildTitleCanvas();
    frame(reduced ? 2.0 : clock, 0);
  }

  var grainCanvas = root.querySelector('.fm-hero__grain');
  var gc = grainCanvas ? grainCanvas.getContext('2d') : null;
  var grainTile = null;
  function buildGrain() {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 128;
    var g = grainTile.getContext('2d');
    var im = g.createImageData(128, 128);
    for (var i = 0; i < im.data.length; i += 4) {
      var v = 90 + Math.random() * 110;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }
  function drawGrain(time) {
    if (!gc || !grainTile) return;
    gc.clearRect(0, 0, W, H);
    var ox = Math.floor((time * 90) % 128), oy = Math.floor((time * 70) % 128);
    var p = gc.createPattern(grainTile, 'repeat');
    if (p.setTransform) { var m = new DOMMatrix(); m.e = -ox; m.f = -oy; p.setTransform(m); }
    gc.fillStyle = p;
    gc.fillRect(0, 0, W, H);
  }

  var runningDt = 0;
  function frame(time, dt) {
    runningDt = dt || 0.016;
    if (gl) drawGL(time * SPEED);
    else drawFallback(time);

    if (!reduced) stepParts(dt, time);
    drawTitle(time);
    if (!reduced) drawGrain(time);
  }

  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    boost += (boostTarget - boost) * Math.min(1, dt * 4);
    var dts = dt * boost;
    clock += dts;
    frame(clock, dts);
    rafId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduced || offscreen) return;
    running = true; last = 0;
    rafId = window.requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0; last = 0;
  }

  /* ---------------- 生命周期 ---------------- */
  var ro = null, debId = 0;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(function () {
      window.clearTimeout(debId);
      debId = window.setTimeout(resize, 140);
    });
    ro.observe(root);
  } else {
    window.addEventListener('resize', resize);
  }

  var io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(function (es) {
      offscreen = !es[0].isIntersecting;
      if (offscreen) stop(); else start();
    }, { threshold: 0.05 });
    io.observe(root);
  }

  var onEnter = function () { boostTarget = 1.55; };
  var onLeave = function () { boostTarget = 1; };
  root.addEventListener('pointerenter', onEnter);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('pointercancel', onLeave);

  var onVis = function () { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVis);

  var mq = null, mqH = null;
  try {
    mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mqH = function (e) { reduced = e.matches; if (reduced) { stop(); frame(2.0, 0); } else start(); };
    if (mq.addEventListener) mq.addEventListener('change', mqH);
    else if (mq.addListener) mq.addListener(mqH);
  } catch (e) {}

  var boot = function () {
    gl = null;
    try { initGL(); } catch (e) { gl = null; }
    resize();
    start();
  };

  if (src.complete && src.naturalWidth) boot();
  else src.addEventListener('load', boot, { once: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      buildTitleCanvas();
      if (running) frame(clock, 0.016);
    });
  }

  return {
    destroy: function () {
      stop();
      window.clearTimeout(debId);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      if (typeof ResizeObserver === 'undefined') window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      if (mq && mqH) {
        if (mq.removeEventListener) mq.removeEventListener('change', mqH);
        else if (mq.removeListener) mq.removeListener(mqH);
      }
      if (gl && tex) gl.deleteTexture(tex);
      if (gl && prog) gl.deleteProgram(prog);
      root.__fmMounted = false;
    }
  };
}

const FMMirrorHero = { mount: mount };

export default FMMirrorHero
