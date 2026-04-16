import { X, Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";

const SHORTCUT_KEYS: { keys: string[]; descKey: string }[] = [
  { keys: ["Ctrl/⌘", "1"], descKey: "shortcuts.goStep1" },
  { keys: ["Ctrl/⌘", "2"], descKey: "shortcuts.goStep2" },
  { keys: ["Ctrl/⌘", "3"], descKey: "shortcuts.goStep3" },
  { keys: ["Ctrl/⌘", "E"], descKey: "shortcuts.exportExcel" },
  { keys: ["Ctrl/⌘", "P"], descKey: "shortcuts.print" },
  { keys: ["Ctrl/⌘", "F"], descKey: "shortcuts.focusSearch" },
  { keys: ["Ctrl", "Shift", "R"], descKey: "shortcuts.rerunFilter" },
  { keys: ["Ctrl/⌘", "Z"], descKey: "shortcuts.undo" },
  { keys: ["Ctrl/⌘", "Shift", "Z"], descKey: "shortcuts.redo" },
  { keys: ["?"], descKey: "shortcuts.showHelp" },
];

export function ShortcutHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">{t("shortcuts.dialogTitle")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {SHORTCUT_KEYS.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{t(s.descKey)}</span>
              <div className="flex gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-700 shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 text-xs text-gray-500">
          {t("shortcuts.hint")}
        </div>
      </div>
    </div>
  );
}
