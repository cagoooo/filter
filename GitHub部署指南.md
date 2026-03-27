# GitHub 部署指南

> 本指南說明如何將「成績篩選系統」完整移植並部署至 GitHub Pages。

---

## 目錄

1. [部署可行性評估](#1-部署可行性評估)
2. [方案一：GitHub Pages（靜態部署）](#2-方案一github-pages靜態部署)
3. [方案二：Vercel / Netlify（推薦）](#3-方案二vercel--netlify推薦)
4. [設定 GitHub Actions 自動部署](#4-設定-github-actions-自動部署)
5. [部署前必要修改](#5-部署前必要修改)
6. [驗證部署成果](#6-驗證部署成果)

---

## 1. 部署可行性評估

### ✅ 完全可行

本系統是**純前端 SPA（單頁應用）**，所有功能皆在瀏覽器本地執行：
- 無後端 API 依賴（Express api-server 目前未被使用）
- 無資料庫連線需求（使用瀏覽器 IndexedDB）
- 無環境變數或 secrets 需求
- 建置產出為純靜態 HTML + CSS + JS 檔案

### 部署方案比較

| 方案 | 優點 | 缺點 | 推薦度 |
|------|------|------|-------|
| GitHub Pages | 免費、直接整合 GitHub | 需設定 base path | ⭐⭐⭐ |
| Vercel | 自動部署、最簡單 | 需第三方帳號 | ⭐⭐⭐⭐⭐ |
| Netlify | 自動部署、功能豐富 | 需第三方帳號 | ⭐⭐⭐⭐ |
| GitHub Pages + Actions | 完全在 GitHub 內 | 設定稍複雜 | ⭐⭐⭐⭐ |

---

## 2. 方案一：GitHub Pages（靜態部署）

### 步驟 1：在 GitHub 建立儲存庫

```bash
# 在 GitHub 上建立新的 public repository
# 例如：your-username/grade-filter
```

### 步驟 2：修改 Vite base path 設定

GitHub Pages 的 URL 格式為 `https://your-username.github.io/grade-filter/`，需要設定 base path。

編輯 `artifacts/grade-filter/vite.config.ts`：

```typescript
export default defineConfig({
  base: process.env.BASE_PATH ?? '/grade-filter/',  // ← 改為你的 repo 名稱
  plugins: [
    react(),
    tailwindcss(),
  ],
  // ... 其餘設定不變
})
```

### 步驟 3：建置靜態檔案

```bash
cd artifacts/grade-filter
pnpm run build
# 建置結果在 dist/public/
```

### 步驟 4：推送至 GitHub

```bash
# 初始化 git（若尚未初始化）
git init
git remote add origin https://github.com/your-username/grade-filter.git

# 推送主分支
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 步驟 5：啟用 GitHub Pages

1. 進入 GitHub repository → **Settings** → **Pages**
2. Source 選擇：**GitHub Actions**
3. 設定完 Actions workflow 後即可自動部署（見第 4 節）

---

## 3. 方案二：Vercel / Netlify（推薦）

### Vercel 部署（最簡單）

1. 前往 [vercel.com](https://vercel.com) 並以 GitHub 帳號登入
2. 點擊「**New Project**」→ 選擇你的 GitHub repo
3. 設定以下參數：

   | 設定項目 | 值 |
   |---------|-----|
   | Framework Preset | Vite |
   | Root Directory | `artifacts/grade-filter` |
   | Build Command | `pnpm run build` |
   | Output Directory | `dist/public` |
   | Install Command | `pnpm install` |

4. 點擊「**Deploy**」，幾分鐘後完成！

> Vercel 不需要設定 `base` path，直接使用根路徑。

### Netlify 部署

1. 前往 [netlify.com](https://netlify.com) 登入
2. 「**New site from Git**」→ 選擇 GitHub repo
3. 設定：
   - Base directory: `artifacts/grade-filter`
   - Build command: `pnpm run build`
   - Publish directory: `artifacts/grade-filter/dist/public`
4. 點擊「**Deploy site**」

> 需在 Netlify 建立 `artifacts/grade-filter/public/_redirects` 檔案（SPA 路由用）：
> ```
> /*    /index.html   200
> ```

---

## 4. 設定 GitHub Actions 自動部署

在專案根目錄建立以下 workflow 檔案：

**檔案路徑**：`.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: '9'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build grade-filter
        run: pnpm run build
        working-directory: artifacts/grade-filter
        env:
          BASE_PATH: '/grade-filter/'   # 改為你的 repo 名稱

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'artifacts/grade-filter/dist/public'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### SPA 路由問題修復

GitHub Pages 不支援 SPA 路由的 404 fallback，需加入以下設定：

在 `artifacts/grade-filter/public/` 目錄新增 `404.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // GitHub Pages SPA redirect hack
    var pathSegmentsToKeep = 1;
    var l = window.location;
    l.replace(
      l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
      l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
      l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
      (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
      l.hash
    );
  </script>
</head>
<body></body>
</html>
```

同時在 `artifacts/grade-filter/index.html` 的 `<head>` 加入：

```html
<script>
  // GitHub Pages SPA redirect handler
  (function(l) {
    if (l.search[1] === '/') {
      var decoded = l.search.slice(1).split('&').map(function(s) {
        return s.replace(/~and~/g, '&')
      }).join('?');
      window.history.replaceState(null, null,
        l.pathname.slice(0, -1) + decoded + l.hash
      );
    }
  }(window.location))
</script>
```

---

## 5. 部署前必要修改

### 5.1 確認 vite.config.ts 的 base 設定

```typescript
// artifacts/grade-filter/vite.config.ts
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // ...
})
```

- GitHub Pages：設定為 `'/你的repo名稱/'`
- Vercel/Netlify：維持 `'/'`（預設值）

### 5.2 建立 .gitignore

確認根目錄的 `.gitignore` 包含：

```gitignore
node_modules/
dist/
.env
.env.local
*.local
```

### 5.3 確認 package.json 的 build script

```json
// artifacts/grade-filter/package.json
{
  "scripts": {
    "build": "tsc -b && vite build"
  }
}
```

---

## 6. 驗證部署成果

部署完成後，開啟瀏覽器前往部署 URL，依序測試：

- [ ] 頁面正常載入，顯示步驟一（匯入）
- [ ] 可上傳 Excel 檔案並看到預覽
- [ ] 步驟指示器可正常切換
- [ ] 瀏覽器重新整理後資料仍然保留（IndexedDB）
- [ ] 執行篩選並查看結果
- [ ] Excel 和 CSV 匯出功能正常

---

## 部署架構圖

```
GitHub Repository (main branch)
        │
        │ git push
        ▼
GitHub Actions Workflow
        │
        ├── pnpm install
        ├── pnpm run build
        │       │
        │       └── artifacts/grade-filter/dist/public/
        │               ├── index.html
        │               ├── assets/
        │               │   ├── index-[hash].js
        │               │   └── index-[hash].css
        │               └── 404.html
        │
        └── Deploy to GitHub Pages
                │
                ▼
        https://your-username.github.io/grade-filter/
```

---

*部署完成後，只需推送到 main 分支，GitHub Actions 即自動重新部署最新版本。*
