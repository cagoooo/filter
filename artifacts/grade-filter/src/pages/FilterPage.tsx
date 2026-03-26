import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { FilterConfig, Subject, SUBJECT_LABELS, GRADE_LABELS } from "../types";
import { Plus, Trash2, ArrowRight, ArrowLeft, Play, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const GRADES = [1, 2, 3, 4, 5, 6];
const SUBJECTS: Subject[] = ["chinese", "english", "math"];

export default function FilterPage({
  onPrev,
  onNext,
}: {
  onPrev: () => void;
  onNext: () => void;
}) {
  const { filterConfigs, setFilterConfigs, runFilter, chineseData, englishData, mathData } =
    useAppContext();

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

  const addConfig = () => {
    setConfigs([
      ...configs,
      { grade: 1, subject: "chinese", mode: "percent", value: 20 },
    ]);
  };

  const removeConfig = (i: number) => {
    setConfigs(configs.filter((_, idx) => idx !== i));
  };

  const updateConfig = (i: number, patch: Partial<FilterConfig>) => {
    setConfigs(configs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const getCountForConfig = (cfg: FilterConfig): number => {
    const data =
      cfg.subject === "chinese"
        ? chineseData
        : cfg.subject === "english"
        ? englishData
        : mathData;
    const gradeData = data.filter((s) => s.grade === cfg.grade);
    if (cfg.mode === "percent") {
      return Math.ceil((cfg.value / 100) * gradeData.length);
    }
    return Math.min(cfg.value, gradeData.length);
  };

  const handleRun = () => {
    setFilterConfigs(configs);
    runFilter();
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
          {configs.map((cfg, i) => {
            const count = getCountForConfig(cfg);
            const hasData = subjectCounts[cfg.subject] > 0;
            const gradeCount =
              (cfg.subject === "chinese"
                ? chineseData
                : cfg.subject === "english"
                ? englishData
                : mathData
              ).filter((s) => s.grade === cfg.grade).length;

            return (
              <div
                key={i}
                className="bg-gray-50 rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        年級
                      </label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={cfg.grade}
                        onChange={(e) =>
                          updateConfig(i, { grade: Number(e.target.value) })
                        }
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {GRADE_LABELS[g]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        科目
                      </label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={cfg.subject}
                        onChange={(e) =>
                          updateConfig(i, {
                            subject: e.target.value as Subject,
                          })
                        }
                      >
                        {SUBJECTS.map((s) => (
                          <option
                            key={s}
                            value={s}
                            disabled={subjectCounts[s] === 0}
                          >
                            {SUBJECT_LABELS[s]}
                            {subjectCounts[s] === 0 ? "（未匯入）" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        篩選方式
                      </label>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          className={cn(
                            "flex-1 text-sm py-2 font-medium transition-colors",
                            cfg.mode === "percent"
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50"
                          )}
                          onClick={() => updateConfig(i, { mode: "percent" })}
                        >
                          百分比
                        </button>
                        <button
                          className={cn(
                            "flex-1 text-sm py-2 font-medium transition-colors border-l border-gray-200",
                            cfg.mode === "count"
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-600 hover:bg-gray-50"
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
                          onChange={(e) =>
                            updateConfig(i, {
                              value: Math.max(1, Number(e.target.value)),
                            })
                          }
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
                      <span className="font-semibold text-blue-600 ml-1">
                        篩出約 {count} 人
                      </span>
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
