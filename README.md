# 沕鉴·Mirror（原 Quest 外院需求站 · 测试版）

独立前端 + 集市 `SSE_market_server` Quest API。不影响既有发帖/浏览逻辑。

## 功能

- 列表（全部 / 悬赏 / 求助）方案 A 卡片
- 发帖：悬赏可选理想金额；求助无金额
- 详情 + 评论（复用集市评论 API）
- 私聊（复用集市 WebSocket Chat）
- 测试登录：集市邮箱密码

## 后端（需部署到集市服务器）

新增路由（独立模块）：

- `GET  /api/auth/quest/me`
- `POST /api/auth/quest/list`
- `POST /api/auth/quest/detail`
- `POST /api/auth/quest/create`

数据库：见 `SSE_market_server/docs/migrations/20260827_quest_mvp.sql`  
回滚：见 `SSE_market_server/docs/quest-mvp-rollback.md`

### 配置（application.yml）

```yaml
quest:
  external_user_ids: ""      # 或环境变量 QUEST_EXTERNAL_USER_IDS=123,456
  test_allow_all_post: true  # 测试 true；正式请 false
```

`test_allow_all_post: true` 时任意登录用户可 Quest 发帖；正式环境关闭并配置外院 userID 或 `user_type=external`。

## 前端打包

```bash
cd quest/scripts
./build-zip.sh
```

产出：`quest/quest.zip` → 上传到 sdpy **quest** 模块 → 部署测试。

访问：`https://ssemarket.cn/sdpy/test/quest/`（以控制台为准）

## 本地开发

```bash
# 后端：在 SSE_market_server 目录重启服务（会 AutoMigrate 新列，additive）

cd quest/web
npm install
npm run dev
# 可选 .env：VITE_API_BASE=https://ssemarket.cn/api
```

## 数据说明

- Quest 帖：`partition=主页`，`post_kind=bounty|inquiry`
- 集市主页 browse 可见（普通帖样式，无角标改动）
- Quest 列表只显示 `post_kind` 为 bounty/inquiry 的帖
