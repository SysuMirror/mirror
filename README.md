# 沕鉴·Mirror — 软件研发与交付

沕鉴 Mirror 面向高校与企业承接软件项目。官网介绍研发服务和工程实践，并提供项目咨询入口。需求社区保留为独立应用，使用 Svelte 5 + Vite，服务端使用 Node 22 标准库。

```
.
├── server.js            # Node 后端：静态托管 + /api/* 社区接口 + /mirror-api/* 兼容接口 + SQLite
├── run.sh               # 前台入口（supervisor 托管），自动寻找 Node 22+
├── deploy.sh            # 兼容旧平台入口，转交 run.sh
├── package.json         # 后端元信息（type: module）
├── contracts/           # 金额 / 批注 / 统计 / 发布者展示规则（JSON 唯一真源）
├── mirror.db            # 运行时 SQLite（账号/会话/需求/报名/收藏/会话/消息/订单/批注/统计）
├── web/                 # 静态产物（直接托管，无需运行时构建）
│   ├── index.html       # 品牌首页（碎镜开屏、研发服务、工程实践与项目咨询）
│   ├── landing-fx.css   # 首页样式与响应式布局
│   ├── landing-fx.js    # 首页导航与项目咨询表单
│   ├── landing-mirror.js # 原始碎镜开屏动画
│   ├── assets/          # 首页图片资源
│   └── app/             # 社区 SPA 构建产物（Svelte）
└── frontend/            # 社区 SPA 源码（Svelte 5 + Vite）
    ├── src/
    │   ├── App.svelte   # 壳层：顶栏/导航/搜索/筛选/登录/Toast/视图切换
    │   ├── state.svelte.js  # 全局响应式状态（runes）
    │   ├── api.js       # 唯一网络出口（同源 /api，统一超时/错误）
    │   ├── actions.js   # 登录/发布/报名/收藏/私聊/已读等业务动作
    │   ├── lib/         # PostCard / SideBar / icons
    │   └── views/       # Hall / PostDetail / Publish / ChatList / Thread / Me / Manage / Applied
    ├── index.html
    ├── vite.config.js   # base=/app/，构建到 ../web/app
    └── package.json
```

## 技术栈与性能

- **后端 Node 22**：只用 `node:http`、`node:sqlite`、`node:crypto`、`fetch`。无 Express/无 ORM，单文件、单进程、同步 SQLite（WAL），启动即建表/迁移/种子。
- **前端 Svelte 5**：编译期生成原生 DOM 操作 + 细粒度 runes 响应式，无虚拟 DOM diff。生产产物 JS ≈ 33KB gzip、CSS ≈ 5.5KB gzip。
- **首页保持原生**：首屏使用原始碎镜 canvas 动画，播放结束后自动破碎并进入品牌介绍，也可点击开屏任意位置提前进入。正文和链接由 HTML 直接提供。

## 官网项目咨询

- 官网表单通过 `POST /api/project-inquiries` 将咨询写入订单库，来源为 `project_inquiry`。提交者无需登录。
- 团队使用现有管理员会话，通过 `GET /mirror-api/orders/list?scope=all` 查看并跟进咨询。咨询不会出现在普通用户列表，也无法转发至集市。

## 快速启动

需要 Node 22+（本机 `~/.nvm/versions/node/v22.23.5`，或 `/shared/opt/node/22.23.3`）。

```bash
cp .env.example .env   # 填 UNISSO_CLIENT_ID / UNISSO_CLIENT_SECRET（已有 .env 则跳过）
./run.sh               # 前台监听 0.0.0.0:8080
```

- 健康门：`GET /api/healthz` → `{"ok":true,"service":"mirror","stack":"node","db":"ok"}`
- 兼容健康门：`GET /mirror-api/healthz`
- 首页：`/`；社区：`/app.html`（SPA 资源在 `/app/assets/*`）

## 前端构建

社区 SPA 改源码后需要重新构建（产物已随部署落盘，运行时不构建）：

```bash
cd frontend
npm install
npm run build      # 产出 ../web/app/
```

`vite.config.js` 固定 `base: '/app/'`，与后端 `serveSpa` 路由一致。开发时 `npm run dev`（5173）会把 `/api`、`/mirror-api` 代理到 8080。

## 环境变量（.env）

