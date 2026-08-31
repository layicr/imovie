// 单元测试：lib/i18n/translations.ts — 双语字典一致性与结构。
// 覆盖：LANGS 仅含 zh/en、zh 与 en 键集合完全一致（防漏翻）、每种语言值均为非空字符串。
import { describe, it, expect } from "vitest";
import { translations, LANGS, type Lang } from "@/lib/i18n/translations";

describe("i18n 双语字典", () => {
  it("LANGS 仅含 zh/en 两种语言", () => {
    expect(LANGS).toHaveLength(2);
    expect(LANGS.map((l) => l.code).sort()).toEqual(["en", "zh"]);
  });

  it("zh 与 en 的键集合完全一致（任一语言漏翻即失败）", () => {
    const zhKeys = Object.keys(translations.zh).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(zhKeys).toEqual(enKeys);
    // 同时确认确实有足量文案，避免空字典误判通过
    expect(zhKeys.length).toBeGreaterThan(50);
  });

  it("每种语言的每个键的值均为非空字符串", () => {
    for (const lang of LANGS.map((l) => l.code) as Lang[]) {
      const dict = translations[lang];
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
        // 不能出现未替换的 {0}{1} 之外异常占位（简单兜底：不含空串）
        expect(value.trim()).not.toBe("");
      }
    }
  });
});
