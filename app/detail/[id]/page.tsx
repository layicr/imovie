import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getRecord } from "@/lib/queries";
import { posterUrl } from "@/lib/poster";
import { getSiteUrl } from "@/lib/seo";
import type { RecordRow } from "@/lib/types";
import DetailContent from "./DetailContent";

export const dynamic = "force-dynamic";

const siteUrl = getSiteUrl();

type Props = {
  params: { id: string };
};

// 详情页动态元数据：标题 / 描述 / OG / Twitter / canonical
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item_id = decodeURIComponent(params.id);
  const db = await getDb();
  const data = await getRecord(db, item_id);

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
function buildMovieJsonLd(item: Item, item_id: string) {
  const image = posterUrl(item.poster_path, item_id);
  const rating = item.douban_rating ?? item.tmdb_rating ?? null;

  const genres = item.genres ? item.genres.split(/\s*\/\s*|,|，|\/|、/).map((s: string) => s.trim()).filter(Boolean) : undefined;
  const countries = item.country ? item.country.split(/\s*\/\s*|,|，|\/|、/).map((s: string) => s.trim()).filter(Boolean) : undefined;
  const directors = item.director ? item.director.split(/\s*\/\s*|,|，|\/|、/).map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({ "@type": "Person", name })) : undefined;
  const actors = item.cast ? item.cast.split(/\s*\/\s*|,|，|\/|、/).map((s: string) => s.trim()).filter(Boolean).map((name: string) => ({ "@type": "Person", name })) : undefined;

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
  Object.keys(jsonLd).forEach((key) => {
    if (jsonLd[key] === undefined) delete jsonLd[key];
  });

  return jsonLd;
}

// 详情页服务端入口：取数据、生成元数据、注入 JSON-LD、渲染客户端交互组件。
export default async function DetailPage({ params }: Props) {
  const item_id = decodeURIComponent(params.id);
  const db = await getDb();
  const data = await getRecord(db, item_id);

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
