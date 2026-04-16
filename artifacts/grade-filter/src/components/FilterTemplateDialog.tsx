import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FilterConfig, FilterTemplate } from "../types";
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
  const { t } = useTranslation();
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
      toast.error(t("template.nameRequired"));
      return;
    }
    if (currentConfigs.length === 0) {
      toast.error(t("template.noConfigsToSave"));
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
    toast.success(t("template.saved", { name: tpl.name }));
  }

  async function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const next = templates.map((x) =>
      x.id === id ? { ...x, lastUsedAt: Date.now() } : x
    );
    await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
    setTemplates(next);
    onApply(JSON.parse(JSON.stringify(tpl.configs)));
    toast.success(t("template.applied", { name: tpl.name, count: tpl.configs.length }));
    onClose();
  }

  async function deleteTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!confirm(t("template.confirmDelete", { name: tpl.name }))) return;
    const next = templates.filter((x) => x.id !== id);
    await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
    setTemplates(next);
    if (selectedId === id) setSelectedId(null);
    toast.success(t("template.deleted"));
  }

  function exportTemplates() {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("template.exportFilename")}${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("template.exported", { count: templates.length }));
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
        if (!Array.isArray(imported)) throw new Error(t("template.formatError"));
        // 合併 + 去重（id）
        const existing = new Map(templates.map((t) => [t.id, t]));
        for (const t of imported) {
          if (!t.id) t.id = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          existing.set(t.id, t);
        }
        const next = [...existing.values()];
        await storageSet(STORAGE_KEYS.FILTER_TEMPLATES, next);
        setTemplates(next);
        toast.success(t("template.imported", { count: imported.length }));
      } catch {
        toast.error(t("template.importFailed"));
      }
    };
    input.click();
  }

  if (!open) return null;

  const selected = templates.find((x) => x.id === selectedId) ?? null;

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
            <h2 className="font-bold text-gray-900">{t("template.dialogTitle")}</h2>
            <span className="text-xs text-gray-500">({templates.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={importTemplates}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title={t("template.importFromJson")}
            >
              <Upload className="w-3.5 h-3.5" />
              {t("template.import")}
            </button>
            <button
              onClick={exportTemplates}
              disabled={templates.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-40"
              title={t("template.exportAsJson")}
            >
              <Download className="w-3.5 h-3.5" />
              {t("template.export")}
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
              {t("template.saveCurrentAsTemplate")}
            </button>
            {templates.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                {t("template.empty")}
              </div>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    setSelectedId(tpl.id);
                    setSaveMode(false);
                  }}
                  className={`w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedId === tpl.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">{tpl.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {tpl.configs.length} {t("template.conditionCount")} · {new Date(tpl.createdAt).toLocaleDateString()}
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
                  {t("template.saveNew")}
                </h3>
                <div>
                  <label className="text-xs font-medium text-gray-600">{t("template.nameLabel")}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("template.namePlaceholder")}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">{t("template.descLabel")}</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder={t("template.descPlaceholder")}
                    rows={2}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    {t("template.willSaveConfigs", { count: currentConfigs.length })}
                  </p>
                  {currentConfigs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">{t("template.noConfigs")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {currentConfigs.map((c, i) => (
                        <li key={i} className="text-xs text-gray-700">
                          {t(`grades.g${c.grade}`, { defaultValue: `${c.grade}` })} {t(`subjects.${c.subject}`)}
                          {" "}
                          {c.direction === "bottom" ? t("filter.bottom") : t("filter.top")} {c.value}
                          {c.mode === "percent" ? t("filter.percentUnit") : t("filter.personUnit")}
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
                    {t("actions.save")}
                  </button>
                  <button
                    onClick={() => setSaveMode(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                  >
                    {t("actions.cancel")}
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
                      {t("template.createdAt")} {new Date(selected.createdAt).toLocaleDateString()}
                      {selected.lastUsedAt && ` · ${t("template.lastUsedAt")} ${new Date(selected.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteTemplate(selected.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title={t("actions.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    {selected.configs.length} {t("template.conditionCount")}
                  </p>
                  <ul className="space-y-1">
                    {selected.configs.map((c, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-center gap-2">
                        <span className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono">
                          {i + 1}
                        </span>
                        {t(`grades.g${c.grade}`, { defaultValue: `${c.grade}` })} {t(`subjects.${c.subject}`)}
                        {" "}
                        <span className={c.direction === "bottom" ? "text-orange-600 font-bold" : "text-blue-600 font-bold"}>
                          {c.direction === "bottom" ? t("filter.bottom") : t("filter.top")}
                        </span>
                        {" "}
                        {c.value}
                        {c.mode === "percent" ? t("filter.percentUnit") : t("filter.personUnit")}
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
                    {t("template.applyThis")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t("template.selectToView")}</p>
                <p className="text-xs mt-1">{t("template.orClickSave")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
