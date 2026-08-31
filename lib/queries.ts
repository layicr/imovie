// lib/queries.ts — 数据访问层：所有观影记录的查询与聚合。 / Data access layer: all watch-record queries and aggregations.
// 全部 SQL 参数化（防注入），并集中维护联表投影、列表筛选、维度、报表等读路径。
// Every SQL statement is parameterized (injection-safe); this module owns the joined projection, list filtering, facets and reports.
import type { Client, InValue } from "@libsql/client";
import type { MediaType, MonthBucket, RecordRow, ReportData, Status, YearGroup, YearReportData } from "./types";
import { PAGE_SIZE_DEFAULT } from "./config";
import { splitMultiValue } from "./split";

// 所有 SQL 一律使用参数化占位符（?），绝不字符串拼接，从根本防 SQL 注入。 / All SQL uses parameterized placeholders, never string concatenation.

// 看板/列表/搜索共用的字段投影（imovie_records 与 imovie_items 联表，避免列名冲突用别名区分）。
// Shared column projection for dashboard/list/search (joins imovie_records with imovie_items; aliases avoid column clashes).
const COLS = `
  r.id AS rec_id, r.status AS status, r.rating AS rating, r.tags AS tags,
  r.watched_at AS watched_at, r.created_at AS rec_created,
  i.item_id, i.tmdb_id, i.media_type, i.title, i.original_title, i.year, i.poster_path,
  i.overview, i.director, i.writer, i.cast, i.genres, i.country, i.language,
  i.release_date, i.runtime, i.aka, i.imdb_id, i.douban_id, i.douban_rating, i.tmdb_rating
`;
const JOIN = `FROM imovie_records r JOIN imovie_items i ON r.item_id = i.item_id`;

// 列表查询过滤条件（与 ListResult 配套返回）。 / Filters for list queries (paired with ListResult).
export interface ListFilters {
  status?: Status;
  media_type?: MediaType;
  year?: number;
  genre?: string;
  country?: string;
  q?: string;
  sort?: "release_date" | "douban_rating" | "tmdb_rating";
  order?: "desc" | "asc";
  page?: number; // 1-based (page index)
  limit?: number;
  skipTotal?: boolean; // 看板/首页固定条数场景：跳过 COUNT(*) 查询 / Skip the COUNT(*) query for fixed-size dashboard/home views.
}

// 列表结果：当前页记录 + 命中总数（skipTotal 时 total 为 0）。 / List result: page records + matched total (total is 0 when skipTotal).
export interface ListResult {
  records: RecordRow[];
  total: number;
}

// 联表行 -> RecordRow 结构映射 / Map a joined row into a RecordRow.
function mapRow(r: Record<string, unknown>): RecordRow {
  return {
    rec_id: r.rec_id as number,
    status: r.status as Status,
    rating: (r.rating as number) ?? null,
    tags: (r.tags as string) ?? null,
    watched_at: (r.watched_at as string) ?? null,
    created_at: (r.rec_created as string) ?? null,
    item: {
      item_id: r.item_id as string,
      tmdb_id: (r.tmdb_id as number) ?? null,
      media_type: r.media_type as MediaType,
      title: r.title as string,
      original_title: (r.original_title as string) ?? null,
      year: (r.year as number) ?? null,
      poster_path: (r.poster_path as string) ?? null,
      overview: (r.overview as string) ?? null,
      director: (r.director as string) ?? null,
      writer: (r.writer as string) ?? null,
      cast: (r.cast as string) ?? null,
      genres: (r.genres as string) ?? null,
      country: (r.country as string) ?? null,
      language: (r.language as string) ?? null,
      release_date: (r.release_date as string) ?? null,
      runtime: (r.runtime as number) ?? null,
      aka: (r.aka as string) ?? null,
      imdb_id: (r.imdb_id as string) ?? null,
      douban_id: (r.douban_id as string) ?? null,
      douban_rating: (r.douban_rating as number) ?? null,
      tmdb_rating: (r.tmdb_rating as number) ?? null,
    },
  };
}

