import * as XLSX from "xlsx";
import { Student, Subject } from "../types";

function generateId(name: string, idNumber: string, index: number): string {
  return `${name}-${idNumber}-${index}`;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s/g, "").replace(/[_\-]/g, "");
}

function findColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => normalizeHeader(h) === candidate || h.includes(candidate)
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * 同 findColumn，但額外回傳置信度：
 * - 精準匹配（正規化後相等） → 0.95
 * - 子字串匹配 → 0.80
 * - 未找到 → 0
 */
function findColumnWithConfidence(
  headers: string[],
  candidates: string[]
): { idx: number; confidence: number } {
  for (const candidate of candidates) {
    const exactIdx = headers.findIndex((h) => normalizeHeader(h) === candidate);
    if (exactIdx !== -1) return { idx: exactIdx, confidence: 0.95 };
  }
  for (const candidate of candidates) {
    const partialIdx = headers.findIndex((h) => h.includes(candidate));
    if (partialIdx !== -1) return { idx: partialIdx, confidence: 0.8 };
  }
  return { idx: -1, confidence: 0 };
}

const TAIWAN_ID_RE = /^[A-Za-z][12]\d{8}$/;
const CLASS_CODE_RE = /^[1-6]\d{2}$/;

function isTaiwanId(val: string): boolean {
  return TAIWAN_ID_RE.test(val.trim());
}

function isClassCode(val: string): boolean {
  return CLASS_CODE_RE.test(val.trim());
}

function isScore(val: string): boolean {
  const n = parseFloat(val);
  return !isNaN(n) && n >= 0 && n <= 150;
}

// 常見的「非數字成績」表示（缺考、補考、請假、轉學等）
const ABSENT_MARKERS = new Set([
  "缺", "缺考", "補", "補考", "請假", "轉學", "未考", "未到",
  "—", "-", "–", "——", "──", "N/A", "NA", "null", "NULL", "無",
  "?", "？", "X", "x", "／", "/",
]);

/**
 * 安全解析成績：
 * - 空值 / 非數字標記（缺考、補考、—）→ undefined
 * - 超出合理範圍（< 0 或 > 150）→ undefined
 * - 正常數字 → number
 */
export function parseScore(raw: unknown): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const str = String(raw).trim();
  if (!str) return undefined;
  if (ABSENT_MARKERS.has(str)) return undefined;
  const num = parseFloat(str);
  if (isNaN(num)) return undefined;
  if (num < 0 || num > 150) return undefined;
  return num;
}

function isSmallInt(val: string): boolean {
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= 1 && n <= 60 && String(n) === val.trim();
}

function isChineseName(val: string): boolean {
  return /^[\u4e00-\u9fff]{2,5}$/.test(val.trim());
}

function isGradeOnly(val: string): boolean {
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= 1 && n <= 6 && String(n) === val.trim();
}

export function parseGradeFromClassCode(val: string): { grade: number; className: string } {
  const trimmed = val.trim();
  if (CLASS_CODE_RE.test(trimmed)) {
    return { grade: parseInt(trimmed[0], 10), className: trimmed };
  }
  const n = parseInt(trimmed, 10);
  if (!isNaN(n) && n >= 1 && n <= 6) return { grade: n, className: trimmed };
  return { grade: 0, className: trimmed };
}

function pickSheetForSubject(workbook: XLSX.WorkBook, subject: Subject): XLSX.WorkSheet {
  const subjectKeywords: Record<Subject, string[]> = {
    chinese: ["國文", "中文", "chinese", "國語", "語文", "國"],
    english: ["英文", "english", "英語", "英"],
    math: ["數學", "math", "數學", "數"],
  };
  const keywords = subjectKeywords[subject];
  const matchedName = workbook.SheetNames.find((name) =>
    keywords.some((k) => name.toLowerCase().includes(k.toLowerCase()))
  );
  return workbook.Sheets[matchedName ?? workbook.SheetNames[0]];
}

