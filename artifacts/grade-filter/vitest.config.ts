/**
 * P3.3：Vitest 單元測試設定
 *
 * 與 vite.config.ts 獨立，避免 PWA / Replit plugin 於測試環境初始化。
 * 使用 jsdom 以支援 React Testing Library；jest-dom 匹配器由
 * `src/test/setup.ts` 載入。
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
