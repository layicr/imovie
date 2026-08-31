import { describe, it, expect } from "vitest";
import {
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  PAGE_SIZE_OPTIONS,
  COUNTRY_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  SITE_NAME,
  NAV_LINKS,
  FOOTER_LINKS,
} from "@/lib/config";

describe("config 常量", () => {
  it("PAGE_SIZE_DEFAULT 在允许范围且等于 60（列表常用默认）", () => {
    expect(PAGE_SIZE_DEFAULT).toBe(60);
    expect(PAGE_SIZE_OPTIONS).toContain(PAGE_SIZE_DEFAULT);
  });

  it("PAGE_SIZE_MAX = PAGE_SIZE_OPTIONS 末项", () => {
    expect(PAGE_SIZE_MAX).toBe(PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1]);
    expect(PAGE_SIZE_MAX).toBeGreaterThanOrEqual(PAGE_SIZE_DEFAULT);
  });

  it("COUNTRY_OPTIONS 含新增的 LB（黎巴嫩）与 MT（马耳他）", () => {
    const values = COUNTRY_OPTIONS.map((c) => c.value);
    expect(values).toContain("LB");
    expect(values).toContain("MT");
    const lb = COUNTRY_OPTIONS.find((c) => c.value === "LB");
    const mt = COUNTRY_OPTIONS.find((c) => c.value === "MT");
    expect(lb?.zh).toBe("黎巴嫩");
    expect(lb?.en).toBe("Lebanon");
    expect(mt?.zh).toBe("马耳他");
    expect(mt?.en).toBe("Malta");
  });

  it("COUNTRY_OPTIONS 每项具备 value/zh/en 三字段且唯一", () => {
    const seen = new Set<string>();
    for (const c of COUNTRY_OPTIONS) {
      expect(c.value).toBeTruthy();
      expect(c.zh).toBeTruthy();
      expect(c.en).toBeTruthy();
      expect(seen.has(c.value)).toBe(false);
      seen.add(c.value);
    }
  });

  it("GENRE_OPTIONS / LANGUAGE_OPTIONS 非空且每项有 value+zh+en", () => {
    expect(GENRE_OPTIONS.length).toBeGreaterThan(0);
    expect(LANGUAGE_OPTIONS.length).toBeGreaterThan(0);
    for (const g of GENRE_OPTIONS) {
      expect(g.value).toBeTruthy();
      expect(g.zh).toBeTruthy();
      expect(g.en).toBeTruthy();
    }
    for (const l of LANGUAGE_OPTIONS) {
      expect(l.value).toBeTruthy();
      expect(l.zh).toBeTruthy();
      expect(l.en).toBeTruthy();
    }
  });
});

describe("站点元信息与导航", () => {
  it("SITE_NAME 为 iMOVIE", () => {
    expect(SITE_NAME).toBe("iMOVIE");
  });

  it("NAV_LINKS 含 home/search/report 三项，且 href/key 唯一非空", () => {
    expect(NAV_LINKS.map((l) => l.key).sort()).toEqual([
      "nav.home",
      "nav.report",
      "nav.search",
    ]);
    const hrefs = new Set(NAV_LINKS.map((l) => l.href));
    expect(hrefs.size).toBe(NAV_LINKS.length);
    for (const l of NAV_LINKS) {
      expect(l.href).toBeTruthy();
      expect(l.key).toBeTruthy();
    }
  });

  it("FOOTER_LINKS 非空且每项具备 href/key", () => {
    expect(FOOTER_LINKS.length).toBeGreaterThan(0);
    for (const l of FOOTER_LINKS) {
      expect(l.href).toBeTruthy();
      expect(l.key).toBeTruthy();
    }
  });
});
