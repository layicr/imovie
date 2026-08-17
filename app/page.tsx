"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import MovieRow from "@/components/MovieRow";
import { posterUrl, backdropUrl } from "@/lib/poster";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { HOME_PLAN_LIMIT, HOME_WATCHED_LIMIT } from "@/lib/config";
import type { RecordRow } from "@/lib/types";

// 看板首页：Hero 大图（取已看第一条）+ 两行横向内容（想看 / 已看）。
export default function Home() {
  const { t } = useLanguage();
  const [plan, setPlan] = useState<RecordRow[]>([]);
  const [watched, setWatched] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [p, w] = await Promise.all([
        fetch(`/api/records?status=plan&limit=${HOME_PLAN_LIMIT}`).then((r) => r.json()),
        fetch(`/api/records?status=watched&limit=${HOME_WATCHED_LIMIT}`).then((r) => r.json()),
      ]);
      setPlan(p.records || []);
      setWatched(w.records || []);
    } finally {
      setLoading(false);
    }
  }

  const featured = watched[0] || plan[0] || null;

  if (loading) {
    // 骨架屏：结构与正式内容一致（Hero + 两行海报墙），消除客户端拉取首屏的白屏突兀感。
    return (
      <div aria-busy="true" aria-label={t("home.loading")}>
        <div className="relative mb-8 flex min-h-[320px] items-end overflow-hidden rounded-lg bg-panel p-6 sm:min-h-[420px] sm:p-10">
          <div className="h-8 w-2/3 animate-pulse rounded bg-line" />
        </div>
        {[t("home.plan"), t("home.watched")].map((title) => (
          <section key={title} className="mb-8">
            <div className="mb-3 h-6 w-32 animate-pulse rounded bg-panel" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:overflow-visible md:px-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] w-[140px] shrink-0 animate-pulse rounded-md bg-panel"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Hero 大图 */}
      {featured ? (
        <section
          className="relative mb-8 flex min-h-[320px] items-end overflow-hidden rounded-lg p-6 sm:min-h-[420px] sm:p-10"
          style={{
            backgroundImage: `linear-gradient(to top, #141414 5%, rgba(20,20,20,0.2) 70%), url(${backdropUrl(
              featured.item.poster_path,
              String(featured.item.item_id)
            )})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10 flex w-full items-end justify-between gap-6 sm:items-center">
            <div className="max-w-xl">
              <div className="mb-2 text-xs uppercase tracking-widest text-brand">
                {featured.status === "watched" ? t("home.recentWatched") : t("home.wishlist")}
              </div>
              <h1 className="font-display text-3xl leading-none sm:text-4xl lg:text-6xl">
                {featured.item.title}
              </h1>
              {featured.item.overview ? (
                <p className="mt-3 line-clamp-2 text-sm text-subtle sm:line-clamp-3">
                  {featured.item.overview}
                </p>
              ) : null}
              <a
                href={`/detail/${featured.item.item_id}`}
                className="mt-4 inline-block rounded bg-brand px-5 py-2 text-sm font-semibold hover:bg-red-700"
              >
                {t("home.viewDetail")}
              </a>
            </div>

            <div className="relative hidden aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-lg shadow-2xl sm:block sm:w-44 lg:w-52">
              <Image
                src={posterUrl(featured.item.poster_path, String(featured.item.item_id))}
                alt={featured.item.title}
                fill
                className="object-cover"
                priority
                unoptimized
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-8 rounded-lg border border-line bg-panel p-10 text-center">
          <h1 className="font-display text-4xl text-subtle">{t("home.emptyTitle")}</h1>
        </section>
      )}

      <MovieRow title={t("home.plan")} records={plan} />
      <MovieRow title={t("home.watched")} records={watched} />
    </div>
  );
}
