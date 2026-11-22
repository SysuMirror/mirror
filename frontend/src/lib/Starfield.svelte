<script>
  // 与首页同源的星空 + 两侧漂浮小 Mirror 碎片背景（fixed，铺满视口，内容浮在其上）。
  import { onMount } from 'svelte'

  let canvas
  onMount(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let W = 0, H = 0, dpr = 1, raf = 0, stars = [], mirrors = [], tpl = null
    const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, inside: false }

    const rnd = (a, b) => a + Math.random() * (b - a)
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

    function buildTemplate() {
      const fs = 60, step = 7
      const c = document.createElement('canvas')
      const g = c.getContext('2d')
      if (!g) return null
      const font = '600 ' + fs + 'px "Segoe UI", Arial, sans-serif'
      g.font = font
      const w = Math.ceil(g.measureText('Mirror').width) + fs * 0.3
      const h = Math.ceil(fs * 1.5)
      c.width = w; c.height = h
      g.font = font; g.textBaseline = 'middle'; g.fillStyle = '#fff'
      g.fillText('Mirror', fs * 0.15, h / 2)
      let data
      try { data = g.getImageData(0, 0, w, h).data } catch { return null }
      const shards = []
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 120) shards.push({ hx: x - w / 2, hy: y - h / 2, s: step * rnd(0.62, 1), ang: rnd(0, Math.PI), spin: rnd(-0.4, 0.4), tone: rnd(0.55, 1) })
      }
      return { shards: shards.slice(0, 150), w, h }
    }
    function makeMirror(sideX) {
      const scale = rnd(0.5, 0.8)
      const half = tpl.w * scale / 2
      return {
        cx: clamp(W * sideX, half + 10, W - half - 10), cy: rnd(H * 0.25, H * 0.75),
        scale, vx: rnd(-0.1, 0.1), vy: rnd(-0.07, 0.07), rot: rnd(-0.05, 0.05), vrot: rnd(-0.0005, 0.0005),
        shards: tpl.shards.map(s => ({ ...s, ox: rnd(-150, 150), oy: rnd(-110, 110), vx: 0, vy: 0 }))
      }
    }
    function resize() {
      W = innerWidth; H = innerHeight
      dpr = Math.min(devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
      const n = clamp(Math.round(W * H / 4200), 120, 420)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: rnd(0.35, 1.6), a: rnd(0.18, 0.8),
        ph: rnd(0, 6.283), tw: rnd(0.4, 1.8), depth: rnd(0.3, 1.2), warm: Math.random() < 0.13,
        spark: Math.random() < 0.1, vx: rnd(-0.05, 0.05), vy: rnd(-0.04, 0.04)
      }))
      tpl = tpl || buildTemplate()
      mirrors = tpl ? [makeMirror(0.08), makeMirror(0.92)] : []
      if (reduce) draw(performance.now())
    }
    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      for (const s of stars) {
        if (!reduce) {
          s.x += s.vx + Math.sin(t * 0.0003 + s.ph) * 0.04
          s.y += s.vy
          if (mouse.inside) {
            const dx = s.x - mouse.x, dy = s.y - mouse.y
            const d = Math.hypot(dx, dy) || 1
            if (d < 160) {
              const f = 1 - d / 160
              s.x += (dx / d) * f * f * 1.6 + (-dy / d) * f * 0.5 + mouse.vx * f * 0.08
              s.y += (dy / d) * f * f * 1.6 + (dx / d) * f * 0.5 + mouse.vy * f * 0.08
            }
          }
          if (s.x < -6) s.x = W + 4; else if (s.x > W + 6) s.x = -4
          if (s.y < -6) s.y = H + 4; else if (s.y > H + 6) s.y = -4
        }
        let a = s.a * (0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph)), near = 0
        if (mouse.inside) {
          const gd = Math.hypot(s.x - mouse.x, s.y - mouse.y)
          if (gd < 160) { near = 1 - gd / 160; a += near * 0.5 }
        }
        ctx.fillStyle = (s.warm ? 'rgba(255,226,196,' : 'rgba(214,232,255,') + clamp(a, 0, 1).toFixed(3) + ')'
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r + near * 0.6, 0, 6.283); ctx.fill()
        if (s.spark) {
          const sl = s.r * (2.2 + near * 4)
          ctx.strokeStyle = (s.warm ? 'rgba(255,226,196,' : 'rgba(214,232,255,') + clamp(a * 0.5, 0, 0.8).toFixed(3) + ')'
          ctx.lineWidth = 0.6
          ctx.beginPath(); ctx.moveTo(s.x - sl, s.y); ctx.lineTo(s.x + sl, s.y); ctx.moveTo(s.x, s.y - sl); ctx.lineTo(s.x, s.y + sl); ctx.stroke()
        }
      }
      for (const mm of mirrors) {
        if (!reduce) {
          mm.cx += mm.vx; mm.cy += mm.vy; mm.rot += mm.vrot
          if (mm.cx < 60 || mm.cx > W - 60) mm.vx *= -1
          if (mm.cy < 60 || mm.cy > H - 60) mm.vy *= -1
        }
        const cos = Math.cos(mm.rot), sin = Math.sin(mm.rot)
        for (const s of mm.shards) {
          if (!reduce) {
            s.vx += -s.ox * 0.018; s.vy += -s.oy * 0.018; s.vx *= 0.9; s.vy *= 0.9
            const wx = mm.cx + (s.hx * cos - s.hy * sin) * mm.scale + s.ox
            const wy = mm.cy + (s.hx * sin + s.hy * cos) * mm.scale + s.oy
            if (mouse.inside) {
              const mdx = wx - mouse.x, mdy = wy - mouse.y
              const md = Math.hypot(mdx, mdy) || 1
              if (md < 110) { const f = 1 - md / 110; s.vx += (mdx / md) * f * f * 2.2; s.vy += (mdy / md) * f * f * 2.2 }
            }
            s.ox += s.vx; s.oy += s.vy; s.ang += s.spin * 0.02
          }
          const px = mm.cx + (s.hx * cos - s.hy * sin) * mm.scale + s.ox
          const py = mm.cy + (s.hx * sin + s.hy * cos) * mm.scale + s.oy
          const size = s.s * mm.scale
          let alpha = 0.4 * s.tone, glow = 0
          if (mouse.inside) {
            const gd = Math.hypot(px - mouse.x, py - mouse.y)
            if (gd < 130) { glow = 1 - gd / 130; alpha += glow * 0.4 }
          }
          ctx.save(); ctx.translate(px, py); ctx.rotate(s.ang + mm.rot)
          ctx.fillStyle = 'rgba(' + (glow > 0.3 ? '247,251,255' : '162,182,207') + ',' + clamp(alpha, 0, 0.9).toFixed(3) + ')'
          ctx.beginPath()
          ctx.moveTo(0, -size * 0.6); ctx.lineTo(size * 0.5, -size * 0.1); ctx.lineTo(size * 0.32, size * 0.55); ctx.lineTo(-size * 0.42, size * 0.4); ctx.lineTo(-size * 0.5, -size * 0.2)
          ctx.closePath(); ctx.fill(); ctx.restore()
        }
      }
    }
    function loop(t) { raf = 0; if (document.hidden) return; draw(t); raf = requestAnimationFrame(loop) }
    function kick() { if (!raf && !reduce && !document.hidden) raf = requestAnimationFrame(loop) }
    function onMove(e) {
      if (mouse.inside) { mouse.vx = mouse.vx * 0.7 + (e.clientX - mouse.x) * 0.3; mouse.vy = mouse.vy * 0.7 + (e.clientY - mouse.y) * 0.3 }
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true
    }
    function onLeave() { mouse.inside = false }
    function onVis() { if (!document.hidden) kick() }
    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('pointerleave', onLeave)
    addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVis)
    resize(); kick()
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerleave', onLeave)
      removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  })
</script>

<canvas bind:this={canvas} class="fx-bg" aria-hidden="true"></canvas>

<style>
  .fx-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; display: block; }
</style>