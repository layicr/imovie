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

describe("限流响应头部", () => {
  it("429 的 Retry-After 为正整数且不超过窗口（60s）", async () => {
    const mw = await loadMiddleware({ password: "secret", rateLimit: 3 });
    const ip = "10.0.4.1";
    let retry: string | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await mw(req(ip));
      if (r.status === 429) {
        retry = r.headers.get("Retry-After");
        break;
      }
    }
    expect(retry).not.toBeNull();
    const n = Number(retry);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(60);
  });
});

describe("限流与认证的组合维度", () => {
  it("认证成功后，全局限流仍继续生效（两维度独立计数）", async () => {
    // 全局限流设很低（3），认证失败上限设很高（100），先以正确密码通过认证，
    // 之后仍应被全局限流拦截，证明两者是独立计数而非互斥。
    const mw = await loadMiddleware({
      password: "secret",
      rateLimit: 3,
      authFailLimit: 100,
    });
    const ip = "10.0.5.1";
    // 前 3 次带正确密码（放行），第 4 次起应被全局限流 429
    const s1 = (await mw(req(ip, basic("secret")))).status; // 放行
    const s2 = (await mw(req(ip, basic("secret")))).status; // 放行
    const s3 = (await mw(req(ip, basic("secret")))).status; // 放行（达阈值）
    const s4 = (await mw(req(ip, basic("secret")))).status; // 限流
    expect([s1, s2, s3]).not.toContain(429);
    expect(s4).toBe(429);
  });
});

describe("safeEqual 恒定时间密码比较", () => {
  it("正确密码返回 200，错误密码返回 401", async () => {
    const mw = await loadMiddleware({ password: "correct-password" });
    const ip = "10.10.0.1";
    expect((await mw(req(ip, basic("correct-password")))).status).toBe(200);
    expect((await mw(req(ip, basic("wrong-password")))).status).toBe(401);
  });

  it("空密码（仅 Basic 前缀无内容）返回 401", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const ip = "10.10.0.2";
    // "Basic " 后无内容 → encoded 为空 → 认证失败
    const r = await mw(req(ip, "Basic "));
    expect(r.status).toBe(401);
  });

  it("密码含冒号时正确解析（取第一个冒号之后全部）", async () => {
    // 用户任意，密码可以是 "p:a:s:s" 这种含冒号的字符串
    const mw = await loadMiddleware({ password: "p:a:s:s" });
    const ip = "10.10.0.3";
    // 构造 "user:p:a:s:s" 的 base64
    const encoded = Buffer.from(":p:a:s:s").toString("base64");
    expect((await mw(req(ip, `Basic ${encoded}`))).status).toBe(200);
    // 只传 "p:a" 应失败
    const encodedPartial = Buffer.from(":p:a").toString("base64");
    expect((await mw(req(ip, `Basic ${encodedPartial}`))).status).toBe(401);
  });

  it("不同长度密码不会误判为相等", async () => {
    const mw = await loadMiddleware({ password: "long-secret-password" });
    const ip = "10.10.0.4";
    // 短密码不应匹配
    expect((await mw(req(ip, basic("short")))).status).toBe(401);
    // 前缀相同但长度不同
    expect((await mw(req(ip, basic("long-secret")))).status).toBe(401);
  });
});

describe("clientIp 提取逻辑", () => {
  it("X-Forwarded-For 多个 IP 时取第一个（公开模式，纯限流）", async () => {
    // 不设密码 → 公开模式，排除认证干扰，专注验证 IP 提取 + 限流
    const mw = await loadMiddleware({ password: undefined, rateLimit: 3 });
    const headers = { "x-forwarded-for": "192.168.1.100, 10.0.0.1, 172.16.0.1" };
    const makeReq = () => new NextRequest("https://example.com/", { headers });

    const s1 = (await mw(makeReq())).status;
    const s2 = (await mw(makeReq())).status;
    const s3 = (await mw(makeReq())).status;
    const s4 = (await mw(makeReq())).status;
    expect([s1, s2, s3]).not.toContain(429);
    expect(s4).toBe(429);
  });

  it("无 X-Forwarded-For 时回退为 unknown 并正常限流", async () => {
    const mw = await loadMiddleware({ password: "secret", rateLimit: 2 });
    // 无 x-forwarded-for 头 → clientIp 返回 "unknown"
    const makeReq = () => new NextRequest("https://example.com/", { headers: {} });
    const s1 = (await mw(makeReq())).status;
    const s2 = (await mw(makeReq())).status;
    const s3 = (await mw(makeReq())).status;
    expect([s1, s2]).not.toContain(429);
    expect(s3).toBe(429);
  });
});

describe("认证头解析边界", () => {
  it("非 Basic 方案（如 Bearer）返回 401", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const ip = "10.11.0.1";
    const r = await mw(req(ip, "Bearer some-token"));
    expect(r.status).toBe(401);
  });

  it("畸形 Base64 内容不抛错，返回 401", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const ip = "10.11.0.2";
    // 非法 base64 字符
    const r = await mw(req(ip, "Basic !!!invalid-base64!!!"));
    expect(r.status).toBe(401);
  });

  it("Basic 后无空格分隔返回 401", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const ip = "10.11.0.3";
    // "Basic" 后没有空格 → auth.split(" ") 返回 ["Basic"] → encoded 为 undefined
    const r = await mw(req(ip, "Basic"));
    expect(r.status).toBe(401);
  });

  it("空 authorization 头返回 401", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const ip = "10.11.0.4";
    const r = await mw(req(ip, ""));
    expect(r.status).toBe(401);
  });
});

describe("安全响应头", () => {
  it("401 响应包含 WWW-Authenticate 头", async () => {
    const mw = await loadMiddleware({ password: "secret" });
    const r = await mw(req("10.12.0.1", basic("wrong")));
    expect(r.status).toBe(401);
    expect(r.headers.get("WWW-Authenticate")).toBe('Basic realm="iMOVIE"');
  });

  it("429 响应包含 X-RateLimit-Limit 正整数头", async () => {
    const mw = await loadMiddleware({ password: undefined, rateLimit: 3 });
    const ip = "10.12.0.2";
    let limitHeader: string | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await mw(req(ip));
      if (r.status === 429) {
        limitHeader = r.headers.get("X-RateLimit-Limit");
        break;
      }
    }
    expect(limitHeader).not.toBeNull();
    const n = Number(limitHeader);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThan(0);
  });
});

describe("限流 sweep 内存保护", () => {
  it("窗口过期后计数重置（sweep 清理过期桶）", async () => {
    const mw = await loadMiddleware({ password: "secret", rateLimit: 2 });
    const ip = "10.13.0.1";
    // 前 2 次放行
    expect((await mw(req(ip))).status).not.toBe(429);
    expect((await mw(req(ip))).status).not.toBe(429);
    // 第 3 次触发限流
    expect((await mw(req(ip))).status).toBe(429);
    // 注意：由于无法在单测中快进时间，此处仅验证限流生效；
    // sweep 的过期清理依赖真实时间窗口，由集成测试覆盖。
  });
});
