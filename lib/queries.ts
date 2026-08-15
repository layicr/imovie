import type { Client, InValue } from "@libsql/client";
import type { MediaType, MonthBucket, RecordRow, ReportData, Status, YearGroup, YearReportData } from "./types";

// 所有 SQL 一律使用参数化占位符（?），绝不字符串拼接，从根本防 SQL 注入。

// 看板/列表/搜索共用的字段投影（imovie_records 与 imovie_items 联表，避免列名冲突用别名区分）。
const COLS = `
  r.id AS rec_id, r.status AS status, r.rating AS rating, r.tags AS tags,
  r.watched_at AS watched_at, r.created_at AS rec_created,
  i.tmdb_id, i.media_type, i.title, i.original_title, i.year, i.poster_path,
  i.overview, i.director, i.writer, i.cast, i.genres, i.country, i.language,
  i.release_date, i.runtime, i.aka, i.imdb_id, i.douban_rating, i.tmdb_rating
`;
const JOIN = `FROM imovie_records r JOIN imovie_items i ON r.tmdb_id = i.tmdb_id`;

export interface ListFilters {
  status?: Status;
  media_type?: MediaType;
  year?: number;
  genre?: string;
  country?: string;
  q?: string;
  sort?: "release_date" | "douban_rating" | "tmdb_rating";
  order?: "desc" | "asc";
  page?: number; // 1-based
  limit?: number;
}

export interface ListResult {
  records: RecordRow[];
  total: number;
}

// 联表行 -> RecordRow 结构映射
function mapRow(r: Record<string, unknown>): RecordRow {
  return {
    rec_id: r.rec_id as number,
    status: r.status as Status,
    rating: (r.rating as number) ?? null,
    tags: (r.tags as string) ?? null,
    watched_at: (r.watched_at as string) ?? null,
    created_at: (r.rec_created as string) ?? null,
    item: {
      tmdb_id: r.tmdb_id as number,
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
      douban_rating: (r.douban_rating as number) ?? null,
      tmdb_rating: (r.tmdb_rating as number) ?? null,
    },
  };
}

// 列表 / 筛选 / 全局搜索：跨片名、原名、演员、类型、标签、状态模糊匹配。
// 支持排序（添加时间 / 豆瓣评分 / TMDb 评分）与分页（page + limit）。
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
  // release_date 可能带地区后缀（如 2023-08-30(中国大陆)），取前 10 位标准日期排序。
  const order = filters.order === "asc" ? "ASC" : "DESC";
  let orderSql: string;
  if (filters.sort === "douban_rating") {
    orderSql = `ORDER BY i.douban_rating ${order} NULLS LAST, substr(i.release_date, 1, 10) DESC`;
  } else if (filters.sort === "tmdb_rating") {
    orderSql = `ORDER BY i.tmdb_rating ${order} NULLS LAST, substr(i.release_date, 1, 10) DESC`;
  } else {
    orderSql = `ORDER BY substr(i.release_date, 1, 10) ${order} NULLS LAST`;
  }

  // 总数（不受分页影响）
  const countRes = await db.execute({
    sql: `SELECT COUNT(*) AS c ${JOIN}${whereSql}`,
    args: [...args],
  });
  const firstRow = countRes.rows[0] as Record<string, unknown> | undefined;
  const total = firstRow ? Number(firstRow.c) || 0 : 0;

  // 分页：limit<=0 表示不限制（内部批量取数用，如年报全量统计）；否则默认 60。
  const isUnlimited = (filters.limit ?? 0) <= 0;
  const limit = isUnlimited ? -1 : filters.limit ?? 60;
  const page = filters.page && filters.page > 1 ? filters.page : 1;
  const offset = (page - 1) * (isUnlimited ? 0 : limit);

  const res = await db.execute({
    sql: `SELECT ${COLS} ${JOIN}${whereSql} ${orderSql}${isUnlimited ? "" : ` LIMIT ${limit} OFFSET ${offset}`}`,
    args: [...args],
  });
  return { records: (res.rows as Record<string, unknown>[]).map(mapRow), total };
}

