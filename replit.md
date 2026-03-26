# Workspace

## 使用者偏好

- **溝通語言**：請全程使用**繁體中文**與使用者溝通，包含所有說明、回覆與提問。

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/grade-filter` (`@workspace/grade-filter`)

成績篩選系統 — React + Vite 純前端應用，所有資料處理在瀏覽器完成（無後端）。

#### 已完成功能（截至 2026-03-26）

**匯入與解析**
- **三步驟流程**：/ (匯入資料) → /filter (設定篩選) → /result (查看結果)，使用 wouter URL 路由
- **分科匯入**：國文、英文、數學各自上傳 Excel/CSV，支援拖曳
- **多標籤頁支援**：一個 Excel 檔含多個 sheet（如「國文」「數學」），自動依科目選取對應標籤頁
- **智慧欄位辨識**：
  - 自動判斷是否有標題列
  - 無標題時依內容型態辨識（班級代碼、台灣身分證格式、成績、座號、中文姓名）
  - 班級代碼（如 203）自動拆解為年級=2、班級=3
  - 成績欄支援「國文」「英文」「數學」「分數」「成績」等多種名稱
  - 身分證字號欄無標題時依資料內容自動偵測
  - 忽略空欄間隔右側的附屬表格（如欄 J/K 的輔助對照表）
- **上傳預覽確認**：上傳後即時顯示「欄位辨識結果與資料預覽」（前3筆），含各欄偵測狀態徽章
- **手動欄位調整**：辨識不正確時，可展開下拉選單手動指定各欄對應，按「重新套用」即時更新

**在校生與特生**
- **在校生**（當然優先）：上傳名單後篩選結果自動加入並標示「優先」⭐
- **特生排除**：依身分證字號比對，結果中以灰色「已排除」顯示（可切換顯示/隱藏）

**篩選設定**
- **單筆條件**：每個年級×科目可設定「百分比」或「固定人數」，多條件並存
- **批次新增**：可折疊的批次面板，一次對多個年級套用同一條件；支援「新增（跳過已有）」或「覆蓋」兩種模式
- **篩選邏輯**：排除特生 → 成績降序排列 → 截取人數 → 加回優先在校生

**結果檢視**
- **統計摘要**：各年級人數長條圖、各科目人數長條圖
- **列表模式**：三科成績並列（篩選科目藍色強調），支援搜尋、年級/科目篩選、欄位排序
- **分班模式**：依年級+班級分組顯示，每班可獨立收起/展開，顯示班級人數摘要徽章
- **匯出**：Excel (.xlsx) 與 CSV，含身分證字號、三科成績、狀態欄

#### 核心元件
| 檔案 | 說明 |
|------|------|
| `src/lib/excel.ts` | Excel 解析、ColumnMapping、remapStudents、匯出 |
| `src/components/UploadPreview.tsx` | 欄位辨識預覽 + 手動調整面板 |
| `src/components/FileUploadCard.tsx` | 上傳區拖曳/點擊卡片 |
| `src/context/AppContext.tsx` | 全域狀態（成績資料、篩選設定、篩選結果） |
| `src/pages/ImportPage.tsx` | 第一步：匯入各科成績 + 輔助名單 |
| `src/pages/FilterPage.tsx` | 第二步：設定篩選條件（含批次新增） |
| `src/pages/ResultPage.tsx` | 第三步：結果列表 / 分班顯示 / 匯出 |

#### 技術細節
- **路由**：wouter（`/`、`/filter`、`/result`）
- **狀態管理**：React Context (AppContext)
- **Excel 讀寫**：SheetJS (xlsx)
- **樣式**：Tailwind CSS + 自訂藍色教育主題

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
