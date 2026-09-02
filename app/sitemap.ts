// app/sitemap.ts — 站点 sitemap.xml 生成（SEO）。 / Site sitemap.xml generation (SEO).
import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic"; // 依赖数据库中的影片列表（实时读取 item_id），禁止静态预渲染 / Depends on the live DB item list; disable static prerender.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const db = await getDb();

  // 各 URL 的 hreflang 备选（中/英 + x-default）；英文版为同一路径加 ?lang=en。
  // hreflang alternates (zh/en + x-default); the English variant is the same path with ?lang=en.
  const langAlternates = (path: string) => ({
    languages: {
      zh: `${siteUrl}${path}`,
      en: `${siteUrl}${path}?lang=en`,
      "x-default": `${siteUrl}${path}`,
    },
  });

  // 静态路由 / Static routes.
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
      alternates: langAlternates("/"),
    },
    {
      url: `${siteUrl}/report`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: langAlternates("/report"),
    },
  ];

  // 所有影片详情页 / Every movie detail page.
  const { rows } = await db.execute("SELECT item_id, updated_at FROM imovie_items ORDER BY item_id");
  const typedRows = rows as unknown as { item_id: string; updated_at: string | null }[];
  const detailUrls = typedRows.map((row) => ({
    url: `${siteUrl}/detail/${encodeURIComponent(row.item_id)}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
    alternates: langAlternates(`/detail/${encodeURIComponent(row.item_id)}`),
  }));

  return [...routes, ...detailUrls];
}
