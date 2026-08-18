# iMOVIE · 只为记录我与电影的全部时光（开发文档）

English version: [README_DEV.en.md](./README_DEV.en.md)

iMOVIE 是一个自托管的**只读**个人观影记录展示网站，让你以 Netflix 般的流媒体界面，优雅地浏览与回望自己的「想看 / 已看」电影与剧集；无论是手机还是桌面，都能获得舒适的沉浸式体验。

- 数据来自数据库（Turso / libSQL，`@libsql/client`），本地 `file:./data/local.db` 起步，**无需任何外部账号或密钥即可展示**（无 TMDb / 豆瓣在线依赖）。
- **应用层完全只读**：所有页面与 API 仅做查询展示，没有任何新增、修改、删除入口；数据通过一次性种子脚本灌入。
- 核心状态：`想看 (plan)` 与 `已看 (watched)`，无「在看」。
- 评分（1–10）与标签**只在「已看」状态出现**；同一用户同一影片只保留一条记录。

---

## 一、技术栈与架构

| 维度 | 选型 | 说明 |
|------|------|------|
| 框架 | Next.js 14（App Router） | 页面 + Route Handler 同仓，SSR/CSR 混合 |
| 语言 | TypeScript（strict） | 全量类型，前端组件与后端查询共享 `lib/types.ts` |
| 数据库 | libSQL（`@libsql/client`） | 本地 `file:` 或 Turso 远程 `libsql://`，业务代码无感切换 |
| 校验 | Zod | 所有外部输入先经 schema 校验再进 SQL |
| 样式 | Tailwind CSS | 暗色优先（`bg-ink` 等定制色），响应式断点 |
| 图片 | `next/image`（`unoptimized`） | 浏览器端直连 TMDb/CDN，规避国内代理失败 |
| 测试 | Vitest（单元/功能）+ Playwright（UI e2e） | 见「八、测试体系」 |
| 部署 | Vercel / 任意 Node 平台 | 见「九、部署与运维」 |

### 分层架构

```
浏览器 / 客户端
   │  HTTP（可选 Basic Auth）
   ▼
middleware.ts       限流（固定窗口 + 近似 LRU 淘汰）+ HTTP Basic 认证 + 错误脱敏
   │
   ▼
app/               页面（Server Component 直查库）+ api/*（Route Handler）
   │
   ▼
lib/queries.ts     纯只读 SELECT（参数化，零注入）
lib/validate.ts    Zod 入参校验（枚举 / 范围 / 长度）
lib/db.ts          单例连接 + 幂等建表（schema.sql）+ 连接串脱敏
lib/config.ts      结构性常量（导航 / 筛选选项 / 分页）
lib/poster.ts      海报 URL 构造（TMDb 相对路径 → 绝对；空值回退 picsum）
lib/api-error.ts   API 统一错误响应（开发回显 / 生产隐藏 5xx；支持中英文）
lib/i18n/          errors.ts（zh/en 错误文案字典）+ LanguageProvider（界面语言）
   │
   ▼
libSQL / Turso      imovie_items + imovie_records（无物理外键，应用层语义关联）
```

---

## 二、快速开始（本地，无需任何密钥）

```bash
npm install          # 安装依赖
npm run db:seed      # 建表并写入示例影片（一次性灌库脚本）
npm run dev          # 启动开发服务器，默认 http://localhost:3000
```

`npm run db:seed` 会按 `data/schema.sql` 自动建表（幂等），并插入一批示例影片（海报留空，前端自动回退占位图）。不配置任何 Key 也能跑通整套浏览体验。

---

## 三、配置（可选）

