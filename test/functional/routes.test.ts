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
