#!/usr/bin/env node
/**
 * 沕鉴·Mirror 社区后端（Node 22 + node:sqlite，零第三方依赖）
 *
 * 职责
 * - 托管设计稿静态站（web/index.html 品牌首页、web/app.html 需求社区、web/assets）
 * - 社区 API（/api/*）：登录、需求、报名、收藏、会话、消息、个人资料
 * - 兼容原生产接口（/mirror-api/*）：UniSSO 登录、订单、批注、浏览/沟通统计
 *
 * 身份
 * - 密码登录：本地表单 -> UniSSO /api/oauth/password/verify 校验 -> 本地账号 + 会话 Cookie
 * - 静默登录：读共享 SSO Cookie（unisso_sid / sse_sso）-> UniSSO session/verify
 * - 所有写操作的身份只取自会话，绝不信任请求体里的用户 ID
 *
 * 数据
 * - mirror.db：账号 / 会话 / 需求 / 报名 / 收藏 / 会话 / 消息 / 订单 / 批注 / 统计
 * - 所有业务表由本文件启动时幂等建表；旧库（Python 版）可直接复用，不丢历史会话和订单
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.join(ROOT, 'web')
const SPA_ROOT = path.join(WEB_ROOT, 'app')
const DB_PATH = process.env.MIRROR_DB || path.join(ROOT, 'mirror.db')
const PORT = Number(process.env.PORT || 8080)
const HOST = process.env.HOST || '0.0.0.0'
const SESSION_TTL = 30 * 86400
const MAX_BODY = 256 * 1024
const BEIJING_OFFSET = 8 * 3600

/* ---------------------------------------------------------------- 配置 */

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const index = line.indexOf('=')
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (value.length >= 2 && value[0] === value.at(-1) && `"'`.includes(value[0]))
      value = value.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = value
  }
}
loadEnvFile(path.join(ROOT, '.env'))

const UNISSO_ISSUER = (process.env.UNISSO_ISSUER || 'https://sso.ssemarket.cn').replace(/\/$/, '')
const UNISSO_CLIENT_ID = process.env.UNISSO_CLIENT_ID || ''
const UNISSO_CLIENT_SECRET = process.env.UNISSO_CLIENT_SECRET || ''
const MARKET_BASE = (process.env.MARKET_BASE || 'https://ssemarket.cn').replace(/\/$/, '')
const MARKET_TRUST_SECRET = process.env.MARKET_TRUST_SECRET || ''
const MARKET_OFFICIAL_EMAIL = (process.env.MARKET_OFFICIAL_EMAIL || '').trim()
const MARKET_OFFICIAL_PASSWORD = process.env.MARKET_OFFICIAL_PASSWORD || ''
const MARKET_OFFICIAL_NAME = process.env.MARKET_OFFICIAL_NAME || '软工集市官方'

const ORDERS_PATH = '/mirror-api/orders'
const PROJECT_INQUIRY_SOURCE = 'project_inquiry'
const ORDER_STATUSES = ['pending', 'accepted', 'in_progress', 'done', 'closed']
const STATUS_LABELS = {
  pending: '待受理', accepted: '已受理', in_progress: '处理中', done: '已完成', closed: '已关闭',
}

const CATS = ['前端', '后端', '设计', '文案', '答疑']
const SKILLS = ['C++', 'Vue', 'Python', 'Java', '数据结构', '算法', 'Figma', '响应式', 'UniSSO', '论文排版', '小程序', 'Git']
const POST_STATUSES = ['招募中', '求助中', '已完成', '已关闭']

const CONTRACTS = path.join(ROOT, 'contracts')
const moneyRules = JSON.parse(fs.readFileSync(path.join(CONTRACTS, 'money-rules.json'), 'utf8'))
const noteRules = JSON.parse(fs.readFileSync(path.join(CONTRACTS, 'note-rules.json'), 'utf8'))
const authorDisplay = JSON.parse(fs.readFileSync(path.join(CONTRACTS, 'author-display.json'), 'utf8'))

