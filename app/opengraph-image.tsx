// app/opengraph-image.tsx — 全局默认社交分享图（首页/报表/搜索等未单独设置 og:image 的页面复用）。
// Global default social share image (reused by home/report/search and any page without its own og:image).
import { ImageResponse } from "next/og";

export const alt = "iMOVIE · My Movie Diary";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 默认图仅用英文标语，避免 ImageResponse 缺中文字体导致乱码；详情页会以海报图覆盖本图。
// The default image uses English only to avoid missing-CJK-font artifacts; detail pages override it with the poster.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b0b0f 0%, #1a1a2e 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ fontSize: 128, fontWeight: 800, letterSpacing: 6 }}>iMOVIE</div>
        <div style={{ fontSize: 34, opacity: 0.75, marginTop: 12 }}>My Movie Diary</div>
      </div>
    ),
    { ...size }
  );
}
