import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterResult, Subject } from "../types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { BarChart3, PieChart as PieIcon, ChevronDown, ChevronUp } from "lucide-react";

const SUBJECT_COLORS: Record<Subject, string> = {
  chinese: "#f43f5e",
  english: "#3b82f6",
  math: "#10b981",
};

const CLASS_PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

interface ScoreDistributionChartProps {
  results: FilterResult[];
}

export default function ScoreDistributionChart({ results }: ScoreDistributionChartProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  const activeResults = useMemo(
    () => results.filter((r) => r.status !== "excluded"),
    [results]
  );

  // 1) 10 分一區間直方圖（依科目分開）
  const subjectHistograms = useMemo(() => {
    const subjects = Array.from(
      new Set(activeResults.map((r) => r.filterSubject))
    ) as Subject[];

    return subjects.map((subject) => {
      const bins: { range: string; count: number; minScore: number }[] = [];
      for (let i = 0; i < 10; i++) {
        bins.push({ range: `${i * 10}-${i * 10 + 9}`, count: 0, minScore: i * 10 });
      }
      bins.push({ range: "100+", count: 0, minScore: 100 });

      activeResults
        .filter((r) => r.filterSubject === subject)
        .forEach((r) => {
          const s = r.filterScore;
          if (s === undefined || s === null || isNaN(s)) return;
          if (s >= 100) bins[10].count++;
          else bins[Math.floor(s / 10)].count++;
        });

      return {
        subject,
        data: bins,
        total: activeResults.filter((r) => r.filterSubject === subject).length,
      };
    });
  }, [activeResults]);

  // 2) 各班錄取人數（前 10 名）
  const classPie = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of activeResults) {
      const key = `${r.grade ? t(`grades.g${r.grade}`, { defaultValue: `${r.grade}` }) : t("chart.unknown")}${r.class || "—"}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [activeResults, t]);

  if (activeResults.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden no-print">
      <button
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-800">{t("chart.title")}</span>
          <span className="text-xs text-gray-400 font-normal">{t("chart.subtitle")}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 space-y-6">
          {/* 分數分布直方圖 */}
          <div>
            <h3 className="text-xs font-semibold text-gray-600 mb-3">{t("chart.histogramTitle")}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectHistograms.map(({ subject, data, total }) => (
                <div key={subject} className="bg-gray-50/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                      style={{ backgroundColor: `${SUBJECT_COLORS[subject]}15`, color: SUBJECT_COLORS[subject] }}
                    >
                      {t(`subjects.${subject}`)}
                    </span>
                    <span className="text-xs text-gray-500">{t("chart.totalPeople", { count: total })}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 6 }}
                        formatter={(v: number) => [`${v}`, t("chart.personCount")]}
                      />
                      <Bar dataKey="count" fill={SUBJECT_COLORS[subject]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          </div>

          {/* 各班占比 */}
          {classPie.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5 text-purple-500" />
                {t("chart.classPieTitle")}
              </h3>
              <div className="bg-gray-50/60 rounded-lg p-3">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={classPie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                      style={{ fontSize: 11 }}
                    >
                      {classPie.map((_, i) => (
                        <Cell key={i} fill={CLASS_PALETTE[i % CLASS_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 6 }}
                      formatter={(v: number) => [`${v}`, t("chart.personCount")]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
