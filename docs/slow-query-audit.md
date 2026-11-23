# 慢查询与缓存策略审计

- 需求单：SK-27CA9F55
- 分支：`fix/yz-sk-27ca9f55`
- 日期：2026-11-23
- 性质：**只读审计**。未修改任何源码，本文件是唯一新增内容。
- 审计对象：`server.py`（生产后端）、`contracts/notes.py`、`contracts/post_stats.py`、
  `dev/dev_gateway.py` 的数据库 / 外部服务访问路径，以及 `web/src/` 中会放大后端压力的调用点。

> 边界说明：前端默认 `API_BASE = https://ssemarket.cn/api`（`web/src/api/client.js:1`），
> 大厅、帖子详情、私信等**主站接口的代码不在本仓库**，其 SQL 无法审计。本文覆盖的是
> 本仓库实际拥有的镜像站后端 `/mirror-api/*`、批注 / 统计契约层，以及 dev 演示网关；
> 主站接口只在“请求放大”层面引用，不臆测其内部实现。

---

## 0. 结论速览（Top 5）

| # | 问题 | 位置 | 级别 | 预估收益 |
|---|---|---|---|---|
| 1 | 详情页每次浏览触发 **2 次公网上游调用**，`resolve_post` 与官方 token 均无缓存 | `server.py:400-408,570-578`；`web/src/components/QuestDetail.vue:69-80` | P0 | 去掉每帖每 5 分钟重复的 provision + quest/detail；直接降低详情页尾延迟与线程占用 |
| 2 | 每个携带镜像会话的请求都 `UPDATE sessions.last_seen`，且所有 SQL 被全局 `db_lock` + 单连接串行化 | `server.py:55,85-91,212-223` | P0 | 少掉每请求一次写事务；WAL 后读不再被写阻塞，写吞吐显著提升 |
| 3 | `orders/list` 只有 `owner_email` 单列索引，`ORDER BY created DESC` 走临时 B-Tree；管理员全量查询是整表扫描 + 排序 | `server.py:152,878-900` | P0 | 合成数据 5 万行实测：管理端列表 4.9ms → 0.27ms（约 18×，见附录 A） |
| 4 | 统计增量每次 `COUNT(*)` 现算，随热帖事件数线性增长；dev 网关在列表里按帖子逐条查 SQL（N+1） | `contracts/post_stats.py:86-95,109-125`；`dev/dev_gateway.py:188-201,257-258` | P1 | 热帖计数从 O(事件数) 降为 O(1)；dev 列表从 O(N) 次 SQL 降为 1 次 |
| 5 | 所有响应一律 `Cache-Control: no-store`，带 hash 的静态资源也不可缓存、无 ETag / 压缩；`notes/list`、`stats/get` 无任何服务端缓存 | `server.py:508-523,525-550`；`dev/dev_gateway.py:476,592` | P1 | 静态资源二次访问可直接命中浏览器缓存；公开读接口减少重复 DB 查询与全量传输 |

---

## 1. 审计方法与边界

1. 逐条列出 `/mirror-api/*` 路由及其调用的数据访问函数（第 2 节）。
2. 对照 `server.py:106-164`、`contracts/notes.py:26-36`、`contracts/post_stats.py:38-52`
   的实际 schema，用 `EXPLAIN QUERY PLAN` 验证每条热点 SQL（附录 A）。
3. 用合成数据做内存微基准，只用于比较“有无索引”的相对量级；不代表生产磁盘上的绝对耗时。
4. 检查进程内 / HTTP / 前端三层缓存，记录 TTL、失效方式与 key 粒度（第 5 节）。
5. 本报告不修改代码；索引 DDL 与缓存方案均以“后续修复单可直接落地”的形式给出。

---

## 2. 数据访问路径清单

### 2.1 存储介质

| 存储 | 文件 | 内容 | 连接方式 |
|---|---|---|---|
| 订单主库 | `mirror.db`（`server.py:31`） | `users / sessions / admins / orders / order_events` | 单连接 `DB`（`server.py:91`）+ 全局 `db_lock`（`:55`） |
| 批注库 | `mirror_notes.db`（`server.py:95`） | `post_notes` | `NoteStore` 单连接 + `RLock`（`contracts/notes.py:57-63`） |
| 统计库 | `mirror_stats.db`（`server.py:96-97`） | `post_stat_events` | `PostStatStore` 单连接 + `RLock`（`contracts/post_stats.py:58-64`） |
| dev 演示态 | `dev/_state/mock_state.json`（`dev/dev_gateway.py:37,142-159`） | 整个演示站状态 | 每次请求读全量 JSON；每次写全量重写 |

### 2.2 路由 → SQL / 上游调用 → 缓存现状

