# UtaKasse v2.0 實作計畫（待確認）

> 對應規格：`docs/specs/UtaKasse_需求單_v2.0.md`
> 撰寫日期：2026-09-24 ｜ 狀態：**等你回覆 OK 才動工**

---

## 0. 先讀 repo 後發現、會影響計畫的事

| # | 現況 | 對計畫的影響 |
|---|---|---|
| 1 | `src/db.js` 工作區（尚未 commit）已經是 `db.version(4)`：加了 `products.sortOrder` 索引，備份 `version: 4`，`validateBackupPayload` 只收 4。commit 過的 v1.0.0 是 `version(3)`、備份 3。 | 規格寫的「DB v3 → v4」實際上要做成 **v4 → v5**。備份還原同時接受 **3／4／5**；3 和 4 的 bonusRules 都套同一套轉換。 |
| 2 | `index.html` 被 build 產物覆蓋（指到 `/assets/index-*.js`，少了 `/src/main.jsx`），`npm run dev` 會是空白頁。根目錄還有 `sw.js`、`workbox-*.js`、`assets/`、`manifest.webmanifest`、`utakasse-netlify-deploy.zip`。 | `index.html` 我已在視覺改版時修回開發版。其餘 dist 產物在 **P6** 移除並加進 `.gitignore`（它們也讓 `npm run lint` 噴 290 個 error）。 |
| 3 | 有兩個 strings 檔：`src/i18n/strings.js`（`t()`，主要 UI 文案）和 `src/lib/strings.js`（`getString()`，文案審核表 ID）。 | 新文字一律放 `src/i18n/strings.js`；`lib/strings.js` 只改「特典→活動」。 |
| 4 | `Sales.jsx`、`Preorders.jsx` 現金不足時 `toast.show(getString('A3'))`，A3 是「匯入完成…」，key 用錯。 | P2 一併改成 S11／A5。 |
| 5 | 交易的 `time` 是 `HH:mm:ss` 字串，`createdAt` 是 epoch ms。 | Excel 日期時間欄用 `createdAt` 轉台北時間；舊交易兩者都有，不用補資料。 |
| 6 | 預購取件 B 的加購也會寫一筆 `type: 'sale'` 交易（`pickupB`）。 | 合購折扣要套進加購那一筆，`grossAmount`／`discounts` 也寫在那筆。 |
| 7 | `ensureSeedData` 在 React StrictMode 下會跑兩次，console 出現無害的 `BulkError`；`npx eslint src` 有 9 個既有 error（`set-state-in-effect` 等）。 | P6 清理。 |
| 8 | 工作區已刪除 `Card.jsx`、`CategoryPill.jsx`、`Input.jsx`（沒人 import）。 | 視為已清理，P6 清理報告會列出。 |

---

## 1. 新增套件

| 套件 | 安裝方式 | 用途 |
|---|---|---|
| `xlsx`（SheetJS CE 0.20.3） | `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | Excel 匯出。用 `await import('xlsx')` 動態載入；`vite.config.js` 的 workbox 加 `maximumFileSizeToCacheInBytes: 4 * 1024 * 1024`，確保離線也能匯出。 |
| `vitest`（devDependency） | `npm i -D vitest` | 單元測試；`package.json` 加 `"test": "vitest run"`。 |

---

## 2. 資料結構（只新增欄位，不改既有欄位名）

### products
```js
{ ...既有, type: 'single' | 'bundle',          // 沒有就當 'single'
  bundleSlots: [{ id, label, pickQty, poolProductIds: [], allowDuplicate: true }] }
```

### bonusRules（一張表管三種活動）
```js
// amount（滿額禮）：沿用 { categoryId, triggerAmount, bonusText }
// combo（合購折扣）：
{ triggerType: 'combo', slots: [{ id, label, qty, poolProductIds: [] }],
  rewardType: 'price' | 'gift', comboPrice, bonusText }
