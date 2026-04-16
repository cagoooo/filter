/**
 * P3.1 PWA：新版本提示
 *
 * vite-plugin-pwa 在偵測到新 Service Worker 安裝後會觸發 needRefresh，
 * 此元件以 toast 形式詢問使用者是否立即重整套用更新。
 *
 * 同時若應用首次成功安裝離線快取，會以 toast 告知「已可離線使用」。
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RefreshCw, WifiOff } from "lucide-react";

// virtual:pwa-register/react 由 vite-plugin-pwa 提供（dev 環境會 polyfill）
type RegisterFn = (options: {
  immediate?: boolean;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (err: unknown) => void;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}) => (reload?: boolean) => Promise<void>;

export function PWAUpdatePrompt() {
  const { t } = useTranslation();
  const [, setSwUpdater] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        // 動態 import：dev 環境若 plugin 未啟用會丟錯，吞掉即可
        const mod = await import(/* @vite-ignore */ "virtual:pwa-register").catch(() => null);
        if (cancelled || !mod || typeof (mod as { registerSW?: RegisterFn }).registerSW !== "function") return;
        const registerSW = (mod as { registerSW: RegisterFn }).registerSW;

        const updater = registerSW({
          immediate: true,
          onNeedRefresh() {
            toast(
              <div className="flex items-start gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t("pwa.newVersion")}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t("pwa.clickToApply")}</p>
                  <button
                    onClick={() => updater(true)}
                    className="mt-2 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {t("pwa.refresh")}
                  </button>
                </div>
              </div>,
              { duration: Infinity, closeButton: true },
            );
          },
          onOfflineReady() {
            toast(
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-green-600" />
                <span className="text-sm">{t("pwa.offlineReady")}</span>
              </div>,
              { duration: 4000 },
            );
          },
          onRegisterError(err) {
            console.warn("[PWA] Service Worker 註冊失敗", err);
          },
        });

        if (!cancelled) setSwUpdater(() => updater);
        cleanup = () => {
          /* updater 沒有 unregister API，留空即可 */
        };
      } catch (err) {
        console.warn("[PWA] virtual:pwa-register 不可用（可能於 dev 環境）", err);
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
