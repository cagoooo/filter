import { useEffect } from "react";
import { useLocation } from "wouter";

export interface ShortcutMap {
  onExport?: () => void;
  onPrint?: () => void;
  onRerun?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

/**
 * 全域鍵盤快捷鍵
 * - Ctrl/Cmd + 1 / 2 / 3：切換步驟
 * - Ctrl/Cmd + E：快速匯出
 * - Ctrl/Cmd + P：列印
 * - Ctrl/Cmd + F：聚焦搜尋框
 * - Ctrl/Shift + R：重新執行篩選
 * - Ctrl/Cmd + Z：撤銷
 * - Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y：還原
 * - ?：顯示快捷鍵說明
 */
export function useKeyboardShortcuts(map: ShortcutMap = {}) {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 若使用者在輸入欄位中打字，僅允許非 mod 鍵（避免 Ctrl+F 等衝突覆蓋）
      const target = e.target as HTMLElement;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;

      // ? 鍵顯示說明（不在輸入欄時）
      if (!inEditable && !mod && e.key === "?") {
        e.preventDefault();
        map.onShowHelp?.();
        return;
      }

      if (!mod) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          navigate("/");
          break;
        case "2":
          e.preventDefault();
          navigate("/filter");
          break;
        case "3":
          e.preventDefault();
          navigate("/result");
          break;
        case "e":
        case "E":
          if (map.onExport) {
            e.preventDefault();
            map.onExport();
          }
          break;
        case "p":
        case "P":
          if (map.onPrint) {
            e.preventDefault();
            map.onPrint();
          }
          break;
        case "f":
        case "F":
          if (map.onFocusSearch) {
            e.preventDefault();
            map.onFocusSearch();
          }
          break;
        case "r":
        case "R":
          if (e.shiftKey && map.onRerun) {
            e.preventDefault();
            map.onRerun();
          }
          break;
        case "z":
        case "Z":
          if (inEditable) return;
          if (e.shiftKey) {
            if (map.onRedo) {
              e.preventDefault();
              map.onRedo();
            }
          } else if (map.onUndo) {
            e.preventDefault();
            map.onUndo();
          }
          break;
        case "y":
        case "Y":
          if (!inEditable && map.onRedo) {
            e.preventDefault();
            map.onRedo();
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, map]);
}
