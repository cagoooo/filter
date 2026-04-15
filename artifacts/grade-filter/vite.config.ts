import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;
const port = rawPort && !isNaN(Number(rawPort)) && Number(rawPort) > 0
  ? Number(rawPort)
  : 5173;

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    /**
     * P3.1 PWA：autoUpdate 模式 — 新版上線時 Service Worker 自動於背景下載，
     * 重新整理頁面即套用。`globPatterns` 涵蓋所有 build 後資源，包含 worker
     * 與字體，使應用可完全離線運作。
     *
     * 圖示：使用既有 favicon.svg（現代瀏覽器支援 SVG manifest icons）。
     * 如要支援較舊的 iOS 安裝畫面，後續可加上 192/512 PNG。
     */
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: "成績篩選系統",
        short_name: "成績篩選",
        description: "國小期中考成績篩選輔助工具，支援離線使用",
        theme_color: "#2563EB",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        lang: "zh-Hant",
        start_url: basePath,
        scope: basePath,
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      devOptions: {
        enabled: false, // 開發時不啟用，避免快取造成除錯困擾
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
