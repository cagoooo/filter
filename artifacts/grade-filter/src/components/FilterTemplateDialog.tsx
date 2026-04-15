import { useState, useEffect } from "react";
import { FilterConfig, FilterTemplate, SUBJECT_LABELS, GRADE_LABELS } from "../types";
import { storageGet, storageSet, STORAGE_KEYS } from "../lib/storage";
import { X, FolderOpen, Save, Trash2, Download, Upload, Plus, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  currentConfigs: FilterConfig[];
  onApply: (configs: FilterConfig[]) => void;
}

export function FilterTemplateDialog({ open, onClose, currentConfigs, onApply }: Props) {
  const [templates, setTemplates] = useState<FilterTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (open) loadTemplates();
  }, [open]);

  async function loadTemplates() {
    const list = (await storageGet<FilterTemplate[]>(STORAGE_KEYS.FILTER_TEMPLATES)) ?? [];
    list.sort((a, b) => (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt));
    setTemplates(list);
  }

  async function saveTemplate() {
    if (!newName.trim()) {
      toast.error("請輸入範本名稱");
      return;
    }
    if (currentConfigs.length === 0) {
      toast.error("目前沒有篩選條件可儲存");
      return;
    }
    const tpl: FilterTemplate = {
      id: `tpl-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      configs: JSON.parse(JSON.stringify(currentConfigs)),
      createdAt: Date.now(),
    };
    const next = [tpl, ...templates];
    await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
    setTemplates(next);
    setSaveMode(false);
    setNewName("");
    setNewDesc("");
    toast.success(`已儲存範本「${tpl.name}」`);
  }

  async function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const next = templates.map((t) =>
      t.id === id ? { ...t, lastUsedAt: Date.now() } : t
    );
    await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
    setTemplates(next);
    onApply(JSON.parse(JSON.stringify(tpl.configs)));
    toast.success(`已套用範本「${tpl.name}」（${tpl.configs.length} 筆條件）`);
    onClose();
  }

  async function deleteTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!confirm(`確定刪除範本「${tpl.name}」？`)) return;
    const next = templates.filter((t) => t.id !== id);
    await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
    setTemplates(next);
    if (selectedId === id) setSelectedId(null);
    toast.success("已刪除");
  }

  function exportTemplates() {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `篩選範本_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已匯出 ${templates.length} 個範本`);
  }

  function importTemplates() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as FilterTemplate[];
        if (!Array.isArray(imported)) throw new Error("格式錯誤");
        // 合併 + 去重（id）
        const existing = new Map(templates.map((t) => [t.id, t]));
        for (const t of imported) {
          if (!t.id) t.id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          existing.set(t.id, t);
        }
        const next = [...existing.values()];
        await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
        setTemplates(next);
        toast.success(`已匯入 ${imported.length} 個範本`);
      } catch {
        toast.error("匯入失敗：JSON 格式錯誤");
      }
    };
    input.click();
  }

  if (!open) return null;

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">篩選條件範本</h2>
            <span className="text-xs text-gray-500">({templates.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={importTemplates}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="從 JSON 匯入"
            >
              <Upload className="w-3.5 h-3.5" />
              匯入
            </button>
            <button
              onClick={exportTemplates}
              disabled={templates.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-40"
              title="匯出為 JSON"
            >
              <Download className="w-3.5 h-3.5" />
              匯出
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* 左側：範本清單 */}
          <div className="w-64 border-r border-gray-100 overflow-y-auto">
            <button
              onClick={() => {
                setSaveMode(true);
                setSelectedId(null);
              }}
              className="w-full px-4 py-3 border-b border-gray-100 flex items-center gap-2 text-sm text-blue-600 font-medium hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              儲存目前條件為範本
            </button>
            {templates.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                尚無儲存的範本
              </div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedId(t.id);
                    setSaveMode(false);
                  }}
                  className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedId === t.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t.configs.length} 筆條件 · {new Date(t.createdAt).toLocaleDateString("zh-TW")}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 右側：詳細 / 儲存表單 */}
          <div className="flex-1 overflow-y-auto p-5">
            {saveMode ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Save className="w-4 h-4 text-blue-600" />
                  儲存新範本
                </h3>
                <div>
                  <label className="text-xs font-medium text-gray-600">範本名稱 *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例：113 學年度上學期資優篩選"
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">說明（選填）</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="簡述使用時機..."
                    rows={2}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">將儲存以下 {currentConfigs.length} 筆條件：</p>
                  {currentConfigs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">目前沒有任何篩選條件</p>
                  ) : (
                    <ul className="space-y-1">
                      {currentConfigs.map((c, i) => (
                        <li key={i} className="text-xs text-gray-700">
                          {GRADE_LABELS[c.grade] || `${c.grade}年級`} {SUBJECT_LABELS[c.subject]}
                          {" "}
                          {c.direction === "bottom" ? "後" : "前"} {c.value}
                          {c.mode === "percent" ? "%" : "人"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveTemplate}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => setSaveMode(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : selected ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{selected.name}</h3>
                    {selected.description && (
                      <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      建立於 {new Date(selected.createdAt).toLocaleDateString("zh-TW")}
                      {selected.lastUsedAt && ` · 上次使用 ${new Date(selected.lastUsedAt).toLocaleDateString("zh-TW")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteTemplate(selected.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="刪除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">{selected.configs.length} 筆條件：</p>
                  <ul className="space-y-1">
                    {selected.configs.map((c, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-center gap-2">
                        <span className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono">
                          {i + 1}
                        </span>
                        {GRADE_LABELS[c.grade] || `${c.grade}年級`} {SUBJECT_LABELS[c.subject]}
                        {" "}
                        <span className={c.direction === "bottom" ? "text-orange-600 font-bold" : "text-blue-600 font-bold"}>
                          {c.direction === "bottom" ? "後" : "前"}
                        </span>
                        {" "}
                        {c.value}
                        {c.mode === "percent" ? "%" : "人"}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => applyTemplate(selected.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    <FolderOpen className="w-4 h-4" />
                    套用此範本
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">選擇左側範本查看詳情</p>
                <p className="text-xs mt-1">或點擊「儲存目前條件為範本」</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
