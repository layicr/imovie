# iMOVIE · Personal Movie Tracking Showcase

中文版：[README_DEV.md](./README_DEV.md)

iMOVIE is a self-hosted **read-only** personal movie & TV tracking showcase. With a Netflix-style streaming interface, it lets you elegantly browse and look back on your own "Plan to Watch / Watched" titles; whether on phone or desktop, you get a comfortable, immersive experience.

- Data comes from a database (Turso / libSQL, `@libsql/client`), starting with a local `file:./data/local.db`. **No external accounts or API keys are required to display your data** (no live TMDb / Douban dependency).
- **The application layer is fully read-only**: all pages and APIs only query and display; there are no create, update, or delete entry points. Data is loaded once via a seed script.
- Core states: `Plan to Watch (plan)` and `Watched (watched)` — no "Currently Watching" state.
- Ratings (1–10) and tags **only appear for "Watched" items**; each user keeps a single record per title.

---

## 1. Quick Start (Local, No Keys Required)

```bash
npm install          # Install dependencies
npm run db:seed      # Create tables and insert sample titles (one-time seed script)
npm run dev          # Start the dev server, default http://localhost:3000
```

`npm run db:seed` auto-creates tables idempotently per `data/schema.sql` and inserts a batch of sample titles (posters left blank; the frontend falls back to a placeholder image automatically). The full browsing experience works without configuring any keys.

## 2. Configuration (Optional)

### Site Password (SITE_PASSWORD)

When set, the whole site requires HTTP Basic authentication to protect your private viewing data; when empty (default), all requests are allowed directly — friendly for local/public access with no password protection.

- The username is arbitrary; only the password is validated. Password comparison uses constant-time comparison to prevent timing side-channel attacks.
- Configure it by setting `SITE_PASSWORD=your-site-password` in your `.env.local` environment variables.

## 3. Feature Overview

| Page          | Path             | Description                                          |
| ------------- | ---------------- | ---------------------------------------------------- |
| Dashboard     | `/`              | Featured hero + horizontal "Plan" / "Watched" rows    |
| Detail        | `/detail/[id]`   | Strict metadata layout (director/cast/rating/aliases)|
| Search        | `/search`        | Global keyword + year/genre/country filters + hot tags|
| Yearly Report | `/report`        | Three overview cards + per-year poster wall + subtotals + month drill-down|

> This repository is a **showcase site**: it has no write features such as "add title", "Douban import", "status toggle", or "rating/tag editing". All data is loaded once via `npm run db:seed`.

The report drill-down ("viewing details") is ordered by **month descending** (newest month first), and titles within a month are sorted by watch time descending. The year/month label follows the UI language (Chinese `2026年1月` / English `Jan, 2026`).

## 4. Common Scripts

```bash
npm run dev       # Development
npm run build     # Production build (with type checking)
npm run start     # Run the production build
npm run lint      # Lint code
npm run db:seed   # Create tables and insert sample data (one-time seed)
```

## 5. Directory Structure

```
app/            Pages and API routes (App Router)
  api/         records (GET list / detail/[tmdb_id] detail), stats (GET yearly report)
components/     Nav / PosterCard / MovieRow / Analytics etc.
lib/           db / queries (read-only) / config / poster / types / validate / i18n / analytics
data/          schema.sql (database schema)
scripts/       seed.ts (one-time seed script; contains write functions but never touches the app layer)
middleware.ts  Optional HTTP Basic Auth
```

## 6. Data Access & Security

- **Connection & schema**: `lib/db.ts` singleton connection; on first connect it creates tables idempotently per `schema.sql`. The schema result is cached in a module-level `schemaReady` Promise so it runs only once per process, with auto-retry on failure.
- **Query layer**: `lib/queries.ts` contains only `SELECT` functions (list/filter/search, sidebar dimensions, detail, report overview, report grouping). All use parameterized placeholders, and dynamic ordering goes through a whitelist enum — **zero SQL injection**.
- **Write isolation**: write logic `ensureItem` / `upsertRecord` is defined only inside `scripts/seed.ts` and is never imported into the app layer, guaranteeing the production runtime is unwritable.
- **Site protection**: optional Basic Auth (`middleware.ts`) + production CSP / security response headers (`next.config.mjs`).

---