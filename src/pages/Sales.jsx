import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import BundlePickerModal from '../components/BundlePickerModal.jsx';
import Toast from '../components/Toast.jsx';
import db, { createUUID } from '../db.js';
import { evalBonuses } from '../lib/bonuses.js';
import { calcCartTotals } from '../lib/promo.js';
import {
  addLine, setLineQty, removeLine, makeSingleLine, makeBundleLine,
  maxQtyForLine, qtyOfProductInCart, usageByProduct, lineToTxItem,
} from '../lib/cart.js';
import { getTaipeiDateKey, getTaipeiTimeHMS } from '../lib/dateTaipei.js';
import { useToast } from '../lib/useToast.js';
import { getString } from '../lib/strings.js';
import { t } from '../i18n/t.js';
import { ui, border, shadow, checkoutCta } from '../lib/uiPalette.js';

const styles = {
  page: {
    height: 'calc(100vh - 188px)', minHeight: 520,
    background: 'transparent', fontFamily: 'inherit',
    color: ui.ink, display: 'flex', flexDirection: 'column',
    gap: 14, overflow: 'hidden', position: 'relative',
  },
  // 場次提示：白底黑框小標籤；未設定時改杏色提醒
  eventTag: (ok) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 700, color: ui.ink,
    padding: '5px 10px', borderRadius: 999,
    border: border.solidSm,
    background: ok ? ui.white : ui.apricot,
    alignSelf: 'flex-start',
  }),
  categoryRow: {
    display: 'flex',
    gap: 8,
    padding: '2px 6px 10px 2px', // 右／下留給硬陰影
    borderBottom: `2px solid ${ui.ink}`,
    marginBottom: 4,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
    flexShrink: 0,
  },
  // 類別 chip：圓角 pill、黑框、選中杏色
  categoryPill: (active) => ({
    flex: '0 0 auto',
    minWidth: 72,
    height: 36,
    padding: '0 16px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 13,
    border: border.solidSm,
    backgroundColor: active ? ui.apricot : ui.white,
    color: ui.ink,
    cursor: 'pointer',
    boxShadow: active ? shadow.sm : 'none',
    transition: 'background 0.15s ease',
    whiteSpace: 'nowrap',
  }),
  productListContainer: { flexGrow: 1, overflowY: 'auto', padding: '2px 6px 14px 2px', minHeight: 0 },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
  stickyBar: { display: 'flex', gap: 12, padding: '10px 8px 8px 0', flexShrink: 0 },
  cancelBtn: {
    flex: '0 0 auto', padding: '10px 16px', borderRadius: 10, minHeight: 44,
    border: border.dashed,
    background: ui.white,
    fontWeight: 700, fontSize: 13, color: ui.ink,
    cursor: 'pointer', lineHeight: 1.3, textAlign: 'center',
    boxShadow: shadow.sm,
  },
  // 總額按鈕＝結帳 CTA：橘色實色、shadow-lg、20px／800
  totalBtn: {
    flex: 1, padding: '12px 20px', borderRadius: 10, minHeight: 44,
    background: checkoutCta.background,
    border: checkoutCta.border,
    color: checkoutCta.color, fontWeight: checkoutCta.fontWeight, fontSize: checkoutCta.fontSize,
    boxShadow: checkoutCta.shadow,
    cursor: 'pointer', letterSpacing: '-0.01em',
  },
};

function isUncategorizedCategory(category) {
  if (category === null || category === undefined) return true;
  return String(category).trim() === '';
}

