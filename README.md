# 沕鉴·Mirror

校园技术服务平台。前端是 Vue 3 + Vite 单页应用，后端是 Python 标准库写的单文件服务，同时托管静态产物和 `/mirror-api/*` 接口，数据存在本地 SQLite 里。

```
.
├── server.py          # 后端：静态资源 + API + SQLite，零第三方依赖
├── run.sh             # 启动入口（前台进程）
├── .env.example       # 环境变量样例（复制为 .env 后填写）
├── mirror.db          # 运行时生成的 SQLite 数据库（不入库）
└── web/
    ├── src/           # Vue 源码
    ├── index.html     # 构建入口
    ├── package.json
    └── dist/          # 构建产物（不入库）
```

## 快速启动

需要 Python 3.10+、Node 18+。

```bash
# 1. 配置
cp .env.example .env
#    编辑 .env，至少填好 UNISSO_CLIENT_ID / UNISSO_CLIENT_SECRET

# 2. 构建前端
cd web
npm ci
npm run build          # 产出 web/dist/
cd ..

# 3. 启动（前台运行，Ctrl+C 停止）
./run.sh               # 等价：python3 server.py
```

默认监听 `0.0.0.0:8080`。打开 `http://localhost:8080/`。

- 健康检查：`GET /mirror-api/healthz` → `{"ok":true,"service":"mirror","db":"ok"}`
- 首次启动自动建库（`users / sessions / admins / orders / order_events` 五张表）
- 访问日志打到标准输出：只记 API 请求和 4xx/5xx，静态资源不刷屏

## 环境变量

由 `server.py` 自行读取项目根目录的 `.env`，**不需要**在 shell 里 `source`。已有系统环境变量优先于 `.env`。

| 变量 | 用途 | 必需 |
|---|---|---|
| `UNISSO_ISSUER` | UniSSO 地址，默认 `https://sso.ssemarket.cn` | 否 |
| `UNISSO_CLIENT_ID` | UniSSO client id | 是 |
| `UNISSO_CLIENT_SECRET` | UniSSO client secret | 是 |
| `MARKET_BASE` | 集市主站地址，默认 `https://ssemarket.cn` | 否 |
| `MARKET_TRUST_SECRET` | 主站信任密钥 | 转发订单时需要 |
| `MARKET_OFFICIAL_EMAIL` / `MARKET_OFFICIAL_PASSWORD` | 转发订单用的官方账号 | 转发订单时需要 |
| `MARKET_OFFICIAL_NAME` | 官方账号显示名 | 否 |
| `PORT` | 监听端口，默认 `8080` | 否 |

⚠️ `.env`、`mirror.db`、`*.pem` 均已被 `.gitignore` 排除，不要把密钥提交进仓库。

## 前端 API 指向（联调前先看）

`web/src/api/client.js` 的 `API_BASE` 默认指向集市主站 `https://ssemarket.cn/api`：大厅、发帖、详情、私信、我的、反馈这些页面消费的是主站接口；`server.py` 提供的 `/mirror-api/*` 是另一套需求订单接口。两套接口目前不共用数据，排查问题时先确认请求打到了哪一边。

**开发 / 测试时不要连生产主站**：复制 `web/.env.dev.example` 为 `web/.env.dev`（内容 `VITE_API_BASE=/api`），再用 `npm run build -- --mode dev` 构建，把 `/api/*` 交给本机的开发网关处理。常规 `npm run build` 不读该文件，生产构建行为不变。`.env.dev` 已被 gitignore 排除。

## 接口

所有接口前缀 `/mirror-api`，请求/响应均为 JSON。除登录和健康检查外都需要会话（`X-Mirror-Session` 或 `Authorization: Bearer ms-...`）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查，不限流、无需登录 |
| GET | `/me` | 当前登录用户 |
| GET | `/orders/list` | 需求列表 |
| GET | `/orders/detail` | 需求详情 |
| GET | `/market/chat-history` | 集市会话记录 |
| POST | `/auth/login` | 邮箱密码登录（后端调 UniSSO 校验） |
| POST | `/auth/sso/try` | 尝试用 UniSSO cookie 静默登录 |
| POST | `/auth/logout` | 退出登录 |
| POST | `/orders/create` | 创建需求 |
| POST | `/orders/status` | 变更需求状态 |
| POST | `/orders/forward` | 转发需求到集市主站 |

订单状态：`pending`（待受理）→ `accepted`（已受理）→ `in_progress`（处理中）→ `done`（已完成）/ `closed`（已关闭）。

## 部署要点