function findMainTableWidth(dataRows: string[][]): number {
  const numCols = Math.max(...dataRows.map((r) => r.length));
  const sample = dataRows.slice(0, Math.min(20, dataRows.length));
  let mainWidth = numCols;
  let gapStart = -1;
  for (let c = 0; c < numCols; c++) {
    const vals = sample.map((r) => String(r[c] ?? "").trim());
    const emptyRate = vals.filter((v) => !v).length / (vals.length || 1);
    if (emptyRate > 0.6) {
      if (gapStart === -1) gapStart = c;
    } else {
      if (gapStart !== -1 && c - gapStart >= 2) {
        mainWidth = gapStart;
        break;
      }
      gapStart = -1;
    }
  }
  return mainWidth;
}

interface ColRates {
  id: number; classCode: number; grade: number;
  name: number; score: number; seat: number;
}

function detectByContent(dataRows: string[][]): {
  idxName: number; idxGrade: number; idxClass: number;
  idxSeat: number; idxId: number; idxScore: number; gradeFromClass: boolean;
  confidence: ConfidenceMap;
} {
  const numCols = findMainTableWidth(dataRows);
  const sample = dataRows.slice(0, Math.min(20, dataRows.length));
  const rates: ColRates[] = [];
  for (let c = 0; c < numCols; c++) {
    const vals = sample.map((r) => String(r[c] ?? "").trim()).filter(Boolean);
    const total = vals.length || 1;
    rates[c] = {
      id: vals.filter(isTaiwanId).length / total,
      classCode: vals.filter(isClassCode).length / total,
      grade: vals.filter(isGradeOnly).length / total,
      name: vals.filter(isChineseName).length / total,
      score: vals.filter(isScore).length / total,
      seat: vals.filter(isSmallInt).length / total,
    };
  }
  const best = (key: keyof ColRates, exclude: number[] = [], thr = 0.3): { idx: number; rate: number } => {
    let b = -1; let bv = thr;
    for (let c = 0; c < numCols; c++) {
      if (exclude.includes(c)) continue;
      if (rates[c][key] > bv) { bv = rates[c][key]; b = c; }
    }
    return { idx: b, rate: b === -1 ? 0 : rates[b][key] };
  };
  const rId = best("id");
  const rClassCode = best("classCode", rId.idx !== -1 ? [rId.idx] : []);
  const rName = best("name", [rId.idx, rClassCode.idx].filter((x) => x !== -1));
  const exc = [rId.idx, rClassCode.idx, rName.idx].filter((x) => x !== -1);
  const rScore = best("score", exc);
  const rSeat = best("seat", [...exc, rScore.idx].filter((x) => x !== -1));
  const rGradeOnly = best("grade", [...exc, rScore.idx, rSeat.idx].filter((x) => x !== -1));
  let idxGrade = -1; let gradeFromClass = false; let gradeConf = 0;
  if (rGradeOnly.idx !== -1) { idxGrade = rGradeOnly.idx; gradeConf = rGradeOnly.rate; }
  else if (rClassCode.idx !== -1) { idxGrade = rClassCode.idx; gradeFromClass = true; gradeConf = rClassCode.rate; }
  const confidence: ConfidenceMap = {
    idIdx: rId.rate,
    classIdx: rClassCode.rate,
    nameIdx: rName.rate,
    scoreIdx: rScore.rate,
    seatIdx: rSeat.rate,
    gradeIdx: gradeConf,
  };
  return {
    idxName: rName.idx, idxGrade, idxClass: rClassCode.idx,
    idxSeat: rSeat.idx, idxId: rId.idx, idxScore: rScore.idx,
    gradeFromClass, confidence,
  };
}

function detectIdByContent(dataRows: string[][], startRow: number, exclude: number[]): number {
  const sample = dataRows.slice(startRow, startRow + 20);
  const numCols = Math.max(...sample.map((r) => r.length));
  let best = -1; let bv = 0.3;
  for (let c = 0; c < numCols; c++) {
    if (exclude.includes(c)) continue;
    const vals = sample.map((r) => String(r[c] ?? "").trim()).filter(Boolean);
    const rate = vals.filter(isTaiwanId).length / (vals.length || 1);
    if (rate > bv) { bv = rate; best = c; }
  }
  return best;
}

