# UtaKasse 視覺改版規格：Neo-Brutalism

> 版本 v1.0 ｜ 2026-09-24
> 取代：v3 Wisteria Glass（紫藤磨砂玻璃）
> 範圍：**只改視覺層**（CSS、樣式物件、色彩 token）。不動資料庫、商業邏輯、路由、文案與元件結構。

---

## 0. 給 Claude Code 的任務說明

請把 UtaKasse 的整體視覺從「Wisteria Glass（磨砂玻璃＋漸層光暈）」改成 **Neo-Brutalism**。

Neo-Brutalism 是經典 Brutalism 更乾淨、更有結構的版本：保留原始、直白的個性，但維持好用的 UI。這是一個**在攤位現場使用的收銀 App**，所以大膽歸大膽，可讀性與點擊準確度排第一。

**風格關鍵字**：高飽和色塊、粗黑框、硬陰影（不模糊）、大字、俐落版面、元件精簡、有目的的不對稱。
**情緒**：自信、大膽、原始但好用。

開始動手前，先完整讀過本檔，再依第 8 節順序執行。

---

## 1. 色板

### 1-1 品牌色（指定色板，共 5 色）

| Token | HEX | 名稱 | 用途 |
|---|---|---|---|
| `--orange` | `#FF9F1C` | Pop Orange | **主操作**：主要按鈕、結帳 CTA、Nav active、重點數字 |
| `--apricot` | `#FFBF69` | Apricot | **次要強調**：選中狀態、hover、標籤、特典提示、數量 badge |
| `--white` | `#FFFFFF` | White | **卡片／面板底色**、輸入框底色 |
| `--mint` | `#CBF3F0` | Pale Mint | **頁面底色**、區塊分隔底色 |
| `--teal` | `#2EC4B6` | Teal | **成功／確認**、已完成狀態、次要按鈕強調 |

### 1-2 結構色（Neo-Brutalism 必要，非品牌色）

| Token | HEX | 用途 |
|---|---|---|
| `--ink` | `#1A1A1A` | 主文字、**所有邊框**、硬陰影、危險操作按鈕底色 |
| `--muted` | `#4F5B5A` | 次要文字、說明文字、placeholder |
| `--line-soft` | `rgba(26,26,26,0.12)` | 背景格線、表格內分隔線（唯一允許的半透明色） |
| `--rose` | `#D96868` | **僅限 Toast 錯誤訊息**（沿用既有規則，不可用在其他地方） |

### 1-3 色彩分工（取代舊規則）

| 狀態 | 新做法 | 舊做法（刪除） |
|---|---|---|
| 主操作 | `#FF9F1C` 底＋`#1A1A1A` 黑字＋黑框＋硬陰影 | 鋼藍漸層 `#9BBCE8 → #80A1D4`＋白字 |
| 次要／選中 | `#FFBF69` 底＋黑字＋黑框 | 淡藍／薰衣草 |
| 成功／確認 | `#2EC4B6` 底＋黑字＋黑框 | 橄欖綠 `#4A8840`／`#75C9C8` |
| 危險操作 | `#1A1A1A` 底＋白字＋黑框＋⚠ 圖示（二次確認按鈕） | 深紫藍 `#5B4D8A` |
| 危險操作（輕量） | 白底＋黑字＋**黑色虛線框** `2.5px dashed` | 淡紫半透明 |
| 裝飾／標籤 | `#FFBF69` 或 `#CBF3F0` 底＋黑框 | 薰衣草 `#C0B9DD` |
| Toast 錯誤 | `#D96868` 底＋白字＋黑框＋硬陰影 | 同色，但加上框與陰影 |

### 1-4 ⚠️ 對比度鐵則（必讀）

- `#FF9F1C`、`#FFBF69`、`#2EC4B6`、`#CBF3F0` 上面的文字**一律用 `#1A1A1A` 黑字**。
  原因：白字放在橘色／青綠上對比度只有約 2:1，在攤位強光下會看不清楚。
- 白字只允許出現在 `#1A1A1A`（危險按鈕）與 `#D96868`（Toast）上。
- 金額、數量、總計等**數字一律黑字**，必要時放在白底或橘底色塊上。

---

## 2. 字體與排版

- 字型：**維持 DM Sans 全站統一**（不新增字型）。
  中文 fallback：`'DM Sans', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`
- 用「字重＋字級反差」做出 Neo-Brutalism 的大字感，而不是換字型。

