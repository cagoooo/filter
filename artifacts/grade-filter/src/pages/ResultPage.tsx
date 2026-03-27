import { useState, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { FilterResult, Subject, SUBJECT_LABELS, GRADE_LABELS } from "../types";
import { exportToExcel, exportToCsv } from "../lib/excel";
import {
  ArrowLeft, FileSpreadsheet, FileText, Star, Users,
  ChevronUp, ChevronDown, Search, RefreshCw, UserX, List, LayoutList,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = keyof FilterResult | "none";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grouped";

export default function ResultPage({ onPrev, onReset }: { onPrev: () => void; onReset: () => void }) {
  const { filterResults } = useAppContext();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [subjectFilter, setSubjectFilter] = useState<Subject | "all">("all");
  const [showExcluded, setShowExcluded] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showStats, setShowStats] = useState(true);

  const grades = useMemo(() => [...new Set(filterResults.map((r) => r.grade))].sort((a, b) => a - b), [filterResults]);
  const subjects = useMemo(() => [...new Set(filterResults.map((r) => r.filterSubject))] as Subject[], [filterResults]);

  const filtered = useMemo(() => {
    let data = filterResults.filter((r) => r.status !== "excluded" || showExcluded);
    if (gradeFilter !== "all") data = data.filter((r) => r.grade === gradeFilter);
    if (subjectFilter !== "all") data = data.filter((r) => r.filterSubject === subjectFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (r) => r.name.toLowerCase().includes(q) || r.idNumber.toLowerCase().includes(q) || r.class.toLowerCase().includes(q)
      );
    }
    if (sortKey !== "none") {
      data = [...data].sort((a, b) => {
        const aVal = a[sortKey as keyof FilterResult] ?? "";
        const bVal = b[sortKey as keyof FilterResult] ?? "";
        if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        return sortDir === "asc"
          ? String(aVal).localeCompare(String(bVal), "zh-TW")
          : String(bVal).localeCompare(String(aVal), "zh-TW");
      });
    }
    return data;
  }, [filterResults, gradeFilter, subjectFilter, search, sortKey, sortDir, showExcluded]);

  const groupedData = useMemo(() => {
    const map = new Map<string, FilterResult[]>();
    const sorted = [...filtered].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return String(a.class).localeCompare(String(b.class), "zh-TW");
    });
    for (const r of sorted) {
      const key = `${r.grade}-${r.class}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp className="w-3.5 h-3.5 text-gray-300" />;
    return sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  const exportData = (includeExcluded = false) => {
    const rows = filterResults.filter((r) => r.status !== "excluded" || includeExcluded);
    return rows.map((r) => ({
      狀態: r.status === "priority" ? "優先" : r.status === "excluded" ? "已排除（特生）" : "一般",
      姓名: r.name,
      年級: GRADE_LABELS[r.grade] || r.grade,
      班級: r.class,
      座號: r.seatNo,
      身分證字號: r.idNumber,
      國文成績: r.chinese ?? "",
      英文成績: r.english ?? "",
      數學成績: r.math ?? "",
      篩選科目: SUBJECT_LABELS[r.filterSubject],
      篩選成績: r.filterScore,
    }));
  };

  const priorityCount = filterResults.filter((r) => r.status === "priority").length;
  const normalCount = filterResults.filter((r) => r.status === "normal").length;
  const excludedCount = filterResults.filter((r) => r.status === "excluded").length;
  const activeResults = filterResults.filter((r) => r.status !== "excluded");

  const gradeStats = useMemo(() => {
    const map: Record<number, number> = {};
    for (const r of activeResults) map[r.grade] = (map[r.grade] || 0) + 1;
    return Object.entries(map).map(([g, count]) => ({ grade: Number(g), count })).sort((a, b) => a.grade - b.grade);
  }, [filterResults]);

  const subjectStats = useMemo(() => {
    const map: Partial<Record<Subject, number>> = {};
    for (const r of activeResults) map[r.filterSubject] = (map[r.filterSubject] || 0) + 1;
    return (["chinese", "english", "math"] as Subject[]).filter((s) => map[s] !== undefined).map((s) => ({ subject: s, count: map[s]! }));
  }, [filterResults]);

  // Per-(grade, subject) score stats
  const scoreStats = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of activeResults) {
      const key = `${r.grade}__${r.filterSubject}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r.filterScore);
    }
    return [...map.entries()]
      .map(([key, scores]) => {
        const [gradeStr, subject] = key.split("__");
        const sorted = [...scores].sort((a, b) => b - a);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          grade: Number(gradeStr),
          subject: subject as Subject,
          count: scores.length,
          max: sorted[0],
          min: sorted[sorted.length - 1],
          avg: Math.round(avg * 10) / 10,
          cutoff: sorted[sorted.length - 1],
        };
      })
      .sort((a, b) =>
        a.grade !== b.grade
          ? a.grade - b.grade
          : (["chinese", "english", "math"] as Subject[]).indexOf(a.subject) -
            (["chinese", "english", "math"] as Subject[]).indexOf(b.subject)
      );
  }, [filterResults]);

  // Per-class breakdown
  const classStats = useMemo(() => {
    const map = new Map<string, { grade: number; cls: string; count: number; priority: number }>();
    for (const r of activeResults) {
      const key = `${r.grade}__${r.class}`;
      if (!map.has(key)) map.set(key, { grade: r.grade, cls: r.class, count: 0, priority: 0 });
      const entry = map.get(key)!;
      entry.count++;
      if (r.status === "priority") entry.priority++;
    }
    return [...map.values()].sort((a, b) =>
      a.grade !== b.grade ? a.grade - b.grade : String(a.cls).localeCompare(String(b.cls), "zh-TW")
    );
  }, [filterResults]);

  const TABLE_COLS = [
    { key: "status", label: "狀態" },
    { key: "name", label: "姓名" },
    { key: "grade", label: "年級" },
    { key: "class", label: "班級" },
    { key: "seatNo", label: "座號" },
    { key: "idNumber", label: "身分證字號" },
    { key: "chinese", label: "國文" },
    { key: "english", label: "英文" },
    { key: "math", label: "數學" },
    { key: "filterSubject", label: "篩選科目" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">篩選名單人次</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{priorityCount + normalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm bg-amber-50/40">
          <p className="text-xs text-amber-600 font-medium">優先（在校生）</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{priorityCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm bg-blue-50/30">
          <p className="text-xs text-blue-600 font-medium">一般篩選</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{normalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm opacity-70">
          <p className="text-xs text-gray-500 font-medium">特生（已排除）</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{excludedCount}</p>
        </div>
      </div>

      {scoreStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
            onClick={() => setShowStats((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-800">成績統計摘要</span>
              <span className="text-xs text-gray-400 font-normal">最高 / 最低 / 平均 / 錄取門檻</span>
            </div>
            {showStats
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showStats && (
            <div className="border-t border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">年級</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">科目</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">人數</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-600">最高分</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-rose-500">最低分</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-blue-600">平均分</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-amber-600">錄取門檻</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-40">分布</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreStats.map(({ grade, subject, count, max, min, avg, cutoff }) => {
                    const subjectColors: Record<Subject, string> = {
                      chinese: "text-rose-600 bg-rose-50",
                      english: "text-blue-600 bg-blue-50",
                      math: "text-emerald-600 bg-emerald-50",
                    };
                    const barColors: Record<Subject, string> = {
                      chinese: "bg-rose-400",
                      english: "bg-blue-400",
                      math: "bg-emerald-400",
                    };
                    // Normalize bar: show range as % of 150
                    const barMin = Math.max(0, min - 5);
                    const barWidth = Math.round(((max - barMin) / 150) * 100);
                    const barOffset = Math.round((barMin / 150) * 100);
                    return (
                      <tr key={`${grade}-${subject}`} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-600 font-medium whitespace-nowrap">
                          {GRADE_LABELS[grade] || `${grade}年級`}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${subjectColors[subject]}`}>
                            {SUBJECT_LABELS[subject]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-700">{count}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-emerald-600">{max}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-rose-500">{min}</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-blue-600">{avg}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-sm font-bold text-amber-600">{cutoff}</span>
                          <span className="text-xs text-gray-400 ml-1">↑</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="relative h-2 bg-gray-100 rounded-full w-32">
                            <div
                              className={`absolute h-2 rounded-full ${barColors[subject]}`}
                              style={{ left: `${barOffset}%`, width: `${Math.max(barWidth, 4)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Class breakdown */}
              {classStats.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 mb-3">各班錄取人數</p>
                  <div className="flex flex-wrap gap-2">
                    {classStats.map(({ grade, cls, count, priority }) => (
                      <div
                        key={`${grade}-${cls}`}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-xs text-gray-500">{GRADE_LABELS[grade]?.replace("年級", "") ?? grade}年{cls}</span>
                        <span className="text-sm font-bold text-gray-800">{count}</span>
                        {priority > 0 && (
                          <span className="text-xs text-amber-600 font-medium">
                            <Star className="w-2.5 h-2.5 inline fill-amber-500 text-amber-500 mr-0.5" />{priority}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(gradeStats.length > 0 || subjectStats.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gradeStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">各年級人數</h3>
              <div className="space-y-2">
                {gradeStats.map(({ grade, count }) => {
                  const max = Math.max(...gradeStats.map((g) => g.count));
                  return (
                    <div key={grade} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-14 flex-shrink-0">{GRADE_LABELS[grade] || `${grade}年級`}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.round((count / max) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {subjectStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">各科目人數</h3>
              <div className="space-y-2">
                {subjectStats.map(({ subject, count }) => {
                  const max = Math.max(...subjectStats.map((s) => s.count));
                  const colors: Record<Subject, string> = { chinese: "bg-rose-400", english: "bg-blue-400", math: "bg-emerald-400" };
                  return (
                    <div key={subject} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-14 flex-shrink-0">{SUBJECT_LABELS[subject]}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${colors[subject]} h-2 rounded-full transition-all`} style={{ width: `${Math.round((count / max) * 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-800 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜尋姓名、身分證、班級..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">全部年級</option>
              {grades.map((g) => <option key={g} value={g}>{GRADE_LABELS[g] || `${g}年級`}</option>)}
            </select>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value as Subject | "all")}
            >
              <option value="all">全部科目</option>
              {subjects.map((s) => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}
            </select>

            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                  viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
                title="綜合列表"
              >
                <List className="w-4 h-4" />
                列表
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200",
                  viewMode === "grouped" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
                title="分班顯示"
              >
                <LayoutList className="w-4 h-4" />
                分班
              </button>
            </div>

            <button
              onClick={() => setShowExcluded((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
                showExcluded
                  ? "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
                  : "border-gray-200 text-gray-400 bg-gray-50"
              )}
            >
              <UserX className="w-4 h-4" />
              {showExcluded ? "隱藏特生" : "顯示特生"}
            </button>
            <button
              onClick={() => exportToExcel(exportData(true), "篩選結果.xlsx")}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => exportToCsv(exportData(true), "篩選結果.csv")}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/30">
                    {TABLE_COLS.map(({ key, label }) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap"
                        onClick={() => toggleSort(key as SortKey)}
                      >
                        <span className="flex items-center gap-1">{label}<SortIcon k={key as SortKey} /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>沒有符合條件的資料</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => <ResultRow key={r.id} r={r} />)
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50/30">
              顯示 {filtered.length} 筆{excludedCount > 0 && !showExcluded && `（另有 ${excludedCount} 名特生已隱藏）`}
            </div>
          </>
        ) : (
          <GroupedView groupedData={groupedData} showExcluded={showExcluded} excludedCount={excludedCount} totalShown={filtered.length} />
        )}
      </div>

      <div className="flex justify-between items-center pt-1">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          修改篩選條件
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 border border-red-200 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          重新開始
        </button>
      </div>
    </div>
  );
}

function ResultRow({ r }: { r: FilterResult }) {
  return (
    <tr
      className={cn(
        "border-b border-gray-50 transition-colors",
        r.status === "excluded" ? "bg-gray-50/80 opacity-60"
          : r.status === "priority" ? "bg-amber-50/40 hover:bg-amber-50/60"
          : "hover:bg-gray-50/50"
      )}
    >
      <td className="px-4 py-3">
        {r.status === "priority" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />優先
          </span>
        ) : r.status === "excluded" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            <UserX className="w-3 h-3" />已排除
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2.5 py-1">一般</span>
        )}
      </td>
      <td className={cn("px-4 py-3 font-medium", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>{r.name}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{GRADE_LABELS[r.grade] || `${r.grade}年級`}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{r.class}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{r.seatNo}</td>
      <td className={cn("px-4 py-3 font-mono text-xs", r.status === "excluded" ? "text-gray-400" : "text-gray-700")}>{r.idNumber}</td>
      <td className="px-4 py-3 text-center"><ScoreCell value={r.chinese} isFilter={r.filterSubject === "chinese"} isExcluded={r.status === "excluded"} /></td>
      <td className="px-4 py-3 text-center"><ScoreCell value={r.english} isFilter={r.filterSubject === "english"} isExcluded={r.status === "excluded"} /></td>
      <td className="px-4 py-3 text-center"><ScoreCell value={r.math} isFilter={r.filterSubject === "math"} isExcluded={r.status === "excluded"} /></td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">{SUBJECT_LABELS[r.filterSubject]}</span>
      </td>
    </tr>
  );
}

function GroupedView({
  groupedData, showExcluded, excludedCount, totalShown,
}: {
  groupedData: Map<string, FilterResult[]>;
  showExcluded: boolean;
  excludedCount: number;
  totalShown: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (groupedData.size === 0) {
    return (
      <div className="px-4 py-12 text-center text-gray-400">
        <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>沒有符合條件的資料</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {[...groupedData.entries()].map(([key, rows]) => {
          const isCollapsed = collapsed.has(key);
          const first = rows[0];
          const activeCount = rows.filter((r) => r.status !== "excluded").length;
          const priorityCount = rows.filter((r) => r.status === "priority").length;
          const excludedInGroup = rows.filter((r) => r.status === "excluded").length;

          return (
            <div key={key}>
              <button
                className="w-full px-5 py-3 flex items-center justify-between bg-gray-50/60 hover:bg-gray-100/40 transition-colors"
                onClick={() => toggle(key)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800 text-sm">
                    {GRADE_LABELS[first.grade] || `${first.grade}年級`} · {first.class}
                  </span>
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
                    {activeCount} 人
                  </span>
                  {priorityCount > 0 && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      優先 {priorityCount}
                    </span>
                  )}
                  {excludedInGroup > 0 && showExcluded && (
                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                      特生 {excludedInGroup}
                    </span>
                  )}
                </div>
                {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
              </button>

              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">狀態</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">座號</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">姓名</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">身分證字號</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">國文</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">英文</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">數學</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">篩選科目</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-b border-gray-50",
                            r.status === "excluded" ? "opacity-50"
                              : r.status === "priority" ? "bg-amber-50/30"
                              : ""
                          )}
                        >
                          <td className="px-4 py-2">
                            {r.status === "priority" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />優先
                              </span>
                            ) : r.status === "excluded" ? (
                              <span className="text-xs text-gray-400">特生</span>
                            ) : (
                              <span className="text-xs text-blue-600 font-medium">一般</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{r.seatNo}</td>
                          <td className={cn("px-4 py-2 font-medium text-sm", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>{r.name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.idNumber}</td>
                          <td className="px-4 py-2 text-center"><ScoreCell value={r.chinese} isFilter={r.filterSubject === "chinese"} isExcluded={r.status === "excluded"} /></td>
                          <td className="px-4 py-2 text-center"><ScoreCell value={r.english} isFilter={r.filterSubject === "english"} isExcluded={r.status === "excluded"} /></td>
                          <td className="px-4 py-2 text-center"><ScoreCell value={r.math} isFilter={r.filterSubject === "math"} isExcluded={r.status === "excluded"} /></td>
                          <td className="px-4 py-2">
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">{SUBJECT_LABELS[r.filterSubject]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50/30">
        共 {groupedData.size} 個班級，顯示 {totalShown} 筆
        {excludedCount > 0 && !showExcluded && `（另有 ${excludedCount} 名特生已隱藏）`}
      </div>
    </>
  );
}

function ScoreCell({ value, isFilter, isExcluded }: { value?: number; isFilter: boolean; isExcluded: boolean }) {
  if (value === undefined || value === null) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={cn("text-sm font-semibold", isExcluded ? "text-gray-400" : isFilter ? "text-blue-700" : "text-gray-700")}>
      {value}
    </span>
  );
}
