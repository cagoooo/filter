import { useState, useEffect, useMemo } from "react";
import {
  FilterConfig,
  FilterResult,
  FilterSnapshot,
  SUBJECT_LABELS,
  GRADE_LABELS,
  Subject,
} from "../types";
import { storageGet, storageSet, STORAGE_KEYS } from "../lib/storage";
import {
  X,
  Camera,
  Trash2,
  GitCompare,
  ArrowLeftRight,
  Plus,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  currentConfigs: FilterConfig[];
  currentResults: FilterResult[];
}

type SnapshotRef =
  | { type: "current"; label: string; configs: FilterConfig[]; results: FilterResult[] }
  | { type: "saved"; snapshot: FilterSnapshot };

function getSnapshotId(s: SnapshotRef): string {
  return s.type === "current" ? "__current__" : s.snapshot.id;
}
function getSnapshotLabel(s: SnapshotRef): string {
  return s.type === "current" ? s.label : s.snapshot.label;
}
function getSnapshotResults(s: SnapshotRef): FilterResult[] {
  return s.type === "current" ? s.results : s.snapshot.results;
}
function getSnapshotConfigs(s: SnapshotRef): FilterConfig[] {
  return s.type === "current" ? s.configs : s.snapshot.configs;
}

interface DiffEntry {
  idNumber: string;
  name: string;
  grade: number;
  cls: string;
  aStatus?: "priority" | "normal" | "excluded";
  bStatus?: "priority" | "normal" | "excluded";
  aSubject?: Subject;
  bSubject?: Subject;
  aScore?: number;
  bScore?: number;
}

function normalizeId(s: string): string {
  return (s ?? "").trim().toUpperCase();
}

function buildIdMap(results: FilterResult[]): Map<string, FilterResult> {
  const map = new Map<string, FilterResult>();
  for (const r of results) {
    if (r.status === "excluded") continue;
    const key = normalizeId(r.idNumber);
    if (!key) continue;
    // Prefer priority over normal in case of dupes
    const existing = map.get(key);
    if (!existing || r.status === "priority") map.set(key, r);
  }
  return map;
}

function computeDiff(a: FilterResult[], b: FilterResult[]): {
  onlyA: DiffEntry[];
  onlyB: DiffEntry[];
  changed: DiffEntry[];
  unchanged: number;
} {
  const mapA = buildIdMap(a);
  const mapB = buildIdMap(b);
  const onlyA: DiffEntry[] = [];
  const onlyB: DiffEntry[] = [];
  const changed: DiffEntry[] = [];
  let unchanged = 0;

  for (const [id, ra] of mapA) {
    const rb = mapB.get(id);
    if (!rb) {
      onlyA.push({
        idNumber: id,
        name: ra.name,
        grade: ra.grade,
        cls: ra.class,
        aStatus: ra.status,
        aSubject: ra.filterSubject,
        aScore: ra.filterScore,
      });
    } else if (ra.status !== rb.status || ra.filterSubject !== rb.filterSubject) {
      changed.push({
        idNumber: id,
        name: ra.name,
        grade: ra.grade,
        cls: ra.class,
        aStatus: ra.status,
        bStatus: rb.status,
        aSubject: ra.filterSubject,
        bSubject: rb.filterSubject,
        aScore: ra.filterScore,
        bScore: rb.filterScore,
      });
    } else {
      unchanged++;
    }
  }
  for (const [id, rb] of mapB) {
    if (!mapA.has(id)) {
      onlyB.push({
        idNumber: id,
        name: rb.name,
        grade: rb.grade,
        cls: rb.class,
        bStatus: rb.status,
        bSubject: rb.filterSubject,
        bScore: rb.filterScore,
      });
    }
  }

  const gradeClsSort = (x: DiffEntry, y: DiffEntry) =>
    x.grade - y.grade || String(x.cls ?? "").localeCompare(String(y.cls ?? ""), "zh-TW");
  onlyA.sort(gradeClsSort);
  onlyB.sort(gradeClsSort);
  changed.sort(gradeClsSort);

  return { onlyA, onlyB, changed, unchanged };
}

const statusLabel: Record<"priority" | "normal" | "excluded", string> = {
  priority: "優先",
  normal: "一般",
  excluded: "特生",
};