- 服务必须绑 `0.0.0.0:8080`，只绑 `127.0.0.1` 外部访问不到
- 启动脚本用 `exec` 保持前台进程，不要用 `nohup` / `&` 自行 daemonize（交给平台的 supervisor 管理）
- 容器内只需明文 HTTP，TLS 由平台中继终结
- 代码、配置、数据库一律放持久化目录；容器重建时非持久化目录会丢
- 静态资源带扩展名且找不到时返回 404，无扩展名的路径按 SPA 回退到 `index.html`

## 平台 dev 部署（独立 Pod，不接 UniSSO / 主站）

dev 用**独立部署单元**，只绑仓库 `dev` 分支；切换完全靠平台的环境变量，不改表单里的启动脚本：

| 变量 | 值 | 说明 |
|---|---|---|
| `MIRROR_DEV_MODE` | `1` | 必填。切到 dev 演示模式；不设就走下面的生产路径 |
| `PORT` | 平台分配 | 默认 `8080` |
| `MIRROR_DEV_DATA` | 持久化目录 | 可选，演示状态与演示库落点（默认 `dev/_state/`，已 gitignore） |
| `MIRROR_STATIC_DIR` | `web/dist` | 可选，静态产物目录 |
| `MIRROR_DEV_NO_LOGIN` | `1`（默认） | 打开即进入演示账号；设 `0` 则显示登录页 |

`deploy.sh` 检测到 `MIRROR_DEV_MODE=1` 后：若缺 `web/dist/index.html` 就在容器内 `npm ci`、从 `.env.dev.example` 生成 `.env.dev`、`npm run build -- --mode dev`，并校验产物 API 基址没有被环境污染，再 `exec python3 dev/dev_gateway.py`。**这里必须走 env 文件**：用 `VITE_API_BASE=/api` 环境变量时，Git Bash / MSYS 会把 `/api` 转成本地路径 `file:///.../PortableGit/api` 打进产物，页面能开但所有接口都打不出去。**一个前台进程**同时托管静态、`/api/*` 演示接口与 `/mirror-api/*` 契约接口，不访问 UniSSO、不连主站、不需要第二个后端进程；健康门 `GET /mirror-api/healthz` 返回 `{"ok":true,"service":"mirror-dev",...}`。演示数据与演示库只落在 dev Pod，绝不写生产库。

`dev/dev_gateway.py` 直接 import 仓库 `contracts/`，**不在 dev 目录保留任何契约副本**（`npm run verify` 会强制检查）。它只在显式开关下启动，未命中的接口返回 JSON 错误而不是把 `index.html` 当接口回给浏览器——后者正是「页面能开、后台一直在报错」的典型原因。

**生产行为零变化**：不设该变量时仍是 `deploy.sh` 静态服务 / `run.sh` 真后端；真后端仍强制要求 `UNISSO_CLIENT_ID` / `UNISSO_CLIENT_SECRET`。若只是想在 dev 起真后端联调，`MIRROR_DEV_MODE=1` 仅放宽**启动校验**，登录与 SSO 接口仍返回 503，**不绕过身份校验**。

## 开发约定

- 一个改动一个分支（`feature/*`、`fix/*`），走 PR 合并，不直接推主干
- 提交信息用 `feat:` / `fix:` / `chore:` 前缀
- 改完先 `npm ci && npm run verify && npm run build`，再自测接口，最后提 PR
- PR 说明写清「为什么改、改了哪、怎么验」，由人 review 后合并

## 金额与未读契约（生产必读）

- `contracts/money-rules.json` 是金额规则的**唯一真源**（1–1000 元、最多 2 位小数）。
  `web/src/utils/money.js`（前端输入净化与提交校验）、`contracts/money_rules.py`
  （服务端 `validate_budget` / `validate_quest_price`）、dev 演示网关都从它取值。
  改规则只改这一个文件，不要在任何一处另写常量。
- 每个部署单元必须自带 `money_rules.py` + `money-rules.json`：仓库根由 `server.py`
  以 `contracts` 包导入；dev 网关与本地试玩包各自带同目录副本。
  **契约文件缺失时启动即报错**，不会静默退回旧规则把脏金额写进库。
- `npm run verify`（在 `web/` 下）会检查：契约副本一致、各端是否复用统一校验、
  22 组金额边界用例在前端 / 集市发帖接口 / 镜像站订单接口三端结果一致、
  无 `console.log` / `debugger` / 缓存串残留、接口请求是否只从 `api/client.js` 发出、
  全局 CSS 是否有孤儿类。提 PR 前必须跑通。
- `apiRequest` 是前端唯一网络出口：15 秒超时、统一 `ApiError`、HTTP 状态与业务 code
  归一化、`FormData` 上传与 `/mirror-api` 另一套 base 都走它。新增接口不要自己写 `fetch`。