| 接口 | 处理入口 | 主要 SQL（无缓存） | 外部 HTTP | 缓存 |
|---|---|---|---|---|
| `GET /mirror-api/healthz` | `server.py:637-648` | `SELECT 1` | — | 无（足够轻） |
| `GET /mirror-api/me` | `server.py:826-837` | 会话读+写、`admins` 查 1 次 | — | 无 |
| `GET /mirror-api/orders/list` | `server.py:878-900` | 会话读+写、`admins`、`orders` 列表 | — | 无 |
| `GET /mirror-api/orders/detail` | `server.py:907-921` | 会话读+写、`admins`、`orders` PK、`order_events` | — | 无 |
| `GET /mirror-api/notes/list` | `server.py:591-602` → `contracts/notes.py:121-131` | `post_notes` 1 次 | — | 无 |
| `GET /mirror-api/stats/get` | `server.py:604-615` → `contracts/post_stats.py:135-141` | `post_stat_events` 聚合 1 次（+ 会话若有） | — | 无 |
| `POST /mirror-api/notes/add` | `contracts/notes.py:133-153` | 会话读+写、`COUNT`、`INSERT`、按 id 回读 | **provision + quest/detail** | 无 |
| `POST /mirror-api/stats/view\|chat` | `contracts/post_stats.py:143-175` | 会话读+写、`INSERT OR IGNORE`、`COUNT` | **provision + quest/detail** | 无 |
| `POST /mirror-api/orders/create` | `server.py:839-876` | 会话读+写、2 条 INSERT | — | 无 |
| `POST /mirror-api/orders/status` | `server.py:925-945` | 会话读+写、`admins`、PK 读、UPDATE、INSERT | — | 无 |
| `POST /mirror-api/orders/forward` | `server.py:947-985` | 会话读+写、`admins`、PK 读、UPDATE、INSERT | official token + `quest/create` | 无 |
| `POST /mirror-api/auth/login` | `server.py:710-747,749-777` | `users` upsert、`admins`、`sessions` INSERT | password verify；管理员另做 provision | 无 |
| `POST /mirror-api/auth/sso/try` | `server.py:779-804` | 同上（无密码校验） | session/verify；管理员 provision | 无 |
| `POST /mirror-api/auth/logout` | `server.py:806-822` | `sessions` DELETE | session/revoke（失败忽略） | 无 |
| `GET /mirror-api/market/chat-history` | `server.py:987-1008` | 会话读+写、`admins` | 透传 `getChatHistory` | 无（实时数据，合理） |

> 计数口径：`resolve_session` 每次都是 1 次 SELECT + 1 次 UPDATE（`server.py:212-223`）；
> `is_admin` 是 1 次 SELECT（`:180-185`）。上表按“命中会话”计。

---

## 3. 逐项发现

### F1（P0）详情浏览链路每次触发两次公网调用，`resolve_post` 与官方 token 均无缓存

**现状**

- 非作者打开详情页即上报浏览：`web/src/components/QuestDetail.vue:69-80`，调用点在 `:94-95`。
- 后端 `stats_api`（`server.py:604-615`）把 `resolve_post` 注入契约层，
  `contracts/post_stats.py:155-160` 在写计数前一定调用它；批注写入同理
  （`server.py:591-602`、`contracts/notes.py:139-145`）。
- `market_post`（`server.py:570-578`）用会话里的 `market_token`，没有就取官方 token；
  而普通用户会话并没有集市 token——只有管理员登录时才会 provision
  （`server.py:758-766`）。因此**几乎每个浏览上报都会**：
  1. `official_market_token()` → `provision_market()` → `POST /api/sso/mirror/provision`
     （`server.py:400-408`，超时 15s，`:388`）；
  2. `market_json('/api/auth/quest/detail')` → 第二次公网 POST（`:570-578`，超时 20s，`:364`）。
- 两次调用都新建 `opener`（`server.py:387,563`），无连接复用、无 single-flight、无任何缓存。

**问题与影响**

- 每次详情浏览 = 会话续期 + 计数插入（共 2 次 SQLite 写）+ **2 个跨公网 RTT**，
  其中公网调用只为拿到一个 `authorID`。
  上游抖动时单请求可拖到 15–35s；`ThreadingHTTPServer` 每连接一线程
  （`server.py:1025`），慢上游会持续占线程，放大内存与连接数。
- 同一次详情页还会并行发起 `notes/list`（`web/src/components/AuthorNotes.vue:49-67`），两条链路互不复用
  帖子归属信息。
- 上游返回的 `authorID` 在帖子生命周期内基本不变，属于天然可缓存数据。

**建议（按收益/成本）**

1. **缓存帖子归属**：`postID -> authorID | None`，正缓存 TTL 300s，负缓存 60s，
   有界 LRU（如 10k 条）。key 只用 `postID`（归属是全局事实，与调用者无关）；
   写权限校验仍以缓存值为准，过期后回源。
2. **官方 token 缓存 + 单飞**：进程内保存 `(token, fetched_at)`，TTL 取上游返回的
   `expires`，缺失时保守 10 分钟；遇到 401/403 立即失效并只允许一个请求回源
   （`threading.Lock` + 双检）。管理员个人 token 不能复用官方 token，保持现状。
3. 上游超时从 15/20s 降到 5s，并区分“超时”与“拒绝”，避免线程被长时间占用。
4. 可选：`stats/view` 先返回当前计数、把作者核实与写入放到后台队列；
   但会牺牲“作者自浏览不计”的强一致，建议仅在此接口压力确实过大时启用。

**风险**：缓存 5 分钟意味着帖子被删除/改归属后最多 5 分钟内的写权限判断滞后。
帖子归属不可改，实际风险极低；若产品要求强一致，可把 TTL 降到 60s 并保留负缓存。

---

### F2（P0）每个会话请求都写 `sessions.last_seen`，且全局锁 + 单连接把读写全部串行

**现状**

- `resolve_session` 在每次请求中先 SELECT，再无条件
  `UPDATE sessions SET last_seen = ?`（`server.py:212-223`）。
- `SESSION_TTL` 为 30 天（`server.py:41`），过期清理只在“该 sid 再次出现”时惰性删除
  （`:219-221`）；从不出现的历史会话永久留在表中。
- 所有 SQL 共用同一个 `sqlite3.connect`（`server.py:85-91`）和同一把
  `db_lock`（`:55`）；SQLite 未启用 WAL，默认 rollback journal + `synchronous=FULL`。
- `threading` 模式下 `ThreadingHTTPServer` 可并发接入，但 DB 层实际是完全串行的。

