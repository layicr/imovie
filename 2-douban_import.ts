/**
 * 豆瓣导出 JSON → iMOVIE SQLite 同步工具
 *
 * 用法（在本目录，需先 npm install 安装 @libsql/client 与 tsx）：
 *   npx tsx 2-douban_import.ts
 *
 * 行为：
 *   - 读取 movie_done.json（已看 → watched）与 movie_wish.json（想看 → plan）
 *   - 以豆瓣编号 subject.id 作为 imovie_items.item_id（主键），douban_id 同值
 *   - 缺失字段（original_title/poster_path/tmdb_id/tmdb_rating/imdb_id/overview/
 *     country/language/runtime 等）通过 TMDb Search + Details API 补全，
 *     并可抓取豆瓣影片页兜底补全导演/主演/类型/上映日期等
 *   - 通过 @libsql/client 直接读写 config.json 中 dbPath 指定的 SQLite 库：
 *       已存在 item_id → 仅以非空字段覆盖更新；新增 → 插入
 *       imovie_records → 事务内按本次 item_id 删除后全量重插（保留其他历史）
 *   - TMDb 查不到的影片，写入 unresolved.json（item_id + title + media_type）供人工处理
 *
 * 配置见同目录 config.json。
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client, type InValue } from "@libsql/client";

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(__dirname, "config.json");
const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as {
  dbPath: string; // 目标 SQLite 库（直接读写，用于在线同步）
  jsonDir: string;
  doneFile: string;
  wishFile: string;
  limit: number; // 0 = 不限制
  outputSql?: string;
  unresolvedFile: string;
  progressFile?: string; // 断点续传：已完成的 item_id 记录
  batchSize?: number; // 每处理多少条后写入文件并休息
  batchRestMs?: number; // 每批之间的休息时间（毫秒）
  tmdbApiKey: string;
  tmdbBaseUrl: string;
  tmdbDelayMs: number;
  randomDelayMaxMs?: number; // 每处理一条后随机休息上限（毫秒），0~该值随机
  enableTmdb: boolean;
  proxy?: string; // 可选 HTTP/HTTPS 代理，如 http://127.0.0.1:7890
  doubanCookie?: string; // 豆瓣页面抓取用 Cookie
  scrapeDelayMs?: number; // 每条豆瓣页面抓取后的停顿（毫秒）
  enableDoubanScrape?: boolean; // 是否对 TMDb 未覆盖字段抓豆瓣页兜底
  mergedSql?: string; // 全部分片合并后的单一 SQL 文件名（空则不生成）
};

const BASE = __dirname;
const jsonDir = path.resolve(BASE, cfg.jsonDir);
const donePath = path.join(jsonDir, cfg.doneFile);
const wishPath = path.join(jsonDir, cfg.wishFile);
const unresolvedPath = path.resolve(BASE, cfg.unresolvedFile);
const progressPath = path.resolve(BASE, cfg.progressFile || "progress.json");
const DB_PATH = path.resolve(BASE, cfg.dbPath);

const BATCH_SIZE = cfg.batchSize && cfg.batchSize > 0 ? cfg.batchSize : 30;
const BATCH_REST_MS = cfg.batchRestMs && cfg.batchRestMs > 0 ? cfg.batchRestMs : 50000;
const RANDOM_DELAY_MAX = cfg.randomDelayMaxMs && cfg.randomDelayMaxMs > 0 ? cfg.randomDelayMaxMs : 1000;
const SCRAPE_DELAY = cfg.scrapeDelayMs && cfg.scrapeDelayMs > 0 ? cfg.scrapeDelayMs : 2000;
const ENABLE_DOUBAN_SCRAPE = cfg.enableDoubanScrape ?? true;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
interface DoubanSubject {
  id: string;
  title: string;
  original_title?: string;
  year?: string;
  type?: string;
  subtype?: string;
  directors: { name: string }[];
  actors: { name: string }[];
  genres: string[];
  rating?: { value: number; max: number } | null;
  pubdate?: string[];
  release_date?: string | null;
  cover_url?: string;
  card_subtitle?: string;
}

interface DoubanEntry {
  id: number;
  status: string;
  rating: { value: number; max: number } | null;
  create_time?: string; // 豆瓣标记时间，用于 watched_at
  subject: DoubanSubject;
}

// TMDb 搜索结果（只需 id，其余靠 details 接口）
interface TmdbSearchResult {
  id: number;
  poster_path: string | null;
  vote_average: number;
  original_title?: string;
  title?: string;
}

// TMDb 详情（补全细节字段）
interface TmdbDetails {
  id: number;
  poster_path: string | null;
  vote_average: number;
  original_title?: string;
  original_name?: string;
  original_language?: string;
  overview?: string | null;
  release_date?: string;
  runtime?: number | null;
  origin_country?: string[];
  imdb_id?: string | null;
  created_by?: { name: string }[]; // tv
  episode_run_time?: number[] | null; // tv 单集时长（分钟），首季有效值
  credits?: { crew?: { name: string; department: string; job?: string }[] };
}

// 单条影片 + 记录
interface Row {
  item_id: string;
  media_type: "movie" | "tv";
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  overview: string | null;
  director: string;
  writer: string | null;
  cast: string;
  genres: string;
  country: string | null;
  language: string | null;
  release_date: string | null;
  runtime: number | null;
  aka: string | null;
  imdb_id: string | null;
  douban_id: string;
  tmdb_id: number | null;
  douban_rating: number | null;
  tmdb_rating: number | null;
  // records
  status: "plan" | "watched";
  rating: number | null;
  tags: string;
  watched_at: string | null;
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
function q(v: string | null | undefined): string {
  // SQL 字符串字面量转义：NULL → NULL，否则单引号转义
  if (v === null || v === undefined) return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}
function qi(v: number | null): string {
  return v === null || v === undefined ? "NULL" : String(v);
}
function splitDate(pub: string | undefined): string | null {
  if (!pub) return null;
  const m = pub.match(/(\d{4})[-/年](\d{1,2})[-/月]?(\d{1,2})?/);
  if (m) {
    const y = m[1];
    const mo = (m[2] || "1").padStart(2, "0");
    const d = (m[3] || "1").padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const ym = pub.match(/(\d{4})[-/](\d{1,2})/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, "0")}-01`;
  const y = pub.match(/(\d{4})/);
  return y ? `${y[1]}-01-01` : null;
}
function parseYear(y: string | undefined): number | null {
  if (!y) return null;
  const m = y.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}
function join(arr: { name: string }[] | undefined, sep = " / "): string {
  return (arr || []).map((x) => x.name).join(sep);
}
function mediaOf(s: DoubanSubject): "movie" | "tv" {
  return s.type === "tv" || s.subtype === "tv" ? "tv" : "movie";
}

// ---------------------------------------------------------------------------
// TMDb 补全
// ---------------------------------------------------------------------------
async function tmdbSearch(
  media: "movie" | "tv",
  title: string,
  year: number | null
): Promise<TmdbSearchResult | null> {
  const url = new URL(`${cfg.tmdbBaseUrl}/search/${media}`);
  url.searchParams.set("api_key", cfg.tmdbApiKey);
  url.searchParams.set("query", title);
  url.searchParams.set("language", "zh-CN");
  if (year) url.searchParams.set("year", String(year));
  url.searchParams.set("include_adult", "false");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: TmdbSearchResult[] };
  return data.results && data.results.length ? data.results[0] : null;
}

async function tmdbAlternativeTitles(
  media: "movie" | "tv",
  id: number,
  originCountry: string | null
): Promise<string | null> {
  // 又名（别名）接口：movie/tv 均为 /{media}/{id}/alternative_titles
  const url = new URL(`${cfg.tmdbBaseUrl}/${media}/${id}/alternative_titles`);
  url.searchParams.set("api_key", cfg.tmdbApiKey);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      titles?: { title: string; iso_3166_1?: string }[];
    };
    const CN = new Set(["CN", "HK", "TW"]); // 中文地区
    const EN = new Set(["US", "GB"]); // 英文地区
    const kept: string[] = [];
    for (const t of data.titles || []) {
      const title = t.title?.trim();
      if (!title) continue;
      const iso = t.iso_3166_1;
      // 保留：中文地区、英文地区、或原产地区（与 origin_country 一致）
      const isCn = iso && CN.has(iso);
      const isEn = iso && EN.has(iso);
      const isOrigin = iso && originCountry && iso === originCountry;
      if (isCn || isEn || isOrigin) kept.push(title);
    }
    // 去重后用 / 分隔
    return kept.length ? Array.from(new Set(kept)).join(" / ") : null;
  } catch {
    return null;
  }
}

// 外部 ID 接口（IMDb 等）：movie/tv 均为 /{media}/{id}/external_ids
// 主详情接口 movie 直接带 imdb_id，但 tv 不带，需单独请求此接口补全。
async function tmdbExternalIds(
  media: "movie" | "tv",
  id: number
): Promise<string | null> {
  const url = new URL(`${cfg.tmdbBaseUrl}/${media}/${id}/external_ids`);
  url.searchParams.set("api_key", cfg.tmdbApiKey);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as { imdb_id?: string | null };
    return data.imdb_id || null;
  } catch {
    return null;
  }
}

// 关键词接口（TMDb Keywords）：movie/tv 均为 /{media}/{id}/keywords
// 返回影片主题关键词（英文，如 "based on novel"、"revenge"），用于填充 records.tags
async function tmdbKeywords(
  media: "movie" | "tv",
  id: number
): Promise<string | null> {
  const url = new URL(`${cfg.tmdbBaseUrl}/${media}/${id}/keywords`);
  url.searchParams.set("api_key", cfg.tmdbApiKey);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as {
      keywords?: { name: string }[]; // movie
      results?: { name: string }[]; // tv
    };
    const list = (data.keywords || data.results || [])
      .map((k) => k.name?.trim())
      .filter((n): n is string => !!n && n.length > 0);
    return list.length ? Array.from(new Set(list)).join(" / ") : null;
  } catch {
    return null;
  }
}

async function tmdbDetails(
  media: "movie" | "tv",
  id: number
): Promise<TmdbDetails | null> {
  const url = new URL(`${cfg.tmdbBaseUrl}/${media}/${id}`);
  url.searchParams.set("api_key", cfg.tmdbApiKey);
  url.searchParams.set("language", "zh-CN");
  url.searchParams.set("append_to_response", "credits");
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return (await res.json()) as TmdbDetails;
}

async function fillFromTmdb(row: Row): Promise<boolean> {
  if (!cfg.enableTmdb || !cfg.tmdbApiKey || cfg.tmdbApiKey.startsWith("YOUR_")) {
    return false;
  }
  await sleep(cfg.tmdbDelayMs);
  let hit: TmdbSearchResult | null = null;
  try {
    hit = await tmdbSearch(row.media_type, row.title, row.year);
  } catch (e) {
    // 网络/接口异常：视为无法补全，进入 unresolved
    console.warn(`  TMDb 查询失败「${row.title}」：${(e as Error).message}`);
    return false;
  }
  if (!hit) return false;
  row.tmdb_id = hit.id;
  row.poster_path = hit.poster_path;
  row.tmdb_rating = hit.vote_average ? Number(hit.vote_average.toFixed(1)) : null;
  // 搜索阶段先取 original_title（有值即保留，不比对豆瓣 title）
  row.original_title = hit.original_title || null;
  // details for the rest
  await sleep(cfg.tmdbDelayMs);
  let d: TmdbDetails | null = null;
  try {
    d = await tmdbDetails(row.media_type, hit.id);
  } catch {
    d = null;
  }
  if (d) {
    row.poster_path = d.poster_path ?? row.poster_path;
    row.tmdb_rating =
      d.vote_average ? Number(d.vote_average.toFixed(1)) : row.tmdb_rating;
    // 一律保留 TMDb 原始标题（不为空即写入，不跟豆瓣 title 比对）
    // 注意：tv 详情接口字段名为 original_name，movie 为 original_title
    row.original_title = d.original_title || (d as any).original_name || null;
    row.language = d.original_language || null;
    row.overview = d.overview || null;
    row.release_date = d.release_date || row.release_date;
    // runtime：movie 直接用 runtime；tv 的 runtime 多为 null，取单集时长 episode_run_time[0]
    if (row.media_type === "tv") {
      row.runtime = d.runtime ?? (d.episode_run_time && d.episode_run_time.length ? d.episode_run_time[0] : null);
    } else {
      row.runtime = d.runtime ?? null;
    }
    row.country = d.origin_country && d.origin_country.length ? d.origin_country.join(" / ") : null;
    // imdb_id：movie 主详情自带；tv 主详情不带，需 external_ids 接口补全
    let imdbId = d.imdb_id || null;
    if (!imdbId && row.media_type === "tv") {
      await sleep(cfg.tmdbDelayMs);
      imdbId = await tmdbExternalIds(row.media_type, hit.id);
    }
    row.imdb_id = imdbId;
    // writer from credits (movie: Writing; tv: created_by)
    let writer = "";
    if (d.credits?.crew) {
      writer = d.credits.crew
        .filter((c) => c.department === "Writing")
        .map((c) => c.name)
        .join(" / ");
    }
    if (!writer && d.created_by && d.created_by.length) {
      writer = d.created_by.map((c) => c.name).join(" / ");
    }
    row.writer = writer || null;
    // 又名（别名）：额外请求 alternative_titles 接口（保留中文/英文/原产地区）
    await sleep(cfg.tmdbDelayMs);
    const originCountry = d.origin_country && d.origin_country.length ? d.origin_country[0] : null;
    const aka = await tmdbAlternativeTitles(row.media_type, hit.id, originCountry);
    if (aka) row.aka = aka;
    // TMDb Keywords → 合并进 records.tags（与豆瓣 genres 合并，去重）
    await sleep(cfg.tmdbDelayMs);
    const keywords = await tmdbKeywords(row.media_type, hit.id);
    if (keywords) {
      const base = (row.tags || "").split(" / ").map((t) => t.trim()).filter(Boolean);
      const extra = keywords.split(" / ").map((t) => t.trim()).filter(Boolean);
      const merged = Array.from(new Set([...base, ...extra]));
      row.tags = merged.join(" / ");
    }
  }
  // 视为成功：至少拿到了 tmdb_id
  return row.tmdb_id !== null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// 豆瓣影片页抓取（兜底补全 TMDb 未覆盖字段）
// ---------------------------------------------------------------------------
async function fetchSubject(itemId: string): Promise<string> {
  const url = `https://movie.douban.com/subject/${itemId}`;
  const headers: Record<string, string> = {
    "User-Agent": UA,
    "Accept-Language": "zh-CN,zh;q=0.9",
  };
  if (cfg.doubanCookie && cfg.doubanCookie.trim()) {
    headers["Cookie"] = cfg.doubanCookie.trim();
  }
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${itemId}`);
  return await res.text();
}

// 国家/地区中文名 → ISO 3166-1 alpha-2；未命中返回原值
const COUNTRY_MAP: Record<string, string> = {
  美国: "US", 中国大陆: "CN", 中国: "CN", 中国香港: "HK", 香港: "HK",
  中国台湾: "TW", 台湾: "TW", 日本: "JP", 韩国: "KR", 朝鲜: "KP",
  英国: "GB", 法国: "FR", 德国: "DE", 意大利: "IT", 西班牙: "ES",
  印度: "IN", 泰国: "TH", 俄罗斯: "RU", 加拿大: "CA", 澳大利亚: "AU",
  巴西: "BR", 墨西哥: "MX", 瑞典: "SE", 丹麦: "DK", 挪威: "NO",
  芬兰: "FI", 荷兰: "NL", 比利时: "BE", 瑞士: "CH", 奥地利: "AT",
  波兰: "PL", 捷克: "CZ", 匈牙利: "HU", 希腊: "GR", 葡萄牙: "PT",
  爱尔兰: "IE", 新西兰: "NZ", 土耳其: "TR", 伊朗: "IR", 以色列: "IL",
  埃及: "EG", 南非: "ZA", 阿根廷: "AR", 智利: "CL", 哥伦比亚: "CO",
  越南: "VN", 新加坡: "SG", 马来西亚: "MY", 印度尼西亚: "ID", 菲律宾: "PH",
  巴基斯坦: "PK", 孟加拉国: "BD", 乌克兰: "UA", 罗马尼亚: "RO",
  保加利亚: "BG", 克罗地亚: "HR", 塞尔维亚: "RS", 捷克斯洛伐克: "CZ",
  苏联: "RU", 西德: "DE", 东德: "DE", 前南斯拉夫: "YU",
};

// 语言中文名 → ISO 639-1；未命中返回原值
const LANGUAGE_MAP: Record<string, string> = {
  汉语普通话: "zh", 普通话: "zh", 汉语: "zh", 中文: "zh", 国语: "zh",
  英语: "en", 粤语: "yue", 日语: "ja", 韩语: "ko", 朝鲜语: "ko",
  法语: "fr", 德语: "de", 意大利语: "it", 西班牙语: "es", 葡萄牙语: "pt",
  俄语: "ru", 泰语: "th", 印地语: "hi", 阿拉伯语: "ar", 土耳其语: "tr",
  荷兰语: "nl", 波兰语: "pl", 希腊语: "el", 瑞典语: "sv", 丹麦语: "da",
  挪威语: "no", 芬兰语: "fi", 捷克语: "cs", 匈牙利语: "hu", 希伯来语: "he",
  越南语: "vi", 泰米尔语: "ta", 波斯语: "fa", 乌克兰语: "uk", 罗马尼亚语: "ro",
  印尼语: "id", 马来语: "ms", 菲律宾语: "fil", 冰岛语: "is",
  保加利亚语: "bg", 塞尔维亚语: "sr", 克罗地亚语: "hr", 斯洛文尼亚语: "sl",
  世界语: "eo", 拉丁语: "la",
};

// 从豆瓣影片页 HTML 解析导演/主演/类型/上映日期/编剧/国家/语言/片长/又名/简介/IMDb
function parseSubjectPage(html: string): Partial<Row> {
  const out: Partial<Row> = {};
  const info = html.match(/<div id="info"[^>]*>([\s\S]*?)<\/div>/);
  const infoHtml = info ? info[1] : "";

  const grab = (label: string): string => {
    const re = new RegExp(`<span[^>]*>${label}<\\/span>([\\s\\S]*?)(?:<br\\/?>|<\\/div>|<\\/span>)`, "i");
    const m = infoHtml.match(re);
    if (!m) return "";
    // 去掉标签、清除前缀冒号（豆瓣结构 "导演</span>: 文牧野"），压缩空白，
    // 并去除尾部的 "更多..." 与多余的分隔斜杠 " /"
    return m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/^[:：\s]+/, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s*更多\.{3}$/u, "")
      .replace(/\/+\s*$/, "");
  };

  const director = grab("导演");
  if (director) out.director = director.replace(/\s*更多\.{3}$/u, "").trim();

  const cast = grab("主演");
  if (cast) out.cast = cast.replace(/\s*更多\.{3}$/u, "").trim();

  const genres = grab("类型");
  if (genres) out.genres = genres.replace(/\s*\/+\s*$/u, "").trim();

  const release = grab("上映日期");
  if (release) {
    // 形如 "2026-08-11(中国大陆)" -> 取首个日期
    const dm = release.match(/(\d{4}-\d{2}-\d{2})/);
    if (dm) out.release_date = dm[1];
  }

  const writer = grab("编剧");
  if (writer) out.writer = writer.replace(/\s*更多\.{3}$/u, "").trim();

  const country = grab("制片国家/地区");
  if (country) out.country = country.trim();

  const language = grab("语言");
  if (language) out.language = language.trim();

  const runtime = grab("片长");
  if (runtime) {
    const rm = runtime.match(/(\d+)/);
    if (rm) out.runtime = parseInt(rm[1], 10);
  }

  const aka = grab("又名");
  if (aka) out.aka = aka.replace(/\s*更多\.{3}$/u, "").trim();

  const imdb = html.match(/imdb\.com\/title\/(tt\d{7,})/i) || html.match(/(tt\d{7,})/);
  if (imdb) out.imdb_id = imdb[1];

  const ov = html.match(/<span[^>]*property="v:summary"[^>]*>([\s\S]*?)<\/span>/i)
    || html.match(/<span class="all hidden">([\s\S]*?)<\/span>/i);
  if (ov) {
    const txt = ov[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (txt) out.overview = txt;
  }

  return out;
}

// 用豆瓣页面解析结果兜底 Row 中为空（TMDb 未覆盖）的字段
async function fillFromDoubanPage(row: Row): Promise<void> {
  if (!ENABLE_DOUBAN_SCRAPE) return;
  try {
    const html = await fetchSubject(row.item_id);
    const parsed = parseSubjectPage(html);
    for (const k of Object.keys(parsed) as (keyof Row)[]) {
      const v = parsed[k];
      const cur = row[k];
      if ((v === undefined || v === null || v === "") && (cur === undefined || cur === null || cur === "")) {
        // 两者皆空，跳过
      } else if (cur === undefined || cur === null || cur === "") {
        (row as any)[k] = v;
      }
    }
    await sleep(SCRAPE_DELAY);
  } catch (e: any) {
    console.warn(`  [douban] 抓取 ${row.item_id} 失败: ${e?.message || e}`);
  }
}

// ---------------------------------------------------------------------------
// 解析
// ---------------------------------------------------------------------------
function buildRow(entry: DoubanEntry, status: "plan" | "watched"): Row {
  const s = entry.subject;
  const media = mediaOf(s);
  const year = parseYear(s.year);
  const genres = (s.genres || []).join(" / ");
  const userRating =
    entry.rating && entry.rating.value
      ? Math.min(10, Math.max(1, Math.round(entry.rating.value * 2)))
      : null;
  // watched_at：watched 状态取豆瓣根级 create_time（用户标记时间），
  // plan 状态为 null。上映日期保留在 release_date 字段。
  const watchedAt = status === "watched" ? splitDate(entry.create_time) : null;

  return {
    item_id: String(s.id),
    media_type: media,
    title: s.title,
    original_title: s.original_title || null,
    year,
    poster_path: null,
    overview: null,
    director: join(s.directors),
    writer: null,
    cast: join(s.actors),
    genres,
    country: null,
    language: null,
    release_date:
      splitDate(s.pubdate?.[0] || undefined) || (s.release_date ?? null),
    runtime: null,
    aka: null,
    imdb_id: null,
    douban_id: String(s.id),
    tmdb_id: null,
    douban_rating: s.rating?.value ?? null,
    tmdb_rating: null,
    status,
    rating: userRating,
    tags: genres || "",
    watched_at: watchedAt,
  };
}

// ---------------------------------------------------------------------------
// SQL 拼接
// ---------------------------------------------------------------------------
// 数据库层（node:sqlite，直接读写 .db 生产库）
// ---------------------------------------------------------------------------
const ITEM_COLS = [
  "item_id", "media_type", "title", "original_title", "year", "poster_path",
  "overview", "director", "writer", "cast", "genres", "country", "language",
  "release_date", "runtime", "aka", "imdb_id", "douban_id", "tmdb_id",
  "douban_rating", "tmdb_rating", "updated_at",
];
const RECORD_COLS = ["user_id", "item_id", "status", "rating", "tags", "watched_at", "created_at"];

const USER_ID = 1;

let db: Client | null = null;

// 测试用：注入已打开的 client（指向测试库），避免 openDb 重新打开生产库
export function __setDb(c: Client): void {
  db = c;
}
export function __getDb(): Client | null {
  return db;
}

async function openDb(): Promise<void> {
  if (db) return; // 已被测试注入
  db = createClient({ url: `file:${DB_PATH}` });
  // 校验表结构存在
  const t1 = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='imovie_items'"
  );
  const t2 = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='imovie_records'"
  );
  if (t1.rows.length === 0 || t2.rows.length === 0) {
    throw new Error("目标库中缺少 imovie_items / imovie_records 表，请确认 dbPath 正确");
  }
}

// 读取库内已存在的 item_id 集合（用于区分新增/已存在）
async function existingItemIds(): Promise<Set<string>> {
  const res = await db!.execute("SELECT item_id FROM imovie_items");
  return new Set(
    (res.rows as unknown as { item_id: string }[]).map((x) => x.item_id.toString())
  );
}

// 判断字段“有值”的辅助：null / undefined / 空串 视为无值
function hasVal(v: unknown): boolean {
  return !(v === null || v === undefined || v === "");
}

// libSQL 命名参数传参辅助：把 { key: val } 转成 { "@key": val }
function named(args: Record<string, unknown>): Record<string, InValue> {
  const out: Record<string, InValue> = {};
  for (const k of Object.keys(args)) out[`@${k}`] = args[k] as InValue;
  return out;
}

// 对单个 Row 做 upsert：
// - 已存在：仅用 Row 中“有值”的字段覆盖，空字段保留库原值
// - 不存在：整行 INSERT
async function upsertItem(r: Row, exists: boolean): Promise<void> {
  const cleanOverview = r.overview ? r.overview.replace(/\r?\n/g, " ").trim() : r.overview;
  const params: Record<string, unknown> = {
    item_id: r.item_id,
    media_type: r.media_type,
    title: r.title,
    original_title: r.original_title,
    year: r.year,
    poster_path: r.poster_path,
    overview: cleanOverview,
    director: r.director,
    writer: r.writer,
    cast: r.cast,
    genres: r.genres,
    country: r.country,
    language: r.language,
    release_date: r.release_date,
    runtime: r.runtime,
    aka: r.aka,
    imdb_id: r.imdb_id,
    douban_id: r.douban_id,
    tmdb_id: r.tmdb_id,
    douban_rating: r.douban_rating,
    tmdb_rating: r.tmdb_rating,
  };

  if (!exists) {
    const cols = ITEM_COLS.filter((c) => c !== "updated_at");
    const placeholders = cols.map((c) => `@${c}`).join(", ");
    const colList = cols.join(", ");
    const insertParams: Record<string, unknown> = { item_id: params.item_id };
    for (const c of cols) if (c !== "item_id") insertParams[c] = params[c];
    await db!.execute({
      sql: `INSERT INTO imovie_items (${colList}, updated_at) VALUES (${placeholders}, datetime('now'))`,
      args: named(insertParams),
    });
    return;
  }

  // 已存在：仅更新有值的字段
  const setClauses: string[] = [];
  for (const c of ITEM_COLS) {
    if (c === "item_id" || c === "updated_at") continue;
    if (hasVal(params[c])) setClauses.push(`${c} = @${c}`);
  }
  if (setClauses.length === 0) return; // 没有任何可覆盖字段
  setClauses.push("updated_at = datetime('now')");
  const updateParams: Record<string, unknown> = { item_id: params.item_id };
  for (const c of ITEM_COLS) {
    if (c === "item_id" || c === "updated_at") continue;
    if (hasVal(params[c])) updateParams[c] = params[c];
  }
  await db!.execute({
    sql: `UPDATE imovie_items SET ${setClauses.join(", ")} WHERE item_id = @item_id`,
    args: named(updateParams),
  });
}

// 事务内：删除本次 item_id 集合对应的 records，再全量重插（保留其他历史记录）
async function rebuildRecords(rows: Row[]): Promise<void> {
  const ids = rows.map((r) => r.item_id).filter((v) => hasVal(v));
  if (ids.length === 0) return;

  const statements: { sql: string; args: Record<string, InValue> }[] = [];

  const placeholders = ids.map((_, i) => `@id${i}`).join(", ");
  const delArgs: Record<string, unknown> = { uid: USER_ID };
  ids.forEach((id, i) => (delArgs[`id${i}`] = id));
  statements.push({
    sql: `DELETE FROM imovie_records WHERE user_id = @uid AND item_id IN (${placeholders})`,
    args: named(delArgs),
  });

  for (const r of rows) {
    statements.push({
      sql:
        `INSERT INTO imovie_records (user_id, item_id, status, rating, tags, watched_at, created_at) ` +
        `VALUES (@user_id, @item_id, @status, @rating, @tags, @watched_at, datetime('now'))`,
      args: named({
        user_id: USER_ID,
        item_id: r.item_id,
        status: r.status,
        rating: r.rating,
        tags: r.tags,
        watched_at: r.watched_at,
      }),
    });
  }

  // batch 在单个事务中执行全部语句，任意失败自动回滚
  await db!.batch(statements, "write");
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function setupProxy(): Promise<void> {
  let proxy = cfg.proxy?.trim();
  if (!proxy) {
    // 自动探测本地常见代理端口
    const candidates = [
      "http://127.0.0.1:7890",
      "http://127.0.0.1:7891",
      "http://127.0.0.1:10809",
      "http://127.0.0.1:10808",
      "http://127.0.0.1:1087",
      "http://127.0.0.1:1080",
    ];
    for (const c of candidates) {
      try {
        // @ts-ignore undici 在 Node 24 运行时内置可用，但无类型声明
        const { ProxyAgent } = await import("undici");
        const agent = new ProxyAgent(c);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        const r = await fetch(`${cfg.tmdbBaseUrl}/movie/550?api_key=${cfg.tmdbApiKey}&language=zh-CN`, {
          // @ts-expect-error undici dispatcher
          dispatcher: agent,
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (r.ok || r.status === 401) {
          proxy = c;
          console.log(`自动探测到可用代理：${c}`);
          break;
        }
      } catch {
        // 该候选不可用（连接被拒/超时），继续下一个
      }
    }
    if (!proxy) console.warn("未发现可用代理，TMDb 补全将跳过（字段留空，进入 unresolved）");
  }
  if (proxy) {
    try {
      // @ts-ignore undici 在 Node 24 运行时内置可用，但无类型声明
      const { ProxyAgent, setGlobalDispatcher } = await import("undici");
      setGlobalDispatcher(new ProxyAgent(proxy));
      console.log(`已启用代理：${proxy}`);
    } catch (e) {
      console.warn("代理初始化失败，将直连：", (e as Error).message);
    }
  }
}

async function main() {
  await setupProxy();
  await openDb();
  console.log(`已打开目标库：${DB_PATH}`);

  const doneRaw: DoubanEntry[] = JSON.parse(fs.readFileSync(donePath, "utf-8"));
  const wishRaw: DoubanEntry[] = JSON.parse(fs.readFileSync(wishPath, "utf-8"));

  const limit = cfg.limit > 0 ? cfg.limit : Infinity;
  const done = doneRaw.slice(0, Math.min(limit, doneRaw.length));
  const wish = wishRaw.slice(0, Math.min(limit, wishRaw.length));

  // 按 item_id 去重合并：watched（已看）优先于 plan（想看），避免同一影片在两个文件重复处理
  const byId = new Map<string, Row>();
  for (const e of done) byId.set(e.subject.id.toString(), buildRow(e, "watched"));
  for (const e of wish) {
    const id = e.subject.id.toString();
    if (!byId.has(id)) byId.set(id, buildRow(e, "plan"));
  }
  const allEntries = Array.from(byId.values());

  // 区分已存在 / 新增：以库内实际 item_id 集合为准
  const existing = await existingItemIds();
  const existCount = allEntries.filter((r) => existing.has(r.item_id)).length;
  const newCount = allEntries.length - existCount;
  console.log(
    `总 ${allEntries.length} 条：库内已存在 ${existCount} 条（按非空字段覆盖更新），新增 ${newCount} 条（直接插入）`
  );

  const unresolved: { item_id: string; title: string; media_type: string }[] = [];

  let processed = 0;
  let filled = 0;
  let upsertedExist = 0;
  let insertedNew = 0;
  let sinceBatch = 0;

  for (const r of allEntries) {
    const ok = await fillFromTmdb(r);
    // TMDb 未覆盖的字段，用豆瓣影片页兜底补全
    await fillFromDoubanPage(r);

    const isExist = existing.has(r.item_id);
    await upsertItem(r, isExist);
    if (isExist) upsertedExist++;
    else insertedNew++;

    if (ok) {
      filled++;
    } else {
      // 未匹配到 TMDb：仍入库（豆瓣字段已兜底），记入 unresolved 供人工补全元数据
      unresolved.push({ item_id: r.item_id, title: r.title, media_type: r.media_type });
    }
    processed++;
    sinceBatch++;

    // 每读一条后随机休息 0~RANDOM_DELAY_MAX 毫秒，避免请求过于规律被限流
    await sleep(Math.random() * RANDOM_DELAY_MAX);

    if (sinceBatch >= BATCH_SIZE) {
      console.log(
        `已处理 ${processed}/${allEntries.length}，TMDb 成功 ${filled} 条。休息 ${Math.round(BATCH_REST_MS / 1000)} 秒…`
      );
      await sleep(BATCH_REST_MS);
      sinceBatch = 0;
    }
  }

  // imovie_records：事务内删除本次 item_id 对应记录后全量重插（保留其他历史记录）
  await rebuildRecords(allEntries);

  // 写出 unresolved（覆盖写，便于人工补全）
  fs.writeFileSync(unresolvedPath, JSON.stringify(unresolved, null, 2), "utf-8");

  console.log(`imovie_items：覆盖更新 ${upsertedExist} 条，新增插入 ${insertedNew} 条`);
  console.log(`imovie_records：已按 ${allEntries.length} 条本次 item 重建（user_id=${USER_ID}）`);
  console.log(`TMDb 补全成功 ${filled} 条，失败 ${unresolved.length} 条`);
  console.log(`unresolved（人工处理）：${unresolved.length} 条 → ${unresolvedPath}`);
}

// 导出供测试使用（仅在 NODE_ENV=test 时被 import，不会触发 main 自动运行）
export {
  openDb,
  existingItemIds,
  upsertItem,
  rebuildRecords,
  buildRow,
  fillFromTmdb,
  fillFromDoubanPage,
  parseSubjectPage,
  hasVal,
  ITEM_COLS,
  RECORD_COLS,
  USER_ID,
  cfg,
};

export type { Row, DoubanEntry };

// 仅在非测试环境自动运行
if (process.env.NODE_ENV !== "test") {
  main()
    .then(async () => {
      try { await db?.close(); } catch { /* 忽略 */ }
    })
    .catch(async (err) => {
      console.error("[douban_import] 失败：", err);
      try { await db?.close(); } catch { /* 忽略 */ }
      process.exit(1);
    });
}
