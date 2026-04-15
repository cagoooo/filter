/**
 * P3.6：UploadPreview 常見情境 stories
 *
 * UploadPreview 是解析後的資料預覽 + 欄位對應 + 異常提示 + Profile
 * 管理合為一體的整合元件，相依資料型別多。這些 stories 以假資料
 * 示範幾個關鍵情境：
 *
 *   - Healthy：乾淨資料、無異常
 *   - WithDuplicates：偵測到身分證重複
 *   - WithAnomalies：成績超出 0–150 範圍
 *   - LowConfidence：欄位辨識置信度低
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import UploadPreview from "./UploadPreview";
import type { ColumnMapping } from "../lib/excel";
import type { Student } from "../types";

const sampleStudents: Student[] = [
  { id: "1", studentId: "1", name: "張小明", grade: 3, class: "301", seatNo: "1", idNumber: "A123456789", chinese: 85 },
  { id: "2", studentId: "2", name: "李小華", grade: 3, class: "301", seatNo: "2", idNumber: "B234567890", chinese: 72 },
  { id: "3", studentId: "3", name: "王小美", grade: 3, class: "302", seatNo: "3", idNumber: "C345678901", chinese: 90 },
];

const sampleRawRows = [
  ["姓名", "班級", "座號", "身分證字號", "國文"],
  ["張小明", "301", "1", "A123456789", "85"],
  ["李小華", "301", "2", "B234567890", "72"],
  ["王小美", "302", "3", "C345678901", "90"],
];

const healthyMapping: ColumnMapping = {
  nameIdx: 0,
  gradeIdx: 1,
  classIdx: 1,
  seatIdx: 2,
  idIdx: 3,
  scoreIdx: 4,
  gradeFromClass: true,
  dataStartRow: 1,
  colLabels: ["姓名", "班級", "座號", "身分證字號", "國文"],
  confidence: {
    nameIdx: 0.95,
    gradeIdx: 0.8,
    classIdx: 0.95,
    seatIdx: 0.95,
    idIdx: 0.95,
    scoreIdx: 0.95,
  },
};

const meta: Meta<typeof UploadPreview> = {
  title: "Components/UploadPreview",
  component: UploadPreview,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    subject: "chinese",
    students: sampleStudents,
    rawRows: sampleRawRows,
    mapping: healthyMapping,
    duplicates: [],
    anomalies: [],
    gradeStats: [
      { grade: 3, total: 3, missing: 0, blankRate: 0 },
    ],
    onRemapped: fn(),
    onDeduplicated: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof UploadPreview>;

export const Healthy: Story = {
  name: "Healthy — 資料乾淨、高信心",
};

export const WithDuplicates: Story = {
  name: "WithDuplicates — 身分證重複",
  args: {
    duplicates: [
      {
        idNumber: "A123456789",
        name: "張小明",
        count: 2,
        rows: [2, 5],
      },
    ],
  },
};

export const WithAnomalies: Story = {
  name: "WithAnomalies — 成績異常",
  args: {
    anomalies: [
      { name: "張小明", score: -1, row: 2 },
      { name: "李小華", score: 160, row: 3 },
    ],
  },
};

export const LowConfidence: Story = {
  name: "LowConfidence — 關鍵欄位信心低",
  args: {
    mapping: {
      ...healthyMapping,
      confidence: {
        nameIdx: 0.4,
        gradeIdx: 0.95,
        classIdx: 0.95,
        seatIdx: 0.95,
        idIdx: 0.5,
        scoreIdx: 0.95,
      },
    },
  },
};

export const HighBlankRate: Story = {
  name: "HighBlankRate — 某年級缺考率高",
  args: {
    gradeStats: [
      { grade: 3, total: 30, missing: 12, blankRate: 0.4 },
      { grade: 4, total: 30, missing: 1, blankRate: 0.033 },
    ],
  },
};