**问题与影响**

- 每个带会话的请求都产生一次小型写事务（B-Tree 更新 + journal）。
  在 `/home/cloud` 这类 HDD 上（本仓库默认 `DB_PATH = ROOT/mirror.db`，`server.py:31`），
  写入成本远高于内存；写期间还持有 `db_lock`，同进程所有读请求一起排队。
- 一个详情请求会多次进出锁：会话读、会话写、管理员查、订单查、事件查
  （`server.py:907-921`），锁竞争随并发线性恶化。
- 过期会话无后台回收，`sessions` 表只增不减；`last_seen` 也没有索引可供批量清理。

**建议（按收益/成本）**

1. **节流 `last_seen` 写入**：只有 `now - last_seen > 300s` 才 UPDATE。
   会话续期精度从“每请求”降到 5 分钟，对 30 天 TTL 无感，写量可下降 1–2 个数量级。
2. **开启 WAL + 显式 PRAGMA**（对每个 SQLite 文件各做一次）：

   ```python
   conn.execute("PRAGMA journal_mode=WAL")      # 持久属性，写一次即可
   conn.execute("PRAGMA synchronous=NORMAL")    # WAL 下兼顾安全与吞吐
   conn.execute("PRAGMA busy_timeout=5000")     # 当前连接默认 5s，建议显式化
   ```

   WAL 允许“多读 + 单写”并行，读者不再被写者阻塞。注意 `mirror.db-wal/-shm`
   会与主库同目录，备份/迁移时要一起处理；`.gitignore` 已有 `mirror.db-*`，
   dev 的两个 `*.db` 也已被忽略。
3. **连接模型**：单连接 + 全局锁仍在应用层串行，WAL 的收益会被锁吃掉。
   建议改为 `threading.local()` 每线程一个连接（写仍由 SQLite 串行化，靠
   `busy_timeout` 等待），或读用独立只读连接池、写用单连接。
4. **后台清理**：启动时 + 每 30–60 分钟执行
   `DELETE FROM sessions WHERE last_seen < ?`，并加 `idx_sessions_last_seen`（见 4.1）。
5. 把 `is_admin` 结果放进带 TTL 的进程缓存（见 F6），避免会话路径上多一次查表。

**风险**：WAL 需要持久化目录可写且支持共享内存（本仓库都是本地文件，满足）；
网络文件系统（NFS 等）不支持 WAL，如未来把 DB 放到网络盘需回退。

---

### F3（P0）`orders/list` 缺少与排序匹配的复合索引，管理员列表整表扫描 + 临时排序

**现状**

- 查询构造：`server.py:878-900`。
  - 普通用户：`WHERE owner_email = ? [AND status = ?] ORDER BY created DESC LIMIT 200`；
  - 管理员 `scope=all`：`[WHERE status = ?] ORDER BY created DESC LIMIT 200`。
- schema 只有 `idx_orders_owner(owner_email)`（`server.py:152`），没有 `created` / `status`
  相关索引；`ORDER BY created DESC` 只能建临时 B-Tree。
- `EXPLAIN QUERY PLAN` 实测（附录 A）：

  | 查询 | 当前计划 |
  |---|---|
  | 普通用户列表 | `SEARCH orders USING INDEX idx_orders_owner` + **`USE TEMP B-TREE FOR ORDER BY`** |
  | 普通用户 + 状态 | `SEARCH ... idx_orders_owner` + **临时排序** |
  | 管理员全量 | **`SCAN orders`** + **临时排序** |
  | 管理员 + 状态 | **`SCAN orders`** + **临时排序** |

**问题与影响**

- 管理员全量列表随订单总量线性变慢；临时排序在数据量大时会使用临时文件/内存，
  同时 `SELECT *` 需要回表取完整行。
- 普通用户列表虽然能按 `owner_email` 定位，但仍要对“该用户全部订单”排序后取前 200；
  单个用户订单多时同样退化。
- 合成数据 5 万行、内存库微基准：管理员全量列表 **4.92ms → 0.27ms**（约 18×）；
  普通用户列表 0.22ms → 0.14ms（见附录 A）。真实 HDD 上排序与回表代价更高。

**建议**

在 `init_db` 的建表脚本（`server.py:106-164`，已全部使用 `IF NOT EXISTS`）中追加：

```sql
-- 普通用户：WHERE owner_email ORDER BY created DESC
CREATE INDEX IF NOT EXISTS idx_orders_owner_created
  ON orders(owner_email, created DESC, id DESC);

-- 普通用户 + 状态筛选
CREATE INDEX IF NOT EXISTS idx_orders_owner_status_created
  ON orders(owner_email, status, created DESC, id DESC);

-- 管理员 scope=all（无状态筛选）
CREATE INDEX IF NOT EXISTS idx_orders_created
  ON orders(created DESC, id DESC);

-- 可选：管理员按状态筛全量；不加则退化为扫 created 索引后过滤
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created DESC, id DESC);
```

- `id DESC` 作为次级排序键，保证同一秒创建的订单顺序稳定（`now_iso` 精度到秒，
  `server.py:176-177`）。`created` 是 ISO 文本，字典序即时间序，可直接建索引。
- **成本权衡**：每多一个索引，`orders` 的 INSERT/UPDATE 多一次 B-Tree 维护。
  订单写入频率远低于列表读，前三个索引收益明确；第四个仅在管理员经常按状态筛时加。
  验证结果：只加前三个索引时，管理员按状态筛 0.70ms；加第四个降到 0.28ms（附录 A）。
- 若要进一步减小回表，可把列表改为只 SELECT 卡片所需列；但当前 `order_row_json`
  需要大部分字段，收益有限，优先级低。

