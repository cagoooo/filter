import * as XLSX from "xlsx";
import { Student, Subject } from "../types";

function generateId(name: string, idNumber: string, index: number): string {
  return `${name}-${idNumber}-${index}`;
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[_\-]/g, "");
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

function parseGradeFromClassCode(val: string): { grade: number; className: string } {
  const trimmed = val.trim();
  if (CLASS_CODE_RE.test(trimmed)) {
    const grade = parseInt(trimmed[0], 10);
    return { grade, className: trimmed };
  }
  const n = parseInt(trimmed, 10);
  if (!isNaN(n) && n >= 1 && n <= 6) {
    return { grade: n, className: trimmed };
  }
  return { grade: 0, className: trimmed };
}

function pickSheetForSubject(workbook: XLSX.WorkBook, subject: Subject): XLSX.WorkSheet {
  const subjectKeywords: Record<Subject, string[]> = {
    chinese: ["國文", "中文", "chinese"],
    english: ["英文", "english"],
    math: ["數學", "math", "數"],
  };
  const keywords = subjectKeywords[subject];
  const matchedName = workbook.SheetNames.find((name) =>
    keywords.some((k) => name.toLowerCase().includes(k.toLowerCase()))
  );
  const sheetName = matchedName ?? workbook.SheetNames[0];
  return workbook.Sheets[sheetName];
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
  id: number;
  classCode: number;
  grade: number;
  name: number;
  score: number;
  seat: number;
}

function detectColumnsByContent(dataRows: string[][]): {
  idxName: number;
  idxGrade: number;
  idxClass: number;
  idxSeat: number;
  idxId: number;
  idxScore: number;
  gradeFromClass: boolean;
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

  const bestCol = (key: keyof ColRates, exclude: number[] = [], threshold = 0.3): number => {
    let best = -1;
    let bestVal = threshold;
    for (let c = 0; c < numCols; c++) {
      if (exclude.includes(c)) continue;
      const v = rates[c][key];
      if (v > bestVal) {
        bestVal = v;
        best = c;
      }
    }
    return best;
  };

  const idxId = bestCol("id");
  const idxClassCode = bestCol("classCode", idxId !== -1 ? [idxId] : []);
  const idxName = bestCol("name", [idxId, idxClassCode].filter((x) => x !== -1));

  const exclude = [idxId, idxClassCode, idxName].filter((x) => x !== -1);
  const idxScore = bestCol("score", exclude);
  const idxSeat = bestCol("seat", [...exclude, idxScore].filter((x) => x !== -1));
  const idxGradeOnly = bestCol("grade", [...exclude, idxScore, idxSeat].filter((x) => x !== -1));

  let idxGrade = -1;
  let gradeFromClass = false;

  if (idxGradeOnly !== -1) {
    idxGrade = idxGradeOnly;
  } else if (idxClassCode !== -1) {
    idxGrade = idxClassCode;
    gradeFromClass = true;
  }

  return { idxName, idxGrade, idxClass: idxClassCode, idxSeat, idxId, idxScore, gradeFromClass };
}

function detectIdColumnByContent(dataRows: string[][], dataStartRow: number, exclude: number[]): number {
  const sample = dataRows.slice(dataStartRow, dataStartRow + Math.min(20, dataRows.length - dataStartRow));
  const numCols = Math.max(...sample.map((r) => r.length));
  let best = -1;
  let bestRate = 0.3;
  for (let c = 0; c < numCols; c++) {
    if (exclude.includes(c)) continue;
    const vals = sample.map((r) => String(r[c] ?? "").trim()).filter(Boolean);
    const rate = vals.filter(isTaiwanId).length / (vals.length || 1);
    if (rate > bestRate) {
      bestRate = rate;
      best = c;
    }
  }
  return best;
}

function classColHasClassCodes(dataRows: string[][], dataStartRow: number, idxClass: number): boolean {
  const sample = dataRows.slice(dataStartRow, dataStartRow + Math.min(10, dataRows.length - dataStartRow));
  const vals = sample.map((r) => String(r[idxClass] ?? "").trim()).filter(Boolean);
  if (vals.length === 0) return false;
  return vals.filter(isClassCode).length / vals.length >= 0.5;
}

function firstRowLooksLikeHeaders(row: string[]): boolean {
  const knownKeywords = [
    "姓名", "名", "name",
    "年級", "grade",
    "班", "class",
    "座號", "seat",
    "身分", "身份", "證", "id",
    "國文", "英文", "數學", "成績", "分數",
    "chinese", "english", "math", "score",
  ];

  const leadingCols = row.slice(0, Math.min(6, row.length)).map((c) => String(c).trim());
  const leadingDataCount = leadingCols.filter(
    (c) => isClassCode(c) || isTaiwanId(c) || (isScore(c) && isScore(c) && parseFloat(c) > 6)
  ).length;
  if (leadingDataCount >= 2) return false;

  const cells = leadingCols.map((c) => c.toLowerCase());
  const matchCount = cells.filter((c) =>
    knownKeywords.some((k) => c.includes(k))
  ).length;
  return matchCount >= 2;
}