| 变量 | 用途 |
|---|---|
| `PORT` | 监听端口，默认 8080 |
| `UNISSO_ISSUER` | 默认 `https://sso.ssemarket.cn` |
| `UNISSO_CLIENT_ID` / `UNISSO_CLIENT_SECRET` | 密码登录 / 静默 SSO 必需 |
| `MARKET_BASE` | 集市主站，默认 `https://ssemarket.cn` |
| `MARKET_TRUST_SECRET` | 订单转发集市所需 |
| `MARKET_OFFICIAL_EMAIL` / `MARKET_OFFICIAL_PASSWORD` / `MARKET_OFFICIAL_NAME` | 官方转发账号 |
| `MIRROR_DB` | 可选，覆盖 SQLite 路径（测试用） |

`.env`、`mirror.db`、`frontend/node_modules`、`web/app` 均已 gitignore，密钥不入库。

## 社区接口（/api/*）

身份只取自会话 Cookie（`mirror_sid`，HttpOnly/SameSite=Lax），写操作绝不信任请求体里的用户 ID。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/healthz` | 健康门 |
| GET | `/api/bootstrap` | 首屏聚合：me / posts / peers / applied / favorites / skills / cats |
| GET | `/api/me` | 当前用户 |
| GET | `/api/posts` | 需求列表（cat/skill/q 过滤） |
| GET | `/api/posts/:id` | 需求详情 |
| POST | `/api/posts` | 发布需求（金额走 contracts/money-rules.json） |
| POST | `/api/posts/:id/apply` | 报名（不能报自己的） |
| POST | `/api/posts/:id/favorite` | 收藏/取消 |
| POST | `/api/posts/:id/view` | 浏览计数（同账号去重，作者不计） |
| POST | `/api/posts/:id/status` | 发布者改状态 |
| POST | `/api/threads/open` | 按 postId/peerId 发起会话 |
| GET | `/api/threads` / `/api/threads/:peerId` | 会话列表 / 单个会话 |
| POST | `/api/threads/:peerId/messages` | 发消息 |
| POST | `/api/threads/:peerId/read` / `/api/threads/read-all` | 已读 |
| POST | `/api/auth/login` | 邮箱密码 → UniSSO 校验 → 本地会话 |
| POST | `/api/auth/sso/try` | 共享 SSO Cookie 静默登录 |
| POST | `/api/auth/logout` | 退出（撤销 SSO + 清 Cookie） |

## 兼容接口（/mirror-api/*）

保留原生产语义：`/auth/login|sso/try|logout`、`/me`、`/orders/create|list|detail|status|forward`、`/notes/list|add`、`/stats/get|view|chat`、`/market/chat-history`。批注/统计现在直接落在社区帖子（postID 为社区需求 id），归属由本地会话核实。

## 数据与迁移

- 启动幂等建表；旧 Python 版 `mirror.db` 可直接复用：自动补 `sessions.account_id/sso_sub/internal`、`admins.sso_sub`，历史会话与订单不丢。
- 首次启动若 `posts` 为空，种子 6 条演示需求 + 演示作者（`demo:*` 账号，不可登录），保证大厅不空白。
- 浏览/沟通计数按账号去重，作者自浏览/自沟通不计。

## 部署与自启（YatTerra）

- 代码/配置/数据库都在持久化目录 `/home/cloud/deploy/programs/mirror-unisso-20260908`。
- supervisor 程序 `mirror-unisso-20260908` 已 `autostart=true` / `autorestart=true`，入口 `run.sh` 为前台进程；**Pod 重建后由平台 init 拉起 supervisord，本服务自动恢复**，无需手改 `supervisord.conf`。
- `run.sh` 按顺序寻找 Node 22+（nvm → /shared/opt/node → 系统），`exec` 单进程，日志走 supervisor。
- 重启：`~/.local/bin/supervisorctl -c ~/deploy/supervisord.conf restart mirror-unisso-20260908`
- 冒烟：`./scripts/smoke-test.sh http://127.0.0.1:8080`

## 首页增强（参考 moonshot.cn 的克制质感）

- 自定义光标：小点 + 拖尾环；悬停可交互元素变取景框，首屏碎镜区变虚线旋转环，深色版块自动反白，按下收紧；触屏/reduced-motion 不启用。
- 首屏 Mirror 粒子：鼠标靠近时碎片被排斥推开、星尘让位，光标周围环绕微光粒子。
- 白色版块（生态/主张/ rise /应用/底座/服务）：低密度星座粒子背景，随鼠标排斥、随滚动视差漂移，进入视口喷发上升粒子。
- 底部口号带：**软件定义世界，工程铸就未来**（深色粒子背景 + 渐变标题）。