import { GraduationCap, FileSpreadsheet, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

// v1.1.3：網站頁尾（品牌區・三個重點・作者署名）
const APP_VERSION = "1.1.3";

export function SiteFooter() {
  const { t } = useTranslation();

  const points = [
    { Icon: FileSpreadsheet, title: t("footer.point1Title"), desc: t("footer.point1Desc") },
    { Icon: SlidersHorizontal, title: t("footer.point2Title"), desc: t("footer.point2Desc") },
    { Icon: ShieldCheck, title: t("footer.point3Title"), desc: t("footer.point3Desc") },
  ];

  return (
    <footer className="no-print mt-8 border-t border-gray-200 bg-gradient-to-b from-white to-blue-50/70">
      <div className="h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500" aria-hidden="true" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 shrink-0 bg-blue-600 rounded-xl shadow-md shadow-blue-600/25 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-gray-900">{t("app.title")}</p>
            <p className="text-sm text-gray-500">{t("app.subtitle")}</p>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {points.map(({ Icon, title, desc }) => (
            <li key={title} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3">
              <span className="mt-0.5 w-8 h-8 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900">{title}</span>
                <span className="block text-sm text-gray-500 mt-0.5 leading-relaxed">{desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
          <p className="text-center sm:text-left leading-relaxed">
            Made with <span aria-label="愛心" className="inline-block mx-0.5">❤️</span> by{" "}
            <a
              href="https://cagoooo.github.io/Akai/"
              target="_blank"
              rel="noopener noreferrer"
              title="阿凱老師教育科技創新專區"
              className="font-bold text-blue-700 border-b border-dotted border-blue-700/70 hover:text-indigo-600 hover:border-indigo-600 transition-colors"
            >
              阿凱老師
            </a>
            <span className="hidden sm:inline" aria-hidden="true"> ・</span>
            <span className="block sm:inline">桃園市龍潭區石門國民小學</span>
          </p>
          <span className="text-xs font-bold text-blue-700 rounded-full border border-blue-200 bg-white/80 px-3 py-1">
            v{APP_VERSION}
          </span>
        </div>
      </div>
    </footer>
  );
}
