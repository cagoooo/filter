/**
 * P3.3：Excel 解析與欄位偵測測試
 *
 * 對應 優化改良建議.md 7.3 節必測項目：
 *   1. 偵測台灣身分證格式
 *   2. 偵測 3 位數班級代碼
 *   3. 偵測 0–150 分數欄位
 *
 * 欄位偵測主要邏輯在模組內 detectByContent / detectIdByContent，
 * 對外只暴露 parseScoreBuffer 這個整合入口——因此我們透過真實 xlsx
 * buffer 驗證整條資料流，同時測試對外工具函式 parseScore /
 * parseGradeFromClassCode。
 */
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseScore,
  parseGradeFromClassCode,
  parseScoreBuffer,
} from "../excel";

function makeXlsxBuffer(rows: (string | number)[][], sheetName = "國文"): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  // xlsx 可能回傳 Uint8Array，統一轉成 ArrayBuffer
  return buf instanceof ArrayBuffer ? buf : (buf as Uint8Array).buffer;
}

describe("parseScore", () => {
  it("正常數字", () => {
    expect(parseScore(85)).toBe(85);
    expect(parseScore("90")).toBe(90);
    expect(parseScore("  72  ")).toBe(72);
    expect(parseScore("95.5")).toBe(95.5);
  });

  it("空值 / null / undefined", () => {
    expect(parseScore(null)).toBeUndefined();
    expect(parseScore(undefined)).toBeUndefined();
    expect(parseScore("")).toBeUndefined();
    expect(parseScore("   ")).toBeUndefined();
  });

  it("缺考／補考等標記", () => {
    expect(parseScore("缺考")).toBeUndefined();
    expect(parseScore("缺")).toBeUndefined();
    expect(parseScore("補")).toBeUndefined();
    expect(parseScore("請假")).toBeUndefined();
    expect(parseScore("—")).toBeUndefined();
    expect(parseScore("-")).toBeUndefined();
    expect(parseScore("N/A")).toBeUndefined();
    expect(parseScore("無")).toBeUndefined();
  });

  it("超出 0–150 合理範圍視為無效", () => {
    expect(parseScore(-1)).toBeUndefined();
    expect(parseScore(151)).toBeUndefined();
    expect(parseScore("200")).toBeUndefined();
  });

  it("邊界值 0 與 150 視為有效", () => {
    expect(parseScore(0)).toBe(0);
    expect(parseScore(150)).toBe(150);
  });

  it("非數字字串（無法 parseFloat）", () => {
    expect(parseScore("abc")).toBeUndefined();
  });
});

describe("parseGradeFromClassCode", () => {
  it("3 位數班級代碼解析出年級", () => {
    expect(parseGradeFromClassCode("301")).toEqual({ grade: 3, className: "301" });
    expect(parseGradeFromClassCode("102")).toEqual({ grade: 1, className: "102" });
    expect(parseGradeFromClassCode("605")).toEqual({ grade: 6, className: "605" });
  });

  it("單一數字 1–6 視為年級", () => {
    expect(parseGradeFromClassCode("3")).toEqual({ grade: 3, className: "3" });
    expect(parseGradeFromClassCode("1")).toEqual({ grade: 1, className: "1" });
  });

  it("前後空白被修剪", () => {
    expect(parseGradeFromClassCode("  301  ")).toEqual({ grade: 3, className: "301" });
  });

  it("無法辨識時 grade=0", () => {
    expect(parseGradeFromClassCode("XYZ").grade).toBe(0);
    expect(parseGradeFromClassCode("999").grade).toBe(0);
    expect(parseGradeFromClassCode("").grade).toBe(0);
  });
});

