// 安全测试：基于 middleware 的限流与 HTTP Basic 认证防护。
// 通过构造 NextRequest 直接调用 middleware 函数（不启动 server），验证：
//  - 限流（#5）：全局每-IP 请求速率上限、认证失败防爆破上限、成功清空失败计数
//  - 认证：设密码时拒绝/放行、未设密码时公开放行
//  - 错误响应不泄露内部细节（无堆栈/路径/模块名）
//
// 注意：middleware 模块顶层读取 process.env.RATE_LIMIT / AUTH_FAIL_LIMIT / SITE_PASSWORD，
// 且模块级 Map 跨用例共享。故每个用例用 vi.resetModules() 重新加载模块，确保从干净状态
// （空计数 Map、正确阈值）开始。断言不依赖具体阈值数字，只验证「前若干次放行、之后持续 429」。
import { vi, describe, it, expect } from "vitest";
import { NextRequest } from "next/server";

function req(ip: string, auth?: string) {
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (auth) headers["authorization"] = auth;
  return new NextRequest("https://example.com/", { headers });
}

function basic(pass: string) {
  return "Basic " + Buffer.from(":" + pass).toString("base64");
}

// 以给定阈值重新加载 middleware（清空模块级计数 Map 并应用新 env）
async function loadMiddleware(opts: {
  password?: string;
  rateLimit?: number;
  authFailLimit?: number;
}) {
  if (opts.password === undefined) delete process.env.SITE_PASSWORD;
  else process.env.SITE_PASSWORD = opts.password;
  process.env.RATE_LIMIT = String(opts.rateLimit ?? 3);
  process.env.AUTH_FAIL_LIMIT = String(opts.authFailLimit ?? 2);
  vi.resetModules();
  return (await import("@/middleware")).middleware;
}

// 断言 status 序列：前两次放行（401/200），之后出现 429 且持续到最后
function expectRateLimited(statuses: number[]) {
  expect(statuses[0]).not.toBe(429);
  expect(statuses[1]).not.toBe(429);
  const first429 = statuses.indexOf(429);
  expect(first429).toBeGreaterThan(1); // 至少放行前两次
  expect(first429).toBeLessThan(statuses.length); // 确实触发了限流
  expect(statuses.slice(first429).every((s) => s === 429)).toBe(true);
}

describe("全局请求限流", () => {
  it("同一 IP 超过阈值后返回 429，且前两次放行", async () => {
    const mw = await loadMiddleware({ password: "secret", rateLimit: 3 });
    const ip = "10.0.0.1";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await mw(req(ip))).status);
    expectRateLimited(statuses);
    // 429 响应带 Retry-After
    let retry: string | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await mw(req(ip));
      if (r.status === 429) {
        retry = r.headers.get("Retry-After");
        break;
      }
    }
    expect(retry).toBeTruthy();
  });

  it("不同 IP 互不影响（各自前两次放行）", async () => {
    const mw = await loadMiddleware({ password: "secret", rateLimit: 3 });
    expect((await mw(req("10.0.0.2"))).status).not.toBe(429);
    expect((await mw(req("10.0.0.3"))).status).not.toBe(429);
  });
});

describe("认证失败防爆破", () => {
  it("连续错误密码超过阈值后返回 429", async () => {
    const mw = await loadMiddleware({
      password: "secret",
      rateLimit: 100,
      authFailLimit: 2,
    });
    const ip = "10.0.1.1";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++)
      statuses.push((await mw(req(ip, basic("wrong")))).status);
    expectRateLimited(statuses);
  });

  it("正确密码放行，并清空该 IP 失败计数（之后错误密码仍放行）", async () => {
    const mw = await loadMiddleware({
      password: "secret",
      rateLimit: 100,
      authFailLimit: 2,
    });
    const ip = "10.0.1.2";
    expect((await mw(req(ip, basic("wrong")))).status).toBe(401);
    expect((await mw(req(ip, basic("secret")))).status).toBe(200);
    // 成功后再次错误密码，应仍为 401（计数已清空，未达上限）
    expect((await mw(req(ip, basic("wrong")))).status).toBe(401);
  });
});

describe("公开模式", () => {
  it("未设 SITE_PASSWORD 时直接放行", async () => {
    const mw = await loadMiddleware({ password: undefined });
    expect((await mw(req("10.0.2.1"))).status).toBe(200);
  });
});

describe("错误响应不泄露内部细节", () => {
  it("401 响应体不含堆栈/路径/模块名", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const r = await mw(req("10.0.3.1", basic("wrong")));
    const body = await r.text();
    expect(body).not.toMatch(/\.ts\b/);
    expect(body).not.toMatch(/at\s+/);
    expect(body).not.toMatch(/stack/i);
    expect(body).toContain("Authentication required");
  });
});
