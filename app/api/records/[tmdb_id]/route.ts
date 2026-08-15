import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRecord } from "@/lib/queries";

export const dynamic = "force-dynamic";

// GET /api/records/[tmdb_id] —— 详情页数据（影片元数据 + 我的记录）
export async function GET(_req: NextRequest, { params }: { params: { tmdb_id: string } }) {
  try {
    const tmdb_id = Number(params.tmdb_id);
    if (!Number.isInteger(tmdb_id)) {
      return NextResponse.json({ error: "无效 tmdb_id" }, { status: 400 });
    }
    const db = await getDb();
    const record = await getRecord(db, tmdb_id);
    if (!record) {
      return NextResponse.json({ error: "未找到该影片" }, { status: 404 });
    }
    // 详情页需要 item（影片元数据）+ record（我的记录）两个字段；
    // getRecord 返回的是 RecordRow，item 嵌套其中，这里拆开返回，避免前端读到 undefined。
    return NextResponse.json({ item: record.item, record });
  } catch {
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}
