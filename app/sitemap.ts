import { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const db = await getDb();

  // 静态路由
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/report`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // 所有影片详情页
  const { rows } = await db.execute("SELECT item_id, updated_at FROM imovie_items ORDER BY item_id");
  const typedRows = rows as unknown as { item_id: string; updated_at: string | null }[];
  const detailUrls = typedRows.map((row) => ({
    url: `${siteUrl}/detail/${encodeURIComponent(row.item_id)}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...routes, ...detailUrls];
}