/* ---------------------------------------------------------------- 数据库 */

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA busy_timeout = 5000')

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name)
}
function ensureColumn(table, column, ddl) {
  if (!tableColumns(table).includes(column))
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      sso_sub TEXT PRIMARY KEY,
      email TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      internal INTEGER NOT NULL DEFAULT 0,
      sse_user_id TEXT NOT NULL DEFAULT '',
      created REAL NOT NULL,
      last_seen REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      market_token TEXT NOT NULL DEFAULT '',
      market_user_id TEXT NOT NULL DEFAULT '',
      created REAL NOT NULL,
      last_seen REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);

    CREATE TABLE IF NOT EXISTS admins (
      email TEXT PRIMARY KEY,
      note TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      budget_type TEXT NOT NULL DEFAULT 'negotiable',
      budget_min REAL,
      budget_max REAL,
      contact_name TEXT NOT NULL DEFAULT '',
      contact_method TEXT NOT NULL DEFAULT '',
      expect_date TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL,
      owner_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      market_post_id TEXT NOT NULL DEFAULT '',
      market_post_by TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL,
      updated TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_email);

    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      actor_email TEXT NOT NULL DEFAULT '',
      actor_admin INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

    /* ---------------- 社区（本次重构新增） ---------------- */

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sso_sub TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      school TEXT NOT NULL DEFAULT '中山大学 · 软件工程学院',
      credit INTEGER NOT NULL DEFAULT 96,
      internal INTEGER NOT NULL DEFAULT 0,
      created REAL NOT NULL,
      last_seen REAL NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email) WHERE email != '';

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cat TEXT NOT NULL DEFAULT '前端',
      skills TEXT NOT NULL DEFAULT '[]',
      price REAL,
      price_type TEXT NOT NULL DEFAULT 'fixed',
      status TEXT NOT NULL DEFAULT '招募中',
      deadline TEXT NOT NULL DEFAULT '',
      author_id INTEGER NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      created REAL NOT NULL,
      updated REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created);

    CREATE TABLE IF NOT EXISTS applications (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created REAL NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created REAL NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS post_views (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created REAL NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_lo INTEGER NOT NULL,
      user_hi INTEGER NOT NULL,
      post_id INTEGER,
      lo_read REAL NOT NULL DEFAULT 0,
      hi_read REAL NOT NULL DEFAULT 0,
      created REAL NOT NULL,
      updated REAL NOT NULL,
      UNIQUE (user_lo, user_hi)
    );
    CREATE INDEX IF NOT EXISTS idx_threads_lo ON threads(user_lo);
    CREATE INDEX IF NOT EXISTS idx_threads_hi ON threads(user_hi);

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'text',
      text TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL DEFAULT '',
      file_size TEXT NOT NULL DEFAULT '',
      created REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, id);

    CREATE TABLE IF NOT EXISTS post_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_post_notes_post ON post_notes(post_id, id);

    CREATE TABLE IF NOT EXISTS stat_chats (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      peer_id INTEGER NOT NULL,
      created REAL NOT NULL,
      PRIMARY KEY (post_id, user_id, peer_id)
    );
  `)

  // 旧库迁移：Python 版 sessions 没有 account_id / sso_sub / internal
  ensureColumn('sessions', 'sso_sub', "sso_sub TEXT NOT NULL DEFAULT ''")
  ensureColumn('sessions', 'internal', 'internal INTEGER NOT NULL DEFAULT 0')
  ensureColumn('sessions', 'account_id', 'account_id INTEGER NOT NULL DEFAULT 0')
  ensureColumn('orders', 'source', "source TEXT NOT NULL DEFAULT 'legacy'")
  ensureColumn('admins', 'sso_sub', "sso_sub TEXT NOT NULL DEFAULT ''")
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_sub ON admins(sso_sub) WHERE sso_sub != ''")

  seedCommunity()
}

/* ---------------------------------------------------------------- 种子数据 */

const SEED_AUTHORS = [
  { key: 201, name: '林同学', school: '中山大学 · 软件工程', credit: 98 },
  { key: 202, name: '计算机系助教', school: '中山大学 · 计算机系', credit: 99 },
  { key: 203, name: '陈同学', school: '中山大学 · 数学学院', credit: 95 },
  { key: 204, name: '周同学', school: '华南理工 · 计算机学院', credit: 97 },
  { key: 205, name: '吴同学', school: '中山大学 · 软件工程', credit: 96 },
  { key: 999, name: '李嘉乐', school: '中山大学 · 软件工程学院', credit: 98 },
]

const SEED_POSTS = [
  { id: 101, author: 201, title: '课程设计前端页面改成响应式', price: 300, priceType: 'fixed', cat: '前端', skills: ['Vue', '响应式', 'Git'], hours: 8, deadline: '2026-11-22', views: 12, status: '招募中', desc: '用 Vue 写的课程设计，手机上排版全乱了。希望有人帮我调一下断点、表格和导航，能讲一下思路就更好了。预算可谈，本周内完成。' },
  { id: 102, author: 203, title: '数据结构作业：图的最短路径看不懂', price: 0, priceType: 'mutual', cat: '答疑', skills: ['数据结构', '算法', 'C++'], hours: 10, deadline: '', views: 8, status: '求助中', desc: 'Dijkstra 和 Floyd 的区别一直搞不清，作业第三题卡了两天。想找人讲讲思路，不代写。' },
  { id: 103, author: 202, title: '小程序登录接口联调（UniSSO）', price: 180, priceType: 'fixed', cat: '后端', skills: ['UniSSO', '小程序', 'Java'], hours: 24, deadline: '2026-11-20', views: 23, status: '招募中', desc: '校园统一登录对接小程序端，回调地址已配好，需要帮忙排查 token 校验失败的问题。' },
  { id: 104, author: 999, title: '毕业设计论文排版与查重前检查', price: 500, priceType: 'fixed', cat: '文案', skills: ['论文排版', 'Word'], hours: 13 * 24, deadline: '', views: 31, status: '已完成', desc: '论文格式按学校模板调整，附查重前的引用规范检查。' },
  { id: 105, author: 204, title: '社团招新页 Figma 稿切静态页', price: 260, priceType: 'fixed', cat: '前端', skills: ['Figma', 'Vue', '响应式'], hours: 48, deadline: '2026-11-25', views: 17, status: '招募中', desc: '已有完整 Figma 稿，需要切成可 responsive 的静态页，交付 HTML/CSS 即可。' },
  { id: 106, author: 205, title: '实验室设备预约后端接口开发', price: 900, priceType: 'fixed', cat: '后端', skills: ['C++', '数据库', 'Git'], hours: 72, deadline: '2026-11-28', views: 41, status: '招募中', desc: '用 C++ 写一套设备预约的增删查改接口，已有表结构，需要写简单文档。' },
]

function seedCommunity() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n
  if (Number(count) > 0) return
  const now = Date.now() / 1000
  const ids = {}
  for (const author of SEED_AUTHORS) {
    const accountId = upsertAccount(`demo:${author.key}`, `demo-${author.key}@mirror.local`,
      author.name, 0, author.school, author.credit)
    ids[author.key] = accountId
  }
  const insert = db.prepare(`
    INSERT INTO posts (id, title, description, cat, skills, price, price_type, status, deadline,
                       author_id, views, created, updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.exec('BEGIN')
  try {
    for (const post of SEED_POSTS) {
      const created = now - post.hours * 3600
      insert.run(post.id, post.title, post.desc, post.cat, JSON.stringify(post.skills),
        post.price, post.priceType, post.status, post.deadline, ids[post.author],
        post.views, created, created)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  console.log(`[mirror] seeded ${SEED_POSTS.length} community posts`)
}

initDb()

/* ---------------------------------------------------------------- 时间 / 格式 */

function beijing(ts) {
  return new Date((Number(ts) + BEIJING_OFFSET) * 1000)
}
function pad(value) {
  return String(value).padStart(2, '0')
}
function fmtWhen(ts) {
  const seconds = Math.max(0, Date.now() / 1000 - Number(ts))
  if (seconds < 60) return '刚刚'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}天前`
  const date = beijing(ts)
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`
}
function fmtClock(ts) {
  const date = beijing(ts)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}
function fmtMessageTime(ts) {
  if (!ts) return '刚刚'
  const date = beijing(ts)
  const today = beijing(Date.now() / 1000)
  const sameDay = date.getUTCFullYear() === today.getUTCFullYear()
    && date.getUTCMonth() === today.getUTCMonth()
    && date.getUTCDate() === today.getUTCDate()
  if (sameDay) return fmtClock(ts)
  const yesterday = new Date(today.getTime() - 86400 * 1000)
  if (date.getUTCFullYear() === yesterday.getUTCFullYear()
    && date.getUTCMonth() === yesterday.getUTCMonth()
    && date.getUTCDate() === yesterday.getUTCDate())
    return '昨天'
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`
}
function fmtDeadline(value) {
  if (!value) return ''
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return String(value).slice(0, 32)
  return `${match[2]}/${match[3]} 23:59`
}
function nowIso() {
  return new Date().toISOString()
}
function unixNow() {
  return Date.now() / 1000
}

/* ---------------------------------------------------------------- 金额 / 文本校验 */

function moneyMessage(key, label = '') {
  return String(moneyRules.messages[key] || '')
    .replaceAll('{label}', label || moneyRules.labels.default)
    .replaceAll('{min}', String(moneyRules.min))
    .replaceAll('{max}', String(moneyRules.max))
    .replaceAll('{decimals}', String(moneyRules.maxDecimalPlaces))
}
function parseAmount(raw, label) {
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  if (!text) return { error: moneyMessage('required', label) }
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${moneyRules.maxDecimalPlaces}})?$`)
  if (!pattern.test(text)) return { error: moneyMessage('format', label) }
  const amount = Number(text)
  if (amount < moneyRules.min) return { error: moneyMessage('belowMin', label) }
  if (amount > moneyRules.max) return { error: moneyMessage('aboveMax', label) }
  return { amount }
}
/** 订单接口：与旧 contracts/money_rules.validate_budget 同口径 */
function validateBudget(body) {
  let type = body.budgetType
  if (!['fixed', 'range', 'negotiable'].includes(type)) type = 'negotiable'
  if (type === 'negotiable') return { type, min: null, max: null }
  if (type === 'fixed') {
    const result = parseAmount(body.budgetMin, moneyRules.labels.fixed)
    if (result.error) return { error: result.error }
    return { type, min: result.amount, max: null }
  }
  const low = parseAmount(body.budgetMin, moneyRules.labels.min)
  if (low.error) return { error: low.error }
  const high = parseAmount(body.budgetMax, moneyRules.labels.max)
  if (high.error) return { error: high.error }
  if (low.amount > high.amount) return { error: moneyRules.messages.rangeOrder }
  return { type, min: low.amount, max: high.amount }
}
function cleanText(value, max) {
  if (typeof value !== 'string') return ''
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return text.length > max ? '' : text
}
function noteError(key) {
  const messages = noteRules.messages
  return String(messages[key] || messages.format || '格式不正确')
    .replaceAll('{max}', String(noteRules.maxLength))
    .replaceAll('{count}', String(noteRules.maxPerPost))
}
function normalizeNote(raw) {
  const content = cleanText(raw, noteRules.maxLength)
  const length = [...content].length
  if (!length) return { error: noteError('required') }
  if (length > noteRules.maxLength) return { error: noteError('tooLong') }
  return { content }
}

/* ---------------------------------------------------------------- 账号 / 会话 */