function classColIsClassCode(dataRows: string[][], startRow: number, idxClass: number): boolean {
  const vals = dataRows.slice(startRow, startRow + 10)
    .map((r) => String(r[idxClass] ?? "").trim()).filter(Boolean);
  return vals.length > 0 && vals.filter(isClassCode).length / vals.length >= 0.5;
}

function firstRowLooksLikeHeaders(row: string[]): boolean {
  const keywords = [
    "姓名", "名", "name", "年級", "grade", "班", "class",
    "座號", "seat", "身分", "身份", "證", "id",
    "國文", "英文", "數學", "成績", "分數", "chinese", "english", "math", "score",
  ];
  const leading = row.slice(0, Math.min(6, row.length)).map((c) => String(c).trim());
  const dataCount = leading.filter(
    (c) => isClassCode(c) || isTaiwanId(c) || (isScore(c) && parseFloat(c) > 6)
  ).length;
  if (dataCount >= 2) return false;
  const cells = leading.map((c) => c.toLowerCase());
  return cells.filter((c) => keywords.some((k) => c.includes(k))).length >= 2;
}

export type ConfidenceField = "nameIdx" | "gradeIdx" | "classIdx" | "seatIdx" | "idIdx" | "scoreIdx";
export type ConfidenceMap = Partial<Record<ConfidenceField, number>>;

export interface ColumnMapping {
  nameIdx: number;
  gradeIdx: number;
  classIdx: number;
  seatIdx: number;
  idIdx: number;
  scoreIdx: number;
  gradeFromClass: boolean;
  dataStartRow: number;
  colLabels: string[];
  /**
   * 偵測置信度（0.0–1.0）。header 精準匹配 ≈ 0.95，含關鍵字 ≈ 0.80，
   * 內容匹配直接使用樣本中命中率（例：0.67 表示 67% 樣本符合該欄位特徵）。
   */
  confidence?: ConfidenceMap;
}

export interface DuplicateGroup {
  idNumber: string;
  name: string;
  count: number;
  rows: number[];
}

export interface ScoreAnomaly {
  name: string;
  score: number;
  row: number;
}

export interface GradeScoreStat {
  grade: number;
  total: number;
  missing: number;
  blankRate: number;
}

export interface ParseResult {
  students: Student[];
  warnings: string[];
  mapping: ColumnMapping;
  rawRows: string[][];
  duplicates: DuplicateGroup[];
  anomalies: ScoreAnomaly[];
  gradeStats: GradeScoreStat[];
}

export function detectDuplicates(students: Student[], dataStartRow: number): DuplicateGroup[] {
  const groups = new Map<string, { name: string; indices: number[] }>();
  students.forEach((s, i) => {
    if (!s.idNumber) return;
    const key = s.idNumber.trim().toUpperCase();
    if (!groups.has(key)) groups.set(key, { name: s.name, indices: [] });
    groups.get(key)!.indices.push(dataStartRow + i + 1);
  });
  const result: DuplicateGroup[] = [];
  for (const [idNumber, g] of groups) {
    if (g.indices.length < 2) continue;
    result.push({ idNumber, name: g.name, count: g.indices.length, rows: g.indices });
  }
  return result;
}

export function analyzeScoreData(
  students: Student[],
  subject: Subject
): { anomalies: ScoreAnomaly[]; gradeStats: GradeScoreStat[] } {
  const anomalies: ScoreAnomaly[] = [];
  const gradeMap = new Map<number, { total: number; missing: number }>();

  students.forEach((s, i) => {
    const grade = s.grade ?? 0;
    if (!gradeMap.has(grade)) gradeMap.set(grade, { total: 0, missing: 0 });
    const stat = gradeMap.get(grade)!;
    const score = s[subject];
    if (score === undefined || score === null) {
      stat.total++;
      stat.missing++;
    } else {
      stat.total++;
      if ((score as number) < 0 || (score as number) > 150) {
        anomalies.push({ name: s.name, score: score as number, row: i + 1 });
      }
    }
  });

  const gradeStats: GradeScoreStat[] = [];
  for (const [grade, stat] of gradeMap) {
    if (grade === 0) continue;
    gradeStats.push({
      grade,
      total: stat.total,
      missing: stat.missing,
      blankRate: stat.total > 0 ? stat.missing / stat.total : 0,
    });
  }
  gradeStats.sort((a, b) => a.grade - b.grade);
  return { anomalies, gradeStats };
}

