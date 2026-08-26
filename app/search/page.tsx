import { Metadata } from "next";
import { Suspense } from "react";
import { getSiteUrl } from "@/lib/seo";
import SearchContent from "./SearchContent";

export const dynamic = "force-dynamic";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "搜索",
  description: "在 iMOVIE 观影记录中搜索电影、剧集，并按类型、国家、年份、状态等维度筛选。",
  alternates: {
    canonical: "/search",
  },
  robots: {
    // 搜索结果页通常不希望被索引，避免重复/低质内容
    index: false,
    follow: true,
  },
  openGraph: {
    title: "搜索 | iMOVIE",
    description: "在 iMOVIE 观影记录中搜索电影、剧集。",
    type: "website",
  },
};

// WebSite + SearchAction JSON-LD（Google 站内搜索框富媒体结果）
function SearchJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "iMOVIE",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function SearchPage() {
  return (
    <>
      <SearchJsonLd />
      <Suspense fallback={<div className="text-subtle">加载中…</div>}>
        <SearchContent />
      </Suspense>
    </>
  );
}
