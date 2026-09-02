// middleware.ts — 解析语言并注入请求头 / 写入 cookie，供服务端渲染与 hreflang 使用。
// Resolve language and inject a request header / cookie so SSR and hreflang can react to it.
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "imovie-lang";
const QUERY = "lang";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const fromQuery = url.searchParams.get(QUERY);
  const fromCookie = req.cookies.get(COOKIE)?.value;

  // 优先级：URL 的 ?lang= 覆盖 cookie，否则回退中文。
  // Precedence: ?lang= in the URL overrides the cookie; otherwise fall back to zh.
  const lang = fromQuery === "en" || fromCookie === "en" ? "en" : "zh";

  const res = NextResponse.next();

  // 若 URL 带 ?lang= 且与 cookie 不一致，写回 cookie，让分享链接落地后记住选择。
  // If the URL carries ?lang= and it differs from the cookie, persist it so shared links stick.
  if ((fromQuery === "en" || fromQuery === "zh") && fromQuery !== fromCookie) {
    res.cookies.set(COOKIE, lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // 注入请求头，供 Server Component 的 headers() 读取（语言真相以服务端为准）。
  // Inject the header for Server Components' headers() to read (server is the source of truth).
  res.headers.set("x-lang", lang);
  return res;
}

export const config = {
  // 跳过 API、Next 内部资源与静态文件，避免无谓开销。
  // Skip API, Next internals and static assets to avoid needless overhead.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
