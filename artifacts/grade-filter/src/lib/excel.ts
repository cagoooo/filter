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
  const best = (key: keyof ColRates, exclude: number[] = [], thr = 0.3): number => {
    let b = -1; let bv = thr;
    for (let c = 0; c < numCols; c++) {
      if (exclude.includes(c)) continue;
      if (rates[c][key] > bv) { bv = rates[c][key]; b = c; }
    }
    return b;
  };
  const idxId = best("id");
  const idxClassCode = best("classCode", idxId !== -1 ? [idxId] : []);
  const idxName = best("name", [idxId, idxClassCode].filter((x) => x !== -1));
  const exc = [idxId, idxClassCode, idxName].filter((x) => x !== -1);
  const idxScore = best("score", exc);
  const idxSeat = best("seat", [...exc, idxScore].filter((x) => x !== -1));
  const idxGradeOnly = best("grade", [...exc, idxScore, idxSeat].filter((x) => x !== -1));
  let idxGrade = -1; let gradeFromClass = false;
  if (idxGradeOnly !== -1) { idxGrade = idxGradeOnly; }
  else if (idxClassCode !== -1) { idxGrade = idxClassCode; gradeFromClass = true; }
  return { idxName, idxGrade, idxClass: idxClassCode, idxSeat, idxId, idxScore, gradeFromClass };
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
    let nameIdx = findColumn(rawHeaders, ["姓名", "name"]);
    let gradeIdx = findColumn(rawHeaders, ["年級", "grade"]);
    const classIdx = findColumn(rawHeaders, ["班級", "class", "班"]);
    const seatIdx = findColumn(rawHeaders, ["座號", "seat", "號碼"]);
    let idIdx = findColumn(rawHeaders, ["身分證字號", "身份證字號", "身分證", "身份證", "證照號碼", "id", "idnumber"]);
    let scoreIdx = findColumn(rawHeaders, scoreCandidates);
    if (scoreIdx === -1) scoreIdx = findColumn(rawHeaders, ["分數", "成績", "score"]);

    let gradeFromClass = false;
    if (gradeIdx === -1 && classIdx !== -1 && classColIsClassCode(rows, 1, classIdx)) {
      gradeIdx = classIdx; gradeFromClass = true;
    }
    if (idIdx === -1) {
      const exc = [nameIdx, gradeIdx, classIdx, seatIdx, scoreIdx].filter((x) => x !== -1);
      idIdx = detectIdByContent(rows, 1, exc);
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

    const score = scoreRaw !== "" ? parseFloat(scoreRaw) : undefined;
    if (!name && !idNumber) continue;

    students.push({
      id: generateId(name, idNumber, i),
      studentId: seatNo || String(i),
      name, grade: isNaN(grade) ? 0 : grade,
      class: className, seatNo, idNumber,
      [subject]: score !== undefined && !isNaN(score) ? score : undefined,
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

export function parseScoreFile(file: File, subject: Subject): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = pickSheetForSubject(workbook, subject);
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

        if (rows.length < 1) {
          resolve({
            students: [], warnings: ["檔案內容為空"],
            mapping: { nameIdx: -1, gradeIdx: -1, classIdx: -1, seatIdx: -1, idIdx: -1, scoreIdx: -1, gradeFromClass: false, dataStartRow: 0, colLabels: [] },
            rawRows: rows,
            duplicates: [], anomalies: [], gradeStats: [],
          });
          return;
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

        resolve({ students, warnings, mapping, rawRows: rows, duplicates, anomalies, gradeStats });
      } catch {
        reject(new Error("無法解析檔案，請確認格式正確"));
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

export function parseListFile(file: File): Promise<{ students: Student[]; warnings: string[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

        if (rows.length < 1) { resolve({ students: [], warnings: ["檔案內容為空"] }); return; }

        const warnings: string[] = [];
        let nameIdx: number; let gradeIdx: number; let classIdx: number;
        let seatIdx: number; let idIdx: number; let gradeFromClass = false;
        let dataStartRow: number;

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
          if (idIdx === -1) warnings.push("找不到「身分證字號」欄位");
          if (nameIdx === -1) warnings.push("找不到「姓名」欄位");
          if (gradeFromClass) warnings.push("年級已從班級代碼自動辨識");
        } else {
          dataStartRow = 0;
          const d = detectByContent(rows);
          nameIdx = d.idxName; gradeIdx = d.idxGrade; classIdx = d.idxClass;
          seatIdx = d.idxSeat; idIdx = d.idxId; gradeFromClass = d.gradeFromClass;
          if (gradeFromClass) warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");
          if (idIdx === -1) warnings.push("找不到「身分證字號」欄位，請確認格式");
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
          students.push({ id: generateId(name, idNumber, i), studentId: seatNo || String(i), name, grade: isNaN(grade) ? 0 : grade, class: className, seatNo, idNumber });
        }

        resolve({ students, warnings });
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
