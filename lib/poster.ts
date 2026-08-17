// 海报 URL 构造助手：海报只存 URL 字符串（TMDb CDN 外链或 picsum 占位），绝不入库图片文件。
export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/w500";
export const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
export const PLACEHOLDER_BASE = "https://picsum.photos/seed";

// 统一把存储的海报路径转换为可访问的完整 URL：
// - 已是完整 http(s) 链接（如 picsum 占位）则原样返回；
// - TMDb 相对路径则拼接 CDN 域名；
// - 为空则回退到基于 seed 的稳定占位图。
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
// 占位图对应 1280x720 横版。逻辑与 posterUrl 一致。
export function backdropUrl(path?: string | null, seed = "imovie"): string {
  if (path && (path.startsWith("http://") || path.startsWith("https://"))) {
    return path;
  }
  if (path) {
    return `${TMDB_BACKDROP_BASE}${path}`;
  }
  return `${PLACEHOLDER_BASE}/${encodeURIComponent(seed)}/1280/720`;
}
