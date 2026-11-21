# 沕鉴·Mirror 前端还原工程交接文档

最后更新：2026-11-22 · 当前 dev3 HEAD：`d31874d`（与线上原版逐块对齐状态）

---

## 一、这个仓库是什么

Gitee 仓库 `yukai921/mirror`，三个分支：

| 分支 | 状态 | 说明 |
|---|---|---|
| `main` | `efa5d48` | **保底备份，任何情况下不要动** |
| `dev` | `571957e` | 旧开发线，不要动 |
| `dev3` | `d31874d` | 当前工作分支，restore-web 在这里 |

`restore-web/` 是「沕鉴·Mirror」前端（`mirror.ssemarket.cn`）的 Vue 3 还原工程。
线上生产前端源码不在任何分支里（仓库里的 `web/src` 是老的 7 页面结构），
restore-web 是基于线上编译产物逆向还原的，**静态优先、不接接口**（登录态用演示数据占位）。

## 二、代码位置（改哪里）

```
restore-web/
├── package.json             依赖：vue / vue-router / vite（无 UI 组件库）
├── vite.config.js           @ 别名指向 src
├── deploy.sh                部署入口（静态 SPA 服务器，dist 缺失时自动构建）
├── public/assets/           6 张 webp 截图 + favicon（原站下载的原图）
└── src/
    ├── main.js              入口：v-reveal 滚动显现指令 + 旧 hash 链接兼容
    ├── router/index.js      路由（web history + scrollBehavior 锚点滚动）
    ├── store/session.js     登录态占位（接后端时替换）
    ├── styles/base.css      全部样式——线上编译产物 CSS 原样移植（去掉了 Vue scoped 标记）
    ├── components/
    │   ├── SiteNav.vue      顶部导航
    │   ├── SiteFooter.vue   页脚
    │   ├── ParticleField.vue hero 粒子背景（canvas，2D 粒子连线）
    │   ├── ServiceList.vue  服务列表
    │   ├── AppNav.vue       需求侧底部标签栏
    │   └── MineSheet.vue    需求侧「我的」侧滑面板
    └── views/               11 个页面：Home / About / Services / Login /
                             List / Create / Detail / Admin / Messages /
                             Profile / Feedback
```

**要改首页**：HomeView.vue（hero、轮播、态势图、技术底座、工作室段全在里面，
轮播文案在文件顶部的 `slides` 数组，技术底座文案在 `capabilities` 数组）。

## 三、本地开发

```powershell
cd D:\mirror-dev3\restore-web
npm install        # 首次或依赖变更后
npm run dev        # 开发预览 http://localhost:5173/
npm run build      # 生产构建，产物在 dist/
```

注意：**不要在 Linux/WSL 里 npm install 后让 Windows 用同一份 node_modules**
（没有 .cmd 脚本会报 `'vite' 不是内部或外部命令`），Windows 上自己装一份。

## 四、推送方法（dev3）

remote 已内嵌 token，直接推：

```powershell
cd D:\mirror-dev3
git add restore-web/
git -c user.name="QvQ-Qiu" -c user.email="2215020897@qq.com" commit -m "改动说明"
git push origin dev3
```

要点：

- 提交身份沿用仓库历史作者 `QvQ-Qiu <2215020897@qq.com>`（沙箱 git 没配身份必须 `-c` 指定；Windows 本机如果配过自己的 git 身份可以不用）
- remote 地址是 `https://oauth2:<token>@gitee.com/yukai921/mirror.git`——**不要改**；如果 token 失效，Gitee 私人令牌的正确用法是 `oauth2:<token>` 或 `qvq-qiu:<token>`（token 属于账号 qvq-qiu，不是仓库 owner yukai921；token 单独当用户名会失败）
- **不要 push main 和 dev**
- 该 token 已多次明文出现在聊天里，建议在 Gitee 设置里轮换

## 五、改动历史（定制 → 回退全记录）

| 提交 | 做了什么 | 现状 |
|---|---|---|
| `9b2f3bd` | restore-web 初始工程（33 文件） | 保留 |
| `a8d3a34` | 加 deploy.sh | 保留 |
| `1cc1417` | 门户页面按线上产物逐块对齐（粒子场/轨道 SVG/轮播样式全部对齐，实测 0 差异） | **当前基线** |
| `ac98069` | hero 迁入四个导航 tab（3D 视差发光）+ 顶部导航只留 Logo + 登录移左下角 + 星星调亮 | 已撤销 |
| `8cd48e1` | hero 背景改星云底图+3000 星点+板块高亮；轮播拆成 EcoCarousel.vue | 已撤销 |
| `4939654` | #eco 改全屏 sticky 3D 星团场景（three.js，EcoStage.vue）；**路由修复：hash→web history + scrollBehavior** | 3D 已撤销；**路由修复保留** |
| `178de41` | 3D 星空改白色银河风（按参考视频 BARE 设计） | 已撤销 |
| `0bc9f4c` | 白色银河回退到紫色星团 3D | 已撤销 |
| `79c02c9` | 3D 场景回退到横向轮播卡片 | 已撤销 |
| `d31874d` | **整体回退到线上原版对齐状态（= 1cc1417）** | 当前 |

保留的唯一定制痕迹：路由 web history + scrollBehavior（线上原版本来就是 history 模式，
之前误写成 hash 导致 #eco 锚点跳不动，这是修 bug 不是定制）。

## 六、已验证 / 未验证

**已验证（与线上原版逐块对比，差异为 0）**：首页 hero、轮播、态势图、导航、页脚；
设计变量 9 项全一致；构建通过。

**未验证**：关于页、技术服务页、登录页、需求侧各页——DOM 是手写近似版，
没有按原版逐块对齐过（当时离线对比工具对这几页失效）。

## 七、已知坑

1. **Pod 部署**：平台「私有库 token」字段会把 token 当用户名（Gitee 拒绝）；
   把 `oauth2:token` 写进仓库地址又会被平台误判冒号成端口号。绕法是临时把仓库
   设为公开。deploy.sh 已备好（子目录填 `restore-web`）。
2. **登录契约（以后接后端时用）**：`/mirror-api/*` 走仓库 server.py（X-Mirror-Session）；
   集市接口 `https://ssemarket.cn/api/auth/*` 走 Bearer token，登录密码必须先 AES 加密
   （key 字面量 `"16bit secret key"`，IV 是 SHA256(key) 前 16 字符）。
3. **未登录可见的内容全是静态的**：首页/关于/服务零网络请求，连「注册用户 1000+」
   都是写死在代码里的宣传数字，不需要后端。
4. **验证方法可复用**：把产物 esbuild 打单文件 + 内联图片，与线上归档产物各起一个
   静态服务，用 playwright 逐块截图 + 计算样式对比（工具在会话 outputs/_verify/，
   沙箱 chromium 缺 libXdamage.so.1，从 ubuntu 源下 deb 解包后 LD_LIBRARY_PATH 指过去）。
