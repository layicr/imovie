// lib/validate.ts — 外部输入校验（zod）。 / External input validation (zod).
import { z } from "zod";
import { PAGE_SIZE_MAX } from "./config";

// 所有外部输入先经 zod 校验再入库：限制长度、限定枚举，从源头降低注入与脏数据风险。
// All external input is validated by zod before touching the DB: length caps and enums cut injection and dirty data at the source.

// 列表查询参数（GET /api/records）。
// List query params (GET /api/records).
// 注意：year/page/limit 使用 z.coerce.number()，会把查询字符串（如 "12"）自动转数字；
// Note: year/page/limit use z.coerce.number(), auto-converting query strings like "12" to numbers;
// 但无法解析的字符串（如 "abc"）会触发 ZodError → 路由层返回 422。
// but unparsable strings (e.g. "abc") raise a ZodError → the route returns 422.
// 枚举字段（status/media_type/sort/order）用 z.enum 严格限定，非法值同样 422。
// Enum fields (status/media_type/sort/order) are restricted by z.enum; bad values also yield 422.
// limit 上限由 PAGE_SIZE_MAX 约束，越界即 422，避免超大分页拖垮查询。
// limit is capped by PAGE_SIZE_MAX; exceeding it returns 422, preventing huge pages from stalling queries.
export const listQuerySchema = z.object({
  status: z.enum(["plan", "watched"]).optional(),
  media_type: z.enum(["movie", "tv"]).optional(),
  year: z.coerce.number().int().optional(),
  genre: z.string().max(50).optional(),
  country: z.string().max(50).optional(),
  q: z.string().max(100).optional(),
  sort: z.enum(["release_date", "douban_rating", "tmdb_rating"]).optional(),
  order: z.enum(["desc", "asc"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).optional(),
});

// 年份路由参数（GET /api/stats/[year]）：严格 4 位纯数字 + 合理范围。
// Year route param (GET /api/stats/[year]): strictly 4 digits + a sane range.
// 正则拒绝 "2026abc" 这类会被 Number 截断的非法输入，范围避免无意义的年份。
// The regex rejects inputs like "2026abc" that Number() would silently truncate; the range avoids meaningless years.
export const yearParamSchema = z
  .string()
  .regex(/^\d{4}$/, "年份必须为 4 位纯数字")
  .pipe(z.coerce.number().int().min(1900).max(9999));
