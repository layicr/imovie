import { describe, it, expect } from "vitest";
import {
  BAIDU_TONGJI_ID,
  LA_51_ID,
  LA_51_CK,
  GA_MEASUREMENT_ID,
} from "@/lib/analytics";

// 第三方统计 ID 属站点凭证；此处仅断言「已配置且格式合法」，
// 不校验具体值（具体值随账号变化，且不应硬编码在测试里）。
describe("analytics 统计配置", () => {
  it("GA 衡量 ID 形如 G-XXXXXXXXXX", () => {
    expect(GA_MEASUREMENT_ID).toMatch(/^G-[A-Z0-9]+$/);
  });

  it("百度统计 ID 非空且为十六进制串", () => {
    expect(BAIDU_TONGJI_ID).toBeTruthy();
    expect(BAIDU_TONGJI_ID).toMatch(/^[0-9a-f]+$/i);
  });

  it("51.la 的 id 与 ck 均非空且为合法字符串", () => {
    expect(LA_51_ID).toBeTruthy();
    expect(LA_51_CK).toBeTruthy();
    expect(LA_51_ID).not.toContain(" ");
    expect(LA_51_CK).not.toContain(" ");
  });
});
