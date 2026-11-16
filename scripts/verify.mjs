#!/usr/bin/env node
/**
 * 生产就绪自检：一条命令验证规则一致、无调试残留、接口层无重复、前后端金额口径一致。
 * 零新增依赖（只用 Node 内置模块 + 仓库自带的 Python）。
 * 用法：在 web/ 下 `npm run verify`，或在仓库根 `node scripts/verify.mjs`。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// 仓库外的 dev 单元是可选的：dev Pod 上没有本地试玩包目录，
// 自检仍要能完整验证仓库本身。可用 MIRROR_DEV_ENV 显式指定。
const DEV_ENV = process.env.MIRROR_DEV_ENV
  ? resolve(process.env.MIRROR_DEV_ENV)
  : resolve(REPO, '..', 'dev-env')
const checks = []
const failures = []

function ok(name, cond, detail = '') {
  checks.push(name)
  if (!cond)
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function read(path) {
  return readFileSync(path, 'utf8')
}

function walk(dir, exts, out = []) {
  if (!existsSync(dir))
    return out
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'dist' && name !== '__pycache__')
        walk(path, exts, out)
    }
    else if (exts.some(ext => name.endsWith(ext))) {
      out.push(path)
    }
  }
  return out
}

const short = p => relative(REPO, p).replaceAll('\\', '/')

// ---------------------------------------------------------------- 1. 契约
const contractPath = join(REPO, 'contracts', 'money-rules.json')
ok('金额契约文件存在', existsSync(contractPath))
if (!existsSync(contractPath)) {
  console.error('缺少 contracts/money-rules.json，无法继续')
  process.exit(1)
}
const rules = JSON.parse(read(contractPath))
ok('金额契约字段合法', rules.min > 0 && rules.max > rules.min && rules.maxDecimalPlaces >= 0)
ok('金额区间符合产品口径 1–1000 元', rules.min === 1 && rules.max === 1000)

// 补充说明契约同样只有一份，数值、文案、净化规则都要跨端一致。
const noteContract = join(REPO, 'contracts', 'note-rules.json')
ok('补充说明契约文件存在', existsSync(noteContract))
if (!existsSync(noteContract)) {
  console.error('缺少 contracts/note-rules.json，无法继续')
  process.exit(1)
}
const noteRules = JSON.parse(read(noteContract))
ok('补充说明契约字段合法',
  !!noteRules && noteRules.minLength > 0 && noteRules.maxLength >= noteRules.minLength
  && noteRules.maxPerPost > 0)

// 浏览 / 沟通计数同样只有一份契约，去重口径与文案跨端一致。
const statsContract = join(REPO, 'contracts', 'post-stats.json')
ok('浏览/沟通计数契约文件存在', existsSync(statsContract))
if (!existsSync(statsContract)) {
  console.error('缺少 contracts/post-stats.json，无法继续')
  process.exit(1)
}
const statsRules = JSON.parse(read(statsContract))
ok('计数契约字段合法',
  !!statsRules && !!statsRules.dedupe?.view && !!statsRules.dedupe?.chat
  && !!statsRules.messages?.login && !!statsRules.messages?.postID)

// 发布者展示：authorID 才是身份，authorName 等只是发布当时的快照，改名后展示时重新解析。
const authorContract = join(REPO, 'contracts', 'author-display.json')
ok('发布者展示契约文件存在', existsSync(authorContract))
if (!existsSync(authorContract)) {
  console.error('缺少 contracts/author-display.json，无法继续')
  process.exit(1)
}
const authorRules = JSON.parse(read(authorContract))
ok('发布者展示契约字段合法',
  !!authorRules && authorRules.identityField === 'authorID'
  && authorRules.accountIdField === 'userID' && authorRules.match === 'loose-string'
  && authorRules.fields?.authorName === 'name'
  && authorRules.messages?.fallback)

const pyModule = join(REPO, 'contracts', 'money_rules.py')
const units = [
  { name: 'dev 网关', dir: DEV_ENV },
  { name: '本地试玩包', dir: join(DEV_ENV, 'Mirror本地试玩') },
]
for (const unit of units) {
  if (!existsSync(unit.dir)) {
    console.log(`  [skip] ${unit.name} 契约副本（当前环境没有该目录）`)
    continue
  }
  const jsonCopy = join(unit.dir, 'money-rules.json')
  const pyCopy = join(unit.dir, 'money_rules.py')
  ok(`${unit.name} 契约副本齐全`, existsSync(jsonCopy) && existsSync(pyCopy))
  if (existsSync(jsonCopy)) {
    ok(`${unit.name} 规则数值一致`,
      JSON.stringify(JSON.parse(read(jsonCopy))) === JSON.stringify(rules))
  }
  if (existsSync(pyCopy)) {
    ok(`${unit.name} 校验实现一致`, read(pyCopy).trim() === read(pyModule).trim())
  }
  for (const file of ['note-rules.json', 'note_rules.py', 'notes.py', 'post-stats.json', 'post_stats.py', 'author-display.json', 'author_display.py']) {
    const copy = join(unit.dir, file)
    const source = join(REPO, 'contracts', file)
    ok(`${unit.name} ${file} 副本齐全`, existsSync(copy))
    if (existsSync(copy))
      ok(`${unit.name} ${file} 与仓库一致`, read(copy).trim() === read(source).trim())
  }
}

// ---------------------------------------------------------------- 2. 各端是否复用统一实现
const moneyJs = read(join(REPO, 'web', 'src', 'utils', 'money.js'))
ok('前端金额模块引用同一契约', moneyJs.includes('contracts/money-rules.json'))
ok('前端无硬编码金额上限', !/99999|MONEY_MAX\s*=\s*\d/.test(moneyJs))

const serverPy = read(join(REPO, 'server.py'))
ok('生产后端复用 validate_budget',
  serverPy.includes('from contracts.money_rules import validate_budget')
  && serverPy.includes('validate_budget(value)'))
ok('生产后端无旧 float 校验残留', !serverPy.includes('预算金额无效'))

for (const file of [join(DEV_ENV, 'dev_gateway.py'), join(DEV_ENV, 'Mirror本地试玩', 'server.py')]) {
  if (!existsSync(file)) {
    console.log(`  [skip] ${short(file)} 复用统一校验（当前环境没有该文件）`)
    continue
  }
  const text = read(file)
  ok(`${short(file)} 复用统一校验`,
    text.includes('validate_quest_price as validate_price') && !text.includes('MONEY_MAX ='))
  ok(`${short(file)} 复用统一批注实现`,
    text.includes('from notes import NoteStore, handle_notes')
    && text.includes('handle_notes(') && !/MAX_LENGTH\s*=\s*\d/.test(text))
  ok(`${short(file)} 复用统一计数实现`,
    text.includes('from post_stats import PostStatStore, handle_stats')
    && text.includes('handle_stats(')
    && !/每点开一次详情记一次浏览/.test(text))
}

const noteJs = read(join(REPO, 'web', 'src', 'utils', 'note.js'))
ok('前端补充说明模块引用同一契约', noteJs.includes('contracts/note-rules.json'))
ok('前端无硬编码补充说明上限', !/NOTE_MAX_LENGTH\s*=\s*\d|maxLength\s*:\s*\d/.test(noteJs))
ok('生产后端复用统一批注实现',
  serverPy.includes('from contracts.notes import NoteStore, handle_notes')
  && serverPy.includes('handle_notes('))
ok('生产后端复用统一计数实现',
  serverPy.includes('from contracts.post_stats import PostStatStore, handle_stats')
  && serverPy.includes('handle_stats('))
ok('计数接口统一走请求层',
  read(join(REPO, 'web', 'src', 'api', 'stats.js')).includes("from './client'"))
const detailVue = read(join(REPO, 'web', 'src', 'components', 'QuestDetail.vue'))
ok('详情页只在上报别人的帖子浏览',
  /if \(!isOwner\.value\)\s*void syncViewCount/.test(detailVue))
ok('详情页展示浏览与沟通数',
  detailVue.includes('statCount(post.viewCount)') && detailVue.includes('statCount(post.chatCount)'))
const messagesVue = read(join(REPO, 'web', 'src', 'views', 'MessagesView.vue'))
ok('私信页从需求发起时上报沟通',
  messagesVue.includes('recordPostChat(postID.value, peerID.value)'))
const authorJs = read(join(REPO, 'web', 'src', 'utils', 'author.js'))
ok('前端发布者展示模块引用同一契约', authorJs.includes('contracts/author-display.json'))
// 生产后端只核实 authorID 归属、不返回帖子内容，作者名由前端按契约解析。
ok('生产后端不自行渲染作者名快照', !serverPy.includes('authorName'))
for (const [file, needle] of [
  ['QuestCard.vue', 'withCurrentAuthor('],
  ['QuestDetail.vue', 'withCurrentAuthor('],
  ['AuthorNotes.vue', 'withCurrentAuthor('],
  ['PostPreview.vue', 'authorID:'],
]) {
  const text = read(join(REPO, 'web', 'src', 'components', file))
  ok(`${file} 复用统一发布者展示解析`, text.includes(needle))
}
for (const file of [join(DEV_ENV, 'dev_gateway.py'), join(DEV_ENV, 'Mirror本地试玩', 'server.py')]) {
  if (!existsSync(file)) {
    console.log(`  [skip] ${short(file)} 复用发布者展示（当前环境没有该文件）`)
    continue
  }
  const text = read(file)
  ok(`${short(file)} 复用统一发布者展示`,
    text.includes('from author_display import with_current_author')
    && text.includes('with_current_author(dict(post), state["me"])'))
}
// 历史数据绝不批量回写：改名只影响展示，不抹掉发布当时的原始记录。
for (const file of [join(DEV_ENV, 'dev_gateway.py'), join(DEV_ENV, 'Mirror本地试玩', 'server.py')]) {
  if (existsSync(file))
    ok(`${short(file)} 改名不回写历史帖子`,
      !/for\s+p\s+in\s+st\["posts"\][\s\S]{0,160}authorName\]\s*=/.test(read(file)))
}

const mainCss = read(join(REPO, 'web', 'src', 'styles', 'main.css'))
ok('会话列表红点与时间在桌面可见',
  !/\.peer-item__side\s*\{\s*display:\s*none/.test(mainCss)
  && /\.peer-item__side\s*\{[^}]*display:\s*flex/s.test(mainCss))
ok('背景为低饱和多层渐变',
  mainCss.includes('radial-gradient') && mainCss.includes('linear-gradient(178deg'))
ok('私信页桌面撑满可用高度',
  mainCss.includes('min-height: calc(100vh - 190px)'))
ok('批注正文不经 v-html 渲染',
  !/v-html/.test(read(join(REPO, 'web', 'src', 'components', 'AuthorNotes.vue'))))
ok('批注接口统一走请求层',
  read(join(REPO, 'web', 'src', 'api', 'notes.js')).includes("from './client'"))

// ---------------------------------------------------------------- 3. 静态卫生
const srcFiles = walk(join(REPO, 'web', 'src'), ['.js', '.vue', '.css'])
const dirty = srcFiles.filter(f => /console\.(log|debug)\b|debugger\b|TODO|FIXME|\?v=/.test(read(f)))
ok('前端无调试残留 / 缓存串', dirty.length === 0, dirty.map(short).join(', '))

const fetchFiles = srcFiles.filter(f => /\bfetch\s*\(/.test(read(f)))
ok('接口请求只从 api/client.js 发出',
  fetchFiles.length === 1 && fetchFiles[0].replaceAll('\\', '/').endsWith('api/client.js'),
  fetchFiles.map(short).join(', '))

const css = read(join(REPO, 'web', 'src', 'styles', 'main.css'))
const allSrc = srcFiles.filter(f => !f.endsWith('main.css')).map(read).join('\n')
const cssClasses = [...new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(m => m[1]))]
const orphan = cssClasses.filter(c => !allSrc.includes(c))
ok('全局样式无孤儿类', orphan.length === 0, orphan.join(', '))

// ---------------------------------------------------------------- 4. 金额边界用例（三端对同一组输入）
const cases = [
  { name: '空金额', type: 'fixed', fixed: '', expect: false },
  { name: '0 元', type: 'fixed', fixed: '0', expect: false },
  { name: '低于下限 0.99', type: 'fixed', fixed: '0.99', expect: false },
  { name: '下限 1', type: 'fixed', fixed: '1', expect: true },
  { name: '常规 300', type: 'fixed', fixed: '300', expect: true },
  { name: '两位小数 99.5', type: 'fixed', fixed: '99.5', expect: true },
  { name: '上限 1000', type: 'fixed', fixed: '1000', expect: true },
  { name: '上限带小数 1000.00', type: 'fixed', fixed: '1000.00', expect: true },
  { name: '超上限 1000.01', type: 'fixed', fixed: '1000.01', expect: false },
  { name: '超上限 1001', type: 'fixed', fixed: '1001', expect: false },
  { name: '天价 900000000', type: 'fixed', fixed: '900000000', expect: false },
  { name: '三位小数 99.999', type: 'fixed', fixed: '99.999', expect: false },
  { name: '科学计数法 1e5', type: 'fixed', fixed: '1e5', expect: false },
  { name: '负数 -5', type: 'fixed', fixed: '-5', expect: false },
  { name: '非数字 abc', type: 'fixed', fixed: 'abc', expect: false },
  { name: 'Infinity', type: 'fixed', fixed: 'Infinity', expect: false },
  { name: '区间倒挂 100-50', type: 'range', min: '100', max: '50', expect: false },
  { name: '区间合法 1-1000', type: 'range', min: '1', max: '1000', expect: true },
  { name: '区间上限越界 1-1001', type: 'range', min: '1', max: '1001', expect: false },
  { name: '区间缺最低', type: 'range', min: '', max: '100', expect: false },
  { name: '区间小数 1.5-2.5', type: 'range', min: '1.5', max: '2.5', expect: true },
  { name: '面议', type: 'negotiable', expect: true },
]

const jsCode = moneyJs
  .replace(/^import rules from .*$/m, '')
  .replace(/^export /gm, '')
const ctx = vm.createContext({ rules })
vm.runInContext(
  `${jsCode}\n;globalThis.__money = { priceRangeError, normalizeMoneyInput, MONEY_MIN, MONEY_MAX };`,
  ctx,
)
const jsPass = cases.map(c => !ctx.__money.priceRangeError(
  c.type, c.fixed ?? '', c.min ?? '', c.max ?? '',
))
const jsMismatch = cases.filter((c, i) => jsPass[i] !== c.expect).map(c => c.name)
ok(`前端金额边界用例（${cases.length} 条）`, jsMismatch.length === 0, jsMismatch.join(', '))
ok('输入净化：非法字符被剔除且小数位受限',
  ctx.__money.normalizeMoneyInput('a9b0c0.123') === '900.12'
  && ctx.__money.normalizeMoneyInput('900000000').length <= rules.maxInputIntegerDigits)
ok('前端常量与契约一致',
  ctx.__money.MONEY_MIN === rules.min && ctx.__money.MONEY_MAX === rules.max)

const pyScript = `
import json, sys
sys.path.insert(0, sys.argv[1])
from money_rules import validate_quest_price, validate_budget
cases = json.loads(sys.argv[2])
out = []
for c in cases:
    q = {"postKind": "bounty", "priceType": c["type"]}
    b = {"budgetType": c["type"]}
    if c["type"] == "fixed":
        q["quotePrice"] = c.get("fixed", "")
        b["budgetMin"] = c.get("fixed", "")
    elif c["type"] == "range":
        q["quotePriceMin"] = c.get("min", "")
        q["quotePriceMax"] = c.get("max", "")
        b["budgetMin"] = c.get("min", "")
        b["budgetMax"] = c.get("max", "")
    out.append({
        "name": c["name"],
        "quest": not validate_quest_price(q),
        "budget": not validate_budget(b)[3],
    })
print(json.dumps(out))
`
let pyResult = null
for (const cmd of ['python', 'python3', 'py']) {
  const r = spawnSync(cmd, ['-c', pyScript, join(REPO, 'contracts'), JSON.stringify(cases)], { encoding: 'utf8' })
  if (r.status === 0 && !r.error) {
    pyResult = r
    break
  }
}
ok('服务端校验模块可执行', !!pyResult, pyResult ? '' : '未找到可用的 python')
if (pyResult) {
  let pyPass = []
  try {
    pyPass = JSON.parse(pyResult.stdout.trim())
  }
  catch {
    ok('服务端用例输出可解析', false, pyResult.stderr || pyResult.stdout)
  }
  if (pyPass.length) {
    const questDiff = pyPass.filter((r, i) => r.quest !== jsPass[i]).map(r => r.name)
    const budgetDiff = pyPass.filter((r, i) => r.budget !== jsPass[i]).map(r => r.name)
    ok('集市发帖接口与前端口径一致', questDiff.length === 0, questDiff.join(', '))
    ok('镜像站订单接口与前端口径一致', budgetDiff.length === 0, budgetDiff.join(', '))
  }
}

// ---------------------------------------------------------------- 5. 补充说明边界与权限（前后端同一组输入）
const noteCases = [
  { name: '空字符串', value: '' },
  { name: '纯空白', value: '   \n  ' },
  { name: '非字符串', value: null },
  { name: '常规中文', value: '需要交付源文件' },
  { name: '首尾空白与 CRLF', value: '  第一行\r\n第二行  ' },
  { name: '控制字符净化', value: 'a\u0000b\u0007c' },
  { name: '多空行压缩', value: 'a\n\n\n\nb' },
  { name: '正好到上限', value: 'x'.repeat(noteRules.maxLength) },
  { name: '超出上限 1 字', value: 'x'.repeat(noteRules.maxLength + 1) },
  { name: 'emoji 按码点计', value: '😀'.repeat(250) },
  { name: 'emoji 超限', value: '😀'.repeat(noteRules.maxLength + 1) },
]

const noteVmCode = noteJs.replace(/^import rules from .*$/m, '').replace(/^export /gm, '')
const noteCtx = vm.createContext({ rules: noteRules })
vm.runInContext(
  `${noteVmCode}\n;globalThis.__note = { validateNote, noteError, noteLength };`,
  noteCtx,
)
const jsNotes = noteCases.map(c => {
  const r = noteCtx.__note.validateNote(c.value)
  return { pass: !r.error, text: r.text, error: r.error }
})

const notePyScript = `
import json, os, sys, tempfile
sys.path.insert(0, sys.argv[1])
from note_rules import validate_note, MAX_PER_POST
from notes import NoteStore, handle_notes
out = {"cases": [], "store": {}, "http": {}}
for c in json.loads(sys.argv[2]):
    text, err = validate_note(c["value"])
    out["cases"].append({"pass": not err, "text": text, "error": err})
with tempfile.TemporaryDirectory() as d:
    store = NoteStore(os.path.join(d, "t.db"))
    actor = {"id": "1", "name": "发布者"}
    for i in range(MAX_PER_POST):
        store.add("101", actor, "第%d条" % i)
    note, err = store.add("101", actor, "超额")
    out["store"]["limit"] = bool(err) and note is None
    out["store"]["count"] = len(store.list("101"))
    out["store"]["isolated"] = len(store.list("102")) == 0

    def resolve(pid):
        if pid == "999":
            raise RuntimeError("upstream down")
        return {"authorID": "1"} if pid == "101" else None

    def call(method, path, body=None, who=None, query=None, target=None):
        return handle_notes(path, method=method, body=body or {}, query=query or {},
                            actor=who, resolve_post=resolve, store=target or store)[0]

    add = "/mirror-api/notes/add"
    out["http"]["readPublic"] = call("GET", "/mirror-api/notes/list", None, None,
                                      {"postID": ["101"]}) == 200
    out["http"]["needLogin"] = call("POST", add, {"postID": 101, "content": "x"}) == 401
    out["http"]["forbidden"] = call("POST", add, {"postID": 101, "content": "x"},
                                     {"id": "2", "name": "路人"}) == 403
    out["http"]["notFound"] = call("POST", add, {"postID": 404, "content": "x"}, actor) == 404
    out["http"]["badID"] = call("POST", add, {"postID": "../etc", "content": "x"}, actor) == 400
    out["http"]["empty"] = call("POST", add, {"postID": 101, "content": "   "}, actor) == 400
    out["http"]["upstreamFail"] = call("POST", add, {"postID": 999, "content": "x"}, actor) == 503
    store2 = NoteStore(os.path.join(d, "t2.db"))
    status, payload = handle_notes(add, method="POST", body={"postID": 101, "content": " 需要交付源文件 "},
                                   actor=actor, resolve_post=resolve, store=store2)
    out["http"]["addOk"] = (status == 200
                            and payload["data"]["note"]["content"] == "需要交付源文件")
    store.close()
    store2.close()
print(json.dumps(out))
`
let notePy = null
let notePyErr = ''
for (const cmd of ['python', 'python3', 'py']) {
  const r = spawnSync(cmd, ['-c', notePyScript, join(REPO, 'contracts'), JSON.stringify(noteCases)], { encoding: 'utf8' })
  if (r.status === 0 && !r.error) {
    notePy = r
    break
  }
  notePyErr = (r.stderr || r.stdout || r.error?.message || '').trim().split('\n').slice(-4).join(' | ')
}
ok('补充说明服务端模块可执行', !!notePy, notePy ? '' : notePyErr || '未找到可用的 python')
if (notePy) {
  let py = null
  try {
    py = JSON.parse(notePy.stdout.trim())
  }
  catch {
    ok('补充说明用例输出可解析', false, notePy.stderr || notePy.stdout)
  }
  if (py) {
    const diff = noteCases
      .map((c, i) => ({ name: c.name, js: jsNotes[i], python: py.cases[i] }))
      .filter(r => r.js.pass !== r.python.pass || r.js.text !== r.python.text
        || r.js.error !== r.python.error)
      .map(r => r.name)
    ok(`补充说明边界用例（${noteCases.length} 条）前后端完全一致`, diff.length === 0, diff.join(', '))
    ok('批注条数上限与帖子隔离',
      py.store.limit && py.store.count === noteRules.maxPerPost && py.store.isolated,
      JSON.stringify(py.store))
    const labels = {
      readPublic: '未登录也能公开读批注',
      needLogin: '未登录写入被拒',
      forbidden: '非作者写入被拒',
      notFound: '帖子不存在被拒',
      badID: '非法帖子编号被拒',
      empty: '空内容被拒',
      upstreamFail: '归属核实失败不静默放行',
      addOk: '作者写入成功且内容被净化',
    }
    for (const [key, label] of Object.entries(labels))
      ok(label, py.http[key] === true, key)
  }
}

// ---------------------------------------------------------------- 5.5 浏览 / 沟通计数语义（服务端单一实现）
const statsPyScript = `
import json, os, sys, tempfile
sys.path.insert(0, sys.argv[1])
from post_stats import PostStatStore, handle_stats
out = {}
with tempfile.TemporaryDirectory() as d:
    s = PostStatStore(os.path.join(d, 't.db'))
    def resolve(pid):
        if pid == '999': raise RuntimeError('upstream down')
        return {'authorID': '1'} if pid == '101' else None
    def base(pid):
        return {'viewCount': 143, 'chatCount': 426} if pid == '101' else {}
    A = {'id': '2', 'name': '同学'}
    OWNER = {'id': '1', 'name': '发布者'}
    def call(method, path, body=None, actor=None, query=None):
        return handle_stats(path, method=method, body=body or {}, query=query or {},
                            actor=actor, resolve_post=resolve, store=s, base=base)
    def count(body, actor, path='/mirror-api/stats/view', key='viewCount'):
        return call('POST', path, body, actor)[1]['data'][key]
    out['readPublic'] = call('GET', '/mirror-api/stats/get', query={'postID': ['101']})[0] == 200
    out['needLogin'] = call('POST', '/mirror-api/stats/view', {'postID': 101})[0] == 401
    out['badID'] = call('POST', '/mirror-api/stats/view', {'postID': '../etc'}, A)[0] == 400
    out['badPeer'] = call('POST', '/mirror-api/stats/chat', {'postID': 101, 'peerID': 'x'}, A)[0] == 400
    out['notFound'] = call('POST', '/mirror-api/stats/view', {'postID': 404}, A)[0] == 404
    out['upstreamFail'] = call('POST', '/mirror-api/stats/view', {'postID': 999}, A)[0] == 503
    out['viewOnce'] = count({'postID': 101}, A) == 144
    out['viewDedupe'] = count({'postID': 101}, A) == 144
    out['ownerSkipped'] = count({'postID': 101}, OWNER) == 144
    chat = '/mirror-api/stats/chat'
    out['chatOnce'] = count({'postID': 101, 'peerID': 1}, A, chat, 'chatCount') == 427
    out['chatDedupe'] = count({'postID': 101, 'peerID': 1}, A, chat, 'chatCount') == 427
    out['chatOtherPeer'] = count({'postID': 101, 'peerID': 3}, A, chat, 'chatCount') == 428
    out['selfChatSkipped'] = count({'postID': 101, 'peerID': 2}, A, chat, 'chatCount') == 428
    out['isolated'] = call('GET', '/mirror-api/stats/get', query={'postID': ['102']})[1]['data']['viewCount'] == 0
    s.close()
print(json.dumps(out))
`
let statsPy = null
let statsPyErr = ''
for (const cmd of ['python', 'python3', 'py']) {
  const r = spawnSync(cmd, ['-c', statsPyScript, join(REPO, 'contracts')], { encoding: 'utf8' })
  if (r.status === 0 && !r.error) {
    statsPy = r
    break
  }
  statsPyErr = (r.stderr || r.stdout || r.error?.message || '').trim().split('\n').slice(-4).join(' | ')
}
ok('计数服务端模块可执行', !!statsPy, statsPy ? '' : statsPyErr || '未找到可用的 python')
if (statsPy) {
  let py = null
  try {
    py = JSON.parse(statsPy.stdout.trim())
  }
  catch {
    ok('计数用例输出可解析', false, statsPy.stderr || statsPy.stdout)
  }
  if (py) {
    const labels = {
      readPublic: '统计可公开读',
      needLogin: '未登录上报被拒',
      badID: '非法帖子编号被拒',
      badPeer: '非法对方编号被拒',
      notFound: '帖子不存在被拒',
      upstreamFail: '归属核实失败不静默放行',
      viewOnce: '浏览别人的帖子 +1',
      viewDedupe: '重复浏览不重复计数',
      ownerSkipped: '作者自浏览不计数',
      chatOnce: '发起私聊沟通数 +1',
      chatDedupe: '同一对话重复聊天不计数',
      chatOtherPeer: '换对象聊天另计一次',
      selfChatSkipped: '自己联系自己不计数',
      isolated: '不同帖子统计互不串扰',
    }
    for (const [key, label] of Object.entries(labels))
      ok(label, py[key] === true, key)
  }
}

// ---------------------------------------------------------------- 5.6 发布者展示：改名跟随，前后端同一组输入
const authorCases = [
  {
    name: '本人历史帖跟随改名',
    record: { postID: 104, authorID: 1, authorName: '开发体验账号', authorAvatar: '', authorScore: 320 },
    me: { userID: 1, name: '帅', avatarURL: 'avatar.png', score: 420 },
    expect: { authorName: '帅', authorAvatar: 'avatar.png', authorScore: 420 },
  },
  {
    name: '字符串 ID 与数字 ID 也算同一人',
    record: { authorID: '1', authorName: '旧名字' },
    me: { userID: 1, name: '帅' },
    expect: { authorName: '帅' },
  },
  {
    name: '别人的帖子保持原样',
    record: { authorID: 101, authorName: '林同学', authorScore: 460 },
    me: { userID: 1, name: '帅', score: 420 },
    expect: { authorName: '林同学', authorScore: 460 },
  },
  {
    name: '未登录（me 为空）保持快照',
    record: { authorID: 1, authorName: '旧名字' },
    me: null,
    expect: { authorName: '旧名字' },
  },
  {
    name: '账号缺 userID 不误判',
    record: { authorID: 1, authorName: '旧名字' },
    me: { name: '帅' },
    expect: { authorName: '旧名字' },
  },
  {
    name: '帖子缺 authorID 不误判',
    record: { authorName: '旧名字' },
    me: { userID: 1, name: '帅' },
    expect: { authorName: '旧名字' },
  },
  {
    name: '账号资料缺字段时保留旧快照',
    record: { authorID: 1, authorName: '旧名字', authorScore: 320 },
    me: { userID: 1, name: '帅' },
    expect: { authorName: '帅', authorScore: 320 },
  },
  {
    name: '历史批注同样跟随改名',
    record: { id: 7, postID: 104, authorID: '1', authorName: '旧名字', content: '问问' },
    me: { userID: 1, name: '帅' },
    expect: { authorName: '帅', content: '问问' },
  },
  {
    name: '非对象入参原样返回',
    record: null,
    me: { userID: 1, name: '帅' },
    expect: null,
  },
]

const canon = (v) => {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`
  if (v && typeof v === 'object')
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`
  return JSON.stringify(v) ?? 'undefined'
}

const authorVmCode = authorJs.replace(/^import rules from .*$/m, '').replace(/^export /gm, '')
const authorCtx = vm.createContext({ rules: authorRules })
vm.runInContext(`${authorVmCode}\n;globalThis.__author = { withCurrentAuthor, isSameAccount };`, authorCtx)
const jsAuthorResults = authorCases.map(c => {
  const before = canon(c.record)
  const result = authorCtx.__author.withCurrentAuthor(c.record, c.me)
  return { result, untouched: canon(c.record) === before }
})

const authorPyScript = `
import json, sys
sys.path.insert(0, sys.argv[1])
from author_display import with_current_author
out = []
for c in json.loads(sys.argv[2]):
    record, me = c["record"], c["me"]
    before = json.dumps(record, sort_keys=True, ensure_ascii=False)
    result = with_current_author(record, me)
    out.append({"result": result,
                "untouched": json.dumps(record, sort_keys=True, ensure_ascii=False) == before})
print(json.dumps(out, ensure_ascii=False))
`
let authorPy = null
let authorPyErr = ''
for (const cmd of ['python', 'python3', 'py']) {
  const r = spawnSync(cmd, ['-c', authorPyScript, join(REPO, 'contracts'), JSON.stringify(authorCases)], { encoding: 'utf8' })
  if (r.status === 0 && !r.error) {
    authorPy = r
    break
  }
  authorPyErr = (r.stderr || r.stdout || r.error?.message || '').trim().split('\n').slice(-4).join(' | ')
}
ok('发布者展示服务端模块可执行', !!authorPy, authorPy ? '' : authorPyErr || '未找到可用的 python')
if (authorPy) {
  let py = null
  try {
    py = JSON.parse(authorPy.stdout.trim())
  }
  catch {
    ok('发布者展示用例输出可解析', false, authorPy.stderr || authorPy.stdout)
  }
  if (py) {
    const diff = authorCases
      .map((c, i) => ({ name: c.name, js: jsAuthorResults[i].result, python: py[i].result }))
      .filter(r => canon(r.js) !== canon(r.python))
      .map(r => r.name)
    ok(`发布者展示（${authorCases.length} 条）前后端完全一致`, diff.length === 0, diff.join(', '))
    const wrong = authorCases
      .map((c, i) => ({ name: c.name, result: jsAuthorResults[i].result, expect: c.expect }))
      .filter(({ result, expect }) => {
        if (expect === null) return result !== null
        return !result || Object.entries(expect).some(([k, v]) => result[k] !== v)
      })
      .map(r => r.name)
    ok('改名跟随且不误伤他人快照', wrong.length === 0, wrong.join(', '))
    ok('解析不修改原始记录',
      jsAuthorResults.every(r => r.untouched) && py.every(r => r.untouched))
    ok('身份比较宽松匹配且拒绝空 ID',
      authorCtx.__author.isSameAccount({ authorID: '1' }, { userID: 1 }) === true
      && authorCtx.__author.isSameAccount({ authorID: 2 }, { userID: 1 }) === false
      && authorCtx.__author.isSameAccount({ authorID: null }, { userID: 1 }) === false
      && authorCtx.__author.isSameAccount({ authorID: 1 }, null) === false)
  }
}

// ---------------------------------------------------------------- 6. 首屏封面工程化
const coverVue = read(join(REPO, 'web', 'src', 'views', 'CoverView.vue'))
const heroJs = read(join(REPO, 'web', 'src', 'utils', 'mirror-hero.js'))
const heroCss = read(join(REPO, 'web', 'src', 'styles', 'hero.css'))
const routerJs = read(join(REPO, 'web', 'src', 'router', 'index.js'))
ok('封面底图是独立静态资源',
  existsSync(join(REPO, 'web', 'public', 'hero-bg.jpg'))
  && coverVue.includes('hero-bg.jpg') && !coverVue.includes('data:image'))
ok('封面引擎是 ES module，不往 window 挂全局',
  heroJs.includes('export default') && !heroJs.includes('window.FMMirrorHero'))
ok('封面引擎去掉自动挂载，改由 Vue 生命周期管理',
  !heroJs.includes("getElementById('fm-hero')")
  && coverVue.includes('FMMirrorHero.mount(') && coverVue.includes('onBeforeUnmount')
  && coverVue.includes('instance.destroy()'))
ok('封面样式无重复 / 残缺 keyframes',
  (heroCss.match(/@keyframes fm-rule/g) || []).length === 1
  && !/(^|\n)\s*100%\{\s*background-position/.test(heroCss))
ok('封面样式不写全局选择器', !/(^|\n)\s*(html|body|\*)\s*\{/.test(heroCss))
ok('封面路由公开、大厅仍是 home',
  routerJs.includes("name: 'cover'") && routerJs.includes('meta: { guest: true }')
  && routerJs.includes("path: '/hall', name: 'home'"))

// ---------------------------------------------------------------- 7. 部署与 dev 隔离
const deploySh = read(join(REPO, 'deploy.sh'))
const devGateway = read(join(REPO, 'dev', 'dev_gateway.py'))
const unreadJs = read(join(REPO, 'web', 'src', 'stores', 'unread.js'))
const webHtml = read(join(REPO, 'web', 'index.html'))

ok('部署入口按 MIRROR_DEV_MODE 分发',
  deploySh.includes('MIRROR_DEV_MODE') && deploySh.includes('exec python3 "$ROOT/dev/dev_gateway.py"'))
ok('dev 入口自带构建并用 env 文件固定同源 API',
  deploySh.includes('.env.dev.example') && deploySh.includes('--mode dev')
  && deploySh.includes('npm run build'))
ok('dev 入口挡住 MSYS 路径转换污染',
  deploySh.includes('PortableGit') && deploySh.includes('grep -Rqs'))
ok('生产静态路径仍完整保留',
  deploySh.includes('QUEST_STATIC_DIR') && deploySh.includes('missing web/dist'))
ok('dev 网关复用 contracts 单一真源',
  devGateway.includes('from contracts.money_rules import')
  && devGateway.includes('from contracts.notes import')
  && devGateway.includes('from contracts.post_stats import')
  && devGateway.includes('from contracts.author_display import'))
ok('dev 目录不保留任何契约副本',
  !existsSync(join(REPO, 'dev', 'money_rules.py'))
  && !existsSync(join(REPO, 'dev', 'money-rules.json'))
  && !existsSync(join(REPO, 'dev', 'notes.py')))
ok('dev 网关必须显式开关才允许启动',
  devGateway.includes('DEV_MODE') && devGateway.includes('if not DEV_MODE'))
ok('dev 网关未命中的接口回 JSON 错误，不回退成 index.html',
  devGateway.includes('upstream not configured in dev mode'))
ok('真后端默认仍强制 UniSSO 凭据',
  serverPy.includes('UNISSO_CLIENT_ID and UNISSO_CLIENT_SECRET are required')
  && serverPy.includes('if not DEV_MODE:'))
ok('dev 只放宽启动校验，登录/SSO 仍拒绝请求',
  (serverPy.match(/sso client misconfigured/g) || []).length >= 3)
ok('未读轮询有失败退避，后端挂掉不刷屏',
  unreadJs.includes('MAX_BACKOFF_MS') && unreadJs.includes('backoffUntil'))
ok('页面声明内联 favicon，消除 404',
  webHtml.includes('rel="icon"') && webHtml.includes('data:image/svg+xml'))

// ---------------------------------------------------------------- 结果
console.log(`\n生产自检：${checks.length - failures.length}/${checks.length} 项通过`)
if (failures.length) {
  console.error('\n未通过：')
  for (const f of failures)
    console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('规则一致、无调试残留、接口层统一、前后端口径一致。')