function resolveColumns(
  rawHeaders: string[],
  dataRows: string[][],
  dataStartRow: number,
  scoreCandidates: string[]
): {
  idxName: number;
  idxGrade: number;
  idxClass: number;
  idxSeat: number;
  idxId: number;
  idxScore: number;
  gradeFromClass: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let idxName = findColumn(rawHeaders, ["姓名", "name"]);
  let idxGrade = findColumn(rawHeaders, ["年級", "grade"]);
  const idxClass = findColumn(rawHeaders, ["班級", "class", "班"]);
  const idxSeat = findColumn(rawHeaders, ["座號", "seat", "號碼"]);
  let idxId = findColumn(rawHeaders, [
    "身分證字號", "身份證字號", "身分證", "身份證", "證照號碼", "id", "idnumber",
  ]);
  let idxScore = findColumn(rawHeaders, scoreCandidates);

  if (idxScore === -1) {
    idxScore = findColumn(rawHeaders, ["分數", "成績", "score"]);
  }

  let gradeFromClass = false;
  if (idxGrade === -1 && idxClass !== -1) {
    if (classColHasClassCodes(dataRows, dataStartRow, idxClass)) {
      idxGrade = idxClass;
      gradeFromClass = true;
    }
  }

  if (idxId === -1) {
    const exclude = [idxName, idxGrade, idxClass, idxSeat, idxScore].filter((x) => x !== -1);
    idxId = detectIdColumnByContent(dataRows, dataStartRow, exclude);
  }

  if (idxName === -1) warnings.push("找不到「姓名」欄位");
  if (idxId === -1) warnings.push("找不到「身分證字號」欄位");
  if (!gradeFromClass && idxGrade === -1) warnings.push("找不到「年級」欄位");
  if (idxScore === -1) warnings.push("找不到成績欄位");
  if (gradeFromClass) warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");

  return { idxName, idxGrade, idxClass, idxSeat, idxId, idxScore, gradeFromClass, warnings };
}

export interface ParseResult {
  students: Student[];
  warnings: string[];
}

