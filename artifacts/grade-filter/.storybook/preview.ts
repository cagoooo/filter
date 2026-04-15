/**
 * P3.6 Storybook 全域 preview：
 *   - 匯入全域 CSS（TailwindCSS 4 + 專案自訂 @layer base 規則）
 *   - 設定預設背景為淺灰，與生產環境 `bg-gray-50` 對齊
 *   - 提供 viewports 快捷鍵模擬行動裝置
 */
import type { Preview } from "@storybook/react-vite";
import "../src/index.css";
import "../src/i18n";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "gray-50",
      values: [
        { name: "white", value: "#ffffff" },
        { name: "gray-50", value: "#f9fafb" },
      ],
    },
    viewport: {
      viewports: {
        mobile: { name: "Mobile (iPhone SE)", styles: { width: "375px", height: "667px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" } },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
