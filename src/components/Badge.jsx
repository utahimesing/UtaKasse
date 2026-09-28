import { ui, border } from '../lib/uiPalette.js';

/**
 * Badge / Pill 元件（Neo-Brutalism：黑框、實色底、黑字）
 * variant: 'new' | 'stock' | 'low' | 'sold' | 'bonus' | 'category' | 'category-active' | 'active' | 'inactive'
 * size: 'sm' | 'md'
 */
const variants = {
  // NEW 標籤：橘底＋微旋轉（有目的的不對稱）
  new:      { background: ui.orange,  color: ui.ink, border: border.solidSm, transform: 'rotate(-4deg)' },
  stock:    { background: ui.white,   color: ui.ink, border: border.solidSm },
  low:      { background: ui.apricot, color: ui.ink, border: border.solidSm },
  sold:     { background: ui.disabledBg, color: ui.disabledText, border: `2px solid ${ui.disabledBorder}`, textDecoration: 'line-through' },
  bonus:    { background: ui.apricot, color: ui.ink, border: border.solidSm },
  category: { background: ui.white,   color: ui.ink, border: border.solidSm },
  'category-active': { background: ui.apricot, color: ui.ink, border: border.solidSm },
  active:   { background: ui.teal,    color: ui.ink, border: border.solidSm },
  inactive: { background: ui.white,   color: ui.muted, border: border.solidSm },
};

const sizes = {
  sm: { fontSize: 11, padding: '3px 8px',  borderRadius: 999 },
  md: { fontSize: 12, padding: '5px 10px', borderRadius: 999 },
};

export default function Badge({ variant = 'stock', size = 'sm', children, style: extra }) {
  return (
    <span style={{
      display: 'inline-block', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap',
      ...sizes[size], ...variants[variant], ...extra,
    }}>
      {children}
    </span>
  );
}
