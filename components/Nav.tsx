"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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

  const links = NAV_LINKS;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      setOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-gradient-to-b from-ink/95 to-ink/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
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

        {/* 桌面端搜索框 */}
        <form onSubmit={submit} className="ml-auto hidden max-w-xs flex-1 sm:block">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("nav.searchPlaceholder")}
            className="w-full rounded border border-line bg-panel px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </form>

        <LanguageSwitcher />

        {/* 移动端汉堡按钮 */}
        <button
          className="ml-auto text-white md:hidden"
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
              className="block py-2 text-sm text-subtle hover:text-white"
            >
              {t(l.key)}
            </Link>
          ))}
          <form onSubmit={submit} className="py-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("nav.searchPlaceholder")}
              className="w-full rounded border border-line bg-panel px-3 py-1.5 text-sm"
            />
          </form>
        </div>
      ) : null}
    </header>
  );
}
