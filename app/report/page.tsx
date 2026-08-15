"use client";

import { useEffect, useRef, useState } from "react";
import PosterCard from "@/components/PosterCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { ReportData, YearReportData } from "@/lib/types";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 报表页：总览三卡 + 按年份小计卡片；点击年份下钻显示当年按月分组的观影记录。
export default function ReportPage() {
  const { t, lang } = useLanguage();

  // 按当前语言将 YYYY-MM 格式化为展示文案（中文：2026年1月 / 英文：Jan, 2026）
  function formatMonth(monthKey: string): string {
    const [y, m] = monthKey.split("-");
    if (lang === "en") return t("report.month", [y, MONTHS_EN[Number(m) - 1]]);
    return t("report.month", [y, String(Number(m))]);
  }
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // 下钻状态：selectedYear 为当前展开的年份，yearData 为对应数据，yearLoading 表示下钻请求中
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearData, setYearData] = useState<YearReportData | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState(false);
  const yearCache = useRef<Map<number, YearReportData>>(new Map());

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

  async function toggleYear(year: number) {
    if (selectedYear === year) {
      // 再次点击收起
      setSelectedYear(null);
      setYearData(null);
      return;
    }
    // 命中前端缓存，直接展开，避免重复请求
    const cached = yearCache.current.get(year);
    if (cached) {
      setSelectedYear(year);
      setYearData(cached);
      setYearError(false);
      return;
    }
    setSelectedYear(year);
    setYearLoading(true);
    setYearData(null);
    setYearError(false);
    try {
      const res = await fetch(`/api/stats/${year}`);
      if (!res.ok) throw new Error("request failed");
      const d = await res.json();
      yearCache.current.set(year, d);
      setYearData(d);
    } catch {
      setYearError(true);
    } finally {
      setYearLoading(false);
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

      {/* 按年小计卡片（可点击下钻） */}
      {years.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {years.map((y) => {
            const active = selectedYear === y.year;
            return (
              <button
                key={y.year}
                type="button"
                onClick={() => toggleYear(y.year)}
                className={
                  "rounded-lg border bg-panel p-4 text-center transition-colors " +
                  (active
                    ? "border-brand text-brand"
                    : "border-line hover:border-brand/60")
                }
              >
                <div className="font-display text-2xl">{y.year}</div>
                <div className="mt-1 text-xs text-subtle">
                  {t("report.yearSummary", [
                    y.count,
                    y.avg != null ? y.avg.toFixed(1) : "—",
                  ])}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-subtle">{t("report.noWatched")}</div>
      )}

      {/* 年份下钻：按月分组的观影记录 */}
      {selectedYear != null && (
        <div className="mt-8 border-t border-line pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">
              {selectedYear}
              {t("report.yearDetail")}
            </h2>
            <button
              type="button"
              onClick={() => { setSelectedYear(null); setYearData(null); }}
              className="text-xs text-subtle hover:text-white"
            >
              {t("report.collapse")}
            </button>
          </div>

          {yearLoading ? (
            <div className="py-8 text-center text-subtle">{t("report.loading")}</div>
          ) : yearError ? (
            <div className="py-8 text-center text-subtle">{t("report.failed")}</div>
          ) : yearData && yearData.months.length ? (
            <div className="space-y-6">
              {yearData.months.map((m) => (
                <div key={m.monthKey}>
                  <div className="mb-2 flex items-center gap-2 text-sm text-subtle">
                    <span className="font-medium text-white">{formatMonth(m.monthKey)}</span>
                    <span className="rounded bg-panel px-1.5 py-0.5 text-xs">
                      {t("report.monthCount", [m.count])}
                    </span>
                  </div>
                  <div className="no-scrollbar flex flex-wrap gap-3">
                    {m.items.map((rec) => (
                      <PosterCard key={rec.rec_id} rec={rec} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-subtle">{t("report.noWatched")}</div>
          )}
        </div>
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
