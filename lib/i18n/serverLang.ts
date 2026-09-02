// lib/i18n/serverLang.ts — 服务端语言解析（由 middleware 注入的 x-lang 请求头决定）。
// Server-side language resolution: reads the x-lang request header that middleware injects.
import { headers } from "next/headers";
import type { Lang } from "./translations";

// 从请求头取语言；仅 zh/en 有效，缺省回退中文。
// Resolve lang from the request header; only zh/en are valid, defaulting to zh.
export async function getServerLang(): Promise<Lang> {
  const h = await headers();
  return h.get("x-lang") === "en" ? "en" : "zh";
}
