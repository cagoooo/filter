/**
 * P3.3：runFilter 核心邏輯單元測試
 *
 * 對應 優化改良建議.md 7.3 節列出的 5 項必測行為：
 *   1. 百分比篩選正確
 *   2. 排除特生
 *   3. 標記優先學生
 *   4. 前 % 與後 % 排序正確
 *   5. ID 大小寫不敏感比對
 *
 * 另補 count 模式、跨 subject enrich、空輸入等邊界案例。
 */
import { describe, it, expect } from "vitest";
import { runFilterPure } from "../filter";
import { Student, FilterConfig } from "../../types";

function mkStudent(overrides: Partial<Student> & { idNumber: string }): Student {
  return {
    id: overrides.idNumber,
    studentId: overrides.seatNo ?? "1",
    name: overrides.name ?? `學生${overrides.idNumber}`,
    grade: overrides.grade ?? 3,
    class: overrides.class ?? "301",
    seatNo: overrides.seatNo ?? "1",
    idNumber: overrides.idNumber,
    chinese: overrides.chinese,
    english: overrides.english,
    math: overrides.math,
  };
}

const CONFIG_TOP_20_PERCENT: FilterConfig = {
  grade: 3,
  subject: "chinese",
  mode: "percent",
  value: 20,
  direction: "top",
};

describe("runFilterPure — 百分比篩選", () => {
  it("20% 於 10 人中取前 2 名（Math.ceil）", () => {
    const students: Student[] = [];
    for (let i = 0; i < 10; i++) {
      students.push(mkStudent({ idNumber: `A${100000000 + i}`, chinese: 50 + i * 5 }));
    }
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [CONFIG_TOP_20_PERCENT],
    });
    const normal = result.filter((r) => r.status === "normal");
    expect(normal).toHaveLength(2);
    // 最高分應為 i=9 (95 分) 與 i=8 (90 分)
    expect(normal[0].filterScore).toBe(95);
    expect(normal[1].filterScore).toBe(90);
  });

  it("15% 於 7 人中取 ceil(1.05)=2 名", () => {
    const students = Array.from({ length: 7 }, (_, i) =>
      mkStudent({ idNumber: `B${200000000 + i}`, chinese: i * 10 }),
    );
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [{ ...CONFIG_TOP_20_PERCENT, value: 15 }],
    });
    expect(result.filter((r) => r.status === "normal")).toHaveLength(2);
  });
});

describe("runFilterPure — count 模式", () => {
  it("指定 3 名 → 回傳正好 3 名（或學生總數）", () => {
    const students = Array.from({ length: 5 }, (_, i) =>
      mkStudent({ idNumber: `C${300000000 + i}`, chinese: i * 10 }),
    );
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 3, direction: "top" }],
    });
    expect(result.filter((r) => r.status === "normal")).toHaveLength(3);
  });

  it("指定 99 名、但僅 3 名符合年級 → clamp 至 3", () => {
    const students = [
      mkStudent({ idNumber: "D100000001", chinese: 80, grade: 3 }),
      mkStudent({ idNumber: "D100000002", chinese: 70, grade: 3 }),
      mkStudent({ idNumber: "D100000003", chinese: 60, grade: 3 }),
      mkStudent({ idNumber: "D100000004", chinese: 90, grade: 4 }),
    ];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 99, direction: "top" }],
    });
    expect(result.filter((r) => r.status === "normal")).toHaveLength(3);
  });
});

describe("runFilterPure — 前 % 與後 % 排序", () => {
  const students = [
    mkStudent({ idNumber: "E100000001", chinese: 30 }),
    mkStudent({ idNumber: "E100000002", chinese: 50 }),
    mkStudent({ idNumber: "E100000003", chinese: 70 }),
    mkStudent({ idNumber: "E100000004", chinese: 90 }),
  ];

  it("direction=top 取高分", () => {
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 2, direction: "top" }],
    });
    const picked = result.filter((r) => r.status === "normal").map((r) => r.filterScore);
    expect(picked).toEqual([90, 70]);
  });

  it("direction=bottom 取低分", () => {
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 2, direction: "bottom" }],
    });
    const picked = result.filter((r) => r.status === "normal").map((r) => r.filterScore);
    expect(picked).toEqual([30, 50]);
  });

  it("未指定 direction 預設為 top", () => {
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 1 }],
    });
    expect(result.filter((r) => r.status === "normal")[0].filterScore).toBe(90);
  });
});