**迁移思路**

- 本项目无独立 migration 框架，`init_db()` 每次启动执行
  `CREATE INDEX IF NOT EXISTS`，存量库会在下次启动时自动补索引，无需手工步骤。
- 若线上订单表已很大，首次建索引会短暂持有写锁：建议在低峰重启，或先备份
  `mirror.db`，再用 `sqlite3 mirror.db "CREATE INDEX ..."` 手工创建并 `PRAGMA index_list(orders)` 验证。

---

### F4（P1）统计计数每次 `COUNT(*)` 现算，热帖成本随事件数线性增长

**现状**

- 每次读/写统计都执行
  `SELECT kind, COUNT(*) ... WHERE post_id = ? GROUP BY kind`
  （`contracts/post_stats.py:86-95`），并由 `_absolute` 在 GET 和每次写后各调用一次
  （`:109-125,139-141,173-175`）。
- schema 只有事件表 + 去重唯一索引（`contracts/post_stats.py:38-52`）。
- dev 网关列表对每个帖子各查一次 `STATS.deltas`（`dev/dev_gateway.py:188-201`，
  列表推导在 `:257-258`），是明确的 N+1。

**问题与影响**

- 事件表按“账号 × 帖子 × 对象”去重后仍会随热度增长。一个 1 万浏览的帖子，
  每次 GET `/stats/get` 或每次新浏览上报都要扫 1 万条索引记录；帖子越热越慢。
- 当前索引 `idx_stat_post(post_id, kind)` 是覆盖索引，单次 COUNT 不慢，但复杂度是
  **O(该帖事件数)**，且读放大与写入频率相乘。
- dev 网关的 N+1 在 4 条演示数据上无感，但它是同一契约的可复用实现，
  一旦演示数据增长或被人复制到更大规模会立刻暴露。

**建议（按收益/成本）**

1. **计数表 + 触发器**（推荐，三端自动一致）：

   ```sql
   CREATE TABLE IF NOT EXISTS post_stat_counts (
     post_id TEXT NOT NULL,
     kind    TEXT NOT NULL CHECK (kind IN ('view', 'chat')),
     n       INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (post_id, kind)
   ) WITHOUT ROWID;

   CREATE TRIGGER IF NOT EXISTS trg_stat_count AFTER INSERT ON post_stat_events
   BEGIN
     INSERT INTO post_stat_counts(post_id, kind, n) VALUES (NEW.post_id, NEW.kind, 1)
     ON CONFLICT(post_id, kind) DO UPDATE SET n = n + 1;
   END;
   ```

   - `INSERT OR IGNORE` 被忽略时不会触发 INSERT 触发器，去重语义不变。
   - 首次迁移回填一次：

     ```sql
     INSERT INTO post_stat_counts(post_id, kind, n)
     SELECT post_id, kind, COUNT(*) FROM post_stat_events GROUP BY post_id, kind
     ON CONFLICT(post_id, kind) DO UPDATE SET n = excluded.n;
     ```

   - `deltas()` 改为 `SELECT kind, n FROM post_stat_counts WHERE post_id = ?`，
     缺失的 kind 补 0；O(1)。
   - 事件表继续保留，用于去重与审计，不删历史。
2. **dev 网关批量查询**：给 `PostStatStore` 增加
   `deltas_many(post_ids) -> {post_id: {view, chat}}`，用一条
   `WHERE post_id IN (...) GROUP BY post_id, kind` 完成；列表只调用一次。
   若采用计数表，`deltas_many` 同样是一条按 `post_id` 的等值/IN 查询。
3. 低风险过渡方案：进程内缓存 `(postID, kind) -> n`，TTL 30s，写入时递增；
   但重启后需回源，且多进程部署会不一致，不如计数表稳妥。

**风险**：触发器与计数表改变 `contracts/post_stats.py` 的写入语义，需要同步三端
（生产、dev、试玩包）的 schema 与测试（`npm run verify` 有 14 组统计语义用例）。
建议作为独立修复单，附回填脚本与一致性校验 SQL：

```sql
SELECT e.post_id, e.kind, COUNT(*) AS real_n, c.n
FROM post_stat_events e
LEFT JOIN post_stat_counts c ON c.post_id = e.post_id AND c.kind = e.kind
GROUP BY e.post_id, e.kind
HAVING real_n != COALESCE(c.n, 0);
```

---

### F5（P1）HTTP 缓存策略缺失：静态资源也被 `no-store`，公开读接口无缓存 / 无 ETag

**现状**

- `MirrorHandler.send()` **无条件**加 `Cache-Control: no-store`（`server.py:518`），
  而 `static_file()` 走的就是 `send()`（`:525-550`），所以 `web/dist/assets/*`
  这些带内容 hash 的 JS/CSS、`hero-bg.jpg`（README 记载 251KB）全部不可缓存。
- 没有任何 `ETag` / `Last-Modified` / `304` 处理；没有 gzip/br 压缩。
- 公开读接口 `GET /mirror-api/notes/list`、`GET /mirror-api/stats/get`
  （`server.py:625-631`）每次请求都查库并传完整 JSON。
- dev 网关同样对所有 JSON 与静态响应加 `no-store`
  （`dev/dev_gateway.py:476,592`）。

**问题与影响**

- 每次刷新/切页都重新下载全部静态资源，校园网与 HDD 环境下首屏明显变慢，
  也浪费带宽；这与“带 hash 的资源可以永久缓存”的常规做法相反。
- 公开读接口没有协商缓存，轮询或多用户重复访问会重复查库、重复传输。
  帖子详情每次挂载 `AuthorNotes` 都会触发一次 `notes/list`（`web/src/components/AuthorNotes.vue:49-67`）。
