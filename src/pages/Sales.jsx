import { useEffect, useMemo, useRef, useState } from 'react';
import ProductCard from '../components/ProductCard.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import Toast from '../components/Toast.jsx';
import db, { createUUID } from '../db.js';
import { evalBonuses } from '../lib/bonuses.js';
import { getTaipeiDateKey, getTaipeiTimeHMS } from '../lib/dateTaipei.js';
import { useToast } from '../lib/useToast.js';
import { t } from '../i18n/t.js';
import { getString } from '../lib/strings.js';
const styles = {
  page: {
    height: 'calc(100vh - 188px)', minHeight: 520,
    background: 'transparent', fontFamily: 'DM Sans, sans-serif',
    color: '#3D3060', display: 'flex', flexDirection: 'column',
    gap: 18, overflow: 'hidden', position: 'relative',
  },
  headerSpacer: { height: 0 }, // 清掉，由 App.jsx 的 contentPad 統一控制
  categoryRow: {
    display: 'flex',
    gap: 4,
    padding: '0 4px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    marginBottom: 12,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
    flexShrink: 0,
  },
  categoryPill: (active) => ({
    flex: 1, // 從 '0 0 auto' 改成 1
    minWidth: 72, // 類別超過 5 個時不會擠爆，改為橫向捲動
    padding: '10px 18px',
    borderRadius: 20,
    fontWeight: 800,
    fontSize: 13,
    border: active
      ? '1.5px solid rgba(255,255,255,0.30)'
      : '1.5px solid rgba(255,255,255,0.58)',
    backgroundColor: active ? '#80A1D4' : 'rgba(255,255,255,0.38)',
    WebkitBackdropFilter: 'blur(10px)',
    backdropFilter: 'blur(10px)',
    color: active ? '#FFFFFF' : '#9A8898',
    cursor: 'pointer',
    boxShadow: active
      ? '0 6px 18px rgba(128,161,212,0.36)'
      : '0 1px 8px rgba(180,140,220,0.10)',
    transition: 'all 0.18s ease',
    whiteSpace: 'nowrap',
  }),
  productListContainer: { flexGrow: 1, overflowY: 'auto', paddingBottom: 14, minHeight: 0 },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 },
  stickyBar: { display: 'flex', gap: 12, padding: '10px 0 6px', flexShrink: 0 },
  cancelBtn: {
    flex: '0 0 auto', padding: '14px 20px', borderRadius: 18,
    border: '1.5px solid rgba(255,255,255,0.65)',
    background: 'rgba(255,255,255,0.52)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    fontWeight: 700, fontSize: 13, color: '#8B85A0',
    cursor: 'pointer', lineHeight: 1.3, textAlign: 'center',
  },
  totalBtn: {
    flex: 1, padding: '16px 20px', borderRadius: 18, border: 'none',
    background: 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
    color: '#FFFFFF', fontWeight: 800, fontSize: 16,
    boxShadow: '0 8px 24px rgba(128,161,212,0.38)',
    cursor: 'pointer', letterSpacing: '0.01em',
  },
};

function clampQty(qty, min, max) {
  const n = Number.isFinite(qty) ? qty : min;
  return Math.max(min, Math.min(max, n));
}

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

async function generateUniqueReceiptNo() {
  const txs = await db.transactions.toArray();
  const used = new Set(txs.map((tx) => String(tx.receiptNo ?? '').trim()).filter(Boolean));
  let receiptNo = makeReceiptNo();
  while (used.has(receiptNo)) {
    receiptNo = makeReceiptNo();
  }
  return receiptNo;
}

