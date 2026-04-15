/**
 * P2.6 骨架屏元件：在解析 Excel 或還原資料時取代 spinner，
 * 讓使用者預覽即將出現的結果版面，降低等待焦慮。
 *
 * 設計原則：
 * - 僅用 Tailwind 既有動畫（animate-pulse），不需額外套件
 * - 元件名稱對應使用情境：
 *   - TableSkeleton：預覽表格（UploadPreview 資料預覽 / ResultPage 列表）
 *   - UploadCardSkeleton：FileUploadCard 的解析中狀態
 *   - StatsSkeleton：ResultPage 頂部的統計方塊
 */
import { cn } from "@/lib/utils";

export function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("h-4 bg-gray-200/80 rounded animate-pulse", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
      <div className="bg-gray-50/60 border-b border-gray-100 px-4 py-3 flex gap-3">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBar key={i} className="h-3 flex-1 max-w-[80px]" />
        ))}
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3 flex items-center gap-3">
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonBar
                key={c}
                className={cn(
                  "flex-1",
                  c === 0 && "max-w-[48px]",
                  c === 1 && "max-w-[120px]",
                  c > 1 && "max-w-[80px]",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function UploadCardSkeleton({ label = "解析中..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "150ms" }} />
        <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: "300ms" }} />
        <span className="ml-2">{label}</span>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <SkeletonBar className="h-3 w-3/4 mx-auto" />
        <SkeletonBar className="h-3 w-1/2 mx-auto" />
        <SkeletonBar className="h-3 w-2/3 mx-auto" />
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <SkeletonBar className="h-3 w-2/3" />
          <div className="h-7 mt-2 bg-gray-200/80 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function AppBootSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-200/80 rounded-lg animate-pulse" />
          <div className="space-y-2">
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-3 w-48" />
          </div>
        </div>
        <StatsSkeleton />
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  );
}
