// 单元测试：lib/api-error.ts — handleRouteError（路由统一异常封装入口）。
// 覆盖：ZodError→422、生产环境脱敏 500、开发环境原始 message、req 语言解析、fallbackKey 被 5xx 屏蔽。
// 不启动 server，纯函数级断言。
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { handleRouteError } from "@/lib/api-error";

function makeReq(acceptLanguage?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (acceptLanguage) headers["accept-language"] = acceptLanguage;
  return new NextRequest("https://example.com/api/x", { headers });
}

// 构造一个真实的 ZodError 实例（用 safeParse 失败结果，避免依赖内部构造器签名）。
function makeZodError(): z.ZodError {
  return z.string().safeParse(123).error!;
}

describe("handleRouteError", () => {
  let originalEnv: string | undefined;
  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("ZodError → 422 + validation_failed（生产环境中文）", async () => {
    process.env.NODE_ENV = "production";
    const res = handleRouteError(makeZodError(), { req: makeReq() });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("参数校验失败");
  });

  it("ZodError → 422 + 英文错误文案（Accept-Language: en）", async () => {
    process.env.NODE_ENV = "production";
    const res = handleRouteError(makeZodError(), { req: makeReq("en-US") });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Parameter validation failed");
  });

  it("ZodError → 开发模式返回 key + 翻译文案", async () => {
    process.env.NODE_ENV = "development";
    const res = handleRouteError(makeZodError());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("validation_failed: 参数校验失败");
  });

  it("普通 Error → 生产模式 500 脱敏为 internal_error（不暴露 message）", async () => {
    process.env.NODE_ENV = "production";
    const res = handleRouteError(new Error("SELECT * FROM users"), { req: makeReq() });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
    expect(body.error).not.toContain("SELECT");
  });

  it("普通 Error → 开发模式 500 返回原始 message", async () => {
    process.env.NODE_ENV = "development";
    const res = handleRouteError(new Error("db connection refused"), { req: makeReq() });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db connection refused");
  });

  it("生产模式英文错误文案（Accept-Language: en）", async () => {
    process.env.NODE_ENV = "production";
    const res = handleRouteError(new Error("boom"), { req: makeReq("en-US") });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("fallbackKey 在生产模式被 5xx 屏蔽（始终 internal_error）", async () => {
    process.env.NODE_ENV = "production";
    const res = handleRouteError(new Error("boom"), {
      fallbackKey: "stats_failed",
      req: makeReq("en-US"),
    });
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("字符串错误（非 Error 对象）也能被处理，不抛异常", async () => {
    process.env.NODE_ENV = "production";
    const res = handleRouteError("plain string error", { req: makeReq() });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("服务器内部错误");
  });
});
