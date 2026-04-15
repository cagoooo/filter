/**
 * P3.3 測試準備：將篩選引擎抽成純函式
 *
 * 原本 runFilter 以閉包存於 AppContext 內，難以單元測試。抽成純函式後：
 * - AppContext 仍可透過 useCallback 包裝呼叫
 * - Vitest 可直接以陣列餵入測資，無需啟動 React / Provider
 *
 * 行為與原先完全一致：
 * 1. 身分證統一以 `trim().toUpperCase()` 比對（大小寫不敏感）
 * 2. 特殊生先以 "excluded" 補進結果末段
 * 3. 優先名單中若未進入切分窗口，仍以 "priority" 狀態補入
 * 4. 同一人在多 config 中可重複出現（rowId 以 `<id>-<subject>` 識別）
 */
import { Student, FilterConfig, FilterResult, Subject } from "../types";

export interface RunFilterParams {
  chineseData: Student[];
  englishData: Student[];
  mathData: Student[];
  currentStudents: Student[];
  specialStudents: Student[];
  configs: FilterConfig[];
}

const nid = (s: string) => s.trim().toUpperCase();

export function runFilterPure(params: RunFilterParams): FilterResult[] {
  const {
    chineseData,
    englishData,
    mathData,
    currentStudents,
    specialStudents,
    configs,
  } = params;

  const allResults: FilterResult[] = [];
  const resultIdSet = new Set<string>();

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

  for (const config of configs) {
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

  return allResults;
}
