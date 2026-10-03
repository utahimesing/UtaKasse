import { useState } from 'react';
import { t, tf } from '../i18n/t.js';
import { ui, border, shadow, surface } from '../lib/uiPalette.js';

/**
 * 報表頁「收攤對帳」兩張卡片（v1.1.2）：不用開 Excel 就能點錢箱、看商品出貨
 * - CashCard：收款方式拆分＋零用金＋錢箱應有
 * - ProductShippedCard：今天每個商品出貨幾個、現在還剩幾個（可收合）
 * 資料由 reportModel.buildCloseoutModel 算好傳進來。
 */
const S = {
  card: { ...surface.card, boxShadow: shadow.sm, padding: 16 },
  title: { fontWeight: 800, fontSize: 18, color: ui.ink },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8,
    padding: '8px 0', borderBottom: `1px solid ${ui.lineSoft}`,
  },
  amount: { fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap' },
  input: {
    width: '100%', boxSizing: 'border-box', marginTop: 6, minHeight: 44, padding: '10px 12px',
    borderRadius: 10, border: border.solidSm, background: ui.white, color: ui.ink,
    fontSize: 18, fontWeight: 800, fontFamily: 'inherit', textAlign: 'right',
  },
  drawer: {
    marginTop: 12, padding: 12, borderRadius: 12,
    background: ui.teal, border: border.solid, color: ui.ink,
  },
  head: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    padding: '12px 16px', width: '100%', boxSizing: 'border-box', minHeight: 44,
    border: 'none', background: ui.white, color: ui.ink, cursor: 'pointer',
    fontWeight: 800, fontSize: 17, fontFamily: 'inherit', textAlign: 'left',
  },
  badge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, border: border.solidSm, background: ui.mint, marginRight: 4 },
};

export function CashCard({ model, cashFloat, onSaveCashFloat, readOnly = false }) {
  // 輸入中的草稿；離開輸入框或按 Enter 才存。父層用 key（場次＋日期）讓切換時重置。
  const [draft, setDraft] = useState(cashFloat == null ? '' : String(cashFloat));
  const floatValue = Math.max(0, parseInt(draft, 10) || 0);
  const drawerTotal = floatValue + model.cashTotal;

  function commit() {
    const saved = cashFloat ?? 0;
    if (floatValue !== saved || (cashFloat == null && draft !== '')) onSaveCashFloat?.(floatValue);
  }

  return (
    <div style={S.card}>
      <div style={S.title}>{t('closeout.cashTitle')}</div>
      <div style={{ ...S.caption, marginTop: 4 }}>{t('closeout.cashHint')}</div>

      <div style={{ marginTop: 8 }}>
        {model.payments.length === 0 ? (
          <div style={{ ...S.caption, padding: '8px 0' }}>{t('closeout.noPayments')}</div>
        ) : (
          model.payments.map((p) => (
            <div key={p.name} style={S.row}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{p.isCash ? '💵 ' : '📱 '}{p.name}</span>
                <span style={{ ...S.caption, marginLeft: 6 }}>{tf('closeout.count', { n: p.count })}</span>
              </div>
              <div style={S.amount}>NT${p.amount}</div>
            </div>
          ))
        )}
        <div style={{ ...S.row, borderBottom: 'none' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{t('closeout.realTotal')}</div>
          <div style={{ ...S.amount, fontSize: 20 }}>NT${model.realTotal}</div>
        </div>
        {model.discountTotal > 0 ? (
          <div style={S.caption}>🏷️ {tf('closeout.discountNote', { amount: model.discountTotal })}</div>
        ) : null}
      </div>

      <div style={S.drawer}>
        <label style={{ display: 'block', fontWeight: 800, fontSize: 14 }}>
          {t('closeout.floatLabel')}
          <input
            type="text"
            inputMode="numeric"
            value={draft}
            disabled={readOnly}
            placeholder="0"
            onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ ...S.input, ...(readOnly ? { background: ui.disabledBg, color: ui.disabledText } : null) }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{t('closeout.drawerTotal')}</div>
          <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1 }}>NT${drawerTotal}</div>
        </div>
        <div style={{ ...S.caption, color: ui.ink, marginTop: 6 }}>
          {tf('closeout.drawerFormula', { float: floatValue, cash: model.cashTotal })}
        </div>
      </div>
    </div>
  );
}

export function ProductShippedCard({ model }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
      <button type="button" style={S.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{tf('closeout.productsTitle', { n: model.shippedTotal })}</span>
        <span style={{ fontSize: 13 }}>{open ? `▲ ${t('reports.collapse')}` : `▼ ${t('reports.expand')}`}</span>
      </button>
      {open ? (
        <div style={{ padding: '4px 16px 12px', borderTop: border.solidSm }}>
          <div style={{ ...S.caption, padding: '8px 0' }}>{t('closeout.productsHint')}</div>
          {model.products.length === 0 ? (
            <div style={{ ...S.caption, paddingBottom: 4 }}>{t('closeout.noProducts')}</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 16px', ...S.caption, paddingBottom: 4 }}>
                <span>{t('closeout.colName')}</span>
                <span style={{ textAlign: 'right' }}>{t('closeout.colShipped')}</span>
                <span style={{ textAlign: 'right', minWidth: 40 }}>{t('closeout.colStock')}</span>
              </div>
              {model.products.map((p) => (
                <div key={p.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 16px', alignItems: 'baseline', padding: '8px 0', borderTop: `1px solid ${ui.lineSoft}` }}>
                  <span style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>
                    {p.isBundle ? <span style={S.badge}>{t('sales.bundleBadge')}</span> : null}
                    {p.name}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 16, textAlign: 'right' }}>{p.shipped}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, textAlign: 'right', minWidth: 40 }}>
                    {p.stock == null ? t('closeout.unlimited') : p.stock === 0 ? t('product.soldOut') : p.stock}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
