import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// P3.5：i18n 初始化 side-effect —— 在 App render 前需完成設定
import "./i18n";
import { reportWebVitals } from "./lib/web-vitals";

createRoot(document.getElementById("root")!).render(<App />);

// P3.7：效能監控（生產環境自動啟用；開發環境以 ?vitals=1 強制啟用）
// 在 render 之後才呼叫，避免影響 First Contentful Paint。
void reportWebVitals();
