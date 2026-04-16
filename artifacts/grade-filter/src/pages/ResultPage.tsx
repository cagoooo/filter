import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFilterContext } from "../context/AppContext";
import { FilterResult, Subject } from "../types";
import { exportToExcel, exportToCsv } from "../lib/excel";
import {
  ArrowLeft, FileSpreadsheet, FileText, Star, Users,
  ChevronUp, ChevronDown, Search, RefreshCw, UserX, List, LayoutList,
  TrendingUp, Printer, Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts";
import { useIsMobile } from "../hooks/use-mobile";
import ScoreDistributionChart from "../components/ScoreDistributionChart";
import { FilterSnapshotDialog } from "../components/FilterSnapshotDialog";
import { VirtualResultList } from "../components/VirtualResultList";

// P2.5：資料量 >= 200 筆時改用虛擬列表，DOM 節點約維持在可見 10~15 列
const VIRTUAL_THRESHOLD = 200;

type SortKey = keyof FilterResult | "none";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grouped";

export default function ResultPage({ onPrev, onReset }: { onPrev: () => void; onReset: () => void }) {
  const { t } = useTranslation();
  const { filterResults, filterConfigs } = useFilterContext();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleExport = () => {
    if (filterResults.length === 0) {
      toast.error(t("result.noDataToExport"));
      return;
    }
    try {
      exportToExcel(exportData(true), t("result.exportFilename"));
      toast.success(t("result.exported", { count: filterResults.length }));
    } catch {
      toast.error(t("result.exportFailed"));
    }
  };

  const handlePrint = () => {
    if (filterResults.length === 0) {
      toast.error(t("result.noDataToPrint"));
      return;
    }
    window.print();
  };

  useKeyboardShortcuts({
    onExport: () => handleExport(),
    onPrint: () => handlePrint(),
  });
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
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }
    return data;
  }, [filterResults, gradeFilter, subjectFilter, search, sortKey, sortDir, showExcluded]);

  const groupedData = useMemo(() => {
    const map = new Map<string, FilterResult[]>();
    const sorted = [...filtered].sort((a, b) => {
      const ga = a.grade || 0;
      const gb = b.grade || 0;
      if (ga !== gb) return ga - gb;
      return String(a.class ?? "").localeCompare(String(b.class ?? ""));
    });
    for (const r of sorted) {
      // 空值保護：避免產生 "undefined-undefined" 之類的 key
      const gradeKey = r.grade || "unknown";
      const classKey = r.class && String(r.class).trim() ? r.class : "unknown";
      const key = `${gradeKey}-${classKey}`;
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
      [t("result.exportStatus")]: r.status === "priority" ? t("result.exportPriority") : r.status === "excluded" ? t("result.exportExcluded") : t("result.exportNormal"),
      [t("result.exportName")]: r.name,
      [t("result.exportGrade")]: t(`grades.g${r.grade}`, { defaultValue: `${r.grade}` }),
      [t("result.exportClass")]: r.class,
      [t("result.exportSeat")]: r.seatNo,
      [t("result.exportIdNumber")]: r.idNumber,
      [t("result.exportChinese")]: r.chinese ?? "",
      [t("result.exportEnglish")]: r.english ?? "",
      [t("result.exportMath")]: r.math ?? "",
      [t("result.exportFilterSubject")]: t(`subjects.${r.filterSubject}`),
      [t("result.exportFilterScore")]: r.filterScore,
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
      a.grade !== b.grade ? a.grade - b.grade : String(a.cls).localeCompare(String(b.cls))
    );
  }, [filterResults]);

  const TABLE_COLS: { key: string; labelKey: string }[] = [
    { key: "status", labelKey: "result.colStatus" },
    { key: "name", labelKey: "result.colName" },
    { key: "grade", labelKey: "result.colGrade" },
    { key: "class", labelKey: "result.colClass" },
    { key: "seatNo", labelKey: "result.colSeat" },
    { key: "idNumber", labelKey: "result.colIdNumber" },
    { key: "chinese", labelKey: "subjects.chinese" },
    { key: "english", labelKey: "subjects.english" },
    { key: "math", labelKey: "subjects.math" },
    { key: "filterSubject", labelKey: "result.colFilterSubject" },
  ];

  return (
    <div className="space-y-5 print-container">
      <div className="print-header hidden">
        <h1>{t("result.reportTitle")}</h1>
        <div className="print-date">
          {t("result.printDate")}{new Date().toLocaleDateString()} · {t("result.totalPeople", { count: priorityCount + normalCount })}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">{t("result.totalLabel")}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{priorityCount + normalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm bg-amber-50/40">
          <p className="text-xs text-amber-600 font-medium">{t("result.priorityLabel")}</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{priorityCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm bg-blue-50/30">
          <p className="text-xs text-blue-600 font-medium">{t("result.normalLabel")}</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{normalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm opacity-70">
          <p className="text-xs text-gray-500 font-medium">{t("result.excludedLabel")}</p>
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
              <span className="text-sm font-semibold text-gray-800">{t("result.statsSummary")}</span>
              <span className="text-xs text-gray-400 font-normal">{t("result.statsSubtitle")}</span>
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
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t("result.thGrade")}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{t("result.thSubject")}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">{t("result.thCount")}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-600">{t("result.thMax")}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-rose-500">{t("result.thMin")}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-blue-600">{t("result.thAvg")}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-amber-600">{t("result.thCutoff")}</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-40">{t("result.thDistribution")}</th>
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
                          {t(`grades.g${grade}`, { defaultValue: `${grade}` })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${subjectColors[subject]}`}>
                            {t(`subjects.${subject}`)}
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
                  <p className="text-xs font-semibold text-gray-500 mb-3">{t("result.classBreakdown")}</p>
                  <div className="flex flex-wrap gap-2">
                    {classStats.map(({ grade, cls, count, priority }) => (
                      <div
                        key={`${grade}-${cls}`}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-xs text-gray-500">{grade}{t("result.yearUnit")}{cls}</span>
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

      <ScoreDistributionChart results={filterResults} />

      {(gradeStats.length > 0 || subjectStats.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gradeStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("result.gradeBreakdown")}</h3>
              <div className="space-y-2">
                {gradeStats.map(({ grade, count }) => {
                  const max = Math.max(...gradeStats.map((g) => g.count));
                  return (
                    <div key={grade} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-14 flex-shrink-0">{t(`grades.g${grade}`, { defaultValue: `${grade}` })}</span>
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
              <h3 className="text-sm font-semibold text-gray-700 mb-3">{t("result.subjectBreakdown")}</h3>
              <div className="space-y-2">
                {subjectStats.map(({ subject, count }) => {
                  const max = Math.max(...subjectStats.map((s) => s.count));
                  const colors: Record<Subject, string> = { chinese: "bg-rose-400", english: "bg-blue-400", math: "bg-emerald-400" };
                  return (
                    <div key={subject} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-14 flex-shrink-0">{t(`subjects.${subject}`)}</span>
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
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("result.searchPlaceholder")}
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
              <option value="all">{t("result.allGrades")}</option>
              {grades.map((g) => <option key={g} value={g}>{t(`grades.g${g}`, { defaultValue: `${g}` })}</option>)}
            </select>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value as Subject | "all")}
            >
              <option value="all">{t("result.allSubjects")}</option>
              {subjects.map((s) => <option key={s} value={s}>{t(`subjects.${s}`)}</option>)}
            </select>

            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
                  viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
                title={t("result.listViewTitle")}
              >
                <List className="w-4 h-4" />
                {t("result.listView")}
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-200",
                  viewMode === "grouped" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
                title={t("result.groupedViewTitle")}
              >
                <LayoutList className="w-4 h-4" />
                {t("result.groupedView")}
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
              {showExcluded ? t("result.hideExcluded") : t("result.showExcluded")}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              title={`${t("actions.exportExcel")} (Ctrl+E)`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={() => {
                try {
                  exportToCsv(exportData(true), t("result.csvFilename"));
                  toast.success(t("result.csvExported"));
                } catch { toast.error(t("result.exportFailed")); }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors no-print"
              title={`${t("actions.print")} (Ctrl+P)`}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t("actions.print")}</span>
            </button>
            <button
              onClick={() => setSnapshotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-colors no-print"
              title={t("result.snapshotTitle")}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">{t("actions.snapshot")}</span>
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <>
            {filtered.length >= VIRTUAL_THRESHOLD ? (
              /* P2.5：大資料集使用虛擬捲動 */
              <VirtualResultList
                results={filtered}
                isMobile={isMobile}
                sortKey={sortKey}
                sortDir={sortDir}
                onToggleSort={toggleSort}
              />
            ) : isMobile ? (
              /* P2.3 行動裝置：改用卡片列表取代橫向捲動表格 */
              <div className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>{t("result.noMatchingData")}</p>
                  </div>
                ) : (
                  filtered.map((r) => <ResultCard key={r.id} r={r} />)
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/30">
                      {TABLE_COLS.map(({ key, labelKey }) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap"
                          onClick={() => toggleSort(key as SortKey)}
                        >
                          <span className="flex items-center gap-1">{t(labelKey)}<SortIcon k={key as SortKey} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p>{t("result.noMatchingData")}</p>
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => <ResultRow key={r.id} r={r} />)
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50/30 flex items-center justify-between gap-2">
              <span>
                {t("result.showingCount", { count: filtered.length })}
                {excludedCount > 0 && !showExcluded && ` (${t("result.hiddenExcluded", { count: excludedCount })})`}
              </span>
              {filtered.length >= VIRTUAL_THRESHOLD && (
                <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                  {t("status.virtualized")}
                </span>
              )}
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
          {t("result.editFilter")}
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 border border-red-200 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t("result.restart")}
        </button>
      </div>

      <FilterSnapshotDialog
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        currentConfigs={filterConfigs}
        currentResults={filterResults}
      />
    </div>
  );
}

function ResultRow({ r }: { r: FilterResult }) {
  const { t } = useTranslation();
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
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />{t("status.priority")}
          </span>
        ) : r.status === "excluded" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            <UserX className="w-3 h-3" />{t("result.excluded")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2.5 py-1">{t("status.normal")}</span>
        )}
      </td>
      <td className={cn("px-4 py-3 font-medium", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>{r.name || "—"}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{r.grade ? t(`grades.g${r.grade}`, { defaultValue: `${r.grade}` }) : "—"}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{r.class || "—"}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{r.seatNo || "—"}</td>
      <td className={cn("px-4 py-3 font-mono text-xs", r.status === "excluded" ? "text-gray-400" : "text-gray-700")}>{r.idNumber}</td>
      <td className="px-4 py-3 text-center"><ScoreCell value={r.chinese} isFilter={r.filterSubject === "chinese"} isExcluded={r.status === "excluded"} /></td>
      <td className="px-4 py-3 text-center"><ScoreCell value={r.english} isFilter={r.filterSubject === "english"} isExcluded={r.status === "excluded"} /></td>
      <td className="px-4 py-3 text-center"><ScoreCell value={r.math} isFilter={r.filterSubject === "math"} isExcluded={r.status === "excluded"} /></td>
      <td className="px-4 py-3">
        <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">{t(`subjects.${r.filterSubject}`)}</span>
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
  const { t } = useTranslation();
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
        <p>{t("result.noMatchingData")}</p>
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
                    {first.grade ? t(`grades.g${first.grade}`, { defaultValue: `${first.grade}` }) : t("result.unknownGrade")} · {first.class || t("result.unknownClass")}
                  </span>
                  <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
                    {activeCount} {t("result.personUnit")}
                  </span>
                  {priorityCount > 0 && (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                      {t("status.priority")} {priorityCount}
                    </span>
                  )}
                  {excludedInGroup > 0 && showExcluded && (
                    <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5">
                      {t("result.specialStudent")} {excludedInGroup}
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
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t("result.colStatus")}</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t("result.colSeat")}</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t("result.colName")}</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t("result.colIdNumber")}</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">{t("subjects.chinese")}</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">{t("subjects.english")}</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">{t("subjects.math")}</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{t("result.colFilterSubject")}</th>
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
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />{t("status.priority")}
                              </span>
                            ) : r.status === "excluded" ? (
                              <span className="text-xs text-gray-400">{t("result.specialStudent")}</span>
                            ) : (
                              <span className="text-xs text-blue-600 font-medium">{t("status.normal")}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">{r.seatNo}</td>
                          <td className={cn("px-4 py-2 font-medium text-sm", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>{r.name}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.idNumber}</td>
                          <td className="px-4 py-2 text-center"><ScoreCell value={r.chinese} isFilter={r.filterSubject === "chinese"} isExcluded={r.status === "excluded"} /></td>
                          <td className="px-4 py-2 text-center"><ScoreCell value={r.english} isFilter={r.filterSubject === "english"} isExcluded={r.status === "excluded"} /></td>
                          <td className="px-4 py-2 text-center"><ScoreCell value={r.math} isFilter={r.filterSubject === "math"} isExcluded={r.status === "excluded"} /></td>
                          <td className="px-4 py-2">
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">{t(`subjects.${r.filterSubject}`)}</span>
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
        {t("result.groupedFooter", { classes: groupedData.size, count: totalShown })}
        {excludedCount > 0 && !showExcluded && ` (${t("result.hiddenExcluded", { count: excludedCount })})`}
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

/** P2.3 行動裝置用卡片（取代表格）*/
function ResultCard({ r }: { r: FilterResult }) {
  const { t } = useTranslation();
  const subjects: Subject[] = ["chinese", "english", "math"];
  const statusBadge =
    r.status === "priority" ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />{t("status.priority")}
      </span>
    ) : r.status === "excluded" ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
        <UserX className="w-3 h-3" />{t("result.excluded")}
      </span>
    ) : (
      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">{t("status.normal")}</span>
    );

  return (
    <div
      className={cn(
        "px-4 py-3 transition-colors",
        r.status === "excluded" ? "bg-gray-50/80 opacity-70"
          : r.status === "priority" ? "bg-amber-50/30"
          : "bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("font-semibold text-sm truncate", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>
              {r.name || "—"}
            </span>
            {statusBadge}
          </div>
          <p className="text-xs text-gray-500">
            {r.grade ? t(`grades.g${r.grade}`, { defaultValue: `${r.grade}` }) : "—"}
            {r.class && <> · {r.class}{t("result.classUnit")}</>}
            {r.seatNo && <> · {r.seatNo}{t("result.seatUnit")}</>}
          </p>
          <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">{r.idNumber}</p>
        </div>
        <span className="text-[11px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
          {t(`subjects.${r.filterSubject}`)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {subjects.map((sub) => {
          const v = r[sub];
          const isFilter = r.filterSubject === sub;
          return (
            <div
              key={sub}
              className={cn(
                "rounded-md px-2 py-1.5 border text-center",
                isFilter
                  ? "bg-blue-50 border-blue-200"
                  : "bg-gray-50/60 border-gray-100"
              )}
            >
              <p className="text-[10px] text-gray-500">{t(`subjects.${sub}`)}</p>
              <p className={cn(
                "text-sm font-bold",
                r.status === "excluded" ? "text-gray-400"
                  : v == null ? "text-gray-300"
                  : isFilter ? "text-blue-700"
                  : "text-gray-700"
              )}>
                {v == null ? "—" : v}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
