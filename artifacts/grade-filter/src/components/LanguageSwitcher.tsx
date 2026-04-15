/**
 * P3.5：語言切換選單
 *
 * 簡易下拉選單，點擊後：
 *   1. 呼叫 i18n.changeLanguage()
 *   2. i18next-browser-languagedetector 自動寫入 localStorage
 *   3. 所有使用 `useTranslation()` 的元件會重新 render
 *
 * 目前支援 zh-TW 與 en；新增語言只需在 `src/i18n/locales/` 放新檔
 * 並於 `i18n/index.ts` 的 SUPPORTED_LANGUAGES 加一筆。
 */
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from "../i18n";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(e.target.value);
  };

  // 將完整語言碼（例 "en-US"）對齊到最近的支援碼（"en"）
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : (i18n.language.startsWith("zh") ? "zh-TW" : "en");

  return (
    <label
      className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-gray-500 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
      title={t("language.label")}
    >
      <Languages className="w-4 h-4" />
      <select
        value={current}
        onChange={handleChange}
        className="bg-transparent border-0 outline-none cursor-pointer text-sm focus:ring-0"
        aria-label={t("language.label")}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {LANGUAGE_LABELS[lng]}
          </option>
        ))}
      </select>
    </label>
  );
}
