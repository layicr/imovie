// app/api/records/route.ts — 列表/筛选/搜索 API 入口。 / List/filter/search API entry.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listFacets, listRecords } from "@/lib/queries";
import { listQuerySchema } from "@/lib/validate";
import { PAGE_SIZE_DEFAULT } from "@/lib/config";
import { handleRouteError } from "@/lib/api-error";

export const dynamic = "force-dynamic"; // 依赖查询参数，禁止静态预渲染 / Depends on query params; disable static prerender.

// GET /api/records?status=&media_type=&year=&genre=&country=&q=&sort=&order=&page=&limit=
// 看板列表 / 多维筛选 / 全局搜索统一入口（参数化查询，防注入）。 / Unified list/filter/search entry (parameterized, injection-safe).
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const parsed = listQuerySchema.parse({
      status: sp.get("status") || undefined,
      media_type: sp.get("media_type") || undefined,
      year: sp.get("year") || undefined,
      genre: sp.get("genre") || undefined,
      country: sp.get("country") || undefined,
      q: sp.get("q") || undefined,
      sort: sp.get("sort") || undefined,
      order: sp.get("order") || undefined,
      page: sp.get("page") || undefined,
      limit: sp.get("limit") || undefined,
    });

    const db = await getDb();
    const { records, total } = await listRecords(db, parsed);
    const { genres, years, countries } = await listFacets(db);
    const pageSize = parsed.limit ?? PAGE_SIZE_DEFAULT;
    const page = parsed.page && parsed.page > 1 ? parsed.page : 1;
    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      genres,
      years,
      countries,
    });
  } catch (e: unknown) {
    return handleRouteError(e, { fallbackKey: "query_failed", req });
  }
}
