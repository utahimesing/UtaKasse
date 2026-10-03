## 摘要

合併 v1.1.1 與 v1.1.2（v1.1.2 疊在 v1.1.1 上，這支 PR 兩個一起帶進 main）。
完整說明：`docs/UtaKasse_v1.1.1_交付報告.md`、`docs/UtaKasse_v1.1.2_交付報告.md`

## v1.1.1：交易作廢
- 報表頁本日交易明細可作廢（兩段確認、原因選填），紀錄保留並標記已作廢
- 作廢時加回庫存（含套組內容物）；預購取件作廢後改回未取件
- 營收、SUMMARY、CSV 不計入作廢；Excel 流水帳保留「作廢」列（數量金額 0）

## v1.1.2：結帳防呆、收攤對帳、清理死碼、資安加強
- **結帳**：每筆結完回到預設收款方式；電子支付改成確認收款（不顯示數字鍵與負數找零）；現金快捷鍵（剛好＋往上湊整）；贈品提醒放大並在結帳後保留；成功訊息顯示找零。預購取件同步套用
- **報表**：新增「收攤對帳」（收款方式拆分、零用金、錢箱應有）與「商品出貨」（出貨數＋剩餘庫存）
- **修正**：預購頁第一次打開清單為空；預購取件只顯示前 3 個收款方式、加購只顯示前 12 個商品；動作後跳問句的 Toast；午夜計時器 24:00
- **死碼**：刪除 2 個死函式、16 個沒用到的文字、1 張沒用到的截圖；7 處寫死文字改用 key；沒有死循環（四個分頁閒置 0 次重繪）
- **資安**：
  - 全部 git 歷史掃描，沒有任何 API key／token／私鑰外洩
  - 修正舊格式 CSV 匯出的公式注入（`=HYPERLINK(...)` 等開頭加 `'`）；Excel 匯出加測試確認不產生公式
  - 新增 `public/_headers`：CSP（只允許 Google 登入／Drive／字型）、禁止被嵌入、nosniff、Referrer-Policy、Permissions-Policy

## 相容性
- DB／備份仍為 v5，不需升級
- 新增選填欄位：交易 `voided`／`voidedAt`／`voidReason`、場次 `cashFloats`

## 測試
- [x] `npm test`：79 個全部通過
- [x] `npm run lint`：0 error、0 warning
- [x] `npm run build`：成功
- [x] `npm audit`：0 vulnerabilities
- [x] 瀏覽器實測（375px 手機寬度）：作廢、現金／LINE Pay 結帳、贈品提醒、收攤對帳數字、零用金儲存、預購取件
- [x] CSP 實測（本機套用同一份標頭）：App、Google 登入程式、字型、離線快取、Excel 匯出正常；不明網站與 iframe 被擋

## 合併後請確認
- [ ] 部署到 Netlify 後，用手機打開確認畫面正常（新的安全標頭只在 Netlify 上生效）
- [ ] 試一次 Google 雲端備份，確認登入彈窗正常
- [ ] 結一筆、作廢一筆，看報表數字和庫存
- [ ] 結一筆現金、一筆 LINE Pay，確認下一筆自動回到現金
- [ ] 報表頁輸入零用金，確認「錢箱應有」
- [ ] Google Cloud Console：OAuth「已授權的 JavaScript 來源」只留 Netlify 網址和 localhost

🤖 Generated with [Claude Code](https://claude.com/claude-code)
