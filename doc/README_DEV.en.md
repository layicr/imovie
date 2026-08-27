# iMOVIE · Personal Movie Tracking Showcase

中文版：[README_DEV.md](./README_DEV.md)

iMOVIE is a self-hosted **read-only** personal movie & TV tracking showcase. With a Netflix-style streaming interface, it lets you elegantly browse and look back on your own "Plan to Watch / Watched" titles; whether on phone or desktop, you get a comfortable, immersive experience.

- Data comes from a database (Turso / libSQL, `@libsql/client`), starting with a local `file:./data/local.db`. **No external accounts or API keys are required to display your data** (no live TMDb / Douban dependency).
- **The application layer is fully read-only**: all pages and APIs only query and display; there are no create, update, or delete entry points. Data is loaded once via a seed script.
- Core states: `Plan to Watch (plan)` and `Watched (watched)` — no "Currently Watching" state.
- Ratings (1–10) and tags **only appear for "Watched" items**; each user keeps a single record per title.

---

## 1. Tech Stack & Architecture

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14 (App Router) | Pages + Route Handlers in one repo; SSR/CSR hybrid |
| Language | TypeScript (strict) | Full typing; frontend components and backend queries share `lib/types.ts` |
| Database | libSQL (`@libsql/client`) | Local `file:` or remote Turso `libsql://`; business code is unaware of the switch |
| Validation | Zod | All external input is validated by a schema before reaching SQL |
| Styling | Tailwind CSS | Dark-first (`bg-ink` custom color), responsive breakpoints |
| Images | `next/image` (`unoptimized`) | Browser fetches TMDb/CDN directly, avoiding domestic proxy failures |
| Testing | Vitest (unit/functional) + Playwright (UI e2e) | See "8. Test Suite" |
| Deploy | Vercel / any Node platform | See "9. Deployment & Ops" |

### Layered Architecture

```
Browser / Client
   │  HTTP (optional Basic Auth)
   ▼
middleware.ts       Rate limit (fixed window + approximate LRU eviction) + HTTP Basic Auth + error masking
   │
   ▼
app/               Pages (Server Components query the DB directly) + api/* (Route Handlers)
   │
   ▼
lib/queries.ts     Pure read-only SELECT (parameterized, zero injection)
lib/validate.ts    Zod input validation (enums / ranges / lengths)
lib/db.ts          Singleton connection + idempotent schema creation (schema.sql) + URL masking
lib/config.ts      Structural constants (nav / filter options / pagination)
lib/poster.ts      Poster URL builder (TMDb relative → absolute; empty falls back to picsum)
lib/api-error.ts   Unified API error responses (dev echo / prod hides 5xx; zh/en)
lib/i18n/          errors.ts (zh/en error dictionary) + LanguageProvider (UI language)
   │
   ▼
libSQL / Turso      imovie_items + imovie_records (no physical FK, app-layer semantic link)
```

---

## 2. Quick Start (Local, No Keys Required)

```bash
npm install          # Install dependencies
npm run db:seed      # Create tables and insert sample titles (one-time seed script)
npm run dev          # Start the dev server, default http://localhost:3000
```

`npm run db:seed` auto-creates tables idempotently per `data/schema.sql` and inserts a batch of sample titles (posters left blank; the frontend falls back to a placeholder image automatically). The full browsing experience works without configuring any keys.

---

## 3. Configuration (Optional)

### Environment Variables (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./data/local.db` | Local file or `libsql://<instance>.turso.io` |
| `TURSO_AUTH_TOKEN` | empty | Remote instance auth token (leave empty for local) |
| `SITE_PASSWORD` | empty | When set, the whole site requires HTTP Basic Auth |
| `RATE_LIMIT` | `120` | Global request cap per IP per 60s (429 on exceed) |
| `AUTH_FAIL_LIMIT` | `20` | Auth-failure cap per IP per 60s (429 on exceed; only when password is set) |

> Whether to bundle the local `data/local.db` into Serverless functions is decided automatically by `next.config.mjs` based on `DATABASE_URL` (no manual switch needed): `file:` or unset → bundle; `libsql://` remote → skip to avoid wasted size. The legacy `INCLUDE_LOCAL_DB` variable is deprecated.

> `.env.example` is a template (no real values) and is committed; `.env.local` holds real secrets and **must be added to `.gitignore`** — never commit it.

### Site Password (SITE_PASSWORD)

When set, the whole site requires HTTP Basic authentication to protect your private viewing data; when empty (default), all requests are allowed directly — friendly for local/public access with no password protection.

