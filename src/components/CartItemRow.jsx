import React from 'react';
import { ui } from '../lib/uiPalette.js';

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    padding: '16px 0',
    borderBottom: 'none',
  },
  left: { display: 'flex', alignItems: 'center', gap: 14, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: ui.primary },
  qtyPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 999,
    padding: '8px 12px',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    border: 'none',
    background: '#FFFFFF',
    fontSize: 20,
    fontWeight: 900,
    cursor: 'pointer',
  },
  trash: {
    border: 'none',
    backgroundColor: '#FFEDEE',
    color: ui.primary,
    padding: '10px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    fontSize: 16,
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
        <div style={{ ...styles.dot, backgroundColor: item?.color || ui.primary }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>{item?.name}</div>
          <div style={{ color: ui.muted, fontWeight: 700, fontSize: 12 }}>
            NT${item?.unitPrice ?? 0} / 件
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={styles.qtyPill}>
          <button
            type="button"
            style={styles.qtyBtn}
            onClick={onDec}
            disabled={!canDec}
          >
            -
          </button>
          <div style={{ minWidth: 24, textAlign: 'center', fontWeight: 900 }}>
            {item?.qty ?? 1}
          </div>
          <button
            type="button"
            style={styles.qtyBtn}
            onClick={onInc}
            disabled={!canInc}
          >
            +
          </button>
        </div>
        <button type="button" style={styles.trash} onClick={onRemove}>
          🗑️
        </button>
      </div>
    </div>
  );
}
