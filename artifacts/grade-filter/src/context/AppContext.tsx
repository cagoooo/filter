import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { Student, FilterConfig, FilterResult, Subject } from "../types";
import { storageGet, storageSet, storageClear, STORAGE_KEYS } from "../lib/storage";

interface AppContextType {
  chineseData: Student[];
  englishData: Student[];
  mathData: Student[];
  currentStudents: Student[];
  specialStudents: Student[];
  filterConfigs: FilterConfig[];
  filterResults: FilterResult[];

  chineseFileName: string;
  englishFileName: string;
  mathFileName: string;
  currentFileName: string;
  specialFileName: string;

  isLoading: boolean;
  hasRestoredData: boolean;

  setChineseData: (data: Student[]) => void;
  setEnglishData: (data: Student[]) => void;
  setMathData: (data: Student[]) => void;
  setCurrentStudents: (data: Student[]) => void;
  setSpecialStudents: (data: Student[]) => void;
  setFilterConfigs: (configs: FilterConfig[]) => void;

  setChineseFileName: (name: string) => void;
  setEnglishFileName: (name: string) => void;
  setMathFileName: (name: string) => void;
  setCurrentFileName: (name: string) => void;
  setSpecialFileName: (name: string) => void;

  runFilter: (configs?: FilterConfig[]) => void;
  clearResults: () => void;
  clearAll: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [chineseData, setChineseData] = useState<Student[]>([]);
  const [englishData, setEnglishData] = useState<Student[]>([]);
  const [mathData, setMathData] = useState<Student[]>([]);
  const [currentStudents, setCurrentStudents] = useState<Student[]>([]);
  const [specialStudents, setSpecialStudents] = useState<Student[]>([]);
  const [filterConfigs, setFilterConfigs] = useState<FilterConfig[]>([]);
  const [filterResults, setFilterResults] = useState<FilterResult[]>([]);

  const [chineseFileName, setChineseFileName] = useState("");
  const [englishFileName, setEnglishFileName] = useState("");
  const [mathFileName, setMathFileName] = useState("");
  const [currentFileName, setCurrentFileName] = useState("");
  const [specialFileName, setSpecialFileName] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [hasRestoredData, setHasRestoredData] = useState(false);

  const didLoad = useRef(false);

