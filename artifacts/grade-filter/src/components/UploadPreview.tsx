import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown, ChevronUp, RefreshCw, CheckCircle, AlertCircle,
  AlertTriangle, BarChart2, Copy, Save, Trash2, Sparkles,
} from "lucide-react";
import { Subject, Student, ExcelProfile } from "../types";
import { ColumnMapping, remapStudents, DuplicateGroup, ScoreAnomaly, GradeScoreStat } from "../lib/excel";
import { storageGet, storageSet, STORAGE_KEYS } from "../lib/storage";
import { toast } from "sonner";
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

const fieldLabelsKeys: Record<keyof Pick<ColumnMapping, "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx">, string> = {
  nameIdx: "upload.fieldName",
  gradeIdx: "upload.fieldGrade",
  classIdx: "upload.fieldClass",
  seatIdx: "upload.fieldSeat",
  idIdx: "upload.fieldId",
  scoreIdx: "upload.fieldScore",
};

const REQUIRED_FIELDS: (keyof Pick<ColumnMapping, "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx">)[] = [
  "nameIdx", "gradeIdx", "idIdx", "scoreIdx", "seatIdx", "classIdx",
];

export default function UploadPreview({
  subject, students, rawRows, mapping,
  duplicates, anomalies, gradeStats,
  onRemapped, onDeduplicated,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [localMapping, setLocalMapping] = useState<ColumnMapping>(mapping);
  const [remapWarnings, setRemapWarnings] = useState<string[]>([]);
  const [dupResolved, setDupResolved] = useState(false);
  const [profiles, setProfiles] = useState<ExcelProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [profileFormOpen, setProfileFormOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const list = (await storageGet<ExcelProfile[]>(STORAGE_KEYS.EXCEL_PROFILES)) ?? [];
      list.sort((a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt));
      setProfiles(list);
    })();
  }, []);

  const colLabels = mapping.colLabels;
  const preview = students.slice(0, 3);

  const hasDuplicates = duplicates.length > 0;
  const hasAnomalies = anomalies.length > 0;
  const highBlankGrades = gradeStats.filter((g) => g.blankRate > 0.3);

  // P2.1: 關鍵欄位置信度低 → 提醒使用者檢查
  const CRITICAL_FIELDS: (keyof typeof fieldLabelsKeys)[] = ["nameIdx", "idIdx", "scoreIdx"];
  const lowConfidenceFields = CRITICAL_FIELDS.filter((f) => {
    const idx = mapping[f];
    if (idx === -1) return false;
    const c = mapping.confidence?.[f] ?? 1;
    return c < 0.6;
  });
  const hasLowConfidence = lowConfidenceFields.length > 0;

  const alertCount =
    (hasDuplicates ? 1 : 0) +
    (hasAnomalies ? 1 : 0) +
    (highBlankGrades.length > 0 ? 1 : 0) +
    (hasLowConfidence ? 1 : 0);

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

  const saveProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error(t("upload.profileNameRequired"));
      return;
    }
    const prof: ExcelProfile = {
      id: `prof-${Date.now()}`,
      name: newProfileName.trim(),
      mapping: {
        nameIdx: localMapping.nameIdx,
        gradeIdx: localMapping.gradeIdx,
        classIdx: localMapping.classIdx,
        seatIdx: localMapping.seatIdx,
        idIdx: localMapping.idIdx,
        scoreIdx: localMapping.scoreIdx,
        gradeFromClass: localMapping.gradeFromClass,
        dataStartRow: localMapping.dataStartRow,
      },
      headerSignature: colLabels.slice(0, 12).map((s) => String(s ?? "")),
      createdAt: Date.now(),
    };
    const next = [prof, ...profiles];
    await storageSet(STORAGE_KEYS.EXCEL_PROFILES, next);
    setProfiles(next);
    setNewProfileName("");
    setProfileFormOpen(false);
    toast.success(t("upload.profileSaved", { name: prof.name }));
  };

  const applyProfile = async (profileId: string) => {
    const prof = profiles.find((p) => p.id === profileId);
    if (!prof) return;
    const { mapping: pm } = prof;
    const newLocal: ColumnMapping = {
      ...localMapping,
      nameIdx: pm.nameIdx,
      gradeIdx: pm.gradeIdx,
      classIdx: pm.classIdx,
      seatIdx: pm.seatIdx,
      idIdx: pm.idIdx,
      scoreIdx: pm.scoreIdx,
      gradeFromClass: pm.gradeFromClass,
    };
    setLocalMapping(newLocal);
    // Immediately re-run parsing with this mapping
    const { students: newStudents, warnings } = remapStudents(rawRows, newLocal, subject);
    setRemapWarnings(warnings);
    onRemapped(newStudents, warnings, newLocal);
    // Update lastUsedAt
    const next = profiles.map((p) => (p.id === profileId ? { ...p, lastUsedAt: Date.now() } : p));
    await storageSet(STORAGE_KEYS.EXCEL_PROFILES, next);
    setProfiles(next);
    toast.success(t("upload.profileApplied", { name: prof.name }));
  };

  const deleteProfile = async (profileId: string) => {
    const prof = profiles.find((p) => p.id === profileId);
    if (!prof) return;
    if (!confirm(t("upload.confirmDeleteProfile", { name: prof.name }))) return;
    const next = profiles.filter((p) => p.id !== profileId);
    await storageSet(STORAGE_KEYS.EXCEL_PROFILES, next);
    setProfiles(next);
    toast.success(t("upload.deleted"));
  };

  const colOptions = [
    { value: -1, label: t("upload.notSelected") },
    ...colLabels.map((label, i) => ({ value: i, label: t("upload.columnLabel", { n: i + 1, label: label.slice(0, 8) }) })),
  ];

  /** 依據置信度挑選顏色。>= 0.85 綠、>= 0.60 黃、其他 橘（低置信但有偵測）*/
  const confidenceStyle = (conf: number | undefined): {
    bg: string;
    icon: React.ReactNode;
    tierLabel: string;
    tierColor: string;
  } => {
    const c = conf ?? 0;
    if (c >= 0.85) {
      return {
        bg: "bg-green-50 text-green-700 border-green-200",
        icon: <CheckCircle className="w-3 h-3" />,
        tierLabel: t("upload.confidenceHigh"),
        tierColor: "bg-green-100 text-green-700",
      };
    }
    if (c >= 0.6) {
      return {
        bg: "bg-amber-50 text-amber-800 border-amber-200",
        icon: <AlertTriangle className="w-3 h-3" />,
        tierLabel: t("upload.confidenceMed"),
        tierColor: "bg-amber-100 text-amber-700",
      };
    }
    return {
      bg: "bg-orange-50 text-orange-800 border-orange-200",
      icon: <AlertTriangle className="w-3 h-3" />,
      tierLabel: t("upload.confidenceLow"),
      tierColor: "bg-orange-100 text-orange-700",
    };
  };

  const fieldBadge = (
    field: keyof Pick<ColumnMapping, "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx">,
    label: string,
    idx: number,
  ) => {
    const found = idx !== -1;
    const conf = mapping.confidence?.[field];
    const style = confidenceStyle(conf);
    const confPct = conf ? Math.round(conf * 100) : 0;
    return (
      <span
        key={field}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
          found ? style.bg : "bg-red-50 text-red-600 border-red-200"
        )}
        title={found ? t("upload.confidenceLabel", { pct: confPct, tier: style.tierLabel }) : t("upload.notDetected")}
      >
        {found ? style.icon : <AlertCircle className="w-3 h-3" />}
        {label}
        {found && (
          <span className="text-xs opacity-70">
            :{" "}
            {field === "gradeIdx" && mapping.gradeFromClass
              ? `${colLabels[idx] ?? `${t("upload.columnLabel", { n: idx + 1, label: "" })}`}${t("upload.classCodeNote")}`
              : colLabels[idx] ?? t("upload.columnLabel", { n: idx + 1, label: "" })}
          </span>
        )}
        {found && conf !== undefined && (
          <span className={cn("ml-1 rounded px-1 py-0.5 text-[10px] font-bold", style.tierColor)}>
            {confPct}%
          </span>
        )}
        {!found && <span className="opacity-70">: {t("upload.notDetected")}</span>}
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
          {t("upload.previewTitle", { count: students.length })}
          {alertCount > 0 && !dupResolved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {t("upload.alertCount", { count: alertCount })}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">

          {hasLowConfidence && (
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-orange-800">
                    {t("upload.lowConfidenceWarning")}
                  </p>
                  <ul className="mt-1 text-xs text-orange-700 space-y-0.5">
                    {lowConfidenceFields.map((f) => {
                      const c = mapping.confidence?.[f] ?? 0;
                      return (
                        <li key={f}>
                          {t("upload.confidenceField", { field: t(fieldLabelsKeys[f]), pct: Math.round(c * 100) })}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1 text-xs text-orange-600 italic">
                    {t("upload.manualMappingHint")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasDuplicates && !dupResolved && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <Copy className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">
                    {t("upload.duplicatesFound", { count: duplicates.length })}
                  </p>
                  <div className="space-y-1 mb-2">
                    {duplicates.map((d) => (
                      <p key={d.idNumber} className="text-xs text-amber-700">
                        ⚠ {d.name}({d.idNumber.slice(0, 4)}****)
                        {t("upload.duplicateDetail", { count: d.count, rows: d.rows.join(", ") })}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={handleKeepHighest}
                      className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
                    >
                      {t("upload.keepHighest")}
                    </button>
                    <button
                      onClick={() => setDupResolved(true)}
                      className="px-3 py-1 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-100 transition-colors"
                    >
                      {t("upload.ignoreContinue")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {dupResolved && hasDuplicates && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center gap-2 text-xs text-green-700">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {t("upload.duplicatesResolved")}
            </div>
          )}

          {(hasAnomalies || highBlankGrades.length > 0) && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-orange-800">{t("upload.anomalyDetection")}</p>
              </div>
              {hasAnomalies && (
                <div>
                  <p className="text-xs text-orange-700 font-medium mb-1">{t("upload.anomalyScoreRange")}</p>
                  {anomalies.map((a, i) => (
                    <p key={i} className="text-xs text-orange-700">
                      {t("upload.anomalyScoreDetail", { name: a.name, score: a.score, row: a.row })}
                    </p>
                  ))}
                </div>
              )}
              {highBlankGrades.length > 0 && (
                <div>
                  <p className="text-xs text-orange-700 font-medium mb-1">{t("upload.highBlankRate")}</p>
                  {highBlankGrades.map((g) => (
                    <p key={g.grade} className="text-xs text-orange-700">
                      {t("upload.blankRateDetail", { grade: g.grade, total: g.total, missing: g.missing, rate: (g.blankRate * 100).toFixed(1) })}
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
                {t("upload.gradeStatTitle")}
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
                    {t("upload.gradeStatSummary", { grade: g.grade, total: g.total })}
                    {g.missing > 0 && `, ${t("upload.blankRateDetail", { grade: g.grade, total: g.total, missing: g.missing, rate: (g.blankRate * 100).toFixed(0) })}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {fieldBadge("gradeIdx", t("upload.thGrade"), mapping.gradeIdx)}
            {fieldBadge("classIdx", t("upload.thClass"), mapping.classIdx)}
            {fieldBadge("nameIdx", t("upload.thName"), mapping.nameIdx)}
            {fieldBadge("scoreIdx", t("upload.scoreLabel", { subject: t(`subjects.${subject}`) }), mapping.scoreIdx)}
            {fieldBadge("idIdx", t("upload.thIdNumber"), mapping.idIdx)}
            {fieldBadge("seatIdx", t("upload.thSeat"), mapping.seatIdx)}
          </div>

          {mapping.gradeFromClass && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5 border border-blue-100">
              {t("upload.gradeFromClassHint")}
            </p>
          )}

          <div>
            <button
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-600 font-medium transition-colors mb-2"
              onClick={() => setManualExpanded((p) => !p)}
            >
              {manualExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {t("upload.manualMapping")}
            </button>

            {manualExpanded && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
                {/* P2.2: Excel 欄位 Profile 管理 */}
                <div className="rounded-md border border-violet-200 bg-violet-50/60 p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      <span className="text-xs font-semibold text-violet-800">
                        {t("upload.profileTitle", { count: profiles.length })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProfileFormOpen((p) => !p)}
                      className="flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900 font-medium"
                    >
                      <Save className="w-3 h-3" />
                      {profileFormOpen ? t("upload.cancelSave") : t("upload.saveCurrentSettings")}
                    </button>
                  </div>

                  {profileFormOpen && (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder={t("upload.profilePlaceholder")}
                        className="flex-1 text-xs border border-violet-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveProfile();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={saveProfile}
                        className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700 transition-colors"
                      >
                        {t("actions.save")}
                      </button>
                    </div>
                  )}

                  {profiles.length === 0 ? (
                    <p className="text-xs text-violet-600/80 italic">
                      {t("upload.noProfilesHint")}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {profiles.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 px-2 py-1.5 bg-white rounded border border-violet-100"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                            <p className="text-[10px] text-gray-500 truncate" title={p.headerSignature.join(" | ")}>
                              {t("upload.profileHeader")}{p.headerSignature.filter(Boolean).slice(0, 4).join(", ") || t("upload.profileNone")}
                              {p.lastUsedAt && ` · ${t("upload.profileLastUsed")}${new Date(p.lastUsedAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyProfile(p.id)}
                            className="px-2 py-1 text-[11px] font-medium text-violet-700 border border-violet-300 rounded hover:bg-violet-100 transition-colors whitespace-nowrap"
                          >
                            {t("actions.apply")}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProfile(p.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title={t("upload.deleteProfile")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REQUIRED_FIELDS.map((field) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {t(fieldLabelsKeys[field])}
                        {field === "gradeIdx" && (
                          <span className="font-normal text-gray-400 ml-1">
                            {t("upload.gradeFromClassNote")}
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
                      {t("upload.threeDigitClassCode")}
                    </label>
                  </div>
                  <button
                    onClick={handleRemap}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t("upload.reapply")}
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
                {t("upload.previewLabel", { count: preview.length })}
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{t("upload.thGrade")}</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{t("upload.thClass")}</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{t("upload.thSeat")}</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{t("upload.thName")}</th>
                      <th className="px-3 py-2 text-right text-gray-600 font-medium whitespace-nowrap">
                        {t("upload.scoreLabel", { subject: t(`subjects.${subject}`) })}
                      </th>
                      <th className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">{t("upload.thIdNumber")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-1.5 text-gray-700">{s.grade || "\u2014"}</td>
                        <td className="px-3 py-1.5 text-gray-700">{s.class || "\u2014"}</td>
                        <td className="px-3 py-1.5 text-gray-700">{s.seatNo || "\u2014"}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900">{s.name || "\u2014"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-blue-700">
                          {s[subject] != null ? s[subject] : "\u2014"}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-gray-600">
                          {s.idNumber
                            ? s.idNumber.slice(0, 4) + "****" + s.idNumber.slice(-2)
                            : "\u2014"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t("upload.noPreview")}</p>
          )}
        </div>
      )}
    </div>
  );
}
