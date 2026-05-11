import NumpadDigits from './NumpadDigits.jsx';
import Button from './Button.jsx';
import { ShoppingCart, CircleDollarSign, ArrowLeft } from 'lucide-react';
import { glass, ui } from '../lib/uiPalette.js';
import { t } from '../i18n/t.js';
import { getString } from '../lib/strings.js';

const S = {
  overlay: {
    position: 'fixed', top: 8, left: 8, right: 8, bottom: 0,
    zIndex: 9999, ...glass.overlay,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'DM Sans, sans-serif', color: ui.ink,
    borderRadius: '24px 24px 0 0', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '18px 20px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.50)',
    flexShrink: 0, background: 'rgba(255,255,255,0.30)',
  },
  headerTitle: {
    flex: 1, fontWeight: 800, fontSize: 17, color: ui.ink,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    WebkitOverflowScrolling: 'touch',
  },
  cartItem: {
    background: 'rgba(255,255,255,0.62)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 16, padding: '10px 12px',
    border: '1px solid rgba(255,255,255,0.72)',
    boxShadow: '0 4px 12px rgba(128,161,212,0.10)',
  },
  footer: {
    flexShrink: 0,
    borderTop: '1px solid rgba(255,255,255,0.50)',
    paddingTop: 10, paddingLeft: 16, paddingRight: 16,
    paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
    background: 'rgba(255,255,255,0.35)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  },
  receiptLabel: { fontSize: 12, color: ui.muted, fontWeight: 700 },
  receiptLine:  { height: 1, background: 'rgba(128,161,212,0.20)', margin: '4px 0' },
  paymentPill: (active) => ({
    borderRadius: 12, padding: '10px 12px',
    fontWeight: 800, fontSize: 12, cursor: 'pointer', textAlign: 'center',
    border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(192,185,221,0.45)',
    background: active
      ? 'linear-gradient(135deg,#9BBCE8 0%,#80A1D4 100%)'
      : 'rgba(255,255,255,0.55)',
    color: active ? '#FFFFFF' : ui.muted,
    boxShadow: active ? '0 4px 14px rgba(128,161,212,0.32)' : 'none',
    backdropFilter: active ? 'none' : 'blur(10px)',
    WebkitBackdropFilter: active ? 'none' : 'blur(10px)',
  }),
  qtyBtn: {
    width: 26, height: 26, border: 'none',
    background: 'rgba(255,255,255,0.70)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    fontSize: 16, fontWeight: 900, cursor: 'pointer',
    borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1,
  },
  trashBtn: {
    border: 'none', background: 'rgba(255,237,238,0.80)',
    color: '#D96868', width: 26, height: 26,
    borderRadius: 6, cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  bonusTag: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 800,
    color: '#F7F4EA',
    background: '#5B4D8A',
    borderRadius: 8,
    padding: '4px 8px',
    marginBottom: 4,
    boxShadow: '0 3px 8px rgba(91,77,138,0.30)',
    animation: 'bonusReveal 220ms ease-out both',
  },
};

const receiptValue = (variant) => {
  const configs = {
    due:    { fontSize: 16, fontWeight: 800, color: '#3D6040' },
    recv:   { fontSize: 16, fontWeight: 800, color: ui.ink },
    change: { fontSize: 22, fontWeight: 900, color: ui.primary },
    bonus:  { fontSize: 12, fontWeight: 700, color: ui.success },
  };
  return configs[variant] ?? { fontSize: 16, fontWeight: 800, color: ui.ink };
};

export default function CheckoutModal({
  cart, products, totalAmount, paymentMethods, selectedPaymentId,
  setSelectedPaymentId, cashInput, setCashInput, cashValue, changeAmount,
  checkoutPhase, onCheckout, checkoutDisabled, cashInsufficient,
  bonusesTriggered, onInc, onDec, onRemove,
  pressDigit, pressDoubleZero, pressBackspace, onClose,
}) {
  return (
    <div style={S.overlay}>
      <style>{`
        @keyframes bonusReveal {
          0% { opacity: 0; transform: translateY(4px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={S.header}>
        <Button variant="ghost" size="sm" onClick={onClose}
          leftIcon={<ArrowLeft size={14} />}>返回</Button>
        <div style={S.headerTitle}>
          <ShoppingCart size={16} color={ui.primary} />
          {t('sales.cartTitle')}
        </div>
      </div>

      <div style={S.body}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
          {cart.map((it) => {
            const product = products.find((p) => p.id === it.productId);
            const stock = product?.stock ?? it.stock;
            const maxQty = typeof stock === 'number' ? stock : Number.MAX_SAFE_INTEGER;
            return (
              <div key={it.productId} style={S.cartItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: it?.color || ui.primary, flexShrink: 0 }} />
                  <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.3, flex: 1, color: ui.ink }}>{it.name}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: ui.muted, fontWeight: 700 }}>NT${it.unitPrice}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => onDec(it.productId)} disabled={it.qty <= 1} style={S.qtyBtn}>-</button>
                    <span style={{ fontWeight: 900, fontSize: 13, minWidth: 16, textAlign: 'center' }}>{it.qty}</span>
                    <button type="button" onClick={() => onInc(it.productId)} disabled={it.qty >= maxQty} style={S.qtyBtn}>+</button>
                    <button type="button" onClick={() => onRemove(it.productId)} style={S.trashBtn}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.footer}>
        {/* 收據區 */}
        <div style={{ display: 'flex', padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.45)', gap: 0 }}>
          {bonusesTriggered.length > 0 && (
            <div style={{ flex: 1, paddingRight: 12, borderRight: '0.5px solid rgba(128,161,212,0.25)' }}>
              <div style={{ fontSize: 10, color: ui.success, fontWeight: 800, marginBottom: 4 }}>🎁 特典</div>
              {bonusesTriggered.map((b) => (
                <div key={b.ruleId} style={S.bonusTag}>{b.bonusText}</div>
              ))}
            </div>
          )}
          <div style={{ minWidth: 140, paddingLeft: bonusesTriggered.length > 0 ? 12 : 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {[
              { label: '應收', value: `NT$${totalAmount}`,  v: 'due'    },
              { label: '實收', value: `NT$${cashValue}`,    v: 'recv'   },
              { label: '找零', value: `NT$${changeAmount}`, v: 'change' },
            ].map(({ label, value, v }, i) => (
              <div key={v}>
                {i === 2 && <div style={S.receiptLine} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
                  <span style={{ ...S.receiptLabel, ...(v === 'change' ? { color: ui.primary } : {}) }}>{label}</span>
                  <span style={receiptValue(v)}>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 付款 + 數字盤 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paymentMethods.filter((m) => m.enabled).map((m) => (
              <button key={m.id} type="button" style={S.paymentPill(selectedPaymentId === m.id)}
                onClick={() => { setSelectedPaymentId(m.id); if (m.isCash) setCashInput('0'); }}>
                {m.name}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <NumpadDigits onDigit={pressDigit} onDoubleZero={pressDoubleZero} onBackspace={pressBackspace} disabled={false} />
          </div>
        </div>

        {/* 結帳按鈕 */}
        <Button
          variant="primary" size="lg"
          success={checkoutPhase === 'done'}
          loading={checkoutPhase === 'processing'}
          disabled={checkoutDisabled}
          onClick={onCheckout}
          style={{ width: '100%' }}
          leftIcon={<CircleDollarSign size={18} color="#FFFFFF" />}
        >
          {checkoutPhase === 'done'
            ? t('sales.checkoutDone')
            : cashInsufficient ? getString('S11') : t('sales.checkout')}
        </Button>
      </div>
    </div>
  );
}
