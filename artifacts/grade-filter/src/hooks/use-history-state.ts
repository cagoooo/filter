import { useState, useCallback, useRef } from "react";

/**
 * useHistoryState — a state hook with undo/redo history.
 *
 * Keeps a bounded stack of past values and a redo stack. Every `set` pushes
 * the previous value onto the past stack and clears the redo stack.
 *
 * Differences from a naive approach:
 * - Uses a `lastSetAt` timestamp to coalesce very rapid consecutive updates
 *   (e.g. typing in a number input) into a single history entry. Default
 *   debounce window is 400ms; pass `coalesceMs: 0` to disable.
 * - History cap prevents unbounded memory growth (default 50 entries).
 */
export interface HistoryStateOptions {
  /** Max past entries to keep. Default 50. */
  limit?: number;
  /** Debounce window for coalescing rapid updates into one history entry (ms). Default 400. */
  coalesceMs?: number;
}

export interface HistoryStateApi<T> {
  value: T;
  set: (next: T | ((prev: T) => T)) => void;
  /** Force a new history entry on the next `set`, even if within coalesce window. */
  commit: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (next: T) => void;
  clearHistory: () => void;
}

export function useHistoryState<T>(initial: T, options: HistoryStateOptions = {}): HistoryStateApi<T> {
  const { limit = 50, coalesceMs = 400 } = options;
  const [value, setValueState] = useState<T>(initial);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const lastSetAtRef = useRef<number>(0);
  const committedRef = useRef<boolean>(true);
  // Force UI update when past/future stacks change (canUndo/canRedo).
  const [, forceRender] = useState(0);
  const bump = useCallback(() => forceRender((n) => n + 1), []);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const nextValue = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (Object.is(nextValue, prev)) return prev;
        const now = Date.now();
        const shouldCoalesce =
          !committedRef.current &&
          coalesceMs > 0 &&
          now - lastSetAtRef.current < coalesceMs &&
          pastRef.current.length > 0;
        if (!shouldCoalesce) {
          pastRef.current.push(prev);
          if (pastRef.current.length > limit) {
            pastRef.current.splice(0, pastRef.current.length - limit);
          }
        }
        futureRef.current = [];
        lastSetAtRef.current = now;
        committedRef.current = false;
        bump();
        return nextValue;
      });
    },
    [bump, coalesceMs, limit]
  );

  const commit = useCallback(() => {
    committedRef.current = true;
  }, []);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setValueState((current) => {
      const prev = pastRef.current.pop()!;
      futureRef.current.push(current);
      committedRef.current = true;
      bump();
      return prev;
    });
  }, [bump]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setValueState((current) => {
      const next = futureRef.current.pop()!;
      pastRef.current.push(current);
      committedRef.current = true;
      bump();
      return next;
    });
  }, [bump]);

  const reset = useCallback((next: T) => {
    pastRef.current = [];
    futureRef.current = [];
    committedRef.current = true;
    setValueState(next);
    bump();
  }, [bump]);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    committedRef.current = true;
    bump();
  }, [bump]);

  return {
    value,
    set,
    commit,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    reset,
    clearHistory,
  };
}
