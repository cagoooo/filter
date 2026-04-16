import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDataContext, useUIContext } from "../context/AppContext";
import { ColumnMapping, DuplicateGroup, ScoreAnomaly, GradeScoreStat } from "../lib/excel";
import {
  parseScoreFileAsync as parseScoreFile,
  parseListFileAsync as parseListFile,
  parseMultiSubjectFileAsync,
} from "../lib/excel-client";
import FileUploadCard from "../components/FileUploadCard";
import UploadPreview from "../components/UploadPreview";
import { Student, Subject } from "../types";
import { Info, ArrowRight, Users, UserX, AlertTriangle, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { toast } from "sonner";

type UploadStatus = "idle" | "loading" | "success" | "error";

interface FileState {
  status: UploadStatus;
  fileName?: string;
  errorMessage?: string;
  warnings: string[];
  count: number;
}

interface ScoreFileExtras {
  rawRows: string[][];
  mapping: ColumnMapping;
  students: Student[];
  duplicates: DuplicateGroup[];
  anomalies: ScoreAnomaly[];
  gradeStats: GradeScoreStat[];
}

interface ListMismatch {
  name: string;
  idNumber: string;
}

const defaultFileState: FileState = { status: "idle", warnings: [], count: 0 };

function restoredState(fileName: string, count: number): FileState {
  return { status: "success", fileName, warnings: [], count };
}

function computeMismatches(listStudents: Student[], scoreStudents: Student[][]): ListMismatch[] {
  const allScoreIds = new Set(
    scoreStudents.flat().map((s) => s.idNumber.trim().toUpperCase())
  );
  return listStudents
    .filter((s) => s.idNumber && !allScoreIds.has(s.idNumber.trim().toUpperCase()))
    .map((s) => ({ name: s.name, idNumber: s.idNumber }));
}

export default function ImportPage({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();
  const {
    setChineseData, setEnglishData, setMathData,
    setCurrentStudents, setSpecialStudents,
    chineseData, englishData, mathData, currentStudents, specialStudents,
    chineseFileName, englishFileName, mathFileName, currentFileName, specialFileName,
    setChineseFileName, setEnglishFileName, setMathFileName,
    setCurrentFileName, setSpecialFileName,
  } = useDataContext();
  const { isLoading } = useUIContext();

  const [chineseState, setChineseState] = useState<FileState>(defaultFileState);
  const [englishState, setEnglishState] = useState<FileState>(defaultFileState);
  const [mathState, setMathState] = useState<FileState>(defaultFileState);
  const [currentState, setCurrentState] = useState<FileState>(defaultFileState);
  const [specialState, setSpecialState] = useState<FileState>(defaultFileState);

  const [chineseExtras, setChineseExtras] = useState<ScoreFileExtras | null>(null);
  const [englishExtras, setEnglishExtras] = useState<ScoreFileExtras | null>(null);
  const [mathExtras, setMathExtras] = useState<ScoreFileExtras | null>(null);

  const [currentMismatches, setCurrentMismatches] = useState<ListMismatch[]>([]);
  const [specialMismatches, setSpecialMismatches] = useState<ListMismatch[]>([]);
  const [mismatchExpanded, setMismatchExpanded] = useState(false);

  // P1.6 — 單檔合併匯入
  const [multiExpanded, setMultiExpanded] = useState(false);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [multiSummary, setMultiSummary] = useState<
    | { fileName: string; counts: Record<Subject, number>; detected: Subject[]; warnings: string[] }
    | null
  >(null);

  useEffect(() => {
    if (isLoading) return;
    if (chineseData.length > 0 && chineseState.status === "idle")
      setChineseState(restoredState(chineseFileName || t("import.restoredData"), chineseData.length));
    if (englishData.length > 0 && englishState.status === "idle")
      setEnglishState(restoredState(englishFileName || t("import.restoredData"), englishData.length));
    if (mathData.length > 0 && mathState.status === "idle")
      setMathState(restoredState(mathFileName || t("import.restoredData"), mathData.length));
    if (currentStudents.length > 0 && currentState.status === "idle")
      setCurrentState(restoredState(currentFileName || t("import.restoredData"), currentStudents.length));
    if (specialStudents.length > 0 && specialState.status === "idle")
      setSpecialState(restoredState(specialFileName || t("import.restoredData"), specialStudents.length));
  }, [isLoading]);

  const allScoreData = [chineseData, englishData, mathData];

  const recomputeCurrentMismatches = (list: Student[], scores: Student[][]) => {
    setCurrentMismatches(computeMismatches(list, scores));
  };

  const recomputeSpecialMismatches = (list: Student[], scores: Student[][]) => {
    setSpecialMismatches(computeMismatches(list, scores));
  };

  const handleScoreUpload = async (
    file: File,
    subject: Subject,
    setState: React.Dispatch<React.SetStateAction<FileState>>,
    setData: (d: Student[]) => void,
    setExtras: (e: ScoreFileExtras | null) => void,
    setFileName: (name: string) => void
  ) => {
    setState({ status: "loading", warnings: [], count: 0 });
    setExtras(null);
    try {
      const result = await parseScoreFile(file, subject);
      setData(result.students);
      setFileName(file.name);
      setState({
        status: "success",
        fileName: file.name,
        warnings: result.warnings,
        count: result.students.length,
      });
      setExtras({
        rawRows: result.rawRows,
        mapping: result.mapping,
        students: result.students,
        duplicates: result.duplicates,
        anomalies: result.anomalies,
        gradeStats: result.gradeStats,
      });
      const updatedScores = subject === "chinese"
        ? [result.students, englishData, mathData]
        : subject === "english"
          ? [chineseData, result.students, mathData]
          : [chineseData, englishData, result.students];
      recomputeCurrentMismatches(currentStudents, updatedScores);
      recomputeSpecialMismatches(specialStudents, updatedScores);
    } catch (err: unknown) {
      setState({
        status: "error",
        errorMessage: err instanceof Error ? err.message : t("upload.parseFailed"),
        warnings: [],
        count: 0,
      });
    }
  };

  const handleRemapped = (
    setData: (d: Student[]) => void,
    setState: React.Dispatch<React.SetStateAction<FileState>>,
    setExtras: (e: ScoreFileExtras | null) => void,
    extras: ScoreFileExtras
  ) => (students: Student[], warnings: string[], newMapping: ColumnMapping) => {
    setData(students);
    setState((prev) => ({ ...prev, warnings, count: students.length }));
    setExtras({ ...extras, mapping: newMapping, students });
  };

  const handleDeduplicated = (
    setData: (d: Student[]) => void,
    setExtras: (e: ScoreFileExtras | null) => void,
    extras: ScoreFileExtras
  ) => (students: Student[]) => {
    setData(students);
    setExtras({ ...extras, students, duplicates: [] });
  };

  const handleCurrentListUpload = async (file: File) => {
    setCurrentState({ status: "loading", warnings: [], count: 0 });
    try {
      const result = await parseListFile(file);
      setCurrentStudents(result.students);
      setCurrentFileName(file.name);
      setCurrentState({ status: "success", fileName: file.name, warnings: result.warnings, count: result.students.length });
      recomputeCurrentMismatches(result.students, allScoreData);
    } catch (err: unknown) {
      setCurrentState({ status: "error", errorMessage: err instanceof Error ? err.message : t("upload.parseFailed"), warnings: [], count: 0 });
    }
  };

  const handleSpecialListUpload = async (file: File) => {
    setSpecialState({ status: "loading", warnings: [], count: 0 });
    try {
      const result = await parseListFile(file);
      setSpecialStudents(result.students);
      setSpecialFileName(file.name);
      setSpecialState({ status: "success", fileName: file.name, warnings: result.warnings, count: result.students.length });
      recomputeSpecialMismatches(result.students, allScoreData);
    } catch (err: unknown) {
      setSpecialState({ status: "error", errorMessage: err instanceof Error ? err.message : t("upload.parseFailed"), warnings: [], count: 0 });
    }
  };

  const clearScore = (
    setData: (d: Student[]) => void,
    setState: React.Dispatch<React.SetStateAction<FileState>>,
    setExtras: (e: ScoreFileExtras | null) => void,
    setFileName: (name: string) => void
  ) => {
    setData([]);
    setState(defaultFileState);
    setExtras(null);
    setFileName("");
  };

  const handleMultiSubjectUpload = async (file: File) => {
    setMultiLoading(true);
    setMultiError(null);
    try {
      const result = await parseMultiSubjectFileAsync(file);
      if (result.detectedSubjects.length === 0) {
        setMultiError(
          result.warnings[0] ??
            t("import.noSubjectDetected")
        );
        setMultiSummary(null);
        return;
      }
      const counts: Record<Subject, number> = { chinese: 0, english: 0, math: 0 };
      for (const subj of result.detectedSubjects) {
        const students = result.students[subj];
        counts[subj] = students.length;
        if (subj === "chinese") {
          setChineseData(students);
          setChineseFileName(file.name);
          setChineseState(restoredState(file.name, students.length));
          setChineseExtras(null);
        } else if (subj === "english") {
          setEnglishData(students);
          setEnglishFileName(file.name);
          setEnglishState(restoredState(file.name, students.length));
          setEnglishExtras(null);
        } else {
          setMathData(students);
          setMathFileName(file.name);
          setMathState(restoredState(file.name, students.length));
          setMathExtras(null);
        }
      }
      setMultiSummary({
        fileName: file.name,
        counts,
        detected: result.detectedSubjects,
        warnings: result.warnings,
      });
      const updatedScores = [
        counts.chinese ? result.students.chinese : chineseData,
        counts.english ? result.students.english : englishData,
        counts.math ? result.students.math : mathData,
      ];
      recomputeCurrentMismatches(currentStudents, updatedScores);
      recomputeSpecialMismatches(specialStudents, updatedScores);
      toast.success(
        t("import.multiImported", { subjects: result.detectedSubjects.map((s) => t(`subjects.${s}`)).join(", ") })
      );
    } catch (err: unknown) {
      setMultiError(err instanceof Error ? err.message : t("upload.parseFailed"));
      setMultiSummary(null);
    } finally {
      setMultiLoading(false);
    }
  };

  const hasAnyScore = chineseData.length > 0 || englishData.length > 0 || mathData.length > 0;
  const totalMismatches = currentMismatches.length + specialMismatches.length;

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">{t("import.formatTitle")}</p>
          <span className="text-sm text-blue-700 mt-1 block" dangerouslySetInnerHTML={{ __html: t("import.formatDescription") }} />
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
          {t("import.importScores")}
        </h2>

        {/* 合併檔案匯入（P1.6）*/}
        <div className="mb-4 border border-indigo-200 rounded-xl overflow-hidden">
          <button
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-indigo-800 bg-indigo-50 hover:bg-indigo-50/80 transition-colors"
            onClick={() => setMultiExpanded((p) => !p)}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              {t("import.multiSubjectTitle")}
            </span>
            {multiExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {multiExpanded && (
            <div className="bg-white border-t border-indigo-100 px-4 py-4 space-y-3">
              <p className="text-xs text-gray-600">
                {t("import.multiSubjectDesc")}
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 transition-colors text-sm font-medium">
                <Layers className="w-4 h-4" />
                {multiLoading ? t("import.parsingEllipsis") : t("import.selectMergedFile")}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={multiLoading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleMultiSubjectUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {multiError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {multiError}
                </div>
              )}
              {multiSummary && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-semibold">
                    {t("import.multiParsed", { fileName: multiSummary.fileName, count: multiSummary.detected.length })}
                  </p>
                  <ul className="list-disc list-inside">
                    {multiSummary.detected.map((s) => (
                      <li key={s}>
                        {t("import.subjectCount", { subject: t(`subjects.${s}`), count: multiSummary.counts[s] })}
                      </li>
                    ))}
                  </ul>
                  {multiSummary.warnings.length > 0 && (
                    <ul className="text-amber-700 mt-1">
                      {multiSummary.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FileUploadCard
              title={t("import.chineseTitle")}
              description={t("import.chineseDesc")}
              onFileSelect={(file) =>
                handleScoreUpload(file, "chinese", setChineseState, setChineseData, setChineseExtras, setChineseFileName)
              }
              status={chineseState.status}
              fileName={chineseState.fileName}
              errorMessage={chineseState.errorMessage}
              warnings={chineseState.warnings}
              onClear={() => clearScore(setChineseData, setChineseState, setChineseExtras, setChineseFileName)}
            />
            {chineseState.status === "success" && chineseExtras && (
              <UploadPreview
                subject="chinese"
                students={chineseExtras.students}
                rawRows={chineseExtras.rawRows}
                mapping={chineseExtras.mapping}
                duplicates={chineseExtras.duplicates}
                anomalies={chineseExtras.anomalies}
                gradeStats={chineseExtras.gradeStats}
                onRemapped={handleRemapped(setChineseData, setChineseState, setChineseExtras, chineseExtras)}
                onDeduplicated={handleDeduplicated(setChineseData, setChineseExtras, chineseExtras)}
              />
            )}
          </div>

          <div>
            <FileUploadCard
              title={t("import.englishTitle")}
              description={t("import.englishDesc")}
              onFileSelect={(file) =>
                handleScoreUpload(file, "english", setEnglishState, setEnglishData, setEnglishExtras, setEnglishFileName)
              }
              status={englishState.status}
              fileName={englishState.fileName}
              errorMessage={englishState.errorMessage}
              warnings={englishState.warnings}
              onClear={() => clearScore(setEnglishData, setEnglishState, setEnglishExtras, setEnglishFileName)}
            />
            {englishState.status === "success" && englishExtras && (
              <UploadPreview
                subject="english"
                students={englishExtras.students}
                rawRows={englishExtras.rawRows}
                mapping={englishExtras.mapping}
                duplicates={englishExtras.duplicates}
                anomalies={englishExtras.anomalies}
                gradeStats={englishExtras.gradeStats}
                onRemapped={handleRemapped(setEnglishData, setEnglishState, setEnglishExtras, englishExtras)}
                onDeduplicated={handleDeduplicated(setEnglishData, setEnglishExtras, englishExtras)}
              />
            )}
          </div>

          <div>
            <FileUploadCard
              title={t("import.mathTitle")}
              description={t("import.mathDesc")}
              onFileSelect={(file) =>
                handleScoreUpload(file, "math", setMathState, setMathData, setMathExtras, setMathFileName)
              }
              status={mathState.status}
              fileName={mathState.fileName}
              errorMessage={mathState.errorMessage}
              warnings={mathState.warnings}
              onClear={() => clearScore(setMathData, setMathState, setMathExtras, setMathFileName)}
            />
            {mathState.status === "success" && mathExtras && (
              <UploadPreview
                subject="math"
                students={mathExtras.students}
                rawRows={mathExtras.rawRows}
                mapping={mathExtras.mapping}
                duplicates={mathExtras.duplicates}
                anomalies={mathExtras.anomalies}
                gradeStats={mathExtras.gradeStats}
                onRemapped={handleRemapped(setMathData, setMathState, setMathExtras, mathExtras)}
                onDeduplicated={handleDeduplicated(setMathData, setMathExtras, mathExtras)}
              />
            )}
          </div>
        </div>

        {(chineseData.length > 0 || englishData.length > 0 || mathData.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-3">
            {chineseData.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {t("import.chineseCount", { count: chineseData.length })}
              </span>
            )}
            {englishData.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {t("import.englishCount", { count: englishData.length })}
              </span>
            )}
            {mathData.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {t("import.mathCount", { count: mathData.length })}
              </span>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
          {t("import.importLists")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploadCard
            title={t("import.currentStudentsTitle")}
            description={t("import.currentStudentsDesc")}
            onFileSelect={handleCurrentListUpload}
            status={currentState.status}
            fileName={currentState.fileName}
            errorMessage={currentState.errorMessage}
            warnings={currentState.warnings}
            onClear={() => {
              setCurrentStudents([]);
              setCurrentFileName("");
              setCurrentState(defaultFileState);
              setCurrentMismatches([]);
            }}
          />
          <FileUploadCard
            title={t("import.specialStudentsTitle")}
            description={t("import.specialStudentsDesc")}
            onFileSelect={handleSpecialListUpload}
            status={specialState.status}
            fileName={specialState.fileName}
            errorMessage={specialState.errorMessage}
            warnings={specialState.warnings}
            onClear={() => {
              setSpecialStudents([]);
              setSpecialFileName("");
              setSpecialState(defaultFileState);
              setSpecialMismatches([]);
            }}
          />
        </div>

        {(currentStudents.length > 0 || specialStudents.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-3">
            {currentStudents.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                <Users className="w-3.5 h-3.5" />
                {t("import.currentCount", { count: currentStudents.length })}
              </span>
            )}
            {specialStudents.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                <UserX className="w-3.5 h-3.5" />
                {t("import.specialCount", { count: specialStudents.length })}
              </span>
            )}
          </div>
        )}

        {totalMismatches > 0 && hasAnyScore && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 overflow-hidden">
            <button
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-amber-800 hover:bg-amber-100/60 transition-colors"
              onClick={() => setMismatchExpanded((p) => !p)}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {t("import.mismatchWarning", { count: totalMismatches })}
              </span>
              {mismatchExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {mismatchExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {currentMismatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {t("import.currentMismatchTitle", { count: currentMismatches.length })}
                    </p>
                    <div className="space-y-1">
                      {currentMismatches.map((m, i) => (
                        <p key={i} className="text-xs text-amber-700 font-mono">
                          • {m.name}（{m.idNumber || t("import.noIdNumber")}）
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {specialMismatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                      <UserX className="w-3.5 h-3.5" />
                      {t("import.specialMismatchTitle", { count: specialMismatches.length })}
                    </p>
                    <div className="space-y-1">
                      {specialMismatches.map((m, i) => (
                        <p key={i} className="text-xs text-amber-700 font-mono">
                          • {m.name}（{m.idNumber || t("import.noIdNumber")}）
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-amber-600 italic">
                  {t("import.mismatchHint")}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!hasAnyScore}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t("import.nextStep")}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
