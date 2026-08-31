// lib/poster.ts — 海报 URL 构造助手。 / Poster URL builder.
// 海报只存 URL 字符串（TMDb CDN 外链或 picsum 占位），绝不入库图片文件。
// Posters are stored only as URL strings (TMDb CDN or picsum placeholder); image files never enter the DB.
export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";
export const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
export const PLACEHOLDER_BASE = "https://picsum.photos/seed";

// 统一把存储的海报路径转换为可访问的完整 URL：
// Normalise a stored poster path into a full, reachable URL:
// - 已是完整 http(s) 链接（如 picsum 占位）则原样返回；
// - already a full http(s) URL (e.g. picsum) → returned as-is;
// - TMDb 相对路径则拼接 CDN 域名；
// - a TMDb relative path → prefixed with the CDN base;
// - 为空则回退到基于 seed 的稳定占位图。
// - empty → a stable placeholder derived from the seed.
/**
 * 海报图 URL：TMDb 相对路径拼 w500，http(s) 原样返回，空值回退 picsum 占位。
 * Poster URL: TMDb relative path → w500 base; http(s) → as-is; empty → picsum placeholder.
 */
export function posterUrl(path?: string | null, seed = "imovie"): string {
  if (path && (path.startsWith("http://") || path.startsWith("https://"))) {
    return path;
  }
  if (path) {
    return `${TMDB_IMG_BASE}${path}`;
  }
  return `${PLACEHOLDER_BASE}/${encodeURIComponent(seed)}/500/750`;
}

// 背景大图（Hero）专用：取 TMDb w780 档位，远小于原图，移动端流量友好；
// Backdrop (Hero) variant: TMDb w780 — far smaller than the original, friendly to mobile traffic;
// 占位图对应 1280x720 横版。逻辑与 posterUrl 一致。
// placeholder is 1280×720 landscape. Same logic as posterUrl.
/**
 * 背景大图 URL：TMDb 相对路径拼 w780，http(s) 原样返回，空值回退 1280x720 占位。
 * Backdrop URL: TMDb relative path → w780 base; http(s) → as-is; empty → 1280×720 placeholder.
 */
export function backdropUrl(path?: string | null, seed = "imovie"): string {
  if (path && (path.startsWith("http://") || path.startsWith("https://"))) {
    return path;
  }
  if (path) {
    return `${TMDB_BACKDROP_BASE}${path}`;
  }
  return `${PLACEHOLDER_BASE}/${encodeURIComponent(seed)}/1280/720`;
}