describe("parseScoreBuffer — 含表頭", () => {
  it("標準表頭格式：偵測姓名/班級/身分證/成績", () => {
    const rows = [
      ["姓名", "班級", "座號", "身分證字號", "國文"],
      ["張小明", "301", "1", "A123456789", 85],
      ["李小華", "301", "2", "B234567890", 72],
      ["王小美", "302", "3", "C345678901", 90],
    ];
    const buffer = makeXlsxBuffer(rows);
    const result = parseScoreBuffer(buffer, "chinese");

    expect(result.students).toHaveLength(3);
    expect(result.students[0].name).toBe("張小明");
    expect(result.students[0].grade).toBe(3); // 從班級 301 解析
    expect(result.students[0].class).toBe("301");
    expect(result.students[0].idNumber).toBe("A123456789");
    expect(result.students[0].chinese).toBe(85);
    expect(result.mapping.gradeFromClass).toBe(true);
  });

  it("year + class 分離欄位", () => {
    const rows = [
      ["姓名", "年級", "班級", "身分證字號", "英文"],
      ["甲", "3", "A", "A123456789", 80],
      ["乙", "3", "A", "B234567890", 95],
    ];
    const buffer = makeXlsxBuffer(rows, "英文");
    const result = parseScoreBuffer(buffer, "english");

    expect(result.students).toHaveLength(2);
    expect(result.students[0].grade).toBe(3);
    expect(result.students[0].english).toBe(80);
    expect(result.mapping.gradeFromClass).toBe(false);
  });

  it("缺考標記應保留學生但成績為 undefined", () => {
    const rows = [
      ["姓名", "班級", "身分證字號", "國文"],
      ["張小明", "301", "A123456789", 85],
      ["李小華", "301", "B234567890", "缺考"],
    ];
    const buffer = makeXlsxBuffer(rows);
    const result = parseScoreBuffer(buffer, "chinese");

    expect(result.students).toHaveLength(2);
    expect(result.students[0].chinese).toBe(85);
    expect(result.students[1].chinese).toBeUndefined();
  });
});

describe("parseScoreBuffer — 身分證欄位偵測（以內容判斷）", () => {
  it("即使表頭欄名不標準，仍能透過台灣身分證格式（1 英文 + 9 數字）自動找到 ID 欄", () => {
    const rows = [
      ["姓名", "班級", "學號", "國文"],  // "學號" 不在預設 ID 關鍵字
      ["張小明", "301", "A123456789", 85],
      ["李小華", "301", "B234567890", 72],
      ["王小美", "302", "C345678901", 90],
    ];
    const buffer = makeXlsxBuffer(rows);
    const result = parseScoreBuffer(buffer, "chinese");

    // ID 欄位應由 content-based fallback 找到
    expect(result.mapping.idIdx).toBeGreaterThanOrEqual(0);
    expect(result.students[0].idNumber).toBe("A123456789");
  });
});

describe("parseScoreBuffer — 3 位數班級代碼偵測", () => {
  it("無年級欄時，3 位數班級代碼（1xx–6xx）可反推年級", () => {
    const rows = [
      ["姓名", "班級", "身分證字號", "國文"],
      ["甲", "101", "A123456789", 80],
      ["乙", "203", "B234567890", 90],
      ["丙", "604", "C345678901", 70],
    ];
    const buffer = makeXlsxBuffer(rows);
    const result = parseScoreBuffer(buffer, "chinese");

    expect(result.mapping.gradeFromClass).toBe(true);
    expect(result.students[0].grade).toBe(1);
    expect(result.students[1].grade).toBe(2);
    expect(result.students[2].grade).toBe(6);
  });
});

describe("parseScoreBuffer — 成績欄位 0–150 範圍", () => {
  it("不尋常但合理的分數（如 120）能被接受", () => {
    const rows = [
      ["姓名", "班級", "身分證字號", "國文"],
      ["甲", "301", "A123456789", 120],
      ["乙", "301", "B234567890", 150],
      ["丙", "301", "C345678901", 0],
    ];
    const buffer = makeXlsxBuffer(rows);
    const result = parseScoreBuffer(buffer, "chinese");

    expect(result.students[0].chinese).toBe(120);
    expect(result.students[1].chinese).toBe(150);
    expect(result.students[2].chinese).toBe(0);
  });
});

describe("parseScoreBuffer — 置信度", () => {
  it("精準表頭匹配 → 置信度 ~0.95", () => {
    const rows = [
      ["姓名", "班級", "身分證字號", "國文"],
      ["甲", "301", "A123456789", 80],
    ];
    const buffer = makeXlsxBuffer(rows);
    const result = parseScoreBuffer(buffer, "chinese");
    expect(result.mapping.confidence?.nameIdx ?? 0).toBeGreaterThanOrEqual(0.9);
    expect(result.mapping.confidence?.scoreIdx ?? 0).toBeGreaterThanOrEqual(0.9);
  });
});

describe("parseScoreBuffer — 錯誤處理", () => {
  it("空 sheet 回傳空陣列與警告", () => {
    const buffer = makeXlsxBuffer([]);
    const result = parseScoreBuffer(buffer, "chinese");
    expect(result.students).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