function accountById(id) {
  if (!id) return null
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(Number(id)) || null
}
function accountBySub(sub) {
  return db.prepare('SELECT * FROM accounts WHERE sso_sub = ?').get(String(sub)) || null
}
function upsertAccount(sub, email, name, internal = false, school, credit) {
  const now = unixNow()
  const cleanEmail = String(email || '').trim().toLowerCase()
  let row = accountBySub(sub)
  if (!row && cleanEmail) row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(cleanEmail)
  if (row) {
    db.prepare(`UPDATE accounts SET sso_sub = ?, email = ?, name = ?, internal = ?,
                school = COALESCE(?, school), credit = COALESCE(?, credit), last_seen = ?
                WHERE id = ?`)
      .run(String(sub), cleanEmail, String(name || row.name || ''), internal ? 1 : 0,
        school ?? null, credit ?? null, now, row.id)
    return Number(row.id)
  }
  const info = db.prepare(`INSERT INTO accounts (sso_sub, email, name, school, credit, internal, created, last_seen)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(String(sub), cleanEmail, String(name || ''), school || '中山大学 · 软件工程学院',
      Number.isFinite(credit) ? credit : 96, internal ? 1 : 0, now, now)
  return Number(info.lastInsertRowid)
}
function isAdminSession(session) {
  if (!session || Number(session.internal) !== 1 || !session.sso_sub) return false
  return !!db.prepare('SELECT 1 FROM admins WHERE sso_sub = ?').get(session.sso_sub)
}
function isAdminAccount(account) {
  if (!account || Number(account.internal) !== 1 || !account.sso_sub) return false
  return !!db.prepare('SELECT 1 FROM admins WHERE sso_sub = ?').get(account.sso_sub)
}
function upsertUser(sub, email, name, internal, sseUserId) {
  const now = unixNow()
  db.prepare(`INSERT INTO users (sso_sub, email, name, internal, sse_user_id, created, last_seen)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(sso_sub) DO UPDATE SET email = excluded.email, name = excluded.name,
                internal = excluded.internal, sse_user_id = excluded.sse_user_id,
                last_seen = excluded.last_seen`)
    .run(String(sub), String(email), String(name), internal ? 1 : 0, String(sseUserId || ''), now, now)
}
function createSession({ ssoSub, email, name, internal, accountId, marketToken = '', marketUserId = '' }) {
  const sid = 'ms-' + crypto.randomBytes(24).toString('hex')
  db.prepare(`INSERT INTO sessions (sid, sso_sub, email, name, internal, account_id,
                                    market_token, market_user_id, created, last_seen)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(sid, String(ssoSub || ''), String(email || ''), String(name || ''), internal ? 1 : 0,
      Number(accountId || 0), String(marketToken || ''), String(marketUserId || ''), unixNow(), unixNow())
  return sid
}
function resolveSession(sid) {
  if (!sid) return null
  const row = db.prepare('SELECT * FROM sessions WHERE sid = ?').get(String(sid))
  if (!row) return null
  const now = unixNow()
  if (now - Number(row.last_seen) > SESSION_TTL) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(row.sid)
    return null
  }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE sid = ?').run(now, row.sid)
  row.last_seen = now
  return row
}
function sessionAccount(session) {
  if (!session) return null
  if (Number(session.account_id) > 0) {
    const account = accountById(session.account_id)
    if (account) return account
  }
  const email = String(session.email || '').trim().toLowerCase()
  const sub = session.sso_sub || `email:${email}`
  const accountId = upsertAccount(sub, email, session.name || email.split('@')[0], session.internal)
  db.prepare('UPDATE sessions SET account_id = ? WHERE sid = ?').run(accountId, session.sid)
  session.account_id = accountId
  return accountById(accountId)
}
function meJson(account) {
  if (!account) return null
  return {
    id: Number(account.id),
    name: account.name || account.email || '同学',
    email: account.email || '',
    school: account.school || '中山大学 · 软件工程学院',
    credit: Number(account.credit) || 96,
    isAdmin: isAdminAccount(account),
  }
}
const SESSION_COOKIE = 'mirror_sid'
function sessionCookie(sid, maxAge = SESSION_TTL) {
  return `${SESSION_COOKIE}=${sid}; Path=/; Max-Age=${Math.floor(maxAge)}; HttpOnly; SameSite=Lax`
}

/* ---------------------------------------------------------------- 社区：查询 */

function postRow(id) {
  const postId = Number(id)
  if (!Number.isInteger(postId) || postId <= 0) return null
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) || null
}
function countApplications(postId) {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM applications WHERE post_id = ?').get(postId).n)
}
function postJson(row, viewerId) {
  const author = accountById(row.author_id) || { id: row.author_id, name: '同学', school: '' }
  let price = row.price === null || row.price === undefined ? null : Number(row.price)
  if (row.price_type === 'negotiable') price = '面议'
  else if (row.price_type === 'mutual') price = 0
  let skills = []
  try { skills = JSON.parse(row.skills || '[]') } catch { skills = [] }
  return {
    id: Number(row.id),
    title: row.title,
    price,
    cat: row.cat,
    skills: Array.isArray(skills) ? skills : [],
    who: author.name || '同学',
    whoId: Number(author.id),
    when: fmtWhen(row.created),
    deadline: fmtDeadline(row.deadline),
    views: Number(row.views) || 0,
    applicants: countApplications(row.id),
    status: row.status,
    desc: row.description,
    mine: !!viewerId && Number(viewerId) === Number(row.author_id),
  }
}
function latestPostOfAuthor(authorId) {
  return db.prepare('SELECT * FROM posts WHERE author_id = ? ORDER BY created DESC LIMIT 1').get(authorId) || null
}
function messagesFor(threadId) {
  return db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY id').all(threadId)
}
function messageJson(row, viewerId) {
  return {
    t: Number(row.sender_id) === Number(viewerId) ? 'me' : 'them',
    type: row.kind === 'card' ? 'card' : 'text',
    text: row.kind === 'card' ? '' : row.text,
    postId: row.kind === 'card' ? Number(row.text) || undefined : undefined,
    name: row.file_name || undefined,
    size: row.file_size || undefined,
    at: fmtMessageTime(row.created),
  }
}
function peerJson(thread, viewerId) {
  const otherId = Number(thread.user_lo) === Number(viewerId) ? Number(thread.user_hi) : Number(thread.user_lo)
  const other = accountById(otherId) || { id: otherId, name: '对方', school: '', credit: 96, last_seen: 0 }
  const messages = messagesFor(thread.id)
  const last = messages.at(-1) || null
  const myRead = Number(thread.user_lo) === Number(viewerId) ? Number(thread.lo_read) : Number(thread.hi_read)
  const unread = messages.filter(item => Number(item.sender_id) !== Number(viewerId)
    && Number(item.created) > myRead).length
  const latest = latestPostOfAuthor(otherId)
  let skills = []
  try { skills = latest ? JSON.parse(latest.skills || '[]') : [] } catch { skills = [] }
  const relatedPost = thread.post_id ? postRow(thread.post_id) : latest
  return {
    id: otherId,
    name: other.name || '对方',
    school: other.school || '中山大学',
    online: unixNow() - Number(other.last_seen || 0) < 300,
    credit: Number(other.credit) || 96,
    skills: (Array.isArray(skills) ? skills : []).slice(0, 3),
    unread,
    postId: relatedPost ? Number(relatedPost.id) : 0,
    last: last ? (last.kind === 'card' ? '分享了一条需求' : last.text) : '开始沟通吧',
    time: fmtMessageTime(last ? last.created : thread.updated),
    messages: messages.map(item => messageJson(item, viewerId)),
  }
}
function listPosts(viewerId) {
  return db.prepare('SELECT * FROM posts ORDER BY created DESC, id DESC').all()
    .map(row => postJson(row, viewerId))
}
function bootstrap(viewerId) {
  const account = viewerId ? accountById(viewerId) : null
  const threads = viewerId
    ? db.prepare('SELECT * FROM threads WHERE user_lo = ? OR user_hi = ? ORDER BY updated DESC').all(viewerId, viewerId)
    : []
  const applied = viewerId
    ? db.prepare('SELECT post_id FROM applications WHERE user_id = ?').all(viewerId).map(row => Number(row.post_id))
    : []
  const favorites = viewerId
    ? db.prepare('SELECT post_id FROM favorites WHERE user_id = ?').all(viewerId).map(row => Number(row.post_id))
    : []
  return {
    me: meJson(account),
    posts: listPosts(viewerId),
    peers: threads.map(thread => peerJson(thread, viewerId)),
    applied,
    favorites,
    skills: SKILLS,
    cats: CATS,
  }
}

/* ---------------------------------------------------------------- 社区：写操作 */

