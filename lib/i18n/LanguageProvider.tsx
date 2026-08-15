"use client";

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

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 首屏默认中文，避免与 SSR 输出不一致导致 hydrate 报错；挂载后再按本地存储/浏览器切换。
  const [lang, setLangState] = useState<Lang>("zh");

  // 读取本地存储（或浏览器语言）决定初始语言
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved === "zh" || saved === "en") {
      setLangState(saved);
      return;
    }
    const nav = (typeof navigator !== "undefined" && navigator.language?.toLowerCase()) || "";
    if (nav.startsWith("en")) setLangState("en");
  }, []);

  // 语言变化时：持久化 + 同步 <html lang> 与 <title>，利于 SEO / 无障碍 / 标签页标题跟随切换
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
      document.title = translations[lang]["site.title"] ?? translations.zh["site.title"];
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, [lang]);

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

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within <LanguageProvider>");
  return ctx;
}