export function FilterSnapshotDialog({ open, onClose, currentConfigs, currentResults }: Props) {
  const [snapshots, setSnapshots] = useState<FilterSnapshot[]>([]);
  const [mode, setMode] = useState<"list" | "save" | "compare">("list");
  const [selectedA, setSelectedA] = useState<string>("__current__");
  const [selectedB, setSelectedB] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    if (open) loadSnapshots();
  }, [open]);

  async function loadSnapshots() {
    const list = (await storageGet<FilterSnapshot[]>(STORAGE_KEYS.FILTER_SNAPSHOTS)) ?? [];
    list.sort((a, b) => b.createdAt - a.createdAt);
    setSnapshots(list);
  }

  async function saveSnapshot() {
    if (!newLabel.trim()) {
      toast.error("請輸入快照名稱");
      return;
    }
    if (currentResults.length === 0) {
      toast.error("目前沒有篩選結果可快照");
      return;
    }
    const snap: FilterSnapshot = {
      id: `snap-${Date.now()}`,
      label: newLabel.trim(),
      note: newNote.trim() || undefined,
      configs: JSON.parse(JSON.stringify(currentConfigs)),
      results: JSON.parse(JSON.stringify(currentResults)),
      createdAt: Date.now(),
    };
    const next = [snap, ...snapshots];
    await storageSet(STORAGE_KEYS.FILTER_SNAPSHOTS, next);
    setSnapshots(next);
    setNewLabel("");
    setNewNote("");
    setMode("list");
    toast.success(`已儲存快照「${snap.label}」`);
  }

  async function deleteSnapshot(id: string) {
    const s = snapshots.find((x) => x.id === id);
    if (!s) return;
    if (!confirm(`確定刪除快照「${s.label}」？`)) return;
    const next = snapshots.filter((x) => x.id !== id);
    await storageSet(STORAGE_KEYS.FILTER_SNAPSHOTS, next);
    setSnapshots(next);
    toast.success("已刪除");
  }

  const allRefs: SnapshotRef[] = useMemo(() => {
    const refs: SnapshotRef[] = [];
    if (currentResults.length > 0) {
      refs.push({
        type: "current",
        label: "目前結果",
        configs: currentConfigs,
        results: currentResults,
      });
    }
    for (const s of snapshots) refs.push({ type: "saved", snapshot: s });
    return refs;
  }, [snapshots, currentConfigs, currentResults]);

  const refA = allRefs.find((r) => getSnapshotId(r) === selectedA) ?? null;
  const refB = allRefs.find((r) => getSnapshotId(r) === selectedB) ?? null;

  const diff = useMemo(() => {
    if (!refA || !refB) return null;
    return computeDiff(getSnapshotResults(refA), getSnapshotResults(refB));
  }, [refA, refB]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-gray-900">篩選結果快照</h2>
            <span className="text-xs text-gray-500">({snapshots.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode(mode === "save" ? "list" : "save")}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
              disabled={currentResults.length === 0}
              title="儲存目前結果為快照"
            >
              <Plus className="w-3.5 h-3.5" />
              新快照
            </button>
            <button
              onClick={() => setMode(mode === "compare" ? "list" : "compare")}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
              disabled={allRefs.length < 2}
              title="比較兩個快照"
            >
              <GitCompare className="w-3.5 h-3.5" />
              比較
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors ml-1"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {mode === "save" ? (
            <div className="p-5 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-600" />
                儲存目前篩選結果
              </h3>
              <div>
                <label className="text-xs font-medium text-gray-600">快照名稱 *</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="例：初版 v1 / 上調門檻 10% / 加入轉學生"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">備註（選填）</label>
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="記錄此次篩選的調整原因..."
                  rows={2}
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <p className="font-medium">將保存：</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>{currentConfigs.length} 筆篩選條件</li>
                  <li>{currentResults.length} 筆結果（含優先 / 一般 / 特生）</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveSnapshot}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
                >
                  儲存快照
                </button>
                <button
                  onClick={() => setMode("list")}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          ) : mode === "compare" ? (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <span className="w-4 h-4 bg-blue-100 text-blue-700 rounded text-[10px] font-bold flex items-center justify-center">A</span>
                    快照 A
                  </label>
                  <select
                    value={selectedA}
                    onChange={(e) => setSelectedA(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— 請選擇 —</option>
                    {allRefs.map((r) => (
                      <option key={getSnapshotId(r)} value={getSnapshotId(r)}>
                        {getSnapshotLabel(r)}
                        {r.type === "saved" ? ` (${new Date(r.snapshot.createdAt).toLocaleDateString("zh-TW")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold flex items-center justify-center">B</span>
                    快照 B
                  </label>
                  <select
                    value={selectedB}
                    onChange={(e) => setSelectedB(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— 請選擇 —</option>
                    {allRefs.map((r) => (
                      <option key={getSnapshotId(r)} value={getSnapshotId(r)}>
                        {getSnapshotLabel(r)}
                        {r.type === "saved" ? ` (${new Date(r.snapshot.createdAt).toLocaleDateString("zh-TW")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {refA && refB && diff ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-lg py-3 px-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">{getSnapshotLabel(refA)}</p>
                      <p className="text-lg font-bold text-blue-600">
                        {getSnapshotResults(refA).filter((r) => r.status !== "excluded").length}
                      </p>
                    </div>
                    <ArrowLeftRight className="w-5 h-5 text-gray-400" />
                    <div className="text-center">
                      <p className="text-xs text-gray-500">{getSnapshotLabel(refB)}</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {getSnapshotResults(refB).filter((r) => r.status !== "excluded").length}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-rose-600 flex items-center justify-center gap-1">
                        <TrendingDown className="w-3 h-3" /> 僅 A 有
                      </p>
                      <p className="text-xl font-bold text-rose-700">{diff.onlyA.length}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-emerald-600 flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3" /> 僅 B 有
                      </p>
                      <p className="text-xl font-bold text-emerald-700">{diff.onlyB.length}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-amber-600 flex items-center justify-center gap-1">
                        <ArrowLeftRight className="w-3 h-3" /> 狀態異動
                      </p>
                      <p className="text-xl font-bold text-amber-700">{diff.changed.length}</p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                      <p className="text-[11px] text-gray-500 flex items-center justify-center gap-1">
                        <Minus className="w-3 h-3" /> 相同
                      </p>
                      <p className="text-xl font-bold text-gray-700">{diff.unchanged}</p>
                    </div>
                  </div>

                  <DiffSection
                    title="僅在 A 中"
                    color="rose"
                    entries={diff.onlyA}
                    show={(d) => (
                      <span className="text-xs text-gray-600">
                        {d.aStatus && statusLabel[d.aStatus]} · {d.aSubject && SUBJECT_LABELS[d.aSubject]} {d.aScore}
                      </span>
                    )}
                  />
                  <DiffSection
                    title="僅在 B 中"
                    color="emerald"
                    entries={diff.onlyB}
                    show={(d) => (
                      <span className="text-xs text-gray-600">
                        {d.bStatus && statusLabel[d.bStatus]} · {d.bSubject && SUBJECT_LABELS[d.bSubject]} {d.bScore}
                      </span>
                    )}
                  />
                  <DiffSection
                    title="狀態異動"
                    color="amber"
                    entries={diff.changed}
                    show={(d) => (
                      <span className="text-xs text-gray-600">
                        {d.aStatus && statusLabel[d.aStatus]} → {d.bStatus && statusLabel[d.bStatus]}
                      </span>
                    )}
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400 py-10 text-sm">
                  請選擇兩個快照以比較差異
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {snapshots.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">尚無儲存的快照</p>
                  <p className="text-xs mt-1">點擊「新快照」保存目前篩選結果以便日後比較</p>
                </div>
              ) : (
                snapshots.map((s) => (
                  <div key={s.id} className="px-5 py-4 flex items-start justify-between hover:bg-gray-50/60">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{s.label}</h3>
                        <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {s.results.filter((r) => r.status !== "excluded").length}
                        </span>
                        <span className="text-xs text-gray-400">
                          {s.configs.length} 條件
                        </span>
                      </div>
                      {s.note && <p className="text-xs text-gray-500 mt-1">{s.note}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(s.createdAt).toLocaleString("zh-TW")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.configs.slice(0, 8).map((c, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600"
                          >
                            {GRADE_LABELS[c.grade]?.replace("年級", "年") ?? c.grade}{SUBJECT_LABELS[c.subject]}
                            {c.direction === "bottom" ? "後" : "前"}{c.value}{c.mode === "percent" ? "%" : "人"}
                          </span>
                        ))}
                        {s.configs.length > 8 && (
                          <span className="text-[10px] text-gray-400 px-1">+{s.configs.length - 8}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteSnapshot(s.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0 ml-3"
                      title="刪除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffSection({
  title,
  color,
  entries,
  show,
}: {
  title: string;
  color: "rose" | "emerald" | "amber";
  entries: DiffEntry[];
  show: (d: DiffEntry) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(entries.length > 0 && entries.length <= 20);
  if (entries.length === 0) return null;

  const colorMap = {
    rose: { header: "bg-rose-50 text-rose-800 border-rose-200" },
    emerald: { header: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    amber: { header: "bg-amber-50 text-amber-800 border-amber-200" },
  } as const;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full px-3 py-2 text-sm font-medium flex items-center justify-between ${colorMap[color].header}`}
      >
        <span>{title}（{entries.length}）</span>
        <span className="text-xs">{expanded ? "收合" : "展開"}</span>
      </button>
      {expanded && (
        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 bg-white">
          {entries.map((d) => (
            <li
              key={`${d.idNumber}-${d.name}`}
              className="px-3 py-2 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-gray-900 truncate">{d.name}</span>
                <span className="text-gray-400 text-[11px] flex-shrink-0">
                  {GRADE_LABELS[d.grade]?.replace("年級", "年") ?? d.grade}
                  {d.cls ? `${d.cls}班` : ""}
                </span>
              </div>
              {show(d)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