// bundle（套組活動）：
{ triggerType: 'bundle', productId }                 // 對應 products 裡 type:'bundle' 那筆
```
舊的 `triggerType: 'product'` 規則由 `migrateBonusRuleV3toV4()` 轉成
`{ triggerType:'combo', rewardType:'gift', slots:[{ poolProductIds: triggerProductIds, qty: triggerProductQty }] }`，原欄位保留不刪（相容）。

### transactions（既有欄位不動）
```js
{ ...既有,
  grossAmount,                                        // 折扣前；舊交易沒有 → 當 subtotal
  discounts: [{ ruleId, ruleName, times, amount }],   // 舊交易沒有 → []
  discountApproximate: false,
  items: [{ lineId, productId, productName, qty, unitPrice,
            kind: 'bundle', components: [{ productId, productName, qty }] }] }  // 一般商品沒有 kind/components
```

### 購物車（只在記憶體，不進 DB）
```js
{ lineId, productId, name, unitPrice, qty, color, categoryIds, stock,
  kind?: 'bundle', components?: [{ productId, productName, qty }] }
```
`lineId`：一般商品 = `productId`；套組 = `productId + ':' + 選款 productId 排序後 join`，同款合併、不同款另開一行。

---

## 3. 檔案清單

### 新增
| 檔案 | 內容 |
|---|---|
| `src/lib/migrations.js` | `migrateBonusRuleV3toV4(rule)`（純函式）＋ `migrateBackupPayload(data)`。DB upgrade 和備份還原都呼叫它。 |
| `src/lib/cart.js` | `makeLineId`、`addLine`、`changeQty`、`stockUsageByProduct(cart)`（單賣＋套組內容物合併計算）、`canAddToCart`。純函式，Sales 和 Preorders 加購共用。 |
| `src/lib/promo.js` | `optimizeCombos(units, comboRules, { maxStates })`（記憶化搜尋＋貪婪備援）、`evalComboGifts`、`calcCartTotals(cart, rules)` 回傳 `{ grossAmount, totalDiscount, subtotal, discounts, approximate }`。純函式。 |
| `src/lib/reportModel.js` | 純函式彙總：`buildLedgerModel({ transactions, products, categories })` → 商品欄順序、每列資料、總數列；`buildSummaryModel` → 商品彙整、實際出貨數（含套組內容物）、折抵合計、收款摘要；`buildCategorySheets`。給 xlsx、CSV、Reports 明細三處共用，可以直接測。 |
| `src/lib/exportXlsx.js` | 動態 `import('xlsx')`，把 reportModel 轉成工作表（真正的日期格、凍結、欄寬、換行），下載一個 `.xlsx`。 |
| `src/components/SlotEditor.jsx` | 「欄位」編輯器：標題、件數、可選商品（依類別全選）；合購 slots 和套組 bundleSlots 共用。 |
| `src/components/BundlePickerModal.jsx` | 收銀台套組選款彈窗：每欄列可選商品＋剩餘庫存、售完變灰、固定內容物自動選、全選滿才能加入。 |
| `src/components/TxDetailList.jsx` | 報表頁「本日交易明細」可收合列表。 |
| `src/lib/__tests__/promo.test.js`、`reportModel.test.js`、`migrations.test.js` | vitest。B 組 B1～B12、D3 遷移、E 組等式。 |

### 修改
| 檔案 | 改什麼 |
|---|---|
| `src/db.js` | `version(5)` ＋ upgrade（呼叫 migrations）；`exportAllData` → `version: 5`；`validateBackupPayload` 接受 3／4／5 並補 type／bundleSlots／slots／comboPrice 驗證；`importAllData` 先 `migrateBackupPayload`。 |
| `src/lib/bonuses.js` | 滿額禮改用「折扣後金額」；`product` 型分支改讀 combo gift（呼叫 promo.js）。 |
| `src/pages/Sales.jsx` | 購物車改 `lineId`；套組卡片開 BundlePickerModal；金額改用 `calcCartTotals`；購物車下方列折扣；結帳寫入新欄位、扣套組內容物庫存（同一 transaction）。 |
| `src/components/CheckoutModal.jsx` | 顯示折扣列、應收／找零用折扣後；套組行顯示選款小字；以 `lineId` 操作。 |
| `src/pages/Preorders.jsx` | 加購清單支援套組＋合購折扣；用詞改「場次」；CSV 匯入套組警告。 |
| `src/lib/csv.js` | `item_name` 對到 `type:'bundle'` 時回傳警告文案。 |
| `src/pages/AdminProducts.jsx` | 活動頁改三種類型框架（滿額禮／合購折扣／套組活動）；套組建立編輯在活動頁，同一 transaction 寫 products＋bonusRules；商品列表套組標籤、編輯跳轉；內容物失效 ⚠；刪除套組二次確認／有交易改封存；`poolProductIds` 只列 single。 |
| `src/pages/Reports.jsx` | 匯出改 xlsx 一個檔；小字連結「匯出 CSV（舊格式）」；新增「本日交易明細」。 |
| `src/lib/reporting.js` | `downloadCsvFiles` 改成間隔 400ms、延後 revoke；CSV 改吃 reportModel（商品欄順序照類別）。 |
| `src/i18n/strings.js`、`src/lib/strings.js` | 用詞統一＋所有新文案。 |
| `package.json` | 加 `xlsx`、`vitest`、`test` script；收尾改 `version: 1.1.0`。 |
| `vite.config.js` | `maximumFileSizeToCacheInBytes`。 |
| `.gitignore` | P6：排除根目錄 dist 產物。 |

---

## 4. Phase 順序與交付

| Phase | 做的事 | 交付／你要測的 |
|---|---|---|
| **P0 地基** | `db.js` v5＋`migrations.js`、備份 3／4／5 相容、`cart.js`＋Sales／Preorders 改 lineId（純重構）、vitest 骨架＋migrations 測試 | 舊資料開得起來、收銀流程跟以前一樣、v3／v4 備份都能還原 |
| **P1 報表** | `reportModel.js`、`exportXlsx.js`、Reports 明細列表、CSV 修 bug（折抵欄先 0、套組欄先空） | 驗收 A 組 |
| **P2 用詞** | 全專案「特典／活動」對照表、活動頁三類型框架（滿額禮沿用）、修錯 key 的 toast | 對照表給你確認 |
| **P3 套組活動** | `SlotEditor`、`BundlePickerModal`、庫存合併檢查、結帳扣內容物、CSV 警告 | 驗收 C 組 |
| **P4 合購折扣** | `promo.js`＋測試、購物車折扣列、CheckoutModal、交易新欄位、滿額禮改折扣後 | 驗收 B、D 組，`npm test` 全過 |
| **P5 報表補齊** | 流水帳／SUMMARY／類別頁補折抵、套用活動、套組內容、實際出貨數 | 驗收 E 組 |
| **P6 清理** | 死碼、`useEffect` 收斂檢查、迴圈終止條件、eslint 0 error、`npm run build`／`npm audit`、清理報告、version 1.1.0、playbook 章節 | 清理報告 |

---

## 5. 用詞對照表（P2 預覽，正式版在 P2 交付）

| 原文 | 指的是 | 改成 |
|---|---|---|
| 報表頁「活動」選單（`reports.eventLabel`） | 場次 | 場次 |
| 「未設定活動」（Reports、Preorders） | 場次 | 未設定場次 |
| 「封存活動（唯讀）」 | 場次 | 封存場次（唯讀） |
| Preorders「活動管理」「請選擇活動」「請先選擇活動後再匯入 CSV」 | 場次 | 場次管理／請選擇場次／請先選擇場次後再匯入 CSV |
| `csv.js`「與目前選擇的活動…不一致」 | 場次 | 場次 |
| `seed.js` 預設場次名「範例活動」 | 場次 | 範例場次 |
| `sales.bonusTitle`「特典提醒：」、CheckoutModal「🎁 特典」 | 規則 | 活動提醒：／🎁 活動 |
| 後台頁籤「場次&特典」、「特典設定」、「＋ 新增特典」、「儲存特典」、「編輯特典」、「特典名稱」、「特典說明文案」、各 toast | 規則 | 場次&活動／活動設定／＋ 新增活動／儲存活動／… |
| `lib/strings.js` S3「特典提醒」、R10「特典」 | 規則 | 活動提醒／活動 |
| `bonusRules`、`bonusesTriggered`、`bonusText` 欄位名 | 資料欄位 | **不改** |
