// app/report/page.tsx — 年度报告页服务端入口。 / Annual report page server entry.
import { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getServerLang } from "@/lib/i18n/serverLang";
import { getReport } from "@/lib/queries";
import ReportContent from "./ReportContent";

export const dynamic = "force-dynamic";

// 动态元数据：按语言选择标题/描述并声明 hreflang。
// Dynamic metadata: pick title/description by language and declare hreflang.
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const title = lang === "en" ? "Annual Report" : "观影报表";
  const description =
    lang === "en"
      ? "iMOVIE stats: total watched, average rating, yearly distribution and monthly drill-down."
      : "iMOVIE 观影统计：总观影数、平均评分、年度分布与按月下钻。";
  return {
    title,
    description,
    alternates: {
      canonical: "/report",
      languages: {
        zh: "/report",
        en: "/report?lang=en",
        "x-default": "/report",
      },
    },
    openGraph: {
      title: `${title} | iMOVIE`,
      description,
      type: "website",
    },
  };
}

// 报表页服务端入口：提前拉取总览与年份数据，首屏 SSR。
// Report page server entry: prefetch the overview and per-year data for first-paint SSR.
export default async function ReportPage() {
  const db = await getDb();
  const report = await getReport(db);
  return <ReportContent initialReport={report} />;
}
