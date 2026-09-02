// app/layout.tsx — 根布局：全局字体、SEO 元数据、外壳（Nav/Footer/Provider）。 / Root layout: global fonts, SEO metadata, and the app shell.
import "./globals.css";
import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { translations, type Lang } from "@/lib/i18n/translations";
import { getServerLang } from "@/lib/i18n/serverLang";
import FloatingActions from "@/components/FloatingActions";
import Analytics from "@/components/Analytics";
import { getSiteUrl } from "@/lib/seo";

// 字体自托管：Inter（正文）+ Bebas Neue（大标题）经 next/font 在构建期下载并同源托管，
// 消除运行时外链与 CLS；中文 Noto Sans SC 仍由 <link> 引入（CJK 全量字形体积过大，不适宜打包）。
// Self-hosted fonts: Inter (body) + Bebas Neue (display) are downloaded at build time and served same-origin via next/font,
// removing runtime external links and CLS; Chinese Noto Sans SC stays a <link> (CJK glyphs are too large to bundle).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const siteUrl = getSiteUrl();

// 动态元数据：按当前语言选择标题/描述并声明 hreflang 备选（默认指向首页，各页面可覆盖）。
// Dynamic metadata: pick title/description by language and declare hreflang alternates
// (defaults to home; child pages may override per-path).
export async function generateMetadata(): Promise<Metadata> {
  const lang: Lang = await getServerLang();
  const dict = translations[lang];
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: dict["site.title"],
      template: "%s | iMOVIE",
    },
    description: dict["site.description"],
    keywords: ["观影记录", "电影", "剧集", "movie", "tv", "watchlist"],
    authors: [{ name: "iMOVIE" }],
    creator: "iMOVIE",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: "/",
      languages: {
        zh: "/",
        en: "/?lang=en",
        "x-default": "/",
      },
    },
    openGraph: {
      title: dict["site.title"],
      description: dict["site.description"],
      type: "website",
      locale: lang === "en" ? "en_US" : "zh_CN",
      siteName: "iMOVIE",
    },
    twitter: {
      card: "summary_large_image",
      title: dict["site.title"],
      description: dict["site.description"],
    },
  };
}

// 根布局：按服务端语言渲染 <html lang>，挂载语言上下文（注入 SSR 初始语言），渲染外壳。
// Root layout: sets <html lang> by server language, mounts the language context (SSR initial lang), renders the shell.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLang();
  return (
    <html lang={lang === "en" ? "en" : "zh-CN"} className={`${inter.variable} ${bebas.variable}`}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* 仅保留中文 Noto Sans SC 的外链（已 display=swap）；Inter/Bebas 已自托管 */}
        {/* Keep only the Chinese Noto Sans SC external link (display=swap); Inter/Bebas are self-hosted. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-ink text-white">
        <LanguageProvider initialLang={lang}>
          <Nav />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-4">
            {children}
          </main>
          <Footer />
          <FloatingActions />
          <Analytics />
        </LanguageProvider>
      </body>
    </html>
  );
}
