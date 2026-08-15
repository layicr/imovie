"use client";

import { useEffect, useState } from "react";
import PosterCard from "@/components/PosterCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { ReportData } from "@/lib/types";

// 各年报表：总览三卡 + 按年份海报墙 + 手写感年份小计。
export default function ReportPage() {
  const { t } = useLanguage();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/stats");
      const d = await res.json();
      setReport(d);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="py-20 text-center text-subtle">{t("report.loading")}</div>;
  if (!report) return <div className="py-20 text-center text-subtle">{t("report.failed")}</div>;

  const { overview, years } = report;

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl">{t("report.title")}</h1>

      {/* 总览三卡 */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card label={t("report.totalWatched")} value={String(overview.totalWatched)} />
        <Card
          label={t("report.avgRating")}
          value={overview.avgRating != null ? overview.avgRating.toFixed(1) : "—"}
        />
        <Card label={t("report.thisYear")} value={String(overview.thisYearWatched)} />
      </div>

      {/* 按年海报墙 */}
      {years.length ? (
        years.map((y) => (
          <section key={y.year} className="mb-10">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="font-display text-3xl text-brand">{y.year}</h2>
              <span className="text-sm text-subtle">
                {t("report.yearSummary", [
                  y.count,
                  y.avg != null ? y.avg.toFixed(1) : "—",
                ])}
              </span>
            </div>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-4">
              {y.items.map((r) => (
                <PosterCard key={r.rec_id} rec={r} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="text-subtle">{t("report.noWatched")}</div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-6 text-center">
      <div className="font-display text-5xl text-brand">{value}</div>
      <div className="mt-2 text-sm text-subtle">{label}</div>
    </div>
  );
}
