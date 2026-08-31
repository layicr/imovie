// lib/api-error.ts — API 统一错误处理与错误响应构造。 / Unified API error handling and error-response construction.
// 所有 Route Handler 通过本模块返回一致结构的 JSON 错误体，并在生产环境脱敏内部细节。
// Every Route Handler returns a consistent JSON error body via this module, with internal details hidden in production.
import { NextRequest, NextResponse } from "next/server";
import {
  errorMessages,
  translateError,
  type ErrorKey,
  type Lang,
} from "@/lib/i18n/errors";
import { ZodError } from "zod";

// 从请求头 / 显式语种参数解析目标语种；缺省回退中文。
// Resolve the target language from the request header or an explicit lang arg; defaults to zh.
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

// 判断字符串是否为合法的 ErrorKey（即字典中存在对应文案）。
// Whether a string is a valid ErrorKey (has a matching entry in the dictionary).
function isErrorKey(value: string): value is ErrorKey {
  return value in errorMessages.zh;
}

/**
 * API 统一错误响应。
 * Unified API error response.
 * - 开发环境返回原始 message，便于调试。
 * - Dev returns the raw message for easy debugging.
 * - 生产环境隐藏内部细节，避免泄露堆栈/文件路径/SQL 片段。
 * - Prod hides internals to avoid leaking stack traces / file paths / SQL fragments.
 * - message 支持国际化 key（ErrorKey）或直接文本；生产环境优先使用翻译后的文本。
 * - message accepts an ErrorKey or raw text; production prefers the translated text.
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
    // Dev: if a key was passed, also attach its Chinese translation for debugging;
    // 如果是运行时错误原文，直接返回。
    // if it's a raw runtime error, return it verbatim.
    errorText = isErrorKey(messageOrKey)
      ? `${messageOrKey}: ${translateError(messageOrKey, lang)}`
      : messageOrKey;
  } else {
    // 生产环境：统一使用翻译后的文案；5xx 内部错误不暴露原始信息。
    // Prod: use the translated text; 5xx internal errors never expose the raw message.
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
/** Wrap an unknown error so the raw Error is never leaked to the client. */
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

/**
 * 统一封装 Route Handler 的异常响应：
 * Wrap a Route Handler's exception into a unified response:
 * - ZodError → 422 validation_failed（响应体附带字段级校验细节 details）
 * - ZodError → 422 validation_failed (body carries field-level details)
 * - 其余未知错误 → apiErrorFromUnknown（生产环境隐藏内部细节）
 * - any other error → apiErrorFromUnknown (internals hidden in production)
 * 用法：`catch (e) { return handleRouteError(e, { fallbackKey: "query_failed", req }); }`
 * Usage: `catch (e) { return handleRouteError(e, { fallbackKey: "query_failed", req }); }`
 */
export function handleRouteError(
  error: unknown,
  opts?: { fallbackKey?: ErrorKey; req?: NextRequest }
): NextResponse {
  if (error instanceof ZodError) {
    const details = error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return apiError("validation_failed", 422, { details }, opts?.req);
  }
  return apiErrorFromUnknown(error, opts?.fallbackKey ?? "operation_failed", opts?.req);
}
