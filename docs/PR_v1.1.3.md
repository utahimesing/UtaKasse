## 摘要

v1.1.3：套件更新（13 個，全部在原本的版本範圍內，小版本／修補版本）。功能沒有改變。

## 更新內容

| 套件 | 舊版 | 新版 | 用途 |
|---|---|---|---|
| react／react-dom | 19.2.5 | 19.3.0 | 畫面核心 |
| dexie | 4.4.2 | 4.4.6 | 資料庫（IndexedDB） |
| lucide-react | 1.14.0 | 1.51.0 | 圖示 |
| papaparse | 5.5.3 | 5.7.0 | CSV 匯入 |
| vite | 8.3.1 | 8.3.2 | 打包（開發用） |
| vitest | 5.0.1 | 5.0.3 | 測試（開發用） |
| eslint | 10.2.1 | 10.12.0 | 程式檢查（開發用） |
| @vitejs/plugin-react | 6.0.1 | 6.1.1 | 開發用 |
| eslint-plugin-react-refresh | 0.5.2 | 0.5.7 | 開發用 |
| globals | 17.5.0 | 17.13.0 | 開發用 |
| @types/react／@types/react-dom | 19.2.x | 19.3.0 | 開發用 |

SheetJS（xlsx）沒有變動。

### 其他
- `vite.config.js`：React 19.3 讓主程式從 497KB 變成 529KB，超過 Vite 預設 500KB 警告線。這是離線 PWA，所有檔案第一次開啟就整包快取，拆檔不會減少下載量，所以把警告門檻調到 600KB。

### 關於 dependabot PR #3、#5、#7–#11
這 7 個 PR 的目標版本都比 main 上的舊，而且全部會跟 main 衝突，請直接關閉，不要合併。

## 測試
- [x] `npm test`：79 個全部通過
- [x] `npm run lint`：0 error、0 warning
- [x] `npm run build`：成功，沒有警告
- [x] `npm audit`：0 vulnerabilities
- [x] 用到的 8 個圖示在新版都還在
- [x] 瀏覽器實測：Dexie 4.4.6 正常打開舊資料（DB v5、7 筆交易、2 筆預購）；四個分頁 0 錯誤、閒置 0 次重繪；現金結帳（庫存 18→17）、作廢（庫存加回 18、報表現金 800→700）；CSV 解析（BOM、CRLF、引號內逗號、末五碼開頭 0）

## 合併後請確認
- [ ] 部署後用手機結一筆、看報表、試一次 Excel 匯出

🤖 Generated with [Claude Code](https://claude.com/claude-code)
