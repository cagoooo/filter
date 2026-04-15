/// <reference lib="webworker" />
import { parseScoreBuffer, parseListBuffer, parseMultiSubjectBuffer } from "./excel";
import type { Subject } from "../types";

type WorkerRequest =
  | { kind: "score"; buffer: ArrayBuffer; subject: Subject }
  | { kind: "list"; buffer: ArrayBuffer }
  | { kind: "multi"; buffer: ArrayBuffer };

type WorkerResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.kind === "score") {
      const result = parseScoreBuffer(msg.buffer, msg.subject);
      (self as unknown as Worker).postMessage({ ok: true, result } as WorkerResponse);
    } else if (msg.kind === "list") {
      const result = parseListBuffer(msg.buffer);
      (self as unknown as Worker).postMessage({ ok: true, result } as WorkerResponse);
    } else if (msg.kind === "multi") {
      const result = parseMultiSubjectBuffer(msg.buffer);
      (self as unknown as Worker).postMessage({ ok: true, result } as WorkerResponse);
    } else {
      (self as unknown as Worker).postMessage({ ok: false, error: "未知的請求類型" } as WorkerResponse);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "解析失敗";
    (self as unknown as Worker).postMessage({ ok: false, error } as WorkerResponse);
  }
};
