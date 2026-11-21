const palette = ['#358eff', '#65e2fa', '#6249ed', '#db72ed', '#d9f7ff']
const tilt = -0.31
const cosTilt = Math.cos(tilt)
const sinTilt = Math.sin(tilt)
const dustExtent = 1.42
const pointerDepth = 0.14

function noise() {
  return Math.random() + Math.random() + Math.random() - 1.5
}

function fragmentPath(x, y) {
  const seam = Math.sin(x * 31 + y * 14) * Math.cos(y * 27 - x * 9)
  const angle = Math.atan2(y * 1.35, x) + seam * 0.86 + noise() * 1.55
  const speed = 0.24 + Math.random() ** 1.6 * 1.22
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed * 0.93,
    curl: noise() * 0.32,
    delay: 0.08 + (seam + 1) * 0.075 + Math.random() * 0.24,
    shard: Math.random() ** 4,
  }
}

function createScatterMotion() {
  return {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    moving: false,
    scatterX: Math.random() * 2 - 1,
    scatterY: Math.random() * 2 - 1,
    scatterZ: Math.random() * 2 - 1,
    reach: 0.40 + Math.random() * 0.72,
    phase: Math.random() * 2 * Math.PI,
  }
}

function createStars(count, nodes, aspect, fineDust = false) {
  const groups = palette.map(() => [])
  for (let index = 0; index < count; index++) {
    const band = Math.random()
    const arm = (index % 3) * Math.PI * 2 / 3
    let radius = Math.random() ** 0.67
    let angle = arm + radius * 7.3 + noise() * (0.48 + radius * 0.36)
    let color = index % 7 === 0 ? 3 : index % 3

    if (band < 0.16) {
      // A bright, irregular oval around the nucleus.
      angle = Math.random() * Math.PI * 2
      radius = 0.39 + noise() * 0.062 + Math.sin(angle * 3 + 0.9) * 0.039
      color = index % 5 === 0 ? 1 : 0
    } else if (band < 0.26) {
      angle = Math.random() * Math.PI * 2
      radius = Math.random() ** 0.82 * 0.225
      color = index % 3 === 0 ? 1 : 4
    } else if (band < 0.43) {
      angle = Math.random() * Math.PI * 2
      radius = 0.47 + Math.random() * 0.6
      color = index % 4 === 0 ? 3 : index % 3
    } else if (radius > 0.58 && Math.sin(angle + 0.3) > 0.43) {
      color = index % 3 === 0 ? 3 : 2
    }

    const knots = Math.sin(angle * 7 - radius * 27) * 0.5 + 0.5
    const intensity = band < 0.16 ? 1.45 : 1
    const x = Math.cos(angle) * radius * 0.64
    const y = Math.sin(angle) * radius * 0.395 + noise() * (0.019 + radius * 0.036)
    groups[color].push({
      x: x * cosTilt - y * sinTilt,
      y: (x * sinTilt + y * cosTilt) * aspect,
      depth: Math.sin(angle) * radius * 0.51 + noise() * 0.23,
      motion: !fineDust && Math.random() < 0.58 ? createScatterMotion() : null,
      fragment: fineDust ? null : fragmentPath(x * cosTilt - y * sinTilt, x * sinTilt + y * cosTilt),
      size: fineDust ? 0.46 + Math.random() ** 2 * 0.85 : 0.52 + Math.random() ** 3 * 1.65,
      opacity: (0.22 + Math.random() ** 1.4 * 0.61) * (0.5 + knots * 0.5) * intensity,
    })
  }

  for (const [index, node] of nodes.entries()) {
    const color = index === 1 ? 1 : index % 2 === 0 ? 3 : 2
    for (let point = 0; point < count * 0.065; point++) {
      const offset = noise()
      const spread = point % 5 === 0 ? 1.9 : 1
      groups[point % 7 === 0 ? 4 : color].push({
        x: node.x - 0.5 + offset * 0.082 * spread,
        y: node.y - 0.5 + (noise() * 0.043 - offset * 0.018) * spread,
        depth: noise() * 0.15,
        motion: null,
        nodeIndex: index,
        fragment: fragmentPath(node.x - 0.5, node.y - 0.5),
        size: 0.42 + Math.random() ** 2 * 1.26,
        opacity: (0.16 + Math.random() * 0.57) / spread,
      })
    }
  }

  return groups
}

