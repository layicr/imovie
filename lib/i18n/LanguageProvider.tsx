"use client";

// lib/i18n/LanguageProvider.tsx — 客户端语言上下文。 / Client-side language context.
// 提供 lang / setLang / t，并负责持久化到 localStorage、同步 <html lang> 与 <title>。
// Exposes lang / setLang / t, persists to localStorage, and keeps <html lang> and <title> in sync.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translations, type Lang } from "./translations";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: (string | number)[]) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "imovie-lang";

// 决定初始语言：本地存储优先，其次浏览器语言，最后回退中文。
// Decide the initial language: localStorage first, then browser language, fallback zh.
function getInitialLang(): Lang {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "zh" || saved === "en") return saved;
  }
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.toLowerCase() || "";
    if (nav.startsWith("en")) return "en";
  }
  return "zh";
}

/**
 * 语言上下文 Provider：包裹整个应用，向子树提供 lang / setLang / t。
 * Language context provider: wraps the app and exposes lang / setLang / t to the subtree.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  // 首屏默认中文，确保 SSR 与客户端首次渲染一致；挂载后再按本地存储/浏览器切换，
  // 避免 hydration mismatch。
  // Default to zh on first paint so SSR and the first client render match; switch after mount to avoid hydration mismatch.
  const [lang, setLangState] = useState<Lang>("zh");
  const [hydrated, setHydrated] = useState(false);

  // 读取本地存储（或浏览器语言）决定初始语言
  // Read localStorage (or browser language) to decide the initial language.
  useEffect(() => {
    setLangState(getInitialLang());
    setHydrated(true);
  }, []);

  // 语言变化时：持久化 + 同步 <html lang> 与 <title>，利于 SEO / 无障碍 / 标签页标题跟随切换
  // On language change: persist + sync <html lang> and <title> for SEO / a11y / tab-title follow.
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

  const setLang = useCallback((l: Lang) => setLangState(l), []);

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
