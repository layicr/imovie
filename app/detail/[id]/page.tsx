// app/detail/[id]/page.tsx — 影片详情页服务端入口（含元数据 + JSON-LD）。 / Movie detail page server entry (metadata + JSON-LD).
import { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getRecord } from "@/lib/queries";
import { posterUrl } from "@/lib/poster";
import { getSiteUrl } from "@/lib/seo";
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
  const title = `${item.title}${item.year ? ` (${item.year})` : ""}`;
  const description = item.overview || `${item.title} 的观影记录与评分。`;
  const image = posterUrl(item.poster_path, item_id);

  return {
    title,
    description,
    alternates: {
      canonical: `/detail/${encodeURIComponent(item_id)}`,
    },
    openGraph: {
      title,
      description,
      type: "video.movie",
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
    datePublished: item.release_date || undefined,
    genre: genres,
    duration: item.runtime ? `PT${item.runtime}M` : undefined,
    countryOfOrigin: countries,
    director: directors,
    actor: actors,
    identifier: item.imdb_id ? `tt${item.imdb_id.replace(/^tt/, "")}` : undefined,
    url: `${siteUrl}/detail/${encodeURIComponent(item_id)}`,
  };

  if (rating != null) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      bestRating: 10,
      worstRating: 0,
      reviewCount: 1,
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
