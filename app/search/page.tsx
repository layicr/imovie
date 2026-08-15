"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import PosterCard from "@/components/PosterCard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { COUNTRY_OPTIONS, GENRE_OPTIONS, PAGE_SIZE_OPTIONS, PAGE_SIZE_DEFAULT } from "@/lib/config";
import type { MediaType, RecordRow, Status } from "@/lib/types";

// 动态类型标签：库里以中文存储，优先用 GENRE_OPTIONS 映射，未收录则原样显示。
function genreDisplay(value: string, lang: "zh" | "en"): string {
  const opt = GENRE_OPTIONS.find((g) => g.value === value);
  if (opt) return lang === "en" ? opt.en : opt.zh;
  return value;
}

// 制片国家/地区标签：库里以中文存储，优先用 COUNTRY_OPTIONS 映射，未收录则原样显示。
function countryDisplay(value: string, lang: "zh" | "en"): string {
  const opt = COUNTRY_OPTIONS.find((c) => c.value === value);
  if (opt) return lang === "en" ? opt.en : opt.zh;
  return value;
}

// 搜索页：全局关键词搜索 + 电影/剧集/状态切换 + 类型/年限多维过滤（选项从库动态读取去重）
// + 排序（添加时间 / 豆瓣评分 / TMDb 评分）+ 分页。
// useSearchParams 需包裹在 Suspense 边界内，避免静态预渲染时的 CSR 退出报错。
function SearchContent() {
  const { t, lang } = useLanguage();
  const sp = useSearchParams();
  const pathname = usePathname();

  const initialQ = sp.get("q") || "";
  const initialMediaType = (sp.get("media_type") as MediaType | "") || "";
  const initialGenre = sp.get("genre") || "";
  const initialCountry = sp.get("country") || "";
  const initialYear = sp.get("year") || "";
  const initialStatusF = (sp.get("status") as Status | "") || "";
  const initialSort = (sp.get("sort") as "release_date" | "douban_rating" | "tmdb_rating") || "release_date";
  const initialOrder = (sp.get("order") as "desc" | "asc") || "desc";
  const initialPage = Number(sp.get("page")) || 1;

  const [q, setQ] = useState(initialQ);
  const [mediaType, setMediaType] = useState<MediaType | "">(initialMediaType);
  const [genre, setGenre] = useState(initialGenre);
  const [country, setCountry] = useState(initialCountry);
  const [year, setYear] = useState(initialYear);
  const [statusF, setStatusF] = useState<Status | "">(initialStatusF);
  const [sort, setSort] = useState<"release_date" | "douban_rating" | "tmdb_rating">(initialSort);
  const [order, setOrder] = useState<"desc" | "asc">(initialOrder);
  const [page, setPage] = useState(initialPage);

  // 同步 URL 的所有筛选参数（从详情页等带 ?genre=/?country= 跳转到本页时触发）
  useEffect(() => {
    const nextQ = sp.get("q") || "";
    const nextMediaType = (sp.get("media_type") as MediaType | "") || "";
    const nextGenre = sp.get("genre") || "";
    const nextCountry = sp.get("country") || "";
    const nextYear = sp.get("year") || "";
    const nextStatusF = (sp.get("status") as Status | "") || "";
    const nextSort = (sp.get("sort") as "release_date" | "douban_rating" | "tmdb_rating") || "release_date";
    const nextOrder = (sp.get("order") as "desc" | "asc") || "desc";
    const nextPage = Number(sp.get("page")) || 1;
    if (nextQ !== q) setQ(nextQ);
    if (nextMediaType !== mediaType) setMediaType(nextMediaType);
    if (nextGenre !== genre) setGenre(nextGenre);
    if (nextCountry !== country) setCountry(nextCountry);
    if (nextYear !== year) setYear(nextYear);
    if (nextStatusF !== statusF) setStatusF(nextStatusF);
    if (nextSort !== sort) setSort(nextSort);
    if (nextOrder !== order) setOrder(nextOrder);
    if (nextPage !== page) setPage(nextPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const [records, setRecords] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [genres, setGenres] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_DEFAULT);
  const [loading, setLoading] = useState(false);

  async function fetchAll(override?: {
    q?: string;
    mediaType?: MediaType | "";
    genre?: string;
    country?: string;
    year?: string;
    statusF?: Status | "";
    sort?: "release_date" | "douban_rating" | "tmdb_rating";
    order?: "desc" | "asc";
    page?: number;
    limit?: number;
  }) {
    setLoading(true);
    const nextQ = override?.q ?? q;
    const nextMediaType = override?.mediaType ?? mediaType;
    const nextGenre = override?.genre ?? genre;
    const nextCountry = override?.country ?? country;
    const nextYear = override?.year ?? year;
    const nextStatusF = override?.statusF ?? statusF;
    const nextSort = override?.sort ?? sort;
    const nextOrder = override?.order ?? order;
    const p = override?.page ?? page;
    const n = override?.limit ?? pageSize;
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextMediaType) params.set("media_type", nextMediaType);
    if (nextGenre) params.set("genre", nextGenre);
    if (nextCountry) params.set("country", nextCountry);
    if (nextYear.trim()) params.set("year", nextYear.trim());
    if (nextStatusF) params.set("status", nextStatusF);
    params.set("sort", nextSort);
    params.set("order", nextOrder);
    params.set("page", String(p));
    params.set("limit", String(n));

    // 同步筛选条件到 URL（不重载页面），使 ?q= 等参数可被分享/刷新保留
    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    if (typeof window !== "undefined" && window.location.href !== nextUrl) {
      window.history.replaceState(null, "", nextUrl);
    }

    try {
      const res = await fetch(`/api/records?${params.toString()}`);
      const d = await res.json();
      setRecords(d.records || []);
      setTotal(d.total || 0);
      setGenres(d.genres || []);
      setCountries(d.countries || []);
      setYears(d.years || []);
      if (d.pageSize) setPageSize(d.pageSize);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }

  // 关键词输入变化即触发搜索；其余筛选项点击 chip 即时生效
  const didInitRef = useRef(false);
  useEffect(() => {
    // 首次挂载用真实 URL 参数（含页码）搜索；之后关键词变化回到第 1 页
    if (!didInitRef.current) {
      didInitRef.current = true;
      fetchAll();
    } else {
      fetchAll({ page: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    fetchAll({ page: 1 });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="mb-4 font-display text-3xl">{t("search.title")}</h1>

      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          className="flex-1 rounded border border-line bg-panel px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button className="rounded bg-brand px-4 py-2 text-sm font-semibold hover:bg-red-700">
          {t("search.search")}
        </button>
      </form>

      {/* 过滤 chips */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={mediaType === ""} onClick={() => { setMediaType(""); fetchAll({ mediaType: "" }); }}>
            {t("search.all")}
          </Chip>
          <Chip active={mediaType === "movie"} onClick={() => { setMediaType("movie"); fetchAll({ mediaType: "movie" }); }}>
            {t("search.movie")}
          </Chip>
          <Chip active={mediaType === "tv"} onClick={() => { setMediaType("tv"); fetchAll({ mediaType: "tv" }); }}>
            {t("search.tv")}
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={statusF === ""} onClick={() => { setStatusF(""); fetchAll({ statusF: "" }); }}>
            {t("search.allStatus")}
          </Chip>
          <Chip active={statusF === "plan"} onClick={() => { setStatusF("plan"); fetchAll({ statusF: "plan" }); }}>
            {t("search.plan")}
          </Chip>
          <Chip active={statusF === "watched"} onClick={() => { setStatusF("watched"); fetchAll({ statusF: "watched" }); }}>
            {t("search.watched")}
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={genre === ""} onClick={() => { setGenre(""); fetchAll({ genre: "" }); }}>
            {t("search.all")}
          </Chip>
          {genres.map((g) => (
            <Chip key={g} active={genre === g} onClick={() => { const next = genre === g ? "" : g; setGenre(next); fetchAll({ genre: next }); }}>
              {genreDisplay(g, lang)}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={country === ""} onClick={() => { setCountry(""); fetchAll({ country: "" }); }}>
            {t("search.all")}
          </Chip>
          {countries.map((c) => (
            <Chip key={c} active={country === c} onClick={() => { const next = country === c ? "" : c; setCountry(next); fetchAll({ country: next }); }}>
              {countryDisplay(c, lang)}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={year === ""} onClick={() => { setYear(""); fetchAll({ year: "" }); }}>
            {t("search.all")}
          </Chip>
          {years.map((y) => (
            <Chip
              key={y}
              active={String(y) === year}
              onClick={() => { const next = year === String(y) ? "" : String(y); setYear(next); fetchAll({ year: next }); }}
            >
              {y}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={sort === "release_date"} onClick={() => { setSort("release_date"); fetchAll({ sort: "release_date" }); }}>
            {t("search.sortCreated")}
          </Chip>
          <Chip active={sort === "douban_rating"} onClick={() => { setSort("douban_rating"); fetchAll({ sort: "douban_rating" }); }}>
            {t("search.sortDouban")}
          </Chip>
          <Chip active={sort === "tmdb_rating"} onClick={() => { setSort("tmdb_rating"); fetchAll({ sort: "tmdb_rating" }); }}>
            {t("search.sortTmdb")}
          </Chip>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={order === "desc"} onClick={() => { setOrder("desc"); fetchAll({ order: "desc" }); }}>
            {t("search.orderDesc")}
          </Chip>
          <Chip active={order === "asc"} onClick={() => { setOrder("asc"); fetchAll({ order: "asc" }); }}>
            {t("search.orderAsc")}
          </Chip>
        </div>

      </div>

      <div className="mb-3 text-xs text-subtle">
        {t("search.count").replace("{0}", String(total))}
      </div>

      {loading ? (
        <div className="text-subtle">{t("search.searching")}</div>
      ) : records.length ? (
        <div className="no-scrollbar flex flex-wrap gap-3">
          {records.map((r) => (
            <PosterCard key={r.rec_id} rec={r} />
          ))}
        </div>
      ) : (
        <div className="text-subtle">{t("search.noMatch")}</div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => fetchAll({ page: page - 1 })}
            className="rounded border border-line bg-panel px-3 py-1.5 text-sm disabled:opacity-40 hover:text-white"
          >
            {t("search.prev")}
          </button>
          <span className="text-xs text-subtle">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => fetchAll({ page: page + 1 })}
            className="rounded border border-line bg-panel px-3 py-1.5 text-sm disabled:opacity-40 hover:text-white"
          >
            {t("search.next")}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-subtle">{t("search.perPage")}</span>
            <select
              value={pageSize}
              onChange={(e) => { const n = Number(e.target.value); setPageSize(n); fetchAll({ limit: n, page: 1 }); }}
              className="rounded border border-line bg-panel px-2 py-1 text-xs focus:border-brand focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// 默认导出：用 Suspense 包裹使用 useSearchParams 的内容组件。
export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-subtle">加载中…</div>}>
      <SearchContent />
    </Suspense>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3 py-1 text-xs " +
        (active ? "bg-brand text-white" : "bg-panel text-subtle hover:text-white")
      }
    >
      {children}
    </button>
  );
}
