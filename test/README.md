# iMOVIE 测试说明（test/）

本目录为 iMOVIE 项目（Next.js 14 + libSQL + TMDb）的自动化测试套件，分两层：

- **Vitest**（单元 + 功能测试）：完全离线、确定性、秒级，覆盖纯函数、数据库查询逻辑、API 路由与中间件安全。
- **Playwright**（UI 端到端测试）：拉起 `next dev`，验证 Web 桌面端 / 移动端的真实界面行为与响应式。

## 运行方式

```bash
# 单元 + 功能测试（Vitest，离线）
npm test            # 运行全部（vitest run）
npm run test:watch  # 监听模式

# UI 端到端测试（Playwright，需联网拉起 dev server）
npx playwright test                # 跑全部项目（web-desktop + mobile）
npx playwright test --project=mobile   # 仅移动端
```

依赖：`vitest`、`@playwright/test`（均为 devDependency，已加入 `package.json`）。
Vitest 配置见根目录 `vitest.config.ts`（`node` 环境、复用 `@/` 路径别名、`test/**/*.test.ts`）。
Playwright 配置见根目录 `playwright.config.ts`（自动拉起 `next dev`、`workers:1`、`retries:1`）。

> 注：`test/` 与 `bak/` 已在 `.gitignore` 中忽略，测试仅在本地运行，不会随部署上传。

## 设计原则

1. **不连真实库**：功能测试基于 `:memory:` 内存库插入已知造数据，断言精确、确定、隔离，不依赖 `local.db`（2293 条且状态会变）。
2. **直接调用 Route Handler / Middleware**：API 路由用 `new NextRequest(url)` 直接 `await GET(req)`；中间件安全测试用 `await middleware(req)` 直接调用，均无需启动完整 server，轻量稳定。
3. **缓存隔离**：`lib/queries.ts` 的 `listFacets` 有模块级 5 分钟 TTL 缓存，每个用例前调用 `invalidateFacets()` 重置；中间件模块顶部读取 `process.env` 且计数 Map 跨用例共享，故安全测试用 `vi.resetModules()` 重新加载模块，确保干净状态。
4. **Schema 复用**：fixture 读取 `data/schema.sql` 按 `;` 拆分执行建表，与 `lib/db.ts` 的 `applySchema` 保持一致，不重复维护 DDL。
5. **UI 测试不依赖外链图加载**：导航用 `waitUntil:"domcontentloaded"`，海报断言用整页首个 `<img>`（`next/image` 对视口外 lazy 图延迟挂载）。
6. **生产/开发双模式校验**：`lib/api-error.ts` 在 `NODE_ENV=production` 下对 5xx 统一脱敏为 `internal_error`（不暴露原始信息），测试同时验证两种模式下的文案行为。

## 目录结构

```
test/
├── vitest.config.ts          # Vitest 配置（实际位于项目根目录）
├── fixtures/
│   └── db.ts                 # 测试数据库 helper（内存库 + schema + 造数据）
├── unit/                     # 纯函数单元测试（Vitest）
│   ├── validate.test.ts      # zod 参数校验（listQuerySchema + yearParamSchema）
│   ├── poster.test.ts        # 海报 URL 构造
│   ├── config.test.ts        # 站点配置常量
│   ├── db.test.ts            # 数据库连接单例与脱敏
│   ├── analytics.test.ts     # 统计脚本配置校验
│   └── api-error.test.ts     # 错误处理工具（apiError / apiErrorFromUnknown / resolveLang / translateError）
├── functional/               # 功能 / 集成测试（Vitest）
│   ├── queries.test.ts       # 数据库查询逻辑（内存库）
│   ├── routes.test.ts        # API 路由（NextRequest 调用）
│   └── security.test.ts      # 中间件限流 + Basic 认证 + 错误脱敏
└── e2e/
    └── ui.spec.ts            # UI 端到端（Playwright：web-desktop / mobile）
```

## fixtures/db.ts

提供 `setupTestDb(items, records)` ：
- 创建独立 `:memory:` client；
- 执行 `data/schema.sql` 建表；
- 批量插入 `imovie_items` 与 `imovie_records` 造数据；
- 调用 `invalidateFacets()` 重置维度缓存。

每次调用都是全新实例，天然隔离。

## 测试用例清单

> 合计 **199 例**：单元 66 + 功能 75（含安全 21）+ UI e2e 58（web 29 + mobile 29）。
> 最近一次全量运行（2026-08-26）：`Vitest 9 files / 141 passed`，`Playwright 58 passed`（0 flaky）。

### 单元测试（66 例）

