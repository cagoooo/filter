/**
 * P2.7：Context 拆分
 *
 * 原本所有狀態集中於單一 AppContext，任何 setState 都會觸發全部訂閱者重渲染。
 * 現在拆成三個聚焦的 Context：
 *
 * - DataContext    ：原始成績／名單資料 + 檔名
 * - FilterContext  ：篩選條件、結果、執行引擎
 * - UIContext      ：載入狀態、是否還原資料、全域清空動作
 *
 * 內部仍由單一 `AppProvider` 管理 state 與 IndexedDB hydration，再透過三個
 * Provider 包裝子樹，讓消費者只訂閱自己需要的切片。
 *
 * 為了向後相容，保留 `useAppContext()` 作為 barrel hook，合併三個切片。
 * 未來可視需求再逐步遷移到 `useDataContext` / `useFilterContext` /
 * `useUIContext`，避免一次性大改所有頁面。
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { Student, FilterConfig, FilterResult, Subject } from "../types";
import { storageGet, storageSet, storageClear, STORAGE_KEYS } from "../lib/storage";

// ───────────────────── 切片型別 ─────────────────────

export interface DataContextValue {
  chineseData: Student[];
  englishData: Student[];
  mathData: Student[];
  currentStudents: Student[];
  specialStudents: Student[];

  chineseFileName: string;
  englishFileName: string;
  mathFileName: string;
  currentFileName: string;
  specialFileName: string;

  setChineseData: (data: Student[]) => void;
  setEnglishData: (data: Student[]) => void;
  setMathData: (data: Student[]) => void;
  setCurrentStudents: (data: Student[]) => void;
  setSpecialStudents: (data: Student[]) => void;

  setChineseFileName: (name: string) => void;
  setEnglishFileName: (name: string) => void;
  setMathFileName: (name: string) => void;
  setCurrentFileName: (name: string) => void;
  setSpecialFileName: (name: string) => void;
}

export interface FilterContextValue {
  filterConfigs: FilterConfig[];
  filterResults: FilterResult[];
  setFilterConfigs: (configs: FilterConfig[]) => void;
  runFilter: (configs?: FilterConfig[]) => void;
  clearResults: () => void;
}

export interface UIContextValue {
  isLoading: boolean;
  hasRestoredData: boolean;
  clearAll: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);
const FilterContext = createContext<FilterContextValue | null>(null);
const UIContext = createContext<UIContextValue | null>(null);

// ───────────────────── 合併 Provider ─────────────────────

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

  // ── hydration：從 IndexedDB 還原 ──
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

  // ── 持久化 effects（維持原邏輯，拆分後跨多個 Provider 不影響）──
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.CHINESE_DATA, chineseData); }, [chineseData]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.ENGLISH_DATA, englishData); }, [englishData]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.MATH_DATA, mathData); }, [mathData]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.CURRENT_STUDENTS, currentStudents); }, [currentStudents]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.SPECIAL_STUDENTS, specialStudents); }, [specialStudents]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.FILTER_CONFIGS, filterConfigs); }, [filterConfigs]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.FILTER_RESULTS, filterResults); }, [filterResults]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.CHINESE_FILENAME, chineseFileName); }, [chineseFileName]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.ENGLISH_FILENAME, englishFileName); }, [englishFileName]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.MATH_FILENAME, mathFileName); }, [mathFileName]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.CURRENT_FILENAME, currentFileName); }, [currentFileName]);
  useEffect(() => { if (didLoad.current) storageSet(STORAGE_KEYS.SPECIAL_FILENAME, specialFileName); }, [specialFileName]);

  // ── 篩選引擎 ──
  const runFilter = useCallback(
    (configs?: FilterConfig[]) => {
      const activeConfigs = configs ?? filterConfigs;
      const allResults: FilterResult[] = [];
      const resultIdSet = new Set<string>();

      const nid = (s: string) => s.trim().toUpperCase();

      const specialIdSet = new Set(specialStudents.map((s) => nid(s.idNumber)));
      const currentIdSet = new Set(currentStudents.map((s) => nid(s.idNumber)));

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

      const addResult = (
        s: Student,
        status: "priority" | "normal" | "excluded",
        subject: Subject,
        score: number,
        rowId: string,
      ) => {
        if (resultIdSet.has(rowId)) return;
        resultIdSet.add(rowId);
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

      const getSubjectData = (subject: Subject) =>
        subject === "chinese" ? chineseData : subject === "english" ? englishData : mathData;

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

        for (const s of selected) {
          const score = s[config.subject] ?? 0;
          const isPriority = currentIdSet.has(nid(s.idNumber));
          const rowId = `${nid(s.idNumber)}-${config.subject}`;
          addResult(s, isPriority ? "priority" : "normal", config.subject, score, rowId);
        }

        const extraPriority = currentStudents.filter(
          (s) =>
            s.grade === config.grade &&
            !specialIdSet.has(nid(s.idNumber)) &&
            !selectedIdSet.has(nid(s.idNumber)),
        );
        for (const s of extraPriority) {
          const scoreMatch = idMaps[config.subject]?.get(nid(s.idNumber));
          const score = scoreMatch?.[config.subject] ?? 0;
          const rowId = `${nid(s.idNumber)}-${config.subject}`;
          addResult(s, "priority", config.subject, score as number, rowId);
        }

        const specialInConfig = specialStudents.filter((s) => s.grade === config.grade);
        for (const s of specialInConfig) {
          const scoreMatch = idMaps[config.subject]?.get(nid(s.idNumber));
          const score = scoreMatch?.[config.subject] ?? 0;
          const rowId = `excluded-${nid(s.idNumber)}-${config.subject}`;
          addResult(s, "excluded", config.subject, score as number, rowId);
        }
      }

      setFilterResults(allResults);
    },
    [chineseData, englishData, mathData, currentStudents, specialStudents, filterConfigs],
  );

  const clearResults = useCallback(() => setFilterResults([]), []);

  const clearAll = useCallback(async () => {
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
  }, []);

  // ── Slice 物件（useMemo 穩定身分，避免不必要重渲染）──
  const dataValue = useMemo<DataContextValue>(
    () => ({
      chineseData, englishData, mathData, currentStudents, specialStudents,
      chineseFileName, englishFileName, mathFileName, currentFileName, specialFileName,
      setChineseData, setEnglishData, setMathData, setCurrentStudents, setSpecialStudents,
      setChineseFileName, setEnglishFileName, setMathFileName, setCurrentFileName, setSpecialFileName,
    }),
    [
      chineseData, englishData, mathData, currentStudents, specialStudents,
      chineseFileName, englishFileName, mathFileName, currentFileName, specialFileName,
    ],
  );

  const filterValue = useMemo<FilterContextValue>(
    () => ({ filterConfigs, filterResults, setFilterConfigs, runFilter, clearResults }),
    [filterConfigs, filterResults, runFilter, clearResults],
  );

  const uiValue = useMemo<UIContextValue>(
    () => ({ isLoading, hasRestoredData, clearAll }),
    [isLoading, hasRestoredData, clearAll],
  );

  return (
    <DataContext.Provider value={dataValue}>
      <FilterContext.Provider value={filterValue}>
        <UIContext.Provider value={uiValue}>
          {children}
        </UIContext.Provider>
      </FilterContext.Provider>
    </DataContext.Provider>
  );
}

// ───────────────────── 切片 Hooks ─────────────────────

export function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDataContext must be used within AppProvider");
  return ctx;
}

export function useFilterContext(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilterContext must be used within AppProvider");
  return ctx;
}

export function useUIContext(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUIContext must be used within AppProvider");
  return ctx;
}

// ───────────────────── 向後相容 Barrel ─────────────────────

export type AppContextType = DataContextValue & FilterContextValue & UIContextValue;

/**
 * @deprecated 請改用 `useDataContext` / `useFilterContext` / `useUIContext`
 * 以取得更細粒度的訂閱，避免不必要的重渲染。保留此 hook 以相容既有呼叫。
 */
export function useAppContext(): AppContextType {
  return { ...useDataContext(), ...useFilterContext(), ...useUIContext() };
}
