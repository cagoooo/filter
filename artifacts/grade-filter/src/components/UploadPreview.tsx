import { useState } from "react";
import {
  ChevronDown, ChevronUp, RefreshCw, CheckCircle, AlertCircle,
  AlertTriangle, BarChart2, Copy,
} from "lucide-react";
import { Subject, SUBJECT_LABELS, Student } from "../types";
import { ColumnMapping, remapStudents, DuplicateGroup, ScoreAnomaly, GradeScoreStat } from "../lib/excel";
import { cn } from "@/lib/utils";

interface Props {
  subject: Subject;
  students: Student[];
  rawRows: string[][];
  mapping: ColumnMapping;
  duplicates: DuplicateGroup[];
  anomalies: ScoreAnomaly[];
  gradeStats: GradeScoreStat[];
  onRemapped: (students: Student[], warnings: string[], mapping: ColumnMapping) => void;
  onDeduplicated?: (students: Student[]) => void;
}

const FIELD_LABELS: Record<keyof Pick<ColumnMapping, "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx">, string> = {
  nameIdx: "姓名",
  gradeIdx: "年級 / 班級代碼",
  classIdx: "班級",
  seatIdx: "座號",
  idIdx: "身分證字號",
  scoreIdx: "成績",
};

const REQUIRED_FIELDS: (keyof Pick<ColumnMapping, "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx">)[] = [
  "nameIdx", "gradeIdx", "idIdx", "scoreIdx", "seatIdx", "classIdx",
];

