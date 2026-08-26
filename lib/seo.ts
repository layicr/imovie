// SEO 相关工具：站点 URL、元数据辅助。
// 统一从 NEXT_PUBLIC_SITE_URL 读取，避免各文件重复处理回退与校验。

const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * 获取站点公开 URL，用于 metadataBase、canonical、sitemap、robots、JSON-LD。
 * 生产环境若未设置 NEXT_PUBLIC_SITE_URL 会打印警告（不阻断构建，避免首次部署卡死）。
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[seo] NEXT_PUBLIC_SITE_URL is not set; falling back to " +
          DEFAULT_SITE_URL +
          ". SEO metadata may point to the wrong host."
      );
    }
    return DEFAULT_SITE_URL;
  }
  // 去掉末尾斜杠，避免拼接出双斜杠
  return raw.replace(/\/$/, "");
}
