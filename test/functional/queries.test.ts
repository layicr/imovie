import { describe, it, expect, beforeEach } from "vitest";
import {
  listRecords,
  listFacets,
  getRecord,
  getReport,
  getYearReport,
  invalidateFacets,
  type ListFilters,
} from "@/lib/queries";
import { setupTestDb, type SeedItem, type SeedRecord } from "../fixtures/db";
import type { Client } from "@libsql/client";

// 造数据：8 部影片 + 8 条观影记录
// 设计覆盖：
//  - status: 4 watched / 3 plan（同一 item_id 只一条记录，符合 UNIQUE(user_id, item_id)）
//  - media_type: movie / tv 都有
//  - year: 2021/2022/2023/2024/2025 分布
//  - genres: 喜剧/动画/奇幻/剧情/科幻/冒险（含「/」分隔）
//  - country: 日本/美国/中国大陆（含「/」分隔）
//  - watched_at: 2022 与 2023 跨月分布，便于年份下钻
const ITEMS: SeedItem[] = [
  {
    item_id: "tt1",
    media_type: "movie",
    title: "星际穿越",
    original_title: "Interstellar",
    year: 2024,
    poster_path: "/p1.jpg",
    genres: "科幻/剧情",
    country: "美国",
    release_date: "2024-11-08",
    douban_rating: 9.4,
    tmdb_rating: 8.6,
  },
  {
    item_id: "tt2",
    media_type: "tv",
    title: "樱桃小丸子",
    original_title: "Chibi Maruko-chan",
    year: 2023,
    poster_path: "/p2.jpg",
    genres: "喜剧/动画",
    country: "日本",
    release_date: "2023-01-15",
    douban_rating: 8.8,
    tmdb_rating: 7.9,
  },
  {
    item_id: "tt3",
    media_type: "movie",
    title: "流浪地球",
    original_title: "The Wandering Earth",
    year: 2023,
    poster_path: "/p3.jpg",
    genres: "科幻/冒险",
    country: "中国大陆",
    release_date: "2023-08-30(中国大陆)",
    douban_rating: 8.3,
    tmdb_rating: 7.0,
  },
  {
    item_id: "tt4",
    media_type: "movie",
    title: "千与千寻",
    original_title: "Spirited Away",
    year: 2022,
    poster_path: "/p4.jpg",
    genres: "动画/奇幻",
    country: "日本",
    release_date: "2022-04-01",
    douban_rating: 9.4,
    tmdb_rating: 8.5,
  },
  {
    item_id: "tt5",
    media_type: "tv",
    title: "老友记",
    original_title: "Friends",
    year: 2021,
    poster_path: "/p5.jpg",
    genres: "喜剧",
    country: "美国",
    release_date: "2021-09-22",
    douban_rating: null,
    tmdb_rating: null,
  },
  {
    item_id: "tt6",
    media_type: "movie",
    title: "无评分影片",
    original_title: "No Rating",
    year: 2025,
    poster_path: null,
    genres: "剧情",
    country: "美国/日本",
    release_date: "2025-02-10",
    douban_rating: null,
    tmdb_rating: null,
  },
  {
    item_id: "tt7",
    media_type: "tv",
    title: "想看剧集",
    original_title: "Plan Show",
    year: 2024,
    poster_path: "/p7.jpg",
    genres: "喜剧",
    country: "日本",
    release_date: "2024-06-01",
    douban_rating: null,
    tmdb_rating: null,
  },
  {
    item_id: "tt8",
    media_type: "movie",
    title: "异常记录",
    original_title: "Weird Record",
    year: 2023,
    poster_path: "/p8.jpg",
    genres: "剧情",
    country: "美国",
    release_date: "2023-02-01",
    douban_rating: 8.0,
    tmdb_rating: 7.5,
  },
];