function buildColLabels(rows: string[][], dataStartRow: number): string[] {
  const numCols = Math.max(...rows.slice(0, 5).map((r) => r.length), 0);
  if (dataStartRow === 1 && rows.length > 0) {
    return Array.from({ length: numCols }, (_, i) => {
      const h = String(rows[0][i] ?? "").trim();
      return h || `第${i + 1}欄`;
    });
  }
  return Array.from({ length: numCols }, (_, i) => `第${i + 1}欄`);
}

function resolveMapping(
  rows: string[][],
  subject: Subject,
  scoreCandidates: string[]
): { mapping: ColumnMapping; warnings: string[] } {
  const warnings: string[] = [];
  let mapping: ColumnMapping;

  if (firstRowLooksLikeHeaders(rows[0])) {
    const rawHeaders = rows[0].map(String);
    const nameR = findColumnWithConfidence(rawHeaders, ["姓名", "name"]);
    const gradeR = findColumnWithConfidence(rawHeaders, ["年級", "grade"]);
    const classR = findColumnWithConfidence(rawHeaders, ["班級", "class", "班"]);
    const seatR = findColumnWithConfidence(rawHeaders, ["座號", "seat", "號碼"]);
    const idR = findColumnWithConfidence(rawHeaders, ["身分證字號", "身份證字號", "身分證", "身份證", "證照號碼", "id", "idnumber"]);
    let scoreR = findColumnWithConfidence(rawHeaders, scoreCandidates);
    if (scoreR.idx === -1) scoreR = findColumnWithConfidence(rawHeaders, ["分數", "成績", "score"]);

    let nameIdx = nameR.idx;
    let gradeIdx = gradeR.idx;
    const classIdx = classR.idx;
    const seatIdx = seatR.idx;
    let idIdx = idR.idx;
    const scoreIdx = scoreR.idx;

    let gradeFromClass = false;
    let gradeConf = gradeR.confidence;
    if (gradeIdx === -1 && classIdx !== -1 && classColIsClassCode(rows, 1, classIdx)) {
      gradeIdx = classIdx;
      gradeFromClass = true;
      gradeConf = Math.max(0.7, classR.confidence);
    }
    let idConf = idR.confidence;
    if (idIdx === -1) {
      const exc = [nameIdx, gradeIdx, classIdx, seatIdx, scoreIdx].filter((x) => x !== -1);
      idIdx = detectIdByContent(rows, 1, exc);
      if (idIdx !== -1) idConf = 0.7; // content-based fallback
    }

    if (nameIdx === -1) warnings.push("找不到「姓名」欄位");
    if (idIdx === -1) warnings.push("找不到「身分證字號」欄位");
    if (!gradeFromClass && gradeIdx === -1) warnings.push("找不到「年級」欄位");
    if (scoreIdx === -1) warnings.push("找不到成績欄位");
    if (gradeFromClass) warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");

    mapping = {
      nameIdx, gradeIdx, classIdx, seatIdx, idIdx, scoreIdx,
      gradeFromClass, dataStartRow: 1,
      colLabels: buildColLabels(rows, 1),
      confidence: {
        nameIdx: nameR.confidence,
        gradeIdx: gradeConf,
        classIdx: classR.confidence,
        seatIdx: seatR.confidence,
        idIdx: idConf,
        scoreIdx: scoreR.confidence,
      },
    };
  } else {
    const d = detectByContent(rows);
    if (d.gradeFromClass) warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");
    else if (d.idxGrade === -1) warnings.push("找不到「年級」欄位，請確認格式");
    if (d.idxId === -1) warnings.push("找不到「身分證字號」欄位，請確認格式");
    if (d.idxScore === -1) warnings.push("找不到成績欄位，請確認格式");

    mapping = {
      nameIdx: d.idxName, gradeIdx: d.idxGrade, classIdx: d.idxClass,
      seatIdx: d.idxSeat, idIdx: d.idxId, scoreIdx: d.idxScore,
      gradeFromClass: d.gradeFromClass, dataStartRow: 0,
      colLabels: buildColLabels(rows, 0),
      confidence: d.confidence,
    };
  }

  return { mapping, warnings };
}

