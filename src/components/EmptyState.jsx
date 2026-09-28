import { ui } from '../lib/uiPalette.js';

/**
 * 空狀態：星爆 sticker 偏右上擺放（裝飾元素只允許放在空狀態、Header、報表頂部）
 */
const sticker = {
  position: 'absolute', top: 6, right: 14,
  width: 44, height: 44,
  background: ui.orange,
  clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  pointerEvents: 'none',
};

export default function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 8 }}>
      <div style={sticker} />
      <div style={{ fontSize: 36, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 17, color: ui.ink }}>{title}</div>
      {subtitle && <div style={{ fontWeight: 600, fontSize: 12, color: ui.muted, textAlign: 'center' }}>{subtitle}</div>}
    </div>
  );
}
