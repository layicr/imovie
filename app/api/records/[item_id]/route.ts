import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRecord } from "@/lib/queries";
import { apiError, apiErrorFromUnknown } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/records/[item_id] —— 详情页数据（影片元数据 + 我的记录）
export async function GET(req: NextRequest, { params }: { params: { item_id: string } }) {
  try {
    const item_id = params.item_id;
    if (!item_id) {
      return apiError("invalid_item_id", 400, undefined, req);
    }
    const db = await getDb();
    const record = await getRecord(db, item_id);
    if (!record) {
      return apiError("not_found", 404, undefined, req);
    }
    // 详情页需要 item（影片元数据）+ record（我的记录）两个字段；
    // getRecord 返回的是 RecordRow，item 嵌套其中，这里拆开返回，避免前端读到 undefined。
    return NextResponse.json({ item: record.item, record });
  } catch (e: any) {
    return apiErrorFromUnknown(e, "query_failed", req);
  }
}
