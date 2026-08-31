// app/report/page.tsx — 年度报告页服务端入口。 / Annual report page server entry.
import { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getReport } from "@/lib/queries";
import ReportContent from "./ReportContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "观影报表",
  description: "iMOVIE 观影统计：总观影数、平均评分、年度分布与按月下钻。",
  alternates: {
    canonical: "/report",
  },
  openGraph: {
    title: "观影报表 | iMOVIE",
    description: "iMOVIE 观影统计：总观影数、平均评分、年度分布。",
    type: "website",
  },
};

// 报表页服务端入口：提前拉取总览与年份数据，首屏 SSR。
// Report page server entry: prefetch the overview and per-year data for first-paint SSR.
export default async function ReportPage() {
  const db = await getDb();
  const report = await getReport(db);
  return <ReportContent initialReport={report} />;
}
