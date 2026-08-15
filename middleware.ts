import { NextRequest, NextResponse } from "next/server";

// 站点密码中间件（HTTP Basic）。
// 行为：
//   - 设置了 SITE_PASSWORD：全站（浏览页面 + 读/写 API）都需通过 HTTP Basic 认证，
//     保护私人观影数据。
//   - 未设置（留空）：所有请求直接放行（本地/公网友好，无密码保护）。
// 用户名任意，仅校验密码，方便单人使用。
// 匹配规则排除静态资源，避免无谓拦截。

// 恒定时间比较，避免密码校验的时序侧信道
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString();
      const sep = decoded.indexOf(":");
      const pass = sep >= 0 ? decoded.slice(sep + 1) : "";
      if (safeEqual(pass, password)) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="iMOVIE"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
