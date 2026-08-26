import { describe, it, expect } from "vitest";
import {
  posterUrl,
  backdropUrl,
  TMDB_IMG_BASE,
  TMDB_BACKDROP_BASE,
  PLACEHOLDER_BASE,
} from "@/lib/poster";

describe("posterUrl", () => {
  it("TMDb 相对路径 → 拼接 image.tmdb.org 前缀", () => {
    expect(posterUrl("/abc123.jpg")).toBe(`${TMDB_IMG_BASE}/abc123.jpg`);
  });

  it("空 / null / undefined → 回退 picsum 占位图（按 seed）", () => {
    expect(posterUrl("")).toBe(`${PLACEHOLDER_BASE}/imovie/500/750`);
    expect(posterUrl(null)).toBe(`${PLACEHOLDER_BASE}/imovie/500/750`);
    expect(posterUrl(undefined)).toBe(`${PLACEHOLDER_BASE}/imovie/500/750`);
  });

  it("自定义 seed 影响占位图 URL", () => {
    expect(posterUrl(undefined, "myseed")).toBe(`${PLACEHOLDER_BASE}/myseed/500/750`);
  });

  it("已是绝对链接（http/https）则原样返回，不二次拼接", () => {
    const abs = "https://example.com/poster.jpg";
    expect(posterUrl(abs)).toBe(abs);
    const abs2 = "http://example.com/p.jpg";
    expect(posterUrl(abs2)).toBe(abs2);
  });

  it("以 // 开头的字符串被视为相对路径，仍拼接 TMDB 前缀", () => {
    // 应用层约定 poster_path 只存 TMDb 相对路径；// 形式不当作绝对链接，按相对处理。
    const p = "//cdn.example.com/p.jpg";
    expect(posterUrl(p)).toBe(`${TMDB_IMG_BASE}${p}`);
  });
});

describe("backdropUrl (Hero 横图)", () => {
  it("TMDb 相对路径 → 拼接 w780 横图档位", () => {
    expect(backdropUrl("/abc123.jpg")).toBe(`${TMDB_BACKDROP_BASE}/abc123.jpg`);
  });

  it("空值回退到 1280x720 横版占位图", () => {
    expect(backdropUrl(undefined)).toBe(`${PLACEHOLDER_BASE}/imovie/1280/720`);
    expect(backdropUrl(null, "hero")).toBe(`${PLACEHOLDER_BASE}/hero/1280/720`);
  });

  it("绝对链接原样返回", () => {
    const abs = "https://example.com/backdrop.jpg";
    expect(backdropUrl(abs)).toBe(abs);
  });
});
