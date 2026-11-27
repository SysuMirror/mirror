# 沕鉴 Mirror

沕鉴面向高校与企业承接软件研发与交付。官网展示研发服务、工程实践和交付方式，访客可直接提交项目咨询。

## 运行

使用 Node.js 22.5 或更新版本，无需安装前端依赖。

```sh
npm start
```

Linux Pod 仍可使用 `./run.sh` 或 `./deploy.sh`。缺省监听 `0.0.0.0:8080`。服务端和工单命令都读取项目根目录的 `.env`，已有系统环境变量优先。生产环境可将 `MIRROR_DB` 指向持久化卷上的 SQLite 文件。除非做临时测试，使用文件路径。

## 受理项目工单

官网通过 `POST /api/project-inquiries` 保存项目需求和联系方式，成功后给出工单编号。状态与处理历史写入同一个 SQLite 数据库。提交重试按同一请求编号去重。

团队通过服务器 SSH 会话读取和处理工单：

```sh
npm run inquiries -- list pending
npm run inquiries -- show <工单编号>
npm run inquiries -- status <工单编号> accepted "已安排需求沟通"
```

状态可用 `pending`、`accepted`、`in_progress`、`done`、`closed`。项目编号由网页回执和工单列表提供。使用与服务进程相同的 `MIRROR_DB` 和 SQLite 文件权限。读取联系人和更新状态均在服务器上执行。

启动兼容现有数据库。已有工单及其他历史表原地保留，团队命令只读取官网咨询。旧社区入口 `/app.html` 转到官网，旧登录和派单接口已下线。健康检查支持 `/api/healthz` 与原部署使用的 `/mirror-api/healthz`。

## 页面与验证

- `web/index.html` 是官网。碎镜开屏在原位置过渡到首页主视觉。
- `web/landing-mirror.js` 绘制开屏和镜面拼合。
- `web/landing-fx.js` 增强导航并提交项目咨询。
- `project-inquiries.js` 管理咨询存储，`scripts/project-inquiries.js` 提供团队处理命令。

```sh
npm test
./scripts/smoke-test.sh http://127.0.0.1:8080
```