### 环境变量（`.env.local`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `file:./data/local.db` | 本地文件或 `libsql://<实例>.turso.io` |
| `TURSO_AUTH_TOKEN` | 空 | 远程实例鉴权令牌（本地留空） |
| `INCLUDE_LOCAL_DB` | `true` | `false` 时跳过本地 `data/` 打包（用 Turso 时设） |
| `SITE_PASSWORD` | 空 | 设置后全站需 HTTP Basic 认证 |
| `RATE_LIMIT` | `120` | 每 IP 每 60s 全局请求上限（超 429） |
| `AUTH_FAIL_LIMIT` | `20` | 每 IP 每 60s 认证失败上限（超 429，仅设密码时生效） |

> `.env.example` 为模板（无真实值），随仓库提交；`.env.local` 含真实密钥，**必须加进 `.gitignore`**，切勿提交。

### 站点密码（SITE_PASSWORD）

设置后全站需通过 HTTP Basic 认证，保护私人观影数据；留空则所有请求直接放行（本地/公网友好，无密码保护）。

- 用户名任意，仅校验密码；密码比较采用恒定时间比较，防时序侧信道。
- 在 `.env.local` 的环境变量中配置 `SITE_PASSWORD=你的站点密码` 即可生效。

---

## 四、功能一览

| 页面     | 路径             | 说明                                        |
| -------- | ---------------- | ------------------------------------------- |
| 看板首页 | `/`              | Featured 大图 + 想看 / 已看两行横向内容       |
| 详情     | `/detail/[id]`   | 严格元数据排版（导演/演员/评分/别名等）       |
| 搜索     | `/search`        | 全局关键词 + 年份/类型/国家多维筛选 + 热门标签 |
| 各年报表 | `/report`        | 总览三卡 + 按年海报墙 + 年份小计 + 按月下钻明细 |

> 本仓库为**展示站**：无「添加影片」「豆瓣导入」「状态切换」「评分/标签编辑」等写入功能，所有数据由 `npm run db:seed` 一次性灌入。

报表下钻「观影明细」按**月份降序**（最新月份在前），影片在月份内按观看时间降序排列；年月文案随界面语言切换（中文 `2026年1月` / 英文 `Jan, 2026`）。

---

## 五、数据模型

两张表（`data/schema.sql` 定义），**无物理外键，仅应用层语义关联**：

### `imovie_items`（影片元数据，TEXT 主键）

- `item_id`：`TEXT PRIMARY KEY`，当前策略**直接等于 douban_id**（如 `1292052`），稳定且天然带外链语义。
- 持久化 `tmdb_id` / `imdb_id` / `douban_id` 用于外链拼接。
- 多值字段以 `/` 分隔存储：`genres`（兼容逗号、顿号）、`country`（ISO 3166-1 alpha-2 两位大写，如 `CN`/`US`）、`language`（ISO 639-1 两位小写，如 `zh`/`en`）、`director`/`writer`/`cast`。
- `release_date` 可能为带地区后缀的 ISO 串（如 `2023-08-30(中国大陆)`），排序时取前 10 位标准日期。

### `imovie_records`（观影记录）

- `id` 自增主键；`item_id` 应用层引用 `imovie_items` 主键。
- `UNIQUE(user_id, item_id)`：同一用户同一影片不可重复。
- `status` 仅 `plan` / `watched`；`rating`（1–10）与 `tags` 仅 `watched` 时非空；`watched_at` 为 `YYYY-MM-DD`。

### 通用返回结构（`lib/types.ts`）

`RecordRow` = 记录字段（`rec_id` / `status` / `rating` / `tags` / `watched_at` / `created_at`）+ 嵌套 `item: Item`。列表、详情、搜索、年份下钻均复用该结构与 `mapRow` 映射。

---

## 六、API 设计

| 路由 | 方法 | 入参（Zod 校验） | 返回 | 说明 |
|------|------|------------------|------|------|
| `/api/records` | GET | `status`/`media_type`/`year`/`genre`/`country`/`q`/`sort`/`order`/`page`/`limit` | `{ records, total, page, pageSize, genres, years, countries }` | 列表/筛选/搜索统一入口；`dynamic = "force-dynamic"` |
| `/api/stats` | GET | 无 | `{ overview, years }` | 年报总览 + 按年分组；`Cache-Control: s-maxage=60` |
| `/api/stats/[year]` | GET | 路径参数（4 位纯数字 + 范围 1900–9999） | `{ total, months }` | 年报下钻：按月份分组；`Cache-Control: s-maxage=60` |
| `/api/records/[item_id]` | GET | 路径参数 | `RecordRow \| null` | 详情联表 |

