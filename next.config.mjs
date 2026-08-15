/** @type {import('next').NextConfig} */
const nextConfig = {
  // 隐藏 X-Powered-By 响应头，避免泄露技术栈版本
  poweredByHeader: false,

  // 仅允许白名单内的图片域名，防止通过图片组件发起任意外链请求（SSRF / 外链滥用）
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },

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
              // 字体：同源 + Google Fonts（项目用 <link> 引入 Inter / Noto Sans SC / Bebas Neue）
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
