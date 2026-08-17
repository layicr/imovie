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

## 目录结构

```
test/
├── vitest.config.ts          # Vitest 配置（实际位于项目根目录）
├── fixtures/
│   └── db.ts                 # 测试数据库 helper（内存库 + schema + 造数据）
├── unit/                     # 纯函数单元测试（Vitest）
│   ├── validate.test.ts      # zod 参数校验
│   ├── poster.test.ts        # 海报 URL 构造
│   └── config.test.ts        # 站点配置常量
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

> 合计 **93 例**：单元 36 + 功能 33（含安全 6）+ UI e2e 24。

### 单元测试（36 例）

| 文件 | 用例数 | 覆盖点 |
|------|--------|--------|
| `unit/validate.test.ts` (18) | `listQuerySchema`：合法/非法枚举（`status`/`media_type`/`sort`/`order`）、`page` 缺省 1、`limit` 缺省 `PAGE_SIZE_DEFAULT`、字符串 coerce（`"12"` 成功 / `"abc"` 失败）、`limit` 超 `PAGE_SIZE_MAX` 报错、`year` 可 coerce、`genre`/`q` 非空串、未知字段被 strip |
| `unit/poster.test.ts` (4) | `posterUrl`：TMDb 相对路径 → 拼 `image.tmdb.org`、完整 http(s) 原样返回、空值回退 picsum（含 `picsum.photos` 域名与 seed） |
| `unit/config.test.ts` (5+9...) | `PAGE_SIZE_DEFAULT=60` 且包含在 `PAGE_SIZE_OPTIONS`、`PAGE_SIZE_MAX` 为末项且 ≥ 默认、`COUNTRY_OPTIONS` 含新增 `LB`(黎巴嫩)/`MT`(马耳他) 及 `zh/en` 文案、每项 `value`/`zh`/`en` 唯一、`GENRE_OPTIONS`/`LANGUAGE_OPTIONS` 非空且三字段齐全 |

> 注：单元总用例数随断言细化略有浮动，运行 `npm test` 以控制台为准。

### 功能测试（33 例）

**`functional/queries.test.ts` 基于内存库（19 例）**

| 分组 | 覆盖点 |
|------|--------|
| 列表筛选 | 默认返回（按 `release_date` 降序）、`status=watched` / `media_type=movie` / `genre` 模糊 / `year` / `q` 标题模糊 |
| 排序 | `sort=rating&order=desc`、`NULLS LAST`（无评分项沉底） |
| 分页 | `page=2&limit=2` 偏移正确、`total` 为全量计数（不受 limit 影响） |
| 维度 | `listFacets`：年份去重排序、类型去重、国家拆分去重、题材拆分去重 |
| 详情 | `getRecord` 按 `item_id` 联表拼接 / 不存在返回 `null` |
| 年报 | `getReport` 总览计数与评分均值、`getYearReport` 按月分组小计 / 仅统计指定年份 |

**`functional/routes.test.ts` 直接调用 Route Handler（10 例）**

| 路由 | 覆盖点 |
|------|--------|
| `/api/records` (GET) | 正常返回 200 与分页结构（`total`/`items`）、参数校验失败 → 422（`limit` 越界 / 非法 `sort`）、内部错误 → 500（`getDb` 注入抛错）、`facets` 维度字段存在 |
| `/api/stats` (GET) | 正常返回 200 与年报结构（overview + years）、内部错误 → 500 |

> 路由测试通过 `vi.mock("@/lib/db", () => ({ getDb: () => Promise.resolve(testDb) }))` 闭包注入内存库，在 `beforeAll` 中赋值模块级变量，避免 `vi.fn()` + `mockResolvedValue` 返回 `undefined` 的陷阱。

**`functional/security.test.ts` 中间件（6 例）**

| 分组 | 覆盖点 |
|------|--------|
| 全局限流 | 同一 IP 超阈值返回 429（前两次放行 + 持续 429 + 带 `Retry-After`）；不同 IP 互不影响 |
| 认证失败防爆破 | 连续错误密码超阈值返回 429；正确密码放行并清空失败计数（之后错误密码仍放行） |
| 公开模式 | 未设 `SITE_PASSWORD` 直接放行（200） |
| 错误脱敏 | 401 响应体不含 `.ts` / 堆栈 / `stack` 字样，且含 `Authentication required` |

> 每个用例用 `vi.resetModules()` 重载 middleware，确保从干净计数 Map 与正确 env 阈值开始；断言不依赖具体阈值数字，只验证「前若干次放行，之后持续 429」。

### UI 端到端测试（24 例）

`test/e2e/ui.spec.ts`，两个 project 各执行一遍（`web-desktop` 1280×800 + `mobile` 390×844 触摸），共 **24 例**：

| 维度 | 覆盖点 |
|------|--------|
| 加载态 | 首页骨架屏（`aria-busy`）被真实内容替换、标题可见 |
| 暗色主题 | 页面背景深色（`bg-ink` = `rgb(20,20,20)`） |
| 海报墙 | 卡片渲染且含可点击详情链接与图片 |
| Web 端 | 列表行（想看/已看）渲染、卡片进详情页、详情页标题/海报/元数据、搜索页输入框、不存在 `item_id` 显示未找到 |
| 移动端 | 窄屏卡片首屏可见、点击进详情页、详情海报图缩放显示（≤230px） |

> 导航统一 `waitUntil:"domcontentloaded"`；海报图用整页首个 `<img>` 断言（规避 `next/image` 视口外 lazy 延迟挂载）。UI e2e 依赖真实 `data/local.db` 与可连通外链图（图加载失败不影响 DOM 断言）。

## 维护约定

- 新增业务逻辑（查询/校验/配置/路由/中间件）时，按「纯函数单测 → 内存库功能测 → 路由/中间件测 → 必要时 UI e2e」分层补充对应用例。
- 造数据需保持确定性：影片 `item_id` 唯一，且遵守 `imovie_records` 的 `UNIQUE(user_id, item_id)` 约束（同一影片只一条记录）。
- 中间件类测试涉及模块级状态，务必在用例间用 `vi.resetModules()` 清理；`listFacets` 缓存用 `invalidateFacets()` 重置。
- 不要将临时调试文件（如 `_debug*.ts`）留在 `test/` 内。
