import { createContext, useContext, useState, ReactNode } from "react";
import { Student, FilterConfig, FilterResult, Subject } from "../types";

interface AppContextType {
  chineseData: Student[];
  englishData: Student[];
  mathData: Student[];
  currentStudents: Student[];
  specialStudents: string[];
  filterConfigs: FilterConfig[];
  filterResults: FilterResult[];

  setChineseData: (data: Student[]) => void;
  setEnglishData: (data: Student[]) => void;
  setMathData: (data: Student[]) => void;
  setCurrentStudents: (data: Student[]) => void;
  setSpecialStudents: (ids: string[]) => void;
  setFilterConfigs: (configs: FilterConfig[]) => void;
  runFilter: () => void;
  clearResults: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [chineseData, setChineseData] = useState<Student[]>([]);
  const [englishData, setEnglishData] = useState<Student[]>([]);
  const [mathData, setMathData] = useState<Student[]>([]);
  const [currentStudents, setCurrentStudents] = useState<Student[]>([]);
  const [specialStudents, setSpecialStudents] = useState<string[]>([]);
  const [filterConfigs, setFilterConfigs] = useState<FilterConfig[]>([]);
  const [filterResults, setFilterResults] = useState<FilterResult[]>([]);

  function getSubjectData(subject: Subject): Student[] {
    if (subject === "chinese") return chineseData;
    if (subject === "english") return englishData;
    return mathData;
  }

  function runFilter() {
    const allResults: FilterResult[] = [];
    const specialIdSet = new Set(specialStudents.map((id) => id.trim()));
    const currentIdSet = new Set(currentStudents.map((s) => s.idNumber.trim()));

    for (const config of filterConfigs) {
      const data = getSubjectData(config.subject);
      const gradeData = data.filter((s) => s.grade === config.grade);

      const nonSpecial = gradeData.filter(
        (s) => !specialIdSet.has(s.idNumber.trim())
      );

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
        if (!allResults.find((r) => r.id === `${s.id}-${config.subject}`)) {
          allResults.push({
            ...s,
            id: `${s.id}-${config.subject}`,
            status: isPriority ? "priority" : "normal",
            filterSubject: config.subject,
            filterScore: score,
          });
        }
      }

      for (const s of priorityStudents) {
        const score = s[config.subject] ?? 0;
        if (!allResults.find((r) => r.id === `${s.id}-${config.subject}`)) {
          allResults.push({
            ...s,
            id: `${s.id}-${config.subject}`,
            status: "priority",
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

  return (
    <AppContext.Provider
      value={{
        chineseData,
        englishData,
        mathData,
        currentStudents,
        specialStudents,
        filterConfigs,
        filterResults,
        setChineseData,
        setEnglishData,
        setMathData,
        setCurrentStudents,
        setSpecialStudents,
        setFilterConfigs,
        runFilter,
        clearResults,
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
