/**
 * P3.6：StepIndicator 的 Storybook 故事
 *
 * 示範三個步驟（匯入 → 篩選 → 結果）於四種進度下的外觀。
 * 同時作為其他元件 story 的範本：
 *   - argTypes 宣告可互動的 props
 *   - 每個 Story 為一種語意化狀態，命名用場景而非 prop 值
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import StepIndicator from "./StepIndicator";

const meta: Meta<typeof StepIndicator> = {
  title: "Components/StepIndicator",
  component: StepIndicator,
  tags: ["autodocs"],
  args: {
    steps: [
      { label: "匯入資料" },
      { label: "設定篩選" },
      { label: "查看結果" },
    ],
  },
  argTypes: {
    currentStep: {
      control: { type: "range", min: 0, max: 2, step: 1 },
      description: "目前位置，0 起算",
    },
  },
};

export default meta;
type Story = StoryObj<typeof StepIndicator>;

export const Step1: Story = {
  name: "第 1 步（匯入中）",
  args: { currentStep: 0 },
};

export const Step2: Story = {
  name: "第 2 步（設定篩選）",
  args: { currentStep: 1 },
};

export const Step3: Story = {
  name: "第 3 步（查看結果）",
  args: { currentStep: 2 },
};

export const FiveSteps: Story = {
  name: "自訂五步驟",
  args: {
    currentStep: 2,
    steps: [
      { label: "註冊" },
      { label: "登入" },
      { label: "設定" },
      { label: "上傳" },
      { label: "完成" },
    ],
  },
};
