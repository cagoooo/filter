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
    const specialIdSet = new Set(specialStudents.map((s) => s.idNumber.trim()));
    const currentIdSet = new Set(currentStudents.map((s) => s.idNumber.trim()));

    const allDataBySubject: Record<Subject, Student[]> = {
      chinese: chineseData,
      english: englishData,
      math: mathData,
    };

    const enrichScores = (s: Student): Partial<Record<Subject, number>> => {
      const scores: Partial<Record<Subject, number>> = {};
      for (const subj of ["chinese", "english", "math"] as Subject[]) {
        const subjectData = allDataBySubject[subj];
        const match = subjectData.find((d) => d.idNumber.trim() === s.idNumber.trim());
        if (match && match[subj] !== undefined) {
          scores[subj] = match[subj] as number;
        }
      }
      return scores;
    };

    for (const config of activeConfigs) {
      const data = getSubjectData(config.subject);
      const gradeData = data.filter((s) => s.grade === config.grade);
      const nonSpecial = gradeData.filter((s) => !specialIdSet.has(s.idNumber.trim()));

      const sorted = [...nonSpecial].sort((a, b) => {
        const scoreA = a[config.subject] ?? 0;
        const scoreB = b[config.subject] ?? 0;
        return scoreB - scoreA;
      });

      let cutCount: number;
      if (config.mode === "percent") {
        cutCount = Math.ceil((config.value / 100) * sorted.length);
      } else {
        cutCount = Math.min(config.value, sorted.length);
      }

      const selected = sorted.slice(0, cutCount);
      const selectedIdSet = new Set(selected.map((s) => s.idNumber.trim()));

      const priorityStudents = currentStudents.filter(
        (s) =>
          s.grade === config.grade &&
          !specialIdSet.has(s.idNumber.trim()) &&
          !selectedIdSet.has(s.idNumber.trim())
      );

      for (const s of selected) {
        const score = s[config.subject] ?? 0;
        const isPriority = currentIdSet.has(s.idNumber.trim());
        const rowId = `${s.idNumber.trim()}-${config.subject}`;
        if (!allResults.find((r) => r.id === rowId)) {
          allResults.push({
            ...s, ...enrichScores(s),
            id: rowId,
            status: isPriority ? "priority" : "normal",
            filterSubject: config.subject,
            filterScore: score,
          });
        }
      }

      for (const s of priorityStudents) {
        const score = s[config.subject] ?? 0;
        const rowId = `${s.idNumber.trim()}-${config.subject}`;
        if (!allResults.find((r) => r.id === rowId)) {
          allResults.push({
            ...s, ...enrichScores(s),
            id: rowId,
            status: "priority",
            filterSubject: config.subject,
            filterScore: score,
          });
        }
      }

      const specialInConfig = specialStudents.filter((s) => s.grade === config.grade);
      for (const s of specialInConfig) {
        const score = s[config.subject] ?? 0;
        const rowId = `excluded-${s.idNumber.trim()}-${config.subject}`;
        if (!allResults.find((r) => r.id === rowId)) {
          allResults.push({
            ...s, ...enrichScores(s),
            id: rowId,
            status: "excluded",
            filterSubject: config.subject,
            filterScore: score,
          });
        }
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
