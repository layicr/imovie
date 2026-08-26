import { Metadata } from "next";
import { getDb } from "@/lib/db";
import { listRecords } from "@/lib/queries";
import { HOME_PLAN_LIMIT, HOME_WATCHED_LIMIT } from "@/lib/config";
import HomeContent from "./HomeContent";

export const dynamic = "force-dynamic";

// 首页服务端渲染：直接从本地 DB 拉取想看/已看两行数据，首屏即含完整 HTML。
export default async function HomePage() {
  const db = await getDb();
  const [planResult, watchedResult] = await Promise.all([
    listRecords(db, { status: "plan", limit: HOME_PLAN_LIMIT }),
    listRecords(db, { status: "watched", limit: HOME_WATCHED_LIMIT }),
  ]);

  return <HomeContent plan={planResult.records} watched={watchedResult.records} />;
}
