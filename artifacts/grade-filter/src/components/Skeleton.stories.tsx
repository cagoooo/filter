/**
 * P3.6：骨架屏元件 stories
 *
 * 以單一檔案呈現 Skeleton.tsx 匯出的四種元件，便於一次瀏覽所有 loading
 * 版面，並協助設計師驗證 animate-pulse 節奏。
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  SkeletonBar,
  TableSkeleton,
  UploadCardSkeleton,
  StatsSkeleton,
  AppBootSkeleton,
} from "./Skeleton";

const meta: Meta = {
  title: "Components/Skeleton",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Bar: Story = {
  name: "SkeletonBar — 單行占位",
  render: () => (
    <div className="space-y-2 max-w-md">
      <SkeletonBar />
      <SkeletonBar className="w-3/4" />
      <SkeletonBar className="w-1/2" />
    </div>
  ),
};

export const Table: Story = {
  name: "TableSkeleton — 表格占位",
  render: () => (
    <div className="max-w-3xl">
      <TableSkeleton rows={6} cols={5} />
    </div>
  ),
};

export const UploadCard: Story = {
  name: "UploadCardSkeleton — 解析中的上傳卡",
  render: () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm">
      <UploadCardSkeleton label="解析中..." />
    </div>
  ),
};

export const Stats: Story = {
  name: "StatsSkeleton — 統計區塊占位",
  render: () => (
    <div className="max-w-3xl">
      <StatsSkeleton />
    </div>
  ),
};

export const AppBoot: Story = {
  name: "AppBootSkeleton — 首次載入整頁骨架",
  parameters: {
    layout: "fullscreen",
  },
  render: () => <AppBootSkeleton />,
};
