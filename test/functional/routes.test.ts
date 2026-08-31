import { describe, it, expect, beforeAll, vi } from "vitest";
import type { Client } from "@libsql/client";
import { NextRequest } from "next/server";
import { setupTestDb, type SeedItem, type SeedRecord } from "../fixtures/db";

// 路由内部调用 getDb()（默认指向真实 local.db）。为保证隔离与确定性，
// 用 vi.mock 把 getDb 替换为返回内存 fixture 库，避免依赖 2293 条真实数据。
// 必须用闭包 + 模块级变量注入 db：vi.mock 的 factory 闭包读取 testDb，
// beforeAll 中赋值，调用时即可拿到内存 fixture 库（避免 mockResolvedValue 不生效的坑）。
let testDb: Client;
vi.mock("@/lib/db", () => ({ getDb: () => Promise.resolve(testDb) }));

import { GET as recordsGET } from "@/app/api/records/route";
import { GET as statsGET } from "@/app/api/stats/route";
import { GET as recordDetailGET } from "@/app/api/records/[item_id]/route";
import { GET as statsYearGET } from "@/app/api/stats/[year]/route";

const ITEMS: SeedItem[] = [
  {
    item_id: "i1", media_type: "movie", title: "星际穿越", original_title: "Interstellar",
    year: 2014, genres: "科幻/冒险", country: "美国", language: "英语",
    release_date: "2014-11-07", runtime: 169, douban_rating: 9.4, tmdb_rating: 8.4,
  },
  {
    item_id: "i2", media_type: "tv", title: "权力的游戏", original_title: "Game of Thrones",
    year: 2011, genres: "剧情/奇幻", country: "美国", language: "英语",
    release_date: "2011-04-17", runtime: 57, douban_rating: 9.5, tmdb_rating: 8.4,
  },
];

const RECORDS: SeedRecord[] = [
  { item_id: "i1", status: "watched", rating: 10, watched_at: "2023-05-10 20:00:00", created_at: "2023-05-10 20:00:00" },
  { item_id: "i2", status: "plan", rating: null, created_at: "2024-01-01 00:00:00" },
];

let db: Client;

beforeAll(async () => {
  db = await setupTestDb(ITEMS, RECORDS);
  testDb = db;
});

function makeReq(url: string, acceptLanguage?: string): NextRequest {
  const req = new NextRequest(new URL(url, "http://localhost"));
  if (acceptLanguage) req.headers.set("accept-language", acceptLanguage);
  return req;
}

