"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { NAV_LINKS, SITE_NAME } from "@/lib/config";
import LanguageSwitcher from "./LanguageSwitcher";

// 顶部导航：红色 logo + 导航 + 搜索框 + 语言切换；移动端可折叠。
export default function Nav() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goSearch = useCallback(
    (term: string) => {
      if (!term || pathname === "/search") return;
      router.push(`/search?q=${encodeURIComponent(term)}`);
    },
    [pathname, router]
  );

  // 移动端友好：停止输入 600ms 后自动跳搜索页。
  // 使用 useRef 保存定时器，避免每次输入都触发 effect 清理链，也防止回车与时延跳转竞态。
  const debouncedSearch = useCallback(
    (term: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => goSearch(term), 600);
    },
    [goSearch]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const links = NAV_LINKS;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      if (timerRef.current) clearTimeout(timerRef.current);
      goSearch(term);
      setOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-gradient-to-b from-ink/95 to-ink/70 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="font-display text-2xl tracking-widest text-brand">
          {SITE_NAME}
        </Link>

        <nav className="hidden gap-4 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname === l.href ? "text-white" : "text-subtle hover:text-white"
              }
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        {/* 搜索框：移动端常驻（汉堡左侧），桌面端靠右；min-w-0 防止挤压 logo */}
        <form onSubmit={submit} className="ml-auto flex min-w-0 flex-1 items-center sm:max-w-xs">
          <input
            value={q}
            onChange={(e) => {
              const value = e.target.value;
              setQ(value);
              debouncedSearch(value.trim());
            }}
            placeholder={t("nav.searchPlaceholder")}
            className="h-11 w-full rounded border border-line bg-panel px-3 text-sm focus:border-brand focus:outline-none"
          />
        </form>

        <LanguageSwitcher />

        {/* 移动端汉堡按钮（仅展开导航链接分组）；≥44px 触控目标 */}
        <button
          className="flex h-11 w-11 items-center justify-center text-white md:hidden"
          aria-label={t("nav.menu")}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open ? (
        <div className="border-t border-line px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block min-h-[44px] py-3 text-sm text-subtle hover:text-white"
            >
              {t(l.key)}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