| 文件 | 用例数 | 覆盖点 |
|------|--------|--------|
| `unit/validate.test.ts` (24) | `listQuerySchema`：无输入时字段全为 undefined、`limit`/`page` 字符串 coerce（`"12"` 成功 / `"abc"` 失败）、`limit` 越界（`>PAGE_SIZE_MAX` 或 `<1`）抛错、`page<1` 抛错、非法枚举 `status`/`media_type`/`order` 抛错、`sort` 仅 `release_date`/`douban_rating`/`tmdb_rating`、`q`/`genre`/`country`/`year`/`media_type` 透传、`q` 超长(>100) 抛错、空串 `q` 保持空串（非 undefined）；`yearParamSchema`：4 位正则（`/^\d{4}$/`）、前导零 coerce 后被范围拒绝、3 位/5 位/含非数字/空串全部失败、`1900`/`9999` 边界、`<1900`/`>9999` 失败 |
| `unit/poster.test.ts` (8) | `posterUrl`：TMDb 相对路径 → 拼 `image.tmdb.org`、空/null/undefined 回退 picsum（按 `:seed`）、自定义 seed 生效、绝对 http(s) 原样返回、`//` 形式按相对路径拼接；`backdropUrl`：TMDb 相对路径 → w780 横图、空值回退 1280×720 横版占位、绝对链接原样返回 |
| `unit/config.test.ts` (5) | `PAGE_SIZE_DEFAULT=60` 且包含在 `PAGE_SIZE_OPTIONS`、`PAGE_SIZE_MAX` 为末项且 ≥ 默认、`COUNTRY_OPTIONS` 含新增 `LB`(黎巴嫩)/`MT`(马耳他) 及 `zh/en` 文案、每项 `value`/`zh`/`en` 唯一、`GENRE_OPTIONS`/`LANGUAGE_OPTIONS` 非空且三字段齐全 |
| `unit/db.test.ts` (3) | `getDb`：同一进程内返回同一连接（单例，仅 connect 一次）、首次连接失败后可重试（`ready` 重置，下次重新 connect）、错误信息对连接 URL 脱敏（不泄露 token / 绝对路径） |
| `unit/analytics.test.ts` (3) | 统计配置：GA 衡量 ID 形如 `G-XXXXXXXXXX`、百度统计 ID 非空且十六进制串、51.la 的 `id`/`ck` 非空且无空格 |
| `unit/api-error.test.ts` (23) | `apiError`：开发/生产双模式文案、`NODE_ENV=production` 下 5xx 统一脱敏为 `internal_error`、4xx 仍回显错误 key 翻译、`isErrorKey` 判定、`translateError` 中/英回退、`resolveLang` 字符串/未定义/大小写归一化、`apiErrorFromUnknown` 未知错误走 fallback key、`extractKeyFromError` 幂等、`withError` 包装正常返回原值、安全头部 `X-Content-Type-Options: nosniff` + `Cache-Control: no-store` |

> 注：单元总用例数随断言细化略有浮动，运行 `npm test` 以控制台为准。

### 功能测试（75 例）

**`functional/queries.test.ts` 基于内存库（33 例）**

| 分组 | 覆盖点 |
|------|--------|
| 列表筛选 | 默认返回全部 8 条（按 `release_date` 降序）、`status=watched`(5)/`status=plan`(3)、`media_type=tv`(3)、`year=2023`(3，含 tt8)、`genre` 模糊（`/` 分隔命中)、`country` 模糊（`美国/日本` 拆分命中)、`q` 全文搜索片名、组合筛选 |
| 排序 | 默认 `release_date` 降序、升序、`douban_rating` 降序（NULLS 沉底）、`tmdb_rating` 升序（NULLS LAST）、**排序 NULLS LAST 二级键**：`douban_rating` 降序时 NULL 值落末尾、`release_date` 升序时 NULL 排末尾 |
| 分页 | `limit=2` 返回前 2、`limit=2&page=2` 偏移不重复、`limit=0` 不限制返回全部、`page<1` 视为 1 |
| 维度 | `listFacets`：genres 按 `/`、`,`、`、` 拆分去重排序、countries 拆分去重（含多值 `美国/日本`）、years 去重降序、`invalidateFacets` 后结果一致 |
| 详情 | `getRecord` 按 `item_id` 联表拼接 / 不存在返回 `null` |
| 年报 | `getReport` 总览计数与评分均值（(9+8+7+10+6)/5=8.0）、years 按 `watched_at` 分组降序且各年 count 正确（tt8 的 `watched_at` 为 NULL 不计入任何年份）、年份聚合 avg（2023 年 7.5） |
| 年份下钻 | `getYearReport` 按年份取全年 watched、按月分桶（monthKey `YYYY-MM` 降序）、无记录 `total=0`、仅统计 watched（plan 不计入）、**`watched_at` 为 NULL 的 watched 记录被 `IS NOT NULL` 守卫排除** |

**`functional/routes.test.ts` 直接调用 Route Handler（21 例）**

| 路由 | 覆盖点 |
|------|--------|
| `/api/records` (GET) | 正常返回 `{ total, records, page, pageSize, genres, years, countries }` 结构、`status=plan` 筛选生效、非法参数 → 422（错误文案 `参数校验失败`）、非法枚举 `status` → 422、**数据库异常 → 500（生产环境脱敏为 `服务器内部错误`）** |
| `/api/stats` (GET) | 正常返回 200 与年报结构（overview + years）、带 `Cache-Control: s-maxage=60` 边缘缓存头、**数据库异常 → 500（脱敏 `服务器内部错误`）** |
| `/api/records/[item_id]` (GET) | 命中返回 `{ item, record }`、未命中 → 404、缺 `item_id` → 400 |
| `/api/stats/[year]` (GET) | 合法年份返回按月分组数据（`total`/`months`）、非法年份 `abcd` → 400、4 位正则边界（`202`/`20261`/`20.5`/` 2024`/`+2024`/`2026abc` 全 → 400）、合法 `2024` 通过正则返回 200、`Accept-Language: zh-CN` → 错误文案 `无效年份`、`Accept-Language: en-US` → `Invalid year` |