describe("GET /api/records", () => {
  it("正常返回 records/total/page/pageSize/facets 结构", async () => {
    const res = await recordsGET(makeReq("http://localhost/api/records"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.records.length).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(60);
    expect(Array.isArray(body.genres)).toBe(true);
    expect(Array.isArray(body.years)).toBe(true);
    expect(Array.isArray(body.countries)).toBe(true);
  });

  it("参数透传：status 筛选生效", async () => {
    const res = await recordsGET(makeReq("http://localhost/api/records?status=plan"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.records[0].item.item_id).toBe("i2");
  });

  it("非法参数 → 422（ZodError）", async () => {
    const res = await recordsGET(makeReq("http://localhost/api/records?limit=99999"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("参数校验失败");
  });

  it("非法枚举 status → 422", async () => {
    const res = await recordsGET(makeReq("http://localhost/api/records?status=doing"));
    expect(res.status).toBe(422);
  });

  it("数据库异常 → 500（内部错误统一格式，生产环境脱敏）", async () => {
    const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("db down"));
    const res = await recordsGET(makeReq("http://localhost/api/records"));
    expect(res.status).toBe(500);
    const body = await res.json();
    // 生产环境下 5xx 统一脱敏为 internal_error，不暴露原始错误
    expect(body.error).toBe("服务器内部错误");
    spy.mockRestore();
  });
});

describe("GET /api/stats", () => {
  it("正常返回 ReportData（overview + years）", async () => {
    const res = await statsGET(makeReq("http://localhost/api/stats"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview.totalWatched).toBe(1);
    expect(Array.isArray(body.years)).toBe(true);
    // 带边缘缓存头
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("数据库异常 → 500（内部错误统一格式，生产环境脱敏）", async () => {
    const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("db down"));
    const res = await statsGET(makeReq("http://localhost/api/stats"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
    spy.mockRestore();
  });
});

describe("GET /api/records/[item_id]", () => {
  it("命中返回 { item, record }", async () => {
    const res = await recordDetailGET(makeReq("http://localhost/api/records/i1"), { params: { item_id: "i1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.item_id).toBe("i1");
    expect(body.record.rating).toBe(10);
  });

  it("未命中 → 404", async () => {
    const res = await recordDetailGET(makeReq("http://localhost/api/records/nope"), { params: { item_id: "nope" } });
    expect(res.status).toBe(404);
  });

  it("缺 item_id → 400", async () => {
    const res = await recordDetailGET(makeReq("http://localhost/api/records/"), { params: { item_id: "" } });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/stats/[year]", () => {
  it("合法年份返回按月分组数据", async () => {
    const res = await statsYearGET(makeReq("http://localhost/api/stats/2023"), { params: { year: "2023" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2023);
    expect(body.total).toBe(1);
    expect(Array.isArray(body.months)).toBe(true);
  });

  it("非法年份 → 400", async () => {
    const res = await statsYearGET(makeReq("http://localhost/api/stats/abcd"), { params: { year: "abcd" } });
    expect(res.status).toBe(400);
  });

  // 最新实现：年份必须严格为 4 位纯数字 (/^\d{4}$/)，以下输入旧 Number() 校验可能放行，
  // 但新正则全部拒绝 → 400。
  it.each([
    ["202", "3 位"],
    ["20261", "5 位"],
    ["20.5", "含小数点"],
    [" 2024", "含前导空格"],
    ["+2024", "含符号"],
    ["2026abc", "被截断的非法输入"],
  ])("非法年份 %s (%s) → 400", async (year) => {
    const res = await statsYearGET(makeReq(`http://localhost/api/stats/${year}`), { params: { year } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("合法 4 位数字年份（含前导 0 的 2024）通过正则", async () => {
    const res = await statsYearGET(makeReq("http://localhost/api/stats/2024"), { params: { year: "2024" } });
    // 2024 在 fixture 中无 watched 记录，total 为 0，但状态应通过校验返回 200
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2024);
  });

  // 错误文案国际化：Accept-Language 决定返回中文或英文。
  it("中文 Accept-Language 返回中文错误文案", async () => {
    const res = await statsYearGET(
      makeReq("http://localhost/api/stats/abcd", "zh-CN"),
      { params: { year: "abcd" } }
    );
    const body = await res.json();
    expect(body.error).toBe("无效年份");
  });

  it("英文 Accept-Language 返回英文错误文案", async () => {
    const res = await statsYearGET(
      makeReq("http://localhost/api/stats/abcd", "en-US"),
      { params: { year: "abcd" } }
    );
    const body = await res.json();
    expect(body.error).toBe("Invalid year");
  });
});

describe("GET /api/records - 参数透传与响应结构", () => {
  it("排序参数透传：?sort=douban_rating&order=desc 返回降序", async () => {
    const res = await recordsGET(
      makeReq("http://localhost/api/records?sort=douban_rating&order=desc")
    );
    const body = await res.json();
    const ratings = body.records.map(
      (r: { item: { douban_rating: number } }) => r.item.douban_rating
    );
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  it("分页参数透传：?limit=1&page=2 返回第二页且不与第一页重复", async () => {
    const p1 = await recordsGET(makeReq("http://localhost/api/records?limit=1&page=1"));
    const p2 = await recordsGET(makeReq("http://localhost/api/records?limit=1&page=2"));
    const b1 = await p1.json();
    const b2 = await p2.json();
    expect(b1.pageSize).toBe(1);
    expect(b2.pageSize).toBe(1);
    expect(b2.records).toHaveLength(1);
    const id1 = b1.records[0].item.item_id;
    const id2 = b2.records[0].item.item_id;
    expect(id2).not.toBe(id1);
  });

  it("响应结构：每条记录含完整 item 字段，facets 维度含造数据值", async () => {
    const res = await recordsGET(makeReq("http://localhost/api/records"));
    const body = await res.json();
    for (const rec of body.records) {
      expect(rec.item).toBeDefined();
      expect(typeof rec.item.title).toBe("string");
      expect("poster_path" in rec.item).toBe(true);
      expect("douban_rating" in rec.item).toBe(true);
    }
    // facets 维度按「/」拆分后的独立 token
    expect(body.genres).toContain("科幻");
    expect(body.countries).toContain("美国");
  });
});

describe("GET /api/stats - 响应结构", () => {
  it("overview 含 totalWatched 与 avgRating，years 元素含 year/count", async () => {
    const res = await statsGET(makeReq("http://localhost/api/stats"));
    const body = await res.json();
    expect(body.overview).toHaveProperty("totalWatched");
    expect(body.overview).toHaveProperty("avgRating");
    expect(Array.isArray(body.years)).toBe(true);
    if (body.years.length > 0) {
      expect(body.years[0]).toHaveProperty("year");
      expect(body.years[0]).toHaveProperty("count");
    }
  });
});