function buildStudents(rows: string[][], mapping: ColumnMapping, subject: Subject): Student[] {
  const { nameIdx, gradeIdx, classIdx, seatIdx, idIdx, scoreIdx, gradeFromClass, dataStartRow } = mapping;
  const students: Student[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((cell) => !cell || String(cell).trim() === "")) continue;

    const name = nameIdx !== -1 ? String(row[nameIdx] ?? "").trim() : "";
    const idNumber = idIdx !== -1 ? String(row[idIdx] ?? "").trim() : "";
    const classRaw = classIdx !== -1 ? String(row[classIdx] ?? "").trim() : "";
    const seatNo = seatIdx !== -1 ? String(row[seatIdx] ?? "").trim() : "";
    const scoreRaw = scoreIdx !== -1 ? String(row[scoreIdx] ?? "").trim() : "";

    let grade: number; let className: string;
    if (gradeFromClass && gradeIdx !== -1) {
      const p = parseGradeFromClassCode(String(row[gradeIdx] ?? "").trim());
      grade = p.grade; className = p.className;
    } else if (gradeIdx !== -1) {
      grade = parseInt(String(row[gradeIdx] ?? "").trim().replace(/[^0-9]/g, ""), 10);
      className = classRaw;
    } else {
      grade = 0; className = classRaw;
    }

    const score = parseScore(scoreRaw);
    if (!name && !idNumber) continue;

    students.push({
      id: generateId(name, idNumber, i),
      studentId: seatNo || String(i),
      name, grade: isNaN(grade) ? 0 : grade,
      class: className, seatNo, idNumber,
      [subject]: score,
    });
  }
  return students;
}

export function remapStudents(
  rawRows: string[][],
  mapping: ColumnMapping,
  subject: Subject
): { students: Student[]; warnings: string[] } {
  const warnings: string[] = [];
  if (mapping.idIdx === -1) warnings.push("找不到「身分證字號」欄位");
  if (!mapping.gradeFromClass && mapping.gradeIdx === -1) warnings.push("找不到「年級」欄位");
  if (mapping.scoreIdx === -1) warnings.push("找不到成績欄位");
  if (mapping.gradeFromClass) warnings.push("年級已從班級代碼自動辨識");
  const students = buildStudents(rawRows, mapping, subject);
  return { students, warnings };
}

/**
 * 以 ArrayBuffer 輸入的版本（供 Web Worker 直接呼叫）
 */
export function parseScoreBuffer(buffer: ArrayBuffer, subject: Subject): ParseResult {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = pickSheetForSubject(workbook, subject);
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  if (rows.length < 1) {
    return {
      students: [], warnings: ["檔案內容為空"],
      mapping: { nameIdx: -1, gradeIdx: -1, classIdx: -1, seatIdx: -1, idIdx: -1, scoreIdx: -1, gradeFromClass: false, dataStartRow: 0, colLabels: [] },
      rawRows: rows,
      duplicates: [], anomalies: [], gradeStats: [],
    };
  }

  const scoreColumnCandidates: Record<Subject, string[]> = {
    chinese: ["國文", "chinese", "中文", "國語"],
    english: ["英文", "english", "英語"],
    math: ["數學", "math", "數"],
  };

  const { mapping, warnings } = resolveMapping(rows, subject, scoreColumnCandidates[subject]);
  const students = buildStudents(rows, mapping, subject);
  const duplicates = detectDuplicates(students, mapping.dataStartRow);
  const { anomalies, gradeStats } = analyzeScoreData(students, subject);

  return { students, warnings, mapping, rawRows: rows, duplicates, anomalies, gradeStats };
}

