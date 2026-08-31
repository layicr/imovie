// app/robots.ts — 站点 robots.txt 生成。 / Site robots.txt generation.
import { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

// 生成 robots 规则：允许全站抓取，仅屏蔽 /api/ 内部接口，并声明 sitemap 位置。
// Build robots rules: allow crawling everywhere except the internal /api/ routes, and advertise the sitemap.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
