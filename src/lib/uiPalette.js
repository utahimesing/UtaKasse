/**
 * UtaKasse UI 色板 v3 — Wisteria Glass
 * Palette: Floral White / Lavender / Periwinkle / Wisteria Blue / Pearl Aqua
 */

// ─── 基礎色板 ───────────────────────────────────────────
export const ui = {
  bg:        '#F7F4EA',   // Floral White — 頁面底色
  surface:   '#DED9E2',   // Lavender — 次要面板底色
  accent:    '#C0B9DD',   // Periwinkle — 邊框、輕量強調
  primary:   '#80A1D4',   // Wisteria Blue — 主要操作
  success:   '#75C9C8',   // Pearl Aqua — 成功 / 確認
  danger:    '#5B4D8A',   // Deep Periwinkle — 取代珊瑚紅
  dangerText: '#FFFFFF',   // 深色背景用白字
  ink:       '#3D3060',   // 主文字（帶紫調深色）
  muted:     '#8B85A0',   // 次要文字
};

// ─── Design Tokens ──────────────────────────────────────
export const radius = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 999,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

export const fontSize = {
  xs:   10,
  sm:   12,
  md:   14,
  lg:   16,
  xl:   20,
  '2xl':28,
};

// ─── Glass 效果代幣 ─────────────────────────────────────
export const glass = {
  card: {
    background: 'rgba(255,255,255,0.52)',
    backdropFilter: 'blur(22px)',
    WebkitBackdropFilter: 'blur(22px)',
    border: '1px solid rgba(255,255,255,0.72)',
    boxShadow: '0 8px 32px rgba(128,161,212,0.16), 0 2px 8px rgba(192,185,221,0.10)',
  },
  modal: {
    background: 'rgba(255,255,255,0.70)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.80)',
    boxShadow: '0 16px 48px rgba(128,161,212,0.22), 0 4px 16px rgba(128,161,212,0.12)',
  },
  overlay: {
    background: 'rgba(247,244,234,0.88)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
  },
};

// ─── Button 代幣 ────────────────────────────────────────
export const buttonVariants = {
  primary: {
    background: 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
    color: '#FFFFFF',
    border: '1.5px solid rgba(255,255,255,0.35)',
    boxShadow: '0 8px 22px rgba(128,161,212,0.42)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.58)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    color: '#3D3060',
    border: '1.5px solid rgba(255,255,255,0.75)',
    boxShadow: '0 4px 16px rgba(128,161,212,0.14)',
  },
  ghost: {
    background: 'transparent',
    color: '#8B85A0',
    border: '1.5px solid rgba(139,133,160,0.35)',
  },
  destructive: {
    background: 'rgba(220,215,240,0.60)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: '#5B4D8A',
    border: '1.5px solid rgba(91,77,138,0.28)',
  },
  // destructive filled（用在確認刪除的二次確認按鈕）
  destructiveFilled: {
    background: 'linear-gradient(135deg, #7060A8 0%, #5B4D8A 100%)',
    color: '#FFFFFF',
    border: '1.5px solid rgba(255,255,255,0.25)',
    boxShadow: '0 6px 18px rgba(91,77,138,0.38)',
  },
  success: {
    background: 'linear-gradient(135deg, #8FD8D7 0%, #75C9C8 100%)',
    color: '#FFFFFF',
    border: '1.5px solid rgba(255,255,255,0.35)',
    boxShadow: '0 6px 20px rgba(117,201,200,0.42)',
  },
};

// ─── 舊代幣相容 ─────────────────────────────────────────
export const checkoutCta = {
  gradient: 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
  shadow:   '0 16px 30px rgba(128,161,212,0.48)',
};

export const cardShadowElevated =
  '0 8px 32px rgba(128,161,212,0.18), 0 2px 8px rgba(192,185,221,0.12)';

// ─── 商品顏色預設（9 種，更新為新色系） ───────────────
export const PRODUCT_COLOR_PRESETS = [
  '#C0B9DD',  // Periwinkle
  '#A8CCE8',  // Sky blue
  '#DED9E2',  // Lavender
  '#B0D8D8',  // Aqua tint
  '#80A1D4',  // Wisteria
  '#C8E2F0',  // Ice blue
  '#D4C8E8',  // Soft purple
  '#A0CCCC',  // Teal tint
  '#E8E4F4',  // Pale lavender
];

export const PRODUCT_PLACEHOLDER_BACKGROUNDS = [
  'rgba(192,185,221,0.32)',
  'rgba(117,201,200,0.26)',
];

export function productPlaceholderVariantIndex(productId) {
  const s = String(productId ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % PRODUCT_PLACEHOLDER_BACKGROUNDS.length;
}
