import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { FilterConfig, Subject, SUBJECT_LABELS, GRADE_LABELS } from "../types";
import { Plus, Trash2, ArrowRight, ArrowLeft, Play, Settings2, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADES = [1, 2, 3, 4, 5, 6];
const SUBJECTS: Subject[] = ["chinese", "english", "math"];

export default function FilterPage({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const { filterConfigs, setFilterConfigs, runFilter, chineseData, englishData, mathData } = useAppContext();

  const subjectCounts: Record<Subject, number> = {
    chinese: chineseData.length,
    english: englishData.length,
    math: mathData.length,
  };

  const [configs, setConfigs] = useState<FilterConfig[]>(
    filterConfigs.length > 0
      ? filterConfigs
      : [{ grade: 1, subject: "chinese", mode: "percent", value: 20 }]
  );

  const [batchExpanded, setBatchExpanded] = useState(false);
  const [batchSubject, setBatchSubject] = useState<Subject>("chinese");
  const [batchMode, setBatchMode] = useState<"percent" | "count">("percent");
  const [batchValue, setBatchValue] = useState<number>(20);
  const [batchGrades, setBatchGrades] = useState<Set<number>>(new Set(GRADES));

  const addConfig = () => {
    setConfigs([...configs, { grade: 1, subject: "chinese", mode: "percent", value: 20 }]);
  };

  const removeConfig = (i: number) => {
    setConfigs(configs.filter((_, idx) => idx !== i));
  };

  const updateConfig = (i: number, patch: Partial<FilterConfig>) => {
    setConfigs(configs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const getCountForConfig = (cfg: FilterConfig): number => {
    const data = cfg.subject === "chinese" ? chineseData : cfg.subject === "english" ? englishData : mathData;
    const gradeData = data.filter((s) => s.grade === cfg.grade);
    if (cfg.mode === "percent") return Math.ceil((cfg.value / 100) * gradeData.length);
    return Math.min(cfg.value, gradeData.length);
  };

  const handleBatchAdd = () => {
    if (batchGrades.size === 0) return;
    const newConfigs: FilterConfig[] = [];
    for (const g of GRADES) {
      if (!batchGrades.has(g)) continue;
      const exists = configs.some((c) => c.grade === g && c.subject === batchSubject);
      if (!exists) {
        newConfigs.push({ grade: g, subject: batchSubject, mode: batchMode, value: batchValue });
      }
    }
    if (newConfigs.length > 0) {
      setConfigs([...configs, ...newConfigs]);
    }
  };

  const handleBatchOverwrite = () => {
    if (batchGrades.size === 0) return;
    const filtered = configs.filter((c) => !(batchGrades.has(c.grade) && c.subject === batchSubject));
    const newConfigs: FilterConfig[] = GRADES.filter((g) => batchGrades.has(g)).map((g) => ({
      grade: g, subject: batchSubject, mode: batchMode, value: batchValue,
    }));
    setConfigs([...filtered, ...newConfigs].sort((a, b) => a.grade - b.grade || SUBJECTS.indexOf(a.subject) - SUBJECTS.indexOf(b.subject)));
  };

  const toggleBatchGrade = (g: number) => {
    const next = new Set(batchGrades);
    if (next.has(g)) next.delete(g); else next.add(g);
    setBatchGrades(next);
  };

  const handleRun = () => {
    setFilterConfigs(configs);
    runFilter(configs);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">篩選條件設定</h2>
          </div>
          <button
            onClick={addConfig}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增條件
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="border border-indigo-200 rounded-lg overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-indigo-800 bg-indigo-50 hover:bg-indigo-50/80 transition-colors"
              onClick={() => setBatchExpanded((p) => !p)}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                批次新增：一次對多個年級套用相同條件
              </span>
              {batchExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {batchExpanded && (
              <div className="px-4 pb-4 pt-3 bg-white border-t border-indigo-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">科目</label>
                    <select
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={batchSubject}
                      onChange={(e) => setBatchSubject(e.target.value as Subject)}
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s} disabled={subjectCounts[s] === 0}>
                          {SUBJECT_LABELS[s]}{subjectCounts[s] === 0 ? "（未匯入）" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">篩選方式</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      {(["percent", "count"] as const).map((m) => (
                        <button
                          key={m}
                          className={cn(
                            "flex-1 text-sm py-2 font-medium transition-colors",
                            m !== "percent" && "border-l border-gray-200",
                            batchMode === m ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                          )}
                          onClick={() => setBatchMode(m)}
                        >
                          {m === "percent" ? "百分比" : "固定人數"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {batchMode === "percent" ? "取前幾 %" : "取前幾名"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={batchMode === "percent" ? 100 : 9999}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={batchValue}
                        onChange={(e) => setBatchValue(Math.max(1, Number(e.target.value)))}
                      />
                      <span className="text-sm text-gray-500 flex-shrink-0">
                        {batchMode === "percent" ? "%" : "名"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">套用至年級</label>
                  <div className="flex flex-wrap gap-2">
                    {GRADES.map((g) => (
                      <button
                        key={g}
                        onClick={() => toggleBatchGrade(g)}
                        className={cn(
                          "px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors",
                          batchGrades.has(g)
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                        )}
                      >
                        {GRADE_LABELS[g]}
                      </button>
                    ))}
                    <button
                      onClick={() => setBatchGrades(new Set(GRADES))}
                      className="px-3 py-1.5 text-sm rounded-lg border font-medium text-gray-500 border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      全選
                    </button>
                    <button
                      onClick={() => setBatchGrades(new Set())}
                      className="px-3 py-1.5 text-sm rounded-lg border font-medium text-gray-500 border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      全消
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleBatchAdd}
                    disabled={batchGrades.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    新增（跳過已有的條件）
                  </button>
                  <button
                    onClick={handleBatchOverwrite}
                    disabled={batchGrades.size === 0}
                    className="flex items-center gap-1.5 px-4 py-2 border border-indigo-300 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                  >
                    覆蓋同年級同科目的條件
                  </button>
                </div>
              </div>
            )}
          </div>

          {configs.map((cfg, i) => {
            const count = getCountForConfig(cfg);
            const hasData = subjectCounts[cfg.subject] > 0;
            const gradeCount = (cfg.subject === "chinese" ? chineseData : cfg.subject === "english" ? englishData : mathData)
              .filter((s) => s.grade === cfg.grade).length;

            return (
              <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">年級</label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={cfg.grade}
                        onChange={(e) => updateConfig(i, { grade: Number(e.target.value) })}
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>{GRADE_LABELS[g]}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">科目</label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={cfg.subject}
                        onChange={(e) => updateConfig(i, { subject: e.target.value as Subject })}
                      >
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s} disabled={subjectCounts[s] === 0}>
                            {SUBJECT_LABELS[s]}{subjectCounts[s] === 0 ? "（未匯入）" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">篩選方式</label>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          className={cn(
                            "flex-1 text-sm py-2 font-medium transition-colors",
                            cfg.mode === "percent" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                          )}
                          onClick={() => updateConfig(i, { mode: "percent" })}
                        >
                          百分比
                        </button>
                        <button
                          className={cn(
                            "flex-1 text-sm py-2 font-medium transition-colors border-l border-gray-200",
                            cfg.mode === "count" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                          )}
                          onClick={() => updateConfig(i, { mode: "count" })}
                        >
                          固定人數
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {cfg.mode === "percent" ? "取前幾 %" : "取前幾名"}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={cfg.mode === "percent" ? 100 : 9999}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={cfg.value}
                          onChange={(e) => updateConfig(i, { value: Math.max(1, Number(e.target.value)) })}
                        />
                        <span className="text-sm text-gray-500 flex-shrink-0">
                          {cfg.mode === "percent" ? "%" : "名"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {configs.length > 1 && (
                    <button
                      onClick={() => removeConfig(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-3 ml-10 flex items-center gap-2">
                  {!hasData ? (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      ⚠ {SUBJECT_LABELS[cfg.subject]}成績尚未匯入
                    </span>
                  ) : gradeCount === 0 ? (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      ⚠ {GRADE_LABELS[cfg.grade]}無{SUBJECT_LABELS[cfg.subject]}成績資料
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {GRADE_LABELS[cfg.grade]}{SUBJECT_LABELS[cfg.subject]}共 {gradeCount} 人 →
                      <span className="font-semibold text-blue-600 ml-1">篩出約 {count} 人</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={addConfig}
            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增篩選條件
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          上一步
        </button>

        <button
          onClick={handleRun}
          disabled={configs.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-4 h-4" />
          執行篩選
        </button>
      </div>
    </div>
  );
}
