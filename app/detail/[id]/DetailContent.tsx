"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import Image from "next/image";
import { posterUrl, backdropUrl } from "@/lib/poster";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { COUNTRY_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/config";
import type { Item, RecordRow, Status } from "@/lib/types";

// 制片国家/地区标签：库里以 2 位国家代码（COUNTRY_OPTIONS.value）存储，
// 显示时按当前语言映射到 zh/en 名称；未收录则原样显示代码。
function countryDisplay(value: string, lang: "zh" | "en"): string {
  const opt = COUNTRY_OPTIONS.find((c) => c.value === value);
  if (opt) return lang === "en" ? opt.en : opt.zh;
  return value;
}

// 语言标签：库里以 ISO 639-1 两位小写代码（LANGUAGE_OPTIONS.value）存储，
// 显示时按当前语言映射到 zh/en 名称；未收录则原样显示代码。
function languageDisplay(value: string, lang: "zh" | "en"): string {
  const opt = LANGUAGE_OPTIONS.find((l) => l.value === value);
  if (opt) return lang === "en" ? opt.en : opt.zh;
  return value;
}

// 详情页元数据里需要「拆分成多项并各自链接到搜索页」的字段（导演/编剧/主演/类型/制片国家地区）。
const LINK_FIELDS = new Set([
  "detail.director",
  "detail.writer",
  "detail.cast",
  "detail.genre",
  "detail.country",
]);

// 按常见分隔符拆分元数据（支持「 / 」「,」「，」「/」「、」）。
function splitMeta(value: string): string[] {
  return value
    .split(/\s*\/\s*|,|，|\/|、/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 将 0–10 分映射为 5 颗星（每颗星 2 分），支持半星。
function StarRating({ score }: { score: number }) {
  const uid = useId();
  const stars = useMemo(() => {
    const value = Math.max(0, Math.min(10, score)) / 2; // 0–5
    return Array.from({ length: 5 }, (_, i) => {
      const fill = Math.max(0, Math.min(1, value - i));
      return { fill };
    });
  }, [score]);

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`评分 ${score}`}>
      {stars.map((s, i) => {
        const gid = `star-fill-${uid}-${i}`;
        return (
          <svg
            key={i}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            className="shrink-0"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gid}>
                <stop offset={`${s.fill * 100}%`} stopColor="#f59e0b" />
                <stop offset={`${s.fill * 100}%`} stopColor="#3f3f46" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${gid})`}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        );
      })}
    </span>
  );
}

// 详情页交互内容（Client Component）：接收服务端已取好的 RecordRow，保留状态/评分等交互。
export default function DetailContent({
  record,
}: {
  record: RecordRow;
}) {
  const { t, lang } = useLanguage();
  const item = record.item;
  const [status, setStatus] = useState<Status>(record.status || "plan");
  const [rating, setRating] = useState<number>(record.rating || 8);

  // 状态行的日期：已看取 watched_at，想看取创建时间 created_at。
  const statusDate =
    (status === "watched" ? record?.watched_at : record?.created_at)?.slice(0, 10) ?? "";

  // 严格按规范的元数据排版顺序渲染（标签随语言切换）
  const meta: { labelKey: string; value?: string | null; display?: string }[] = [
    { labelKey: "detail.director", value: item.director },
    { labelKey: "detail.writer", value: item.writer },
    { labelKey: "detail.cast", value: item.cast },
    { labelKey: "detail.genre", value: item.genres },
    { labelKey: "detail.country", value: item.country },
    { labelKey: "detail.language", value: item.language, display: item.language ? languageDisplay(item.language, lang) : undefined },
    { labelKey: "detail.release", value: item.release_date },
    { labelKey: "detail.runtime", value: item.runtime ? `${item.runtime} ${t("detail.runtimeUnit")}` : null },
    { labelKey: "detail.aka", value: item.aka },
    { labelKey: "detail.imdb", value: item.imdb_id },
    { labelKey: "detail.tmdbId", value: item.tmdb_id != null ? String(item.tmdb_id) : null },
  ];

  const heroBackdrop = backdropUrl(item.poster_path, String(item.item_id));

  return (
    <div>
      {/* 顶部 Hero：全宽氛围大图 + 标题 + 年份/类型 */}
      <div
        className="relative -mx-4 mb-6 flex h-[300px] items-end overflow-hidden sm:-mx-4 sm:mb-8 sm:h-[420px]"
        style={{
          backgroundImage: `linear-gradient(to top, #141414 0%, rgba(20,20,20,0.6) 40%, rgba(20,20,20,0.1) 100%), url(${heroBackdrop})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="w-full bg-gradient-to-t from-ink via-ink/80 to-transparent px-4 pb-6 pt-20 sm:px-6 sm:pb-8">
          <h1 className="font-display text-3xl leading-none tracking-wide text-white sm:text-4xl lg:text-6xl">
            {item.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-subtle">
            {item.year ? <span>{item.year}</span> : null}
            {item.year && item.genres ? <span className="text-line">|</span> : null}
            {item.genres ? <span>{item.genres}</span> : null}
            {item.runtime ? (
              <>
                <span className="text-line">|</span>
                <span>{item.runtime} {t("detail.runtimeUnit")}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* 左列：大圆角海报 */}
        <div className="w-[150px] shrink-0 sm:w-[220px]">
          <div className="overflow-hidden rounded-xl ring-1 ring-line shadow-2xl">
            <Image
              src={posterUrl(item.poster_path, String(item.item_id))}
              alt={item.title}
              width={220}
              height={330}
              sizes="(max-width:640px) 150px, 220px"
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>

        {/* 元数据 + 操作 */}
        <div className="flex-1">
          {/* 顶部操作栏：原名（左侧、放大） + 专业评分（右侧）同一行 */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {/* 原名：放大展示，与评分同处一行 */}
            {item.original_title ? (
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-subtle">{t("detail.originalTitle")}</span>
                <span className="font-display text-5xl leading-tight text-white">
                  {item.original_title}
                </span>
              </div>
            ) : null}

            {/* 评分概览：靠右对齐、卡片化、更醒目 */}
            {(item.tmdb_rating != null || item.douban_rating != null) ? (
              <div className="flex flex-wrap gap-3 sm:justify-end">
                {item.tmdb_rating != null ? (
                  <div className="flex items-center gap-3 rounded-lg bg-gradient-to-br from-panel to-ink px-4 py-3 ring-1 ring-line shadow-lg">
                    <div className="flex flex-col items-end">
                      <span className="text-xs uppercase tracking-wider text-subtle">{t("detail.tmdb")}</span>
                      <span className="font-display text-4xl leading-none text-white">
                        {item.tmdb_rating.toFixed(1)}
                      </span>
                    </div>
                    <StarRating score={item.tmdb_rating} />
                  </div>
                ) : null}
                {item.douban_rating != null ? (
                  <div className="flex items-center gap-3 rounded-lg bg-gradient-to-br from-panel to-ink px-4 py-3 ring-1 ring-line shadow-lg">
                    <div className="flex flex-col items-end">
                      <span className="text-xs uppercase tracking-wider text-subtle">{t("detail.douban")}</span>
                      <span className="font-display text-4xl leading-none text-brand">
                        {item.douban_rating.toFixed(1)}
                      </span>
                    </div>
                    <StarRating score={item.douban_rating} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {meta.map((m) => (
              <div key={m.labelKey} className="flex gap-2 border-b border-line/60 py-1.5">
                <dt className="w-28 shrink-0 text-subtle">{t(m.labelKey)}</dt>
                <dd className="text-white">
                  {m.value ? (
                    m.display ? (
                      m.display
                    ) : LINK_FIELDS.has(m.labelKey) ? (
                      (() => {
                        // 不同字段跳转到搜索页对应的筛选参数：类型→genre，国家→country，其余→q
                        const param =
                          m.labelKey === "detail.genre"
                            ? "genre"
                            : m.labelKey === "detail.country"
                            ? "country"
                            : "q";
                        return splitMeta(m.value).map((part, i) => (
                          <span key={`${part}-${i}`}>
                            {i > 0 && <span className="text-line"> / </span>}
                            <Link
                              href={`/search?${param}=${encodeURIComponent(part)}`}
                              className="text-[#3070a8] hover:text-[#6a97bb] hover:underline"
                            >
                              {param === "country" ? countryDisplay(part, lang) : part}
                            </Link>
                          </span>
                        ));
                      })()
                    ) : (
                      m.value
                    )
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {/* 状态行：状态徽章 + 日期徽章 + 我的评分滑块（已看时放在时间后方同一行） */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow">
              {status === "plan" ? t("detail.statusPlan") : t("detail.statusWatched")}
            </span>
            {statusDate ? (
              <span className="inline-flex items-center gap-1.5 rounded border border-line bg-panel px-3 py-1.5 text-sm text-subtle shadow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-subtle" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" />
                </svg>
                {statusDate}
              </span>
            ) : null}

            {/* 仅已看显示 5 星评分，紧跟在时间徽章后方 */}
            {status === "watched" ? (
              <div className="flex min-w-[180px] flex-1 items-center gap-3">
                <span className="text-sm text-subtle">{t("detail.myRating")}</span>
                <StarRating score={rating} />
                <span className="w-8 text-center font-bold text-brand">{rating}</span>
              </div>
            ) : null}
          </div>

        </div>
      </div>

      {/* 剧情简介：通栏全宽，不局限于封面列宽 */}
      {item.overview ? (
        <div className="mt-6 border-t border-line/60 pt-4">
          <div className="mb-2 text-sm font-medium text-white">{t("detail.plot")}</div>
          <p className="text-sm leading-relaxed text-subtle">{item.overview}</p>
        </div>
      ) : null}
    </div>
  );
}
