"use client";

import FeedbackButton from "./FeedbackButton";
import BackToTop from "./BackToTop";

// 右下角浮动操作区：反馈问题 + 返回顶部，固定悬浮于全站右下角。
export default function FloatingActions() {
  return (
    <div className="fixed right-5 z-50 flex flex-col items-center gap-3 bottom-[max(1.25rem,env(safe-area-inset-bottom))]">
      <FeedbackButton />
      <BackToTop />
    </div>
  );
}