export interface MultiSubjectParseResult {
  /** Per-subject parsed students (score filled only for that subject). */
  students: Record<Subject, Student[]>;
  /** Which subjects were detected in the file */
  detectedSubjects: Subject[];
  warnings: string[];
  /** Union of all raw rows for debugging / remap UI (not currently used for re-map) */
  rawRows: string[][];
}

/**
 * Detect and parse a single Excel file that contains score columns for
 * multiple subjects at once (e.g. columns 國文 / 英文 / 數學 all on one sheet).
 *
 * Strategy:
 * 1. Read the first sheet.
 * 2. Detect columns by header keywords for each subject.
 * 3. For every subject that has a detected score column, build a dedicated
 *    Student[] using the existing buildStudents() with scoreIdx pointed at
 *    that column. This reuses all of the identifier/grade/class detection
 *    that single-subject parsing relies on.
 */
export function parseMultiSubjectBuffer(buffer: ArrayBuffer): MultiSubjectParseResult {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  const empty: MultiSubjectParseResult = {
    students: { chinese: [], english: [], math: [] },
    detectedSubjects: [],
    warnings: ["檔案內容為空"],
    rawRows: rows,
  };
  if (rows.length < 1) return empty;

  const warnings: string[] = [];
  const hasHeaders = firstRowLooksLikeHeaders(rows[0]);
  const rawHeaders = hasHeaders ? rows[0].map(String) : [];
  const dataStartRow = hasHeaders ? 1 : 0;

  const subjectKeywords: Record<Subject, string[]> = {
    chinese: ["國文", "chinese", "中文", "國語"],
    english: ["英文", "english", "英語"],
    math: ["數學", "math"],
  };

  // Detect score column per subject (header-based only — content-based detection
  // can't distinguish between three score columns anyway).
  const scoreIdxBySubject: Record<Subject, number> = { chinese: -1, english: -1, math: -1 };
  if (hasHeaders) {
    for (const subj of ["chinese", "english", "math"] as Subject[]) {
      scoreIdxBySubject[subj] = findColumn(rawHeaders, subjectKeywords[subj]);
    }
  }

  const detected: Subject[] = (["chinese", "english", "math"] as Subject[]).filter(
    (s) => scoreIdxBySubject[s] !== -1
  );
  if (detected.length === 0) {
    warnings.push(
      "合併檔案必須有表頭，並包含「國文」「英文」「數學」至少一欄才能辨識（可在標題列明寫：姓名、班級、身分證字號、國文成績、英文成績、數學成績）"
    );
    return { ...empty, warnings, rawRows: rows };
  }

  // Build a base mapping once, reusing resolveMapping for the first detected subject
  // (it picks name/id/grade/class by header or content; those don't change per subject).
  const baseCandidates = subjectKeywords[detected[0]];
  const { mapping: baseMapping, warnings: baseWarnings } = resolveMapping(rows, detected[0], baseCandidates);
  warnings.push(...baseWarnings);

  const students: Record<Subject, Student[]> = { chinese: [], english: [], math: [] };
  for (const subj of detected) {
    const mapping: ColumnMapping = { ...baseMapping, scoreIdx: scoreIdxBySubject[subj] };
    students[subj] = buildStudents(rows, mapping, subj);
  }

  return { students, detectedSubjects: detected, warnings, rawRows: rows };
}