- The username is arbitrary; only the password is validated. Password comparison uses constant-time comparison to prevent timing side-channel attacks.
- Configure it by setting `SITE_PASSWORD=your-site-password` in your `.env.local` environment variables.

---

## 4. Feature Overview

| Page          | Path             | Description                                          |
| ------------- | ---------------- | ---------------------------------------------------- |
| Dashboard     | `/`              | Featured hero + horizontal "Plan" / "Watched" rows    |
| Detail        | `/detail/[id]`   | Strict metadata layout (director/cast/rating/aliases)|
| Search        | `/search`        | Global keyword + year/genre/country filters + hot tags|
| Yearly Report | `/report`        | Three overview cards + per-year poster wall + subtotals + month drill-down|

> This repository is a **showcase site**: it has no write features such as "add title", "Douban import", "status toggle", or "rating/tag editing". All data is loaded once via `npm run db:seed`.

The report drill-down ("viewing details") is ordered by **month descending** (newest month first), and titles within a month are sorted by watch time descending. The year/month label follows the UI language (Chinese `2026年1月` / English `Jan, 2026`).

---

## 5. Data Model

Two tables (defined in `data/schema.sql`), **no physical foreign keys, only app-layer semantic links**:

### `imovie_items` (title metadata, TEXT primary key)

- `item_id`: `TEXT PRIMARY KEY`; current strategy is to **use the douban_id directly** (e.g. `1292052`) — stable and carries external-link semantics.
- Persisted `tmdb_id` / `imdb_id` / `douban_id` for external-link composition.
- Multi-value fields are stored `/`-separated: `genres` (also tolerant of commas and ideographic commas), `country` (ISO 3166-1 alpha-2 uppercase, e.g. `CN`/`US`), `language` (ISO 639-1 lowercase, e.g. `zh`/`en`), `director`/`writer`/`cast`.
- `release_date` may be an ISO string with a regional suffix (e.g. `2023-08-30(中国大陆)`); sorting uses the first 10 standard-date characters.

### `imovie_records` (viewing record)

- `id` auto-increment primary key; `item_id` references `imovie_items` primary key at the app layer.
- `UNIQUE(user_id, item_id)`: a user cannot have duplicate records for the same title.
- `status` is only `plan` / `watched`; `rating` (1–10) and `tags` are non-empty only for `watched`; `watched_at` is `YYYY-MM-DD`.

### Common response structure (`lib/types.ts`)

`RecordRow` = record fields (`rec_id` / `status` / `rating` / `tags` / `watched_at` / `created_at`) + nested `item: Item`. Lists, details, search, and year drill-down all reuse this structure and the `mapRow` mapper.

---

## 6. API Design

| Route | Method | Input (Zod-validated) | Returns | Notes |
|-------|--------|------------------------|---------|-------|
| `/api/records` | GET | `status`/`media_type`/`year`/`genre`/`country`/`q`/`sort`/`order`/`page`/`limit` | `{ records, total, page, pageSize, genres, years, countries }` | Unified list/filter/search entry; `dynamic = "force-dynamic"` |
| `/api/stats` | GET | none | `{ overview, years }` | Report overview + per-year grouping; `Cache-Control: s-maxage=60` |
| `/api/stats/[year]` | GET | path param (4-digit number, range 1900–9999) | `{ total, months }` | Report drill-down: grouped by month; `Cache-Control: s-maxage=60` |
| `/api/records/[item_id]` | GET | path param | `RecordRow \| null` | Detail join |

**Validation & error codes**: input that violates Zod enums/ranges/lengths → `422`; `/api/stats/[year]` with a non-4-digit or out-of-range year → `400`; internal DB error → `500`. `limit` is capped by `config.PAGE_SIZE_MAX` (the last item of `PAGE_SIZE_OPTIONS`, currently 120); `sort` allows only a three-value whitelist.

**Error response i18n**: all API errors are returned uniformly via `apiError` / `apiErrorFromUnknown` in `lib/api-error.ts`; the message language (Chinese `zh` or English `en`) is decided by the `Accept-Language` request header, with text from `lib/i18n/errors.ts`. In development the original message is echoed for debugging; in production 5xx internal details are hidden automatically (returning "服务器内部错误" / "Internal server error").

**Query-layer safety**: all `SELECT`s in `lib/queries.ts` use `?` parameterized placeholders; dynamic ordering goes through an enum whitelist — **zero SQL injection**. `genres`/`country` multi-values are split and deduplicated at the app layer via `split(/[/,、]/)`, avoiding SQL `json_each` errors on special characters.

---

## 7. Data Access & Security

