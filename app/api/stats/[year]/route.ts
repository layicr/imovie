// app/api/stats/[year]/route.ts — 年份下钻 API。 / Year drill-down API.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getYearReport } from "@/lib/queries";
import { apiError, handleRouteError } from "@/lib/api-error";
import { yearParamSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/stats/[year] —— 某一年份按月份分组的观影记录（年报下钻）。
// GET /api/stats/[year] — a given year's records grouped by month (annual-report drill-down).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year: yearStr } = await params;
  const parsed = yearParamSchema.safeParse(yearStr);
  if (!parsed.success) {
    return apiError("invalid_year", 400, undefined, req);
  }
  const year = parsed.data;
  try {
    const db = await getDb();
    const data = await getYearReport(db, year);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e: unknown) {
    return handleRouteError(e, { fallbackKey: "stats_failed", req });
  }
}
