"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { FEEDBACK_GITHUB_URL } from "@/lib/config";

// 右下角「反馈问题」按钮：点击在新标签页打开 GitHub 反馈链接（Issues 页）。
export default function FeedbackButton() {
  const { t } = useLanguage();

  return (
    <a
      href={FEEDBACK_GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("fb.button")}
      title={t("fb.button")}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:bg-red-700"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
