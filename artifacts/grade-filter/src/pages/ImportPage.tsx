import { useState } from "react";
import { useAppContext } from "../context/AppContext";
import { parseScoreFile, parseListFile } from "../lib/excel";
import FileUploadCard from "../components/FileUploadCard";
import { Subject } from "../types";
import { Info, ArrowRight, Users, UserX } from "lucide-react";

type UploadStatus = "idle" | "loading" | "success" | "error";

interface FileState {
  status: UploadStatus;
  fileName?: string;
  errorMessage?: string;
  warnings: string[];
  count: number;
}

const defaultFileState: FileState = {
  status: "idle",
  warnings: [],
  count: 0,
};

export default function ImportPage({ onNext }: { onNext: () => void }) {
  const {
    setChineseData,
    setEnglishData,
    setMathData,
    setCurrentStudents,
    setSpecialStudents,
    chineseData,
    englishData,
    mathData,
    currentStudents,
    specialStudents,
  } = useAppContext();

  const [chineseState, setChineseState] = useState<FileState>(defaultFileState);
  const [englishState, setEnglishState] = useState<FileState>(defaultFileState);
  const [mathState, setMathState] = useState<FileState>(defaultFileState);
  const [currentState, setCurrentState] = useState<FileState>(defaultFileState);
  const [specialState, setSpecialState] = useState<FileState>(defaultFileState);

  const handleScoreUpload = async (
    file: File,
    subject: Subject,
    setState: (s: FileState) => void,
    setData: (d: ReturnType<typeof useAppContext>["chineseData"]) => void
  ) => {
    setState({ status: "loading", warnings: [], count: 0 });
    try {
      const result = await parseScoreFile(file, subject);
      setData(result.students);
      setState({
        status: "success",
        fileName: file.name,
        warnings: result.warnings,
        count: result.students.length,
      });
    } catch (err: unknown) {
      setState({
        status: "error",
        errorMessage: err instanceof Error ? err.message : "解析失敗",
        warnings: [],
        count: 0,
      });
    }
  };

  const handleListUpload = async (
    file: File,
    setState: (s: FileState) => void,
    setData: (ids: string[]) => void,
    isCurrentList: boolean
  ) => {
    setState({ status: "loading", warnings: [], count: 0 });
    try {
      const result = await parseListFile(file);
      if (isCurrentList) {
        setCurrentStudents(result.students);
        setData([]);
      } else {
        setData(result.students.map((s) => s.idNumber));
      }
      setState({
        status: "success",
        fileName: file.name,
        warnings: result.warnings,
        count: result.students.length,
      });
    } catch (err: unknown) {
      setState({
        status: "error",
        errorMessage: err instanceof Error ? err.message : "解析失敗",
        warnings: [],
        count: 0,
      });
    }
  };

  const hasAnyScore =
    chineseData.length > 0 ||
    englishData.length > 0 ||
    mathData.length > 0;

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Excel 欄位格式說明</p>
          <p className="text-sm text-blue-700 mt-1">
            每個成績檔案需包含：<strong>姓名、年級、班級、座號、身分證字號、成績</strong>（對應科目）等欄位。
            名單檔案需包含：<strong>姓名、年級、班級、座號、身分證字號</strong>等欄位。
            欄位名稱不需完全一致，系統會自動辨識。
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
          匯入各科成績
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FileUploadCard
            title="國文成績"
            description="期中考國文科成績"
            onFileSelect={(file) =>
              handleScoreUpload(file, "chinese", setChineseState, setChineseData)
            }
            status={chineseState.status}
            fileName={chineseState.fileName}
            errorMessage={chineseState.errorMessage}
            warnings={chineseState.warnings}
            onClear={() => {
              setChineseData([]);
              setChineseState(defaultFileState);
            }}
          />
          <FileUploadCard
            title="英文成績"
            description="期中考英文科成績"
            onFileSelect={(file) =>
              handleScoreUpload(file, "english", setEnglishState, setEnglishData)
            }
            status={englishState.status}
            fileName={englishState.fileName}
            errorMessage={englishState.errorMessage}
            warnings={englishState.warnings}
            onClear={() => {
              setEnglishData([]);
              setEnglishState(defaultFileState);
            }}
          />
          <FileUploadCard
            title="數學成績"
            description="期中考數學科成績"
            onFileSelect={(file) =>
              handleScoreUpload(file, "math", setMathState, setMathData)
            }
            status={mathState.status}
            fileName={mathState.fileName}
            errorMessage={mathState.errorMessage}
            warnings={mathState.warnings}
            onClear={() => {
              setMathData([]);
              setMathState(defaultFileState);
            }}
          />
        </div>

        {(chineseData.length > 0 ||
          englishData.length > 0 ||
          mathData.length > 0) && (
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
            onFileSelect={(file) =>
              handleListUpload(
                file,
                setCurrentState,
                () => {},
                true
              )
            }
            status={currentState.status}
            fileName={currentState.fileName}
            errorMessage={currentState.errorMessage}
            warnings={currentState.warnings}
            onClear={() => {
              setCurrentStudents([]);
              setCurrentState(defaultFileState);
            }}
          />
          <FileUploadCard
            title="特生名單（排除施測）"
            description="特殊生不參與篩選，依身分證字號比對排除"
            onFileSelect={(file) =>
              handleListUpload(
                file,
                setSpecialState,
                (ids) => setSpecialStudents(ids as string[]),
                false
              )
            }
            status={specialState.status}
            fileName={specialState.fileName}
            errorMessage={specialState.errorMessage}
            warnings={specialState.warnings}
            onClear={() => {
              setSpecialStudents([]);
              setSpecialState(defaultFileState);
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
