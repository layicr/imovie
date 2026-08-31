/** @type {import('next').NextConfig} */

// 是否走本地文件库（与 lib/db.ts 判断一致）：无 DATABASE_URL 或 file: 开头 → 本地。
// 本地文件库需要把 data/local.db 与 schema.sql 打包进 Serverless 函数；
// libsql:// 等远程库则无需本地文件，跳过打包，避免无效体积。
const useLocalDb =
  !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:");

// data 目录随项目入库的文件仅两个（data/ 下其余内容不应上传）：
//   - data/local.db   运行必需的只读数据库（见 lib/db.ts）
//   - data/schema.sql 建表用的 DDL（见 lib/db.ts applySchema）
const dataTraceFiles = ["./data/local.db", "./data/schema.sql"];

const nextConfig = {
  // 隐藏 X-Powered-By 响应头，避免泄露技术栈版本
  poweredByHeader: false,

  // 仅允许白名单内的图片域名，防止通过图片组件发起任意外链请求（SSRF / 外链滥用）
  images: {
    // 关闭服务端图片优化器：经 Node 代理拉取 TMDb/CDN 原图在国内网络下易遇
    // ECONNRESET 导致 /_next/image 500；改为浏览器端直连 CDN，避免代理失败。
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },

  // 运行期由 lib/db.ts 通过 fs 动态打开 data/ 下的文件（无 import 链），
  // Next.js 默认不会把它打包进 Serverless 函数。显式声明将其纳入 trace，
  // 否则 Vercel 上读到的会是 connect() 时新建的空库（或找不到文件）→ 无数据。
  // 关键点：页面（Server Component：/、/detail/[id]、/search、/report）与
  // /api/** 都会查库，必须**同时**把这些入口都列入，否则只有 API 函数能拿到文件。
  ...(useLocalDb && {
    outputFileTracingIncludes: {
      "/": dataTraceFiles,
      "/detail/[id]": dataTraceFiles,
      "/search": dataTraceFiles,
      "/report": dataTraceFiles,
      "/api/**/*": dataTraceFiles,
    },
  }),

  // 全局安全响应头（公网部署加固）
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 图片：TMDb CDN、picsum 占位图（含其 CDN 重定向域名 fastly.picsum.photos）/ next/image 优化后的本地代理 / data URI
              "img-src 'self' https://image.tmdb.org https://picsum.photos https://fastly.picsum.photos data:",
              // 字体：同源（next/font 自托管的 Inter / Bebas Neue）+ Google Fonts（仅中文 Noto Sans SC 经 <link> 引入的 CSS 与字体文件）
              "font-src 'self' https://fonts.gstatic.com",
              // 脚本：同源 + 内联脚本（Next.js webpack runtime / react-refresh 运行时为内联）+ 'unsafe-eval'（dev 的 react-refresh 需要）
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // 样式：同源 + 内联样式（Next.js 注入）+ Google Fonts CSS
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
