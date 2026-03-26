import { useState, useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { FilterResult, Subject, SUBJECT_LABELS, GRADE_LABELS } from "../types";
import { exportToExcel, exportToCsv } from "../lib/excel";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Star,
  Users,
  ChevronUp,
  ChevronDown,
  Search,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = keyof FilterResult | "none";
type SortDir = "asc" | "desc";

export default function ResultPage({ onPrev, onReset }: { onPrev: () => void; onReset: () => void }) {
  const { filterResults } = useAppContext();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [subjectFilter, setSubjectFilter] = useState<Subject | "all">("all");

  const grades = useMemo(
    () =>
      [...new Set(filterResults.map((r) => r.grade))].sort((a, b) => a - b),
    [filterResults]
  );

  const subjects = useMemo(
    () =>
      [...new Set(filterResults.map((r) => r.filterSubject))] as Subject[],
    [filterResults]
  );

  const filtered = useMemo(() => {
    let data = filterResults.filter((r) => r.status !== "excluded");

    if (gradeFilter !== "all") {
      data = data.filter((r) => r.grade === gradeFilter);
    }
    if (subjectFilter !== "all") {
      data = data.filter((r) => r.filterSubject === subjectFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.idNumber.toLowerCase().includes(q) ||
          r.class.toLowerCase().includes(q)
      );
    }

    if (sortKey !== "none") {
      data = [...data].sort((a, b) => {
        const aVal = a[sortKey as keyof FilterResult] ?? "";
        const bVal = b[sortKey as keyof FilterResult] ?? "";
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        return sortDir === "asc"
          ? String(aVal).localeCompare(String(bVal), "zh-TW")
          : String(bVal).localeCompare(String(aVal), "zh-TW");
      });
    }

    return data;
  }, [filterResults, gradeFilter, subjectFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k)
      return <ChevronUp className="w-3.5 h-3.5 text-gray-300" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
    );
  };

  const exportData = () =>
    filtered.map((r) => ({
      姓名: r.name,
      年級: GRADE_LABELS[r.grade] || r.grade,
      班級: r.class,
      座號: r.seatNo,
      身分證字號: r.idNumber,
      科目: SUBJECT_LABELS[r.filterSubject],
      成績: r.filterScore,
      狀態: r.status === "priority" ? "優先" : "一般",
    }));

  const priorityCount = filterResults.filter((r) => r.status === "priority").length;
  const normalCount = filterResults.filter((r) => r.status === "normal").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">總計人次</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {filterResults.filter(r => r.status !== "excluded").length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-amber-600 font-medium">優先（在校生）</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {priorityCount}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-blue-600 font-medium">一般篩選</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{normalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">目前顯示</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </div>
      </div>

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
          <div className="flex gap-2 flex-wrap">
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={gradeFilter}
              onChange={(e) =>
                setGradeFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
            >
              <option value="all">全部年級</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {GRADE_LABELS[g] || `${g}年級`}
                </option>
              ))}
            </select>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subjectFilter}
              onChange={(e) =>
                setSubjectFilter(e.target.value as Subject | "all")
              }
            >
              <option value="all">全部科目</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {SUBJECT_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              onClick={() => exportToExcel(exportData(), "篩選結果.xlsx")}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => exportToCsv(exportData(), "篩選結果.csv")}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/30">
                {[
                  { key: "status", label: "狀態" },
                  { key: "name", label: "姓名" },
                  { key: "grade", label: "年級" },
                  { key: "class", label: "班級" },
                  { key: "seatNo", label: "座號" },
                  { key: "idNumber", label: "身分證字號" },
                  { key: "filterSubject", label: "科目" },
                  { key: "filterScore", label: "成績" },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort(key as SortKey)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <SortIcon k={key as SortKey} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>沒有符合條件的資料</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-gray-50 hover:bg-gray-50/50 transition-colors",
                      r.status === "priority" && "bg-amber-50/40"
                    )}
                  >
                    <td className="px-4 py-3">
                      {r.status === "priority" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          優先
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2.5 py-1">
                          一般
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {GRADE_LABELS[r.grade] || `${r.grade}年級`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.class}</td>
                    <td className="px-4 py-3 text-gray-600">{r.seatNo}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {r.idNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-700 bg-gray-100 rounded-full px-2.5 py-1">
                        {SUBJECT_LABELS[r.filterSubject]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {r.filterScore}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
