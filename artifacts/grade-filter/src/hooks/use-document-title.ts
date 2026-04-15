import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

/**
 * P3.5：document.title 亦跟隨 i18n 語言切換
 * 格式：`<step> — <appTitle>`
 */
export function useDocumentTitle() {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const appTitle = t("app.title");
    const stepKey =
      location === "/filter" ? "steps.filter" :
      location === "/result" ? "steps.result" :
      "steps.import";
    document.title = `${t(stepKey)} — ${appTitle}`;
  }, [location, t, i18n.language]);
}
