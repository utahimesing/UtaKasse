import { ui } from '../lib/uiPalette.js';

/**
 * 區塊標題（H2）：20px / 800，下方一條偏左的橘色粗色條（有目的的不對稱）
 */
export default function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 20, color: ui.ink, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ width: 48, height: 6, background: ui.orange, border: '2px solid #1A1A1A', marginTop: 6 }} />
        {subtitle && (
          <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12, marginTop: 6 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}
