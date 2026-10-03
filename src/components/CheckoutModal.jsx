import NumpadDigits from './NumpadDigits.jsx';
import Button from './Button.jsx';
import { ShoppingCart, CircleDollarSign, ArrowLeft } from 'lucide-react';
import { surface, ui, border, shadow, checkoutCta } from '../lib/uiPalette.js';
import { t } from '../i18n/t.js';
import { getString } from '../lib/strings.js';
import { describeComponents, isBundleLine } from '../lib/cart.js';
import { quickCashOptions } from '../lib/cash.js';

const S = {
  // 遮罩：實色半透明，不模糊
  scrim: {
    position: 'fixed', inset: 0, zIndex: 9998,
    ...surface.overlay,
  },
  // 底部抽屜面板：白底＋黑框＋硬陰影，只圓上方兩角
  panel: {
    position: 'fixed', top: 12, left: 8, right: 8, bottom: 0,
    zIndex: 9999, ...surface.sheet,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'inherit', color: ui.ink,
    overflow: 'hidden',
  },
  // 復古視窗標題列：杏色色帶＋黑色底線
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px',
    ...surface.titleBar,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1, fontWeight: 800, fontSize: 17, color: ui.ink,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '12px 14px',
    WebkitOverflowScrolling: 'touch',
    background: ui.mint,
  },
  cartItem: {
    background: ui.white,
    border: border.solidSm,
    borderRadius: 10, padding: '10px 12px',
    boxShadow: shadow.sm,
  },
  footer: {
    flexShrink: 0,
    borderTop: border.solid,
    paddingTop: 10, paddingLeft: 14, paddingRight: 14,
    paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
    background: ui.white,
  },
  receiptLabel: { fontSize: 12, color: ui.muted, fontWeight: 700 },
  receiptLine:  { height: 2, background: ui.ink, margin: '4px 0' },
  paymentPill: (active) => ({
    borderRadius: 999, padding: '0 12px', minHeight: 44,
    fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'center',
    border: border.solidSm,
    background: active ? ui.apricot : ui.white,
    color: ui.ink,
    boxShadow: active ? shadow.sm : 'none',
  }),
  qtyBtn: {
    width: 32, height: 32, border: border.solidSm,
    background: ui.white, color: ui.ink,
    fontSize: 16, fontWeight: 800, cursor: 'pointer',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1,
  },
  trashBtn: {
    border: border.dashed, background: ui.white,
    color: ui.ink, width: 32, height: 32,
    borderRadius: 8, cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  },
  // 贈品提醒：整條杏色色帶、大字，結帳前一定看得到
  bonusBanner: {
    display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
    padding: '8px 12px', marginBottom: 8, borderRadius: 10,
    background: ui.apricot, border: border.solid, color: ui.ink,
    animation: 'bonusReveal 220ms ease-out both',
  },
  quickCashBtn: {
    flex: 1, minHeight: 44, padding: '0 4px', borderRadius: 8,
    border: border.solidSm, background: ui.mint, color: ui.ink,
    fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer',
  },
  // 電子支付：不用找零，改成「請確認已收款」
  confirmBox: {
    height: '100%', boxSizing: 'border-box', minHeight: 150,
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6,
    padding: 12, borderRadius: 10, textAlign: 'center',
    background: ui.mint, border: border.solid, color: ui.ink,
  },
  bundleBadge: {
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px',
    borderRadius: 999, border: border.solidSm, background: ui.mint, marginRight: 4,
  },
  discountRow: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 700, padding: '2px 0' },
};

// 金額一律黑字，用字級／字重做層次
const receiptValue = (variant) => {
  const configs = {
    gross:  { fontSize: 13, fontWeight: 700, color: ui.muted, textDecoration: 'line-through' },
    due:    { fontSize: 17, fontWeight: 800, color: ui.ink },
    recv:   { fontSize: 17, fontWeight: 800, color: ui.ink },
    change: { fontSize: 26, fontWeight: 800, color: ui.ink, letterSpacing: '-0.02em' },
  };
  return configs[variant] ?? { fontSize: 17, fontWeight: 800, color: ui.ink };
};

