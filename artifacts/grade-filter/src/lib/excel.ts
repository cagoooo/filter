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

function findColumn(
  headers: string[],
  candidates: string[]
): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => normalizeHeader(h) === candidate || h.includes(candidate)
    );
    if (idx !== -1) return idx;
  }
  return -1;
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
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });

        if (rows.length < 2) {
          resolve({ students: [], warnings: ["檔案內容為空或只有標題列"] });
          return;
        }

        const rawHeaders = rows[0].map(String);
        const headers = rawHeaders.map(normalizeHeader);

        const idxName = findColumn(rawHeaders, ["姓名", "name"]);
        const idxGrade = findColumn(rawHeaders, ["年級", "grade"]);
        const idxClass = findColumn(rawHeaders, ["班級", "class", "班"]);
        const idxSeat = findColumn(rawHeaders, ["座號", "seat", "號碼"]);
        const idxId = findColumn(rawHeaders, [
          "身分證字號",
          "身份證字號",
          "身分證",
          "身份證",
          "id",
          "idnumber",
        ]);

        const scoreColumnCandidates: Record<Subject, string[]> = {
          chinese: ["國文", "chinese", "中文", "國語"],
          english: ["英文", "english", "英語"],
          math: ["數學", "math", "數"],
        };

        const idxScore = findColumn(rawHeaders, scoreColumnCandidates[subject]);

        const warnings: string[] = [];

        if (idxName === -1) warnings.push("找不到「姓名」欄位");
        if (idxId === -1) warnings.push("找不到「身分證字號」欄位");
        if (idxGrade === -1) warnings.push("找不到「年級」欄位");
        if (idxScore === -1) warnings.push(`找不到成績欄位`);

        const students: Student[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.every((cell) => !cell || String(cell).trim() === ""))
            continue;

          const name = idxName !== -1 ? String(row[idxName] ?? "").trim() : "";
          const idNumber =
            idxId !== -1 ? String(row[idxId] ?? "").trim() : "";
          const gradeRaw =
            idxGrade !== -1 ? String(row[idxGrade] ?? "").trim() : "";
          const className =
            idxClass !== -1 ? String(row[idxClass] ?? "").trim() : "";
          const seatNo =
            idxSeat !== -1 ? String(row[idxSeat] ?? "").trim() : "";
          const scoreRaw =
            idxScore !== -1 ? String(row[idxScore] ?? "").trim() : "";

          const grade = parseInt(gradeRaw.replace(/[^0-9]/g, ""), 10);
          const score = scoreRaw !== "" ? parseFloat(scoreRaw) : undefined;

          if (!name && !idNumber) continue;

          const student: Student = {
            id: generateId(name, idNumber, i),
            studentId: seatNo || String(i),
            name,
            grade: isNaN(grade) ? 0 : grade,
            class: className,
            seatNo,
            idNumber,
            [subject]: isNaN(score!) ? undefined : score,
          };

          students.push(student);
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

        if (rows.length < 2) {
          resolve({ students: [], warnings: ["檔案內容為空"] });
          return;
        }

        const rawHeaders = rows[0].map(String);
        const idxName = findColumn(rawHeaders, ["姓名", "name"]);
        const idxGrade = findColumn(rawHeaders, ["年級", "grade"]);
        const idxClass = findColumn(rawHeaders, ["班級", "class", "班"]);
        const idxSeat = findColumn(rawHeaders, ["座號", "seat"]);
        const idxId = findColumn(rawHeaders, [
          "身分證字號",
          "身份證字號",
          "身分證",
          "身份證",
          "id",
          "idnumber",
        ]);

        const warnings: string[] = [];
        if (idxId === -1) warnings.push("找不到「身分證字號」欄位");
        if (idxName === -1) warnings.push("找不到「姓名」欄位");

        const students: Student[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.every((cell) => !cell || String(cell).trim() === ""))
            continue;

          const name = idxName !== -1 ? String(row[idxName] ?? "").trim() : "";
          const idNumber =
            idxId !== -1 ? String(row[idxId] ?? "").trim() : "";
          const gradeRaw =
            idxGrade !== -1 ? String(row[idxGrade] ?? "").trim() : "";
          const className =
            idxClass !== -1 ? String(row[idxClass] ?? "").trim() : "";
          const seatNo =
            idxSeat !== -1 ? String(row[idxSeat] ?? "").trim() : "";

          const grade = parseInt(gradeRaw.replace(/[^0-9]/g, ""), 10);

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
