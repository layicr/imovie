// 生成「北京时间（UTC+8）」字符串，格式与 SQLite datetime('now','+8 hours') 完全一致：
// 'YYYY-MM-DD HH:MM:SS'。集中在此，供 queries / 反馈等模块复用，避免时区与格式漂移。

export function beijingNow(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}
