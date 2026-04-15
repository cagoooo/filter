import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// P3.5：i18n 初始化 side-effect —— 在 App render 前需完成設定
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
