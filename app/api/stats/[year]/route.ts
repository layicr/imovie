import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getYearReport } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/stats/[year] —— 某一年份按月份分组的观影记录（年报下钻）。
export async function GET(
  _req: Request,
  { params }: { params: { year: string } }
) {
  const year = Number(params.year);
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    return NextResponse.json({ error: "无效年份" }, { status: 400 });
  }
  try {
    const db = await getDb();
    const data = await getYearReport(db, year);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "统计失败" }, { status: 500 });
  }
}