const RECORDS: SeedRecord[] = [
  { item_id: "tt1", status: "watched", rating: 9, watched_at: "2024-11-20 21:00:00", created_at: "2024-11-10 10:00:00" },
  { item_id: "tt2", status: "watched", rating: 8, watched_at: "2023-03-12 20:00:00", created_at: "2023-03-01 10:00:00" },
  { item_id: "tt3", status: "watched", rating: 7, watched_at: "2023-08-31 22:00:00", created_at: "2023-08-20 10:00:00" },
  { item_id: "tt4", status: "watched", rating: 10, watched_at: "2022-12-25 19:00:00", created_at: "2022-12-20 10:00:00" },
  { item_id: "tt5", status: "plan", rating: null, tags: "经典/喜剧", created_at: "2024-01-01 10:00:00" },
  { item_id: "tt6", status: "plan", rating: null, tags: "待补", created_at: "2025-01-01 10:00:00" },
  { item_id: "tt7", status: "plan", rating: null, tags: "重温", created_at: "2024-05-01 10:00:00" },
  // watched 但 watched_at 为 NULL：应被 getYearReport 的 IS NOT NULL 过滤排除
  { item_id: "tt8", status: "watched", rating: 6, watched_at: null, created_at: "2023-02-01 10:00:00" },
];

let db: Client;

beforeEach(async () => {
  invalidateFacets();
  db = await setupTestDb(ITEMS, RECORDS);
});

describe("listRecords - 筛选", () => {
  it("无筛选时返回全部 8 条记录", async () => {
    const { records, total } = await listRecords(db, {});
    expect(total).toBe(8);
    expect(records).toHaveLength(8);
  });

  it("按 status=watched 过滤，仅返回已看记录（含 tt8）", async () => {
    const { records, total } = await listRecords(db, { status: "watched" });
    expect(total).toBe(5); // tt1-tt4 + tt8
    expect(records.every((r) => r.status === "watched")).toBe(true);
  });

  it("按 status=plan 过滤，返回 3 条想看", async () => {
    const { records, total } = await listRecords(db, { status: "plan" });
    expect(total).toBe(3);
    expect(records.every((r) => r.status === "plan")).toBe(true);
  });

  it("按 media_type=tv 过滤，返回 3 条（tt2、tt5、tt7）", async () => {
    const { total } = await listRecords(db, { media_type: "tv" });
    expect(total).toBe(3);
  });

  it("按 year=2023 过滤，命中 tt2、tt3、tt8 三条记录", async () => {
    const { records, total } = await listRecords(db, { year: 2023 });
    expect(total).toBe(3);
    const ids = records.map((r) => r.item.item_id).sort();
    expect(ids).toEqual(["tt2", "tt3", "tt8"]);
  });

  it("按 genre=科幻 模糊匹配（含「/」分隔），命中 tt1、tt3", async () => {
    const { records, total } = await listRecords(db, { genre: "科幻" });
    expect(total).toBe(2);
    const ids = records.map((r) => r.item.item_id).sort();
    expect(ids).toEqual(["tt1", "tt3"]);
  });

  it("按 country=日本 模糊匹配（含「/」分隔），命中 tt2、tt4、tt6、tt7", async () => {
    const { total } = await listRecords(db, { country: "日本" });
    expect(total).toBe(4);
  });

  it("按 q 全文搜索匹配片名/原名/导演等，搜索『地球』命中 tt3", async () => {
    const { records, total } = await listRecords(db, { q: "地球" });
    expect(total).toBe(1);
    expect(records[0].item.item_id).toBe("tt3");
  });

  it("组合筛选：status=watched 且 year=2023 返回 3 条", async () => {
    const { total } = await listRecords(db, { status: "watched", year: 2023 });
    expect(total).toBe(3);
  });
});

describe("listRecords - 排序", () => {
  it("默认按 release_date 降序，最新在前", async () => {
    const { records } = await listRecords(db, {});
    // 取前两个 release_date 前 10 位比较
    const dates = records.map((r) => (r.item.release_date ?? "").slice(0, 10));
    const sortedDesc = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    expect(dates).toEqual(sortedDesc);
  });

  it("release_date 升序时最旧在前", async () => {
    const { records } = await listRecords(db, { order: "asc" });
    const dates = records.map((r) => (r.item.release_date ?? "").slice(0, 10));
    const sortedAsc = [...dates].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    expect(dates).toEqual(sortedAsc);
  });

  it("按 douban_rating 降序，无评分行排最后（NULLS LAST）", async () => {
    const { records } = await listRecords(db, { status: "watched", sort: "douban_rating", order: "desc" });
    const ratings = records.map((r) => r.item.douban_rating);
    // watched 中全部有 douban_rating，仍需验证降序
    expect(ratings).toEqual([...ratings].sort((a, b) => (b ?? 0) - (a ?? 0)));
  });

  it("按 tmdb_rating 升序，无评分行排最后（NULLS LAST）", async () => {
    const { records } = await listRecords(db, { sort: "tmdb_rating", order: "asc" });
    const withRating = records.filter((r) => r.item.tmdb_rating != null);
    const withoutRating = records.filter((r) => r.item.tmdb_rating == null);
    // 有评分部分按升序
    const ratedSorted = [...withRating.map((r) => r.item.tmdb_rating as number)].sort((a, b) => a - b);
    expect(withRating.map((r) => r.item.tmdb_rating)).toEqual(ratedSorted);
    // 无评分全部集中在末尾
    expect(withoutRating.length).toBeGreaterThan(0);
    expect(records.slice(records.length - withoutRating.length)).toEqual(expect.arrayContaining(withoutRating));
  });
});

