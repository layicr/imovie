import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/stats —— 各年报表数据：总览三卡 + 按年份分组的海报墙与小计。
// 报表为低频变更数据，加 60s 边缘缓存减少 DB 压力（Vercel 等支持 Cache-Control）。
export async function GET() {
  try {
    const db = await getDb();
    const report = await getReport(db);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "统计失败" }, { status: 500 });
  }
}