- 未读数由 `stores/unread.js` 单一状态源管理：已读基线按账号隔离（localStorage）、
  页面隐藏时暂停轮询、可见时立即刷新、请求防重入。后端没有 `readChat` 时用基线兜底，
  新消息到来仍能重新亮红点。

## 发布者补充说明（批注）契约

需求详情页底部展示发布者后续补充的细节（验收标准、交付时间、参考资料等），
替代原先的大片空白；这里**不是公开评论区**，只有发布者本人能写。

- 规则唯一真源 `contracts/note-rules.json`（1–500 字、每帖最多 20 条、全部中文文案）。
  `contracts/note_rules.py` 是服务端唯一的净化与校验实现（去控制字符、压多余空行、
  按 Unicode 码点计长度）；`web/src/utils/note.js` 直接 import 同一份 JSON，
  前端只做即时提示，能否写入由服务端裁决。`npm run verify` 会用同一组边界用例
  比对两端结果（含 emoji 计长、CRLF、控制字符），并验证权限与条数上限。
- `contracts/notes.py` 是**唯一的存储与 HTTP 语义实现**（`NoteStore` + `handle_notes`），
  被生产后端、dev 网关、本地试玩包共用；各端只注入「当前身份」和「帖子归属」，
  不重复写校验，也不各自建表。
- 接口（同源 `/mirror-api`，前端由 `api/notes.js` 走统一 `apiRequest`）：
  | 方法 | 路径 | 说明 |
  |---|---|---|
  | GET | `/mirror-api/notes/list?postID=101` | 公开读，返回批注时间线 |
  | POST | `/mirror-api/notes/add` | 写，body 只有 `{postID, content}` |
- 写权限在服务端：生产 `server.py` 从会话取身份，并向主站
  `/api/auth/quest/detail` 核实帖子 `authorID`；**不信任前端传来的用户 ID**，
  核实失败返回 503 而不是静默放行。dev / 试玩环境用演示账号与本地假数据注入。
- 数据落在各自独立的 SQLite 文件（`mirror_notes.db` / `dev_notes.db` /
  `_demo_notes.db`）：不改动订单表结构，不写主站，不随试玩 zip 分发。
  `NoteStore.close()` 用于测试与进程退出时释放句柄。
- 前端 `components/AuthorNotes.vue`：Vue 插值渲染（不经 `v-html`）、提交防重、
  超长实时提示、失败重试、空态引导、桌面与 375px 手机响应式。

## 浏览 / 沟通计数契约

详情页标题行显示「浏览 N」「沟通 N」，统计来自同一套服务端实现，**前端不传增量、
不传用户 ID**。之前试玩包在详情接口里每次 `+1`（含作者自己、刷新也涨）、dev 网关不涨、
沟通数三端都是静态假数据，现已全部收口。

- 口径真源 `contracts/post-stats.json`；`contracts/post_stats.py` 是唯一的存储与
  HTTP 语义实现（`PostStatStore` + `handle_stats`），生产后端、dev 网关、本地试玩包共用，
  `npm run verify` 强制比对三处副本一致并跑 14 组语义用例。
- 去重与权限：同一账号对同一帖只计一次浏览；同一账号在同一帖对同一对象只计一次沟通；
  **作者浏览自己的帖子、自己联系自己都不计**。身份只取自会话 / 演示账号，
  帖子归属由各端 `resolve_post` 向主站核实，核实失败返回 503，不静默放行。
- 接口（同源 `/mirror-api`，前端由 `api/stats.js` 走统一 `apiRequest`）：
  | 方法 | 路径 | 说明 |
  |---|---|---|
  | GET | `/mirror-api/stats/get?postID=101` | 公开读，返回绝对值与增量 |
  | POST | `/mirror-api/stats/view` | body `{postID}`，进入别人的详情时上报 |
  | POST | `/mirror-api/stats/chat` | body `{postID, peerID}`，从需求发起私聊时上报 |
- 增量落在各自独立 SQLite（`mirror_stats.db` / `dev_stats.db` / `_demo_stats.db`），
  **不写主站、不写演示快照、不随试玩 zip 分发**，删库即复位。演示环境由 `with_comments`
  把「快照基线 + 增量」叠加到列表 / 详情返回值；生产环境没有演示基线，只返回增量，
  主站若要展示绝对值需自行提供基线（已写在此处，不假装已完成）。
- 前端触发点：`QuestDetail.vue` 仅在非作者时上报浏览并更新标签；`contactAuthor` /
  `contactWorker` 跳转带 `post` 参数，`MessagesView.vue` 据此上报沟通；
  `MyPostsView.vue` 刷新即看到最新值。会话列表的时间取真实聊天记录 / 帖子发布时间，
  未读红点在桌面与手机都由同一份 `stores/unread.js` 状态渲染。

## 发布者展示契约（改名跟随）

