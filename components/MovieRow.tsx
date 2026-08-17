"use client";

import PosterCard from "./PosterCard";
import type { RecordRow } from "@/lib/types";

// 横向内容行：标题 + 海报墙。
// 移动端：横向滑动（snap + 隐藏滚动条），还原 Netflix 横向手感；
// 桌面端（md+）：自动换行铺满，避免大屏留白浪费。
export default function MovieRow({
  title,
  records,
}: {
  title: string;
  records: RecordRow[];
}) {
  if (!records.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-2xl tracking-wide">{title}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {records.map((r) => (
          <PosterCard key={r.rec_id} rec={r} />
        ))}
      </div>
    </section>
  );
}