**校验与错误码**：参数不符 Zod 枚举/范围/长度 → `422`；`/api/stats/[year]` 年份非 4 位纯数字或越界 → `400`；内部 DB 异常 → `500`。`limit` 上限由 `config.PAGE_SIZE_MAX`（= `PAGE_SIZE_OPTIONS` 末项，当前 120）约束，`sort` 仅允许白名单三值。

**错误响应国际化**：所有 API 错误统一经 `lib/api-error.ts` 的 `apiError` / `apiErrorFromUnknown` 返回；错误文案由请求头 `Accept-Language` 决定中文（`zh`）或英文（`en`），文案来自 `lib/i18n/errors.ts`。开发环境回显原始信息便于调试，生产环境自动隐藏 5xx 内部细节（统一返回「服务器内部错误」/「Internal server error」）。

**查询层安全**：`lib/queries.ts` 全部 `SELECT` 使用 `?` 参数化占位符，动态排序字段走枚举白名单，**零 SQL 注入**；`genres`/`country` 多值以应用层 `split(/[/,、]/)` 拆分去重，避免 SQL `json_each` 对特殊字符报错。

---

## 七、数据访问与安全

- **连接与建表**：`lib/db.ts` 单例连接；首次连接按 `schema.sql` 幂等建表，建表结果用模块级 `schemaReady` Promise 缓存，整个进程只执行一次，且失败可自动重试。连接异常时错误信息经 `maskDbUrl()` 脱敏（远程 `?authToken=***`、本地仅保留文件名），避免泄露令牌或绝对路径。
- **查询层**：`lib/queries.ts` 仅含 `SELECT` 函数（列表/筛选/搜索、侧栏维度、详情、年报总览、年报分组），全部使用参数化占位符，动态排序走白名单枚举，**零 SQL 注入**。
- **维度缓存**：`listFacets` 有模块级 5 分钟 TTL 缓存（`facetsCache`），避免每次列表请求重复扫描；写入后调用 `invalidateFacets()` 可立即刷新。
- **写库隔离**：写入逻辑 `ensureItem` / `upsertRecord` 仅定义在 `scripts/seed.ts` 内，不导入到应用层，保证线上运行态不可写。
- **站点保护**：可选 Basic Auth（`middleware.ts`）+ 生产 CSP / 安全响应头（`next.config.mjs`）：`X-Content-Type-Options` / `X-Frame-Options: DENY` / `Referrer-Policy` / `Permissions-Policy` / `Content-Security-Policy`（已含 `img-src` 白名单与 `script-src` 内联，dev 需 `'unsafe-eval'`）。
- **限流中间件**（`middleware.ts`）：Edge Runtime 下用模块级 `Map` 做固定窗口计数，并已加容量防护：
  - 全局：`RATE_LIMIT` 次 / IP / 60s，超出 `429`（带 `Retry-After`）。
  - 认证防爆破：`AUTH_FAIL_LIMIT` 次 / IP / 60s，超出 `429`；认证成功清空该 IP 失败计数。
  - 每次请求顺带执行 `sweep()`：清理过期桶，并在桶数超过 `MAX_BUCKETS=2000` 时按最早到期（`resetAt`）近似 LRU 淘汰，防止异常 IP 风暴撑爆内存。
  - 错误响应体不含 `.ts` / 堆栈 / `stack` 字样（脱敏）；错误文案统一经 `apiError` 输出（见第六节）。
  - 局限：Serverless 多实例各自计数、不共享，全局一致需换边缘 KV（如 Upstash）。

---

## 八、测试体系