export default function UploadPreview({
  subject, students, rawRows, mapping,
  duplicates, anomalies, gradeStats,
  onRemapped, onDeduplicated,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [localMapping, setLocalMapping] = useState<ColumnMapping>(mapping);
  const [remapWarnings, setRemapWarnings] = useState<string[]>([]);
  const [dupResolved, setDupResolved] = useState(false);

  const colLabels = mapping.colLabels;
  const preview = students.slice(0, 3);

  const hasDuplicates = duplicates.length > 0;
  const hasAnomalies = anomalies.length > 0;
  const highBlankGrades = gradeStats.filter((g) => g.blankRate > 0.3);

  const alertCount = (hasDuplicates ? 1 : 0) + (hasAnomalies ? 1 : 0) + (highBlankGrades.length > 0 ? 1 : 0);

  const handleRemap = () => {
    const { students: newStudents, warnings } = remapStudents(rawRows, localMapping, subject);
    setRemapWarnings(warnings);
    const newMapping: ColumnMapping = { ...localMapping };
    onRemapped(newStudents, warnings, newMapping);
  };

  const handleKeepHighest = () => {
    const dupIds = new Set(duplicates.map((d) => d.idNumber.trim().toUpperCase()));
    const nonDupStudents = students.filter((s) => !dupIds.has(s.idNumber.trim().toUpperCase()));
    const bestByDup: Map<string, Student> = new Map();
    for (const s of students) {
      const key = s.idNumber.trim().toUpperCase();
      if (!dupIds.has(key)) continue;
      const current = bestByDup.get(key);
      const currentScore = current ? ((current[subject] ?? -1) as number) : -1;
      const thisScore = (s[subject] ?? -1) as number;
      if (!current || thisScore > currentScore) bestByDup.set(key, s);
    }
    const resolved = [...nonDupStudents, ...Array.from(bestByDup.values())];
    setDupResolved(true);
    if (onDeduplicated) onDeduplicated(resolved);
  };

  const updateLocal = (field: keyof ColumnMapping, val: number) => {
    setLocalMapping((prev) => ({ ...prev, [field]: val }));
  };

  const colOptions = [
    { value: -1, label: "（未選取）" },
    ...colLabels.map((label, i) => ({ value: i, label: `第${i + 1}欄 「${label.slice(0, 8)}」` })),
  ];

  const fieldBadge = (
    field: keyof Pick<ColumnMapping, "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx">,
    label: string,
    idx: number,
  ) => {
    const found = idx !== -1;
    return (
      <span
        key={field}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
          found
            ? "bg-green-50 text-green-700 border-green-200"
            : "bg-red-50 text-red-600 border-red-200"
        )}
      >
        {found ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
        {label}
        {found && (
          <span className="text-xs opacity-70">
            :{" "}
            {field === "gradeIdx" && mapping.gradeFromClass
              ? `${colLabels[idx] ?? `第${idx + 1}欄`}（班級代碼）`
              : colLabels[idx] ?? `第${idx + 1}欄`}
          </span>
        )}
        {!found && <span className="opacity-70">: 未偵測到</span>}
      </span>
    );
  };

  return (
    <div className="mt-3 border border-blue-100 rounded-lg bg-blue-50/40 overflow-hidden">
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-blue-800 hover:bg-blue-50/60 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="flex items-center gap-2">
          欄位辨識結果與資料預覽（共 {students.length} 筆）
          {alertCount > 0 && !dupResolved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {alertCount} 項警示
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">

          {hasDuplicates && !dupResolved && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <Copy className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">
                    發現 {duplicates.length} 筆重複的身分證字號
                  </p>
                  <div className="space-y-1 mb-2">
                    {duplicates.map((d) => (
                      <p key={d.idNumber} className="text-xs text-amber-700">
                        ⚠ {d.name}（{d.idNumber.slice(0, 4)}****）
                        共 {d.count} 筆，出現於第 {d.rows.join("、")} 行
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleKeepHighest}
                      className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                    >
                      保留各人成績最高的一筆
                    </button>
                    <button
                      onClick={() => setDupResolved(true)}
                      className="px-3 py-1 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-100 transition-colors"
                    >
                      忽略，繼續使用
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {dupResolved && hasDuplicates && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center gap-2 text-xs text-green-700">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              重複問題已處理，每位學生保留成績最高的一筆
            </div>
          )}

          {(hasAnomalies || highBlankGrades.length > 0) && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-orange-800">成績資料異常偵測</p>
              </div>
              {hasAnomalies && (
                <div>
                  <p className="text-xs text-orange-700 font-medium mb-1">異常分數（超出 0–150 範圍）：</p>
                  {anomalies.map((a, i) => (
                    <p key={i} className="text-xs text-orange-700">
                      • {a.name} — {a.score} 分（第 {a.row} 行）
                    </p>
                  ))}
                </div>
              )}
              {highBlankGrades.length > 0 && (
                <div>
                  <p className="text-xs text-orange-700 font-medium mb-1">空白成績比例過高（超過 30%）：</p>
                  {highBlankGrades.map((g) => (
                    <p key={g.grade} className="text-xs text-orange-700">
                      • {g.grade} 年級：共 {g.total} 筆，其中 {g.missing} 筆空白
                      （{(g.blankRate * 100).toFixed(1)}%），請確認資料完整性
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {gradeStats.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
                <BarChart2 className="w-3.5 h-3.5" />
                各年級成績統計
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {gradeStats.map((g) => (
                  <span
                    key={g.grade}
                    className={cn(
                      "text-xs",
                      g.blankRate > 0.3 ? "text-orange-600 font-medium" : "text-gray-600"
                    )}
                  >
                    {g.grade} 年級：{g.total} 筆
                    {g.missing > 0 && `，空白 ${g.missing} 筆 (${(g.blankRate * 100).toFixed(0)}%)`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {fieldBadge("gradeIdx", "年級", mapping.gradeIdx)}
            {fieldBadge("classIdx", "班級", mapping.classIdx)}
            {fieldBadge("nameIdx", "姓名", mapping.nameIdx)}
            {fieldBadge("scoreIdx", `${SUBJECT_LABELS[subject]}成績`, mapping.scoreIdx)}
            {fieldBadge("idIdx", "身分證字號", mapping.idIdx)}
            {fieldBadge("seatIdx", "座號", mapping.seatIdx)}
          </div>

          {mapping.gradeFromClass && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5 border border-blue-100">
              年級從班級代碼自動拆解：例如「203」= 2年級3班
            </p>
          )}

          <div>
            <button
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium transition-colors mb-2"
              onClick={() => setManualExpanded((p) => !p)}
            >
              {manualExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              手動調整欄位對應
            </button>

            {manualExpanded && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REQUIRED_FIELDS.map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {FIELD_LABELS[field]}
                        {field === "gradeIdx" && (
                          <span className="font-normal text-gray-400 ml-1">
                            （可選班級代碼欄，系統自動拆解年級）
                          </span>
                        )}
                      </label>
                      <select
                        value={localMapping[field]}
                        onChange={(e) => updateLocal(field, Number(e.target.value))}
                        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {colOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`gradeFromClass-${subject}`}
                      checked={localMapping.gradeFromClass}
                      onChange={(e) => setLocalMapping((p) => ({ ...p, gradeFromClass: e.target.checked }))}
                      className="rounded"
                    />
                    <label htmlFor={`gradeFromClass-${subject}`} className="text-xs text-gray-600">
                      年級欄的值是三位數班級代碼（如 203）
                    </label>
                  </div>
                  <button
                    onClick={handleRemap}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新套用
                  </button>
                </div>

                {remapWarnings.length > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
                    {remapWarnings.map((w, i) => <p key={i}>• {w}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {preview.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1.5">
                資料預覽（前 {preview.length} 筆）
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">年級</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">班級</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">座號</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">姓名</th>
                      <th className="px-3 py-2 text-right text-gray-600 font-medium whitespace-nowrap">
                        {SUBJECT_LABELS[subject]}成績
                      </th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">身分證字號</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-1.5 text-gray-700">{s.grade || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-700">{s.class || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-700">{s.seatNo || "—"}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900">{s.name || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-blue-700">
                          {s[subject] != null ? s[subject] : "—"}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-gray-600">
                          {s.idNumber
                            ? s.idNumber.slice(0, 4) + "****" + s.idNumber.slice(-2)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">（無法產生預覽，請確認欄位對應）</p>
          )}
        </div>
      )}
    </div>
  );
}
