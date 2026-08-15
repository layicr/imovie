"use client";

import PosterCard from "./PosterCard";
import type { RecordRow } from "@/lib/types";

// 横向内容行：标题 + 可横向滑动的海报墙（桌面与移动端一致，触控友好）。
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
      <div className="flex flex-wrap gap-3 pb-4">
        {records.map((r) => (
          <PosterCard key={r.rec_id} rec={r} />
        ))}
      </div>
    </section>
  );
}
