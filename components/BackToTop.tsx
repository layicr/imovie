"use client";

// components/BackToTop.tsx — 右下角「返回顶部」浮动按钮（滚动后出现）。 / Bottom-right "back to top" floating button (appears after scrolling).
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

// 右下角「返回顶部」按钮：滚动超过一定距离后出现，点击平滑回到页面顶部。
// Back-to-top button: appears after scrolling past a threshold; click smoothly scrolls to the top.
export default function BackToTop() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("top.aria")}
      title={t("top.aria")}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-panel text-white shadow-lg ring-1 ring-line hover:text-brand"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 19V5M5 12l7-7 7 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
