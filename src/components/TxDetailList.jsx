import { useState } from 'react';
import { t } from '../i18n/t.js';
import { ui, border, shadow, surface } from '../lib/uiPalette.js';
import { calcTxKind, getTxPaymentLabel } from '../lib/reporting.js';
import { describeTxItems, describeTxActivities, txDiscountTotal } from '../lib/reportModel.js';

/**
 * 報表頁「本日交易明細」：可收合，最新的在最上面，只能看不能改。
 */
const S = {
  wrap: { ...surface.card, boxShadow: shadow.sm, padding: 0, overflow: 'hidden' },
  head: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    padding: '12px 16px', width: '100%', boxSizing: 'border-box',
    border: 'none', borderBottom: border.solid, background: ui.apricot, color: ui.ink,
    fontWeight: 800, fontSize: 17, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 44,
  },
  card: { border: border.solidSm, borderRadius: 10, padding: 12, background: ui.white, marginBottom: 10 },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
  kind: { display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: border.solidSm, background: ui.mint },
};

export default function TxDetailList({ transactions, dateKey }) {
  const [open, setOpen] = useState(false);
  const txs = (transactions ?? [])
    .filter((tx) => tx.date === dateKey)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <div style={S.wrap}>
      <button type="button" style={S.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{t('reports.txDetailTitle')}（{txs.length}）</span>
        <span style={{ fontSize: 13 }}>{open ? `▲ ${t('reports.collapse')}` : `▼ ${t('reports.expand')}`}</span>
      </button>
      {open ? (
        <div style={{ padding: 12, background: ui.mint }}>
          {txs.length === 0 ? (
            <div style={S.caption}>{t('reports.txDetailEmpty')}</div>
          ) : (
            txs.map((tx, idx) => {
              const discount = txDiscountTotal(tx);
              const activities = describeTxActivities(tx);
              return (
                <div key={tx.id ?? idx} style={{ ...S.card, marginBottom: idx === txs.length - 1 ? 0 : 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>
                      #{tx.receiptNo ?? '—'}
                      <span style={{ ...S.caption, marginLeft: 8 }}>{tx.time ?? ''}</span>
                      <span style={{ ...S.kind, marginLeft: 8 }}>{calcTxKind(tx)}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>NT${tx.subtotal ?? 0}</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14, lineHeight: 1.5 }}>{describeTxItems(tx)}</div>
                  {discount > 0 ? (
                    <div style={{ ...S.caption, marginTop: 4 }}>🏷️ {t('reports.discountLabel')} −NT${discount}</div>
                  ) : null}
                  {activities ? (
                    <div style={{ ...S.caption, marginTop: 4 }}>🎁 {activities}</div>
                  ) : null}
                  <div style={{ ...S.caption, marginTop: 4 }}>
                    {getTxPaymentLabel(tx)}{tx.note ? `・${tx.note}` : ''}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
