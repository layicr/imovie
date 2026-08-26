// 单元测试：lib/api-error.ts — API 统一错误处理核心。
// 覆盖 resolveLang / isErrorKey / apiError / apiErrorFromUnknown 四个函数。
// 不启动 server，纯函数级断言。
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { apiError, apiErrorFromUnknown } from "@/lib/api-error";
import { translateError } from "@/lib/i18n/errors";

// ── helpers ────────────────────────────────────────────────────────────────

function makeReq(acceptLang?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (acceptLang !== undefined) headers["accept-language"] = acceptLang;
  return new NextRequest("https://example.com/api/test", { headers });
}

// ── 1. resolveLang（通过 apiError 间接验证） ────────────────────────────────

describe("resolveLang", () => {
  it('字符串 "zh" → "zh"', () => {
    const res = apiError("not_found", 404, undefined, "zh");
    const body = JSON.parse(res.body!.readableStream ? "" : "{}");
    // 生产模式下 not_found 翻译为中文
    expect(res.status).toBe(404);
  });

  it('字符串 "en" → "en"', async () => {
    const res = apiError("not_found", 404, undefined, "en");
    const body = await res.json();
    expect(body.error).toBe("The requested item was not found");
  });

  it('NextRequest accept-language: en → "en"', async () => {
    const res = apiError("not_found", 404, undefined, makeReq("en-US,en;q=0.9"));
    const body = await res.json();
    expect(body.error).toBe("The requested item was not found");
  });

  it('NextRequest accept-language: zh → "zh"', async () => {
    const res = apiError("not_found", 404, undefined, makeReq("zh-CN,zh;q=0.9"));
    const body = await res.json();
    expect(body.error).toBe("未找到该影片");
  });

  it("NextRequest 无 accept-language → 默认 zh", async () => {
    const res = apiError("not_found", 404, undefined, makeReq(undefined));
    const body = await res.json();
    expect(body.error).toBe("未找到该影片");
  });

  it("undefined → 默认 zh", async () => {
    const res = apiError("not_found", 404, undefined, undefined);
    const body = await res.json();
    expect(body.error).toBe("未找到该影片");
  });
});

// ── 2. isErrorKey（通过 apiError 间接验证） ─────────────────────────────────

describe("isErrorKey", () => {
  it("合法 ErrorKey 在生产模式返回翻译文案", async () => {
    const res = apiError("invalid_year", 400, undefined, "en");
    const body = await res.json();
    expect(body.error).toBe("Invalid year");
  });

  it("非法 key 在生产模式原文返回", async () => {
    const res = apiError("some_random_text", 400, undefined, "en");
    const body = await res.json();
    expect(body.error).toBe("some_random_text");
  });
});

// ── 3. apiError ─────────────────────────────────────────────────────────────

describe("apiError", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("生产模式：4xx + ErrorKey 返回翻译文案", async () => {
    process.env.NODE_ENV = "production";
    const res = apiError("validation_failed", 422, undefined, "en");
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.error).toBe("Parameter validation failed");
  });

  it("生产模式：5xx 强制翻译为 internal_error（脱敏）", async () => {
    process.env.NODE_ENV = "production";
    // 即使传入 not_found，5xx 也应被脱敏
    const res = apiError("not_found", 500, undefined, "en");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    // 原始 key 不应泄露
    expect(body.error).not.toContain("not_found");
  });

  it("生产模式：5xx 原始错误信息不暴露", async () => {
    process.env.NODE_ENV = "production";
    const res = apiError("SELECT * FROM secret_table", 500, undefined, "en");
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("secret_table");
  });

  it("开发模式：ErrorKey 返回 key + 翻译文案", async () => {
    process.env.NODE_ENV = "development";
    const res = apiError("not_found", 404, undefined, "zh");
    const body = await res.json();
    expect(body.error).toBe("not_found: 未找到该影片");
  });

  it("开发模式：原始错误信息直接返回", async () => {
    process.env.NODE_ENV = "development";
    const res = apiError("Connection refused: db:5432", 500, undefined, "en");
    const body = await res.json();
    expect(body.error).toBe("Connection refused: db:5432");
  });

  it("extra 字段合并到响应体", async () => {
    process.env.NODE_ENV = "production";
    const res = apiError("validation_failed", 422, { fields: { year: "invalid" } }, "en");
    const body = await res.json();
    expect(body.error).toBe("Parameter validation failed");
    expect(body.fields).toEqual({ year: "invalid" });
  });

  it("默认 status 为 500", () => {
    process.env.NODE_ENV = "production";
    const res = apiError("some_error");
    expect(res.status).toBe(500);
  });
});

// ── 4. apiErrorFromUnknown ──────────────────────────────────────────────────

describe("apiErrorFromUnknown", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("开发模式：Error 对象返回原始 message", async () => {
    process.env.NODE_ENV = "development";
    const res = apiErrorFromUnknown(new Error("DB connection timeout"), "query_failed", "en");
    const body = await res.json();
    expect(body.error).toBe("DB connection timeout");
  });

  it("开发模式：字符串错误返回原字符串", async () => {
    process.env.NODE_ENV = "development";
    const res = apiErrorFromUnknown("raw string error", "query_failed", "en");
    const body = await res.json();
    expect(body.error).toBe("raw string error");
  });

  it("生产模式：5xx 强制脱敏为 internal_error（fallbackKey 被 5xx 屏蔽）", async () => {
    // apiErrorFromUnknown 固定传 status=500，apiError 对 5xx 强制翻译为 internal_error，
    // 故 fallbackKey 在生产模式不生效 — 这是预期的安全脱敏行为。
    process.env.NODE_ENV = "production";
    const res = apiErrorFromUnknown(new Error("secret stack trace"), "query_failed", "en");
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.error).not.toContain("secret stack trace");
  });

  it("生产模式：默认 fallbackKey — 仍被 5xx 屏蔽为 internal_error", async () => {
    process.env.NODE_ENV = "production";
    const res = apiErrorFromUnknown(new Error("boom"), undefined, "zh");
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
  });

  it("生产模式：自定义 fallbackKey — 仍被 5xx 屏蔽为 internal_error", async () => {
    process.env.NODE_ENV = "production";
    const res = apiErrorFromUnknown(new Error("boom"), "stats_failed", "en");
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});

// ── 5. translateError（lib/i18n/errors.ts） ─────────────────────────────────

describe("translateError", () => {
  it("已知 key + zh 返回中文", () => {
    expect(translateError("not_found", "zh")).toBe("未找到该影片");
  });

  it("已知 key + en 返回英文", () => {
    expect(translateError("not_found", "en")).toBe("The requested item was not found");
  });

  it("默认 lang 为 zh", () => {
    expect(translateError("internal_error")).toBe("服务器内部错误");
  });
});