| 層級 | 字級 | 字重 | 其他 |
|---|---|---|---|
| Display（結帳總額、報表總營收） | 40–48px | 800 | `letter-spacing: -0.02em`、`line-height: 1` |
| H1（頁面標題） | 28px | 800 | `letter-spacing: -0.01em` |
| H2（區塊標題） | 20px | 800 | 可大寫英文標籤 |
| Body | 15–16px | 500 | `line-height: 1.5` |
| Label／按鈕 | 14–16px | 700 | 英文用 `text-transform: uppercase; letter-spacing: 0.04em` |
| Caption | 12px | 600 | 顏色 `--muted` |

fontSize token 更新：`xs 11 / sm 12 / md 15 / lg 17 / xl 22 / 2xl 32 / 3xl 44`

---

## 3. 核心視覺元素（Design Tokens）

### 3-1 邊框

```css
--border-w:      2.5px;
--border-w-sm:   2px;      /* chip、小 badge、表格 */
--border:        2.5px solid #1A1A1A;
--border-sm:     2px solid #1A1A1A;
```
所有卡片、按鈕、輸入框、Header、Nav、Modal、Toast 都要有黑框。

### 3-2 硬陰影（不模糊、不透明）

```css
--shadow-sm:  3px 3px 0 #1A1A1A;
--shadow-md:  5px 5px 0 #1A1A1A;
--shadow-lg:  8px 8px 0 #1A1A1A;   /* Modal、底部抽屜 */
```
- **禁止** blur 值大於 0 的陰影、禁止彩色陰影、禁止 rgba 陰影。
- 按下回饋（取代原本 `scale(0.96)`）：
  ```css
  button:active:not(:disabled) {
    transform: translate(3px, 3px);
    box-shadow: 0 0 0 #1A1A1A;
  }
  ```
  → 視覺上像按鈕被「壓下去」，這是 Neo-Brutalism 的招牌互動。

### 3-3 圓角（整體收小）

```css
--radius-sm:   4px;
--radius-md:   10px;
--radius-lg:   14px;
--radius-xl:   18px;
--radius-pill: 999px;   /* 只給 chip／tag 用 */
```

### 3-4 間距

spacing token 維持不變（4 / 8 / 12 / 16 / 24 / 32），但**卡片內距最少 16px**，Neo-Brutalism 需要呼吸空間，不然黑框會擠。

---

## 4. 全域移除清單（Glass 風格全面退場）

以下全部刪除或改寫，全專案 grep 確認：

1. `backdrop-filter`、`-webkit-backdrop-filter`、`backdropFilter`、`WebkitBackdropFilter` → **全部刪除**
2. `--glass-bg`、`--glass-border`、`--blur-lg`、`--blur-md` 與 `glass.*` 物件 → 刪除或改寫成實色 token
3. `body::before` 的 Wisteria Aurora 5 層 radial-gradient → 改成第 5-1 節的格線背景
4. 所有 `linear-gradient` 按鈕漸層 → 改實色
5. 舊色值全部替換（grep 關鍵字）：
   `#80A1D4`、`#9BBCE8`、`#5B4D8A`、`#7060A8`、`#C0B9DD`、`#DED9E2`、`#F7F4EA`、`#3D3060`、`#8B85A0`、`#75C9C8`、`#8FD8D7`、`#4A8840`、`#A8CCE8`、`#B0D8D8`、`#C8E2F0`、`#D4C8E8`、`#A0CCCC`、`#E8E4F4`、`#EEE9F8`、`#E4F2F2`、`#EEF0FA`
   以及 `rgba(128,161,212,`、`rgba(192,185,221,`、`rgba(117,201,200,`、`rgba(91,77,138,`、`rgba(220,215,240,`、`rgba(255,255,255,0.`
6. `index.css` 裡的 hack 選擇器 `div[style*="border-radius: 28px 28px 0 0"]` → 刪除，改在底部抽屜元件本身用新 token 寫樣式
7. `index.css` 的 `:root` 裡 `--success` 重複宣告兩次 → 合併成一個

---

## 5. 版面與元件規格

### 5-1 全頁背景

```css
body { background: #CBF3F0; }
body::before {
  content: '';
  position: fixed; inset: 0;
  z-index: -1; pointer-events: none;
  background-color: #CBF3F0;
  background-image:
    linear-gradient(rgba(26,26,26,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(26,26,26,0.07) 1px, transparent 1px);
  background-size: 24px 24px;
}
```
→ 參考圖 1、2 的方格紙背景。格線要淡，不可搶內容。

### 5-2 Header（sticky top）

- 底色 `#FFFFFF`、`border: var(--border)`、`box-shadow: var(--shadow-md)`、圓角 `0 0 18px 18px`
- 移除玻璃磨砂
- Logo 區可加一個 `#FF9F1C` 色塊或小 sticker（見 5-10）
- 「聯絡開發者」「斗內開發者」改成小型 outline 按鈕：白底＋黑框＋`--shadow-sm`

