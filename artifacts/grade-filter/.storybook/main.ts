/**
 * P3.6 Storybook 主設定（Storybook 10 + Vite）
 *
 * 不自動化 storybook init（會覆蓋既有設定），改手動撰寫最小配置：
 *   - stories glob 對應 src 內所有 *.stories.{ts,tsx,mdx}
 *   - 僅啟用 addon-docs 以降低依賴與啟動時間；未來可補 a11y / viewport
 *   - framework 指向 @storybook/react-vite 以重用專案既有 vite.config.ts
 */
import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";
import { mergeConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  async viteFinal(viteConfig) {
    // Storybook 會自動套用專案的 vite.config.ts，但 VitePWA 在 story bundle
    // 中會報「manager 超過 2MB」錯誤；Replit plugins 也不需要。這裡把它們
    // 全部過濾掉，再補上 TailwindCSS 4 plugin 與 `@/` alias。
    // plugins may be nested arrays (e.g. VitePWA returns multiple sub-plugins)
    // — flatten first, then filter.
    const flat = (viteConfig.plugins ?? []).flat(Infinity);
    const unwantedPlugins = ["vite-plugin-pwa", "runtime-error-overlay"];
    const filtered = flat.filter((p) => {
      if (!p || typeof p !== "object") return true;
      const name = "name" in p && typeof p.name === "string" ? p.name : "";
      return !unwantedPlugins.some((u) => name.includes(u));
    });

    return mergeConfig(
      { ...viteConfig, plugins: filtered },
      {
        plugins: [tailwindcss()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "../src"),
          },
        },
      },
    );
  },
};

export default config;
