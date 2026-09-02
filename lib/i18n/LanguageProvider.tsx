"use client";

// lib/i18n/LanguageProvider.tsx — 客户端语言上下文。 / Client-side language context.
// 提供 lang / setLang / t；语言真相以服务端（cookie，由 middleware 注入）为准，
// 首屏语言由 SSR 注入（initialLang），保证 SSR 与客户端首帧一致，利于 SEO 与避免 hydration mismatch。
// Exposes lang / setLang / t; the source of truth is the server (cookie via middleware),
// and the first paint uses the SSR-injected language to keep SSR and first client frame in sync (SEO + no mismatch).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { translations, type Lang } from "./translations";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: (string | number)[]) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "imovie-lang";
const COOKIE = "imovie-lang";

// 把语言写入 cookie（供服务端 / middleware 读取）
// Persist the language to a cookie for the server / middleware to read.
function writeLangCookie(l: Lang) {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }
}

// 仅客户端回退：读 localStorage 的同名 key（与 SSR 的 cookie 最终保持一致）。
// Client-only fallback: read the same key from localStorage (kept in sync with the server cookie).
function readLocalLang(): Lang {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "zh" || saved === "en") return saved;
  }
  return "zh";
}

/**
 * 语言上下文 Provider：包裹整个应用，向子树提供 lang / setLang / t。
 * Language context provider: wraps the app and exposes lang / setLang / t to the subtree.
 */
export function LanguageProvider({
  children,
  initialLang = "zh",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  // 首屏语言由 SSR 注入（initialLang），保证 SSR 与客户端首帧一致；挂载后再做边缘同步。
  // First paint uses the SSR-injected language so SSR and first client frame match; edge-sync after mount.
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  // 挂载后：若本地存储与 SSR 值不一致（极少数边缘情况），以本地存储为准同步一次。
  // After mount: if localStorage disagrees with the SSR value (rare edge case), sync once to localStorage.
  useEffect(() => {
    const local = readLocalLang();
    if (local !== initialLang) setLangState(local);
    setHydrated(true);
  }, [initialLang]);

  // 语言变化：持久化（localStorage + cookie）+ 同步 <html lang> 与 <title>，利于 SEO / 无障碍 / 标签页标题跟随切换。
  // On change: persist (localStorage + cookie) and sync <html lang> and <title> for SEO / a11y / tab-title follow.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
      document.title = translations[lang]["site.title"] ?? translations.zh["site.title"];
    }
    if (typeof localStorage !== "undefined" && hydrated) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, [lang, hydrated]);

  // t：按 key 取译文，支持 {0}{1} 占位替换为 vars。
  // t: look up a translation by key, with {0}{1} placeholder substitution from vars.
  const t = useCallback(
    (key: string, vars?: (string | number)[]) => {
      let s: string = translations[lang][key] ?? translations.zh[key] ?? key;
      if (vars) {
        vars.forEach((v, i) => {
          s = s.replace(new RegExp(`\\{${i}\\}`, "g"), String(v));
        });
      }
      return s;
    },
    [lang]
  );

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, l);
      writeLangCookie(l);
      // 触发服务端重渲染：更新 <html lang> 与 metadata（title / canonical / hreflang）。
      // Trigger a server re-render so <html lang> and metadata (title / canonical / hreflang) refresh.
      router.refresh();
    },
    [router]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * 读取语言上下文；必须在 <LanguageProvider> 内使用，否则抛错。
 * Consume the language context; must be used inside <LanguageProvider> or it throws.
 */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within <LanguageProvider>");
  return ctx;
}
