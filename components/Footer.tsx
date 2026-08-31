"use client";

// components/Footer.tsx — 站点页脚（标语 + 友情链接）。 / Site footer (tagline + friend links).
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { FOOTER_LINKS, SITE_NAME } from "@/lib/config";

// 友情链接：站点底部展示，外链统一新开页并加安全属性；文案随语言切换。
// Footer links: shown at the bottom; external links open in a new tab with safe rel; copy is localized.
export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="mt-12 border-t border-line bg-ink">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <div className="font-display text-xl tracking-widest text-brand">
              {SITE_NAME}
            </div>
            <p className="mt-2 space-y-1 text-xs leading-relaxed text-subtle">
              <span className="block">{t("footer.tagline1")}</span>
              <span className="block">{t("footer.tagline2")}</span>
            </p>
          </div>

          {/* 友情链接区 */}
          <nav aria-label={t("footer.linksTitle")} className="flex flex-col gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-subtle">
              {t("footer.linksTitle")}
            </h2>
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {FOOTER_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-subtle transition-colors hover:text-brand"
                  >
                    {t(l.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-6 border-t border-line pt-4 text-center text-xs text-subtle">
          © {new Date().getFullYear()} {SITE_NAME} · layicr
        </div>
      </div>
    </footer>
  );
}