describe("listRecords - 分页", () => {
  it("limit=2 且默认 page=1 返回前 2 条", async () => {
    const { records, total } = await listRecords(db, { limit: 2 });
    expect(total).toBe(8);
    expect(records).toHaveLength(2);
  });

  it("limit=2 page=2 返回偏移后的下一批且不重复", async () => {
    const p1 = await listRecords(db, { limit: 2, page: 1 });
    const p2 = await listRecords(db, { limit: 2, page: 2 });
    const ids1 = p1.records.map((r) => r.rec_id);
    const ids2 = p2.records.map((r) => r.rec_id);
    expect(ids2).toHaveLength(2);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
  });

  it("limit=0 表示不限制，返回全部 8 条", async () => {
    const { records, total } = await listRecords(db, { limit: 0 });
    expect(total).toBe(8);
    expect(records).toHaveLength(8);
  });

  it("page<1 视为 1，不报错", async () => {
    const { records } = await listRecords(db, { limit: 3, page: 0 });
    expect(records).toHaveLength(3);
  });
});

describe("listFacets - 维度去重拆分", () => {
  it("genres 按「/」「,」「、」拆分去重并排序", async () => {
    const { genres } = await listFacets(db);
    // 造数据中 genres 实际值：科幻/剧情、喜剧/动画、科幻/冒险、动画/奇幻、喜剧、剧情
    // 已看 + 想看 全部 item 都在 records 中，拆分后去重集合：
    // 科幻、剧情、喜剧、动画、奇幻、冒险
    expect(genres).toContain("科幻");
    expect(genres).toContain("剧情");
    expect(genres).toContain("喜剧");
    expect(genres).toContain("动画");
    expect(genres).toContain("奇幻");
    expect(genres).toContain("冒险");
    // 去重：『科幻』只出现一次
    expect(genres.filter((g) => g === "科幻")).toHaveLength(1);
    // 已排序（中文 localeCompare 升序）
    expect(genres).toEqual([...genres].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")));
  });

  it("countries 拆分去重，含多值『美国/日本』拆成两个 token", async () => {
    const { countries } = await listFacets(db);
    expect(countries).toContain("美国");
    expect(countries).toContain("日本");
    expect(countries).toContain("中国大陆");
  });

  it("years 去重降序且仅含被观看/记录影片的年份", async () => {
    const { years } = await listFacets(db);
    expect(years).toContain(2021);
    expect(years).toContain(2022);
    expect(years).toContain(2023);
    expect(years).toContain(2024);
    expect(years).toContain(2025);
    // 降序
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it("invalidateFacets 后重新读取得到一致结果（缓存重置）", async () => {
    const f1 = await listFacets(db);
    invalidateFacets();
    const f2 = await listFacets(db);
    expect(f2).toEqual(f1);
  });
});

describe("getRecord - 详情", () => {
  it("按 item_id 取详情，正确联表拼接 item", async () => {
    const rec = await getRecord(db, "tt1");
    expect(rec).not.toBeNull();
    expect(rec!.item.item_id).toBe("tt1");
    expect(rec!.item.title).toBe("星际穿越");
    expect(rec!.item.douban_rating).toBe(9.4);
    expect(rec!.status).toBe("watched");
    expect(rec!.rating).toBe(9);
  });

  it("不存在的 item_id 返回 null", async () => {
    const rec = await getRecord(db, "nope");
    expect(rec).toBeNull();
  });
});

describe("getReport - 年报聚合", () => {
  it("overview 统计：已看总数 5、平均评分", async () => {
    const report = await getReport(db);
    expect(report.overview.totalWatched).toBe(5); // tt1-tt4 + tt8(watched)
    // 平均评分 = (9+8+7+10+6)/5 = 8.0
    expect(report.overview.avgRating).toBeCloseTo(8.0, 5);
  });

  it("years 按 watched_at 年份分组降序，且各年 count 正确", async () => {
    const report = await getReport(db);
    // watched_at 年份分布：2024(tt1) / 2023(tt2,tt3) / 2022(tt4)
    const byYear = Object.fromEntries(report.years.map((y) => [y.year, y.count]));
    expect(byYear[2022]).toBe(1);
    expect(byYear[2023]).toBe(2);
    expect(byYear[2024]).toBe(1);
    // 降序
    const yIds = report.years.map((y) => y.year);
    expect(yIds).toEqual([...yIds].sort((a, b) => b - a));
  });

  it("年份聚合 avg 正确（2023 年 tt2=8、tt3=7 => 7.5）", async () => {
    const report = await getReport(db);
    const y2023 = report.years.find((y) => y.year === 2023);
    expect(y2023!.avg).toBeCloseTo(7.5, 5);
  });
});

describe("getYearReport - 年份下钻（按月分组）", () => {
  it("按年份取出全年 watched 记录", async () => {
    const yr = await getYearReport(db, 2023);
    expect(yr.year).toBe(2023);
    expect(yr.total).toBe(2);
  });

  it("按月分桶，monthKey 为 YYYY-MM，且月份降序", async () => {
    const yr = await getYearReport(db, 2023);
    // tt2: 2023-03-12, tt3: 2023-08-31
    const keys = yr.months.map((m) => m.monthKey).sort((a, b) => b.localeCompare(a));
    expect(keys).toEqual(["2023-08", "2023-03"]);
    const aug = yr.months.find((m) => m.monthKey === "2023-08");
    expect(aug!.count).toBe(1);
    expect(aug!.items[0].item.item_id).toBe("tt3");
  });

  it("无该年份观影记录时 total=0 且 months 为空", async () => {
    const yr = await getYearReport(db, 2099);
    expect(yr.total).toBe(0);
    expect(yr.months).toHaveLength(0);
  });

  it("仅统计 watched，plan 不计入（2023 仅 tt2、tt3 两条 watched）", async () => {
    // tt2、tt3 在 2023 均为 watched；plan 记录（tt5/tt6/tt7）不进入年份下钻
    const yr = await getYearReport(db, 2023);
    const allIds = yr.months.flatMap((m) => m.items.map((i) => i.item.item_id));
    expect(allIds).toContain("tt2");
    expect(allIds).toContain("tt3");
    expect(yr.total).toBe(2);
  });

  it("watched_at 为 NULL 的 watched 记录被排除（IS NOT NULL 守卫）", async () => {
    // tt8 是 watched 且 year=2023，但 watched_at 为 NULL，不应进入年份下钻
    const yr = await getYearReport(db, 2023);
    const allIds = yr.months.flatMap((m) => m.items.map((i) => i.item.item_id));
    expect(allIds).not.toContain("tt8");
    expect(yr.total).toBe(2); // 仍为 tt2、tt3 两条
  });
});

describe("listRecords - 排序 NULLS LAST 二级键", () => {
  it("按 douban_rating 降序时，NULL 值排在末尾而非报错", async () => {
    const { records } = await listRecords(db, { sort: "douban_rating", order: "desc" });
    const rated = records.filter((r) => r.item.douban_rating != null);
    const unrated = records.filter((r) => r.item.douban_rating == null);
    // 有评分部分降序
    const ratedSorted = [...rated.map((r) => r.item.douban_rating as number)].sort((a, b) => b - a);
    expect(rated.map((r) => r.item.douban_rating)).toEqual(ratedSorted);
    // 无评分记录全部位于数组末尾
    expect(records.slice(records.length - unrated.length).map((r) => r.rec_id))
      .toEqual(expect.arrayContaining(unrated.map((r) => r.rec_id)));
  });

  it("按 release_date 升序时，NULL release_date 排在末尾", async () => {
    const { records } = await listRecords(db, { sort: "release_date", order: "asc" });
    const withDate = records.filter((r) => r.item.release_date != null);
    const withoutDate = records.filter((r) => r.item.release_date == null);
    const dates = withDate.map((r) => r.item.release_date as string);
    const sortedAsc = [...dates].sort();
    expect(dates).toEqual(sortedAsc);
    expect(records.slice(records.length - withoutDate.length).map((r) => r.rec_id))
      .toEqual(expect.arrayContaining(withoutDate.map((r) => r.rec_id)));
  });
});
