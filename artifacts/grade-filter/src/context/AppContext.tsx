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
import { Student, FilterConfig, FilterResult } from "../types";
import { storageGet, storageSet, storageClear, STORAGE_KEYS } from "../lib/storage";
import { runFilterPure } from "../lib/filter";

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

  // ── 篩選引擎（純函式於 lib/filter.ts，此處僅負責接入 React state）──
  const runFilter = useCallback(
    (configs?: FilterConfig[]) => {
      const activeConfigs = configs ?? filterConfigs;
      const results = runFilterPure({
        chineseData,
        englishData,
        mathData,
        currentStudents,
        specialStudents,
        configs: activeConfigs,
      });
      setFilterResults(results);
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