// 列表 / 筛选 / 全局搜索：跨片名、原名、演员、类型、标签、状态模糊匹配。
// List / filter / global search: fuzzy match across title, original title, cast, genre, tags and status.
// 支持排序（添加时间 / 豆瓣评分 / TMDb 评分）与分页（page + limit）。
// Supports sorting (added time / Douban rating / TMDb rating) and pagination (page + limit).
export async function listRecords(db: Client, filters: ListFilters = {}): Promise<ListResult> {
  const where: string[] = [];
  const args: InValue[] = [];

  if (filters.status) {
    where.push("r.status = ?");
    args.push(filters.status);
  }
  if (filters.media_type) {
    where.push("i.media_type = ?");
    args.push(filters.media_type);
  }
  if (filters.year) {
    where.push("i.year = ?");
    args.push(filters.year);
  }
  if (filters.genre) {
    where.push("i.genres LIKE ?");
    args.push(`%${filters.genre}%`);
  }
  if (filters.country) {
    where.push("i.country LIKE ?");
    args.push(`%${filters.country}%`);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(
      "(i.title LIKE ? OR i.original_title LIKE ? OR i.director LIKE ? OR i.writer LIKE ? OR i.cast LIKE ? OR i.genres LIKE ? OR i.country LIKE ? OR r.tags LIKE ? OR r.status LIKE ?)"
    );
    args.push(like, like, like, like, like, like, like, like, like);
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  // 排序：默认按上映日期(release_date)；评分排序把无值行排到最后（NULLS LAST）。
  // Sorting: default by release_date; rating sorts push nulls to the end (NULLS LAST).
  // release_date 可能带地区后缀（如 2023-08-30(中国大陆)），取前 10 位标准日期排序。
  // release_date may carry a region suffix (e.g. 2023-08-30(中国大陆)); sort by the first 10 chars (standard date).
  const order = filters.order === "asc" ? "ASC" : "DESC";
  let orderSql: string;
  if (filters.sort === "douban_rating") {
    orderSql = `ORDER BY i.douban_rating ${order} NULLS LAST, substr(i.release_date, 1, 10) DESC`;
  } else if (filters.sort === "tmdb_rating") {
    orderSql = `ORDER BY i.tmdb_rating ${order} NULLS LAST, substr(i.release_date, 1, 10) DESC`;
  } else {
    orderSql = `ORDER BY substr(i.release_date, 1, 10) ${order} NULLS LAST`;
  }

  // 总数（不受分页影响）；看板/首页固定条数场景可跳过 COUNT(*) 查询
  // Total (ignores pagination); the COUNT(*) is skipped for fixed-size dashboard/home views.
  let total = 0;
  if (!filters.skipTotal) {
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) AS c ${JOIN}${whereSql}`,
      args: [...args],
    });
    const firstRow = countRes.rows[0] as Record<string, unknown> | undefined;
    total = firstRow ? Number(firstRow.c) || 0 : 0;
  }

  // 分页：内部调用若传 limit<=0（zod 已禁止外部 API 传入）表示不限制，否则回退 PAGE_SIZE_DEFAULT。
  // Pagination: an internal limit<=0 (zod already blocks external APIs) means "no limit"; otherwise fall back to PAGE_SIZE_DEFAULT.
  const isUnlimited = (filters.limit ?? 0) <= 0;
  const limit = isUnlimited ? -1 : filters.limit ?? PAGE_SIZE_DEFAULT;
  const page = filters.page && filters.page > 1 ? filters.page : 1;
  const offset = (page - 1) * (isUnlimited ? 0 : limit);

  const sql = `SELECT ${COLS} ${JOIN}${whereSql} ${orderSql}${
    isUnlimited ? "" : " LIMIT ? OFFSET ?"
  }`;
  const res = await db.execute({
    sql,
    args: isUnlimited ? [...args] : [...args, limit, offset],
  });
  return { records: (res.rows as Record<string, unknown>[]).map(mapRow), total };
}

// 动态筛选维度：从库里读取去重后的类型标签、年份与制片国家/地区，供搜索侧栏渲染选项。
// Dynamic filter facets: distinct genre tags, years and countries for the search sidebar.
// 维度几乎不变，但每次列表请求都会调用。用模块级 TTL 缓存避免重复扫描
// Facets rarely change but are fetched on every list request; a module-level TTL cache avoids repeated scans
// （默认 5 分钟）；若有写入（新增/导入影片）后需立即刷新，可调用 invalidateFacets()。
// (default 5 min); call invalidateFacets() to force a refresh after a write (add/import).
// 测试契约：功能测试（test/functional）在 beforeEach 调用本函数重置缓存，确保用例间
// Test contract: functional tests (test/functional) call this in beforeEach to reset the cache so cases stay
// 内存库隔离、不串扰；改动缓存策略时须同步验证 test/functional 的 facets 用例。
// isolated in the in-memory db; changing the cache strategy must keep the functional facets cases green.
const FACETS_TTL = 5 * 60 * 1000;
let facetsCache: { value: Facets; at: number } | null = null;

// 筛选维度结构：去重后的类型、年份、国家列表。 / Facet shape: deduplicated genres, years and countries.
export interface Facets {
  genres: string[];
  years: number[];
  countries: string[];
}

// 清除维度缓存（写入后调用，使下次读取重新扫描）。 / Clear the facet cache (call after a write to force a rescan).
export function invalidateFacets(): void {
  facetsCache = null;
}

// 读取类型/年份/国家三维筛选选项（带 TTL 缓存）。 / Read the genre/year/country facets (with TTL cache).
export async function listFacets(db: Client): Promise<Facets> {
  const now = Date.now();
  if (facetsCache && now - facetsCache.at < FACETS_TTL) {
    return facetsCache.value;
  }
  // genres 以「/」分隔（兼容逗号/顿号）存储：取出所有原始串后在应用层拆分去重，
  // Genres are stored slash-separated (also comma/middot); collect raw strings then split & dedupe in app code,
  // 避免 SQL 内 json_each 对含特殊字符的值报 malformed JSON。
  // avoiding SQL json_each's malformed-JSON errors on special characters.
  // 只取「已有观影记录」的影片维度，避免未看影片污染筛选选项，并缩小扫描范围。
  // Only take dimensions of movies that have a record, so unwatched titles don't pollute options and the scan stays small.
  const gRes = await db.execute({
    sql: `SELECT DISTINCT genres, country FROM imovie_items
          WHERE item_id IN (SELECT item_id FROM imovie_records)
            AND ((genres IS NOT NULL AND genres <> '') OR (country IS NOT NULL AND country <> ''))`,
    args: [],
  });
  const genreSet = new Set<string>();
  const countrySet = new Set<string>();
  for (const row of gRes.rows as Record<string, unknown>[]) {
    const genreRaw = row.genres as string | null;
    if (genreRaw) {
      for (const token of splitMultiValue(genreRaw)) {
        genreSet.add(token);
      }
    }
    const countryRaw = row.country as string | null;
    if (countryRaw) {
      for (const token of splitMultiValue(countryRaw)) {
        countrySet.add(token);
      }
    }
  }
  const genres = [...genreSet].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const countries = [...countrySet].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  const yRes = await db.execute({
    sql: `SELECT DISTINCT year FROM imovie_items
          WHERE item_id IN (SELECT item_id FROM imovie_records) AND year IS NOT NULL
          ORDER BY year DESC`,
    args: [],
  });
  const years = (yRes.rows as Record<string, unknown>[])
    .map((r) => Number(r.year))
    .filter((y) => Number.isFinite(y));

  const value: Facets = { genres, years, countries };
  facetsCache = { value, at: now };
  return value;
}

// 单条记录（详情页用） / Single record (used by the detail page).
export async function getRecord(db: Client, item_id: string): Promise<RecordRow | null> {
  const res = await db.execute({
    sql: `SELECT ${COLS} ${JOIN} WHERE r.item_id = ?`,
    args: [item_id],
  });
  const rows = res.rows as Record<string, unknown>[];
  return rows.length ? mapRow(rows[0]) : null;
}

// 总览统计：累计已看、平均评分、今年已看（单条 SQL 聚合，省去多次往返）
// Overview stats: total watched, average rating, watched this year (one aggregated SQL, saving round-trips).
async function getOverview(db: Client) {
  const res = await db.execute({
    sql: `SELECT
            COUNT(*) AS total,
            AVG(CASE WHEN rating IS NOT NULL THEN CAST(rating AS REAL) END) AS avg,
            SUM(CASE WHEN strftime('%Y', watched_at)=strftime('%Y','now') THEN 1 ELSE 0 END) AS thisYear
          FROM imovie_records WHERE status='watched'`,
    args: [],
  });
  const row = res.rows[0] as Record<string, unknown> | undefined;
  return {
    totalWatched: Number(row?.total ?? 0),
    avgRating: row?.avg == null ? null : Number(row.avg),
    thisYearWatched: Number(row?.thisYear ?? 0),
  };
}

// 年度报告：总览 + 按年份分组的年份小计（海报墙在下钻接口按需返回，此处不返回 items）
// Annual report: overview + per-year subtotals (poster walls are returned lazily by the drill-down API, not here).
//
// 优化：年份的 count/avg 直接在数据库层用一条 GROUP BY 聚合返回，
// Optimization: year count/avg are aggregated in one GROUP BY at the DB layer,
// 不再像旧实现那样全量拉取 watched 记录后在应用层分组（避免大表全扫 + 内存开销）。
// instead of pulling all watched rows and grouping in app code (which caused a full scan + memory overhead).
// 报表页当前仅消费 year/count/avg，年份下钻所需的 items 按需懒加载，此处不返回。
// The report page only consumes year/count/avg; drill-down items are lazy-loaded, so they're omitted here.
export async function getReport(db: Client): Promise<ReportData> {
  const overview = await getOverview(db);

  const res = await db.execute({
    sql: `SELECT
            CAST(strftime('%Y', watched_at) AS INTEGER) AS year,
            CAST(COUNT(*) AS INTEGER) AS count,
            CASE WHEN SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) > 0
                 THEN AVG(CASE WHEN rating IS NOT NULL THEN CAST(rating AS REAL) END)
                 ELSE NULL END AS avg
          FROM imovie_records
          WHERE status = 'watched' AND watched_at IS NOT NULL
          GROUP BY year
          ORDER BY year DESC`,
    args: [],
  });

  const years: YearGroup[] = (res.rows as unknown as Array<{ year: number; count: number; avg: number | null }>).map(
    (r) => ({
      year: Number(r.year),
      count: Number(r.count),
      avg: r.avg == null ? null : Number(r.avg),
    })
  );

  return { overview, years };
}

// 年份下钻：拉取指定 watched_at 年份的所有 watched 记录（应用层按月分组）。
// Year drill-down: fetch all watched records of a given watched_at year (grouped by month in app code).
// watched_at 与报表其他口径一致（naive 字符串，不偏移）。一次取出全年而非按月发 12 条 SQL，
// watched_at matches the report's other figures (naive string, no offset). One full-year fetch instead of 12 monthly SQLs,
// 符合站点规模（年观影量数十~数百），并复用 listRecords 的联表投影与 mapRow。
// which fits the site scale (tens–hundreds per year) and reuses listRecords' projection and mapRow.
export async function getYearReport(db: Client, year: number): Promise<YearReportData> {
  const res = await db.execute({
    sql: `SELECT ${COLS} ${JOIN}
          WHERE r.status = 'watched'
            AND strftime('%Y', r.watched_at) = ?
          ORDER BY r.watched_at DESC, r.id DESC`,
    args: [String(year)],
  });
  const rows = res.rows as Record<string, unknown>[];
  const records = rows.map(mapRow);

  // 按 YYYY-MM 分组（monthKey 为中性标识，展示文案由前端按语言格式化）
  // Group by YYYY-MM (monthKey is a neutral key; display text is localized on the frontend).
  const buckets = new Map<string, RecordRow[]>();
  for (const rec of records) {
    const wa = rec.watched_at;
    if (!wa) continue;
    const monthKey = wa.slice(0, 7); // YYYY-MM
    if (!buckets.has(monthKey)) buckets.set(monthKey, []);
    buckets.get(monthKey)!.push(rec);
  }

  const months: MonthBucket[] = [...buckets.entries()]
    .map(([monthKey, items]) => ({
      monthKey,
      count: items.length,
      items,
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey)); // 月份降序（新月份在前） / Months descending (newest first).

  return { year, total: records.length, months };
}
