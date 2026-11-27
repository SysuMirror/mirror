import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

export const root = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(root, '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

const configuredPath = process.env.MIRROR_DB || 'mirror.db'
export const databasePath = configuredPath === ':memory:' ? configuredPath : path.resolve(root, configuredPath)
export const statuses = ['pending', 'accepted', 'in_progress', 'done', 'closed']
const source = 'project_inquiry'

function cleanText(value, max) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) ? text : ''
}

export function validateInquiry(value) {
  const title = cleanText(value.title, 60)
  const description = cleanText(value.description, 3600)
  const organization = cleanText(value.organization, 120)
  const contactName = cleanText(value.contactName, 60)
  const contactMethod = cleanText(value.contactMethod, 120)
  if (!title || !description) return { error: '请填写项目名称和需求说明。' }
  if (!contactName || !contactMethod) return { error: '请留下联系人和联系方式。' }
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactMethod)
  const phone = /^[+\d().\s-]+$/.test(contactMethod) && contactMethod.replace(/\D/g, '').length >= 7
  if (!email && !phone) return { error: '请填写可联系的邮箱或电话号码。' }
  if (value.organization && !organization) return { error: '请检查机构名称。' }
  if (typeof value.requestKey !== 'string' || !/^[0-9a-f]{32}$/.test(value.requestKey))
    return { error: '提交凭据无效，请刷新页面后重试。' }
  return { title, description, organization, contactName, contactMethod, id: 'q' + value.requestKey }
}

export function openInquiries({ initialize = false } = {}) {
  if (!initialize && (databasePath === ':memory:' || !existsSync(databasePath)))
    throw new Error(`找不到持久化工单数据库，请检查 MIRROR_DB：${databasePath}`)
  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA busy_timeout = 5000')
  if (initialize) {
    db.exec('PRAGMA journal_mode = WAL')
    transaction(db, () => {
      db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        contact_name TEXT NOT NULL DEFAULT '',
        contact_method TEXT NOT NULL DEFAULT '',
        owner_email TEXT NOT NULL,
        owner_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        created TEXT NOT NULL,
        updated TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'legacy'
      );
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
    `)
      if (!db.prepare('PRAGMA table_info(orders)').all().some(column => column.name === 'source'))
        db.exec("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy'")
      db.exec('CREATE INDEX IF NOT EXISTS idx_orders_source_created ON orders(source, created DESC)')
    })
  }
  return db
}

function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function recordEvent(db, id, type, status, note, actorAdmin, date) {
  db.prepare(`INSERT INTO order_events (order_id, type, status, note, actor_admin, created)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, type, status, note, actorAdmin, date)
}

export function createInquiry(db, request) {
  const date = new Date().toISOString()
  const content = request.organization ? `项目单位：${request.organization}\n\n${request.description}` : request.description
  return transaction(db, () => {
    const written = db.prepare(`INSERT INTO orders (
      id, title, content, contact_name, contact_method, owner_email, owner_name, created, updated, source
    ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
      .run(request.id, request.title, content, request.contactName, request.contactMethod, request.contactName, date, date, source)
    if (written.changes) {
      recordEvent(db, request.id, 'create', 'pending', '官网项目咨询已提交', 0, date)
      return true
    }
    return false
  })
}

export function listInquiries(db, status) {
  return db.prepare(`SELECT id, title, status, created, updated FROM orders
                     WHERE source = ? AND (? IS NULL OR status = ?)
                     ORDER BY created DESC, id DESC`).all(source, status ?? null, status ?? null)
}

export function getInquiry(db, id) {
  const row = db.prepare(`SELECT id, title, content, contact_name, contact_method, status, created, updated
                          FROM orders WHERE id = ? AND source = ?`).get(id, source)
  if (!row) return null
  const events = db.prepare('SELECT type, status, note, created FROM order_events WHERE order_id = ? ORDER BY id').all(id)
  return { ...row, events }
}

export function updateInquiry(db, id, status, note) {
  const date = new Date().toISOString()
  return transaction(db, () => {
    const changed = db.prepare('UPDATE orders SET status = ?, updated = ? WHERE id = ? AND source = ?')
      .run(status, date, id, source)
    if (!changed.changes) return false
    recordEvent(db, id, 'status', status, note, 1, date)
    return true
  })
}
