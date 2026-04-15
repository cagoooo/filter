/**
 * P3.7：Web Vitals 效能監控
 *
 * 量測五項 Core Web Vitals（web-vitals v5+ API）：
 *   - CLS：Cumulative Layout Shift
 *   - LCP：Largest Contentful Paint
 *   - INP：Interaction to Next Paint（取代已過時的 FID）
 *   - FCP：First Contentful Paint
 *   - TTFB：Time to First Byte
 *
 * 啟用條件：
 *   - 生產環境：預設啟用
 *   - 開發環境：需在 URL 加 `?vitals=1` 才啟用（避免 dev 雜訊）
 *
 * 資料流：
 *   1. `reportWebVitals(customReporter?)` 在 main.tsx 被呼叫
 *   2. 預設以 `console.info` 列印評級（good / needs-improvement / poor）
 *   3. 可傳入自訂 reporter（例：發 beacon 到 /api/metrics、Sentry、GA4）
 *
 * 注意：web-vitals 會在頁面 hidden / unload 時批次上報，
 * 請勿在 reporter 內做阻塞式 fetch，務必用 navigator.sendBeacon 或
 * fetch keepalive。
 */
import type { Metric } from "web-vitals";

export type WebVitalReporter = (metric: Metric) => void;

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.PROD) return true;
  try {
    return new URLSearchParams(window.location.search).get("vitals") === "1";
  } catch {
    return false;
  }
}

const defaultReporter: WebVitalReporter = (metric) => {
  const color =
    metric.rating === "good"
      ? "color:#16a34a"
      : metric.rating === "needs-improvement"
        ? "color:#ca8a04"
        : "color:#dc2626";
  // eslint-disable-next-line no-console
  console.info(
    `%c[WebVitals] ${metric.name}=${metric.value.toFixed(2)} (${metric.rating})`,
    color,
    metric,
  );
};

/**
 * 註冊量測。多次呼叫安全（web-vitals 內部會去重聆聽器）。
 *
 * @param reporter 若未提供，使用內建 console 格式化報告。
 */
export async function reportWebVitals(reporter: WebVitalReporter = defaultReporter) {
  if (!isEnabled()) return;
  // 動態 import 以免納入初始 bundle（web-vitals gzip 約 2KB，仍延後載入以
  // 不阻擋主要資源）。
  try {
    const mod = await import("web-vitals");
    mod.onCLS(reporter);
    mod.onLCP(reporter);
    mod.onINP(reporter);
    mod.onFCP(reporter);
    mod.onTTFB(reporter);
  } catch (err) {
    // web-vitals 理論上不會 fail，但若 CDN / 網路異常仍需 graceful degrade
    // eslint-disable-next-line no-console
    console.warn("[WebVitals] 載入失敗", err);
  }
}

/**
 * 以 sendBeacon 發送到自訂端點（範例；未啟用）。
 * 未來如要接 /api/metrics 或第三方分析，可把這個或類似函式傳給
 * reportWebVitals()。
 */
export function beaconReporter(endpoint: string): WebVitalReporter {
  return (metric) => {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        delta: metric.delta,
        navigationType: metric.navigationType,
        timestamp: Date.now(),
        url: window.location.pathname,
      });
      navigator.sendBeacon(endpoint, body);
    } catch {
      /* beacon 失敗不影響 UX，吞掉即可 */
    }
  };
}
