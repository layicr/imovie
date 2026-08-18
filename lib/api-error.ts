import { NextRequest, NextResponse } from "next/server";
import {
  errorMessages,
  translateError,
  type ErrorKey,
  type Lang,
} from "@/lib/i18n/errors";

function resolveLang(input?: NextRequest | Lang): Lang {
  if (typeof input === "string" && (input === "zh" || input === "en")) {
    return input;
  }
  const req = input as NextRequest | undefined;
  if (!req) return "zh";
  const header = req.headers.get("accept-language") ?? "";
  const primary = header.split(",")[0]?.trim().toLowerCase() ?? "";
  return primary.startsWith("en") ? "en" : "zh";
}

function isErrorKey(value: string): value is ErrorKey {
  return value in errorMessages.zh;
}

/**
 * API 统一错误响应。
 * - 开发环境返回原始 message，便于调试。
 * - 生产环境隐藏内部细节，避免泄露堆栈/文件路径/SQL 片段。
 * - message 支持国际化 key（ErrorKey）或直接文本；生产环境优先使用翻译后的文本。
 */
export function apiError(
  messageOrKey: string,
  status: number = 500,
  extra?: Record<string, unknown>,
  langOrReq?: NextRequest | Lang
): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  const lang = resolveLang(langOrReq);

  let errorText: string;
  if (isDev) {
    // 开发环境：如果传入的是 key，也附上对应中文翻译，方便调试；
    // 如果是运行时错误原文，直接返回。
    errorText = isErrorKey(messageOrKey)
      ? `${messageOrKey}: ${translateError(messageOrKey, lang)}`
      : messageOrKey;
  } else {
    // 生产环境：统一使用翻译后的文案；5xx 内部错误不暴露原始信息。
    if (status >= 500) {
      errorText = translateError("internal_error", lang);
    } else {
      errorText = isErrorKey(messageOrKey)
        ? translateError(messageOrKey, lang)
        : messageOrKey;
    }
  }

  const body: Record<string, unknown> = {
    error: errorText,
    ...extra,
  };
  return NextResponse.json(body, { status });
}

/** 包装未知错误，确保不会把原始 Error 直接暴露给客户端。 */
export function apiErrorFromUnknown(
  error: unknown,
  fallbackKey: ErrorKey = "operation_failed",
  langOrReq?: NextRequest | Lang
): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  const isDev = process.env.NODE_ENV === "development";
  const lang = resolveLang(langOrReq);
  if (isDev) {
    return apiError(message, 500, undefined, lang);
  }
  return apiError(translateError(fallbackKey, lang), 500, undefined, lang);
}
