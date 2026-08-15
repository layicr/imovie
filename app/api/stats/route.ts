import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/stats —— 各年报表数据：总览三卡 + 按年份分组的海报墙与小计。
export async function GET() {
  try {
    const db = await getDb();
    const report = await getReport(db);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "统计失败" }, { status: 500 });
  }
}
