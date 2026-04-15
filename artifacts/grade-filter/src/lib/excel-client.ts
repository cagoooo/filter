/**
 * Excel 解析 client：
 * - 小檔案（< 500KB）直接於主執行緒解析
 * - 大檔案自動使用 Web Worker，避免 UI 凍結
 * - Worker 若初始化失敗會自動 fallback 到主執行緒
 */
import {
  parseScoreFile,
  parseListFile,
  parseScoreBuffer,
  parseListBuffer,
  parseMultiSubjectFile,
  parseMultiSubjectBuffer,
  ParseResult,
  MultiSubjectParseResult,
} from "./excel";
import { Subject, Student } from "../types";

const WORKER_THRESHOLD = 500 * 1024; // 500 KB

let workerInstance: Worker | null = null;
function getWorker(): Worker | null {
  if (workerInstance) return workerInstance;
  try {
    workerInstance = new Worker(new URL("./excel.worker.ts", import.meta.url), {
      type: "module",
    });
    return workerInstance;
  } catch (err) {
    console.warn("[excel-client] Worker 初始化失敗，將使用主執行緒解析", err);
    return null;
  }
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsArrayBuffer(file);
  });
}

function sendToWorker<T>(request:
  | { kind: "score"; buffer: ArrayBuffer; subject: Subject }
  | { kind: "list"; buffer: ArrayBuffer }
  | { kind: "multi"; buffer: ArrayBuffer }
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    if (!worker) {
      reject(new Error("Worker 不可用"));
      return;
    }
    const handleMessage = (e: MessageEvent) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      if (e.data?.ok) resolve(e.data.result as T);
      else reject(new Error(e.data?.error || "解析失敗"));
    };
    const handleError = (err: ErrorEvent) => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      reject(new Error(err.message || "Worker 錯誤"));
    };
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage(request);
  });
}

export async function parseScoreFileAsync(
  file: File,
  subject: Subject
): Promise<ParseResult> {
  // 小檔直接主執行緒處理
  if (file.size < WORKER_THRESHOLD) {
    return parseScoreFile(file, subject);
  }
  // 大檔嘗試 Worker
  try {
    const buffer = await readFileAsArrayBuffer(file);
    return await sendToWorker<ParseResult>({ kind: "score", buffer, subject });
  } catch (err) {
    console.warn("[excel-client] Worker 失敗，fallback 主執行緒", err);
    // Fallback 主執行緒
    const buffer = await readFileAsArrayBuffer(file);
    return parseScoreBuffer(buffer, subject);
  }
}

export async function parseMultiSubjectFileAsync(
  file: File
): Promise<MultiSubjectParseResult> {
  if (file.size < WORKER_THRESHOLD) {
    return parseMultiSubjectFile(file);
  }
  try {
    const buffer = await readFileAsArrayBuffer(file);
    return await sendToWorker<MultiSubjectParseResult>({ kind: "multi", buffer });
  } catch (err) {
    console.warn("[excel-client] Worker 失敗，fallback 主執行緒", err);
    const buffer = await readFileAsArrayBuffer(file);
    return parseMultiSubjectBuffer(buffer);
  }
}

export async function parseListFileAsync(
  file: File
): Promise<{ students: Student[]; warnings: string[] }> {
  if (file.size < WORKER_THRESHOLD) {
    return parseListFile(file);
  }
  try {
    const buffer = await readFileAsArrayBuffer(file);
    return await sendToWorker<{ students: Student[]; warnings: string[] }>({
      kind: "list",
      buffer,
    });
  } catch (err) {
    console.warn("[excel-client] Worker 失敗，fallback 主執行緒", err);
    const buffer = await readFileAsArrayBuffer(file);
    return parseListBuffer(buffer);
  }
}
