# 姬帳 UtaKasse 需求單 v2.0：活動系統改版＋流水帳報表

> 文件版本 v2.0 ｜ 2026-09-24 ｜ 目標 App 版本：v1.1.0（DB v4）
> 預計實作：本週末，交給 Claude Code 執行
>
> **v2.0 變更摘要（相對 v1.0）**
> 1. 新增 F0：Excel 報表，包含「流水帳」與「SUMMARY」兩頁（參考 CWT64-SALES-D1.xlsx）
> 2. 「特典」全面改名為「活動」，分成三種：滿額禮／合購折扣／套組活動
> 3. 原本規劃的獨立 promoRules 表取消，改成擴充既有的 bonusRules 表（一張表管所有活動）
> 4. 合購折扣改成「全購物車最佳化」：一定要套用最划算的活動組合，可以同時套用多個活動；組合內容改用 slots 結構（跟套組共用），才能表達「A＋B」這類合購
> 5. 開放問題全部定案（第 11 節）
> 6. 最後一個階段：清理死碼與死迴圈
>
> 下次更新觸發條件：實作中範圍調整、驗收結果、正式上線後的回報

---

## 0. 給 Claude Code 的開場說明（整段貼上）

```
你要在 UtaKasse（React + Vite + Dexie IndexedDB 的離線 PWA 記帳 App）實作一次改版。
完整規格在 docs/specs/UtaKasse_需求單_v2.0.md，請完整讀完再動手。

工作規則：
1. 動手前先讀這些檔案：src/db.js、Sales.jsx、CheckoutModal.jsx、AdminProducts.jsx、
   Preorders.jsx、Reports.jsx、src/lib/reporting.js、strings.js、package.json、vite.config.js。
   路徑以 repo 實際位置為準。
2. 先交一份實作計畫給我（要改哪些檔案、資料結構、新增哪些套件），我確認後再寫 code。
3. 照第 9 節的 Phase 順序做。每個 Phase 做完就停，列出我要在 npm run dev 手動測的步驟，
   我回覆 OK 才進下一個 Phase。
4. 絕對不能弄壞舊資料：v3 的商品、交易、活動規則、備份檔，升級後都要能正常使用。
5. 交易資料的既有欄位名稱（例如 bonusesTriggered、subtotal）不要改，只能新增欄位。
6. 沿用既有設計系統（index.css 的 CSS 變數、uiPalette.js、DM Sans），不要新增色票。
7. 介面文字一律繁體中文（台灣用語），集中寫在 strings.js。
8. 我是開發新手：每一步都要說明改了什麼、為什麼。
9. 最後一個 Phase 要清理死碼與死迴圈（第 9 節 P6），不可以跳過。
```

---

## 1. 背景

### 1.1 已確認的現況（依 v1.0.0 程式碼）

| 項目 | 現行行為 | 位置 |
|---|---|---|
| 報表匯出 | 按一次會連續觸發兩個 CSV 下載，而且馬上 `revokeObjectURL`。手機瀏覽器（特別是 iOS Safari）通常只會收到第一個檔案，所以使用者實際上拿不到交易明細 | `reporting.js` downloadCsvFiles |
| 交易 CSV 欄位 | 商品欄依名稱字母排序，不照商品順序；時間只有時分秒 | `buildTransactionsCsvText` |
| 報表頁 | 只看得到當日總額，看不到每一筆買了什麼 | `Reports.jsx` |
| 結帳總額 | `Σ unitPrice × qty`，沒有折扣機制 | `Sales.jsx` |
| 扣庫存 | 每個購物車品項只扣自己的 stock | `Sales.jsx`、`Preorders.jsx` |
| 特典 | 只顯示提示文字，不影響金額；合購類型只能選 1 個觸發商品 | `evalBonuses`、`AdminProducts.jsx` |
| 用詞衝突 | 「活動」這個詞目前同時指「場次」（報表頁的「活動」選單、「封存活動」、Sales 預設場次名「活動」）和「特典規則」（「＋ 新增活動」「儲存活動」） | 多處 |

### 1.2 實際案例（驗收用）

- 海報 15 款，每款 220 元，各有庫存
- 大套組：內容包含「海報任選 1 款」，海報跟單賣的共用同一批庫存
- 海報 Buy 2 for 400

