"use client";

import Image from "next/image";
import MovieRow from "@/components/MovieRow";
import { posterUrl, backdropUrl } from "@/lib/poster";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { RecordRow } from "@/lib/types";

// 看板首页内容（Client Component）：服务端已取好初始数据，直接渲染 Hero + 两行海报墙。
export default function HomeContent({
  plan,
  watched,
}: {
  plan: RecordRow[];
  watched: RecordRow[];
}) {
  const { t } = useLanguage();
  const featured = watched[0] || plan[0] || null;

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
