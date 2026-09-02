// app/search/page.tsx — 搜索页服务端入口（含 SearchAction JSON-LD）。 / Search page server entry (with SearchAction JSON-LD).
import { Metadata } from "next";
import { Suspense } from "react";
import { getSiteUrl } from "@/lib/seo";
import { getServerLang } from "@/lib/i18n/serverLang";
import SearchContent from "./SearchContent";

export const dynamic = "force-dynamic";

const siteUrl = getSiteUrl();

// 动态元数据：按语言选择标题/描述，声明 hreflang（搜索页本身 noindex，hreflang 仅作语言入口标注）。
// Dynamic metadata: pick title/description by language and declare hreflang (page is noindex; hreflang labels language entries).
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang();
  const title = lang === "en" ? "Search" : "搜索";
  const description =
    lang === "en"
      ? "Search movies and TV series in your iMOVIE diary; filter by genre, country, year and status."
      : "在 iMOVIE 观影记录中搜索电影、剧集，并按类型、国家、年份、状态等维度筛选。";
  return {
    title,
    description,
    alternates: {
      canonical: "/search",
      languages: {
        zh: "/search",
        en: "/search?lang=en",
        "x-default": "/search",
      },
    },
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      title: `${title} | iMOVIE`,
      description,
      type: "website",
    },
  };
}

// WebSite + SearchAction JSON-LD（Google 站内搜索框富媒体结果）
// WebSite + SearchAction JSON-LD (enables Google's sitelinks search box rich result).
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