- JSON 未压缩，批注列表和统计响应在网络层体积偏大。

**建议（按收益/成本）**

1. **静态资源分级缓存**（低成本，收益最大）：
   - `web/dist/assets/*`（Vite 内容 hash，URL 变化即失效）：
     `Cache-Control: public, max-age=31536000, immutable`；
   - `index.html`：`Cache-Control: no-cache`（每次协商，保证发版后立即生效）；
   - `web/public/*` 无 hash 的固定资源：`public, max-age=86400` + `ETag`。
   实现上建议让 `send()` 接受 `cache_policy` 参数，或静态路径绕过统一 `no-store`。
2. **ETag / 304**：静态文件用 `(st_mtime_ns, size)` 生成弱 ETag；
   公开 API 用“该帖最大事件 id / 批注条数”生成 ETag，成本低于返回全量。
3. **API 缓存分级**：
   - 会话/订单类：保持 `no-store`（含个人信息）；
   - 公开的 `notes/list`、`stats/get`：`Cache-Control: private, max-age=5` 或
     `no-cache` + ETag，允许 5 秒陈旧；
   - `stats/view/chat`、`notes/add` 等写接口继续 `no-store`。
4. **服务端短期缓存**（与 5.2 的缓存矩阵配合）：
   `notes/list` key=`postID`，TTL 30–60s，写入成功时追加/失效；
   `stats/get` 若采用 F4 的计数表则本身就是 O(1)，可不加缓存。
5. **压缩**：对 `text/*`、`application/json`、`image/svg+xml` 且 >1KB 的响应启用
   gzip；静态资源可在构建时预压缩 `.gz`，运行期零成本。

**风险**：`index.html` 若误设为长期缓存，发版后用户会长期拿到旧入口，必须用
`no-cache` 而非 `immutable`。公开 API 的 5 秒陈旧对计数展示可接受，对权限数据不可用
（权限接口不在缓存白名单内）。

---

### F6（P2）管理员身份每个请求现查一次，可在会话路径上缓存

**现状**

- `is_admin()` 每次都查 `admins`（`server.py:180-185`）；它在 `api_me`、`order_list`、
  `order_detail`、`order_status`、`order_forward`、`market_chat_history`
  中被重复调用（如 `:836,883,917,927,949,990`）。
- 索引方面没有问题：`idx_admins_sub` 是部分唯一索引（`server.py:168-170`），
  等值查询命中良好。

**问题与影响**

- 每个带会话请求多一次等值查询；与 F2 的全局锁叠加后，属于可省掉的固定开销。
- 管理员集合变动很少，适合短 TTL 缓存。

**建议**

- 进程内缓存 `sso_sub -> (is_admin, fetched_at)`，TTL 60s，key 用 `sso_sub`
  （不要用 email，避免改名/多账号问题）。
- 管理员名单变更（手工改库）最多 60s 生效；若要求立即生效，可在管理操作后清空缓存。
- 不要把 `is_admin` 固化进 30 天会话行，否则撤权要等会话过期。

---

### F7（P2）存在无用索引，同时缺少会话清理所需索引

**现状**

- `idx_users_email ON users(email)`（`server.py:118`）：全仓库没有按 `email` 查 `users`
  的 SQL——`upsert_user` 只按主键 `sso_sub` 冲突更新（`:188-197`），也没有 SELECT。
- `idx_sessions_email ON sessions(email)`（`server.py:128`）：`sessions` 只按 `sid`
  查/删（`:216,220,818`），从不按 email 查。
- 过期会话清理需要按 `last_seen` 扫描，但没有对应索引（`sessions` 仅 PK）。
- `order_events(order_id)`（`:163`）与 `post_notes(post_id, id)`（`contracts/notes.py:35`）经
  `EXPLAIN` 验证已能同时满足过滤与排序，无需改。

**问题与影响**

- 两个无用索引让 `users` / `sessions` 的每次写入多维护一棵 B-Tree；会话表是高频写表
  （见 F2），这部分成本是持续的。
- 没有 `last_seen` 索引时，批量清理只能全表扫描，清理本身会变成慢查询。

**建议**

```sql
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_sessions_email;
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);
```

- **必须同时删除** `server.py:118` 与 `:128` 的两条 `CREATE INDEX`；只加 `DROP` 的话，
  每次启动会先建后删，做无用功。删除 `CREATE` 后把 `DROP` 留在脚本里，
  对存量库首次启动生效，之后是空操作。
- 执行前确认没有仓库外的脚本按 email 查这两张表（本次只在仓库内做了检索）。
- 清理任务与 F2 的节流写入一起做；建议保留至少 30 天 TTL 再加余量。

---

### F8（P2）dev 网关：每次请求解析全量 JSON，每次写全量重写，且列表存在 N+1

**现状**

- `mock_dispatch` 每个请求都 `load_state()`（`dev/dev_gateway.py:206`），
  即读取并 `json.loads` 整个 `mock_state.json`（`:142-151`）；
  任何写操作都 `save_state()` 全量序列化 + 临时文件 + rename（`:154-159`）。
- `peer_unread_map` 在首次 GET `/api/auth/quest/chatPeers` 时也会写盘（`:165-173,414-427`），
  即**读路径触发写**。
- 列表接口对每个帖子调用 `with_comments`（`:257-258`），后者对每个帖子执行一次
  `STATS.deltas` SQL（`:196-200`）。

**问题与影响**

- 演示数据只有 4 条帖子时不明显；但每次评论、浏览、已读都会重写整个状态文件，
  帖子数增长后是 O(总数据量) 的磁盘写。