function isArchivedProduct(product) {
  const v = product?.archived;
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function isNewProduct(product) {
  const v = product?.isNew;
  return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function makeReceiptNo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const MAX_RECEIPT_TRIES = 1000;

async function generateUniqueReceiptNo() {
  const txs = await db.transactions.toArray();
  const used = new Set(txs.map((tx) => String(tx.receiptNo ?? '').trim()).filter(Boolean));
  let receiptNo = makeReceiptNo();
  // 有上限的迴圈：5 碼 32 進位有 3,300 萬種組合，實務上第一次就會成功
  for (let i = 0; i < MAX_RECEIPT_TRIES && used.has(receiptNo); i++) {
    receiptNo = makeReceiptNo();
  }
  if (used.has(receiptNo)) receiptNo = `${receiptNo}${Date.now().toString(36).slice(-3).toUpperCase()}`;
  return receiptNo;
}

export default function Sales({ products = [], categories = [], refreshProducts }) {
  const topRef = useRef(null);

  const [activeCategory, setActiveCategory] = useState('全部');
  const [cart, setCart] = useState([]); // 以 lineId 為鍵，見 src/lib/cart.js
  const [bundlePicking, setBundlePicking] = useState(null); // 正在選款的套組商品

  const [bonusRules, setBonusRules] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [activeEventName, setActiveEventName] = useState('');

  const [cashInput, setCashInput] = useState('0');
  const [checkoutPhase, setCheckoutPhase] = useState('idle'); // idle | done
  const [showCheckout, setShowCheckout] = useState(false);
  const toast = useToast();

  useEffect(() => {
    async function load() {
      await refreshProducts?.();

      const rules = await db.bonusRules.orderBy('sortOrder').toArray();
      setBonusRules(rules);

      const allPaymentMethods = await db.paymentMethods.toArray();
      const pms = allPaymentMethods
        .filter((m) => !!m.enabled)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setPaymentMethods(pms);
      // 付款方式清單變動時，選到的付款方式若已不存在就退回第一個
      setSelectedPaymentId((prev) => (prev && pms.some((m) => m.id === prev) ? prev : (pms[0]?.id ?? null)));

      const allEvents = await db.events.toArray();
      const activeEvent = allEvents.find((e) => e.status === 'active' && !e.archived) ?? null;
      setActiveEventName(activeEvent?.name ?? '');
    }
    load().catch((e) => console.error(e));
  }, [refreshProducts]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const getStock = useCallback((productId) => {
    const p = productsById.get(productId);
    return p ? p.stock : null;
  }, [productsById]);

  const categoryTabs = useMemo(() => {
    const normalized = categories.length > 0
      ? categories.map((c) => (typeof c === 'string' ? { id: c, name: c } : c))
      : [{ id: '全部', name: '全部' }];
    const hasUncategorized = products.some((p) => isUncategorizedCategory(p.category) && !(Array.isArray(p.categoryIds) && p.categoryIds.length > 0));
    if (hasUncategorized && !normalized.some((c) => c.name === '未分類')) {
      return [...normalized, { id: '未分類', name: '未分類' }];
    }
    return normalized;
  }, [categories, products]);

  // 選到的類別被刪掉時退回「全部」：在 render 時決定，不用 effect 裡 setState
  const effectiveCategory = useMemo(() => {
    if (activeCategory === '全部') return activeCategory;
    return categoryTabs.some((c) => c.name === activeCategory) ? activeCategory : '全部';
  }, [activeCategory, categoryTabs]);

  const categoryNameToId = useMemo(() => {
    const map = new Map();
    categoryTabs.forEach((c) => {
      if (c.name && c.id) map.set(c.name, c.id);
    });
    return map;
  }, [categoryTabs]);

  const visibleProducts = useMemo(() => {
    const sellingProducts = products.filter((p) => !isArchivedProduct(p));
    let filtered = sellingProducts;
    if (effectiveCategory === '未分類') {
      filtered = sellingProducts.filter(
        (p) =>
          isUncategorizedCategory(p.category) &&
          !(Array.isArray(p.categoryIds) && p.categoryIds.length > 0),
      );
    } else if (effectiveCategory !== '全部') {
      const selectedCategoryId = categoryNameToId.get(effectiveCategory);
      filtered = sellingProducts.filter((p) => {
        const legacyMatch = String(p.category ?? '').trim() === effectiveCategory;
        const relationMatch = Array.isArray(p.categoryIds) && selectedCategoryId
          ? p.categoryIds.includes(selectedCategoryId)
          : false;
        return legacyMatch || relationMatch;
      });
    }
    return [...filtered].sort((a, b) => {
      const aOrder = a.sortOrder;
      const bOrder = b.sortOrder;
      const aHasOrder = aOrder != null && Number.isFinite(Number(aOrder));
      const bHasOrder = bOrder != null && Number.isFinite(Number(bOrder));
      if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
      if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
      return Number(isNewProduct(b)) - Number(isNewProduct(a));
    });
  }, [products, effectiveCategory, categoryNameToId]);

  // 合購折扣（全購物車最佳化）：購物車一有變動就重算
  const totals = useMemo(() => calcCartTotals(cart, bonusRules), [cart, bonusRules]);
  const totalAmount = totals.subtotal;

  // 滿額禮用折扣後金額判斷；合購 gift 模式看能不能湊滿一組
  const cartItemsForBonuses = useMemo(() => {
    return cart.map((it) => ({
      productId: it.productId,
      qty: it.qty,
      kind: it.kind,
      sub: it.unitPrice * it.qty - (totals.discountByProductId.get(it.productId) ?? 0),
      catIds: it.categoryIds ?? [],
    }));
  }, [cart, totals]);

  const bonusesTriggered = useMemo(() => {
    return evalBonuses(cartItemsForBonuses, bonusRules);
  }, [cartItemsForBonuses, bonusRules]);

  const selectedPayment = useMemo(() => {
    return paymentMethods.find((m) => m.id === selectedPaymentId) ?? null;
  }, [paymentMethods, selectedPaymentId]);

  const cashValue = useMemo(() => {
    const n = parseInt(cashInput, 10);
    return Number.isFinite(n) ? n : 0;
  }, [cashInput]);

  const changeAmount = useMemo(() => cashValue - totalAmount, [cashValue, totalAmount]);

  function pressDigit(n) {
    setCashInput((prev) => (prev === '0' ? String(n) : `${prev}${n}`));
  }

  function pressBackspace() {
    setCashInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  }

  async function ensureActiveEvent() {
    const allEvents = await db.events.toArray();
    const evt = allEvents.find((e) => e.status === 'active' && !e.archived) ?? null;
    if (!evt) throw new Error('NO_ACTIVE_EVENT');
    return evt;
  }

  function clearLast() {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.qty > 1) return setLineQty(prev, last.lineId, last.qty - 1, getStock);
      return prev.slice(0, -1);
    });
  }

  function clearAll() {
    setCart([]);
    setCashInput('0');
  }

  function pressDoubleZero() {
    setCashInput((prev) => (prev === '0' ? '0' : `${prev}00`));
  }

  function addToCart(product) {
    if ((product.type ?? 'single') === 'bundle') {
      setBundlePicking(product);
      return;
    }
    setCart((prev) => addLine(prev, makeSingleLine(product), getStock));
  }

  function confirmBundle(components) {
    const product = bundlePicking;
    setBundlePicking(null);
    if (!product) return;
    setCart((prev) => addLine(prev, makeBundleLine(product, components), getStock));
  }

  function incQty(lineId) {
    setCart((prev) => {
      const line = prev.find((x) => x.lineId === lineId);
      return line ? setLineQty(prev, lineId, line.qty + 1, getStock) : prev;
    });
  }

  function decQty(lineId) {
    setCart((prev) => {
      const line = prev.find((x) => x.lineId === lineId);
      return line ? setLineQty(prev, lineId, line.qty - 1, getStock) : prev;
    });
  }

  function removeFromCart(lineId) {
    setCart((prev) => removeLine(prev, lineId));
    // Trash click => Toast A1
    toast.show(getString('A1'));
  }

  const getMaxQty = useCallback((line) => maxQtyForLine(line, cart, getStock), [cart, getStock]);

  async function commitSale() {
    let event;
    try {
      event = await ensureActiveEvent();
    } catch (e) {
      if (e?.message === 'NO_ACTIVE_EVENT') {
        toast.show(t('sales.noEventToast'), 'error');
        return null;
      }
      throw e;
    }
    const createdAt = Date.now();
    const taipeiDate = getTaipeiDateKey(new Date(createdAt));
    const time = getTaipeiTimeHMS(new Date(createdAt));

    const payments = selectedPayment ? [
      { methodId: selectedPayment.id, methodName: selectedPayment.name, amount: totalAmount, isCash: selectedPayment.isCash },
    ] : [];

    const bonuses = bonusesTriggered.map((b) => ({
      ruleId: b.ruleId,
      ruleName: b.ruleName,
      bonusText: b.bonusText,
    }));

    const receiptNo = await generateUniqueReceiptNo();
    const tx = {
      id: createUUID(),
      receiptNo,
      eventId: event.id,
      date: taipeiDate,
      createdAt,
      time,
      type: 'sale',
      preorderId: null,
      items: cart.map(lineToTxItem),
      subtotal: totalAmount,                    // 折扣後實收（沿用欄位）
      grossAmount: totals.grossAmount,          // 折扣前
      discounts: totals.discounts,              // [{ ruleId, ruleName, times, amount }]
      discountApproximate: !!totals.approximate,
      payments,
      depositAlreadyPaid: 0,
      bonusesTriggered: bonuses,
      note: null,
    };

    // 扣庫存＋寫交易包在同一個 transaction：任何一步失敗就整筆回滾
    const usage = usageByProduct(cart); // 單賣 ＋ 套組本身 ＋ 套組內容物 合併
    await db.transaction('rw', db.products, db.transactions, async () => {
      for (const [productId, used] of usage) {
        const prod = await db.products.get(productId);
        if (!prod || typeof prod.stock !== 'number') continue;
        await db.products.update(productId, { stock: Math.max(0, prod.stock - used) });
      }
      await db.transactions.add(tx);
    });
    return receiptNo;
  }

  async function onCheckout() {
    if (totalAmount <= 0) return;
    if (checkoutPhase !== 'idle') return;

    if (selectedPayment?.isCash) {
      const cashInt = parseInt(cashInput, 10) || 0;
      if (cashInt < totalAmount) {
        toast.show(getString('S11'), 'error');
        return;
      }
    }

    setCheckoutPhase('done');

    try {
      const receiptNo = await commitSale();
      if (!receiptNo) {
        setCheckoutPhase('idle');
        return;
      }
      await refreshProducts?.();
      // 0.8s animation window
      setTimeout(() => {
        setCart([]);
        setCashInput('0');
        setCheckoutPhase('idle');
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Checkout success => Toast A2 + receipt number
        toast.show(`${getString('A2')}${receiptNo}`, 'success');
        setShowCheckout(false);
      }, 800);
    } catch (e) {
      console.error(e);
      setCheckoutPhase('idle');
      toast.show(t('admin.err.saveFailed'), 'error');
    }
  }

  const checkoutDisabled =
    checkoutPhase !== 'idle' || totalAmount <= 0;

  const cashInsufficient = !!selectedPayment?.isCash && cashValue < totalAmount;
  const isCartEmpty = cart.length === 0;
  const totalQty = useMemo(() => cart.reduce((s, it) => s + it.qty, 0), [cart]);

  return (
    <div style={styles.page}>
      <div ref={topRef} className="topRef" />

      <div style={styles.eventTag(!!activeEventName)}>
        {activeEventName ? `📍 ${activeEventName}` : t('sales.noEventTag')}
      </div>

      <div style={styles.categoryRow}>
        {categoryTabs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.name)}
            style={styles.categoryPill(effectiveCategory === c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div style={styles.productListContainer}>
        <div style={styles.productGrid}>
          {visibleProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              cartQty={qtyOfProductInCart(cart, p.id)}
              onClick={() => addToCart(p)}
            />
          ))}
        </div>
      </div>

      {!isCartEmpty && (
        <div style={styles.stickyBar}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={clearLast}
            onPointerDown={(e) => {
              const tid = setTimeout(() => clearAll(), 600);
              e.currentTarget._lp = tid;
            }}
            onPointerUp={(e) => clearTimeout(e.currentTarget._lp)}
            onPointerLeave={(e) => clearTimeout(e.currentTarget._lp)}
            onContextMenu={(e) => { e.preventDefault(); clearAll(); }}
          >
            {t('sales.cancel')}
            <span style={{ display: 'block', fontSize: 10, color: ui.muted, marginTop: 2 }}>
              {t('sales.cancelHint')}
            </span>
          </button>
          <button
            type="button"
            style={styles.totalBtn}
            onClick={() => setShowCheckout(true)}
          >
            [{totalQty} 件]{' '}NT${totalAmount}
            {totals.totalDiscount > 0 ? (
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                🏷️ {t('sales.discountTotal')} −NT${totals.totalDiscount}
              </span>
            ) : null}
          </button>
        </div>
      )}

      {bundlePicking && (
        <BundlePickerModal
          product={bundlePicking}
          products={products}
          cart={cart}
          getStock={getStock}
          onConfirm={confirmBundle}
          onClose={() => setBundlePicking(null)}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          totals={totals}
          totalAmount={totalAmount}
          getMaxQty={getMaxQty}
          paymentMethods={paymentMethods}
          selectedPaymentId={selectedPaymentId}
          setSelectedPaymentId={setSelectedPaymentId}
          setCashInput={setCashInput}
          cashValue={cashValue}
          changeAmount={changeAmount}
          checkoutPhase={checkoutPhase}
          onCheckout={onCheckout}
          checkoutDisabled={checkoutDisabled}
          cashInsufficient={cashInsufficient}
          bonusesTriggered={bonusesTriggered}
          onInc={incQty}
          onDec={decQty}
          onRemove={removeFromCart}
          pressDigit={pressDigit}
          pressDoubleZero={pressDoubleZero}
          pressBackspace={pressBackspace}
          onClose={() => setShowCheckout(false)}
        />
      )}

      <Toast message={toast.message} visible={toast.visible} variant={toast.variant} />
    </div>
  );
}