function scatterStar(state, dx, dy, dz, time, step, drag, radiusX, radiusY) {
  // Offset each star's contact area and give it its own direction. The cursor
  // agitates a patch of dust instead of pushing particles into a rim.
  const localX = dx + state.scatterY * 0.42
  const localY = dy - state.scatterX * 0.37
  const distance = localX * localX + localY * localY + dz * dz
  const contact = Math.max(0, state.reach - distance) / state.reach
  if (!state.moving && !contact) return false

  const force = contact * contact
  const flutter = force ? Math.sin(time * 9 + state.phase) : 0
  const x = force * (state.scatterX * 0.65 + state.scatterY * flutter * 0.45) * radiusX
  const y = force * (state.scatterY * 0.65 - state.scatterX * flutter * 0.45) * radiusY
  const z = force * (state.scatterZ * 0.21 + flutter * 0.09)
  state.vx = (state.vx + (x - state.x) * step * 0.17) * drag
  state.vy = (state.vy + (y - state.y) * step * 0.17) * drag
  state.vz = (state.vz + (z - state.z) * step * 0.17) * drag
  state.x += state.vx * step
  state.y += state.vy * step
  state.z += state.vz * step
  state.moving = force > 0 || Math.abs(state.x) + Math.abs(state.y) + Math.abs(state.z)
    + Math.abs(state.vx) + Math.abs(state.vy) + Math.abs(state.vz) > 0.0001
  if (!state.moving) state.x = state.y = state.z = state.vx = state.vy = state.vz = 0
  return state.moving
}

