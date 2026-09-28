import { t } from '../i18n/t.js';
import { ui, border, shadow } from '../lib/uiPalette.js';
import { makeEmptySlot } from '../lib/slots.js';

/**
 * 「欄位」編輯器：合購折扣的 slots 與套組活動的 bundleSlots 共用。
 * 每個欄位：標題、要選幾件（qtyKey：'qty' 或 'pickQty'）、可選商品（可依類別全選）。
 * products 只應傳入 type === 'single' 且未封存的商品（套組不能包套組）。
 */
const S = {
  slotCard: { border: border.solidSm, borderRadius: 10, padding: 12, background: ui.white, boxShadow: shadow.sm, marginBottom: 12 },
  label: { fontWeight: 700, fontSize: 12, color: ui.ink, marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', minHeight: 44, borderRadius: 10,
    border: border.solidSm, padding: '10px 12px', fontWeight: 700, fontSize: 15,
    background: ui.white, color: ui.ink, fontFamily: 'inherit',
  },
  chip: (active) => ({
    minHeight: 36, padding: '0 12px', borderRadius: 999, fontWeight: 700, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', border: border.solidSm,
    background: active ? ui.apricot : ui.white, color: ui.ink,
    boxShadow: active ? shadow.sm : 'none',
  }),
  smallBtn: {
    minHeight: 36, padding: '0 12px', borderRadius: 10, fontWeight: 700, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', border: border.solidSm, background: ui.white, color: ui.ink,
  },
  removeBtn: {
    minHeight: 36, padding: '0 12px', borderRadius: 10, fontWeight: 700, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', border: border.dashed, background: ui.white, color: ui.ink,
  },
  caption: { color: ui.muted, fontWeight: 600, fontSize: 12 },
};

export default function SlotEditor({ slots, onChange, products = [], categories = [], qtyKey = 'qty' }) {
  const list = Array.isArray(slots) ? slots : [];

  function update(idx, patch) {
    onChange(list.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function togglePool(idx, productId) {
    const slot = list[idx];
    const pool = slot.poolProductIds ?? [];
    const next = pool.includes(productId) ? pool.filter((id) => id !== productId) : [...pool, productId];
    update(idx, { poolProductIds: next });
  }

  function selectCategory(idx, catId) {
    const slot = list[idx];
    const ids = products.filter((p) => (p.categoryIds ?? []).includes(catId)).map((p) => p.id);
    const pool = slot.poolProductIds ?? [];
    const allIn = ids.length > 0 && ids.every((id) => pool.includes(id));
    const next = allIn ? pool.filter((id) => !ids.includes(id)) : Array.from(new Set([...pool, ...ids]));
    update(idx, { poolProductIds: next });
  }

  return (
    <div>
      {list.map((slot, idx) => {
        const pool = slot.poolProductIds ?? [];
        return (
          <div key={slot.id ?? idx} style={S.slotCard}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <div style={S.label}>{t('slot.label')}</div>
                <input
                  value={slot.label ?? ''}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  placeholder={t('slot.labelPlaceholder')}
                  style={S.input}
                />
              </div>
              <div style={{ flex: '0 0 110px' }}>
                <div style={S.label}>{t('slot.qty')}</div>
                <input
                  type="number"
                  min={1}
                  value={slot[qtyKey] ?? 1}
                  onChange={(e) => update(idx, { [qtyKey]: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  style={S.input}
                />
              </div>
              <button type="button" style={S.removeBtn} onClick={() => onChange(list.filter((_, i) => i !== idx))}>
                {t('slot.remove')}
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={S.label}>{t('slot.pool')}（{pool.length}）</div>
              {categories.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                  <span style={S.caption}>{t('slot.selectByCategory')}</span>
                  {categories.map((c) => (
                    <button key={c.id} type="button" style={S.smallBtn} onClick={() => selectCategory(idx, c.id)}>
                      {c.name}
                    </button>
                  ))}
                  <button type="button" style={S.smallBtn} onClick={() => update(idx, { poolProductIds: [] })}>
                    {t('slot.clear')}
                  </button>
                </div>
              ) : null}
              {products.length === 0 ? (
                <div style={S.caption}>{t('slot.noProducts')}</div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px 4px 0' }}>
                  {products.map((p) => (
                    <button key={p.id} type="button" style={S.chip(pool.includes(p.id))} onClick={() => togglePool(idx, p.id)}>
                      {p.name}
                      <span style={{ ...S.caption, marginLeft: 6 }}>NT${p.price}</span>
                    </button>
                  ))}
                </div>
              )}
              {pool.length === 1 ? <div style={{ ...S.caption, marginTop: 6 }}>{t('slot.fixedHint')}</div> : null}
            </div>
          </div>
        );
      })}
      <button type="button" style={{ ...S.smallBtn, minHeight: 44, background: ui.apricot, boxShadow: shadow.sm }} onClick={() => onChange([...list, makeEmptySlot(qtyKey)])}>
        {t('slot.add')}
      </button>
    </div>
  );
}