function ensureThread(userA, userB, postId) {
  const lo = Math.min(Number(userA), Number(userB))
  const hi = Math.max(Number(userA), Number(userB))
  const now = unixNow()
  let row = db.prepare('SELECT * FROM threads WHERE user_lo = ? AND user_hi = ?').get(lo, hi)
  if (row) {
    if (postId) db.prepare('UPDATE threads SET post_id = ?, updated = ? WHERE id = ?').run(postId, now, row.id)
    else db.prepare('UPDATE threads SET updated = ? WHERE id = ?').run(now, row.id)
    return Number(row.id)
  }
  const info = db.prepare(`INSERT INTO threads (user_lo, user_hi, post_id, lo_read, hi_read, created, updated)
                           VALUES (?, ?, ?, 0, 0, ?, ?)`)
    .run(lo, hi, postId || null, now, now)
  return Number(info.lastInsertRowid)
}
function findThread(userA, userB) {
  const lo = Math.min(Number(userA), Number(userB))
  const hi = Math.max(Number(userA), Number(userB))
  return db.prepare('SELECT * FROM threads WHERE user_lo = ? AND user_hi = ?').get(lo, hi) || null
}
function markThreadRead(userId, peerId) {
  const thread = findThread(userId, peerId)
  if (!thread) return false
  const column = Number(thread.user_lo) === Number(userId) ? 'lo_read' : 'hi_read'
  db.prepare(`UPDATE threads SET ${column} = ? WHERE id = ?`).run(unixNow(), thread.id)
  return true
}
function markAllRead(userId) {
  const now = unixNow()
  db.prepare(`UPDATE threads SET lo_read = CASE WHEN user_lo = ? THEN ? ELSE lo_read END,
                                   hi_read = CASE WHEN user_hi = ? THEN ? ELSE hi_read END
              WHERE user_lo = ? OR user_hi = ?`).run(userId, now, userId, now, userId, userId)
}
function addMessage(userId, peerId, text) {
  const thread = findThread(userId, peerId)
  if (!thread) return { error: '会话不存在', status: 404 }
  const content = cleanText(text, 2000)
  if (!content) return { error: '消息不能为空', status: 400 }
  const info = db.prepare('INSERT INTO messages (thread_id, sender_id, kind, text, created) VALUES (?, ?, ?, ?, ?)')
    .run(thread.id, userId, 'text', content, unixNow())
  db.prepare('UPDATE threads SET updated = ? WHERE id = ?').run(unixNow(), thread.id)
  markThreadRead(userId, peerId)
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid)
  return { message: messageJson(row, userId) }
}
function countStatChats(postId, peerId) {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM stat_chats WHERE post_id = ? AND peer_id = ?')
    .get(postId, peerId).n)
}

/* ---------------------------------------------------------------- UniSSO / 集市 */