export function parseMultiSubjectFile(file: File): Promise<MultiSubjectParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseMultiSubjectBuffer(e.target!.result as ArrayBuffer));
      } catch {
        reject(new Error("無法解析檔案，請確認格式正確"));
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

export function parseScoreFile(file: File, subject: Subject): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseScoreBuffer(e.target!.result as ArrayBuffer, subject));
      } catch {
        reject(new Error("無法解析檔案，請確認格式正確"));
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

function parseListSheetRows(rows: string[][], globalOffset: number): Student[] {
  if (rows.length < 2) return [];
  const hasContent = rows.slice(0, 5).some((r) => r.some((c) => c && String(c).trim()));
  if (!hasContent) return [];

  let nameIdx = -1, gradeIdx = -1, classIdx = -1, seatIdx = -1, idIdx = -1;
  let gradeFromClass = false, dataStartRow: number;

  if (firstRowLooksLikeHeaders(rows[0])) {
    dataStartRow = 1;
    const rh = rows[0].map(String);
    nameIdx = findColumn(rh, ["姓名", "name"]);
    let gradeIdxH = findColumn(rh, ["年級", "grade"]);
    const classIdxH = findColumn(rh, ["班級", "class", "班"]);
    seatIdx = findColumn(rh, ["座號", "seat"]);
    let idIdxH = findColumn(rh, ["身分證字號", "身份證字號", "身分證", "身份證", "證照號碼", "id", "idnumber"]);
    if (gradeIdxH === -1 && classIdxH !== -1 && classColIsClassCode(rows, 1, classIdxH)) {
      gradeIdxH = classIdxH; gradeFromClass = true;
    }
    if (idIdxH === -1) {
      const exc = [nameIdx, gradeIdxH, classIdxH, seatIdx].filter((x) => x !== -1);
      idIdxH = detectIdByContent(rows, 1, exc);
    }
    gradeIdx = gradeIdxH; classIdx = classIdxH; idIdx = idIdxH;
  } else {
    dataStartRow = 0;
    const d = detectByContent(rows);
    nameIdx = d.idxName; gradeIdx = d.idxGrade; classIdx = d.idxClass;
    seatIdx = d.idxSeat; idIdx = d.idxId; gradeFromClass = d.gradeFromClass;
  }

  const students: Student[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (row.every((c) => !c || String(c).trim() === "")) continue;
    const name = nameIdx !== -1 ? String(row[nameIdx] ?? "").trim() : "";
    const idNumber = idIdx !== -1 ? String(row[idIdx] ?? "").trim() : "";
    const classRaw = classIdx !== -1 ? String(row[classIdx] ?? "").trim() : "";
    const seatNo = seatIdx !== -1 ? String(row[seatIdx] ?? "").trim() : "";
    let grade: number; let className: string;
    if (gradeFromClass && gradeIdx !== -1) {
      const p = parseGradeFromClassCode(String(row[gradeIdx] ?? "").trim());
      grade = p.grade; className = p.className;
    } else if (gradeIdx !== -1) {
      grade = parseInt(String(row[gradeIdx] ?? "").trim().replace(/[^0-9]/g, ""), 10);
      className = classRaw;
    } else { grade = 0; className = classRaw; }
    if (!idNumber && !name) continue;
    students.push({
      id: generateId(name, idNumber, globalOffset + i),
      studentId: seatNo || String(globalOffset + i),
      name, grade: isNaN(grade) ? 0 : grade, class: className, seatNo, idNumber,
    });
  }
  return students;
}

export function parseListBuffer(buffer: ArrayBuffer): { students: Student[]; warnings: string[] } {
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });

  const allStudents: Student[] = [];
  const warnings: string[] = [];
  let globalOffset = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const students = parseListSheetRows(rows, globalOffset);
    allStudents.push(...students);
    globalOffset += rows.length;
  }

  if (allStudents.length === 0) {
    warnings.push("檔案內容為空或無法辨識欄位");
  }

  return { students: allStudents, warnings };
}

export function parseListFile(file: File): Promise<{ students: Student[]; warnings: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseListBuffer(e.target!.result as ArrayBuffer));
      } catch { reject(new Error("無法解析檔案")); }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "篩選結果");
  XLSX.writeFile(wb, filename);
}

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = String(row[h] ?? "");
        return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
