"use client";

import FeedbackButton from "./FeedbackButton";
import BackToTop from "./BackToTop";

// 右下角浮动操作区：反馈问题 + 返回顶部，固定悬浮于全站右下角。
export default function FloatingActions() {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-center gap-3">
      <FeedbackButton />
      <BackToTop />
    </div>
  );
}