- 列表的 O(N) 次 SQL 是契约层的 N+1（见 F4）。
- 仅影响 dev Pod，不涉及生产，故列为 P2；但它是 `contracts/post_stats.py` 的复用方，
  修复计数表时应一并处理。

**建议**

- 进程内缓存 `(mtime, state)`，命中则不再解析 JSON；写操作合并为短延迟批量落盘
  （如 200ms debounce），或长期迁移到 SQLite（与生产同一套 Store）。
- 首次初始化 `peerUnread` 放到启动时（`main()`），读接口不再写盘。
- 列表改用 F4 的 `deltas_many`，一次查询拿全量。
- 若演示站点长期保留，建议直接复用 `PostStatStore` / `NoteStore` 之外的
  结构化存储，避免 JSON 全量读写。

---

### F9（P2）前端 30 秒轮询在后台标签页不会暂停，放大了会话接口压力

**现状**

- `POLL_MS = 30000`（`web/src/stores/unread.js:15`），`startUnreadPolling` 直接
  `setInterval(refreshUnread, POLL_MS)`（`:133-140`）。
- `onVisibility` 只在页面变为可见时补一次刷新（`:127-131`）；定时器回调
  **没有检查 `document.hidden`**，隐藏标签页仍会每 30 秒发一次 `chatPeers`。
- README 宣称“页面隐藏时暂停轮询”（`README.md:134-135`），与实现不符。

**问题与影响**

- 每个打开的标签页 × 每 30 秒一次；多标签、多用户的校园场景下，
  这是会话/未读接口最稳定的背景流量。浏览器对后台定时器有节流，但不会归零，
  且节流后仍会周期性唤醒网络。
- `refreshUnread` 已有防重入与指数退避（`:97-125`），说明作者已考虑压力，
  缺的只是可见性门控。

**建议**

- 在 `refreshUnread()` 开头或定时器回调中加 `if (document.hidden) return`，
  由 `visibilitychange` 负责恢复；这与 README 描述一致，改动极小。
- 若产品允许，可把前台轮询降到 60s，或改用 WebSocket/SSE 推送未读变化。
- 该问题不在“后端 SQL”范围内，但直接决定 F2/F6 热点接口的 QPS，建议与后端缓存同批处理。

---

### F10（P3）限流器内存无淘汰，且按 IP 粒度可能误伤 NAT 用户

**现状**

- `rate_events` 是一个普通 dict（`server.py:54`），`allow_rate` 只在同一 IP 再次请求时
  清理该 IP 的旧事件（`:479-488`）；IP 键本身永不删除。

**问题与影响**

- 长期运行时键数量只增不减（每个访问过的 IP 一条），属于缓慢内存泄漏；
  单条事件列表有上限（40 条），量级不大，但属于无界增长。
- 校园网/办公网常见 NAT，大量用户共享出口 IP，40 次/分钟很容易被合并计数，
  造成“正常用户被 429”。这是可用性问题，不是慢查询，但会放大重试流量。

**建议**

- 每次限流检查顺带清理过期键（例如每 N 次调用扫描一次），或换成带 TTL 的有界结构。
- 评估把登录/写接口的限流键从纯 IP 改为 `IP + 会话/账号` 的组合；
  未登录接口再退回纯 IP。

---

## 4. 索引与 schema 建议汇总

### 4.1 建议 DDL

> 以下语句可直接追加到 `server.py:init_db()` 的 `executescript` 中；
> 现有建表/建索引全部使用 `IF NOT EXISTS`，对存量库在下次启动时自动生效。
> 其中两条 `DROP INDEX` 还需同步删除 `server.py:118,128` 的旧 `CREATE INDEX`，
> 否则每次启动会重建再删除。

```sql
-- orders：列表排序（详见 F3）
CREATE INDEX IF NOT EXISTS idx_orders_owner_created
  ON orders(owner_email, created DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_owner_status_created
  ON orders(owner_email, status, created DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created
  ON orders(created DESC, id DESC);
-- 可选，管理员按状态筛全量时再加
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created DESC, id DESC);

-- sessions：过期清理（详见 F2 / F7）
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen);

-- 清理无用索引
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_sessions_email;

-- 统计计数（详见 F4，属于独立修复单，需同步三端契约）
CREATE TABLE IF NOT EXISTS post_stat_counts (
  post_id TEXT NOT NULL,
  kind    TEXT NOT NULL CHECK (kind IN ('view', 'chat')),
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, kind)
) WITHOUT ROWID;

CREATE TRIGGER IF NOT EXISTS trg_stat_count AFTER INSERT ON post_stat_events
BEGIN
  INSERT INTO post_stat_counts(post_id, kind, n) VALUES (NEW.post_id, NEW.kind, 1)
  ON CONFLICT(post_id, kind) DO UPDATE SET n = n + 1;
END;
```

### 4.2 migration 思路

- 订单 / 会话索引：随 `init_db()` 启动自动创建，无需迁移脚本。
- 统计计数表：需要一次性回填（见 F4 的 `INSERT ... SELECT ... ON CONFLICT`）。
  建议用一张 `schema_meta(key, value)` 记录 `stats_backfill_v1=done`，
  避免每次启动重复回填；回填与后续触发器在同一事务中完成。
- 大表首次建索引会持写锁：先 `cp mirror.db mirror.db.bak`，低峰重启；
  或手工执行 DDL 后用 `EXPLAIN QUERY PLAN` 复核。
- 回滚：索引可随时 `DROP`；计数表回滚时删除触发器与计数表即可，
  事件表是唯一真源，不会丢数据。

