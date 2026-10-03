import { useState } from 'react';
import { t, tf } from '../i18n/t.js';
import { ui, border, shadow, surface } from '../lib/uiPalette.js';
import { calcTxKind, getTxPaymentLabel } from '../lib/reporting.js';
import { describeTxItems, describeTxActivities, txDiscountTotal } from '../lib/reportModel.js';
import { isVoided, VOID_REASON_PRESETS, VOID_REASON_MAX } from '../lib/voidTx.js';
import { getTaipeiTimeHMS } from '../lib/dateTaipei.js';
import Button from './Button.jsx';

/**
 * 報表頁「本日交易明細」：可收合，最新的在最上面。
 * v1.1.1：每筆可「作廢」（兩段確認：按作廢 → 確定作廢）；作廢的保留顯示、加刪除線。
 * readOnly（封存場次）時不顯示作廢按鈕。
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
  voidBadge: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, border: border.solidSm, background: ui.white, color: ui.ink },
  strike: { textDecoration: 'line-through', color: ui.muted },
  voidBtn: {
    minHeight: 44, minWidth: 64, padding: '0 14px', borderRadius: 10,
    border: border.dashed, background: ui.white, color: ui.ink,
    fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
  },
  panel: { marginTop: 10, padding: 12, borderRadius: 10, border: border.solid, background: ui.apricot },
  chip: (active) => ({
    minHeight: 36, padding: '0 12px', borderRadius: 999, border: border.solidSm,
    background: active ? ui.ink : ui.white, color: active ? ui.white : ui.ink,
    fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
  }),
  input: {
    width: '100%', boxSizing: 'border-box', marginTop: 6, minHeight: 44, padding: '10px 12px',
    borderRadius: 10, border: border.solidSm, background: ui.white, color: ui.ink,
    fontSize: 16, fontWeight: 600, fontFamily: 'inherit',
  },
};

export default function TxDetailList({ transactions, dateKey, onVoid, readOnly = false }) {
  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const txs = (transactions ?? [])
    .filter((tx) => tx.date === dateKey)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const voidedCount = txs.filter(isVoided).length;
  const canVoid = !readOnly && typeof onVoid === 'function';

  function startVoid(txId) {
    setConfirmingId(txId);
    setReason('');
  }

  async function confirmVoid(tx) {
    if (busy) return;
    setBusy(true);
    try {
      await onVoid(tx, reason);
      setConfirmingId(null);
      setReason('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={S.wrap}>
      <button type="button" style={S.head} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          {t('reports.txDetailTitle')}（{txs.length - voidedCount}）
          {voidedCount > 0 ? <span style={{ ...S.caption, color: ui.ink, marginLeft: 6 }}>{tf('reports.voidedCount', { n: voidedCount })}</span> : null}
        </span>
        <span style={{ fontSize: 13 }}>{open ? `▲ ${t('reports.collapse')}` : `▼ ${t('reports.expand')}`}</span>
      </button>
      {open ? (
        <div style={{ padding: 12, background: ui.mint }}>
          {txs.length === 0 ? (
            <div style={S.caption}>{t('reports.txDetailEmpty')}</div>
          ) : (
            txs.map((tx, idx) => {
              const voided = isVoided(tx);
              const discount = txDiscountTotal(tx);
              const activities = describeTxActivities(tx);
              const confirming = confirmingId === tx.id;
              return (
                <div key={tx.id ?? idx} style={{ ...S.card, marginBottom: idx === txs.length - 1 ? 0 : 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>
                      <span style={voided ? S.strike : null}>#{tx.receiptNo ?? '—'}</span>
                      <span style={{ ...S.caption, marginLeft: 8 }}>{tx.time ?? ''}</span>
                      <span style={{ ...S.kind, marginLeft: 8 }}>{calcTxKind(tx)}</span>
                      {voided ? <span style={{ ...S.voidBadge, marginLeft: 6 }}>{t('void.badge')}</span> : null}
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 17, ...(voided ? S.strike : null) }}>NT${tx.subtotal ?? 0}</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 600, fontSize: 14, lineHeight: 1.5, ...(voided ? S.strike : null) }}>{describeTxItems(tx)}</div>
                  {discount > 0 ? (
                    <div style={{ ...S.caption, marginTop: 4 }}>🏷️ {t('reports.discountLabel')} −NT${discount}</div>
                  ) : null}
                  {activities ? (
                    <div style={{ ...S.caption, marginTop: 4 }}>🎁 {activities}</div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <div style={S.caption}>
                      {getTxPaymentLabel(tx)}{tx.note ? `・${tx.note}` : ''}
                    </div>
                    {canVoid && !voided && !confirming ? (
                      <button type="button" style={S.voidBtn} onClick={() => startVoid(tx.id)}>{t('void.button')}</button>
                    ) : null}
                  </div>
                  {voided ? (
                    <div style={{ ...S.caption, marginTop: 6, color: ui.ink }}>
                      ✕ {tf('void.at', { time: Number.isFinite(tx.voidedAt) ? getTaipeiTimeHMS(new Date(tx.voidedAt)) : '' })}
                      {tx.voidReason ? `・${tx.voidReason}` : ''}
                    </div>
                  ) : null}
                  {confirming ? (
                    <VoidPanel
                      tx={tx}
                      reason={reason}
                      setReason={setReason}
                      busy={busy}
                      onBack={() => setConfirmingId(null)}
                      onConfirm={() => confirmVoid(tx)}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function VoidPanel({ tx, reason, setReason, busy, onBack, onConfirm }) {
  const amount = tx.subtotal ?? 0;
  const isPreorder = tx.type === 'preorder_pickup';
  const effects = [t('void.effectKeep'), t('void.effectReport'), t('void.effectStock')];
  if (isPreorder) effects.push(t('void.effectPreorder'), t('void.effectAddOn'));

  return (
    <div style={S.panel} role="group" aria-label={t('void.confirm')}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>
        {tf('void.confirmTitle', { no: tx.receiptNo ?? '—', amount })}
      </div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, fontWeight: 600, lineHeight: 1.6 }}>
        {effects.map((e) => <li key={e}>{e}</li>)}
      </ul>
      {amount > 0 ? (
        <div style={{ marginTop: 8, fontWeight: 800, fontSize: 14 }}>
          💰 {tf('void.refundHint', { amount, method: getTxPaymentLabel(tx) || '—' })}
        </div>
      ) : null}
      <div style={{ marginTop: 10, fontWeight: 800, fontSize: 13 }}>{t('void.reasonLabel')}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        {VOID_REASON_PRESETS.map((r) => (
          <button key={r} type="button" style={S.chip(reason === r)} onClick={() => setReason(reason === r ? '' : r)}>{r}</button>
        ))}
      </div>
      <input
        type="text"
        value={reason}
        maxLength={VOID_REASON_MAX}
        placeholder={t('void.reasonPlaceholder')}
        onChange={(e) => setReason(e.target.value)}
        style={S.input}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Button variant="secondary" onClick={onBack} disabled={busy} style={{ flex: 1 }}>{t('void.back')}</Button>
        <Button variant="destructiveFilled" onClick={onConfirm} loading={busy} style={{ flex: 1 }}>{t('void.confirm')}</Button>
      </div>
    </div>
  );
}
