import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReport } from "@/lib/queries";
import { apiErrorFromUnknown } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/stats —— 各年报表数据：总览三卡 + 按年份分组的年份小计（海报墙在下钻接口按需返回）。
// 报表为低频变更数据，加 60s 边缘缓存减少 DB 压力（Vercel 等支持 Cache-Control）。
export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const report = await getReport(db);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: any) {
    return apiErrorFromUnknown(e, "stats_failed", req);
  }
}
