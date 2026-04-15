import { X, Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string[]; desc: string }[] = [
  { keys: ["Ctrl/⌘", "1"], desc: "跳至步驟一（匯入成績）" },
  { keys: ["Ctrl/⌘", "2"], desc: "跳至步驟二（設定篩選）" },
  { keys: ["Ctrl/⌘", "3"], desc: "跳至步驟三（查看結果）" },
  { keys: ["Ctrl/⌘", "E"], desc: "快速匯出 Excel（於結果頁）" },
  { keys: ["Ctrl/⌘", "P"], desc: "列印結果（於結果頁）" },
  { keys: ["Ctrl/⌘", "F"], desc: "聚焦搜尋框" },
  { keys: ["Ctrl", "Shift", "R"], desc: "重新執行篩選" },
  { keys: ["?"], desc: "顯示此快捷鍵說明" },
];

export function ShortcutHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            <h2 className="font-bold text-gray-900">鍵盤快捷鍵</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{s.desc}</span>
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
          提示：在輸入欄位中部分快捷鍵會暫時停用，以免干擾輸入
        </div>
      </div>
    </div>
  );
}
