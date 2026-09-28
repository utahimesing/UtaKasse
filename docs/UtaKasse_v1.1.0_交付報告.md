# UtaKasse v1.1.0 交付報告

> 日期：2026-09-28 ｜ 對應規格：`docs/specs/UtaKasse_需求單_v2.0.md`、`docs/specs/UtaKasse_NeoBrutalism_StyleSpec_v1.0.md`
> 狀態：程式完成，**尚未 commit**（全部改動在工作目錄，方便你先看過再決定）

---

## 1. 總結

| 項目 | 結果 |
|---|---|
| `npm test`（vitest） | 4 個檔案、44 個測試全部通過 |
| `npm run lint` | 0 error、0 warning |
| `npm run build` | 成功；xlsx chunk（492 KB）已在 service worker precache 清單裡 |
| `npm audit` | 0 vulnerabilities |
| 打包 | `utakasse-netlify-deploy-v1.1.0.zip`（`dist/` 內容，可直接拖進 Netlify） |

---

## 2. 驗收條件對照（需求單第 10 節）

✅＝自動測試或瀏覽器實測通過 ｜ 📱＝需要你用手機再確認一次

| # | 條件 | 怎麼驗的 | 結果 |
|---|---|---|---|
| A1 | 匯出只下載 1 個 xlsx | 瀏覽器實測，出現 `範例活動_20260925_SALES.xlsx` | ✅ 📱 iOS 請再試 |
| A2 | 流水帳每筆一列、日期格式、總數／總金額列 | 單元測試讀回 xlsx 檢查 | ✅ |
| A3 | SUMMARY 與舊 CSV 摘要一致 | 同一套區塊，補上出貨數與折抵列 | ✅ |
| A4 | 每個類別一頁 | 單元測試 | ✅ |
| A5 | 報表頁可展開本日交易明細 | 瀏覽器實測 | ✅ |
| A6 | 斷網可匯出 | xlsx chunk 已進 precache；**沒有實際斷網測** | 📱 |
| B1–B11 | 合購最佳化各案例 | `promo.test.js` 逐案例 | ✅ |
| B12 | 60 件 3 規則 1 秒內 | 測試實測 < 1 秒 | ✅ |
| C1 | 大套組選海報A → 庫存 3→2 | 瀏覽器實測（選 B、C 各一組，B 3→2、C 3→1） | ✅ |
| C2 | 單賣已佔庫存 → 套組選單變灰 | `cart.test.js`＋瀏覽器（海報A 售完變灰） | ✅ |
| C3 | 不同選款 → 購物車 2 行 | 瀏覽器實測 | ✅ |
| C4 | 大套組＋海報×1 → 1420 | 瀏覽器實測＋單元測試 | ✅ |
| C5 | 封存海報C → 選單不顯示、列表 ⚠️ | 瀏覽器實測 | ✅ |
| D1–D2 | 滿額禮用折扣後金額 | 單元測試 | ✅ |
| D3 | v3 備份還原 → 舊合購變 gift | 瀏覽器實測還原 v3 備份；v2 備份被正確拒絕 | ✅ |
| E1–E3 | 報表對帳、出貨數含套組、等式 | `reportModel.test.js` | ✅ |
| E4 | 新版備份 → 還原 → 活動與套組還在 | 瀏覽器實測（匯出 v5 → 還原 → 數量一致） | ✅ |

其他已實測：Excel 凍結第 1 列＋前 2 欄、第 1 列自動換行（XML 用瀏覽器 DOMParser 驗證格式正確）、後台新增／刪除合購與套組、375px 手機寬度無橫向捲動、四個分頁閒置 3 秒 0 次重新 render。

---

## 3. 各 Phase 做了什麼

| Phase | 內容 | 主要檔案 |
|---|---|---|
| P0 | DB v5＋遷移函式、備份 v3／v4／v5 相容、購物車改 lineId | `db.js`、`lib/migrations.js`、`lib/cart.js` |
| P1 | Excel 報表（流水帳／SUMMARY／類別頁）、報表頁交易明細、CSV 下載 bug | `lib/reportModel.js`、`lib/exportXlsx.js`、`components/TxDetailList.jsx`、`lib/reporting.js` |
| P2 | 用詞統一、活動頁三種類型框架 | `i18n/strings.js`、`pages/AdminProducts.jsx` |
| P3 | 套組活動（選款彈窗、庫存合併、扣內容物） | `components/BundlePickerModal.jsx`、`components/SlotEditor.jsx`、`lib/slots.js` |
| P4 | 合購折扣最佳化、滿額禮改折扣後 | `lib/promo.js`、`lib/bonuses.js`、`pages/Sales.jsx`、`components/CheckoutModal.jsx`、`pages/Preorders.jsx` |
| P5 | 報表補折抵、套用活動、套組內容、實際出貨數 | `lib/reportModel.js` |
| P6 | 清理（見第 5 節） | — |
| 視覺 | Neo-Brutalism 改版 | `index.css`、`lib/uiPalette.js`、所有元件與頁面 |

