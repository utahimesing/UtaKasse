## 摘要

v1.1.0：活動系統改版、Excel 報表、Neo-Brutalism 視覺改版。完整說明見 `docs/UtaKasse_v1.1.0_交付報告.md`。

## 主要改動

- **DB v5**：舊的合購特典自動轉成「合購折扣（贈品提醒）」，行為不變。備份還原接受 v3／v4／v5。
- **三種活動**：滿額禮、合購折扣（全購物車最佳化）、套組活動（選款、庫存合併檢查、扣內容物）。
- **Excel 報表**：單一 xlsx，含流水帳、SUMMARY、各類別分帳頁，離線可用。報表頁新增本日交易明細。
- **視覺**：Neo-Brutalism，移除所有磨砂玻璃效果。
- **清理**：移除死碼與根目錄 build 產物，修正 effect 收斂問題。

## 測試

- [x] `npm test`：44 個全部通過
- [x] `npm run lint`：0 error
- [x] `npm run build`：成功，xlsx 已進 precache
- [x] `npm audit`：0 vulnerabilities
- [x] 瀏覽器實測驗收 A–E 組（見交付報告第 2 節）

## 合併前請確認

- [ ] 用 iPhone 匯出一次 Excel，並在飛航模式下再匯出一次
- [ ] 用 Excel 或 Google 試算表打開匯出檔，確認凍結窗格與換行
- [ ] 部署前先用舊版做一次 Google Drive 備份

合併後舊資料會在第一次開啟時自動升級到 DB v5。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
