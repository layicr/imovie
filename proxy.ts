import { NextRequest, NextResponse } from "next/server";

// 站点密码中间件（HTTP Basic）。
// 行为：
//   - 设置了 SITE_PASSWORD：全站（浏览页面 + 读/写 API）都需通过 HTTP Basic 认证，
//     保护私人观影数据。
//   - 未设置（留空）：所有请求直接放行（本地/公网友好，无密码保护）。
// 用户名任意，仅校验密码，方便单人使用。
// 匹配规则排除静态资源，避免无谓拦截。
//
// 限流（#5）：在 Edge Runtime 下用模块级 Map 做固定窗口计数（warm 实例内持久）。
//   - 全局请求速率：每 IP 60s 内最多 RATE_LIMIT 次，超出返回 429（防爬取/滥用）。
//   - 认证失败防爆破：每 IP 60s 内最多 AUTH_FAIL_LIMIT 次失败，超出返回 429（缓解 Basic 暴力破解）。
//     注意：Serverless 多实例各自独立计数，无法跨实例共享；作为基础防护，
//     如需全局一致限流应改用边缘 KV（如 Upstash Redis）。

// 恒定时间比较，避免密码校验的时序侧信道（Edge Runtime 无 node:crypto，用 TextEncoder + XOR 累积）。
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

// 限流窗口配置（次 / 毫秒）
const WINDOW_MS = 60_000;
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 120); // 全局每 IP 请求上限
const AUTH_FAIL_LIMIT = Number(process.env.AUTH_FAIL_LIMIT ?? 20); // 认证失败上限
const MAX_BUCKETS = 2000; // 单个 map 最多保留的桶数，防止异常 IP 风暴撑爆内存

type Bucket = { count: number; resetAt: number };
// 全局请求计数：key = "r:<ip>"
const rateBuckets = new Map<string, Bucket>();
// 认证失败计数：key = "a:<ip>"
const authFailBuckets = new Map<string, Bucket>();

function clientIp(req: NextRequest): string {
  // Next 16 的 NextRequest 已移除 `ip` 字段，统一从 x-forwarded-for 取首个地址
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

// 固定窗口计数：返回剩余可请求次数（负数表示已超限，其绝对值为超出量）
function hit(map: Map<string, Bucket>, key: string, limit: number, now: number): number {
  const b = map.get(key);
  if (!b || b.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return limit - 1;
  }
  b.count += 1;
  return limit - b.count;
}

// 清理过期窗口并限制总容量，避免 Map 无限增长（每次请求顺带执行）。
// 策略：先删除所有过期桶；若仍超限，则删除最早到期的桶（近似 LRU）。
function sweep(map: Map<string, Bucket>, now: number) {
  const expired: string[] = [];
  const active: Array<{ key: string; resetAt: number }> = [];
  for (const [k, v] of map) {
    if (v.resetAt <= now) {
      expired.push(k);
    } else {
      active.push({ key: k, resetAt: v.resetAt });
    }
  }
  for (const k of expired) map.delete(k);

  if (map.size > MAX_BUCKETS) {
    active.sort((a, b) => a.resetAt - b.resetAt);
    const toEvict = active.slice(0, map.size - MAX_BUCKETS);
    for (const { key } of toEvict) map.delete(key);
  }
}

function tooMany(remaining: number, resetAt: number, limit: number): NextResponse | null {
  if (remaining >= 0) return null;
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limit),
    },
  });
}

const LANG_COOKIE = "imovie-lang";
const LANG_QUERY = "lang";

// 语言解析：从 ?lang= 或 imovie-lang cookie 取语言，注入 x-lang 头供 SSR 的 getServerLang 读取。
// 仅对页面请求注入；API 请求跳过，避免给 JSON 响应增加无用头 / 写 cookie。
// （由原本的 middleware.ts 迁移而来，因 Next.js 不允许 middleware.ts 与 proxy.ts 并存。）
function withLang(req: NextRequest, res: NextResponse): NextResponse {
  const url = req.nextUrl;
  if (url.pathname.startsWith("/api/")) return res;

  const fromQuery = url.searchParams.get(LANG_QUERY);
  const fromCookie = req.cookies.get(LANG_COOKIE)?.value;
  const lang = fromQuery === "en" || fromCookie === "en" ? "en" : "zh";

  // 若 URL 带 ?lang= 且与 cookie 不一致，写回 cookie，让分享链接落地后记住选择。
  if ((fromQuery === "en" || fromQuery === "zh") && fromQuery !== fromCookie) {
    res.cookies.set(LANG_COOKIE, lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  res.headers.set("x-lang", lang);
  return res;
}

export function proxy(req: NextRequest) {
  const now = Date.now();
  const ip = clientIp(req);
  sweep(rateBuckets, now);
  sweep(authFailBuckets, now);

  // 全局请求速率限制（始终生效，包括未设密码的公开模式）
  const remaining = hit(rateBuckets, `r:${ip}`, RATE_LIMIT, now);
  const blocked = tooMany(remaining, rateBuckets.get(`r:${ip}`)!.resetAt, RATE_LIMIT);
  if (blocked) return blocked;

  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return withLang(req, NextResponse.next());
  }

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString();
      const sep = decoded.indexOf(":");
      const pass = sep >= 0 ? decoded.slice(sep + 1) : "";
      if (safeEqual(pass, password)) {
        // 认证成功：清除该 IP 的失败计数，避免误伤正常用户
        authFailBuckets.delete(`a:${ip}`);
        return withLang(req, NextResponse.next());
      }
    }
  }

  // 认证失败：累计失败次数，超限则临时封锁
  const failRemaining = hit(authFailBuckets, `a:${ip}`, AUTH_FAIL_LIMIT, now);
  const failBlocked = tooMany(
    failRemaining,
    authFailBuckets.get(`a:${ip}`)!.resetAt,
    AUTH_FAIL_LIMIT
  );
  if (failBlocked) return failBlocked;

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="iMOVIE"' },
  });
}

export const config = {
  // 排除 API 静态资源、图标，以及 robots.txt / sitemap.xml（SEO 资源须公开可抓，
  // 即便设置了 SITE_PASSWORD 也不应被 Basic 认证拦截）。
  // Exclude API static assets, the favicon, and robots.txt / sitemap.xml (SEO assets must
  // stay publicly crawlable even when SITE_PASSWORD is set, so Basic auth must not block them).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