  useEffect(() => {
    async function loadFromStorage() {
      try {
        const [
          chinese, english, math, current, special,
          configs, results,
          chFile, enFile, maFile, cuFile, spFile,
        ] = await Promise.all([
          storageGet<Student[]>(STORAGE_KEYS.CHINESE_DATA),
          storageGet<Student[]>(STORAGE_KEYS.ENGLISH_DATA),
          storageGet<Student[]>(STORAGE_KEYS.MATH_DATA),
          storageGet<Student[]>(STORAGE_KEYS.CURRENT_STUDENTS),
          storageGet<Student[]>(STORAGE_KEYS.SPECIAL_STUDENTS),
          storageGet<FilterConfig[]>(STORAGE_KEYS.FILTER_CONFIGS),
          storageGet<FilterResult[]>(STORAGE_KEYS.FILTER_RESULTS),
          storageGet<string>(STORAGE_KEYS.CHINESE_FILENAME),
          storageGet<string>(STORAGE_KEYS.ENGLISH_FILENAME),
          storageGet<string>(STORAGE_KEYS.MATH_FILENAME),
          storageGet<string>(STORAGE_KEYS.CURRENT_FILENAME),
          storageGet<string>(STORAGE_KEYS.SPECIAL_FILENAME),
        ]);

        let restored = false;
        if (chinese?.length) { setChineseData(chinese); restored = true; }
        if (english?.length) { setEnglishData(english); restored = true; }
        if (math?.length) { setMathData(math); restored = true; }
        if (current?.length) { setCurrentStudents(current); restored = true; }
        if (special?.length) { setSpecialStudents(special); restored = true; }
        if (configs?.length) { setFilterConfigs(configs); restored = true; }
        if (results?.length) { setFilterResults(results); restored = true; }
        if (chFile) setChineseFileName(chFile);
        if (enFile) setEnglishFileName(enFile);
        if (maFile) setMathFileName(maFile);
        if (cuFile) setCurrentFileName(cuFile);
        if (spFile) setSpecialFileName(spFile);

        setHasRestoredData(restored);
      } finally {
        didLoad.current = true;
        setIsLoading(false);
      }
    }
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.CHINESE_DATA, chineseData);
  }, [chineseData]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.ENGLISH_DATA, englishData);
  }, [englishData]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.MATH_DATA, mathData);
  }, [mathData]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.CURRENT_STUDENTS, currentStudents);
  }, [currentStudents]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.SPECIAL_STUDENTS, specialStudents);
  }, [specialStudents]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.FILTER_CONFIGS, filterConfigs);
  }, [filterConfigs]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.FILTER_RESULTS, filterResults);
  }, [filterResults]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.CHINESE_FILENAME, chineseFileName);
  }, [chineseFileName]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.ENGLISH_FILENAME, englishFileName);
  }, [englishFileName]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.MATH_FILENAME, mathFileName);
  }, [mathFileName]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.CURRENT_FILENAME, currentFileName);
  }, [currentFileName]);

  useEffect(() => {
    if (!didLoad.current) return;
    storageSet(STORAGE_KEYS.SPECIAL_FILENAME, specialFileName);
  }, [specialFileName]);

  function getSubjectData(subject: Subject): Student[] {
    if (subject === "chinese") return chineseData;
    if (subject === "english") return englishData;
    return mathData;
  }

  function runFilter(configs?: FilterConfig[]) {
    const activeConfigs = configs ?? filterConfigs;
    const allResults: FilterResult[] = [];
    const resultIdSet = new Set<string>();

    // 統一 ID 正規化：去空白 + 全大寫
    const nid = (s: string) => s.trim().toUpperCase();

    const specialIdSet = new Set(specialStudents.map((s) => nid(s.idNumber)));
    const currentIdSet = new Set(currentStudents.map((s) => nid(s.idNumber)));

    // 建立各科 ID → Student 查表（O(1) 查詢）
    const allDataBySubject: Record<Subject, Student[]> = {
      chinese: chineseData,
      english: englishData,
      math: mathData,
    };
    const idMaps: Record<Subject, Map<string, Student>> = {
      chinese: new Map(),
      english: new Map(),
      math: new Map(),
    };
    for (const subj of ["chinese", "english", "math"] as Subject[]) {
      for (const s of allDataBySubject[subj]) {
        const key = nid(s.idNumber);
        if (key) idMaps[subj].set(key, s);
      }
    }

    // 從各科成績資料中查詢完整學生資訊 + 所有分數
    const findScoreStudent = (idNumber: string): Student | undefined => {
      const key = nid(idNumber);
      for (const subj of ["chinese", "english", "math"] as Subject[]) {
        const found = idMaps[subj].get(key);
        if (found) return found;
      }
      return undefined;
    };

    const enrichScores = (idNumber: string): Partial<Record<Subject, number>> => {
      const key = nid(idNumber);
      const scores: Partial<Record<Subject, number>> = {};
      for (const subj of ["chinese", "english", "math"] as Subject[]) {
        const match = idMaps[subj].get(key);
        if (match && match[subj] !== undefined) {
          scores[subj] = match[subj] as number;
        }
      }
      return scores;
    };

    const addResult = (s: Student, status: "priority" | "normal" | "excluded", subject: Subject, score: number, rowId: string) => {
      if (resultIdSet.has(rowId)) return;
      resultIdSet.add(rowId);
      // 優先使用成績資料的學生基本資訊（姓名/班級/座號較完整）
      const scoreStudent = findScoreStudent(s.idNumber);
      const base = scoreStudent ?? s;
      allResults.push({
        ...base,
        ...enrichScores(s.idNumber),
        id: rowId,
        status,
        filterSubject: subject,
        filterScore: score,
      });
    };

    for (const config of activeConfigs) {
      const data = getSubjectData(config.subject);
      const gradeData = data.filter((s) => s.grade === config.grade);
      const nonSpecial = gradeData.filter((s) => !specialIdSet.has(nid(s.idNumber)));

      const isBottom = config.direction === "bottom";
      const sorted = [...nonSpecial].sort((a, b) => {
        const scoreA = a[config.subject] ?? 0;
        const scoreB = b[config.subject] ?? 0;
        return isBottom ? scoreA - scoreB : scoreB - scoreA;
      });

      let cutCount: number;
      if (config.mode === "percent") {
        cutCount = Math.ceil((config.value / 100) * sorted.length);
      } else {
        cutCount = Math.min(config.value, sorted.length);
      }

      const selected = sorted.slice(0, cutCount);
      const selectedIdSet = new Set(selected.map((s) => nid(s.idNumber)));

      // 1. 篩選入圍者（若同時在優先名單 → 標優先）
      for (const s of selected) {
        const score = s[config.subject] ?? 0;
        const isPriority = currentIdSet.has(nid(s.idNumber));
        const rowId = `${nid(s.idNumber)}-${config.subject}`;
        addResult(s, isPriority ? "priority" : "normal", config.subject, score, rowId);
      }

      // 2. 優先學生（不在篩選內但在優先名單 → 額外加入）
      const extraPriority = currentStudents.filter(
        (s) =>
          s.grade === config.grade &&
          !specialIdSet.has(nid(s.idNumber)) &&
          !selectedIdSet.has(nid(s.idNumber))
      );
      for (const s of extraPriority) {
        const scoreMatch = idMaps[config.subject]?.get(nid(s.idNumber));
        const score = scoreMatch?.[config.subject] ?? 0;
        const rowId = `${nid(s.idNumber)}-${config.subject}`;
        addResult(s, "priority", config.subject, score as number, rowId);
      }

      // 3. 特生（已排除但仍顯示）
      const specialInConfig = specialStudents.filter((s) => s.grade === config.grade);
      for (const s of specialInConfig) {
        const scoreMatch = idMaps[config.subject]?.get(nid(s.idNumber));
        const score = scoreMatch?.[config.subject] ?? 0;
        const rowId = `excluded-${nid(s.idNumber)}-${config.subject}`;
        addResult(s, "excluded", config.subject, score as number, rowId);
      }
    }

    setFilterResults(allResults);
  }

  function clearResults() {
    setFilterResults([]);
  }

  async function clearAll() {
    await storageClear();
    setChineseData([]);
    setEnglishData([]);
    setMathData([]);
    setCurrentStudents([]);
    setSpecialStudents([]);
    setFilterConfigs([]);
    setFilterResults([]);
    setChineseFileName("");
    setEnglishFileName("");
    setMathFileName("");
    setCurrentFileName("");
    setSpecialFileName("");
    setHasRestoredData(false);
  }

  return (
    <AppContext.Provider
      value={{
        chineseData, englishData, mathData,
        currentStudents, specialStudents,
        filterConfigs, filterResults,
        chineseFileName, englishFileName, mathFileName,
        currentFileName, specialFileName,
        isLoading, hasRestoredData,
        setChineseData, setEnglishData, setMathData,
        setCurrentStudents, setSpecialStudents, setFilterConfigs,
        setChineseFileName, setEnglishFileName, setMathFileName,
        setCurrentFileName, setSpecialFileName,
        runFilter, clearResults, clearAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