// 动态筛选维度：从库里读取去重后的类型标签、年份与制片国家/地区，供搜索侧栏渲染选项。
export interface Facets {
  genres: string[];
  years: number[];
  countries: string[];
}

// 维度几乎不变，但每次列表请求都会调用。用模块级 TTL 缓存避免重复扫描
// （默认 5 分钟）；若有写入（新增/导入影片）后需立即刷新，可调用 invalidateFacets()。
const FACETS_TTL = 5 * 60 * 1000;
let facetsCache: { value: Facets; at: number } | null = null;

export function invalidateFacets(): void {
  facetsCache = null;
}

export async function listFacets(db: Client): Promise<Facets> {
  const now = Date.now();
  if (facetsCache && now - facetsCache.at < FACETS_TTL) {
    return facetsCache.value;
  }
  // genres 以「/」分隔（兼容逗号/顿号）存储：取出所有原始串后在应用层拆分去重，
  // 避免 SQL 内 json_each 对含特殊字符的值报 malformed JSON。
  // 只取「已有观影记录」的影片维度，避免未看影片污染筛选选项，并缩小扫描范围。
  const gRes = await db.execute({
    sql: `SELECT DISTINCT genres, country FROM imovie_items
          WHERE tmdb_id IN (SELECT tmdb_id FROM imovie_records)
            AND ((genres IS NOT NULL AND genres <> '') OR (country IS NOT NULL AND country <> ''))`,
    args: [],
  });
  const genreSet = new Set<string>();
  const countrySet = new Set<string>();
  for (const row of gRes.rows as Record<string, unknown>[]) {
    const genreRaw = row.genres as string | null;
    if (genreRaw) {
      for (const part of genreRaw.split(/[/,、]/)) {
        const token = part.trim();
        if (token) genreSet.add(token);
      }
    }
    const countryRaw = row.country as string | null;
    if (countryRaw) {
      for (const part of countryRaw.split(/[/,、]/)) {
        const token = part.trim();
        if (token) countrySet.add(token);
      }
    }
  }
  const genres = [...genreSet].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const countries = [...countrySet].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

  const yRes = await db.execute({
    sql: `SELECT DISTINCT year FROM imovie_items
          WHERE tmdb_id IN (SELECT tmdb_id FROM imovie_records) AND year IS NOT NULL
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

// 单条记录（详情页用）
export async function getRecord(db: Client, tmdb_id: number): Promise<RecordRow | null> {
  const res = await db.execute({
    sql: `SELECT ${COLS} ${JOIN} WHERE r.tmdb_id = ?`,
    args: [tmdb_id],
  });
  const rows = res.rows as Record<string, unknown>[];
  return rows.length ? mapRow(rows[0]) : null;
}

// 总览统计：累计已看、平均评分、今年已看（单条 SQL 聚合，省去多次往返）
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
    totalWatched: (row?.total as number) ?? 0,
    avgRating: row?.avg == null ? null : Number(row.avg),
    thisYearWatched: (row?.thisYear as number) ?? 0,
  };
}

// 年度报告：总览 + 按年份分组的海报墙与小计
//
// 优化：年份的 count/avg 直接在数据库层用一条 GROUP BY 聚合返回，
// 不再像旧实现那样全量拉取 watched 记录后在应用层分组（避免大表全扫 + 内存开销）。
// 报表页当前仅消费 year/count/avg，年份下钻所需的 items 按需懒加载，此处不返回。
export async function getReport(db: Client): Promise<ReportData> {
  const overview = await getOverview(db);

  const res = await db.execute({
    sql: `SELECT
            CAST(strftime('%Y', watched_at) AS INTEGER) AS year,
            COUNT(*) AS count,
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
// watched_at 与报表其他口径一致（naive 字符串，不偏移）。一次取出全年而非按月发 12 条 SQL，
// 符合站点规模（年观影量数十~数百），并复用 listRecords 的联表投影与 mapRow。

export async function getYearReport(db: Client, year: number): Promise<YearReportData> {
  // 按年份过滤：strftime('%Y', watched_at)
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
      monthLabel: monthKey, // 占位，前端按语言覆盖
      count: items.length,
      items,
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey)); // 月份降序（新月份在前）

  return { year, total: records.length, months };
}

