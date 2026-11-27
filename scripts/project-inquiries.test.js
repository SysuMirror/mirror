import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'

function start(env) {
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  const exit = once(child, 'exit')
  let output = ''
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('工单服务器启动超时：' + output)), 8000)
    child.stdout.on('data', data => {
      output += data
      const address = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)
      if (address) {
        clearTimeout(timer)
        resolve(address[0])
      }
    })
    child.stderr.on('data', data => { output += data })
    exit.then(([code]) => {
      clearTimeout(timer)
      reject(new Error(`服务器已退出（${code}）：${output}`))
    }, error => {
      clearTimeout(timer)
      reject(error)
    })
  })
  return {
    ready,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill()
      await exit
    },
  }
}

test('官网工单持久化、重复提交和团队跟进，旧接口下线', async () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'mirror-inquiries-'))
  const dbFile = path.join(folder, 'mirror.db')
  const env = { ...process.env, MIRROR_DB: dbFile, HOST: '127.0.0.1', PORT: '0' }
  const legacy = new DatabaseSync(dbFile)
  legacy.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '', contact_method TEXT NOT NULL DEFAULT '',
      owner_email TEXT NOT NULL, owner_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending', created TEXT NOT NULL, updated TEXT NOT NULL
    );
    INSERT INTO orders (id, title, content, owner_email, created, updated)
      VALUES ('o-old', '旧工单', '历史内容', 'old@example.com', '2026-08-01', '2026-08-01');
  `)
  legacy.close()

  let service = start(env)
  try {
    const base = await service.ready
    const payload = {
      title: '官网工单联调', description: '需要开发一个报表工具。', organization: '测试单位',
      contactName: '测试联系人', contactMethod: 'fixture@example.com', requestKey: '4e4cf5aac01346d096ba4d3ba6815103',
    }
    function submit(body) {
      return fetch(base + '/api/project-inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    assert.equal((await submit({ ...payload, contactMethod: '无效地址' })).status, 400)
    const first = await submit(payload)
    assert.equal(first.status, 201)
    const order = await first.json()
    const duplicate = await submit(payload)
    assert.equal(duplicate.status, 200)
    assert.deepEqual(await duplicate.json(), order)
    assert.equal((await fetch(base + '/api/project-inquiries')).status, 405)
    assert.equal((await fetch(base + '/mirror-api/orders/list')).status, 404)
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST' })).status, 404)
    assert.equal((await fetch(base + '/mirror-api/orders/forward', { method: 'POST' })).status, 404)
    const oldPage = await fetch(base + '/app.html?go=login', { redirect: 'manual' })
    assert.equal(oldPage.status, 302)
    assert.equal(oldPage.headers.get('Location'), '/')

    await service.stop()
    service = start(env)
    await service.ready

    function cli(...args) {
      const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/project-inquiries.js', ...args], { env, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      return JSON.parse(result.stdout)
    }
    assert.deepEqual(cli('list', 'pending').map(row => row.id), [order.orderId])
    const actual = cli('show', order.orderId)
    assert.equal(actual.contact_method, payload.contactMethod)
    assert.match(actual.content, /测试单位/)
    assert.equal(actual.events.length, 1)
    cli('status', order.orderId, 'accepted', '已安排需求沟通')
    assert.deepEqual(cli('list', 'pending'), [])
    assert.equal(cli('show', order.orderId).events.at(-1).note, '已安排需求沟通')
    const saved = new DatabaseSync(dbFile, { readOnly: true })
    try {
      assert.equal(saved.prepare("SELECT title FROM orders WHERE id = 'o-old'").get().title, '旧工单')
    } finally {
      saved.close()
    }
  } finally {
    await service.stop()
    rmSync(folder, { recursive: true, force: true })
  }
})