### 5-3 底部浮島 Nav（fixed bottom，4 tab）

- 容器：`#FFFFFF` 底、`var(--border)`、`var(--shadow-md)`、圓角 18px
- 未選中 tab：透明底、黑字、字重 700
- **選中 tab**：`#FF9F1C` 底＋黑字＋`var(--border-sm)`＋圓角 10px（取代鋼藍漸層＋白字）
- icon 與文字都用 `#1A1A1A`
- tab 結構、順序、點擊區域大小不變

### 5-4 Content 區

- padding 維持 `20px 18px 94px`（底部留給 Nav）
- 區塊之間間距 20–24px

### 5-5 卡片（商品卡、預購單卡、報表卡）

```
background: #FFFFFF;
border: var(--border);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-md);
padding: 16px;
```
- 商品卡被選中／加入購物車：底色改 `#FFBF69`
- 卡片標題列可加一條 `#CBF3F0` 或 `#FFBF69` 色帶＋下方黑線分隔（參考圖 2 的視窗標題列），**只用在資訊卡，收銀台商品卡保持簡潔**

### 5-6 按鈕（Button.jsx / buttonVariants）

所有 variant 共用：`border: var(--border)`、`box-shadow: var(--shadow-sm)`、`font-weight: 700`、`min-height: 44px`、按下效果見 3-2。

| Variant | 底色 | 文字 | 框 |
|---|---|---|---|
| `primary` | `#FF9F1C` | `#1A1A1A` | 實線黑框 |
| `secondary` | `#FFFFFF` | `#1A1A1A` | 實線黑框 |
| `ghost` | transparent | `#1A1A1A` | `2px solid #1A1A1A`，無陰影 |
| `success` | `#2EC4B6` | `#1A1A1A` | 實線黑框 |
| `destructive` | `#FFFFFF` | `#1A1A1A` | `2.5px dashed #1A1A1A` |
| `destructiveFilled` | `#1A1A1A` | `#FFFFFF` | 實線黑框，陰影改 `3px 3px 0 #FF9F1C` |
| `disabled`（新增規則） | `#E6E6E6` | `#8A8A8A` | `2px solid #8A8A8A`，無陰影，無按下效果 |

- 結帳 CTA（`checkoutCta`）：`#FF9F1C` 實色、`var(--shadow-lg)`、字級 20px／800，要是整個畫面最醒目的東西
- 刪除 `checkoutCta.gradient` 的漸層，改 `background: '#FF9F1C'`

### 5-7 輸入框 / select / textarea

- `#FFFFFF` 底、`var(--border-sm)`、圓角 `--radius-md`、高度 ≥ 44px
- focus：`outline: none; box-shadow: 3px 3px 0 #FF9F1C;` 框維持黑色
- placeholder 顏色 `--muted`
- 注意：先前稽核修過 select 重複 border 宣告，改版時不要又寫出重複宣告

### 5-8 Modal / CheckoutModal / 底部抽屜

- 遮罩：`rgba(26,26,26,0.45)` 實色遮罩，**不模糊**
- 面板：`#FFFFFF`、`var(--border)`、`var(--shadow-lg)`
- 底部抽屜圓角 `18px 18px 0 0`
- 可選：面板頂端做「復古視窗標題列」── 一條 `#FFBF69` 色帶＋黑色底線＋右側 ✕ 關閉鈕（參考圖 2），標題文字 800 字重

### 5-9 Chip / Tag / Badge（類別篩選、付款方式、訂單狀態）

- 圓角 `--radius-pill`、`var(--border-sm)`、字重 700、高度 32px
- 未選中：`#FFFFFF`；選中：`#FFBF69`
- 狀態 badge：已完成 `#2EC4B6`、待處理 `#FFBF69`、已取消 `#FFFFFF`＋刪除線文字
- 「NEW」商品標籤：`#FF9F1C` 底＋黑框，可 `transform: rotate(-4deg)`（有目的的不對稱）

### 5-10 裝飾元素（克制使用）

- **Sticker**：星爆形／圓形色塊，`#FF9F1C` 或 `#2EC4B6`＋黑框，用 CSS `clip-path` 或 inline SVG 製作
- 只能放在：Header Logo 旁、空狀態畫面（無商品／無訂單）、報表頁頂部
- **禁止**放在收銀台商品格、結帳流程、任何可點擊元素上面，避免誤觸或干擾結帳

### 5-11 Toast

- 成功：`#2EC4B6` 底＋黑字＋黑框＋`--shadow-sm`
- 一般資訊：`#FFFFFF` 底＋黑字＋黑框＋`--shadow-sm`
- 錯誤：`#D96868` 底＋白字＋黑框＋`--shadow-sm`（`--rose` 唯一合法使用處）

