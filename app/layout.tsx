import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/translations";
import FloatingActions from "@/components/FloatingActions";
import Analytics from "@/components/Analytics";

// 站点标题/描述取自 i18n 字典（translations.zh / translations.en），
// 中英文统一维护，避免硬编码；默认输出中文，英文版通过 lang="en" 的 meta 提供给搜索引擎。
export const metadata: Metadata = {
  title: translations.zh["site.title"],
  description: translations.zh["site.description"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        {/* 英文版元信息：用 lang="en" 区分语言，供搜索引擎/社交分享识别；文案取自 i18n 字典 */}
        <meta
          name="description"
          lang="en"
          content={translations.en["site.description"]}
        />
        <meta property="og:title" lang="en" content={translations.en["site.title"]} />
        <meta
          property="og:description"
          lang="en"
          content={translations.en["site.description"]}
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
