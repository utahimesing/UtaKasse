/**
 * UtaKasse UI 色板 v4 — Neo-Brutalism
 * Palette: Pop Orange / Apricot / White / Pale Mint / Teal ＋ Ink 結構色
 * CSS 端對應：src/index.css 的 :root 變數
 */

// ─── 基礎色板 ───────────────────────────────────────────
export const ui = {
  // 品牌色（5 色）
  orange:  '#FF9F1C',   // 主操作、結帳 CTA、Nav active、重點數字
  apricot: '#FFBF69',   // 選中狀態、hover、標籤、特典提示、數量 badge
  white:   '#FFFFFF',   // 卡片／面板／輸入框底色
  mint:    '#CBF3F0',   // 頁面底色、區塊分隔底色
  teal:    '#2EC4B6',   // 成功／確認、已完成狀態

  // 結構色
  ink:      '#1A1A1A',              // 主文字、所有邊框、硬陰影、危險操作底色
  muted:    '#4F5B5A',              // 次要文字、說明文字、placeholder
  lineSoft: 'rgba(26,26,26,0.12)',  // 唯一允許的半透明色：格線、表格分隔線
  rose:     '#D96868',              // 僅限 Toast 錯誤訊息

  // 語意別名（沿用舊 key，讓既有引用不必改）
  bg:         '#CBF3F0',
  surface:    '#FFFFFF',
  accent:     '#FFBF69',
  primary:    '#FF9F1C',
  success:    '#2EC4B6',
  danger:     '#1A1A1A',
  dangerText: '#FFFFFF',

  // disabled 專用
  disabledBg:     '#E6E6E6',
  disabledText:   '#8A8A8A',
  disabledBorder: '#8A8A8A',
};

// ─── Design Tokens ──────────────────────────────────────
export const radius = {
  sm:   4,
  md:   10,
  lg:   14,
  xl:   18,
  pill: 999,
};

export const fontSize = {
  xs:    11,
  sm:    12,
  md:    15,
  lg:    17,
  xl:    22,
  '2xl': 32,
  '3xl': 44,
};

export const border = {
  w:      2.5,
  wSm:    2,
  solid:  '2.5px solid #1A1A1A',
  solidSm:'2px solid #1A1A1A',
  dashed: '2.5px dashed #1A1A1A',
};

// 硬陰影：不模糊、不透明、不上色（destructiveFilled 例外用橘色）
export const shadow = {
  sm:   '3px 3px 0 #1A1A1A',
  md:   '5px 5px 0 #1A1A1A',
  lg:   '8px 8px 0 #1A1A1A',
  none: '0 0 0 #1A1A1A',
};

// ─── 面板代幣（取代舊 glass.*，實色＋黑框＋硬陰影） ───────
export const surface = {
  card: {
    background: ui.white,
    border: border.solid,
    borderRadius: radius.lg,
    boxShadow: shadow.md,
  },
  // 底部抽屜：只圓上方兩角
  sheet: {
    background: ui.white,
    border: border.solid,
    borderBottom: 'none',
    borderRadius: '18px 18px 0 0',
    boxShadow: shadow.lg,
  },
  // 遮罩：實色半透明，不模糊
  overlay: {
    background: 'rgba(26,26,26,0.45)',
  },
  // 資訊卡標題列色帶
  titleBar: {
    background: ui.apricot,
    borderBottom: border.solid,
  },
};

// ─── Button 代幣 ────────────────────────────────────────
// 共用：黑框、硬陰影 sm、字重 700、min-height 44、按下位移（index.css）
export const buttonVariants = {
  primary: {
    background: ui.orange,
    color: ui.ink,
    border: border.solid,
    boxShadow: shadow.sm,
  },
  secondary: {
    background: ui.white,
    color: ui.ink,
    border: border.solid,
    boxShadow: shadow.sm,
  },
  ghost: {
    background: 'transparent',
    color: ui.ink,
    border: border.solidSm,
    boxShadow: 'none',
  },
  success: {
    background: ui.teal,
    color: ui.ink,
    border: border.solid,
    boxShadow: shadow.sm,
  },
  // 輕量危險操作：白底＋黑色虛線框
  destructive: {
    background: ui.white,
    color: ui.ink,
    border: border.dashed,
    boxShadow: shadow.sm,
  },
  // 二次確認用：黑底白字，陰影改橘色
  destructiveFilled: {
    background: ui.ink,
    color: ui.white,
    border: border.solid,
    boxShadow: '3px 3px 0 #FF9F1C',
  },
  // disabled：灰底灰字灰框、無陰影、無按下效果
  disabled: {
    background: ui.disabledBg,
    color: ui.disabledText,
    border: `2px solid ${ui.disabledBorder}`,
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
};

// ─── 結帳 CTA：整個畫面最醒目的東西 ─────────────────────
export const checkoutCta = {
  background: ui.orange,
  color: ui.ink,
  border: border.solid,
  shadow: shadow.lg,
  fontSize: 20,
  fontWeight: 800,
};

// ─── 商品顏色預設（9 種） ─────────────────────────────
// 既有商品存的是舊色碼 → 不做 migration，舊顏色照樣顯示；新色板只影響之後新增的商品
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

export function productPlaceholderVariantIndex(productId) {
  const s = String(productId ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % PRODUCT_PLACEHOLDER_BACKGROUNDS.length;
}