async function fetchJson(url, options = {}, timeout = 20000) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeout) })
  const text = await response.text()
  let payload = {}
  try { payload = text ? JSON.parse(text) : {} } catch { payload = {} }
  return { status: response.status, payload }
}
function formBody(values) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) params.set(key, String(value))
  return params
}
async function unissoPasswordVerify(email, password) {
  return fetchJson(`${UNISSO_ISSUER}/api/oauth/password/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'Mirror/3.0',
    },
    body: formBody({
      email, password,
      client_id: UNISSO_CLIENT_ID,
      client_secret: UNISSO_CLIENT_SECRET,
    }),
  })
}
async function unissoSessionCall(endpoint, session, timeout = 10000) {
  try {
    return await fetchJson(`${UNISSO_ISSUER}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'Mirror/3.0',
      },
      body: formBody({
        session,
        client_id: UNISSO_CLIENT_ID,
        client_secret: UNISSO_CLIENT_SECRET,
      }),
    }, timeout)
  } catch {
    return { status: 0, payload: {} }
  }
}
async function marketJson(apiPath, token, payload) {
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mirror-Auth/1.0' }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetchJson(`${MARKET_BASE}${apiPath}`, {
    method: payload === undefined ? 'GET' : 'POST',
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
}
async function provisionMarket(user, password) {
  if (!MARKET_TRUST_SECRET) throw new Error('provisioning is not configured')
  const { status, payload } = await fetchJson(`${MARKET_BASE}/api/sso/mirror/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Unisso-Trust': MARKET_TRUST_SECRET,
      'User-Agent': 'Mirror-Auth/1.0',
    },
    body: JSON.stringify({
      email: user.email,
      password,
      name: user.full_name || user.username || '',
    }),
  }, 15000)
  if (status !== 200 || payload.code !== 200) throw new Error('market provisioning failed')
  const data = payload.data || {}
  const marketUser = data.user || {}
  if (!data.token || !marketUser.userID) throw new Error('market provisioning response invalid')
  return { token: data.token, refreshToken: data.refresh_token, user: marketUser }
}
async function officialMarketToken() {
  if (!MARKET_OFFICIAL_EMAIL || !MARKET_OFFICIAL_PASSWORD)
    throw new Error('官方集市账号未配置（MARKET_OFFICIAL_EMAIL / MARKET_OFFICIAL_PASSWORD）')
  return provisionMarket({ email: MARKET_OFFICIAL_EMAIL, full_name: MARKET_OFFICIAL_NAME }, MARKET_OFFICIAL_PASSWORD)
}
async function marketCreateQuestPost(token, order) {
  const payload = {
    title: order.title,
    content: order.content,
    postKind: 'bounty',
    priceType: order.budget_type === 'range' ? 'range' : 'fixed',
  }
  if (order.budget_type === 'range') {
    payload.quotePriceMin = order.budget_min
    payload.quotePriceMax = order.budget_max
  } else if (order.budget_type === 'fixed') {
    payload.quotePrice = order.budget_min
  } else {
    payload.priceType = 'fixed'
    payload.quotePrice = 0
    payload.title = `${order.title}（预算面议）`
  }
  if (order.expect_date) payload.deadline = order.expect_date
  const { payload: body } = await marketJson('/api/auth/quest/create', token, payload)
  if (body.code !== undefined && Number(body.code) !== 200)
    throw new Error(body.msg || '集市发帖失败')
  const post = (body.data && body.data.post) || body.post || {}
  const postId = post.postID || post.post_id
  if (!postId) throw new Error('集市发帖未返回帖子 ID')
  return String(postId)
}
function finishLogin(user, email, req) {
  const sub = String(user.sub)
  const internal = user.internal === true
  const name = String(user.name || user.preferred_username || email.split('@')[0] || '').slice(0, 128)
  const sseUserId = String(user.sse_sub || '')
  upsertUser(sub, email, name, internal, sseUserId)
  const accountId = upsertAccount(sub, email, name, internal)
  const admin = isAdminSession({ internal: internal ? 1 : 0, sso_sub: sub })
  const sid = createSession({
    ssoSub: sub, email, name, internal, accountId,
  })
  if (admin) {
    provisionMarket({ email, full_name: name, username: user.preferred_username }, crypto.randomBytes(18).toString('base64url'))
      .then((result) => {
        db.prepare('UPDATE sessions SET market_token = ?, market_user_id = ? WHERE sid = ?')
          .run(String(result.token), String(result.user.userID || sseUserId), sid)
      })
      .catch((error) => {
        console.error(`[mirror] market provision warning: ${error.message}`)
      })
  }
  return { sid, token: '', isAdmin: admin, marketUserID: sseUserId, accountId }
}

/* ---------------------------------------------------------------- HTTP 基础 */

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
function jsonResponse(res, status, payload, headers = {}) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    ...headers,
  })
  res.end(body)
}
function reply(res, payload, status = 200, headers) {
  jsonResponse(res, status, payload, headers)
}
function fail(res, status, message) {
  jsonResponse(res, status, { error: message })
}
async function readJson(req, { optional = false } = {}) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'request too large')
    chunks.push(chunk)
  }
  if (!chunks.length) {
    if (optional) return {}
    throw new HttpError(400, 'invalid request size')
  }
  let value
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new HttpError(400, 'invalid JSON') }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'JSON object required')
  return value
}
function parseCookies(req) {
  const cookies = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    if (!part.includes('=')) continue
    const index = part.indexOf('=')
    cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  }
  return cookies
}
function sessionOf(req) {
  let sid = String(req.headers['x-mirror-session'] || '')
  if (!sid) {
    const auth = String(req.headers.authorization || '')
    if (auth.startsWith('Bearer ms-')) sid = auth.slice(7).trim()
  }
  if (!sid) sid = parseCookies(req)[SESSION_COOKIE] || ''
  return resolveSession(sid)
}
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket.remoteAddress || 'unknown'
}
const rateEvents = new Map()
function allowRate(key, limit = 120, seconds = 60) {
  const now = Date.now() / 1000
  let items = rateEvents.get(key) || []
  items = items.filter(item => now - item < seconds)
  if (items.length >= limit) { rateEvents.set(key, items); return false }
  items.push(now)
  rateEvents.set(key, items)
  return true
}

/* ---------------------------------------------------------------- 静态文件 */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function serveStatic(req, res, pathname) {
  let relative
  try { relative = decodeURIComponent(pathname) } catch { return fail(res, 400, 'bad path') }
  if (relative === '/' || relative === '') relative = '/index.html'
  const resolved = path.resolve(WEB_ROOT, '.' + relative)
  if (resolved !== WEB_ROOT && !resolved.startsWith(WEB_ROOT + path.sep))
    return fail(res, 403, 'forbidden')

  let stat = null
  try { stat = fs.statSync(resolved) } catch { stat = null }
  if (!stat || stat.isDirectory()) {
    if (path.extname(relative)) return fail(res, 404, 'not found')
    return serveFile(req, res, path.join(WEB_ROOT, 'index.html'))
  }
  return serveFile(req, res, resolved)
}
function serveFile(req, res, file) {
  let stat
  try { stat = fs.statSync(file) } catch { return fail(res, 404, 'not found') }
  if (!stat.isFile()) return fail(res, 404, 'not found')
  const ext = path.extname(file).toLowerCase()
  const body = fs.readFileSync(file)
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  }
  if (ext === '.html') {
    // 尽量穿透中继/浏览器缓存，避免用户拿到旧首页
    headers.Pragma = 'no-cache'
    headers.Expires = '0'
    headers['Surrogate-Control'] = 'no-store'
  }
  res.writeHead(200, headers)
  res.end(req.method === 'HEAD' ? undefined : body)
}

/* 社区 SPA（Svelte 构建产物，web/app/）。/app.html 是设计稿沿用的入口链接。 */
function serveSpa(req, res, pathname) {
  let relative = pathname === '/app.html' ? '/' : pathname.replace(/^\/app/, '') || '/'
  if (relative === '/' || relative === '') return serveFile(req, res, path.join(SPA_ROOT, 'index.html'))
  const resolved = path.resolve(SPA_ROOT, '.' + relative)
  if (resolved !== SPA_ROOT && !resolved.startsWith(SPA_ROOT + path.sep)) return fail(res, 403, 'forbidden')
  let stat = null
  try { stat = fs.statSync(resolved) } catch { stat = null }
  if (stat && stat.isFile()) return serveFile(req, res, resolved)
  if (path.extname(relative)) return fail(res, 404, 'not found')
  return serveFile(req, res, path.join(SPA_ROOT, 'index.html'))
}

/* ---------------------------------------------------------------- 社区 API */

function requireAccount(req, res) {
  const account = sessionAccount(sessionOf(req))
  if (!account) { fail(res, 401, '请先登录'); return null }
  return account
}

async function handleCommunityApi(req, res, pathname, query) {
  if (pathname === '/api/healthz') {
    return reply(res, { ok: true, service: 'mirror', stack: 'node', db: 'ok' })
  }
  if (pathname === '/api/project-inquiries') return submitProjectInquiry(req, res)
  // 前端诊断哨兵回传：落盘 + 打日志，便于排查白屏等渲染问题（不鉴权、限流）
  if (pathname === '/api/debug') {
    if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
    if (!allowRate('debug:' + clientIp(req), 60, 60)) return reply(res, { ok: true })
    let value = {}
    try { value = await readJson(req, { optional: true }) } catch { value = {} }
    const line = JSON.stringify({ t: new Date().toISOString(), ip: clientIp(req), ua: String(req.headers['user-agent'] || '').slice(0, 160), ...value })
    console.log('[mirror-debug]', line)
    try { fs.appendFileSync(path.join(ROOT, 'debug.log'), line + '\n') } catch {}
    return reply(res, { ok: true })
  }
  if (!allowRate('api:' + clientIp(req), 180, 60)) return fail(res, 429, '请求过于频繁，请稍后再试')

  if (req.method === 'GET') return communityGet(req, res, pathname, query)
  if (req.method === 'POST') return communityPost(req, res, pathname)
  return fail(res, 405, 'method not allowed')
}

function communityGet(req, res, pathname, query) {
  if (pathname === '/api/bootstrap') {
    const account = sessionAccount(sessionOf(req))
    return reply(res, bootstrap(account ? Number(account.id) : 0))
  }
  if (pathname === '/api/me') {
    const account = sessionAccount(sessionOf(req))
    return account ? reply(res, { user: meJson(account) }) : fail(res, 401, '请先登录')
  }
  if (pathname === '/api/posts') {
    const account = sessionAccount(sessionOf(req))
    const viewer = account ? Number(account.id) : 0
    let posts = listPosts(viewer)
    const cat = query.get('cat') || ''
    const skill = query.get('skill') || ''
    const keyword = (query.get('q') || '').trim().toLowerCase()
    if (cat && cat !== '全部') posts = posts.filter(post => post.cat === cat)
    if (skill) posts = posts.filter(post => post.skills.includes(skill))
    if (keyword) posts = posts.filter(post => `${post.title} ${post.desc} ${post.cat} ${post.skills.join(' ')} ${post.who}`.toLowerCase().includes(keyword))
    return reply(res, { posts, total: posts.length })
  }
  const detail = pathname.match(/^\/api\/posts\/(\d+)$/)
  if (detail) {
    const row = postRow(detail[1])
    if (!row) return fail(res, 404, '需求不存在')
    const account = sessionAccount(sessionOf(req))
    return reply(res, { post: postJson(row, account ? Number(account.id) : 0) })
  }
  if (pathname === '/api/threads') {
    const account = requireAccount(req, res)
    if (!account) return
    return reply(res, { peers: bootstrap(Number(account.id)).peers })
  }
  const thread = pathname.match(/^\/api\/threads\/(\d+)$/)
  if (thread) {
    const account = requireAccount(req, res)
    if (!account) return
    const row = findThread(account.id, thread[1])
    if (!row) return fail(res, 404, '会话不存在')
    return reply(res, { peer: peerJson(row, account.id) })
  }
  return fail(res, 404, 'not found')
}

async function communityPost(req, res, pathname) {
  if (pathname === '/api/auth/login') {
    const value = await readJson(req)
    if (!UNISSO_CLIENT_ID || !UNISSO_CLIENT_SECRET) return fail(res, 503, '统一认证尚未配置')
    const email = cleanText(value.email, 128).toLowerCase()
    const password = typeof value.password === 'string' ? value.password : ''
    if (!email || !password || password.length > 128) return fail(res, 400, '请输入邮箱和密码')
    if (!allowRate('login:' + clientIp(req), 10, 60)) return fail(res, 429, '尝试过于频繁，请稍后再试')
    let result
    try { result = await unissoPasswordVerify(email, password) }
    catch { return fail(res, 503, '统一认证暂时不可用，请稍后重试') }
    if (result.status === 400) return fail(res, 400, '邮箱或密码格式不正确')
    const user = (result.payload && result.payload.user) || {}
    if (result.status === 401 || !user.sub) return fail(res, 401, '邮箱或密码错误')
    if (result.status !== 200 || result.payload.ok !== true) return fail(res, 503, '统一认证暂时不可用，请稍后重试')
    const finalEmail = String(user.email || email).trim().toLowerCase()
    const login = finishLogin(user, finalEmail)
    const account = accountById(login.accountId)
    const headers = { 'Set-Cookie': sessionCookie(login.sid) }
    const ssoSession = String(result.payload.sso_session || '')
    if (ssoSession) {
      const name = String(result.payload.sso_cookie_name || 'unisso_sid')
      const domain = String(result.payload.sso_cookie_domain || '.ssemarket.cn')
      const maxAge = Number(result.payload.sso_max_age || 604800)
      headers['Set-Cookie'] = [
        sessionCookie(login.sid),
        `${name}=${ssoSession}; Domain=${domain}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
      ]
    }
    return reply(res, { ok: true, sid: login.sid, user: meJson(account), isAdmin: login.isAdmin }, 200, headers)
  }

  if (pathname === '/api/auth/sso/try') {
    if (!UNISSO_CLIENT_ID || !UNISSO_CLIENT_SECRET) return fail(res, 503, '统一认证尚未配置')
    if (!allowRate('sso:' + clientIp(req), 10, 60)) return fail(res, 429, '请求过于频繁')
    const cookies = parseCookies(req)
    const ssoSession = cookies.unisso_sid || cookies.sse_sso || ''
    if (!ssoSession) return fail(res, 401, 'no_sso')
    const result = await unissoSessionCall('/api/oauth/session/verify', ssoSession)
    if (result.status === 401) return fail(res, 401, 'invalid_sso')
    const user = (result.payload && result.payload.user) || {}
    if (result.status !== 200 || result.payload.ok !== true || !user.sub)
      return fail(res, 503, '统一认证暂时不可用')
    const email = String(user.email || '').trim().toLowerCase()
    const login = finishLogin(user, email)
    return reply(res, { ok: true, sid: login.sid, user: meJson(accountById(login.accountId)) }, 200,
      { 'Set-Cookie': sessionCookie(login.sid) })
  }

  if (pathname === '/api/auth/logout') {
    const session = sessionOf(req)
    const cookies = parseCookies(req)
    const ssoSession = cookies.unisso_sid || cookies.sse_sso || ''
    if (ssoSession) unissoSessionCall('/api/oauth/session/revoke', ssoSession, 5000).catch(() => {})
    if (session) db.prepare('DELETE FROM sessions WHERE sid = ?').run(session.sid)
    const cleared = [sessionCookie('', 0), 'unisso_sid=; Domain=.ssemarket.cn; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
      'sse_sso=; Domain=.ssemarket.cn; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']
    return reply(res, { ok: true }, 200, { 'Set-Cookie': cleared })
  }

  const account = requireAccount(req, res)
  if (!account) return
  const viewerId = Number(account.id)

  if (pathname === '/api/posts') {
    const value = await readJson(req)
    const title = cleanText(value.title, 60)
    if (!title) return fail(res, 400, '请填写需求标题（最多 60 字）')
    const desc = cleanText(value.desc, 4000)
    const cat = CATS.includes(value.cat) ? value.cat : '前端'
    let skills = Array.isArray(value.skills)
      ? value.skills.filter(item => typeof item === 'string').map(item => cleanText(item, 20)).filter(Boolean)
      : []
    skills = [...new Set(skills)].slice(0, 8)
    let priceType = ['fixed', 'negotiable', 'mutual'].includes(value.priceType) ? value.priceType : 'fixed'
    let price = 0
    if (priceType === 'mutual') price = 0
    else if (priceType === 'negotiable') price = null
    else {
      const result = parseAmount(value.price, moneyRules.labels.fixed)
      if (result.error) return fail(res, 400, result.error)
      price = result.amount
    }
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(value.deadline || '')) ? String(value.deadline) : ''
    const status = POST_STATUSES.includes(value.status) ? value.status : '招募中'
    const now = unixNow()
    const info = db.prepare(`INSERT INTO posts (title, description, cat, skills, price, price_type,
                             status, deadline, author_id, views, created, updated)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
      .run(title, desc, cat, JSON.stringify(skills), price, priceType, status, deadline, viewerId, now, now)
    const row = postRow(info.lastInsertRowid)
    return reply(res, { ok: true, post: postJson(row, viewerId) }, 201)
  }

  const apply = pathname.match(/^\/api\/posts\/(\d+)\/apply$/)
  if (apply) {
    const row = postRow(apply[1])
    if (!row) return fail(res, 404, '需求不存在')
    if (Number(row.author_id) === viewerId) return fail(res, 400, '不能报名自己发布的需求')
    db.prepare('INSERT OR IGNORE INTO applications (post_id, user_id, created) VALUES (?, ?, ?)')
      .run(row.id, viewerId, unixNow())
    return reply(res, { ok: true, applied: true, applicants: countApplications(row.id) })
  }

  const favorite = pathname.match(/^\/api\/posts\/(\d+)\/favorite$/)
  if (favorite) {
    const row = postRow(favorite[1])
    if (!row) return fail(res, 404, '需求不存在')
    const existing = db.prepare('SELECT 1 FROM favorites WHERE post_id = ? AND user_id = ?').get(row.id, viewerId)
    if (existing) {
      db.prepare('DELETE FROM favorites WHERE post_id = ? AND user_id = ?').run(row.id, viewerId)
      return reply(res, { ok: true, favorite: false })
    }
    db.prepare('INSERT INTO favorites (post_id, user_id, created) VALUES (?, ?, ?)')
      .run(row.id, viewerId, unixNow())
    return reply(res, { ok: true, favorite: true })
  }

  const view = pathname.match(/^\/api\/posts\/(\d+)\/view$/)
  if (view) {
    const row = postRow(view[1])
    if (!row) return fail(res, 404, '需求不存在')
    if (Number(row.author_id) !== viewerId) {
      const info = db.prepare('INSERT OR IGNORE INTO post_views (post_id, user_id, created) VALUES (?, ?, ?)')
        .run(row.id, viewerId, unixNow())
      if (Number(info.changes) > 0)
        db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(row.id)
    }
    return reply(res, { ok: true, views: Number(postRow(row.id).views) })
  }

  const status = pathname.match(/^\/api\/posts\/(\d+)\/status$/)
  if (status) {
    const row = postRow(status[1])
    if (!row) return fail(res, 404, '需求不存在')
    if (Number(row.author_id) !== viewerId) return fail(res, 403, '只有发布者可以修改状态')
    const value = await readJson(req)
    if (!POST_STATUSES.includes(value.status)) return fail(res, 400, '状态不合法')
    db.prepare('UPDATE posts SET status = ?, updated = ? WHERE id = ?').run(value.status, unixNow(), row.id)
    return reply(res, { ok: true, post: postJson(postRow(row.id), viewerId) })
  }

  if (pathname === '/api/threads/open') {
    const value = await readJson(req)
    let peerId = Number(value.peerId || 0)
    let post = null
    if (value.postId) {
      post = postRow(value.postId)
      if (!post) return fail(res, 404, '需求不存在')
      peerId = Number(post.author_id)
    } else if (peerId) {
      if (!accountById(peerId)) return fail(res, 404, '用户不存在')
      post = latestPostOfAuthor(peerId)
    } else return fail(res, 400, '缺少 postId 或 peerId')
    if (peerId === viewerId) return fail(res, 400, '不能和自己发起会话')
    const threadId = ensureThread(viewerId, peerId, post ? Number(post.id) : null)
    return reply(res, { ok: true, threadId, peerId })
  }

  const message = pathname.match(/^\/api\/threads\/(\d+)\/messages$/)
  if (message) {
    const value = await readJson(req)
    const result = addMessage(viewerId, message[1], value.text)
    if (result.error) return fail(res, result.status, result.error)
    return reply(res, { ok: true, message: result.message }, 201)
  }

  const read = pathname.match(/^\/api\/threads\/(\d+)\/read$/)
  if (read) {
    if (!markThreadRead(viewerId, read[1])) return fail(res, 404, '会话不存在')
    return reply(res, { ok: true })
  }

  if (pathname === '/api/threads/read-all') {
    markAllRead(viewerId)
    return reply(res, { ok: true })
  }

  return fail(res, 404, 'not found')
}

/* ---------------------------------------------------------------- 兼容 /mirror-api */

async function submitProjectInquiry(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
  if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json')
    return fail(res, 415, '请使用项目咨询表单提交')
  if (!allowRate('project-inquiry:' + clientIp(req), 12, 600))
    return fail(res, 429, '提交过于频繁，请稍后再试')

  const value = await readJson(req)
  const title = cleanText(value.title, 60)
  const description = cleanText(value.description, 3600)
  const organization = cleanText(value.organization, 120)
  const contactName = cleanText(value.contactName, 60)
  const contactMethod = cleanText(value.contactMethod, 120)
  if (!title || !description) return fail(res, 400, '请填写项目名称和需求说明')
  if (!contactName || !contactMethod) return fail(res, 400, '请留下联系人和联系方式')
  if (value.organization && !organization) return fail(res, 400, '请检查机构名称')
  if (typeof value.requestKey !== 'string' || !/^[0-9a-f]{32}$/.test(value.requestKey))
    return fail(res, 400, '提交凭据无效，请刷新后重试')

  const orderId = 'q' + value.requestKey
  const created = nowIso()
  const content = organization ? `项目单位：${organization}\n\n${description}` : description
  db.exec('BEGIN')
  try {
    const inserted = db.prepare(`INSERT INTO orders (
        id, title, content, contact_name, contact_method, owner_email, owner_name, created, updated, source
      ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
      .run(orderId, title, content, contactName, contactMethod, contactName, created, created, PROJECT_INQUIRY_SOURCE)
    if (inserted.changes) {
      db.prepare(`INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)
                  VALUES (?, 'create', 'pending', ?, '', 0, ?)`)
        .run(orderId, '官网项目咨询已提交', created)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return reply(res, { ok: true, orderId }, 201)
}

function orderJson(row, events) {
  const value = {
    id: row.id,
    title: row.title,
    content: row.content,
    budgetType: row.budget_type,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    contactName: row.contact_name,
    contactMethod: row.contact_method,
    expectDate: row.expect_date,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    marketPostId: row.market_post_id,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
    createdAt: row.created,
    updatedAt: row.updated,
  }
  if (row.source === PROJECT_INQUIRY_SOURCE) value.source = row.source
  if (events) value.events = events.map(event => ({
    type: event.type, status: event.status, note: event.note,
    actorEmail: event.actor_email, actorAdmin: !!event.actor_admin, createdAt: event.created,
  }))
  return value
}
function orderEvents(orderId) {
  return db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').all(orderId)
}
function noteJson(row) {
  return {
    id: Number(row.id), postID: String(row.post_id), authorID: String(row.author_id),
    authorName: row.author_name || authorDisplay.messages.fallback,
    content: row.content, createdAt: new Date(Number(row.created) * 1000).toISOString(),
  }
}

async function handleLegacyApi(req, res, pathname, query) {
  const pathPart = pathname.replace(/^\/mirror-api/, '') || '/'
  if (pathPart === '/healthz') return reply(res, { ok: true, service: 'mirror', db: 'ok' })

  if (req.method === 'GET') {
    if (!allowRate('legacy:' + clientIp(req), 120, 60)) return fail(res, 429, 'too many requests')
    if (pathPart === '/me') {
      const session = sessionOf(req)
      if (!session) return fail(res, 401, 'unauthorized')
      const account = sessionAccount(session)
      return reply(res, {
        email: session.email,
        name: session.name,
        sub: session.sso_sub,
        internal: !!Number(session.internal),
        isAdmin: isAdminSession(session),
        user: meJson(account),
      })
    }
    if (pathPart === '/orders/list') {
      const session = sessionOf(req)
      if (!session) return fail(res, 401, 'unauthorized')
      const admin = isAdminSession(session)
      const status = query.get('status') || ''
      let sql = 'SELECT * FROM orders'
      const where = []
      const params = []
      if (!(admin && (query.get('scope') || 'all') === 'all')) {
        where.push('owner_email = ? AND source != ?')
        params.push(session.email, PROJECT_INQUIRY_SOURCE)
      }
      if (status && ORDER_STATUSES.includes(status)) {
        where.push('status = ?')
        params.push(status)
      }
      if (where.length) sql += ' WHERE ' + where.join(' AND ')
      sql += ' ORDER BY created DESC LIMIT 200'
      const rows = db.prepare(sql).all(...params)
      return reply(res, { items: rows.map(row => orderJson(row)), total: rows.length })
    }
    if (pathPart === '/orders/detail') {
      const session = sessionOf(req)
      if (!session) return fail(res, 401, 'unauthorized')
      const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(String(query.get('id') || ''))
      if (!row) return fail(res, 404, '订单不存在')
      const admin = isAdminSession(session)
      if (!admin && (row.source === PROJECT_INQUIRY_SOURCE || row.owner_email !== session.email))
        return fail(res, 403, '无权查看')
      return reply(res, { order: orderJson(row, orderEvents(row.id)), viewerIsAdmin: admin })
    }
    if (pathPart === '/market/chat-history') {
      const session = sessionOf(req)
      if (!session || !isAdminSession(session)) return fail(res, 403, 'forbidden')
      const sender = query.get('senderUserID') || ''
      const target = query.get('targetUserID') || ''
      if (!sender || !target) return fail(res, 400, 'senderUserID and targetUserID required')
      try {
        const url = `${MARKET_BASE}/api/auth/getChatHistory?senderUserID=${encodeURIComponent(sender)}&targetUserID=${encodeURIComponent(target)}&threadAnonymous=false`
        const { payload } = await fetchJson(url, {
          headers: { Authorization: `Bearer ${session.market_token}`, 'User-Agent': 'Mirror-Auth/1.0' },
        }, 15000)
        return reply(res, payload)
      } catch (error) {
        return fail(res, 502, `获取集市消息失败：${error.message}`)
      }
    }
    if (pathPart === '/notes/list') {
      const postId = Number(query.get('postID') || 0)
      if (!Number.isInteger(postId) || postId <= 0) return fail(res, 400, noteError('postID'))
      const rows = db.prepare('SELECT * FROM post_notes WHERE post_id = ? ORDER BY id').all(postId)
      return reply(res, { notes: rows.map(noteJson), total: rows.length, maxPerPost: noteRules.maxPerPost })
    }
    if (pathPart === '/stats/get') {
      const postId = Number(query.get('postID') || 0)
      if (!Number.isInteger(postId) || postId <= 0) return fail(res, 400, '需求编号不合法')
      const views = Number(db.prepare('SELECT COUNT(*) AS n FROM post_views WHERE post_id = ?').get(postId).n)
      const chats = Number(db.prepare('SELECT COUNT(*) AS n FROM stat_chats WHERE post_id = ?').get(postId).n)
      return reply(res, { postID: String(postId), view: views, chat: chats })
    }
    return fail(res, 404, 'not found')
  }

  if (req.method !== 'POST') return fail(res, 405, 'method not allowed')
  if (!allowRate('legacy:' + clientIp(req), 60, 60)) return fail(res, 429, 'too many requests')
  const value = await readJson(req, { optional: true })
  const session = sessionOf(req)

  if (pathPart === '/auth/login') {
    if (!UNISSO_CLIENT_ID || !UNISSO_CLIENT_SECRET) return fail(res, 503, 'sso client misconfigured')
    const email = cleanText(value.email, 128).toLowerCase()
    const password = typeof value.password === 'string' ? value.password : ''
    if (!email || !password) return fail(res, 400, 'email and password are required')
    const result = await unissoPasswordVerify(email, password)
    if (result.status === 400) return fail(res, 400, 'email and password are required')
    const user = (result.payload && result.payload.user) || {}
    if (result.status !== 200 || result.payload.ok !== true || !user.sub)
      return fail(res, 503, 'service unavailable')
    const finalEmail = String(user.email || email).trim().toLowerCase()
    const login = finishLogin(user, finalEmail)
    const headers = {}
    const ssoSession = String(result.payload.sso_session || '')
    if (ssoSession) {
      const name = String(result.payload.sso_cookie_name || 'unisso_sid')
      const domain = String(result.payload.sso_cookie_domain || '.ssemarket.cn')
      const maxAge = Number(result.payload.sso_max_age || 604800)
      headers['Set-Cookie'] = `${name}=${ssoSession}; Domain=${domain}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
    }
    return reply(res, {
      sid: login.sid, token: login.token, isAdmin: login.isAdmin,
      marketUserID: login.marketUserID, user: meJson(accountById(login.accountId)),
    }, 200, headers)
  }

  if (pathPart === '/auth/sso/try') {
    if (!UNISSO_CLIENT_ID || !UNISSO_CLIENT_SECRET) return fail(res, 503, 'sso client misconfigured')
    if (!allowRate('sso:' + clientIp(req), 10, 60)) return fail(res, 429, 'too many requests')
    const cookies = parseCookies(req)
    const ssoSession = cookies.unisso_sid || cookies.sse_sso || ''
    if (!ssoSession) return fail(res, 401, 'no_sso')
    const result = await unissoSessionCall('/api/oauth/session/verify', ssoSession)
    if (result.status === 401) return fail(res, 401, 'invalid_sso')
    const user = (result.payload && result.payload.user) || {}
    if (result.status !== 200 || result.payload.ok !== true || !user.sub)
      return fail(res, 503, 'sso_unavailable')
    const email = String(user.email || '').trim().toLowerCase()
    const login = finishLogin(user, email)
    return reply(res, { sid: login.sid, token: login.token, isAdmin: login.isAdmin,
      marketUserID: login.marketUserID, user: meJson(accountById(login.accountId)) })
  }

  if (pathPart === '/auth/logout') {
    if (session) db.prepare('DELETE FROM sessions WHERE sid = ?').run(session.sid)
    const cookies = parseCookies(req)
    const ssoSession = cookies.unisso_sid || cookies.sse_sso || ''
    if (ssoSession) unissoSessionCall('/api/oauth/session/revoke', ssoSession, 5000).catch(() => {})
    return reply(res, { ok: true }, 200, {
      'Set-Cookie': ['unisso_sid=; Domain=.ssemarket.cn; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
        'sse_sso=; Domain=.ssemarket.cn; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'],
    })
  }

  const account = sessionAccount(session)
  if (!account) return fail(res, 401, 'unauthorized')

  if (pathPart === '/orders/create') {
    const title = cleanText(value.title, 60)
    const content = cleanText(value.content, 4000)
    const contactName = cleanText(value.contactName, 60)
    const contactMethod = cleanText(value.contactMethod, 120)
    if (!title || !content) return fail(res, 400, '请填写需求标题和描述')
    if (!contactName || !contactMethod) return fail(res, 400, '请留下称呼和联系方式')
    const budget = validateBudget(value)
    if (budget.error) return fail(res, 400, budget.error)
    const orderId = 'o' + crypto.randomBytes(8).toString('hex')
    const created = nowIso()
    db.prepare(`INSERT INTO orders (id, title, content, budget_type, budget_min, budget_max,
                 contact_name, contact_method, expect_date, owner_email, owner_name, status, created, updated)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
      .run(orderId, title, content, budget.type, budget.min, budget.max, contactName, contactMethod,
        cleanText(value.expectDate, 32), session.email, session.name, created, created)
    db.prepare(`INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)
                VALUES (?, 'create', 'pending', ?, ?, 0, ?)`)
      .run(orderId, '需求已提交', session.email, created)
    return reply(res, { ok: true, orderId }, 201)
  }

  if (pathPart === '/orders/status') {
    if (!isAdminSession(session)) return fail(res, 403, 'forbidden')
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(String(value.id || ''))
    if (!row || !ORDER_STATUSES.includes(value.status)) return fail(res, 400, '订单或状态无效')
    const updated = nowIso()
    db.prepare('UPDATE orders SET status = ?, updated = ? WHERE id = ?').run(value.status, updated, row.id)
    db.prepare(`INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)
                VALUES (?, 'status', ?, ?, ?, 1, ?)`)
      .run(row.id, value.status, cleanText(value.note, 500) || STATUS_LABELS[value.status] || value.status,
        session.email, updated)
    return reply(res, { ok: true })
  }

  if (pathPart === '/orders/forward') {
    if (!isAdminSession(session)) return fail(res, 403, 'forbidden')
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(String(value.id || ''))
    if (!row) return fail(res, 404, '订单不存在')
    if (row.source === PROJECT_INQUIRY_SOURCE) return fail(res, 403, '官网项目咨询仅供内部跟进')
    if (row.market_post_id) return reply(res, { error: '该需求已转发过集市', postId: row.market_post_id }, 409)
    try {
      let token = session.market_token
      let by = session.email
      if (value.as !== 'self') {
        const official = await officialMarketToken()
        token = official.token
        by = MARKET_OFFICIAL_EMAIL
      }
      if (!token) throw new Error('当前管理员会话缺少集市凭据，请重新登录后再试')
      const postId = await marketCreateQuestPost(token, row)
      const updated = nowIso()
      db.prepare('UPDATE orders SET market_post_id = ?, market_post_by = ?, updated = ? WHERE id = ?')
        .run(postId, by, updated, row.id)
      db.prepare(`INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)
                  VALUES (?, 'forward', '', ?, ?, 1, ?)`)
        .run(row.id, `已转发到软工集市（帖子 ${postId}，由 ${by} 发布）`, session.email, updated)
      return reply(res, { ok: true, postId, postUrl: `${MARKET_BASE}/#/post/${postId}` })
    } catch (error) {
      return fail(res, 502, `转发失败：${error.message}`)
    }
  }

  if (pathPart === '/notes/add') {
    const postId = Number(value.postID || 0)
    const post = postRow(postId)
    if (!post) return fail(res, 404, noteError('notFound'))
    if (Number(post.author_id) !== Number(account.id)) return fail(res, 403, noteError('forbidden'))
    const count = Number(db.prepare('SELECT COUNT(*) AS n FROM post_notes WHERE post_id = ?').get(postId).n)
    if (count >= noteRules.maxPerPost) return fail(res, 400, noteError('tooMany'))
    const note = normalizeNote(value.content)
    if (note.error) return fail(res, 400, note.error)
    const info = db.prepare('INSERT INTO post_notes (post_id, author_id, author_name, content, created) VALUES (?, ?, ?, ?, ?)')
      .run(postId, account.id, account.name, note.content, unixNow())
    return reply(res, { ok: true, note: noteJson(db.prepare('SELECT * FROM post_notes WHERE id = ?').get(info.lastInsertRowid)) }, 201)
  }

  if (pathPart === '/stats/view') {
    const postId = Number(value.postID || 0)
    const post = postRow(postId)
    if (!post) return fail(res, 404, '这条需求不存在或已被删除')
    if (Number(post.author_id) !== Number(account.id)) {
      const info = db.prepare('INSERT OR IGNORE INTO post_views (post_id, user_id, created) VALUES (?, ?, ?)')
        .run(postId, account.id, unixNow())
      if (Number(info.changes) > 0) db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(postId)
    }
    return reply(res, { ok: true, postID: String(postId) })
  }

  if (pathPart === '/stats/chat') {
    const postId = Number(value.postID || 0)
    const peerId = Number(value.peerID || 0)
    const post = postRow(postId)
    if (!post) return fail(res, 404, '这条需求不存在或已被删除')
    if (!peerId) return fail(res, 400, '对方编号不合法')
    if (peerId !== Number(account.id)) {
      db.prepare('INSERT OR IGNORE INTO stat_chats (post_id, user_id, peer_id, created) VALUES (?, ?, ?, ?)')
        .run(postId, account.id, peerId, unixNow())
    }
    return reply(res, { ok: true, postID: String(postId), chat: countStatChats(postId, peerId) })
  }

  return fail(res, 404, 'not found')
}

/* ---------------------------------------------------------------- 路由 */

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { return fail(res, 400, 'bad path') }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { Allow: 'GET, HEAD, POST, OPTIONS' })
    return res.end()
  }
  if (pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST')
      return fail(res, 405, 'method not allowed')
    return handleCommunityApi(req, res, pathname, url.searchParams)
  }
  if (pathname.startsWith('/mirror-api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST')
      return fail(res, 405, 'method not allowed')
    return handleLegacyApi(req, res, pathname, url.searchParams)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'method not allowed')
  if (pathname === '/app.html' || pathname === '/app' || pathname.startsWith('/app/'))
    return serveSpa(req, res, pathname)
  return serveStatic(req, res, pathname)
}

