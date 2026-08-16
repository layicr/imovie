"use client";

import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/poster";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { RecordRow } from "@/lib/types";

// 海报卡片：hover 放大 1.3 倍、压制相邻卡片、浮出操作提示（Netflix 手感）。
// 已看卡片带红色评分角标，想看带红色「想看」徽章。
export default function PosterCard({ rec }: { rec: RecordRow }) {
  const { item, status, rating } = rec;
  const { t } = useLanguage();
  return (
    <Link
      href={`/detail/${item.item_id}`}
      className="group relative block w-[140px] shrink-0 snap-start sm:w-[160px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-panel ring-1 ring-line transition-transform duration-300 group-hover:z-10 group-hover:scale-110 group-hover:shadow-2xl">
        <Image
          src={posterUrl(item.poster_path, String(item.item_id))}
          alt={item.title}
          fill
          sizes="160px"
          className="object-cover"
          loading="lazy"
        />
        <div className="absolute right-1 top-1 flex flex-col gap-1">
          {status === "watched" && rating ? (
            <span className="rounded bg-brand px-1.5 py-0.5 text-xs font-bold text-white">
              {rating}
            </span>
          ) : status === "plan" ? (
            <span className="rounded bg-brand/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {t("card.plan")}
            </span>
          ) : null}
          {status === "plan" && item.douban_rating ? (
            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
              {item.douban_rating}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
          {item.original_title ? (
            <p className="mb-1 line-clamp-2 text-[11px] leading-tight text-white">
              <span className="text-subtle">{t("card.originalTitle")}：</span>
              {item.original_title}
            </p>
          ) : null}
          <span className="block rounded bg-white/10 py-1 text-center text-xs">
            {t("card.viewDetail")}
          </span>
        </div>
      </div>
      <div className="mt-1 truncate text-xs text-subtle group-hover:text-white">
        {item.title}
      </div>
    </Link>
  );
}
