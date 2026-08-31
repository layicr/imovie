"use client";

// components/PosterCard.tsx — 单个海报卡片（hover 放大 + 评分/想看角标）。 / Single poster card (hover zoom + rating/plan badge).
import Image from "next/image";
import Link from "next/link";
import { posterUrl } from "@/lib/poster";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { RecordRow } from "@/lib/types";

// 海报卡片：hover 放大 1.1 倍并自身浮起（z-10）；底部操作提示悬停淡入；已看带品牌色评分角标，想看带品牌色「想看」徽章，豆瓣评分为琥珀色。
// Poster card: on hover it scales to 1.1× and lifts itself (z-10); the bottom action hint fades in; watched shows a brand-color rating badge, plan-to-watch a brand-color "plan" badge, and Douban rating an amber badge.
export default function PosterCard({ rec }: { rec: RecordRow }) {
  const { item, status, rating } = rec;
  const { t } = useLanguage();
  return (
    <Link
      href={`/detail/${item.item_id}`}
      className="group relative block w-[140px] shrink-0 snap-start sm:w-[160px]"
    >
      {/* isolate 创建独立 stacking context，防止 hover 放大时被父级 overflow-hidden 裁剪；
          同时让 z-10 只在卡片内部生效，不污染外层布局。 */}
      <div className="relative isolate aspect-[2/3] overflow-hidden rounded-md bg-panel ring-1 ring-line transition-transform duration-300 [@media(hover:hover)]:group-hover:z-10 [@media(hover:hover)]:group-hover:scale-110 [@media(hover:hover)]:group-hover:shadow-2xl active:scale-95">
        <Image
          src={posterUrl(item.poster_path, String(item.item_id))}
          alt={item.title}
          fill
          sizes="(max-width:640px) 140px, 160px"
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
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 opacity-100 transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
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