- **Connection & schema**: `lib/db.ts` singleton connection; on first connect it creates tables idempotently per `schema.sql`. The schema result is cached in a module-level `schemaReady` Promise so it runs only once per process, with auto-retry on failure. On connection failure the error message is masked by `maskDbUrl()` (remote `?authToken=***`, local keeps only the filename) to avoid leaking tokens or absolute paths.
- **Vercel read-only FS compatibility**: in `file:` mode, if the source directory is unwritable (e.g. Vercel `/var/task` read-only — libsql's default writable open fails because it cannot create a journal), `lib/db.ts` first copies `data/local.db` to writable `/tmp/local.db` before opening (it runs `mkdirSync('/tmp', {recursive:true})` to ensure the directory exists, and copies only when the copy is missing or its size changed). A read-only showcase site needs no real writes, so this is safe; on a writable local environment a copy failure automatically falls back to opening the source file directly.
- **Query layer**: `lib/queries.ts` contains only `SELECT` functions (list/filter/search, sidebar dimensions, detail, report overview, report grouping). All use parameterized placeholders, and dynamic ordering goes through a whitelist enum — **zero SQL injection**.
- **Dimension cache**: `listFacets` has a module-level 5-minute TTL cache (`facetsCache`) to avoid rescanning on every list request; call `invalidateFacets()` after writes to refresh immediately.
- **Write isolation**: write logic `ensureItem` / `upsertRecord` is defined only inside `scripts/seed.ts` and is never imported into the app layer, guaranteeing the production runtime is unwritable.
- **Site protection**: optional Basic Auth (`middleware.ts`) + production CSP / security response headers (`next.config.mjs`): `X-Content-Type-Options` / `X-Frame-Options: DENY` / `Referrer-Policy` / `Permissions-Policy` / `Content-Security-Policy` (includes `img-src` whitelist and `script-src` inline; dev needs `'unsafe-eval'`).
- **Rate-limit middleware** (`middleware.ts`): under Edge Runtime, uses a module-level `Map` for fixed-window counting, with capacity protection:
  - Global: `RATE_LIMIT` requests / IP / 60s, `429` on exceed (with `Retry-After`).
  - Auth brute-force protection: `AUTH_FAIL_LIMIT` failures / IP / 60s, `429` on exceed; a successful auth clears that IP's failure counter.
  - Each request also runs `sweep()`: it drops expired buckets, and when the bucket count exceeds `MAX_BUCKETS=2000` it evicts the earliest-to-reset buckets (approximate LRU), preventing an IP storm from exhausting memory.
  - Error responses contain no `.ts` / stack-trace / `stack` strings (masked); error text is emitted uniformly via `apiError` (see section 6).
  - Limitation: on Serverless, multiple instances count independently and do not share state; global consistency would require an edge KV (e.g. Upstash).

---

## 8. Test Suite

The `test/` directory is a standalone automated test suite that **does not modify application source**; **199 cases** in total:

| Layer | Framework | Files | Cases | Notes |
|-------|-----------|-------|-------|-------|
| Unit | Vitest | `test/unit/*.test.ts` | 66 | Pure functions: Zod validation (`listQuerySchema` + `yearParamSchema`), error handling, poster URL, config constants, DB connection, analytics config |
| Functional | Vitest | `test/functional/*.test.ts` | 75 | In-memory `:memory:` DB queries (33), API routes (21), middleware security (21) |
| UI e2e | Playwright | `test/e2e/ui.spec.ts` | 58 | Web desktop (29) × mobile (29), 58 total |

**Actual file list (matches the code):**

- `test/unit/validate.test.ts` — `listQuerySchema` / `yearParamSchema` validation (enum, coerce, limit cap)
- `test/unit/poster.test.ts` — `posterUrl` construction (TMDb relative path / absolute URL passthrough / empty fallback)
- `test/unit/config.test.ts` — paging constants and `COUNTRY_OPTIONS` (incl. LB/MT) boundaries
- `test/unit/db.test.ts` — `getDb` connection singleton and retry-on-failure (mocks `@libsql/client`)
- `test/unit/analytics.test.ts` — third-party analytics ID format assertions
- `test/unit/api-error.test.ts` — unified error handling and dev/prod dual-mode messaging
- `test/functional/queries.test.ts` — in-memory DB: filter/sort/paginate, dimension dedup, detail, report aggregate, year drill-down
- `test/functional/routes.test.ts` — API routes: success / 422 / 500 and response structure
- `test/functional/security.test.ts` — middleware rate-limit / Basic Auth / error responses without internal leaks
- `test/e2e/ui.spec.ts` — Playwright UI end-to-end (desktop + mobile responsive)

> Latest full run (2026-08-27, measured):
> - **Vitest**: `Test Files 9 passed (9)`, `Tests 141 passed (141)`, 2.03s (unit + functional), **zero failures**.
> - **Playwright UI e2e**: `57 passed + 1 flaky` (58 total, 3.2m), overall green; the 1 flaky is a mobile nav-redirect assertion-timing issue that passes on rerun. Needs browser binaries and external network, so run it **separately** with `npx playwright test` — CI and `npm test` do not touch it.

### Design notes
1. **No real DB**: functional tests use an in-memory `:memory:` fixture (`test/fixtures/db.ts` reads `data/schema.sql` to build tables + seed data) for precise, deterministic, isolated assertions.
2. **Direct Handler calls**: API routes call `new NextRequest(url)` then `await GET(req)`; middleware uses `await middleware(req)` — no server startup needed.
3. **State isolation**: `listFacets` cache is reset via `invalidateFacets()`; middleware modules are reloaded with `vi.resetModules()` to clear the counting Map.
4. **Dual-mode error check**: `lib/api-error.ts` masks 5xx as `internal_error` under `NODE_ENV=production`; tests verify both dev and prod message behavior.
5. **Offline & fast**: Vitest has no IO dependency and finishes in seconds; Playwright launches `next dev` and does not depend on external image loading for assertions (navigation uses `domcontentloaded`; the mobile describe block uses a `beforeEach` to force a 390×844 viewport so responsive classes take effect).

### Run
```bash
npm test                 # Vitest (unit + functional, offline)
npm run test:watch       # Vitest watch mode
npx playwright test               # UI e2e (needs network, auto-starts dev server)
npx playwright test --project=mobile   # Mobile only
```

### SEO Environment Variable
Before deploying, set `NEXT_PUBLIC_SITE_URL`:

```bash
NEXT_PUBLIC_SITE_URL=https://imovie.lyc.la
```

This variable is used for `metadataBase`, `canonical`, `sitemap`, `robots`, and JSON-LD structured data. It falls back to `http://localhost:3000` locally; in production a warning is logged if missing.

> See [test/README.md](../test/README.md) for the test suite details.

---

## 9. Deployment & Ops

### Vercel deployment
1. **Environment variables** (set on the platform, not in git): `DATABASE_URL`, `SITE_PASSWORD`, `RATE_LIMIT`, `AUTH_FAIL_LIMIT` (add `TURSO_AUTH_TOKEN` only when using remote Turso). Whether to bundle local `data/` is decided automatically by `DATABASE_URL` (see section 3) — **no need to set `INCLUDE_LOCAL_DB`**.
2. **Local-file mode works**: since this is a read-only showcase site, you can use `DATABASE_URL=file:./data/local.db` on Vercel. How it works: `next.config.mjs` `outputFileTracingIncludes` bundles `data/local.db` + `schema.sql` into every DB-querying Serverless function (both pages and `/api/**`); at runtime `lib/db.ts` detects the read-only `/var/task` and copies the DB to writable `/tmp/local.db` before opening. Limitations: each instance holds its own `/tmp` copy (not shared), and a cold start copies the DB once (a few MB). Switch to a remote Turso instance (`DATABASE_URL=libsql://...`) only if you need frequent updates or shared state across instances.
3. **Tests stay out of production**: Vitest/Playwright are devDependencies and are not bundled into the runtime; CI runs only `npm test` (offline) — **do not** let the deploy flow run `playwright test` (needs browser binaries + external network, which fails in CI).
4. **`.gitignore` must ignore**: `.env*.local`, `*.db*`, `data/*.db`, test reports (`test/.playwright-report.json`, `test-results/`) to avoid leaking secrets and private data into the repo.

---

## 10. Common Scripts

```bash
npm run dev       # Development
npm run build     # Production build (with type checking)
npm run start     # Run the production build
npm run lint      # Lint code
npm run db:seed   # Create tables and insert sample data (one-time seed)
npm test          # Vitest unit + functional tests (offline)
```

## 11. Directory Structure

```
app/            Pages and API routes (App Router)
  api/         records (GET list / detail/[item_id] detail), stats (GET yearly report / [year] drill-down)
components/     Nav / PosterCard / MovieRow / Analytics etc.
lib/           db / queries (read-only) / config / poster / types / validate / api-error / i18n / analytics
data/          schema.sql (table DDL) + local.db (runtime database, not committed)
scripts/       seed.ts (one-time seed script; contains write functions but never touches the app layer)
test/          unit / functional / e2e / fixtures (automated tests, see section 8)
middleware.ts   Rate limit + HTTP Basic Auth + error masking
```