---

## 2. 範圍

| 範圍內 ✅ | 範圍外 ❌ |
|---|---|
| F0 Excel 報表（流水帳＋SUMMARY＋類別分帳頁）、報表頁顯示交易明細 | 百分比折扣、整單折扣、優惠碼 |
| F1 用詞統一：特典 → 活動、指場次的活動 → 場次 | 會員、點數 |
| F2 套組活動（連動內容物庫存） | 多裝置同步 |
| F3 合購折扣（全購物車最佳化） | 預購 CSV 完整支援套組選款（只做警告） |
| F4 滿額禮（沿用既有功能，只改名） | |
| DB v3 → v4、備份 v3／v4 相容、清理死碼與死迴圈 | |

---

## 3. F0 Excel 報表（流水帳＋SUMMARY）

### 3.1 匯出格式

- 報表頁的匯出按鈕改成匯出**一個 `.xlsx` 檔**，裡面有好幾個工作表。只下載一個檔案，手機也收得到
- 檔名：`{場次名稱}_{YYYYMMDD}_SALES.xlsx`，例如 `CWT72_250601_20250601_SALES.xlsx`
- 範圍：跟現在一樣，是「選定場次＋選定日期」
- 套件：使用 SheetJS 社群版，**從官方來源安裝**：`npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
  - 原因：npm registry 上的 `xlsx@0.18.5` 有已知漏洞。本專案的標準是 `npm audit` 0 vulnerabilities
  - 用 `await import('xlsx')` 動態載入，不要拖慢首頁
  - 要確認 vite-plugin-pwa 有把這個 chunk 加進 precache，離線時也能匯出。檔案如果超過 workbox 預設的 2MB 上限，要調高 `maximumFileSizeToCacheInBytes`
- 保留舊的 CSV 匯出，改成按鈕下方的小字連結「匯出 CSV（舊格式）」。兩個 CSV 下載之間要間隔約 400ms，而且延後 revoke，修掉只下載到一個檔案的 bug

### 3.2 工作表 1：`流水帳`

一筆交易一列，照時間排序。欄位（從左到右）：

| 欄位 | 內容 |
|---|---|
| 編號 | `receiptNo`（舊交易沒有就用流水序號） |
| 日期和時間 | 真正的 Excel 日期時間格子（格式 `yyyy/m/d hh:mm:ss`，台北時間），不要存成文字 |
| 類型 | 現場／預購A／預購B／通販（沿用 `calcTxKind`） |
| 〔商品欄 × N〕 | 每個商品一欄，填這筆交易的數量，沒買填 0。**套組活動也是一欄**（填套組數量） |
| 活動折抵 | 這筆交易的合購折扣總額，填負數；沒有就填 0 |
| 小計 | `tx.subtotal`（實收） |
| 收款方式 | 沿用 `getTxPaymentLabel` |
| 套用活動 | 例：`海報 Buy 2 for 400 ×1；滿800送小卡` |
| 套組內容 | 例：`大套組[海報A]；大套組[海報C]` |
| 備註 | `tx.note` |

規則：
1. 商品欄順序：先照類別的 sortOrder，同一類別內照後台商品列表的順序；多類別的商品放在第一個類別。**只列出當天有賣出的商品**
2. 最下方加兩列：
   - `銷售總數`：每個商品欄的數量加總
   - `總金額`：每個商品的 Σ(qty × unitPrice)，用交易裡存的 unitPrice 計算，不用現在的售價。小計欄放實收總額
3. 凍結第 1 列和前 2 欄
4. 欄寬：商品欄自動換行，列高要夠顯示兩行商品名稱

### 3.3 工作表 2：`SUMMARY`

把現有 `buildSummaryCsvText` 的內容（商品彙整＋收款摘要）原樣放進這個工作表，再補上：
1. 新增一列「各商品實際出貨數量（含套組內容物）」＝單賣數量＋套組內容物數量，用來盤點庫存
2. 新增一列「活動折抵合計」（負數）
3. 確保等式成立：Σ 各商品金額 − 活動折抵 = 所有管道總銷售金額

### 3.4 工作表 3 之後：類別分帳頁（參考檔案裡依角色分頁的做法）

- 每個「當天有賣出商品的類別」各一頁，工作表名稱＝類別名稱（去掉 Excel 不接受的字元 `[]:*?/\`，截到 31 字）
- 欄位同流水帳，但**只放該類別的商品欄**，只列出有買該類別商品的交易
- 最下方同樣有 `銷售總數`、`總金額`
- 商品屬於多個類別時，每一頁都會出現（這是分帳用途，本來就是這樣）

### 3.5 報表頁顯示交易明細（Reports.jsx）

在「本日營收」卡片下方新增「本日交易明細」，可以收合：
- 每筆一張小卡：編號、時間、類型、品項摘要（`海報A×1、大套組[海報C]×1`）、套用的活動、實收、收款方式
- 最新的在最上面
- 這次只能看，不做刪除或修改交易

---

## 4. F1 用詞統一

| 指的是什麼 | 統一用詞 | 範例修改 |
|---|---|---|
| 一場販售活動（events 表） | **場次** | 報表頁「活動」→「場次」、「未設定活動」→「未設定場次」、「封存活動（唯讀）」→「封存場次（唯讀）」、Sales 自動建立的預設場次名稱「活動」→「場次」、Preorders「請先選擇活動後再匯入 CSV」→「請先選擇場次…」 |
| 滿額禮／合購／套組規則（bonusRules 表） | **活動** | 「特典設定」→「活動設定」、「特典提醒：」→「活動提醒：」、後台頁籤「場次&特典」→「場次&活動」 |

做法：用 grep 找出全專案的「特典」和「活動」，逐一判斷屬於哪一種再改，**改完列出對照表給我看**。資料欄位名稱（`bonusRules`、`bonusesTriggered`）不改。

---

## 5. 活動資料結構（bonusRules 擴充）

### 5.1 三種活動類型

| UI 名稱 | `triggerType` | 做什麼 | 會改金額 | 會扣庫存 |
|---|---|---|---|---|
| 滿額禮 | `amount`（沿用） | 消費達門檻時提醒送贈品 | ❌ | ❌ |
| 合購折扣 | `combo`（新） | 任選 N 件＝X 元，或達成數量時提醒送贈品 | ✅（組合價模式） | ❌ |
| 套組活動 | `bundle`（新） | 建立一個可販售的套組商品 | ✅（套組本身有售價） | ✅ 扣套組和內容物 |

### 5.2 欄位

```js
// 共通（沿用）
{ id, name, enabled, triggerType, exclusiveGroup, sortOrder, bonusText }

