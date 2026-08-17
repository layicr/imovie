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
middleware.ts       Rate limit (fixed window) + HTTP Basic Auth + error masking
   │
   ▼
app/               Pages (Server Components query the DB directly) + api/* (Route Handlers)
   │
   ▼
lib/queries.ts     Pure read-only SELECT (parameterized, zero injection)
lib/validate.ts    Zod input validation (enums / ranges / lengths)
lib/db.ts          Singleton connection + idempotent schema creation (schema.sql)
lib/config.ts      Structural constants (nav / filter options / pagination)
lib/poster.ts      Poster URL builder (TMDb relative → absolute; empty falls back to picsum)
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
| `INCLUDE_LOCAL_DB` | `true` | Set `false` to skip bundling `data/` (when using Turso) |
| `SITE_PASSWORD` | empty | When set, the whole site requires HTTP Basic Auth |
| `RATE_LIMIT` | `120` | Global request cap per IP per 60s (429 on exceed) |
| `AUTH_FAIL_LIMIT` | `20` | Auth-failure cap per IP per 60s (429 on exceed; only when password is set) |

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
| `/api/records/[item_id]` | GET | path param | `RecordRow \| null` | Detail join |

**Validation & error codes**: input that violates Zod enums/ranges/lengths → `422`; internal DB error → `500`. `limit` is capped by `config.PAGE_SIZE_MAX` (the last item of `PAGE_SIZE_OPTIONS`, currently 120); `sort` allows only a three-value whitelist.

**Query-layer safety**: all `SELECT`s in `lib/queries.ts` use `?` parameterized placeholders; dynamic ordering goes through an enum whitelist — **zero SQL injection**. `genres`/`country` multi-values are split and deduplicated at the app layer via `split(/[/,、]/)`, avoiding SQL `json_each` errors on special characters.

---

## 7. Data Access & Security

- **Connection & schema**: `lib/db.ts` singleton connection; on first connect it creates tables idempotently per `schema.sql`. The schema result is cached in a module-level `schemaReady` Promise so it runs only once per process, with auto-retry on failure.
- **Query layer**: `lib/queries.ts` contains only `SELECT` functions (list/filter/search, sidebar dimensions, detail, report overview, report grouping). All use parameterized placeholders, and dynamic ordering goes through a whitelist enum — **zero SQL injection**.
- **Dimension cache**: `listFacets` has a module-level 5-minute TTL cache (`facetsCache`) to avoid rescanning on every list request; call `invalidateFacets()` after writes to refresh immediately.
- **Write isolation**: write logic `ensureItem` / `upsertRecord` is defined only inside `scripts/seed.ts` and is never imported into the app layer, guaranteeing the production runtime is unwritable.
- **Site protection**: optional Basic Auth (`middleware.ts`) + production CSP / security response headers (`next.config.mjs`): `X-Content-Type-Options` / `X-Frame-Options: DENY` / `Referrer-Policy` / `Permissions-Policy` / `Content-Security-Policy` (includes `img-src` whitelist and `script-src` inline; dev needs `'unsafe-eval'`).
- **Rate-limit middleware** (`middleware.ts`): under Edge Runtime, uses a module-level `Map` for fixed-window counting.
  - Global: `RATE_LIMIT` requests / IP / 60s, `429` on exceed (with `Retry-After`).
  - Auth brute-force protection: `AUTH_FAIL_LIMIT` failures / IP / 60s, `429` on exceed; a successful auth clears that IP's failure counter.
  - Error responses contain no `.ts` / stack-trace / `stack` strings (masked).
  - Limitation: on Serverless, multiple instances count independently and do not share state; global consistency would require an edge KV (e.g. Upstash).

---

## 8. Test Suite

The `test/` directory is a standalone automated test suite that **does not modify application source**; **93 cases** in total:

| Layer | Framework | Files | Cases | Notes |
|-------|-----------|-------|-------|-------|
| Unit | Vitest | `test/unit/*.test.ts` | 36 | Pure functions: Zod validation, poster URL, config constants |
| Functional | Vitest | `test/functional/*.test.ts` | 33 | In-memory `:memory:` DB queries, API routes, middleware security |
| UI e2e | Playwright | `test/e2e/ui.spec.ts` | 24 | Web desktop + mobile real UI |

### Design notes
1. **No real DB**: functional tests use an in-memory `:memory:` fixture (`test/fixtures/db.ts` reads `data/schema.sql` to build tables + seed data) for precise, deterministic, isolated assertions.
2. **Direct Handler calls**: API routes call `new NextRequest(url)` then `await GET(req)`; middleware uses `await middleware(req)` — no server startup needed.
3. **State isolation**: `listFacets` cache is reset via `invalidateFacets()`; middleware modules are reloaded with `vi.resetModules()` to clear the counting Map.
4. **Offline & fast**: Vitest has no IO dependency and finishes in seconds; Playwright launches `next dev` and does not depend on external image loading for assertions (navigation uses `domcontentloaded`).

### Run
```bash
npm test                 # Vitest (unit + functional, offline)
npx playwright test      # UI e2e (needs network, auto-starts dev server)
```

> See [test/README.md](../test/README.md) and [test/REPORT-2026-08-17.md](../test/REPORT-2026-08-17.md) for details.

---

## 9. Deployment & Ops

### Vercel deployment
1. **Environment variables** (set on the platform, not in git): `DATABASE_URL`(Turso), `TURSO_AUTH_TOKEN`, `SITE_PASSWORD`, `RATE_LIMIT`, `AUTH_FAIL_LIMIT`, `INCLUDE_LOCAL_DB=false`.
2. **Local-file mode limitation**: Serverless read-only filesystem + multiple instances means a local `file:` DB reads a build-time snapshot, runtime writes fail, and instances don't share state. **Production must use a remote Turso instance**.
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
  api/         records (GET list / detail/[item_id] detail), stats (GET yearly report)
components/     Nav / PosterCard / MovieRow / Analytics etc.
lib/           db / queries (read-only) / config / poster / types / validate / i18n / analytics
data/          schema.sql (table DDL) + local.db (runtime database, not committed)
scripts/       seed.ts (one-time seed script; contains write functions but never touches the app layer)
test/          unit / functional / e2e / fixtures (automated tests, see section 8)
middleware.ts   Rate limit + HTTP Basic Auth + error masking
```