### 跟規格不一樣的地方（刻意的）

1. **DB 版本是 v5，不是 v4。** 工作目錄裡的 `db.js` 早就已經是 v4（加了 `products.sortOrder` 索引，但沒發布）。為了不跟那個 v4 撞號，這次升到 v5。備份檔也寫 `version: 5`，還原接受 3／4／5。
2. **SUMMARY 等式多一項「預購B訂金」。** 規格寫「Σ 各商品金額 − 活動折抵 = 所有管道總銷售金額」，但預購B的商品金額是全額，實收只有尾款，訂金是場次前收的，不在「所有管道總銷售金額」裡。不加這一項，只要有預購B等式就不成立。SUMMARY 最下面有「差異（應為 0）」一列方便對帳。
3. **函式名 `migrateBonusRuleV3toV4` 照規格保留**，實際作用是把 v5 以前的規則轉成新格式。

---

## 4. F1 用詞對照表

| 原文 | 位置 | 指的是 | 改成 |
|---|---|---|---|
| 報表頁「活動」選單 | Reports | 場次 | 場次 |
| 未設定活動 | Reports、Preorders | 場次 | 未設定場次 |
| 封存活動（唯讀）… | Reports | 場次 | 封存場次（唯讀）… |
| 活動管理／請選擇活動 | Preorders | 場次 | 場次管理／請選擇場次 |
| 請先選擇活動（後再匯入 CSV） | Preorders | 場次 | 請先選擇場次（後再匯入 CSV） |
| CSV 場次名稱與目前選擇的活動不一致 | `csv.js` | 場次 | 目前選擇的場次 |
| 預設場次名「範例活動」 | `seed.js` | 場次 | 範例場次（只影響新安裝） |
| 預購場外已付（A型，活動前已收） | 報表、CSV | 場次 | 場次前已收 |
| 檔名預設「活動」 | `reporting.js` | 場次 | 場次 |
| 特典提醒： | 收銀台 | 規則 | 活動提醒： |
| 🎁 特典 | CheckoutModal | 規則 | 🎁 活動 |
| 場次&特典（頁籤） | 後台 | 規則 | 場次&活動 |
| 特典設定／＋ 新增特典／編輯特典／儲存特典 | 後台 | 規則 | 活動設定／＋ 新增活動／編輯活動／儲存活動 |
| 特典名稱／特典說明文案 | 後台 | 規則 | 活動名稱／提醒文案 |
| 滿額贈 | 後台 | 規則 | 滿額禮 |
| 合購特典（商品觸發） | 後台 | 規則 | 合購折扣（贈品提醒模式） |
| 尚未設定特典規則 | 後台 | 規則 | 尚未設定活動 |
| 範例特典（…） | `seed.js` | 規則 | 範例活動（…） |
| `lib/strings.js` S3、R10 | — | 規則 | 已刪除（沒有程式使用） |
| `bonusRules`、`bonusesTriggered`、`bonusText` | 資料欄位 | — | **不改** |

注意：你已經建立的場次名稱、活動名稱是你自己的資料，升級不會動。

---

## 5. P6 清理報告

### 刪除的檔案

| 檔案 | 為什麼安全 |
|---|---|
| `src/App.css` | 空檔案，沒有任何地方 import |
| `src/assets/hero.png`、`react.svg`、`vite.svg` | Vite 範本圖，全專案沒有引用 |
| `src/components/Card.jsx`、`CategoryPill.jsx`、`Input.jsx` | 改版前就已從工作目錄刪除，沒有任何 import |
| 根目錄 `assets/`、`sw.js`、`workbox-*.js`、`manifest.webmanifest` | 舊的 build 產物，放錯位置（應在 `dist/`），讓 `npm run lint` 噴 290 個 error |
| 根目錄 `favicon.svg`、`icon-*.png`、`icons.svg`、`utakasse-logo.png`、`privacy.html` | 跟 `public/` 裡的檔案逐位元組相同，build 用的是 `public/` 那份 |

`.gitignore` 加上根目錄 build 產物與 `*.zip`，避免再被加進去。

### 刪除的程式碼

| 項目 | 原因 |
|---|---|
| `lib/strings.js` 30 個 ID（N1–N4、S1–S8、S10、P1、P3–P8、R1–R4、R6–R10、A5） | 沒有任何 `getString()` 呼叫；介面文字統一放 `i18n/strings.js` |
| `uiPalette.js` 的 `glass`、`cardShadowElevated`、`surface.modal`、`spacing` | 改版後沒人用 |
| 舊的 `triggerProductIds` 單選下拉 UI | 被 SlotEditor 取代 |
| 舊的 `downloadCsvFiles`（連續觸發＋馬上 revoke） | 改成間隔 400ms、延後 4 秒 revoke |
| `Sales.jsx` 的 `headerSpacer`、`clampQty`、`nameStyle` 覆寫 | 沒作用或被 `cart.js` 取代 |
| `Preorders.jsx` 的 `calcCartTotal`、`clampQty`、`addOnCartItemsForUI`、傳給鍵盤卻沒作用的 `value`／`onClear` | 被 `cart.js`／`promo.js` 取代 |
| `app.offline` 字串 | 沒有使用 |