// amount（滿額禮，沿用）
{ categoryId, triggerAmount }

// combo（合購折扣，新）：用「欄位 slots」描述一組要湊哪些東西，跟套組的結構一樣
{
  slots: [
    { id, label: '任選海報', qty: 2, poolProductIds: ['p1', …] },
  ],
  rewardType: 'price' | 'gift',       // price = 組合價；gift = 只提醒送贈品
  comboPrice: 400,                    // rewardType === 'price' 才需要
  bonusText,                          // gift 模式顯示的文案；price 模式可以留空
}
```

用 slots 就能表達各種合購：

| 活動 | slots |
|---|---|
| 海報任選 2 張 400 | `[{ 海報A～O, qty: 2 }]` |
| 海報＋寫真書 700 | `[{ 海報A～O, qty: 1 }, { 寫真書, qty: 1 }]` |
| Alan＋Butterfly＋Journey 三書合購 | `[{ Alan, 1 }, { Butterfly, 1 }, { Journey, 1 }]` |

⚠️ 不能用「一個商品池＋N 件」的簡化結構。例如「海報＋寫真書」如果寫成池子 {海報, 寫真書} 任選 2 件，買 2 本寫真書也會被判成 700，金額會算錯。

```js

// bundle（套組活動，新）
{
  productId: 'p-bundle',              // 對應 products 表裡的套組商品
}
```

### 5.3 套組商品（products 表新增欄位）

套組要能在收銀台被點、在報表裡有自己的欄位、在預購 CSV 裡對得到名稱，所以套組本身還是存成一筆 product：

```js
{
  // 既有欄位
  id, name, price, stock, categoryIds, color, imageUrl, isNew, archived,
  // 新增
  type: 'single' | 'bundle',          // 沒有這個欄位時一律視為 'single'
  bundleSlots: [
    { id, label: '自選海報', pickQty: 1, poolProductIds: [...], allowDuplicate: true },
  ],
}
```

- 套組的建立和編輯都在**活動頁**。存檔時同時寫入 products（`type: 'bundle'`）和 bonusRules（`triggerType: 'bundle'`，用 productId 關聯），兩者包在同一個 Dexie transaction
- 後台商品列表裡的套組顯示「套組」標籤；點編輯會跳到活動頁的對應活動
- 刪除套組活動 = 同時刪掉對應的套組商品（要二次確認；有歷史交易時改成封存，不刪除）
- `poolProductIds` 只能選 `type === 'single'` 的商品（套組不能包套組）

### 5.4 DB v4 升級（db.js）

```js
db.version(4).stores({ /* 同 v3 */ }).upgrade(async (tx) => {
  // 舊的合購特典 triggerType 'product' → 'combo' + rewardType 'gift'
  // triggerProductIds + triggerProductQty → slots: [{ poolProductIds: triggerProductIds, qty: triggerProductQty }]
  // 舊資料的行為必須完全不變（原本只提醒，升級後也只提醒）
});
```

- products 的新欄位不用建索引，讀取時用 `type ?? 'single'` 就好
- `exportAllData()` 改成 `version: 4`
- `validateBackupPayload()` 同時接受 3 和 4。還原 v3 備份時，**套用同一套 product → combo 轉換**，寫成共用函式 `migrateBonusRuleV3toV4()`，DB upgrade 和備份還原都呼叫它
- 新增驗證：products 的 `type` 只能是 single／bundle；bundle 必須有 bundleSlots 陣列；combo 必須有 slots 陣列、每個 slot 的 qty ≥ 1，price 模式的 `comboPrice` ≥ 0
- 套組和合購的「欄位編輯器」做成同一個共用元件（例如 `SlotEditor.jsx`）

---

## 6. F2 套組活動

### 6.1 後台（活動頁）

1. 「＋ 新增活動」→ 選類型「套組活動」
2. 欄位：套組名稱、售價、庫存（選填，用來追蹤套組限定的東西）、類別、顏色／圖片、套組內容
3. 套組內容：＋新增欄位 → 標題、要選幾件、可選商品（可依類別全選）。只有 1 個可選商品的欄位就是固定內容物
4. 驗證：至少 1 個欄位、每欄 pickQty ≥ 1、可選商品 ≥ 1
5. 內容物被封存或刪除時，活動列表標 ⚠️「內容物失效」

### 6.2 收銀台

1. 點套組卡片 → 打開「套組選款」彈窗（新元件 `BundlePickerModal.jsx`）
   - 每個欄位列出可選商品和剩餘庫存，售完的變灰
   - 每欄選滿打 ✅，全部選滿「加入購物車」才能按
   - 固定內容物自動選好
2. 購物車改用 `lineId` 當鍵
   - 一般商品：同一商品一樣合併成一行
   - 套組：選款一樣就合併數量，不一樣就另開一行，下方小字顯示選了哪些款
3. **庫存合併檢查**：同一個商品在單賣行和套組內容裡的數量加總，不能超過庫存
4. 預購取件的加購清單也支援套組

### 6.3 結帳寫入與扣庫存

```js
items: [{
  lineId, productId, productName, qty, unitPrice,
  kind: 'bundle',                                   // 一般商品省略
  components: [{ productId, productName, qty }],    // 每 1 組的內容
}]
```

1. 套組本身的 stock 是數字的話，扣 qty
2. 每個 component 扣 `component.qty × item.qty`
3. 全部包在同一個 Dexie transaction，任何一步失敗就整筆回滾

### 6.4 預購 CSV

item_name 對到套組商品時，匯入結果顯示警告：「⚠️『大套組』的內容物不會自動扣庫存，請在取件時用加購補點，或手動調整庫存」

---

## 7. F3 合購折扣（全購物車最佳化）⭐ 核心邏輯

### 7.1 業務規則

1. 同一張購物車可以**同時套用多個合購折扣，同一個活動也可以套用多次**
2. **每一件商品最多只能屬於一組折扣**，不能重複使用
3. 系統必須盤點購物車裡的所有商品，找出**總折扣最大**的組合，不是照排序先到先得
4. 套組行和套組內容物**不參與**合購折扣
5. 一組＝把活動的每個 slot 都填滿（每個 slot 從自己的可選商品裡挑 qty 件）。一組的折扣＝組內商品原價合計 − comboPrice。**≤ 0 的組合不能套用**
6. 總額 = Σ 行金額 − 總折扣，而且不能小於 0
7. 同樣最划算的組合有好幾種時，依序比較：(a) 組數較少的優先 (b) 用到的活動 sortOrder 加總較小的優先。確保每次算出來都一樣
8. 購物車有任何變動都要重新計算（加減商品、刪除、清空）

### 7.2 演算法（放在新檔 `src/lib/promo.js`，必須是純函式）

```
optimizeCombos(units, comboRules, { maxStates = 50000 })
  → { groups: [{ ruleId, unitKeys, discount }], totalDiscount, approximate: boolean }