export default function CheckoutModal({
  cart, totals, totalAmount, getMaxQty, paymentMethods, selectedPayment,
  onSelectPayment, onQuickCash, cashValue, changeAmount,
  checkoutPhase, onCheckout, checkoutDisabled, cashInsufficient,
  bonusesTriggered, onInc, onDec, onRemove,
  pressDigit, pressDoubleZero, pressBackspace, onClose,
}) {
  const discounts = totals?.discounts ?? [];
  const hasDiscount = (totals?.totalDiscount ?? 0) > 0;
  const isCash = !!selectedPayment?.isCash;
  // 電子支付只顯示應收；現金才有實收／找零（找零不顯示負數）
  const receiptRows = [
    ...(hasDiscount ? [{ label: t('sales.gross'), value: `NT$${totals.grossAmount}`, v: 'gross' }] : []),
    { label: t('sales.due'), value: `NT$${totalAmount}`,  v: 'due'    },
    ...(isCash ? [
      { label: t('sales.received'), value: `NT$${cashValue}`, v: 'recv' },
      { label: t('sales.change'), value: changeAmount >= 0 ? `NT$${changeAmount}` : '—', v: 'change' },
    ] : []),
  ];
  const quickCash = isCash ? quickCashOptions(totalAmount) : [];

  return (
    <>
      <div style={S.scrim} onClick={onClose} />
      <div style={S.panel}>
        <style>{`
          @keyframes bonusReveal {
            0% { opacity: 0; transform: translateY(4px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={S.header}>
          <Button variant="secondary" size="sm" onClick={onClose}
            leftIcon={<ArrowLeft size={14} />}>{t('sales.back')}</Button>
          <div style={S.headerTitle}>
            <ShoppingCart size={16} color={ui.ink} />
            {t('sales.cartTitle')}
          </div>
        </div>

        <div style={S.body}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
            {cart.map((it) => {
              const maxQty = typeof getMaxQty === 'function' ? getMaxQty(it) : Number.MAX_SAFE_INTEGER;
              const bundle = isBundleLine(it);
              return (
                <div key={it.lineId} style={{ ...S.cartItem, gridColumn: bundle ? '1 / -1' : 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 999, border: border.solidSm, backgroundColor: it?.color || ui.orange, flexShrink: 0 }} />
                    <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.3, flex: 1, color: ui.ink }}>
                      {bundle ? <span style={S.bundleBadge}>{t('sales.bundleBadge')}</span> : null}
                      {it.name}
                    </div>
                  </div>
                  {bundle ? (
                    <div style={{ fontSize: 11, color: ui.muted, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>
                      {describeComponents(it.components)}
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: ui.muted, fontWeight: 700 }}>NT${it.unitPrice}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button type="button" onClick={() => onDec(it.lineId)} disabled={it.qty <= 1} style={{ ...S.qtyBtn, opacity: it.qty <= 1 ? 0.35 : 1 }}>-</button>
                      <span style={{ fontWeight: 800, fontSize: 14, minWidth: 18, textAlign: 'center' }}>{it.qty}</span>
                      <button type="button" onClick={() => onInc(it.lineId)} disabled={it.qty >= maxQty} style={{ ...S.qtyBtn, opacity: it.qty >= maxQty ? 0.35 : 1 }}>+</button>
                      <button type="button" onClick={() => onRemove(it.lineId)} style={S.trashBtn} aria-label="移除">🗑</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 套用的合購折扣，每條一列 */}
          {hasDiscount ? (
            <div style={{ ...S.cartItem, marginTop: 12 }}>
              {discounts.map((d) => (
                <div key={d.ruleId} style={S.discountRow}>
                  <span>🏷️ {d.ruleName} ×{d.times}</span>
                  <span>−NT${d.amount}</span>
                </div>
              ))}
              {totals.approximate ? (
                <div style={{ fontSize: 11, color: ui.muted, fontWeight: 600, marginTop: 4 }}>{t('sales.discountApprox')}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={S.footer}>
          {/* 贈品提醒（整條色帶） */}
          {bonusesTriggered.length > 0 ? (
            <div style={S.bonusBanner} role="status">
              <span style={{ fontSize: 14, fontWeight: 800 }}>{t('sales.bonusShort')}</span>
              <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>
                {bonusesTriggered.map((b) => b.bonusText ?? b.ruleName).join('、')}
              </span>
            </div>
          ) : null}

          {/* 收據區 */}
          <div style={{ display: 'flex', padding: '4px 0 8px', gap: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {receiptRows.map(({ label, value, v }) => (
                <div key={v}>
                  {v === 'change' && <div style={S.receiptLine} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
                    <span style={S.receiptLabel}>{label}</span>
                    <span style={receiptValue(v)}>{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 付款 + 數字盤 */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paymentMethods.map((m) => (
                <button key={m.id} type="button" style={S.paymentPill(selectedPayment?.id === m.id)}
                  onClick={() => onSelectPayment(m)}>
                  {m.name}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isCash ? (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {quickCash.map((amount, i) => (
                      <button key={amount} type="button" style={S.quickCashBtn} onClick={() => onQuickCash(amount)}>
                        {i === 0 ? t('sales.exact') : amount}
                      </button>
                    ))}
                  </div>
                  <NumpadDigits compact onDigit={pressDigit} onDoubleZero={pressDoubleZero} onBackspace={pressBackspace} />
                </>
              ) : (
                <div style={S.confirmBox}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t('sales.confirmPaidTitle')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedPayment?.name ?? t('sales.noPayment')}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>NT${totalAmount}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: ui.muted }}>{t('sales.confirmPaidHint')}</div>
                </div>
              )}
            </div>
          </div>

          {/* 結帳按鈕：整個畫面最醒目的東西 */}
          <Button
            variant="primary" size="lg"
            success={checkoutPhase === 'done'}
            loading={checkoutPhase === 'processing'}
            disabled={checkoutDisabled}
            onClick={onCheckout}
            style={{ width: '100%', fontSize: checkoutCta.fontSize, fontWeight: checkoutCta.fontWeight, boxShadow: checkoutDisabled ? 'none' : checkoutCta.shadow }}
            leftIcon={<CircleDollarSign size={20} color={ui.ink} />}
          >
            {checkoutPhase === 'done'
              ? t('sales.checkoutDone')
              : cashInsufficient ? getString('S11') : isCash ? t('sales.checkout') : t('sales.checkoutPaid')}
          </Button>
        </div>
      </div>
    </>
  );
}
