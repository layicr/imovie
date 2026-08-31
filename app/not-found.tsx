// app/not-found.tsx — 全局 404 页面（服务端渲染，带 i18n）。 / Global 404 page (server-rendered, i18n-aware).
import Link from "next/link";
import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/seo";
import { translations, type Lang } from "@/lib/i18n/translations";

// 服务端 404：无法使用客户端 LanguageProvider（无 localStorage），
// 故依据请求头 Accept-Language（及 imovie-lang cookie）判定语言，与 API 的 resolveLang 保持一致。
// Server-side 404: the client LanguageProvider is unavailable (no localStorage), so we resolve the language
// from the Accept-Language header (and the imovie-lang cookie) to stay consistent with the API's resolveLang.
async function resolveLang(): Promise<Lang> {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)imovie-lang=(zh|en)/);
  if (m) return m[1] as Lang;
  const al = (h.get("accept-language") ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return al.startsWith("en") ? "en" : "zh";
}

// 全局 404 页面（i18n 文案取自 translations）。详情页未知 item_id、或任意未匹配路由都会落入此处。
// Global 404 page (copy from translations). Unknown item_id on the detail page or any unmatched route lands here.
export default async function NotFound() {
  const lang = await resolveLang();
  const t = (key: string) => translations[lang][key] ?? translations.zh[key] ?? key;
  const siteUrl = getSiteUrl();

  return (
    <div lang={lang === "en" ? "en" : "zh-CN"} className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <meta httpEquiv="content-language" content={lang === "en" ? "en" : "zh-CN"} />
      <h1 className="font-display text-6xl text-brand">404</h1>
      <p className="text-lg text-subtle">{t("notFound.title")}</p>
      <p className="text-sm text-subtle">{t("notFound.subtitle")}</p>
      <Link
        href="/"
        className="mt-2 rounded bg-brand px-5 py-2 text-sm font-semibold hover:bg-red-700"
      >
        {t("notFound.backHome")}
      </Link>
      <link rel="canonical" href={`${siteUrl}/`} />
    </div>
  );
}
