/**
 * P3.6：FileUploadCard 的四種狀態（對應 優化改良建議 §7.6 所列必畫情境）
 *
 *   - Idle：初始空白框
 *   - Loading：解析中 skeleton
 *   - Success：成功後的檔名 + 警告清單
 *   - Error：錯誤訊息與重試提示
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import FileUploadCard from "./FileUploadCard";

const meta: Meta<typeof FileUploadCard> = {
  title: "Components/FileUploadCard",
  component: FileUploadCard,
  tags: ["autodocs"],
  args: {
    title: "國文成績",
    description: "上傳 xlsx/xls/csv，系統會自動偵測欄位",
    acceptedFormats: ".xlsx, .xls, .csv",
    onFileSelect: fn() as unknown as (file: File) => Promise<void>,
    onClear: fn(),
  },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["idle", "loading", "success", "error"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileUploadCard>;

export const Idle: Story = {
  name: "Idle — 尚未上傳",
  args: { status: "idle" },
};

export const Loading: Story = {
  name: "Loading — 解析中",
  args: { status: "loading" },
};

export const Success: Story = {
  name: "Success — 上傳成功",
  args: {
    status: "success",
    fileName: "三年級國文成績.xlsx",
  },
};

export const SuccessWithWarnings: Story = {
  name: "Success — 含警告訊息",
  args: {
    status: "success",
    fileName: "三年級國文成績.xlsx",
    warnings: [
      "年級已從班級代碼自動辨識（例：203 → 2年級3班）",
      "偵測到 2 位學生身分證字號重複，請確認",
    ],
  },
};

export const Error: Story = {
  name: "Error — 解析失敗",
  args: {
    status: "error",
    errorMessage: "無法解析此檔案，請確認格式是否正確",
  },
};