### 死迴圈與重複 render 檢查

| 位置 | 原本 | 處理 |
|---|---|---|
| `Reports.jsx` `selectedDateKey` | effect 裡 setState，值又在相依陣列 | 改成用 `useMemo` 在 render 時算出，不再用 effect |
| `Sales.jsx` `selectedPaymentId` | 第二個 effect 讀寫同一個 state | 刪掉那個 effect，改在載入時用 functional update 一次決定 |
| `Sales.jsx` 類別被刪除時退回「全部」 | effect 裡 setState | 改成 render 時算出 `effectiveCategory` |
| `Toast.jsx` | 自己也有一個計時 effect，跟 `useToast` 重複 | 只保留 `useToast` 的計時，Toast 純顯示 |
| `refreshProducts`（App） | — | 已是 `useCallback([])`，reference 穩定，Sales 的載入 effect 只跑一次 |
| `generateUniqueReceiptNo` 的 `while` | 理論上可能無限重試 | 改成最多 1000 次，再撞號就加時間後綴 |
| `promo.js` 遞迴 | — | 每層都讓剩餘件數減少；另有 `maxStates` 上限，超過改用貪婪法 |
| `promo.js` 重建組合的 `while` | — | 有 `guard` 上限＝總件數＋1 |
| `seed.js` StrictMode 重複執行 | 開發模式 console 出現 `BulkError` | 包進同一個 Dexie transaction，第二次會看到已有資料直接結束 |

實測：用暫時的 React commit 計數器量四個分頁，閒置 3 秒都是 **0 次** commit。計數器已移除。

### 順手修掉的 bug

| Bug | 修法 |
|---|---|
| 現金不足時 Toast 顯示「匯入完成…」（用錯 key A3） | 改用 S11「金額不足或未收銀」 |
| 預購取件數字鍵盤的「00」鍵沒反應 | 接上 `onDoubleZero` |
| 用 CSV 匯入商品時，同名商品的 `sortOrder`、`type`、`bundleSlots` 會被洗掉 | 匯入時保留既有欄位，只覆蓋 CSV 有的欄位 |
| `index.html` 被 build 產物覆蓋，`npm run dev` 白畫面 | 改回開發版 |

---

## 6. 已知問題與待確認（Issue Report）

以下是我在這個環境裡無法完全驗證、或規格本身需要你決定的事。**沒有會讓資料壞掉或結帳算錯的問題。**

### ISSUE-1　📱 手機實機驗證（A1、A6）
- **現況**：桌面瀏覽器確認只下載一個檔案，service worker precache 清單也包含 xlsx chunk。
- **沒驗到**：iOS Safari 實際下載、飛航模式下匯出。
- **請你做**：部署後用手機開 App → 等一下讓 service worker 裝好 → 開飛航模式 → 報表頁按「匯出 Excel 報表」。

### ISSUE-2　📱 Excel／Numbers 實際開檔
- **現況**：凍結窗格、換行樣式是匯出後直接改檔案內部 XML 補上的（SheetJS 社群版不支援）。XML 用瀏覽器驗證過格式正確，SheetJS 也能讀回。
- **沒驗到**：這個環境沒有 Excel，無法實際打開看畫面。
- **請你做**：用 Excel 或 Google 試算表開一次匯出檔，確認第 1 列和前 2 欄有凍結、商品名稱會換行。

### ISSUE-3　SUMMARY 等式的「差異」可能不是 0
- **什麼時候**：預購 CSV 的 `total_price` 跟 `unit_price × item_qty` 不一樣（例如預購有打折）。
- **原因**：報表用交易裡存的單價算商品金額，預購收的錢用 CSV 的金額。
- **建議**：這是資料本身不一致，報表照實顯示差異比較安全。要不要另外處理，等你決定。

### ISSUE-4　預購 CSV 的套組只扣套組本身庫存（規格 Q3 的決定）
- 匯入時會跳警告。內容物要在取件時用加購補點，或手動改庫存。

### ISSUE-5　舊介面文字還沒全部搬進 `strings.js`
- 新增和這次改到的文字都已集中。原本就寫死、這次沒動到的句子（例如付款方式區塊、雲端備份區塊、部分 Toast）還留在元件裡，功能不受影響。

### ISSUE-6　還沒 commit
- 所有改動都在工作目錄。建議你看過後開一個分支 commit，例如 `feat: v1.1.0 活動系統改版＋Excel 報表＋Neo-Brutalism`。

---

## 7. 部署

1. 解壓 `utakasse-netlify-deploy-v1.1.0.zip`，或直接把 zip 拖到 Netlify 的 Deploys 頁。
2. 第一次打開新版時，舊資料會自動升級到 DB v5（只轉換舊的合購特典格式，其他資料不動）。
3. **升級前建議先用舊版做一次 Google Drive 備份**，萬一有問題可以還原（新版也能讀舊版備份）。