export function parseScoreFile(
  file: File,
  subject: Subject
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = pickSheetForSubject(workbook, subject);
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (rows.length < 1) {
          resolve({ students: [], warnings: ["檔案內容為空"] });
          return;
        }

        const warnings: string[] = [];
        let dataStartRow: number;
        let idxName: number;
        let idxGrade: number;
        let idxClass: number;
        let idxSeat: number;
        let idxId: number;
        let idxScore: number;
        let gradeFromClass = false;

        const scoreColumnCandidates: Record<Subject, string[]> = {
          chinese: ["國文", "chinese", "中文", "國語"],
          english: ["英文", "english", "英語"],
          math: ["數學", "math", "數"],
        };

        if (firstRowLooksLikeHeaders(rows[0])) {
          dataStartRow = 1;
          const rawHeaders = rows[0].map(String);
          const resolved = resolveColumns(rawHeaders, rows, dataStartRow, scoreColumnCandidates[subject]);
          idxName = resolved.idxName;
          idxGrade = resolved.idxGrade;
          idxClass = resolved.idxClass;
          idxSeat = resolved.idxSeat;
          idxId = resolved.idxId;
          idxScore = resolved.idxScore;
          gradeFromClass = resolved.gradeFromClass;
          warnings.push(...resolved.warnings);
        } else {
          dataStartRow = 0;
          const detected = detectColumnsByContent(rows);
          idxName = detected.idxName;
          idxGrade = detected.idxGrade;
          idxClass = detected.idxClass;
          idxSeat = detected.idxSeat;
          idxId = detected.idxId;
          idxScore = detected.idxScore;
          gradeFromClass = detected.gradeFromClass;

          if (gradeFromClass) {
            warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");
          } else if (idxGrade === -1) {
            warnings.push("找不到「年級」欄位，請確認格式");
          }
          if (idxId === -1) warnings.push("找不到「身分證字號」欄位，請確認格式");
          if (idxScore === -1) warnings.push("找不到成績欄位，請確認格式");
        }

        const students: Student[] = [];

        for (let i = dataStartRow; i < rows.length; i++) {
          const row = rows[i];
          if (row.every((cell) => !cell || String(cell).trim() === "")) continue;

          const name = idxName !== -1 ? String(row[idxName] ?? "").trim() : "";
          const idNumber = idxId !== -1 ? String(row[idxId] ?? "").trim() : "";
          const classRaw = idxClass !== -1 ? String(row[idxClass] ?? "").trim() : "";
          const seatNo = idxSeat !== -1 ? String(row[idxSeat] ?? "").trim() : "";
          const scoreRaw = idxScore !== -1 ? String(row[idxScore] ?? "").trim() : "";

          let grade: number;
          let className: string;

          if (gradeFromClass && idxGrade !== -1) {
            const parsed = parseGradeFromClassCode(String(row[idxGrade] ?? "").trim());
            grade = parsed.grade;
            className = parsed.className;
          } else if (idxGrade !== -1) {
            const gradeRaw = String(row[idxGrade] ?? "").trim();
            grade = parseInt(gradeRaw.replace(/[^0-9]/g, ""), 10);
            className = classRaw;
          } else {
            grade = 0;
            className = classRaw;
          }

          const score = scoreRaw !== "" ? parseFloat(scoreRaw) : undefined;

          if (!name && !idNumber) continue;

          students.push({
            id: generateId(name, idNumber, i),
            studentId: seatNo || String(i),
            name,
            grade: isNaN(grade) ? 0 : grade,
            class: className,
            seatNo,
            idNumber,
            [subject]: score !== undefined && !isNaN(score) ? score : undefined,
          });
        }

        resolve({ students, warnings });
      } catch (err) {
        reject(new Error("無法解析檔案，請確認格式正確"));
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

export function parseListFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (rows.length < 1) {
          resolve({ students: [], warnings: ["檔案內容為空"] });
          return;
        }

        const warnings: string[] = [];
        let dataStartRow: number;
        let idxName: number;
        let idxGrade: number;
        let idxClass: number;
        let idxSeat: number;
        let idxId: number;
        let gradeFromClass = false;

        if (firstRowLooksLikeHeaders(rows[0])) {
          dataStartRow = 1;
          const rawHeaders = rows[0].map(String);
          let idxGradeH = findColumn(rawHeaders, ["年級", "grade"]);
          const idxClassH = findColumn(rawHeaders, ["班級", "class", "班"]);
          let idxIdH = findColumn(rawHeaders, [
            "身分證字號", "身份證字號", "身分證", "身份證", "證照號碼", "id", "idnumber",
          ]);
          const idxNameH = findColumn(rawHeaders, ["姓名", "name"]);
          const idxSeatH = findColumn(rawHeaders, ["座號", "seat"]);

          let gradeFromClassH = false;
          if (idxGradeH === -1 && idxClassH !== -1) {
            if (classColHasClassCodes(rows, 1, idxClassH)) {
              idxGradeH = idxClassH;
              gradeFromClassH = true;
            }
          }
          if (idxIdH === -1) {
            const exclude = [idxNameH, idxGradeH, idxClassH, idxSeatH].filter((x) => x !== -1);
            idxIdH = detectIdColumnByContent(rows, 1, exclude);
          }

          idxName = idxNameH;
          idxGrade = idxGradeH;
          idxClass = idxClassH;
          idxSeat = idxSeatH;
          idxId = idxIdH;
          gradeFromClass = gradeFromClassH;

          if (idxId === -1) warnings.push("找不到「身分證字號」欄位");
          if (idxName === -1) warnings.push("找不到「姓名」欄位");
          if (gradeFromClass) warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");
        } else {
          dataStartRow = 0;
          const detected = detectColumnsByContent(rows);
          idxName = detected.idxName;
          idxGrade = detected.idxGrade;
          idxClass = detected.idxClass;
          idxSeat = detected.idxSeat;
          idxId = detected.idxId;
          gradeFromClass = detected.gradeFromClass;

          if (gradeFromClass) {
            warnings.push("年級已從班級代碼自動辨識（例：203 → 2年級3班）");
          }
          if (idxId === -1) warnings.push("找不到「身分證字號」欄位，請確認格式");
        }

        const students: Student[] = [];

        for (let i = dataStartRow; i < rows.length; i++) {
          const row = rows[i];
          if (row.every((cell) => !cell || String(cell).trim() === "")) continue;

          const name = idxName !== -1 ? String(row[idxName] ?? "").trim() : "";
          const idNumber = idxId !== -1 ? String(row[idxId] ?? "").trim() : "";
          const classRaw = idxClass !== -1 ? String(row[idxClass] ?? "").trim() : "";
          const seatNo = idxSeat !== -1 ? String(row[idxSeat] ?? "").trim() : "";

          let grade: number;
          let className: string;

          if (gradeFromClass && idxGrade !== -1) {
            const parsed = parseGradeFromClassCode(String(row[idxGrade] ?? "").trim());
            grade = parsed.grade;
            className = parsed.className;
          } else if (idxGrade !== -1) {
            const gradeRaw = String(row[idxGrade] ?? "").trim();
            grade = parseInt(gradeRaw.replace(/[^0-9]/g, ""), 10);
            className = classRaw;
          } else {
            grade = 0;
            className = classRaw;
          }

          if (!idNumber && !name) continue;

          students.push({
            id: generateId(name, idNumber, i),
            studentId: seatNo || String(i),
            name,
            grade: isNaN(grade) ? 0 : grade,
            class: className,
            seatNo,
            idNumber,
          });
        }

        resolve({ students, warnings });
      } catch {
        reject(new Error("無法解析檔案"));
      }
    };
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string
) {
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
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
