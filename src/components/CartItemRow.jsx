import { ui, border } from '../lib/uiPalette.js';
import { describeComponents, isBundleLine } from '../lib/cart.js';
import { t } from '../i18n/t.js';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: '14px 0',
    borderBottom: `1px solid ${ui.lineSoft}`,
  },
  left: { display: 'flex', alignItems: 'center', gap: 12, flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 999, border: border.solidSm, backgroundColor: ui.orange, flexShrink: 0 },
  qtyPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ui.white,
    border: border.solidSm,
    borderRadius: 999,
    padding: 3,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    color: ui.ink,
    fontSize: 20,
    fontWeight: 800,
    cursor: 'pointer',
    lineHeight: 1,
  },
  trash: {
    border: border.dashed,
    backgroundColor: ui.white,
    color: ui.ink,
    width: 44,
    height: 44,
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
};

export default function CartItemRow({
  item,
  onInc,
  onDec,
  onRemove,
  canDec,
  canInc,
}) {
  return (
    <div style={styles.row}>
      <div style={styles.left}>
        <div style={{ ...styles.dot, backgroundColor: item?.color || ui.orange }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: ui.ink }}>
            {isBundleLine(item) ? (
              <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, border: border.solidSm, background: ui.mint, marginRight: 4 }}>
                {t('sales.bundleBadge')}
              </span>
            ) : null}
            {item?.name}
          </div>
          {isBundleLine(item) ? (
            <div style={{ color: ui.muted, fontWeight: 600, fontSize: 11, lineHeight: 1.4 }}>{describeComponents(item.components)}</div>
          ) : null}
          <div style={{ color: ui.muted, fontWeight: 600, fontSize: 12 }}>
            NT${item?.unitPrice ?? 0} / 件
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={styles.qtyPill}>
          <button
            type="button"
            style={{ ...styles.qtyBtn, opacity: canDec ? 1 : 0.35 }}
            onClick={onDec}
            disabled={!canDec}
          >
            -
          </button>
          <div style={{ minWidth: 24, textAlign: 'center', fontWeight: 800, color: ui.ink }}>
            {item?.qty ?? 1}
          </div>
          <button
            type="button"
            style={{ ...styles.qtyBtn, opacity: canInc ? 1 : 0.35 }}
            onClick={onInc}
            disabled={!canInc}
          >
            +
          </button>
        </div>
        <button type="button" style={styles.trash} onClick={onRemove} aria-label="移除">
          🗑️
        </button>
      </div>
    </div>
  );
}
