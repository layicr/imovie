"use client";

// components/LanguageSwitcher.tsx — 语言切换分段控件（持久化到 localStorage）。 / Language switch segmented control (persisted to localStorage).
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LANGS } from "@/lib/i18n/translations";

// 语言切换：顶部导航右侧的小型分段控件，点击即切换全站语言（持久化到 localStorage）。
// Language switch: a small segmented control on the nav right; click switches the whole site (persisted to localStorage).
export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center rounded-full border border-line bg-panel p-0.5 text-xs">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={
            "rounded-full px-2.5 py-1 transition-colors " +
            (lang === l.code ? "bg-brand text-white" : "text-subtle hover:text-white")
          }
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