export default function Sales({ products = [], categories = [], refreshProducts }) {
  const topRef = useRef(null);

  const [activeCategory, setActiveCategory] = useState('全部');
  const [cart, setCart] = useState([]);

  const [bonusRules, setBonusRules] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);

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
      if (pms.length > 0) {
        setSelectedPaymentId((prev) => (prev && pms.some((m) => m.id === prev) ? prev : pms[0].id));
      }
    }
    load().catch((e) => console.error(e));
  }, [refreshProducts]);

  useEffect(() => {
    if (paymentMethods.length === 0) {
      setSelectedPaymentId(null);
      return;
    }
    if (!selectedPaymentId || !paymentMethods.some((m) => m.id === selectedPaymentId)) {
      setSelectedPaymentId(paymentMethods[0].id);
    }
  }, [paymentMethods, selectedPaymentId]);

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

  useEffect(() => {
    if (activeCategory === '全部') return;
    const exists = categoryTabs.some((c) => c.name === activeCategory);
    if (!exists) setActiveCategory('全部');
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
    if (activeCategory === '未分類') {
      filtered = sellingProducts.filter(
        (p) =>
          isUncategorizedCategory(p.category) &&
          !(Array.isArray(p.categoryIds) && p.categoryIds.length > 0),
      );
    } else if (activeCategory !== '全部') {
      const selectedCategoryId = categoryNameToId.get(activeCategory);
      filtered = sellingProducts.filter((p) => {
        const legacyMatch = String(p.category ?? '').trim() === activeCategory;
        const relationMatch = Array.isArray(p.categoryIds) && selectedCategoryId
          ? p.categoryIds.includes(selectedCategoryId)
          : false;
        return legacyMatch || relationMatch;
      });
    }
    return [...filtered].sort((a, b) => Number(isNewProduct(b)) - Number(isNewProduct(a)));
  }, [products, activeCategory, categoryNameToId]);

  const cartItemsForBonuses = useMemo(() => {
    return cart.map((it) => ({
      productId: it.productId,
      qty: it.qty,
      sub: it.unitPrice * it.qty,
      catIds: it.categoryIds ?? [],
    }));
  }, [cart]);

  const bonusesTriggered = useMemo(() => {
    return evalBonuses(cartItemsForBonuses, bonusRules);
  }, [cartItemsForBonuses, bonusRules]);

  const totalAmount = useMemo(() => {
    return cart.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  }, [cart]);

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
    const dateKey = getTaipeiDateKey(new Date());
    const allEvents = await db.events.toArray();
    let evt = allEvents.find((e) => e.status === 'active' && !e.archived) ?? null;
    if (evt) return evt;

    // If no active event exists, create a default one for this device.
    evt = {
      id: createUUID(),
      name: '活動',
      date: dateKey,
      status: 'active',
      archived: false,
      createdAt: Date.now(),
    };
    await db.events.add(evt);
    return evt;
  }

  function clearLast() {
    setCart((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.qty > 1) {
        return prev.map((x) =>
          x.productId === last.productId ? { ...x, qty: x.qty - 1 } : x,
        );
      }
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
    setCart((prev) => {
      const ex = prev.find((x) => x.productId === product.id);
      const stock = product.stock;
      const canClick = stock === null || typeof stock === 'undefined' || stock > 0;
      if (!canClick) return prev;

      if (!ex) {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            qty: 1,
            color: product.color,
            categoryIds: product.categoryIds ?? [],
            stock,
          },
        ];
      }

      const maxQty = stock === null || typeof stock === 'undefined' ? Number.MAX_SAFE_INTEGER : stock;
      const nextQty = clampQty(ex.qty + 1, 1, maxQty);
      if (nextQty === ex.qty) return prev;
      return prev.map((x) => (x.productId === product.id ? { ...x, qty: nextQty, stock } : x));
    });
  }

  function incQty(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setCart((prev) => prev.map((x) => (x.productId === productId ? { ...x, qty: clampQty(x.qty + 1, 1, p.stock ?? Number.MAX_SAFE_INTEGER) } : x)));
  }

  function decQty(productId) {
    setCart((prev) => prev.map((x) => (x.productId === productId ? { ...x, qty: clampQty(x.qty - 1, 1, x.stock ?? Number.MAX_SAFE_INTEGER) } : x)));
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((x) => x.productId !== productId));
    // Trash click => Toast A1
    toast.show(getString('A1'));
  }

  async function commitSale() {
    const event = await ensureActiveEvent();
    const createdAt = Date.now();
    const taipeiDate = getTaipeiDateKey(new Date(createdAt));
    const time = getTaipeiTimeHMS(new Date(createdAt));

    const payment = selectedPayment ?? { id: 'pm-cash', name: '現金', isCash: true };
    const payments = selectedPayment ? [
      { methodId: payment.id, methodName: payment.name, amount: totalAmount, isCash: payment.isCash },
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
      items: cart.map((it) => ({
        productId: it.productId,
        productName: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
      })),
      subtotal: totalAmount,
      payments,
      depositAlreadyPaid: 0,
      bonusesTriggered: bonuses,
      note: null,
    };

    await db.transaction('rw', db.products, db.transactions, db.preOrders, async () => {
      // 1) Reduce stock (if stock is a number).
      for (const it of cart) {
        if (typeof it.stock === 'number') {
          await db.products.update(it.productId, {
            stock: Math.max(0, (it.stock ?? 0) - it.qty),
          });
        }
      }
      // 2) Write transaction.
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
        toast.show(getString('A3'));
        return;
      }
    }

    setCheckoutPhase('done');

    try {
      const receiptNo = await commitSale();
      await refreshProducts?.();
      // 0.8s animation window
      setTimeout(() => {
        setCart([]);
        setCashInput('0');
        setCheckoutPhase('idle');
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Checkout success => Toast A2 + receipt number
        toast.show(`${getString('A2')}${receiptNo}`);
        setShowCheckout(false);
      }, 800);
    } catch (e) {
      console.error(e);
      setCheckoutPhase('idle');
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

      <div style={styles.headerSpacer} />

      <div style={styles.categoryRow}>
        {categoryTabs.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.name)}
            style={styles.categoryPill(activeCategory === c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div style={styles.productListContainer}>
        <div style={styles.productGrid}>
          {visibleProducts.map((p) => {
            const cartQty = cart.find((x) => x.productId === p.id)?.qty ?? 0;
            return (
              <ProductCard
                key={p.id}
                product={{
                  ...p,
                  stock: typeof p.stock === 'number' ? p.stock : p.stock,
                }}
                cartQty={cartQty}
                nameStyle={{
                  color: '#3F3A46',
                  textShadow: '0 1px 0 rgba(255,255,255,0.55), 0 1px 6px rgba(180,140,220,0.12)',
                }}
                onClick={() => addToCart(p)}
              />
            );
          })}
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
            取消
            <span style={{ display: 'block', fontSize: 10, opacity: 0.65, marginTop: 2 }}>
              長按清全部
            </span>
          </button>
          <button
            type="button"
            style={styles.totalBtn}
            onClick={() => setShowCheckout(true)}
          >
            [{totalQty} 件]　NT${totalAmount}
          </button>
        </div>
      )}

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          products={products}
          totalAmount={totalAmount}
          paymentMethods={paymentMethods}
          selectedPaymentId={selectedPaymentId}
          setSelectedPaymentId={setSelectedPaymentId}
          cashInput={cashInput}
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

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