`test/` 目录为独立自动化测试套件，**不改动应用源码**，合计 **102 例**：

| 维度 | 框架 | 文件 | 用例 | 说明 |
|------|------|------|------|------|
| 单元 | Vitest | `test/unit/*.test.ts` | 23 | 纯函数：Zod 校验、海报 URL、配置常量 |
| 功能 | Vitest | `test/functional/*.test.ts` | 55 | 内存 `:memory:` 库查询、API 路由、中间件安全（含安全 6 例） |
| UI e2e | Playwright | `test/e2e/ui.spec.ts` | 24 | Web 桌面端 + 移动端真实界面 |

> 最近一次全量运行（2026-08-18）：Vitest `Test Files 6 passed (6)`、`Tests 78 passed (78)`，耗时 1.63s（单元 + 功能）；UI e2e 24 例另计（需联网拉起 `next dev`）。

### 设计要点
1. **不连真实库**：功能测试基于 `:memory:` fixture（`test/fixtures/db.ts` 读 `data/schema.sql` 建表 + 造数据），断言精确、确定、隔离。
2. **直接调用 Handler**：API 路由用 `new NextRequest(url)` 直接 `await GET(req)`；中间件用 `await middleware(req)`，均无需启动 server。
3. **状态隔离**：`listFacets` 缓存用 `invalidateFacets()` 重置；中间件模块用 `vi.resetModules()` 重载，清空计数 Map。
4. **离线 + 快速**：Vitest 无 IO 依赖，`npm test` 秒级完成；Playwright 拉起 `next dev`，不依赖外链图加载断言（导航用 `domcontentloaded`）。

### 运行
```bash
npm test                 # Vitest（单元 + 功能，离线）
npx playwright test      # UI e2e（需联网，自动拉起 dev server）
```

> 详见 [test/README.md](./../test/README.md) 与 [test/REPORT-2026-08-18.md](./../test/REPORT-2026-08-18.md)。

---

## 九、部署与运维

### Vercel 部署
1. **环境变量**（平台配置，不要写进 git）：`DATABASE_URL`(Turso)、`TURSO_AUTH_TOKEN`、`SITE_PASSWORD`、`RATE_LIMIT`、`AUTH_FAIL_LIMIT`、`INCLUDE_LOCAL_DB=false`。
2. **本地文件模式局限**：Serverless 只读文件系统 + 多实例，本地 `file:` 库会读到打包快照、运行期写入失败、实例间不共享。**生产必须用 Turso 远程库**。
3. **测试不进生产**：Vitest/Playwright 为 devDependency，不被打进运行时 bundle；CI 只跑 `npm test`（离线），**不要**让部署流程跑 `playwright test`（需浏览器二进制 + 外链联网，CI 必失败）。
4. **`.gitignore` 必须忽略**：`.env*.local`、`*.db*`、`data/*.db`、测试报告（`test/.playwright-report.json`、`test-results/`），避免密钥与私人数据入库。

---

## 十、常用脚本

```bash
npm run dev       # 开发
npm run build     # 生产构建（类型检查）
npm run start     # 运行生产构建
npm run lint      # 代码检查
npm run db:seed   # 建表并写入示例数据（一次性灌库）
npm test          # Vitest 单元 + 功能测试（离线）
```

## 十一、目录结构

```
app/           页面与 API 路由（App Router）
  api/         records（GET 列表 / detail/[item_id] 详情）、stats（GET 年报 / [year] 下钻）
components/     Nav / PosterCard / MovieRow / Analytics 等
lib/           db / queries（纯只读）/ config / poster / types / validate / api-error / i18n / analytics
data/          schema.sql（建表 DDL）+ local.db（运行时实际数据库，不入库）
scripts/       seed.ts（一次性灌库脚本，内含写库函数，不污染应用层）
test/          unit / functional / e2e / fixtures（自动化测试，见第八节）
middleware.ts  限流 + HTTP Basic Auth + 错误脱敏
```