### 4.3 不建议改动的索引

| 索引 | 结论 |
|---|---|
| `idx_events_order(order_id)` | 已验证 `ORDER BY id` 无需临时排序（rowid 作为索引尾部键），保持 |
| `idx_post_notes_post(post_id, id)` | 同时满足 `WHERE post_id` 与 `ORDER BY id`，保持 |
| `idx_stat_post(post_id, kind)` | 覆盖 `GROUP BY kind`，保持（计数表上线后可仅用于回填/校验） |
| `idx_admins_sub` 部分唯一索引 | 等值查询命中，保持 |

---

## 5. 缓存策略建议

### 5.1 当前缺口归纳

1. **没有应用层读缓存**：会话、管理员身份、订单列表/详情、批注列表、统计计数全部现查。
2. **没有上游结果缓存**：帖子归属、官方 token 每次都回源（F1）。
3. **没有写节流**：会话 `last_seen` 每请求写（F2）。
4. **HTTP 层一刀切 `no-store`**：连带 hash 的静态资源也不可缓存，且无 ETag/压缩（F5）。
5. **失效机制缺失**：TTL、key 粒度、写后失效都没有统一定义；
   `sessions` 过期只靠“再次访问时惰性删除”，没有后台回收（F2/F7）。
6. **前端轮询无可见性门控**，持续放大后端 QPS（F9）。

### 5.2 缓存矩阵（建议）

| 数据 | 层 | key | TTL | 失效方式 | 一致性要求 |
|---|---|---|---|---|---|
| 会话行 | 进程内 | `sid` | 15–30s | 登出删除；TTL 到期；过期立即失效 | 中（登出需即时，可显式清 key） |
| `last_seen` 写 | 进程内时间戳 | `sid` | 节流 300s | 写回 DB | 低 |
| 管理员标记 | 进程内 | `sso_sub` | 60s | TTL；管理操作后清空 | 中 |
| 帖子归属 | 进程内 LRU | `postID` | 正 300s / 负 60s | TTL；401/403 回源 | 中（帖子归属不可变） |
| 官方 token | 进程内单值 | `official` | `min(expiry, 10min)` | 401/403 失效，单飞回源 | 高（token 不能并发重复换取） |
| 批注列表 | 进程内 | `postID` | 30–60s | 写入成功后追加或删除 key | 中 |
| 统计计数 | SQLite 计数表 | `(postID, kind)` | 无（写穿） | 插入事件时 +1 | 高（唯一真源仍是事件表） |
| 订单列表 | 进程内（可选） | `(owner_email, status)` 或 `(admin, status)` | 5–10s | 创建/改状态/转发后失效 | 中 |
| 静态资源 | 浏览器/CDN | URL（带 hash） | 1 年 immutable | 文件名变化 | 高（hash 保证） |
| `index.html` | 浏览器 | 路径 | `no-cache` | 发版后协商 | 高 |
| 公开 API | 浏览器 | URL + ETag | `private, max-age=5` / 304 | ETag 变化 | 低（计数可短暂陈旧） |

### 5.3 实施顺序与一致性约束

1. **先做无状态、低风险项**：静态资源分级缓存 + ETag（F5）、会话写节流（F2）、
   管理员缓存（F6）、前端可见性门控（F9）。这些不需要改 schema，回滚简单。
2. **再做上游缓存**（F1）：纯进程内、TTL 可调；注意 token 必须单飞，
   避免并发请求同时 provision。
3. **最后做 schema 变更**（F3/F4/F7）：索引随启动自动建；统计计数表需要回填与三端契约同步，
   建议独立修复单，先补测试（`npm run verify` 的统计用例）再上线。
4. 所有进程内缓存必须**有界**（LRU / 最大条数），否则会变成新的内存泄漏；
   所有 TTL 必须可配置（环境变量或契约常量），便于线上调参。
5. 缓存只缓存“可重建的数据”；**订单/权限的判断结果不要把长期身份固化进会话**，
   管理员权限与会话身份分离，避免撤权延迟 30 天。

---

## 6. 收益 / 成本排序

| 优先级 | 改动 | 预期收益 | 成本 / 风险 |
|---|---|---|---|
| 1 | 帖子归属 + 官方 token 缓存、超时下调（F1） | 详情浏览去掉 2 个公网 RTT，尾延迟与线程占用显著下降 | 低；TTL 内归属滞后可接受 |
| 2 | 会话 `last_seen` 节流 + WAL（F2） | 每请求写事务消失；读写不再互相阻塞 | 低–中；WAL 需持久化盘，连接模型需调整才能吃满收益 |
| 3 | 订单列表复合索引（F3） | 管理员列表由整表扫描+排序降为索引扫描；实测约 18× | 低；写放大略有增加 |
| 4 | 静态资源缓存 + ETag（F5） | 二次访问零下载；首屏流量与延迟下降 | 低；注意 `index.html` 不能长缓存 |
| 5 | 统计计数表 + dev 批量查询（F4/F8） | 热帖计数 O(1)；dev 列表 O(N) SQL → 1 条 | 中；跨三端契约与回填 |
| 6 | 管理员缓存（F6） | 每请求省一次查表 | 低；60s 撤权延迟 |
| 7 | 批注列表缓存（F5/F1 配套） | 详情页重复读降为进程内命中 | 低–中；写后失效需正确 |
| 8 | 会话清理 + 无用索引清理（F2/F7） | 控制表增长与写放大 | 低；需确认无外部脚本依赖 |
| 9 | dev 网关状态缓存 / 批量化（F8） | dev 响应更稳，避免全量重写 | 低；仅 dev |
| 10 | 前端轮询可见性门控（F9） | 后台标签页 QPS 归零 | 极低；与 README 对齐 |
| 11 | 限流器淘汰与粒度（F10） | 内存有界、减少 NAT 误伤 | 低；策略需产品确认 |

