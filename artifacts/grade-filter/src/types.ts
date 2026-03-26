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

export interface FilterConfig {
  grade: number;
  subject: Subject;
  mode: FilterMode;
  value: number;
}

export interface FilterResult extends Student {
  status: "priority" | "normal" | "excluded";
  filterSubject: Subject;
  filterScore: number;
}
