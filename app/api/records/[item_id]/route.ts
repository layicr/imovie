// app/api/records/[item_id]/route.ts — 单条记录详情 API。 / Single-record detail API.
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRecord } from "@/lib/queries";
import { apiError, handleRouteError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/records/[item_id] —— 详情页数据（影片元数据 + 我的记录）
// GET /api/records/[item_id] — detail data (movie metadata + my record).
export async function GET(req: NextRequest, { params }: { params: Promise<{ item_id: string }> }) {
  try {
    const { item_id } = await params;
    if (!item_id) {
      return apiError("invalid_item_id", 400, undefined, req);
    }
    const db = await getDb();
    const record = await getRecord(db, item_id);
    if (!record) {
      return apiError("not_found", 404, undefined, req);
    }
    // 详情页需要 item（影片元数据）+ record（我的记录）两个字段；
    // The detail page needs both item (movie metadata) and record (my record);
    // getRecord 返回的是 RecordRow，item 嵌套其中，这里拆开返回，避免前端读到 undefined。
    // getRecord returns a RecordRow with item nested inside, so we split it out to avoid undefined on the client.
    return NextResponse.json({ item: record.item, record });
  } catch (e: unknown) {
    return handleRouteError(e, { fallbackKey: "query_failed", req });
  }
}