const server = http.createServer((req, res) => {
  const started = Date.now()
  res.on('finish', () => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/mirror-api/') || res.statusCode >= 400)
      console.log(`${new Date().toISOString()} ${req.socket.remoteAddress} "${req.method} ${req.url}" ${res.statusCode} ${Date.now() - started}ms`)
  })
  handle(req, res).catch((error) => {
    if (error instanceof HttpError) return fail(res, error.status, error.message)
    console.error(`[mirror] ${error.stack || error}`)
    if (!res.headersSent) fail(res, 503, 'service unavailable')
    else res.end()
  })
})

if (!UNISSO_CLIENT_ID || !UNISSO_CLIENT_SECRET)
  console.warn('[mirror] UNISSO_CLIENT_ID / UNISSO_CLIENT_SECRET 未配置：登录接口会返回 503')
if (!MARKET_TRUST_SECRET)
  console.warn('[mirror] MARKET_TRUST_SECRET 未配置：集市转发不可用')

server.listen(PORT, HOST, () => {
  console.log(`[mirror] Node community server listening on http://${HOST}:${PORT}`)
  console.log(`[mirror] static: ${WEB_ROOT}`)
  console.log(`[mirror] db: ${DB_PATH}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[mirror] ${signal} received, shutting down`)
    server.close(() => {
      try { db.close() } catch {}
      process.exit(0)
    })
    setTimeout(() => process.exit(0), 5000).unref()
  })
}