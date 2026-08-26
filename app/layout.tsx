import "./globals.css";
import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/translations";
import FloatingActions from "@/components/FloatingActions";
import Analytics from "@/components/Analytics";
import { getSiteUrl } from "@/lib/seo";

// 字体自托管：Inter（正文）+ Bebas Neue（大标题）经 next/font 在构建期下载并同源托管，
// 消除运行时外链与 CLS；中文 Noto Sans SC 仍由 <link> 引入（CJK 全量字形体积过大，不适宜打包）。
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

// 站点标题/描述取自 i18n 字典（translations.zh / translations.en），
// 中英文统一维护，避免硬编码；默认输出中文，英文版通过 lang="en" 的 meta 提供给搜索引擎。
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: translations.zh["site.title"],
    template: "%s | iMOVIE",
  },
  description: translations.zh["site.description"],
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
  },
  openGraph: {
    title: translations.zh["site.title"],
    description: translations.zh["site.description"],
    type: "website",
    locale: "zh_CN",
    siteName: "iMOVIE",
  },
  twitter: {
    card: "summary_large_image",
    title: translations.zh["site.title"],
    description: translations.zh["site.description"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${bebas.variable}`}>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* 仅保留中文 Noto Sans SC 的外链（已 display=swap）；Inter/Bebas 已自托管 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-ink text-white">
        <LanguageProvider>
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
