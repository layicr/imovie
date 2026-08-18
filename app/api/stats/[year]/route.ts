import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getYearReport } from "@/lib/queries";
import { apiError, apiErrorFromUnknown } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/stats/[year] —— 某一年份按月份分组的观影记录（年报下钻）。
export async function GET(
  req: NextRequest,
  { params }: { params: { year: string } }
) {
  const raw = params.year;
  // 严格校验：必须是 4 位纯数字年份，拒绝 "2026abc" 这类会被 Number 截断的输入。
  if (!/^\d{4}$/.test(raw)) {
    return apiError("invalid_year", 400, undefined, req);
  }
  const year = Number(raw);
  if (year < 1900 || year > 9999) {
    return apiError("invalid_year", 400, undefined, req);
  }
  try {
    const db = await getDb();
    const data = await getYearReport(db, year);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: any) {
    return apiErrorFromUnknown(e, "stats_failed", req);
  }
}
