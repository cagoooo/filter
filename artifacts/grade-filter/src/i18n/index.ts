/**
 * P3.5：i18n 初始化
 *
 * 專案主要語言為繁體中文（zh-TW），加入 i18next 的目的不是立刻多語化，
 * 而是：
 *   1. 集中管理散落在各元件的字串
 *   2. 為未來（國際學校、英語教師、僑校等）擴充預留架構
 *
 * 策略：
 *   - fallbackLng = "zh-TW"（所有未定義的 key 直接 fallback 到中文）
 *   - 新元件優先用 `useTranslation()`，舊元件漸進式遷移
 *   - 新增語言只需在 `locales/` 下加 `xx.json`，無需改動初始化邏輯
 *
 * Language detector 會依序從以下來源判斷語言：
 *   querystring → localStorage → navigator → htmlTag
 * 使用者顯式切換的結果寫入 localStorage，下次載入保留。
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import zhTW from "./locales/zh-TW.json";
import en from "./locales/en.json";

export const SUPPORTED_LANGUAGES = ["zh-TW", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  "zh-TW": "繁體中文",
  en: "English",
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "zh-TW": { translation: zhTW },
      en: { translation: en },
    },
    fallbackLng: "zh-TW",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: {
      escapeValue: false, // React 已自動防 XSS
    },
    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "grade-filter-lang",
    },
    returnEmptyString: false,
  });

export default i18n;