---

## 7. 已核查、无需改动的事项

- **生产订单读路径没有典型 N+1**：`order_list` 不逐条取事件（`server.py:878-900`），
  详情固定 2 条查询（订单 PK + 事件，`:902-921`），并非 N+1。
  真正的问题是 F3 的排序索引与 F2 的重复会话写。
- **`order_events` 查询**：`WHERE order_id = ? ORDER BY id` 可全程走
  `idx_events_order`，无临时排序（附录 A），无需复合索引。
- **批注查询**：`post_notes(post_id, id)` 同时覆盖过滤与排序；`COUNT(*)` 上限 20 条，
  成本可控（`contracts/notes.py:35,65-96`）。
- **统计去重**：两个部分唯一索引 + `INSERT OR IGNORE` 在并发下仍只记一次
  （`contracts/post_stats.py:38-52,70-78`），语义正确。
- **参数化 SQL**：所有 SQL 均使用 `?` 占位符，没有拼接用户输入，无注入风险。
- **管理员查询索引**：`idx_admins_sub` 部分唯一索引可用，无需新增。
- **`market_chat_history` 不缓存**：实时会话数据，缓存反而带来隐私与一致性问题，
  保持透传是合理的（`server.py:987-1008`）。

---

## 附录 A：查询计划与微基准

### A.1 `EXPLAIN QUERY PLAN`（复刻仓库 schema，SQLite 内存库）

```
## 当前：普通用户列表
SEARCH orders USING INDEX idx_orders_owner (owner_email=?)
USE TEMP B-TREE FOR ORDER BY

## 当前：普通用户 + 状态
SEARCH orders USING INDEX idx_orders_owner (owner_email=?)
USE TEMP B-TREE FOR ORDER BY

## 当前：管理员全量
SCAN orders
USE TEMP B-TREE FOR ORDER BY

## 当前：管理员 + 状态
SCAN orders
USE TEMP B-TREE FOR ORDER BY

## order_events（无需改）
SEARCH order_events USING INDEX idx_events_order (order_id=?)

## post_notes 列表 / 计数（无需改）
SEARCH post_notes USING INDEX idx_post_notes_post (post_id=?)
SEARCH post_notes USING COVERING INDEX idx_post_notes_post (post_id=?)

## post_stat_events 聚合（无需改）
SEARCH post_stat_events USING COVERING INDEX idx_stat_post (post_id=?)
```

### A.2 加索引后的计划

```
普通用户列表        SEARCH orders USING INDEX idx_orders_owner_created (owner_email=?)
普通用户 + 状态     SEARCH orders USING COVERING INDEX idx_orders_owner_status_created
                    (owner_email=? AND status=?)
管理员全量          SCAN orders USING INDEX idx_orders_created
管理员 + 状态       SEARCH orders USING INDEX idx_orders_status_created (status=?)
```

### A.3 内存微基准（合成 5 万订单，仅比较相对量级）

| 查询 | 当前索引 | 加 4 个索引后 |
|---|---|---|
| 普通用户列表 `owner_email` + 排序 | 0.22ms | 0.14ms |
| 管理员全量 + 排序 | **4.92ms** | **0.27ms**（约 18×） |
| 普通用户 + 状态 | 0.06ms（该用户仅 100 行） | 0.03ms |
| 管理员 + 状态 | 无状态索引时需扫 created 索引 | 加状态索引 0.28ms；只加前三个索引 0.70ms |

> 说明：内存库、数据均匀分布、无 I/O 与锁竞争，绝对数值不代表生产；
> 结论只用于说明“临时排序 / 整表扫描”和“索引有序扫描”的复杂度差异。
> 生产库位于 HDD 时，回表与排序的实际代价更高。

### A.4 单请求数据库开销（按代码路径计数）

| 请求 | SQL 次数 | 上游 HTTP | 说明 |
|---|---|---|---|
| `GET /me` | 3 | — | 会话 SELECT + 会话 UPDATE + `admins` |
| `GET /orders/list` | 4 | — | 会话 ×2 + `admins` + 列表 |
| `GET /orders/detail` | 5 | — | 会话 ×2 + `admins` + 订单 PK + 事件 |
| `GET /notes/list`（无会话） | 1 | — | 公开读 |
| `POST /stats/view` | 4 | **2** | 会话 ×2 + INSERT + COUNT |
| `POST /notes/add` | 5 | **2** | 会话 ×2 + COUNT + INSERT + 回读 |
| `POST /orders/status` | 6 | — | 会话 ×2 + `admins` + PK + UPDATE + INSERT |
| `POST /orders/forward` | 6 | 2–3 | 另含官方 token / 发帖 |

`resolve_session` 的 SELECT+UPDATE 在下表中已各计 1 次；`is_admin` 已计入。

---

## 附录 B：可选的并发数据完整性加固（非性能）

`order_forward` 先读 `market_post_id`、再发帖、再写回（`server.py:947-984`），
两个并发管理员请求可能都通过“未转发”检查，导致同一订单在集市发出两条帖子。
这属于正确性问题，不属于慢查询，但如果要动 `orders` 索引，建议顺手加：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_market_post
  ON orders(market_post_id) WHERE market_post_id != '';
```

或在写回时使用条件更新：
`UPDATE orders SET market_post_id = ? ... WHERE id = ? AND market_post_id = ''`，
再根据 `rowcount` 判断是否抢到转发权。是否纳入修复范围由产品/运维决定。
