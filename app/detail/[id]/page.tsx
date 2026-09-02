// app/detail/[id]/page.tsx — 影片详情页服务端入口（含元数据 + JSON-LD）。 / Movie detail page server entry (metadata + JSON-LD).
import { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getRecord } from "@/lib/queries";
import { posterUrl } from "@/lib/poster";
import { getSiteUrl } from "@/lib/seo";
import { getServerLang } from "@/lib/i18n/serverLang";
import { splitMultiValue } from "@/lib/split";
import type { RecordRow } from "@/lib/types";
import DetailContent from "./DetailContent";

export const dynamic = "force-dynamic";

// 同一请求内（generateMetadata 与页面正文）对同一条记录去重，只查一次库。
// De-duplicate the same record within one request (generateMetadata + page body) so the DB is hit only once.
const getRecordCached = cache(getRecord);

const siteUrl = getSiteUrl();

type Props = {
  params: Promise<{ id: string }>;
};

// 详情页动态元数据：标题 / 描述 / OG / Twitter / canonical
// Detail page dynamic metadata: title / description / OG / Twitter / canonical.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item_id = decodeURIComponent(id);
  const db = await getDb();
  const data = await getRecordCached(db, item_id);

  if (!data) {
    return {
      title: "未找到影片",
      robots: { index: false, follow: false },
    };
  }

  const { item } = data;
  const lang = await getServerLang();
  const title = `${item.title}${item.year ? ` (${item.year})` : ""}`;
  // 描述按语言：中文用简介兜底中文句；英文用对应英文兜底句（库里 overview 无英文翻译）。
  // Description by language: zh falls back to a Chinese sentence; en to an English one (DB overview is untranslated).
  const description = item.overview
    ? item.overview
    : lang === "en"
      ? `My watch record and rating of ${item.title}.`
      : `${item.title} 的观影记录与评分。`;
  const image = posterUrl(item.poster_path, item_id);

  return {
    title,
    description,
    alternates: {
      canonical: `/detail/${encodeURIComponent(item_id)}`,
      languages: {
        zh: `/detail/${encodeURIComponent(item_id)}`,
        en: `/detail/${encodeURIComponent(item_id)}?lang=en`,
        "x-default": `/detail/${encodeURIComponent(item_id)}`,
      },
    },
    openGraph: {
      title,
      description,
      // 按媒体类型区分 OG 类型：剧集用 video.tv_show，电影用 video.movie
      // Pick the OG type by media type: TV series -> video.tv_show, movie -> video.movie.
      type: item.media_type === "tv" ? "video.tv_show" : "video.movie",
      images: image ? [{ url: image, alt: item.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

type Item = RecordRow["item"];

// 构造 JSON-LD Movie 结构化数据
// Build the JSON-LD Movie structured data.
function buildMovieJsonLd(item: Item, item_id: string) {
  const image = posterUrl(item.poster_path, item_id);
  const rating = item.douban_rating ?? item.tmdb_rating ?? null;

  const genres = item.genres ? splitMultiValue(item.genres) : undefined;
  const countries = item.country ? splitMultiValue(item.country) : undefined;
  const directors = item.director
    ? splitMultiValue(item.director).map((name) => ({ "@type": "Person", name }))
    : undefined;
  const actors = item.cast
    ? splitMultiValue(item.cast).map((name) => ({ "@type": "Person", name }))
    : undefined;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: item.title,
    alternativeHeadline: item.original_title || undefined,
    description: item.overview || undefined,
    image: image || undefined,
    // release_date 可能带地区后缀（如 2023-08-30(中国大陆)），只取前 10 位标准日期
    // release_date may carry a region suffix; keep only the first 10 chars (standard date).
    datePublished: item.release_date ? item.release_date.slice(0, 10) : undefined,
    genre: genres,
    duration: item.runtime ? `PT${item.runtime}M` : undefined,
    countryOfOrigin: countries,
    director: directors,
    actor: actors,
    identifier: item.imdb_id ? `tt${item.imdb_id.replace(/^tt/, "")}` : undefined,
    url: `${siteUrl}/detail/${encodeURIComponent(item_id)}`,
  };

  // 仅「我」的单条个人评分，用 Review 语义而非 AggregateRating，避免被误判为聚合评分
  // Only a single personal rating from the owner — use Review semantics, not AggregateRating.
  if (rating != null) {
    jsonLd.review = {
      "@type": "Review",
      author: { "@type": "Person", name: "iMOVIE" },
      reviewRating: {
        "@type": "Rating",
        ratingValue: rating,
        bestRating: 10,
        worstRating: 0,
      },
    };
  }

  // 移除 undefined 字段，避免 JSON-LD 污染
  // Drop undefined fields so the JSON-LD stays clean.
  Object.keys(jsonLd).forEach((key) => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });

  return jsonLd;
}

// 详情页服务端入口：取数据、生成元数据、注入 JSON-LD、渲染客户端交互组件。
// Detail page server entry: fetch data, build metadata, inject JSON-LD, render the client interaction component.
export default async function DetailPage({ params }: Props) {
  const { id } = await params;
  const item_id = decodeURIComponent(id);
  const db = await getDb();
  const data = await getRecordCached(db, item_id);

  if (!data) {
    notFound();
  }

  const record = data;
  const jsonLd = buildMovieJsonLd(record.item, item_id);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DetailContent record={record} />
    </>
  );
}
