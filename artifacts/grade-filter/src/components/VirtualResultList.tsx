/**
 * P2.5：結果表格虛擬化
 *
 * 大於 VIRTUAL_THRESHOLD（200 筆）時啟用，避免 DOM 節點數量過多導致滾動卡頓。
 * 為了讓虛擬化與既有的 table 美術風格相容，此元件改用 div + CSS Grid
 * 模擬表格；寬度透過 template-columns 統一，確保 header 與 body 對齊。
 *
 * Mobile 下直接回退為卡片式虛擬列表（重用 ResultCard 的視覺）。
 */
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FilterResult, Subject, SUBJECT_LABELS, GRADE_LABELS } from "../types";
import { ChevronDown, ChevronUp, Star, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = keyof FilterResult | "none";
type SortDir = "asc" | "desc";

interface Props {
  results: FilterResult[];
  isMobile: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
}

const DESKTOP_ROW_HEIGHT = 52;
const MOBILE_ROW_HEIGHT = 132; // card with subject grid
const CONTAINER_HEIGHT_DESKTOP = 600;
const CONTAINER_HEIGHT_MOBILE = 560;

// 欄寬參考 TABLE_COLS 設計，轉為 grid-template-columns
const DESKTOP_GRID =
  "[status] 96px [name] 1fr [grade] 80px [class] 80px [seat] 72px [id] 156px " +
  "[chinese] 72px [english] 72px [math] 72px [filterSub] 96px";

const TABLE_COLS: { key: SortKey; label: string; align?: "left" | "right" | "center" }[] = [
  { key: "status", label: "狀態" },
  { key: "name", label: "姓名" },
  { key: "grade", label: "年級" },
  { key: "class", label: "班級" },
  { key: "seatNo", label: "座號" },
  { key: "idNumber", label: "身分證字號" },
  { key: "chinese", label: "國文", align: "center" },
  { key: "english", label: "英文", align: "center" },
  { key: "math", label: "數學", align: "center" },
  { key: "filterSubject", label: "篩選科目" },
];

export function VirtualResultList({
  results,
  isMobile,
  sortKey,
  sortDir,
  onToggleSort,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowHeight = isMobile ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT;
  const containerHeight = isMobile ? CONTAINER_HEIGHT_MOBILE : CONTAINER_HEIGHT_DESKTOP;

  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp className="w-3.5 h-3.5 text-gray-300" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
      : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  return (
    <div>
      {!isMobile && (
        <div
          className="bg-gray-50/40 border-b border-gray-100 text-xs font-semibold text-gray-600"
          style={{
            display: "grid",
            gridTemplateColumns: DESKTOP_GRID,
          }}
        >
          {TABLE_COLS.map((c) => (
            <button
              key={c.key}
              className={cn(
                "px-4 py-3 flex items-center gap-1 select-none hover:bg-gray-100/60 transition-colors whitespace-nowrap",
                c.align === "center" && "justify-center",
                c.align === "right" && "justify-end"
              )}
              onClick={() => onToggleSort(c.key)}
            >
              <span>{c.label}</span>
              <SortIcon k={c.key} />
            </button>
          ))}
        </div>
      )}

      <div
        ref={parentRef}
        style={{ height: containerHeight, overflow: "auto" }}
        className="relative"
      >
        <div style={{ height: totalSize, position: "relative", width: "100%" }}>
          {items.map((vi) => {
            const r = results[vi.index];
            return (
              <div
                key={r.id}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                {isMobile ? (
                  <VirtualCard r={r} />
                ) : (
                  <VirtualRow r={r} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VirtualRow({ r }: { r: FilterResult }) {
  return (
    <div
      className={cn(
        "border-b border-gray-50 text-sm transition-colors items-center",
        r.status === "excluded" ? "bg-gray-50/80 opacity-60"
          : r.status === "priority" ? "bg-amber-50/40 hover:bg-amber-50/60"
          : "hover:bg-gray-50/50"
      )}
      style={{
        display: "grid",
        gridTemplateColumns: DESKTOP_GRID,
        minHeight: DESKTOP_ROW_HEIGHT,
      }}
    >
      <div className="px-4 py-3">
        {r.status === "priority" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />優先
          </span>
        ) : r.status === "excluded" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            <UserX className="w-3 h-3" />已排除
          </span>
        ) : (
          <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">一般</span>
        )}
      </div>
      <div className={cn("px-4 py-3 font-medium truncate", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>
        {r.name || "—"}
      </div>
      <div className="px-4 py-3 text-gray-500 text-xs truncate">
        {r.grade ? (GRADE_LABELS[r.grade] || `${r.grade}年級`) : "—"}
      </div>
      <div className="px-4 py-3 text-gray-500 text-xs truncate">{r.class || "—"}</div>
      <div className="px-4 py-3 text-gray-500 text-xs truncate">{r.seatNo || "—"}</div>
      <div className={cn("px-4 py-3 font-mono text-xs truncate", r.status === "excluded" ? "text-gray-400" : "text-gray-700")}>
        {r.idNumber}
      </div>
      <div className="px-4 py-3 text-center">
        <ScoreCell value={r.chinese} isFilter={r.filterSubject === "chinese"} isExcluded={r.status === "excluded"} />
      </div>
      <div className="px-4 py-3 text-center">
        <ScoreCell value={r.english} isFilter={r.filterSubject === "english"} isExcluded={r.status === "excluded"} />
      </div>
      <div className="px-4 py-3 text-center">
        <ScoreCell value={r.math} isFilter={r.filterSubject === "math"} isExcluded={r.status === "excluded"} />
      </div>
      <div className="px-4 py-3">
        <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
          {SUBJECT_LABELS[r.filterSubject]}
        </span>
      </div>
    </div>
  );
}

function VirtualCard({ r }: { r: FilterResult }) {
  const subjects: Subject[] = ["chinese", "english", "math"];
  const statusBadge =
    r.status === "priority" ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />優先
      </span>
    ) : r.status === "excluded" ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
        <UserX className="w-3 h-3" />已排除
      </span>
    ) : (
      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">一般</span>
    );

  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-gray-100 transition-colors",
        r.status === "excluded" ? "bg-gray-50/80 opacity-70"
          : r.status === "priority" ? "bg-amber-50/30"
          : "bg-white"
      )}
      style={{ minHeight: MOBILE_ROW_HEIGHT }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("font-semibold text-sm truncate", r.status === "excluded" ? "text-gray-400" : "text-gray-900")}>
              {r.name || "—"}
            </span>
            {statusBadge}
          </div>
          <p className="text-xs text-gray-500">
            {r.grade ? (GRADE_LABELS[r.grade] || `${r.grade}年級`) : "—"}
            {r.class && <> · {r.class}班</>}
            {r.seatNo && <> · {r.seatNo}號</>}
          </p>
          <p className="text-[11px] font-mono text-gray-400 mt-0.5 truncate">{r.idNumber}</p>
        </div>
        <span className="text-[11px] font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">
          {SUBJECT_LABELS[r.filterSubject]}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {subjects.map((sub) => {
          const v = r[sub];
          const isFilter = r.filterSubject === sub;
          return (
            <div
              key={sub}
              className={cn(
                "rounded-md px-2 py-1.5 border text-center",
                isFilter ? "bg-blue-50 border-blue-200" : "bg-gray-50/60 border-gray-100"
              )}
            >
              <p className="text-[10px] text-gray-500">{SUBJECT_LABELS[sub]}</p>
              <p className={cn(
                "text-sm font-bold",
                r.status === "excluded" ? "text-gray-400"
                  : v == null ? "text-gray-300"
                  : isFilter ? "text-blue-700"
                  : "text-gray-700"
              )}>
                {v == null ? "—" : v}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreCell({ value, isFilter, isExcluded }: { value?: number; isFilter: boolean; isExcluded: boolean }) {
  if (value === undefined || value === null) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={cn("text-sm font-semibold", isExcluded ? "text-gray-400" : isFilter ? "text-blue-700" : "text-gray-700")}>
      {value}
    </span>
  );
}