`authorID` 才是身份，**`authorName` / `authorAvatar` / `authorScore` 只是发布当时的快照**。
早期试玩里把昵称写死进帖子，账号改名后出现「补充说明署名是新名字、发布者栏还是旧名字」
的同人双名；修法是展示时按 ID 关联当前账号资料，**不批量回写历史数据**——回写既容易漏
（评论、订单、私聊各存一份），也会抹掉发布当时的原始记录。

- 规则唯一真源 `contracts/author-display.json`：身份字段、账号字段、宽松字符串匹配、
  三组展示字段映射、兜底文案。`contracts/author_display.py`（服务端）与
  `web/src/utils/author.js`（前端）读同一份契约，`npm run verify` 用 9 组用例比对两端输出。
- 前端展示层：`QuestCard.vue` / `QuestDetail.vue` / `AuthorNotes.vue` 用
  `withCurrentAuthor(record, me)` 解析，`PostPreview.vue` 把 `authorID` 一起带进草稿；
  身份判断统一走 `isSameAccount()`，不再各处写 `===`（真后端返回字符串 ID 也能对上）。
  因为 `me` 是响应式 store，改名后不用重新拉列表就能跟上。
- 服务端出口：dev 网关与本地试玩包在 `with_comments()`（列表 / 详情共用）调用
  `with_current_author()`，保证 API 返回值本身一致，不只靠前端兜底。生产后端只向主站
  核实 `authorID` 归属、不返回帖子内容，因此不实现展示逻辑。
- 别人的帖子保持后端返回的快照：调用方拿不到他人的最新资料，不做猜测性覆盖。
- `npm run verify` 额外检查：契约副本齐全一致、各组件复用统一解析、改名不回写历史帖子。

## 首屏封面（沕鉴·Mirror hero）

来源：外部提供的「合并片段-首屏hero」片段（结构 / 样式 / 脚本三段）。
接入时拆成四份，不再把 367KB 的片段整段粘进页面：

| 文件 | 职责 |
|---|---|
| `web/src/views/CoverView.vue` | 封面结构、CTA「进入需求大厅」、引擎生命周期 |
| `web/src/styles/hero.css` | 全部 `.fm-` 命名空间样式 + 桌面/手机两套断点 |
| `web/src/utils/mirror-hero.js` | WebGL / 2D 粒子 / 字效引擎（原逻辑不动） |
| `web/public/hero-bg.jpg` | 底图，从内联 base64 拆成 251KB 静态资源，可缓存 |

- 对引擎只做三处工程化改动：IIFE 改成 ES module（不再往 `window` 挂全局）、
  删掉片段末尾的自动挂载、改由 `onMounted` 调 `mount()` / `onBeforeUnmount`
  调 `destroy()`。单页应用切路由不 `destroy()` 会泄漏 rAF、resize 监听与 WebGL 上下文。
- 原片段样式里有残缺的 keyframes 残片与 3 处重复的 `.fm-hero__rule` 定义，已清理；
  真实标题默认可见，**只有引擎成功挂载（`is-mounted`）后才淡出**，
  canvas 不可用或模块加载失败时首屏不会变成没有标题的黑屏。
- 字体：不引第三方字体 CDN，改用系统 serif 栈（Noto Serif SC / 思源宋体 /
  Songti SC / 宋体）。若要与演示版字形完全一致，把 woff2 自托管到
  `web/public/` 并在 `web/index.html` 加 `@font-face`，其余代码不用动。
- 双端调整：桌面保持 100vh 与原粒子密度；手机用 `100svh`（地址栏收起不留白边）、
  `density 0.55 / speed 0.7` 省电、标题与字距重排、CTA ≥48px 触摸目标、
  院校条收窄，并补了横屏矮屏断点。`prefers-reduced-motion` 下只留静态首帧。
- 路由：`/` = 封面（`name: cover`，未登录可看），`/hall` = 需求大厅
  （`name: home` 保持不变，所有 `router.push({name:'home'})` 无需改动）。
  桌面顶栏品牌链接回封面；三个导航组件里「需求大厅」的硬编码路径已改为 `/hall`。
- `npm run verify` 会检查：底图不是内联 base64、引擎无全局挂载且无自动挂载、
  组件确实调用 `destroy()`、样式无重复/残缺 keyframes 且无全局选择器、封面路由公开。

## 仍待主站配合（本地关不掉的口子）

前端与镜像站 `server.py` 已做金额校验；但大厅 / 发帖 / 私信消费的是集市主站
`https://ssemarket.cn/api/auth/*`（代码不在本仓库）。**主站 `/api/auth/quest/create`
需按同一份契约补服务端校验并提供 `readChat`**，否则绕过前端直接调主站仍可写入非法金额。
上线前必须与主站对齐，不能只靠前端拦。