describe("runFilterPure — 排除特殊生", () => {
  it("特殊生不進入 normal 結果，另以 excluded 狀態出現", () => {
    const students = [
      mkStudent({ idNumber: "F100000001", chinese: 100, name: "甲" }),
      mkStudent({ idNumber: "F100000002", chinese: 90, name: "乙" }),
      mkStudent({ idNumber: "F100000003", chinese: 80, name: "丙" }),
    ];
    const special = [mkStudent({ idNumber: "F100000001", name: "甲" })];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: special,
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 2, direction: "top" }],
    });

    const normal = result.filter((r) => r.status === "normal");
    expect(normal.map((r) => r.idNumber)).toEqual(["F100000002", "F100000003"]);

    const excluded = result.filter((r) => r.status === "excluded");
    expect(excluded).toHaveLength(1);
    expect(excluded[0].idNumber).toBe("F100000001");
  });
});

describe("runFilterPure — 標記優先學生", () => {
  it("優先名單落在 top N 中 → status=priority 而非 normal", () => {
    const students = [
      mkStudent({ idNumber: "G100000001", chinese: 100 }),
      mkStudent({ idNumber: "G100000002", chinese: 90 }),
      mkStudent({ idNumber: "G100000003", chinese: 80 }),
    ];
    const current = [mkStudent({ idNumber: "G100000002" })];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: current,
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 2, direction: "top" }],
    });

    const priority = result.filter((r) => r.status === "priority");
    expect(priority).toHaveLength(1);
    expect(priority[0].idNumber).toBe("G100000002");
  });

  it("優先名單未落在 top N → 仍以 priority 狀態補入結果", () => {
    const students = [
      mkStudent({ idNumber: "H100000001", chinese: 100 }),
      mkStudent({ idNumber: "H100000002", chinese: 90 }),
      mkStudent({ idNumber: "H100000003", chinese: 30 }),
    ];
    const current = [mkStudent({ idNumber: "H100000003" })];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: current,
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 2, direction: "top" }],
    });

    const priority = result.filter((r) => r.status === "priority");
    expect(priority).toHaveLength(1);
    expect(priority[0].idNumber).toBe("H100000003");
    expect(priority[0].filterScore).toBe(30);
  });
});

describe("runFilterPure — ID 大小寫不敏感比對", () => {
  it("特殊生 ID 小寫也能正確排除對應的成績資料", () => {
    const students = [
      mkStudent({ idNumber: "A123456789", chinese: 95 }),
      mkStudent({ idNumber: "B123456789", chinese: 85 }),
    ];
    const special = [mkStudent({ idNumber: "a123456789" })];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: special,
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 2, direction: "top" }],
    });
    const normal = result.filter((r) => r.status === "normal");
    expect(normal).toHaveLength(1);
    expect(normal[0].idNumber).toBe("B123456789");
  });

  it("優先名單 ID 前後空白仍可匹配", () => {
    const students = [mkStudent({ idNumber: "X123456789", chinese: 70 })];
    const current = [mkStudent({ idNumber: "  x123456789  " })];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: current,
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 1, direction: "top" }],
    });
    expect(result.filter((r) => r.status === "priority")).toHaveLength(1);
  });
});

describe("runFilterPure — enrichScores 跨科目", () => {
  it("結果物件包含該學生在其他科目的分數", () => {
    const chinese = [mkStudent({ idNumber: "Z100000001", chinese: 90 })];
    const english = [mkStudent({ idNumber: "Z100000001", english: 80 })];
    const math = [mkStudent({ idNumber: "Z100000001", math: 75 })];
    const result = runFilterPure({
      chineseData: chinese,
      englishData: english,
      mathData: math,
      currentStudents: [],
      specialStudents: [],
      configs: [{ grade: 3, subject: "chinese", mode: "count", value: 1, direction: "top" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].chinese).toBe(90);
    expect(result[0].english).toBe(80);
    expect(result[0].math).toBe(75);
  });
});

describe("runFilterPure — 邊界案例", () => {
  it("空輸入回傳空陣列", () => {
    const result = runFilterPure({
      chineseData: [],
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [],
    });
    expect(result).toEqual([]);
  });

  it("多 config 不重複同一學生同科目的 normal 項目", () => {
    const students = [mkStudent({ idNumber: "Y100000001", chinese: 80 })];
    const result = runFilterPure({
      chineseData: students,
      englishData: [],
      mathData: [],
      currentStudents: [],
      specialStudents: [],
      configs: [
        { grade: 3, subject: "chinese", mode: "count", value: 1, direction: "top" },
        { grade: 3, subject: "chinese", mode: "count", value: 1, direction: "top" },
      ],
    });
    expect(result).toHaveLength(1);
  });
});
