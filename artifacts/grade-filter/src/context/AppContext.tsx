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
  runFilter: (configs?: FilterConfig[]) => void;
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

  function runFilter(configs?: FilterConfig[]) {
    const activeConfigs = configs ?? filterConfigs;
    const allResults: FilterResult[] = [];
    const specialIdSet = new Set(specialStudents.map((id) => id.trim()));
    const currentIdSet = new Set(currentStudents.map((s) => s.idNumber.trim()));

    const allDataBySubject: Record<Subject, Student[]> = {
      chinese: chineseData,
      english: englishData,
      math: mathData,
    };

    for (const config of activeConfigs) {
      const data = getSubjectData(config.subject);
      const gradeData = data.filter((s) => s.grade === config.grade);

      const specialInGrade = gradeData.filter((s) =>
        specialIdSet.has(s.idNumber.trim())
      );
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

      const enrichScores = (s: Student): Partial<Record<Subject, number>> => {
        const scores: Partial<Record<Subject, number>> = {};
        for (const subj of ["chinese", "english", "math"] as Subject[]) {
          const subjectData = allDataBySubject[subj];
          const match = subjectData.find(
            (d) => d.idNumber.trim() === s.idNumber.trim()
          );
          if (match && match[subj] !== undefined) {
            scores[subj] = match[subj] as number;
          }
        }
        return scores;
      };

      for (const s of selected) {
        const score = s[config.subject] ?? 0;
        const isPriority = currentIdSet.has(s.idNumber.trim());
        const rowId = `${s.idNumber.trim()}-${config.subject}`;
        if (!allResults.find((r) => r.id === rowId)) {
          allResults.push({
            ...s,
            ...enrichScores(s),
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
            ...s,
            ...enrichScores(s),
            id: rowId,
            status: "priority",
            filterSubject: config.subject,
            filterScore: score,
          });
        }
      }

      for (const s of specialInGrade) {
        const score = s[config.subject] ?? 0;
        const rowId = `excluded-${s.idNumber.trim()}-${config.subject}`;
        if (!allResults.find((r) => r.id === rowId)) {
          allResults.push({
            ...s,
            ...enrichScores(s),
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
