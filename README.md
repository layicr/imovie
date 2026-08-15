# iMOVIE · 只为记录我与电影的全部时光

English version: [README.en.md](./README.en.md)

一个自托管的**只读**个人观影记录展示网站，用于浏览与查阅自己的「想看 / 已看」电影与剧集。  
Netflix 流媒体风界面，响应式适配桌面与手机。

- 数据来自数据库（Turso / libSQL，`@libsql/client`），本地 `file:./data/local.db` 起步，**无需任何外部账号或密钥即可展示**（无 TMDb / 豆瓣在线依赖）。
- **应用层完全只读**：所有页面与 API 仅做查询展示，没有任何新增、修改、删除入口；数据通过一次性种子脚本灌入。
- 核心状态：`想看 (plan)` 与 `已看 (watched)`，无「在看」。
- 评分（1–10）与标签**只在「已看」状态出现**；同一用户同一影片只保留一条记录。

---

## 一、快速开始（本地，无需任何密钥）

```bash
npm install          # 安装依赖
npm run db:seed      # 建表并写入示例影片（一次性灌库脚本）
npm run dev          # 启动开发服务器，默认 http://localhost:3000
```

`npm run db:seed` 会按 `data/schema.sql` 自动建表（幂等），并插入一批示例影片（海报留空，前端自动回退占位图）。不配置任何 Key 也能跑通整套浏览体验。

## 二、配置（可选）

复制 `.env.example` 为 `.env.local` 并填入：

```
# 生产环境（Vercel）切到 Turso 远程库：
# DATABASE_URL=libsql://<实例>.turso.io
# TURSO_AUTH_TOKEN=你的Token
# 站点密码（可选）：设置后全站需 HTTP Basic 认证，保护私人观影数据；留空则本地放行
# SITE_PASSWORD=你的站点密码
```

> 真实环境变量只进 `.env.local`，`*.env*` 与本地数据库均已在 `.gitignore` 中，不会入库。

### 站点密码（SITE_PASSWORD）

- **设置后**：全站浏览页面需通过 HTTP Basic 认证，保护私人观影数据。
- **留空（默认）**：所有请求直接放行，本地/公网友好（无密码保护）。
- 用户名任意，仅校验密码；密码比较采用恒定时间比较，防时序侧信道。
- 在部署平台（Vercel 等）或 `.env.local` 的环境变量中配置即可生效。

## 三、功能一览

| 页面     | 路径             | 说明                                        |
| -------- | ---------------- | ------------------------------------------- |
| 看板首页 | `/`              | Featured 大图 + 想看 / 已看两行横向内容       |
| 详情     | `/detail/[id]`   | 严格元数据排版（导演/演员/评分/别名等）       |
| 搜索     | `/search`        | 全局关键词 + 年份/类型/国家多维筛选 + 热门标签 |
| 各年报表 | `/report`        | 总览三卡 + 按年海报墙 + 年份小计 + 按月下钻明细 |

> 本仓库为**展示站**：无「添加影片」「豆瓣导入」「状态切换」「评分/标签编辑」等写入功能，所有数据由 `npm run db:seed` 一次性灌入。

报表下钻「观影明细」按**月份降序**（最新月份在前），影片在月份内按观看时间降序排列；年月文案随界面语言切换（中文 `2026年1月` / 英文 `Jan, 2026`）。

## 四、常用脚本

```bash
npm run dev       # 开发
npm run build     # 生产构建（类型检查）
npm run start     # 运行生产构建
npm run lint      # 代码检查
npm run db:seed   # 建表并写入示例数据（一次性灌库）
```

## 五、目录结构

```
app/           页面与 API 路由（App Router）
  api/         records（GET 列表 / detail/[tmdb_id] 详情）、stats（GET 年报）
components/     Nav / PosterCard / MovieRow / Analytics 等
lib/           db / queries（纯只读）/ config / poster / types / validate / i18n / analytics
data/          schema.sql（数据库结构）
scripts/       seed.ts（一次性灌库脚本，内含写库函数，不污染应用层）
middleware.ts  可选 HTTP Basic Auth
```

## 六、数据访问与安全

- **连接与建表**：`lib/db.ts` 单例连接；首次连接按 `schema.sql` 幂等建表，建表结果用模块级 `schemaReady` Promise 缓存，整个进程只执行一次，且失败可自动重试。
- **查询层**：`lib/queries.ts` 仅含 `SELECT` 函数（列表/筛选/搜索、侧栏维度、详情、年报总览、年报分组），全部使用参数化占位符，动态排序走白名单枚举，**零 SQL 注入**。
- **写库隔离**：写入逻辑 `ensureItem` / `upsertRecord` 仅定义在 `scripts/seed.ts` 内，不导入到应用层，保证线上运行态不可写。
- **站点保护**：可选 Basic Auth（`middleware.ts`）+ 生产 CSP / 安全响应头（`next.config.mjs`）。

---