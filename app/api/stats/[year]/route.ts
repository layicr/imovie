import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getYearReport } from "@/lib/queries";
import { apiError, apiErrorFromUnknown } from "@/lib/api-error";
import { yearParamSchema } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/stats/[year] —— 某一年份按月份分组的观影记录（年报下钻）。
export async function GET(
  req: NextRequest,
  { params }: { params: { year: string } }
) {
  const parsed = yearParamSchema.safeParse(params.year);
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
  } catch (e: any) {
    return apiErrorFromUnknown(e, "stats_failed", req);
  }
}
