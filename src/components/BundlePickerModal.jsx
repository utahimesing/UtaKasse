import { useMemo, useState } from 'react';
import { t, tf } from '../i18n/t.js';
import Button from './Button.jsx';
import { ui, border, shadow, surface } from '../lib/uiPalette.js';
import { remainingStock } from '../lib/cart.js';

/**
 * 套組選款彈窗
 * - 每個欄位列出可選商品與剩餘庫存，售完的變灰
 * - 每欄選滿打 ✅，全部選滿「加入購物車」才能按
 * - 固定內容物（欄位只有 1 個可選商品）自動選好
 * - 庫存合併檢查：單賣行、購物車裡其他套組、這個視窗內其他欄位選的，全部合併計算
 */
const S = {
  scrim: { position: 'fixed', inset: 0, zIndex: 9990, ...surface.overlay, display: 'flex', alignItems: 'flex-end' },
  sheet: {
    width: '100%', boxSizing: 'border-box', ...surface.sheet, boxShadow: 'none',
    maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: ui.mint,
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px 10px 18px', ...surface.titleBar, flexShrink: 0 },
  body: { overflowY: 'auto', padding: 16, flex: 1 },
  slotCard: { ...surface.card, boxShadow: shadow.sm, padding: 12, marginBottom: 12 },
  chip: (state) => ({
    minHeight: 44, padding: '6px 12px', borderRadius: 10, fontWeight: 700, fontSize: 13,
    cursor: state === 'disabled' ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    border: state === 'disabled' ? `2px solid ${ui.disabledBorder}` : border.solidSm,
    background: state === 'picked' ? ui.apricot : state === 'disabled' ? ui.disabledBg : ui.white,
    color: state === 'disabled' ? ui.disabledText : ui.ink,
    boxShadow: state === 'picked' ? shadow.sm : 'none',
    display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left',
  }),
  minus: {
    width: 36, height: 36, borderRadius: 999, border: border.solidSm, background: ui.white, color: ui.ink,
    fontWeight: 800, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0,
  },
  footer: { padding: '12px 16px max(16px, env(safe-area-inset-bottom, 16px))', borderTop: border.solid, background: ui.white, flexShrink: 0 },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
};

function initialPicks(slots, poolOf) {
  const picks = {};
  for (const slot of slots) {
    const pool = poolOf(slot);
    picks[slot.id] = {};
    if (pool.length === 1) picks[slot.id][pool[0].id] = Math.max(1, slot.pickQty ?? 1);
  }
  return picks;
}

export default function BundlePickerModal({ product, products, cart, getStock, onConfirm, onClose }) {
  const slots = useMemo(() => (Array.isArray(product?.bundleSlots) ? product.bundleSlots : []), [product]);
  const productsById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const poolOf = (slot) => (slot.poolProductIds ?? [])
    .map((id) => productsById.get(id))
    .filter((p) => p && !p.archived && (p.type ?? 'single') === 'single');

  const [picks, setPicks] = useState(() => initialPicks(slots, poolOf));

  // 這個視窗內已選的用量（所有欄位合併）
  const pickedUsage = useMemo(() => {
    const m = new Map();
    for (const slotPicks of Object.values(picks)) {
      for (const [pid, n] of Object.entries(slotPicks)) m.set(pid, (m.get(pid) ?? 0) + n);
    }
    return m;
  }, [picks]);

  const bundleRemaining = remainingStock(product.id, cart, getStock);
  const bundleSoldOut = typeof bundleRemaining === 'number' && bundleRemaining < 1;

  const countInSlot = (slotId) => Object.values(picks[slotId] ?? {}).reduce((s, n) => s + n, 0);
  const allFilled = slots.length > 0 && slots.every((s) => countInSlot(s.id) >= Math.max(1, s.pickQty ?? 1));

  function remainingFor(pid) {
    return remainingStock(pid, cart, getStock, { extraUsage: pickedUsage });
  }

  function pick(slot, pid) {
    const need = Math.max(1, slot.pickQty ?? 1);
    if (countInSlot(slot.id) >= need) return;
    const rem = remainingFor(pid);
    if (typeof rem === 'number' && rem < 1) return;
    const cur = picks[slot.id]?.[pid] ?? 0;
    if (cur >= 1 && slot.allowDuplicate === false) return;
    setPicks((prev) => ({ ...prev, [slot.id]: { ...(prev[slot.id] ?? {}), [pid]: cur + 1 } }));
  }

  function unpick(slot, pid) {
    const cur = picks[slot.id]?.[pid] ?? 0;
    if (cur <= 0) return;
    setPicks((prev) => {
      const next = { ...(prev[slot.id] ?? {}) };
      if (cur - 1 <= 0) delete next[pid];
      else next[pid] = cur - 1;
      return { ...prev, [slot.id]: next };
    });
  }

  function confirm() {
    if (!allFilled || bundleSoldOut) return;
    const merged = new Map();
    for (const slotPicks of Object.values(picks)) {
      for (const [pid, n] of Object.entries(slotPicks)) {
        const cur = merged.get(pid) ?? { productId: pid, productName: productsById.get(pid)?.name ?? pid, qty: 0 };
        cur.qty += n;
        merged.set(pid, cur);
      }
    }
    onConfirm([...merged.values()]);
  }

  return (
    <div style={S.scrim} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{t('bundle.title')}</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{product.name}・NT${product.price}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose} aria-label={t('common.close')}>✕</Button>
        </div>

        <div style={S.body}>
          {bundleSoldOut ? (
            <div style={{ ...S.slotCard, background: ui.apricot, fontWeight: 700 }}>{t('bundle.bundleSoldOut')}</div>
          ) : null}
          {slots.map((slot) => {
            const need = Math.max(1, slot.pickQty ?? 1);
            const got = countInSlot(slot.id);
            const pool = poolOf(slot);
            const fixed = pool.length === 1;
            return (
              <div key={slot.id} style={S.slotCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>
                    {got >= need ? '✅ ' : ''}{slot.label || t('bundle.contents')}
                  </div>
                  <div style={S.caption}>{fixed ? t('bundle.fixed') : `${tf('bundle.pickN', { n: need })}（${got}/${need}）`}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, padding: '0 4px 4px 0' }}>
                  {pool.map((p) => {
                    const cnt = picks[slot.id]?.[p.id] ?? 0;
                    const rem = remainingFor(p.id);
                    const soldOut = typeof rem === 'number' && rem < 1 && cnt === 0;
                    const state = cnt > 0 ? 'picked' : soldOut ? 'disabled' : 'idle';
                    return (
                      <div key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button type="button" style={S.chip(state)} disabled={soldOut || fixed} onClick={() => pick(slot, p.id)}>
                          <span>{p.name}{cnt > 0 ? ` ×${cnt}` : ''}</span>
                          <span style={S.caption}>
                            {typeof rem === 'number' ? (rem < 1 && cnt === 0 ? t('bundle.soldOut') : tf('bundle.remaining', { n: rem })) : t('bundle.unlimited')}
                          </span>
                        </button>
                        {cnt > 0 && !fixed ? (
                          <button type="button" style={S.minus} onClick={() => unpick(slot, p.id)} aria-label="−">−</button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={S.footer}>
          <Button variant="primary" size="lg" disabled={!allFilled || bundleSoldOut} onClick={confirm} style={{ width: '100%' }}>
            {t('bundle.add')}
          </Button>
        </div>
      </div>
    </div>
  );
}