export function mountGalaxy(canvas, props) {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return null

  const host = canvas.parentElement
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const dust = document.createElement('canvas')
  const dustContext = dust.getContext('2d')
  let width = 0
  let height = 0
  let pixelRatio = 1
  let groups = []
  let raf = 0
  let inView = true
  let flight = null
  let highlighted = null
  let highlight = 0
  let previousTime = 0
  let pointerX = 0.5
  let pointerY = 0.5
  let pointerInside = false
  let pointerOnNode = false
  let zoneFocus = 0
  const nodeScales = props.nodes.map(() => 0)
  let ambientTime = 0
  let driftX = 0
  let driftY = 0

  function bakeDust(count, aspect) {
    if (!dustContext) return
    dust.width = Math.ceil(width * dustExtent * pixelRatio)
    dust.height = Math.ceil(height * dustExtent * pixelRatio)
    dustContext.setTransform(pixelRatio, 0, 0, pixelRatio, dust.width / 2, dust.height / 2)
    dustContext.globalCompositeOperation = 'lighter'

    for (const [index, stars] of createStars(count, [], aspect, true).entries()) {
      dustContext.fillStyle = palette[index]
      for (const star of stars) {
        const perspective = 1 / (1 - star.depth * 0.24)
        dustContext.globalAlpha = star.opacity * 0.63
        dustContext.fillRect(star.x * width * perspective, star.y * height * perspective, star.size, star.size)
      }
    }
  }

  function drawDust(roll, zoom, focusX, focusY, dim, dissolve) {
    if (!dustContext || !dust.width) return
    ctx.save()
    ctx.globalAlpha = (0.84 + 0.16 * zoneFocus) * (1 - 0.81 * dim) * (1 - dissolve)
    ctx.translate(width / 2, height / 2)
    ctx.scale(width * zoom, height * zoom)
    ctx.rotate(roll)
    ctx.translate(-focusX + driftX * 0.48, -focusY + driftY * 0.48)
    ctx.drawImage(dust, -dustExtent / 2, -dustExtent / 2, dustExtent, dustExtent)
    ctx.restore()
  }

  function draw(time) {
    raf = 0
    if (!width || !height) return
    ctx.clearRect(0, 0, width, height)

    const reduced = motion.matches
    const elapsed = Math.min(34, Math.max(0, time - previousTime))
    const response = reduced ? 1 : 1 - Math.exp(-elapsed / 145)
    const step = elapsed / (1000 / 60)
    const drag = Math.pow(0.70, step)
    previousTime = time
    if (!reduced) ambientTime += elapsed / 1000
    const scroll = reduced || flight ? 0 : props.scrollProgress
    const approach = Math.min(1, scroll / 0.38)
    const target = scroll < 0.06 ? props.activeNode : null
    if (target) highlighted = target
    highlight += ((target ? 1 : 0) - highlight) * response
    for (const [index, node] of props.nodes.entries()) {
      const targetScale = !reduced && !flight && target === node ? 0.17 : 0
      nodeScales[index] += (targetScale - nodeScales[index]) * response
    }
    const followsPointer = !reduced && pointerInside && !flight && scroll < 0.06
    const scattersStars = followsPointer && !pointerOnNode
    zoneFocus += ((props.regionHovered && !flight && scroll < 0.06 ? 1 : 0) - zoneFocus) * response
    driftX += ((followsPointer ? (pointerX - 0.5) * 0.034 : 0) - driftX) * response
    driftY += ((followsPointer ? (pointerY - 0.5) * 0.032 : 0) - driftY) * response

    const progress = flight && !reduced ? Math.min(1, (time - flight.start) / flight.duration) : 0
    const ecoFlight = !reduced && flight?.node.to.hash === '#eco'
    const dispersal = ecoFlight ? Math.max(0, (progress - 0.35) / 0.65) : scroll
    const travelingSparks = ecoFlight && progress > 0.43 ? flight.sparks : null
    const dissolve = Math.min(1, Math.max(0, (dispersal - 0.24) / 0.51))
    const travel = progress * progress
    const steering = progress * progress * (3 - 2 * progress)
    const roll = (reduced ? 0 : Math.sin(ambientTime * 0.39) * 0.045) - 0.65 * travel - approach * 0.16
    const breath = reduced ? 0 : Math.sin(ambientTime * 0.67) * 0.018
    const pushIn = approach * approach * (3 - 2 * approach)
    const zoom = 1 + breath + pushIn * 0.72 + (reduced ? 0 : zoneFocus * 0.060) + travel * (ecoFlight ? 2.3 : 4.45)
      - Math.sin(steering * Math.PI) * (1 - progress) * 0.12
    const cos = Math.cos(roll)
    const sin = Math.sin(roll)
    const focusX = flight ? (flight.node.x - 0.5) * steering : 0
    const focusY = flight ? (flight.node.y - 0.5) * steering : 0
    const dim = highlight * (1 - steering)
    const shimmer = reduced ? 0 : Math.sin(ambientTime * 1.1) * 0.014
    const tide = reduced ? 0 : Math.sin(ambientTime * 0.88) * 0.022
    const glint = reduced ? 0 : Math.sin(ambientTime * 1.9) * 0.17
    const radius = Math.min(67, width * 0.145)
    const radiusX = radius / width
    const radiusY = radius / height
    const perspective = 0.24 + travel * 0.68
    const regionLight = 1 + zoneFocus * 0.27

    ctx.globalCompositeOperation = 'lighter'
    drawDust(roll, zoom, focusX, focusY, dim, dissolve)
    for (const [index, stars] of groups.entries()) {
      ctx.fillStyle = palette[index]
      for (const star of stars) {
        if (travelingSparks?.has(star)) continue
        let x = star.x - focusX + (driftX + shimmer) * (0.44 + star.depth)
        let y = star.y - focusY + driftY * (0.44 + star.depth) + tide * star.x
        const nodeScale = nodeScales[star.nodeIndex] || 0
        if (nodeScale > 0.001) {
          const node = props.nodes[star.nodeIndex]
          x += (star.x + 0.5 - node.x) * nodeScale
          y += (star.y + 0.5 - node.y) * nodeScale
        }
        let depth = star.depth
        let scale = zoom / (1 - depth * perspective)
        let px = 0.5 + (x * cos - y * sin) * scale
        let py = 0.5 + (x * sin + y * cos) * scale
        const state = star.motion

        if (state && !reduced && !flight && (scattersStars || state.moving)) {
          const dx = scattersStars ? (px - pointerX) / radiusX : 2
          const dy = scattersStars ? (py - pointerY) / radiusY : 2
          const dz = (depth - pointerDepth) / 0.66
          if (scatterStar(state, dx, dy, dz, ambientTime, step, drag, radiusX, radiusY)) {
            depth += state.z
            scale = zoom / (1 - depth * perspective)
            px = 0.5 + (x * cos - y * sin + state.x) * scale
            py = 0.5 + (x * sin + y * cos + state.y) * scale
          }
        }
        let scattering = 0
        const fragment = star.fragment
        if (dispersal > fragment.delay) {
          const release = (dispersal - fragment.delay) / (1 - fragment.delay)
          scattering = release ** 1.38
          const arc = Math.sin(release * Math.PI) * fragment.curl
          px += fragment.x * scattering - fragment.y * arc
          py += fragment.y * scattering + fragment.x * arc
        }
        if (px < -0.01 || px > 1.01 || py < -0.01 || py > 1.01) continue

        let light = 1 + glint * star.depth * 2
        if (highlighted && dim > 0.005) {
          const dx = (px - highlighted.x) * 0.94
          const dy = py - highlighted.y
          const proximity = Math.max(0, 1 - (dx * dx + dy * dy) / 0.043)
          light += dim * (proximity * proximity * 2.85 - 0.83)
        }
        const fragmentLight = (1 - scattering) * (1 + Math.min(1, scattering * 8) * fragment.shard * 0.75)
        ctx.globalAlpha = Math.min(1, star.opacity * light * regionLight * fragmentLight
          * (1 + (depth - star.depth) * 0.72))
        const size = star.size * (1 + nodeScale + travel * 1.8 + pushIn * 0.28 + (depth - star.depth) * 1.30)
        if (scattering > 0.035 && fragment.shard > 0.87) {
          const length = size * (2.8 + fragment.shard * 4.4)
          ctx.strokeStyle = palette[index]
          ctx.lineWidth = size * 0.60
          ctx.beginPath()
          ctx.moveTo(px * width, py * height)
          ctx.lineTo(px * width - fragment.x * length, py * height - fragment.y * length)
          ctx.stroke()
        } else {
          ctx.fillRect(px * width, py * height, size, size)
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    if (!motion.matches && inView && !document.hidden) raf = requestAnimationFrame(draw)
  }

  function refresh() {
    cancelAnimationFrame(raf)
    raf = 0
    if (inView && !document.hidden) draw(performance.now())
  }

  function resize() {
    const nextWidth = host.clientWidth
    const nextHeight = host.clientHeight
    const desktop = nextWidth >= 500
    const dpr = Math.min(window.devicePixelRatio || 1, desktop ? 1.6 : 1.35)
    if (!nextWidth || !nextHeight || (width === nextWidth && height === nextHeight && pixelRatio === dpr)) return

    width = nextWidth
    height = nextHeight
    pixelRatio = dpr
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const aspect = Math.min(1.22, width / height)
    groups = createStars(desktop ? 8500 : 3950, props.nodes, aspect)
    bakeDust(desktop ? 35000 : 7500, aspect)
    refresh()
  }

  function followPointer(event) {
    if (event.pointerType !== 'mouse') return
    const bounds = host.getBoundingClientRect()
    pointerInside = true
    pointerOnNode = Boolean(event.target.closest('a'))
    pointerX = (event.clientX - bounds.left) / bounds.width
    pointerY = (event.clientY - bounds.top) / bounds.height
  }

  function resetPointer() {
    pointerInside = false
  }

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting
    refresh()
  })
  intersection.observe(host)
  host.addEventListener('pointermove', followPointer, { passive: true })
  host.addEventListener('pointerleave', resetPointer)
  document.addEventListener('visibilitychange', refresh)
  motion.addEventListener('change', refresh)
  resize()

  return {
    sampleNodeSparks(node) {
      const index = props.nodes.indexOf(node)
      if (index < 0) return []
      const bounds = canvas.getBoundingClientRect()
      const sources = groups.flatMap((stars, color) =>
        stars.filter(star => star.nodeIndex === index).map(star => ({ star, color: palette[color] })),
      )
      const stride = Math.max(1, sources.length / 58)
      const samples = Array.from({ length: Math.min(58, sources.length) }, (_, index) =>
        sources[Math.floor(index * stride)],
      )
      if (flight?.node === node) flight.sparks = new Set(samples.map(({ star }) => star))
      return samples.map(({ star, color }) => {
        const perspective = 1 / (1 - star.depth * 0.24)
        return {
          x: bounds.left + (0.5 + star.x * perspective) * bounds.width,
          y: bounds.top + (0.5 + star.y * perspective) * bounds.height,
          size: star.size,
          color,
        }
      })
    },
    startFlight(node, duration) {
      if (motion.matches || !width || !height) return false
      flight = { node, duration, start: performance.now() }
      return true
    },
    resetFlight() {
      flight = null
    },
    refresh,
    dispose() {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersection.disconnect()
      host.removeEventListener('pointermove', followPointer)
      host.removeEventListener('pointerleave', resetPointer)
      document.removeEventListener('visibilitychange', refresh)
      motion.removeEventListener('change', refresh)
    },
  }
}
