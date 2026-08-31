// app/api/stats/route.ts — 年度报告 API。 / Annual report API.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReport } from "@/lib/queries";
import { handleRouteError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/stats —— 各年报表数据：总览三卡 + 按年份分组的年份小计（海报墙在下钻接口按需返回）。
// GET /api/stats — report data: the three overview cards + per-year subtotals (poster walls come lazily from the drill-down API).
// 报表为低频变更数据，加 60s 边缘缓存减少 DB 压力（Vercel 等支持 Cache-Control）。
// Reports change infrequently, so a 60s edge cache cuts DB load (Cache-Control is honored by Vercel etc.).
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const report = await getReport(db);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: unknown) {
    return handleRouteError(e, { fallbackKey: "stats_failed", req });
  }
}
