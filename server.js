import { readFile } from 'node:fs/promises'
import http from 'node:http'
import { isIP } from 'node:net'
import path from 'node:path'
import { createInquiry, openInquiries, root, validateInquiry } from './project-inquiries.js'

const webRoot = path.join(root, 'web')
if (process.platform !== 'win32') process.umask(0o077)
const db = openInquiries({ initialize: true })
const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 8080)
const maxBodySize = 32 * 1024
const rateWindow = 10 * 60 * 1000
const attempts = new Map()
let cleanRatesAt = 0

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(JSON.stringify(body))
}

function limitSubmission(req) {
  const now = Date.now()
  if (now >= cleanRatesAt) {
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key)
    cleanRatesAt = now + 60_000
  }
  const forwarded = process.env.MIRROR_TRUST_PROXY === '1'
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : ''
  const address = isIP(forwarded) ? forwarded : req.socket.remoteAddress
  let entry = attempts.get(address)
  if (!entry || entry.until <= now) {
    if (!entry && attempts.size >= 8192) return 60
    entry = { count: 0, until: now + rateWindow }
    attempts.set(address, entry)
  }
  entry.count++
  return entry.count > 30 ? Math.ceil((entry.until - now) / 1000) : 0
}

async function submitInquiry(req, res) {
  if (req.method !== 'POST')
    return sendJson(res, 405, { error: '请求方式无效。' }, { Allow: 'POST' })
  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json')
    return sendJson(res, 415, { error: '请通过官网项目咨询表单提交。' })
  const retryAfter = limitSubmission(req)
  if (retryAfter) return sendJson(res, 429, { error: '提交过于频繁，请稍后重试。' }, { 'Retry-After': retryAfter })

  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBodySize) {
      sendJson(res, 413, { error: '项目说明过长，请缩短后重试。' }, { Connection: 'close' })
      return
    }
    chunks.push(chunk)
  }

  let payload
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return sendJson(res, 400, { error: '工单数据无效。' })
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return sendJson(res, 400, { error: '工单数据无效。' })

  const inquiry = validateInquiry(payload)
  if (inquiry.error) return sendJson(res, 400, { error: inquiry.error })
  const created = createInquiry(db, inquiry)
  return sendJson(res, created ? 201 : 200, { ok: true, orderId: inquiry.id })
}

async function serveFile(req, res, pathname) {
  const file = path.resolve(webRoot, pathname === '/' ? 'index.html' : '.' + pathname)
  const relative = path.relative(webRoot, file)
  const type = mimeTypes[path.extname(file).toLowerCase()]
  if (relative.startsWith('..') || path.isAbsolute(relative) || !type)
    return sendJson(res, 404, { error: '页面不存在。' })

  let data
  try {
    data = await readFile(file)
  } catch (error) {
    if (['ENOENT', 'EISDIR', 'ENOTDIR'].includes(error.code)) return sendJson(res, 404, { error: '页面不存在。' })
    throw error
  }
  const html = type.startsWith('text/html')
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': html ? 'no-store, no-cache, must-revalidate, max-age=0' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    ...(html ? { 'Surrogate-Control': 'no-store', Pragma: 'no-cache', Expires: '0' } : {}),
  })
  return res.end(req.method === 'HEAD' ? undefined : data)
}

async function handle(req, res) {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  } catch {
    return sendJson(res, 400, { error: '地址无效。' })
  }
  if (pathname === '/api/project-inquiries') return submitInquiry(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const isApi = pathname.startsWith('/api/') || pathname.startsWith('/mirror-api/')
    return sendJson(res, isApi ? 404 : 405, { error: '请求方式或地址无效。' })
  }
  if (pathname === '/api/healthz')
    return sendJson(res, 200, { ok: true, service: 'mirror', stack: 'node', db: 'ok' })
  if (pathname === '/mirror-api/healthz')
    return sendJson(res, 200, { ok: true, service: 'mirror', db: 'ok' })
  if (pathname === '/app' || pathname === '/app.html' || pathname.startsWith('/app/')) {
    res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' })
    return res.end()
  }
  // Retired APIs must not be served from public files or expose historical orders.
  if (pathname.startsWith('/api/') || pathname.startsWith('/mirror-api/'))
    return sendJson(res, 404, { error: '接口不存在。' })
  return serveFile(req, res, pathname)
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error('[mirror]', error.message)
    if (!res.headersSent) sendJson(res, 503, { error: '工单服务暂时不可用，请稍后再试。' })
    else res.end()
  })
})

server.listen(port, host, () => {
  console.log(`[mirror] listening on http://${host}:${server.address().port}`)
})
