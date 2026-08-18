export const errorMessages = {
  zh: {
    invalid_year: "无效年份",
    invalid_item_id: "无效 item_id",
    not_found: "未找到该影片",
    query_failed: "查询失败",
    stats_failed: "统计失败",
    validation_failed: "参数校验失败",
    operation_failed: "操作失败",
    internal_error: "服务器内部错误",
  },
  en: {
    invalid_year: "Invalid year",
    invalid_item_id: "Invalid item_id",
    not_found: "The requested item was not found",
    query_failed: "Query failed",
    stats_failed: "Statistics failed",
    validation_failed: "Parameter validation failed",
    operation_failed: "Operation failed",
    internal_error: "Internal server error",
  },
} as const;

export type ErrorKey = keyof typeof errorMessages.zh;
export type Lang = "zh" | "en";

export function translateError(key: ErrorKey, lang: Lang = "zh"): string {
  return errorMessages[lang][key] ?? errorMessages.zh[key];
}