> 路由测试通过 `vi.mock("@/lib/db", () => ({ getDb: () => Promise.resolve(testDb) }))` 闭包注入内存库，在 `beforeAll` 中赋值模块级变量，避免 `vi.fn()` + `mockResolvedValue` 返回 `undefined` 的陷阱。
> 错误文案统一来自 `lib/i18n/errors.ts`，由 `Accept-Language` 决定中英文（`apiError` 工具在开发环境回显原始 key/信息、生产环境隐藏 5xx 内部细节）。

**`functional/security.test.ts` 中间件（21 例）**

| 分组 | 覆盖点 |
|------|--------|
| 全局限流 | 同一 IP 超阈值返回 429（前两次放行 + 持续 429 + 带 `Retry-After`）；不同 IP 互不影响 |
| 认证失败防爆破 | 连续错误密码超阈值返回 429；正确密码放行并清空失败计数（之后错误密码仍放行） |
| 公开模式 | 未设 `SITE_PASSWORD` 直接放行（200） |
| 错误脱敏 | 401 响应体不含 `.ts` / 堆栈 / `stack` 字样，且含 `Authentication required` |
| 限流响应头部 | 429 的 `Retry-After` 为正整数且不超过窗口（≤60s） |
| 组合维度 | 认证成功后全局限流仍继续生效（限流与认证失败为独立计数） |
| 路径放行 | 静态资源（`/_next/static`）、favicon、`robots.txt` 跳过认证 |

> 每个用例用 `vi.resetModules()` 重载 middleware，确保从干净计数 Map 与正确 env 阈值开始；断言不依赖具体阈值数字，只验证「前若干次放行，之后持续 429」。
> 限流 Map 已加 `MAX_BUCKETS=2000` 上限与近似 LRU 淘汰，防止异常 IP 风暴撑爆内存。

### UI 端到端测试（58 例）

`test/e2e/ui.spec.ts`，两个 project 各执行一遍（`web-desktop` 1280×800 + `mobile` 390×844 触摸），共 **58 例**（web 29 + mobile 29）：

| 维度 | 覆盖点 |
|------|--------|
| 加载态 | 首页骨架屏（`aria-busy`）被真实内容替换、标题可见 |
| 暗色主题 | 页面背景深色（`bg-ink` = `rgb(20,20,20)`） |
| 海报墙 | 卡片渲染且含可点击详情链接与图片 |
| Web 端 | 列表行（想看/已看）渲染、卡片进详情页、详情页标题/海报/元数据、搜索页输入框、不存在 `item_id` 显示未找到、报表页 `/report` 加载与年份下钻卡片、搜索输入关键词后结果随之变化 |
| 移动端（iPhone 视口，含 `beforeEach` 强制 390×844） | 汉堡按钮可见且点击展开导航菜单、导航菜单内链接可点击跳转、点击导航链接后菜单自动收起、Hero 区域高度适配小屏（`min-h-[320px]`）、Hero 侧边海报在窄屏隐藏（`hidden sm:block`）、MovieRow 海报墙支持横向滚动、汉堡按钮触控目标 ≥44×44px、导航链接触控目标 ≥44px 高度、`viewport-fit=cover` 已设置、header 使用 `safe-area-inset-top` 适配刘海、`FloatingActions` 使用 `safe-area-inset-bottom` 适配 Home 指示条、搜索框输入后 600ms 自动跳转、详情页元数据列表纵向排列 |

> 导航统一 `waitUntil:"domcontentloaded"`；海报图用整页首个 `<img>` 断言（规避 `next/image` 视口外 lazy 延迟挂载）；移动端 describe 块用 `beforeEach` 强制设置 390×844 视口，确保 `md:hidden` 等响应式类在任意 project 下均生效。UI e2e 依赖真实 `data/local.db` 与可连通外链图（图加载失败不影响 DOM 断言）。

## 维护约定

- 新增业务逻辑（查询/校验/配置/路由/中间件）时，按「纯函数单测 → 内存库功能测 → 路由/中间件测 → 必要时 UI e2e」分层补充对应用例。
- 造数据需保持确定性：影片 `item_id` 唯一，且遵守 `imovie_records` 的 `UNIQUE(user_id, item_id)` 约束（同一影片只一条记录）。
- 中间件类测试涉及模块级状态，务必在用例间用 `vi.resetModules()` 清理；`listFacets` 缓存用 `invalidateFacets()` 重置。
- 错误脱敏相关变更需同步验证 `NODE_ENV=production` 与开发模式下的返回文案差异。
- 不要将临时调试文件（如 `_debug*.ts`）留在 `test/` 内。
