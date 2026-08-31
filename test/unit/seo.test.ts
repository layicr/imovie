// 单元测试：lib/seo.ts — getSiteUrl（站点公开 URL 解析，纯函数）。
// 覆盖：未配置回退默认、去掉末尾斜杠、正常返回、生产环境未配置时的 console.warn 告警。
import { describe, it, expect, afterEach, vi } from "vitest";
import { getSiteUrl } from "@/lib/seo";

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("未设置 NEXT_PUBLIC_SITE_URL → 回退默认 http://localhost:3000", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("带末尾斜杠 → 去掉，避免拼接出双斜杠", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com/");
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("正常返回（无末尾斜杠时保持不变）", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://imovie.example.com");
    expect(getSiteUrl()).toBe("https://imovie.example.com");
  });

  it("生产环境未设置 → 仍回退默认并打印 console.warn 告警", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = getSiteUrl();
    expect(url).toBe("http://localhost:3000");
    expect(warn).toHaveBeenCalled();
  });
});
