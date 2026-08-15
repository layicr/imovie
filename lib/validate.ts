import { z } from "zod";
import { PAGE_SIZE_MAX } from "./config";

// 所有外部输入先经 zod 校验再入库：限制长度、限定枚举，从源头降低注入与脏数据风险。

// 列表查询参数（GET /api/records）
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