### 5-12 報表頁數字與圖表

- 總營收用 Display 字級，放在 `#FF9F1C` 色塊卡片裡
- 次要指標卡用 `#FFFFFF`，指標標籤用 Caption
- 若有圖表，系列色依序：`#FF9F1C`、`#2EC4B6`、`#FFBF69`、`#1A1A1A`，長條加 `2px` 黑框

### 5-13 商品顏色預設（PRODUCT_COLOR_PRESETS，9 色）

```js
export const PRODUCT_COLOR_PRESETS = [
  '#FF9F1C',  // Pop Orange
  '#FFBF69',  // Apricot
  '#2EC4B6',  // Teal
  '#CBF3F0',  // Pale Mint
  '#FFFFFF',  // White
  '#FFD9A8',  // Apricot tint
  '#8FE0D8',  // Teal tint
  '#FFE8C7',  // Cream orange
  '#E4FAF8',  // Mint tint
];

export const PRODUCT_PLACEHOLDER_BACKGROUNDS = ['#FFBF69', '#CBF3F0'];
```
⚠ 使用者既有商品存的是舊色碼 → **不要寫 migration 改資料庫**，舊顏色照樣顯示即可；新色板只影響之後新增的商品。

---

## 6. 有目的的不對稱（Purposeful Asymmetry）

可以做，但只做在「非操作區」：
1. 頁面 H1 標題下方加一條偏左的粗色條（`#FF9F1C`，寬 48px、高 6px）
2. 空狀態插圖／sticker 偏右上擺放
3. NEW 標籤、特典提示微旋轉 −3° 到 −4°

**不可以**：歪斜按鈕、歪斜輸入框、讓金額或數量不對齊。

---

## 7. 可用性底線（不可為了風格犧牲）

1. 所有可點擊元素最小 44×44px
2. 金額、數量、總計文字對比度 ≥ 7:1（黑字在白／橘／青綠底上皆符合）
3. 375px 寬的手機畫面不可出現水平捲動（黑框＋硬陰影會多吃 5–8px 寬度，記得算進去）
4. 離線與 PWA 行為不變
5. `vite.config.js` 的 PWA manifest `theme_color` 與 `background_color`、`index.html` 的 `<meta name="theme-color">` 同步改成 `#FF9F1C`／`#CBF3F0`

---

## 8. 執行順序

1. **`src/index.css`**：重寫 `:root` token（第 1、3 節）、全域 `button` 按下效果、`body::before` 背景（5-1）、刪除 glass 相關 class 與 hack 選擇器
2. **`src/uiPalette.js`**：`ui` 物件換新色；`glass` 物件改名或改寫成 `surface`（實色＋黑框＋硬陰影）；`buttonVariants`、`checkoutCta`、`cardShadowElevated`、`PRODUCT_COLOR_PRESETS`、`fontSize` 依本檔更新；檔頭註解改成 `UtaKasse UI 色板 v4 — Neo-Brutalism`
3. **全專案 grep** 第 4 節的舊色碼與 blur 關鍵字，列出所有命中檔案與行號，再逐一替換
4. **`Button.jsx`**：套用新 variant 與 disabled 規則
5. **`App.jsx` / `App.css`**：Header、浮島 Nav
6. **頁面**：`Sales.jsx` → `CheckoutModal.jsx` → `Preorders.jsx` → `Reports.jsx` → `AdminProducts.jsx`
7. **`useToast.js`** 相關樣式
8. **`vite.config.js`、`index.html`**：theme-color
9. 跑 `npm run build`，確認無錯誤

每完成一個步驟，簡短回報改了哪些檔案。

---

## 9. 驗收條件

- [ ] 全專案 grep `backdrop-filter`、`backdropFilter`、`blur(` → **0 筆**
- [ ] 全專案 grep 第 4 節列出的舊色碼 → **0 筆**（`#D96868` 除外，且只出現在 Toast 錯誤）
- [ ] 所有按鈕、卡片、輸入框、Header、Nav、Modal 都有黑框＋硬陰影（blur 為 0）
- [ ] 橘、杏、青綠、薄荷底上沒有白字
- [ ] 按鈕按下有「位移＋陰影消失」回饋
- [ ] 375px 寬度無水平捲動；結帳流程可完整走完
- [ ] `npm run build` 成功
- [ ] 資料庫（`db.js`）、`reporting.js`、`googleDrive.js` **零改動**

---

## 10. 下次更新觸發條件

- 新增元件類型（例：圖表、日期選擇器）時補充規格
- 若決定引入 display 字型（取代純 DM Sans）
- 若 `#D96868` 錯誤色決定改用其他色
