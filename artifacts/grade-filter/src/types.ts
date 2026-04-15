export interface Student {
  id: string;
  studentId: string;
  name: string;
  grade: number;
  class: string;
  seatNo: string;
  idNumber: string;
  chinese?: number;
  english?: number;
  math?: number;
}

export type Subject = "chinese" | "english" | "math";

export const SUBJECT_LABELS: Record<Subject, string> = {
  chinese: "國文",
  english: "英文",
  math: "數學",
};

export const GRADE_LABELS: Record<number, string> = {
  1: "一年級",
  2: "二年級",
  3: "三年級",
  4: "四年級",
  5: "五年級",
  6: "六年級",
};

export type FilterMode = "percent" | "count";
export type FilterDirection = "top" | "bottom";

export interface FilterConfig {
  grade: number;
  subject: Subject;
  mode: FilterMode;
  value: number;
  direction?: FilterDirection; // "top" = 高分前幾（預設）, "bottom" = 低分後幾（學習扶助）
}

export interface FilterResult extends Student {
  status: "priority" | "normal" | "excluded";
  filterSubject: Subject;
  filterScore: number;
}

export interface FilterTemplate {
  id: string;
  name: string;
  description?: string;
  configs: FilterConfig[];
  createdAt: number;
  lastUsedAt?: number;
}

export interface FilterSnapshot {
  id: string;
  label: string;
  note?: string;
  configs: FilterConfig[];
  results: FilterResult[];
  createdAt: number;
}

/**
 * Excel 欄位對應 Profile —— 可將一次成功的欄位辨識結果命名保存，
 * 下次匯入同樣格式的檔案時一鍵套用，免除重複調整欄位的工作。
 */
export interface ExcelProfile {
  id: string;
  name: string;
  /** 欄位索引對應（-1 表示未選）*/
  mapping: {
    nameIdx: number;
    gradeIdx: number;
    classIdx: number;
    seatIdx: number;
    idIdx: number;
    scoreIdx: number;
    gradeFromClass: boolean;
    dataStartRow: number;
  };
  /** 建立時的表頭字串，幫助使用者辨識 profile 適用格式 */
  headerSignature: string[];
  createdAt: number;
  lastUsedAt?: number;
}
