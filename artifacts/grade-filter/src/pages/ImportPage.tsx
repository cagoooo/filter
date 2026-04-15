import { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { ColumnMapping, DuplicateGroup, ScoreAnomaly, GradeScoreStat } from "../lib/excel";
import { parseScoreFileAsync as parseScoreFile, parseListFileAsync as parseListFile } from "../lib/excel-client";
import FileUploadCard from "../components/FileUploadCard";
import UploadPreview from "../components/UploadPreview";
import { Student, Subject } from "../types";
import { Info, ArrowRight, Users, UserX, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

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
  const {
    setChineseData, setEnglishData, setMathData,
    setCurrentStudents, setSpecialStudents,
    chineseData, englishData, mathData, currentStudents, specialStudents,
    chineseFileName, englishFileName, mathFileName, currentFileName, specialFileName,
    setChineseFileName, setEnglishFileName, setMathFileName,
    setCurrentFileName, setSpecialFileName,
    isLoading,
  } = useAppContext();

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

  useEffect(() => {
    if (isLoading) return;
    if (chineseData.length > 0 && chineseState.status === "idle")
      setChineseState(restoredState(chineseFileName || "（上次匯入的資料）", chineseData.length));
    if (englishData.length > 0 && englishState.status === "idle")
      setEnglishState(restoredState(englishFileName || "（上次匯入的資料）", englishData.length));
    if (mathData.length > 0 && mathState.status === "idle")
      setMathState(restoredState(mathFileName || "（上次匯入的資料）", mathData.length));
    if (currentStudents.length > 0 && currentState.status === "idle")
      setCurrentState(restoredState(currentFileName || "（上次匯入的資料）", currentStudents.length));
    if (specialStudents.length > 0 && specialState.status === "idle")
      setSpecialState(restoredState(specialFileName || "（上次匯入的資料）", specialStudents.length));
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
        errorMessage: err instanceof Error ? err.message : "解析失敗",
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
      setCurrentState({ status: "error", errorMessage: err instanceof Error ? err.message : "解析失敗", warnings: [], count: 0 });
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
      setSpecialState({ status: "error", errorMessage: err instanceof Error ? err.message : "解析失敗", warnings: [], count: 0 });
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

  const hasAnyScore = chineseData.length > 0 || englishData.length > 0 || mathData.length > 0;
  const totalMismatches = currentMismatches.length + specialMismatches.length;

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Excel 欄位格式說明</p>
          <p className="text-sm text-blue-700 mt-1">
            每個成績檔案需包含：<strong>姓名、年級、班級、座號、身分證字號、成績</strong>等欄位。
            欄位名稱不需完全一致，系統會自動辨識。資料會自動儲存在本裝置上，重新整理後仍可繼續操作。
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
          匯入各科成績
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FileUploadCard
              title="國文成績"
              description="期中考國文科成績"
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
              title="英文成績"
              description="期中考英文科成績"
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
              title="數學成績"
              description="期中考數學科成績"
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
                國文：{chineseData.length} 筆
              </span>
            )}
            {englishData.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                英文：{englishData.length} 筆
              </span>
            )}
            {mathData.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                數學：{mathData.length} 筆
              </span>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
          匯入輔助名單（選填）
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileUploadCard
            title="在校生名單（當然優先）"
            description="目前正在班上課的學生，篩選後自動加入並標示「優先」"
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
            title="特生名單（排除施測）"
            description="特殊生不參與篩選，依身分證字號比對排除，結果中仍可見"
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
                在校生：{currentStudents.length} 名
              </span>
            )}
            {specialStudents.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                <UserX className="w-3.5 h-3.5" />
                特生排除：{specialStudents.length} 名
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
                名單比對警示：有 {totalMismatches} 位在成績資料中找不到記錄（可能身分證字號有誤）
              </span>
              {mismatchExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {mismatchExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {currentMismatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      在校生名單中，以下 {currentMismatches.length} 位在成績資料中找不到對應記錄：
                    </p>
                    <div className="space-y-1">
                      {currentMismatches.map((m, i) => (
                        <p key={i} className="text-xs text-amber-700 font-mono">
                          • {m.name}（{m.idNumber || "無身分證字號"}）
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {specialMismatches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                      <UserX className="w-3.5 h-3.5" />
                      特生名單中，以下 {specialMismatches.length} 位在成績資料中找不到對應記錄：
                    </p>
                    <div className="space-y-1">
                      {specialMismatches.map((m, i) => (
                        <p key={i} className="text-xs text-amber-700 font-mono">
                          • {m.name}（{m.idNumber || "無身分證字號"}）
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-amber-600 italic">
                  請回頭核查這些學生在 Excel 中的身分證字號是否正確，或確認該學生是否確實有成績記錄。
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
          下一步：設定篩選條件
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
