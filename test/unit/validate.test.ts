import { describe, it, expect } from "vitest";
import { listQuerySchema } from "@/lib/validate";
import { PAGE_SIZE_MAX } from "@/lib/config";

describe("listQuerySchema", () => {
  it("无输入时所有字段均为 undefined（无默认值）", () => {
    const r = listQuerySchema.parse({});
    expect(r.limit).toBeUndefined();
    expect(r.page).toBeUndefined();
    expect(r.status).toBeUndefined();
    expect(r.sort).toBeUndefined();
    expect(r.order).toBeUndefined();
    expect(r.q).toBeUndefined();
    expect(r.genre).toBeUndefined();
    expect(r.country).toBeUndefined();
    expect((r as Record<string, unknown>).language).toBeUndefined();
    expect(r.year).toBeUndefined();
    expect(r.media_type).toBeUndefined();
  });

  it("coerce：字符串数字 '12' 解析为 number", () => {
    const r = listQuerySchema.parse({ limit: "12", page: "3" });
    expect(r.limit).toBe(12);
    expect(r.page).toBe(3);
  });

  it("coerce 失败：'abc' 不能转 number → 抛错", () => {
    expect(() => listQuerySchema.parse({ limit: "abc" })).toThrow();
    expect(() => listQuerySchema.parse({ page: "abc" })).toThrow();
  });

  it("limit 超过 PAGE_SIZE_MAX → 抛错", () => {
    expect(() => listQuerySchema.parse({ limit: PAGE_SIZE_MAX + 1 })).toThrow();
    // 边界值应合法
    expect(listQuerySchema.parse({ limit: PAGE_SIZE_MAX }).limit).toBe(PAGE_SIZE_MAX);
  });

  it("limit 低于 1 → 抛错", () => {
    expect(() => listQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => listQuerySchema.parse({ limit: -5 })).toThrow();
  });

  it("page 低于 1 → 抛错", () => {
    expect(() => listQuerySchema.parse({ page: 0 })).toThrow();
    expect(() => listQuerySchema.parse({ page: -1 })).toThrow();
  });

  it("status 非法枚举 → 抛错", () => {
    expect(() => listQuerySchema.parse({ status: "doing" })).toThrow();
    // 合法值
    expect(listQuerySchema.parse({ status: "plan" }).status).toBe("plan");
    expect(listQuerySchema.parse({ status: "watched" }).status).toBe("watched");
  });

  it("media_type 非法枚举 → 抛错", () => {
    expect(() => listQuerySchema.parse({ media_type: "game" })).toThrow();
    expect(listQuerySchema.parse({ media_type: "movie" }).media_type).toBe("movie");
    expect(listQuerySchema.parse({ media_type: "tv" }).media_type).toBe("tv");
  });

  it("sort 合法枚举仅 release_date/douban_rating/tmdb_rating", () => {
    expect(listQuerySchema.parse({ sort: "release_date" }).sort).toBe("release_date");
    expect(listQuerySchema.parse({ sort: "douban_rating" }).sort).toBe("douban_rating");
    expect(listQuerySchema.parse({ sort: "tmdb_rating" }).sort).toBe("tmdb_rating");
    // 此前误以为有 year/rating/created/title，实际不支持
    expect(() => listQuerySchema.parse({ sort: "year" })).toThrow();
    expect(() => listQuerySchema.parse({ sort: "rating" })).toThrow();
  });

  it("order 非法枚举 → 抛错", () => {
    expect(() => listQuerySchema.parse({ order: "sideways" })).toThrow();
    expect(listQuerySchema.parse({ order: "asc" }).order).toBe("asc");
    expect(listQuerySchema.parse({ order: "desc" }).order).toBe("desc");
  });

  it("q / genre / country / year / media_type 透传（language 非查询字段）", () => {
    const r = listQuerySchema.parse({
      q: "星际",
      genre: "科幻",
      country: "美国",
      year: 2024,
      media_type: "movie",
    });
    expect(r.q).toBe("星际");
    expect(r.genre).toBe("科幻");
    expect(r.country).toBe("美国");
    expect(r.year).toBe(2024);
    expect(r.media_type).toBe("movie");
    // language 不是 listQuerySchema 的字段，应被 strip 掉
    expect((r as Record<string, unknown>).language).toBeUndefined();
  });

  it("q 超长（>100） → 抛错", () => {
    expect(() => listQuerySchema.parse({ q: "x".repeat(101) })).toThrow();
  });

  it("空字符串 q 保持为空串（不转为 undefined）", () => {
    const r = listQuerySchema.parse({ q: "" });
    expect(r.q).toBe("");
  });
});