```

**前處理**
- 只保留 enabled、`rewardType === 'price'` 的 combo 規則
- 把購物車的一般商品彙整成 `items[]`：`{ productId, price, count, ruleIds }`。至少符合一條規則的商品才放進來，依 productId 固定排序

**精確解：記憶化搜尋**
- 狀態 = 每個 item 剩幾件（`counts[]`），memo key = `counts.join(',')`
- `best(counts)`：
  1. 找出第一個還有剩的 item `i`；全部用完就回傳 0
  2. 選項 A：item `i` 的這 1 件不參加任何折扣 → `best(counts, i 減 1)`
  3. 選項 B：對每條規則 r 裡**每一個可以放 `i` 的 slot**，把 `i` 的這 1 件放進那個 slot，再把這條規則的所有 slot 填滿（放 `i` 的 slot 少填 1 件）。填的時候**只能從 index ≥ i 的 item 裡選**（重複組合，要檢查剩餘數量）。因為 `i` 是目前剩下的最小 index，所有剩下的商品本來就都 ≥ i，所以不會漏掉任何分組；memo 會吸收重複的狀態。算出 discount，大於 0 才成立 → `discount + best(扣掉這組後的 counts)`
  4. 回傳所有選項中最好的（照 7.1 第 7 點的規則決勝）
- 這種做法能窮舉所有分組方式，結果保證是最佳解

**防呆（避免卡死）**
- 計算過的狀態數超過 `maxStates` 就立刻中止，改用貪婪法：
  1. 每條規則各自把每個 slot 填上剩下商品中單價最高的，算出一組
  2. 在所有規則裡選折扣最大的那組套用，扣掉這些商品
  3. 重複，直到沒有折扣 > 0 的組合
  4. 回傳 `approximate: true`，購物車顯示小字「活動組合較複雜，已用近似計算，請核對金額」
- 遞迴不可以用 while(true)。每一層都一定會讓剩餘件數減少，保證會結束

**gift 模式與滿額禮**
- combo 的 gift 模式：購物車（不含套組）能湊滿至少 1 組 slots，就顯示 bonusText。不佔用商品，不影響折扣計算
- 滿額禮的門檻用**折扣後**的金額判斷（例：原價 880、折扣後 800，「滿 850 送」不成立）
- 滿額禮沿用既有的 exclusiveGroup 邏輯

### 7.3 收銀台、結帳與寫入

1. 購物車小計下方列出每一條套用的折扣：`🏷️ 海報 Buy 2 for 400 ×2　−NT$80`
2. 總額按鈕、CheckoutModal 的應收和找零，全部用折扣後的金額
3. 預購取件的加購清單也套用合購折扣，只算加購的品項
4. 交易新增欄位（舊交易沒有這些欄位時，一律當成 0 或空陣列）：

```js
{
  subtotal: 800,          // 折扣後實收（沿用欄位），payments.amount 也寫這個數字
  grossAmount: 880,       // 折扣前
  discounts: [{ ruleId, ruleName, times: 2, amount: 80 }],
  discountApproximate: false,
}
```

item 的 unitPrice 一律存原價，不要把折扣攤到每個品項上。

### 7.4 後台表單（合購折扣）

- 欄位：名稱、組合內容（共用 SlotEditor：每個欄位有標題、件數、可選商品，可依類別全選）、模式（組合價／贈品提醒）、組合價或贈品文案
- 驗證：至少 1 個 slot；price 模式的總件數要 ≥ 2、comboPrice ≥ 0；gift 模式的文案不能空白
- 軟性提醒：comboPrice ≥「每個 slot 用最便宜的商品填滿」的合計時，顯示「⚠️ 這個組合價沒有比原價便宜」，但還是可以存

---

## 8. 單元測試

- 新增 devDependency `vitest`，在 package.json 加上 `"test": "vitest run"`
- 至少要測 `promo.js` 和報表的彙總函式，測試案例就用第 10 節 B、D 組

---

## 9. 實作階段

| Phase | 內容 | 做完才能往下 |
|---|---|---|
| **P0 地基** | DB v4＋遷移函式、備份 v3／v4 相容、購物車改成 lineId（純重構，行為不變） | 舊資料開得起來、收銀流程跟以前完全一樣 |
| **P1 報表** | F0 全部（活動折抵、套組內容欄先填 0 或空白） | 驗收 A 組 |
| **P2 用詞** | F1 用詞統一＋活動頁改成三種類型的框架，滿額禮沿用 | 對照表給我確認 |
| **P3 套組活動** | 第 6 節 | 驗收 C 組 |
| **P4 合購折扣** | 第 7、8 節 | 驗收 B、D 組、`npm test` 全過 |
| **P5 報表補齊** | 流水帳、SUMMARY 補上折扣和套組欄位 | 驗收 E 組 |
| **P6 清理** | 見下方 | 清理報告 |

**P6 清理死碼與死迴圈**
1. **死碼**：沒被 import 的檔案和函式、沒用到的變數和 state、沒用到的 strings.js key、被新邏輯取代的舊程式（例如舊的 triggerProductIds UI、舊的 downloadCsvFiles 寫法）
2. **死迴圈**：
   - 檢查所有 `useEffect`：effect 裡 setState 的值如果又出現在自己的相依陣列，要確認一定會收斂（重點檢查 `Reports.jsx` 的 selectedDateKey、`Sales.jsx` 的 selectedPaymentId、`refreshProducts` 的 reference 是否穩定）
   - 檢查所有 `while` 和遞迴都有保證會結束的條件
   - 用 React DevTools Profiler 或 console 計數，確認各頁面閒置時不會一直重新 render
3. 跑 `npm run build` 和 `npm audit`，要 0 error、0 vulnerabilities
4. 交一份清理報告：刪了什麼、改了什麼、為什麼安全

**收尾**：package.json version 改成 1.1.0；playbook 新增「活動設定（三種類型）」和「Excel 報表怎麼看」兩個章節

---

## 10. 驗收條件（npm run dev 手動測）

**測試資料**：海報 A、B、C 各 220 元、庫存 3；寫真書 600 元、庫存 5；
活動 R1「海報 Buy 2 for 400」（slots：海報A～C ×2）；
活動 R2「海報＋寫真書 700」（slots：海報A～C ×1、寫真書 ×1）；
套組「大套組」1200 元（自選海報 ×1，範圍 A～C）；
滿額禮「滿 1000 送小卡」。

**A. 報表**
1. 結 3 筆以上交易後匯出 → 只下載 1 個 xlsx，手機上也收得到 ✅
2. 流水帳每筆一列、時間是日期格式、最下方有銷售總數／總金額 ✅
3. SUMMARY 內容跟舊 CSV 的摘要一致 ✅
4. 每個有賣出的類別各一頁，只有相關商品和交易 ✅
5. 報表頁可以展開本日交易明細 ✅
6. 斷網狀態也能匯出 ✅

**B. 合購折扣：最佳化（重點）**

| # | 購物車 | 原價 | 正確折扣 | 應收 | 說明 |
|---|---|---|---|---|---|
| B1 | 海報 ×1 | 220 | 0 | 220 | |
| B2 | 海報 ×2 | 440 | 40 | 400 | R1 |
| B3 | 海報 ×3 | 660 | 40 | 620 | R1＋1 張原價 |
| B4 | 海報 ×2＋書 ×1 | 1040 | 120 | 920 | R2（120）比 R1（40）划算，不能照排序先套 R1 |
| B5 | 海報 ×3＋書 ×1 | 1260 | 160 | 1100 | R2＋R1 同時套用 |
| B6 | 海報 ×4＋書 ×1 | 1480 | 160 | 1320 | R2＋R1＋1 張原價 |
| B7 | 海報 ×4＋書 ×2 | 2080 | 280 | 1800 | R2 ×2＋R1 ×1，同一活動套多次＋多活動並用 |
| B8 | 書 ×2 | 1200 | 0 | 1200 | 2 本書不能被當成 R2（驗證 slot 結構） |
| B9 | 海報 ×5 | 1100 | 80 | 1020 | R1 ×2 |

B10：把 R1 的 comboPrice 改成 500（比原價貴）→ 海報 ×2 應收 440，這組不能套用 ✅
B11：價格不同的商品。另外設海報D 250 元、R1 範圍改成 A＋D。購物車海報A ×1＋海報D ×2 → 應該湊 D＋D（折 100），不是 A＋D（折 70）✅
B12：購物車放 60 件、3 條規則 → 1 秒內算完，畫面不能卡住；觸發近似計算時要顯示提示 ✅

> 上面的數字都已經用獨立的暴力解程式驗算過
B10：購物車放 60 件、3 條規則 → 1 秒內算完，畫面不能卡住；觸發近似計算時要顯示提示 ✅

**C. 套組活動**
1. 大套組選海報A → 結帳 1200 → 海報A 庫存 3 → 2 ✅
2. 海報A 剩 1 張、購物車已有單賣海報A → 套組選單裡海報A 變灰 ✅
3. 大套組選 A、再點一次選 B → 購物車出現 2 行 ✅
4. 大套組＋海報 ×1 → 應收 1420（套組不參與合購）✅
5. 封存海報C → 套組選單不顯示海報C，活動列表出現 ⚠️ ✅

**D. 滿額禮與舊資料**
1. 海報 ×4＋書 ×1（折扣後 1320）→ 觸發「滿 1000 送小卡」✅
2. 海報 ×5（原價 1100、折扣後 1020）→ 觸發；海報 ×4（原價 880、折扣後 800）→ 不觸發 ✅
3. v1.0.0 的 v3 備份檔還原 → 成功；舊的合購特典變成 gift 模式的合購折扣，提醒行為不變 ✅

**E. 報表對帳**
1. 跑完 B、C 組後匯出：活動折抵、套用活動、套組內容欄位都正確 ✅
2. SUMMARY 的「實際出貨數量」有算到套組裡的海報 ✅
3. Σ 各商品金額 − 活動折抵 = 總銷售金額 ✅
4. 新版備份 → 還原 → 活動、套組都還在 ✅

---

## 11. 已定案的決策

| # | 問題 | 決策 |
|---|---|---|
| Q1 | 套組裡的商品算不算進合購折扣？ | 不算 |
| Q2 | 範圍內商品價格不同時怎麼湊組？ | 由最佳化演算法決定，保證總折扣最大 |
| Q3 | 預購 CSV 要不要支援套組選款？ | 這次只做警告 |
| Q4 | 一件商品符合多個活動時怎麼辦？ | **全購物車盤點，套用總折扣最大的組合，可以同時套多個活動**（第 7 節） |
| Q5 | 滿額禮用折扣前還是折扣後的金額？ | 折扣後 |
| Q6 | 報表格式？ | 一個 xlsx：流水帳＋SUMMARY＋類別分帳頁，保留舊 CSV 當備用 |

---

## 12. 完成後要更新的 Project FILES

| 檔案 | 動作 |
|---|---|
| `db.js`、`Sales.jsx`、`CheckoutModal.jsx`、`AdminProducts.jsx`、`Preorders.jsx`、`Reports.jsx`、`reporting.js`、`strings.js`、`package.json`、`vite.config.js` | 更新舊檔 |
| `src/lib/promo.js`、`BundlePickerModal.jsx`、`SlotEditor.jsx`、`src/lib/exportXlsx.js`（或 Claude Code 實際的命名）、測試檔 | 新增檔案 |
| P6 清理時刪掉的檔案 | 依清理報告從 FILES 移除 |
| `utakasse-playbook.md`、`UtaKasse_DevJournal_2026.md` | 更新舊檔 |
