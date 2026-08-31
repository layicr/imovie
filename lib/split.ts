// lib/split.ts — 多值字段拆分工具。 / Multi-value field splitting utility.
//
// 统一拆分多值字段（导演/演员/类型/制片国家等）。
// Unified splitting for multi-value fields (director / cast / genre / country…).
// 兼容「 / 」「,」「，」「/」「、」及前后空白，split 后 trim 并过滤空值，
// Compatible with " / ", ",", "，", "/", "、" and surrounding whitespace; trims and drops empties,
// 消除详情页与 listFacets 各自写正则导致的规则漂移。
// so the detail page and listFacets no longer drift from separate regexes.

/**
 * 将多值字段按分隔符拆分为字符串数组；入参为空时返回空数组。
 * Split a multi-value field into a string array by delimiters; returns [] when input is empty.
 */
export function splitMultiValue(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\/\s、,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
