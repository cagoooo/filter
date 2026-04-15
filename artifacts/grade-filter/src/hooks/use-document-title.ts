import { useEffect } from "react";
import { useLocation } from "wouter";

const TITLES: Record<string, string> = {
  "/": "匯入成績 — 成績篩選系統",
  "/filter": "設定篩選 — 成績篩選系統",
  "/result": "篩選結果 — 成績篩選系統",
};

export function useDocumentTitle() {
  const [location] = useLocation();
  useEffect(() => {
    document.title = TITLES[location] ?? "成績篩選系統";
  }, [location]);
}
